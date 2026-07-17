"use client";

/**
 * useWallet.ts
 *
 * Wallet connection state backed by Stellar Wallets Kit (SWK).
 * Supports Freighter, xBull, Albedo, Lobstr, Hana, and any other wallet
 * in the SWK default module list — no Freighter-specific code here.
 *
 * SWK is a singleton that must only be initialised on the client.
 * We lazy-init it on first use inside an effect so SSR never touches it.
 *
 * State is intentionally ephemeral in React (no localStorage on our side),
 * though SWK itself persists the selected wallet id to localStorage so it
 * can restore the session — we just read that back on mount.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { SignTransaction } from "@stellar/stellar-sdk/contract";

export type WalletState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "connected"; address: string; walletName: string }
  | { status: "error"; message: string };

export interface UseWalletResult {
  wallet: WalletState;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** SWK-backed signTransaction matching the SDK's SignTransaction type. */
  signTx: SignTransaction;
}

// ── SWK singleton init ─────────────────────────────────────────────────────────
// We dynamically import SWK so it never runs during SSR.
async function getKit() {
  const { StellarWalletsKit } = await import(
    "@creit-tech/stellar-wallets-kit/sdk"
  );
  const { defaultModules } = await import(
    "@creit-tech/stellar-wallets-kit/modules/utils"
  );
  const { Networks } = await import("@creit-tech/stellar-wallets-kit/types");

  StellarWalletsKit.init({
    modules: defaultModules(),
    network: Networks.TESTNET,
  });

  return StellarWalletsKit;
}

// Cache the initialised kit promise so we only call init() once.
let kitPromise: ReturnType<typeof getKit> | null = null;
function kit(): ReturnType<typeof getKit> {
  if (!kitPromise) kitPromise = getKit();
  return kitPromise;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useWallet(): UseWalletResult {
  const [wallet, setWallet] = useState<WalletState>({ status: "idle" });
  // Keep a ref to the current address so signTx can close over it without
  // triggering a re-render every time the wallet state changes.
  const addressRef = useRef<string | undefined>(undefined);

  // On mount, check whether SWK already has a persisted session.
  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      try {
        const swk = await kit();
        const { address } = await swk.getAddress();
        if (cancelled || !address) return;
        const walletName = resolveWalletName(swk);
        addressRef.current = address;
        setWallet({ status: "connected", address, walletName });
      } catch {
        // No persisted session or wallet unavailable — stay idle.
      }
    }
    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    setWallet({ status: "connecting" });
    try {
      const swk = await kit();
      // authModal opens the wallet picker. Resolves when the user selects a
      // wallet and grants access. Throws if the user closes the modal.
      const { address } = await swk.authModal();
      if (!address) {
        setWallet({
          status: "error",
          message:
            "Couldn't read your wallet address. Make sure your wallet is unlocked.",
        });
        return;
      }
      const walletName = resolveWalletName(swk);
      addressRef.current = address;
      setWallet({ status: "connected", address, walletName });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // SWK throws a generic error when the modal is dismissed.
      if (msg.toLowerCase().includes("modal") || msg.toLowerCase().includes("close") || msg === "") {
        setWallet({ status: "idle" });
      } else {
        setWallet({
          status: "error",
          message: `Wallet connection failed: ${msg}`,
        });
      }
      console.error("[useWallet] connect error:", err);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      const swk = await kit();
      await swk.disconnect();
    } catch {
      // Ignore disconnect errors.
    }
    addressRef.current = undefined;
    setWallet({ status: "idle" });
  }, []);

  // Wrap SWK's signTransaction into the SDK's SignTransaction shape.
  // The SDK calls: signTx(xdr, { networkPassphrase, address })
  const signTx: SignTransaction = useCallback(async (xdr, opts) => {
    const swk = await kit();
    const result = await swk.signTransaction(xdr, {
      networkPassphrase: opts?.networkPassphrase,
      address: opts?.address ?? addressRef.current,
    });
    return {
      signedTxXdr: result.signedTxXdr,
      signerAddress: result.signerAddress,
    };
  }, []);

  return { wallet, connect, disconnect, signTx };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Read the currently selected wallet's display name from SWK, with a fallback. */
function resolveWalletName(swk: Awaited<ReturnType<typeof getKit>>): string {
  try {
    // selectedModule is a getter — it throws if no module is selected yet.
    return (swk as unknown as { selectedModule?: { name?: string } })
      .selectedModule?.name ?? "Wallet";
  } catch {
    return "Wallet";
  }
}
