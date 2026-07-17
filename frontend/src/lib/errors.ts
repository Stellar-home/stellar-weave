/**
 * errors.ts
 *
 * Maps contract error codes to actionable, user-facing messages.
 * Keeps all error copy in one place so it's easy to update.
 */

/** Extract a numeric error code from whatever the contract client throws. */
function extractErrorCode(err: unknown): number | null {
  if (err == null) return null;
  // The generated client wraps contract errors as objects with a `code`
  // property, or as strings matching "Error(N)" / "contract error: N".
  if (typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e["code"] === "number") return e["code"] as number;
    // Err wrapper from the Rust Result type: { type: 'error', code: N }
    if (typeof e["type"] === "string" && e["type"] === "error") {
      if (typeof e["value"] === "object" && e["value"] !== null) {
        const val = e["value"] as Record<string, unknown>;
        if (typeof val["code"] === "number") return val["code"] as number;
      }
    }
  }
  // Fallback: parse from stringified error message
  const msg = String(err);
  const match = msg.match(/Error\((\d+)\)|contract error.*?(\d+)/i);
  if (match) return parseInt(match[1] ?? match[2], 10);
  return null;
}

/**
 * When Result<T>.unwrap() throws, it throws new Error(errorMessage) where
 * errorMessage is the variant name string (e.g. "HandleTaken"). Map those too.
 */
const PROFILE_REGISTRY_NAMES: Record<string, string> = {
  HandleTaken: "That handle is already taken — try a different one.",
  HandleInvalid: "That handle contains invalid characters. Use only letters, numbers, and underscores.",
  ProfileNotFound: "Profile not found. Double-check the profile ID or handle.",
  NotProfileOwner: "You don't own that profile.",
  HandleTooLong: "Handle is too long — maximum 30 characters.",
  HandleTooShort: "Handle is too short — minimum 3 characters.",
};

const FOLLOW_GRAPH_NAMES: Record<string, string> = {
  SelfFollow: "You can't follow yourself.",
  AlreadyFollowing: "You're already following that profile.",
  NotFollowing: "You're not following that profile, so there's nothing to unfollow.",
  FollowerProfileNotFound: "Your profile wasn't found. Make sure you've registered first.",
  FolloweeProfileNotFound: "That profile doesn't exist — check the ID or handle and try again.",
  InvalidPagination: "Invalid page size. Use a value between 1 and 50.",
};

const PROFILE_REGISTRY_ERRORS: Record<number, string> = {
  1: "That handle is already taken — try a different one.",
  2: "That handle contains invalid characters. Use only letters, numbers, and underscores.",
  3: "Profile not found. Double-check the profile ID or handle.",
  4: "You don't own that profile.",
  5: "Handle is too long — maximum 30 characters.",
  6: "Handle is too short — minimum 3 characters.",
};

const FOLLOW_GRAPH_ERRORS: Record<number, string> = {
  1: "You can't follow yourself.",
  2: "You're already following that profile.",
  3: "You're not following that profile, so there's nothing to unfollow.",
  4: "Your profile wasn't found. Make sure you've registered first.",
  5: "That profile ID doesn't exist — check the number and try again.",
  6: "Invalid page size. Use a value between 1 and 50.",
};

export function profileRegistryError(err: unknown): string {
  // Primary: Err.unwrap() throws new Error(variantName) — match the name string.
  const msg = String(err instanceof Error ? err.message : err);
  if (PROFILE_REGISTRY_NAMES[msg]) return PROFILE_REGISTRY_NAMES[msg];

  // Fallback: numeric error code from XDR/simulation failure objects.
  const code = extractErrorCode(err);
  if (code !== null && PROFILE_REGISTRY_ERRORS[code]) {
    return PROFILE_REGISTRY_ERRORS[code];
  }
  if (msg.toLowerCase().includes("user rejected")) {
    return "You cancelled the transaction in your wallet.";
  }
  if (msg.toLowerCase().includes("account not found")) {
    return "Your account doesn't exist on testnet yet. Make sure it has been funded — try reconnecting your wallet.";
  }
  return `Something went wrong: ${msg}`;
}

export function followGraphError(err: unknown): string {
  // Primary: Err.unwrap() throws new Error(variantName) — match the name string.
  const msg = String(err instanceof Error ? err.message : err);
  if (FOLLOW_GRAPH_NAMES[msg]) return FOLLOW_GRAPH_NAMES[msg];

  // Fallback: numeric error code from XDR/simulation failure objects.
  const code = extractErrorCode(err);
  if (code !== null && FOLLOW_GRAPH_ERRORS[code]) {
    return FOLLOW_GRAPH_ERRORS[code];
  }
  if (msg.toLowerCase().includes("user rejected")) {
    return "You cancelled the transaction in your wallet.";
  }
  return `Something went wrong: ${msg}`;
}
