import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import manifestData from "@/data/m1b-dev-reviewer-packets.json";
import ready1 from "@/data/m1b-dev-review-ready-1.json";
import ready2 from "@/data/m1b-dev-review-ready-2.json";
import ready3 from "@/data/m1b-dev-review-ready-3.json";
import ready4 from "@/data/m1b-dev-review-ready-4.json";
import ready5 from "@/data/m1b-dev-review-ready-5.json";
import ready6 from "@/data/m1b-dev-review-ready-6.json";
import blockedData from "@/data/m1b-dev-review-blocked.json";
import { supabase } from "@/integrations/supabase/client";
import {
  buildHumanReviewSubmission,
  evaluateDecisionDraft,
  mergeReviewPackets,
  packetFromSourceContext,
  type HumanReviewChoice,
  type HumanReviewDraft,
  type HumanReviewPacket,
  type HumanReviewPacketSet,
} from "@/lib/m1bHumanReview";

export const Route = createFileRoute("/admin/human-review")({
  head: () => ({
    meta: [
      { title: "Human Review — SafeProducts Admin" },
      { name: "description", content: "Fail-closed M1-B and M1-BR evidence adjudication for SafeProducts administrators." },
      { property: "og:title", content: "Human Review — SafeProducts Admin" },
      { property: "og:description", content: "Fail-closed M1-B and M1-BR evidence adjudication for SafeProducts administrators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: HumanReviewAdmin,
});

const STORAGE_KEY = "safeproducts:m1b-human-review:drafts:v1";
const EMPTY_DRAFT: HumanReviewDraft = {
  identity_decision: null,
  ingredient_declaration_decision: null,
  correction_note: "",
};

const manifest = manifestData as {
  packet_count: number;
  ready_count: number;
  blocked_count: number;
  gold_status: string;
  human_adjudication_required: boolean;
};
const bundledReady = [
  ...(ready1 as HumanReviewPacket[]),
  ...(ready2 as HumanReviewPacket[]),
  ...(ready3 as HumanReviewPacket[]),
  ...(ready4 as HumanReviewPacket[]),
  ...(ready5 as HumanReviewPacket[]),
  ...(ready6 as HumanReviewPacket[]),
];
const bundledBlocked = blockedData as HumanReviewPacket[];

function bundledSnapshotIsValid(): boolean {
  if (manifest.packet_count !== 30 || manifest.gold_status !== "UNASSIGNED") return false;
  if (!manifest.human_adjudication_required) return false;
  if (bundledReady.length !== manifest.ready_count || bundledBlocked.length !== manifest.blocked_count) return false;
  if (bundledReady.length + bundledBlocked.length !== manifest.packet_count) return false;
  const ids = [...bundledReady, ...bundledBlocked].map((packet) => packet.candidate_id);
  if (new Set(ids).size !== ids.length) return false;
  if (!bundledReady.every((packet) =>
    packet.curation_status === "READY_FOR_HUMAN_ADJUDICATION"
    && packet.gold_status === "UNASSIGNED"
    && !!packet.identity_summary
    && !!packet.ingredient_declaration
    && Array.isArray(packet.evidence_sources)
    && packet.evidence_sources.length > 0
  )) return false;
  return bundledBlocked.every((packet) =>
    packet.do_not_adjudicate_gold === true
    && packet.gold_status === "UNASSIGNED"
    && !!packet.evidence_gap_reason
  );
}

const BUNDLED_VALID = bundledSnapshotIsValid();
const DEV_SNAPSHOT: HumanReviewPacketSet = BUNDLED_VALID
  ? { ready_packets: bundledReady, blocked_packets: bundledBlocked }
  : { ready_packets: [], blocked_packets: [] };

type LiveReviewRow = {
  source_context: Record<string, unknown> | null;
};

function loadDrafts(): Record<string, HumanReviewDraft> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveDrafts(drafts: Record<string, HumanReviewDraft>) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

function sourceLabel(source: Record<string, unknown>) {
  if (source.authoritative) return "Authoritative";
  if (source.reconciled_pack_formula) return "Reconciled pack/formula";
  if (source.trusted_structured) return "Trusted structured";
  return String(source.source_kind || "Evidence");
}

function DecisionGroup({
  label,
  value,
  onChange,
}: {
  label: string;
  value: HumanReviewChoice | null;
  onChange: (value: HumanReviewChoice) => void;
}) {
  const choices: HumanReviewChoice[] = ["APPROVE", "CORRECT", "REJECT"];
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-heading">{label}</legend>
      <div className="grid grid-cols-3 gap-2">
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => onChange(choice)}
            aria-pressed={value === choice}
            className={`rounded-md border px-2 py-2 text-xs font-semibold transition ${
              value === choice
                ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
                : "border-divider bg-background text-body hover:border-brand-blue/50 hover:text-heading"
            }`}
          >
            {choice}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function HumanReviewAdmin() {
  const [livePackets, setLivePackets] = useState<HumanReviewPacket[]>([]);
  const [drafts, setDrafts] = useState<Record<string, HumanReviewDraft>>(loadDrafts);
  const [reviewerId, setReviewerId] = useState("");
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const packetSet = useMemo(() => mergeReviewPackets(DEV_SNAPSHOT, livePackets), [livePackets]);
  const ready = packetSet.ready_packets;
  const blocked = packetSet.blocked_packets;
  const packet = ready[index] || null;
  const draft = packet ? drafts[packet.candidate_id] || EMPTY_DRAFT : EMPTY_DRAFT;
  const evaluation = evaluateDecisionDraft(draft);
  const reviewedCount = useMemo(
    () => ready.filter((item) => {
      const itemDraft = drafts[item.candidate_id];
      return !!itemDraft && evaluateDecisionDraft(itemDraft).complete;
    }).length,
    [drafts, ready],
  );
  const allReviewed = ready.length > 0 && reviewedCount === ready.length;

  async function loadLiveQueue() {
    setLoading(true);
    setQueueError(null);
    const client = supabase as any;
    const [{ data: userData }, queueResponse] = await Promise.all([
      supabase.auth.getUser(),
      client
        .from("sp_catalog_review_queue_v1")
        .select("source_context")
        .order("opened_at", { ascending: false })
        .limit(100),
    ]);

    if (userData?.user?.email) setReviewerId(userData.user.email);
    if (queueResponse.error) {
      setQueueError(queueResponse.error.message);
    } else {
      const rows = Array.isArray(queueResponse.data) ? queueResponse.data as LiveReviewRow[] : [];
      setLivePackets(rows.flatMap((row) => {
        const packet = packetFromSourceContext(row.source_context);
        return packet ? [packet] : [];
      }));
    }
    setLoading(false);
  }

  useEffect(() => { void loadLiveQueue(); }, []);
  useEffect(() => { saveDrafts(drafts); }, [drafts]);
  useEffect(() => {
    if (index >= ready.length && ready.length > 0) setIndex(ready.length - 1);
  }, [index, ready.length]);

  function updateDraft(patch: Partial<HumanReviewDraft>) {
    if (!packet) return;
    setValidationMessage(null);
    setDrafts((current) => ({
      ...current,
      [packet.candidate_id]: { ...(current[packet.candidate_id] || EMPTY_DRAFT), ...patch },
    }));
  }

  function validateAll() {
    if (!BUNDLED_VALID) {
      setValidationMessage("Bundled DEV evidence failed integrity validation. Review is disabled fail-closed.");
      return;
    }
    if (!reviewerId.trim()) {
      setValidationMessage("Reviewer identity is required before validation.");
      return;
    }
    if (!allReviewed) {
      const firstIncomplete = ready.findIndex((item) => {
        const itemDraft = drafts[item.candidate_id];
        return !itemDraft || !evaluateDecisionDraft(itemDraft).complete;
      });
      if (firstIncomplete >= 0) setIndex(firstIncomplete);
      setValidationMessage(`Human review is incomplete: ${reviewedCount} of ${ready.length} reviewable packets are complete.`);
      return;
    }
    setValidationMessage(`Validated ${reviewedCount} human decisions. Gold remains UNASSIGNED and promotion remains disabled.`);
  }

  function exportDecisions() {
    if (!BUNDLED_VALID || !allReviewed || !reviewerId.trim()) {
      validateAll();
      return;
    }
    const submission = buildHumanReviewSubmission(ready, drafts, reviewerId, new Date().toISOString());
    const blob = new Blob([JSON.stringify(submission, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `safeproducts-m1b-human-review-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Human Review"
        action={
          <button
            type="button"
            onClick={() => void loadLiveQueue()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-divider bg-card px-3 py-2 text-xs font-semibold text-heading hover:border-brand-blue/60 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh queue
          </button>
        }
      />

      <div className="rounded-xl border border-brand-blue/25 bg-card p-4 text-xs text-body">
        <div className="flex gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" />
          <p>
            Benchmark-gold review and runtime ingredient recovery are separate. DEV approval only stages a packet for later gold processing;
            it never assigns benchmark gold, publishes a result, or promotes a record automatically. Runtime recovery can repair evidence and
            request recalculation, while the existing regulatory gate still decides whether a numeric Safety Score is allowed.
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-divider bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-heading">Read-only review queue</h2>
            <p className="mt-1 text-xs text-body">Compatible source-context packets are merged into this local review workspace. No queue records are changed.</p>
          </div>
          <span className="rounded-full border border-divider px-2.5 py-1 text-xs font-semibold text-heading">{livePackets.length} compatible packets</span>
        </div>
        {queueError && (
          <div className="mt-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
            Live queue could not be read: {queueError}. The bundled DEV batch remains available.
          </div>
        )}
        {!loading && !queueError && livePackets.length === 0 && (
          <div className="mt-4 rounded-lg border border-divider bg-background p-4 text-sm text-body">
            No structurally compatible review packets are currently available from the live queue.
          </div>
        )}
      </section>

      {!BUNDLED_VALID && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
          Bundled DEV evidence failed integrity validation. Human adjudication is disabled fail-closed.
        </div>
      )}

      <section className="rounded-xl border border-divider bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-heading">Bundled DEV benchmark-gold review</h2>
            <p className="mt-1 text-xs text-body">The bundled DEV batch remains available if the read-only queue cannot be loaded. This workflow does not modify BENCHMARK_GOLD state.</p>
          </div>
          <span className="text-xs font-semibold text-heading">Gold remains UNASSIGNED in this review artifact</span>
        </div>

        <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-divider bg-background p-4"><p className="text-xs text-body">Reviewable</p><p className="mt-1 text-2xl font-bold text-heading">{ready.length}</p></div>
          <div className="rounded-xl border border-divider bg-background p-4"><p className="text-xs text-body">Reviewed</p><p className="mt-1 text-2xl font-bold text-heading">{reviewedCount} / {ready.length}</p></div>
          <div className="rounded-xl border border-divider bg-background p-4"><p className="text-xs text-body">Evidence incomplete</p><p className="mt-1 text-2xl font-bold text-heading">{blocked.length}</p></div>
          <div className="rounded-xl border border-divider bg-background p-4"><p className="text-xs text-body">Gold status</p><p className="mt-1 text-lg font-bold text-heading">UNASSIGNED</p></div>
        </section>
      </section>

      {packet && (
        <section className="rounded-xl border border-divider bg-card p-4 sm:p-5">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">Review {index + 1} of {ready.length}</p>
              <h2 className="mt-1 text-lg font-bold text-heading">{packet.candidate_brand_name || "Unbranded"} — {packet.candidate_product_name}</h2>
              <p className="mt-1 text-xs text-body">Candidate ID: {packet.candidate_id}</p>
            </div>
            {evaluation.complete && (
              <span className="inline-flex items-center gap-1 rounded-full border border-divider px-2.5 py-1 text-xs font-semibold text-heading">
                <CheckCircle2 className="h-3.5 w-3.5" /> Reviewed
              </span>
            )}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <div className="rounded-lg border border-divider bg-background p-4">
                <h3 className="text-sm font-bold text-heading">Exact identity</h3>
                <p className="mt-2 text-sm text-body">{packet.identity_summary || "Identity summary unavailable"}</p>
                {packet.product_fingerprint && <p className="mt-2 break-all text-[11px] text-body/80">Fingerprint: {packet.product_fingerprint}</p>}
                {!!packet.identity_source_urls?.length && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {packet.identity_source_urls.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline">
                        Identity source <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-divider bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-heading">Ingredient declaration</h3>
                  <span className="text-xs text-body">{packet.ingredient_count || 0} parsed ingredients</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-body">{packet.ingredient_declaration || "Declaration unavailable"}</p>
              </div>

              <div className="rounded-lg border border-divider bg-background p-4">
                <h3 className="text-sm font-bold text-heading">Evidence</h3>
                <div className="mt-3 space-y-3">
                  {(packet.evidence_sources || []).map((source, sourceIndex) => {
                    const url = String(source.source_url || "");
                    return (
                      <div key={`${url}-${sourceIndex}`} className="rounded-md border border-divider bg-card p-3">
                        <div className="flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-divider px-2 py-0.5 text-[11px] font-semibold text-heading">{sourceLabel(source)}</span>
                          {source.requires_human_authority_judgment && <span className="rounded-full border border-divider px-2 py-0.5 text-[11px] text-body">Human judgment required</span>}
                        </div>
                        {url && <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 break-all text-xs font-semibold text-brand-blue hover:underline">Open evidence <ExternalLink className="h-3 w-3" /></a>}
                        {source.evidence_text_sha256 && <p className="mt-2 break-all text-[10px] text-body/70">Evidence SHA256: {String(source.evidence_text_sha256)}</p>}
                        {source.provenance_note && <p className="mt-2 text-xs leading-5 text-body">{String(source.provenance_note)}</p>}
                      </div>
                    );
                  })}
                </div>
                {!!packet.rejected_evidence?.length && (
                  <div className="mt-3 rounded-md border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                    <div className="flex gap-2 font-semibold"><AlertTriangle className="h-4 w-4 shrink-0" /> Rejected/conflicting evidence preserved</div>
                    <div className="mt-2 space-y-2">
                      {packet.rejected_evidence.map((item, rejectedIndex) => (
                        <div key={rejectedIndex} className="leading-5">
                          {String(item.conflict_code || item.source_kind || "REJECTED_EVIDENCE")}: {String(item.conflict_detail || item.source_url || "Preserved and excluded from gold evidence.")}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-lg border border-divider bg-background p-4">
                <h3 className="text-sm font-bold text-heading">Your human decision</h3>
                <p className="mt-1 text-xs leading-5 text-body">Review identity and declaration independently. CORRECT requires a note.</p>
                <div className="mt-4 space-y-5">
                  <DecisionGroup label="Identity" value={draft.identity_decision} onChange={(value) => updateDraft({ identity_decision: value })} />
                  <DecisionGroup label="Ingredient declaration" value={draft.ingredient_declaration_decision} onChange={(value) => updateDraft({ ingredient_declaration_decision: value })} />
                  <label className="block">
                    <span className="text-sm font-semibold text-heading">Correction note</span>
                    <textarea
                      value={draft.correction_note}
                      onChange={(event) => updateDraft({ correction_note: event.target.value })}
                      rows={5}
                      placeholder="Required when either decision is CORRECT. Add any useful note for a rejection too."
                      className="mt-2 w-full rounded-md border border-divider bg-card px-3 py-2 text-sm text-heading outline-none focus:border-brand-blue"
                    />
                  </label>
                  {!evaluation.complete && (draft.identity_decision || draft.ingredient_declaration_decision) && (
                    <p className="text-xs text-danger">{evaluation.errors.join(" · ")}</p>
                  )}
                  {packet.review_note && <p className="rounded-md border border-divider bg-card p-3 text-xs leading-5 text-body">{packet.review_note}</p>}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0} className="inline-flex items-center gap-1 rounded-md border border-divider px-3 py-2 text-xs font-semibold text-heading disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <button type="button" onClick={() => setIndex((value) => Math.min(ready.length - 1, value + 1))} disabled={index >= ready.length - 1} className="inline-flex items-center gap-1 rounded-md border border-divider px-3 py-2 text-xs font-semibold text-heading disabled:opacity-40">
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-divider bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-heading">Evidence-incomplete benchmark packets</h2>
            <p className="mt-1 text-xs text-body">Visible for transparency, but benchmark adjudication controls are intentionally disabled.</p>
          </div>
          <span className="text-sm font-bold text-heading">{blocked.length}</span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {blocked.map((item) => (
            <div key={item.candidate_id} className="rounded-lg border border-divider bg-background p-3">
              <p className="text-sm font-semibold text-heading">{item.candidate_brand_name || "Unbranded"} — {item.candidate_product_name}</p>
              <p className="mt-1 text-xs text-body">{item.candidate_id}</p>
              <p className="mt-2 text-xs leading-5 text-body">{item.evidence_gap_reason || "Evidence incomplete."}</p>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-danger">Do not adjudicate gold</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-divider bg-card p-4 sm:p-5">
        <h2 className="font-bold text-heading">Finalize bundled DEV review batch</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="block">
            <span className="text-xs font-semibold text-body">Reviewer identity</span>
            <input value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} className="mt-1 w-full rounded-md border border-divider bg-background px-3 py-2 text-sm text-heading outline-none focus:border-brand-blue" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={validateAll} className="rounded-md border border-brand-blue px-3 py-2 text-xs font-semibold text-brand-blue hover:bg-brand-blue/10">Validate Human Review</button>
            <button type="button" onClick={exportDecisions} disabled={!BUNDLED_VALID || !allReviewed || !reviewerId.trim()} className="inline-flex items-center gap-2 rounded-md bg-brand-blue px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
              <Download className="h-3.5 w-3.5" /> Export Decisions
            </button>
          </div>
        </div>
        {validationMessage && <p className="mt-3 rounded-md border border-divider bg-background p-3 text-xs text-body">{validationMessage}</p>}
        <p className="mt-3 text-[11px] leading-5 text-body/80">Draft benchmark decisions are saved only in this browser until exported. Validation never changes gold status or writes a production decision.</p>
      </section>
    </div>
  );
}
