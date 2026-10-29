import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const FUNCTION_VERSION = "SP-LABEL-PAIR-VALIDATOR/1.3";
const DEFAULT_MODEL = "gpt-5.6-luna";
const MAX_IMAGE_DATA_URL = 14_500_000;
const ISSUE_CODES = new Set([
  "NONE",
  "IMAGE_UNUSABLE",
  "WRONG_ROLE",
  "FRONT_NOT_PRODUCT",
  "BRAND_NOT_LEGIBLE",
  "PRODUCT_NAME_NOT_LEGIBLE",
  "INGREDIENT_PANEL_NOT_FOUND",
  "INGREDIENTS_NOT_LEGIBLE",
  "DIFFERENT_PRODUCTS",
  "CANNOT_CONFIRM_SAME_PRODUCT",
  "DUPLICATE_VIEW",
]);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function getAdminKey(): string {
  const preferred = Deno.env.get("SP_LABEL_ADMIN_KEY_NAME") ?? "default";
  const mapRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (mapRaw) {
    try {
      const map = JSON.parse(mapRaw) as Record<string, string>;
      const selected = map[preferred] ?? map.default ?? Object.values(map)[0];
      if (selected?.trim()) return selected;
    } catch {
      // Fall through to the legacy server key.
    }
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy?.trim()) return legacy;
  throw new Error("SUPABASE_SERVER_KEY_UNAVAILABLE");
}

function adminHeaders(key: string): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: key,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function rpc(
  url: string,
  key: string,
  name: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: any }> {
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: adminHeaders(key),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  let data: any = null;
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { ok: response.ok, status: response.status, data };
}

function decodeJwtSubject(request: Request): string | null {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

function extractOutputText(response: any): string | null {
  if (!Array.isArray(response?.output)) return null;
  for (const item of response.output) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part?.type === "output_text" && typeof part.text === "string" && part.text.trim()) {
        return part.text;
      }
    }
  }
  return null;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function isImageDataUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 20 &&
    value.length <= MAX_IMAGE_DATA_URL &&
    /^data:image\/(png|jpe?g|webp);base64,/i.test(value)
  );
}

function validateModelResult(value: any): boolean {
  return (
    value &&
    typeof value === "object" &&
    typeof value.front_label_ok === "boolean" &&
    typeof value.ingredient_panel_ok === "boolean" &&
    typeof value.same_product === "boolean" &&
    typeof value.duplicate_view === "boolean" &&
    typeof value.brand_name === "string" &&
    typeof value.product_name === "string" &&
    typeof value.variant === "string" &&
    typeof value.pack_size_text === "string" &&
    typeof value.front_issue === "string" &&
    ISSUE_CODES.has(value.front_issue) &&
    typeof value.ingredient_issue === "string" &&
    ISSUE_CODES.has(value.ingredient_issue) &&
    typeof value.same_product_issue === "string" &&
    ISSUE_CODES.has(value.same_product_issue)
  );
}

function issueMessage(result: any): string {
  if (result.duplicate_view || result.same_product_issue === "DUPLICATE_VIEW") {
    return "Please use two different photos: one product/front photo and one ingredient/composition photo.";
  }
  if (!result.front_label_ok) {
    if (result.front_issue === "BRAND_NOT_LEGIBLE") {
      return "The brand cannot be read from the product photo. Please use any photo where the brand is readable.";
    }
    if (result.front_issue === "PRODUCT_NAME_NOT_LEGIBLE") {
      return "The product cannot be identified from the first photo. Please use any readable product photo.";
    }
    if (result.front_issue === "WRONG_ROLE" || result.front_issue === "FRONT_NOT_PRODUCT") {
      return "The first image should show the product/package so its brand or product identity can be read.";
    }
    return "The first image is genuinely unreadable. Please try another photo where the product identity can be read.";
  }
  if (!result.ingredient_panel_ok) {
    if (result.ingredient_issue === "INGREDIENT_PANEL_NOT_FOUND" || result.ingredient_issue === "WRONG_ROLE") {
      return "The second image should show ingredient, composition or INCI text.";
    }
    if (result.ingredient_issue === "INGREDIENTS_NOT_LEGIBLE") {
      return "The ingredient/composition text is genuinely unreadable. Please try another photo where ingredient names can be read.";
    }
    return "The ingredient/composition image is genuinely unreadable. Please try another readable photo.";
  }
  if (!result.same_product) {
    if (result.same_product_issue === "DIFFERENT_PRODUCTS") {
      return "The two photos clearly appear to be different products. Please use photos of the same product.";
    }
    return "The two photos could not be matched because they contain conflicting product information.";
  }
  return "The images could not be accepted. Please use a readable product image and a readable ingredient/composition image.";
}

Deno.serve(async (request: Request): Promise<Response> => {
  const requestId = crypto.randomUUID();
  if (request.method !== "POST") {
    return jsonResponse({ success: false, code: "METHOD_NOT_ALLOWED", request_id: requestId }, 405);
  }

  const userId = decodeJwtSubject(request);
  if (!userId) {
    return jsonResponse({ success: false, code: "AUTH_SUBJECT_REQUIRED", request_id: requestId }, 401);
  }

  const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!openaiKey.trim()) {
    return jsonResponse({ success: false, code: "OPENAI_NOT_CONFIGURED", request_id: requestId }, 503);
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ success: false, code: "INVALID_JSON", request_id: requestId }, 400);
  }

  const frontImageDataUrl = payload?.frontImageDataUrl;
  const ingredientImageDataUrl = payload?.ingredientImageDataUrl;
  const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId : "";

  if (
    !isImageDataUrl(frontImageDataUrl) ||
    !isImageDataUrl(ingredientImageDataUrl) ||
    sessionId.length < 1 ||
    sessionId.length > 100
  ) {
    return jsonResponse({ success: false, code: "INVALID_LABEL_PAIR_PAYLOAD", request_id: requestId }, 400);
  }

  const [frontHash, ingredientHash] = await Promise.all([
    sha256Hex(frontImageDataUrl),
    sha256Hex(ingredientImageDataUrl),
  ]);

  if (frontHash === ingredientHash) {
    const eligibility = {
      eligible: false,
      front_label_ok: false,
      ingredient_panel_ok: false,
      same_product: false,
      duplicate_view: true,
      brand_name: "",
      product_name: "",
      variant: "",
      pack_size_text: "",
      front_issue: "DUPLICATE_VIEW",
      ingredient_issue: "DUPLICATE_VIEW",
      same_product_issue: "DUPLICATE_VIEW",
    };
    return jsonResponse(
      {
        success: false,
        code: "DUPLICATE_IMAGES",
        eligibility,
        user_message: issueMessage(eligibility),
        validator_version: FUNCTION_VERSION,
        request_id: requestId,
      },
      422,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (!supabaseUrl) {
    return jsonResponse({ success: false, code: "SUPABASE_URL_UNAVAILABLE", request_id: requestId }, 500);
  }

  let adminKey: string;
  try {
    adminKey = getAdminKey();
  } catch {
    return jsonResponse({ success: false, code: "SUPABASE_SERVER_KEY_UNAVAILABLE", request_id: requestId }, 500);
  }

  const slot = await rpc(supabaseUrl, adminKey, "sp_web_claim_label_pair_slot_v1", {
    p_user_id: userId,
    p_limit: 5,
    p_window_seconds: 3600,
  });
  if (!slot.ok) {
    return jsonResponse({ success: false, code: "PAIR_RATE_LIMIT_CHECK_FAILED", request_id: requestId }, 503);
  }
  if (slot.data?.allowed !== true) {
    return jsonResponse(
      {
        success: false,
        code: "PAIR_RATE_LIMITED",
        retry_after_seconds: Number(slot.data?.retry_after_seconds ?? 3600),
        request_id: requestId,
      },
      429,
    );
  }

  const issueEnum = [
    "NONE",
    "IMAGE_UNUSABLE",
    "WRONG_ROLE",
    "FRONT_NOT_PRODUCT",
    "BRAND_NOT_LEGIBLE",
    "PRODUCT_NAME_NOT_LEGIBLE",
    "INGREDIENT_PANEL_NOT_FOUND",
    "INGREDIENTS_NOT_LEGIBLE",
    "DIFFERENT_PRODUCTS",
    "CANNOT_CONFIRM_SAME_PRODUCT",
    "DUPLICATE_VIEW",
  ];

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      front_label_ok: { type: "boolean" },
      ingredient_panel_ok: { type: "boolean" },
      same_product: { type: "boolean" },
      duplicate_view: { type: "boolean" },
      brand_name: { type: "string" },
      product_name: { type: "string" },
      variant: { type: "string" },
      pack_size_text: { type: "string" },
      front_issue: { type: "string", enum: issueEnum },
      ingredient_issue: { type: "string", enum: issueEnum },
      same_product_issue: { type: "string", enum: issueEnum },
    },
    required: [
      "front_label_ok",
      "ingredient_panel_ok",
      "same_product",
      "duplicate_view",
      "brand_name",
      "product_name",
      "variant",
      "pack_size_text",
      "front_issue",
      "ingredient_issue",
      "same_product_issue",
    ],
  };

  const prompt = `You are the SafeProducts READABILITY + FRONT-IDENTITY GATE. Your job is not to judge photographic quality. Your job is to decide whether the useful text can be read and to extract visible front-label identity fields.

CORE RULE: ACCEPT ordinary user photos whenever the required information is readable enough to attempt extraction. Do not reject because of low pixel dimensions, narrow crops, moderate blur, glare, shadows, perspective, curved bottles/tubes, wrinkles, reflections, background clutter, phone compression, messaging-app compression, non-centred framing, visible package wear, multilingual text, or small text if the useful text is still readable.

IMAGE 1 — PRODUCT / FRONT IMAGE:
- Accept if a real product/package is visible and the brand name OR unmistakable product identity can reasonably be read.
- Extract brand_name, product_name and variant conservatively from visible text.
- Also extract pack_size_text when a consumer pack/net quantity or pack count is clearly visible. Examples: "100 g", "100 ml", "60 capsules", "30 tablets", "10 sachets", "1 L".
- pack_size_text is OPTIONAL for eligibility. If it is cropped, hidden, ambiguous, or not clearly readable, return an empty string. NEVER reject the photo because pack size is missing.
- Distinguish pack size from ingredient strength/dose. Example: if a supplement says "600 mg" for ingredient strength and "60 Capsules" for the pack, return "60 Capsules", not "600 mg".
- Do not put pack size inside product_name or variant when it can be returned separately.
- The whole front panel does not need to be visible.
- Product claims, batch, price, instructions and decorative areas are irrelevant.
- Do not require every character of the product name to be sharp.
- Reject only when the product identity is genuinely unreadable, the image is not a product/package, or it is clearly the wrong role.

IMAGE 2 — INGREDIENT / COMPOSITION IMAGE:
- Accept if ingredient/composition/INCI/supplement composition text is present and ingredient names can reasonably be read for downstream extraction.
- It does not need to show the brand or product name.
- It does not need to show price, batch number, manufacturer, warnings, instructions, barcode or the whole package.
- It does not need to contain the complete panel within a perfect rectangle.
- A readable crop of the ingredient area is valid.
- Reject only when no ingredient/composition text is present or the ingredient names are genuinely unreadable.

SAME-PRODUCT RULE:
- Do not require IMAGE 2 to prove identity again.
- If IMAGE 1 identifies the product and IMAGE 2 is a plausible ingredient panel with no visible contradiction, set same_product=true.
- Set DIFFERENT_PRODUCTS only when there is positive visible evidence of a different brand/product/package.
- Do not reject merely because IMAGE 2 is tightly cropped around ingredients.

DUPLICATE RULE:
- Exact duplicate or near-identical copies of the same view are invalid.
- Different views of the same package are valid.

IMPORTANT: Eligibility is only permission to attempt ingredient extraction. Do not reject because you are uncertain whether every ingredient can be extracted perfectly. Downstream extraction/confidence handles completeness and uncertainty.

If the useful text is readable, ACCEPT. Do not perform safety scoring and do not invent hidden text.`;

  let aiResponse: Response;
  try {
    aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("SP_LABEL_OPENAI_MODEL") ?? DEFAULT_MODEL,
        store: false,
        max_output_tokens: 750,
        safety_identifier: `sp_label_pair_${userId}`,
        input: [
          { role: "system", content: [{ type: "input_text", text: prompt }] },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Check readability and roles. From IMAGE 1 also return visible brand, product, variant and pack size. Pack size may be empty and must never affect eligibility. IMAGE 2 should contain readable ingredient/composition text.",
              },
              { type: "input_image", image_url: frontImageDataUrl, detail: "high" },
              { type: "input_image", image_url: ingredientImageDataUrl, detail: "high" },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "safeproducts_label_pair_eligibility",
            strict: true,
            schema,
          },
        },
      }),
      signal: AbortSignal.timeout(28_000),
    });
  } catch (error) {
    console.error("pair validator transport error", requestId, error instanceof Error ? error.message : String(error));
    return jsonResponse({ success: false, code: "PAIR_AI_TRANSPORT_FAILED", request_id: requestId }, 504);
  }

  const rawAi = await aiResponse.text();
  if (!aiResponse.ok) {
    console.error("pair validator AI error", requestId, aiResponse.status, rawAi.slice(0, 500));
    return jsonResponse(
      {
        success: false,
        code: aiResponse.status === 429 ? "PAIR_AI_RATE_LIMITED" : "PAIR_AI_FAILED",
        request_id: requestId,
      },
      aiResponse.status === 429 ? 429 : 502,
    );
  }

  let aiJson: any;
  try {
    aiJson = JSON.parse(rawAi);
  } catch {
    return jsonResponse({ success: false, code: "PAIR_AI_RESPONSE_INVALID", request_id: requestId }, 502);
  }

  const outputText = extractOutputText(aiJson);
  if (!outputText) {
    return jsonResponse({ success: false, code: "PAIR_AI_RESPONSE_EMPTY", request_id: requestId }, 502);
  }

  let result: any;
  try {
    result = JSON.parse(outputText);
  } catch {
    return jsonResponse({ success: false, code: "PAIR_AI_STRUCTURED_OUTPUT_INVALID", request_id: requestId }, 502);
  }

  if (!validateModelResult(result)) {
    return jsonResponse({ success: false, code: "PAIR_AI_STRUCTURED_OUTPUT_REJECTED", request_id: requestId }, 502);
  }

  const eligible = Boolean(
    result.front_label_ok &&
      result.ingredient_panel_ok &&
      result.same_product &&
      !result.duplicate_view &&
      result.front_issue === "NONE" &&
      result.ingredient_issue === "NONE" &&
      result.same_product_issue === "NONE",
  );

  const eligibility = {
    eligible,
    front_label_ok: result.front_label_ok,
    ingredient_panel_ok: result.ingredient_panel_ok,
    same_product: result.same_product,
    duplicate_view: result.duplicate_view,
    brand_name: result.brand_name.trim().slice(0, 200),
    product_name: result.product_name.trim().slice(0, 300),
    variant: result.variant.trim().slice(0, 200),
    pack_size_text: result.pack_size_text.trim().slice(0, 120),
    front_issue: result.front_issue,
    ingredient_issue: result.ingredient_issue,
    same_product_issue: result.same_product_issue,
  };

  return jsonResponse(
    {
      success: eligible,
      code: eligible ? "IMAGE_PAIR_ELIGIBLE" : "IMAGE_PAIR_INELIGIBLE",
      eligibility,
      user_message: eligible
        ? "Both images are readable enough for ingredient and safety analysis."
        : issueMessage(eligibility),
      validator_version: FUNCTION_VERSION,
      request_id: requestId,
    },
    eligible ? 200 : 422,
  );
});