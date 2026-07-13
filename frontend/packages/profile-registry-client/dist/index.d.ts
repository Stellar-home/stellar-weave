import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, Result } from "@stellar/stellar-sdk/contract";
import type { u32, u64, u128 } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CAVUZWNQ322DFBNDEENP6GBYF6ESZFQDIEJN5C367WIG23AFMZO7ZLDU";
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
export type DataKey = {
    tag: "Admin";
    values: void;
} | {
    tag: "NextId";
    values: void;
} | {
    tag: "Profile";
    values: readonly [u128];
} | {
    tag: "Handle";
    values: readonly [string];
};
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
    register: ({ owner, handle, metadata_uri }: {
        owner: string;
        handle: string;
        metadata_uri: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<u128>>>;
    /**
     * Construct and simulate a get_profile transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Return the profile for a given `profile_id`.
     *
     * No authentication required — permissionless read.
     */
    get_profile: ({ profile_id }: {
        profile_id: u128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<Profile>>>;
    /**
     * Construct and simulate a resolve_handle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Return the `profile_id` for a registered handle.
     *
     * The `handle` input is normalized before lookup — case-insensitive.
     * No authentication required — permissionless read.
     */
    resolve_handle: ({ handle }: {
        handle: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<u128>>>;
    /**
     * Construct and simulate a update_metadata transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Update the `metadata_uri` of an existing profile.
     *
     * Requires auth from the profile's stored owner (not an arbitrary caller).
     */
    update_metadata: ({ profile_id, metadata_uri }: {
        profile_id: u128;
        metadata_uri: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a transfer_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Transfer ownership of a profile to `new_owner`.
     *
     * Requires auth from the profile's current stored owner.
     */
    transfer_ownership: ({ profile_id, new_owner }: {
        profile_id: u128;
        new_owner: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { admin }: {
        admin: string;
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
        register: (json: string) => AssembledTransaction<Result<bigint, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        get_profile: (json: string) => AssembledTransaction<Result<Profile, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        resolve_handle: (json: string) => AssembledTransaction<Result<bigint, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        update_metadata: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        transfer_ownership: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
    };
}
