-- Additive ticket workflow. No existing ticket or audit row is changed here.
-- Runtime uses one VOLATILE invoker call: status, audit and receipt commit together.
CREATE TABLE public.support_ticket_workflow_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE NOT NULL,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  actor_label text CHECK (actor_label IS NULL OR char_length(actor_label) <= 320),
  from_status text NOT NULL CHECK (from_status IN ('open','pending','closed')),
  to_status text NOT NULL CHECK (to_status IN ('open','pending','closed') AND to_status <> from_status),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000 AND reason = btrim(reason)),
  expected_revision text NOT NULL CHECK (expected_revision ~ '^[0-9a-f]{64}$'),
  revision text NOT NULL CHECK (revision ~ '^[0-9a-f]{64}$'),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  audit_id uuid NOT NULL UNIQUE REFERENCES public.audit_logs(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (ticket_id,request_id)
);
CREATE INDEX support_ticket_workflow_history_idx ON public.support_ticket_workflow_operations (tenant_id,ticket_id,sequence DESC);

CREATE FUNCTION public.nexid_reject_support_ticket_workflow_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='support_ticket_workflow_append_only';
END;
$$;
CREATE TRIGGER support_ticket_workflow_append_only BEFORE UPDATE OR DELETE
ON public.support_ticket_workflow_operations FOR EACH ROW
EXECUTE FUNCTION public.nexid_reject_support_ticket_workflow_mutation_v1();

-- Epoch preserves all timestamp precision independent of the connection timezone.
-- xmin detects external updates even if a writer preserves updated_at.
CREATE FUNCTION public.nexid_support_ticket_revision_v1(p_id uuid,p_tenant_id uuid,p_status text,p_updated_at timestamptz,p_xmin text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER SET search_path=pg_catalog,public AS $$
  SELECT encode(sha256(convert_to(jsonb_build_array(p_id,p_tenant_id,p_status,extract(epoch FROM p_updated_at),p_xmin)::text,'UTF8')),'hex');
$$;

CREATE FUNCTION public.nexid_support_ticket_receipt_v1(p_operation public.support_ticket_workflow_operations)
RETURNS jsonb LANGUAGE sql STABLE STRICT SECURITY INVOKER SET search_path=pg_catalog,public AS $$
  SELECT jsonb_build_object('operationId',p_operation.id,'requestId',p_operation.request_id,
    'sequence',p_operation.sequence::text,'fromStatus',p_operation.from_status,'toStatus',p_operation.to_status,
    'reason',p_operation.reason,'actor',jsonb_build_object('id',p_operation.actor_id,'label',p_operation.actor_label),
    'createdAt',p_operation.created_at,'revision',p_operation.revision);
$$;

CREATE FUNCTION public.nexid_support_ticket_current_v1(p_ticket_id uuid,p_tenant_id uuid,p_tenant_slug text)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
  SELECT jsonb_build_object('ticketId',t.id,'tenantId',t.tenant_id,'tenantSlug',tenant.slug,
    'status',t.status,'updatedAt',t.updated_at,
    'revision',public.nexid_support_ticket_revision_v1(t.id,COALESCE(t.tenant_id,'00000000-0000-0000-0000-000000000000'::uuid),t.status,t.updated_at,t.xmin::text),
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

CREATE FUNCTION public.nexid_read_support_ticket_workflow_v1(p_ticket_id uuid,p_tenant_id uuid,p_tenant_slug text,p_cursor bigint)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
  -- One MVCC snapshot for the current ticket, incident binding and full page.
  WITH current_ticket AS (
    SELECT t.id,t.tenant_id,jsonb_build_object('ticketId',t.id,'tenantId',t.tenant_id,'tenantSlug',tenant.slug,
      'status',t.status,'updatedAt',t.updated_at,
      'revision',public.nexid_support_ticket_revision_v1(t.id,COALESCE(t.tenant_id,'00000000-0000-0000-0000-000000000000'::uuid),t.status,t.updated_at,t.xmin::text),
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

CREATE FUNCTION public.nexid_transition_support_ticket_v1(
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
  IF v_ticket.status=p_to_status THEN
    RETURN jsonb_build_object('ok',false,'reason','ticket_workflow_no_change');
  END IF;
  UPDATE public.tickets SET status=p_to_status,
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

REVOKE ALL ON public.support_ticket_workflow_operations FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.support_ticket_workflow_operations_sequence_seq FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_reject_support_ticket_workflow_mutation_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_support_ticket_revision_v1(uuid,uuid,text,timestamptz,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_support_ticket_receipt_v1(public.support_ticket_workflow_operations) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_support_ticket_current_v1(uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_read_support_ticket_workflow_v1(uuid,uuid,text,bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_transition_support_ticket_v1(uuid,uuid,text,uuid,text,text,text,text,uuid) FROM PUBLIC;
