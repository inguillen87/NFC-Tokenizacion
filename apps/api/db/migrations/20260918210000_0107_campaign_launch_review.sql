-- Additive review/simulation only. No sender, scheduler, contact export, budget charge or draft rewrite.
CREATE TABLE public.campaign_launch_plans(
 draft_id uuid PRIMARY KEY REFERENCES public.campaign_drafts(id),tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 version integer NOT NULL CHECK(version>0),draft_revision integer NOT NULL CHECK(draft_revision>0),
 state text NOT NULL CHECK(state IN('configured','in_review','approved')),
 draft_snapshot jsonb NOT NULL,settings jsonb NOT NULL,
 prepared_by uuid NOT NULL REFERENCES public.users(id),submitted_by uuid REFERENCES public.users(id),approved_by uuid REFERENCES public.users(id),approved_at timestamptz,
 latest_simulation jsonb,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.campaign_launch_operations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),draft_id uuid NOT NULL REFERENCES public.campaign_drafts(id),tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 actor_id uuid NOT NULL REFERENCES public.users(id),actor_label text NOT NULL,operation_id uuid NOT NULL,
 action text NOT NULL,request_hash text NOT NULL,command jsonb NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,draft_id,actor_id,operation_id)
);
CREATE INDEX campaign_launch_scope ON public.campaign_launch_plans(tenant_id,updated_at DESC);
CREATE INDEX campaign_launch_history ON public.campaign_launch_operations(tenant_id,draft_id,created_at DESC,id);
REVOKE ALL ON public.campaign_launch_plans,public.campaign_launch_operations FROM PUBLIC;

-- A fresh aggregate at the time of simulation. No identifiers or contact values leave this function.
CREATE FUNCTION public.nexid_campaign_audience_summary_v1(p_tenant uuid,p_channel text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $audience$
DECLARE summary jsonb; required_scope text;
BEGIN
 IF p_channel NOT IN('whatsapp','email','phone') OR p_channel IS NULL THEN RAISE EXCEPTION 'launch_channel_invalid'; END IF;
 required_scope:=p_channel||'_marketing';
 WITH members AS MATERIALIZED (
  SELECT m.consumer_id,m.status,c.email,c.phone
  FROM public.tenant_consumer_memberships m JOIN public.consumers c ON c.id=m.consumer_id
  WHERE m.tenant_id=p_tenant ORDER BY m.consumer_id LIMIT 100001
 ), classified AS MATERIALIZED (
  SELECT m.consumer_id,
   CASE WHEN m.status IS DISTINCT FROM 'active' THEN 'inactive'
    WHEN NOT coalesce((SELECT bool_and(s.granted IS TRUE AND s.granted_at IS NOT NULL AND s.granted_at<=now() AND s.revoked_at IS NULL)
     FROM public.consumer_tenant_consents s WHERE s.tenant_id=p_tenant AND s.consumer_id=m.consumer_id AND lower(s.scope)=required_scope),false) THEN 'no_consent'
    WHEN p_channel='email' AND (m.email IS NULL OR btrim(m.email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') THEN 'invalid_contact'
    WHEN p_channel<>'email' AND (m.phone IS NULL OR btrim(m.phone) !~ '^\+[1-9][0-9]{7,14}$') THEN 'invalid_contact'
    ELSE 'eligible' END AS eligibility,
   CASE WHEN p_channel='email' THEN lower(btrim(m.email)) ELSE btrim(m.phone) END contact_key
  FROM members m
 ) SELECT jsonb_build_object('scope',required_scope,'membersObserved',count(*),
  'inactiveMembership',count(*) FILTER(WHERE eligibility='inactive'),
  'missingCurrentConsent',count(*) FILTER(WHERE eligibility='no_consent'),
  'unusableContact',count(*) FILTER(WHERE eligibility='invalid_contact'),
  'consentedCandidates',count(*) FILTER(WHERE eligibility='eligible'),
  'eligibleDestinations',count(DISTINCT contact_key) FILTER(WHERE eligibility='eligible'),
  'duplicateDestinations',count(*) FILTER(WHERE eligibility='eligible')-count(DISTINCT contact_key) FILTER(WHERE eligibility='eligible'),
  'observedAt',statement_timestamp(),'source','tenant_consumer_memberships + consumer_tenant_consents + consumers',
  'basis','current_consent_and_contact_syntax_not_provider_deliverability') INTO summary FROM classified;
 IF (summary->>'membersObserved')::integer>100000 THEN RAISE EXCEPTION 'launch_audience_limit';END IF;
 RETURN summary;
END;
$audience$;
REVOKE ALL ON FUNCTION public.nexid_campaign_audience_summary_v1(uuid,text) FROM PUBLIC;

CREATE FUNCTION public.nexid_campaign_launch_v1(p_tenant uuid,p_draft uuid,p_actor uuid,p_label text,p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $launch$
DECLARE d public.campaign_drafts%ROWTYPE;w public.campaign_launch_plans%ROWTYPE;old_op public.campaign_launch_operations%ROWTYPE;
 action text:=p_command->>'action';op uuid:=(p_command->>'operationId')::uuid;expected integer:=(p_command->>'expectedVersion')::integer;
 expected_draft integer:=(p_command->>'expectedDraftRevision')::integer;fingerprint text:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
 settings jsonb:=p_command->'settings';snapshot jsonb;result jsonb;audience jsonb;sim jsonb;unit_cost bigint;budget bigint;recipient_limit integer;eligible integer;within_count integer;selected_count integer;receipt uuid:=gen_random_uuid();
BEGIN
 IF p_tenant IS NULL OR p_draft IS NULL OR p_actor IS NULL OR op IS NULL OR expected IS NULL OR expected<0 OR expected_draft IS NULL OR expected_draft<1
 OR action IS NULL OR action NOT IN('configure','submit','request_changes','approve','simulate') OR jsonb_typeof(p_command) IS DISTINCT FROM 'object' OR octet_length(p_command::text)>8192 THEN RAISE EXCEPTION 'launch_command_invalid';END IF;
 PERFORM set_config('lock_timeout','5s',true);
 SELECT * INTO d FROM public.campaign_drafts WHERE id=p_draft AND tenant_id=p_tenant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'launch_draft_not_found';END IF;
 SELECT * INTO old_op FROM public.campaign_launch_operations WHERE tenant_id=p_tenant AND draft_id=p_draft AND actor_id=p_actor AND operation_id=op;
 IF FOUND THEN
  IF old_op.request_hash IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION 'launch_idempotency_conflict';END IF;
  RETURN jsonb_build_object('plan',old_op.result,'receipt',jsonb_build_object('id',old_op.id,'operationId',op,'action',action,'committed',true,'replayed',true));
 END IF;
 SELECT * INTO w FROM public.campaign_launch_plans WHERE tenant_id=p_tenant AND draft_id=p_draft FOR UPDATE;
 IF coalesce(w.version,0)<>expected THEN RAISE EXCEPTION 'launch_revision_conflict';END IF;
 IF d.status<>'draft' THEN RAISE EXCEPTION 'launch_draft_archived';END IF;
 IF d.revision<>expected_draft THEN RAISE EXCEPTION 'launch_draft_changed';END IF;
 snapshot:=jsonb_build_object('id',d.id,'revision',d.revision,'title',d.title,'message',d.message,'channel',d.channel,'purpose',d.purpose,'createdBy',d.created_by,'updatedBy',d.updated_by);
 IF action='configure' THEN
  IF w.state='in_review' THEN RAISE EXCEPTION 'launch_review_locked';END IF;
  IF jsonb_typeof(settings) IS DISTINCT FROM 'object' OR settings->>'currency' IS NULL OR settings->>'currency' NOT IN('ARS','USD','EUR')
   OR (settings->>'unitCostMinor') IS NULL OR (settings->>'unitCostMinor') !~ '^[1-9][0-9]{0,7}$'
   OR (settings->>'budgetMinor') IS NULL OR (settings->>'budgetMinor') !~ '^[0-9]{1,9}$'
   OR (settings->>'maxRecipients') IS NULL OR (settings->>'maxRecipients') !~ '^[1-9][0-9]{0,4}$'
   OR (settings->>'maxRecipients')::int>10000 OR (settings->>'unitCostMinor')::bigint>10000000 OR (settings->>'budgetMinor')::bigint>100000000
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(settings) key WHERE key NOT IN('currency','unitCostMinor','budgetMinor','maxRecipients')) THEN RAISE EXCEPTION 'launch_settings_invalid';END IF;
  INSERT INTO public.campaign_launch_plans(draft_id,tenant_id,version,draft_revision,state,draft_snapshot,settings,prepared_by)
   VALUES(p_draft,p_tenant,1,d.revision,'configured',snapshot,settings,p_actor)
  ON CONFLICT(draft_id) DO UPDATE SET version=campaign_launch_plans.version+1,draft_revision=d.revision,state='configured',draft_snapshot=snapshot,settings=EXCLUDED.settings,prepared_by=p_actor,submitted_by=NULL,approved_by=NULL,approved_at=NULL,latest_simulation=NULL,updated_at=now();
 ELSE
  IF w.draft_id IS NULL THEN RAISE EXCEPTION 'launch_configuration_required';END IF;
  -- Returning a stale review to editing is allowed; approval or simulation of it is not.
  IF action<>'request_changes' AND (w.draft_revision<>d.revision OR w.draft_snapshot IS DISTINCT FROM snapshot) THEN RAISE EXCEPTION 'launch_draft_changed';END IF;
  IF action='submit' THEN
   IF w.state<>'configured' THEN RAISE EXCEPTION 'launch_transition_invalid';END IF;
   UPDATE public.campaign_launch_plans SET state='in_review',submitted_by=p_actor,version=version+1,updated_at=now() WHERE draft_id=p_draft;
  ELSIF action='request_changes' THEN
   IF w.state NOT IN('in_review','approved') OR coalesce(length(p_command->>'note'),0)<10 THEN RAISE EXCEPTION 'launch_transition_invalid';END IF;
   UPDATE public.campaign_launch_plans SET state='configured',approved_by=NULL,approved_at=NULL,latest_simulation=NULL,version=version+1,updated_at=now() WHERE draft_id=p_draft;
  ELSIF action='approve' THEN
   IF w.state<>'in_review' THEN RAISE EXCEPTION 'launch_transition_invalid';END IF;
   IF p_actor IN(w.prepared_by,w.submitted_by,d.created_by,d.updated_by) THEN RAISE EXCEPTION 'launch_independent_review_required';END IF;
   UPDATE public.campaign_launch_plans SET state='approved',approved_by=p_actor,approved_at=now(),version=version+1,updated_at=now() WHERE draft_id=p_draft;
  ELSIF action='simulate' THEN
   IF w.state<>'approved' OR w.approved_by IS NULL THEN RAISE EXCEPTION 'launch_approval_required';END IF;
   audience:=public.nexid_campaign_audience_summary_v1(p_tenant,d.channel);
   unit_cost:=(w.settings->>'unitCostMinor')::bigint;budget:=(w.settings->>'budgetMinor')::bigint;recipient_limit:=(w.settings->>'maxRecipients')::int;
   eligible:=(audience->>'eligibleDestinations')::int;within_count:=least(eligible,recipient_limit);selected_count:=least(within_count,(budget/unit_cost)::int);
   sim:=jsonb_build_object('id',op,'mode','dry_run','draftRevision',d.revision,'planVersion',w.version,'observedAt',statement_timestamp(),'audience',audience,'candidateCount',selected_count,
    'excludedByRecipientLimit',eligible-within_count,'excludedByBudget',within_count-selected_count,'estimatedCostMinor',selected_count*unit_cost,'currency',w.settings->>'currency',
    'budgetMinor',budget,'unitCostMinor',unit_cost,'maxRecipients',recipient_limit,'sentCount',0,'chargedMinor',0,'dispatchEnabled',false,
    'costBasis','operator_reference_not_provider_quote','consentSnapshotNotSendAuthorization',true);
   UPDATE public.campaign_launch_plans SET latest_simulation=sim,version=version+1,updated_at=now() WHERE draft_id=p_draft;
  END IF;
 END IF;
 SELECT to_jsonb(p) INTO result FROM public.campaign_launch_plans p WHERE p.draft_id=p_draft;
 INSERT INTO public.campaign_launch_operations(id,draft_id,tenant_id,actor_id,actor_label,operation_id,action,request_hash,command,result)
 VALUES(receipt,p_draft,p_tenant,p_actor,left(p_label,160),op,action,fingerprint,p_command,result);
 RETURN jsonb_build_object('plan',result,'receipt',jsonb_build_object('id',receipt,'operationId',op,'action',action,'committed',true,'replayed',false));
END;
$launch$;
REVOKE ALL ON FUNCTION public.nexid_campaign_launch_v1(uuid,uuid,uuid,text,jsonb) FROM PUBLIC;
