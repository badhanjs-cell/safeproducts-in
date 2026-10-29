import { MultiSourceEvidenceReview } from "@/components/MultiSourceEvidenceReview";
import { ClinicalSafetyScreen } from "@/components/ClinicalSafetyScreen";
import { SupplementRegulatoryReview } from "@/components/SupplementRegulatoryReview";
import { AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import type { PendingLabelResult } from "@/lib/labels.functions";

export function LabelPendingResult({ r, onReset }: { r: PendingLabelResult; onReset: () => void }) {
  const deeper = r.status === "DEEPER_VERIFICATION_IN_PROGRESS";
  const conflict = r.status === "CONFLICT_REQUIRES_REVIEW";
  const clinicalAvailable = r.clinical_screen?.status === "PROVISIONAL_CLINICAL_SCREEN";
  const title = deeper
    ? "Unable to finish this label analysis"
    : conflict
      ? "Ingredient evidence needs review"
      : clinicalAvailable ? "Clinical screening available — full product safety unverified" : "Ingredients recognized — safety evidence unavailable";

  return (
    <div className="space-y-6 rounded-lg border border-divider bg-card p-5">
      <div className="rounded-lg border border-divider bg-background px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-blue">{r.brand_name}</p>
        <h2 className="mt-1 text-lg font-bold text-heading">{r.product_name}</h2>
        {r.variant && <p className="mt-1 text-xs text-body">{r.variant}</p>}
        {r.pack_size_text && <p className="mt-1 text-xs text-body">Pack: {r.pack_size_text}</p>}
      </div>

      <div className="rounded-lg border border-warn/40 bg-warn/10 p-4">
        <div className="flex items-start gap-3">
          {deeper ? <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-warn" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" />}
          <div>
            <p className="text-sm font-bold text-heading">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-body">
              {r.summary || "SafeProducts is withholding the Safety Score until the required ingredient and regulatory evidence is complete."}
            </p>
          </div>
        </div>
      </div>

      {r.detected_ingredients.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-bold text-heading">Ingredients read from this label</h3>
          <div className="flex flex-wrap gap-2">
            {r.detected_ingredients.map((ingredient) => (
              <span key={ingredient} className="rounded-full border border-divider bg-background px-3 py-1 text-xs text-body">
                {ingredient}
              </span>
            ))}
          </div>
        </div>
      )}

      {r.ingredient_breakdown.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-heading">What the assessment could verify</h3>
          {r.ingredient_breakdown.map((row, i) => (
            <div key={i} className="rounded-md border border-divider bg-background p-3 text-xs text-body">
              <strong className="text-heading">{row.name}</strong>
              <span className="ml-2 font-semibold">({row.status})</span>
              <p className="mt-1 leading-relaxed">{row.details}</p>
            </div>
          ))}
        </div>
      )}
      {r.evidence_coverage !== undefined && (
        <p className="text-xs text-body">Applicable regulatory evidence coverage: {Math.round(r.evidence_coverage)}%. An unverified ingredient is not automatically unsafe.</p>
      )}
      {r.warnings.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-body">
          {r.warnings.map((warning,i)=><li key={i}>{warning}</li>)}
        </ul>
      )}
      {r.catalog_sync_status === "SYNCED" && (
        <div className="flex items-start gap-2 text-xs text-body">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-safe" />
          <span>Product identity and label evidence were saved for continued verification.</span>
        </div>
      )}

      <MultiSourceEvidenceReview review={r.multi_source_review} />
      <ClinicalSafetyScreen screen={r.clinical_screen} />
      <SupplementRegulatoryReview review={r.supplement_review} />

      <div className="rounded-md border border-divider bg-background px-4 py-3 text-xs leading-relaxed text-body">
        No Safety Score is shown for this pending result. The supporting regulatory evidence is insufficient. The ingredients and disclosure gaps are listed above; missing evidence is not a finding that the product is safe or unsafe.
      </div>

      <button
        type="button"
        onClick={onReset}
        className="rounded-md border border-brand-blue px-4 py-2 text-sm font-bold text-brand-blue hover:bg-brand-blue hover:text-primary-foreground"
      >
        Analyse Another
      </button>
    </div>
  );
}
