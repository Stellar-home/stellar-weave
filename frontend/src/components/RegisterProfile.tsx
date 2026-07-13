"use client";

/**
 * RegisterProfile.tsx
 *
 * Form to register a new on-chain profile via ProfileRegistry.register.
 * - Validates handle client-side (mirrors contract rules exactly).
 * - Maps all contract error codes to specific messages.
 * - Shows loading state during the transaction.
 * - Displays the resulting Profile on success.
 */

import { useState } from "react";
import type { Profile } from "profile-registry-client";
import { makeProfileRegistryClient } from "@/lib/contracts";
import { profileRegistryError } from "@/lib/errors";
import type { SignTransaction } from "@stellar/stellar-sdk/contract";

interface Props {
  address: string;
  signTx: SignTransaction;
  /** Called with the registered profile_id and profile after successful registration. */
  onRegistered: (profileId: bigint, profile: Profile) => void;
}

// Mirrors the contract's validate_and_normalize rules exactly.
function validateHandle(handle: string): string | null {
  if (handle.length < 3) return "Handle must be at least 3 characters.";
  if (handle.length > 30) return "Handle must be 30 characters or fewer.";
  if (!/^[a-zA-Z0-9_]+$/.test(handle))
    return "Handle can only contain letters, numbers, and underscores.";
  return null;
}

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; profileId: bigint; profile: Profile }
  | { status: "error"; message: string };

export function RegisterProfile({ address, signTx, onRegistered }: Props) {
  const [handle, setHandle] = useState("");
  const [metadataUri, setMetadataUri] = useState("");
  const [handleError, setHandleError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>({ status: "idle" });

  function handleHandleChange(value: string) {
    setHandle(value);
    // Live validation — show error as the user types (after first character).
    if (value.length > 0) {
      setHandleError(validateHandle(value));
    } else {
      setHandleError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validateHandle(handle);
    if (validationError) {
      setHandleError(validationError);
      return;
    }

    setFormState({ status: "submitting" });

    try {
      const client = makeProfileRegistryClient(address, signTx);

      // Build the transaction.
      const tx = await client.register({
        owner: address,
        handle: handle.toLowerCase(),
        metadata_uri: metadataUri.trim(),
      });

      // Sign and send — Freighter popup will appear here.
      const sent = await tx.signAndSend();
      // .result is Result<bigint>; .unwrap() extracts the value or throws Err.message.
      const profileId = sent.result.unwrap();

      // Fetch the full profile to display.
      const readClient = makeProfileRegistryClient();
      const profileTx = await readClient.get_profile({ profile_id: profileId });
      const profile = profileTx.result.unwrap();

      setFormState({ status: "success", profileId, profile });
      onRegistered(profileId, profile);
    } catch (err) {
      setFormState({
        status: "error",
        message: profileRegistryError(err),
      });
      console.error("[RegisterProfile]", err);
    }
  }

  if (formState.status === "success") {
    const { profileId, profile } = formState;
    return (
      <section aria-labelledby="register-success-heading" className="space-y-3">
        <h2
          id="register-success-heading"
          className="text-lg font-semibold text-emerald-600 dark:text-emerald-400"
        >
          Profile Registered
        </h2>
        <ProfileCard profileId={profileId} profile={profile} />
      </section>
    );
  }

  const isSubmitting = formState.status === "submitting";

  return (
    <section aria-labelledby="register-heading" className="space-y-4">
      <h2
        id="register-heading"
        className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
      >
        Register a Profile
      </h2>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-1">
          <label
            htmlFor="handle"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Handle
          </label>
          <input
            id="handle"
            type="text"
            value={handle}
            onChange={(e) => handleHandleChange(e.target.value)}
            placeholder="your_handle"
            maxLength={30}
            autoComplete="off"
            autoCapitalize="none"
            disabled={isSubmitting}
            aria-describedby={handleError ? "handle-error" : "handle-hint"}
            aria-invalid={handleError != null}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800
              px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400
              focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50
              transition-colors"
          />
          {handleError ? (
            <p id="handle-error" role="alert" className="text-xs text-red-600 dark:text-red-400">
              {handleError}
            </p>
          ) : (
            <p id="handle-hint" className="text-xs text-zinc-500 dark:text-zinc-400">
              3–30 characters. Letters, numbers, and underscores only. Saved as lowercase.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label
            htmlFor="metadata-uri"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Metadata URI{" "}
            <span className="font-normal text-zinc-400 dark:text-zinc-500">(optional)</span>
          </label>
          <input
            id="metadata-uri"
            type="text"
            value={metadataUri}
            onChange={(e) => setMetadataUri(e.target.value)}
            placeholder="ipfs://…"
            disabled={isSubmitting}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800
              px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400
              focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50
              transition-colors"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            IPFS or Arweave URI pointing to your profile JSON.
          </p>
        </div>

        {formState.status === "error" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {formState.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || handleError != null || handle.length === 0}
          className="min-h-[44px] px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium
            hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors"
        >
          {isSubmitting ? "Registering…" : "Register Profile"}
        </button>
      </form>
    </section>
  );
}

// ── Shared profile display card ────────────────────────────────────────────────

export function ProfileCard({
  profileId,
  profile,
}: {
  profileId: bigint;
  profile: Profile;
}) {
  return (
    <dl className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="font-medium text-zinc-500 dark:text-zinc-400">Profile ID</dt>
      <dd className="font-mono text-zinc-900 dark:text-zinc-100">{String(profileId)}</dd>

      <dt className="font-medium text-zinc-500 dark:text-zinc-400">Handle</dt>
      <dd className="text-zinc-900 dark:text-zinc-100">@{profile.handle}</dd>

      <dt className="font-medium text-zinc-500 dark:text-zinc-400">Owner</dt>
      <dd className="font-mono text-xs break-all text-zinc-700 dark:text-zinc-300">
        {profile.owner}
      </dd>

      {profile.metadata_uri && (
        <>
          <dt className="font-medium text-zinc-500 dark:text-zinc-400">Metadata URI</dt>
          <dd className="break-all text-zinc-700 dark:text-zinc-300 text-xs">
            {profile.metadata_uri}
          </dd>
        </>
      )}

      <dt className="font-medium text-zinc-500 dark:text-zinc-400">Registered</dt>
      <dd className="text-zinc-700 dark:text-zinc-300">
        {new Date(Number(profile.created_at) * 1000).toLocaleString()}
      </dd>
    </dl>
  );
}
