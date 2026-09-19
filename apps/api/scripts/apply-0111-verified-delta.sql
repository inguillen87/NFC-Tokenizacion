-- Equivalent to migration 0111; source and target normalized SHA-256 are verified before commit.
DO $base$ DECLARE h text; BEGIN
 SELECT encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') INTO h FROM pg_proc WHERE oid='public.nexid_capture_epcis_document_v1(jsonb)'::regprocedure;
 IF h NOT IN ('27adc41f0c3eb0fddd26ca19ba1718eeadd470828bdf4afe120bc9dd67caca39','268586fa4b0976bf8100c2038829bee8536256dd4e9ea3f0b356b3357c942cdf') THEN RAISE EXCEPTION 'epcis_engine_changed_reconcile_before_upgrade';END IF;
 SELECT encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') INTO h FROM pg_proc WHERE oid='public.nexid_enforce_epcis_capture_scope_v1()'::regprocedure;
 IF h NOT IN ('ba61cb405aeea2c73292f0b51eab2f651596eb7667e6ff509b71298a3bfdbc19','a8d6d905a6879d6f7d1ea32052521d74ef45ef2f3268c6afc7bb726d7f28f78e') THEN RAISE EXCEPTION 'epcis_scope_changed_reconcile_before_upgrade';END IF;
END; $base$;
-- Add an explicit human-origin alternative; never impersonate an integration key.
-- Existing SDK captures keep their original actor and contract.
ALTER TABLE public.epcis_capture_operations ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES public.users(id) ON DELETE RESTRICT;
ALTER TABLE public.epcis_capture_operations ADD COLUMN IF NOT EXISTS operator_context jsonb;
ALTER TABLE public.epcis_capture_operations ALTER COLUMN api_key_id DROP NOT NULL;
DO $constraint$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.epcis_capture_operations'::regclass AND conname='epcis_capture_actor_choice') THEN
  ALTER TABLE public.epcis_capture_operations ADD CONSTRAINT epcis_capture_actor_choice CHECK ((
   (api_key_id IS NOT NULL AND actor_user_id IS NULL AND operator_context IS NULL)
   OR (api_key_id IS NULL AND actor_user_id IS NOT NULL AND jsonb_typeof(operator_context)='object'
       AND octet_length(operator_context::text)<=2048
       AND operator_context->>'origin'='operator_import'
       AND operator_context->>'batchId' IS NOT NULL
       AND operator_context->>'documentDigest' ~ '^[0-9a-f]{64}$'
       AND char_length(operator_context->>'reference') BETWEEN 4 AND 160)
  ) IS TRUE);
 END IF;
END;
$constraint$;
CREATE OR REPLACE FUNCTION public.nexid_epcis_require_operator_v1(p_tenant uuid,p_actor uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $operator$
BEGIN
 PERFORM 1 FROM public.users u JOIN public.memberships m ON m.user_id=u.id JOIN public.tenants t ON t.id=p_tenant
 WHERE u.id=p_actor AND u.admin_status='active' AND t.status='active'
 AND ((m.tenant_id=p_tenant AND m.role::text IN ('tenant_owner','tenant_admin','operations_manager')) OR (m.tenant_id IS NULL AND m.role::text='super_admin'))
 FOR SHARE OF u,m,t;
 IF NOT FOUND THEN RAISE EXCEPTION 'epcis_operator_membership_required';END IF;
END;
$operator$;
REVOKE ALL ON FUNCTION public.nexid_epcis_require_operator_v1(uuid,uuid) FROM PUBLIC;

DO $apply$ DECLARE before_body text; after_body text; source text; edit jsonb; h text; BEGIN
 SELECT prosrc INTO before_body FROM pg_proc WHERE oid='public.nexid_capture_epcis_document_v1(jsonb)'::regprocedure;
 after_body:=replace(before_body,E'\r\n',E'\n'); h:=encode(sha256(convert_to(after_body,'UTF8')),'hex');
 IF h='268586fa4b0976bf8100c2038829bee8536256dd4e9ea3f0b356b3357c942cdf' THEN RETURN;END IF;
 IF h<>'27adc41f0c3eb0fddd26ca19ba1718eeadd470828bdf4afe120bc9dd67caca39' THEN RAISE EXCEPTION 'epcis_engine_changed_reconcile_before_upgrade';END IF;
 FOR edit IN SELECT value FROM jsonb_array_elements($edits$[[48,48,";\n  v_actor_user_id uuid;\n  v_operator_context jsonb := p_input->'operator_context'"],[1498,1498,"  v_actor_user_id := NULLIF(p_input->>'actor_user_id', '')::uuid;\n  "],[1632,1632,"("],[1652,1652,")=(v_actor_user_id IS NULL)"],[2556,2556,"v_actor_user_id IS NOT NULL THEN\n    PERFORM public.nexid_epcis_require_operator_v1(v_tenant_id,v_actor_user_id);\n    IF jsonb_typeof(v_operator_context) IS DISTINCT FROM 'object' OR v_operator_context->>'origin' IS DISTINCT FROM 'operator_import' THEN RAISE EXCEPTION 'epcis_operator_context_invalid'; END IF;\n  ELSE\n  IF "],[2859,2859,"\n  END IF;\n"],[3251,3251," OR (v_existing.actor_user_id IS DISTINCT FROM v_actor_user_id) OR (v_existing.operator_context IS DISTINCT FROM v_operator_context)"],[5526,5526,"  IF v_actor_user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_event_input->'identifiers') i JOIN gs1_digital_link_identities g ON g.id=(i->>'registry_id')::uuid WHERE g.tenant_id=v_tenant_id AND g.batch_id=(v_operator_context->>'batchId')::uuid) THEN RAISE EXCEPTION 'epcis_operator_batch_mismatch';END IF;\n  "],[5903,5903,"actor_user_id, operator_context, "],[6067,6067,", v_actor_user_id, v_operator_context"]]$edits$::jsonb) ORDER BY (value->>0)::integer DESC LOOP
  after_body:=overlay(after_body placing (edit->>2) from (edit->>0)::integer+1 for (edit->>1)::integer-(edit->>0)::integer);
 END LOOP;
 IF encode(sha256(convert_to(after_body,'UTF8')),'hex')<>'268586fa4b0976bf8100c2038829bee8536256dd4e9ea3f0b356b3357c942cdf' THEN RAISE EXCEPTION 'epcis_operator_target_hash_mismatch';END IF;
 SELECT pg_get_functiondef('public.nexid_capture_epcis_document_v1(jsonb)'::regprocedure) INTO source;
 EXECUTE replace(source,before_body,after_body);
 SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') INTO h FROM pg_proc WHERE oid='public.nexid_capture_epcis_document_v1(jsonb)'::regprocedure;
 IF h<>'268586fa4b0976bf8100c2038829bee8536256dd4e9ea3f0b356b3357c942cdf' THEN RAISE EXCEPTION 'epcis_operator_installed_hash_mismatch';END IF;
END; $apply$;

CREATE OR REPLACE FUNCTION public.nexid_enforce_epcis_capture_scope_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $scope$
BEGIN
 IF NEW.actor_user_id IS NOT NULL THEN
  PERFORM public.nexid_epcis_require_operator_v1(NEW.tenant_id,NEW.actor_user_id);
  PERFORM 1 FROM public.batches b WHERE b.id=(NEW.operator_context->>'batchId')::uuid AND b.tenant_id=NEW.tenant_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'epcis_operator_batch_mismatch';END IF;
 ELSE
  PERFORM 1 FROM public.tenant_api_keys k WHERE k.id=NEW.api_key_id AND k.tenant_id=NEW.tenant_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'epcis_capture_api_key_tenant_mismatch';END IF;
 END IF;
 RETURN NEW;
END;
$scope$;
CREATE INDEX IF NOT EXISTS epcis_capture_operator_recent ON public.epcis_capture_operations(tenant_id,actor_user_id,captured_at DESC) WHERE actor_user_id IS NOT NULL;
COMMENT ON COLUMN public.epcis_capture_operations.actor_user_id IS 'Authenticated human importer. Mutually exclusive with SDK api_key_id.';
