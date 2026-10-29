// SafeProducts canonical BROWSER Supabase client.
// Fail closed before creating a client if the injected runtime binding drifts.
import { createClient } from "@supabase/supabase-js";
import { assertCanonicalSupabaseUrl, assertPublishableKey } from "@/lib/backendIdentity";
import type { SafeProductsWebDatabase } from "./webDatabase";
import { brokeredPreviewStorage } from "./previewAuthStorage";

const SUPABASE_URL = assertCanonicalSupabaseUrl(
  import.meta.env.VITE_SUPABASE_URL,
  "VITE_SUPABASE_URL",
);
const SUPABASE_PUBLISHABLE_KEY = assertPublishableKey(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  "VITE_SUPABASE_PUBLISHABLE_KEY",
);

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<SafeProductsWebDatabase>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
  },
});