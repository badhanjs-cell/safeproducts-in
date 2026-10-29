#!/usr/bin/env python3
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path
from typing import Iterable

QUALIFIED="QUALIFIED"
RECOVERY_TERMINAL={"QUALIFIED","INSUFFICIENT_EVIDENCE","CONFLICT_REQUIRES_REVIEW","FAILED"}


def _rate(num:int,den:int)->float:
    return round(num/den,10) if den else 0.0


def _percentile(values:Iterable[float],q:float):
    vals=sorted(float(v) for v in values if isinstance(v,(int,float)) and math.isfinite(float(v)) and float(v)>=0)
    if not vals:return None
    if len(vals)==1:return vals[0]
    pos=(len(vals)-1)*q
    lo=math.floor(pos); hi=math.ceil(pos)
    if lo==hi:return vals[lo]
    return vals[lo]+(vals[hi]-vals[lo])*(pos-lo)


def summarize(rows:list[dict])->dict:
    total=len(rows)
    m1b_q=sum(r.get("m1b_status")==QUALIFIED for r in rows)
    eligible_for_recovery=sum(r.get("m1b_status")!=QUALIFIED for r in rows)
    m1br_q=sum(r.get("m1b_status")!=QUALIFIED and r.get("m1br_status")==QUALIFIED for r in rows)
    combined=sum(r.get("final_state")==QUALIFIED for r in rows)
    human=sum(bool(r.get("human_review_required")) or r.get("final_state")=="CONFLICT_REQUIRES_REVIEW" for r in rows)
    unsupported=sum(max(int(r.get("unsupported_ingredient_count") or 0),0) for r in rows)
    conflicts=sum(r.get("final_state")=="CONFLICT_REQUIRES_REVIEW" for r in rows)
    promotions=sum(r.get("promotion_status")=="PROMOTED" for r in rows)
    lat=[r.get("latency_ms") for r in rows]
    total_cost=sum(float(r.get("cost_usd") or 0) for r in rows if isinstance(r.get("cost_usd",0),(int,float)))
    recovered_cost=sum(float(r.get("cost_usd") or 0) for r in rows
                       if r.get("m1b_status")!=QUALIFIED and r.get("m1br_status")==QUALIFIED
                       and isinstance(r.get("cost_usd",0),(int,float)))
    return {
      "product_count":total,
      "m1b_qualified_count":m1b_q,
      "m1br_qualified_count":m1br_q,
      "combined_qualified_count":combined,
      "m1b_success_rate":_rate(m1b_q,total),
      "m1br_recovery_rate":_rate(m1br_q,eligible_for_recovery),
      "combined_qualification_rate":_rate(combined,total),
      "m1br_absolute_lift":round(_rate(combined,total)-_rate(m1b_q,total),10),
      "human_review_rate":_rate(human,total),
      "review_referral_count":human,
      "conflict_count":conflicts,
      "unsupported_ingredient_count":unsupported,
      "p50_latency_ms":_percentile(lat,0.50),
      "p95_latency_ms":_percentile(lat,0.95),
      "cost_usd_total":round(total_cost,6),
      "cost_per_recovery_usd":round(recovered_cost/m1br_q,6) if m1br_q else None,
      "cache_promotion_count":promotions,
    }


def side_by_side(rows:list[dict], baseline:dict|None=None)->dict:
    current=summarize(rows)
    return {
      "historical_baseline":baseline or {},
      "m1b":{
        "qualified_count":current["m1b_qualified_count"],
        "success_rate":current["m1b_success_rate"],
      },
      "m1br_incremental":{
        "qualified_count":current["m1br_qualified_count"],
        "recovery_rate":current["m1br_recovery_rate"],
        "absolute_lift":current["m1br_absolute_lift"],
        "cost_per_recovery_usd":current["cost_per_recovery_usd"],
      },
      "combined":current,
      "human_review":{"rate":current["human_review_rate"],"count":current["review_referral_count"]},
    }


def _load_jsonl(path:str)->list[dict]:
    rows=[]
    for n,line in enumerate(Path(path).read_text().splitlines(),1):
        if not line.strip():continue
        value=json.loads(line)
        if not isinstance(value,dict):raise ValueError(f"{path}:{n}: object required")
        rows.append(value)
    return rows


def main(argv=None):
    ap=argparse.ArgumentParser()
    ap.add_argument("--records",required=True)
    ap.add_argument("--baseline")
    ap.add_argument("--output",required=True)
    args=ap.parse_args(argv)
    rows=_load_jsonl(args.records)
    baseline=json.loads(Path(args.baseline).read_text()) if args.baseline else None
    out=side_by_side(rows,baseline)
    Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    Path(args.output).write_text(json.dumps(out,indent=2,sort_keys=True)+"\n")
    return 0


if __name__=="__main__":raise SystemExit(main())
