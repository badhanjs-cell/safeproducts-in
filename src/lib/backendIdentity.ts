// SafeProducts canonical backend identity guard.
// Fail-closed: there is no fallback project, no fallback URL, and no fallback client.
// Any deviation throws an error containing SAFEPRODUCTS_BACKEND_IDENTITY_MISMATCH.

export const CANONICAL_PROJECT_REF = "wmxbdirvlwuagouraobr";
export const CANONICAL_SUPABASE_HOST = `${CANONICAL_PROJECT_REF}.supabase.co`;
export const CANONICAL_SUPABASE_URL = `https://${CANONICAL_SUPABASE_HOST}`;
export const IDENTITY_MISMATCH_CODE = "SAFEPRODUCTS_BACKEND_IDENTITY_MISMATCH";

function fail(detail: string): never {
  throw new Error(`${IDENTITY_MISMATCH_CODE}: ${detail}`);
}

/** Returns the URL only when it is HTTPS and points at the canonical project host. */
export function assertCanonicalSupabaseUrl(
  url: string | undefined | null,
  source = "supabase url",
): string {
  if (!url || typeof url !== "string" || url.trim() === "") {
    fail(`${source} is missing; expected ${CANONICAL_SUPABASE_URL}`);
  }
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return fail(`${source} is not a valid URL`);
  }
  if (parsed.protocol !== "https:") fail(`${source} must use https`);
  if (parsed.hostname !== CANONICAL_SUPABASE_HOST) {
    fail(`${source} host "${parsed.hostname}" is not ${CANONICAL_SUPABASE_HOST}`);
  }
  return `${parsed.protocol}//${parsed.hostname}`;
}

/** Returns the project ref only when it equals the canonical ref. */
export function assertCanonicalProjectRef(
  ref: string | undefined | null,
  source = "supabase project ref",
): string {
  if (!ref || typeof ref !== "string" || ref.trim() === "") {
    fail(`${source} is missing; expected ${CANONICAL_PROJECT_REF}`);
  }
  const value = ref.trim();
  if (value !== CANONICAL_PROJECT_REF) {
    fail(`${source} "${value}" is not ${CANONICAL_PROJECT_REF}`);
  }
  return value;
}

function decodeJwtPart(part: string): unknown {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) fail("supabase publishable key is malformed");

  try {
    const normalized = part.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = globalThis.atob(padded);
    const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return fail("supabase publishable key is malformed");
  }
}

/**
 * Accepts modern publishable keys or canonical-project legacy anon JWTs.
 * Never includes the credential value in an error.
 */
export function assertPublishableKey(
  key: string | undefined | null,
  source = "supabase publishable key",
): string {
  if (!key || typeof key !== "string" || key.trim() === "") {
    fail(`${source} is missing`);
  }
  const value = key.trim();
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return value;
  if (value.startsWith("sb_secret_")) fail(`${source} is not an approved publishable key`);

  const parts = value.split(".");
  if (
    parts.length !== 3 ||
    parts.some((part) => part === "" || !/^[A-Za-z0-9_-]+$/.test(part))
  ) {
    fail(`${source} is not an approved publishable key`);
  }

  const header = decodeJwtPart(parts[0]);
  const payload = decodeJwtPart(parts[1]);
  if (
    typeof header !== "object" ||
    header === null ||
    Array.isArray(header) ||
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    fail(`${source} is malformed`);
  }

  const claims = payload as Record<string, unknown>;
  if (claims.role !== "anon" || claims.ref !== CANONICAL_PROJECT_REF) {
    fail(`${source} is not an approved publishable key`);
  }
  return value;
}

export function isCanonicalSupabaseUrl(url: unknown): boolean {
  try {
    assertCanonicalSupabaseUrl(typeof url === "string" ? url : undefined);
    return true;
  } catch {
    return false;
  }
}
