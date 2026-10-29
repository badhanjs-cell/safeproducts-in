import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { assertPublishableKey } from "../src/lib/backendIdentity.ts";

const root = new URL("..", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const canonicalRef = "wmxbdirvlwuagouraobr";
const legacyRef = ["prznbjqxux", "getekhwvoz"].join("");
const privilegedName = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");
const browserWebhookName = ["VITE", "MAKE", "SEARCH", "WEBHOOK", "URL"].join("_");

function sourceFiles(path, output = []) {
  const url = new URL(path, root);
  if (!existsSync(url)) return output;
  for (const entry of readdirSync(url)) {
    const child = join(path, entry);
    const info = statSync(new URL(child, root));
    if (info.isDirectory()) sourceFiles(`${child}/`, output);
    else if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".toml"].includes(extname(entry)))
      output.push(child);
  }
  return output;
}

test("canonical project ref, host and config are fixed", () => {
  const identity = read("src/lib/backendIdentity.ts");
  assert.match(identity, new RegExp(canonicalRef));
  assert.match(identity, /supabase\.co/);
  assert.equal(read("supabase/config.toml").trim(), `project_id = "${canonicalRef}"`);
});

test("Vite config does not hard-code or override Supabase bindings", () => {
  const config = read("vite.config.ts");
  assert.doesNotMatch(config, /sb_(?:publishable|secret)_[A-Za-z0-9_-]+/);
  assert.doesNotMatch(config, /process\.env\.(?:VITE_)?SUPABASE_[A-Z0-9_]+\s*=/);
});

test("all active Supabase client paths use both identity guards", () => {
  for (const path of [
    "src/integrations/supabase/client.ts",
    "src/integrations/supabase/client.server.ts",
    "src/integrations/supabase/auth-middleware.ts",
  ]) {
    const source = read(path);
    assert.match(source, /assertCanonicalSupabaseUrl/, path);
    assert.match(source, /assertPublishableKey/, path);
  }
});

test("publishable credential validation accepts only approved public forms", () => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const jwt = (payload, header = { alg: "HS256", typ: "JWT" }) =>
    `${encode(header)}.${encode(payload)}.signature`;
  const canonicalAnon = jwt({ role: "anon", ref: canonicalRef });

  assert.equal(assertPublishableKey("sb_publishable_public-test_123"), "sb_publishable_public-test_123");
  assert.equal(assertPublishableKey(canonicalAnon), canonicalAnon);
  for (const rejected of [
    jwt({ role: "service_role", ref: canonicalRef }),
    jwt({ role: "anon", ref: "different-project" }),
    "not-a-jwt",
    "eyJ.invalid.signature",
    "sb_secret_private-test_123",
  ]) {
    assert.throws(() => assertPublishableKey(rejected), /SAFEPRODUCTS_BACKEND_IDENTITY_MISMATCH/);
  }
});

test("active source and config contain no legacy or privileged backend path", () => {
  const files = [
    ...sourceFiles("src/"),
    "package.json",
    "vite.config.ts",
    "wrangler.jsonc",
    ".env.example",
  ];
  for (const path of files) {
    const source = read(path);
    assert.equal(source.includes(legacyRef), false, path);
    assert.equal(source.includes(privilegedName), false, path);
  }
  assert.equal(existsSync(new URL("src/lib/supabaseClient.ts", root)), false);
});

test("Make webhook stays server-only and absent from environment files", () => {
  assert.equal(read(".env").includes("MAKE_SEARCH_WEBHOOK_URL"), false);
  assert.equal(read(".env").includes(browserWebhookName), false);
  for (const path of sourceFiles("src/"))
    assert.equal(read(path).includes(browserWebhookName), false, path);
  assert.match(read("src/lib/productSearch.functions.ts"), /process\.env\.MAKE_SEARCH_WEBHOOK_URL/);
});

test("website database access uses only versioned table names", () => {
  const oldTables = [
    "guidelines",
    "contact_submissions",
    "label_analyses",
    "page_views",
    "site_announcements",
    "user_roles",
  ];
  for (const path of sourceFiles("src/")) {
    const source = read(path);
    for (const table of oldTables)
      assert.doesNotMatch(source, new RegExp(`\\.from\\(\\s*["']${table}["']\\s*\\)`), path);
  }
  const schema = read("src/integrations/supabase/webDatabase.ts");
  for (const table of oldTables) assert.match(schema, new RegExp(`sp_web_${table}_v1`));
});

test("development RPC route and alternate client are removed", () => {
  assert.equal(existsSync(new URL("src/routes/rpc-test.tsx", root)), false);
  assert.equal(existsSync(new URL("src/lib/supabaseClient.ts", root)), false);
});

test("identity gate blocks children until a successful sentinel result", () => {
  const gate = read("src/components/BackendIdentityGate.tsx");
  assert.match(gate, /useState<"checking" \| "ok" \| "error">\("checking"\)/);
  assert.match(gate, /status === "checking"/);
  assert.match(gate, /status === "error"/);
  assert.match(gate, /return <>\{children\}<\/>/);
  assert.equal(gate.includes("{error}"), false);
});

test("root gates VerifiedRoot before route effects can mount", () => {
  const rootRoute = read("src/routes/__root.tsx");
  assert.match(
    rootRoute,
    /<BackendIdentityGate>[\s\S]*<VerifiedRoot \/>[\s\S]*<\/BackendIdentityGate>/,
  );
  assert.ok(
    rootRoute.indexOf("function RootComponent") < rootRoute.indexOf("function VerifiedRoot"),
  );
  assert.ok(
    rootRoute.indexOf("function VerifiedRoot") < rootRoute.indexOf("logPageView({ page: path })"),
  );
});

test("legacy migrations remain quarantined and guarded", () => {
  assert.match(read("supabase/archive_legacy_lovable_cloud/README.md"), /ARCHIVE ONLY/);
  const active = new URL("supabase/migrations/", root);
  const names = existsSync(active) ? readdirSync(active) : [];
  assert.equal(
    names.some((name) => /^202605.*\.sql$/i.test(name)),
    false,
  );
  assert.match(
    read("scripts/assert-canonical-backend.mjs"),
    /SAFEPRODUCTS_BACKEND_IDENTITY_CHANGE_BLOCKED/,
  );
  assert.match(read("package.json"), /"check:backend"/);
});
