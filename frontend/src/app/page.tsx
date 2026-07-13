"use client";

/**
 * page.tsx — Weave Social Graph Demo
 *
 * Single-page demo flow:
 *   1. Connect Freighter wallet
 *   2. Register an on-chain profile (ProfileRegistry)
 *   3. Follow another profile (FollowGraph)
 *   4. See live is_following / follower / following counts
 *
 * Every step is a real testnet transaction — no mocked data.
 */

import { useState } from "react";
import type { Profile } from "profile-registry-client";

import { useWallet } from "@/hooks/useWallet";
import { WalletBar } from "@/components/WalletBar";
import { RegisterProfile } from "@/components/RegisterProfile";
import { FollowSection } from "@/components/FollowSection";

export default function DemoPage() {
  const { wallet, connect, signTx } = useWallet();

  // Registered profile state — set after successful registration.
  const [registeredProfile, setRegisteredProfile] = useState<{
    profileId: bigint;
    profile: Profile;
  } | null>(null);

  const isConnected = wallet.status === "connected";

  return (
    <div className="flex flex-col min-h-screen">
      <WalletBar wallet={wallet} onConnect={connect} />

      <main className="flex-1 w-full max-w-2xl mx-auto px-6 py-10 space-y-10">
        {/* ── Step indicator ─────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Weave Social Graph Demo
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Connect your wallet, register a profile, and follow another profile — all as real Stellar testnet transactions.
          </p>
        </div>

        {/* ── Step 1: Wallet ─────────────────────────────────────────── */}
        {!isConnected && (
          <section
            aria-labelledby="wallet-step-heading"
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 space-y-3"
          >
            <h2
              id="wallet-step-heading"
              className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
            >
              Step 1 — Connect Your Wallet
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Connect Freighter to get started. Make sure you&apos;re on the Stellar testnet.
            </p>
            <button
              type="button"
              onClick={connect}
              disabled={wallet.status === "connecting"}
              className="min-h-[44px] px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium
                hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors"
            >
              {wallet.status === "connecting" ? "Connecting…" : "Connect Wallet"}
            </button>
            {wallet.status === "error" && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {wallet.message}
              </p>
            )}
          </section>
        )}

        {/* ── Step 2: Register ───────────────────────────────────────── */}
        {isConnected && !registeredProfile && (
          <section
            aria-labelledby="register-step-heading"
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6"
          >
            <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1 uppercase tracking-wide">
              Step 2
            </p>
            <RegisterProfile
              address={wallet.address}
              signTx={signTx}
              onRegistered={(profileId, profile) =>
                setRegisteredProfile({ profileId, profile })
              }
            />
          </section>
        )}

        {/* ── Step 2 success + Step 3: Follow ───────────────────────── */}
        {isConnected && registeredProfile && (
          <>
            <section
              aria-labelledby="profile-step-heading"
              className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-900 p-6 space-y-3"
            >
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                Profile registered ✓
              </p>
              <h2
                id="profile-step-heading"
                className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
              >
                @{registeredProfile.profile.handle}
                <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
                  profile ID {String(registeredProfile.profileId)}
                </span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono break-all">
                {registeredProfile.profile.owner}
              </p>
            </section>

            <section
              aria-labelledby="follow-step-heading"
              className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6"
            >
              <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1 uppercase tracking-wide">
                Step 3
              </p>
              <FollowSection
                followerProfileId={registeredProfile.profileId}
                address={wallet.address}
                signTx={signTx}
              />
            </section>
          </>
        )}

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer className="pt-6 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400 dark:text-zinc-500 space-y-1">
          <p>
            ProfileRegistry:{" "}
            <a
              href={`https://stellar.expert/explorer/testnet/contract/${process.env.NEXT_PUBLIC_PROFILE_REGISTRY_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono underline hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              {process.env.NEXT_PUBLIC_PROFILE_REGISTRY_ID}
            </a>
          </p>
          <p>
            FollowGraph:{" "}
            <a
              href={`https://stellar.expert/explorer/testnet/contract/${process.env.NEXT_PUBLIC_FOLLOW_GRAPH_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono underline hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              {process.env.NEXT_PUBLIC_FOLLOW_GRAPH_ID}
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
