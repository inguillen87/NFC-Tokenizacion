-- Additive recall workflow. Does not change tags, batch status, SDM or crypto configuration.
CREATE TABLE public.product_recall_cases(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES public.tenants(id),batch_id uuid NOT NULL REFERENCES public.batches(id),
 state text NOT NULL CHECK(state IN('draft','in_review','active','closing','closed','cancelled')),
 version integer NOT NULL CHECK(version>0),document jsonb NOT NULL CHECK(jsonb_typeof(document)='object'),
 progress jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(progress)='object'),
 created_by uuid NOT NULL REFERENCES public.users(id),last_editor_id uuid NOT NULL REFERENCES public.users(id),submitted_by uuid REFERENCES public.users(id),published_by uuid REFERENCES public.users(id),close_requested_by uuid REFERENCES public.users(id),closed_by uuid REFERENCES public.users(id),
 close_reason text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),published_at timestamptz,closed_at timestamptz,
 UNIQUE(id,tenant_id,batch_id)
);
CREATE INDEX product_recall_cases_batch ON public.product_recall_cases(tenant_id,batch_id,created_at DESC);
CREATE INDEX product_recall_cases_public ON public.product_recall_cases(tenant_id,batch_id,published_at DESC) WHERE published_at IS NOT NULL;
CREATE UNIQUE INDEX product_recall_cases_one_open ON public.product_recall_cases(tenant_id,batch_id) WHERE state IN('draft','in_review','active','closing');
CREATE TABLE public.product_recall_operations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,batch_id uuid NOT NULL,case_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES public.users(id),actor_label text NOT NULL,operation_id uuid NOT NULL,
 action text NOT NULL,request_hash text NOT NULL,command jsonb NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(case_id,tenant_id,batch_id) REFERENCES public.product_recall_cases(id,tenant_id,batch_id),
 UNIQUE(tenant_id,batch_id,actor_id,operation_id)
);
CREATE INDEX product_recall_operations_history ON public.product_recall_operations(case_id,created_at,id);
REVOKE ALL ON public.product_recall_cases,public.product_recall_operations FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.nexid_recall_command_v1(p_tenant uuid,p_batch uuid,p_actor uuid,p_label text,p_case uuid,p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $recall$
DECLARE c public.product_recall_cases%ROWTYPE;old_op public.product_recall_operations%ROWTYPE;
 action text:=p_command->>'action';op uuid:=(p_command->>'operationId')::uuid;expected integer:=(p_command->>'expectedVersion')::integer;
 digest text:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');doc jsonb:=p_command->'document';d jsonb;task jsonb;record jsonb;progress_next jsonb;
 dest text:=p_command->>'destinationId';new_returned integer;new_held integer;allowed_quantity integer;snapshot jsonb;receipt uuid:=gen_random_uuid();
BEGIN
 IF p_tenant IS NULL OR p_batch IS NULL OR p_actor IS NULL OR p_case IS NULL OR op IS NULL OR expected IS NULL OR expected<0
 OR p_command->>'caseId' IS DISTINCT FROM p_case::text OR jsonb_typeof(p_command) IS DISTINCT FROM 'object' OR octet_length(p_command::text)>65536
 OR action IS NULL OR action NOT IN('create','save','submit','revise','publish','acknowledge','account','request_close','resume','close','cancel') THEN RAISE EXCEPTION 'recall_request_invalid';END IF;
 PERFORM set_config('lock_timeout','5s',true);
 PERFORM pg_advisory_xact_lock(hashtextextended('nexid:recall:'||p_tenant::text||':'||p_batch::text,0));
 IF NOT EXISTS(SELECT 1 FROM public.batches WHERE id=p_batch AND tenant_id=p_tenant) THEN RAISE EXCEPTION 'recall_batch_not_found';END IF;
 SELECT * INTO old_op FROM public.product_recall_operations WHERE tenant_id=p_tenant AND batch_id=p_batch AND actor_id=p_actor AND operation_id=op;
 IF FOUND THEN
  IF old_op.request_hash IS DISTINCT FROM digest THEN RAISE EXCEPTION 'recall_idempotency_conflict';END IF;
  RETURN jsonb_build_object('case',old_op.result,'receipt',jsonb_build_object('id',old_op.id,'operationId',op,'action',action,'committed',true,'replayed',true));
 END IF;
 SELECT * INTO c FROM public.product_recall_cases WHERE id=p_case AND tenant_id=p_tenant AND batch_id=p_batch FOR UPDATE;
 IF action='create' THEN
  IF c.id IS NOT NULL OR expected<>0 THEN RAISE EXCEPTION 'recall_revision_conflict';END IF;
  IF EXISTS(SELECT 1 FROM public.product_recall_cases WHERE tenant_id=p_tenant AND batch_id=p_batch AND state IN('draft','in_review','active','closing')) THEN RAISE EXCEPTION 'recall_open_case_exists';END IF;
 ELSE
  IF c.id IS NULL THEN RAISE EXCEPTION 'recall_case_not_found';END IF;
  IF c.version<>expected THEN RAISE EXCEPTION 'recall_revision_conflict';END IF;
 END IF;
 IF action IN('create','save') THEN
  IF action='save' AND c.state<>'draft' THEN RAISE EXCEPTION 'recall_transition_invalid';END IF;
  IF jsonb_typeof(doc) IS DISTINCT FROM 'object' OR doc->>'kind' NOT IN('recall','quarantine') OR doc->>'kind' IS NULL
  OR jsonb_typeof(doc->'destinations') IS DISTINCT FROM 'array' OR jsonb_array_length(doc->'destinations') NOT BETWEEN 1 AND 50
  OR coalesce(length(doc->>'title'),0) NOT BETWEEN 5 AND 160 OR coalesce(length(doc->>'publicMessage'),0) NOT BETWEEN 10 AND 600 OR coalesce(length(doc->>'instructions'),0) NOT BETWEEN 10 AND 1000
  THEN RAISE EXCEPTION 'recall_document_invalid';END IF;
  IF (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(doc->'destinations') x)<>jsonb_array_length(doc->'destinations') THEN RAISE EXCEPTION 'recall_destination_duplicate';END IF;
  FOR d IN SELECT value FROM jsonb_array_elements(doc->'destinations') LOOP
   IF (d->>'units') IS NULL OR (d->>'units') !~ '^[1-9][0-9]{0,7}$' OR (d->>'units')::bigint>10000000 THEN RAISE EXCEPTION 'recall_units_invalid';END IF;
   IF (d->>'id') IS NULL OR (d->>'assigneeId') IS NULL THEN RAISE EXCEPTION 'recall_assignee_forbidden';END IF;
   IF (d->>'assigneeId')::uuid IS DISTINCT FROM p_actor AND NOT EXISTS(SELECT 1 FROM public.memberships m JOIN public.users u ON u.id=m.user_id WHERE m.tenant_id=p_tenant AND m.user_id=(d->>'assigneeId')::uuid AND u.admin_status='active') THEN RAISE EXCEPTION 'recall_assignee_forbidden';END IF;
  END LOOP;
  IF action='create' THEN INSERT INTO public.product_recall_cases(id,tenant_id,batch_id,state,version,document,created_by,last_editor_id) VALUES(p_case,p_tenant,p_batch,'draft',1,doc,p_actor,p_actor);
  ELSE UPDATE public.product_recall_cases SET document=doc,last_editor_id=p_actor,version=version+1,updated_at=now() WHERE id=p_case;END IF;
 ELSIF action='submit' THEN
  IF c.state<>'draft' THEN RAISE EXCEPTION 'recall_transition_invalid';END IF;
  UPDATE public.product_recall_cases SET state='in_review',submitted_by=p_actor,version=version+1,updated_at=now() WHERE id=p_case;
 ELSIF action='revise' THEN
  IF c.state<>'in_review' OR coalesce(length(p_command->>'reason'),0)<10 THEN RAISE EXCEPTION 'recall_transition_invalid';END IF;
  UPDATE public.product_recall_cases SET state='draft',version=version+1,updated_at=now() WHERE id=p_case;
 ELSIF action='publish' THEN
  IF c.state<>'in_review' THEN RAISE EXCEPTION 'recall_transition_invalid';END IF;
  IF p_actor IN(c.created_by,c.last_editor_id,c.submitted_by) THEN RAISE EXCEPTION 'recall_independent_review_required';END IF;
  UPDATE public.product_recall_cases SET state='active',published_at=now(),published_by=p_actor,version=version+1,updated_at=now() WHERE id=p_case;
 ELSIF action IN('acknowledge','account') THEN
  IF c.state<>'active' OR coalesce(length(p_command->>'reason'),0)<10 OR coalesce(length(p_command->>'evidenceReference'),0)<5 THEN RAISE EXCEPTION 'recall_transition_invalid';END IF;
  SELECT value INTO task FROM jsonb_array_elements(c.document->'destinations') WHERE value->>'id'=dest;
  IF task IS NULL THEN RAISE EXCEPTION 'recall_destination_not_found';END IF;
  record:=coalesce(c.progress->dest,'{}'::jsonb);allowed_quantity:=(task->>'units')::integer;
  IF action='acknowledge' THEN
   IF record->>'acknowledgedAt' IS NOT NULL THEN RAISE EXCEPTION 'recall_acknowledgement_exists';END IF;
   record:=record||jsonb_build_object('acknowledgedAt',now(),'acknowledgedBy',p_actor,'ackEvidence',p_command->>'evidenceReference');
  ELSE
   new_returned:=(p_command->>'returnedUnits')::integer;new_held:=(p_command->>'heldUnits')::integer;
   IF record->>'acknowledgedAt' IS NULL THEN RAISE EXCEPTION 'recall_acknowledgement_required';END IF;
   IF new_returned IS NULL OR new_held IS NULL OR new_returned<0 OR new_held<0 OR new_returned::bigint+new_held>allowed_quantity THEN RAISE EXCEPTION 'recall_units_invalid';END IF;
   record:=record||jsonb_build_object('returnedUnits',new_returned,'heldUnits',new_held,'accountedAt',now(),'accountedBy',p_actor,'accountEvidence',p_command->>'evidenceReference');
  END IF;
  progress_next:=jsonb_set(c.progress,ARRAY[dest],record,true);
  UPDATE public.product_recall_cases SET progress=progress_next,version=version+1,updated_at=now() WHERE id=p_case;
 ELSIF action='request_close' THEN
  IF c.state<>'active' OR coalesce(length(p_command->>'reason'),0)<10 THEN RAISE EXCEPTION 'recall_transition_invalid';END IF;
  FOR d IN SELECT value FROM jsonb_array_elements(c.document->'destinations') LOOP
   record:=c.progress->(d->>'id');
   IF record IS NULL OR record->>'acknowledgedAt' IS NULL OR coalesce((record->>'returnedUnits')::integer,0)+coalesce((record->>'heldUnits')::integer,0)<>(d->>'units')::integer THEN RAISE EXCEPTION 'recall_pending_actions';END IF;
  END LOOP;
  UPDATE public.product_recall_cases SET state='closing',close_requested_by=p_actor,close_reason=p_command->>'reason',version=version+1,updated_at=now() WHERE id=p_case;
 ELSIF action='close' THEN
  IF c.state<>'closing' OR coalesce(length(p_command->>'reason'),0)<10 THEN RAISE EXCEPTION 'recall_transition_invalid';END IF;
  IF c.close_requested_by=p_actor THEN RAISE EXCEPTION 'recall_independent_review_required';END IF;
  UPDATE public.product_recall_cases SET state='closed',closed_at=now(),closed_by=p_actor,version=version+1,updated_at=now() WHERE id=p_case;
 ELSIF action='resume' THEN
  IF c.state<>'closing' OR coalesce(length(p_command->>'reason'),0)<10 THEN RAISE EXCEPTION 'recall_transition_invalid';END IF;
  UPDATE public.product_recall_cases SET state='active',version=version+1,updated_at=now() WHERE id=p_case;
 ELSIF action='cancel' THEN
  IF c.state NOT IN('draft','in_review') OR coalesce(length(p_command->>'reason'),0)<10 THEN RAISE EXCEPTION 'recall_transition_invalid';END IF;
  UPDATE public.product_recall_cases SET state='cancelled',version=version+1,updated_at=now() WHERE id=p_case;
 END IF;
 SELECT to_jsonb(updated) INTO snapshot FROM public.product_recall_cases updated WHERE updated.id=p_case;
 INSERT INTO public.product_recall_operations(id,tenant_id,batch_id,case_id,actor_id,actor_label,operation_id,action,request_hash,command,result)
 VALUES(receipt,p_tenant,p_batch,p_case,p_actor,left(p_label,180),op,action,digest,p_command,snapshot);
 RETURN jsonb_build_object('case',snapshot,'receipt',jsonb_build_object('id',receipt,'operationId',op,'action',action,'committed',true,'replayed',false));
END;
$recall$;
REVOKE ALL ON FUNCTION public.nexid_recall_command_v1(uuid,uuid,uuid,text,uuid,jsonb) FROM PUBLIC;
