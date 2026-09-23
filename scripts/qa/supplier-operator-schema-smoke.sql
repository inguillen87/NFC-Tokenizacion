-- Run only in the existing empty, schema-only QA branch, after 0115 and 0116.
-- Exercises the real schema and deferred IAM/audit guards. Always rolls back.
-- No passwords, provider calls, usable session tokens or cryptographic keys.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $qa$
DECLARE
  v_tenant uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_operator uuid := gen_random_uuid();
  v_admin_session uuid := gen_random_uuid();
  v_operator_session uuid := gen_random_uuid();
  v_request uuid;
  v_result jsonb;
  v_review_command jsonb;
BEGIN
  IF EXISTS(SELECT 1 FROM public.tenants) OR EXISTS(SELECT 1 FROM public.users)
    OR EXISTS(SELECT 1 FROM public.supplier_requests) THEN
    RAISE EXCEPTION 'empty_schema_only_qa_branch_required';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.schema_migrations WHERE id='20260923180100_0116_supplier_request_assignments.sql') THEN
    RAISE EXCEPTION 'qa_requires_0116';
  END IF;
  -- A schema-only Neon branch contains no baseline catalog seed rows. This
  -- synthetic administrator profile exists only inside this rolled-back test.
  INSERT INTO public.enterprise_role_profiles(code,display_name,tenant_bound,human_session_allowed,default_permissions,active)
  VALUES('super_admin','Synthetic QA administrator',false,true,'["supplier_order.create","supplier_request.assign"]'::jsonb,true)
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO public.tenants(id,slug,name,root_key_ct)
  VALUES(v_tenant,'qa-operator-'||v_tenant::text,'Synthetic operator QA','qa-unused-no-key-material');
  INSERT INTO public.users(id,email,full_name,admin_status) VALUES
    (v_admin,'qa-admin-'||v_admin::text||'@offline.invalid','Synthetic QA administrator','active'),
    (v_operator,'qa-operator-'||v_operator::text||'@offline.invalid','Synthetic QA operator','active');
  INSERT INTO public.memberships(user_id,tenant_id,role) VALUES
    (v_admin,NULL,'super_admin'), (v_operator,NULL,'supplier_operator');
  INSERT INTO public.auth_sessions(id,user_id,tenant_id,role,session_token_hash,expires_at) VALUES
    (v_admin_session,v_admin,NULL,'super_admin','qa-noncredential-'||gen_random_uuid(),now()+interval '5 minutes'),
    (v_operator_session,v_operator,NULL,'supplier_operator','qa-noncredential-'||gen_random_uuid(),now()+interval '5 minutes');
  INSERT INTO public.resource_permissions(user_id,tenant_id,resource,action,effect)
  VALUES(v_operator,NULL,'supplier_requests','assigned_review','allow');
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;
  IF NOT public.nexid_supplier_operator_authorized_v1(v_operator,v_operator_session,'supplier_request.assigned.read')
    OR public.nexid_actor_has_enterprise_capability_v1(v_operator,NULL,'supplier_operator','batch.keys.generate') THEN
    RAISE EXCEPTION 'qa_operator_capability_boundary_failed';
  END IF;
  v_result := public.nexid_mutate_supplier_request_v1(jsonb_build_object(
    'action','create','tenant_id',v_tenant,'actor_id',v_admin,'auth_session_id',v_admin_session,
    'request_id',NULL,'idempotency_key',gen_random_uuid(),'expected_revision',NULL,
    'content',jsonb_build_object('title','Synthetic QA request','construction_id','pet_wet','quantity',1,'pack_purpose','trial_integration','notes','Schema-only QA; no dispatch')));
  IF v_result->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'qa_request_create_failed'; END IF;
  v_request := (v_result#>>'{request,id}')::uuid;
  v_result := public.nexid_mutate_supplier_request_v1(jsonb_build_object(
    'action','submit','tenant_id',v_tenant,'actor_id',v_admin,'auth_session_id',v_admin_session,
    'request_id',v_request,'idempotency_key',gen_random_uuid(),'expected_revision',1,'content',NULL));
  IF v_result->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'qa_request_submit_failed'; END IF;
  v_result := public.nexid_mutate_supplier_request_assignment_v1(jsonb_build_object(
    'tenant_id',v_tenant,'actor_id',v_admin,'auth_session_id',v_admin_session,'request_id',v_request,
    'operator_id',v_operator,'expected_revision',0,'expected_request_revision',2,'idempotency_key',gen_random_uuid()));
  IF v_result->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'qa_assignment_failed'; END IF;
  IF public.nexid_supplier_request_assigned_current_v1(v_request,v_operator,v_operator_session) IS NULL THEN
    RAISE EXCEPTION 'qa_assigned_read_failed';
  END IF;
  v_review_command := jsonb_build_object('tenant_id',v_tenant,'actor_id',v_operator,'auth_session_id',v_operator_session,
    'request_id',v_request,'action','request_information','message','Synthetic QA clarification',
    'expected_revision',0,'expected_request_revision',2,'idempotency_key',gen_random_uuid());
  v_result := public.nexid_mutate_supplier_request_review_v1(v_review_command);
  IF v_result->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'qa_operator_review_failed'; END IF;
  IF public.nexid_mutate_supplier_request_review_v1(v_review_command)->>'idempotent_replay' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'qa_operator_receipt_failed';
  END IF;
  v_result := public.nexid_mutate_supplier_request_assignment_v1(jsonb_build_object(
    'tenant_id',v_tenant,'actor_id',v_admin,'auth_session_id',v_admin_session,'request_id',v_request,
    'operator_id',NULL,'expected_revision',1,'expected_request_revision',2,'idempotency_key',gen_random_uuid()));
  IF v_result->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'qa_unassignment_failed'; END IF;
  IF public.nexid_supplier_request_assigned_current_v1(v_request,v_operator,v_operator_session) IS NOT NULL
    OR public.nexid_supplier_request_assigned_review_v1(v_request,v_operator,v_operator_session) IS NOT NULL
    OR public.nexid_mutate_supplier_request_review_v1(v_review_command)->>'ok' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'qa_revoked_assignment_access_failed';
  END IF;
  SET CONSTRAINTS ALL IMMEDIATE;
END;
$qa$;
SELECT 'full_schema_assignment_review_revocation_passed' AS qa_result;
ROLLBACK;
