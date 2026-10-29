import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const canonicalRef = "wmxbdirvlwuagouraobr";
const canonicalUrl = `https://${canonicalRef}.supabase.co`;
const legacyRef = ["prznbjqxux", "getekhwvoz"].join("");
const blockedCode = "SAFEPRODUCTS_BACKEND_IDENTITY_CHANGE_BLOCKED";
const archive = "supabase/archive_legacy_lovable_cloud";
const ignored = new Set([".git", "node_modules", "dist", "build", ".output", ".nitro"]);
const textExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".toml",
  ".env",
  ".md",
]);

function block(message) {
  console.error(`${blockedCode}: ${message}`);
  process.exit(1);
}

const read = (path) => readFileSync(join(root, path), "utf8");

function walk(path, output = []) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) return output;
  for (const entry of readdirSync(absolute)) {
    if (ignored.has(entry)) continue;
    const child = join(path, entry).replaceAll("\\", "/");
    if (child === archive || child.startsWith(`${archive}/`)) continue;
    const info = statSync(join(root, child));
    if (info.isDirectory()) walk(child, output);
    else if (textExtensions.has(extname(entry)) || entry === ".env" || entry === ".env.example")
      output.push(child);
  }
  return output;
}

if (read("supabase/config.toml").trim() !== `project_id = "${canonicalRef}"`) {
  block("supabase/config.toml is not canonical");
}

if (existsSync(join(root, ".env"))) {
  const env = read(".env");
  for (const name of ["SUPABASE_PROJECT_ID", "VITE_SUPABASE_PROJECT_ID"]) {
    if (!new RegExp(`^${name}=["']?${canonicalRef}["']?$`, "m").test(env))
      block(`${name} is not canonical`);
  }
  for (const name of ["SUPABASE_URL", "VITE_SUPABASE_URL"]) {
    const escapedUrl = canonicalUrl.replaceAll(".", "\\.");
    if (!new RegExp(`^${name}=["']?${escapedUrl}["']?$`, "m").test(env))
      block(`${name} is not canonical`);
  }
  if (/^MAKE_SEARCH_WEBHOOK_URL\s*=/m.test(env))
    block("the Make webhook must not be stored in .env");
  if (/^VITE_[A-Z0-9_]*MAKE[A-Z0-9_]*WEBHOOK[A-Z0-9_]*\s*=/m.test(env))
    block("the Make webhook must not have a browser environment binding");
}

const files = [
  ...walk("src"),
  ...walk("scripts"),
  ...walk("tests"),
  "package.json",
  ".env.example",
  "vite.config.ts",
  "wrangler.jsonc",
  "supabase/config.toml",
]
  .filter((path, index, all) => existsSync(join(root, path)) && all.indexOf(path) === index)
  .filter((path) => path !== "scripts/assert-canonical-backend.mjs");

const serviceRoleName = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");
const viteMakePattern = /VITE_[A-Z0-9_]*MAKE[A-Z0-9_]*WEBHOOK[A-Z0-9_]*/;
const oldTables = [
  "guidelines",
  "contact_submissions",
  "label_analyses",
  "page_views",
  "site_announcements",
  "user_roles",
];

for (const path of files) {
  const source = read(path);
  if (source.includes(legacyRef)) block(`legacy backend reference found in ${path}`);
  if (source.includes(serviceRoleName)) block(`privileged key reference found in ${path}`);
  if (viteMakePattern.test(source)) block(`browser webhook variable found in ${path}`);
  for (const table of oldTables) {
    if (new RegExp(`\\.from\\(\\s*["']${table}["']\\s*\\)`).test(source)) {
      block(`unversioned website table access found in ${path}`);
    }
  }
}

if (existsSync(join(root, "src/lib/supabaseClient.ts"))) block("alternate Supabase client exists");
if (existsSync(join(root, "src/routes/rpc-test.tsx"))) block("development RPC route exists");

const migrations = join(root, "supabase/migrations");
if (
  existsSync(migrations) &&
  readdirSync(migrations).some((name) => /^202605.*\.sql$/i.test(name))
) {
  block("a quarantined legacy migration is active");
}

const identity = read("src/lib/backendIdentity.ts");
const viteConfig = read("vite.config.ts");
const browserClient = read("src/integrations/supabase/client.ts");
const serverClient = read("src/integrations/supabase/client.server.ts");
const authMiddleware = read("src/integrations/supabase/auth-middleware.ts");
if (!identity.includes("assertCanonicalSupabaseUrl") || !identity.includes(canonicalRef))
  block("canonical identity guard is absent");
if (/sb_(?:publishable|secret)_[A-Za-z0-9_-]+/.test(viteConfig))
  block("vite.config.ts contains a hard-coded Supabase key");
if (/process\.env\.(?:VITE_)?SUPABASE_[A-Z0-9_]+\s*=/.test(viteConfig))
  block("vite.config.ts overrides a Supabase environment variable");
for (const [path, source] of [
  ["src/integrations/supabase/client.ts", browserClient],
  ["src/integrations/supabase/client.server.ts", serverClient],
  ["src/integrations/supabase/auth-middleware.ts", authMiddleware],
]) {
  if (!source.includes("assertCanonicalSupabaseUrl") || !source.includes("assertPublishableKey"))
    block(`canonical guards are absent from ${path}`);
}

console.log("Canonical backend assertion passed.");
