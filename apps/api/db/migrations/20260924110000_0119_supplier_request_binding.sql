-- Supplier/specification routing within the existing request -> technical order
-- workflow. No contacts, messages, purchases, exports, keys or QA approvals are
-- created by this migration. Existing unlinked orders retain lifecycle v1.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TABLE public.supplier_request_binding_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
 request_id uuid NOT NULL, order_id uuid NOT NULL REFERENCES public.supplier_orders(id) ON DELETE RESTRICT,
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 2147483646), request_revision integer NOT NULL CHECK(request_revision>0),
 action text NOT NULL CHECK(action IN ('assign','withdraw')),
 supplier_ref text NOT NULL CHECK(supplier_ref ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$'),
 supplier_name text NOT NULL CHECK(char_length(supplier_name)<=200 AND public.nexid_supplier_request_review_message_valid_v1(supplier_name) IS TRUE),
 confirmation_ref text NOT NULL CHECK(char_length(confirmation_ref)<=240 AND public.nexid_supplier_request_review_message_valid_v1(confirmation_ref) IS TRUE),
 spec_revision integer NOT NULL CHECK(spec_revision>0), spec_hash text NOT NULL CHECK(spec_hash ~ '^sha256:[0-9a-f]{64}$'),
 spec_decision_id uuid NOT NULL REFERENCES public.supplier_packaging_governance_decisions(id) ON DELETE RESTRICT,
 reason text NOT NULL CHECK(char_length(reason)<=1000 AND public.nexid_supplier_request_review_message_valid_v1(reason) IS TRUE),
 actor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT, auth_session_id uuid NOT NULL REFERENCES public.auth_sessions(id) ON DELETE RESTRICT,
 idempotency_key uuid NOT NULL, fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
 audit_id uuid NOT NULL UNIQUE REFERENCES public.audit_logs(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL,
 FOREIGN KEY(tenant_id,request_id) REFERENCES public.supplier_requests(tenant_id,id) ON DELETE RESTRICT,
 UNIQUE(tenant_id,request_id,revision),UNIQUE(tenant_id,idempotency_key)
);
CREATE INDEX supplier_binding_order_idx ON public.supplier_request_binding_events(order_id,revision DESC);
ALTER TABLE public.supplier_order_lifecycle_receipts ADD COLUMN supplier_binding_event_id uuid REFERENCES public.supplier_request_binding_events(id) ON DELETE RESTRICT;

-- An approved label alone is insufficient: the immutable packaging receipt must
-- match the current order's tenant, revision, hash, snapshot and evidence.
CREATE FUNCTION public.nexid_supplier_binding_spec_v1(p_order uuid,p_tenant uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('status',o.packaging_governance_status,'revision',o.packaging_spec_revision,
 'hash',o.packaging_spec_hash,'decision_id',d.id,'ready',d.id IS NOT NULL)
 FROM public.supplier_orders o LEFT JOIN public.supplier_packaging_governance_decisions d ON d.supplier_order_id=o.id AND d.tenant_id=o.tenant_id
 AND d.spec_revision=o.packaging_spec_revision AND d.decision_status='approved' AND o.packaging_governance_status='approved'
 AND d.spec_hash=o.packaging_spec_hash AND d.spec_snapshot=o.packaging_spec_snapshot AND d.evidence_refs=o.packaging_evidence_refs
 AND d.validation_snapshot=o.packaging_validation_snapshot AND lower(d.carrier_profile_code)=lower(o.carrier_profile_code)
 AND o.packaging_validation_snapshot->>'validator'='validateSupplierPackagingSpec' AND o.packaging_validation_snapshot->>'validatorVersion'='1'
 AND o.packaging_validation_snapshot->'ok'='true'::jsonb AND o.packaging_validation_snapshot->'productionReady'='true'::jsonb
 AND d.decided_by=o.packaging_approved_by AND d.decided_at=o.packaging_approved_at
 WHERE o.id=p_order AND o.tenant_id=p_tenant;
$$;
CREATE FUNCTION public.nexid_supplier_binding_public_v1(e public.supplier_request_binding_events)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('id',e.id,'revision',e.revision,'request_revision',e.request_revision,'order_id',e.order_id,'action',e.action,
 'supplier',jsonb_build_object('reference',e.supplier_ref,'name',e.supplier_name,'confirmation_ref',e.confirmation_ref),
 'spec',jsonb_build_object('revision',e.spec_revision,'hash',e.spec_hash,'decision_id',e.spec_decision_id),
 'reason',e.reason,'actor_id',e.actor_id,'created_at',e.created_at);
$$;
CREATE FUNCTION public.nexid_supplier_binding_current_v1(p_request uuid,p_tenant uuid,p_before integer DEFAULT NULL)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('request_id',r.id,'request_revision',r.revision,'tenant_id',r.tenant_id,'tenant_slug',t.slug,
 'order',jsonb_build_object('id',o.id,'status',o.status,'pack_purpose',o.pack_purpose),'specification',public.nexid_supplier_binding_spec_v1(o.id,r.tenant_id),
 'revision',COALESCE(e.revision,0),'current',CASE WHEN e.id IS NOT NULL THEN public.nexid_supplier_binding_public_v1(e) ELSE NULL END,
 'history',COALESCE(h.items,'[]'::jsonb),'count',COALESCE(h.count,0),'truncated',COALESCE(h.first>1,false),
 'next_before_revision',CASE WHEN h.first>1 THEN h.first ELSE NULL END,'as_of',clock_timestamp(),
 'dispatch_receipt',CASE WHEN receipt.id IS NOT NULL THEN jsonb_build_object('id',receipt.id,'created_at',receipt.created_at,'binding_event_id',receipt.supplier_binding_event_id) ELSE NULL END)
 FROM public.supplier_requests r JOIN public.tenants t ON t.id=r.tenant_id JOIN public.supplier_orders o ON o.id=r.order_id AND o.tenant_id=r.tenant_id
 LEFT JOIN LATERAL(SELECT * FROM public.supplier_request_binding_events WHERE request_id=r.id AND tenant_id=r.tenant_id ORDER BY revision DESC LIMIT 1)e ON true
 LEFT JOIN LATERAL(SELECT jsonb_agg(public.nexid_supplier_binding_public_v1(v) ORDER BY revision)items,count(*)::int count,min(revision)first
 FROM(SELECT * FROM public.supplier_request_binding_events WHERE request_id=r.id AND tenant_id=r.tenant_id AND(p_before IS NULL OR revision<p_before) ORDER BY revision DESC LIMIT 50)v)h ON true
 LEFT JOIN public.supplier_order_lifecycle_receipts receipt ON receipt.supplier_order_id=o.id AND receipt.tenant_id=r.tenant_id AND receipt.transition='mark_sent'
 WHERE r.id=p_request AND r.tenant_id=p_tenant AND r.status='provisioned';
$$;
CREATE FUNCTION public.nexid_supplier_binding_read_v1(p_request uuid,p_tenant uuid,p_actor uuid,p_session uuid,p_before integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET lock_timeout='5s' AS $$
DECLARE v_order uuid;
BEGIN
 IF p_before IS NOT NULL AND(p_before<1 OR p_before>2147483646)THEN RAISE EXCEPTION 'supplier_binding_input_invalid';END IF;
 IF NOT public.nexid_supplier_quote_actor_v1(p_tenant,p_actor,p_session,'read')THEN RETURN NULL;END IF;
 SELECT order_id INTO v_order FROM public.supplier_requests WHERE id=p_request AND tenant_id=p_tenant AND status='provisioned' FOR SHARE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 PERFORM 1 FROM public.supplier_orders WHERE id=v_order AND tenant_id=p_tenant FOR SHARE;
 IF NOT FOUND OR NOT public.nexid_supplier_quote_actor_v1(p_tenant,p_actor,p_session,'read')THEN RETURN NULL;END IF;
 RETURN public.nexid_supplier_binding_current_v1(p_request,p_tenant,p_before);
END;
$$;
CREATE FUNCTION public.nexid_supplier_binding_event_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE r public.supplier_requests%ROWTYPE;e public.supplier_request_binding_events%ROWTYPE;s jsonb;v_fingerprint text;
BEGIN
 IF TG_OP<>'INSERT'THEN RAISE EXCEPTION 'supplier_binding_append_only';END IF;
 IF NOT public.nexid_supplier_quote_actor_v1(NEW.tenant_id,NEW.actor_id,NEW.auth_session_id,'issue')THEN RAISE EXCEPTION 'supplier_binding_scope_forbidden';END IF;
 SELECT * INTO r FROM public.supplier_requests WHERE id=NEW.request_id AND tenant_id=NEW.tenant_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'provisioned' OR r.order_id<>NEW.order_id OR r.revision<>NEW.request_revision THEN RAISE EXCEPTION 'supplier_binding_request_changed';END IF;
 PERFORM 1 FROM public.supplier_orders WHERE id=NEW.order_id AND tenant_id=NEW.tenant_id AND status='pack_ready' FOR UPDATE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.supplier_order_lifecycle_receipts WHERE supplier_order_id=NEW.order_id AND transition='mark_sent')THEN RAISE EXCEPTION 'supplier_binding_dispatch_locked';END IF;
 SELECT * INTO e FROM public.supplier_request_binding_events WHERE request_id=NEW.request_id AND tenant_id=NEW.tenant_id ORDER BY revision DESC LIMIT 1;
 IF NEW.revision<>COALESCE(e.revision,0)+1 OR(e.id IS NOT NULL AND NEW.created_at<e.created_at)THEN RAISE EXCEPTION 'supplier_binding_revision_conflict';END IF;
 IF NEW.action='assign'THEN
 s:=public.nexid_supplier_binding_spec_v1(NEW.order_id,NEW.tenant_id);
 IF s->'ready' IS DISTINCT FROM 'true'::jsonb OR(s->>'revision')::int<>NEW.spec_revision OR s->>'hash'<>NEW.spec_hash OR(s->>'decision_id')::uuid<>NEW.spec_decision_id THEN RAISE EXCEPTION 'supplier_binding_spec_changed';END IF;
 ELSE
 IF e.id IS NULL OR e.action<>'assign' OR ROW(NEW.supplier_ref,NEW.supplier_name,NEW.confirmation_ref,NEW.spec_revision,NEW.spec_hash,NEW.spec_decision_id)
 IS DISTINCT FROM ROW(e.supplier_ref,e.supplier_name,e.confirmation_ref,e.spec_revision,e.spec_hash,e.spec_decision_id)THEN RAISE EXCEPTION 'supplier_binding_transition_invalid';END IF;
 END IF;
 v_fingerprint:=encode(sha256(convert_to(jsonb_build_array('nexid.supplier-binding.v1',NEW.tenant_id,NEW.request_id,NEW.actor_id,NEW.action,NEW.revision-1,NEW.request_revision,NEW.order_id,
 CASE WHEN NEW.action='assign'THEN jsonb_build_object('reference',NEW.supplier_ref,'name',NEW.supplier_name,'confirmation_ref',NEW.confirmation_ref) ELSE NULL END,
 CASE WHEN NEW.action='assign'THEN jsonb_build_object('revision',NEW.spec_revision,'hash',NEW.spec_hash,'decision_id',NEW.spec_decision_id) ELSE NULL END,NEW.reason)::text,'UTF8')),'hex');
 IF NEW.fingerprint<>v_fingerprint OR NOT EXISTS(SELECT 1 FROM public.audit_logs a WHERE a.id=NEW.audit_id AND a.actor_id=NEW.actor_id AND a.tenant_id=NEW.tenant_id
 AND a.resource_type='supplier_request_binding' AND a.resource_id=NEW.request_id::text AND a.action='supplier_binding_'||NEW.action
 AND a.request_id=NEW.idempotency_key::text AND a.after_hash=NEW.fingerprint)THEN RAISE EXCEPTION 'supplier_binding_audit_required';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER supplier_binding_event_guard BEFORE INSERT OR UPDATE OR DELETE ON public.supplier_request_binding_events
 FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_binding_event_guard_v1();
CREATE FUNCTION public.nexid_mutate_supplier_binding_v1(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET lock_timeout='5s' AS $$
DECLARE v_tenant uuid;v_request uuid;v_actor uuid;v_session uuid;v_key uuid;v_order uuid;v_action text;v_revision int;v_request_revision int;v_reason text;v_supplier jsonb;v_spec jsonb;
 r public.supplier_requests%ROWTYPE;o public.supplier_orders%ROWTYPE;e public.supplier_request_binding_events%ROWTYPE;old public.supplier_request_binding_events%ROWTYPE;
 v_fingerprint text;v_audit uuid;v_now timestamptz;v_id uuid;
BEGIN
 IF jsonb_typeof(p_input)IS DISTINCT FROM 'object' OR octet_length(p_input::text)>16384
 OR NOT(p_input?&ARRAY['tenant_id','request_id','actor_id','auth_session_id','idempotency_key','action','expected_revision','expected_request_revision','order_id','supplier','spec','reason'])
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_input)k WHERE k NOT IN('tenant_id','request_id','actor_id','auth_session_id','idempotency_key','action','expected_revision','expected_request_revision','order_id','supplier','spec','reason'))THEN RAISE EXCEPTION 'supplier_binding_input_invalid';END IF;
 v_tenant:=(p_input->>'tenant_id')::uuid;v_request:=(p_input->>'request_id')::uuid;v_actor:=(p_input->>'actor_id')::uuid;v_session:=(p_input->>'auth_session_id')::uuid;v_key:=(p_input->>'idempotency_key')::uuid;v_order:=(p_input->>'order_id')::uuid;
 v_action:=p_input->>'action';v_supplier:=p_input->'supplier';v_spec:=p_input->'spec';v_reason:=p_input->>'reason';
 IF v_tenant IS NULL OR v_request IS NULL OR v_actor IS NULL OR v_session IS NULL OR v_key IS NULL OR v_order IS NULL OR v_action IS NULL OR v_action NOT IN('assign','withdraw')
 OR jsonb_typeof(p_input->'expected_revision')IS DISTINCT FROM 'number' OR(p_input->>'expected_revision')!~'^(0|[1-9][0-9]{0,9})$'
 OR jsonb_typeof(p_input->'expected_request_revision')IS DISTINCT FROM 'number' OR(p_input->>'expected_request_revision')!~'^[1-9][0-9]{0,9}$'
 OR jsonb_typeof(p_input->'reason')IS DISTINCT FROM 'string' OR char_length(v_reason)>1000 OR public.nexid_supplier_request_review_message_valid_v1(v_reason)IS NOT TRUE
 THEN RAISE EXCEPTION 'supplier_binding_input_invalid';END IF;
 IF(p_input->>'expected_revision')::numeric>=2147483646 OR(p_input->>'expected_request_revision')::numeric>2147483646 THEN RAISE EXCEPTION 'supplier_binding_input_invalid';END IF;
 v_revision:=(p_input->>'expected_revision')::int;v_request_revision:=(p_input->>'expected_request_revision')::int;
 IF v_action='assign'THEN
 IF jsonb_typeof(v_supplier)IS DISTINCT FROM 'object' OR jsonb_typeof(v_spec)IS DISTINCT FROM 'object'THEN RAISE EXCEPTION 'supplier_binding_input_invalid';END IF;
 IF NOT(v_supplier?&ARRAY['reference','name','confirmation_ref'])OR EXISTS(SELECT 1 FROM jsonb_object_keys(v_supplier)k WHERE k NOT IN('reference','name','confirmation_ref'))
 OR NOT(v_spec?&ARRAY['revision','hash','decision_id'])OR EXISTS(SELECT 1 FROM jsonb_object_keys(v_spec)k WHERE k NOT IN('revision','hash','decision_id'))
 OR jsonb_typeof(v_supplier->'reference')IS DISTINCT FROM 'string' OR(v_supplier->>'reference')!~'^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$'
 OR jsonb_typeof(v_supplier->'name')IS DISTINCT FROM 'string' OR(v_supplier->>'name')~'[[:cntrl:]]' OR char_length(v_supplier->>'name')>200 OR public.nexid_supplier_request_review_message_valid_v1(v_supplier->>'name')IS NOT TRUE
 OR jsonb_typeof(v_supplier->'confirmation_ref')IS DISTINCT FROM 'string' OR(v_supplier->>'confirmation_ref')~'[[:cntrl:]]' OR char_length(v_supplier->>'confirmation_ref')>240 OR public.nexid_supplier_request_review_message_valid_v1(v_supplier->>'confirmation_ref')IS NOT TRUE
 OR jsonb_typeof(v_spec->'revision')IS DISTINCT FROM 'number' OR(v_spec->>'revision')!~'^[1-9][0-9]{0,9}$'
 OR jsonb_typeof(v_spec->'hash')IS DISTINCT FROM 'string' OR(v_spec->>'hash')!~'^sha256:[0-9a-f]{64}$'
 OR jsonb_typeof(v_spec->'decision_id')IS DISTINCT FROM 'string' OR(v_spec->>'decision_id')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 THEN RAISE EXCEPTION 'supplier_binding_input_invalid';END IF;
 IF(v_spec->>'revision')::numeric>2147483646 THEN RAISE EXCEPTION 'supplier_binding_input_invalid';END IF;
 ELSIF v_supplier IS DISTINCT FROM 'null'::jsonb OR v_spec IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'supplier_binding_input_invalid';END IF;
 IF NOT public.nexid_supplier_quote_actor_v1(v_tenant,v_actor,v_session,'issue')THEN RETURN jsonb_build_object('ok',false,'reason','supplier_binding_scope_forbidden');END IF;
 v_fingerprint:=encode(sha256(convert_to(jsonb_build_array('nexid.supplier-binding.v1',v_tenant,v_request,v_actor,v_action,v_revision,v_request_revision,v_order,CASE WHEN v_supplier='null'::jsonb THEN NULL ELSE v_supplier END,CASE WHEN v_spec='null'::jsonb THEN NULL ELSE v_spec END,v_reason)::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant::text||':'||v_key::text,119));
 SELECT * INTO r FROM public.supplier_requests WHERE id=v_request AND tenant_id=v_tenant FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_not_found');END IF;
 IF r.status<>'provisioned' OR r.order_id<>v_order OR r.revision<>v_request_revision THEN RETURN jsonb_build_object('ok',false,'reason','supplier_binding_request_changed');END IF;
 SELECT * INTO o FROM public.supplier_orders WHERE id=v_order AND tenant_id=v_tenant FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','supplier_binding_request_changed');END IF;
 IF NOT public.nexid_supplier_quote_actor_v1(v_tenant,v_actor,v_session,'issue')THEN RETURN jsonb_build_object('ok',false,'reason','supplier_binding_scope_forbidden');END IF;
 SELECT * INTO old FROM public.supplier_request_binding_events WHERE tenant_id=v_tenant AND idempotency_key=v_key;
 IF FOUND THEN
 IF old.fingerprint<>v_fingerprint THEN RETURN jsonb_build_object('ok',false,'reason','supplier_binding_idempotency_conflict');END IF;
 RETURN public.nexid_supplier_binding_current_v1(v_request,v_tenant)||jsonb_build_object('ok',true,'idempotent_replay',true,'receipt',jsonb_build_object('idempotency_key',v_key,'event_id',old.id,'action',old.action,'revision',old.revision));END IF;
 IF o.status<>'pack_ready' OR EXISTS(SELECT 1 FROM public.supplier_order_lifecycle_receipts WHERE supplier_order_id=v_order AND transition='mark_sent')THEN RETURN jsonb_build_object('ok',false,'reason','supplier_binding_dispatch_locked');END IF;
 SELECT * INTO e FROM public.supplier_request_binding_events WHERE request_id=v_request AND tenant_id=v_tenant ORDER BY revision DESC LIMIT 1;
 IF COALESCE(e.revision,0)<>v_revision THEN RETURN jsonb_build_object('ok',false,'reason','supplier_binding_revision_conflict');END IF;
 IF v_action='assign'THEN
 IF public.nexid_supplier_binding_spec_v1(v_order,v_tenant)IS DISTINCT FROM jsonb_build_object('status','approved','revision',(v_spec->>'revision')::int,'hash',v_spec->>'hash','decision_id',(v_spec->>'decision_id')::uuid,'ready',true)THEN RETURN jsonb_build_object('ok',false,'reason','supplier_binding_spec_changed');END IF;
 ELSE
 IF e.id IS NULL OR e.action<>'assign'THEN RETURN jsonb_build_object('ok',false,'reason','supplier_binding_transition_invalid');END IF;
 END IF;
 v_audit:=gen_random_uuid();v_id:=gen_random_uuid();v_now:=clock_timestamp();
 INSERT INTO public.audit_logs(id,actor_id,tenant_id,action,resource_type,resource_id,before_hash,after_hash,request_id)
 VALUES(v_audit,v_actor,v_tenant,'supplier_binding_'||v_action,'supplier_request_binding',v_request::text,e.fingerprint,v_fingerprint,v_key::text);
 INSERT INTO public.supplier_request_binding_events(id,tenant_id,request_id,order_id,revision,request_revision,action,supplier_ref,supplier_name,confirmation_ref,spec_revision,spec_hash,spec_decision_id,reason,actor_id,auth_session_id,idempotency_key,fingerprint,audit_id,created_at)
 VALUES(v_id,v_tenant,v_request,v_order,v_revision+1,v_request_revision,v_action,
 CASE WHEN v_action='assign'THEN v_supplier->>'reference' ELSE e.supplier_ref END,CASE WHEN v_action='assign'THEN v_supplier->>'name' ELSE e.supplier_name END,CASE WHEN v_action='assign'THEN v_supplier->>'confirmation_ref' ELSE e.confirmation_ref END,
 CASE WHEN v_action='assign'THEN(v_spec->>'revision')::int ELSE e.spec_revision END,CASE WHEN v_action='assign'THEN v_spec->>'hash' ELSE e.spec_hash END,CASE WHEN v_action='assign'THEN(v_spec->>'decision_id')::uuid ELSE e.spec_decision_id END,
 v_reason,v_actor,v_session,v_key,v_fingerprint,v_audit,v_now);
 RETURN public.nexid_supplier_binding_current_v1(v_request,v_tenant)||jsonb_build_object('ok',true,'idempotent_replay',false,'receipt',jsonb_build_object('idempotency_key',v_key,'event_id',v_id,'action',v_action,'revision',v_revision+1));
END;
$$;

-- Reuse lifecycle 0086: once a request opts into supplier binding, its manual
-- dispatch receipt must name the chosen reference and the same approved spec.
-- Old orders without binding events are unaffected. The original export/QA
-- gates still run; this trigger does not send, export, approve or activate.
CREATE FUNCTION public.nexid_supplier_binding_dispatch_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE e public.supplier_request_binding_events%ROWTYPE;s jsonb;
BEGIN
 IF NEW.transition<>'mark_sent' THEN
 IF NEW.supplier_binding_event_id IS NOT NULL THEN RAISE EXCEPTION 'supplier_binding_receipt_invalid';END IF;RETURN NEW;END IF;
 PERFORM 1 FROM public.supplier_orders WHERE id=NEW.supplier_order_id AND tenant_id=NEW.tenant_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'supplier_binding_receipt_invalid';END IF;
 SELECT * INTO e FROM public.supplier_request_binding_events WHERE order_id=NEW.supplier_order_id AND tenant_id=NEW.tenant_id ORDER BY revision DESC LIMIT 1;
 IF NOT FOUND THEN
 IF NEW.supplier_binding_event_id IS NOT NULL THEN RAISE EXCEPTION 'supplier_binding_receipt_invalid';END IF;RETURN NEW;END IF;
 IF e.action<>'assign'THEN RAISE EXCEPTION 'supplier_binding_required';END IF;
 s:=public.nexid_supplier_binding_spec_v1(NEW.supplier_order_id,NEW.tenant_id);
 IF s->'ready' IS DISTINCT FROM 'true'::jsonb OR(s->>'revision')::int<>e.spec_revision OR s->>'hash'<>e.spec_hash OR(s->>'decision_id')::uuid<>e.spec_decision_id THEN RAISE EXCEPTION 'supplier_binding_spec_changed';END IF;
 IF NEW.recipient_ref IS DISTINCT FROM e.supplier_ref THEN RAISE EXCEPTION 'supplier_binding_recipient_mismatch';END IF;
 IF NEW.supplier_binding_event_id IS NOT NULL AND NEW.supplier_binding_event_id<>e.id THEN RAISE EXCEPTION 'supplier_binding_receipt_invalid';END IF;
 NEW.supplier_binding_event_id:=e.id;RETURN NEW;
END;
$$;
CREATE TRIGGER supplier_binding_dispatch_guard BEFORE INSERT ON public.supplier_order_lifecycle_receipts FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_binding_dispatch_guard_v1();
REVOKE ALL ON public.supplier_request_binding_events FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_binding_spec_v1(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_binding_public_v1(public.supplier_request_binding_events) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_binding_current_v1(uuid,uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_binding_read_v1(uuid,uuid,uuid,uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_binding_event_guard_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_mutate_supplier_binding_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_binding_dispatch_guard_v1() FROM PUBLIC;
