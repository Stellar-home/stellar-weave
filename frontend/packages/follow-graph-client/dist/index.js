import { Buffer } from "buffer";
import { Client as ContractClient, Spec as ContractSpec, } from "@stellar/stellar-sdk/contract";
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
};
export const Errors = {
    1: { message: "SelfFollow" },
    2: { message: "AlreadyFollowing" },
    3: { message: "NotFollowing" },
    4: { message: "FollowerProfileNotFound" },
    5: { message: "FolloweeProfileNotFound" },
    6: { message: "InvalidPagination" }
};
export class Client extends ContractClient {
    options;
    static async deploy(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { admin, profile_registry }, 
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options) {
        return ContractClient.deploy({ admin, profile_registry }, options);
    }
    constructor(options) {
        super(new ContractSpec(["AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAABgAAAAAAAAAKU2VsZkZvbGxvdwAAAAAAAQAAAAAAAAAQQWxyZWFkeUZvbGxvd2luZwAAAAIAAAAAAAAADE5vdEZvbGxvd2luZwAAAAMAAAAAAAAAF0ZvbGxvd2VyUHJvZmlsZU5vdEZvdW5kAAAAAAQAAAAAAAAAF0ZvbGxvd2VlUHJvZmlsZU5vdEZvdW5kAAAAAAUAAAAAAAAAEUludmFsaWRQYWdpbmF0aW9uAAAAAAAABg==",
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
            "AAAAAAAAAIRSZXR1cm4gdGhlIG51bWJlciBvZiBwcm9maWxlcyB0aGF0IGBwcm9maWxlX2lkYCBmb2xsb3dzLgpSZXR1cm5zIDAgaWYgdGhlIHByb2ZpbGUgaGFzIG5ldmVyIGZvbGxvd2VkIGFueW9uZSAobm9ybWFsIHN0YXJ0aW5nIHN0YXRlKS4AAAATZ2V0X2ZvbGxvd2luZ19jb3VudAAAAAABAAAAAAAAAApwcm9maWxlX2lkAAAAAAAKAAAAAQAAAAQ="]), options);
        this.options = options;
    }
    fromJSON = {
        follow: (this.txFromJSON),
        upgrade: (this.txFromJSON),
        version: (this.txFromJSON),
        unfollow: (this.txFromJSON),
        is_following: (this.txFromJSON),
        get_followers: (this.txFromJSON),
        get_following: (this.txFromJSON),
        get_follower_count: (this.txFromJSON),
        get_following_count: (this.txFromJSON)
    };
}
