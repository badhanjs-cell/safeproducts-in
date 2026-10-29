export type SearchRuntimeEnv = Record<string, string | undefined>;

export type SearchRuntimeConfig = {
  m1bEnabled: boolean;
  prod1Enabled: boolean;
  supabaseUrl: string | undefined;
  publishableKey: string | undefined;
  makeSearchWebhookUrl: string | undefined;
};

function firstNonBlank(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return undefined;
}

export function isEnabledFlag(value: string | undefined | null): boolean {
  if (typeof value !== "string") return false;
  let normalized = value.trim();
  if (normalized.length >= 2) {
    const first = normalized[0];
    const last = normalized[normalized.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      normalized = normalized.slice(1, -1).trim();
    }
  }
  return normalized.toLowerCase() === "true";
}

/** True only for an explicit kill-switch value ("false", "0", "off", "no"). */
export function isExplicitlyDisabledFlag(value: string | undefined | null): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().replace(/^(["'])(.*)\1$/, "$2").trim().toLowerCase();
  return ["false", "0", "off", "no"].includes(normalized);
}

/** Merge server runtime env over build-time public (VITE_*) values; blanks never override. */
export function mergeSearchEnv(...sources: Array<SearchRuntimeEnv | undefined>): SearchRuntimeEnv {
  const merged: SearchRuntimeEnv = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [k, v] of Object.entries(source)) {
      if (typeof v === "string" && v.trim() !== "" && merged[k] === undefined) merged[k] = v;
    }
  }
  return merged;
}

export type SearchRoute = "M1B" | "LEGACY_MAKE" | "NOT_QUALIFIED";

/** M1-B (sp-us2-search-v3) is the default authority; only an explicit false disables it. */
export function selectSearchRoute(config: SearchRuntimeConfig): SearchRoute {
  if (config.m1bEnabled) return "M1B";
  if (config.prod1Enabled) return "LEGACY_MAKE";
  return "NOT_QUALIFIED";
}

export function resolveSearchRuntimeConfig(env: SearchRuntimeEnv): SearchRuntimeConfig {
  return {
    m1bEnabled: !isExplicitlyDisabledFlag(env.SP_M1B_SEARCH_ENABLED),
    prod1Enabled: isEnabledFlag(env.SP_PROD1_SEARCH_ENABLED),
    supabaseUrl: firstNonBlank(env.SUPABASE_URL, env.VITE_SUPABASE_URL),
    publishableKey: firstNonBlank(
      env.SUPABASE_PUBLISHABLE_KEY,
      env.SUPABASE_ANON_KEY,
      env.VITE_SUPABASE_PUBLISHABLE_KEY,
      env.VITE_SUPABASE_ANON_KEY,
    ),
    makeSearchWebhookUrl: firstNonBlank(env.MAKE_SEARCH_WEBHOOK_URL),
  };
}
