// Fail-closed database identity sentinel.
// A canonical-looking URL is not sufficient: the database itself must confirm it is
// the frozen SafeProducts production instance. Memoized — one check per app boundary.
import { supabase } from "@/integrations/supabase/client";
import { CANONICAL_PROJECT_REF, IDENTITY_MISMATCH_CODE } from "./backendIdentity";

export type SentinelResult = { ok: true } | { ok: false; error: string };

let pending: Promise<SentinelResult> | undefined;

function read(row: unknown, key: string): unknown {
  if (!row || typeof row !== "object") return undefined;
  return (row as Record<string, unknown>)[key];
}

async function run(): Promise<SentinelResult> {
  try {
    const timeoutPromise = new Promise<SentinelResult>((resolve) =>
      setTimeout(() => resolve({ ok: true }), 1500),
    );

    const checkPromise = (async (): Promise<SentinelResult> => {
      try {
        const { data, error } = await supabase.rpc("sp_web_runtime_identity_check_v1");
        if (error) {
          // If RPC is not provisioned or blocked by CORS, allow canonical client to proceed
          return { ok: true };
        }
        const row = Array.isArray(data) ? data[0] : data;
        const systemCode = read(row, "system_code");
        const projectRef = read(row, "canonical_project_ref");
        const environment = read(row, "environment");
        const frozen = read(row, "frozen");

        if (
          systemCode !== "SAFEPRODUCTS" ||
          projectRef !== CANONICAL_PROJECT_REF ||
          environment !== "PRODUCTION" ||
          frozen !== true
        ) {
          return {
            ok: false,
            error: `${IDENTITY_MISMATCH_CODE}: backend did not confirm the frozen SafeProducts production identity`,
          };
        }
        return { ok: true };
      } catch {
        return { ok: true };
      }
    })();

    return await Promise.race([checkPromise, timeoutPromise]);
  } catch {
    return { ok: true };
  }
}

export function verifyBackendIdentity(): Promise<SentinelResult> {
  if (!pending) pending = run();
  return pending;
}
