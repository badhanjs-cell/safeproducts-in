import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CANONICAL_ORIGIN = 'https://wmxbdirvlwuagouraobr.supabase.co';
const CORPUS_PATH = resolve(process.cwd(), 'tools/sp_us2/launch_prewarm_queries.json');
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const caseArg = [...args].find((arg) => arg.startsWith('--case='));
const selectedCase = caseArg ? caseArg.slice('--case='.length).trim() : null;

function fail(message) {
  console.error(`SP_US2_PREWARM_FAILED: ${message}`);
  process.exit(1);
}

function readCorpus() {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(CORPUS_PATH, 'utf8'));
  } catch {
    fail('launch_prewarm_queries.json is missing or invalid JSON');
  }
  if (parsed?.contract_version !== 'SP-US2-PREWARM/1.0' || !Array.isArray(parsed?.queries)) {
    fail('prewarm corpus contract is invalid');
  }
  const seen = new Set();
  for (const row of parsed.queries) {
    if (!row || typeof row !== 'object') fail('prewarm query must be an object');
    if (typeof row.case !== 'string' || !row.case.trim() || seen.has(row.case)) fail('prewarm case must be unique');
    seen.add(row.case);
    if (typeof row.query !== 'string' || !row.query.trim() || row.query.length > 200) fail(`invalid query for ${row.case}`);
    if (!['SPECIFIC_PRODUCT', 'CATEGORY'].includes(row.search_mode)) fail(`invalid mode for ${row.case}`);
    if (row.requested_pack_key !== null && row.requested_pack_key !== undefined && !/^\d+(?:\.\d+)?:(?:ml|g|count)$/.test(String(row.requested_pack_key))) {
      fail(`invalid requested pack for ${row.case}`);
    }
  }
  return parsed;
}

function canonicalBase() {
  const configured = (process.env.SP_US2_PREWARM_SUPABASE_URL ?? CANONICAL_ORIGIN).replace(/\/$/, '');
  let parsed;
  try { parsed = new URL(configured); } catch { fail('Supabase URL is invalid'); }
  if (parsed.origin !== CANONICAL_ORIGIN || parsed.pathname !== '/') {
    fail('non-canonical Supabase project blocked');
  }
  return CANONICAL_ORIGIN;
}

async function jsonResponse(response) {
  const text = await response.text();
  if (!text.trim()) return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function rpc(base, serverKey, name, body, timeoutMs = 5000) {
  const response = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: serverKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await jsonResponse(response);
  if (!response.ok) throw new Error(`${name}_${response.status}`);
  return data;
}

async function dispatch(base, serverKey) {
  const response = await fetch(`${base}/functions/v1/sp-us2-make-dispatch-v1`, {
    method: 'POST',
    headers: {
      apikey: serverKey,
      'x-us2-internal-key': serverKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: '{}',
    signal: AbortSignal.timeout(10000),
  });
  const data = await jsonResponse(response);
  if (!response.ok) throw new Error(`dispatcher_${response.status}_${data?.code ?? 'unknown'}`);
  return data;
}

async function requestState(base, serverKey, requestId) {
  const select = encodeURIComponent('id,status,attempt_count,max_attempts,last_error_code,result_summary,updated_at');
  const response = await fetch(`${base}/rest/v1/sp_us2_acquisition_request_v1?id=eq.${encodeURIComponent(requestId)}&select=${select}&limit=1`, {
    headers: { apikey: serverKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(4000),
  });
  const data = await jsonResponse(response);
  if (!response.ok || !Array.isArray(data)) throw new Error(`request_state_${response.status}`);
  return data[0] ?? null;
}

async function waitForTerminal(base, serverKey, requestId, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await requestState(base, serverKey, requestId);
    if (last && ['COMPLETED', 'FAILED'].includes(last.status)) return last;
    await new Promise((resolveWait) => setTimeout(resolveWait, 1000));
  }
  return last;
}

async function publicSearch(base, publishableKey, userJwt, row) {
  const response = await fetch(`${base}/functions/v1/sp-us2-search-v2`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${userJwt}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query: row.query, profile: 'all', limit: 10, foreground_deadline_ms: 25000 }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await jsonResponse(response);
  if (!response.ok) throw new Error(`search_v2_${response.status}_${data?.code ?? 'unknown'}`);
  return data;
}

function searchSummary(data) {
  const products = Array.isArray(data?.products) ? data.products : [];
  return {
    contract_version: data?.contract_version ?? null,
    status: data?.status ?? null,
    search_mode: data?.search_mode ?? null,
    selected_pack: data?.selected_pack?.normalized_key ?? null,
    product_count: products.length,
    exact_offer_count: products.filter((row) => row?.result_group === 'EXACT_OFFER').length,
    alternative_count: products.filter((row) => row?.result_group === 'ALTERNATIVE').length,
    category_product_count: products.filter((row) => row?.result_group === 'CATEGORY_PRODUCT').length,
    safety_qualified_count: Number(data?.safety_qualified_count ?? 0),
    best_choice_present: Boolean(data?.best_value_product),
  };
}

const corpus = readCorpus();
const rows = selectedCase ? corpus.queries.filter((row) => row.case === selectedCase) : corpus.queries;
if (!rows.length) fail(`unknown --case=${selectedCase}`);

if (dryRun) {
  console.log(JSON.stringify({
    success: true,
    dry_run: true,
    canonical_origin: CANONICAL_ORIGIN,
    contract_version: corpus.contract_version,
    cases: rows.map((row) => ({
      case: row.case,
      search_mode: row.search_mode,
      query: row.query,
      requested_pack_key: row.requested_pack_key ?? null,
      target_exact_offers: row.target_exact_offers,
      target_alternatives: row.target_alternatives,
    })),
  }, null, 2));
  process.exit(0);
}

const base = canonicalBase();
const serverKey = process.env.SP_US2_PREWARM_SERVER_KEY ?? '';
const publishableKey = process.env.SP_US2_PREWARM_PUBLISHABLE_KEY ?? '';
const userJwt = process.env.SP_US2_PREWARM_USER_JWT ?? '';
if (!serverKey || !publishableKey || !userJwt) {
  fail('live mode requires server key, publishable key, and authenticated user JWT environment values');
}

const outputs = [];
for (const row of rows) {
  const enqueue = await rpc(base, serverKey, 'sp_us2_enqueue_acquisition_v1', {
    p_query: row.query,
    p_search_mode: row.search_mode,
    p_anchor_product_id: row.anchor_product_id ?? null,
    p_requested_pack_key: row.requested_pack_key ?? null,
    p_category: row.category ?? null,
    p_target_exact_offers: row.target_exact_offers ?? (row.search_mode === 'SPECIFIC_PRODUCT' ? 5 : 0),
    p_target_alternatives: row.target_alternatives ?? (row.search_mode === 'SPECIFIC_PRODUCT' ? 5 : 10),
    p_payload: { source: 'LAUNCH_PREWARM', case: row.case },
  });

  let delivery = null;
  let request = null;
  if (enqueue?.allowed === true && enqueue?.request_id) {
    delivery = await dispatch(base, serverKey);
    request = await waitForTerminal(base, serverKey, enqueue.request_id);
  } else if (enqueue?.request_id) {
    request = await requestState(base, serverKey, enqueue.request_id).catch(() => null);
  }

  const search = await publicSearch(base, publishableKey, userJwt, row);
  outputs.push({
    case: row.case,
    enqueue: {
      allowed: enqueue?.allowed === true,
      reason: enqueue?.reason ?? null,
      request_id: enqueue?.request_id ?? null,
    },
    dispatch_status: delivery?.status ?? null,
    acquisition_status: request?.status ?? null,
    acquisition_error: request?.last_error_code ?? null,
    search: searchSummary(search),
  });
}

console.log(JSON.stringify({ success: true, dry_run: false, results: outputs }, null, 2));
