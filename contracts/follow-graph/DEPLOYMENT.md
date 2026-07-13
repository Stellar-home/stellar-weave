# FollowGraph — Deployment Reference

## Testnet Deployment

| Field | Value |
|---|---|
| **Contract ID** | `CBO2USOJ4MII4GWULU2YGBIAIUN7333SFU5S5R3GKLAP6FGT5DSO5BOR` |
| **Network** | Stellar Testnet (`Test SDF Network ; September 2015`) |
| **Deployed by** | `GALDKWEV7OOWI45GUJT3X6LKNER6IBRK6RB5BZGE776HZ2RPBFSZHNRB` (key alias: `alice`) |
| **Admin** | `GALDKWEV7OOWI45GUJT3X6LKNER6IBRK6RB5BZGE776HZ2RPBFSZHNRB` |
| **Deployed at** | 2026-07-12 |
| **WASM hash (sha256)** | `5008e2a26630bd400db7f8c3ca969b364c427ac8b6fe6effa2f136638367b05e` |
| **WASM size** | 9,755 bytes (optimised) |
| **soroban-sdk** | `26.1.0` |
| **Stellar CLI** | `27.0.0` |
| **rustc** | `1.96.1 (31fca3adb 2026-06-26)` |
| **ProfileRegistry dependency** | `CAVUZWNQ322DFBNDEENP6GBYF6ESZFQDIEJN5C367WIG23AFMZO7ZLDU` |

### Stellar Expert

- Contract: https://stellar.expert/explorer/testnet/contract/CBO2USOJ4MII4GWULU2YGBIAIUN7333SFU5S5R3GKLAP6FGT5DSO5BOR
- WASM upload tx: https://stellar.expert/explorer/testnet/tx/364b4ba3e30b7eff48183e12042b1ea8fb514f407418b5af310a6b6a7b6af147
- Deploy tx: https://stellar.expert/explorer/testnet/tx/99c2f968e612e17fbb40fbd8102c44f3fb36ef37e499792a4367b2dfd33f88a0

---

## Build & Deploy Commands

```bash
# From repo root
cd contracts

# Build
stellar contract build --package follow-graph

# Deploy (constructor takes admin address and ProfileRegistry contract address)
stellar contract deploy \
  --wasm target/wasm32v1-none/release/follow_graph.wasm \
  --source alice \
  --network testnet \
  --alias follow_graph \
  -- \
  --admin GALDKWEV7OOWI45GUJT3X6LKNER6IBRK6RB5BZGE776HZ2RPBFSZHNRB \
  --profile_registry CAVUZWNQ322DFBNDEENP6GBYF6ESZFQDIEJN5C367WIG23AFMZO7ZLDU
```

---

## Live Invocation Examples

All examples target testnet. Replace the contract ID alias with the full ID if your
local `~/.stellar/network/testnet/contract-ids/` doesn't have the alias configured.

### `follow` — create a directed follow edge

```bash
stellar contract invoke \
  --id CBO2USOJ4MII4GWULU2YGBIAIUN7333SFU5S5R3GKLAP6FGT5DSO5BOR \
  --source <FOLLOWER_OWNER_KEY_ALIAS> \
  --network testnet \
  -- \
  follow \
  --follower <FOLLOWER_PROFILE_ID_u128> \
  --followee <FOLLOWEE_PROFILE_ID_u128>
# returns: null (success)
# emits: follow_created event with (follower, followee)
```

### `unfollow` — remove a follow edge

```bash
stellar contract invoke \
  --id CBO2USOJ4MII4GWULU2YGBIAIUN7333SFU5S5R3GKLAP6FGT5DSO5BOR \
  --source <FOLLOWER_OWNER_KEY_ALIAS> \
  --network testnet \
  -- \
  unfollow \
  --follower <FOLLOWER_PROFILE_ID_u128> \
  --followee <FOLLOWEE_PROFILE_ID_u128>
# returns: null (success)
# emits: follow_removed event with (follower, followee)
```

### `is_following` — O(1) edge check

```bash
stellar contract invoke \
  --id CBO2USOJ4MII4GWULU2YGBIAIUN7333SFU5S5R3GKLAP6FGT5DSO5BOR \
  --source alice \
  --network testnet \
  -- \
  is_following \
  --follower 1 \
  --followee 2
# returns: true
```

### `get_follower_count` — follower count for a profile

```bash
stellar contract invoke \
  --id CBO2USOJ4MII4GWULU2YGBIAIUN7333SFU5S5R3GKLAP6FGT5DSO5BOR \
  --source alice \
  --network testnet \
  -- \
  get_follower_count \
  --profile_id 2
# returns: 1
```

### `get_following_count` — following count for a profile

```bash
stellar contract invoke \
  --id CBO2USOJ4MII4GWULU2YGBIAIUN7333SFU5S5R3GKLAP6FGT5DSO5BOR \
  --source alice \
  --network testnet \
  -- \
  get_following_count \
  --profile_id 1
# returns: 1
```

### `get_followers` — paginated list of followers

```bash
stellar contract invoke \
  --id CBO2USOJ4MII4GWULU2YGBIAIUN7333SFU5S5R3GKLAP6FGT5DSO5BOR \
  --source alice \
  --network testnet \
  -- \
  get_followers \
  --profile_id 2 \
  --page 0 \
  --page_size 50
# returns: ["1"]
# page_size must be 1–50 inclusive; page is 0-indexed; out-of-range page returns []
```

### `get_following` — paginated list of accounts a profile follows

```bash
stellar contract invoke \
  --id CBO2USOJ4MII4GWULU2YGBIAIUN7333SFU5S5R3GKLAP6FGT5DSO5BOR \
  --source alice \
  --network testnet \
  -- \
  get_following \
  --profile_id 1 \
  --page 0 \
  --page_size 50
# returns: ["2"]
```

---

## Live End-to-End Demonstration (§11)

Performed 2026-07-12 against testnet. Demonstrates a complete social graph interaction
from profile registration through follow verification.

### Step 1 — Profiles used

Profile 1 (`weave_dev`) — already registered in the ProfileRegistry deployment reference.
Profile 2 (`weave_graph_demo`) — registered in this session:

```
tx: https://stellar.expert/explorer/testnet/tx/f1cc8e4e1631a3722a1b465b33cf9d66c9dc9ad58ebc745a1ae6177370734990
profile_id: 2
handle: weave_graph_demo
owner: GALDKWEV7OOWI45GUJT3X6LKNER6IBRK6RB5BZGE776HZ2RPBFSZHNRB
```

### Step 2 — `follow` (profile 1 → profile 2)

```
tx: https://stellar.expert/explorer/testnet/tx/35c06183c749f0d9980b494b00b041a9e55d0293018d318ac75e71e9b200205b
event emitted: follow_created → (1, 2)
```

### Step 3 — `is_following(1, 2)` → `true` ✅

### Step 4 — `get_follower_count(2)` → `1` ✅

### Step 5 — `get_followers(2, page=0, page_size=50)` → `["1"]` ✅

---

## Test Output

```
running 18 tests
test test::test_counts_default_to_zero ... ok
test test::test_duplicate_follow_returns_already_following ... ok
test test::test_follow_nonexistent_followee ... ok
test test::test_follow_success_and_is_following ... ok
test test::test_cross_contract_owner_matches_registered ... ok
test test::test_follow_increments_counts ... ok
test test::test_follow_nonexistent_follower ... ok
test test::test_get_followers_page_size_over_limit ... ok
test test::test_get_followers_page_size_zero ... ok
test test::test_self_follow_returns_error ... ok
test test::test_follow_unfollow_follow_consistency ... ok
test test::test_follow_without_auth_fails ... ok
test test::test_two_followers_appear_in_list ... ok
test test::test_unfollow_not_following ... ok
test test::test_unfollow_decrements_counts ... ok
test test::test_unfollow_success ... ok
test test::test_unfollow_without_auth_fails ... ok
test test::test_get_followers_pagination ... ok

test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.07s
```

---

## Contract Design Notes

### Follower/following counts live in FollowGraph, not ProfileRegistry

The original technical spec (§6.2) described `FollowGraph` cross-contract-calling into
`ProfileRegistry` to increment `Profile.follower_count` / `Profile.following_count`.
This was **not implemented**, and deliberately so.

Reason: the deployed `ProfileRegistry` (`CAVUZWNQ322DFBNDEENP6GBYF6ESZFQDIEJN5C367WIG23AFMZO7ZLDU`)
has no function to mutate those fields. Soroban contract code is immutable after
deployment — there is no way to add a `bump_follower_count` function to the live contract
ID. Redeploying would discard the proof-of-life deployment and its transaction history.

Decision: `FollowGraph` owns `FollowerCount(profile_id)` and `FollowingCount(profile_id)`
as its own persistent storage keys, updated atomically on every `follow`/`unfollow`.
`Profile.follower_count` and `Profile.following_count` in `ProfileRegistry` are
permanently `0` and should be treated as vestigial reserved fields.

**Any code — indexer, client, other contract — that needs real counts must query
`FollowGraph.get_follower_count` / `FollowGraph.get_following_count`, not
`ProfileRegistry.get_profile`.**

This note exists so this decision is never re-litigated without awareness of the above
constraint.

### Auth pattern

`follow` and `unfollow` fetch the follower's owner address from `ProfileRegistry` via
cross-contract call and call `owner.require_auth()` on that stored address. No address is
accepted as a parameter for auth purposes — this prevents a caller from passing an
arbitrary address and "proving" ownership of a profile they don't control.

### Pagination

`get_followers` and `get_following` enforce `page_size` in `[1, 50]`. Out-of-range pages
return an empty `Vec`, not an error — callers should treat an empty page as the end of
the list. Very large follower lists (10K+ entries) should be served from the off-chain
indexer rather than these on-chain list functions.

### List removal order

`unfollow` uses positional `remove` (preserves insertion order, O(n)) rather than
`swap_remove` (O(1) but scrambles order). This gives better pagination UX — follower
order remains stable after unfollows. The O(n) cost is acceptable because these lists are
not the intended query path for large-scale accounts; that role belongs to the indexer.
