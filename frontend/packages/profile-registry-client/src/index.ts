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
    contractId: "CAVUZWNQ322DFBNDEENP6GBYF6ESZFQDIEJN5C367WIG23AFMZO7ZLDU",
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


export interface Profile {
  /**
 * Ledger timestamp at registration.
 */
created_at: u64;
  /**
 * Reserved for FollowGraph — always 0 in this contract.
 */
follower_count: u32;
  /**
 * Reserved for FollowGraph — always 0 in this contract.
 */
following_count: u32;
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
   * Construct and simulate a register transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Register a new profile. Returns the assigned `profile_id` (starts at 1).
   * 
   * Requires the `owner` address to have authorized this call.
   */
  register: ({owner, handle, metadata_uri}: {owner: string, handle: string, metadata_uri: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u128>>>

  /**
   * Construct and simulate a get_profile transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return the profile for a given `profile_id`.
   * 
   * No authentication required — permissionless read.
   */
  get_profile: ({profile_id}: {profile_id: u128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Profile>>>

  /**
   * Construct and simulate a resolve_handle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return the `profile_id` for a registered handle.
   * 
   * The `handle` input is normalized before lookup — case-insensitive.
   * No authentication required — permissionless read.
   */
  resolve_handle: ({handle}: {handle: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u128>>>

  /**
   * Construct and simulate a update_metadata transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update the `metadata_uri` of an existing profile.
   * 
   * Requires auth from the profile's stored owner (not an arbitrary caller).
   */
  update_metadata: ({profile_id, metadata_uri}: {profile_id: u128, metadata_uri: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a transfer_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Transfer ownership of a profile to `new_owner`.
   * 
   * Requires auth from the profile's current stored owner.
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
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABAAAAAAAAAAuaW5zdGFuY2Ugc3RvcmFnZSDigJQgc2V0IG9uY2UgYXQgY29uc3RydWN0aW9uLgAAAAAABUFkbWluAAAAAAAAAAAAAFVpbnN0YW5jZSBzdG9yYWdlIOKAlCBtb25vdG9uaWNhbGx5IGluY3JlYXNpbmcgdTEyOCBjb3VudGVyOyBwcm9maWxlX2lkIDAgaXMgcmVzZXJ2ZWQuAAAAAAAABk5leHRJZAAAAAAAAQAAAC5wZXJzaXN0ZW50IHN0b3JhZ2Ug4oCUIHByb2ZpbGVfaWQg4oaSIFByb2ZpbGUuAAAAAAAHUHJvZmlsZQAAAAABAAAACgAAAAEAAABBcGVyc2lzdGVudCBzdG9yYWdlIOKAlCBub3JtYWxpemVkIGhhbmRsZSAoU3ltYm9sKSDihpIgcHJvZmlsZV9pZC4AAAAAAAAGSGFuZGxlAAAAAAABAAAAEQ==",
        "AAAAAQAAAAAAAAAAAAAAB1Byb2ZpbGUAAAAABgAAACFMZWRnZXIgdGltZXN0YW1wIGF0IHJlZ2lzdHJhdGlvbi4AAAAAAAAKY3JlYXRlZF9hdAAAAAAABgAAADdSZXNlcnZlZCBmb3IgRm9sbG93R3JhcGgg4oCUIGFsd2F5cyAwIGluIHRoaXMgY29udHJhY3QuAAAAAA5mb2xsb3dlcl9jb3VudAAAAAAABAAAADdSZXNlcnZlZCBmb3IgRm9sbG93R3JhcGgg4oCUIGFsd2F5cyAwIGluIHRoaXMgY29udHJhY3QuAAAAAA9mb2xsb3dpbmdfY291bnQAAAAABAAAAC9Ob3JtYWxpemVkIChsb3dlcmNhc2UpIGhhbmRsZSBzdG9yZWQgYXMgU3ltYm9sLgAAAAAGaGFuZGxlAAAAAAARAAAAMUlQRlMgb3IgQXJ3ZWF2ZSBjb250ZW50IFVSSTsgbWF5IGJlIGVtcHR5IHN0cmluZy4AAAAAAAAMbWV0YWRhdGFfdXJpAAAAEAAAAAAAAAAFb3duZXIAAAAAAAAT",
        "AAAAAAAAAIRSZWdpc3RlciBhIG5ldyBwcm9maWxlLiBSZXR1cm5zIHRoZSBhc3NpZ25lZCBgcHJvZmlsZV9pZGAgKHN0YXJ0cyBhdCAxKS4KClJlcXVpcmVzIHRoZSBgb3duZXJgIGFkZHJlc3MgdG8gaGF2ZSBhdXRob3JpemVkIHRoaXMgY2FsbC4AAAAIcmVnaXN0ZXIAAAADAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABmhhbmRsZQAAAAAAEAAAAAAAAAAMbWV0YWRhdGFfdXJpAAAAEAAAAAEAAAPpAAAACgAAAAM=",
        "AAAABQAAAEVFbWl0dGVkIHdoZW4gYSBuZXcgcHJvZmlsZSBpcyByZWdpc3RlcmVkLgpUb3BpYzogYHByb2ZpbGVfcmVnaXN0ZXJlZGAAAAAAAAAAAAAAEVByb2ZpbGVSZWdpc3RlcmVkAAAAAAAAAQAAABJwcm9maWxlX3JlZ2lzdGVyZWQAAAAAAAMAAAAAAAAACnByb2ZpbGVfaWQAAAAAAAoAAAABAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAAAAAAAAZoYW5kbGUAAAAAABEAAAAAAAAAAg==",
        "AAAAAAAAAGFSZXR1cm4gdGhlIHByb2ZpbGUgZm9yIGEgZ2l2ZW4gYHByb2ZpbGVfaWRgLgoKTm8gYXV0aGVudGljYXRpb24gcmVxdWlyZWQg4oCUIHBlcm1pc3Npb25sZXNzIHJlYWQuAAAAAAAAC2dldF9wcm9maWxlAAAAAAEAAAAAAAAACnByb2ZpbGVfaWQAAAAAAAoAAAABAAAD6QAAB9AAAAAHUHJvZmlsZQAAAAAD",
        "AAAAAAAAAO9Jbml0aWFsaXplIHRoZSByZWdpc3RyeSB3aXRoIGEgZGVzaWduYXRlZCBhZG1pbiBhZGRyZXNzLgoKVGhlIGFkbWluIGlzIHN0b3JlZCBmb3IgZnV0dXJlIGdvdmVybmFuY2UgdXNlIGJ1dCBkb2VzIG5vdCBnYXRlIGFueQpmdW5jdGlvbiBpbiB0aGlzIGluaXRpYWwgdmVyc2lvbiDigJQgZXZlcnkgZnVuY3Rpb24gaXMgb3duZXItZ2F0ZWQgKHBlcgpwcm9maWxlKSBvciBmdWxseSBwZXJtaXNzaW9ubGVzcyAocmVhZHMpLgAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAKpSZXR1cm4gdGhlIGBwcm9maWxlX2lkYCBmb3IgYSByZWdpc3RlcmVkIGhhbmRsZS4KClRoZSBgaGFuZGxlYCBpbnB1dCBpcyBub3JtYWxpemVkIGJlZm9yZSBsb29rdXAg4oCUIGNhc2UtaW5zZW5zaXRpdmUuCk5vIGF1dGhlbnRpY2F0aW9uIHJlcXVpcmVkIOKAlCBwZXJtaXNzaW9ubGVzcyByZWFkLgAAAAAADnJlc29sdmVfaGFuZGxlAAAAAAABAAAAAAAAAAZoYW5kbGUAAAAAABAAAAABAAAD6QAAAAoAAAAD",
        "AAAABQAAAEpFbWl0dGVkIHdoZW4gYSBwcm9maWxlJ3MgbWV0YWRhdGEgVVJJIGlzIHVwZGF0ZWQuClRvcGljOiBgcHJvZmlsZV91cGRhdGVkYAAAAAAAAAAAABZQcm9maWxlTWV0YWRhdGFVcGRhdGVkAAAAAAABAAAAD3Byb2ZpbGVfdXBkYXRlZAAAAAACAAAAAAAAAApwcm9maWxlX2lkAAAAAAAKAAAAAQAAAAAAAAAFZmllbGQAAAAAAAARAAAAAAAAAAI=",
        "AAAAAAAAAHtVcGRhdGUgdGhlIGBtZXRhZGF0YV91cmlgIG9mIGFuIGV4aXN0aW5nIHByb2ZpbGUuCgpSZXF1aXJlcyBhdXRoIGZyb20gdGhlIHByb2ZpbGUncyBzdG9yZWQgb3duZXIgKG5vdCBhbiBhcmJpdHJhcnkgY2FsbGVyKS4AAAAAD3VwZGF0ZV9tZXRhZGF0YQAAAAACAAAAAAAAAApwcm9maWxlX2lkAAAAAAAKAAAAAAAAAAxtZXRhZGF0YV91cmkAAAAQAAAAAQAAA+kAAAACAAAAAw==",
        "AAAABQAAAEdFbWl0dGVkIHdoZW4gYSBwcm9maWxlJ3Mgb3duZXIgaXMgdHJhbnNmZXJyZWQuClRvcGljOiBgcHJvZmlsZV91cGRhdGVkYAAAAAAAAAAAF1Byb2ZpbGVPd25lclRyYW5zZmVycmVkAAAAAAEAAAAPcHJvZmlsZV91cGRhdGVkAAAAAAIAAAAAAAAACnByb2ZpbGVfaWQAAAAAAAoAAAABAAAAAAAAAAVmaWVsZAAAAAAAABEAAAAAAAAAAg==",
        "AAAAAAAAAGdUcmFuc2ZlciBvd25lcnNoaXAgb2YgYSBwcm9maWxlIHRvIGBuZXdfb3duZXJgLgoKUmVxdWlyZXMgYXV0aCBmcm9tIHRoZSBwcm9maWxlJ3MgY3VycmVudCBzdG9yZWQgb3duZXIuAAAAABJ0cmFuc2Zlcl9vd25lcnNoaXAAAAAAAAIAAAAAAAAACnByb2ZpbGVfaWQAAAAAAAoAAAAAAAAACW5ld19vd25lcgAAAAAAABMAAAABAAAD6QAAAAIAAAAD" ]),
      options
    )
  }
  public readonly fromJSON = {
    register: this.txFromJSON<Result<u128>>,
        get_profile: this.txFromJSON<Result<Profile>>,
        resolve_handle: this.txFromJSON<Result<u128>>,
        update_metadata: this.txFromJSON<Result<void>>,
        transfer_ownership: this.txFromJSON<Result<void>>
  }
}