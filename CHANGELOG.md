# Changelog

All notable changes to this project will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] — v2 contracts built, testnet deployment pending

### Breaking Changes

- **ProfileRegistry: `Profile.follower_count` and `Profile.following_count` removed.**
  These fields were permanently zero in v1 (no mutation entrypoint existed in the deployed
  contract). Removing them eliminates a footgun; real counts are in `FollowGraph`. Any code
  reading these fields must be updated to call `FollowGraph.get_follower_count` /
  `get_following_count` instead.

- **ProfileRegistry: event names changed.**
  The generic `profile_updated` event (with a `field` discriminator) is replaced by two
  distinct events that carry the new value inline:
  - `profile_meta_updated` — emitted by `update_metadata`, payload: `(profile_id, new_metadata_uri)`
  - `profile_owner_xfrd` — emitted by `transfer_ownership`, payload: `(profile_id, new_owner)`
  Any backend/indexer parsing the old `profile_updated` topic must be updated (the backend
  in this repo has been updated as part of this change).

### Added

- `ProfileRegistry.upgrade(new_wasm_hash)` — admin-authenticated Wasm upgrade entrypoint.
  Auth is checked against the admin address stored in contract state, not a caller-supplied
  parameter (the caller-supplied-admin pattern is a documented Soroban exploit vector).
- `ProfileRegistry.version()` → `2`
- `FollowGraph.upgrade(new_wasm_hash)` — same pattern as ProfileRegistry.
- `FollowGraph.version()` → `2`
- 6 new tests across the two contracts: upgrade-by-admin succeeds, upgrade-by-non-admin
  fails, upgrade-to-self preserves state (×2), version returns 2 (×2).
- `DEPLOYMENT.v1.md` in both contract directories — preserves v1 proof-of-work history
  with a deprecation banner pointing to the current v2 docs.

### Changed

- `FollowGraph.contractimport!` hash updated to pin ProfileRegistry v2 WASM.
- Backend `parse.rs`: `EventTopic::ProfileUpdated` replaced by `ProfileMetaUpdated` and
  `ProfileOwnerTransferred`; new decode functions for v2 Vec-tuple payloads.
- Backend `ingest.rs`: `process_event` now writes `new_metadata_uri` and `new_owner`
  directly from event payloads — removes the stale-data workaround that only bumped
  `updated_at`.
- Backend `db.rs`: `update_profile_owner` is now called (removed `#[allow(dead_code)]`).
- `backend/.env` and `backend/.env.example`: contract ID placeholder updated to prompt
  for v2 ID post-deploy.
- `frontend/.env.local` and `frontend/.env.example`: both contract IDs updated to
  placeholders pending post-deploy client regeneration.
- Dead workspace stub `contracts/src/lib.rs` removed (issue #1).
- `README.md` deployed contracts table updated to v2; v1 history linked, not erased.
- Total test count: 47 (25 ProfileRegistry + 22 FollowGraph), up from 37.

### Why this was a coordinated breaking redeploy, not a patch

Both contracts were already deployed as immutable Wasm on testnet. The two design flaws
(`follower_count`/`following_count` dead fields; event payloads missing new values) could
not be fixed in the live contracts — Soroban contracts are immutable after deployment.
The v1 contracts remain live on testnet as historical records. v2 contracts start fresh.
This is the right time to do this: testnet only, no real users, no value at stake.

---

## [0.1.0] — 2026-07-12 — Initial deployment

### Added

- `ProfileRegistry` v1 deployed to testnet (`CAVUZWNQ...MZO7ZLDU`).
  Functions: `register`, `get_profile`, `resolve_handle`, `update_metadata`,
  `transfer_ownership`. 19 unit tests.
- `FollowGraph` v1 deployed to testnet (`CBO2USOJ...T5DSO5BOR`).
  Functions: `follow`, `unfollow`, `is_following`, `get_followers`, `get_following`,
  `get_follower_count`, `get_following_count`. 18 unit tests.
- Live end-to-end proof: profile 1 followed profile 2 on testnet
  ([tx](https://stellar.expert/explorer/testnet/tx/35c06183c749f0d9980b494b00b041a9e55d0293018d318ac75e71e9b200205b)).
- `/demo` frontend page: connect wallet → register profile → follow profile, against live
  testnet contracts. Supports Freighter, xBull, Albedo, Lobstr, Hana via Stellar Wallets Kit.
- Backend Axum server: `GET /health`, `GET /profiles/:id`.
- Backend ingestion worker: polls ProfileRegistry events, decodes XDR, writes to Postgres
  with idempotency guard (`UNIQUE(tx_hash, event_index) ON CONFLICT DO NOTHING`).
- Postgres schema: `profiles`, `ingested_events`, `ingestion_cursor` tables.
