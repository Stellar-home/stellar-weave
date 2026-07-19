# ProfileRegistry v2 — Deployment Reference

> For the v1 deployment history (contract `CAVUZWNQ...MZO7ZLDU`, deployed 2026-07-11),
> see [`DEPLOYMENT.v1.md`](./DEPLOYMENT.v1.md).

## Testnet Deployment

| Field | Value |
|---|---|
| **Contract ID** | `REPLACE_AFTER_DEPLOY` |
| **Network** | Stellar Testnet (`Test SDF Network ; September 2015`) |
| **Deployed by** | `GALDKWEV7OOWI45GUJT3X6LKNER6IBRK6RB5BZGE776HZ2RPBFSZHNRB` (alias: `alice`) |
| **Admin address** | `GALDKWEV7OOWI45GUJT3X6LKNER6IBRK6RB5BZGE776HZ2RPBFSZHNRB` |
| **Deployed at** | TBD |
| **WASM hash** | `REPLACE_AFTER_UPLOAD` |
| **soroban-sdk version** | `26.1.0` |
| **stellar-cli version** | `27.0.0` |

Verify independently once deployed:
- https://stellar.expert/explorer/testnet/contract/REPLACE_AFTER_DEPLOY

---

## What Changed from v1

1. **`follower_count`/`following_count` removed from `Profile` struct** — these were
   permanently-zero vestigial fields in v1. Real counts live in `FollowGraph` and always
   did. Removing them eliminates a footgun that required a README warning to prevent misuse.

2. **Richer event payloads** — v1 emitted a generic `profile_updated` event with only a
   `field` discriminator (`"metadata"` or `"owner"`), forcing indexers to do a follow-up
   `get_profile` RPC call to learn the new value. v2 emits distinct events that carry the
   new value inline:
   - `profile_meta_updated` → `(profile_id: u128, new_metadata_uri: Symbol)`
   - `profile_owner_xfrd` → `(profile_id: u128, new_owner: Address)`

3. **`upgrade(new_wasm_hash)` function** — admin-authenticated against the address stored
   in contract state (not a caller-supplied parameter). See security note below.

4. **`version() → u32`** — returns `2`. Allows indexers and tooling to detect which code
   revision is running without guessing.

---

## Build & Deploy

```bash
cd contracts

# Build
stellar contract build --package profile-registry
# Output: target/wasm32v1-none/release/profile_registry.wasm

# Upload WASM and record the hash
stellar contract upload \
  --wasm target/wasm32v1-none/release/profile_registry.wasm \
  --source alice --network testnet
# → record the sha256 hash output

# Deploy
stellar contract deploy \
  --wasm target/wasm32v1-none/release/profile_registry.wasm \
  --source alice --network testnet \
  --alias profile_registry_v2 \
  -- --admin GALDKWEV7OOWI45GUJT3X6LKNER6IBRK6RB5BZGE776HZ2RPBFSZHNRB
# → record the contract ID

# Re-register the weave_dev demo profile for continuity
stellar contract invoke \
  --id <NEW_CONTRACT_ID> --source alice --network testnet \
  -- register \
  --owner GALDKWEV7OOWI45GUJT3X6LKNER6IBRK6RB5BZGE776HZ2RPBFSZHNRB \
  --handle weave_dev \
  --metadata_uri "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"

# Verify version
stellar contract invoke \
  --id <NEW_CONTRACT_ID> --source alice --network testnet \
  -- version
# → "2"
```

---

## Post-Deploy: Update Downstream Config

After recording the new contract ID:

1. `backend/.env` and `backend/.env.example` — set `PROFILE_REGISTRY_CONTRACT_ID`
2. `frontend/.env.local` — set `NEXT_PUBLIC_PROFILE_REGISTRY_ID`
3. Regenerate typed client:
   ```bash
   stellar contract bindings typescript \
     --contract-id <NEW_CONTRACT_ID> \
     --network testnet \
     --output-dir frontend/packages/profile-registry-client \
     --overwrite
   ```
4. Update README "Deployed Contracts" table.

---

## Storage Hygiene (Security Note)

**Instance storage** (loads in full on every interaction — a growing collection here is a
DoS risk) contains only:
- `DataKey::Admin` — single Address, fixed size ✅
- `DataKey::NextId` — single u128, fixed size ✅

All per-profile data (`DataKey::Profile(u128)`, `DataKey::Handle(Symbol)`) lives in
**persistent storage**, keyed per entry. No unbounded collection in instance storage. ✅

**Admin upgrade power:** The `upgrade()` function is authenticated against the admin
address stored in contract state — never from a caller-supplied argument. An attacker
supplying their own address as "admin" in a function argument would be rejected because
the contract ignores that argument and loads the real admin from storage instead.

This admin key is a centralization point: whoever holds it can upgrade the contract's
Wasm bytecode. This is acceptable for testnet iteration. Before any mainnet deployment,
consider protecting the admin key with a multisig or timelock — tracked as a future
consideration, not implemented here.

---

## Test Results

```
running 25 tests
test test::test_duplicate_handle_different_case ... ok
test test::test_duplicate_handle_same_case ... ok
test test::test_get_profile_not_found ... ok
test test::test_handle_exactly_30_chars_succeeds ... ok
test test::test_handle_invalid_at_sign ... ok
test test::test_handle_invalid_hyphen ... ok
test test::test_handle_invalid_space ... ok
test test::test_handle_too_long_31_chars ... ok
test test::test_handle_too_short_one_char ... ok
test test::test_handle_too_short_two_chars ... ok
test test::test_register_counter_increments ... ok
test test::test_register_requires_owner_auth ... ok
test test::test_register_returns_id_starting_at_one ... ok
test test::test_resolve_handle_case_insensitive ... ok
test test::test_resolve_handle_not_found ... ok
test test::test_transfer_ownership_event_carries_new_owner ... ok
test test::test_transfer_ownership_non_owner_fails ... ok
test test::test_transfer_ownership_success ... ok
test test::test_update_metadata_auth_enforced ... ok
test test::test_update_metadata_event_carries_new_value ... ok
test test::test_update_metadata_success ... ok
test test::test_upgrade_fails_for_non_admin ... ok
test test::test_upgrade_succeeds_for_stored_admin ... ok
test test::test_upgrade_to_self_preserves_state ... ok
test test::test_version_returns_2 ... ok

test result: ok. 25 passed; 0 failed; 0 ignored
```
