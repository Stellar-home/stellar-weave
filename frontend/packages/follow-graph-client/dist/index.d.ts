import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, Result } from "@stellar/stellar-sdk/contract";
import type { u32, u64, u128 } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CBO2USOJ4MII4GWULU2YGBIAIUN7333SFU5S5R3GKLAP6FGT5DSO5BOR";
    };
};
export declare const Errors: {
    1: {
        message: string;
    };
    2: {
        message: string;
    };
    3: {
        message: string;
    };
    4: {
        message: string;
    };
    5: {
        message: string;
    };
    6: {
        message: string;
    };
};
/**
 * Storage keys for all persistent and instance data owned by FollowGraph.
 *
 * Design note (§2 of spec): follower/following counts live here, NOT in
 * ProfileRegistry. The deployed ProfileRegistry has no mutation function for
 * those fields and Soroban contract code is immutable after deployment.
 * Any caller that needs real counts must query `get_follower_count` /
 * `get_following_count` on this contract.
 */
export type DataKey = {
    tag: "Admin";
    values: void;
} | {
    tag: "ProfileRegistry";
    values: void;
} | {
    tag: "Edge";
    values: readonly [u128, u128];
} | {
    tag: "FollowersList";
    values: readonly [u128];
} | {
    tag: "FollowingList";
    values: readonly [u128];
} | {
    tag: "FollowerCount";
    values: readonly [u128];
} | {
    tag: "FollowingCount";
    values: readonly [u128];
};
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
export type EdgeVisibility = {
    tag: "Public";
    values: void;
} | {
    tag: "Shielded";
    values: void;
};
export interface Client {
    /**
     * Construct and simulate a follow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Create a directed follow edge from `follower` to `followee`.
     *
     * Auth comes from the **owner address stored in ProfileRegistry** for the
     * follower profile — not from any address passed directly into this
     * function. This prevents a caller from spoofing ownership.
     */
    follow: ({ follower, followee }: {
        follower: u128;
        followee: u128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a unfollow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Remove a directed follow edge from `follower` to `followee`.
     *
     * Auth is required from the follower's owner (fetched from ProfileRegistry).
     * The followee's profile is NOT re-validated — if the edge exists it was
     * valid when created; we don't fail unfollow because a followee profile
     * might theoretically no longer resolve.
     */
    unfollow: ({ follower, followee }: {
        follower: u128;
        followee: u128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a is_following transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Check whether `follower` currently follows `followee`.
     * O(1) edge-key existence check — does not touch the lists.
     */
    is_following: ({ follower, followee }: {
        follower: u128;
        followee: u128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>;
    /**
     * Construct and simulate a get_followers transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Return a page of profile_ids that follow `profile_id`.
     *
     * `page` is 0-indexed. `page_size` must be 1–50 inclusive.
     * An out-of-range page returns an empty Vec (not an error).
     */
    get_followers: ({ profile_id, page, page_size }: {
        profile_id: u128;
        page: u32;
        page_size: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<Array<u128>>>>;
    /**
     * Construct and simulate a get_following transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Return a page of profile_ids that `profile_id` follows.
     *
     * `page` is 0-indexed. `page_size` must be 1–50 inclusive.
     * An out-of-range page returns an empty Vec (not an error).
     */
    get_following: ({ profile_id, page, page_size }: {
        profile_id: u128;
        page: u32;
        page_size: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<Array<u128>>>>;
    /**
     * Construct and simulate a get_follower_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Return the number of followers for `profile_id`.
     * Returns 0 if the profile has never been followed (normal starting state).
     */
    get_follower_count: ({ profile_id }: {
        profile_id: u128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<u32>>;
    /**
     * Construct and simulate a get_following_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Return the number of profiles that `profile_id` follows.
     * Returns 0 if the profile has never followed anyone (normal starting state).
     */
    get_following_count: ({ profile_id }: {
        profile_id: u128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<u32>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { admin, profile_registry }: {
        admin: string;
        profile_registry: string;
    }, 
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions & Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
    }): Promise<AssembledTransaction<T>>;
    constructor(options: ContractClientOptions);
    readonly fromJSON: {
        follow: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        unfollow: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        is_following: (json: string) => AssembledTransaction<boolean>;
        get_followers: (json: string) => AssembledTransaction<Result<bigint[], import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        get_following: (json: string) => AssembledTransaction<Result<bigint[], import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        get_follower_count: (json: string) => AssembledTransaction<number>;
        get_following_count: (json: string) => AssembledTransaction<number>;
    };
}
