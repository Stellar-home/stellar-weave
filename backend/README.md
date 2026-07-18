# Weave Backend

An Axum HTTP service that ingests `ProfileRegistry` events from Stellar testnet
and serves the resulting state over a REST API.

## What this is

The backend is the "Query / Indexing Layer" in Weave's architecture — it listens
to on-chain events from the deployed `ProfileRegistry` Soroban contract and
writes them into Postgres, making profile data queryable without hitting the RPC
on every read.

**What's implemented in this task:**

- Postgres schema (3 tables: `profiles`, `ingested_events`, `ingestion_cursor`)
- Background ingestion worker — polls Soroban RPC `getEvents`, decodes XDR
  event payloads, writes `profile_registered` and `profile_updated` events
- Ledger cursor in Postgres so the worker resumes correctly after restarts
- `GET /health` endpoint
- `GET /profiles/:profile_id` endpoint
- Unit tests for all XDR decoding logic (14 tests, no network/DB required)
- Integration tests (disabled by default, require Postgres + `DATABASE_URL`)

**Explicitly out of scope for this task (separate issues):**

- `FollowGraph` event ingestion (`follow_created` / `follow_removed`)
- GraphQL API layer
- Advanced idempotency (reorg handling, exactly-once semantics beyond the
  unique-constraint guard already in place)
- `tx_builder` module for server-side transaction construction
- Production deployment / hosting

---

## Local setup

### 1. Start Postgres

```bash
docker run --name weave-pg \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:16
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env if your Postgres URL differs from the default
```

### 3. Run migrations

```bash
cargo install sqlx-cli --no-default-features --features postgres
sqlx database create
sqlx migrate run
```

### 4. Start the service

```bash
cargo run
```

The server listens on `http://localhost:3001` by default.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | **required** | Postgres connection string |
| `SOROBAN_RPC_URL` | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint |
| `PROFILE_REGISTRY_CONTRACT_ID` | `CAVUZWNQ...` | ProfileRegistry contract to ingest |
| `START_LEDGER` | `0` | Ledger to start from on first run. `0` = tip minus 1000 ledgers. |
| `POLL_INTERVAL_SECONDS` | `5` | Seconds between RPC polls (matches ledger close time) |
| `PORT` | `3001` | HTTP server port |

---

## Schema

Defined in `migrations/0001_init.sql`.

**`profiles`** — indexed view of on-chain `ProfileRegistry` state.

| Column | Type | Notes |
|---|---|---|
| `profile_id` | `NUMERIC(39,0)` | u128 — exceeds BIGINT range |
| `owner` | `TEXT` | Stellar strkey (G...) |
| `handle` | `TEXT` | Lowercase-normalized |
| `metadata_uri` | `TEXT` | IPFS/Arweave URI; empty string until set |
| `created_at_ts` | `BIGINT` | Ledger timestamp (unix seconds); 0 if not enriched |
| `indexed_at` | `TIMESTAMPTZ` | When the row was first written |
| `updated_at` | `TIMESTAMPTZ` | Bumped on every `profile_updated` event |

**`ingested_events`** — raw event log. Unique on `(tx_hash, event_index)` — this
is the baseline idempotency guard that prevents double-ingestion on worker
restart.

**`ingestion_cursor`** — single-row table holding `last_ledger`. The worker reads
this on startup and resumes from `last_ledger + 1`, then advances the cursor
after each batch.

---

## API

### `GET /health`

```
200 OK
{"status":"ok"}
```

### `GET /profiles/:profile_id`

`:profile_id` is a decimal integer (e.g. `1`).

**200 OK** (profile found):
```json
{
  "profile_id": "1",
  "owner": "GALDKWEV7OOWI45GUJT3X6LKNER6IBRK6RB5BZGE776HZ2RPBFSZHNRB",
  "handle": "weave_dev",
  "metadata_uri": "",
  "created_at_ts": 0,
  "indexed_at": "2026-07-18T01:00:00Z",
  "updated_at": "2026-07-18T01:00:00Z"
}
```

**404 Not Found** (profile not yet ingested or doesn't exist):
```json
{"error":"profile not found"}
```

---

## Testing

Unit tests (no Postgres required):
```bash
cargo test
```

Integration tests (require Postgres with migrations applied):
```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/weave \
  cargo test -- --ignored
```

---

## Known limitations

- `profile_updated` events bump `updated_at` but do not yet write the new
  `metadata_uri` or `owner` value. The event body only carries the field name,
  not the new value. Enrichment via a follow-up `get_profile` RPC call is a
  planned improvement (separate issue).
- `created_at_ts` is stored as `0` — the ledger timestamp is in `Profile` struct
  storage but not in the event body. Backfill via `get_profile` is a planned
  improvement.
- The ingestion worker processes up to 200 events per poll. For a high-volume
  catch-up from a very old `START_LEDGER`, the first few polls will each process
  200 events until caught up. This is intentional; increase `BATCH_LIMIT` in
  `ingest.rs` if faster catch-up is needed.
