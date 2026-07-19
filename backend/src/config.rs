//! Runtime configuration loaded from environment variables.
//!
//! All values are read from the process environment (populated from `.env` by
//! `dotenvy` before this module is called). Missing required variables produce
//! a clear error message rather than a panic.

use anyhow::{Context, Result};

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub soroban_rpc_url: String,
    pub profile_registry_contract_id: String,
    /// Ledger to start ingestion from on the very first run (cursor = 0).
    /// Set to 0 to use the contract's deployment ledger (worker will detect
    /// "start from beginning" and fetch the latest ledger minus a small buffer).
    /// Defaults to 0 if not set.
    pub start_ledger: u32,
    /// Seconds between RPC polls. Defaults to 5 (one Stellar ledger close time).
    pub poll_interval_seconds: u64,
    /// TCP port for the HTTP server. Defaults to 3001.
    pub port: u16,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let database_url = std::env::var("DATABASE_URL")
            .context("DATABASE_URL must be set (e.g. postgres://localhost:5432/weave)")?;

        let soroban_rpc_url = std::env::var("SOROBAN_RPC_URL")
            .unwrap_or_else(|_| "https://soroban-testnet.stellar.org".to_string());

        let profile_registry_contract_id = std::env::var("PROFILE_REGISTRY_CONTRACT_ID")
            .unwrap_or_else(|_| {
                "CCMV3J6W52JIZJVVX2YYBEALROVROU7KTDBLVSUYYMTLDTFJHXXPOKKP".to_string()
            });

        let start_ledger: u32 = std::env::var("START_LEDGER")
            .unwrap_or_else(|_| "0".to_string())
            .parse()
            .context("START_LEDGER must be a non-negative integer")?;

        let poll_interval_seconds: u64 = std::env::var("POLL_INTERVAL_SECONDS")
            .unwrap_or_else(|_| "5".to_string())
            .parse()
            .context("POLL_INTERVAL_SECONDS must be a non-negative integer")?;

        let port: u16 = std::env::var("PORT")
            .unwrap_or_else(|_| "3001".to_string())
            .parse()
            .context("PORT must be a valid port number (0–65535)")?;

        Ok(Self {
            database_url,
            soroban_rpc_url,
            profile_registry_contract_id,
            start_ledger,
            poll_interval_seconds,
            port,
        })
    }
}
