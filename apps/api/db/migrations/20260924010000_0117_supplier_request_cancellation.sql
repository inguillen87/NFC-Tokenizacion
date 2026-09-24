-- Forward-only cancellation of a submitted commercial request, never a purchase,
-- provisioned technical order, production batch or physical tag. No data is cancelled
-- by applying this migration. The existing runner owns transactions and the ledger.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.supplier_requests
 ADD COLUMN cancellation_reason text,
 ADD COLUMN cancelled_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
 ADD COLUMN cancelled_at timestamptz;
ALTER TABLE public.supplier_requests DROP CONSTRAINT supplier_requests_status_check;
ALTER TABLE public.supplier_requests ADD CONSTRAINT supplier_requests_status_check
 CHECK(status IN ('draft','submitted','provisioned','cancelled')) NOT VALID;
ALTER TABLE public.supplier_requests DROP CONSTRAINT supplier_requests_check;
ALTER TABLE public.supplier_requests ADD CONSTRAINT supplier_requests_submission_state_check CHECK (
 (status='draft' AND submitted_by IS NULL AND submitted_at IS NULL)
 OR (status IN ('submitted','provisioned','cancelled') AND submitted_by IS NOT NULL AND submitted_at IS NOT NULL
 AND construction_id<>'' AND quantity IS NOT NULL AND pack_purpose IS NOT NULL)) NOT VALID;
ALTER TABLE public.supplier_requests ADD CONSTRAINT supplier_requests_cancellation_check CHECK (
 (status<>'cancelled' AND cancellation_reason IS NULL AND cancelled_by IS NULL AND cancelled_at IS NULL)
 OR (status='cancelled' AND cancelled_by IS NOT NULL AND cancelled_at IS NOT NULL
 AND public.nexid_supplier_request_review_message_valid_v1(cancellation_reason) IS TRUE
 AND cancelled_at>=submitted_at AND cancelled_by=updated_by AND cancelled_at=updated_at)) NOT VALID;
ALTER TABLE public.supplier_request_operations DROP CONSTRAINT supplier_request_operations_action_check;
ALTER TABLE public.supplier_request_operations ADD CONSTRAINT supplier_request_operations_action_check
 CHECK(action IN ('create','patch','submit','cancel')) NOT VALID;
ALTER TABLE public.supplier_requests VALIDATE CONSTRAINT supplier_requests_status_check;
ALTER TABLE public.supplier_requests VALIDATE CONSTRAINT supplier_requests_submission_state_check;
ALTER TABLE public.supplier_requests VALIDATE CONSTRAINT supplier_requests_cancellation_check;
ALTER TABLE public.supplier_request_operations VALIDATE CONSTRAINT supplier_request_operations_action_check;

CREATE OR REPLACE FUNCTION public.nexid_supplier_request_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'supplier_request_immutable'; END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.revision<>OLD.revision+1 OR NEW.updated_at<OLD.updated_at OR OLD.status IN ('provisioned','cancelled')
    OR (OLD.status='draft' AND NEW.status NOT IN ('draft','submitted'))
    OR (OLD.status='submitted' AND (NEW.status NOT IN ('provisioned','cancelled')
      OR ROW(NEW.title,NEW.construction_id,NEW.quantity,NEW.pack_purpose,NEW.notes,NEW.submitted_at,NEW.submitted_by)
        IS DISTINCT FROM ROW(OLD.title,OLD.construction_id,OLD.quantity,OLD.pack_purpose,OLD.notes,OLD.submitted_at,OLD.submitted_by))) THEN
    RAISE EXCEPTION 'supplier_request_immutable';
  END IF;
  IF NEW.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.supplier_orders o WHERE o.id=NEW.order_id AND o.tenant_id=NEW.tenant_id) THEN
    RAISE EXCEPTION 'supplier_request_order_scope_invalid';
  END IF;
  IF NEW.status='cancelled' AND (OLD.status<>'submitted' OR NEW.cancelled_by IS DISTINCT FROM NEW.updated_by
    OR NEW.cancelled_at IS DISTINCT FROM NEW.updated_at) THEN RAISE EXCEPTION 'supplier_request_cancellation_invalid'; END IF;
  RETURN NEW;
END;
$$;

-- The terminal row must have its matching immutable operation AND audit in the
-- same transaction. Direct status updates cannot manufacture a cancelled record.
CREATE FUNCTION public.nexid_supplier_request_cancellation_receipt_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.status='cancelled' AND NOT EXISTS (
 SELECT 1 FROM public.supplier_request_operations o JOIN public.audit_logs a ON a.id=o.audit_id
 WHERE o.tenant_id=NEW.tenant_id AND o.request_id=NEW.id AND o.action='cancel' AND o.revision=NEW.revision
 AND o.actor_id=NEW.cancelled_by AND a.actor_id=NEW.cancelled_by AND a.tenant_id=NEW.tenant_id
 AND a.resource_type='supplier_request' AND a.resource_id=NEW.id::text AND a.action='supplier_request_cancelled'
 AND a.request_id=o.idempotency_key::text
 AND a.after_hash=encode(sha256(convert_to(to_jsonb(NEW)::text,'UTF8')),'hex')) THEN
 RAISE EXCEPTION 'supplier_request_cancellation_receipt_required'; END IF;
 RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER supplier_request_cancellation_receipt_guard
 AFTER INSERT OR UPDATE ON public.supplier_requests DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_request_cancellation_receipt_guard_v1();

CREATE FUNCTION public.nexid_supplier_request_cancellation_actor_v1(p_tenant uuid,p_actor uuid,p_session uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE v_scope uuid;v_role text;
BEGIN
 SELECT s.tenant_id,s.role::text INTO v_scope,v_role FROM public.auth_sessions s JOIN public.users u ON u.id=s.user_id
 JOIN public.memberships m ON m.user_id=u.id AND m.role=s.role AND m.tenant_id IS NOT DISTINCT FROM s.tenant_id
 JOIN public.enterprise_role_profiles p ON p.code=m.role::text
 WHERE s.id=p_session AND s.user_id=p_actor AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
 AND u.admin_status::text='active' AND p.active AND p.human_session_allowed
 AND ((s.role::text='super_admin' AND s.tenant_id IS NULL) OR (s.tenant_id=p_tenant AND p.tenant_bound))
 FOR SHARE OF s,u,m,p;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('resource-permission-scope'||chr(31)||p_actor::text||chr(31)||COALESCE(v_scope::text,'GLOBAL'),0));
 RETURN public.nexid_actor_has_enterprise_capability_v1(p_actor,v_scope,v_role,'supplier_order.create');
END;
$$;

CREATE FUNCTION public.nexid_cancel_supplier_request_v1(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET lock_timeout='5s' AS $$
DECLARE
 v_tenant uuid;v_actor uuid;v_session uuid;v_id uuid;v_key uuid;v_expected integer;v_review integer;v_actual_review integer;
 v_reason text;v_fingerprint text;v_audit uuid;v_before jsonb;v_now timestamptz;
 v_request public.supplier_requests%ROWTYPE;v_operation public.supplier_request_operations%ROWTYPE;
BEGIN
 IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR octet_length(p_input::text)>16384
 OR NOT(p_input ?& ARRAY['tenant_id','actor_id','auth_session_id','request_id','idempotency_key','expected_revision','expected_review_revision','reason'])
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k WHERE k NOT IN ('tenant_id','actor_id','auth_session_id','request_id','idempotency_key','expected_revision','expected_review_revision','reason'))
 THEN RAISE EXCEPTION 'supplier_request_cancellation_input_invalid'; END IF;
 v_tenant:=(p_input->>'tenant_id')::uuid;v_actor:=(p_input->>'actor_id')::uuid;v_session:=(p_input->>'auth_session_id')::uuid;
 v_id:=(p_input->>'request_id')::uuid;v_key:=(p_input->>'idempotency_key')::uuid;
 IF v_tenant IS NULL OR v_actor IS NULL OR v_session IS NULL OR v_id IS NULL OR v_key IS NULL
 OR jsonb_typeof(p_input->'expected_revision') IS DISTINCT FROM 'number'
 OR (p_input->>'expected_revision') !~ '^[1-9][0-9]{0,9}$'
 OR jsonb_typeof(p_input->'expected_review_revision') IS DISTINCT FROM 'number'
 OR (p_input->>'expected_review_revision') !~ '^(0|[1-9][0-9]{0,9})$'
 OR jsonb_typeof(p_input->'reason') IS DISTINCT FROM 'string'
 OR public.nexid_supplier_request_review_message_valid_v1(p_input->>'reason') IS NOT TRUE
 THEN RAISE EXCEPTION 'supplier_request_cancellation_input_invalid'; END IF;
 IF (p_input->>'expected_revision')::numeric>=2147483647 OR (p_input->>'expected_review_revision')::numeric>=2147483647
 THEN RAISE EXCEPTION 'supplier_request_cancellation_input_invalid'; END IF;
 v_expected:=(p_input->>'expected_revision')::integer;v_review:=(p_input->>'expected_review_revision')::integer;v_reason:=btrim(p_input->>'reason');
 -- Match the existing assignment/review lock order: live authority, operation
 -- key, request row, then authority recheck before replay or mutation.
 IF NOT public.nexid_supplier_request_cancellation_actor_v1(v_tenant,v_actor,v_session) THEN
 RETURN jsonb_build_object('ok',false,'reason','supplier_request_scope_forbidden'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant::text||':'||v_key::text,113));
 SELECT * INTO v_request FROM public.supplier_requests WHERE id=v_id AND tenant_id=v_tenant FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_not_found'); END IF;
 IF NOT public.nexid_supplier_request_cancellation_actor_v1(v_tenant,v_actor,v_session) THEN
 RETURN jsonb_build_object('ok',false,'reason','supplier_request_scope_forbidden'); END IF;
 v_fingerprint:=encode(sha256(convert_to(jsonb_build_array('nexid.supplier-request-cancellation.v1',v_tenant,v_actor,v_id,v_expected,v_review,v_reason)::text,'UTF8')),'hex');
 SELECT * INTO v_operation FROM public.supplier_request_operations WHERE tenant_id=v_tenant AND idempotency_key=v_key;
 IF FOUND THEN
 IF v_operation.action<>'cancel' OR v_operation.fingerprint<>v_fingerprint THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_idempotency_conflict'); END IF;
 RETURN jsonb_build_object('ok',true,'idempotent_replay',true,'request',public.nexid_supplier_request_current_v1(v_id,v_tenant),
 'receipt',jsonb_build_object('idempotency_key',v_key,'action','cancel','revision',v_operation.revision)); END IF;
 IF v_request.status<>'submitted' THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_cancellation_not_submitted'); END IF;
 IF v_request.revision<>v_expected THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_revision_conflict'); END IF;
 SELECT COALESCE((SELECT revision FROM public.supplier_request_reviews WHERE tenant_id=v_tenant AND request_id=v_id),0) INTO v_actual_review;
 IF v_actual_review<>v_review THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_review_revision_conflict'); END IF;
 v_before:=to_jsonb(v_request);v_now:=clock_timestamp();v_audit:=gen_random_uuid();
 UPDATE public.supplier_requests SET status='cancelled',revision=revision+1,updated_by=v_actor,updated_at=v_now,
 cancellation_reason=v_reason,cancelled_by=v_actor,cancelled_at=v_now WHERE id=v_id AND tenant_id=v_tenant RETURNING * INTO v_request;
 INSERT INTO public.audit_logs(id,actor_id,tenant_id,action,resource_type,resource_id,before_hash,after_hash,request_id)
 VALUES(v_audit,v_actor,v_tenant,'supplier_request_cancelled','supplier_request',v_id::text,
 encode(sha256(convert_to(v_before::text,'UTF8')),'hex'),encode(sha256(convert_to(to_jsonb(v_request)::text,'UTF8')),'hex'),v_key::text);
 INSERT INTO public.supplier_request_operations(tenant_id,request_id,idempotency_key,actor_id,action,fingerprint,revision,audit_id)
 VALUES(v_tenant,v_id,v_key,v_actor,'cancel',v_fingerprint,v_request.revision,v_audit);
 RETURN jsonb_build_object('ok',true,'idempotent_replay',false,'request',public.nexid_supplier_request_current_v1(v_id,v_tenant),
 'receipt',jsonb_build_object('idempotency_key',v_key,'action','cancel','revision',v_request.revision));
END;
$$;

-- The company and NexID can still read the original clarification history.
-- Assigned operators retain the existing submitted/provisioned-only access:
-- cancelled requests withdraw from their operational inbox without erasing history.
CREATE OR REPLACE FUNCTION public.nexid_supplier_request_review_current_v1(p_request uuid,p_tenant uuid,p_before integer DEFAULT NULL)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
  SELECT jsonb_build_object('request_id',r.id,'request_revision',r.revision,
    'tenant_id',r.tenant_id,'tenant_slug',t.slug,
    'review',jsonb_build_object('state',COALESCE(review.state,'pending'),'revision',COALESCE(review.revision,0),'updated_at',review.updated_at),
    'history',COALESCE(history.items,'[]'::jsonb),'count',COALESCE(history.count,0),
    'truncated',COALESCE(history.first_revision>1,false),
    'next_before_revision',CASE WHEN history.first_revision>1 THEN history.first_revision ELSE NULL END)
  FROM public.supplier_requests r JOIN public.tenants t ON t.id=r.tenant_id
  LEFT JOIN public.supplier_request_reviews review ON review.tenant_id=r.tenant_id AND review.request_id=r.id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('id',e.id,'revision',e.revision,'request_revision',e.request_revision,
      'action',e.action,'message',e.message,'actor_id',e.actor_id,'created_at',e.created_at) ORDER BY e.revision) AS items,
      count(*)::integer AS count,min(e.revision) AS first_revision
    FROM (SELECT * FROM public.supplier_request_review_events WHERE tenant_id=r.tenant_id AND request_id=r.id
      AND (p_before IS NULL OR revision<p_before) ORDER BY revision DESC LIMIT 100) e
  ) history ON true
  WHERE r.id=p_request AND r.tenant_id=p_tenant AND r.status IN ('submitted','provisioned','cancelled');
$$;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_cancellation_receipt_guard_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_cancellation_actor_v1(uuid,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_cancel_supplier_request_v1(jsonb) FROM PUBLIC;

-- Keep responsible-operator history readable for NexID after cancellation.
CREATE OR REPLACE FUNCTION public.nexid_supplier_request_assignment_current_v1(p_request uuid,p_tenant uuid,p_before integer DEFAULT NULL)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('request_id',r.id,'request_revision',r.revision,'tenant_id',r.tenant_id,'tenant_slug',t.slug,
 'assignment',jsonb_build_object('operator_id',a.operator_id,'revision',COALESCE(a.revision,0),'updated_at',a.updated_at),
 'history',COALESCE(h.items,'[]'::jsonb),'count',COALESCE(h.count,0),'truncated',COALESCE(h.first_revision>1,false),
 'next_before_revision',CASE WHEN h.first_revision>1 THEN h.first_revision ELSE NULL END)
 FROM public.supplier_requests r JOIN public.tenants t ON t.id=r.tenant_id LEFT JOIN public.supplier_request_assignments a ON a.request_id=r.id AND a.tenant_id=r.tenant_id
 LEFT JOIN LATERAL(SELECT jsonb_agg(jsonb_build_object('id',e.id,'revision',e.revision,'request_revision',e.request_revision,'action',e.action,'operator_id',e.operator_id,'actor_id',e.actor_id,'created_at',e.created_at) ORDER BY e.revision) items,count(*)::integer count,min(e.revision) first_revision
 FROM(SELECT * FROM public.supplier_request_assignment_events WHERE request_id=r.id AND tenant_id=r.tenant_id AND(p_before IS NULL OR revision<p_before) ORDER BY revision DESC LIMIT 100)e)h ON true
 WHERE r.id=p_request AND r.tenant_id=p_tenant AND r.status IN ('submitted','provisioned','cancelled');
$$;
