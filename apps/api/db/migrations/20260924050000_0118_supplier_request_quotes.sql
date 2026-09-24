-- Versioned commercial quotations. No pricing, purchases, permissions, keys,
-- cancellations or messages are created by this migration. Forward-only; the
-- established migration runner owns the transaction and ledger.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
ALTER TABLE public.supplier_requests ADD COLUMN quotation_revision integer NOT NULL DEFAULT 0
 CHECK(quotation_revision BETWEEN 0 AND 2147483646);
ALTER TABLE public.supplier_requests ADD COLUMN quotation_state text CHECK(quotation_state IN ('offered','accepted','rejected','withdrawn'));
ALTER TABLE public.supplier_requests ADD CONSTRAINT supplier_quote_state_bound CHECK((quotation_revision=0)=(quotation_state IS NULL));
CREATE TABLE public.supplier_request_quote_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
 request_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 2147483646),
 request_revision integer NOT NULL CHECK(request_revision>1),
 review_revision integer NOT NULL CHECK(review_revision BETWEEN 0 AND 2147483646),
 quote_version integer NOT NULL CHECK(quote_version>0),
 source_request_revision integer NOT NULL CHECK(source_request_revision>0),
 action text NOT NULL CHECK(action IN ('issue','accept','reject','withdraw')),
 state text NOT NULL CHECK(state IN ('offered','accepted','rejected','withdrawn')),
 currency text NOT NULL CHECK(currency IN ('ARS','USD','EUR')),
 net_minor bigint NOT NULL CHECK(net_minor BETWEEN 1 AND 999999999999),
 tax_minor bigint NOT NULL CHECK(tax_minor BETWEEN 0 AND 999999999999),
 shipping_minor bigint NOT NULL CHECK(shipping_minor BETWEEN 0 AND 999999999999),
 total_minor bigint GENERATED ALWAYS AS (net_minor+tax_minor+shipping_minor) STORED CHECK(total_minor<=999999999999),
 valid_until timestamptz NOT NULL,
 conditions text NOT NULL CHECK(public.nexid_supplier_request_review_message_valid_v1(conditions) IS TRUE),
 reason text NOT NULL CHECK((action='accept' AND reason='') OR public.nexid_supplier_request_review_message_valid_v1(reason) IS TRUE),
 actor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 auth_session_id uuid NOT NULL REFERENCES public.auth_sessions(id) ON DELETE RESTRICT,
 idempotency_key uuid NOT NULL,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
 audit_id uuid NOT NULL UNIQUE REFERENCES public.audit_logs(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL,
 FOREIGN KEY(tenant_id,request_id) REFERENCES public.supplier_requests(tenant_id,id) ON DELETE RESTRICT,
 UNIQUE(tenant_id,request_id,revision), UNIQUE(tenant_id,idempotency_key),
 CHECK(state=CASE action WHEN 'issue' THEN 'offered' WHEN 'accept' THEN 'accepted' WHEN 'reject' THEN 'rejected' ELSE 'withdrawn' END)
);

CREATE OR REPLACE FUNCTION public.nexid_supplier_request_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'supplier_request_immutable'; END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.revision<>OLD.revision+1 OR NEW.updated_at<OLD.updated_at OR OLD.status IN ('provisioned','cancelled')
    OR (OLD.status='draft' AND NEW.status NOT IN ('draft','submitted'))
    OR (OLD.status='submitted' AND (NEW.status NOT IN ('submitted','provisioned','cancelled')
      OR ROW(NEW.title,NEW.construction_id,NEW.quantity,NEW.pack_purpose,NEW.notes,NEW.submitted_at,NEW.submitted_by)
        IS DISTINCT FROM ROW(OLD.title,OLD.construction_id,OLD.quantity,OLD.pack_purpose,OLD.notes,OLD.submitted_at,OLD.submitted_by))) THEN
    RAISE EXCEPTION 'supplier_request_immutable';
  END IF;
  IF NEW.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.supplier_orders o WHERE o.id=NEW.order_id AND o.tenant_id=NEW.tenant_id) THEN
    RAISE EXCEPTION 'supplier_request_order_scope_invalid';
  END IF;
  IF NEW.status='cancelled' AND (OLD.status<>'submitted' OR NEW.cancelled_by IS DISTINCT FROM NEW.updated_by
    OR NEW.cancelled_at IS DISTINCT FROM NEW.updated_at) THEN RAISE EXCEPTION 'supplier_request_cancellation_invalid'; END IF;
  IF OLD.status='submitted' AND NEW.status='submitted' THEN
    IF NEW.quotation_revision<>OLD.quotation_revision+1 OR NEW.order_id IS DISTINCT FROM OLD.order_id
      OR ROW(NEW.cancellation_reason,NEW.cancelled_by,NEW.cancelled_at) IS DISTINCT FROM ROW(OLD.cancellation_reason,OLD.cancelled_by,OLD.cancelled_at)
    THEN RAISE EXCEPTION 'supplier_request_immutable'; END IF;
  ELSIF NEW.quotation_revision<>OLD.quotation_revision OR NEW.quotation_state IS DISTINCT FROM OLD.quotation_state THEN RAISE EXCEPTION 'supplier_request_immutable'; END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.nexid_supplier_quote_actor_v1(p_tenant uuid,p_actor uuid,p_session uuid,p_action text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_action IS NULL OR p_action NOT IN ('read','issue','accept','reject','withdraw') THEN RETURN false; END IF;
 IF NOT public.nexid_supplier_request_cancellation_actor_v1(p_tenant,p_actor,p_session) THEN RETURN false; END IF;
 RETURN EXISTS(SELECT 1 FROM public.auth_sessions s WHERE s.id=p_session AND s.user_id=p_actor
   AND (p_action='read' OR (p_action IN ('issue','withdraw') AND s.role::text='super_admin' AND s.tenant_id IS NULL)
     OR (p_action IN ('accept','reject') AND s.role::text<>'super_admin' AND s.tenant_id=p_tenant)));
END;
$$;
CREATE FUNCTION public.nexid_supplier_quote_event_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE r public.supplier_requests%ROWTYPE;e public.supplier_request_quote_events%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'supplier_quote_append_only'; END IF;
 SELECT * INTO r FROM public.supplier_requests WHERE tenant_id=NEW.tenant_id AND id=NEW.request_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'submitted' OR r.quotation_revision<>NEW.revision OR r.revision<>NEW.request_revision
 OR r.updated_by<>NEW.actor_id OR r.updated_at<>NEW.created_at OR r.quotation_state<>NEW.state THEN RAISE EXCEPTION 'supplier_quote_request_binding_invalid'; END IF;
 IF NOT public.nexid_supplier_quote_actor_v1(NEW.tenant_id,NEW.actor_id,NEW.auth_session_id,NEW.action) THEN RAISE EXCEPTION 'supplier_quote_scope_forbidden'; END IF;
 SELECT * INTO e FROM public.supplier_request_quote_events WHERE tenant_id=NEW.tenant_id AND request_id=NEW.request_id ORDER BY revision DESC LIMIT 1;
 IF NEW.revision<>COALESCE(e.revision,0)+1 OR (e.id IS NOT NULL AND NEW.created_at<e.created_at) THEN RAISE EXCEPTION 'supplier_quote_revision_conflict'; END IF;
 IF NEW.review_revision<>COALESCE((SELECT revision FROM public.supplier_request_reviews WHERE tenant_id=NEW.tenant_id AND request_id=NEW.request_id),0) THEN RAISE EXCEPTION 'supplier_request_review_revision_conflict'; END IF;
 IF NEW.action='issue' THEN
   IF NEW.quote_version<>COALESCE(e.quote_version,0)+1 OR e.state='accepted' OR NEW.source_request_revision<>NEW.request_revision-1
     OR NEW.valid_until<=NEW.created_at OR NEW.valid_until>NEW.created_at+interval '90 days'
   THEN RAISE EXCEPTION 'supplier_quote_transition_invalid'; END IF;
 ELSE
   IF e.id IS NULL OR e.state<>'offered' OR ROW(NEW.currency,NEW.net_minor,NEW.tax_minor,NEW.shipping_minor,NEW.valid_until,NEW.conditions,NEW.quote_version,NEW.source_request_revision)
     IS DISTINCT FROM ROW(e.currency,e.net_minor,e.tax_minor,e.shipping_minor,e.valid_until,e.conditions,e.quote_version,e.source_request_revision)
   THEN RAISE EXCEPTION 'supplier_quote_transition_invalid'; END IF;
   IF NEW.action='accept' AND NEW.review_revision<>e.review_revision THEN RAISE EXCEPTION 'supplier_quote_review_changed'; END IF;
   IF NEW.action='accept' AND NEW.valid_until<=NEW.created_at THEN RAISE EXCEPTION 'supplier_quote_expired'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER supplier_quote_event_guard BEFORE INSERT OR UPDATE OR DELETE ON public.supplier_request_quote_events
 FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_quote_event_guard_v1();
CREATE FUNCTION public.nexid_supplier_quote_receipt_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.quotation_revision=0 THEN RETURN NULL; END IF;
 IF TG_OP='UPDATE' AND NEW.quotation_revision=OLD.quotation_revision THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.supplier_request_quote_events e JOIN public.audit_logs a ON a.id=e.audit_id
 WHERE e.tenant_id=NEW.tenant_id AND e.request_id=NEW.id AND e.revision=NEW.quotation_revision AND e.request_revision=NEW.revision
 AND e.actor_id=NEW.updated_by AND e.created_at=NEW.updated_at AND a.actor_id=e.actor_id AND a.tenant_id=e.tenant_id
 AND a.resource_type='supplier_request_quote' AND a.resource_id=NEW.id::text AND a.action='supplier_quote_'||e.action
 AND a.request_id=e.idempotency_key::text AND a.after_hash=encode(sha256(convert_to(to_jsonb(NEW)::text,'UTF8')),'hex')) THEN
 RAISE EXCEPTION 'supplier_quote_receipt_required'; END IF;
 RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER supplier_quote_receipt_guard AFTER INSERT OR UPDATE ON public.supplier_requests
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_quote_receipt_guard_v1();

CREATE FUNCTION public.nexid_supplier_quote_public_event_v1(e public.supplier_request_quote_events)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('id',e.id,'revision',e.revision,'request_revision',e.request_revision,'quote_version',e.quote_version,
 'source_request_revision',e.source_request_revision,'review_revision',e.review_revision,'action',e.action,'state',e.state,'currency',e.currency,
 'net_minor',e.net_minor,'tax_minor',e.tax_minor,'shipping_minor',e.shipping_minor,'total_minor',e.total_minor,
 'valid_until',e.valid_until,'conditions',e.conditions,'reason',e.reason,'actor_id',e.actor_id,'created_at',e.created_at);
$$;
CREATE FUNCTION public.nexid_supplier_quote_current_v1(p_request uuid,p_tenant uuid,p_before integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE r public.supplier_requests%ROWTYPE;e public.supplier_request_quote_events%ROWTYPE;items jsonb;first_revision integer;counted integer;
BEGIN
 IF p_before IS NOT NULL AND (p_before<1 OR p_before>2147483646) THEN RAISE EXCEPTION 'supplier_quote_cursor_invalid'; END IF;
 SELECT * INTO r FROM public.supplier_requests WHERE id=p_request AND tenant_id=p_tenant FOR SHARE;
 IF NOT FOUND OR r.status='draft' THEN RETURN NULL; END IF;
 SELECT * INTO e FROM public.supplier_request_quote_events WHERE tenant_id=p_tenant AND request_id=p_request ORDER BY revision DESC LIMIT 1;
 SELECT COALESCE(jsonb_agg(public.nexid_supplier_quote_public_event_v1(q) ORDER BY q.revision),'[]'::jsonb),min(q.revision),count(*)::integer
 INTO items,first_revision,counted FROM (SELECT * FROM public.supplier_request_quote_events WHERE tenant_id=p_tenant AND request_id=p_request
 AND(p_before IS NULL OR revision<p_before) ORDER BY revision DESC LIMIT 50) q;
 RETURN jsonb_build_object('request',public.nexid_supplier_request_current_v1(p_request,p_tenant),'revision',r.quotation_revision,
 'current',CASE WHEN e.id IS NULL THEN NULL ELSE public.nexid_supplier_quote_public_event_v1(e) END,
 'history',items,'count',counted,'truncated',COALESCE(first_revision>1,false),'next_before_revision',CASE WHEN first_revision>1 THEN first_revision ELSE NULL END,
 'as_of',clock_timestamp());
END;
$$;
CREATE FUNCTION public.nexid_supplier_quote_read_v1(p_request uuid,p_tenant uuid,p_actor uuid,p_session uuid,p_before integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET lock_timeout='5s' AS $$
BEGIN
 IF NOT public.nexid_supplier_quote_actor_v1(p_tenant,p_actor,p_session,'read') THEN RETURN jsonb_build_object('ok',false,'reason','supplier_quote_scope_forbidden'); END IF;
 RETURN public.nexid_supplier_quote_current_v1(p_request,p_tenant,p_before);
END;
$$;

CREATE FUNCTION public.nexid_mutate_supplier_quote_v1(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET lock_timeout='5s' AS $$
DECLARE
 v_tenant uuid;v_actor uuid;v_session uuid;v_id uuid;v_key uuid;v_action text;v_reason text;v_offer jsonb;v_fingerprint text;
 v_expected integer;v_request_expected integer;v_review_expected integer;v_now timestamptz;v_audit uuid;v_before jsonb;
 r public.supplier_requests%ROWTYPE;e public.supplier_request_quote_events%ROWTYPE;o public.supplier_request_quote_events%ROWTYPE;n public.supplier_request_quote_events%ROWTYPE;
BEGIN
 IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR octet_length(p_input::text)>32768
 OR NOT(p_input ?& ARRAY['tenant_id','actor_id','auth_session_id','request_id','idempotency_key','action','expected_revision','expected_request_revision','expected_review_revision','offer','reason'])
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k WHERE k NOT IN ('tenant_id','actor_id','auth_session_id','request_id','idempotency_key','action','expected_revision','expected_request_revision','expected_review_revision','offer','reason'))
 THEN RAISE EXCEPTION 'supplier_quote_input_invalid'; END IF;
 v_tenant:=(p_input->>'tenant_id')::uuid;v_actor:=(p_input->>'actor_id')::uuid;v_session:=(p_input->>'auth_session_id')::uuid;
 v_id:=(p_input->>'request_id')::uuid;v_key:=(p_input->>'idempotency_key')::uuid;v_action:=p_input->>'action';v_reason:=p_input->>'reason';v_offer:=p_input->'offer';
 IF v_tenant IS NULL OR v_actor IS NULL OR v_session IS NULL OR v_id IS NULL OR v_key IS NULL OR v_action IS NULL OR v_action NOT IN ('issue','accept','reject','withdraw')
 OR jsonb_typeof(p_input->'reason') IS DISTINCT FROM 'string'
 OR NOT((v_action='accept' AND v_reason='') OR public.nexid_supplier_request_review_message_valid_v1(v_reason) IS TRUE)
 OR EXISTS(SELECT 1 FROM unnest(ARRAY['expected_revision','expected_request_revision','expected_review_revision']) k
   WHERE jsonb_typeof(p_input->k) IS DISTINCT FROM 'number' OR (p_input->>k) !~ '^(0|[1-9][0-9]{0,9})$')
 THEN RAISE EXCEPTION 'supplier_quote_input_invalid'; END IF;
 IF (p_input->>'expected_revision')::numeric>=2147483646 OR (p_input->>'expected_request_revision')::numeric NOT BETWEEN 1 AND 2147483645
 OR (p_input->>'expected_review_revision')::numeric>=2147483647 THEN RAISE EXCEPTION 'supplier_quote_input_invalid'; END IF;
 v_expected:=(p_input->>'expected_revision')::integer;v_request_expected:=(p_input->>'expected_request_revision')::integer;v_review_expected:=(p_input->>'expected_review_revision')::integer;
 IF v_action='issue' THEN
  IF jsonb_typeof(v_offer) IS DISTINCT FROM 'object' OR NOT(v_offer ?& ARRAY['currency','net_minor','tax_minor','shipping_minor','valid_until','conditions'])
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(v_offer) k WHERE k NOT IN ('currency','net_minor','tax_minor','shipping_minor','valid_until','conditions'))
  OR jsonb_typeof(v_offer->'currency') IS DISTINCT FROM 'string' OR v_offer->>'currency' NOT IN ('ARS','USD','EUR')
  OR jsonb_typeof(v_offer->'conditions') IS DISTINCT FROM 'string' OR public.nexid_supplier_request_review_message_valid_v1(v_offer->>'conditions') IS NOT TRUE
  OR jsonb_typeof(v_offer->'valid_until') IS DISTINCT FROM 'string' OR (v_offer->>'valid_until') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
  OR EXISTS(SELECT 1 FROM unnest(ARRAY['net_minor','tax_minor','shipping_minor']) k WHERE jsonb_typeof(v_offer->k) IS DISTINCT FROM 'number' OR (v_offer->>k) !~ '^(0|[1-9][0-9]{0,11})$')
  THEN RAISE EXCEPTION 'supplier_quote_input_invalid'; END IF;
  IF (v_offer->>'net_minor')::bigint<1 OR (v_offer->>'net_minor')::bigint+(v_offer->>'tax_minor')::bigint+(v_offer->>'shipping_minor')::bigint>999999999999 THEN RAISE EXCEPTION 'supplier_quote_input_invalid'; END IF;
 ELSIF v_offer IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'supplier_quote_input_invalid'; END IF;
 IF NOT public.nexid_supplier_quote_actor_v1(v_tenant,v_actor,v_session,v_action) THEN RETURN jsonb_build_object('ok',false,'reason','supplier_quote_scope_forbidden'); END IF;
 v_fingerprint:=encode(sha256(convert_to(jsonb_build_array('nexid.supplier-quote.v1',v_tenant,v_actor,v_id,v_action,v_expected,v_request_expected,v_review_expected,v_offer,v_reason)::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant::text||':'||v_key::text,118));
 SELECT * INTO r FROM public.supplier_requests WHERE id=v_id AND tenant_id=v_tenant FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_not_found'); END IF;
 IF NOT public.nexid_supplier_quote_actor_v1(v_tenant,v_actor,v_session,v_action) THEN RETURN jsonb_build_object('ok',false,'reason','supplier_quote_scope_forbidden'); END IF;
 SELECT * INTO o FROM public.supplier_request_quote_events WHERE tenant_id=v_tenant AND idempotency_key=v_key;
 IF FOUND THEN
  IF o.fingerprint<>v_fingerprint THEN RETURN jsonb_build_object('ok',false,'reason','supplier_quote_idempotency_conflict'); END IF;
  RETURN public.nexid_supplier_quote_current_v1(v_id,v_tenant)||jsonb_build_object('ok',true,'idempotent_replay',true,
   'receipt',jsonb_build_object('idempotency_key',v_key,'action',o.action,'revision',o.revision,'request_revision',o.request_revision,'quote_version',o.quote_version));
 END IF;
 IF r.status<>'submitted' THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_not_submitted'); END IF;
 IF r.revision<>v_request_expected OR r.quotation_revision<>v_expected THEN RETURN jsonb_build_object('ok',false,'reason','supplier_quote_revision_conflict'); END IF;
 IF COALESCE((SELECT revision FROM public.supplier_request_reviews WHERE tenant_id=v_tenant AND request_id=v_id),0)<>v_review_expected THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_review_revision_conflict'); END IF;
 IF v_action IN ('issue','accept') AND EXISTS(SELECT 1 FROM public.supplier_request_reviews WHERE tenant_id=v_tenant AND request_id=v_id AND state='needs_information') THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_information_required'); END IF;
 SELECT * INTO e FROM public.supplier_request_quote_events WHERE tenant_id=v_tenant AND request_id=v_id ORDER BY revision DESC LIMIT 1;
 v_now:=clock_timestamp();
 IF v_action='issue' THEN
  IF e.state='accepted' THEN RETURN jsonb_build_object('ok',false,'reason','supplier_quote_transition_invalid'); END IF;
  IF (v_offer->>'valid_until')::timestamptz<=v_now OR (v_offer->>'valid_until')::timestamptz>v_now+interval '90 days' THEN RETURN jsonb_build_object('ok',false,'reason','supplier_quote_validity_invalid'); END IF;
 ELSE
  IF e.id IS NULL OR e.state<>'offered' THEN RETURN jsonb_build_object('ok',false,'reason','supplier_quote_transition_invalid'); END IF;
  IF v_action='accept' AND e.review_revision<>v_review_expected THEN RETURN jsonb_build_object('ok',false,'reason','supplier_quote_review_changed'); END IF;
  IF v_action='accept' AND e.valid_until<=v_now THEN RETURN jsonb_build_object('ok',false,'reason','supplier_quote_expired'); END IF;
 END IF;
 v_before:=to_jsonb(r);v_audit:=gen_random_uuid();
 UPDATE public.supplier_requests SET revision=revision+1,quotation_revision=quotation_revision+1,quotation_state=CASE v_action WHEN 'issue' THEN 'offered' WHEN 'accept' THEN 'accepted' WHEN 'reject' THEN 'rejected' ELSE 'withdrawn' END,updated_by=v_actor,updated_at=v_now WHERE id=v_id AND tenant_id=v_tenant RETURNING * INTO r;
 INSERT INTO public.audit_logs(id,actor_id,tenant_id,action,resource_type,resource_id,before_hash,after_hash,request_id)
 VALUES(v_audit,v_actor,v_tenant,'supplier_quote_'||v_action,'supplier_request_quote',v_id::text,
 encode(sha256(convert_to(v_before::text,'UTF8')),'hex'),encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex'),v_key::text);
 INSERT INTO public.supplier_request_quote_events(tenant_id,request_id,revision,request_revision,review_revision,quote_version,source_request_revision,action,state,currency,net_minor,tax_minor,shipping_minor,valid_until,conditions,reason,actor_id,auth_session_id,idempotency_key,fingerprint,audit_id,created_at)
 VALUES(v_tenant,v_id,r.quotation_revision,r.revision,v_review_expected,CASE WHEN v_action='issue' THEN COALESCE(e.quote_version,0)+1 ELSE e.quote_version END,
 CASE WHEN v_action='issue' THEN r.revision-1 ELSE e.source_request_revision END,v_action,CASE v_action WHEN 'issue' THEN 'offered' WHEN 'accept' THEN 'accepted' WHEN 'reject' THEN 'rejected' ELSE 'withdrawn' END,
 CASE WHEN v_action='issue' THEN v_offer->>'currency' ELSE e.currency END,
 CASE WHEN v_action='issue' THEN (v_offer->>'net_minor')::bigint ELSE e.net_minor END,
 CASE WHEN v_action='issue' THEN (v_offer->>'tax_minor')::bigint ELSE e.tax_minor END,
 CASE WHEN v_action='issue' THEN (v_offer->>'shipping_minor')::bigint ELSE e.shipping_minor END,
 CASE WHEN v_action='issue' THEN (v_offer->>'valid_until')::timestamptz ELSE e.valid_until END,
 CASE WHEN v_action='issue' THEN v_offer->>'conditions' ELSE e.conditions END,v_reason,v_actor,v_session,v_key,v_fingerprint,v_audit,v_now) RETURNING * INTO n;
 RETURN public.nexid_supplier_quote_current_v1(v_id,v_tenant)||jsonb_build_object('ok',true,'idempotent_replay',false,
 'receipt',jsonb_build_object('idempotency_key',v_key,'action',n.action,'revision',n.revision,'request_revision',n.request_revision,'quote_version',n.quote_version));
END;
$$;

-- Preserve the existing industrial conversion function and require an accepted
-- quote only when the request has entered the quoted flow. Trigger-level guard
-- also covers direct SQL or older API callers without a UI-only permission.
CREATE FUNCTION public.nexid_supplier_quote_conversion_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.status='provisioned' AND OLD.quotation_revision>0 AND NOT EXISTS(
 SELECT 1 FROM public.supplier_request_quote_events e WHERE e.tenant_id=OLD.tenant_id AND e.request_id=OLD.id AND e.revision=OLD.quotation_revision AND e.state='accepted')
 THEN RAISE EXCEPTION 'supplier_request_quote_acceptance_required'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER supplier_quote_conversion_guard BEFORE UPDATE ON public.supplier_requests
 FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_quote_conversion_guard_v1();
REVOKE ALL ON public.supplier_request_quote_events FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_quote_actor_v1(uuid,uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_quote_event_guard_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_quote_receipt_guard_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_quote_public_event_v1(public.supplier_request_quote_events) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_quote_current_v1(uuid,uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_quote_read_v1(uuid,uuid,uuid,uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_mutate_supplier_quote_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_quote_conversion_guard_v1() FROM PUBLIC;
