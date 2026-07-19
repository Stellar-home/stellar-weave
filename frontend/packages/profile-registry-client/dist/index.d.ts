import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, Result } from "@stellar/stellar-sdk/contract";
import type { u32, u64, u128 } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CCMV3J6W52JIZJVVX2YYBEALROVROU7KTDBLVSUYYMTLDTFJHXXPOKKP";
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
    upgrade: ({ new_wasm_hash }: {
        new_wasm_hash: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Returns the contract version. This deployment is v2.
     *
     * Security note: the admin key can upgrade this contract's Wasm bytecode.
     * This is a centralization point — document as a candidate for multisig/
     * timelock control before any mainnet deployment.
     */
    version: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>;
    /**
     * Construct and simulate a register transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Register a new profile. Returns the assigned profile_id (starts at 1).
     */
    register: ({ owner, handle, metadata_uri }: {
        owner: string;
        handle: string;
        metadata_uri: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<u128>>>;
    /**
     * Construct and simulate a get_profile transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_profile: ({ profile_id }: {
        profile_id: u128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<Profile>>>;
    /**
     * Construct and simulate a resolve_handle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    resolve_handle: ({ handle }: {
        handle: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<u128>>>;
    /**
     * Construct and simulate a update_metadata transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Update the metadata_uri of an existing profile.
     *
     * v2: event is now `profile_metadata_updated` and carries the new value
     * directly, so an indexer does not need a follow-up get_profile call.
     */
    update_metadata: ({ profile_id, metadata_uri }: {
        profile_id: u128;
        metadata_uri: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a transfer_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Transfer ownership of a profile to new_owner.
     *
     * v2: event is now `profile_owner_transferred` and carries the new owner
     * address directly, so an indexer does not need a follow-up get_profile call.
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
        upgrade: (json: string) => AssembledTransaction<null>;
        version: (json: string) => AssembledTransaction<number>;
        register: (json: string) => AssembledTransaction<Result<bigint, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        get_profile: (json: string) => AssembledTransaction<Result<Profile, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        resolve_handle: (json: string) => AssembledTransaction<Result<bigint, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        update_metadata: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        transfer_ownership: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
    };
}
