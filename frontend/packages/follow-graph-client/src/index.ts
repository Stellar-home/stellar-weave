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
    contractId: "CDNMUIWW6X565R2SWQNUGIQGDNLZA3QPNHO5YDA7YRXAB6PEICQH7ZHS",
  }
} as const

export const Errors = {
  1: {message:"SelfFollow"},
  2: {message:"AlreadyFollowing"},
  3: {message:"NotFollowing"},
  4: {message:"FollowerProfileNotFound"},
  5: {message:"FolloweeProfileNotFound"},
  6: {message:"InvalidPagination"}
}

/**
 * Storage keys for all persistent and instance data owned by FollowGraph.
 * 
 * Design note (§2 of spec): follower/following counts live here, NOT in
 * ProfileRegistry. The deployed ProfileRegistry has no mutation function for
 * those fields and Soroban contract code is immutable after deployment.
 * Any caller that needs real counts must query `get_follower_count` /
 * `get_following_count` on this contract.
 */
export type DataKey = {tag: "Admin", values: void} | {tag: "ProfileRegistry", values: void} | {tag: "Edge", values: readonly [u128, u128]} | {tag: "FollowersList", values: readonly [u128]} | {tag: "FollowingList", values: readonly [u128]} | {tag: "FollowerCount", values: readonly [u128]} | {tag: "FollowingCount", values: readonly [u128]};


/**
 * A directed follow relationship between two profiles.
 */
export interface FollowEdge {
  created_at: u64;
  followee: u128;
  follower: u128;
  /**
 * Always `EdgeVisibility::Public` in this version.
 */
visibility: EdgeVisibility;
}

/**
 * Visibility of a follow edge.
 * 
 * Only `Public` is used in this version. `Shielded` is reserved as a schema
 * placeholder so a future ZK-privacy migration doesn't require a breaking
 * storage change. Do not implement Shielded behaviour here.
 */
export type EdgeVisibility = {tag: "Public", values: void} | {tag: "Shielded", values: void};

export interface Client {
  /**
   * Construct and simulate a follow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create a directed follow edge from `follower` to `followee`.
   * 
   * Auth comes from the **owner address stored in ProfileRegistry** for the
   * follower profile — not from any address passed directly into this
   * function. This prevents a caller from spoofing ownership.
   */
  follow: ({follower, followee}: {follower: u128, followee: u128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Upgrade the contract Wasm to `new_wasm_hash`.
   * 
   * Auth is required from the admin address stored in *contract state*, not
   * from any caller-supplied parameter — same security pattern as
   * ProfileRegistry.upgrade(). See that contract's comments for full rationale.
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the contract version. This deployment is v2.
   */
  version: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a unfollow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Remove a directed follow edge from `follower` to `followee`.
   * 
   * Auth is required from the follower's owner (fetched from ProfileRegistry).
   * The followee's profile is NOT re-validated — if the edge exists it was
   * valid when created; we don't fail unfollow because a followee profile
   * might theoretically no longer resolve.
   */
  unfollow: ({follower, followee}: {follower: u128, followee: u128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a is_following transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check whether `follower` currently follows `followee`.
   * O(1) edge-key existence check — does not touch the lists.
   */
  is_following: ({follower, followee}: {follower: u128, followee: u128}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a get_followers transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return a page of profile_ids that follow `profile_id`.
   * 
   * `page` is 0-indexed. `page_size` must be 1–50 inclusive.
   * An out-of-range page returns an empty Vec (not an error).
   */
  get_followers: ({profile_id, page, page_size}: {profile_id: u128, page: u32, page_size: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Array<u128>>>>

  /**
   * Construct and simulate a get_following transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return a page of profile_ids that `profile_id` follows.
   * 
   * `page` is 0-indexed. `page_size` must be 1–50 inclusive.
   * An out-of-range page returns an empty Vec (not an error).
   */
  get_following: ({profile_id, page, page_size}: {profile_id: u128, page: u32, page_size: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Array<u128>>>>

  /**
   * Construct and simulate a get_follower_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return the number of followers for `profile_id`.
   * Returns 0 if the profile has never been followed (normal starting state).
   */
  get_follower_count: ({profile_id}: {profile_id: u128}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_following_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return the number of profiles that `profile_id` follows.
   * Returns 0 if the profile has never followed anyone (normal starting state).
   */
  get_following_count: ({profile_id}: {profile_id: u128}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, profile_registry}: {admin: string, profile_registry: string},
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
    return ContractClient.deploy({admin, profile_registry}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAABgAAAAAAAAAKU2VsZkZvbGxvdwAAAAAAAQAAAAAAAAAQQWxyZWFkeUZvbGxvd2luZwAAAAIAAAAAAAAADE5vdEZvbGxvd2luZwAAAAMAAAAAAAAAF0ZvbGxvd2VyUHJvZmlsZU5vdEZvdW5kAAAAAAQAAAAAAAAAF0ZvbGxvd2VlUHJvZmlsZU5vdEZvdW5kAAAAAAUAAAAAAAAAEUludmFsaWRQYWdpbmF0aW9uAAAAAAAABg==",
        "AAAAAgAAAYxTdG9yYWdlIGtleXMgZm9yIGFsbCBwZXJzaXN0ZW50IGFuZCBpbnN0YW5jZSBkYXRhIG93bmVkIGJ5IEZvbGxvd0dyYXBoLgoKRGVzaWduIG5vdGUgKMKnMiBvZiBzcGVjKTogZm9sbG93ZXIvZm9sbG93aW5nIGNvdW50cyBsaXZlIGhlcmUsIE5PVCBpbgpQcm9maWxlUmVnaXN0cnkuIFRoZSBkZXBsb3llZCBQcm9maWxlUmVnaXN0cnkgaGFzIG5vIG11dGF0aW9uIGZ1bmN0aW9uIGZvcgp0aG9zZSBmaWVsZHMgYW5kIFNvcm9iYW4gY29udHJhY3QgY29kZSBpcyBpbW11dGFibGUgYWZ0ZXIgZGVwbG95bWVudC4KQW55IGNhbGxlciB0aGF0IG5lZWRzIHJlYWwgY291bnRzIG11c3QgcXVlcnkgYGdldF9mb2xsb3dlcl9jb3VudGAgLwpgZ2V0X2ZvbGxvd2luZ19jb3VudGAgb24gdGhpcyBjb250cmFjdC4AAAAAAAAAB0RhdGFLZXkAAAAABwAAAAAAAAAvaW5zdGFuY2Ug4oCUIGFkbWluIGFkZHJlc3Mgc2V0IGF0IGNvbnN0cnVjdGlvbi4AAAAABUFkbWluAAAAAAAAAAAAAD5pbnN0YW5jZSDigJQgQWRkcmVzcyBvZiB0aGUgZGVwbG95ZWQgUHJvZmlsZVJlZ2lzdHJ5IGNvbnRyYWN0LgAAAAAAD1Byb2ZpbGVSZWdpc3RyeQAAAAABAAAAOXBlcnNpc3RlbnQg4oCUIChmb2xsb3dlcl9pZCwgZm9sbG93ZWVfaWQpIOKGkiBGb2xsb3dFZGdlLgAAAAAAAARFZGdlAAAAAgAAAAoAAAAKAAAAAQAAAElwZXJzaXN0ZW50IOKAlCBmb2xsb3dlZV9pZCDihpIgVmVjPHUxMjg+IG9mIGZvbGxvd2VyX2lkcyBpbiBmb2xsb3cgb3JkZXIuAAAAAAAADUZvbGxvd2Vyc0xpc3QAAAAAAAABAAAACgAAAAEAAABJcGVyc2lzdGVudCDigJQgZm9sbG93ZXJfaWQg4oaSIFZlYzx1MTI4PiBvZiBmb2xsb3dlZV9pZHMgaW4gZm9sbG93IG9yZGVyLgAAAAAAAA1Gb2xsb3dpbmdMaXN0AAAAAAAAAQAAAAoAAAABAAAAMXBlcnNpc3RlbnQg4oCUIHByb2ZpbGVfaWQg4oaSIHUzMiBmb2xsb3dlciBjb3VudC4AAAAAAAANRm9sbG93ZXJDb3VudAAAAAAAAAEAAAAKAAAAAQAAADJwZXJzaXN0ZW50IOKAlCBwcm9maWxlX2lkIOKGkiB1MzIgZm9sbG93aW5nIGNvdW50LgAAAAAADkZvbGxvd2luZ0NvdW50AAAAAAABAAAACg==",
        "AAAAAQAAADRBIGRpcmVjdGVkIGZvbGxvdyByZWxhdGlvbnNoaXAgYmV0d2VlbiB0d28gcHJvZmlsZXMuAAAAAAAAAApGb2xsb3dFZGdlAAAAAAAEAAAAAAAAAApjcmVhdGVkX2F0AAAAAAAGAAAAAAAAAAhmb2xsb3dlZQAAAAoAAAAAAAAACGZvbGxvd2VyAAAACgAAADBBbHdheXMgYEVkZ2VWaXNpYmlsaXR5OjpQdWJsaWNgIGluIHRoaXMgdmVyc2lvbi4AAAAKdmlzaWJpbGl0eQAAAAAH0AAAAA5FZGdlVmlzaWJpbGl0eQAA",
        "AAAAAAAAAQNDcmVhdGUgYSBkaXJlY3RlZCBmb2xsb3cgZWRnZSBmcm9tIGBmb2xsb3dlcmAgdG8gYGZvbGxvd2VlYC4KCkF1dGggY29tZXMgZnJvbSB0aGUgKipvd25lciBhZGRyZXNzIHN0b3JlZCBpbiBQcm9maWxlUmVnaXN0cnkqKiBmb3IgdGhlCmZvbGxvd2VyIHByb2ZpbGUg4oCUIG5vdCBmcm9tIGFueSBhZGRyZXNzIHBhc3NlZCBkaXJlY3RseSBpbnRvIHRoaXMKZnVuY3Rpb24uIFRoaXMgcHJldmVudHMgYSBjYWxsZXIgZnJvbSBzcG9vZmluZyBvd25lcnNoaXAuAAAAAAZmb2xsb3cAAAAAAAIAAAAAAAAACGZvbGxvd2VyAAAACgAAAAAAAAAIZm9sbG93ZWUAAAAKAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAQJVcGdyYWRlIHRoZSBjb250cmFjdCBXYXNtIHRvIGBuZXdfd2FzbV9oYXNoYC4KCkF1dGggaXMgcmVxdWlyZWQgZnJvbSB0aGUgYWRtaW4gYWRkcmVzcyBzdG9yZWQgaW4gKmNvbnRyYWN0IHN0YXRlKiwgbm90CmZyb20gYW55IGNhbGxlci1zdXBwbGllZCBwYXJhbWV0ZXIg4oCUIHNhbWUgc2VjdXJpdHkgcGF0dGVybiBhcwpQcm9maWxlUmVnaXN0cnkudXBncmFkZSgpLiBTZWUgdGhhdCBjb250cmFjdCdzIGNvbW1lbnRzIGZvciBmdWxsIHJhdGlvbmFsZS4AAAAAAAd1cGdyYWRlAAAAAAEAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAA=",
        "AAAAAAAAADRSZXR1cm5zIHRoZSBjb250cmFjdCB2ZXJzaW9uLiBUaGlzIGRlcGxveW1lbnQgaXMgdjIuAAAAB3ZlcnNpb24AAAAAAAAAAAEAAAAE",
        "AAAAAAAAAT5SZW1vdmUgYSBkaXJlY3RlZCBmb2xsb3cgZWRnZSBmcm9tIGBmb2xsb3dlcmAgdG8gYGZvbGxvd2VlYC4KCkF1dGggaXMgcmVxdWlyZWQgZnJvbSB0aGUgZm9sbG93ZXIncyBvd25lciAoZmV0Y2hlZCBmcm9tIFByb2ZpbGVSZWdpc3RyeSkuClRoZSBmb2xsb3dlZSdzIHByb2ZpbGUgaXMgTk9UIHJlLXZhbGlkYXRlZCDigJQgaWYgdGhlIGVkZ2UgZXhpc3RzIGl0IHdhcwp2YWxpZCB3aGVuIGNyZWF0ZWQ7IHdlIGRvbid0IGZhaWwgdW5mb2xsb3cgYmVjYXVzZSBhIGZvbGxvd2VlIHByb2ZpbGUKbWlnaHQgdGhlb3JldGljYWxseSBubyBsb25nZXIgcmVzb2x2ZS4AAAAAAAh1bmZvbGxvdwAAAAIAAAAAAAAACGZvbGxvd2VyAAAACgAAAAAAAAAIZm9sbG93ZWUAAAAKAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAgAAAOlWaXNpYmlsaXR5IG9mIGEgZm9sbG93IGVkZ2UuCgpPbmx5IGBQdWJsaWNgIGlzIHVzZWQgaW4gdGhpcyB2ZXJzaW9uLiBgU2hpZWxkZWRgIGlzIHJlc2VydmVkIGFzIGEgc2NoZW1hCnBsYWNlaG9sZGVyIHNvIGEgZnV0dXJlIFpLLXByaXZhY3kgbWlncmF0aW9uIGRvZXNuJ3QgcmVxdWlyZSBhIGJyZWFraW5nCnN0b3JhZ2UgY2hhbmdlLiBEbyBub3QgaW1wbGVtZW50IFNoaWVsZGVkIGJlaGF2aW91ciBoZXJlLgAAAAAAAAAAAAAORWRnZVZpc2liaWxpdHkAAAAAAAIAAAAAAAAAAAAAAAZQdWJsaWMAAAAAAAAAAAAAAAAACFNoaWVsZGVk",
        "AAAAAAAAAHJDaGVjayB3aGV0aGVyIGBmb2xsb3dlcmAgY3VycmVudGx5IGZvbGxvd3MgYGZvbGxvd2VlYC4KTygxKSBlZGdlLWtleSBleGlzdGVuY2UgY2hlY2sg4oCUIGRvZXMgbm90IHRvdWNoIHRoZSBsaXN0cy4AAAAAAAxpc19mb2xsb3dpbmcAAAACAAAAAAAAAAhmb2xsb3dlcgAAAAoAAAAAAAAACGZvbGxvd2VlAAAACgAAAAEAAAAB",
        "AAAAAAAAAHFJbml0aWFsaXNlIEZvbGxvd0dyYXBoIHdpdGggYW4gYWRtaW4gYWRkcmVzcyBhbmQgdGhlIGFkZHJlc3Mgb2YgdGhlCmFscmVhZHktZGVwbG95ZWQgUHJvZmlsZVJlZ2lzdHJ5IHYyIGNvbnRyYWN0LgAAAAAAAA1fX2NvbnN0cnVjdG9yAAAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAABBwcm9maWxlX3JlZ2lzdHJ5AAAAEwAAAAA=",
        "AAAAAAAAAKxSZXR1cm4gYSBwYWdlIG9mIHByb2ZpbGVfaWRzIHRoYXQgZm9sbG93IGBwcm9maWxlX2lkYC4KCmBwYWdlYCBpcyAwLWluZGV4ZWQuIGBwYWdlX3NpemVgIG11c3QgYmUgMeKAkzUwIGluY2x1c2l2ZS4KQW4gb3V0LW9mLXJhbmdlIHBhZ2UgcmV0dXJucyBhbiBlbXB0eSBWZWMgKG5vdCBhbiBlcnJvcikuAAAADWdldF9mb2xsb3dlcnMAAAAAAAADAAAAAAAAAApwcm9maWxlX2lkAAAAAAAKAAAAAAAAAARwYWdlAAAABAAAAAAAAAAJcGFnZV9zaXplAAAAAAAABAAAAAEAAAPpAAAD6gAAAAoAAAAD",
        "AAAAAAAAAK1SZXR1cm4gYSBwYWdlIG9mIHByb2ZpbGVfaWRzIHRoYXQgYHByb2ZpbGVfaWRgIGZvbGxvd3MuCgpgcGFnZWAgaXMgMC1pbmRleGVkLiBgcGFnZV9zaXplYCBtdXN0IGJlIDHigJM1MCBpbmNsdXNpdmUuCkFuIG91dC1vZi1yYW5nZSBwYWdlIHJldHVybnMgYW4gZW1wdHkgVmVjIChub3QgYW4gZXJyb3IpLgAAAAAAAA1nZXRfZm9sbG93aW5nAAAAAAAAAwAAAAAAAAAKcHJvZmlsZV9pZAAAAAAACgAAAAAAAAAEcGFnZQAAAAQAAAAAAAAACXBhZ2Vfc2l6ZQAAAAAAAAQAAAABAAAD6QAAA+oAAAAKAAAAAw==",
        "AAAAAAAAAHpSZXR1cm4gdGhlIG51bWJlciBvZiBmb2xsb3dlcnMgZm9yIGBwcm9maWxlX2lkYC4KUmV0dXJucyAwIGlmIHRoZSBwcm9maWxlIGhhcyBuZXZlciBiZWVuIGZvbGxvd2VkIChub3JtYWwgc3RhcnRpbmcgc3RhdGUpLgAAAAAAEmdldF9mb2xsb3dlcl9jb3VudAAAAAAAAQAAAAAAAAAKcHJvZmlsZV9pZAAAAAAACgAAAAEAAAAE",
        "AAAAAAAAAIRSZXR1cm4gdGhlIG51bWJlciBvZiBwcm9maWxlcyB0aGF0IGBwcm9maWxlX2lkYCBmb2xsb3dzLgpSZXR1cm5zIDAgaWYgdGhlIHByb2ZpbGUgaGFzIG5ldmVyIGZvbGxvd2VkIGFueW9uZSAobm9ybWFsIHN0YXJ0aW5nIHN0YXRlKS4AAAATZ2V0X2ZvbGxvd2luZ19jb3VudAAAAAABAAAAAAAAAApwcm9maWxlX2lkAAAAAAAKAAAAAQAAAAQ=" ]),
      options
    )
  }
  public readonly fromJSON = {
    follow: this.txFromJSON<Result<void>>,
        upgrade: this.txFromJSON<null>,
        version: this.txFromJSON<u32>,
        unfollow: this.txFromJSON<Result<void>>,
        is_following: this.txFromJSON<boolean>,
        get_followers: this.txFromJSON<Result<Array<u128>>>,
        get_following: this.txFromJSON<Result<Array<u128>>>,
        get_follower_count: this.txFromJSON<u32>,
        get_following_count: this.txFromJSON<u32>
  }
}