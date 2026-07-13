"use client";

/**
 * FollowSection.tsx
 *
 * Follow / unfollow another profile, then show live counts.
 *
 * After a successful follow or unfollow, three reads are fired concurrently
 * via Promise.all (§8 — no request waterfalls):
 *   - is_following
 *   - get_follower_count(followee)
 *   - get_following_count(follower)
 */

import { useState } from "react";
import { makeProfileRegistryClient, makeFollowGraphClient } from "@/lib/contracts";
import { followGraphError, profileRegistryError } from "@/lib/errors";
import type { SignTransaction } from "@stellar/stellar-sdk/contract";

interface Props {
  followerProfileId: bigint;
  address: string;
  signTx: SignTransaction;
}

type FollowState =
  | { status: "idle" }
  | { status: "resolving" }
  | { status: "following" }
  | { status: "unfollowing" }
  | { status: "error"; message: string };

interface EdgeInfo {
  followeeId: bigint;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
}

export function FollowSection({ followerProfileId, address, signTx }: Props) {
  const [targetInput, setTargetInput] = useState("");
  const [state, setState] = useState<FollowState>({ status: "idle" });
  const [edge, setEdge] = useState<EdgeInfo | null>(null);

  /** Resolve a handle string to a profile_id, or parse a numeric ID directly. */
  async function resolveTarget(input: string): Promise<bigint> {
    const trimmed = input.trim();
    const numeric = /^\d+$/.test(trimmed);
    if (numeric) return BigInt(trimmed);

    // Treat as a handle — resolve via ProfileRegistry.
    const client = makeProfileRegistryClient();
    const tx = await client.resolve_handle({ handle: trimmed.toLowerCase() });
    // tx.result is Result<bigint>; .unwrap() throws if the handle wasn't found.
    return tx.result.unwrap();
  }

  /** After any write, refresh the three read values concurrently. */
  async function refreshEdgeInfo(followeeId: bigint) {
    const readClient = makeFollowGraphClient();
    const [isTx, followerTx, followingTx] = await Promise.all([
      readClient.is_following({
        follower: followerProfileId,
        followee: followeeId,
      }),
      readClient.get_follower_count({ profile_id: followeeId }),
      readClient.get_following_count({ profile_id: followerProfileId }),
    ]);
    setEdge({
      followeeId,
      isFollowing: isTx.result as boolean,
      followerCount: Number(followerTx.result),
      followingCount: Number(followingTx.result),
    });
  }

  async function handleFollow(e: React.FormEvent) {
    e.preventDefault();
    if (!targetInput.trim()) return;

    setState({ status: "resolving" });
    let followeeId: bigint;
    try {
      followeeId = await resolveTarget(targetInput);
    } catch (err) {
      setState({ status: "error", message: profileRegistryError(err) });
      return;
    }

    setState({ status: "following" });
    try {
      const client = makeFollowGraphClient(address, signTx);
      const tx = await client.follow({
        follower: followerProfileId,
        followee: followeeId,
      });
      await tx.signAndSend();
      await refreshEdgeInfo(followeeId);
      setState({ status: "idle" });
    } catch (err) {
      setState({ status: "error", message: followGraphError(err) });
      console.error("[FollowSection] follow error:", err);
    }
  }

  async function handleUnfollow() {
    if (!edge) return;
    setState({ status: "unfollowing" });
    try {
      const client = makeFollowGraphClient(address, signTx);
      const tx = await client.unfollow({
        follower: followerProfileId,
        followee: edge.followeeId,
      });
      await tx.signAndSend();
      await refreshEdgeInfo(edge.followeeId);
      setState({ status: "idle" });
    } catch (err) {
      setState({ status: "error", message: followGraphError(err) });
      console.error("[FollowSection] unfollow error:", err);
    }
  }

  const isBusy =
    state.status === "resolving" ||
    state.status === "following" ||
    state.status === "unfollowing";

  function busyLabel() {
    if (state.status === "resolving") return "Looking up profile…";
    if (state.status === "following") return "Following…";
    if (state.status === "unfollowing") return "Unfollowing…";
    return null;
  }

  return (
    <section aria-labelledby="follow-heading" className="space-y-5">
      <h2
        id="follow-heading"
        className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
      >
        Follow a Profile
      </h2>

      <form onSubmit={handleFollow} noValidate className="space-y-4">
        <div className="space-y-1">
          <label
            htmlFor="follow-target"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Profile ID or handle
          </label>
          <input
            id="follow-target"
            type="text"
            value={targetInput}
            onChange={(e) => {
              setTargetInput(e.target.value);
              if (state.status === "error") setState({ status: "idle" });
            }}
            placeholder="1  or  some_handle"
            disabled={isBusy}
            autoComplete="off"
            autoCapitalize="none"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800
              px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400
              focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50
              transition-colors"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Enter a numeric profile ID (e.g. <code className="font-mono">1</code>) or a handle (e.g.{" "}
            <code className="font-mono">weave_dev</code>). Known demo profiles: 1 (weave_dev), 2 (weave_graph_demo).
          </p>
        </div>

        {state.status === "error" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.message}
          </p>
        )}

        <div className="flex gap-3 flex-wrap">
          <button
            type="submit"
            disabled={isBusy || !targetInput.trim()}
            className="min-h-[44px] px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium
              hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
              focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            {state.status === "following" || state.status === "resolving"
              ? busyLabel()
              : "Follow Profile"}
          </button>

          {edge?.isFollowing && (
            <button
              type="button"
              onClick={handleUnfollow}
              disabled={isBusy}
              className="min-h-[44px] px-5 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600
                text-zinc-700 dark:text-zinc-300 text-sm font-medium
                hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2
                focus-visible:outline-offset-2 focus-visible:outline-zinc-500
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {state.status === "unfollowing" ? "Unfollowing…" : "Unfollow"}
            </button>
          )}
        </div>
      </form>

      {edge && (
        <div aria-live="polite" aria-atomic="true" className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Graph state — profile {String(followerProfileId)} ↔ profile {String(edge.followeeId)}
          </h3>

          <dl className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4
            grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="font-medium text-zinc-500 dark:text-zinc-400">Following?</dt>
            <dd className={edge.isFollowing ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-zinc-700 dark:text-zinc-300"}>
              {edge.isFollowing ? "Yes" : "No"}
            </dd>

            <dt className="font-medium text-zinc-500 dark:text-zinc-400">
              Followers of profile {String(edge.followeeId)}
            </dt>
            <dd className="text-zinc-900 dark:text-zinc-100 font-mono">
              {edge.followerCount}
            </dd>

            <dt className="font-medium text-zinc-500 dark:text-zinc-400">
              Following count of profile {String(followerProfileId)}
            </dt>
            <dd className="text-zinc-900 dark:text-zinc-100 font-mono">
              {edge.followingCount}
            </dd>
          </dl>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            These values are read directly from the contract via Soroban RPC — not cached or mocked.
          </p>
        </div>
      )}
    </section>
  );
}
