-- Commercial company requests precede technical supplier orders. Saving and
-- submitting never create batches, key material, exports or physical approvals.
-- The migration runner owns the transaction and schema ledger.
CREATE TABLE public.supplier_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200 AND char_length(btrim(title))>0),
  construction_id text NOT NULL DEFAULT '' CHECK (construction_id IN ('','pet_wet','white_wet','dry_inlay','tt_bridge','tt_void','uhf_label','uhf_metal')),
  quantity integer CHECK (quantity BETWEEN 1 AND 100000000),
  pack_purpose text CHECK (pack_purpose IN ('trial_integration','production')),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes)<=4000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','provisioned')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  submitted_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  submitted_at timestamptz,
  order_id uuid UNIQUE REFERENCES public.supplier_orders(id) ON DELETE RESTRICT,
  UNIQUE (tenant_id,id),
  CHECK ((status='draft' AND submitted_by IS NULL AND submitted_at IS NULL)
    OR (status IN ('submitted','provisioned') AND submitted_by IS NOT NULL AND submitted_at IS NOT NULL
      AND construction_id<>'' AND quantity IS NOT NULL AND pack_purpose IS NOT NULL)),
  CHECK ((status='provisioned')=(order_id IS NOT NULL))
);
CREATE INDEX supplier_requests_tenant_updated_idx ON public.supplier_requests(tenant_id,updated_at DESC,id DESC);
CREATE INDEX supplier_requests_inbox_idx ON public.supplier_requests(updated_at DESC,id DESC) WHERE status IN ('submitted','provisioned');

CREATE TABLE public.supplier_request_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('create','patch','submit')),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  revision integer NOT NULL CHECK (revision>0),
  audit_id uuid NOT NULL UNIQUE REFERENCES public.audit_logs(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (tenant_id,request_id) REFERENCES public.supplier_requests(tenant_id,id) ON DELETE RESTRICT,
  UNIQUE (tenant_id,idempotency_key)
);
CREATE INDEX supplier_request_operations_request_idx ON public.supplier_request_operations(tenant_id,request_id,created_at DESC);

CREATE FUNCTION public.nexid_supplier_request_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'supplier_request_immutable'; END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.revision<>OLD.revision+1 OR NEW.updated_at<OLD.updated_at OR OLD.status='provisioned'
    OR (OLD.status='draft' AND NEW.status NOT IN ('draft','submitted'))
    OR (OLD.status='submitted' AND (NEW.status<>'provisioned'
      OR ROW(NEW.title,NEW.construction_id,NEW.quantity,NEW.pack_purpose,NEW.notes,NEW.submitted_at,NEW.submitted_by)
        IS DISTINCT FROM ROW(OLD.title,OLD.construction_id,OLD.quantity,OLD.pack_purpose,OLD.notes,OLD.submitted_at,OLD.submitted_by))) THEN
    RAISE EXCEPTION 'supplier_request_immutable';
  END IF;
  IF NEW.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.supplier_orders o WHERE o.id=NEW.order_id AND o.tenant_id=NEW.tenant_id) THEN
    RAISE EXCEPTION 'supplier_request_order_scope_invalid';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER supplier_request_guard BEFORE UPDATE OR DELETE ON public.supplier_requests FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_request_guard_v1();
CREATE FUNCTION public.nexid_supplier_request_operation_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'supplier_request_operation_append_only'; END;
$$;
CREATE TRIGGER supplier_request_operation_guard BEFORE UPDATE OR DELETE ON public.supplier_request_operations FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_request_operation_guard_v1();

CREATE FUNCTION public.nexid_supplier_request_actor_v1(p_tenant uuid,p_actor uuid,p_session uuid,p_operator boolean)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM 1 FROM public.auth_sessions s
    JOIN public.users u ON u.id=s.user_id
    JOIN public.memberships m ON m.user_id=u.id AND m.role=s.role AND m.tenant_id IS NOT DISTINCT FROM s.tenant_id
    WHERE s.id=p_session AND s.user_id=p_actor AND s.revoked_at IS NULL AND s.expires_at>now()
      AND u.admin_status::text='active'
      AND ((s.role::text='super_admin' AND s.tenant_id IS NULL) OR (NOT p_operator AND s.tenant_id=p_tenant))
      AND public.nexid_actor_has_enterprise_capability_v1(u.id,s.tenant_id,s.role::text,'supplier_order.create')
    FOR SHARE OF s,u,m;
  RETURN FOUND AND EXISTS (SELECT 1 FROM public.tenants WHERE id=p_tenant);
END;
$$;
CREATE FUNCTION public.nexid_supplier_request_content_valid_v1(p_content jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
  SELECT CASE WHEN jsonb_typeof(p_content) IS DISTINCT FROM 'object' THEN false ELSE
    p_content ?& ARRAY['title','construction_id','quantity','pack_purpose','notes']
    AND NOT EXISTS (SELECT 1 FROM jsonb_object_keys(p_content) k WHERE k NOT IN ('title','construction_id','quantity','pack_purpose','notes'))
    AND jsonb_typeof(p_content->'title')='string' AND char_length(p_content->>'title') BETWEEN 1 AND 200 AND char_length(btrim(p_content->>'title'))>0
    AND jsonb_typeof(p_content->'notes')='string' AND char_length(p_content->>'notes')<=4000
    AND jsonb_typeof(p_content->'construction_id')='string' AND p_content->>'construction_id' IN ('','pet_wet','white_wet','dry_inlay','tt_bridge','tt_void','uhf_label','uhf_metal')
    AND CASE WHEN p_content->'quantity'='null'::jsonb THEN true
      WHEN jsonb_typeof(p_content->'quantity')='number' AND p_content->>'quantity' ~ '^[1-9][0-9]{0,8}$' THEN (p_content->>'quantity')::numeric BETWEEN 1 AND 100000000 ELSE false END
    AND (p_content->'pack_purpose'='null'::jsonb OR (jsonb_typeof(p_content->'pack_purpose')='string' AND p_content->>'pack_purpose' IN ('trial_integration','production')))
  END;
$$;
CREATE FUNCTION public.nexid_supplier_request_current_v1(p_request uuid,p_tenant uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
  SELECT to_jsonb(r)||jsonb_build_object('tenant_slug',t.slug) FROM public.supplier_requests r
    JOIN public.tenants t ON t.id=r.tenant_id WHERE r.id=p_request AND r.tenant_id=p_tenant;
$$;

CREATE FUNCTION public.nexid_mutate_supplier_request_v1(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET lock_timeout='5s' AS $$
DECLARE
  v_tenant uuid; v_actor uuid; v_session uuid; v_key uuid; v_id uuid; v_action text; v_expected integer;
  v_content jsonb; v_fingerprint text; v_audit uuid; v_before jsonb; v_current jsonb;
  v_request public.supplier_requests%ROWTYPE; v_operation public.supplier_request_operations%ROWTYPE;
BEGIN
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR octet_length(p_input::text)>32768 THEN RAISE EXCEPTION 'supplier_request_input_invalid'; END IF;
  v_tenant:=(p_input->>'tenant_id')::uuid; v_actor:=(p_input->>'actor_id')::uuid; v_session:=(p_input->>'auth_session_id')::uuid;
  v_key:=(p_input->>'idempotency_key')::uuid; v_id:=(p_input->>'request_id')::uuid;
  v_action:=p_input->>'action'; v_expected:=(p_input->>'expected_revision')::integer; v_content:=p_input->'content';
  IF v_tenant IS NULL OR v_actor IS NULL OR v_session IS NULL OR v_key IS NULL OR v_action IS NULL OR v_action NOT IN ('create','patch','submit')
    OR (v_action='create' AND (v_id IS NOT NULL OR v_expected IS NOT NULL))
    OR (v_action<>'create' AND (v_id IS NULL OR v_expected IS NULL OR v_expected<1 OR v_expected>=2147483647))
    OR (v_action IN ('create','patch') AND public.nexid_supplier_request_content_valid_v1(v_content) IS NOT TRUE)
    OR (v_action='submit' AND v_content IS DISTINCT FROM 'null'::jsonb) THEN RAISE EXCEPTION 'supplier_request_input_invalid'; END IF;
  IF NOT public.nexid_supplier_request_actor_v1(v_tenant,v_actor,v_session,false) THEN
    RETURN jsonb_build_object('ok',false,'reason','supplier_request_scope_forbidden');
  END IF;
  v_fingerprint:=encode(sha256(convert_to(jsonb_build_array('nexid.supplier-request.v1',v_tenant,v_actor,v_action,v_id,v_expected,v_content)::text,'UTF8')),'hex');
  -- Serialize a key even before a create has a request row. A fresh statement
  -- following the lock sees the concurrent winner's committed operation.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant::text||':'||v_key::text,113));
  SELECT * INTO v_operation FROM public.supplier_request_operations WHERE tenant_id=v_tenant AND idempotency_key=v_key;
  IF FOUND THEN
    IF v_operation.fingerprint<>v_fingerprint THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_idempotency_conflict'); END IF;
    RETURN jsonb_build_object('ok',true,'idempotent_replay',true,
      'request',public.nexid_supplier_request_current_v1(v_operation.request_id,v_tenant),
      'receipt',jsonb_build_object('idempotency_key',v_key,'action',v_operation.action,'revision',v_operation.revision));
  END IF;
  IF v_action='create' THEN
    INSERT INTO public.supplier_requests(tenant_id,title,construction_id,quantity,pack_purpose,notes,created_by,updated_by)
      VALUES(v_tenant,v_content->>'title',v_content->>'construction_id',(v_content->>'quantity')::integer,v_content->>'pack_purpose',v_content->>'notes',v_actor,v_actor)
      RETURNING * INTO v_request;
    v_id:=v_request.id;
  ELSE
    SELECT * INTO v_request FROM public.supplier_requests WHERE id=v_id AND tenant_id=v_tenant FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_not_found'); END IF;
    IF v_request.revision<>v_expected THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_revision_conflict','current_revision',v_request.revision); END IF;
    IF v_request.status<>'draft' THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_not_draft'); END IF;
    v_before:=to_jsonb(v_request);
    IF v_action='submit' THEN
      IF v_request.construction_id='' OR v_request.quantity IS NULL OR v_request.pack_purpose IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_incomplete'); END IF;
      UPDATE public.supplier_requests SET status='submitted',revision=revision+1,submitted_by=v_actor,submitted_at=clock_timestamp(),updated_by=v_actor,updated_at=clock_timestamp()
        WHERE id=v_id AND tenant_id=v_tenant RETURNING * INTO v_request;
    ELSE
      UPDATE public.supplier_requests SET title=v_content->>'title',construction_id=v_content->>'construction_id',quantity=(v_content->>'quantity')::integer,
        pack_purpose=v_content->>'pack_purpose',notes=v_content->>'notes',revision=revision+1,updated_by=v_actor,updated_at=clock_timestamp()
        WHERE id=v_id AND tenant_id=v_tenant RETURNING * INTO v_request;
    END IF;
  END IF;
  v_current:=public.nexid_supplier_request_current_v1(v_id,v_tenant); v_audit:=gen_random_uuid();
  INSERT INTO public.audit_logs(id,actor_id,tenant_id,action,resource_type,resource_id,before_hash,after_hash,request_id)
    VALUES(v_audit,v_actor,v_tenant,'supplier_request_'||CASE v_action WHEN 'create' THEN 'created' WHEN 'patch' THEN 'updated' ELSE 'submitted' END,
      'supplier_request',v_id::text,CASE WHEN v_before IS NULL THEN NULL ELSE encode(sha256(convert_to(v_before::text,'UTF8')),'hex') END,
      encode(sha256(convert_to(to_jsonb(v_request)::text,'UTF8')),'hex'),v_key::text);
  INSERT INTO public.supplier_request_operations(tenant_id,request_id,idempotency_key,actor_id,action,fingerprint,revision,audit_id)
    VALUES(v_tenant,v_id,v_key,v_actor,v_action,v_fingerprint,v_request.revision,v_audit);
  RETURN jsonb_build_object('ok',true,'idempotent_replay',false,'request',v_current,
    'receipt',jsonb_build_object('idempotency_key',v_key,'action',v_action,'revision',v_request.revision));
END;
$$;

CREATE FUNCTION public.nexid_convert_supplier_request_v1(p_request_id uuid,p_expected_revision integer,p_input jsonb)
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

REVOKE ALL ON public.supplier_requests,public.supplier_request_operations FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_guard_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_operation_guard_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_actor_v1(uuid,uuid,uuid,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_content_valid_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_current_v1(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_mutate_supplier_request_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_convert_supplier_request_v1(uuid,integer,jsonb) FROM PUBLIC;
