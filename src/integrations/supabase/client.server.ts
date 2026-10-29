// SafeProducts canonical SERVER Supabase client.
// Least privilege: the website server uses the publishable key only — never the
// service role. RLS and the narrow sp_web_* RPCs govern every operation.
// Fail-closed on any non-canonical backend identity.
import { createClient } from "@supabase/supabase-js";
import type { SafeProductsWebDatabase } from "./webDatabase";
import { assertCanonicalSupabaseUrl, assertPublishableKey } from "@/lib/backendIdentity";

function createSupabaseServerClient() {
  const url = assertCanonicalSupabaseUrl(process.env.SUPABASE_URL, "SUPABASE_URL");
  const key = assertPublishableKey(
    process.env.SUPABASE_PUBLISHABLE_KEY,
    "SUPABASE_PUBLISHABLE_KEY",
  );

  return createClient<SafeProductsWebDatabase>(url, key, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseServer: ReturnType<typeof createSupabaseServerClient> | undefined;

// Import like: import { supabaseServer } from "@/integrations/supabase/client.server";
export const supabaseServer = new Proxy({} as ReturnType<typeof createSupabaseServerClient>, {
  get(_, prop, receiver) {
    if (!_supabaseServer) _supabaseServer = createSupabaseServerClient();
    return Reflect.get(_supabaseServer, prop, receiver);
  },
});
