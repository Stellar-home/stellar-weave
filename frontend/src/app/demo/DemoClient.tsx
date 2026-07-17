"use client";

/**
 * DemoClient.tsx
 *
 * The full wallet → register → follow demo flow.
 *
 * Layout:
 *   WalletBar (sticky top)
 *   ┌─ Step indicator ────────────────────────────────┐
 *   │  1 Connect  →  2 Register  →  3 Follow          │
 *   └─────────────────────────────────────────────────┘
 *   ┌─ Active panel ──────────────────────────────────┐
 *   │  ConnectStep | RegisterProfile | FollowSection  │
 *   └─────────────────────────────────────────────────┘
 *
 * Steps advance linearly:
 *   - Step 1 (connect): show wallet connection prompt.
 *   - Step 2 (register): wallet is connected, show RegisterProfile.
 *   - Step 3 (follow): profile registered, show FollowSection.
 *
 * The user can always disconnect from the WalletBar, which resets to step 1.
 */

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { WalletBar } from "@/components/WalletBar";
import { RegisterProfile } from "@/components/RegisterProfile";
import { FollowSection } from "@/components/FollowSection";
import type { Profile } from "profile-registry-client";

type DemoStep = "connect" | "register" | "follow";

interface RegisteredProfile {
  profileId: bigint;
  profile: Profile;
}

export default function DemoClient() {
  const { wallet, connect, disconnect, signTx } = useWallet();
  const [step, setStep] = useState<DemoStep>("connect");
  const [registered, setRegistered] = useState<RegisteredProfile | null>(null);

  // Advance to register as soon as the wallet connects.
  // (wallet.status is the source of truth; step tracks what the user has done)
  const effectiveStep: DemoStep =
    wallet.status !== "connected"
      ? "connect"
      : registered
      ? "follow"
      : step === "follow"
      ? "follow"
      : "register";

  function handleRegistered(profileId: bigint, profile: Profile) {
    setRegistered({ profileId, profile });
    setStep("follow");
  }

  function handleDisconnect() {
    disconnect();
    setStep("connect");
    setRegistered(null);
  }

  const STEPS: { key: DemoStep; label: string; num: number }[] = [
    { key: "connect", label: "Connect", num: 1 },
    { key: "register", label: "Register", num: 2 },
    { key: "follow", label: "Follow", num: 3 },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <WalletBar
        wallet={wallet}
        onConnect={connect}
        onDisconnect={handleDisconnect}
      />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10 space-y-8">
        {/* Step indicator */}
        <nav aria-label="Demo progress" className="flex items-center gap-0">
          {STEPS.map((s, i) => {
            const isComplete =
              (s.key === "connect" && wallet.status === "connected") ||
              (s.key === "register" && registered !== null);
            const isActive = effectiveStep === s.key;
            const isLast = i === STEPS.length - 1;

            return (
              <div key={s.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <span
                    className={[
                      "flex items-center justify-center size-8 rounded-full text-sm font-semibold border-2 transition-colors",
                      isComplete
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : isActive
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-400",
                    ].join(" ")}
                    aria-current={isActive ? "step" : undefined}
                  >
                    {isComplete ? (
                      <svg
                        className="size-4"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M3 8l3.5 3.5L13 5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      s.num
                    )}
                  </span>
                  <span
                    className={[
                      "mt-1 text-xs font-medium",
                      isActive
                        ? "text-indigo-600 dark:text-indigo-400"
                        : isComplete
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-zinc-400 dark:text-zinc-500",
                    ].join(" ")}
                  >
                    {s.label}
                  </span>
                </div>
                {!isLast && (
                  <div
                    className={[
                      "flex-1 h-0.5 mx-2 mb-4 transition-colors",
                      isComplete
                        ? "bg-emerald-400"
                        : "bg-zinc-200 dark:bg-zinc-800",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </nav>

        {/* Active panel */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          {effectiveStep === "connect" && (
            <ConnectStep
              wallet={wallet}
              onConnect={connect}
            />
          )}

          {effectiveStep === "register" && wallet.status === "connected" && (
            <RegisterProfile
              address={wallet.address}
              signTx={signTx}
              onRegistered={handleRegistered}
            />
          )}

          {effectiveStep === "follow" &&
            registered &&
            wallet.status === "connected" && (
              <FollowSection
                followerProfileId={registered.profileId}
                address={wallet.address}
                signTx={signTx}
              />
            )}
        </div>

        {/* Testnet notice */}
        <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
          All transactions are on{" "}
          <strong className="font-medium">Stellar Testnet</strong> — no real
          funds involved. Need testnet XLM?{" "}
          <a
            href="https://laboratory.stellar.org/#account-creator?network=test"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            Use Friendbot
          </a>
          .
        </p>
      </main>
    </div>
  );
}

// ── Step 1: connect prompt ─────────────────────────────────────────────────────

function ConnectStep({
  wallet,
  onConnect,
}: {
  wallet: ReturnType<typeof useWallet>["wallet"];
  onConnect: () => void;
}) {
  return (
    <div className="space-y-5 text-center py-4">
      <div
        className="mx-auto size-14 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center"
        aria-hidden="true"
      >
        <svg
          className="size-7 text-indigo-600 dark:text-indigo-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 12h.01" />
          <path d="M2 10h20" />
          <path d="M6 4l2-2h8l2 2" />
        </svg>
      </div>

      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Connect your Stellar wallet
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Freighter, xBull, Albedo, Lobstr, Hana — any Stellar wallet works.
        </p>
      </div>

      {wallet.status === "error" && (
        <p
          role="alert"
          className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-lg px-4 py-2"
        >
          {wallet.message}
        </p>
      )}

      <button
        type="button"
        onClick={onConnect}
        disabled={wallet.status === "connecting"}
        className="min-h-[44px] px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-medium text-sm
          hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {wallet.status === "connecting" ? "Opening wallet picker…" : "Connect Wallet"}
      </button>
    </div>
  );
}
