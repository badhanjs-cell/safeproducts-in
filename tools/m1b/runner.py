#!/usr/bin/env python3
from __future__ import annotations
import argparse
import json
import urllib.error
import urllib.request
from pathlib import Path

TERMINAL={"QUALIFIED","INSUFFICIENT_EVIDENCE","CONFLICT_REQUIRES_REVIEW"}


def promotion_allowed(run:dict)->bool:
    if run.get("context")!="BENCHMARK":
        return run.get("final_state")=="QUALIFIED"
    return (
        run.get("final_state")=="QUALIFIED"
        and bool(run.get("benchmark_sealed_at"))
        and bool(run.get("displayed_at"))
        and run.get("promotion_status") not in {"PROMOTED","REJECTED"}
    )


def acknowledge_display_and_promote(client, run:dict, session_key:str, render_confirmed:bool):
    if not render_confirmed:
        return {"success":False,"code":"RENDER_CONFIRMATION_REQUIRED"}
    run_id=run.get("run_id")
    if not run_id or not session_key:
        return {"success":False,"code":"RUN_OR_SESSION_REQUIRED"}
    ack=client.ack_display(run_id,session_key)
    if not isinstance(ack,dict) or ack.get("success") is not True:
        return {"success":False,"code":"DISPLAY_ACK_FAILED","detail":ack}
    promote=client.promote(run_id)
    if not isinstance(promote,dict) or promote.get("success") is not True:
        return {"success":False,"code":"PROMOTION_FAILED","detail":promote}
    return promote


def validate_record(row:dict)->list[str]:
    errors=[]
    for key in ("slot_id","split","category","product","m1b_status","m1br_status","final_state"):
        if key not in row: errors.append(f"missing {key}")
    if row.get("split") not in {"DEV","HOLDOUT"}:errors.append("invalid split")
    if row.get("final_state") not in TERMINAL:errors.append("invalid final_state")
    if row.get("final_state")=="QUALIFIED" and not row.get("sealed_at") and not row.get("benchmark_sealed_at"):
        errors.append("qualified benchmark record must be sealed")
    return errors


def validate_manifest_for_execution(manifest:dict, split:str)->list[str]:
    slots=[x for x in manifest.get("slots",[]) if x.get("split")==split]
    expected=30 if split=="DEV" else 120
    errors=[]
    if len(slots)!=expected: errors.append(f"{split} expected {expected} slots; got {len(slots)}")
    for slot in slots:
        product=slot.get("product") or {}
        if slot.get("curation_status") in {None,"UNASSIGNED"} or not product.get("product_fingerprint"):
            errors.append(f"{slot.get('slot_id')}: benchmark product is not curated")
        if slot.get("gold_status") not in {"ADJUDICATED","QUALIFIED","INSUFFICIENT_EVIDENCE","CONFLICT_REQUIRES_REVIEW"}:
            errors.append(f"{slot.get('slot_id')}: human-adjudicated gold is required")
    return errors


class SupabaseRpcClient:
    def __init__(self,base_url:str,api_key:str):
        self.base_url=base_url.rstrip("/")
        self.api_key=api_key
    def _rpc(self,name:str,payload:dict):
        data=json.dumps(payload).encode()
        req=urllib.request.Request(
            f"{self.base_url}/rest/v1/rpc/{name}",data=data,method="POST",
            headers={"apikey":self.api_key,"Authorization":f"Bearer {self.api_key}","Content-Type":"application/json"})
        try:
            with urllib.request.urlopen(req,timeout=10) as response:
                return json.loads(response.read().decode() or "{}")
        except urllib.error.HTTPError as exc:
            return {"success":False,"code":f"HTTP_{exc.code}"}
    def ack_display(self,run_id:str,session_key:str):
        return self._rpc("sp_m1b_ack_benchmark_display_v1",{"p_run_id":run_id,"p_session_key":session_key})
    def promote(self,run_id:str):
        return self._rpc("sp_m1b_promote_after_display_v1",{"p_run_id":run_id})


def load_json(path:str):return json.loads(Path(path).read_text())

def main(argv=None):
    ap=argparse.ArgumentParser()
    sub=ap.add_subparsers(dest="cmd",required=True)
    q=sub.add_parser("preflight");q.add_argument("--manifest",required=True);q.add_argument("--split",choices=("DEV","HOLDOUT"),required=True)
    q=sub.add_parser("validate-records");q.add_argument("--records",required=True)
    args=ap.parse_args(argv)
    if args.cmd=="preflight":
        errors=validate_manifest_for_execution(load_json(args.manifest),args.split)
    else:
        errors=[]
        for n,line in enumerate(Path(args.records).read_text().splitlines(),1):
            if not line.strip():continue
            value=json.loads(line); errors.extend(f"line {n}: {e}" for e in validate_record(value))
    if errors:
        for e in errors[:100]:print(e)
        return 2
    print("M1-B benchmark preflight PASS")
    return 0


if __name__=="__main__":raise SystemExit(main())
