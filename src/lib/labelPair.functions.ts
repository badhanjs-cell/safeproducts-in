import { createServerFn, SAFEPRODUCTS_RUNTIME_ENV } from "./clientServerFn";
import { z } from "zod";
import { assertCanonicalSupabaseUrl, assertPublishableKey } from "@/lib/backendIdentity";

const imageDataUrlSchema = z
  .string()
  .min(20)
  .max(15_000_000)
  .regex(/^data:image\/(png|jpe?g|webp);base64,/i, "Must be a supported base64-encoded image data URL");

const inputSchema = z.object({
  frontImageDataUrl: imageDataUrlSchema,
  ingredientImageDataUrl: imageDataUrlSchema,
  sessionId: z.string().min(1).max(100),
  accessToken: z.string().min(20).max(8192),
});

const issueCodes = [
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
] as const;

type IssueCode = (typeof issueCodes)[number];

export type LabelPairEligibility = {
  eligible: boolean;
  front_label_ok: boolean;
  ingredient_panel_ok: boolean;
  same_product: boolean;
  duplicate_view: boolean;
  brand_name: string;
  product_name: string;
  variant: string;
  pack_size_text: string;
  front_issue: IssueCode;
  ingredient_issue: IssueCode;
  same_product_issue: IssueCode;
};

export type LabelPairValidationResult = {
  success: true;
  eligibility: LabelPairEligibility;
  user_message: string;
  validator_version: string;
};

function isIssueCode(value: unknown): value is IssueCode {
  return typeof value === "string" && (issueCodes as readonly string[]).includes(value);
}

function isEligibility(value: unknown): value is LabelPairEligibility {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.eligible === "boolean" &&
    typeof v.front_label_ok === "boolean" &&
    typeof v.ingredient_panel_ok === "boolean" &&
    typeof v.same_product === "boolean" &&
    typeof v.duplicate_view === "boolean" &&
    typeof v.brand_name === "string" &&
    typeof v.product_name === "string" &&
    typeof v.variant === "string" &&
    typeof v.pack_size_text === "string" &&
    isIssueCode(v.front_issue) &&
    isIssueCode(v.ingredient_issue) &&
    isIssueCode(v.same_product_issue)
  );
}

function userMessageFromPayload(payload: Record<string, unknown>): string {
  if (typeof payload.user_message === "string" && payload.user_message.trim()) {
    return payload.user_message.trim();
  }
  return "The two images did not pass the label eligibility check. Please retake the requested photos.";
}

export const validateLabelPair = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<LabelPairValidationResult> => {
    const supabaseUrl = assertCanonicalSupabaseUrl(SAFEPRODUCTS_RUNTIME_ENV.SUPABASE_URL, "SUPABASE_URL");
    const publishableKey = assertPublishableKey(SAFEPRODUCTS_RUNTIME_ENV.SUPABASE_PUBLISHABLE_KEY, "SUPABASE_PUBLISHABLE_KEY");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35_000);

    let response: Response;
    try {
      response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/sp-label-pair-validate-v1`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.accessToken}`,
          apikey: publishableKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          frontImageDataUrl: data.frontImageDataUrl,
          ingredientImageDataUrl: data.ingredientImageDataUrl,
          sessionId: data.sessionId,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Image eligibility check timed out. Please try again with clear photos.");
      }
      throw new Error("Image eligibility check is temporarily unavailable. Please try again.");
    } finally {
      clearTimeout(timeout);
    }

    const raw = await response.text();
    let payload: Record<string, unknown> = {};
    if (raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed;
      } catch {
        payload = {};
      }
    }

    if (response.status === 401) {
      throw new Error("Your temporary safety session expired. Please try again.");
    }
    if (response.status === 429) {
      throw new Error("Too many image checks. Please wait a while and try again.");
    }
    if (response.status === 422) {
      throw new Error(userMessageFromPayload(payload));
    }
    if (!response.ok) {
      throw new Error("The two images could not be validated. Please try again with clearer photos.");
    }

    const eligibility = payload.eligibility;
    if (payload.success !== true || !isEligibility(eligibility) || eligibility.eligible !== true) {
      throw new Error(userMessageFromPayload(payload));
    }

    return {
      success: true,
      eligibility,
      user_message: userMessageFromPayload(payload),
      validator_version: typeof payload.validator_version === "string" ? payload.validator_version : "UNKNOWN",
    };
  });
