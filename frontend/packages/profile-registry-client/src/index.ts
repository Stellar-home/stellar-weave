import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CCMV3J6W52JIZJVVX2YYBEALROVROU7KTDBLVSUYYMTLDTFJHXXPOKKP",
  }
} as const

export const Errors = {
  1: {message:"HandleTaken"},
  2: {message:"HandleInvalid"},
  3: {message:"ProfileNotFound"},
  4: {message:"NotProfileOwner"},
  5: {message:"HandleTooLong"},
  6: {message:"HandleTooShort"}
}

export type DataKey = {tag: "Admin", values: void} | {tag: "NextId", values: void} | {tag: "Profile", values: readonly [u128]} | {tag: "Handle", values: readonly [string]};


/**
 * v2: `follower_count` and `following_count` removed entirely.
 * Real counts are owned by FollowGraph (see contracts/follow-graph).
 * Removing them eliminates the permanently-zero vestigial fields that existed
 * in v1 and caused the README ⚠️ warning to be necessary.
 */
export interface Profile {
  /**
 * Ledger timestamp at registration.
 */
created_at: u64;
  /**
 * Normalized (lowercase) handle stored as Symbol.
 */
handle: string;
  /**
 * IPFS or Arweave content URI; may be empty string.
 */
metadata_uri: string;
  owner: string;
}

export interface Client {
  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Upgrade the contract Wasm to `new_wasm_hash`.
   * 
   * Auth is required from the admin address stored in *contract state*, not
   * from any caller-supplied parameter. This is deliberate: trusting a
   * caller-supplied "admin" argument instead of loading from storage is a
   * documented Soroban exploit pattern — an attacker could supply their own
   * address and bypass the check. We always load from storage.
   * 
   * The new Wasm must already be uploaded to the ledger before calling this.
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the contract version. This deployment is v2.
   * 
   * Security note: the admin key can upgrade this contract's Wasm bytecode.
   * This is a centralization point — document as a candidate for multisig/
   * timelock control before any mainnet deployment.
   */
  version: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a register transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Register a new profile. Returns the assigned profile_id (starts at 1).
   */
  register: ({owner, handle, metadata_uri}: {owner: string, handle: string, metadata_uri: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u128>>>

  /**
   * Construct and simulate a get_profile transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_profile: ({profile_id}: {profile_id: u128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Profile>>>

  /**
   * Construct and simulate a resolve_handle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  resolve_handle: ({handle}: {handle: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u128>>>

  /**
   * Construct and simulate a update_metadata transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update the metadata_uri of an existing profile.
   * 
   * v2: event is now `profile_metadata_updated` and carries the new value
   * directly, so an indexer does not need a follow-up get_profile call.
   */
  update_metadata: ({profile_id, metadata_uri}: {profile_id: u128, metadata_uri: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a transfer_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Transfer ownership of a profile to new_owner.
   * 
   * v2: event is now `profile_owner_transferred` and carries the new owner
   * address directly, so an indexer does not need a follow-up get_profile call.
   */
  transfer_ownership: ({profile_id, new_owner}: {profile_id: u128, new_owner: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin}: {admin: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAABgAAAAAAAAALSGFuZGxlVGFrZW4AAAAAAQAAAAAAAAANSGFuZGxlSW52YWxpZAAAAAAAAAIAAAAAAAAAD1Byb2ZpbGVOb3RGb3VuZAAAAAADAAAAAAAAAA9Ob3RQcm9maWxlT3duZXIAAAAABAAAAAAAAAANSGFuZGxlVG9vTG9uZwAAAAAAAAUAAAAAAAAADkhhbmRsZVRvb1Nob3J0AAAAAAAG",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABAAAAAAAAAA3aW5zdGFuY2Ugc3RvcmFnZSDigJQgYWRtaW4gYWRkcmVzcyBzZXQgYXQgY29uc3RydWN0aW9uLgAAAAAFQWRtaW4AAAAAAAAAAAAASmluc3RhbmNlIHN0b3JhZ2Ug4oCUIG1vbm90b25pY2FsbHkgaW5jcmVhc2luZyB1MTI4IGNvdW50ZXI7IDAgaXMgcmVzZXJ2ZWQuAAAAAAAGTmV4dElkAAAAAAABAAAALnBlcnNpc3RlbnQgc3RvcmFnZSDigJQgcHJvZmlsZV9pZCDihpIgUHJvZmlsZS4AAAAAAAdQcm9maWxlAAAAAAEAAAAKAAAAAQAAAEFwZXJzaXN0ZW50IHN0b3JhZ2Ug4oCUIG5vcm1hbGl6ZWQgaGFuZGxlIChTeW1ib2wpIOKGkiBwcm9maWxlX2lkLgAAAAAAAAZIYW5kbGUAAAAAAAEAAAAR",
        "AAAAAQAAAQd2MjogYGZvbGxvd2VyX2NvdW50YCBhbmQgYGZvbGxvd2luZ19jb3VudGAgcmVtb3ZlZCBlbnRpcmVseS4KUmVhbCBjb3VudHMgYXJlIG93bmVkIGJ5IEZvbGxvd0dyYXBoIChzZWUgY29udHJhY3RzL2ZvbGxvdy1ncmFwaCkuClJlbW92aW5nIHRoZW0gZWxpbWluYXRlcyB0aGUgcGVybWFuZW50bHktemVybyB2ZXN0aWdpYWwgZmllbGRzIHRoYXQgZXhpc3RlZAppbiB2MSBhbmQgY2F1c2VkIHRoZSBSRUFETUUg4pqg77iPIHdhcm5pbmcgdG8gYmUgbmVjZXNzYXJ5LgAAAAAAAAAAB1Byb2ZpbGUAAAAABAAAACFMZWRnZXIgdGltZXN0YW1wIGF0IHJlZ2lzdHJhdGlvbi4AAAAAAAAKY3JlYXRlZF9hdAAAAAAABgAAAC9Ob3JtYWxpemVkIChsb3dlcmNhc2UpIGhhbmRsZSBzdG9yZWQgYXMgU3ltYm9sLgAAAAAGaGFuZGxlAAAAAAARAAAAMUlQRlMgb3IgQXJ3ZWF2ZSBjb250ZW50IFVSSTsgbWF5IGJlIGVtcHR5IHN0cmluZy4AAAAAAAAMbWV0YWRhdGFfdXJpAAAAEAAAAAAAAAAFb3duZXIAAAAAAAAT",
        "AAAAAAAAAc5VcGdyYWRlIHRoZSBjb250cmFjdCBXYXNtIHRvIGBuZXdfd2FzbV9oYXNoYC4KCkF1dGggaXMgcmVxdWlyZWQgZnJvbSB0aGUgYWRtaW4gYWRkcmVzcyBzdG9yZWQgaW4gKmNvbnRyYWN0IHN0YXRlKiwgbm90CmZyb20gYW55IGNhbGxlci1zdXBwbGllZCBwYXJhbWV0ZXIuIFRoaXMgaXMgZGVsaWJlcmF0ZTogdHJ1c3RpbmcgYQpjYWxsZXItc3VwcGxpZWQgImFkbWluIiBhcmd1bWVudCBpbnN0ZWFkIG9mIGxvYWRpbmcgZnJvbSBzdG9yYWdlIGlzIGEKZG9jdW1lbnRlZCBTb3JvYmFuIGV4cGxvaXQgcGF0dGVybiDigJQgYW4gYXR0YWNrZXIgY291bGQgc3VwcGx5IHRoZWlyIG93bgphZGRyZXNzIGFuZCBieXBhc3MgdGhlIGNoZWNrLiBXZSBhbHdheXMgbG9hZCBmcm9tIHN0b3JhZ2UuCgpUaGUgbmV3IFdhc20gbXVzdCBhbHJlYWR5IGJlIHVwbG9hZGVkIHRvIHRoZSBsZWRnZXIgYmVmb3JlIGNhbGxpbmcgdGhpcy4AAAAAAAd1cGdyYWRlAAAAAAEAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAA=",
        "AAAAAAAAAPZSZXR1cm5zIHRoZSBjb250cmFjdCB2ZXJzaW9uLiBUaGlzIGRlcGxveW1lbnQgaXMgdjIuCgpTZWN1cml0eSBub3RlOiB0aGUgYWRtaW4ga2V5IGNhbiB1cGdyYWRlIHRoaXMgY29udHJhY3QncyBXYXNtIGJ5dGVjb2RlLgpUaGlzIGlzIGEgY2VudHJhbGl6YXRpb24gcG9pbnQg4oCUIGRvY3VtZW50IGFzIGEgY2FuZGlkYXRlIGZvciBtdWx0aXNpZy8KdGltZWxvY2sgY29udHJvbCBiZWZvcmUgYW55IG1haW5uZXQgZGVwbG95bWVudC4AAAAAAAd2ZXJzaW9uAAAAAAAAAAABAAAABA==",
        "AAAAAAAAAEZSZWdpc3RlciBhIG5ldyBwcm9maWxlLiBSZXR1cm5zIHRoZSBhc3NpZ25lZCBwcm9maWxlX2lkIChzdGFydHMgYXQgMSkuAAAAAAAIcmVnaXN0ZXIAAAADAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABmhhbmRsZQAAAAAAEAAAAAAAAAAMbWV0YWRhdGFfdXJpAAAAEAAAAAEAAAPpAAAACgAAAAM=",
        "AAAAAAAAAAAAAAALZ2V0X3Byb2ZpbGUAAAAAAQAAAAAAAAAKcHJvZmlsZV9pZAAAAAAACgAAAAEAAAPpAAAH0AAAAAdQcm9maWxlAAAAAAM=",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAOcmVzb2x2ZV9oYW5kbGUAAAAAAAEAAAAAAAAABmhhbmRsZQAAAAAAEAAAAAEAAAPpAAAACgAAAAM=",
        "AAAAAAAAALpVcGRhdGUgdGhlIG1ldGFkYXRhX3VyaSBvZiBhbiBleGlzdGluZyBwcm9maWxlLgoKdjI6IGV2ZW50IGlzIG5vdyBgcHJvZmlsZV9tZXRhZGF0YV91cGRhdGVkYCBhbmQgY2FycmllcyB0aGUgbmV3IHZhbHVlCmRpcmVjdGx5LCBzbyBhbiBpbmRleGVyIGRvZXMgbm90IG5lZWQgYSBmb2xsb3ctdXAgZ2V0X3Byb2ZpbGUgY2FsbC4AAAAAAA91cGRhdGVfbWV0YWRhdGEAAAAAAgAAAAAAAAAKcHJvZmlsZV9pZAAAAAAACgAAAAAAAAAMbWV0YWRhdGFfdXJpAAAAEAAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAMFUcmFuc2ZlciBvd25lcnNoaXAgb2YgYSBwcm9maWxlIHRvIG5ld19vd25lci4KCnYyOiBldmVudCBpcyBub3cgYHByb2ZpbGVfb3duZXJfdHJhbnNmZXJyZWRgIGFuZCBjYXJyaWVzIHRoZSBuZXcgb3duZXIKYWRkcmVzcyBkaXJlY3RseSwgc28gYW4gaW5kZXhlciBkb2VzIG5vdCBuZWVkIGEgZm9sbG93LXVwIGdldF9wcm9maWxlIGNhbGwuAAAAAAAAEnRyYW5zZmVyX293bmVyc2hpcAAAAAAAAgAAAAAAAAAKcHJvZmlsZV9pZAAAAAAACgAAAAAAAAAJbmV3X293bmVyAAAAAAAAEwAAAAEAAAPpAAAAAgAAAAM=" ]),
      options
    )
  }
  public readonly fromJSON = {
    upgrade: this.txFromJSON<null>,
        version: this.txFromJSON<u32>,
        register: this.txFromJSON<Result<u128>>,
        get_profile: this.txFromJSON<Result<Profile>>,
        resolve_handle: this.txFromJSON<Result<u128>>,
        update_metadata: this.txFromJSON<Result<void>>,
        transfer_ownership: this.txFromJSON<Result<void>>
  }
}