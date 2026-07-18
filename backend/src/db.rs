//! Database query helpers.
//!
//! All queries live here so `ingest.rs` and `routes.rs` stay focused on their
//! own concerns. Callers receive typed structs; raw SQL is confined here.
//!
//! ## Why runtime queries instead of `sqlx::query!` macros?
//!
//! The compile-time `query!` macros require `DATABASE_URL` to be set at build
//! time (or a pre-generated `.sqlx` cache via `cargo sqlx prepare`). To keep
//! `cargo build` working without a running Postgres — essential for CI and new
//! contributor onboarding — we use the runtime query API throughout.
//!
//! The trade-off is losing compile-time column-type verification. We mitigate
//! this by keeping queries simple, using explicit `FromRow` derives, and
//! running the integration tests against a real DB in CI.

use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;

/// Row shape returned by `GET /profiles/:id`.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ProfileRow {
    pub profile_id: BigDecimal,
    pub owner: String,
    pub handle: String,
    pub metadata_uri: String,
    pub created_at_ts: i64,
    pub indexed_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Fetch a single profile by its numeric ID.
/// Returns `None` if no row exists.
pub async fn get_profile(
    pool: &PgPool,
    profile_id: &BigDecimal,
) -> Result<Option<ProfileRow>, sqlx::Error> {
    sqlx::query_as::<_, ProfileRow>(
        r#"
        SELECT profile_id, owner, handle, metadata_uri, created_at_ts, indexed_at, updated_at
        FROM profiles
        WHERE profile_id = $1
        "#,
    )
    .bind(profile_id)
    .fetch_optional(pool)
    .await
}

/// Read the current ingestion cursor (last processed ledger).
/// Returns 0 if the cursor row is absent (defensive; migration always seeds it).
pub async fn get_cursor(pool: &PgPool) -> Result<i64, sqlx::Error> {
    let row: Option<(i64,)> =
        sqlx::query_as("SELECT last_ledger FROM ingestion_cursor WHERE id = 1")
            .fetch_optional(pool)
            .await?;
    Ok(row.map(|(v,)| v).unwrap_or(0))
}

/// Advance the cursor to `ledger` atomically inside an open transaction.
pub async fn set_cursor(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ledger: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE ingestion_cursor SET last_ledger = $1 WHERE id = 1")
        .bind(ledger)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// Insert a new profile row.
/// ON CONFLICT (profile_id) DO NOTHING makes this safe to replay.
pub async fn upsert_profile(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    profile_id: &BigDecimal,
    owner: &str,
    handle: &str,
    metadata_uri: &str,
    created_at_ts: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO profiles (profile_id, owner, handle, metadata_uri, created_at_ts)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (profile_id) DO NOTHING
        "#,
    )
    .bind(profile_id)
    .bind(owner)
    .bind(handle)
    .bind(metadata_uri)
    .bind(created_at_ts)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Update `metadata_uri` for an existing profile and bump `updated_at`.
pub async fn update_profile_metadata(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    profile_id: &BigDecimal,
    metadata_uri: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE profiles
        SET metadata_uri = $2, updated_at = now()
        WHERE profile_id = $1
        "#,
    )
    .bind(profile_id)
    .bind(metadata_uri)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Update `owner` for an existing profile and bump `updated_at`.
/// Not yet called in the ingestion worker (profile_updated events do not carry
/// the new value inline — enrichment from RPC is a future task).
#[allow(dead_code)]
pub async fn update_profile_owner(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    profile_id: &BigDecimal,
    new_owner: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE profiles
        SET owner = $2, updated_at = now()
        WHERE profile_id = $1
        "#,
    )
    .bind(profile_id)
    .bind(new_owner)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Insert a raw event log row.
/// ON CONFLICT (tx_hash, event_index) DO NOTHING is the baseline idempotency
/// guard. Returns `true` if the row was newly inserted, `false` if it already
/// existed (meaning this event was already processed).
pub async fn insert_ingested_event(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tx_hash: &str,
    event_index: i32,
    ledger: i64,
    topic: &str,
    raw_data: &serde_json::Value,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"
        INSERT INTO ingested_events (tx_hash, event_index, ledger, topic, raw_data)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (tx_hash, event_index) DO NOTHING
        "#,
    )
    .bind(tx_hash)
    .bind(event_index)
    .bind(ledger)
    .bind(topic)
    .bind(raw_data)
    .execute(&mut **tx)
    .await?;
    Ok(result.rows_affected() > 0)
}
