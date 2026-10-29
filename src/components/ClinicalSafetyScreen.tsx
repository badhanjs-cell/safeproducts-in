import type { ClinicalSafetyScreenResult } from "@/lib/labels.functions";
export function ClinicalSafetyScreen({screen}:{screen:ClinicalSafetyScreenResult|null|undefined}){
 if(!screen||screen.version!=="SP_CLINICAL_SCREEN_V1")return null;
 const score=screen.score;
 return (
  <section aria-label="Independent clinical safety screening" className="space-y-3 rounded-lg border border-divider bg-card p-4">
   <h3 className="text-base font-bold text-heading">Clinical safety screening — source-backed</h3>
   {screen.status==="AVOID_FOR_PROFILE"?
     <p className="font-bold text-warn">Avoid for selected profile — no numerical score</p>:
    score!==null?<p className="text-xl font-bold text-heading">Provisional clinical screen: {Math.round(score)}/100</p>:
     <p className="font-bold text-heading">Clinical score needs further exposure information</p>}
   <p className="text-sm text-body">{screen.summary}</p>
   <p className="text-xs font-semibold text-warn">This is not a qualified finished-product Safety Score, a prediction of individual risk, or confirmation of regulatory compliance.</p>
   <h4 className="text-sm font-bold text-heading">Evidence-based clinical risk signals</h4>
   <div className="space-y-2">
    {screen.signals.map(s=>(
      <div key={s.key} className="rounded-md border border-divider px-3 py-2">
       <p className="text-sm text-body">{s.finding}</p>
       <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-blue underline">NIH-NCCIH source</a>
       {score!==null&&<p className="mt-1 text-xs text-body">Screening policy adjustment: −{s.points} points</p>}
      </div>
    ))}
   </div>
   <details>
    <summary className="cursor-pointer text-xs font-bold text-brand-blue">Scoring methodology and evidence limitations</summary>
    <p className="mt-2 text-xs leading-relaxed text-body">{screen.methodology}</p>
    <ul className="mt-2 list-disc pl-5 text-xs text-body">
     {screen.unknowns.map((u,i)=><li key={i}>{u}</li>)}
    </ul>
    <p className="mt-2 text-xs text-body">Clinical evidence and regulatory evidence coverage are tracked separately.</p>
   </details>
  </section>
 );
}
