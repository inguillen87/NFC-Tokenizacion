-- Records an operator-documented supplier acknowledgement/issue about ONE
-- encrypted export. No download URL, secret, export, dispatch or physical receipt
-- is created. The runner owns the transaction and ledger. Requires 0119.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TABLE public.supplier_delivery_ack_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
 request_id uuid NOT NULL,order_id uuid NOT NULL REFERENCES public.supplier_orders(id) ON DELETE RESTRICT,
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 2147483646),request_revision integer NOT NULL CHECK(request_revision>0),
 action text NOT NULL CHECK(action IN('received','issue','withdraw')),
 dispatch_id uuid NOT NULL REFERENCES public.supplier_order_lifecycle_receipts(id) ON DELETE RESTRICT,
 binding_id uuid NOT NULL REFERENCES public.supplier_request_binding_events(id) ON DELETE RESTRICT,
 artifact_id uuid NOT NULL REFERENCES public.vault_artifacts(id) ON DELETE RESTRICT,
 artifact_hash text NOT NULL CHECK(artifact_hash ~ '^sha256:[0-9a-f]{64}$'),
 reported_hash text CHECK(reported_hash ~ '^sha256:[0-9a-f]{64}$'),
 evidence_ref text NOT NULL CHECK(char_length(evidence_ref)<=240 AND evidence_ref !~ '[[:cntrl:]]' AND public.nexid_supplier_request_review_message_valid_v1(evidence_ref)IS TRUE),
 reason text NOT NULL CHECK(char_length(reason)<=1000 AND public.nexid_supplier_request_review_message_valid_v1(reason)IS TRUE),
 actor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,auth_session_id uuid NOT NULL REFERENCES public.auth_sessions(id) ON DELETE RESTRICT,
 idempotency_key uuid NOT NULL,fingerprint text NOT NULL CHECK(fingerprint~'^[0-9a-f]{64}$'),audit_id uuid NOT NULL UNIQUE REFERENCES public.audit_logs(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL,
 CHECK(action<>'received' OR(reported_hash IS NOT NULL AND reported_hash=artifact_hash)),CHECK(action<>'withdraw' OR reported_hash IS NULL),
 FOREIGN KEY(tenant_id,request_id)REFERENCES public.supplier_requests(tenant_id,id) ON DELETE RESTRICT,
 UNIQUE(tenant_id,request_id,revision),UNIQUE(tenant_id,idempotency_key)
);
CREATE INDEX supplier_delivery_ack_order_idx ON public.supplier_delivery_ack_events(order_id,revision DESC);
CREATE FUNCTION public.nexid_supplier_delivery_source_v1(p_order uuid,p_tenant uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('dispatch_id',d.id,'binding_id',b.id,'supplier_ref',b.supplier_ref,'supplier_name',b.supplier_name,
 'spec_revision',b.spec_revision,'spec_hash',b.spec_hash,'sent_at',d.created_at)
 FROM public.supplier_order_lifecycle_receipts d JOIN public.supplier_request_binding_events b ON b.id=d.supplier_binding_event_id AND b.order_id=d.supplier_order_id AND b.tenant_id=d.tenant_id
 WHERE d.supplier_order_id=p_order AND d.tenant_id=p_tenant AND d.transition='mark_sent' AND b.action='assign' AND d.recipient_ref=b.supplier_ref
 AND public.nexid_supplier_binding_spec_v1(p_order,p_tenant)=jsonb_build_object('status','approved','revision',b.spec_revision,'hash',b.spec_hash,'decision_id',b.spec_decision_id,'ready',true);
$$;
CREATE FUNCTION public.nexid_supplier_delivery_artifacts_v1(p_order uuid,p_tenant uuid)
RETURNS TABLE(id uuid,hash text,created_at timestamptz) LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT a.id,a.content_hash,a.created_at FROM public.vault_artifacts a JOIN public.supplier_orders o ON o.id=a.supplier_order_id AND o.tenant_id=a.tenant_id
 CROSS JOIN LATERAL(SELECT public.nexid_supplier_delivery_source_v1(p_order,p_tenant) s)source
 WHERE a.supplier_order_id=p_order AND a.tenant_id=p_tenant AND a.resource_type='supplier_order' AND a.resource_id=p_order::text
 AND a.artifact_type='supplier_pack_zip_encrypted' AND a.status='active' AND a.delivery_status='ready'
 AND a.encrypted_payload_base64 IS NOT NULL AND octet_length(a.encrypted_payload_base64)>0
 AND a.content_hash~'^sha256:[0-9a-f]{64}$' AND a.metadata_json->>'envelope_sha256'=a.content_hash
 AND a.metadata_json->>'pack_purpose'=o.pack_purpose AND a.metadata_json->'packaging_spec_revision'=source.s->'spec_revision'
 AND a.metadata_json->>'packaging_spec_hash'=source.s->>'spec_hash' AND a.created_at<=(source.s->>'sent_at')::timestamptz;
$$;
CREATE FUNCTION public.nexid_supplier_delivery_ack_public_v1(e public.supplier_delivery_ack_events)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('id',e.id,'revision',e.revision,'request_revision',e.request_revision,'order_id',e.order_id,'action',e.action,
 'dispatch_id',e.dispatch_id,'binding_id',e.binding_id,'artifact_id',e.artifact_id,'artifact_hash',e.artifact_hash,'reported_hash',e.reported_hash,
 'evidence_ref',e.evidence_ref,'reason',e.reason,'actor_id',e.actor_id,'created_at',e.created_at,'source','nexid_manual_record',
 'supplier_authenticated',false,'download_verified',false,'decryption_verified',false,'physical_received',false);
$$;
CREATE FUNCTION public.nexid_supplier_delivery_ack_current_v1(p_request uuid,p_tenant uuid,p_before integer DEFAULT NULL)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('request_id',r.id,'request_revision',r.revision,'tenant_id',r.tenant_id,'tenant_slug',t.slug,'order_id',o.id,
 'source',public.nexid_supplier_delivery_source_v1(o.id,r.tenant_id),'artifacts',COALESCE(a.items,'[]'::jsonb),'artifacts_count',COALESCE(a.count,0),'artifacts_truncated',COALESCE(a.more,false),
 'revision',COALESCE(e.revision,0),'current',CASE WHEN e.id IS NOT NULL THEN public.nexid_supplier_delivery_ack_public_v1(e)ELSE NULL END,
 'history',COALESCE(h.items,'[]'::jsonb),'count',COALESCE(h.count,0),'truncated',COALESCE(h.first>1,false),'next_before_revision',CASE WHEN h.first>1 THEN h.first ELSE NULL END,'as_of',clock_timestamp())
 FROM public.supplier_requests r JOIN public.tenants t ON t.id=r.tenant_id JOIN public.supplier_orders o ON o.id=r.order_id AND o.tenant_id=r.tenant_id
 LEFT JOIN LATERAL(SELECT * FROM public.supplier_delivery_ack_events WHERE request_id=r.id AND tenant_id=r.tenant_id ORDER BY revision DESC LIMIT 1)e ON true
 LEFT JOIN LATERAL(SELECT jsonb_agg(public.nexid_supplier_delivery_ack_public_v1(v)ORDER BY revision)items,count(*)::int count,min(revision)first
 FROM(SELECT * FROM public.supplier_delivery_ack_events WHERE request_id=r.id AND tenant_id=r.tenant_id AND(p_before IS NULL OR revision<p_before) ORDER BY revision DESC LIMIT 50)v)h ON true
 LEFT JOIN LATERAL(SELECT jsonb_agg(jsonb_build_object('id',x.id,'hash',x.hash,'created_at',x.created_at)ORDER BY x.created_at DESC,x.id DESC)FILTER(WHERE x.n<=52)items,LEAST(count(*),52)::int count,count(*)>52 more
 FROM(SELECT v.*,row_number()OVER(ORDER BY created_at DESC,id DESC)n FROM public.nexid_supplier_delivery_artifacts_v1(o.id,r.tenant_id)v ORDER BY created_at DESC,id DESC LIMIT 53)x)a ON true
 WHERE r.id=p_request AND r.tenant_id=p_tenant AND r.status='provisioned';
$$;
CREATE FUNCTION public.nexid_supplier_delivery_ack_read_v1(p_request uuid,p_tenant uuid,p_actor uuid,p_session uuid,p_before integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET lock_timeout='5s' AS $$
DECLARE v_order uuid;
BEGIN
 IF p_before IS NOT NULL AND(p_before<1 OR p_before>2147483646)THEN RAISE EXCEPTION 'supplier_delivery_ack_input_invalid';END IF;
 IF NOT public.nexid_supplier_quote_actor_v1(p_tenant,p_actor,p_session,'read')THEN RETURN NULL;END IF;
 SELECT order_id INTO v_order FROM public.supplier_requests WHERE id=p_request AND tenant_id=p_tenant AND status='provisioned' FOR SHARE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 PERFORM 1 FROM public.supplier_orders WHERE id=v_order AND tenant_id=p_tenant FOR SHARE;
 IF NOT FOUND OR NOT public.nexid_supplier_quote_actor_v1(p_tenant,p_actor,p_session,'read')THEN RETURN NULL;END IF;
 RETURN public.nexid_supplier_delivery_ack_current_v1(p_request,p_tenant,p_before);
END;
$$;
CREATE FUNCTION public.nexid_supplier_delivery_ack_event_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE r public.supplier_requests%ROWTYPE;e public.supplier_delivery_ack_events%ROWTYPE;s jsonb;v_fp text;
BEGIN
 IF TG_OP<>'INSERT'THEN RAISE EXCEPTION 'supplier_delivery_ack_append_only';END IF;
 IF NOT public.nexid_supplier_quote_actor_v1(NEW.tenant_id,NEW.actor_id,NEW.auth_session_id,'issue')THEN RAISE EXCEPTION 'supplier_delivery_ack_scope_forbidden';END IF;
 SELECT * INTO r FROM public.supplier_requests WHERE id=NEW.request_id AND tenant_id=NEW.tenant_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'provisioned' OR r.order_id<>NEW.order_id OR r.revision<>NEW.request_revision THEN RAISE EXCEPTION 'supplier_delivery_ack_request_changed';END IF;
 PERFORM 1 FROM public.supplier_orders WHERE id=NEW.order_id AND tenant_id=NEW.tenant_id FOR UPDATE;
 SELECT * INTO e FROM public.supplier_delivery_ack_events WHERE request_id=NEW.request_id AND tenant_id=NEW.tenant_id ORDER BY revision DESC LIMIT 1;
 IF NEW.revision<>COALESCE(e.revision,0)+1 OR(e.id IS NOT NULL AND NEW.created_at<e.created_at)THEN RAISE EXCEPTION 'supplier_delivery_ack_revision_conflict';END IF;
 IF NEW.action='withdraw'THEN
 IF e.id IS NULL OR e.action='withdraw' OR ROW(NEW.dispatch_id,NEW.binding_id,NEW.artifact_id,NEW.artifact_hash)IS DISTINCT FROM ROW(e.dispatch_id,e.binding_id,e.artifact_id,e.artifact_hash)THEN RAISE EXCEPTION 'supplier_delivery_ack_transition_invalid';END IF;
 ELSE
 s:=public.nexid_supplier_delivery_source_v1(NEW.order_id,NEW.tenant_id);
 IF s IS NULL OR(s->>'dispatch_id')::uuid<>NEW.dispatch_id OR(s->>'binding_id')::uuid<>NEW.binding_id THEN RAISE EXCEPTION 'supplier_delivery_ack_source_changed';END IF;
 PERFORM 1 FROM public.vault_artifacts WHERE id=NEW.artifact_id FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM public.nexid_supplier_delivery_artifacts_v1(NEW.order_id,NEW.tenant_id)a WHERE a.id=NEW.artifact_id AND a.hash=NEW.artifact_hash)THEN RAISE EXCEPTION 'supplier_delivery_ack_artifact_changed';END IF;
 END IF;
 v_fp:=encode(sha256(convert_to(jsonb_build_array('nexid.supplier-delivery-ack.v1',NEW.tenant_id,NEW.request_id,NEW.actor_id,NEW.action,NEW.revision-1,NEW.request_revision,NEW.order_id,NEW.dispatch_id,NEW.binding_id,NEW.artifact_id,NEW.artifact_hash,NEW.reported_hash,NEW.evidence_ref,NEW.reason)::text,'UTF8')),'hex');
 IF NEW.fingerprint<>v_fp OR NOT EXISTS(SELECT 1 FROM public.audit_logs a WHERE a.id=NEW.audit_id AND a.actor_id=NEW.actor_id AND a.tenant_id=NEW.tenant_id
 AND a.resource_type='supplier_delivery_ack' AND a.resource_id=NEW.request_id::text AND a.action='supplier_delivery_ack_'||NEW.action AND a.request_id=NEW.idempotency_key::text AND a.after_hash=NEW.fingerprint)THEN RAISE EXCEPTION 'supplier_delivery_ack_audit_required';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER supplier_delivery_ack_event_guard BEFORE INSERT OR UPDATE OR DELETE ON public.supplier_delivery_ack_events FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_delivery_ack_event_guard_v1();
CREATE FUNCTION public.nexid_mutate_supplier_delivery_ack_v1(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET lock_timeout='5s' AS $$
DECLARE v_tenant uuid;v_request uuid;v_actor uuid;v_session uuid;v_key uuid;v_order uuid;v_dispatch uuid;v_binding uuid;v_artifact uuid;v_hash text;v_reported text;v_ref text;v_reason text;v_action text;v_rev int;v_rr int;v_fp text;v_audit uuid;v_id uuid;v_now timestamptz;s jsonb;
 r public.supplier_requests%ROWTYPE;e public.supplier_delivery_ack_events%ROWTYPE;old public.supplier_delivery_ack_events%ROWTYPE;
BEGIN
 IF jsonb_typeof(p_input)IS DISTINCT FROM 'object' OR octet_length(p_input::text)>16384
 OR NOT(p_input?&ARRAY['tenant_id','request_id','actor_id','auth_session_id','idempotency_key','action','expected_revision','expected_request_revision','order_id','dispatch_id','binding_id','artifact_id','artifact_hash','reported_hash','evidence_ref','reason'])
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_input)k WHERE k NOT IN('tenant_id','request_id','actor_id','auth_session_id','idempotency_key','action','expected_revision','expected_request_revision','order_id','dispatch_id','binding_id','artifact_id','artifact_hash','reported_hash','evidence_ref','reason'))THEN RAISE EXCEPTION 'supplier_delivery_ack_input_invalid';END IF;
 v_tenant:=(p_input->>'tenant_id')::uuid;v_request:=(p_input->>'request_id')::uuid;v_actor:=(p_input->>'actor_id')::uuid;v_session:=(p_input->>'auth_session_id')::uuid;v_key:=(p_input->>'idempotency_key')::uuid;v_order:=(p_input->>'order_id')::uuid;
 v_dispatch:=(p_input->>'dispatch_id')::uuid;v_binding:=(p_input->>'binding_id')::uuid;v_artifact:=(p_input->>'artifact_id')::uuid;v_hash:=p_input->>'artifact_hash';v_reported:=p_input->>'reported_hash';v_ref:=p_input->>'evidence_ref';v_reason:=p_input->>'reason';v_action:=p_input->>'action';
 IF v_tenant IS NULL OR v_request IS NULL OR v_actor IS NULL OR v_session IS NULL OR v_key IS NULL OR v_order IS NULL OR v_dispatch IS NULL OR v_binding IS NULL OR v_artifact IS NULL
 OR v_action IS NULL OR v_action NOT IN('received','issue','withdraw') OR jsonb_typeof(p_input->'expected_revision')IS DISTINCT FROM 'number' OR(p_input->>'expected_revision')!~'^(0|[1-9][0-9]{0,9})$'
 OR jsonb_typeof(p_input->'expected_request_revision')IS DISTINCT FROM 'number' OR(p_input->>'expected_request_revision')!~'^[1-9][0-9]{0,9}$'
 OR jsonb_typeof(p_input->'artifact_hash')IS DISTINCT FROM 'string' OR v_hash!~'^sha256:[0-9a-f]{64}$'
 OR(p_input->'reported_hash'<>'null'::jsonb AND(jsonb_typeof(p_input->'reported_hash')IS DISTINCT FROM 'string' OR v_reported!~'^sha256:[0-9a-f]{64}$'))
 OR(v_action='received' AND(v_reported IS NULL OR v_reported<>v_hash))OR(v_action='withdraw' AND v_reported IS NOT NULL)
 OR jsonb_typeof(p_input->'evidence_ref')IS DISTINCT FROM 'string' OR char_length(v_ref)>240 OR v_ref~'[[:cntrl:]]' OR public.nexid_supplier_request_review_message_valid_v1(v_ref)IS NOT TRUE
 OR jsonb_typeof(p_input->'reason')IS DISTINCT FROM 'string' OR char_length(v_reason)>1000 OR public.nexid_supplier_request_review_message_valid_v1(v_reason)IS NOT TRUE THEN RAISE EXCEPTION 'supplier_delivery_ack_input_invalid';END IF;
 IF(p_input->>'expected_revision')::numeric>=2147483646 OR(p_input->>'expected_request_revision')::numeric>2147483646 THEN RAISE EXCEPTION 'supplier_delivery_ack_input_invalid';END IF;
 v_rev:=(p_input->>'expected_revision')::int;v_rr:=(p_input->>'expected_request_revision')::int;
 IF NOT public.nexid_supplier_quote_actor_v1(v_tenant,v_actor,v_session,'issue')THEN RETURN jsonb_build_object('ok',false,'reason','supplier_delivery_ack_scope_forbidden');END IF;
 v_fp:=encode(sha256(convert_to(jsonb_build_array('nexid.supplier-delivery-ack.v1',v_tenant,v_request,v_actor,v_action,v_rev,v_rr,v_order,v_dispatch,v_binding,v_artifact,v_hash,v_reported,v_ref,v_reason)::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant::text||':'||v_key::text,120));
 SELECT * INTO r FROM public.supplier_requests WHERE id=v_request AND tenant_id=v_tenant FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_not_found');END IF;
 IF r.status<>'provisioned' OR r.order_id<>v_order OR r.revision<>v_rr THEN RETURN jsonb_build_object('ok',false,'reason','supplier_delivery_ack_request_changed');END IF;
 PERFORM 1 FROM public.supplier_orders WHERE id=v_order AND tenant_id=v_tenant FOR UPDATE;
 IF NOT FOUND OR NOT public.nexid_supplier_quote_actor_v1(v_tenant,v_actor,v_session,'issue')THEN RETURN jsonb_build_object('ok',false,'reason','supplier_delivery_ack_scope_forbidden');END IF;
 SELECT * INTO old FROM public.supplier_delivery_ack_events WHERE tenant_id=v_tenant AND idempotency_key=v_key;
 IF FOUND THEN
 IF old.fingerprint<>v_fp THEN RETURN jsonb_build_object('ok',false,'reason','supplier_delivery_ack_idempotency_conflict');END IF;
 RETURN public.nexid_supplier_delivery_ack_current_v1(v_request,v_tenant)||jsonb_build_object('ok',true,'idempotent_replay',true,'receipt',jsonb_build_object('idempotency_key',v_key,'event_id',old.id,'action',old.action,'revision',old.revision));END IF;
 SELECT * INTO e FROM public.supplier_delivery_ack_events WHERE request_id=v_request AND tenant_id=v_tenant ORDER BY revision DESC LIMIT 1;
 IF COALESCE(e.revision,0)<>v_rev THEN RETURN jsonb_build_object('ok',false,'reason','supplier_delivery_ack_revision_conflict');END IF;
 IF v_action='withdraw'THEN
 IF e.id IS NULL OR e.action='withdraw' OR ROW(v_dispatch,v_binding,v_artifact,v_hash)IS DISTINCT FROM ROW(e.dispatch_id,e.binding_id,e.artifact_id,e.artifact_hash)THEN RETURN jsonb_build_object('ok',false,'reason','supplier_delivery_ack_transition_invalid');END IF;
 ELSE
 s:=public.nexid_supplier_delivery_source_v1(v_order,v_tenant);
 IF s IS NULL OR(s->>'dispatch_id')::uuid<>v_dispatch OR(s->>'binding_id')::uuid<>v_binding THEN RETURN jsonb_build_object('ok',false,'reason','supplier_delivery_ack_source_changed');END IF;
 PERFORM 1 FROM public.vault_artifacts WHERE id=v_artifact FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM public.nexid_supplier_delivery_artifacts_v1(v_order,v_tenant)a WHERE a.id=v_artifact AND a.hash=v_hash)THEN RETURN jsonb_build_object('ok',false,'reason','supplier_delivery_ack_artifact_changed');END IF;
 END IF;
 v_audit:=gen_random_uuid();v_id:=gen_random_uuid();v_now:=clock_timestamp();
 INSERT INTO public.audit_logs(id,actor_id,tenant_id,action,resource_type,resource_id,before_hash,after_hash,request_id)VALUES(v_audit,v_actor,v_tenant,'supplier_delivery_ack_'||v_action,'supplier_delivery_ack',v_request::text,e.fingerprint,v_fp,v_key::text);
 INSERT INTO public.supplier_delivery_ack_events(id,tenant_id,request_id,order_id,revision,request_revision,action,dispatch_id,binding_id,artifact_id,artifact_hash,reported_hash,evidence_ref,reason,actor_id,auth_session_id,idempotency_key,fingerprint,audit_id,created_at)
 VALUES(v_id,v_tenant,v_request,v_order,v_rev+1,v_rr,v_action,v_dispatch,v_binding,v_artifact,v_hash,v_reported,v_ref,v_reason,v_actor,v_session,v_key,v_fp,v_audit,v_now);
 RETURN public.nexid_supplier_delivery_ack_current_v1(v_request,v_tenant)||jsonb_build_object('ok',true,'idempotent_replay',false,'receipt',jsonb_build_object('idempotency_key',v_key,'event_id',v_id,'action',v_action,'revision',v_rev+1));
END;
$$;
REVOKE ALL ON public.supplier_delivery_ack_events FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_delivery_source_v1(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_delivery_artifacts_v1(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_delivery_ack_public_v1(public.supplier_delivery_ack_events) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_delivery_ack_current_v1(uuid,uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_delivery_ack_read_v1(uuid,uuid,uuid,uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_delivery_ack_event_guard_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_mutate_supplier_delivery_ack_v1(jsonb) FROM PUBLIC;
