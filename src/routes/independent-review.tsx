import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/independent-review")({
  head:()=>({meta:[{title:"Independent Safety Review — SafeProducts"},
    {name:"robots",content:"noindex,nofollow"}]}),
  component:IndependentReviewPage
});

type ReviewRole="CLINICAL"|"REGULATORY";
type CaseItem={id:string;case_key:string;profile:string;scope:string;
  label_facts:Record<string,unknown>;external_evidence_url:string;
  applicable_law_url:string;country_code:string};
type ReviewQueue={role:ReviewRole;cases:CaseItem[];case_count:number;
  blinded_to_candidate_predictions:boolean};

const options:Record<ReviewRole,{value:string;label:string}[]>={
  CLINICAL:[
    {value:"LOW_CONCERN",label:"Low concern (evidence-supported)"},
    {value:"CAUTION",label:"Clinical caution"},
    {value:"HIGH_CONCERN",label:"Clinically high concern / contraindication"}
  ],
  REGULATORY:[
    {value:"PERMITTED",label:"Permitted for this category and jurisdiction"},
    {value:"RESTRICTED",label:"Restricted — applicable limits or warnings"},
    {value:"PROHIBITED",label:"Prohibited in applicable product category"},
    {value:"NOT_APPLICABLE",label:"This regulatory source/category is not applicable"}
  ]
};
function safeSourceUrl(value:string){
  try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password?u.href:null}catch{return null}
}
function IndependentReviewPage(){
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [signedIn,setSignedIn]=useState(false);
 const [queue,setQueue]=useState<ReviewQueue|null>(null);
 const [selected,setSelected]=useState<string>("");
 const [judgment,setJudgment]=useState("");
 const [sourceUrl,setSourceUrl]=useState("");
 const [rationale,setRationale]=useState("");
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);

 async function loadQueue(){
   setLoading(true);
   setQueue(null);
   const user=await supabase.auth.getUser();
   const valid=Boolean(user.data.user&&!user.error);
   setSignedIn(valid);
   if(valid){
     // RPC is credentialed and denies non-reviewers; it never returns candidate predictions.
     const {data,error}=await (supabase as any).rpc("sp_safety_validation_review_queue_v1");
     if(error){setMessage("Access restricted: independent reviewer verification is required.");}
     else if(data?.blinded_to_candidate_predictions===true
       &&["CLINICAL","REGULATORY"].includes(data.role)&&Array.isArray(data.cases)){
       setQueue(data as ReviewQueue);
       setMessage("");
     }else setMessage("No independently credentialed reviewer access is available.");
   }
   setLoading(false);
 }
 useEffect(()=>{void loadQueue();const {data}=supabase.auth.onAuthStateChange((_event,session)=>{
   if(!session){setSignedIn(false);setQueue(null);}
 });return ()=>data.subscription.unsubscribe();},[]);
 async function login(){
  setBusy(true);setMessage("");
  const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
  setPassword("");
  if(error)setMessage("Sign-in unsuccessful. Use the credentials issued through the approved reviewer onboarding process.");
  else await loadQueue();
  setBusy(false);
 }
 async function submitReview(){
  const caseItem=queue?.cases.find(x=>x.id===selected);
  if(!caseItem||!queue||!options[queue.role].some(x=>x.value===judgment)
   ||!safeSourceUrl(sourceUrl)||rationale.trim().length<30){
   setMessage("Select an allowed judgment and supply a HTTPS evidence source and rationale of at least 30 characters.");
   return;
  }
  setBusy(true);setMessage("");
  const {error}=await (supabase as any).rpc("sp_safety_validation_submit_review_v1",{
    p_case:caseItem.id,p_label:judgment,p_evidence_url:safeSourceUrl(sourceUrl),
    p_rationale:rationale.trim()
  });
  if(error)setMessage("The server did not accept this assessment. Check your reviewer authorization, source and evidence rationale.");
  else{
   setSelected("");setJudgment("");setSourceUrl("");setRationale("");
   setMessage("Review recorded as a private, immutable independent judgment; no public Safety Score has changed.");
   await loadQueue();
  }
  setBusy(false);
 }
 const current=queue?.cases.find(c=>c.id===selected);
 return <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
  <h1 className="text-2xl font-bold text-heading">Independent clinical & regulatory review</h1>
  <p className="text-sm text-body">
   Restricted evaluation portal for independently credentialed reviewers. Candidate predictions,
   prior reviewer judgments and scoring outcomes are deliberately hidden.
   This portal does not issue scientific certification or publish consumer scores.
  </p>
  {message&&<p role="status" className="rounded-md border border-divider p-3 text-sm text-body">{message}</p>}
  {loading?<p className="text-sm text-body">Checking reviewer access…</p>:!signedIn?
   <form className="space-y-3 rounded-lg border border-divider p-4" onSubmit={e=>{e.preventDefault();void login();}}>
    <h2 className="font-semibold text-heading">Credentialed reviewer sign-in</h2>
    <label className="block text-sm text-body">Email
      <input autoComplete="username" type="email" required value={email} onChange={e=>setEmail(e.target.value)}
       className="mt-1 block w-full rounded border border-divider bg-background p-2 text-heading"/>
    </label>
    <label className="block text-sm text-body">Password
      <input autoComplete="current-password" type="password" required value={password}
       onChange={e=>setPassword(e.target.value)}
       className="mt-1 block w-full rounded border border-divider bg-background p-2 text-heading"/>
    </label>
    <button type="submit" disabled={busy} className="rounded border border-brand-blue px-4 py-2 text-brand-blue">
      {busy?"Signing in…":"Sign in"}
    </button>
   </form>
  :!queue?<p className="text-sm text-body">This account does not yet have verified independent-reviewer access.</p>
  :<section className="space-y-4">
    <p className="text-sm text-body">Authorized review lane: <strong>{queue.role}</strong>.
      Pending independently frozen cases: {queue.case_count}.
    </p>
    {queue.cases.length===0?<p className="text-sm text-body">
      No assigned frozen cases are currently available. New cases appear only after external benchmark
      preparation, study freeze and prediction lock.
    </p>:<>
      <label className="block text-sm text-body">Choose a frozen benchmark case
        <select value={selected} onChange={e=>{setSelected(e.target.value);setJudgment("");}}
         className="mt-1 block w-full rounded border border-divider bg-background p-2 text-heading">
          <option value="">Select case…</option>
          {queue.cases.map(x=><option key={x.id} value={x.id}>{x.case_key} — {x.scope}, {x.profile}</option>)}
        </select>
      </label>
      {current&&<>
       <div className="space-y-2 rounded-lg border border-divider p-4">
        <h2 className="font-semibold text-heading">Source record — {current.case_key}</h2>
        <p className="text-sm text-body">Jurisdiction: {current.country_code}; scope: {current.scope}; profile: {current.profile}</p>
        <pre className="overflow-auto whitespace-pre-wrap text-xs text-body">{JSON.stringify(current.label_facts,null,2)}</pre>
        {safeSourceUrl(current.external_evidence_url)&&
         <a className="block text-sm text-brand-blue underline" href={safeSourceUrl(current.external_evidence_url)!}
          target="_blank" rel="noopener noreferrer">Review external clinical source</a>}
        {safeSourceUrl(current.applicable_law_url)&&
         <a className="block text-sm text-brand-blue underline" href={safeSourceUrl(current.applicable_law_url)!}
          target="_blank" rel="noopener noreferrer">Review applicable regulatory source</a>}
       </div>
       <label className="block text-sm text-body">Your independent judgment
        <select value={judgment} onChange={e=>setJudgment(e.target.value)}
          className="mt-1 block w-full rounded border border-divider bg-background p-2 text-heading">
         <option value="">Select assessment…</option>
         {options[queue.role].map(x=><option value={x.value} key={x.value}>{x.label}</option>)}
        </select>
       </label>
       <label className="block text-sm text-body">Supporting evidence URL (HTTPS)
        <input type="url" required value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)}
         placeholder="https://official-source.example/..." className="mt-1 block w-full rounded border border-divider bg-background p-2 text-heading"/>
       </label>
       <label className="block text-sm text-body">Evidence-based rationale (minimum 30 characters)
        <textarea value={rationale} required minLength={30} maxLength={2500}
         onChange={e=>setRationale(e.target.value)} rows={5}
         className="mt-1 block w-full rounded border border-divider bg-background p-2 text-heading"/>
       </label>
       <button type="button" disabled={busy} onClick={()=>void submitReview()}
         className="rounded border border-brand-blue px-4 py-2 text-brand-blue">
         {busy?"Submitting…":"Submit immutable review"}
       </button>
      </>}
    </>}
   </section>}
 </main>;
}
