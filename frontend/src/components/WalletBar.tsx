"use client";

/**
 * WalletBar.tsx
 *
 * Top bar for the demo page. Shows the connected wallet address and name,
 * a disconnect button when connected, or a "Connect Wallet" button when not.
 */

import type { WalletState } from "@/hooks/useWallet";

interface Props {
  wallet: WalletState;
  onConnect: () => void;
  onDisconnect: () => void;
}

function truncate(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function WalletBar({ wallet, onConnect, onDisconnect }: Props) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div>
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">Weave</span>
        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
          Social Graph Demo · Stellar Testnet
        </span>
      </div>

      <div className="flex items-center gap-3">
        {wallet.status === "error" && (
          <span
            className="text-sm text-red-600 dark:text-red-400 max-w-xs truncate"
            role="alert"
          >
            {wallet.message}
          </span>
        )}

        {wallet.status === "connected" && (
          <>
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <span
                className="size-2 rounded-full bg-emerald-500"
                aria-hidden="true"
              />
              {wallet.walletName}
            </span>

            <span
              className="text-sm font-mono text-zinc-600 dark:text-zinc-300"
              title={wallet.address}
            >
              {truncate(wallet.address)}
            </span>

            <button
              type="button"
              onClick={onDisconnect}
              className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700
                text-zinc-700 dark:text-zinc-300 text-sm font-medium
                hover:bg-zinc-100 dark:hover:bg-zinc-800
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                focus-visible:outline-zinc-500 transition-colors"
            >
              Disconnect
            </button>
          </>
        )}

        {wallet.status !== "connected" && (
          <button
            type="button"
            onClick={onConnect}
            disabled={wallet.status === "connecting"}
            className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium
              hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
              focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            {wallet.status === "connecting" ? "Connecting…" : "Connect Wallet"}
          </button>
        )}
      </div>
    </header>
  );
}
