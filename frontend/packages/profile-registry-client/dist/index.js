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
        contractId: "CCMV3J6W52JIZJVVX2YYBEALROVROU7KTDBLVSUYYMTLDTFJHXXPOKKP",
    }
};
export const Errors = {
    1: { message: "HandleTaken" },
    2: { message: "HandleInvalid" },
    3: { message: "ProfileNotFound" },
    4: { message: "NotProfileOwner" },
    5: { message: "HandleTooLong" },
    6: { message: "HandleTooShort" }
};
export class Client extends ContractClient {
    options;
    static async deploy(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { admin }, 
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options) {
        return ContractClient.deploy({ admin }, options);
    }
    constructor(options) {
        super(new ContractSpec(["AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAABgAAAAAAAAALSGFuZGxlVGFrZW4AAAAAAQAAAAAAAAANSGFuZGxlSW52YWxpZAAAAAAAAAIAAAAAAAAAD1Byb2ZpbGVOb3RGb3VuZAAAAAADAAAAAAAAAA9Ob3RQcm9maWxlT3duZXIAAAAABAAAAAAAAAANSGFuZGxlVG9vTG9uZwAAAAAAAAUAAAAAAAAADkhhbmRsZVRvb1Nob3J0AAAAAAAG",
            "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABAAAAAAAAAA3aW5zdGFuY2Ugc3RvcmFnZSDigJQgYWRtaW4gYWRkcmVzcyBzZXQgYXQgY29uc3RydWN0aW9uLgAAAAAFQWRtaW4AAAAAAAAAAAAASmluc3RhbmNlIHN0b3JhZ2Ug4oCUIG1vbm90b25pY2FsbHkgaW5jcmVhc2luZyB1MTI4IGNvdW50ZXI7IDAgaXMgcmVzZXJ2ZWQuAAAAAAAGTmV4dElkAAAAAAABAAAALnBlcnNpc3RlbnQgc3RvcmFnZSDigJQgcHJvZmlsZV9pZCDihpIgUHJvZmlsZS4AAAAAAAdQcm9maWxlAAAAAAEAAAAKAAAAAQAAAEFwZXJzaXN0ZW50IHN0b3JhZ2Ug4oCUIG5vcm1hbGl6ZWQgaGFuZGxlIChTeW1ib2wpIOKGkiBwcm9maWxlX2lkLgAAAAAAAAZIYW5kbGUAAAAAAAEAAAAR",
            "AAAAAQAAAQd2MjogYGZvbGxvd2VyX2NvdW50YCBhbmQgYGZvbGxvd2luZ19jb3VudGAgcmVtb3ZlZCBlbnRpcmVseS4KUmVhbCBjb3VudHMgYXJlIG93bmVkIGJ5IEZvbGxvd0dyYXBoIChzZWUgY29udHJhY3RzL2ZvbGxvdy1ncmFwaCkuClJlbW92aW5nIHRoZW0gZWxpbWluYXRlcyB0aGUgcGVybWFuZW50bHktemVybyB2ZXN0aWdpYWwgZmllbGRzIHRoYXQgZXhpc3RlZAppbiB2MSBhbmQgY2F1c2VkIHRoZSBSRUFETUUg4pqg77iPIHdhcm5pbmcgdG8gYmUgbmVjZXNzYXJ5LgAAAAAAAAAAB1Byb2ZpbGUAAAAABAAAACFMZWRnZXIgdGltZXN0YW1wIGF0IHJlZ2lzdHJhdGlvbi4AAAAAAAAKY3JlYXRlZF9hdAAAAAAABgAAAC9Ob3JtYWxpemVkIChsb3dlcmNhc2UpIGhhbmRsZSBzdG9yZWQgYXMgU3ltYm9sLgAAAAAGaGFuZGxlAAAAAAARAAAAMUlQRlMgb3IgQXJ3ZWF2ZSBjb250ZW50IFVSSTsgbWF5IGJlIGVtcHR5IHN0cmluZy4AAAAAAAAMbWV0YWRhdGFfdXJpAAAAEAAAAAAAAAAFb3duZXIAAAAAAAAT",
            "AAAAAAAAAc5VcGdyYWRlIHRoZSBjb250cmFjdCBXYXNtIHRvIGBuZXdfd2FzbV9oYXNoYC4KCkF1dGggaXMgcmVxdWlyZWQgZnJvbSB0aGUgYWRtaW4gYWRkcmVzcyBzdG9yZWQgaW4gKmNvbnRyYWN0IHN0YXRlKiwgbm90CmZyb20gYW55IGNhbGxlci1zdXBwbGllZCBwYXJhbWV0ZXIuIFRoaXMgaXMgZGVsaWJlcmF0ZTogdHJ1c3RpbmcgYQpjYWxsZXItc3VwcGxpZWQgImFkbWluIiBhcmd1bWVudCBpbnN0ZWFkIG9mIGxvYWRpbmcgZnJvbSBzdG9yYWdlIGlzIGEKZG9jdW1lbnRlZCBTb3JvYmFuIGV4cGxvaXQgcGF0dGVybiDigJQgYW4gYXR0YWNrZXIgY291bGQgc3VwcGx5IHRoZWlyIG93bgphZGRyZXNzIGFuZCBieXBhc3MgdGhlIGNoZWNrLiBXZSBhbHdheXMgbG9hZCBmcm9tIHN0b3JhZ2UuCgpUaGUgbmV3IFdhc20gbXVzdCBhbHJlYWR5IGJlIHVwbG9hZGVkIHRvIHRoZSBsZWRnZXIgYmVmb3JlIGNhbGxpbmcgdGhpcy4AAAAAAAd1cGdyYWRlAAAAAAEAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAA=",
            "AAAAAAAAAPZSZXR1cm5zIHRoZSBjb250cmFjdCB2ZXJzaW9uLiBUaGlzIGRlcGxveW1lbnQgaXMgdjIuCgpTZWN1cml0eSBub3RlOiB0aGUgYWRtaW4ga2V5IGNhbiB1cGdyYWRlIHRoaXMgY29udHJhY3QncyBXYXNtIGJ5dGVjb2RlLgpUaGlzIGlzIGEgY2VudHJhbGl6YXRpb24gcG9pbnQg4oCUIGRvY3VtZW50IGFzIGEgY2FuZGlkYXRlIGZvciBtdWx0aXNpZy8KdGltZWxvY2sgY29udHJvbCBiZWZvcmUgYW55IG1haW5uZXQgZGVwbG95bWVudC4AAAAAAAd2ZXJzaW9uAAAAAAAAAAABAAAABA==",
            "AAAAAAAAAEZSZWdpc3RlciBhIG5ldyBwcm9maWxlLiBSZXR1cm5zIHRoZSBhc3NpZ25lZCBwcm9maWxlX2lkIChzdGFydHMgYXQgMSkuAAAAAAAIcmVnaXN0ZXIAAAADAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABmhhbmRsZQAAAAAAEAAAAAAAAAAMbWV0YWRhdGFfdXJpAAAAEAAAAAEAAAPpAAAACgAAAAM=",
            "AAAAAAAAAAAAAAALZ2V0X3Byb2ZpbGUAAAAAAQAAAAAAAAAKcHJvZmlsZV9pZAAAAAAACgAAAAEAAAPpAAAH0AAAAAdQcm9maWxlAAAAAAM=",
            "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
            "AAAAAAAAAAAAAAAOcmVzb2x2ZV9oYW5kbGUAAAAAAAEAAAAAAAAABmhhbmRsZQAAAAAAEAAAAAEAAAPpAAAACgAAAAM=",
            "AAAAAAAAALpVcGRhdGUgdGhlIG1ldGFkYXRhX3VyaSBvZiBhbiBleGlzdGluZyBwcm9maWxlLgoKdjI6IGV2ZW50IGlzIG5vdyBgcHJvZmlsZV9tZXRhZGF0YV91cGRhdGVkYCBhbmQgY2FycmllcyB0aGUgbmV3IHZhbHVlCmRpcmVjdGx5LCBzbyBhbiBpbmRleGVyIGRvZXMgbm90IG5lZWQgYSBmb2xsb3ctdXAgZ2V0X3Byb2ZpbGUgY2FsbC4AAAAAAA91cGRhdGVfbWV0YWRhdGEAAAAAAgAAAAAAAAAKcHJvZmlsZV9pZAAAAAAACgAAAAAAAAAMbWV0YWRhdGFfdXJpAAAAEAAAAAEAAAPpAAAAAgAAAAM=",
            "AAAAAAAAAMFUcmFuc2ZlciBvd25lcnNoaXAgb2YgYSBwcm9maWxlIHRvIG5ld19vd25lci4KCnYyOiBldmVudCBpcyBub3cgYHByb2ZpbGVfb3duZXJfdHJhbnNmZXJyZWRgIGFuZCBjYXJyaWVzIHRoZSBuZXcgb3duZXIKYWRkcmVzcyBkaXJlY3RseSwgc28gYW4gaW5kZXhlciBkb2VzIG5vdCBuZWVkIGEgZm9sbG93LXVwIGdldF9wcm9maWxlIGNhbGwuAAAAAAAAEnRyYW5zZmVyX293bmVyc2hpcAAAAAAAAgAAAAAAAAAKcHJvZmlsZV9pZAAAAAAACgAAAAAAAAAJbmV3X293bmVyAAAAAAAAEwAAAAEAAAPpAAAAAgAAAAM="]), options);
        this.options = options;
    }
    fromJSON = {
        upgrade: (this.txFromJSON),
        version: (this.txFromJSON),
        register: (this.txFromJSON),
        get_profile: (this.txFromJSON),
        resolve_handle: (this.txFromJSON),
        update_metadata: (this.txFromJSON),
        transfer_ownership: (this.txFromJSON)
    };
}
