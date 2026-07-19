//! Weave backend — Axum HTTP server + ProfileRegistry event ingestion worker.
//!
//! Startup sequence:
//!   1. Load .env, init tracing.
//!   2. Connect to Postgres, run pending migrations.
//!   3. Spawn the ingestion worker as a background task.
//!   4. Bind the Axum router on PORT (default 3001).
//!
//! Both the worker and the HTTP server run concurrently. If either exits with
//! an error the process logs and exits non-zero so a supervisor can restart.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::Router;
use sqlx::postgres::PgPoolOptions;
use tracing::{error, info};
use tracing_subscriber::{EnvFilter, fmt};

mod config;
mod db;
mod ingest;
mod parse;
mod routes;

pub use config::Config;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env before anything else so env vars are visible to all initialisation.
    // ok() — not fatal if .env is absent (production may inject env vars directly).
    dotenvy::dotenv().ok();

    // Structured logging. RUST_LOG controls the filter; default to info.
    fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let cfg = Config::from_env()?;
    info!(
        rpc_url = %cfg.soroban_rpc_url,
        profile_registry_id = %cfg.profile_registry_contract_id,
        follow_graph_id = %cfg.follow_graph_contract_id,
        poll_interval_s = cfg.poll_interval_seconds,
        start_ledger = cfg.start_ledger,
        "Weave backend starting"
    );

    // Connect to Postgres and run any pending migrations automatically.
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&cfg.database_url)
        .await?;
    info!("Connected to Postgres");

    sqlx::migrate!("./migrations").run(&pool).await?;
    info!("Migrations applied");

    let pool = Arc::new(pool);
    let cfg = Arc::new(cfg);

    // Spawn the ingestion worker. It runs forever polling the Soroban RPC;
    // errors are logged but do not kill the HTTP server.
    let worker_pool = Arc::clone(&pool);
    let worker_cfg = Arc::clone(&cfg);
    tokio::spawn(async move {
        if let Err(e) = ingest::run(worker_pool, worker_cfg).await {
            error!(error = %e, "Ingestion worker exited with error");
        }
    });

    // Build and bind the Axum router.
    let app: Router = routes::router(Arc::clone(&pool));
    let addr: SocketAddr = format!("0.0.0.0:{}", cfg.port).parse()?;
    info!(%addr, "HTTP server listening");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
