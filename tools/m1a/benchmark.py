#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, math, re, sys, unicodedata
from collections import Counter, defaultdict
from pathlib import Path

FREEZE="2a5e7a30f2a670d0d1b3337bf27203cf37dd1c79"
SUPABASE="wmxbdirvlwuagouraobr"
CATEGORIES=("cosmetics","personal_care","baby_products","supplements","nutraceuticals","special_dietary")
OUTCOMES={"QUALIFIED","INSUFFICIENT_EVIDENCE","CONFLICT_REQUIRES_REVIEW"}

class ContractError(ValueError): pass

def norm(s):
    s=unicodedata.normalize("NFKC",s or "").strip().lower().replace("–","-").replace("—","-")
    s=re.sub(r"\s+"," ",s); return re.sub(r"\s*([(),:/+])\s*",r"\1",s)

def manifest():
    slots=[]
    for cat in CATEGORIES:
        pre=cat.upper().replace("_","-")
        for i in range(1,26):
            split="DEV" if i<=5 else "HOLDOUT"; n=i if i<=5 else i-5
            slots.append({"slot_id":f"{pre}-{split}-{n:03d}","category":cat,"split":split,
              "product":{"product_fingerprint":None,"product_name":None,"brand_name":None,"market":"IN",
                         "barcode_or_gtin":None,"variant":None},
              "difficulty_tags":[],"curation_status":"UNASSIGNED","gold_status":"UNASSIGNED"})
    return {"manifest_version":"1.0.0","canonical_homepage_freeze_commit":FREEZE,
            "canonical_supabase_project_ref":SUPABASE,"production_write_allowed":False,"slots":slots}

def validate_manifest(m):
    e=[]
    if m.get("canonical_homepage_freeze_commit")!=FREEZE:e.append("freeze mismatch")
    if m.get("canonical_supabase_project_ref")!=SUPABASE:e.append("Supabase ref mismatch")
    if m.get("production_write_allowed") is not False:e.append("production_write_allowed must be false")
    slots=m.get("slots",[])
    if len(slots)!=150:e.append(f"expected 150 slots; got {len(slots)}")
    ids=set(); c=Counter(); s=Counter(); cs=Counter()
    for x in slots:
        sid=x.get("slot_id"); cat=x.get("category"); split=x.get("split")
        if not sid or sid in ids:e.append(f"duplicate/missing slot {sid}")
        ids.add(sid); c[cat]+=1;s[split]+=1;cs[(cat,split)]+=1
    for cat in CATEGORIES:
        if c[cat]!=25 or cs[(cat,"DEV")]!=5 or cs[(cat,"HOLDOUT")]!=20:e.append(f"{cat} quota mismatch")
    if s["DEV"]!=30 or s["HOLDOUT"]!=120:e.append("split quota mismatch")
    if e: raise ContractError("; ".join(e))

def loadj(p): return json.loads(Path(p).read_text())
def loadjl(p):
    out=[]
    for n,line in enumerate(Path(p).read_text().splitlines(),1):
        if line.strip():
            try:v=json.loads(line)
            except Exception as ex:raise ContractError(f"{p}:{n}: {ex}")
            if not isinstance(v,dict):raise ContractError(f"{p}:{n}: object required")
            out.append(v)
    return out
def index(rows,label):
    d={}
    for r in rows:
        sid=r.get("slot_id")
        if not sid or sid in d:raise ContractError(f"{label}: duplicate/missing slot_id {sid}")
        d[sid]=r
    return d
def sources(r): return {s.get("source_id") for s in (r.get("sources") or []) if isinstance(s,dict) and s.get("source_id")}
def names(r): return [norm(i.get("normalized") or i.get("name")) for i in (r.get("ingredients") or []) if isinstance(i,dict) and (i.get("normalized") or i.get("name"))]
def evidence_errors(r,label):
    e=[]; sid=r.get("slot_id"); out=r.get("outcome")
    if out not in OUTCOMES:e.append(f"{label}:{sid}: invalid outcome")
    ing=r.get("ingredients") or []; src=sources(r)
    if out=="QUALIFIED" and not ing:e.append(f"{label}:{sid}: QUALIFIED requires ingredients")
    for j,i in enumerate(ing):
        refs=i.get("source_refs") if isinstance(i,dict) else None
        if not refs:e.append(f"{label}:{sid}: ingredient[{j}] has no source_refs")
        elif any(x not in src for x in refs):e.append(f"{label}:{sid}: unknown source ref")
    return e
def lcs(a,b):
    p=[0]*(len(b)+1)
    for x in a:
        q=[0]
        for j,y in enumerate(b,1):q.append(p[j-1]+1 if x==y else max(p[j],q[j-1]))
        p=q
    return p[-1]
def mean(v):return sum(v)/len(v) if v else None

def score(m,grows,prows,split):
    validate_manifest(m); slots={x["slot_id"]:x for x in m["slots"] if split=="ALL" or x["split"]==split}
    g=index(grows,"gold"); p=index(prows,"prediction")
    missg=set(slots)-set(g); missp=set(slots)-set(p)
    if missg or missp:raise ContractError(f"missing gold={len(missg)} predictions={len(missp)}")
    errs=[]
    for sid in slots:errs+=evidence_errors(g[sid],"gold")+evidence_errors(p[sid],"prediction")
    if errs:raise ContractError("; ".join(errs[:30]))
    tp=fp=fn=oc=at=ac=ct=cc=prov=provt=vlm=down=downs=0; order=[]; lat=[]; cost=[]; bc=defaultdict(Counter)
    for sid,slot in slots.items():
        a,b=g[sid],p[sid]; go,po=a["outcome"],b["outcome"]; cat=slot["category"];bc[cat]["n"]+=1
        if go==po:oc+=1;bc[cat]["oc"]+=1
        if go!="QUALIFIED":at+=1;ac+=po!="QUALIFIED"
        if go=="CONFLICT_REQUIRES_REVIEW":ct+=1;cc+=po==go
        src=sources(b)
        for i in b.get("ingredients") or []:
            provt+=1; refs=i.get("source_refs") or [];prov+=bool(refs) and all(x in src for x in refs)
        if go=="QUALIFIED":
            ga,pa=names(a),names(b) if po=="QUALIFIED" else [];cg,cp=Counter(ga),Counter(pa);ov=cg&cp
            T=sum(ov.values());F=sum((cp-cg).values());N=sum((cg-cp).values());tp+=T;fp+=F;fn+=N
            bc[cat]["tp"]+=T;bc[cat]["fp"]+=F;bc[cat]["fn"]+=N;order.append(lcs(ga,pa)/max(len(ga),len(pa),1))
        x=b.get("latency_ms")
        if isinstance(x,(int,float)) and x>=0 and math.isfinite(float(x)):lat.append(float(x))
        x=b.get("cost_usd")
        if isinstance(x,(int,float)) and x>=0 and math.isfinite(float(x)):cost.append(float(x))
        x=b.get("vlm_calls",0);vlm+=x if isinstance(x,int) and x>=0 else 0
        if po=="QUALIFIED":down+=1;downs+=b.get("downstream_qualified") is True
    precision=tp/(tp+fp) if tp+fp else 0.; recall=tp/(tp+fn) if tp+fn else 0.; f1=2*precision*recall/(precision+recall) if precision+recall else 0.
    by={}
    for cat in CATEGORIES:
        z=bc[cat]; pr=z["tp"]/(z["tp"]+z["fp"]) if z["tp"]+z["fp"] else 0.;rc=z["tp"]/(z["tp"]+z["fn"]) if z["tp"]+z["fn"] else 0.
        by[cat]={"products":z["n"],"ingredient_precision":pr,"ingredient_recall":rc,"outcome_accuracy":z["oc"]/z["n"] if z["n"] else 0.}
    n=len(slots)
    return {"schema_version":"1.0.0","split":split,"product_count":n,"ingredient_true_positive":tp,
      "unsupported_ingredient_count":fp,"missed_ingredient_count":fn,"ingredient_precision":precision,
      "ingredient_recall":recall,"ingredient_f1":f1,"ingredient_order_lcs_ratio_mean":mean(order),
      "provenance_coverage":prov/provt if provt else 1.,"outcome_accuracy":oc/n if n else 0.,
      "abstention_accuracy":ac/at if at else 1.,"conflict_accuracy":cc/ct if ct else 1.,
      "latency_ms_mean":mean(lat),"cost_usd_mean":mean(cost),"vlm_calls_total":vlm,"vlm_calls_per_product":vlm/n if n else 0.,
      "downstream_qualification_success":downs/down if down else 1.,"by_category":by}

def compare(a,b):
    if a.get("split")!="HOLDOUT" or b.get("split")!="HOLDOUT":raise ContractError("HOLDOUT metrics required")
    c={"provenance_coverage_is_100_percent":b["provenance_coverage"]>=1.,
       "unsupported_ingredient_count_is_zero":b["unsupported_ingredient_count"]==0,
       "precision_not_below_baseline":b["ingredient_precision"]>=a["ingredient_precision"],
       "recall_exceeds_baseline":b["ingredient_recall"]>a["ingredient_recall"],
       "abstention_accuracy_not_below_baseline":b["abstention_accuracy"]>=a["abstention_accuracy"],
       "conflict_accuracy_not_below_baseline":b["conflict_accuracy"]>=a["conflict_accuracy"],
       "downstream_qualification_success_not_below_baseline":b["downstream_qualification_success"]>=a["downstream_qualification_success"]}
    return {"schema_version":"1.0.0","decision":"PASS" if all(c.values()) else "FAIL","checks":c,"baseline":a,"candidate":b}

def write(p,v):Path(p).parent.mkdir(parents=True,exist_ok=True);Path(p).write_text(json.dumps(v,indent=2,sort_keys=True)+"\n")
def main(argv=None):
    ap=argparse.ArgumentParser();sp=ap.add_subparsers(dest="cmd",required=True)
    q=sp.add_parser("init-manifest");q.add_argument("--output",required=True)
    q=sp.add_parser("validate-manifest");q.add_argument("--manifest",required=True)
    q=sp.add_parser("score");q.add_argument("--manifest",required=True);q.add_argument("--gold",required=True);q.add_argument("--predictions",required=True);q.add_argument("--split",choices=("DEV","HOLDOUT","ALL"),required=True);q.add_argument("--output",required=True)
    q=sp.add_parser("compare");q.add_argument("--baseline",required=True);q.add_argument("--candidate",required=True);q.add_argument("--output",required=True)
    a=ap.parse_args(argv)
    try:
        if a.cmd=="init-manifest":m=manifest();validate_manifest(m);write(a.output,m)
        elif a.cmd=="validate-manifest":validate_manifest(loadj(a.manifest))
        elif a.cmd=="score":write(a.output,score(loadj(a.manifest),loadjl(a.gold),loadjl(a.predictions),a.split))
        else:
            v=compare(loadj(a.baseline),loadj(a.candidate));write(a.output,v)
            if v["decision"]!="PASS":return 2
        return 0
    except ContractError as e:print(f"M1-A contract failure: {e}",file=sys.stderr);return 2

generate_manifest=manifest
validate_evidence_record=evidence_errors
compare_metrics=compare

if __name__=="__main__":raise SystemExit(main())
