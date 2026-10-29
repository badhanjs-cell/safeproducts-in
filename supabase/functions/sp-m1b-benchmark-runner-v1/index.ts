import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const WORKER_CODE = "M1B_BENCHMARK_EXECUTOR";
type Obj = Record<string, any>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function adminKey() {
  const preferred = Deno.env.get("SP_LABEL_ADMIN_KEY_NAME") ?? "default";
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const map = JSON.parse(raw);
      const value = map[preferred] ?? map.default ?? Object.values(map)[0];
      if (typeof value === "string" && value.trim()) return value;
    } catch { /* fall through */ }
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy?.trim()) return legacy;
  throw new Error("SUPABASE_SERVER_KEY_UNAVAILABLE");
}

function headers(key: string) {
  const h: Record<string, string> = { apikey: key, "Content-Type": "application/json", Accept: "application/json" };
  if (!key.startsWith("sb_secret_")) h.Authorization = `Bearer ${key}`;
  return h;
}

async function rpc(base: string, key: string, name: string, body: Obj, timeout = 15000) {
  const response = await fetch(`${base.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: headers(key),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const text = await response.text();
  let data: any = null;
  if (text.trim()) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  return { ok: response.ok, status: response.status, data };
}

async function pathA(base: string, key: string, payload: Obj) {
  const response = await fetch(`${base.replace(/\/$/, "")}/functions/v1/sp-m1b-path-a-v1`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-m1b-internal-key": key },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(35000),
  });
  const text = await response.text();
  let data: any = null;
  if (text.trim()) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  return { ok: response.ok, status: response.status, data };
}

function parseIdentity(item: Obj) {
  const parts = String(item.identity_summary ?? "").split("|").map((x) => x.trim()).filter(Boolean);
  const market = parts.length >= 3 ? parts.at(-1) : "IN";
  const pack = parts.length >= 3 ? parts.at(-2) : undefined;
  const variant = parts.length >= 5 ? parts[2] : undefined;
  const product = parts.length >= 2 ? parts[1] : String(item.candidate_product_name ?? "");
  return {
    brand_name: String(item.candidate_brand_name ?? parts[0] ?? "").trim(),
    product_name: product.trim(),
    ...(variant ? { variant } : {}),
    ...(pack ? { pack_size_text: pack } : {}),
    market_country_code: market === "IN" ? "IN" : "IN",
  };
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  if (req.method !== "POST") return json({ success: false, code: "METHOD_NOT_ALLOWED", request_id: requestId }, 405);

  let key: string;
  try { key = adminKey(); } catch {
    return json({ success: false, code: "SUPABASE_SERVER_KEY_UNAVAILABLE", request_id: requestId }, 500);
  }
  const base = Deno.env.get("SUPABASE_URL") ?? "";
  if (!base) return json({ success: false, code: "SUPABASE_URL_MISSING", request_id: requestId }, 500);

  const token = req.headers.get("x-sp-worker-token") ?? "";
  const valid = await rpc(base, key, "sp_internal_worker_token_valid_v1", { p_worker_code: WORKER_CODE, p_token: token });
  if (!valid.ok || valid.data !== true) return json({ success: false, code: "WORKER_AUTH_REQUIRED", request_id: requestId }, 401);

  // Reconcile any asynchronous recovery that finished since the previous dispatch.
  await rpc(base, key, "sp_m1b_reconcile_benchmark_execution_v1", { p_execution_batch_id: null }).catch(() => null);

  const claimed = await rpc(base, key, "sp_m1b_claim_benchmark_execution_item_v1", { p_worker_code: WORKER_CODE });
  if (!claimed.ok || claimed.data?.success !== true) {
    return json({ success: false, code: "BENCHMARK_CLAIM_FAILED", detail: claimed.data, request_id: requestId }, 500);
  }
  const item = claimed.data?.item;
  if (!item) return json({ success: true, idle: true, request_id: requestId });

  try {
    const identity = parseIdentity(item);
    if (!identity.brand_name || !identity.product_name) throw new Error("BENCHMARK_IDENTITY_INVALID");

    const sessionKey = crypto.randomUUID();
    const begun = await rpc(base, key, "sp_m1b_begin_run_v1", {
      p_context: "BENCHMARK",
      p_product_id: null,
      p_product_fingerprint: item.product_fingerprint,
      p_benchmark_slot_id: item.benchmark_slot_id,
      p_session_key: sessionKey,
    });
    if (!begun.ok || begun.data?.success !== true || !begun.data?.run_id) throw new Error("BENCHMARK_RUN_BEGIN_FAILED");
    const runId = begun.data.run_id;

    const result = await pathA(base, key, {
      run_id: runId,
      product_id: null,
      query: `${identity.brand_name} ${identity.product_name}`,
      identity,
      foreground_budget_ms: 25000,
      benchmark_mode: true,
    });
    if (!result.ok || result.data?.success !== true) throw new Error(`PATH_A_HTTP_${result.status}`);

    const recorded = await rpc(base, key, "sp_m1b_record_benchmark_path_a_v1", {
      p_item_id: item.item_id,
      p_run_id: runId,
      p_result: result.data,
    });
    if (!recorded.ok || recorded.data?.success !== true) throw new Error("BENCHMARK_PATH_A_RECORD_FAILED");

    let recoveryDispatch: any = null;
    if (recorded.data?.status === "WAITING_M1BR") {
      recoveryDispatch = await rpc(base, key, "sp_m1b_dispatch_benchmark_recovery_v1", {});
    }
    await rpc(base, key, "sp_m1b_reconcile_benchmark_execution_v1", { p_execution_batch_id: item.execution_batch_id }).catch(() => null);

    return json({
      success: true,
      item_id: item.item_id,
      execution_batch_id: item.execution_batch_id,
      benchmark_slot_id: item.benchmark_slot_id,
      m1b_status: recorded.data?.m1b_status ?? null,
      m1br_status: recorded.data?.m1br_status ?? null,
      recovery_dispatched: recoveryDispatch?.ok === true,
      request_id: requestId,
    });
  } catch (error) {
    await rpc(base, key, "sp_m1b_fail_benchmark_execution_item_v1", {
      p_item_id: item.item_id,
      p_error_code: error instanceof Error ? error.message : "BENCHMARK_EXECUTION_FAILED",
    }).catch(() => null);
    return json({
      success: false,
      code: "BENCHMARK_ITEM_EXECUTION_FAILED",
      item_id: item.item_id,
      detail: error instanceof Error ? error.message : String(error),
      request_id: requestId,
    }, 500);
  }
});
