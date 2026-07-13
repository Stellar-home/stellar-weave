/**
 * contracts.ts
 *
 * Factory functions for the typed Soroban contract clients.
 * All network config comes from NEXT_PUBLIC_* env vars — never hardcoded here.
 *
 * Pass `signTransaction` from Freighter when constructing clients for write
 * calls; omit it for read-only simulation calls.
 */

import { Client as ProfileRegistryClient } from "profile-registry-client";
import { Client as FollowGraphClient } from "follow-graph-client";
import type { SignTransaction } from "@stellar/stellar-sdk/contract";

const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL!;
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE!;
const PROFILE_REGISTRY_ID = process.env.NEXT_PUBLIC_PROFILE_REGISTRY_ID!;
const FOLLOW_GRAPH_ID = process.env.NEXT_PUBLIC_FOLLOW_GRAPH_ID!;

export function makeProfileRegistryClient(
  publicKey?: string,
  signTransaction?: SignTransaction,
): ProfileRegistryClient {
  return new ProfileRegistryClient({
    contractId: PROFILE_REGISTRY_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    publicKey,
    signTransaction,
  });
}

export function makeFollowGraphClient(
  publicKey?: string,
  signTransaction?: SignTransaction,
): FollowGraphClient {
  return new FollowGraphClient({
    contractId: FOLLOW_GRAPH_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    publicKey,
    signTransaction,
  });
}
