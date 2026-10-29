import { MultiSourceEvidenceReview } from "@/components/MultiSourceEvidenceReview";
import { ClinicalSafetyScreen } from "@/components/ClinicalSafetyScreen";
import { SupplementRegulatoryReview } from "@/components/SupplementRegulatoryReview";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { QualifiedLabelResult } from "@/lib/labels.functions";

function statusIcon(s: string) {
  if (s === "permitted") return <CheckCircle2 className="inline h-4 w-4 text-safe" />;
  if (s === "restricted") return <AlertTriangle className="inline h-4 w-4 text-warn" />;
  if (s === "prohibited") return <XCircle className="inline h-4 w-4 text-danger" />;
  if(s === "identified") return <span className="text-body">ID</span>;
  if(s === "undisclosed") return <span className="text-body">Not listed</span>;
  return <span className="text-body">?</span>;
}

function humanizeProductScope(scope: string) {
  return scope
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function LabelQualifiedResult({ r, onReset }: { r: QualifiedLabelResult; onReset: () => void }) {
  const score = Math.round(r.safety_score);
  const provisional = r.status === "PROVISIONAL_SCORE";
  const color = provisional ? "bg-slate-600" : score >= 80 ? "bg-safe" : score >= 50 ? "bg-warn" : "bg-danger";
  const productLabel = `${r.brand_name} ${r.product_name}${r.variant ? ` ${r.variant}` : ""}${r.pack_size_text ? ` ${r.pack_size_text}` : ""}`.trim();
  const shareText = `${productLabel} — SafeProducts ${provisional ? "Provisional screening index" : "Safety Score"}: ${score}%. For awareness only—not medical advice, government approval, regulatory certification, a legal-compliance determination, or a probability of safety.`;
  return (
    <div className="space-y-6 rounded-lg border border-divider bg-card p-5">
      <div className="rounded-lg border border-divider bg-background px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-blue">{r.brand_name}</p>
        <h2 className="mt-1 text-lg font-bold text-heading">{r.product_name}</h2>
        {r.variant && <p className="mt-1 text-xs text-body">{r.variant}</p>}
        {r.pack_size_text && <p className="mt-1 text-xs text-body">Pack: {r.pack_size_text}</p>}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold text-heading">Detected Ingredients</h3>
        <MultiSourceEvidenceReview review={r.multi_source_review} />
      <ClinicalSafetyScreen screen={r.clinical_screen} />
      <SupplementRegulatoryReview review={r.supplement_review} />

      <div className="flex flex-wrap gap-2">
          {r.detected_ingredients.map((i) => (
            <span key={i} className="rounded-full border border-divider bg-background px-3 py-1 text-xs text-body">
              {i}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 border-y border-divider py-6">
        <div className={`flex h-20 w-20 flex-col items-center justify-center rounded-full ${color} text-white`}>
          <span className="text-2xl font-bold leading-none">{score}%</span>
          <span className="mt-1 text-center text-[9px] font-bold leading-tight">{provisional ? "PROVISIONAL SCREEN" : "SAFETY SCORE"}</span>
        </div>
        {provisional && <p className="max-w-lg text-center text-xs font-bold text-warn">Preliminary score only; regulatory coverage incomplete. Not a verified product Safety Score.</p>}
        {r.evidence_coverage !== undefined && r.evidence_coverage < 80 && (
          <span className="text-[11px] font-bold text-warn">Applicable evidence coverage is incomplete; see ingredient details</span>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold text-heading">Ingredient Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-divider text-left text-xs text-body">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {r.ingredient_breakdown.map((row, i) => (
                <tr key={i} className="border-b border-divider/50">
                  <td className="py-2 pr-3 font-medium text-heading">{row.name}</td>
                  <td className="py-2 pr-3 capitalize">
                    {statusIcon(row.status)} <span className="ml-1 text-body">{row.status}</span>
                  </td>
                  <td className="py-2 text-body">{row.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onReset}
          className="rounded-md border border-brand-blue px-4 py-2 text-sm font-bold text-brand-blue hover:bg-brand-blue hover:text-primary-foreground"
        >
          Analyse Another
        </button>
        <button
          onClick={() => navigator.clipboard?.writeText(shareText)}
          className="rounded-md border border-divider px-4 py-2 text-sm text-body hover:border-brand-blue hover:text-brand-blue"
        >
          Share Result
        </button>
      </div>

      <details className="border-t border-divider pt-4 text-xs text-body/80">
        <summary className="cursor-pointer font-bold text-brand-blue">Disclaimer &amp; methodology</summary>
        <div className="mt-3 space-y-3">
          <p>
            SafeProducts provides independent consumer safety intelligence based on available product-label evidence, published regulatory information and other identified sources.
          </p>
          <p>
            A Safety Score is a SafeProducts analytical index—not a probability of safety, medical advice, government approval, regulatory certification, or a legal-compliance determination. Results may be provisional where evidence is incomplete or under review. Verify critical decisions with the applicable regulator, product manufacturer, and a qualified healthcare professional.
          </p>

          <dl className="space-y-2">
            <div><dt className="inline font-bold text-heading">Brand: </dt><dd className="inline">{r.brand_name}</dd></div>
            <div><dt className="inline font-bold text-heading">Product: </dt><dd className="inline">{r.product_name}{r.variant ? ` — ${r.variant}` : ""}{r.pack_size_text ? ` — ${r.pack_size_text}` : ""}</dd></div>
            <div><dt className="inline font-bold text-heading">Product registry: </dt><dd className="inline">{r.catalog_sync_status === "SYNCED" ? "Saved" : "Sync pending; safety report remains valid"}</dd></div>
            {r.regulatory_screen_score !== undefined && (
              <div><dt className="inline font-bold text-heading">Regulatory Screen: </dt><dd className="inline">{Math.round(r.regulatory_screen_score)}%</dd></div>
            )}
            {r.evidence_coverage !== undefined && (
              <div><dt className="inline font-bold text-heading">Evidence Coverage: </dt><dd className="inline">{Math.round(r.evidence_coverage)}%</dd></div>
            )}
            {r.product_scope && (
              <div><dt className="inline font-bold text-heading">Product Scope: </dt><dd className="inline">{humanizeProductScope(r.product_scope)}</dd></div>
            )}
            {r.research_pending_count !== undefined && (
              <div>
                <dt className="inline font-bold text-heading">Evidence research: </dt>
                <dd className="inline">
                  {r.research_pending_count} ingredient{r.research_pending_count === 1 ? " was" : "s were"} queued for automatic PubChem/GRIL processing. Unresolved evidence does not automatically mean unsafe.
                </dd>
              </div>
            )}
            {r.confidence_adjustment !== undefined && (
              <div><dt className="inline font-bold text-heading">Evidence uncertainty adjustment: </dt><dd className="inline">−{r.confidence_adjustment} points</dd></div>
            )}
            {r.safety_score_raw !== undefined && (
              <div><dt className="inline font-bold text-heading">Raw score: </dt><dd className="inline">{r.safety_score_raw}%</dd></div>
            )}
            {r.score_policy_version && (
              <div><dt className="inline font-bold text-heading">Score policy version: </dt><dd className="inline">{r.score_policy_version}</dd></div>
            )}
            {r.engine && (
              <div><dt className="inline font-bold text-heading">Analysis engine: </dt><dd className="inline">{r.engine}</dd></div>
            )}
            {r.edge_version && (
              <div><dt className="inline font-bold text-heading">Processing version: </dt><dd className="inline">{r.edge_version}</dd></div>
            )}
            {r.cache_hit !== undefined && (
              <div><dt className="inline font-bold text-heading">Cached analysis: </dt><dd className="inline">{r.cache_hit ? "Yes" : "No"}</dd></div>
            )}
          </dl>

          {r.evidence_coverage !== undefined && r.evidence_coverage < 80 && (
            <p className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-warn">
              Evidence coverage is incomplete and may still be expanded. Incomplete evidence does not automatically mean a product is unsafe.
            </p>
          )}

          {r.summary && (
            <div><h3 className="font-bold text-heading">Technical summary</h3><p className="mt-1">{r.summary}</p></div>
          )}

          {r.warnings.length > 0 && (
            <div>
              <h3 className="font-bold text-heading">Screening Notes</h3>
              <ul className="mt-1 space-y-1">
                {r.warnings.map((warning, index) => <li key={index}>• {warning}</li>)}
              </ul>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
