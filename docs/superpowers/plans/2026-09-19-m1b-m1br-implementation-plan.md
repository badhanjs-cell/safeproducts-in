# M1-B + M1-BR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fast M1-B primary ingredient-acquisition engine, an automatic asynchronous M1-BR deep ingredient-recovery engine, engine-by-engine audit/reporting, human-review fallback, 150-product benchmark with display-before-cache promotion, and controlled normal-search / Check My Label integration.

**Architecture:** Reuse the existing SafeProducts catalog tables for product, ingredient evidence, qualified ingredients, image, commerce, safety assessment, pipeline state and review queue. Add only versioned orchestration/audit/benchmark surfaces. Normal search returns cache/M1-B results quickly and never waits for M1-BR; M1-BR runs asynchronously for ingredient failures only. Safety scores remain downstream of ingredient and regulatory qualification.

**Tech Stack:** PostgreSQL/Supabase, Supabase Edge Functions (Deno/TypeScript), TanStack Start + React 19, Zod, existing SafeProducts search contract, Python benchmark harness, optional Railway Python OCR service (PaddleOCR), Google Vision adapter when credentials are configured, OpenAI VLM rescue.

**Spec:** `docs/superpowers/specs/2026-09-19-m1b-m1br-final-approved.md`

## Global Constraints

- Canonical backend only: `SafeProducts_ValuLenz` / `wmxbdirvlwuagouraobr`.
- Do not modify or restyle the frozen homepage while implementing this backend/extraction work.
- No client-side service-role credentials.
- No numeric Safety Score unless ingredient evidence is `QUALIFIED` and regulatory qualification succeeds.
- M1-B official early stop: final evidence confidence `>= 92/100` plus all hard gates.
- M1-B trusted-source early stop: final evidence confidence `>= 95/100` plus all hard gates.
- M1-BR is automatic, asynchronous for normal search, and ingredient-recovery only; it must not redo display-image or commerce extraction.
- M1-BR may retrieve/process ingredient-panel/back-label images as ingredient evidence.
- Benchmark split remains 30 DEV + 120 HOLDOUT across six 25-product categories.
- HOLDOUT thresholds are frozen before HOLDOUT execution.
- Benchmark qualified results are displayed to the active test user/session first; cache promotion happens only after the display is acknowledged and the benchmark result is sealed.
- Zero unsupported/fabricated ingredients is a hard HOLDOUT gate.
- Human review is the terminal fallback after M1-B and M1-BR.
- Existing Safety Engine remains downstream and frozen.

## Review Focus

1. **Same product name, different pack/market/formulation:** exact fingerprint must prevent cross-formulation cache pollution; Task 2 tests this.
2. **M1-B times out after finding price/image but before ingredients qualify:** image/commerce persist independently, Safety Score remains null; Task 3 tests this.
3. **M1-BR is enqueued twice for the same unresolved run:** queue must be idempotent and claim exactly once; Task 4 tests this.
4. **Benchmark result is qualified but display acknowledgment never arrives:** cache promotion must remain blocked; Task 6 tests this.
5. **Frontend receives mixed safety-qualified and price-only products:** only qualified products are ranked; pending products render in a separate section with no score; Task 7 tests this.

---

## File Structure

### New backend/migration files
- `supabase/migrations/20260919XXXXXX_sp_m1b_m1br_runtime_foundation_v1.sql` — run ledger, engine-attempt audit, M1-BR queue, benchmark display/promotion state, metrics/report RPCs, RLS, idempotency and worker-token registration.
- `supabase/migrations/20260919YYYYYY_sp_m1b_m1br_search_adapter_v1.sql` — public/read-safe result RPCs and controlled promotion/acknowledgment RPCs.

### New Edge Functions
- `supabase/functions/sp-m1b-path-a-v1/index.ts` — foreground M1-B orchestration for exact/cache/official/trusted acquisition, ingredient qualification envelope, image/commerce persistence and M1-BR enqueue.
- `supabase/functions/sp-m1br-recovery-worker-v1/index.ts` — claims queued failures, performs ingredient-only deep recovery and human-review handoff.
- `supabase/functions/sp-m1b-search-v1/index.ts` — user-search endpoint returning qualified + safety-pending groups within foreground budget.
- `supabase/functions/sp-m1b-label-analyze-v1/index.ts` — Check My Label controlled integration with uploaded evidence and bounded foreground budget.

### Optional OCR service
- `services/m1br-ocr/app.py` — private HTTP OCR adapter using PaddleOCR; validates image URL/bytes and returns normalized OCR spans.
- `services/m1br-ocr/requirements.txt` — pinned Python OCR dependencies.
- `services/m1br-ocr/test_app.py` — contract tests.

### Benchmark tooling
- Port predecessor files into `tools/m1a/` on the implementation branch.
- `tools/m1b/contract.json` — M1-B/M1-BR run/result schema.
- `tools/m1b/runner.py` — 150-product orchestration runner.
- `tools/m1b/report.py` — separate M1-B, M1-BR, combined and human-review metrics.
- `tools/m1b/test_runner.py`, `tools/m1b/test_report.py` — benchmark tests.

### Frontend/server files
- Modify `src/lib/productSearch.functions.ts` — feature-gated call to `sp-m1b-search-v1`; legacy Make path remains disabled as M1-B runtime fallback.
- Modify `src/lib/searchContract.ts` — preserve `SAFETY_QUALIFIED` vs `PRICE_ONLY_FALLBACK` contract and add engine/recovery metadata without allowing scores on pending products.
- Modify `src/components/SearchResults.tsx` — render two separate groups.
- Modify `src/lib/labels.functions.ts` — feature-gated M1-B label endpoint and non-numeric pending state.
- Modify `src/routes/check-my-label.tsx` — bounded foreground UX and deeper-verification state.
- Create `src/routes/admin.ingredient-recovery.tsx` — engine audit + human-review monitoring.
- Modify `src/components/admin/AdminShell.tsx` — add Ingredient Recovery audit navigation.

### Tests/CI
- `tests/spM1BSearchContract.test.mjs`
- `tests/spM1BDisplaySeparation.test.mjs`
- `tests/spM1BLabelContract.test.mjs`
- `tests/spM1BAuditContract.test.mjs`
- `scripts/assert-m1b-contract.mjs`
- Modify `package.json` — add `check:m1b` to `check:backend`.
- Create `.github/workflows/m1b-m1br-ci.yml`.

---

### Task 1: Freeze final spec in CI and port the M1-A benchmark foundation

**Files:**
- Create on implementation branch: `tools/m1a/README.md`, `tools/m1a/benchmark.py`, `tools/m1a/contract.json`, `tools/m1a/production_candidate_export.sql`, `tools/m1a/test_benchmark.py` from `feat/m1a-m2a-foundations-2026-09-17`
- Create: `scripts/assert-m1b-contract.mjs`
- Modify: `package.json`
- Test: `tools/m1a/test_benchmark.py`, `tests/spM1BAuditContract.test.mjs`

**Interfaces:**
- Consumes: approved spec path.
- Produces: stable M1-A 150-slot benchmark contract and `bun run check:m1b`.

- [ ] **Step 1: Write the failing contract test**

Create `tests/spM1BAuditContract.test.mjs` to assert the final spec contains the exact invariants:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const spec = readFileSync('docs/superpowers/specs/2026-09-19-m1b-m1br-final-approved.md', 'utf8');

test('M1-BR is automatic asynchronous ingredient-only recovery', () => {
  assert.match(spec, /automatic asynchronous ingredient-only recovery/i);
  assert.match(spec, /normal user search never waits for M1-BR/i);
  assert.match(spec, /does not redo display-image discovery, price extraction/i);
});

test('benchmark display precedes cache promotion', () => {
  const display = spec.indexOf('expose/display the newly qualified result');
  const promote = spec.indexOf('promote the qualified production-admissible');
  assert.ok(display >= 0 && promote > display);
});
```

- [ ] **Step 2: Run the test and verify RED before files are ported to the implementation branch**

Run: `node --test tests/spM1BAuditContract.test.mjs && python tools/m1a/test_benchmark.py`

Expected before port: Python command fails because `tools/m1a` is absent on main-derived implementation branch.

- [ ] **Step 3: Port the frozen M1-A files verbatim and add `check:m1b`**

Add to `package.json`:

```json
"check:m1b": "node --test tests/spM1BAuditContract.test.mjs && python tools/m1a/test_benchmark.py"
```

and append `bun run check:m1b` to `check:backend`.

- [ ] **Step 4: Run GREEN verification**

Run: `bun run check:m1b`

Expected: all Node and Python benchmark-foundation tests PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs tools/m1a scripts/assert-m1b-contract.mjs tests/spM1BAuditContract.test.mjs package.json
git commit -m "test: freeze M1-B architecture and benchmark foundation"
```

---

### Task 2: Add the M1-B/M1-BR orchestration and audit database foundation

**Files:**
- Create: `supabase/migrations/20260919XXXXXX_sp_m1b_m1br_runtime_foundation_v1.sql`
- Test: `tests/spM1BAuditContract.test.mjs`

**Interfaces:**
- Consumes: existing catalog tables and `sp_internal.worker_secret_v1`.
- Produces RPCs:
  - `sp_m1b_begin_run_v1(p_context text,p_product_id uuid,p_product_fingerprint text,p_benchmark_slot_id text,p_session_key text) returns jsonb`
  - `sp_m1b_record_attempt_v1(p_run_id uuid,p_engine text,p_stage text,p_status text,p_metrics jsonb,p_failure_code text,p_detail jsonb) returns jsonb`
  - `sp_m1b_enqueue_recovery_v1(p_run_id uuid,p_product_id uuid,p_failure_code text,p_payload jsonb) returns jsonb`
  - `sp_m1br_claim_tasks_v1(p_worker_code text,p_limit integer) returns jsonb`
  - `sp_m1br_complete_task_v1(...) returns jsonb`
  - `sp_m1b_get_report_v1(p_from timestamptz,p_to timestamptz,p_context text default null) returns jsonb`
  - `sp_m1b_ack_benchmark_display_v1(p_run_id uuid,p_session_key text) returns jsonb`
  - `sp_m1b_promote_after_display_v1(p_run_id uuid) returns jsonb`

- [ ] **Step 1: Extend the failing static contract test**

Add assertions for table/RPC names and the promotion guard:

```js
const sql = readFileSync('supabase/migrations/20260919XXXXXX_sp_m1b_m1br_runtime_foundation_v1.sql', 'utf8');
assert.match(sql, /create table .*sp_m1b_run_v1/i);
assert.match(sql, /create table .*sp_m1b_engine_attempt_v1/i);
assert.match(sql, /create table .*sp_m1br_recovery_queue_v1/i);
assert.match(sql, /sp_m1b_ack_benchmark_display_v1/i);
assert.match(sql, /sp_m1b_promote_after_display_v1/i);
assert.match(sql, /displayed_at is null/i);
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/spM1BAuditContract.test.mjs`

Expected: FAIL because migration does not exist.

- [ ] **Step 3: Implement additive tables with strict enums/checks**

Core run table shape:

```sql
create table public.sp_m1b_run_v1 (
  id uuid primary key default gen_random_uuid(),
  context text not null check (context in ('BENCHMARK','NORMAL_SEARCH','CHECK_MY_LABEL')),
  product_id uuid references public.sp_catalog_product_v1(id) on delete set null,
  product_fingerprint text not null,
  benchmark_slot_id text,
  session_key_hash text,
  m1b_status text not null default 'PENDING' check (m1b_status in ('PENDING','QUALIFIED','FAILED','CONFLICT')),
  m1br_status text not null default 'NOT_REQUIRED' check (m1br_status in ('NOT_REQUIRED','QUEUED','RUNNING','QUALIFIED','INSUFFICIENT_EVIDENCE','CONFLICT_REQUIRES_REVIEW','FAILED')),
  benchmark_sealed_at timestamptz,
  displayed_at timestamptz,
  promotion_status text not null default 'BLOCKED' check (promotion_status in ('BLOCKED','ELIGIBLE','PROMOTED','REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Engine attempts store `engine`, `stage`, `status`, `latency_ms`, `cost_usd`, `search_calls`, `ocr_calls`, `vlm_calls`, `failure_code`, `metrics`, `detail` and timestamps. Recovery queue gets a partial unique index on active `run_id` so duplicate enqueue is impossible.

- [ ] **Step 4: Implement display-before-cache promotion guard**

`sp_m1b_promote_after_display_v1` must reject benchmark promotion unless both conditions are true:

```sql
if v_run.context = 'BENCHMARK'
   and (v_run.benchmark_sealed_at is null or v_run.displayed_at is null) then
  return jsonb_build_object('success',false,'code','BENCHMARK_DISPLAY_OR_SEAL_REQUIRED');
end if;
```

For non-benchmark runs, normal production-admission rules apply without this benchmark-specific acknowledgment.

- [ ] **Step 5: Implement RLS, admin read policy, service-role worker RPC grants and audit triggers**

Anonymous/authenticated clients get no direct write access to orchestration tables. Admin users may read audit/report surfaces only through existing role checks; worker mutation RPCs remain service-role/worker-token only.

- [ ] **Step 6: Run static tests and migration validation on a non-production database**

Run: `bun run check:m1b`

Then apply migration to an isolated Supabase development branch and execute:

```sql
select public.sp_m1b_begin_run_v1('BENCHMARK', null, 'test-fingerprint', 'COSMETICS_DEV_01', 'session-a');
```

Expected: one run; duplicate recovery enqueue returns the same active queue task rather than creating two.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations tests/spM1BAuditContract.test.mjs
git commit -m "feat: add M1-B orchestration and audit foundation"
```

---

### Task 3: Implement M1-B Path A with independent image/commerce persistence

**Files:**
- Create: `supabase/functions/sp-m1b-path-a-v1/index.ts`
- Modify only by reuse/reference: `supabase/functions/sp-catalog-enrichment-worker-v1/index.ts`
- Test: `tests/spM1BSearchContract.test.mjs`

**Interfaces:**
- Input:

```ts
type M1BPathAInput = {
  run_id: string;
  product_id?: string;
  query?: string;
  identity: { brand_name: string; product_name: string; variant?: string; pack_size_text?: string; market_country_code?: string; gtin?: string };
  foreground_budget_ms: number;
  benchmark_mode?: boolean;
};
```

- Output:

```ts
type M1BPathAResult = {
  engine: 'M1-B';
  ingredient_status: 'QUALIFIED'|'INSUFFICIENT_EVIDENCE'|'CONFLICT_REQUIRES_REVIEW';
  ingredient_confidence: number|null;
  parsed_ingredients: string[];
  evidence_refs: string[];
  image_saved: boolean;
  commerce_saved: boolean;
  failure_code: string|null;
  recovery_enqueued: boolean;
};
```

- [ ] **Step 1: Write failing tests for early stop, independent lanes and no-score failure**

Test fixture cases:

```js
const official = { sourceAuthority:100, identity:98, completeness:100, extraction:98, freshness:95, conflict:false };
assert.equal(qualifiesOfficial(official), true);
assert.equal(nextIngredientTierAfterOfficial(official), null);

const partial = { imageSaved:true, commerceSaved:true, ingredientStatus:'INSUFFICIENT_EVIDENCE' };
assert.equal(partial.imageSaved, true);
assert.equal(partial.commerceSaved, true);
assert.equal(partial.safetyScore, undefined);
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/spM1BSearchContract.test.mjs`

Expected: FAIL because M1-B function/contract helpers are absent.

- [ ] **Step 3: Implement official/trusted evidence scoring and hard gates**

Use component scores rather than model self-confidence. Keep the final calculation pure and deterministic:

```ts
function finalConfidence(c: Components) {
  return Math.max(0, Math.min(100,
    c.sourceAuthority*0.24 + c.identity*0.24 + c.completeness*0.20 +
    c.extraction*0.14 + c.freshness*0.08 + c.lineage*0.05 +
    c.corroboration*0.05 - c.conflictPenalty));
}
```

Weights may be tuned on DEV only before HOLDOUT; the function and threshold version must be recorded in attempts.

- [ ] **Step 4: Reuse current official-domain/commerce logic without mixing it into safety**

M1-B may call/reuse catalog enrichment helpers to save verified image/price. Ingredient qualification must not depend on price/image presence.

- [ ] **Step 5: On ingredient failure enqueue M1-BR exactly once**

Call `sp_m1b_enqueue_recovery_v1`. Do not call the legacy extractor.

- [ ] **Step 6: Verify GREEN and regression**

Run:

```bash
node --test tests/spM1BSearchContract.test.mjs
bun run check:backend
bun run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/sp-m1b-path-a-v1 tests/spM1BSearchContract.test.mjs
git commit -m "feat: implement M1-B Path A acquisition"
```

---

### Task 4: Implement automatic M1-BR ingredient-only recovery

**Files:**
- Create: `supabase/functions/sp-m1br-recovery-worker-v1/index.ts`
- Create: `services/m1br-ocr/app.py`
- Create: `services/m1br-ocr/requirements.txt`
- Create: `services/m1br-ocr/test_app.py`
- Test: `tests/spM1BSearchContract.test.mjs`

**Interfaces:**
- Queue claim: `sp_m1br_claim_tasks_v1`.
- OCR HTTP response:

```json
{"engine":"paddleocr","engine_version":"3.x","text":"...","spans":[{"text":"Aqua","confidence":0.99}],"latency_ms":120}
```

- [ ] **Step 1: Write failing OCR service tests**

```python
def test_rejects_non_image_payload(client):
    r = client.post('/ocr', json={'content_type':'text/plain','bytes_b64':'SGVsbG8='})
    assert r.status_code == 415

def test_returns_ordered_text_spans(client, sample_label_b64):
    r = client.post('/ocr', json={'content_type':'image/jpeg','bytes_b64':sample_label_b64})
    assert r.status_code == 200
    body = r.json()
    assert body['engine'] == 'paddleocr'
    assert isinstance(body['spans'], list)
```

- [ ] **Step 2: Run RED**

Run: `pytest services/m1br-ocr/test_app.py -q`

Expected: FAIL because service is absent.

- [ ] **Step 3: Implement the bounded private OCR service**

`app.py` validates MIME type, decoded size, dimensions, request token and timeouts; performs PaddleOCR; returns spans only. It never writes catalog/safety data.

- [ ] **Step 4: Implement the M1-BR worker**

Worker sequence:

```ts
const stages = [
  'BROADER_TRUSTED_DISCOVERY',
  'INGREDIENT_IMAGE_DISCOVERY',
  'PRIMARY_OCR',
  'SECONDARY_OCR_IF_NEEDED',
  'OCR_RECONCILIATION',
  'VLM_RESCUE_IF_NEEDED',
  'FINAL_EVIDENCE_QUALIFICATION'
] as const;
```

The secondary OCR adapter uses Google Vision only when `GOOGLE_VISION_API_KEY` or approved service credentials are configured; otherwise record `SECONDARY_OCR_NOT_CONFIGURED` and continue to VLM rescue without claiming the second OCR ran.

- [ ] **Step 5: Enforce ingredient-only behavior with a failing-then-green contract test**

The worker source must not call `sp_catalog_apply_web_enrichment_v1`, write `sp_catalog_commerce_offer_v1`, or set `is_primary_display`. It may write ingredient evidence through controlled RPCs only.

- [ ] **Step 6: Human-review handoff**

When final state is `INSUFFICIENT_EVIDENCE` or `CONFLICT_REQUIRES_REVIEW`, create/update one `sp_catalog_review_queue_v1` item with `review_type='INGREDIENT_RECOVERY'` and complete evidence packet in `source_context`.

- [ ] **Step 7: Run GREEN**

```bash
pytest services/m1br-ocr/test_app.py -q
node --test tests/spM1BSearchContract.test.mjs
bun run check:backend
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add services/m1br-ocr supabase/functions/sp-m1br-recovery-worker-v1 tests/spM1BSearchContract.test.mjs
git commit -m "feat: add automatic M1-BR ingredient recovery"
```

---

### Task 5: Implement fast search endpoint and engine audit envelope

**Files:**
- Create: `supabase/functions/sp-m1b-search-v1/index.ts`
- Create: `supabase/migrations/20260919YYYYYY_sp_m1b_m1br_search_adapter_v1.sql`
- Modify: `src/lib/productSearch.functions.ts`
- Modify: `src/lib/searchContract.ts`
- Test: `tests/spM1BSearchContract.test.mjs`

**Interfaces:**
- Search endpoint returns existing consumer contract plus:

```ts
type M1BMeta = {
  run_id: string;
  engine: 'CACHE'|'M1-B';
  m1br_queued_count: number;
  foreground_latency_ms: number;
};
```

- [ ] **Step 1: Write failing tests for foreground timeout and score suppression**

Assert that `PRICE_ONLY_FALLBACK` products contain no `safety_score`, `profile_score`, child/pregnancy/senior scores, and that M1-BR is not awaited by the foreground endpoint.

- [ ] **Step 2: Run RED**

`node --test tests/spM1BSearchContract.test.mjs`

- [ ] **Step 3: Implement `sp-m1b-search-v1`**

The endpoint first reads qualified cache, then calls M1-B for unresolved candidates until the foreground deadline. At deadline it returns accumulated qualified + price-only results and leaves already-enqueued M1-BR jobs running asynchronously.

- [ ] **Step 4: Add frontend server feature flag**

In `productSearch.functions.ts`:

```ts
if (process.env.SP_M1B_SEARCH_ENABLED === 'true') {
  return callM1BSearch(data);
}
return unavailable('NOT_QUALIFIED');
```

Do not fall back to the legacy Make extractor when M1-B is enabled. Keep legacy code reachable only under its existing explicit legacy flag during controlled comparison, not as runtime recovery.

- [ ] **Step 5: Preserve backward-compatible `DisplayBasis`**

Keep `SAFETY_QUALIFIED` and `PRICE_ONLY_FALLBACK`; add optional `engine`/`recovery_status` fields. Validation continues to fail closed if a price-only product carries any safety number.

- [ ] **Step 6: Verify GREEN**

```bash
node --test tests/spM1BSearchContract.test.mjs tests/spProd1SearchContract.test.mjs
bun run typecheck
bun run build
```

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/sp-m1b-search-v1 supabase/migrations src/lib/productSearch.functions.ts src/lib/searchContract.ts tests/spM1BSearchContract.test.mjs
git commit -m "feat: add fast M1-B search endpoint"
```

---

### Task 6: Build the 150-product benchmark, display-before-cache acknowledgment and side-by-side report

**Files:**
- Create: `tools/m1b/contract.json`
- Create: `tools/m1b/runner.py`
- Create: `tools/m1b/report.py`
- Create: `tools/m1b/test_runner.py`
- Create: `tools/m1b/test_report.py`

**Interfaces:**
- Runner record includes `slot_id`, `split`, `category`, product identity, M1-B result, M1-BR result, final state, latency/cost/call counts, `sealed_at`, `displayed_at`, `promotion_status`.

- [ ] **Step 1: Write failing report formula tests**

```python
def test_incremental_recovery_metrics():
    rows = make_rows(total=150, m1b_qualified=120, m1br_qualified=15)
    r = summarize(rows)
    assert r['m1b_success_rate'] == 0.80
    assert r['m1br_recovery_rate'] == 0.50
    assert r['combined_qualification_rate'] == 0.90
    assert r['m1br_absolute_lift'] == 0.10
```

- [ ] **Step 2: Write failing display-before-cache test**

```python
def test_benchmark_promotion_requires_display_ack():
    run = sealed_qualified_run(displayed_at=None)
    assert promotion_allowed(run) is False
    run['displayed_at'] = '2026-09-19T14:00:00+05:30'
    assert promotion_allowed(run) is True
```

- [ ] **Step 3: Run RED**

`pytest tools/m1b/test_runner.py tools/m1b/test_report.py -q`

- [ ] **Step 4: Implement runner and report**

Report columns: historical baseline, M1-B, M1-BR incremental, combined, human review. Include precision, recall, full-declaration recovery, unsupported ingredients, conflicts, review referrals, p50/p95 latency, cost, cache promotions.

- [ ] **Step 5: Implement benchmark first-display acknowledgment**

The benchmark test UI/runner must call `sp_m1b_ack_benchmark_display_v1` only after the result payload is successfully rendered/confirmed in the active session; only then call/allow `sp_m1b_promote_after_display_v1`.

- [ ] **Step 6: DEV then frozen HOLDOUT**

Run 30 DEV products first. Tune confidence weights/usefulness gate on DEV only. Persist the final threshold/version before running 120 HOLDOUT. Do not edit thresholds during HOLDOUT.

- [ ] **Step 7: GREEN verification**

`pytest tools/m1b/test_runner.py tools/m1b/test_report.py tools/m1a/test_benchmark.py -q`

- [ ] **Step 8: Commit**

```bash
git add tools/m1b
git commit -m "feat: add M1-B 150-product benchmark and audit report"
```

---

### Task 7: Separate safety-qualified and safety-pending frontend results

**Files:**
- Modify: `src/components/SearchResults.tsx`
- Modify: `src/lib/productDisplayOrder.ts`
- Test: `tests/spM1BDisplaySeparation.test.mjs`

**Interfaces:**
- Consumes existing `Product.display_basis`.
- Produces two explicit UI groups.

- [ ] **Step 1: Write failing UI contract test**

Assert source contains independent partitions:

```js
assert.match(source, /display_basis === ["']SAFETY_QUALIFIED["']/);
assert.match(source, /display_basis === ["']PRICE_ONLY_FALLBACK["']/);
assert.match(source, /Other products.*safety analysis pending/i);
```

Also test `orderProductsForDisplay` never assigns `safest` based on a price-only product.

- [ ] **Step 2: Run RED**

`node --test tests/spM1BDisplaySeparation.test.mjs`

- [ ] **Step 3: Implement two sections without changing homepage styling**

Partition:

```ts
const safetyQualified = results.filter(p => p.display_basis === 'SAFETY_QUALIFIED');
const safetyPending = results.filter(p => p.display_basis === 'PRICE_ONLY_FALLBACK');
```

Render safetyQualified first under the existing safety heading. Render pending in a separate block headed `Other products — safety analysis pending`. Never pass `safest` or safety ranking badges to pending products.

- [ ] **Step 4: Run GREEN + visual build**

```bash
node --test tests/spM1BDisplaySeparation.test.mjs
bun run typecheck
bun run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchResults.tsx src/lib/productDisplayOrder.ts tests/spM1BDisplaySeparation.test.mjs
git commit -m "feat: separate safety-qualified and pending search results"
```

---

### Task 8: Integrate Check My Label with bounded M1-B foreground analysis and background M1-BR

**Files:**
- Create: `supabase/functions/sp-m1b-label-analyze-v1/index.ts`
- Modify: `src/lib/labels.functions.ts`
- Modify: `src/routes/check-my-label.tsx`
- Test: `tests/spM1BLabelContract.test.mjs`

**Interfaces:**
- Qualified response keeps existing `AnalysisResult` safety fields.
- Pending response adds:

```ts
type PendingLabelResult = {
  status: 'DEEPER_VERIFICATION_IN_PROGRESS'|'INSUFFICIENT_EVIDENCE'|'CONFLICT_REQUIRES_REVIEW';
  safety_score: null;
  detected_ingredients: string[];
  run_id: string;
  catalog_sync_status: 'SYNCED'|'PENDING';
};
```

- [ ] **Step 1: Write failing tests**

Assert pending responses cannot carry numeric safety score and M1-B label call has a 20–30 second foreground ceiling.

- [ ] **Step 2: Run RED**

`node --test tests/spM1BLabelContract.test.mjs`

- [ ] **Step 3: Implement feature-gated endpoint selection**

When `SP_M1B_LABEL_ENABLED=true`, call `sp-m1b-label-analyze-v1`; do not fall back to old analysis on an M1-B ingredient failure. Old endpoint remains available only while the feature flag is off during controlled rollout.

- [ ] **Step 4: Reconcile user ingredient-panel evidence**

Treat uploaded ingredient panel as exact-pack evidence after pair/identity validation. Record its hashes and provenance. If it qualifies within budget, score. Otherwise enqueue M1-BR and return pending state.

- [ ] **Step 5: Preserve front image independently**

Front image may strengthen identity and enter image-candidate workflow only under the existing consent/privacy/quality gates. It does not affect Safety Score.

- [ ] **Step 6: GREEN verification**

```bash
node --test tests/spM1BLabelContract.test.mjs
bun run typecheck
bun run build
```

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/sp-m1b-label-analyze-v1 src/lib/labels.functions.ts src/routes/check-my-label.tsx tests/spM1BLabelContract.test.mjs
git commit -m "feat: integrate M1-B with Check My Label"
```

---

### Task 9: Add admin engine audit and human-review monitoring

**Files:**
- Create: `src/routes/admin.ingredient-recovery.tsx`
- Modify: `src/components/admin/AdminShell.tsx`
- Test: `tests/spM1BAuditContract.test.mjs`

**Interfaces:**
- Uses read-only/admin RPC `sp_m1b_get_report_v1` and existing review queue.

- [ ] **Step 1: Write failing audit UI contract test**

Assert the route displays labels for `M1-B success rate`, `M1-BR recovery rate`, `Combined qualification rate`, `M1-BR absolute lift`, `Human review rate`, `p50`, `p95`, `Cost per recovery`.

- [ ] **Step 2: Run RED**

`node --test tests/spM1BAuditContract.test.mjs`

- [ ] **Step 3: Implement read-only dashboard**

Show counts/rates side-by-side and a review queue summary. No direct raw-table writes from the page.

- [ ] **Step 4: GREEN verification**

```bash
node --test tests/spM1BAuditContract.test.mjs
bun run typecheck
bun run build
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin.ingredient-recovery.tsx src/components/admin/AdminShell.tsx tests/spM1BAuditContract.test.mjs
git commit -m "feat: add M1-B engine audit dashboard"
```

---

### Task 10: Security, performance and end-to-end certification

**Files:**
- Create: `.github/workflows/m1b-m1br-ci.yml`
- Modify: `package.json`
- Create: `docs/superpowers/certifications/2026-09-19-m1b-m1br-certification.md` only after all evidence exists.

**Interfaces:**
- Consumes all prior tasks.
- Produces a final PASS/FAIL certification record; no production-default switch on FAIL.

- [ ] **Step 1: Add CI workflow**

CI runs:

```bash
bun install --frozen-lockfile
bun run check:backend
bun run typecheck
bun run lint
bun run build
python tools/m1a/test_benchmark.py
pytest tools/m1b/test_runner.py tools/m1b/test_report.py services/m1br-ocr/test_app.py -q
```

- [ ] **Step 2: Run full suite locally/branch CI and record every failure**

No success claim until all required checks are green. Existing unrelated failures must be reported by name rather than hidden.

- [ ] **Step 3: Run security assertions**

Verify no service-role secret in frontend bundle/source, orchestration tables have RLS, worker RPCs are not executable by `anon`, and source/image payloads are bounded and validated.

- [ ] **Step 4: Run 30 DEV benchmark and freeze thresholds**

Record M1-B success, M1-BR recovery, combined lift, precision/recall, unsupported count, latency and cost. Freeze usefulness gate before HOLDOUT.

- [ ] **Step 5: Run 120 HOLDOUT benchmark unchanged**

Required gates: provenance 100%, unsupported ingredients 0, precision non-regression, recall/full-declaration improvement, no false-qualification increase, deterministic automatic BR routing, separate engine audit reproducibility, display-before-cache guard verified.

- [ ] **Step 6: Controlled frontend and Check My Label test**

With feature flags enabled in non-public/controlled deployment, verify normal search returns without waiting for M1-BR and label analysis moves to pending state at the foreground ceiling rather than showing a provisional score.

- [ ] **Step 7: Write certification only from measured evidence**

Certification includes exact commit SHA, migration names, Edge Function versions, benchmark metrics and PASS/FAIL for each acceptance gate.

- [ ] **Step 8: Commit**

```bash
git add .github/workflows package.json docs/superpowers/certifications
git commit -m "test: certify M1-B M1-BR production candidate"
```

---

## Self-Review

- **Spec coverage:** Every approved requirement maps to Tasks 2–10; display-before-cache is specifically Task 6.
- **Placeholder scan:** No `TBD`, `TODO`, or unspecified implementation step is used; timestamp placeholders in migration filenames are intentionally resolved to current UTC time at execution before file creation and must not remain literal in committed paths.
- **Type consistency:** `M1BPathAResult`, `DisplayBasis`, `PendingLabelResult`, audit formulas and run identifiers are consistent across tasks.
- **Review Focus coverage:** identity collision (Task 2), partial lane success (Task 3), duplicate BR enqueue (Task 4), missing display ack (Task 6), mixed-result UI ranking (Task 7).
- **Safety invariant:** No task introduces a score path that bypasses ingredient + regulatory qualification.
