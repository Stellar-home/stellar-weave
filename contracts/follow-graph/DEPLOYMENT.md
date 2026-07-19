# FollowGraph v2 — Deployment Reference

> For the v1 deployment history (contract `CBO2USOJ...T5DSO5BOR`, deployed 2026-07-12),
> see [`DEPLOYMENT.v1.md`](./DEPLOYMENT.v1.md).

## Testnet Deployment

| Field | Value |
|---|---|
| **Contract ID** | `CDNMUIWW6X565R2SWQNUGIQGDNLZA3QPNHO5YDA7YRXAB6PEICQH7ZHS` |
| **Network** | Stellar Testnet (`Test SDF Network ; September 2015`) |
| **Deployed by** | `GALDKWEV7OOWI45GUJT3X6LKNER6IBRK6RB5BZGE776HZ2RPBFSZHNRB` (alias: `alice`) |
| **Admin** | `GALDKWEV7OOWI45GUJT3X6LKNER6IBRK6RB5BZGE776HZ2RPBFSZHNRB` |
| **Deployed at** | 2026-07-19 |
| **WASM hash** | `d8c2a13557c1b66a2b67c81747b5e38ef04891f06fee22fe712bf85b8e391240` |
| **ProfileRegistry v2 dependency** | `CCMV3J6W52JIZJVVX2YYBEALROVROU7KTDBLVSUYYMTLDTFJHXXPOKKP` |
| **soroban-sdk** | `26.1.0` |
| **Stellar CLI** | `27.0.0` |

Deployment transactions:
- WASM upload: [`4c3b5761b8ea25025577ff992d87ee63e7a4de7352edb822dfe2388fd7ad3be5`](https://stellar.expert/explorer/testnet/tx/4c3b5761b8ea25025577ff992d87ee63e7a4de7352edb822dfe2388fd7ad3be5)
- Contract deploy: [`746c713c9dfdec95beaf27f570c7e20b27779b9a75ce57a73ae0c30a3d6ed24b`](https://stellar.expert/explorer/testnet/tx/746c713c9dfdec95beaf27f570c7e20b27779b9a75ce57a73ae0c30a3d6ed24b)
- Demo follow (profile 1 → profile 2): [`5d0719b840652143647482972f1ea504364c0c3a861013ed2f68be300d711fca`](https://stellar.expert/explorer/testnet/tx/5d0719b840652143647482972f1ea504364c0c3a861013ed2f68be300d711fca)

Live verification:
- `is_following(1, 2)` → `true` ✅
- `get_follower_count(2)` → `1` ✅
- `version()` → `2` ✅

---

## What Changed from v1

1. **`upgrade(new_wasm_hash)` and `version()` functions added** — same pattern as
   ProfileRegistry v2. Admin-authenticated against stored state.

2. **Constructor now takes ProfileRegistry v2 address** — the `contractimport!` in the
   source is pinned to the v2 ProfileRegistry WASM hash.

3. **`follow_created`/`follow_removed` event payloads unchanged** — they already carried
   full state (follower, followee) in v1. No redesign needed here.

4. **`Profile.follower_count`/`following_count` no longer exist on the imported type** —
   the cross-contract call to `ProfileRegistry.get_profile` now returns the v2 `Profile`
   struct which has these fields removed. Code that previously asserted these were 0 has
   been updated accordingly.

---

## Build & Deploy

**Deploy ProfileRegistry v2 first** — FollowGraph v2's constructor takes the v2 address.

```bash
cd contracts

# Build
stellar contract build --package follow-graph
# Output: target/wasm32v1-none/release/follow_graph.wasm

# Upload WASM
stellar contract upload \
  --wasm target/wasm32v1-none/release/follow_graph.wasm \
  --source alice --network testnet
# → record the sha256 hash

# Deploy (constructor takes admin + v2 ProfileRegistry address)
stellar contract deploy \
  --wasm target/wasm32v1-none/release/follow_graph.wasm \
  --source alice --network testnet \
  --alias follow_graph_v2 \
  -- \
  --admin GALDKWEV7OOWI45GUJT3X6LKNER6IBRK6RB5BZGE776HZ2RPBFSZHNRB \
  --profile_registry <V2_PROFILE_REGISTRY_CONTRACT_ID>
# → record the contract ID

# Re-create the demo follow relationship (profile 1 → profile 2) for continuity
stellar contract invoke \
  --id <NEW_FOLLOW_GRAPH_ID> --source alice --network testnet \
  -- follow --follower 1 --followee 2

# Verify
stellar contract invoke \
  --id <NEW_FOLLOW_GRAPH_ID> --source alice --network testnet \
  -- is_following --follower 1 --followee 2
# → true

stellar contract invoke \
  --id <NEW_FOLLOW_GRAPH_ID> --source alice --network testnet \
  -- version
# → "2"
```

---

## Post-Deploy: Update Downstream Config

Contract IDs are now live. Regenerate typed client:
```bash
stellar contract bindings typescript \
  --contract-id CDNMUIWW6X565R2SWQNUGIQGDNLZA3QPNHO5YDA7YRXAB6PEICQH7ZHS \
  --network testnet \
  --output-dir frontend/packages/follow-graph-client \
  --overwrite
```

---

## Storage Hygiene (Security Note)

**Instance storage** contains only:
- `DataKey::Admin` — single Address, fixed size ✅
- `DataKey::ProfileRegistry` — single Address, fixed size ✅

All per-edge/per-profile data uses **persistent storage** keyed per entry. No unbounded
collection in instance storage. ✅

Same admin-upgrade-power trust assumption as ProfileRegistry v2 — see that contract's
DEPLOYMENT.md for the full note.

---

## Test Results

```
running 22 tests
test test::test_counts_default_to_zero ... ok
test test::test_cross_contract_owner_matches_registered ... ok
test test::test_duplicate_follow_returns_already_following ... ok
test test::test_follow_increments_counts ... ok
test test::test_follow_nonexistent_followee ... ok
test test::test_follow_nonexistent_follower ... ok
test test::test_follow_success_and_is_following ... ok
test test::test_follow_unfollow_follow_consistency ... ok
test test::test_follow_without_auth_fails ... ok
test test::test_get_followers_page_size_over_limit ... ok
test test::test_get_followers_page_size_zero ... ok
test test::test_get_followers_pagination ... ok
test test::test_self_follow_returns_error ... ok
test test::test_two_followers_appear_in_list ... ok
test test::test_unfollow_decrements_counts ... ok
test test::test_unfollow_not_following ... ok
test test::test_unfollow_success ... ok
test test::test_unfollow_without_auth_fails ... ok
test test::test_upgrade_fails_for_non_admin ... ok
test test::test_upgrade_succeeds_for_stored_admin ... ok
test test::test_upgrade_to_self_preserves_follow_state ... ok
test test::test_version_returns_2 ... ok

test result: ok. 22 passed; 0 failed; 0 ignored
```
