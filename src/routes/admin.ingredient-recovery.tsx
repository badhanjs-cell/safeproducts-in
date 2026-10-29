import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_INGREDIENT_RECOVERY_DRAFT,
  parseIngredientRecoveryLines,
  validateIngredientRecoveryDraft,
  type IngredientRecoveryDraft,
  type IngredientRecoveryResult,
  type IngredientRecoverySourceKind,
} from "@/lib/m1bHumanReview";

export const Route = createFileRoute("/admin/ingredient-recovery")({ component: IngredientRecoveryAdmin });

type Report = {
  attempted: number;
  m1b_qualified: number;
  m1b_failed: number;
  m1b_success_rate: number;
  m1br_invocations: number;
  m1br_qualified: number;
  m1br_recovery_rate: number;
  combined_qualified: number;
  combined_qualification_rate: number;
  m1br_absolute_lift: number;
  human_review_required: number;
  human_review_rate: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  m1br_cost_usd: number;
  cost_per_recovery_usd: number;
  cache_promotion_count: number;
};

type ReviewItem = {
  id: string;
  product_id: string | null;
  review_type: string;
  severity: string;
  status: string;
  title: string;
  detail: string | null;
  source_context: Record<string, unknown> | null;
  opened_at: string;
};

const EMPTY_REPORT: Report = {
  attempted: 0,
  m1b_qualified: 0,
  m1b_failed: 0,
  m1b_success_rate: 0,
  m1br_invocations: 0,
  m1br_qualified: 0,
  m1br_recovery_rate: 0,
  combined_qualified: 0,
  combined_qualification_rate: 0,
  m1br_absolute_lift: 0,
  human_review_required: 0,
  human_review_rate: 0,
  p50_latency_ms: 0,
  p95_latency_ms: 0,
  m1br_cost_usd: 0,
  cost_per_recovery_usd: 0,
  cache_promotion_count: 0,
};

const SOURCE_KINDS: { value: IngredientRecoverySourceKind; label: string }[] = [
  { value: "OFFICIAL_BRAND", label: "Official brand" },
  { value: "OFFICIAL_FIRST_PARTY_RETAIL", label: "Official first-party retail" },
  { value: "TRUSTED_STRUCTURED_SOURCE", label: "Trusted structured source" },
  { value: "MANUAL_WEB_REVIEW", label: "Manual web review" },
];

function finiteNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeReport(value: unknown): Report {
  const v = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return Object.fromEntries(
    Object.keys(EMPTY_REPORT).map((key) => [key, finiteNumber(v[key])]),
  ) as unknown as Report;
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function latency(value: number) {
  if (!value) return "—";
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`;
}

function money(value: number) {
  return value > 0 ? `$${value.toFixed(value < 0.01 ? 4 : 2)}` : "—";
}

function fmtTime(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-divider bg-card p-4">
      <p className="text-xs font-semibold text-body">{label}</p>
      <p className="mt-2 text-2xl font-bold text-heading">{value}</p>
      {detail && <p className="mt-1 text-[11px] text-body/80">{detail}</p>}
    </div>
  );
}

function identitySummary(item: ReviewItem) {
  const context = item.source_context || {};
  const packet = context.packet;
  if (packet && typeof packet === "object" && !Array.isArray(packet)) {
    const p = packet as Record<string, unknown>;
    const summary = p.identity_summary ?? p.product_name;
    if (typeof summary === "string" && summary.trim()) return summary.trim();
  }
  return item.title;
}

function RecoveryResultPanel({ result }: { result: IngredientRecoveryResult }) {
  const scoreAvailable = result.score_available === true && typeof result.safety_score === "number";
  return (
    <div className="rounded-lg border border-brand-blue/25 bg-brand-blue/5 p-3 text-xs text-body">
      <div className="flex items-center gap-2 font-semibold text-heading">
        <ShieldCheck className="h-4 w-4 text-brand-blue" /> Backend recovery result
      </div>
      <div className="mt-2 grid gap-1 sm:grid-cols-2">
        <p><span className="font-semibold">score_available:</span> {result.score_available === true ? "yes" : "no"}</p>
        <p><span className="font-semibold">ingredient_count:</span> {result.ingredient_count ?? "—"}</p>
        <p><span className="font-semibold">evidence tier:</span> {result.evidence_tier ?? "—"}</p>
        <p><span className="font-semibold">evidence confidence:</span> {result.evidence_confidence ?? "—"}</p>
        <p><span className="font-semibold">Safety Score:</span> {scoreAvailable ? result.safety_score : "Not available"}</p>
        <p><span className="font-semibold">regulatory status:</span> {result.assessment_status ?? "—"}</p>
      </div>
      {!scoreAvailable && (
        <p className="mt-2 rounded-md border border-divider bg-card px-3 py-2">
          <span className="font-semibold">Backend reason:</span> {result.regulatory_reason ?? "Safety Score remains unavailable after regulatory validation."}
        </p>
      )}
    </div>
  );
}

function IngredientRecoveryAdmin() {
  const [report, setReport] = useState<Report>(EMPTY_REPORT);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, IngredientRecoveryDraft>>({});
  const [results, setResults] = useState<Record<string, IngredientRecoveryResult>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const pTo = new Date();
    const pFrom = new Date(pTo.getTime() - 7 * 24 * 60 * 60 * 1000);
    const client = supabase as any;

    const [reportResponse, reviewResponse] = await Promise.all([
      client.rpc("sp_m1b_get_report_v1", {
        p_from: pFrom.toISOString(),
        p_to: pTo.toISOString(),
        p_context: null,
      }),
      client
        .from("sp_catalog_review_queue_v1")
        .select("id,product_id,review_type,severity,status,title,detail,source_context,opened_at")
        .eq("review_type", "INGREDIENT_RECOVERY")
        .order("opened_at", { ascending: false })
        .limit(25),
    ]);

    const messages = [reportResponse.error?.message, reviewResponse.error?.message].filter(Boolean);
    if (messages.length) setError(messages.join(" · "));
    if (!reportResponse.error) setReport(normalizeReport(reportResponse.data));
    if (!reviewResponse.error) setReviews(Array.isArray(reviewResponse.data) ? reviewResponse.data as ReviewItem[] : []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const openReviews = useMemo(
    () => reviews.filter((item) => ["OPEN", "ASSIGNED", "IN_REVIEW"].includes(item.status)),
    [reviews],
  );

  function updateDraft(reviewId: string, patch: Partial<IngredientRecoveryDraft>) {
    setRowErrors((current) => ({ ...current, [reviewId]: "" }));
    setDrafts((current) => ({
      ...current,
      [reviewId]: { ...(current[reviewId] || EMPTY_INGREDIENT_RECOVERY_DRAFT), ...patch },
    }));
  }

  async function submitRecovery(item: ReviewItem) {
    const draft = drafts[item.id] || EMPTY_INGREDIENT_RECOVERY_DRAFT;
    const validation = validateIngredientRecoveryDraft(draft);
    if (validation) {
      setRowErrors((current) => ({ ...current, [item.id]: validation }));
      return;
    }

    setBusyId(item.id);
    setRowErrors((current) => ({ ...current, [item.id]: "" }));
    const parsed = parseIngredientRecoveryLines(draft.parsed_ingredients);
    const client = supabase as any;
    const { data, error: submitError } = await client.rpc("sp_m1b_submit_human_recovery_v2", {
      p_review_id: item.id,
      p_source_url: draft.source_url.trim(),
      p_source_kind: draft.source_kind,
      p_ingredient_declaration: draft.ingredient_declaration.trim(),
      p_parsed_ingredients: parsed,
      p_identity_confirmed: true,
      p_reviewer_note: draft.reviewer_note.trim() || null,
    });

    if (submitError) {
      setRowErrors((current) => ({ ...current, [item.id]: submitError.message || "Recovery submission failed." }));
      setBusyId(null);
      return;
    }

    setResults((current) => ({ ...current, [item.id]: (data || {}) as IngredientRecoveryResult }));
    setBusyId(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Ingredient Recovery Audit"
        action={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-divider bg-card px-3 py-2 text-xs font-semibold text-heading hover:border-brand-blue/60 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        }
      />

      <div className="rounded-lg border border-divider bg-card px-4 py-3 text-xs text-body">
        Admin-only M1-B / M1-BR operational view for the last 7 days. Terminal ingredient recovery submits verified evidence to the backend; only the backend may recalculate a Safety Score.
      </div>

      {error && <p className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">{error}</p>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="M1-B success rate" value={pct(report.m1b_success_rate)} detail={`${report.m1b_qualified} of ${report.attempted} runs`} />
        <Metric label="M1-BR recovery rate" value={pct(report.m1br_recovery_rate)} detail={`${report.m1br_qualified} of ${report.m1br_invocations} recovery invocations`} />
        <Metric label="Combined qualification rate" value={pct(report.combined_qualification_rate)} detail={`${report.combined_qualified} qualified after M1-B + M1-BR`} />
        <Metric label="M1-BR absolute lift" value={pct(report.m1br_absolute_lift)} detail="Incremental qualification attributable to recovery" />
        <Metric label="Human review rate" value={pct(report.human_review_rate)} detail={`${report.human_review_required} terminal recovery runs require review`} />
        <Metric label="p50 latency" value={latency(report.p50_latency_ms)} detail="Median recorded per-run foreground/recovery attempt latency" />
        <Metric label="p95 latency" value={latency(report.p95_latency_ms)} detail="95th percentile recorded per-run latency" />
        <Metric label="Cost per recovery" value={money(report.cost_per_recovery_usd)} detail={`Recorded M1-BR cost ${money(report.m1br_cost_usd)}`} />
      </section>

      <section className="space-y-4 rounded-xl border border-divider bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-bold text-heading">Terminal ingredient recovery workstation</h2>
            <p className="mt-1 text-xs text-body">{openReviews.length} open/assigned ingredient-recovery review item{openReviews.length === 1 ? "" : "s"} in the latest 25.</p>
          </div>
          <p className="text-xs text-body">Cache promotions: {report.cache_promotion_count}</p>
        </div>

        {openReviews.map((item) => {
          const draft = drafts[item.id] || EMPTY_INGREDIENT_RECOVERY_DRAFT;
          const result = results[item.id];
          return (
            <article key={item.id} className="space-y-4 rounded-xl border border-divider bg-background p-4">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-[11px] text-body">Opened {fmtTime(item.opened_at)} · {item.severity} · {item.status}</p>
                  <h3 className="mt-1 font-semibold text-heading">{identitySummary(item)}</h3>
                  {item.detail && <p className="mt-1 text-xs text-body">{item.detail}</p>}
                </div>
                <span className="text-[11px] font-mono text-body">{item.id}</span>
              </div>

              <label className="flex items-start gap-2 rounded-md border border-divider bg-card p-3 text-xs text-heading">
                <input
                  type="checkbox"
                  checked={draft.identity_confirmed}
                  onChange={(event) => updateDraft(item.id, { identity_confirmed: event.target.checked })}
                  className="mt-0.5"
                />
                <span><strong>Exact product identity confirmed</strong><br /><span className="text-body">Confirm exact variant, pack, geography, and formula identity before submitting evidence.</span></span>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-semibold text-heading">
                  <span>Source URL</span>
                  <input
                    type="url"
                    value={draft.source_url}
                    onChange={(event) => updateDraft(item.id, { source_url: event.target.value })}
                    placeholder="https://…"
                    className="w-full rounded-md border border-divider bg-card px-3 py-2 font-normal text-heading"
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold text-heading">
                  <span>Source kind</span>
                  <select
                    value={draft.source_kind}
                    onChange={(event) => updateDraft(item.id, { source_kind: event.target.value as IngredientRecoverySourceKind })}
                    className="w-full rounded-md border border-divider bg-card px-3 py-2 font-normal text-heading"
                  >
                    {SOURCE_KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
                  </select>
                </label>
              </div>

              <label className="block space-y-1 text-xs font-semibold text-heading">
                <span>Ingredient declaration</span>
                <textarea
                  rows={4}
                  value={draft.ingredient_declaration}
                  onChange={(event) => updateDraft(item.id, { ingredient_declaration: event.target.value })}
                  placeholder="Paste the complete declaration exactly as evidenced."
                  className="w-full rounded-md border border-divider bg-card px-3 py-2 font-normal text-heading"
                />
              </label>

              <label className="block space-y-1 text-xs font-semibold text-heading">
                <span>Parsed ingredients</span>
                <textarea
                  rows={6}
                  value={draft.parsed_ingredients}
                  onChange={(event) => updateDraft(item.id, { parsed_ingredients: event.target.value })}
                  placeholder="One ingredient per line"
                  className="w-full rounded-md border border-divider bg-card px-3 py-2 font-normal text-heading"
                />
                <span className="font-normal text-body">Review and edit the parsed list before submission. Duplicates are removed case-insensitively.</span>
              </label>

              <label className="block space-y-1 text-xs font-semibold text-heading">
                <span>Reviewer note</span>
                <textarea
                  rows={2}
                  value={draft.reviewer_note}
                  onChange={(event) => updateDraft(item.id, { reviewer_note: event.target.value })}
                  placeholder="Optional provenance or reconciliation note"
                  className="w-full rounded-md border border-divider bg-card px-3 py-2 font-normal text-heading"
                />
              </label>

              {rowErrors[item.id] && <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{rowErrors[item.id]}</p>}
              {result && <RecoveryResultPanel result={result} />}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void submitRecovery(item)}
                  disabled={busyId === item.id}
                  className="rounded-md bg-brand-blue px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {busyId === item.id ? "Validating…" : "Validate & Recalculate"}
                </button>
              </div>
            </article>
          );
        })}

        {!loading && openReviews.length === 0 && (
          <p className="rounded-lg border border-divider bg-background px-4 py-8 text-center text-xs text-body">No open ingredient-recovery items require terminal review.</p>
        )}
      </section>

      <section className="rounded-xl border border-divider bg-card p-4 sm:p-5">
        <h2 className="mb-3 font-bold text-heading">Recent recovery queue history</h2>
        <div className="overflow-x-auto rounded-lg border border-divider">
          <table className="min-w-[820px] w-full text-left text-xs">
            <thead className="bg-background text-body"><tr><th className="px-3 py-2">Opened</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Severity</th><th className="px-3 py-2">Title</th><th className="px-3 py-2">Detail</th></tr></thead>
            <tbody>
              {reviews.map((item) => (
                <tr key={item.id} className="border-t border-divider/60">
                  <td className="px-3 py-2 text-body">{fmtTime(item.opened_at)}</td>
                  <td className="px-3 py-2 font-semibold text-heading">{item.status}</td>
                  <td className="px-3 py-2 text-body">{item.severity}</td>
                  <td className="px-3 py-2 text-heading">{item.title}</td>
                  <td className="max-w-md px-3 py-2 text-body">{item.detail || "—"}</td>
                </tr>
              ))}
              {!loading && reviews.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-body">No ingredient-recovery review items in this view.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
