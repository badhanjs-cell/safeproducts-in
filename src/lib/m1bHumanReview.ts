export type HumanReviewChoice = "APPROVE" | "CORRECT" | "REJECT";

export type HumanReviewDraft = {
  identity_decision: HumanReviewChoice | null;
  ingredient_declaration_decision: HumanReviewChoice | null;
  correction_note: string;
};

export type HumanReviewEvidenceSource = {
  source_kind?: string | null;
  source_url?: string | null;
  authoritative?: boolean;
  trusted_structured?: boolean;
  reconciled_pack_formula?: boolean;
  requires_human_authority_judgment?: boolean;
  evidence_text_sha256?: string | null;
  provenance_note?: string | null;
  [key: string]: unknown;
};

export type HumanReviewRejectedEvidence = {
  source_kind?: string | null;
  source_url?: string | null;
  conflict_code?: string | null;
  conflict_detail?: string | null;
  [key: string]: unknown;
};

export type HumanReviewPacket = {
  candidate_id: string;
  benchmark_category?: string | null;
  candidate_brand_name?: string | null;
  candidate_product_name?: string | null;
  identity_summary?: string | null;
  product_fingerprint?: string | null;
  curation_status?: string | null;
  gold_status?: string | null;
  human_adjudication_required?: boolean;
  identity_source_urls?: string[];
  ingredient_declaration?: string | null;
  ingredient_count?: number | null;
  evidence_sources?: HumanReviewEvidenceSource[];
  rejected_evidence?: HumanReviewRejectedEvidence[];
  rejected_evidence_count?: number;
  review_note?: string | null;
  evidence_gap_reason?: string | null;
  do_not_adjudicate_gold?: boolean;
};

export type HumanReviewPacketSet = {
  ready_packets: HumanReviewPacket[];
  blocked_packets: HumanReviewPacket[];
};

export type HumanReviewEvaluation = {
  complete: boolean;
  errors: string[];
  decision_status: "HUMAN_APPROVED_FOR_GOLD_STAGING" | "HUMAN_CORRECTION_REQUIRED" | "HUMAN_REJECTED" | null;
  gold_status: "UNASSIGNED";
  promotion_allowed: false;
};

const CHOICES = new Set<HumanReviewChoice>(["APPROVE", "CORRECT", "REJECT"]);

export function evaluateDecisionDraft(draft: HumanReviewDraft): HumanReviewEvaluation {
  const errors: string[] = [];
  const identity = draft.identity_decision;
  const ingredients = draft.ingredient_declaration_decision;
  const note = String(draft.correction_note || "").trim();

  if (!identity || !CHOICES.has(identity)) errors.push("IDENTITY_DECISION_REQUIRED");
  if (!ingredients || !CHOICES.has(ingredients)) errors.push("INGREDIENT_DECLARATION_DECISION_REQUIRED");
  if ((identity === "CORRECT" || ingredients === "CORRECT") && !note) {
    errors.push("CORRECTION_NOTE_REQUIRED");
  }

  let decision_status: HumanReviewEvaluation["decision_status"] = null;
  if (errors.length === 0) {
    if (identity === "REJECT" || ingredients === "REJECT") decision_status = "HUMAN_REJECTED";
    else if (identity === "CORRECT" || ingredients === "CORRECT") decision_status = "HUMAN_CORRECTION_REQUIRED";
    else decision_status = "HUMAN_APPROVED_FOR_GOLD_STAGING";
  }

  return {
    complete: errors.length === 0,
    errors,
    decision_status,
    gold_status: "UNASSIGNED",
    promotion_allowed: false,
  };
}

function isReady(packet: HumanReviewPacket): boolean {
  return packet.curation_status === "READY_FOR_HUMAN_ADJUDICATION" && packet.do_not_adjudicate_gold !== true;
}

export function mergeReviewPackets(
  snapshot: HumanReviewPacketSet,
  livePackets: HumanReviewPacket[],
): HumanReviewPacketSet {
  const ready = new Map<string, HumanReviewPacket>();
  const blocked = new Map<string, HumanReviewPacket>();

  for (const packet of snapshot.ready_packets || []) ready.set(packet.candidate_id, packet);
  for (const packet of snapshot.blocked_packets || []) blocked.set(packet.candidate_id, packet);

  for (const packet of livePackets || []) {
    const id = String(packet?.candidate_id || "").trim();
    if (!id) continue;
    ready.delete(id);
    blocked.delete(id);
    if (isReady(packet)) ready.set(id, packet);
    else blocked.set(id, { ...packet, do_not_adjudicate_gold: true });
  }

  return { ready_packets: [...ready.values()], blocked_packets: [...blocked.values()] };
}

export function packetFromSourceContext(value: unknown): HumanReviewPacket | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const context = value as Record<string, unknown>;
  const nested = context.human_review_packet ?? context.reviewer_packet ?? context.packet;
  const raw = nested && typeof nested === "object" && !Array.isArray(nested)
    ? nested as Record<string, unknown>
    : context;
  const candidateId = String(raw.candidate_id || "").trim();
  if (!candidateId) return null;
  return raw as HumanReviewPacket;
}

export function buildHumanReviewSubmission(
  packets: HumanReviewPacket[],
  drafts: Record<string, HumanReviewDraft>,
  reviewerId: string,
  reviewedAt: string,
) {
  const decisions = packets.flatMap((packet) => {
    const draft = drafts[packet.candidate_id];
    if (!draft) return [];
    const evaluation = evaluateDecisionDraft(draft);
    if (!evaluation.complete) return [];
    return [{
      candidate_id: packet.candidate_id,
      identity_decision: draft.identity_decision,
      ingredient_declaration_decision: draft.ingredient_declaration_decision,
      correction_note: String(draft.correction_note || "").trim(),
      decision_status: evaluation.decision_status,
      reviewer_id: reviewerId.trim(),
      reviewed_at: reviewedAt,
      gold_status: "UNASSIGNED" as const,
    }];
  });

  return {
    schema_version: "1.0.0",
    split: "DEV",
    reviewer_id: reviewerId.trim(),
    reviewed_at: reviewedAt,
    accepted_decision_count: decisions.length,
    pending_human_decision_count: Math.max(packets.length - decisions.length, 0),
    gold_status: "UNASSIGNED" as const,
    promotion_allowed: false as const,
    human_adjudication_required: true,
    decisions,
  };
}

export type IngredientRecoverySourceKind =
  | "OFFICIAL_BRAND"
  | "OFFICIAL_FIRST_PARTY_RETAIL"
  | "TRUSTED_STRUCTURED_SOURCE"
  | "MANUAL_WEB_REVIEW";

export type IngredientRecoveryDraft = {
  source_url: string;
  source_kind: IngredientRecoverySourceKind;
  ingredient_declaration: string;
  parsed_ingredients: string;
  identity_confirmed: boolean;
  reviewer_note: string;
};

export type IngredientRecoveryResult = {
  success?: boolean;
  ingredient_count?: number;
  evidence_confidence?: number;
  evidence_tier?: string;
  score_available?: boolean;
  safety_score?: number | null;
  assessment_status?: string;
  regulatory_reason?: string;
  regulatory_evidence_coverage?: number | null;
};

export const EMPTY_INGREDIENT_RECOVERY_DRAFT: IngredientRecoveryDraft = {
  source_url: "",
  source_kind: "TRUSTED_STRUCTURED_SOURCE",
  ingredient_declaration: "",
  parsed_ingredients: "",
  identity_confirmed: false,
  reviewer_note: "",
};

export function parseIngredientRecoveryLines(value: string): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of String(value || "").split(/\r?\n/)) {
    const ingredient = raw.trim();
    const key = ingredient.toLocaleLowerCase();
    if (!ingredient || seen.has(key)) continue;
    seen.add(key);
    output.push(ingredient);
    if (output.length >= 250) break;
  }
  return output;
}

export function validateIngredientRecoveryDraft(draft: IngredientRecoveryDraft): string | null {
  if (!draft.identity_confirmed) return "Confirm the exact product identity before recovery.";
  try {
    const url = new URL(draft.source_url.trim());
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("invalid");
  } catch {
    return "A valid HTTPS evidence source URL is required.";
  }
  if (!draft.ingredient_declaration.trim()) return "Enter the complete ingredient declaration.";
  if (parseIngredientRecoveryLines(draft.parsed_ingredients).length === 0) {
    return "Enter at least one parsed ingredient, one per line.";
  }
  return null;
}
