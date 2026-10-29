import { ExternalLink, FileCheck2 } from "lucide-react";
import type { SupplementRegulatoryReviewResult } from "@/lib/labels.functions";

const labels:Record<string,string>={
 REFERENCE_MATCH:"Declared part matches reference",
 VISIBLE:"Visible in submitted photo",
 NOT_VISIBLE:"Not legible in submitted photo",
 REQUIRES_VERIFICATION:"Verification required",
 APPLICABILITY_UNCONFIRMED:"Category not yet confirmed",
};
const hostAllowed=(url:string)=>{
 try{return ["www.fssai.gov.in","fssai.gov.in","www.nin.res.in","nin.res.in","www.icmr.gov.in","icmr.gov.in","www.nccih.nih.gov","nccih.nih.gov"].includes(new URL(url).hostname)&&url.startsWith("https://")}catch{return false}
};
export function SupplementRegulatoryReview({review}:{review:SupplementRegulatoryReviewResult|null|undefined}){
 if(!review||review.review_version!=="SP_SUPPLEMENT_REVIEW_V1"||!Array.isArray(review.checks))return null;
 const headlineKeys=["ashwagandha_plant_part","ashwagandha_daily_usage","category","directions","daily_dose","clinical_precautions"];
 const heads=review.checks.filter(c=>headlineKeys.includes(c.key));
 const other=review.checks.filter(c=>!headlineKeys.includes(c.key));
 const renderCheck=(check:SupplementRegulatoryReviewResult["checks"][number],index:number)=>(
  <div key={check.key+"-"+index} className="rounded-md border border-divider bg-background px-3 py-3">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <strong className="text-xs text-heading">{check.title}</strong>
    <span className="rounded-full border border-divider px-2 py-1 text-[10px] text-body">{labels[check.status]??"Requires review"}</span>
   </div>
   <p className="mt-2 text-xs leading-relaxed text-body">{check.detail}</p>
   {review.references.filter(ref=>ref.key===check.source_key&&hostAllowed(ref.url)).map(ref=>(
    <a key={ref.key} href={ref.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-brand-blue underline">
     {ref.authority}: View official reference <ExternalLink className="h-3 w-3"/>
    </a>
   ))}
  </div>
 );
 return (
  <section className="space-y-4 border-t border-divider pt-5" aria-label="Indian supplement regulation and labelling review">
   <div className="flex items-start gap-2">
    <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue"/>
    <div>
     <h3 className="font-bold text-heading">FSSAI supplement, label and usage review</h3>
     <p className="mt-1 text-xs leading-relaxed text-body">{review.scope_note}</p>
     <p className="mt-2 text-xs text-body">Regulatory classification: <strong className="text-heading">{review.regulatory_category.replaceAll("_"," ")}</strong>. {review.category_confirmed?"Declaration visible; official licence still needs verification.":"The complete package and licensing category have not been verified."}</p>
    </div>
   </div>
   <div className="grid gap-3">{heads.map(renderCheck)}</div>
   <details className="rounded-md border border-divider px-3 py-3">
    <summary className="cursor-pointer text-sm font-bold text-brand-blue">Complete FSSAI labelling and NIN/ICMR checklist ({other.length} additional checks)</summary>
    <div className="mt-3 grid gap-3">{other.map(renderCheck)}</div>
   </details>
   <p className="text-xs text-body">{review.caveat}</p>
  </section>
 );
}
