-- Migration 0001: Initial schema for the Weave backend indexer.
--
-- Tables:
--   profiles         — indexed view of on-chain ProfileRegistry state
--   ingested_events  — raw event log; unique (tx_hash, event_index) prevents double-ingestion
--   ingestion_cursor — single-row ledger cursor so the worker resumes after restart

-- ── profiles ──────────────────────────────────────────────────────────────────

CREATE TABLE profiles (
    -- u128 exceeds BIGINT range (i64 max). NUMERIC(39,0) accommodates the full
    -- range the contract can produce without silently narrowing the type.
    profile_id      NUMERIC(39, 0) PRIMARY KEY,
    owner           TEXT          NOT NULL,
    handle          TEXT          NOT NULL,
    metadata_uri    TEXT          NOT NULL DEFAULT '',
    -- Ledger timestamp (unix seconds) from the profile_registered event payload.
    created_at_ts   BIGINT        NOT NULL,
    indexed_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Case-insensitive handle uniqueness index (mirrors contract's normalized storage).
CREATE UNIQUE INDEX idx_profiles_handle ON profiles (lower(handle));

-- ── ingested_events ────────────────────────────────────────────────────────────

-- Raw event log. The unique constraint on (tx_hash, event_index) is the baseline
-- idempotency guard: re-processing the same event (e.g. after a worker restart)
-- will hit ON CONFLICT DO NOTHING and not double-write. Advanced replay/reorg
-- handling is out of scope for this task.
CREATE TABLE ingested_events (
    id          BIGSERIAL   PRIMARY KEY,
    tx_hash     TEXT        NOT NULL,
    event_index INT         NOT NULL,
    ledger      BIGINT      NOT NULL,
    topic       TEXT        NOT NULL,
    raw_data    JSONB       NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tx_hash, event_index)
);

-- ── ingestion_cursor ───────────────────────────────────────────────────────────

-- Single-row table. The CHECK constraint enforces the singleton invariant so
-- concurrent workers can't accidentally insert a second row.
CREATE TABLE ingestion_cursor (
    id          INT     PRIMARY KEY DEFAULT 1,
    last_ledger BIGINT  NOT NULL,
    CONSTRAINT single_row CHECK (id = 1)
);

-- Seed with 0; the worker interprets 0 as "first run, start from START_LEDGER".
INSERT INTO ingestion_cursor (id, last_ledger) VALUES (1, 0);
