import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20261010090000_sp_web_featured_browse_depth_hotfix_v1.sql",
  "utf8",
);
const homepage = readFileSync("src/routes/index.tsx", "utf8");

test("featured browse keeps the versioned canonical core and source-grounded top-ups", () => {
  assert.match(migration, /_sp_web_featured_products_core_v1_2/);
  assert.match(migration, /sp_web_featured_products_v1_2/);
  assert.match(migration, /sp_web_browse_seed_catalog_v1/);
  assert.match(migration, /sp_web_profile_seed_catalog_v1/);
  assert.match(migration, /left join lateral[\s\S]*sp_catalog_commerce_offer_v1/i);
  assert.match(migration, /false as safety_claim_available/i);
  assert.match(migration, /when r\.safety_claim_available then r\.profile_score else null end/i);
});

test("ALL profile preserves the historical 2+2+2 mix before general fill", () => {
  assert.match(migration, /child_items[\s\S]*limit 2/i);
  assert.match(migration, /pregnancy_items[\s\S]*limit 2/i);
  assert.match(migration, /senior_items[\s\S]*limit 2/i);
  assert.match(migration, /greatest\(v_limit-6,0\)/i);
  assert.match(migration, /'profile_mix'/);
});

test("frontend trusts the vetted browse RPC instead of dropping valid profile results", () => {
  assert.match(homepage, /rpc\("sp_web_featured_products_v1_2"/);
  assert.match(homepage, /payload\.results\.map\(\(item\) => toProduct\(item, profile\)\)/);
  assert.match(homepage, /display_eligible:\s*true/);
  assert.doesNotMatch(homepage, /function isProfileRelevant/);
  assert.doesNotMatch(homepage, /function isCategoryRelevant/);
});
