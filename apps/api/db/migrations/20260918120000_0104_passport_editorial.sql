-- Passport Studio: additive and opt-in per existing batch. No rewriting of live product data.
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS editorial_managed boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.passport_editorial_heads(
  batch_id uuid PRIMARY KEY REFERENCES public.batches(id), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  draft jsonb NOT NULL, published jsonb, published_version integer NOT NULL DEFAULT 0 CHECK(published_version>=0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.passport_editorial_history(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  batch_id uuid NOT NULL REFERENCES public.batches(id), revision integer NOT NULL CHECK(revision>0),
  action text NOT NULL CHECK(action IN ('start','save','submit','request_changes','approve','publish','reopen')),
  actor_id text NOT NULL, actor_label text NOT NULL, note text NOT NULL DEFAULT '',
  document jsonb NOT NULL, content_digest text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(batch_id,revision)
);
CREATE TABLE IF NOT EXISTS public.passport_editorial_receipts(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  batch_id uuid NOT NULL REFERENCES public.batches(id), actor_id text NOT NULL, operation_id uuid NOT NULL,
  request_hash text NOT NULL, action text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,batch_id,actor_id,operation_id)
);
REVOKE ALL ON public.passport_editorial_heads,public.passport_editorial_history,public.passport_editorial_receipts FROM PUBLIC;

-- This internal projection is fingerprinted; raw SDM or key material is never placed in history.
CREATE OR REPLACE FUNCTION public.nexid_editorial_public_fields_v1(cfg jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $proj$
 SELECT jsonb_build_object('common',coalesce((SELECT jsonb_object_agg(key,value) FROM jsonb_each(coalesce(cfg,'{}'::jsonb)) WHERE key=ANY(ARRAY['product_name','public_lot_label','lot','batch_lot','lot_number','sku','winery','region','image_url','agro_product_profile','agroProductProfile','agro'])),'{}'::jsonb),
   'nested_product',cfg#>'{sun,product}','nested_origin',cfg#>'{sun,origin}','product_alias',cfg->'product');
$proj$;
CREATE OR REPLACE FUNCTION public.nexid_editorial_public_digest_v1(cfg jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $hash$
 SELECT encode(sha256(convert_to(public.nexid_editorial_public_fields_v1(cfg)::text,'UTF8')),'hex');
$hash$;
CREATE OR REPLACE FUNCTION public.nexid_editorial_write_guard_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $guard$
BEGIN
 IF OLD.editorial_managed AND NOT NEW.editorial_managed THEN RAISE EXCEPTION 'editorial_managed_cannot_disable'; END IF;
 IF OLD.editorial_managed AND public.nexid_editorial_public_fields_v1(OLD.sdm_config) IS DISTINCT FROM public.nexid_editorial_public_fields_v1(NEW.sdm_config)
    AND coalesce(current_setting('nexid.editorial_authorized_batch',true),'')<>OLD.id::text THEN
   RAISE EXCEPTION 'editorial_managed_use_studio';
 END IF;
 RETURN NEW;
END;
$guard$;
DROP TRIGGER IF EXISTS nexid_editorial_write_guard ON public.batches;
CREATE TRIGGER nexid_editorial_write_guard BEFORE UPDATE OF sdm_config,editorial_managed ON public.batches FOR EACH ROW EXECUTE FUNCTION public.nexid_editorial_write_guard_v1();

CREATE OR REPLACE FUNCTION public.nexid_editorial_commit_v1(p_tenant uuid,p_batch uuid,p_actor text,p_operation uuid,p_command jsonb,p_next jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $commit$
DECLARE
 b public.batches%ROWTYPE; h public.passport_editorial_heads%ROWTYPE; r public.passport_editorial_receipts%ROWTYPE;
 action text:=p_command->>'action'; request_hash text:=encode(sha256(convert_to((p_command->'request')::text,'UTF8')),'hex');
 next_revision integer:=(p_next->>'revision')::integer; expected integer:=(p_command->>'expectedRevision')::integer;
 old_state text; next_state text:=p_next->>'state'; public_hash text; previous_public jsonb; next_public jsonb;
 version integer; patch jsonb; cfg jsonb; saved jsonb; history jsonb; result_id uuid:=gen_random_uuid(); k text;
BEGIN
 IF p_tenant IS NULL OR p_batch IS NULL OR p_operation IS NULL OR coalesce(p_actor,'') !~ '^[A-Za-z0-9][A-Za-z0-9_:-]{0,179}$'
    OR action IS NULL OR action NOT IN ('start','save','submit','request_changes','approve','publish','reopen')
    OR p_next IS NULL OR next_revision IS NULL OR next_revision<1 OR next_state IS NULL OR expected IS NULL OR jsonb_typeof(p_next)<>'object' OR octet_length(p_next::text)>131072 THEN RAISE EXCEPTION 'editorial_request_invalid'; END IF;
 PERFORM set_config('lock_timeout','5s',true);
 PERFORM pg_advisory_xact_lock(hashtextextended('nexid:editorial:'||p_tenant::text||':'||p_batch::text||':'||p_actor||':'||p_operation::text,0));
 SELECT * INTO r FROM public.passport_editorial_receipts WHERE tenant_id=p_tenant AND batch_id=p_batch AND actor_id=p_actor AND operation_id=p_operation;
 IF FOUND THEN
   IF r.request_hash<>request_hash THEN RAISE EXCEPTION 'editorial_idempotency_conflict'; END IF;
   SELECT coalesce(jsonb_agg(x ORDER BY x.revision DESC),'[]'::jsonb) INTO history FROM (SELECT e.id,e.revision,e.action,e.actor_label,e.note,e.document,e.created_at FROM public.passport_editorial_history e WHERE e.tenant_id=p_tenant AND e.batch_id=p_batch AND revision<=(r.result#>>'{draft,revision}')::integer ORDER BY revision DESC LIMIT 10) x;
   RETURN jsonb_build_object('result',r.result,'history',history,'receipt',jsonb_build_object('id',r.id,'operationId',p_operation,'action',action,'committed',true,'replayed',true));
 END IF;
 SELECT * INTO b FROM public.batches WHERE id=p_batch AND tenant_id=p_tenant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'editorial_batch_not_found'; END IF;
 public_hash:=public.nexid_editorial_public_digest_v1(b.sdm_config);
 SELECT * INTO h FROM public.passport_editorial_heads WHERE batch_id=p_batch AND tenant_id=p_tenant FOR UPDATE;
 IF (p_next#>>'{scope,tenantId}') IS DISTINCT FROM p_tenant::text OR (p_next#>>'{scope,batchId}') IS DISTINCT FROM p_batch::text
    OR (p_next->>'contentDigest') !~ '^[a-f0-9]{64}$' OR (p_next->>'basePublishedDigest') !~ '^[a-f0-9]{64}$'
    OR (p_next#>>'{document,schemaVersion}') IS DISTINCT FROM 'nexid.passport-editorial.v1' THEN RAISE EXCEPTION 'editorial_scope_forbidden'; END IF;
 IF action='start' THEN
   IF h.batch_id IS NOT NULL OR b.editorial_managed THEN RAISE EXCEPTION 'editorial_already_managed'; END IF;
   IF next_revision<>1 OR next_state<>'draft' OR expected<>0 OR (p_next->>'createdBy')<>p_actor OR (p_next->>'lastEditorId')<>p_actor
      OR (p_next->>'basePublishedDigest')<>public_hash THEN RAISE EXCEPTION 'editorial_revision_conflict'; END IF;
   previous_public:=p_command->'baselineDocument';
   IF previous_public IS DISTINCT FROM p_next->'document' THEN RAISE EXCEPTION 'editorial_baseline_mismatch'; END IF;
   next_public:=jsonb_build_object('version',0,'document',previous_public,'contentDigest',p_next->>'contentDigest');version:=0;
   UPDATE public.batches SET editorial_managed=true WHERE id=p_batch;
 ELSE
   IF h.batch_id IS NULL OR NOT b.editorial_managed THEN RAISE EXCEPTION 'editorial_not_started'; END IF;
   IF expected IS DISTINCT FROM (h.draft->>'revision')::integer OR (p_command->>'expectedContentDigest') IS DISTINCT FROM h.draft->>'contentDigest'
      OR (p_next->>'id') IS DISTINCT FROM h.draft->>'id' OR next_revision<>expected+1 THEN RAISE EXCEPTION 'editorial_revision_conflict'; END IF;
   IF (p_next#>>'{document,template}') IS DISTINCT FROM h.draft#>>'{document,template}' OR (p_next#>>'{document,locale}') IS DISTINCT FROM h.draft#>>'{document,locale}' THEN RAISE EXCEPTION 'editorial_template_change_not_supported'; END IF;
   old_state:=h.draft->>'state';version:=h.published_version;next_public:=h.published;
   IF action='save' THEN
     IF old_state NOT IN ('draft','changes_requested') OR next_state<>'draft' OR p_next->>'lastEditorId'<>p_actor THEN RAISE EXCEPTION 'editorial_transition_invalid'; END IF;
   ELSIF action='submit' THEN
     IF old_state NOT IN ('draft','changes_requested') OR next_state<>'in_review' OR p_next->>'submittedBy'<>p_actor THEN RAISE EXCEPTION 'editorial_transition_invalid'; END IF;
   ELSIF action='request_changes' THEN
     IF old_state<>'in_review' OR next_state<>'changes_requested' THEN RAISE EXCEPTION 'editorial_transition_invalid'; END IF;
   ELSIF action='approve' THEN
     IF old_state<>'in_review' OR next_state<>'approved' OR p_actor IN (h.draft->>'createdBy',h.draft->>'lastEditorId',h.draft->>'submittedBy')
        OR (p_next#>>'{approval,actorId}')<>p_actor OR (p_next#>>'{approval,contentDigest}')<>h.draft->>'contentDigest' THEN RAISE EXCEPTION 'editorial_independent_review_required'; END IF;
   ELSIF action='reopen' THEN
     IF old_state NOT IN ('approved','published') OR next_state<>'draft' OR p_next->>'createdBy'<>p_actor OR p_next->>'lastEditorId'<>p_actor
        OR p_next->>'basePublishedDigest'<>public_hash THEN RAISE EXCEPTION 'editorial_transition_invalid'; END IF;
   ELSIF action='publish' THEN
     IF old_state<>'approved' OR next_state<>'published' OR p_next->'approval' IS DISTINCT FROM h.draft->'approval' THEN RAISE EXCEPTION 'editorial_approval_required'; END IF;
     IF h.draft->>'basePublishedDigest'<>public_hash THEN RAISE EXCEPTION 'editorial_published_content_changed'; END IF;
     patch:=p_next#>'{document,identity}';
     IF jsonb_typeof(patch)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(patch) x WHERE x<>ALL(ARRAY['product_name','public_lot_label','sku','winery','region','image_url'])) THEN RAISE EXCEPTION 'editorial_field_not_allowed'; END IF;
     IF p_next#>>'{document,template}'='agro' THEN patch:=patch||jsonb_build_object('agro_product_profile',p_next#>'{document,agro_product_profile}'); END IF;
     cfg:=coalesce(b.sdm_config,'{}'::jsonb)||patch;
     -- Keep the known legacy display aliases coherent, without copying or touching keys/counters.
     cfg:=cfg||jsonb_build_object('lot',patch->'public_lot_label','batch_lot',patch->'public_lot_label','lot_number',patch->'public_lot_label');
     cfg:=jsonb_set(cfg,'{sun}',CASE WHEN jsonb_typeof(cfg->'sun')='object' THEN cfg->'sun' ELSE '{}'::jsonb END,true);
     cfg:=jsonb_set(cfg,'{sun,product}',(CASE WHEN jsonb_typeof(cfg#>'{sun,product}')='object' THEN cfg#>'{sun,product}' ELSE '{}'::jsonb END)||jsonb_build_object('name',patch->'product_name','producer',patch->'winery','sku',patch->'sku','imageUrl',patch->'image_url'),true);
     cfg:=jsonb_set(cfg,'{sun,origin}',(CASE WHEN jsonb_typeof(cfg#>'{sun,origin}')='object' THEN cfg#>'{sun,origin}' ELSE '{}'::jsonb END)||jsonb_build_object('region',patch->'region'),true);
     PERFORM set_config('nexid.editorial_authorized_batch',p_batch::text,true);
     UPDATE public.batches SET sdm_config=cfg WHERE id=p_batch AND tenant_id=p_tenant;
     PERFORM set_config('nexid.editorial_authorized_batch','',true);
     version:=version+1;next_public:=jsonb_build_object('version',version,'document',p_next->'document','contentDigest',p_next->>'contentDigest');
   END IF;
   IF action NOT IN ('save') AND p_next->'document' IS DISTINCT FROM h.draft->'document' THEN RAISE EXCEPTION 'editorial_content_changed_without_edit'; END IF;
   IF action NOT IN ('save') AND p_next->>'contentDigest' IS DISTINCT FROM h.draft->>'contentDigest' THEN RAISE EXCEPTION 'editorial_integrity_mismatch'; END IF;
 END IF;
 INSERT INTO public.passport_editorial_heads(batch_id,tenant_id,draft,published,published_version) VALUES(p_batch,p_tenant,p_next,next_public,version)
 ON CONFLICT(batch_id) DO UPDATE SET draft=EXCLUDED.draft,published=EXCLUDED.published,published_version=EXCLUDED.published_version,updated_at=now();
 INSERT INTO public.passport_editorial_history(tenant_id,batch_id,revision,action,actor_id,actor_label,note,document,content_digest)
 VALUES(p_tenant,p_batch,next_revision,action,p_actor,left(coalesce(p_command->>'actorLabel',p_actor),180),left(coalesce(p_command->>'note',''),800),p_next->'document',p_next->>'contentDigest');
 saved:=jsonb_build_object('draft',p_next,'published',next_public);
 INSERT INTO public.passport_editorial_receipts(id,tenant_id,batch_id,actor_id,operation_id,request_hash,action,result) VALUES(result_id,p_tenant,p_batch,p_actor,p_operation,request_hash,action,saved);
 SELECT coalesce(jsonb_agg(x ORDER BY x.revision DESC),'[]'::jsonb) INTO history FROM (SELECT e.id,e.revision,e.action,e.actor_label,e.note,e.document,e.created_at FROM public.passport_editorial_history e WHERE e.tenant_id=p_tenant AND e.batch_id=p_batch ORDER BY revision DESC LIMIT 10) x;
 RETURN jsonb_build_object('result',saved,'history',history,'receipt',jsonb_build_object('id',result_id,'operationId',p_operation,'action',action,'committed',true,'replayed',false));
END;
$commit$;
REVOKE ALL ON FUNCTION public.nexid_editorial_commit_v1(uuid,uuid,text,uuid,jsonb,jsonb) FROM PUBLIC;
