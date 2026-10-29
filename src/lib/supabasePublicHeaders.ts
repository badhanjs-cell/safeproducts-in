import { assertPublishableKey } from "./backendIdentity";

/**
 * Headers for public Supabase requests (Edge Functions + REST RPC).
 * Modern `sb_publishable_` keys are opaque, not JWTs: send them only as `apikey`.
 * A validated canonical legacy anon JWT is also sent as a Bearer token.
 */
export function supabasePublicHeaders(publishableKey: string): Record<string, string> {
  const key = assertPublishableKey(publishableKey, "Supabase public request key");
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

/** Fail-closed redirect detection for fetches made with `redirect: "manual"` (workerd rejects "error"). */
export function isRedirectResponse(response: { status: number; redirected?: boolean; type?: string }): boolean {
  return response.redirected === true || response.type === "opaqueredirect" || (response.status >= 300 && response.status <= 399);
}
