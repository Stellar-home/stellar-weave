#![cfg_attr(target_family = "wasm", no_std)]

use soroban_sdk::{BytesN, contract, contracterror, contractimpl, contracttype, Address, Env, Vec};

// ── Cross-contract import ──────────────────────────────────────────────────────
// Generates profile_registry::Client, profile_registry::Profile, and
// profile_registry::Error from the built WASM artifact.
//
// The sha256 parameter pins the import to the exact v2 ProfileRegistry WASM
// (hash dc13986ab487fd4bfe8b9f0ddd38fb681b8302396b836f6be7ce047b7dc2cb94).
// If this hash fails at build time it means profile_registry.wasm has changed —
// rebuild profile-registry first, verify its output hash, then update this value.
//
// Why this matters: without the pin, soroban_sdk::contractimport! silently accepts
// any WASM at the given path. A stale/wrong WASM would produce a Client with the
// wrong function signatures, meaning FollowGraph's cross-contract calls would
// target the wrong ProfileRegistry behaviour at runtime with no build-time signal.
mod profile_registry {
    soroban_sdk::contractimport!(
        file = "../target/wasm32v1-none/release/profile_registry.wasm",
        sha256 = "dc13986ab487fd4bfe8b9f0ddd38fb681b8302396b836f6be7ce047b7dc2cb94"
    );
}

// ── TTL constants ──────────────────────────────────────────────────────────────
// Kept identical to ProfileRegistry so the two contracts' storage policies are
// consistent. ~1 year in ledgers at 5-second close time; extend when TTL falls
// below ~30 days.
const PERSISTENT_BUMP_AMOUNT: u32 = 6_307_200;
const PERSISTENT_LIFETIME_THRESHOLD: u32 = 518_400;

// ── Data types ─────────────────────────────────────────────────────────────────

/// Visibility of a follow edge.
///
/// Only `Public` is used in this version. `Shielded` is reserved as a schema
/// placeholder so a future ZK-privacy migration doesn't require a breaking
/// storage change. Do not implement Shielded behaviour here.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum EdgeVisibility {
    Public,
    // Reserved — ZK-shielded edges, not implemented in this version.
    Shielded,
}

/// A directed follow relationship between two profiles.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct FollowEdge {
    pub follower: u128,
    pub followee: u128,
    pub created_at: u64,
    /// Always `EdgeVisibility::Public` in this version.
    pub visibility: EdgeVisibility,
}

/// Storage keys for all persistent and instance data owned by FollowGraph.
///
/// Design note (§2 of spec): follower/following counts live here, NOT in
/// ProfileRegistry. The deployed ProfileRegistry has no mutation function for
/// those fields and Soroban contract code is immutable after deployment.
/// Any caller that needs real counts must query `get_follower_count` /
/// `get_following_count` on this contract.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// instance — admin address set at construction.
    Admin,
    /// instance — Address of the deployed ProfileRegistry contract.
    ProfileRegistry,
    /// persistent — (follower_id, followee_id) → FollowEdge.
    Edge(u128, u128),
    /// persistent — followee_id → Vec<u128> of follower_ids in follow order.
    FollowersList(u128),
    /// persistent — follower_id → Vec<u128> of followee_ids in follow order.
    FollowingList(u128),
    /// persistent — profile_id → u32 follower count.
    FollowerCount(u128),
    /// persistent — profile_id → u32 following count.
    FollowingCount(u128),
}

// ── Errors ─────────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    SelfFollow = 1,
    AlreadyFollowing = 2,
    NotFollowing = 3,
    FollowerProfileNotFound = 4,
    FolloweeProfileNotFound = 5,
    InvalidPagination = 6,
}

// ── Contract ───────────────────────────────────────────────────────────────────

#[contract]
pub struct FollowGraph;

#[contractimpl]
impl FollowGraph {
    // ── Constructor (CAP-0058) ───────────────────────────────────────────────

    /// Initialise FollowGraph with an admin address and the address of the
    /// already-deployed ProfileRegistry v2 contract.
    pub fn __constructor(env: Env, admin: Address, profile_registry: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::ProfileRegistry, &profile_registry);
    }

    // ── Upgradability ────────────────────────────────────────────────────────

    /// Returns the contract version. This deployment is v2.
    pub fn version() -> u32 {
        2
    }

    /// Upgrade the contract Wasm to `new_wasm_hash`.
    ///
    /// Auth is required from the admin address stored in *contract state*, not
    /// from any caller-supplied parameter — same security pattern as
    /// ProfileRegistry.upgrade(). See that contract's comments for full rationale.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        // SECURITY: load from state, never accept as parameter.
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    // ── Mutations ────────────────────────────────────────────────────────────

    /// Create a directed follow edge from `follower` to `followee`.
    ///
    /// Auth comes from the **owner address stored in ProfileRegistry** for the
    /// follower profile — not from any address passed directly into this
    /// function. This prevents a caller from spoofing ownership.
    pub fn follow(env: Env, follower: u128, followee: u128) -> Result<(), Error> {
        // 1. Reject self-follow.
        if follower == followee {
            return Err(Error::SelfFollow);
        }

        let registry_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::ProfileRegistry)
            .unwrap();
        let registry = profile_registry::Client::new(&env, &registry_addr);

        // 2. Verify follower profile exists; capture owner for auth.
        let follower_profile = registry
            .try_get_profile(&follower)
            .map_err(|_| Error::FollowerProfileNotFound)?
            .map_err(|_| Error::FollowerProfileNotFound)?;
        let follower_owner = follower_profile.owner;

        // 3. Verify followee profile exists.
        registry
            .try_get_profile(&followee)
            .map_err(|_| Error::FolloweeProfileNotFound)?
            .map_err(|_| Error::FolloweeProfileNotFound)?;

        // 4. Require auth from the follower's actual owner (fetched above).
        follower_owner.require_auth();

        // 5. Reject if edge already exists.
        let edge_key = DataKey::Edge(follower, followee);
        if env.storage().persistent().has(&edge_key) {
            return Err(Error::AlreadyFollowing);
        }

        // 6. Write the edge.
        let edge = FollowEdge {
            follower,
            followee,
            created_at: env.ledger().timestamp(),
            visibility: EdgeVisibility::Public,
        };
        env.storage().persistent().set(&edge_key, &edge);
        env.storage().persistent().extend_ttl(
            &edge_key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );

        // 7. Append follower to followee's FollowersList.
        let followers_key = DataKey::FollowersList(followee);
        let mut followers: Vec<u128> = env
            .storage()
            .persistent()
            .get(&followers_key)
            .unwrap_or_else(|| Vec::new(&env));
        followers.push_back(follower);
        env.storage().persistent().set(&followers_key, &followers);
        env.storage().persistent().extend_ttl(
            &followers_key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );

        // 8. Append followee to follower's FollowingList.
        let following_key = DataKey::FollowingList(follower);
        let mut following: Vec<u128> = env
            .storage()
            .persistent()
            .get(&following_key)
            .unwrap_or_else(|| Vec::new(&env));
        following.push_back(followee);
        env.storage().persistent().set(&following_key, &following);
        env.storage().persistent().extend_ttl(
            &following_key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );

        // 9. Increment counts.
        Self::increment_count(&env, DataKey::FollowerCount(followee));
        Self::increment_count(&env, DataKey::FollowingCount(follower));

        // 11. Emit event.
        // Event names are pinned by the indexer spec (§8) — do not rename.
        #[allow(deprecated)]
        env.events()
            .publish((soroban_sdk::Symbol::new(&env, "follow_created"),), (follower, followee));

        Ok(())
    }

    /// Remove a directed follow edge from `follower` to `followee`.
    ///
    /// Auth is required from the follower's owner (fetched from ProfileRegistry).
    /// The followee's profile is NOT re-validated — if the edge exists it was
    /// valid when created; we don't fail unfollow because a followee profile
    /// might theoretically no longer resolve.
    pub fn unfollow(env: Env, follower: u128, followee: u128) -> Result<(), Error> {
        // 1. Edge must exist.
        let edge_key = DataKey::Edge(follower, followee);
        if !env.storage().persistent().has(&edge_key) {
            return Err(Error::NotFollowing);
        }

        // 2. Fetch follower owner and require auth.
        let registry_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::ProfileRegistry)
            .unwrap();
        let registry = profile_registry::Client::new(&env, &registry_addr);
        let follower_profile = registry
            .try_get_profile(&follower)
            .map_err(|_| Error::FollowerProfileNotFound)?
            .map_err(|_| Error::FollowerProfileNotFound)?;
        follower_profile.owner.require_auth();

        // 3. Delete the edge.
        env.storage().persistent().remove(&edge_key);

        // 4. Remove follower from followee's FollowersList.
        // Tradeoff: using positional remove (preserves insertion order) rather
        // than swap_remove (O(1) but scrambles order). The lists are expected
        // to be used for paginated display; preserving order gives better UX.
        // Very large accounts should query the off-chain indexer instead; these
        // lists are not the intended path for 100K+ follower accounts.
        let followers_key = DataKey::FollowersList(followee);
        if let Some(mut followers) = env
            .storage()
            .persistent()
            .get::<DataKey, Vec<u128>>(&followers_key)
        {
            if let Some(pos) = followers.iter().position(|id| id == follower) {
                followers.remove(pos as u32);
                env.storage().persistent().set(&followers_key, &followers);
                env.storage().persistent().extend_ttl(
                    &followers_key,
                    PERSISTENT_LIFETIME_THRESHOLD,
                    PERSISTENT_BUMP_AMOUNT,
                );
            }
        }

        // 5. Remove followee from follower's FollowingList (same tradeoff as above).
        let following_key = DataKey::FollowingList(follower);
        if let Some(mut following) = env
            .storage()
            .persistent()
            .get::<DataKey, Vec<u128>>(&following_key)
        {
            if let Some(pos) = following.iter().position(|id| id == followee) {
                following.remove(pos as u32);
                env.storage().persistent().set(&following_key, &following);
                env.storage().persistent().extend_ttl(
                    &following_key,
                    PERSISTENT_LIFETIME_THRESHOLD,
                    PERSISTENT_BUMP_AMOUNT,
                );
            }
        }

        // 6. Decrement counts (saturating — never panic on underflow).
        Self::decrement_count(&env, DataKey::FollowerCount(followee));
        Self::decrement_count(&env, DataKey::FollowingCount(follower));

        // 7. Emit event.
        // Event names are pinned by the indexer spec (§8) — do not rename.
        #[allow(deprecated)]
        env.events()
            .publish((soroban_sdk::Symbol::new(&env, "follow_removed"),), (follower, followee));

        Ok(())
    }

    // ── Reads ────────────────────────────────────────────────────────────────

    /// Check whether `follower` currently follows `followee`.
    /// O(1) edge-key existence check — does not touch the lists.
    pub fn is_following(env: Env, follower: u128, followee: u128) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Edge(follower, followee))
    }

    /// Return a page of profile_ids that follow `profile_id`.
    ///
    /// `page` is 0-indexed. `page_size` must be 1–50 inclusive.
    /// An out-of-range page returns an empty Vec (not an error).
    pub fn get_followers(
        env: Env,
        profile_id: u128,
        page: u32,
        page_size: u32,
    ) -> Result<Vec<u128>, Error> {
        if page_size == 0 || page_size > 50 {
            return Err(Error::InvalidPagination);
        }
        let list: Vec<u128> = env
            .storage()
            .persistent()
            .get(&DataKey::FollowersList(profile_id))
            .unwrap_or_else(|| Vec::new(&env));
        Ok(Self::paginate(&env, &list, page, page_size))
    }

    /// Return a page of profile_ids that `profile_id` follows.
    ///
    /// `page` is 0-indexed. `page_size` must be 1–50 inclusive.
    /// An out-of-range page returns an empty Vec (not an error).
    pub fn get_following(
        env: Env,
        profile_id: u128,
        page: u32,
        page_size: u32,
    ) -> Result<Vec<u128>, Error> {
        if page_size == 0 || page_size > 50 {
            return Err(Error::InvalidPagination);
        }
        let list: Vec<u128> = env
            .storage()
            .persistent()
            .get(&DataKey::FollowingList(profile_id))
            .unwrap_or_else(|| Vec::new(&env));
        Ok(Self::paginate(&env, &list, page, page_size))
    }

    /// Return the number of followers for `profile_id`.
    /// Returns 0 if the profile has never been followed (normal starting state).
    pub fn get_follower_count(env: Env, profile_id: u128) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::FollowerCount(profile_id))
            .unwrap_or(0u32)
    }

    /// Return the number of profiles that `profile_id` follows.
    /// Returns 0 if the profile has never followed anyone (normal starting state).
    pub fn get_following_count(env: Env, profile_id: u128) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::FollowingCount(profile_id))
            .unwrap_or(0u32)
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    fn increment_count(env: &Env, key: DataKey) {
        let current: u32 = env.storage().persistent().get(&key).unwrap_or(0u32);
        let next = current.saturating_add(1);
        env.storage().persistent().set(&key, &next);
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );
    }

    fn decrement_count(env: &Env, key: DataKey) {
        let current: u32 = env.storage().persistent().get(&key).unwrap_or(0u32);
        let next = current.saturating_sub(1);
        env.storage().persistent().set(&key, &next);
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );
    }

    /// Slice `list` into the requested page. Returns an empty Vec when `page`
    /// is beyond the available data — that is a normal, expected condition for
    /// any paginated API and must not be treated as an error.
    fn paginate(env: &Env, list: &Vec<u128>, page: u32, page_size: u32) -> Vec<u128> {
        let total = list.len();
        let start = page.saturating_mul(page_size);
        if start >= total {
            return Vec::new(env);
        }
        let end = (start + page_size).min(total);
        let mut result = Vec::new(env);
        for i in start..end {
            result.push_back(list.get(i).unwrap());
        }
        result
    }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, MockAuth, MockAuthInvoke},
        Address, Env, IntoVal, String,
    };

    // Re-import the ProfileRegistry contract for use in tests.
    // We register it in the test Env using its WASM so cross-contract calls
    // actually invoke the real compiled code (not a mock), proving the
    // contractimport! wiring is correct.
    use crate::profile_registry::{
        self, WASM as PROFILE_REGISTRY_WASM,
    };

    // ── Helpers ──────────────────────────────────────────────────────────────

    fn s(env: &Env, val: &str) -> String {
        String::from_str(env, val)
    }

    /// Register a ProfileRegistry and a FollowGraph in the test Env,
    /// return (env, fg_client, pr_client, pr_contract_id).
    fn setup() -> (
        Env,
        FollowGraphClient<'static>,
        profile_registry::Client<'static>,
        Address,
    ) {
        let env = Env::default();
        env.mock_all_auths();

        // Register ProfileRegistry using the real WASM so cross-contract calls work.
        let pr_admin = Address::generate(&env);
        let pr_id = env.register(PROFILE_REGISTRY_WASM, (&pr_admin,));
        let pr_client = profile_registry::Client::new(&env, &pr_id);

        // Register FollowGraph with the ProfileRegistry address.
        let fg_admin = Address::generate(&env);
        let fg_id = env.register(FollowGraph, (&fg_admin, &pr_id));
        let fg_client = FollowGraphClient::new(&env, &fg_id);

        (env, fg_client, pr_client, pr_id)
    }

    /// Register a profile and return (owner, profile_id).
    fn register_profile(
        env: &Env,
        pr: &profile_registry::Client,
        handle: &str,
    ) -> (Address, u128) {
        let owner = Address::generate(env);
        let id = pr.register(&owner, &s(env, handle), &s(env, ""));
        (owner, id)
    }

    // ── Test 1: follow succeeds; is_following returns true ───────────────────

    #[test]
    fn test_follow_success_and_is_following() {
        let (env, fg, pr, _) = setup();
        let (_, alice_id) = register_profile(&env, &pr, "alice");
        let (_, bob_id) = register_profile(&env, &pr, "bob");

        fg.follow(&alice_id, &bob_id);
        assert!(fg.is_following(&alice_id, &bob_id));
    }

    // ── Test 2: follow increments counts correctly ────────────────────────────

    #[test]
    fn test_follow_increments_counts() {
        let (env, fg, pr, _) = setup();
        let (_, alice_id) = register_profile(&env, &pr, "alice");
        let (_, bob_id) = register_profile(&env, &pr, "bob");

        assert_eq!(fg.get_follower_count(&bob_id), 0u32);
        assert_eq!(fg.get_following_count(&alice_id), 0u32);

        fg.follow(&alice_id, &bob_id);

        assert_eq!(fg.get_follower_count(&bob_id), 1u32);
        assert_eq!(fg.get_following_count(&alice_id), 1u32);
    }

    // ── Test 3: self-follow → SelfFollow ─────────────────────────────────────

    #[test]
    fn test_self_follow_returns_error() {
        let (env, fg, pr, _) = setup();
        let (_, alice_id) = register_profile(&env, &pr, "alice");

        let result = fg.try_follow(&alice_id, &alice_id);
        assert_eq!(result, Err(Ok(Error::SelfFollow)));
    }

    // ── Test 4: nonexistent follower → FollowerProfileNotFound ───────────────

    #[test]
    fn test_follow_nonexistent_follower() {
        let (env, fg, pr, _) = setup();
        let (_, bob_id) = register_profile(&env, &pr, "bob");

        let result = fg.try_follow(&999u128, &bob_id);
        assert_eq!(result, Err(Ok(Error::FollowerProfileNotFound)));
    }

    // ── Test 5: nonexistent followee → FolloweeProfileNotFound ───────────────

    #[test]
    fn test_follow_nonexistent_followee() {
        let (env, fg, pr, _) = setup();
        let (_, alice_id) = register_profile(&env, &pr, "alice");

        let result = fg.try_follow(&alice_id, &999u128);
        assert_eq!(result, Err(Ok(Error::FolloweeProfileNotFound)));
    }

    // ── Test 6: duplicate follow → AlreadyFollowing ───────────────────────────

    #[test]
    fn test_duplicate_follow_returns_already_following() {
        let (env, fg, pr, _) = setup();
        let (_, alice_id) = register_profile(&env, &pr, "alice");
        let (_, bob_id) = register_profile(&env, &pr, "bob");

        fg.follow(&alice_id, &bob_id);
        let result = fg.try_follow(&alice_id, &bob_id);
        assert_eq!(result, Err(Ok(Error::AlreadyFollowing)));
    }

    // ── Test 7: follow without follower-owner auth fails ─────────────────────
    // Auth is enforced through the owner address fetched from ProfileRegistry —
    // if that auth is not satisfied the transaction must be rejected.

    #[test]
    fn test_follow_without_auth_fails() {
        let env = Env::default();
        // Do NOT mock all auths.

        let pr_admin = Address::generate(&env);
        let pr_id = env.register(PROFILE_REGISTRY_WASM, (&pr_admin,));
        let pr_client = profile_registry::Client::new(&env, &pr_id);

        let fg_admin = Address::generate(&env);
        let fg_id = env.register(FollowGraph, (&fg_admin, &pr_id));
        let fg_client = FollowGraphClient::new(&env, &fg_id);

        // Register profiles with mock_all_auths for setup only.
        env.mock_all_auths();
        let alice_owner = Address::generate(&env);
        let bob_owner = Address::generate(&env);
        let alice_id = pr_client.register(&alice_owner, &s(&env, "alice"), &s(&env, ""));
        let bob_id = pr_client.register(&bob_owner, &s(&env, "bob"), &s(&env, ""));

        // Now mock auth only for bob (wrong address — not alice's owner).
        env.mock_auths(&[MockAuth {
            address: &bob_owner,
            invoke: &MockAuthInvoke {
                contract: &fg_id,
                fn_name: "follow",
                args: (alice_id, bob_id).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        let result = fg_client.try_follow(&alice_id, &bob_id);
        assert!(result.is_err());
    }

    // ── Test 8: unfollow succeeds; is_following false after ───────────────────

    #[test]
    fn test_unfollow_success() {
        let (env, fg, pr, _) = setup();
        let (_, alice_id) = register_profile(&env, &pr, "alice");
        let (_, bob_id) = register_profile(&env, &pr, "bob");

        fg.follow(&alice_id, &bob_id);
        assert!(fg.is_following(&alice_id, &bob_id));

        fg.unfollow(&alice_id, &bob_id);
        assert!(!fg.is_following(&alice_id, &bob_id));
    }

    // ── Test 9: unfollow decrements counts correctly ──────────────────────────

    #[test]
    fn test_unfollow_decrements_counts() {
        let (env, fg, pr, _) = setup();
        let (_, alice_id) = register_profile(&env, &pr, "alice");
        let (_, bob_id) = register_profile(&env, &pr, "bob");

        fg.follow(&alice_id, &bob_id);
        assert_eq!(fg.get_follower_count(&bob_id), 1u32);
        assert_eq!(fg.get_following_count(&alice_id), 1u32);

        fg.unfollow(&alice_id, &bob_id);
        assert_eq!(fg.get_follower_count(&bob_id), 0u32);
        assert_eq!(fg.get_following_count(&alice_id), 0u32);
    }

    // ── Test 10: unfollow non-existent edge → NotFollowing ───────────────────

    #[test]
    fn test_unfollow_not_following() {
        let (env, fg, pr, _) = setup();
        let (_, alice_id) = register_profile(&env, &pr, "alice");
        let (_, bob_id) = register_profile(&env, &pr, "bob");

        let result = fg.try_unfollow(&alice_id, &bob_id);
        assert_eq!(result, Err(Ok(Error::NotFollowing)));
    }

    // ── Test 11: unfollow without auth fails ──────────────────────────────────

    #[test]
    fn test_unfollow_without_auth_fails() {
        let env = Env::default();

        let pr_admin = Address::generate(&env);
        let pr_id = env.register(PROFILE_REGISTRY_WASM, (&pr_admin,));
        let pr_client = profile_registry::Client::new(&env, &pr_id);

        let fg_admin = Address::generate(&env);
        let fg_id = env.register(FollowGraph, (&fg_admin, &pr_id));
        let fg_client = FollowGraphClient::new(&env, &fg_id);

        env.mock_all_auths();
        let alice_owner = Address::generate(&env);
        let bob_owner = Address::generate(&env);
        let alice_id = pr_client.register(&alice_owner, &s(&env, "alice"), &s(&env, ""));
        let bob_id = pr_client.register(&bob_owner, &s(&env, "bob"), &s(&env, ""));
        fg_client.follow(&alice_id, &bob_id);

        // Mock auth for bob only — alice's owner is not authorised.
        env.mock_auths(&[MockAuth {
            address: &bob_owner,
            invoke: &MockAuthInvoke {
                contract: &fg_id,
                fn_name: "unfollow",
                args: (alice_id, bob_id).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        let result = fg_client.try_unfollow(&alice_id, &bob_id);
        assert!(result.is_err());
    }

    // ── Test 12: two followers both appear in get_followers ───────────────────

    #[test]
    fn test_two_followers_appear_in_list() {
        let (env, fg, pr, _) = setup();
        let (_, alice_id) = register_profile(&env, &pr, "alice");
        let (_, bob_id) = register_profile(&env, &pr, "bob");
        let (_, carol_id) = register_profile(&env, &pr, "carol");

        // alice and bob both follow carol.
        fg.follow(&alice_id, &carol_id);
        fg.follow(&bob_id, &carol_id);

        let followers = fg.get_followers(&carol_id, &0u32, &50u32);
        assert_eq!(followers.len(), 2u32);
        assert!(followers.iter().any(|id| id == alice_id));
        assert!(followers.iter().any(|id| id == bob_id));
    }

    // ── Test 13: get_followers pagination correctness ────────────────────────
    // 5 edges → page_size 2 → pages return 2, 2, 1, 0 items.

    #[test]
    fn test_get_followers_pagination() {
        let (env, fg, pr, _) = setup();
        // Register 6 profiles: one followee + 5 followers.
        let (_, target_id) = register_profile(&env, &pr, "target");
        let mut follower_ids = Vec::new(&env);
        for i in 0..5u32 {
            let handle_str = alloc_handle(i);
            let handle = soroban_sdk::String::from_str(&env, handle_str);
            let owner = Address::generate(&env);
            let id = pr.register(&owner, &handle, &s(&env, ""));
            follower_ids.push_back(id);
            fg.follow(&id, &target_id);
        }

        let page0 = fg.get_followers(&target_id, &0u32, &2u32);
        let page1 = fg.get_followers(&target_id, &1u32, &2u32);
        let page2 = fg.get_followers(&target_id, &2u32, &2u32);
        let page3 = fg.get_followers(&target_id, &3u32, &2u32);

        assert_eq!(page0.len(), 2u32);
        assert_eq!(page1.len(), 2u32);
        assert_eq!(page2.len(), 1u32);
        assert_eq!(page3.len(), 0u32); // out-of-range page → empty, not error
    }

    // ── Test 14: page_size 0 → InvalidPagination ─────────────────────────────

    #[test]
    fn test_get_followers_page_size_zero() {
        let (env, fg, pr, _) = setup();
        let (_, alice_id) = register_profile(&env, &pr, "alice");
        assert_eq!(
            fg.try_get_followers(&alice_id, &0u32, &0u32),
            Err(Ok(Error::InvalidPagination))
        );
        assert_eq!(
            fg.try_get_following(&alice_id, &0u32, &0u32),
            Err(Ok(Error::InvalidPagination))
        );
    }

    // ── Test 15: page_size 51 → InvalidPagination ────────────────────────────

    #[test]
    fn test_get_followers_page_size_over_limit() {
        let (env, fg, pr, _) = setup();
        let (_, alice_id) = register_profile(&env, &pr, "alice");
        assert_eq!(
            fg.try_get_followers(&alice_id, &0u32, &51u32),
            Err(Ok(Error::InvalidPagination))
        );
        assert_eq!(
            fg.try_get_following(&alice_id, &0u32, &51u32),
            Err(Ok(Error::InvalidPagination))
        );
    }

    // ── Test 16: count on profile with no activity → 0, not error ────────────

    #[test]
    fn test_counts_default_to_zero() {
        let (env, fg, pr, _) = setup();
        let (_, alice_id) = register_profile(&env, &pr, "alice");
        assert_eq!(fg.get_follower_count(&alice_id), 0u32);
        assert_eq!(fg.get_following_count(&alice_id), 0u32);
    }

    // ── Test 17: follow → unfollow → follow again leaves consistent state ─────

    #[test]
    fn test_follow_unfollow_follow_consistency() {
        let (env, fg, pr, _) = setup();
        let (_, alice_id) = register_profile(&env, &pr, "alice");
        let (_, bob_id) = register_profile(&env, &pr, "bob");

        fg.follow(&alice_id, &bob_id);
        fg.unfollow(&alice_id, &bob_id);
        fg.follow(&alice_id, &bob_id);

        // Edge must exist.
        assert!(fg.is_following(&alice_id, &bob_id));

        // Counts must be 1.
        assert_eq!(fg.get_follower_count(&bob_id), 1u32);
        assert_eq!(fg.get_following_count(&alice_id), 1u32);

        // Lists must contain exactly one entry each (no duplicates).
        let followers = fg.get_followers(&bob_id, &0u32, &50u32);
        let following = fg.get_following(&alice_id, &0u32, &50u32);
        assert_eq!(followers.len(), 1u32);
        assert_eq!(following.len(), 1u32);
        assert_eq!(followers.get(0).unwrap(), alice_id);
        assert_eq!(following.get(0).unwrap(), bob_id);
    }

    // ── Test 18: cross-contract call correctness ──────────────────────────────
    // Verify that the Profile.owner returned by the imported ProfileRegistry
    // client matches what was actually registered, proving the contractimport!
    // wiring is correct and not just compiling.

    #[test]
    fn test_cross_contract_owner_matches_registered() {
        let (env, _fg, pr, _) = setup();
        let owner = Address::generate(&env);
        let id = pr.register(&owner, &s(&env, "alice"), &s(&env, "ipfs://test"));

        // Fetch directly through the imported client.
        let profile = pr.get_profile(&id);
        assert_eq!(profile.owner, owner);
        assert_eq!(profile.handle, soroban_sdk::Symbol::new(&env, "alice"));
        // v2: follower_count / following_count removed from Profile struct —
        // real counts are owned by FollowGraph (this contract). See DataKey::FollowerCount.
    }

    // ── Utility ──────────────────────────────────────────────────────────────

    /// Return a unique &'static str handle for use in the pagination test.
    fn alloc_handle(i: u32) -> &'static str {
        match i {
            0 => "follower0",
            1 => "follower1",
            2 => "follower2",
            3 => "follower3",
            4 => "follower4",
            _ => "followerx",
        }
    }

    // ── version / upgrade ─────────────────────────────────────────────────────

    #[test]
    fn test_version_returns_2() {
        let (_env, fg, _pr, _) = setup();
        assert_eq!(fg.version(), 2u32);
    }

    /// upgrade() by the real stored admin must succeed and contract still works.
    #[test]
    fn test_upgrade_succeeds_for_stored_admin() {
        let env = Env::default();
        env.mock_all_auths();

        let pr_admin = Address::generate(&env);
        let pr_id = env.register(PROFILE_REGISTRY_WASM, (&pr_admin,));

        let fg_admin = Address::generate(&env);
        let fg_id = env.register(FollowGraph, (&fg_admin, &pr_id));
        let fg_client = FollowGraphClient::new(&env, &fg_id);

        let wasm_hash = env.deployer().upload_contract_wasm(follow_graph::WASM);
        // Should not panic.
        fg_client.upgrade(&wasm_hash);
        assert_eq!(fg_client.version(), 2u32);
    }

    /// upgrade() called by a non-admin must fail — tests the specific exploit
    /// pattern from §2.1: admin is loaded from storage, not caller-supplied.
    #[test]
    fn test_upgrade_fails_for_non_admin() {
        let env = Env::default();

        let pr_admin = Address::generate(&env);
        let pr_id = env.register(PROFILE_REGISTRY_WASM, (&pr_admin,));

        let fg_admin = Address::generate(&env);
        let fg_id = env.register(FollowGraph, (&fg_admin, &pr_id));
        let fg_client = FollowGraphClient::new(&env, &fg_id);

        let attacker = Address::generate(&env);
        let wasm_hash = {
            env.mock_all_auths();
            env.deployer().upload_contract_wasm(follow_graph::WASM)
        };

        // Mock auth only for attacker — real admin has NOT authorised.
        env.mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &fg_id,
                fn_name: "upgrade",
                args: (wasm_hash.clone(),).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        let result = fg_client.try_upgrade(&wasm_hash);
        assert!(result.is_err(), "upgrade must fail for non-admin");
    }

    /// After a same-wasm upgrade, state (edges, counts, lists) is preserved.
    #[test]
    fn test_upgrade_to_self_preserves_follow_state() {
        let (env, fg, pr, _) = setup();
        let (_, alice_id) = register_profile(&env, &pr, "alice");
        let (_, bob_id) = register_profile(&env, &pr, "bob");
        fg.follow(&alice_id, &bob_id);
        assert!(fg.is_following(&alice_id, &bob_id));
        assert_eq!(fg.get_follower_count(&bob_id), 1u32);

        let wasm_hash = env.deployer().upload_contract_wasm(follow_graph::WASM);
        fg.upgrade(&wasm_hash);

        // State must survive the upgrade.
        assert!(fg.is_following(&alice_id, &bob_id));
        assert_eq!(fg.get_follower_count(&bob_id), 1u32);
        assert_eq!(fg.version(), 2u32);
    }

    // ── Self-WASM reference for upgrade tests ─────────────────────────────────
    mod follow_graph {
        soroban_sdk::contractimport!(
            file = "../target/wasm32v1-none/release/follow_graph.wasm"
        );
    }
}
