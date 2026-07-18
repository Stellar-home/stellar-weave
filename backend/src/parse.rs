//! Event payload parsing.
//!
//! The Soroban RPC returns event topics and values as base64-encoded XDR
//! `ScVal` strings. This module decodes them into typed Rust structs.
//!
//! ## Contract event shapes (from contracts/profile-registry/src/lib.rs)
//!
//! `profile_registered` event  (#[contractevent(topics = ["profile_registered"])]):
//!   topic[0] = ScVal::Symbol("profile_registered")   ← event name from #[contractevent]
//!   topic[1] = ScVal::U128(profile_id)               ← the #[topic] field
//!   value    = ScVal::Map { owner: Address, handle: Symbol }
//!              (all non-topic fields packed into the body as an ScMap)
//!
//! `profile_updated` event (#[contractevent(topics = ["profile_updated"])]):
//!   topic[0] = ScVal::Symbol("profile_updated")
//!   topic[1] = ScVal::U128(profile_id)
//!   value    = ScVal::Map { field: Symbol("metadata" | "owner") }

use anyhow::{Context, Result, anyhow, bail};
use stellar_xdr::{AccountId, Limits, PublicKey, ReadXdr, ScAddress, ScVal};

/// Topic name decoded from `topic[0]`.
#[derive(Debug, Clone, PartialEq)]
pub enum EventTopic {
    ProfileRegistered,
    ProfileUpdated,
    Unknown(String),
}

/// Decode the first topic string (event name) from a base64 XDR ScVal.
pub fn decode_topic_name(b64: &str) -> Result<EventTopic> {
    let val =
        ScVal::from_xdr_base64(b64, Limits::none()).context("failed to decode topic[0] XDR")?;
    match val {
        ScVal::Symbol(s) => {
            let name = symbol_to_str(&s)?;
            match name.as_str() {
                "profile_registered" => Ok(EventTopic::ProfileRegistered),
                "profile_updated" => Ok(EventTopic::ProfileUpdated),
                other => Ok(EventTopic::Unknown(other.to_string())),
            }
        }
        other => bail!("expected ScVal::Symbol for topic[0], got {:?}", other),
    }
}

/// Decode a `u128` profile_id from topic[1] (ScVal::U128 parts).
pub fn decode_profile_id(b64: &str) -> Result<u128> {
    let val =
        ScVal::from_xdr_base64(b64, Limits::none()).context("failed to decode profile_id XDR")?;
    match val {
        ScVal::U128(parts) => {
            let hi = (parts.hi as u128) << 64;
            let lo = parts.lo as u128;
            Ok(hi | lo)
        }
        other => bail!("expected ScVal::U128 for profile_id, got {:?}", other),
    }
}

/// Decode the value body of a `profile_registered` event.
///
/// Expected shape: ScVal::Map with keys "owner" (ScVal::Address) and
/// "handle" (ScVal::Symbol).
/// Returns `(owner_strkey, handle)`.
pub fn decode_profile_registered_value(b64: &str) -> Result<(String, String)> {
    let val = ScVal::from_xdr_base64(b64, Limits::none())
        .context("failed to decode profile_registered value XDR")?;

    let map = match val {
        ScVal::Map(Some(m)) => m,
        other => bail!(
            "expected ScVal::Map for profile_registered value, got {:?}",
            other
        ),
    };

    let mut owner: Option<String> = None;
    let mut handle: Option<String> = None;

    for entry in map.iter() {
        let key_name = match &entry.key {
            ScVal::Symbol(s) => symbol_to_str(s)?,
            other => bail!(
                "expected Symbol key in profile_registered map, got {:?}",
                other
            ),
        };
        match key_name.as_str() {
            "owner" => {
                owner = Some(decode_address_from_scval(&entry.val)?);
            }
            "handle" => {
                handle = Some(decode_symbol_from_scval(&entry.val)?);
            }
            _ => {} // forward-compatible: ignore unknown keys
        }
    }

    let owner = owner.ok_or_else(|| anyhow!("profile_registered value missing 'owner' field"))?;
    let handle =
        handle.ok_or_else(|| anyhow!("profile_registered value missing 'handle' field"))?;

    Ok((owner, handle))
}

/// Decode the value body of a `profile_updated` event.
///
/// Expected shape: ScVal::Map with key "field" → ScVal::Symbol.
/// Returns the field name ("metadata" or "owner").
pub fn decode_profile_updated_value(b64: &str) -> Result<String> {
    let val = ScVal::from_xdr_base64(b64, Limits::none())
        .context("failed to decode profile_updated value XDR")?;

    let map = match val {
        ScVal::Map(Some(m)) => m,
        other => bail!(
            "expected ScVal::Map for profile_updated value, got {:?}",
            other
        ),
    };

    for entry in map.iter() {
        if let ScVal::Symbol(k) = &entry.key
            && symbol_to_str(k).unwrap_or_default() == "field"
        {
            return decode_symbol_from_scval(&entry.val);
        }
    }

    bail!("profile_updated value missing 'field' key")
}

// ── ScVal extractors ───────────────────────────────────────────────────────────

/// Encode a Stellar address (Account or Contract) from `ScVal::Address`
/// to its strkey string representation (G... or C...).
fn decode_address_from_scval(val: &ScVal) -> Result<String> {
    match val {
        ScVal::Address(addr) => match addr {
            ScAddress::Account(AccountId(PublicKey::PublicKeyTypeEd25519(key))) => {
                let raw: [u8; 32] = key.0;
                let strkey = stellar_strkey::Strkey::PublicKeyEd25519(
                    stellar_strkey::ed25519::PublicKey(raw),
                );
                Ok(strkey.to_string())
            }
            ScAddress::Contract(hash) => {
                let raw: [u8; 32] = hash.0.clone().into();
                let strkey = stellar_strkey::Strkey::Contract(stellar_strkey::Contract(raw));
                Ok(strkey.to_string())
            }
            other => bail!(
                "ScAddress variant not supported for owner field: {:?}",
                other
            ),
        },
        other => bail!("expected ScVal::Address, got {:?}", other),
    }
}

/// Extract the inner string from `ScVal::Symbol`.
fn decode_symbol_from_scval(val: &ScVal) -> Result<String> {
    match val {
        ScVal::Symbol(s) => symbol_to_str(s),
        other => bail!("expected ScVal::Symbol, got {:?}", other),
    }
}

/// Convert a `ScSymbol` to a Rust `String`.
/// ScSymbol wraps `StringM<32>` which stores raw bytes; they are always ASCII
/// per the Soroban spec but we validate with `from_utf8` defensively.
fn symbol_to_str(sym: &stellar_xdr::ScSymbol) -> Result<String> {
    // ScSymbol implements AsRef<[u8]>
    let bytes: &[u8] = sym.as_ref();
    std::str::from_utf8(bytes)
        .map(|s| s.to_string())
        .map_err(|e| anyhow!("ScSymbol is not valid UTF-8: {}", e))
}

// ── Tests ──────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use stellar_xdr::{
        AccountId, Limits, PublicKey, ScAddress, ScMap, ScMapEntry, ScSymbol, ScVal, StringM,
        UInt128Parts, Uint256, VecM, WriteXdr,
    };

    fn make_symbol_b64(s: &str) -> String {
        let sym = ScSymbol(StringM::try_from(s.as_bytes().to_vec()).expect("valid symbol"));
        ScVal::Symbol(sym)
            .to_xdr_base64(Limits::none())
            .expect("XDR encode must succeed")
    }

    fn make_u128_b64(val: u128) -> String {
        let parts = UInt128Parts {
            hi: (val >> 64) as u64,
            lo: val as u64,
        };
        ScVal::U128(parts)
            .to_xdr_base64(Limits::none())
            .expect("XDR encode must succeed")
    }

    fn make_sym(s: &str) -> ScVal {
        ScVal::Symbol(ScSymbol(
            StringM::try_from(s.as_bytes().to_vec()).expect("valid symbol"),
        ))
    }

    fn make_registered_value_b64(owner_strkey: &str, handle: &str) -> String {
        let strkey = stellar_strkey::Strkey::from_string(owner_strkey).expect("valid strkey");
        let raw = match strkey {
            stellar_strkey::Strkey::PublicKeyEd25519(k) => k.0,
            _ => panic!("expected G... strkey"),
        };
        let key_bytes = Uint256(raw);
        let address = ScAddress::Account(AccountId(PublicKey::PublicKeyTypeEd25519(key_bytes)));

        let entries = vec![
            ScMapEntry {
                key: make_sym("owner"),
                val: ScVal::Address(address),
            },
            ScMapEntry {
                key: make_sym("handle"),
                val: make_sym(handle),
            },
        ];
        let map = ScMap(VecM::try_from(entries).unwrap());
        ScVal::Map(Some(map))
            .to_xdr_base64(Limits::none())
            .expect("XDR encode must succeed")
    }

    fn make_updated_value_b64(field: &str) -> String {
        let entries = vec![ScMapEntry {
            key: make_sym("field"),
            val: make_sym(field),
        }];
        let map = ScMap(VecM::try_from(entries).unwrap());
        ScVal::Map(Some(map))
            .to_xdr_base64(Limits::none())
            .expect("XDR encode must succeed")
    }

    // ── decode_topic_name ──────────────────────────────────────────────────

    #[test]
    fn test_decode_topic_name_profile_registered() {
        let b64 = make_symbol_b64("profile_registered");
        assert_eq!(
            decode_topic_name(&b64).unwrap(),
            EventTopic::ProfileRegistered
        );
    }

    #[test]
    fn test_decode_topic_name_profile_updated() {
        let b64 = make_symbol_b64("profile_updated");
        assert_eq!(decode_topic_name(&b64).unwrap(), EventTopic::ProfileUpdated);
    }

    #[test]
    fn test_decode_topic_name_unknown() {
        let b64 = make_symbol_b64("some_other_event");
        assert!(matches!(
            decode_topic_name(&b64).unwrap(),
            EventTopic::Unknown(_)
        ));
    }

    #[test]
    fn test_decode_topic_name_wrong_type_returns_error() {
        // A U128 where a Symbol is expected should return Err.
        let b64 = make_u128_b64(42);
        assert!(decode_topic_name(&b64).is_err());
    }

    // ── decode_profile_id ─────────────────────────────────────────────────

    #[test]
    fn test_decode_profile_id_one() {
        let b64 = make_u128_b64(1u128);
        assert_eq!(decode_profile_id(&b64).unwrap(), 1u128);
    }

    #[test]
    fn test_decode_profile_id_large() {
        let large: u128 = (42u128 << 64) | 999u128;
        let b64 = make_u128_b64(large);
        assert_eq!(decode_profile_id(&b64).unwrap(), large);
    }

    #[test]
    fn test_decode_profile_id_max() {
        let b64 = make_u128_b64(u128::MAX);
        assert_eq!(decode_profile_id(&b64).unwrap(), u128::MAX);
    }

    #[test]
    fn test_decode_profile_id_wrong_type_returns_error() {
        let b64 = make_symbol_b64("not_a_number");
        assert!(decode_profile_id(&b64).is_err());
    }

    // ── decode_profile_registered_value ──────────────────────────────────

    #[test]
    fn test_decode_profile_registered_value_roundtrip() {
        let owner = "GALDKWEV7OOWI45GUJT3X6LKNER6IBRK6RB5BZGE776HZ2RPBFSZHNRB";
        let handle = "weave_dev";
        let b64 = make_registered_value_b64(owner, handle);
        let (got_owner, got_handle) = decode_profile_registered_value(&b64).unwrap();
        assert_eq!(got_owner, owner);
        assert_eq!(got_handle, handle);
    }

    // ── decode_profile_updated_value ──────────────────────────────────────

    #[test]
    fn test_decode_profile_updated_metadata() {
        let b64 = make_updated_value_b64("metadata");
        assert_eq!(decode_profile_updated_value(&b64).unwrap(), "metadata");
    }

    #[test]
    fn test_decode_profile_updated_owner() {
        let b64 = make_updated_value_b64("owner");
        assert_eq!(decode_profile_updated_value(&b64).unwrap(), "owner");
    }
}
