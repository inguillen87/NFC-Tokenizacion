-- Additive adapter: reuse the existing recall engine and its durable receipts.
-- No users, memberships, notices, task rows, tag states or product data are created here.
CREATE INDEX product_recall_cases_assignees ON public.product_recall_cases USING gin ((document->'destinations') jsonb_path_ops) WHERE published_at IS NOT NULL;
CREATE OR REPLACE FUNCTION public.nexid_recall_assignee_command_v1(
 p_tenant uuid,p_batch uuid,p_actor uuid,p_label text,p_case uuid,p_destination uuid,p_command jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $assigned$
DECLARE c public.product_recall_cases%ROWTYPE;dest jsonb;member_id uuid;actor_id uuid;canonical jsonb;answer jsonb;operation uuid:=(p_command->>'operationId')::uuid;notice_version integer;
BEGIN
 IF p_tenant IS NULL OR p_batch IS NULL OR p_actor IS NULL OR p_case IS NULL OR p_destination IS NULL OR operation IS NULL
 OR jsonb_typeof(p_command) IS DISTINCT FROM 'object' OR octet_length(p_command::text)>8192
 OR p_command->>'action' IS NULL OR p_command->>'action' NOT IN('acknowledge','account')
 OR p_command->>'caseId' IS DISTINCT FROM p_case::text OR p_command->>'destinationId' IS DISTINCT FROM p_destination::text
 OR (p_command->>'expectedNoticeVersion') IS NULL OR (p_command->>'expectedNoticeVersion') !~ '^[1-9][0-9]{0,6}$'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_command) x WHERE x<>ALL(ARRAY['action','operationId','caseId','destinationId','expectedVersion','expectedNoticeVersion','reason','evidenceReference','returnedUnits','heldUnits'])) THEN RAISE EXCEPTION 'recall_task_request_invalid';END IF;
 PERFORM set_config('lock_timeout','5s',true);
 PERFORM pg_advisory_xact_lock(hashtextextended('nexid:recall:'||p_tenant::text||':'||p_batch::text,0));
 -- Retain the current membership during this operation, not an authorization inferred from a task URL.
 SELECT u.id INTO actor_id FROM public.users u WHERE u.id=p_actor AND u.admin_status='active' FOR SHARE;
 IF actor_id IS NULL THEN RAISE EXCEPTION 'recall_task_assignee_forbidden';END IF;
 SELECT m.user_id INTO member_id FROM public.memberships m WHERE m.user_id=p_actor
 AND (m.tenant_id=p_tenant OR (m.tenant_id IS NULL AND m.role::text='super_admin')) LIMIT 1 FOR SHARE;
 IF member_id IS NULL THEN RAISE EXCEPTION 'recall_task_assignee_forbidden';END IF;
 SELECT * INTO c FROM public.product_recall_cases x WHERE x.id=p_case AND x.tenant_id=p_tenant AND x.batch_id=p_batch FOR UPDATE;
 IF c.id IS NULL OR c.published_at IS NULL THEN RAISE EXCEPTION 'recall_task_not_found';END IF;
 SELECT value INTO dest FROM jsonb_array_elements(c.document->'destinations') WHERE value->>'id'=p_destination::text AND value->>'assigneeId'=p_actor::text;
 IF dest IS NULL THEN RAISE EXCEPTION 'recall_task_not_found';END IF;
 canonical:=p_command||jsonb_build_object('submissionSource','assigned_task');
 -- A replay is authorized by the current assignment, then delegated to the same engine;
 -- it remains recoverable after other destinations progress or the case closes.
 IF NOT EXISTS(SELECT 1 FROM public.product_recall_operations o WHERE o.tenant_id=p_tenant AND o.batch_id=p_batch AND o.actor_id=p_actor AND o.operation_id=operation) THEN
  SELECT coalesce((SELECT h.notice_version FROM public.product_recall_notice_heads h WHERE h.case_id=p_case AND h.tenant_id=p_tenant),1) INTO notice_version;
  IF notice_version IS DISTINCT FROM (p_command->>'expectedNoticeVersion')::integer THEN RAISE EXCEPTION 'recall_task_notice_changed';END IF;
 END IF;
 answer:=public.nexid_recall_command_v1(p_tenant,p_batch,p_actor,p_label,p_case,canonical);
 -- Never return the other destinations, internal recall reason or the full case snapshot.
 RETURN jsonb_build_object('caseId',p_case,'destinationId',p_destination,'caseVersion',answer#>'{case,version}',
 'receipt',answer->'receipt','evidenceBasis','assigned_account_declaration');
END;
$assigned$;
REVOKE ALL ON FUNCTION public.nexid_recall_assignee_command_v1(uuid,uuid,uuid,text,uuid,uuid,jsonb) FROM PUBLIC;
