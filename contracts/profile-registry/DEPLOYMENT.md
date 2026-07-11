# ProfileRegistry — Deployment Reference

## Testnet Deployment

| Field | Value |
|---|---|
| **Contract ID** | `CAVUZWNQ322DFBNDEENP6GBYF6ESZFQDIEJN5C367WIG23AFMZO7ZLDU` |
| **Network** | Stellar Testnet (`Test SDF Network ; September 2015`) |
| **Deployed by** | `GALDKWEV7OOWI45GUJT3X6LKNER6IBRK6RB5BZGE776HZ2RPBFSZHNRB` (alias: `alice`) |
| **Admin address** | `GALDKWEV7OOWI45GUJT3X6LKNER6IBRK6RB5BZGE776HZ2RPBFSZHNRB` |
| **Deployed at** | 2026-07-11 |
| **WASM hash** | `fabb1c738df685c74fb99eef77158bcf9b11c9e16e4f93445362429a1462cff5` |
| **WASM size** | 8,868 bytes (optimised) |
| **soroban-sdk version** | `26.1.0` |
| **stellar-cli version** | `27.0.0` |

Verify independently:
- [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CAVUZWNQ322DFBNDEENP6GBYF6ESZFQDIEJN5C367WIG23AFMZO7ZLDU)
- [Stellar Lab](https://lab.stellar.org/r/testnet/contract/CAVUZWNQ322DFBNDEENP6GBYF6ESZFQDIEJN5C367WIG23AFMZO7ZLDU)

Deployment transactions:
- WASM upload: [`2504c5e207d3eedadb83925fc53030a84cc54c0337762117a84c7e3be0bfdfcc`](https://stellar.expert/explorer/testnet/tx/2504c5e207d3eedadb83925fc53030a84cc54c0337762117a84c7e3be0bfdfcc)
- Contract deploy: [`0594697e917bf4255323b70c7861f0c4bcc70a57fa94485d7ad7f266e570a92c`](https://stellar.expert/explorer/testnet/tx/0594697e917bf4255323b70c7861f0c4bcc70a57fa94485d7ad7f266e570a92c)

---

## Build

```bash
cd contracts
stellar contract build
# Output: target/wasm32v1-none/release/profile_registry.wasm
```

Requires:
- Rust with `wasm32v1-none` target (`rustup target add wasm32v1-none`)
- `stellar-cli` v27+ (`cargo install --locked stellar-cli`)

---

## Deploy (fresh deployment)

```bash
# 1. Generate and fund a deployer key (one-time)
stellar keys generate alice --network testnet --fund

# 2. Get alice's public key
stellar keys address alice

# 3. Build
cd contracts
stellar contract build

# 4. Deploy, passing the constructor's admin argument
stellar contract deploy \
  --wasm target/wasm32v1-none/release/profile_registry.wasm \
  --source alice \
  --network testnet \
  --alias profile_registry \
  -- \
  --admin <ALICE_PUBLIC_KEY>

# Returns the contract ID.
```

---

## Live Invocation Examples

All examples use the deployed testnet contract ID. Replace `<YOUR_KEY_ALIAS>` and
`<YOUR_STELLAR_ADDRESS>` with your own values.

### `register` — create a new profile

```bash
stellar contract invoke \
  --id CAVUZWNQ322DFBNDEENP6GBYF6ESZFQDIEJN5C367WIG23AFMZO7ZLDU \
  --source <YOUR_KEY_ALIAS> \
  --network testnet \
  -- \
  register \
  --owner <YOUR_STELLAR_ADDRESS> \
  --handle your_handle \
  --metadata_uri "ipfs://<YOUR_CID>"
# Returns the assigned profile_id (u128), e.g. "1"
```

Handle rules:
- 3–30 characters
- Lowercase ASCII letters, digits, and `_` only — uppercase is folded to lowercase automatically
- Must be unique (case-insensitive)

### `get_profile` — fetch a profile by ID

```bash
stellar contract invoke \
  --id CAVUZWNQ322DFBNDEENP6GBYF6ESZFQDIEJN5C367WIG23AFMZO7ZLDU \
  --source <YOUR_KEY_ALIAS> \
  --network testnet \
  -- \
  get_profile \
  --profile_id 1
# Returns:
# {
#   "created_at": 1783789266,
#   "follower_count": 0,
#   "following_count": 0,
#   "handle": "weave_dev",
#   "metadata_uri": "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
#   "owner": "GALDKWEV7OOWI45GUJT3X6LKNER6IBRK6RB5BZGE776HZ2RPBFSZHNRB"
# }
```

### `resolve_handle` — look up a profile_id by handle (case-insensitive)

```bash
stellar contract invoke \
  --id CAVUZWNQ322DFBNDEENP6GBYF6ESZFQDIEJN5C367WIG23AFMZO7ZLDU \
  --source <YOUR_KEY_ALIAS> \
  --network testnet \
  -- \
  resolve_handle \
  --handle weave_dev
# Returns: "1"
```

### `update_metadata` — update a profile's metadata URI

```bash
stellar contract invoke \
  --id CAVUZWNQ322DFBNDEENP6GBYF6ESZFQDIEJN5C367WIG23AFMZO7ZLDU \
  --source <YOUR_KEY_ALIAS> \
  --network testnet \
  -- \
  update_metadata \
  --profile_id 1 \
  --metadata_uri "ipfs://<NEW_CID>"
# Requires auth from the profile's current owner.
```

### `transfer_ownership` — transfer a profile to a new owner

```bash
stellar contract invoke \
  --id CAVUZWNQ322DFBNDEENP6GBYF6ESZFQDIEJN5C367WIG23AFMZO7ZLDU \
  --source <YOUR_KEY_ALIAS> \
  --network testnet \
  -- \
  transfer_ownership \
  --profile_id 1 \
  --new_owner <NEW_OWNER_STELLAR_ADDRESS>
# Requires auth from the profile's current owner.
```

---

## Live Invocations Confirmed at Deployment

| Function | Tx / Result |
|---|---|
| `register` (handle: `weave_dev`) | [`10df30b8ffbd3fc3a9d9626d90eb1ea94e10ed4a0f13c497e010ebdbb996a27c`](https://stellar.expert/explorer/testnet/tx/10df30b8ffbd3fc3a9d9626d90eb1ea94e10ed4a0f13c497e010ebdbb996a27c) → `"1"` |
| `get_profile` (id: 1) | Returned full profile struct ✅ |
| `resolve_handle` (handle: `weave_dev`) | Returned `"1"` ✅ |

---

## Test Results

```
running 19 tests
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
test test::test_transfer_ownership_non_owner_fails ... ok
test test::test_transfer_ownership_success ... ok
test test::test_update_metadata_auth_enforced ... ok
test test::test_update_metadata_success ... ok

test result: ok. 19 passed; 0 failed; 0 ignored
```

---

## Contract Design Notes

- **Constructor (CAP-0058):** Initialized via `__constructor(admin)` at deploy time. No separate `init()` — eliminates front-running on deploy.
- **Profile IDs:** `u128`, monotonically incrementing from 1. ID 0 is reserved/invalid and never issued.
- **Handle normalisation:** Handles are folded to lowercase before storage and lookup. `"Alice"` and `"alice"` resolve to the same handle.
- **Auth model:** Every mutating function loads the owner from storage and calls `owner.require_auth()` — never trusts a caller-supplied address. Read functions (`get_profile`, `resolve_handle`) are fully permissionless.
- **Storage:** `Profile` and `Handle` entries use **persistent** storage with TTL extended to ~1 year (6,307,200 ledgers at 5s close time) on every write, with a threshold of ~30 days (518,400 ledgers). `Admin` and `NextId` use instance storage.
- **Events:** Every mutation emits an event. Topics are `profile_registered` and `profile_updated` — canonical names referenced in the indexer design in `docs/weave_technical_spec.md`.
- **follower_count / following_count:** Fields exist in the `Profile` struct but are always 0. Reserved for future cross-contract calls from `FollowGraph` — not mutated by this contract.
