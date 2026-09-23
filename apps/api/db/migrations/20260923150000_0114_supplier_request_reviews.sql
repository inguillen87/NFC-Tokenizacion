-- Public commercial clarifications. They never modify the submitted request,
-- provision material, or assert physical approval. No role or grant is added.
CREATE TABLE public.supplier_request_reviews (
  tenant_id uuid NOT NULL,
  request_id uuid PRIMARY KEY,
  state text NOT NULL CHECK (state IN ('needs_information','answered')),
  revision integer NOT NULL CHECK (revision>0),
  updated_at timestamptz NOT NULL,
  FOREIGN KEY (tenant_id,request_id) REFERENCES public.supplier_requests(tenant_id,id) ON DELETE RESTRICT,
  UNIQUE (tenant_id,request_id)
);
CREATE TABLE public.supplier_request_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  request_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision>0),
  request_revision integer NOT NULL CHECK (request_revision>0),
  action text NOT NULL CHECK (action IN ('request_information','respond')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000 AND char_length(btrim(message))>0),
  actor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  auth_session_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  audit_id uuid NOT NULL UNIQUE REFERENCES public.audit_logs(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL,
  FOREIGN KEY (tenant_id,request_id) REFERENCES public.supplier_request_reviews(tenant_id,request_id) ON DELETE RESTRICT,
  UNIQUE (tenant_id,request_id,revision),
  UNIQUE (tenant_id,idempotency_key)
);
CREATE INDEX supplier_request_review_events_history_idx ON public.supplier_request_review_events(tenant_id,request_id,revision DESC);
CREATE INDEX supplier_request_reviews_activity_idx ON public.supplier_request_reviews(updated_at DESC,request_id DESC);

CREATE FUNCTION public.nexid_supplier_request_review_message_valid_v1(p_message text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
  SELECT p_message IS NOT NULL AND char_length(p_message) BETWEEN 1 AND 2000 AND char_length(btrim(p_message))>0
    AND regexp_replace(p_message,E'[\t\n\r]','','g') !~ '[[:cntrl:]]'
    AND p_message !~* '(^|[^A-Za-z0-9_])(PACK[_ -]?PASSWORD|K[_ -]?META([_ -]?BATCH)?|K[_ -]?FILE([_ -]?BATCH)?)($|[^A-Za-z0-9_])'
    AND p_message !~* '(^|[^A-Za-z0-9_])(PASSWORD|PASSWD|SECRET|WEBHOOK[_ -]?SECRET|PRIVATE[_ -]?KEY|API[_ -]?KEY|TOKEN|BEARER[_ -]?TOKEN|SESSION[_ -]?TOKEN|AUTHORIZATION|COOKIE|DATABASE[_ -]?URL)[[:space:]]*[:=]'
    AND p_message !~ '[A-Za-z][A-Za-z0-9+.-]*://[^[:space:]/@:]+:[^[:space:]@]+@'
    AND p_message !~* '-----BEGIN( [A-Z0-9]+)? PRIVATE KEY-----'
    AND p_message !~ '(^|[^0-9A-Fa-f])(0x)?[0-9A-Fa-f]{32,}($|[^0-9A-Fa-f])'
    AND NOT EXISTS (SELECT 1 FROM regexp_matches(p_message,'[A-Za-z0-9+/_-]{32,}={0,2}','g') AS token(parts)
      WHERE ((parts[1] ~ '[A-Z]')::integer+(parts[1] ~ '[a-z]')::integer+(parts[1] ~ '[0-9]')::integer+(parts[1] ~ '[+/_-]')::integer)>=3
        AND (SELECT count(DISTINCT letter) FROM regexp_split_to_table(regexp_replace(parts[1],'=+$',''),'') AS letter)>=16);
$$;
ALTER TABLE public.supplier_request_review_events ADD CONSTRAINT supplier_request_review_message_safe CHECK (public.nexid_supplier_request_review_message_valid_v1(message));

CREATE FUNCTION public.nexid_supplier_request_review_actor_v1(p_tenant uuid,p_actor uuid,p_session uuid,p_action text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('request_information','respond') THEN RETURN false; END IF;
  IF NOT public.nexid_supplier_request_actor_v1(p_tenant,p_actor,p_session,p_action='request_information') THEN RETURN false; END IF;
  IF p_action='respond' THEN
    RETURN EXISTS (SELECT 1 FROM public.auth_sessions WHERE id=p_session AND user_id=p_actor AND tenant_id=p_tenant AND role::text<>'super_admin');
  END IF;
  RETURN true;
END;
$$;
CREATE FUNCTION public.nexid_supplier_request_review_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'supplier_request_review_immutable'; END IF;
  PERFORM 1 FROM public.supplier_requests WHERE id=NEW.request_id AND tenant_id=NEW.tenant_id AND status='submitted' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'supplier_request_not_submitted'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.revision<>1 OR NEW.state<>'needs_information' THEN RAISE EXCEPTION 'supplier_request_review_transition_invalid'; END IF;
  ELSIF NEW.request_id IS DISTINCT FROM OLD.request_id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.revision<>OLD.revision+1 OR NEW.updated_at<OLD.updated_at OR NEW.state=OLD.state THEN
    RAISE EXCEPTION 'supplier_request_review_transition_invalid';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER supplier_request_review_guard BEFORE INSERT OR UPDATE OR DELETE ON public.supplier_request_reviews FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_request_review_guard_v1();
CREATE FUNCTION public.nexid_supplier_request_review_event_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE v_revision integer;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'supplier_request_review_event_append_only'; END IF;
  SELECT revision INTO v_revision FROM public.supplier_requests WHERE id=NEW.request_id AND tenant_id=NEW.tenant_id AND status='submitted' FOR UPDATE;
  IF NOT FOUND OR v_revision<>NEW.request_revision THEN RAISE EXCEPTION 'supplier_request_revision_conflict'; END IF;
  IF NOT public.nexid_supplier_request_review_actor_v1(NEW.tenant_id,NEW.actor_id,NEW.auth_session_id,NEW.action) THEN RAISE EXCEPTION 'supplier_request_review_scope_forbidden'; END IF;
  IF NEW.revision<>1+COALESCE((SELECT max(revision) FROM public.supplier_request_review_events WHERE tenant_id=NEW.tenant_id AND request_id=NEW.request_id),0)
    OR NOT EXISTS (SELECT 1 FROM public.supplier_request_reviews WHERE tenant_id=NEW.tenant_id AND request_id=NEW.request_id AND revision=NEW.revision
      AND state=CASE NEW.action WHEN 'request_information' THEN 'needs_information' ELSE 'answered' END AND updated_at=NEW.created_at)
    OR NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE id=NEW.audit_id AND actor_id=NEW.actor_id AND tenant_id=NEW.tenant_id
      AND resource_type='supplier_request_review' AND resource_id=NEW.request_id::text AND action='supplier_request_review_'||NEW.action AND request_id=NEW.idempotency_key::text) THEN
    RAISE EXCEPTION 'supplier_request_review_event_invalid';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER supplier_request_review_event_guard BEFORE INSERT OR UPDATE OR DELETE ON public.supplier_request_review_events FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_request_review_event_guard_v1();
CREATE FUNCTION public.nexid_supplier_request_review_consistency_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.supplier_request_reviews r JOIN public.supplier_request_review_events e
    ON e.tenant_id=r.tenant_id AND e.request_id=r.request_id AND e.revision=r.revision
    WHERE r.request_id=NEW.request_id AND r.tenant_id=NEW.tenant_id
      AND e.created_at=r.updated_at AND r.state=CASE e.action WHEN 'request_information' THEN 'needs_information' ELSE 'answered' END) THEN
    RAISE EXCEPTION 'supplier_request_review_event_required';
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER supplier_request_review_consistency AFTER INSERT OR UPDATE ON public.supplier_request_reviews
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_request_review_consistency_v1();

CREATE FUNCTION public.nexid_supplier_request_review_current_v1(p_request uuid,p_tenant uuid,p_before integer DEFAULT NULL)
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
  WHERE r.id=p_request AND r.tenant_id=p_tenant AND r.status IN ('submitted','provisioned');
$$;
CREATE OR REPLACE FUNCTION public.nexid_supplier_request_current_v1(p_request uuid,p_tenant uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
  SELECT to_jsonb(r)||jsonb_build_object('tenant_slug',t.slug,'review_summary',
    jsonb_build_object('state',COALESCE(review.state,'pending'),'revision',COALESCE(review.revision,0),'updated_at',review.updated_at))
  FROM public.supplier_requests r JOIN public.tenants t ON t.id=r.tenant_id
  LEFT JOIN public.supplier_request_reviews review ON review.tenant_id=r.tenant_id AND review.request_id=r.id
  WHERE r.id=p_request AND r.tenant_id=p_tenant;
$$;

CREATE FUNCTION public.nexid_mutate_supplier_request_review_v1(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET lock_timeout='5s' AS $$
DECLARE
  v_tenant uuid; v_actor uuid; v_session uuid; v_key uuid; v_id uuid; v_action text; v_expected integer; v_request_expected integer;
  v_message text; v_fingerprint text; v_audit uuid; v_now timestamptz; v_revision integer; v_state text;
  v_request public.supplier_requests%ROWTYPE; v_event public.supplier_request_review_events%ROWTYPE;
BEGIN
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR octet_length(p_input::text)>16384 THEN RAISE EXCEPTION 'supplier_request_review_input_invalid'; END IF;
  v_tenant:=(p_input->>'tenant_id')::uuid; v_actor:=(p_input->>'actor_id')::uuid; v_session:=(p_input->>'auth_session_id')::uuid;
  v_key:=(p_input->>'idempotency_key')::uuid; v_id:=(p_input->>'request_id')::uuid; v_action:=p_input->>'action'; v_message:=p_input->>'message';
  v_expected:=(p_input->>'expected_revision')::integer; v_request_expected:=(p_input->>'expected_request_revision')::integer;
  IF v_tenant IS NULL OR v_actor IS NULL OR v_session IS NULL OR v_key IS NULL OR v_id IS NULL
    OR v_action IS NULL OR v_action NOT IN ('request_information','respond')
    OR v_expected IS NULL OR v_expected<0 OR v_expected>=2147483647 OR v_request_expected IS NULL OR v_request_expected<1 OR v_request_expected>=2147483647
    OR jsonb_typeof(p_input->'message') IS DISTINCT FROM 'string' OR public.nexid_supplier_request_review_message_valid_v1(v_message) IS NOT TRUE THEN
    RAISE EXCEPTION 'supplier_request_review_input_invalid';
  END IF;
  IF NOT public.nexid_supplier_request_review_actor_v1(v_tenant,v_actor,v_session,v_action) THEN
    RETURN jsonb_build_object('ok',false,'reason','supplier_request_review_scope_forbidden');
  END IF;
  v_fingerprint:=encode(sha256(convert_to(jsonb_build_array('nexid.supplier-request-review.v1',v_tenant,v_actor,v_id,v_action,v_expected,v_request_expected,v_message)::text,'UTF8')),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant::text||':'||v_key::text,114));
  SELECT * INTO v_event FROM public.supplier_request_review_events WHERE tenant_id=v_tenant AND idempotency_key=v_key;
  IF FOUND THEN
    IF v_event.fingerprint<>v_fingerprint THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_review_idempotency_conflict'); END IF;
    RETURN public.nexid_supplier_request_review_current_v1(v_id,v_tenant)||jsonb_build_object('ok',true,'idempotent_replay',true,
      'receipt',jsonb_build_object('idempotency_key',v_key,'action',v_event.action,'revision',v_event.revision));
  END IF;
  -- All review writes and conversion take this same lock, in this order.
  SELECT * INTO v_request FROM public.supplier_requests WHERE id=v_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_not_found'); END IF;
  IF v_request.status<>'submitted' THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_not_submitted'); END IF;
  IF v_request.revision<>v_request_expected THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_revision_conflict'); END IF;
  SELECT revision,state INTO v_revision,v_state FROM public.supplier_request_reviews WHERE tenant_id=v_tenant AND request_id=v_id;
  v_revision:=COALESCE(v_revision,0); v_state:=COALESCE(v_state,'pending');
  IF v_revision<>v_expected THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_review_revision_conflict'); END IF;
  IF (v_action='request_information' AND v_state='needs_information') OR (v_action='respond' AND v_state<>'needs_information') THEN
    RETURN jsonb_build_object('ok',false,'reason','supplier_request_review_transition_invalid');
  END IF;
  v_revision:=v_revision+1; v_now:=clock_timestamp(); v_audit:=gen_random_uuid();
  IF v_revision=1 THEN
    INSERT INTO public.supplier_request_reviews(tenant_id,request_id,state,revision,updated_at)
      VALUES(v_tenant,v_id,'needs_information',v_revision,v_now);
  ELSE
    UPDATE public.supplier_request_reviews SET state=CASE v_action WHEN 'request_information' THEN 'needs_information' ELSE 'answered' END,
      revision=v_revision,updated_at=v_now WHERE tenant_id=v_tenant AND request_id=v_id;
  END IF;
  INSERT INTO public.audit_logs(id,actor_id,tenant_id,action,resource_type,resource_id,before_hash,after_hash,request_id)
    VALUES(v_audit,v_actor,v_tenant,'supplier_request_review_'||v_action,'supplier_request_review',v_id::text,
      encode(sha256(convert_to(jsonb_build_array(v_expected,v_state)::text,'UTF8')),'hex'),v_fingerprint,v_key::text);
  INSERT INTO public.supplier_request_review_events(tenant_id,request_id,revision,request_revision,action,message,actor_id,auth_session_id,idempotency_key,fingerprint,audit_id,created_at)
    VALUES(v_tenant,v_id,v_revision,v_request.revision,v_action,v_message,v_actor,v_session,v_key,v_fingerprint,v_audit,v_now);
  RETURN public.nexid_supplier_request_review_current_v1(v_id,v_tenant)||jsonb_build_object('ok',true,'idempotent_replay',false,
    'receipt',jsonb_build_object('idempotency_key',v_key,'action',v_action,'revision',v_revision));
END;
$$;

REVOKE ALL ON public.supplier_request_reviews,public.supplier_request_review_events FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_review_message_valid_v1(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_review_actor_v1(uuid,uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_review_guard_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_review_event_guard_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_review_consistency_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_review_current_v1(uuid,uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_current_v1(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_mutate_supplier_request_review_v1(jsonb) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.nexid_convert_supplier_request_v1(p_request_id uuid,p_expected_revision integer,p_input jsonb)
RETURNS TABLE(supplier_order jsonb,sub_batches jsonb)
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET lock_timeout='5s' AS $$
DECLARE
  v_request public.supplier_requests%ROWTYPE; v_tenant uuid; v_actor uuid; v_session uuid;
  v_chip text; v_carrier text; v_material text; v_order jsonb; v_batches jsonb; v_before jsonb;
BEGIN
  IF p_request_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<1 OR p_expected_revision>=2147483647 OR jsonb_typeof(p_input) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'supplier_request_source_invalid';
  END IF;
  v_tenant:=(p_input->>'tenant_id')::uuid; v_actor:=(p_input->>'actor_id')::uuid; v_session:=(p_input->>'auth_session_id')::uuid;
  IF NOT public.nexid_supplier_request_actor_v1(v_tenant,v_actor,v_session,true) THEN RAISE EXCEPTION 'supplier_request_operator_required'; END IF;
  SELECT * INTO v_request FROM public.supplier_requests WHERE id=p_request_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'supplier_request_not_found'; END IF;
  IF v_request.status='provisioned' THEN RAISE EXCEPTION 'supplier_request_already_provisioned'; END IF;
  IF v_request.status<>'submitted' THEN RAISE EXCEPTION 'supplier_request_not_submitted'; END IF;
  IF v_request.revision<>p_expected_revision THEN RAISE EXCEPTION 'supplier_request_revision_conflict'; END IF;
  IF EXISTS (SELECT 1 FROM public.supplier_request_reviews WHERE tenant_id=v_tenant AND request_id=p_request_id AND state='needs_information') THEN
    RAISE EXCEPTION 'supplier_request_information_required';
  END IF;
  SELECT construction.chip,construction.carrier,construction.material INTO v_chip,v_carrier,v_material FROM (VALUES
    ('pet_wet','NTAG424_DNA','ntag424_dna','transparent_pet_wet_inlay'),
    ('white_wet','NTAG424_DNA','ntag424_dna','white_wet_inlay'),
    ('dry_inlay','NTAG424_DNA','ntag424_dna','dry_inlay'),
    ('tt_bridge','NTAG424_DNA_TT','ntag424_dna_tt','tagtamper_tail'),
    ('tt_void','NTAG424_DNA_TT','ntag424_dna_tt','tagtamper_void_destructible'),
    ('uhf_label','','uhf_rfid','uhf_logistics_label'),
    ('uhf_metal','','uhf_rfid','uhf_on_metal')
  ) AS construction(id,chip,carrier,material) WHERE construction.id=v_request.construction_id;
  IF NOT FOUND OR (p_input->>'total_quantity')::numeric IS DISTINCT FROM v_request.quantity
    OR p_input->>'pack_purpose' IS DISTINCT FROM v_request.pack_purpose
    OR p_input->>'carrier_profile_code' IS DISTINCT FROM v_carrier OR p_input->>'material_type' IS DISTINCT FROM v_material
    OR (v_chip<>'' AND p_input->>'chip_model' IS DISTINCT FROM v_chip)
    OR (v_chip='' AND (COALESCE(btrim(p_input->>'chip_model'),'')='' OR p_input->>'chip_model' ~* 'NTAG')) THEN
    RAISE EXCEPTION 'supplier_request_order_mismatch';
  END IF;
  v_before:=to_jsonb(v_request);
  -- Keep the established atomic provisioning function unchanged. Its key,
  -- purpose, packaging and physical release gates remain authoritative.
  SELECT result.supplier_order,result.sub_batches INTO v_order,v_batches FROM public.nexid_create_supplier_order_v2(p_input) result;
  IF v_order IS NULL OR (v_order->>'id')::uuid IS DISTINCT FROM (p_input->>'supplier_order_id')::uuid OR (v_order->>'tenant_id')::uuid IS DISTINCT FROM v_tenant THEN
    RAISE EXCEPTION 'supplier_request_order_readback_invalid';
  END IF;
  UPDATE public.supplier_requests SET status='provisioned',order_id=(v_order->>'id')::uuid,revision=revision+1,updated_by=v_actor,updated_at=clock_timestamp()
    WHERE id=p_request_id AND tenant_id=v_tenant RETURNING * INTO v_request;
  INSERT INTO public.audit_logs(actor_id,tenant_id,action,resource_type,resource_id,before_hash,after_hash,request_id)
    VALUES(v_actor,v_tenant,'supplier_request_provisioned','supplier_request',p_request_id::text,
      encode(sha256(convert_to(v_before::text,'UTF8')),'hex'),encode(sha256(convert_to(to_jsonb(v_request)::text,'UTF8')),'hex'),p_input->>'request_id');
  RETURN QUERY SELECT v_order,v_batches;
END;
$$;

REVOKE ALL ON FUNCTION public.nexid_convert_supplier_request_v1(uuid,integer,jsonb) FROM PUBLIC;
