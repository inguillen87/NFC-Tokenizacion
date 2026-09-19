-- Additive, opt-in notice revision. Never changes stock, tags, SDM, or the original recall document.
CREATE TABLE public.product_recall_notice_reviews (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,batch_id uuid NOT NULL,case_id uuid NOT NULL,
 review jsonb NOT NULL CHECK(jsonb_typeof(review)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(case_id,tenant_id,batch_id) REFERENCES public.product_recall_cases(id,tenant_id,batch_id),
 UNIQUE(id,tenant_id,batch_id,case_id)
);
CREATE UNIQUE INDEX product_recall_notice_one_pending ON public.product_recall_notice_reviews(case_id)
 WHERE review->>'state' IN ('draft','in_review','changes_requested');
CREATE INDEX product_recall_notice_review_scope ON public.product_recall_notice_reviews(tenant_id,batch_id,case_id,created_at DESC);
CREATE TABLE public.product_recall_notice_heads (
 case_id uuid PRIMARY KEY,tenant_id uuid NOT NULL,batch_id uuid NOT NULL,
 notice_version integer NOT NULL CHECK(notice_version>1),state text NOT NULL CHECK(state IN('active','lifted')),
 notice jsonb NOT NULL CHECK(jsonb_typeof(notice)='object'),resolution_message text,
 effective_at timestamptz NOT NULL,approved_by uuid NOT NULL REFERENCES public.users(id),proposal_id uuid NOT NULL,
 FOREIGN KEY(case_id,tenant_id,batch_id) REFERENCES public.product_recall_cases(id,tenant_id,batch_id),
 FOREIGN KEY(proposal_id,tenant_id,batch_id,case_id) REFERENCES public.product_recall_notice_reviews(id,tenant_id,batch_id,case_id),
 CHECK((state='lifted' AND length(resolution_message)>=10) OR (state='active' AND resolution_message IS NULL))
);
CREATE TABLE public.product_recall_notice_operations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,batch_id uuid NOT NULL,case_id uuid NOT NULL,proposal_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES public.users(id),actor_label text NOT NULL,operation_id uuid NOT NULL,
 action text NOT NULL,request_hash text NOT NULL,command jsonb NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(proposal_id,tenant_id,batch_id,case_id) REFERENCES public.product_recall_notice_reviews(id,tenant_id,batch_id,case_id),
 UNIQUE(tenant_id,batch_id,actor_id,operation_id)
);
CREATE INDEX product_recall_notice_operation_scope ON public.product_recall_notice_operations(tenant_id,case_id,created_at,id);
REVOKE ALL ON public.product_recall_notice_heads,public.product_recall_notice_reviews,public.product_recall_notice_operations FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.nexid_recall_notice_commit_v1(
 p_tenant uuid,p_batch uuid,p_actor uuid,p_label text,p_command jsonb,p_plan jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $notice$
DECLARE
 c public.product_recall_cases%ROWTYPE;h public.product_recall_notice_heads%ROWTYPE;r public.product_recall_notice_reviews%ROWTYPE;old_op public.product_recall_notice_operations%ROWTYPE;
 action text:=p_command->>'action';op uuid:=(p_command->>'operationId')::uuid;proposal uuid:=(p_command->>'proposalId')::uuid;v_case_id uuid:=(p_command->>'caseId')::uuid;
 next_review jsonb:=p_plan->'review';effect jsonb:=p_plan->'effect';current_notice jsonb;current_version integer;expected integer:=(p_command->>'expectedReviewVersion')::integer;
 digest text:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');snapshot jsonb;result jsonb;receipt uuid:=gen_random_uuid();at timestamptz:=(p_plan#>>'{audit,at}')::timestamptz;
BEGIN
 IF p_tenant IS NULL OR p_batch IS NULL OR p_actor IS NULL OR v_case_id IS NULL OR proposal IS NULL OR op IS NULL OR expected IS NULL OR expected<0
 OR jsonb_typeof(p_command) IS DISTINCT FROM 'object' OR octet_length(p_command::text)>16384
 OR jsonb_typeof(p_plan) IS DISTINCT FROM 'object' OR octet_length(p_plan::text)>65536 OR at IS NULL
 OR action IS NULL OR action NOT IN('create_correction','create_lift','save_correction','save_lift','submit','return_for_changes','approve','cancel')
 OR p_plan->>'protocol' IS DISTINCT FROM 'nexid.recall-notice-review.v1'
 OR p_plan#>>'{audit,actorId}' IS DISTINCT FROM p_actor::text OR p_plan#>>'{audit,action}' IS DISTINCT FROM action
 OR p_plan#>>'{audit,operationId}' IS DISTINCT FROM op::text THEN RAISE EXCEPTION 'notice_review_request_invalid';END IF;
 PERFORM set_config('lock_timeout','5s',true);
 -- Same lock as the original recall workflow: progress/closure cannot race an approval.
 PERFORM pg_advisory_xact_lock(hashtextextended('nexid:recall:'||p_tenant::text||':'||p_batch::text,0));
 SELECT * INTO old_op FROM public.product_recall_notice_operations o WHERE o.tenant_id=p_tenant AND o.batch_id=p_batch AND o.actor_id=p_actor AND o.operation_id=op;
 IF FOUND THEN
  IF old_op.request_hash IS DISTINCT FROM digest THEN RAISE EXCEPTION 'notice_review_idempotency_conflict';END IF;
  RETURN old_op.result||jsonb_build_object('receipt',old_op.result->'receipt'||jsonb_build_object('replayed',true));
 END IF;
 SELECT * INTO c FROM public.product_recall_cases x WHERE x.id=v_case_id AND x.tenant_id=p_tenant AND x.batch_id=p_batch FOR UPDATE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'notice_review_case_not_found';END IF;
 IF c.published_at IS NULL OR c.state NOT IN('active','closing','closed') THEN RAISE EXCEPTION 'notice_review_requires_published_case';END IF;
 SELECT * INTO h FROM public.product_recall_notice_heads x WHERE x.case_id=c.id AND x.tenant_id=p_tenant FOR UPDATE;
 current_version:=coalesce(h.notice_version,1);
 current_notice:=coalesce(h.notice,jsonb_build_object('title',c.document->'title','publicMessage',c.document->'publicMessage','instructions',c.document->'instructions','contact',c.document->'contact'));
 SELECT * INTO r FROM public.product_recall_notice_reviews x WHERE x.id=proposal AND x.tenant_id=p_tenant AND x.batch_id=p_batch AND x.case_id=c.id FOR UPDATE;
 IF action LIKE 'create_%' THEN
  IF r.id IS NOT NULL OR expected<>0 THEN RAISE EXCEPTION 'notice_review_revision_conflict';END IF;
  IF EXISTS(SELECT 1 FROM public.product_recall_notice_reviews x WHERE x.case_id=c.id AND x.review->>'state' IN('draft','in_review','changes_requested')) THEN RAISE EXCEPTION 'notice_review_pending_exists';END IF;
 ELSE
  IF r.id IS NULL THEN RAISE EXCEPTION 'notice_review_proposal_not_found';END IF;
  IF (r.review->>'version')::integer<>expected OR p_plan->'previousReview' IS DISTINCT FROM r.review THEN RAISE EXCEPTION 'notice_review_revision_conflict';END IF;
  IF r.review->>'state' IN('applied','cancelled') THEN RAISE EXCEPTION 'notice_review_terminal_state';END IF;
 END IF;
 IF next_review->>'id' IS DISTINCT FROM proposal::text OR next_review->>'caseId' IS DISTINCT FROM c.id::text
 OR next_review->>'tenantId' IS DISTINCT FROM p_tenant::text OR next_review->>'batchId' IS DISTINCT FROM p_batch::text
 OR (next_review->>'version')::integer IS DISTINCT FROM expected+1 THEN RAISE EXCEPTION 'notice_review_scope_mismatch';END IF;
 IF action<>'cancel' THEN
  IF (p_command->>'expectedCaseVersion')::integer IS DISTINCT FROM c.version OR (p_command->>'expectedNoticeVersion')::integer IS DISTINCT FROM current_version
  OR (next_review->>'baseCaseVersion')::integer IS DISTINCT FROM c.version OR (next_review->>'baseNoticeVersion')::integer IS DISTINCT FROM current_version
  OR next_review->'baseNotice' IS DISTINCT FROM current_notice THEN RAISE EXCEPTION 'notice_review_source_changed';END IF;
  IF h.state='lifted' THEN RAISE EXCEPTION 'notice_review_already_lifted';END IF;
 END IF;
 IF action LIKE 'create_%' OR action LIKE 'save_%' THEN
  IF action LIKE 'save_%' AND r.review->>'state' NOT IN('draft','changes_requested') THEN RAISE EXCEPTION 'notice_review_transition_invalid';END IF;
  IF next_review->>'state'<>'draft' OR NOT (next_review->'contributorIds' ? p_actor::text)
  OR coalesce(length(next_review->>'reason'),0)<10 OR coalesce(length(next_review->>'evidenceReference'),0)<5 THEN RAISE EXCEPTION 'notice_review_invalid_proposal';END IF;
  IF next_review->>'kind'='lift' THEN
   IF c.state<>'closed' OR coalesce(length(next_review->>'resolutionMessage'),0)<10 THEN RAISE EXCEPTION 'notice_review_close_tracking_first';END IF;
  ELSIF next_review->>'kind'='correction' THEN
   IF jsonb_typeof(next_review->'requestedNotice') IS DISTINCT FROM 'object' OR next_review->'requestedNotice' IS NOT DISTINCT FROM current_notice THEN RAISE EXCEPTION 'notice_review_no_public_change';END IF;
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(next_review->'requestedNotice') k WHERE k<>ALL(ARRAY['title','publicMessage','instructions','contact'])) THEN RAISE EXCEPTION 'notice_review_field_not_allowed';END IF;
  ELSE RAISE EXCEPTION 'notice_review_kind_invalid';END IF;
 ELSIF action='submit' THEN
  IF r.review->>'state' NOT IN('draft','changes_requested') OR next_review->>'state'<>'in_review' OR NOT(next_review->'contributorIds' ? p_actor::text) THEN RAISE EXCEPTION 'notice_review_transition_invalid';END IF;
 ELSIF action IN('return_for_changes','approve') THEN
  IF r.review->>'state'<>'in_review' OR (r.review->'contributorIds' ? p_actor::text) THEN RAISE EXCEPTION 'notice_review_independent_approval_required';END IF;
  IF next_review->'requestedNotice' IS DISTINCT FROM r.review->'requestedNotice' OR next_review->'resolutionMessage' IS DISTINCT FROM r.review->'resolutionMessage'
  OR next_review->'reason' IS DISTINCT FROM r.review->'reason' OR next_review->'evidenceReference' IS DISTINCT FROM r.review->'evidenceReference'
  OR next_review->'contributorIds' IS DISTINCT FROM r.review->'contributorIds' THEN RAISE EXCEPTION 'notice_review_reviewed_content_changed';END IF;
  IF action='return_for_changes' AND next_review->>'state'<>'changes_requested' THEN RAISE EXCEPTION 'notice_review_transition_invalid';END IF;
  IF action='approve' AND (next_review->>'state'<>'applied' OR next_review->>'approvedBy' IS DISTINCT FROM p_actor::text) THEN RAISE EXCEPTION 'notice_review_approval_required';END IF;
 ELSIF action='cancel' AND next_review->>'state'<>'cancelled' THEN RAISE EXCEPTION 'notice_review_transition_invalid';END IF;
 IF r.id IS NOT NULL AND NOT((next_review->'contributorIds') @> (r.review->'contributorIds')) THEN RAISE EXCEPTION 'notice_review_contributors_lost';END IF;
 INSERT INTO public.product_recall_notice_reviews(id,tenant_id,batch_id,case_id,review) VALUES(proposal,p_tenant,p_batch,c.id,next_review)
 ON CONFLICT(id) DO UPDATE SET review=EXCLUDED.review,updated_at=now();
 IF action='approve' THEN
  IF jsonb_typeof(effect) IS DISTINCT FROM 'object' OR (effect->>'nextNoticeVersion')::integer IS DISTINCT FROM current_version+1
  OR effect->>'approvedBy' IS DISTINCT FROM p_actor::text OR effect#>>'{scope,caseId}' IS DISTINCT FROM c.id::text
  OR effect->>'doesNotDetermineNfcAuthenticity' IS DISTINCT FROM 'true' OR effect->>'doesNotReleaseProduct' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'notice_review_effect_invalid';END IF;
  IF next_review->>'kind'='lift' THEN
   IF c.state<>'closed' OR effect->>'noticeState'<>'lifted' OR effect->'notice' IS DISTINCT FROM current_notice OR effect->'resolutionMessage' IS DISTINCT FROM next_review->'resolutionMessage' THEN RAISE EXCEPTION 'notice_review_effect_invalid';END IF;
  ELSE
   IF effect->>'noticeState'<>'active' OR effect->'notice' IS DISTINCT FROM next_review->'requestedNotice' OR effect->>'resolutionMessage' IS NOT NULL THEN RAISE EXCEPTION 'notice_review_effect_invalid';END IF;
  END IF;
  INSERT INTO public.product_recall_notice_heads(case_id,tenant_id,batch_id,notice_version,state,notice,resolution_message,effective_at,approved_by,proposal_id)
  VALUES(c.id,p_tenant,p_batch,current_version+1,effect->>'noticeState',effect->'notice',effect->>'resolutionMessage',at,p_actor,proposal)
  ON CONFLICT(case_id) DO UPDATE SET notice_version=EXCLUDED.notice_version,state=EXCLUDED.state,notice=EXCLUDED.notice,resolution_message=EXCLUDED.resolution_message,effective_at=EXCLUDED.effective_at,approved_by=EXCLUDED.approved_by,proposal_id=EXCLUDED.proposal_id;
  UPDATE public.product_recall_cases SET version=version+1,updated_at=now() WHERE id=c.id;
  SELECT * INTO c FROM public.product_recall_cases x WHERE x.id=c.id;
  -- Main history records the change too; original document, progress and physical status are not rewritten.
  INSERT INTO public.product_recall_operations(tenant_id,batch_id,case_id,actor_id,actor_label,operation_id,action,request_hash,command,result)
  VALUES(p_tenant,p_batch,c.id,p_actor,left(p_label,180),op,CASE WHEN next_review->>'kind'='lift' THEN 'notice_lifted' ELSE 'notice_corrected' END,digest,p_command||jsonb_build_object('reason',next_review->>'reason','evidenceReference',next_review->>'evidenceReference'),to_jsonb(c));
 ELSIF effect IS NOT NULL AND effect<>'null'::jsonb THEN RAISE EXCEPTION 'notice_review_unexpected_effect';END IF;
 result:=jsonb_build_object('review',next_review,'caseVersion',c.version,'effect',effect,'receipt',jsonb_build_object('id',receipt,'operationId',op,'proposalId',proposal,'action',action,'committed',true,'replayed',false,'reviewVersion',expected+1));
 INSERT INTO public.product_recall_notice_operations(id,tenant_id,batch_id,case_id,proposal_id,actor_id,actor_label,operation_id,action,request_hash,command,result)
 VALUES(receipt,p_tenant,p_batch,c.id,proposal,p_actor,left(p_label,180),op,action,digest,p_command,result);
 RETURN result;
END;
$notice$;
REVOKE ALL ON FUNCTION public.nexid_recall_notice_commit_v1(uuid,uuid,uuid,text,jsonb,jsonb) FROM PUBLIC;
