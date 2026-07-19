//! Background ingestion worker.
//!
//! Polls the Soroban RPC for `ProfileRegistry` events, decodes them, and
//! writes the decoded state into Postgres. Runs forever; errors on individual
//! events are logged and skipped so one bad event can't halt ingestion.
//!
//! ## Resume behaviour
//!
//! On startup the worker reads `ingestion_cursor.last_ledger`. If 0 (first
//! run), it starts from `Config::start_ledger` if non-zero, or falls back to
//! `current_ledger - DEFAULT_LOOKBACK_LEDGERS` (~83 minutes) to avoid
//! scanning from genesis. After each batch the cursor is advanced to cover the
//! full range polled, even if no events were found, so empty ranges are never
//! re-scanned.
//!
//! ## Idempotency
//!
//! `db::insert_ingested_event` uses ON CONFLICT DO NOTHING on
//! (tx_hash, event_index). If the worker restarts mid-batch, any events
//! already in `ingested_events` return `false` from that function and the
//! state-update step is skipped. Profile inserts also use ON CONFLICT DO
//! NOTHING, making the whole pipeline safe to re-run.

use std::sync::Arc;

use anyhow::{Context, Result};
use bigdecimal::BigDecimal;
use serde_json::json;
use sqlx::PgPool;
use stellar_rpc_client::{Client as RpcClient, EventStart, EventType};
use tokio::time::{Duration, sleep};
use tracing::{debug, error, info, warn};

use crate::config::Config;
use crate::db;
use crate::parse::{
    EventTopic, decode_follow_event_value, decode_profile_id,
    decode_profile_meta_updated_value, decode_profile_owner_transferred_value,
    decode_profile_registered_value, decode_topic_name,
};

/// Maximum events to fetch per RPC call. The server caps this at 10 000;
/// 200 keeps batches snappy while staying well under the limit.
const BATCH_LIMIT: usize = 200;

/// How far back to look on first run when START_LEDGER = 0.
const DEFAULT_LOOKBACK_LEDGERS: u32 = 1_000;

/// Entry point — called from `main.rs` inside `tokio::spawn`.
pub async fn run(pool: Arc<PgPool>, cfg: Arc<Config>) -> Result<()> {
    let rpc =
        RpcClient::new(&cfg.soroban_rpc_url).context("failed to create Soroban RPC client")?;

    info!("Ingestion worker started");

    loop {
        match tick(&rpc, &pool, &cfg).await {
            Ok(events_processed) => {
                if events_processed > 0 {
                    info!(events_processed, "Batch complete");
                } else {
                    debug!("No new events — sleeping");
                }
            }
            Err(e) => {
                error!(
                    error = %e,
                    "Error during ingestion tick — will retry after poll interval"
                );
            }
        }

        sleep(Duration::from_secs(cfg.poll_interval_seconds)).await;
    }
}

/// One poll-and-process cycle. Returns the number of events processed.
async fn tick(rpc: &RpcClient, pool: &PgPool, cfg: &Config) -> Result<usize> {
    let last_ledger = db::get_cursor(pool).await?;

    let start_ledger: u32 = if last_ledger == 0 {
        if cfg.start_ledger > 0 {
            cfg.start_ledger
        } else {
            let latest = rpc
                .get_latest_ledger()
                .await
                .context("failed to get latest ledger for first-run default")?;
            latest
                .sequence
                .saturating_sub(DEFAULT_LOOKBACK_LEDGERS)
                .max(1)
        }
    } else {
        (last_ledger as u32).saturating_add(1)
    };

    let latest = rpc
        .get_latest_ledger()
        .await
        .context("failed to get latest ledger")?;
    let end_ledger = latest.sequence;

    if start_ledger > end_ledger {
        return Ok(0);
    }

    let event_start = EventStart::ledger_range(start_ledger, end_ledger)
        .map_err(|e| anyhow::anyhow!("invalid ledger range: {}", e))?;

    // Poll ProfileRegistry events.
    info!(
        start_ledger,
        end_ledger,
        contract_id = %cfg.profile_registry_contract_id,
        "Polling ProfileRegistry events"
    );
    let pr_resp = rpc
        .get_events(
            event_start.clone(),
            Some(EventType::Contract),
            std::slice::from_ref(&cfg.profile_registry_contract_id),
            &[],
            Some(BATCH_LIMIT),
        )
        .await
        .context("getEvents RPC call failed (ProfileRegistry)")?;

    // Poll FollowGraph events.
    info!(
        start_ledger,
        end_ledger,
        contract_id = %cfg.follow_graph_contract_id,
        "Polling FollowGraph events"
    );
    let fg_resp = rpc
        .get_events(
            event_start,
            Some(EventType::Contract),
            std::slice::from_ref(&cfg.follow_graph_contract_id),
            &[],
            Some(BATCH_LIMIT),
        )
        .await
        .context("getEvents RPC call failed (FollowGraph)")?;

    let all_events: Vec<_> = pr_resp
        .events
        .into_iter()
        .chain(fg_resp.events.into_iter())
        .collect();

    let event_count = all_events.len();
    info!(start_ledger, end_ledger, event_count, "Received events from RPC");

    let mut processed = 0usize;

    for event in &all_events {
        if event.topic.is_empty() {
            warn!(event_id = %event.id, "Event has no topics — skipping");
            continue;
        }

        let topic_name = match decode_topic_name(&event.topic[0]) {
            Ok(t) => t,
            Err(e) => {
                warn!(error = %e, event_id = %event.id, "Failed to decode topic[0] — skipping");
                continue;
            }
        };

        let topic_str = match &topic_name {
            EventTopic::ProfileRegistered => "profile_registered",
            EventTopic::ProfileMetaUpdated => "profile_meta_updated",
            EventTopic::ProfileOwnerTransferred => "profile_owner_xfrd",
            EventTopic::FollowCreated => "follow_created",
            EventTopic::FollowRemoved => "follow_removed",
            EventTopic::Unknown(name) => {
                debug!(name, event_id = %event.id, "Unknown event topic — skipping");
                continue;
            }
        };

        let tx_hash = event.tx_hash.as_deref().unwrap_or("unknown");
        // Event id format: "<ledger>-<tx_index>-<op_index>-<event_index>"
        let event_index: i32 = event
            .id
            .rsplit('-')
            .next()
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        let event_ledger = event.ledger as i64;

        let raw_data = json!({
            "id": event.id,
            "ledger": event.ledger,
            "tx_hash": tx_hash,
            "topic": event.topic,
            "value": event.value,
        });

        if let Err(e) = process_event(
            pool,
            &topic_name,
            topic_str,
            &event.topic,
            &event.value,
            tx_hash,
            event_index,
            event_ledger,
            &raw_data,
        )
        .await
        {
            error!(
                error = %e,
                event_id = %event.id,
                topic = topic_str,
                "Failed to process event — skipping"
            );
            continue;
        }

        processed += 1;
    }

    // Advance the cursor to cover the full ledger range we polled, even if
    // there were no events in it, so we never re-scan empty ranges.
    if (end_ledger as i64) > last_ledger {
        let mut tx = pool.begin().await?;
        db::set_cursor(&mut tx, end_ledger as i64).await?;
        tx.commit().await?;
        debug!(cursor = end_ledger, "Cursor advanced");
    }

    Ok(processed)
}

/// Process one event: decode payload and write to DB in a single transaction.
#[allow(clippy::too_many_arguments)]
async fn process_event(
    pool: &PgPool,
    topic_name: &EventTopic,
    topic_str: &str,
    topics: &[String],
    value_b64: &str,
    tx_hash: &str,
    event_index: i32,
    ledger: i64,
    raw_data: &serde_json::Value,
) -> Result<()> {
    let mut db_tx = pool.begin().await?;

    // Insert the raw event record. Returns false if this event was already seen
    // (worker restart scenario) — in that case skip the state update entirely.
    let is_new = db::insert_ingested_event(
        &mut db_tx,
        tx_hash,
        event_index,
        ledger,
        topic_str,
        raw_data,
    )
    .await?;

    if !is_new {
        debug!(
            tx_hash,
            event_index,
            topic = topic_str,
            "Event already ingested — skipping duplicate"
        );
        db_tx.rollback().await?;
        return Ok(());
    }

    match topic_name {
        // ── ProfileRegistry events ── topic[1] carries profile_id ─────────────
        EventTopic::ProfileRegistered
        | EventTopic::ProfileMetaUpdated
        | EventTopic::ProfileOwnerTransferred => {
            let profile_id_raw = decode_profile_id(
                topics.get(1).context("profile event missing topic[1]")?,
            )
            .context("failed to decode profile_id from topic[1]")?;
            let profile_id = u128_to_bigdecimal(profile_id_raw);

            match topic_name {
                EventTopic::ProfileRegistered => {
                    let (owner, handle) = decode_profile_registered_value(value_b64)
                        .context("failed to decode profile_registered value")?;

                    // `created_at` is in contract storage but not in the event payload.
                    // Store 0 as sentinel; ledger timestamp is a reasonable proxy.
                    db::upsert_profile(&mut db_tx, &profile_id, &owner, &handle, "", 0).await?;

                    info!(
                        profile_id = profile_id_raw,
                        owner = %owner,
                        handle = %handle,
                        ledger,
                        "Ingested profile_registered"
                    );
                }

                EventTopic::ProfileMetaUpdated => {
                    let new_uri = decode_profile_meta_updated_value(value_b64)
                        .context("failed to decode profile_meta_updated value")?;

                    db::update_profile_metadata(&mut db_tx, &profile_id, &new_uri).await?;

                    info!(
                        profile_id = profile_id_raw,
                        new_uri = %new_uri,
                        ledger,
                        "Ingested profile_meta_updated"
                    );
                }

                EventTopic::ProfileOwnerTransferred => {
                    let new_owner = decode_profile_owner_transferred_value(value_b64)
                        .context("failed to decode profile_owner_xfrd value")?;

                    db::update_profile_owner(&mut db_tx, &profile_id, &new_owner).await?;

                    info!(
                        profile_id = profile_id_raw,
                        new_owner = %new_owner,
                        ledger,
                        "Ingested profile_owner_xfrd"
                    );
                }

                _ => unreachable!(),
            }
        }

        // ── FollowGraph events ── both IDs are in the value payload ────────────
        EventTopic::FollowCreated => {
            let (follower_raw, followee_raw) = decode_follow_event_value(value_b64)
                .context("failed to decode follow_created value")?;
            let follower_id = u128_to_bigdecimal(follower_raw);
            let followee_id = u128_to_bigdecimal(followee_raw);

            db::insert_follow(&mut db_tx, &follower_id, &followee_id, ledger).await?;

            info!(
                follower = follower_raw,
                followee = followee_raw,
                ledger,
                "Ingested follow_created"
            );
        }

        EventTopic::FollowRemoved => {
            let (follower_raw, followee_raw) = decode_follow_event_value(value_b64)
                .context("failed to decode follow_removed value")?;
            let follower_id = u128_to_bigdecimal(follower_raw);
            let followee_id = u128_to_bigdecimal(followee_raw);

            db::delete_follow(&mut db_tx, &follower_id, &followee_id).await?;

            info!(
                follower = follower_raw,
                followee = followee_raw,
                ledger,
                "Ingested follow_removed"
            );
        }

        EventTopic::Unknown(_) => unreachable!("filtered above"),
    }

    db_tx.commit().await?;
    Ok(())
}

/// Convert a `u128` to a `BigDecimal` for NUMERIC(39,0) storage.
/// Parses from the decimal string representation since BigDecimal does not
/// implement From<u128> directly.
fn u128_to_bigdecimal(val: u128) -> BigDecimal {
    val.to_string()
        .parse()
        .expect("u128 decimal string is always valid BigDecimal")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_u128_to_bigdecimal_one() {
        assert_eq!(u128_to_bigdecimal(1).to_string(), "1");
    }

    #[test]
    fn test_u128_to_bigdecimal_max() {
        assert_eq!(
            u128_to_bigdecimal(u128::MAX).to_string(),
            u128::MAX.to_string()
        );
    }
}
