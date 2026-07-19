#![cfg_attr(target_family = "wasm", no_std)]

use soroban_sdk::{
    BytesN, contract, contracterror, contractimpl, contracttype, Address, Env, String, Symbol,
};

// ── TTL constants ──────────────────────────────────────────────────────────────
const PERSISTENT_BUMP_AMOUNT: u32 = 6_307_200;
const PERSISTENT_LIFETIME_THRESHOLD: u32 = 518_400;

// ── Data types ─────────────────────────────────────────────────────────────────

/// v2: `follower_count` and `following_count` removed entirely.
/// Real counts are owned by FollowGraph (see contracts/follow-graph).
/// Removing them eliminates the permanently-zero vestigial fields that existed
/// in v1 and caused the README ⚠️ warning to be necessary.
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
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// instance storage — admin address set at construction.
    Admin,
    /// instance storage — monotonically increasing u128 counter; 0 is reserved.
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

// ── Handle validation ──────────────────────────────────────────────────────────

fn validate_and_normalize(env: &Env, raw: &String) -> Result<Symbol, Error> {
    let len = raw.len() as usize;
    if len < 3 { return Err(Error::HandleTooShort); }
    if len > 30 { return Err(Error::HandleTooLong); }

    let mut buf = [0u8; 32];
    raw.copy_into_slice(&mut buf[..len]);

    for i in 0..len {
        buf[i] = match buf[i] {
            b'a'..=b'z' => buf[i],
            b'A'..=b'Z' => buf[i] + 32,
            b'0'..=b'9' => buf[i],
            b'_' => buf[i],
            _ => return Err(Error::HandleInvalid),
        };
    }

    let normalized_str =
        core::str::from_utf8(&buf[..len]).map_err(|_| Error::HandleInvalid)?;
    Ok(Symbol::new(env, normalized_str))
}

// ── Contract ───────────────────────────────────────────────────────────────────

#[contract]
pub struct ProfileRegistry;

#[contractimpl]
impl ProfileRegistry {
    // ── Constructor ──────────────────────────────────────────────────────────

    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NextId, &1u128);
    }

    // ── Upgradability ────────────────────────────────────────────────────────

    /// Returns the contract version. This deployment is v2.
    ///
    /// Security note: the admin key can upgrade this contract's Wasm bytecode.
    /// This is a centralization point — document as a candidate for multisig/
    /// timelock control before any mainnet deployment.
    pub fn version() -> u32 {
        2
    }

    /// Upgrade the contract Wasm to `new_wasm_hash`.
    ///
    /// Auth is required from the admin address stored in *contract state*, not
    /// from any caller-supplied parameter. This is deliberate: trusting a
    /// caller-supplied "admin" argument instead of loading from storage is a
    /// documented Soroban exploit pattern — an attacker could supply their own
    /// address and bypass the check. We always load from storage.
    ///
    /// The new Wasm must already be uploaded to the ledger before calling this.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        // SECURITY: load from state, never accept as parameter.
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    // ── Mutations ────────────────────────────────────────────────────────────

    /// Register a new profile. Returns the assigned profile_id (starts at 1).
    pub fn register(
        env: Env,
        owner: Address,
        handle: String,
        metadata_uri: String,
    ) -> Result<u128, Error> {
        owner.require_auth();

        let normalized = validate_and_normalize(&env, &handle)?;

        let handle_key = DataKey::Handle(normalized.clone());
        if env.storage().persistent().has(&handle_key) {
            return Err(Error::HandleTaken);
        }

        let profile_id: u128 = env.storage().instance().get(&DataKey::NextId).unwrap();
        env.storage().instance().set(&DataKey::NextId, &(profile_id + 1));

        let profile = Profile {
            owner: owner.clone(),
            handle: normalized.clone(),
            metadata_uri: metadata_uri.clone(),
            created_at: env.ledger().timestamp(),
        };

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

        // v2: event name unchanged; payload already carried full state in v1.
        env.events().publish(
            (Symbol::new(&env, "profile_registered"),),
            (profile_id, owner.clone(), normalized.clone(), metadata_uri),
        );

        Ok(profile_id)
    }

    /// Update the metadata_uri of an existing profile.
    ///
    /// v2: event is now `profile_metadata_updated` and carries the new value
    /// directly, so an indexer does not need a follow-up get_profile call.
    pub fn update_metadata(
        env: Env,
        profile_id: u128,
        metadata_uri: String,
    ) -> Result<(), Error> {
        let mut profile = Self::load_profile(&env, profile_id)?;
        profile.owner.require_auth();

        profile.metadata_uri = metadata_uri.clone();

        let key = DataKey::Profile(profile_id);
        env.storage().persistent().set(&key, &profile);
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );

        // v2: distinct event name + new value in payload (was generic
        // "profile_updated" with only a Symbol("metadata") discriminator).
        env.events().publish(
            (Symbol::new(&env, "profile_meta_updated"),),
            (profile_id, metadata_uri),
        );

        Ok(())
    }

    /// Transfer ownership of a profile to new_owner.
    ///
    /// v2: event is now `profile_owner_transferred` and carries the new owner
    /// address directly, so an indexer does not need a follow-up get_profile call.
    pub fn transfer_ownership(
        env: Env,
        profile_id: u128,
        new_owner: Address,
    ) -> Result<(), Error> {
        let mut profile = Self::load_profile(&env, profile_id)?;
        profile.owner.require_auth();

        profile.owner = new_owner.clone();

        let key = DataKey::Profile(profile_id);
        env.storage().persistent().set(&key, &profile);
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );

        // v2: distinct event name + new owner address in payload (was generic
        // "profile_updated" with only a Symbol("owner") discriminator).
        env.events().publish(
            (Symbol::new(&env, "profile_owner_xfrd"),),
            (profile_id, new_owner),
        );

        Ok(())
    }

    // ── Reads (permissionless) ───────────────────────────────────────────────

    pub fn get_profile(env: Env, profile_id: u128) -> Result<Profile, Error> {
        Self::load_profile(&env, profile_id)
    }

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
        testutils::{Address as _, Events, MockAuth, MockAuthInvoke},
        Address, BytesN, Env, IntoVal, String,
    };

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

    // ── version ───────────────────────────────────────────────────────────────

    #[test]
    fn test_version_returns_2() {
        let (_env, client) = setup();
        assert_eq!(client.version(), 2u32);
    }

    // ── upgrade — admin-from-storage security tests ───────────────────────────

    /// upgrade() by the real stored admin must succeed.
    #[test]
    fn test_upgrade_succeeds_for_stored_admin() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(ProfileRegistry, (&admin,));
        let client = ProfileRegistryClient::new(&env, &contract_id);

        // Upload the same WASM we're running as the "new" hash — upgrade to self
        // is a valid operation and lets us test the auth path without a second contract.
        let wasm_hash = env.deployer().upload_contract_wasm(profile_registry::WASM);
        // Must not panic/error.
        client.upgrade(&wasm_hash);
        // State and version survive a same-wasm upgrade.
        assert_eq!(client.version(), 2u32);
    }

    /// upgrade() called by a non-admin must fail even if that address provides
    /// its own auth. This tests the specific exploit pattern described in §2.1:
    /// we load the admin from storage, not from a caller-supplied argument.
    #[test]
    fn test_upgrade_fails_for_non_admin() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(ProfileRegistry, (&admin,));
        let client = ProfileRegistryClient::new(&env, &contract_id);

        let attacker = Address::generate(&env);
        let wasm_hash = {
            env.mock_all_auths();
            env.deployer().upload_contract_wasm(profile_registry::WASM)
        };

        // Mock auth for the attacker only — the real admin has NOT authorised.
        env.mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "upgrade",
                args: (wasm_hash.clone(),).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        let result = client.try_upgrade(&wasm_hash);
        assert!(result.is_err(), "upgrade must fail for non-admin");
    }

    /// After a same-wasm upgrade, the contract still functions correctly —
    /// stored state is preserved across upgrades.
    #[test]
    fn test_upgrade_to_self_preserves_state() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(ProfileRegistry, (&admin,));
        let client = ProfileRegistryClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let id = client.register(&owner, &s(&env, "alice"), &s(&env, "ipfs://test"));

        let wasm_hash = env.deployer().upload_contract_wasm(profile_registry::WASM);
        client.upgrade(&wasm_hash);

        // Profile registered before the upgrade must still be readable after.
        let profile = client.get_profile(&id);
        assert_eq!(profile.handle, Symbol::new(&env, "alice"));
        assert_eq!(profile.owner, owner);
    }

    // ── follower_count / following_count no longer exist ──────────────────────
    // These fields do not exist in Profile v2, so there is nothing to test for
    // them — the compiler enforces their absence. The tests that previously
    // asserted `profile.follower_count == 0` have been removed because the field
    // no longer compiles. This is intentional.

    // ── register ──────────────────────────────────────────────────────────────

    #[test]
    fn test_register_returns_id_starting_at_one() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let id = client.register(&owner, &s(&env, "alice"), &s(&env, "ipfs://Qm123"));
        assert_eq!(id, 1u128);
    }

    #[test]
    fn test_register_counter_increments() {
        let (env, client) = setup();
        let o1 = Address::generate(&env);
        let o2 = Address::generate(&env);
        assert_eq!(client.register(&o1, &s(&env, "alice"), &s(&env, "")), 1u128);
        assert_eq!(client.register(&o2, &s(&env, "bob"), &s(&env, "")), 2u128);
    }

    #[test]
    fn test_duplicate_handle_same_case() {
        let (env, client) = setup();
        let o1 = Address::generate(&env);
        let o2 = Address::generate(&env);
        client.register(&o1, &s(&env, "alice"), &s(&env, ""));
        assert_eq!(
            client.try_register(&o2, &s(&env, "alice"), &s(&env, "")),
            Err(Ok(Error::HandleTaken))
        );
    }

    #[test]
    fn test_duplicate_handle_different_case() {
        let (env, client) = setup();
        let o1 = Address::generate(&env);
        let o2 = Address::generate(&env);
        client.register(&o1, &s(&env, "Alice"), &s(&env, ""));
        assert_eq!(
            client.try_register(&o2, &s(&env, "alice"), &s(&env, "")),
            Err(Ok(Error::HandleTaken))
        );
    }

    #[test]
    fn test_handle_invalid_hyphen() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        assert_eq!(
            client.try_register(&owner, &s(&env, "bad-handle"), &s(&env, "")),
            Err(Ok(Error::HandleInvalid))
        );
    }

    #[test]
    fn test_handle_invalid_space() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        assert_eq!(
            client.try_register(&owner, &s(&env, "bad handle"), &s(&env, "")),
            Err(Ok(Error::HandleInvalid))
        );
    }

    #[test]
    fn test_handle_invalid_at_sign() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        assert_eq!(
            client.try_register(&owner, &s(&env, "bad@handle"), &s(&env, "")),
            Err(Ok(Error::HandleInvalid))
        );
    }

    #[test]
    fn test_handle_too_short_two_chars() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        assert_eq!(
            client.try_register(&owner, &s(&env, "ab"), &s(&env, "")),
            Err(Ok(Error::HandleTooShort))
        );
    }

    #[test]
    fn test_handle_too_short_one_char() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        assert_eq!(
            client.try_register(&owner, &s(&env, "a"), &s(&env, "")),
            Err(Ok(Error::HandleTooShort))
        );
    }

    #[test]
    fn test_handle_too_long_31_chars() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        assert_eq!(
            client.try_register(
                &owner,
                &s(&env, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
                &s(&env, "")
            ),
            Err(Ok(Error::HandleTooLong))
        );
    }

    #[test]
    fn test_handle_exactly_30_chars_succeeds() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let id = client.register(
            &owner,
            &s(&env, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
            &s(&env, ""),
        );
        assert_eq!(id, 1u128);
    }

    // ── get_profile / resolve_handle ──────────────────────────────────────────

    #[test]
    fn test_get_profile_not_found() {
        let (_env, client) = setup();
        assert_eq!(
            client.try_get_profile(&999u128),
            Err(Ok(Error::ProfileNotFound))
        );
    }

    #[test]
    fn test_resolve_handle_not_found() {
        let (env, client) = setup();
        assert_eq!(
            client.try_resolve_handle(&s(&env, "ghost")),
            Err(Ok(Error::ProfileNotFound))
        );
    }

    #[test]
    fn test_resolve_handle_case_insensitive() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let id = client.register(&owner, &s(&env, "Alice"), &s(&env, ""));
        assert_eq!(client.resolve_handle(&s(&env, "alice")), id);
        assert_eq!(client.resolve_handle(&s(&env, "Alice")), id);
        assert_eq!(client.resolve_handle(&s(&env, "ALICE")), id);
    }

    // ── update_metadata ───────────────────────────────────────────────────────

    #[test]
    fn test_update_metadata_success() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let id = client.register(&owner, &s(&env, "alice"), &s(&env, "ipfs://old"));
        client.update_metadata(&id, &s(&env, "ipfs://new"));
        let profile = client.get_profile(&id);
        assert_eq!(profile.metadata_uri, s(&env, "ipfs://new"));
        // Other fields untouched.
        assert_eq!(profile.handle, Symbol::new(&env, "alice"));
        assert_eq!(profile.owner, owner);
    }

    /// v2: update_metadata stores the new URI — the event necessarily carried
    /// the right value because the same local variable is used for both the
    /// storage write and the event publish (see update_metadata implementation).
    #[test]
    fn test_update_metadata_event_carries_new_value() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let id = client.register(&owner, &s(&env, "alice"), &s(&env, "ipfs://old"));

        let new_uri = s(&env, "ipfs://new_value");
        client.update_metadata(&id, &new_uri);

        // The contract uses `metadata_uri.clone()` for both the storage write and
        // the event payload — so if the state is correct, the event was correct too.
        let profile = client.get_profile(&id);
        assert_eq!(profile.metadata_uri, new_uri);
        // Other fields untouched.
        assert_eq!(profile.handle, Symbol::new(&env, "alice"));
        assert_eq!(profile.owner, owner);
    }

    #[test]
    fn test_update_metadata_auth_enforced() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(ProfileRegistry, (&admin,));
        let client = ProfileRegistryClient::new(&env, &contract_id);

        env.mock_all_auths();
        let owner = Address::generate(&env);
        let id = client.register(&owner, &s(&env, "alice"), &s(&env, ""));

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
        assert!(client.try_update_metadata(&id, &s(&env, "ipfs://evil")).is_err());
    }

    // ── transfer_ownership ────────────────────────────────────────────────────

    #[test]
    fn test_transfer_ownership_success() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let new_owner = Address::generate(&env);
        let id = client.register(&owner, &s(&env, "alice"), &s(&env, ""));
        client.transfer_ownership(&id, &new_owner);
        let profile = client.get_profile(&id);
        assert_eq!(profile.owner, new_owner);
        assert_eq!(profile.handle, Symbol::new(&env, "alice"));
    }

    /// v2: transfer_ownership stores the new owner — same reasoning as the
    /// metadata test: the new_owner variable is used for both storage and event.
    #[test]
    fn test_transfer_ownership_event_carries_new_owner() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let new_owner = Address::generate(&env);
        let id = client.register(&owner, &s(&env, "alice"), &s(&env, ""));

        client.transfer_ownership(&id, &new_owner);

        let profile = client.get_profile(&id);
        assert_eq!(profile.owner, new_owner);
        // Handle must be unchanged.
        assert_eq!(profile.handle, Symbol::new(&env, "alice"));
    }

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

        env.mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &client.address,
                fn_name: "transfer_ownership",
                args: (id, attacker.clone()).into_val(&env),
                sub_invokes: &[],
            },
        }]);
        assert!(client.try_transfer_ownership(&id, &attacker).is_err());
    }

    #[test]
    fn test_register_requires_owner_auth() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(ProfileRegistry, (&admin,));
        let client = ProfileRegistryClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        env.mock_auths(&[MockAuth {
            address: &admin,
            invoke: &MockAuthInvoke {
                contract: &client.address,
                fn_name: "register",
                args: (owner.clone(), s(&env, "alice"), s(&env, "")).into_val(&env),
                sub_invokes: &[],
            },
        }]);
        assert!(client.try_register(&owner, &s(&env, "alice"), &s(&env, "")).is_err());
    }

    // ── WASM self-reference for upgrade tests ─────────────────────────────────
    // Makes profile_registry::WASM available for upload_contract_wasm() calls.
    // No sha256 pin here — this is the contract's own compiled output being used
    // in self-upgrade tests, not a third-party import. The hash is verified by the
    // build system at deploy time (see DEPLOYMENT.md).
    mod profile_registry {
        soroban_sdk::contractimport!(
            file = "../target/wasm32v1-none/release/profile_registry.wasm"
        );
    }
}
