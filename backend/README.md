# Weave Backend

An Axum HTTP service that ingests `ProfileRegistry` and `FollowGraph` events from
Stellar testnet and serves the resulting state over a REST API.

## What this is

The backend is the "Query / Indexing Layer" in Weave's architecture — it listens
to on-chain events from the deployed Soroban contracts and writes them into
Postgres, making profile and social-graph data queryable without hitting the RPC
on every read.

**What's implemented:**

- Postgres schema (4 tables: `profiles`, `follows`, `ingested_events`, `ingestion_cursor`)
- Background ingestion worker — polls Soroban RPC `getEvents` for both
  `ProfileRegistry` and `FollowGraph`, decodes XDR event payloads, writes state
- Handles `profile_registered`, `profile_meta_updated`, `profile_owner_xfrd`,
  `follow_created`, and `follow_removed` events
- Ledger cursor in Postgres so the worker resumes correctly after restarts
- `GET /health` endpoint
- `GET /profiles/:profile_id` endpoint
- `GET /profiles/:profile_id/followers` endpoint — returns `[]` (not 404) for zero followers
- `GET /profiles/:profile_id/following` endpoint
- Unit tests for all XDR decoding logic (21 tests, no network/DB required)
- Integration tests (disabled by default, require Postgres + `DATABASE_URL`)

**Explicitly out of scope / not yet started:**

- GraphQL API layer (issues #41–45)
- `tx_builder` module for server-side transaction construction (issues #24–26)
- Advanced reorg handling / exactly-once semantics beyond the unique-constraint guard
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

**Important — set `START_LEDGER` before first run.**
The default `START_LEDGER=0` only looks back ~1000 ledgers (~83 minutes). To
ingest the full history including the demo follow relationship, leave `START_LEDGER=0`
— the v2 contracts were deployed recently enough that the default lookback covers them.
For an explicit full-history ingest from the v2 deployment ledger, set `START_LEDGER`
to the ledger number shown in the DEPLOYMENT.md files.

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
| `PROFILE_REGISTRY_CONTRACT_ID` | `CCMV3J6W...` (v2) | ProfileRegistry contract to ingest |
| `FOLLOW_GRAPH_CONTRACT_ID` | `CDNMUIWW...` (v2) | FollowGraph contract to ingest |
| `START_LEDGER` | `0` | Ledger to start from on first run. `0` = tip minus 1000 ledgers (~83 min lookback). Set to the v2 deployment ledger for a full historical ingest. |
| `POLL_INTERVAL_SECONDS` | `5` | Seconds between RPC polls (matches ledger close time) |
| `PORT` | `3001` | HTTP server port |

---

## Schema

Defined in `migrations/0001_init.sql` and `migrations/0002_add_follows.sql`.

**`profiles`** — indexed view of on-chain `ProfileRegistry` state.

| Column | Type | Notes |
|---|---|---|
| `profile_id` | `NUMERIC(39,0)` | u128 — exceeds BIGINT range |
| `owner` | `TEXT` | Stellar strkey (G...) |
| `handle` | `TEXT` | Lowercase-normalized |
| `metadata_uri` | `TEXT` | IPFS/Arweave URI; empty string until set |
| `created_at_ts` | `BIGINT` | Ledger timestamp (unix seconds); 0 if not enriched |
| `indexed_at` | `TIMESTAMPTZ` | When the row was first written |
| `updated_at` | `TIMESTAMPTZ` | Bumped on every metadata/owner update event |

**`follows`** — directed follow edges derived from `FollowGraph` events.

| Column | Type | Notes |
|---|---|---|
| `follower_id` | `NUMERIC(39,0)` | u128 profile ID of the follower |
| `followee_id` | `NUMERIC(39,0)` | u128 profile ID being followed |
| `created_at_ts` | `BIGINT` | Ledger number at ingestion time |
| `indexed_at` | `TIMESTAMPTZ` | When the row was written |

Primary key is `(follower_id, followee_id)`. Indexed on both columns for fast
"who follows X" and "who does X follow" queries. `follow_removed` events DELETE
the row — no soft-delete.

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

### `GET /profiles/:profile_id/followers`

Returns all profiles that follow `profile_id`, ordered by `created_at_ts` ascending.
Returns `[]` (not 404) when the profile has zero followers.

**200 OK:**
```json
[
  {"follower_id": "1", "followee_id": "2", "created_at_ts": 1752345678}
]
```

### `GET /profiles/:profile_id/following`

Returns all profiles that `profile_id` follows, ordered by `created_at_ts` ascending.
Returns `[]` (not 404) when the profile follows nobody.

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

## Troubleshooting

### Profiles or follows not appearing — worker polling the wrong ledger range

If `GET /profiles/1` returns 404 or `GET /profiles/2/followers` returns `[]`
after the worker has been running for a while, check where the cursor is:

```bash
psql $DATABASE_URL -c "SELECT last_ledger FROM ingestion_cursor;"
```

If `last_ledger` is near the current tip and past the v2 deployment ledgers,
reset the cursor to re-ingest from the beginning:

```bash
psql $DATABASE_URL -c "UPDATE ingestion_cursor SET last_ledger = 0;"
cargo run
```

This is safe — `ON CONFLICT DO NOTHING` guards on all tables prevent double-ingestion.

### Confirming a successful ingest

After startup you should see log lines like:

```
INFO backend::ingest: Ingested profile_registered profile_id=1 handle=weave_dev
INFO backend::ingest: Ingested profile_registered profile_id=2 handle=weave_graph_demo
INFO backend::ingest: Ingested follow_created follower=1 followee=2
INFO backend::ingest: Batch complete events_processed=3
```

Then verify:

```bash
curl http://localhost:3001/profiles/1
curl http://localhost:3001/profiles/2/followers
# → [{"follower_id":"1","followee_id":"2","created_at_ts":...}]
```

---

## Known limitations

- `created_at_ts` in `profiles` is stored as `0` — the ledger timestamp is in
  `Profile` struct storage but not in the event payload. Backfill via a follow-up
  `get_profile` RPC call is a planned improvement.
- The ingestion worker processes up to 200 events per poll per contract. For a
  high-volume catch-up, the first few polls will each process 200 events until
  caught up.
