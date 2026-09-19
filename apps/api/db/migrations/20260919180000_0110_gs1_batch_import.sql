-- Additive, bounded GS1 file registration. Existing SUN, tags and batch config are never modified.
CREATE TABLE IF NOT EXISTS public.gs1_batch_import_operations (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id), batch_id uuid NOT NULL REFERENCES public.batches(id),
 actor_user_id uuid NOT NULL, operation_id uuid NOT NULL, request_hash text NOT NULL,
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,batch_id,actor_user_id,operation_id),
 CHECK(request_hash ~ '^[a-f0-9]{64}$'), CHECK(jsonb_typeof(result)='object' AND octet_length(result::text)<=131072)
);
REVOKE ALL ON public.gs1_batch_import_operations FROM PUBLIC;
CREATE INDEX IF NOT EXISTS gs1_batch_import_history ON public.gs1_batch_import_operations(tenant_id,batch_id,created_at DESC);

CREATE OR REPLACE FUNCTION public.nexid_gs1_import_plan_v1(p_tenant uuid,p_batch uuid,p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $plan$
DECLARE b record; item jsonb; matched public.gs1_digital_link_identities%ROWTYPE; entitlement uuid; ordinal integer:=1; label text;
 state text; basis jsonb:='[]'::jsonb; exposed jsonb:='[]'::jsonb; row_out jsonb;
 created_count integer:=0; existing_count integer:=0; blocked_count integer:=0; enabled boolean; fingerprint text;
BEGIN
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 100
    OR octet_length(p_rows::text)>65536 THEN RAISE EXCEPTION 'gs1_import_rows_invalid'; END IF;
 SELECT batch.id,batch.bid,batch.tenant_id,batch.status::text AS batch_status,tenant.slug,tenant.status::text AS tenant_status,
  COALESCE(NULLIF(batch.carrier_profile_code,''),batch.sdm_config->>'carrier_profile_code') AS carrier,
  COALESCE(batch.sdm_config->>'product_name',batch.sdm_config#>>'{sun,product,name}','') AS product,
  EXISTS(SELECT 1 FROM public.tenant_carrier_policies p JOIN public.carrier_profiles c ON c.code=p.carrier_profile_code
   WHERE p.tenant_id=tenant.id AND p.carrier_profile_code='gs1_digital_link' AND p.enabled=true) AS policy_enabled
 INTO b FROM public.batches batch JOIN public.tenants tenant ON tenant.id=batch.tenant_id
 WHERE batch.id=p_batch AND tenant.id=p_tenant;
 IF NOT FOUND THEN RAISE EXCEPTION 'gs1_import_scope_not_found'; END IF;
 IF b.carrier IS DISTINCT FROM 'gs1_digital_link' THEN RAISE EXCEPTION 'gs1_import_profile_mismatch'; END IF;
 label:=btrim(b.product);
 IF char_length(label)>240 OR label ~ '[\x00-\x1F\x7F]' THEN RAISE EXCEPTION 'gs1_import_product_label_invalid'; END IF;
 enabled:=b.batch_status='active' AND b.tenant_status='active' AND b.policy_enabled;
 FOR item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  ordinal:=ordinal+1; entitlement:=NULL; state:='ready'; matched:=NULL;
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(item))<>3
    OR NOT(item ?& ARRAY['gtin','lot','serial']) OR jsonb_typeof(item->'gtin') IS DISTINCT FROM 'string'
    OR jsonb_typeof(item->'lot') IS DISTINCT FROM 'string' OR jsonb_typeof(item->'serial') IS DISTINCT FROM 'string'
    THEN RAISE EXCEPTION 'gs1_import_row_shape_invalid'; END IF;
  IF NOT public.nexid_is_valid_gtin14_v1(item->>'gtin') THEN state:='gtin_invalid';
  ELSIF char_length(item->>'lot')>20 OR (item->>'lot'<>'' AND (item->>'lot' !~ '^[!-~]+$' OR item->>'lot' ~ '[/\\?#%]')) THEN state:='lot_invalid';
  ELSIF char_length(item->>'serial')>20 OR (item->>'serial'<>'' AND (item->>'serial' !~ '^[!-~]+$' OR item->>'serial' ~ '[/\\?#%]')) THEN state:='serial_invalid';
  ELSIF (SELECT count(*) FROM jsonb_array_elements(p_rows) candidate WHERE candidate->>'gtin'=item->>'gtin' AND candidate->>'lot'=item->>'lot' AND candidate->>'serial'=item->>'serial')>1 THEN state:='duplicate_identity';
  ELSE
   SELECT e.id INTO entitlement FROM public.gs1_gtin_prefix_entitlements e
    WHERE e.tenant_id=p_tenant AND e.status='active' AND item->>'gtin' LIKE e.canonical_gtin_prefix||'%'
    ORDER BY length(e.canonical_gtin_prefix) DESC,e.id LIMIT 1;
   IF entitlement IS NULL THEN state:='prefix_required';
   ELSE
    SELECT i.* INTO matched FROM public.gs1_digital_link_identities i
     WHERE i.gtin=item->>'gtin' AND i.lot=item->>'lot' AND i.serial=item->>'serial';
    IF FOUND THEN
     IF matched.tenant_id=p_tenant AND matched.batch_id=p_batch AND matched.tag_id IS NULL AND matched.status='active'
       AND matched.entitlement_id=entitlement AND matched.display_name IS NOT DISTINCT FROM NULLIF(label,'')
       AND matched.metadata_json='{}'::jsonb THEN state:='already_registered';
     ELSE state:='identity_conflict'; END IF;
    END IF;
   END IF;
  END IF;
  row_out:=item||jsonb_build_object('row',ordinal,'state',state,'identityId',CASE WHEN state='already_registered' THEN matched.id ELSE NULL END);
  exposed:=exposed||jsonb_build_array(row_out);
  basis:=basis||jsonb_build_array(row_out||jsonb_build_object('entitlementId',entitlement));
  IF state='ready' THEN created_count:=created_count+1;
  ELSIF state='already_registered' THEN existing_count:=existing_count+1;
  ELSE blocked_count:=blocked_count+1; END IF;
 END LOOP;
 fingerprint:=encode(sha256(convert_to(jsonb_build_object('tenant',p_tenant,'batch',p_batch,'carrier',b.carrier,'product',label,
  'batchStatus',b.batch_status,'tenantStatus',b.tenant_status,'policy',b.policy_enabled,'rows',basis)::text,'UTF8')),'hex');
 RETURN jsonb_build_object('protocol','nexid.gs1-import.v1','source','database',
  'scope',jsonb_build_object('tenant',b.slug,'bid',b.bid,'batchId',p_batch),'product',label,'planDigest',fingerprint,
  'rows',exposed,'counts',jsonb_build_object('new',created_count,'existing',existing_count,'blocked',blocked_count),
  'channelReady',enabled,'canCommit',enabled AND blocked_count=0,'observedAt',now());
END;
$plan$;
REVOKE ALL ON FUNCTION public.nexid_gs1_import_plan_v1(uuid,uuid,jsonb) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.nexid_gs1_import_commit_v1(p_tenant uuid,p_batch uuid,p_actor uuid,p_operation uuid,p_rows jsonb,p_expected text,p_reason text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $commit$
DECLARE previous public.gs1_batch_import_operations%ROWTYPE; request_hash text; plan jsonb; item jsonb;
 identity uuid; entitlement uuid; result_rows jsonb:='[]'::jsonb; result jsonb; label text;
BEGIN
 IF p_tenant IS NULL OR p_batch IS NULL OR p_actor IS NULL OR p_operation IS NULL OR p_expected IS NULL OR p_expected !~ '^[a-f0-9]{64}$'
  OR p_reason IS NULL OR char_length(p_reason) NOT BETWEEN 3 AND 1000 OR p_reason ~ '[\x00-\x1F\x7F]'
  OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 100 OR octet_length(p_rows::text)>65536
  THEN RAISE EXCEPTION 'gs1_import_command_invalid'; END IF;
 PERFORM set_config('lock_timeout','5s',true);
 request_hash:=encode(sha256(convert_to(jsonb_build_object('rows',p_rows,'expected',p_expected,'reason',p_reason)::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended('gs1-import:'||p_tenant::text||':'||p_batch::text||':'||p_actor::text||':'||p_operation::text,0));
 SELECT * INTO previous FROM public.gs1_batch_import_operations WHERE tenant_id=p_tenant AND batch_id=p_batch AND actor_user_id=p_actor AND operation_id=p_operation;
 IF FOUND THEN
  IF previous.request_hash<>request_hash THEN RAISE EXCEPTION 'gs1_import_operation_conflict'; END IF;
  RETURN previous.result||jsonb_build_object('replayed',true);
 END IF;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR SHARE;
 PERFORM 1 FROM public.batches WHERE id=p_batch AND tenant_id=p_tenant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'gs1_import_scope_not_found'; END IF;
 PERFORM 1 FROM public.tenant_carrier_policies WHERE tenant_id=p_tenant AND carrier_profile_code='gs1_digital_link' FOR SHARE;
 PERFORM 1 FROM public.carrier_profiles WHERE code='gs1_digital_link' FOR SHARE;
 PERFORM 1 FROM public.gs1_gtin_prefix_entitlements e WHERE e.tenant_id=p_tenant AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) r WHERE r->>'gtin' LIKE e.canonical_gtin_prefix||'%') ORDER BY e.id FOR SHARE;
 PERFORM 1 FROM public.gs1_digital_link_identities i WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) r WHERE i.gtin=r->>'gtin' AND i.lot=r->>'lot' AND i.serial=r->>'serial') ORDER BY i.id FOR UPDATE;
 plan:=public.nexid_gs1_import_plan_v1(p_tenant,p_batch,p_rows);
 IF plan->>'planDigest' IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'gs1_import_plan_changed'; END IF;
 IF plan->>'canCommit' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'gs1_import_not_ready'; END IF;
 label:=NULLIF(plan->>'product','');
 FOR item IN SELECT value FROM jsonb_array_elements(plan->'rows') LOOP
  IF item->>'state'='already_registered' THEN identity:=(item->>'identityId')::uuid;
  ELSE
   SELECT e.id INTO entitlement FROM public.gs1_gtin_prefix_entitlements e WHERE e.tenant_id=p_tenant AND e.status='active' AND item->>'gtin' LIKE e.canonical_gtin_prefix||'%' ORDER BY length(e.canonical_gtin_prefix) DESC,e.id LIMIT 1;
   INSERT INTO public.gs1_digital_link_identities(tenant_id,entitlement_id,batch_id,gtin,lot,serial,display_name,created_by_user_id)
    VALUES(p_tenant,entitlement,p_batch,item->>'gtin',item->>'lot',item->>'serial',label,p_actor) RETURNING id INTO identity;
   INSERT INTO public.gs1_digital_link_identity_audit(identity_id,tenant_id,action,actor_user_id,reason,snapshot_json)
    VALUES(identity,p_tenant,'registered',p_actor,p_reason,jsonb_build_object('gtin',item->>'gtin','lot',item->>'lot','serial',item->>'serial','batch_id',p_batch,'tag_id',NULL,'entitlement_id',entitlement,'status','active','import_operation_id',p_operation));
  END IF;
  result_rows:=result_rows||jsonb_build_array(item||jsonb_build_object('identityId',identity,'state',CASE WHEN item->>'state'='ready' THEN 'created' ELSE 'already_registered' END));
 END LOOP;
 result:=jsonb_build_object('protocol','nexid.gs1-import-receipt.v1','source','database','scope',plan->'scope','product',plan->'product',
  'operationId',p_operation,'planDigest',p_expected,'committed',true,'replayed',false,'counts',plan->'counts','rows',result_rows,'recordedAt',now());
 INSERT INTO public.gs1_batch_import_operations(tenant_id,batch_id,actor_user_id,operation_id,request_hash,result) VALUES(p_tenant,p_batch,p_actor,p_operation,request_hash,result);
 RETURN result;
END;
$commit$;
REVOKE ALL ON FUNCTION public.nexid_gs1_import_commit_v1(uuid,uuid,uuid,uuid,jsonb,text,text) FROM PUBLIC;
