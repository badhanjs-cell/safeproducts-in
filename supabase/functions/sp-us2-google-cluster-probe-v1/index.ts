import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Obj = Record<string, any>;

const WORKER_CODE = "US2_GOOGLE_CLUSTER_PROBE";

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

function serverKey() {
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
  throw new Error("SERVER_KEY_UNAVAILABLE");
}

function restHeaders(key: string) {
  const headers: Record<string, string> = {
    apikey: key,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text.trim()) return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function rpc(base: string, key: string, name: string, body: Obj, timeout = 2500) {
  const response = await fetch(`${base.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: restHeaders(key),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  return { ok: response.ok, status: response.status, data: await parseResponse(response) };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ success: false, code: "METHOD_NOT_ALLOWED" }, 405);

  const base = Deno.env.get("SUPABASE_URL") ?? "";
  if (!base) return json({ success: false, code: "SERVER_CONFIGURATION_MISSING" }, 503);

  let key: string;
  try { key = serverKey(); } catch { return json({ success: false, code: "SERVER_CONFIGURATION_MISSING" }, 503); }

  const workerToken = req.headers.get("x-sp-worker-token") ?? "";
  const auth = await rpc(base, key, "sp_internal_worker_token_valid_v1", {
    p_worker_code: WORKER_CODE,
    p_token: workerToken,
  }).catch(() => ({ ok: false, status: 0, data: false }));
  if (!auth.ok || auth.data !== true) return json({ success: false, code: "INTERNAL_AUTH_REQUIRED" }, 401);

  const response = await fetch(`${base.replace(/\/$/, "")}/functions/v1/sp-us2-google-cluster-v1`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-us2-internal-key": key,
    },
    body: JSON.stringify({
      query: "nivea men deep comfort after shave lotion 100 ml",
      anchor_product: {
        canonical_product_id: "0b479259-06ab-4c7c-ab09-98011f1d544e",
        brand_name: "NIVEA MEN",
        product_name: "Deep Comfort After Shave Lotion",
        pack_normalized_key: "100:ml",
      },
      requested_pack_key: "100:ml",
      target_exact_offers: 4,
    }),
    signal: AbortSignal.timeout(12000),
  });

  const data = await parseResponse(response);
  return json({
    success: response.ok,
    probe: "NIVEA_MEN_DEEP_COMFORT_100ML",
    upstream_status: response.status,
    result: data,
  }, response.ok ? 200 : 502);
});
