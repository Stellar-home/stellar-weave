#![cfg_attr(target_family = "wasm", no_std)]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env, String,
    Symbol,
};

// ── TTL constants ──────────────────────────────────────────────────────────────
// Persistent entries must never expire silently.
// ~1 year in ledgers at 5-second close time: 365 * 24 * 720 = 6_307_200
// Extend when TTL falls below ~30 days (518_400 ledgers).
const PERSISTENT_BUMP_AMOUNT: u32 = 6_307_200;
const PERSISTENT_LIFETIME_THRESHOLD: u32 = 518_400;

// ── Data types ─────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Profile {
    pub owner: Address,
    /// Normalized (lowercase) handle stored as Symbol.
    pub handle: Symbol,
    /// IPFS or Arweave content URI; may be empty string.
    pub metadata_uri: String,
    /// Ledger timestamp at registration.
    pub created_at: u64,
    /// Reserved for FollowGraph — always 0 in this contract.
    pub follower_count: u32,
    /// Reserved for FollowGraph — always 0 in this contract.
    pub following_count: u32,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// instance storage — set once at construction.
    Admin,
    /// instance storage — monotonically increasing u128 counter; profile_id 0 is reserved.
    NextId,
    /// persistent storage — profile_id → Profile.
    Profile(u128),
    /// persistent storage — normalized handle (Symbol) → profile_id.
    Handle(Symbol),
}

// ── Errors ─────────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    HandleTaken = 1,
    HandleInvalid = 2,
    ProfileNotFound = 3,
    NotProfileOwner = 4,
    HandleTooLong = 5,
    HandleTooShort = 6,
}

// ── Events ─────────────────────────────────────────────────────────────────────

/// Emitted when a new profile is registered.
/// Topic: `profile_registered`
#[contractevent(topics = ["profile_registered"])]
pub struct ProfileRegistered {
    #[topic]
    pub profile_id: u128,
    pub owner: Address,
    pub handle: Symbol,
}

/// Emitted when a profile's metadata URI is updated.
/// Topic: `profile_updated`
#[contractevent(topics = ["profile_updated"])]
pub struct ProfileMetadataUpdated {
    #[topic]
    pub profile_id: u128,
    pub field: Symbol,
}

/// Emitted when a profile's owner is transferred.
/// Topic: `profile_updated`
#[contractevent(topics = ["profile_updated"])]
pub struct ProfileOwnerTransferred {
    #[topic]
    pub profile_id: u128,
    pub field: Symbol,
}

// ── Handle validation ──────────────────────────────────────────────────────────

/// Validate and normalize a raw handle string.
///
/// Accepts a `soroban_sdk::String` so the caller can pass arbitrary casing.
/// Returns a `Symbol` containing the lowercase-normalized handle on success, or
/// an `Error` describing the specific constraint violation.
///
/// Rules:
/// - Length: 3–30 characters inclusive.
/// - Allowed: lowercase ASCII letters `a-z`, digits `0-9`, underscore `_`.
///   Uppercase letters are folded to lowercase before the uniqueness check.
///   Any other byte (including spaces, `@`, `-`, unicode) → `HandleInvalid`.
fn validate_and_normalize(env: &Env, raw: &String) -> Result<Symbol, Error> {
    let len = raw.len() as usize;

    if len < 3 {
        return Err(Error::HandleTooShort);
    }
    if len > 30 {
        return Err(Error::HandleTooLong);
    }

    // Copy the raw string bytes into a fixed-size stack buffer — no heap allocation.
    let mut buf = [0u8; 32];
    raw.copy_into_slice(&mut buf[..len]);

    // Validate and normalize (fold uppercase to lowercase).
    for i in 0..len {
        let nb = match buf[i] {
            b'a'..=b'z' => buf[i],
            b'A'..=b'Z' => buf[i] + 32, // fold to lowercase
            b'0'..=b'9' => buf[i],
            b'_' => buf[i],
            _ => return Err(Error::HandleInvalid),
        };
        buf[i] = nb;
    }

    // SAFETY: all bytes are ASCII — valid UTF-8.
    let normalized_str =
        core::str::from_utf8(&buf[..len]).map_err(|_| Error::HandleInvalid)?;

    // Symbol::new panics if passed chars outside [a-zA-Z0-9_]; our normalized
    // bytes satisfy that constraint by construction.
    Ok(Symbol::new(env, normalized_str))
}

// ── Contract ───────────────────────────────────────────────────────────────────

#[contract]
pub struct ProfileRegistry;

#[contractimpl]
impl ProfileRegistry {
    // ── Constructor (CAP-0058) ───────────────────────────────────────────────

    /// Initialize the registry with a designated admin address.
    ///
    /// The admin is stored for future governance use but does not gate any
    /// function in this initial version — every function is owner-gated (per
    /// profile) or fully permissionless (reads).
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        // profile_id 0 is reserved/invalid; issue IDs starting from 1.
        env.storage().instance().set(&DataKey::NextId, &1u128);
    }

    // ── Mutations ────────────────────────────────────────────────────────────

    /// Register a new profile. Returns the assigned `profile_id` (starts at 1).
    ///
    /// Requires the `owner` address to have authorized this call.
    pub fn register(
        env: Env,
        owner: Address,
        handle: String,
        metadata_uri: String,
    ) -> Result<u128, Error> {
        owner.require_auth();

        let normalized = validate_and_normalize(&env, &handle)?;

        // Uniqueness check on the normalized handle.
        let handle_key = DataKey::Handle(normalized.clone());
        if env.storage().persistent().has(&handle_key) {
            return Err(Error::HandleTaken);
        }

        // Allocate a profile_id.
        let profile_id: u128 = env.storage().instance().get(&DataKey::NextId).unwrap();
        env.storage()
            .instance()
            .set(&DataKey::NextId, &(profile_id + 1));

        let profile = Profile {
            owner: owner.clone(),
            handle: normalized.clone(),
            metadata_uri,
            created_at: env.ledger().timestamp(),
            follower_count: 0,
            following_count: 0,
        };

        // Write to persistent storage and extend TTL.
        let profile_key = DataKey::Profile(profile_id);
        env.storage().persistent().set(&profile_key, &profile);
        env.storage().persistent().extend_ttl(
            &profile_key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );

        env.storage().persistent().set(&handle_key, &profile_id);
        env.storage().persistent().extend_ttl(
            &handle_key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );

        ProfileRegistered {
            profile_id,
            owner: owner.clone(),
            handle: normalized.clone(),
        }
        .publish(&env);

        Ok(profile_id)
    }

    /// Update the `metadata_uri` of an existing profile.
    ///
    /// Requires auth from the profile's stored owner (not an arbitrary caller).
    pub fn update_metadata(
        env: Env,
        profile_id: u128,
        metadata_uri: String,
    ) -> Result<(), Error> {
        let mut profile = Self::load_profile(&env, profile_id)?;
        // Auth must come from the stored owner, not a caller-supplied address.
        profile.owner.require_auth();

        profile.metadata_uri = metadata_uri;

        let key = DataKey::Profile(profile_id);
        env.storage().persistent().set(&key, &profile);
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );

        ProfileMetadataUpdated {
            profile_id,
            field: Symbol::new(&env, "metadata"),
        }
        .publish(&env);

        Ok(())
    }

    /// Transfer ownership of a profile to `new_owner`.
    ///
    /// Requires auth from the profile's current stored owner.
    pub fn transfer_ownership(
        env: Env,
        profile_id: u128,
        new_owner: Address,
    ) -> Result<(), Error> {
        let mut profile = Self::load_profile(&env, profile_id)?;
        profile.owner.require_auth();

        profile.owner = new_owner;

        let key = DataKey::Profile(profile_id);
        env.storage().persistent().set(&key, &profile);
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );

        ProfileOwnerTransferred {
            profile_id,
            field: Symbol::new(&env, "owner"),
        }
        .publish(&env);

        Ok(())
    }

    // ── Reads (permissionless) ───────────────────────────────────────────────

    /// Return the profile for a given `profile_id`.
    ///
    /// No authentication required — permissionless read.
    pub fn get_profile(env: Env, profile_id: u128) -> Result<Profile, Error> {
        Self::load_profile(&env, profile_id)
    }

    /// Return the `profile_id` for a registered handle.
    ///
    /// The `handle` input is normalized before lookup — case-insensitive.
    /// No authentication required — permissionless read.
    pub fn resolve_handle(env: Env, handle: String) -> Result<u128, Error> {
        let normalized = validate_and_normalize(&env, &handle)?;
        let key = DataKey::Handle(normalized);
        env.storage()
            .persistent()
            .get::<DataKey, u128>(&key)
            .ok_or(Error::ProfileNotFound)
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    fn load_profile(env: &Env, profile_id: u128) -> Result<Profile, Error> {
        env.storage()
            .persistent()
            .get::<DataKey, Profile>(&DataKey::Profile(profile_id))
            .ok_or(Error::ProfileNotFound)
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

    // ── Helpers ──────────────────────────────────────────────────────────────

    fn setup() -> (Env, ProfileRegistryClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(ProfileRegistry, (&admin,));
        let client = ProfileRegistryClient::new(&env, &contract_id);
        (env, client)
    }

    fn s(env: &Env, val: &str) -> String {
        String::from_str(env, val)
    }

    // ── Test 1: first registration returns profile_id = 1 ────────────────────

    #[test]
    fn test_register_returns_id_starting_at_one() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let id = client.register(&owner, &s(&env, "alice"), &s(&env, "ipfs://Qm123"));
        assert_eq!(id, 1u128);
    }

    // ── Test 2: counter increments correctly ─────────────────────────────────

    #[test]
    fn test_register_counter_increments() {
        let (env, client) = setup();
        let o1 = Address::generate(&env);
        let o2 = Address::generate(&env);
        let id1 = client.register(&o1, &s(&env, "alice"), &s(&env, ""));
        let id2 = client.register(&o2, &s(&env, "bob"), &s(&env, ""));
        assert_eq!(id1, 1u128);
        assert_eq!(id2, 2u128);
    }

    // ── Test 3: duplicate handle same case → HandleTaken ─────────────────────

    #[test]
    fn test_duplicate_handle_same_case() {
        let (env, client) = setup();
        let o1 = Address::generate(&env);
        let o2 = Address::generate(&env);
        client.register(&o1, &s(&env, "alice"), &s(&env, ""));
        let result = client.try_register(&o2, &s(&env, "alice"), &s(&env, ""));
        assert_eq!(result, Err(Ok(Error::HandleTaken)));
    }

    // ── Test 4: duplicate handle different case → HandleTaken ────────────────

    #[test]
    fn test_duplicate_handle_different_case() {
        let (env, client) = setup();
        let o1 = Address::generate(&env);
        let o2 = Address::generate(&env);
        // Register with uppercase A.
        client.register(&o1, &s(&env, "Alice"), &s(&env, ""));
        // Try to register again with lowercase — must collide.
        let result = client.try_register(&o2, &s(&env, "alice"), &s(&env, ""));
        assert_eq!(result, Err(Ok(Error::HandleTaken)));
    }

    // ── Test 5: handle with invalid characters → HandleInvalid ───────────────

    #[test]
    fn test_handle_invalid_hyphen() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        // Hyphen is not in [a-zA-Z0-9_].
        let result = client.try_register(&owner, &s(&env, "bad-handle"), &s(&env, ""));
        assert_eq!(result, Err(Ok(Error::HandleInvalid)));
    }

    #[test]
    fn test_handle_invalid_space() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let result = client.try_register(&owner, &s(&env, "bad handle"), &s(&env, ""));
        assert_eq!(result, Err(Ok(Error::HandleInvalid)));
    }

    #[test]
    fn test_handle_invalid_at_sign() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let result = client.try_register(&owner, &s(&env, "bad@handle"), &s(&env, ""));
        assert_eq!(result, Err(Ok(Error::HandleInvalid)));
    }

    // ── Test 6: handle too short → HandleTooShort ────────────────────────────

    #[test]
    fn test_handle_too_short_two_chars() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let result = client.try_register(&owner, &s(&env, "ab"), &s(&env, ""));
        assert_eq!(result, Err(Ok(Error::HandleTooShort)));
    }

    #[test]
    fn test_handle_too_short_one_char() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let result = client.try_register(&owner, &s(&env, "a"), &s(&env, ""));
        assert_eq!(result, Err(Ok(Error::HandleTooShort)));
    }

    // ── Test 7: handle too long → HandleTooLong ──────────────────────────────

    #[test]
    fn test_handle_too_long_31_chars() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        // 31 'a' characters.
        let result = client.try_register(
            &owner,
            &s(&env, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
            &s(&env, ""),
        );
        assert_eq!(result, Err(Ok(Error::HandleTooLong)));
    }

    // Edge: exactly 30 chars should succeed.
    #[test]
    fn test_handle_exactly_30_chars_succeeds() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let id = client.register(&owner, &s(&env, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), &s(&env, ""));
        assert_eq!(id, 1u128);
    }

    // ── Test 8: get_profile on nonexistent id → ProfileNotFound ─────────────

    #[test]
    fn test_get_profile_not_found() {
        let (_env, client) = setup();
        let result = client.try_get_profile(&999u128);
        assert_eq!(result, Err(Ok(Error::ProfileNotFound)));
    }

    // ── Test 9: resolve_handle on nonexistent handle → ProfileNotFound ───────

    #[test]
    fn test_resolve_handle_not_found() {
        let (env, client) = setup();
        let result = client.try_resolve_handle(&s(&env, "ghost"));
        assert_eq!(result, Err(Ok(Error::ProfileNotFound)));
    }

    // ── Test 10: resolve_handle is case-insensitive ───────────────────────────

    #[test]
    fn test_resolve_handle_case_insensitive() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let id = client.register(&owner, &s(&env, "Alice"), &s(&env, ""));
        // Lowercase lookup.
        assert_eq!(client.resolve_handle(&s(&env, "alice")), id);
        // Original-case lookup.
        assert_eq!(client.resolve_handle(&s(&env, "Alice")), id);
        // All uppercase.
        assert_eq!(client.resolve_handle(&s(&env, "ALICE")), id);
    }

    // ── Test 11: update_metadata by owner succeeds, only changes metadata_uri ─

    #[test]
    fn test_update_metadata_success() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let id = client.register(&owner, &s(&env, "alice"), &s(&env, "ipfs://old"));

        client.update_metadata(&id, &s(&env, "ipfs://new"));

        let profile = client.get_profile(&id);
        assert_eq!(profile.metadata_uri, s(&env, "ipfs://new"));
        // Other fields must be untouched.
        assert_eq!(profile.handle, Symbol::new(&env, "alice"));
        assert_eq!(profile.owner, owner);
        assert_eq!(profile.follower_count, 0u32);
        assert_eq!(profile.following_count, 0u32);
    }

    // ── Test 12: update_metadata enforces owner auth ──────────────────────────

    #[test]
    fn test_update_metadata_auth_enforced() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(ProfileRegistry, (&admin,));
        let client = ProfileRegistryClient::new(&env, &contract_id);

        // Register normally (mock all auth for setup).
        env.mock_all_auths();
        let owner = Address::generate(&env);
        let id = client.register(&owner, &s(&env, "alice"), &s(&env, ""));

        // Now set up an explicit mock auth for an attacker instead of the owner.
        let attacker = Address::generate(&env);
        env.mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &client.address,
                fn_name: "update_metadata",
                args: (id, s(&env, "ipfs://evil")).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        // Must fail — owner auth not satisfied.
        let result = client.try_update_metadata(&id, &s(&env, "ipfs://evil"));
        assert!(result.is_err());
    }

    // ── Test 13: transfer_ownership succeeds, new owner reflected ────────────

    #[test]
    fn test_transfer_ownership_success() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let new_owner = Address::generate(&env);

        let id = client.register(&owner, &s(&env, "alice"), &s(&env, ""));
        client.transfer_ownership(&id, &new_owner);

        let profile = client.get_profile(&id);
        assert_eq!(profile.owner, new_owner);
        // Handle and other fields must be untouched.
        assert_eq!(profile.handle, Symbol::new(&env, "alice"));
        assert_eq!(profile.follower_count, 0u32);
    }

    // ── Test 14: transfer_ownership by non-owner fails ────────────────────────

    #[test]
    fn test_transfer_ownership_non_owner_fails() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(ProfileRegistry, (&admin,));
        let client = ProfileRegistryClient::new(&env, &contract_id);

        env.mock_all_auths();
        let owner = Address::generate(&env);
        let attacker = Address::generate(&env);
        let id = client.register(&owner, &s(&env, "alice"), &s(&env, ""));

        // Mock auth for the attacker only, not the owner.
        env.mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &client.address,
                fn_name: "transfer_ownership",
                args: (id, attacker.clone()).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        let result = client.try_transfer_ownership(&id, &attacker);
        assert!(result.is_err());
    }

    // ── Test 15: register without owner auth fails ────────────────────────────

    #[test]
    fn test_register_requires_owner_auth() {
        let env = Env::default();
        // Do NOT mock any auths.
        let admin = Address::generate(&env);
        let contract_id = env.register(ProfileRegistry, (&admin,));
        let client = ProfileRegistryClient::new(&env, &contract_id);

        let owner = Address::generate(&env);

        // Mock auth for a different address (the admin), not the owner.
        env.mock_auths(&[MockAuth {
            address: &admin,
            invoke: &MockAuthInvoke {
                contract: &client.address,
                fn_name: "register",
                args: (owner.clone(), s(&env, "alice"), s(&env, "")).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        // owner.require_auth() will fail because auth was set up for admin, not owner.
        let result = client.try_register(&owner, &s(&env, "alice"), &s(&env, ""));
        assert!(result.is_err());
    }
}
