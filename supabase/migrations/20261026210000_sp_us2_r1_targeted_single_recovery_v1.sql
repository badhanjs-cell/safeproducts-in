-- SP-US2-R1: exact task + product + run recovery, never claims the global backlog.
-- Service-role-only exact claim. No cron or Make production scenario modifications.
BEGIN;
CREATE OR REPLACE FUNCTION public.sp_m1br_targeted_status_v1(
 p_task_id uuid,p_product_id uuid,p_run_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $f$
DECLARE v record;
BEGIN
 SELECT q.id,q.status,q.attempt_count,q.max_attempts,q.next_attempt_at,q.failure_code,
 q.product_id,q.run_id,r.context,r.final_ingredient_status
 INTO v FROM public.sp_m1br_recovery_queue_v1 q
 JOIN public.sp_m1b_run_v1 r ON r.id=q.run_id
 JOIN public.sp_catalog_product_v1 p ON p.id=q.product_id
 WHERE q.id=p_task_id AND q.product_id=p_product_id AND q.run_id=p_run_id
 AND r.product_id=p_product_id AND r.context='NORMAL_SEARCH' AND p.is_active=true;
 IF NOT FOUND THEN RETURN jsonb_build_object('eligible',false,'reason','EXACT_RUN_PRODUCT_TASK_MISMATCH'); END IF;
 RETURN jsonb_build_object('eligible',v.status IN ('PENDING','RETRY')
 AND v.attempt_count=0 AND v.next_attempt_at<=now()
 AND v.attempt_count<v.max_attempts
 AND v.final_ingredient_status IS DISTINCT FROM 'QUALIFIED',
 'task_id',v.id,'product_id',v.product_id,'run_id',v.run_id,'queue_status',v.status,
 'attempt_count',v.attempt_count,'failure_code',v.failure_code,
 'reason',CASE
  WHEN v.status NOT IN ('PENDING','RETRY') THEN 'TASK_NOT_PENDING'
  WHEN v.attempt_count<>0 THEN 'ONE_ATTEMPT_LIMIT_REACHED'
  WHEN v.next_attempt_at>now() THEN 'NOT_DUE'
  WHEN v.attempt_count>=v.max_attempts THEN 'MAX_ATTEMPTS_REACHED'
  WHEN v.final_ingredient_status='QUALIFIED' THEN 'ALREADY_QUALIFIED'
  ELSE 'ELIGIBLE' END);
END $f$;
REVOKE ALL ON FUNCTION public.sp_m1br_targeted_status_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sp_m1br_targeted_status_v1(uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.sp_m1br_claim_targeted_v1(
 p_task_id uuid,p_product_id uuid,p_run_id uuid,p_worker_code text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $f$
DECLARE v public.sp_m1br_recovery_queue_v1%ROWTYPE;
BEGIN
 IF p_task_id IS NULL OR p_product_id IS NULL OR p_run_id IS NULL
    OR p_worker_code<>'M1BR_INGREDIENT_RECOVERY' THEN
  RAISE EXCEPTION 'EXACT_TASK_PRODUCT_RUN_AND_WORKER_REQUIRED' USING errcode='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('SP_US2_R1:'||p_task_id::text,0));
 UPDATE public.sp_m1br_recovery_queue_v1 q SET
 status='IN_PROGRESS',attempt_count=1,locked_at=now(),worker_code=p_worker_code,updated_at=now()
 WHERE q.id=p_task_id AND q.product_id=p_product_id AND q.run_id=p_run_id
  AND q.status IN ('PENDING','RETRY') AND q.attempt_count=0
  AND q.max_attempts>0 AND q.next_attempt_at<=now()
  AND EXISTS (SELECT 1 FROM public.sp_m1b_run_v1 r
    WHERE r.id=p_run_id AND r.product_id=p_product_id AND r.context='NORMAL_SEARCH'
      AND r.final_ingredient_status IS DISTINCT FROM 'QUALIFIED')
  AND EXISTS(SELECT 1 FROM public.sp_catalog_product_v1 p
    WHERE p.id=p_product_id AND p.is_active=true)
  AND NOT EXISTS (SELECT 1 FROM public.sp_m1br_recovery_queue_v1 o
    WHERE o.product_id=p_product_id AND o.id<>p_task_id AND o.status='IN_PROGRESS')
 RETURNING q.* INTO v;
 IF NOT FOUND THEN
  RETURN jsonb_build_object('claimed',false,'reason','EXACT_TARGET_NOT_ELIGIBLE');
 END IF;
 UPDATE public.sp_m1b_run_v1 SET m1br_status='RUNNING',updated_at=now()
 WHERE id=p_run_id AND product_id=p_product_id;
 RETURN jsonb_build_object('claimed',true,'task',
   jsonb_build_object('task_id',v.id,'run_id',v.run_id,'product_id',v.product_id,
    'failure_code',v.failure_code,'payload',v.payload,'attempt_count',v.attempt_count,
    'max_attempts',1));
END $f$;
REVOKE ALL ON FUNCTION public.sp_m1br_claim_targeted_v1(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sp_m1br_claim_targeted_v1(uuid,uuid,uuid,text) TO service_role;

-- Internal manual dispatch, no cron. Credential stays inside existing private worker vault.
-- This function is intentionally callable only by postgres through SQL editor.
CREATE OR REPLACE FUNCTION sp_internal.dispatch_m1br_targeted_v1(
 p_task_id uuid,p_product_id uuid,p_run_id uuid,p_mode text DEFAULT 'PREFLIGHT'
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,sp_internal,net,pg_temp AS $f$
DECLARE v_token text;v_req bigint;v_mode text:=upper(trim(coalesce(p_mode,'')));
BEGIN
 IF v_mode NOT IN ('PREFLIGHT','EXECUTE') THEN
  RAISE EXCEPTION 'MODE_MUST_BE_PREFLIGHT_OR_EXECUTE' USING errcode='22023';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sp_m1br_recovery_queue_v1 q
 JOIN public.sp_m1b_run_v1 r ON r.id=q.run_id
 WHERE q.id=p_task_id AND q.product_id=p_product_id AND q.run_id=p_run_id
 AND r.product_id=p_product_id AND r.context='NORMAL_SEARCH') THEN
  RAISE EXCEPTION 'EXACT_TARGET_NOT_FOUND' USING errcode='22023';
 END IF;
 SELECT token INTO v_token FROM sp_internal.worker_secret_v1
 WHERE worker_code='M1BR_INGREDIENT_RECOVERY';
 IF length(coalesce(v_token,''))<32 THEN
  RAISE EXCEPTION 'RECOVERY_WORKER_CREDENTIAL_NOT_CONFIGURED' USING errcode='22023';
 END IF;
 SELECT net.http_post(
  url=>'https://wmxbdirvlwuagouraobr.supabase.co/functions/v1/sp-m1br-targeted-recovery-v1',
  headers=>jsonb_build_object('Content-Type','application/json','x-sp-worker-token',v_token),
  body=>jsonb_build_object('task_id',p_task_id,'product_id',p_product_id,
    'run_id',p_run_id,'mode',v_mode),
  timeout_milliseconds=>case when v_mode='PREFLIGHT' then 15000 else 175000 end
 ) INTO v_req;
 RETURN v_req;
END $f$;
REVOKE ALL ON FUNCTION sp_internal.dispatch_m1br_targeted_v1(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;