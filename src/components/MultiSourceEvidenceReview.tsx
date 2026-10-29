import type { MultiSourceSafetyReviewResult } from "@/lib/labels.functions";

const statusText:Record<string,string>={
  PROFILE_CAUTION:"Profile-specific caution",
  EVIDENCE_CAUTION:"Ingredient concerns identified",
  EVIDENCE_PARTIAL:"Partial source coverage",
  NO_APPLICABLE_EVIDENCE:"No applicable source records"
};
export function MultiSourceEvidenceReview({review}:{review:MultiSourceSafetyReviewResult|null|undefined}){
  if(!review||review.version!=="SP_MULTI_SOURCE_EVIDENCE_V1")return null;
  return (
    <section className="space-y-3 rounded-lg border border-divider p-4" aria-label="Independent multi-source ingredient evidence">
      <h3 className="font-bold text-heading">Ingredient safety evidence — source-linked</h3>
      <p className="text-sm font-semibold text-heading">{statusText[review.assessment_band]??"Evidence review"}</p>
      <p className="text-xs text-body">
        {review.matched_ingredient_count} of {review.assessable_ingredient_count} named ingredients
        have at least one relevant reference ({review.ingredient_evidence_coverage}% ingredient evidence coverage;
        {review.source_count} distinct source{review.source_count===1?"":"s"}).
      </p>
      <p className="text-xs text-body">
        Coverage here measures whether a named ingredient has a cited reference. It is not a regulatory
        clearance percentage, product safety probability, or a verified product Safety Score.
      </p>
      {review.evidence.length>0&&(
        <div className="space-y-2">
          {review.evidence.map(item=>(
            <div key={item.id+"-"+item.ingredient} className="rounded-md border border-divider p-3">
              <p className="text-sm font-semibold text-heading">{item.canonical}</p>
              <p className="text-xs text-body">{item.summary}</p>
              <p className="mt-1 text-xs text-body">{item.context}</p>
              {item.requires_exposure&&<p className="mt-1 text-xs font-semibold text-warn">Confirm daily dose, route and individual circumstances.</p>}
              <a href={item.source.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-brand-blue underline">
                {item.source.authority}: View scientific evidence
              </a>
            </div>
          ))}
        </div>
      )}
      {review.unresolved_ingredients.length>0&&(
        <details>
          <summary className="cursor-pointer text-xs font-bold text-brand-blue">
            Ingredients without applicable references ({review.unresolved_ingredients.length})
          </summary>
          <ul className="mt-2 list-disc pl-5 text-xs text-body">
            {review.unresolved_ingredients.map((v,i)=><li key={i}>{v}</li>)}
          </ul>
        </details>
      )}
      {review.disclosure_gaps.length>0&&(
        <p className="text-xs text-body">Undisclosed groups need separate verification: {review.disclosure_gaps.join("; ")}.</p>
      )}
      <details>
        <summary className="cursor-pointer text-xs font-bold text-brand-blue">Source policy, evidence gaps and limitations</summary>
        <p className="mt-2 text-xs text-body">{review.methodology}</p>
        <ul className="mt-2 list-disc pl-5 text-xs text-body">
          {review.warnings.map((v,i)=><li key={i}>{v}</li>)}
        </ul>
      </details>
      <p className="text-xs font-semibold text-warn">
        Curated pilot evidence — not yet independently validated for a numerical product Safety Score.
      </p>
    </section>
  );
}
