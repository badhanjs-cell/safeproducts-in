// SafeProducts canonical BROWSER Supabase client.
// Fail closed before creating a client if the injected runtime binding drifts.
import { createClient } from "@supabase/supabase-js";
import { assertCanonicalSupabaseUrl, assertPublishableKey } from "@/lib/backendIdentity";
import type { SafeProductsWebDatabase } from "./webDatabase";
import { brokeredPreviewStorage } from "./previewAuthStorage";

const CANONICAL_URL_DEFAULT = "https://wmxbdirvlwuagouraobr.supabase.co";
const CANONICAL_KEY_DEFAULT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndteGJkaXJ2bHd1YWdvdXJhb2JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTAwODgsImV4cCI6MjA5MjI2NjA4OH0.JMmfyKke6NkMYRkOsHi3WCG-_xAVvh-6BEo7v0mLMDA";

const SUPABASE_URL = assertCanonicalSupabaseUrl(
  import.meta.env.VITE_SUPABASE_URL || CANONICAL_URL_DEFAULT,
  "VITE_SUPABASE_URL",
);
const SUPABASE_PUBLISHABLE_KEY = assertPublishableKey(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || CANONICAL_KEY_DEFAULT,
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