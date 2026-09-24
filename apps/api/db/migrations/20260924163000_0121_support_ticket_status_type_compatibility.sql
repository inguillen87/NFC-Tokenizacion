-- Forward repair for already-installed 0112 functions. Supports enum or text
-- ticket status without rewriting the column, rows, receipts or audit history.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.nexid_support_ticket_current_v1(p_ticket_id uuid,p_tenant_id uuid,p_tenant_slug text)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
  SELECT jsonb_build_object('ticketId',t.id,'tenantId',t.tenant_id,'tenantSlug',tenant.slug,
    'status',t.status,'updatedAt',t.updated_at,
    'revision',public.nexid_support_ticket_revision_v1(t.id,COALESCE(t.tenant_id,'00000000-0000-0000-0000-000000000000'::uuid),t.status::text,t.updated_at,t.xmin::text),
    'canUpdate',blocked.reason IS NULL,'blockedReason',blocked.reason)
  FROM public.tickets t LEFT JOIN public.tenants tenant ON tenant.id=t.tenant_id
  CROSS JOIN LATERAL (SELECT CASE
    WHEN t.tenant_id IS NULL OR tenant.slug IS NULL THEN 'tenant_unassigned'
    WHEN t.source='event_incident' OR EXISTS (SELECT 1 FROM public.event_incidents i WHERE i.ticket_id=t.id) THEN 'incident_managed'
    WHEN t.status NOT IN ('open','pending','closed') THEN 'legacy_status'
    ELSE NULL END AS reason) blocked
  WHERE t.id=p_ticket_id AND (p_tenant_id IS NULL OR t.tenant_id=p_tenant_id)
    AND (p_tenant_slug IS NULL OR tenant.slug=p_tenant_slug);
$$;

CREATE OR REPLACE FUNCTION public.nexid_read_support_ticket_workflow_v1(p_ticket_id uuid,p_tenant_id uuid,p_tenant_slug text,p_cursor bigint)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
  -- One MVCC snapshot for the current ticket, incident binding and full page.
  WITH current_ticket AS (
    SELECT t.id,t.tenant_id,jsonb_build_object('ticketId',t.id,'tenantId',t.tenant_id,'tenantSlug',tenant.slug,
      'status',t.status,'updatedAt',t.updated_at,
      'revision',public.nexid_support_ticket_revision_v1(t.id,COALESCE(t.tenant_id,'00000000-0000-0000-0000-000000000000'::uuid),t.status::text,t.updated_at,t.xmin::text),
      'canUpdate',blocked.reason IS NULL,'blockedReason',blocked.reason) AS snapshot
    FROM public.tickets t LEFT JOIN public.tenants tenant ON tenant.id=t.tenant_id
    CROSS JOIN LATERAL (SELECT CASE
      WHEN t.tenant_id IS NULL OR tenant.slug IS NULL THEN 'tenant_unassigned'
      WHEN t.source='event_incident' OR EXISTS (SELECT 1 FROM public.event_incidents i WHERE i.ticket_id=t.id) THEN 'incident_managed'
      WHEN t.status NOT IN ('open','pending','closed') THEN 'legacy_status'
      ELSE NULL END AS reason) blocked
    WHERE t.id=p_ticket_id AND (p_tenant_id IS NULL OR t.tenant_id=p_tenant_id)
      AND (p_tenant_slug IS NULL OR tenant.slug=p_tenant_slug)
  ), history_page AS (
    SELECT o.sequence,public.nexid_support_ticket_receipt_v1(o) AS receipt,row_number() OVER (ORDER BY o.sequence DESC) AS position
    FROM public.support_ticket_workflow_operations o JOIN current_ticket t ON t.id=o.ticket_id AND t.tenant_id=o.tenant_id
    WHERE p_cursor IS NULL OR o.sequence<p_cursor ORDER BY o.sequence DESC LIMIT 51
  ), history AS (
    SELECT COALESCE(jsonb_agg(receipt ORDER BY sequence DESC) FILTER (WHERE position<=50),'[]'::jsonb) AS items,
      COALESCE(bool_or(position>50),false) AS has_more FROM history_page
  ) SELECT CASE WHEN p_cursor IS NOT NULL AND p_cursor<=0 THEN jsonb_build_object('ok',false,'reason','ticket_workflow_invalid_request')
    WHEN NOT EXISTS (SELECT 1 FROM current_ticket) THEN jsonb_build_object('ok',false,'reason','ticket_not_found')
    ELSE jsonb_build_object('ok',true,'current',(SELECT snapshot FROM current_ticket),'items',items,
      'page',jsonb_build_object('hasMore',has_more,'nextCursor',CASE WHEN has_more THEN items->49->>'sequence' ELSE NULL END)) END FROM history;
$$;

CREATE OR REPLACE FUNCTION public.nexid_transition_support_ticket_v1(
  p_ticket_id uuid,p_tenant_id uuid,p_tenant_slug text,p_actor_id uuid,p_actor_label text,
  p_expected_revision text,p_to_status text,p_reason text,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET lock_timeout='5s' AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE; v_operation public.support_ticket_workflow_operations%ROWTYPE;
  v_current jsonb; v_fingerprint text; v_audit_id uuid; v_revision text;
BEGIN
  IF p_ticket_id IS NULL OR p_actor_id IS NULL OR p_request_id IS NULL
    OR p_expected_revision IS NULL OR p_expected_revision !~ '^[0-9a-f]{64}$'
    OR p_to_status IS NULL OR p_to_status NOT IN ('open','pending','closed')
    OR p_reason IS NULL OR char_length(p_reason) NOT BETWEEN 1 AND 1000 OR p_reason<>btrim(p_reason)
    OR p_reason ~ '[[:cntrl:]]' OR char_length(p_actor_label)>320 THEN
    RETURN jsonb_build_object('ok',false,'reason','ticket_workflow_invalid_request');
  END IF;
  -- Match the established command lock order: actor, membership, then resource.
  -- HTTP still enforces the revocable session, role allowlist and permission
  -- denies; these locks prevent an actor/scope revocation racing the commit.
  PERFORM 1 FROM public.users u WHERE u.id=p_actor_id AND u.admin_status='active' FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','forbidden'); END IF;
  PERFORM 1 FROM public.memberships m WHERE m.user_id=p_actor_id
    AND ((p_tenant_id IS NOT NULL AND m.tenant_id=p_tenant_id)
      OR (m.tenant_id IS NULL AND m.role::text='super_admin'))
    ORDER BY m.tenant_id NULLS FIRST LIMIT 1 FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','forbidden'); END IF;
  SELECT t.* INTO v_ticket FROM public.tickets t LEFT JOIN public.tenants tenant ON tenant.id=t.tenant_id
    WHERE t.id=p_ticket_id AND (p_tenant_id IS NULL OR t.tenant_id=p_tenant_id)
      AND (p_tenant_slug IS NULL OR tenant.slug=p_tenant_slug) FOR UPDATE OF t;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','ticket_not_found'); END IF;
  v_fingerprint:=encode(sha256(convert_to(jsonb_build_array('nexid.support-ticket-workflow.v1',
    v_ticket.tenant_id,p_ticket_id,p_actor_id,p_expected_revision,p_to_status,p_reason,p_request_id)::text,'UTF8')),'hex');
  -- Separate statement after the lock: a concurrent winner's committed receipt
  -- is visible even when this call began before that winner committed.
  SELECT * INTO v_operation FROM public.support_ticket_workflow_operations
    WHERE ticket_id=p_ticket_id AND request_id=p_request_id;
  IF FOUND THEN
    IF v_operation.fingerprint<>v_fingerprint THEN
      RETURN jsonb_build_object('ok',false,'reason','ticket_workflow_conflict');
    END IF;
    RETURN jsonb_build_object('ok',true,'outcome','replayed',
      'current',public.nexid_support_ticket_current_v1(p_ticket_id,p_tenant_id,p_tenant_slug),
      'receipt',public.nexid_support_ticket_receipt_v1(v_operation));
  END IF;
  v_current:=public.nexid_support_ticket_current_v1(p_ticket_id,p_tenant_id,p_tenant_slug);
  IF NOT (v_current->>'canUpdate')::boolean THEN
    RETURN jsonb_build_object('ok',false,'reason','ticket_workflow_blocked');
  END IF;
  IF v_current->>'revision'<>p_expected_revision THEN
    RETURN jsonb_build_object('ok',false,'reason','ticket_workflow_conflict');
  END IF;
  IF v_ticket.status::text=p_to_status THEN
    RETURN jsonb_build_object('ok',false,'reason','ticket_workflow_no_change');
  END IF;
  UPDATE public.tickets SET status=(jsonb_populate_record(NULL::public.tickets,jsonb_build_object('status',p_to_status))).status,
    updated_at=GREATEST(clock_timestamp(),v_ticket.updated_at+interval '1 microsecond') WHERE id=p_ticket_id;
  v_current:=public.nexid_support_ticket_current_v1(p_ticket_id,p_tenant_id,p_tenant_slug);
  v_revision:=v_current->>'revision';
  v_audit_id:=gen_random_uuid();
  INSERT INTO public.audit_logs(id,actor_id,tenant_id,action,resource_type,resource_id,before_hash,after_hash,request_id)
    VALUES(v_audit_id,p_actor_id,v_ticket.tenant_id,'support_ticket_status_changed','ticket',p_ticket_id::text,
      p_expected_revision,v_revision,p_request_id::text);
  INSERT INTO public.support_ticket_workflow_operations(ticket_id,tenant_id,request_id,actor_id,actor_label,
    from_status,to_status,reason,expected_revision,revision,fingerprint,audit_id)
    VALUES(p_ticket_id,v_ticket.tenant_id,p_request_id,p_actor_id,p_actor_label,v_ticket.status,p_to_status,p_reason,
      p_expected_revision,v_revision,v_fingerprint,v_audit_id) RETURNING * INTO v_operation;
  RETURN jsonb_build_object('ok',true,'outcome','updated','current',v_current,
    'receipt',public.nexid_support_ticket_receipt_v1(v_operation));
END;
$$;

REVOKE ALL ON FUNCTION public.nexid_support_ticket_current_v1(uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_read_support_ticket_workflow_v1(uuid,uuid,text,bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_transition_support_ticket_v1(uuid,uuid,text,uuid,text,text,text,text,uuid) FROM PUBLIC;
