"use client";

/**
 * useWallet.ts
 *
 * Manages Freighter wallet connection state for the demo page.
 * State lives in React state only — no localStorage, no session persistence.
 */

import { useState, useEffect, useCallback } from "react";
import {
  isConnected,
  requestAccess,
  getAddress,
  signTransaction,
} from "@stellar/freighter-api";
import type { SignTransaction } from "@stellar/stellar-sdk/contract";

export type WalletState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "connected"; address: string }
  | { status: "error"; message: string };

export interface UseWalletResult {
  wallet: WalletState;
  connect: () => Promise<void>;
  /** Freighter-backed signTransaction matching the SDK's SignTransaction type. */
  signTx: SignTransaction;
}

export function useWallet(): UseWalletResult {
  const [wallet, setWallet] = useState<WalletState>({ status: "idle" });

  // On mount, check if Freighter is already connected and restore the address.
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const connected = await isConnected();
        if (!connected || cancelled) return;
        const { address, error } = await getAddress();
        if (cancelled) return;
        if (error || !address) return;
        setWallet({ status: "connected", address });
      } catch {
        // Freighter not installed or not accessible — stay idle.
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    setWallet({ status: "connecting" });
    try {
      // requestAccess prompts the user to allow the site in Freighter.
      const accessResult = await requestAccess();
      if (accessResult.error) {
        setWallet({
          status: "error",
          message: "Freighter access was denied. Allow this site in your wallet and try again.",
        });
        return;
      }
      const { address, error } = await getAddress();
      if (error || !address) {
        setWallet({
          status: "error",
          message: "Couldn't read your wallet address. Make sure Freighter is unlocked.",
        });
        return;
      }
      setWallet({ status: "connected", address });
    } catch (err) {
      setWallet({
        status: "error",
        message:
          "Freighter isn't installed or couldn't be reached. Install the Freighter extension and try again.",
      });
      console.error("[useWallet] connect error:", err);
    }
  }, []);

  // Wrap Freighter's signTransaction into the SDK's SignTransaction shape.
  // The SDK calls: signTx(xdr, { networkPassphrase, address })
  // Freighter accepts: signTransaction(xdr, { networkPassphrase, address })
  const signTx: SignTransaction = useCallback(
    async (xdr, opts) => {
      const result = await signTransaction(xdr, {
        networkPassphrase: opts?.networkPassphrase,
        address: opts?.address,
      });
      return {
        signedTxXdr: result.signedTxXdr,
        signerAddress: result.signerAddress,
        ...(result.error ? { error: result.error } : {}),
      };
    },
    [],
  );

  return { wallet, connect, signTx };
}
