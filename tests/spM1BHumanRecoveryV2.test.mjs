import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MIGRATION = 'supabase/migrations/20260921114500_sp_m1b_qualification_policy_v2_human_recovery_v2.sql';

test('Human Review Recovery v2 persistence is admin-only, provenance-bound, and rescoring-capable', () => {
  assert.equal(existsSync(resolve(ROOT, MIGRATION)), true, 'v2 migration must exist');
  const sql = readFileSync(resolve(ROOT, MIGRATION), 'utf8');

  assert.match(sql, /sp_m1b_submit_human_recovery_v2/i);
  assert.match(sql, /sp_web_has_role_v1\s*\(\s*auth\.uid\(\)\s*,\s*'admin'/i);
  assert.match(sql, /ADMIN_MANUAL/i);
  assert.match(sql, /ADMIN_VERIFIED/i);
  assert.match(sql, /HUMAN_VERIFIED_WEB/i);
  assert.match(sql, /sp_m1b_score_qualified_product_v1/i);
  assert.match(sql, /status\s*=\s*'RESOLVED'/i);
  assert.match(sql, /source_url.*https:\/\//is);
  assert.match(sql, /jsonb_typeof\s*\(\s*p_parsed_ingredients\s*\)\s*<>\s*'array'/i);
  assert.match(sql, /array_length|jsonb_array_length/i);
  assert.match(sql, /revoke all on function public\.sp_m1b_submit_human_recovery_v2/i);
  const grants = sql.split(/\r?\n/).filter((line) => /grant execute on function public\.sp_m1b_submit_human_recovery_v2/i.test(line));
  assert.ok(grants.some((line) => /\bto authenticated\b/i.test(line)));
  assert.ok(grants.some((line) => /\bto service_role\b/i.test(line)));
  assert.ok(grants.every((line) => !/\bto (?:anon|public)\b/i.test(line)));
});

test('Human Review remains read-only while runtime recovery is routed to the dedicated Ingredient Recovery workstation', () => {
  const humanReview = readFileSync(resolve(ROOT, 'src/routes/admin.human-review.tsx'), 'utf8');
  const ingredientRecovery = readFileSync(resolve(ROOT, 'src/routes/admin.ingredient-recovery.tsx'), 'utf8');
  const adminShell = readFileSync(resolve(ROOT, 'src/components/admin/AdminShell.tsx'), 'utf8');

  assert.match(humanReview, /Benchmark-gold review and runtime ingredient recovery are separate/i);
  assert.match(humanReview, /Read-only review queue/i);
  assert.match(humanReview, /Gold remains UNASSIGNED/i);
  assert.doesNotMatch(humanReview, /sp_m1b_submit_human_recovery_v2/);

  assert.match(adminShell, /\/admin\/ingredient-recovery/);
  assert.match(adminShell, /Ingredient Recovery/);
  assert.match(ingredientRecovery, /sp_m1b_submit_human_recovery_v2/);
  assert.match(ingredientRecovery, /Validate & Recalculate/);
  assert.match(ingredientRecovery, /INGREDIENT_RECOVERY/);
});

test('Ingredient Recovery audit route is the terminal admin workstation and never accepts a manual score', () => {
  const route = readFileSync(resolve(ROOT, 'src/routes/admin.ingredient-recovery.tsx'), 'utf8');
  assert.match(route, /sp_m1b_submit_human_recovery_v2/);
  assert.match(route, /Exact product identity confirmed/);
  assert.match(route, /Source URL/);
  assert.match(route, /Source kind/);
  assert.match(route, /Ingredient declaration/);
  assert.match(route, /Parsed ingredients/);
  assert.match(route, /Reviewer note/);
  assert.match(route, /Validate & Recalculate/);
  assert.match(route, /score_available/);
  assert.match(route, /safety_score/);
  assert.match(route, /regulatory_reason/);
  assert.match(route, /load\(\)/);
  assert.doesNotMatch(route, /manual[_ -]?safety[_ -]?score/i);
  assert.doesNotMatch(route, /server[_ -]?credential|privileged[_ -]?credential|browser[_ -]?secret/i);
  assert.doesNotMatch(route, /benchmark_gold|sp_m1b_benchmark_gold/i);
});

test('manual recovery does not weaken benchmark-gold curation semantics', () => {
  const route = readFileSync(resolve(ROOT, 'src/routes/admin.human-review.tsx'), 'utf8');
  assert.match(route, /BENCHMARK_GOLD|Gold remains UNASSIGNED|gold_status/i);
  assert.match(route, /promotion remains disabled|never assigns benchmark gold|never.*promot/i);
  assert.match(route, /bundled|DEV/i);
});
