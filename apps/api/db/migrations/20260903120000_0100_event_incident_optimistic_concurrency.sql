-- Prevent one operator from silently overwriting an incident decision made by
-- another operator after the first operator loaded the expediente.

-- Expand first: keep the 0065 nine-argument signature available while the
-- currently deployed API is still using it. The API released with this
-- migration calls the new ten-argument overload below. A later contract
-- migration can remove the legacy signature after deployment telemetry proves
-- that no old API instance is serving traffic.

CREATE OR REPLACE FUNCTION public.nexid_transition_event_incident(
  p_incident_id uuid,
  p_expected_tenant_slug text,
  p_expected_version bigint,
  p_to_status text,
  p_to_severity text,
  p_actor_id uuid,
  p_actor_email text,
  p_actor_label text,
  p_reason text,
  p_idempotency_key text
)
RETURNS TABLE (
  incident_id uuid,
  tenant_id uuid,
  tenant_slug text,
  event_id bigint,
  ticket_id uuid,
  status text,
  severity text,
  title text,
  summary text,
  opened_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  version bigint,
  idempotent_replay boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_incident event_incidents%ROWTYPE;
  v_tenant_slug text;
  v_severity text;
  v_history_exists boolean;
  v_allowed boolean;
  v_action text;
  v_from_status text;
  v_from_severity text;
  v_request_fingerprint text;
  v_existing_fingerprint text;
BEGIN
  IF p_expected_version IS NULL OR p_expected_version < 1 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'incident_expected_version_required';
  END IF;

  SELECT i.*
  INTO v_incident
  FROM event_incidents i
  WHERE i.id = p_incident_id
  FOR UPDATE;

  IF v_incident.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'incident_not_found';
  END IF;

  SELECT lower(t.slug)
  INTO v_tenant_slug
  FROM tenants t
  WHERE t.id = v_incident.tenant_id
  FOR SHARE;

  IF v_tenant_slug IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'incident_tenant_link_broken';
  END IF;
  IF NULLIF(lower(trim(COALESCE(p_expected_tenant_slug, ''))), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'incident_tenant_scope_required';
  END IF;
  IF v_tenant_slug <> lower(trim(p_expected_tenant_slug)) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'incident_tenant_scope_mismatch';
  END IF;

  v_severity := COALESCE(NULLIF(p_to_severity, ''), v_incident.severity);
  v_request_fingerprint := encode(digest(jsonb_build_object(
    'incident_id', p_incident_id,
    'expected_version', p_expected_version,
    'to_status', p_to_status,
    'to_severity', v_severity,
    'reason', p_reason
  )::text, 'sha256'), 'hex');

  -- An exact retry remains idempotent even though the successful first request
  -- advanced the version. Reusing the key with any changed input fails closed.
  SELECT h.request_fingerprint
  INTO v_existing_fingerprint
  FROM event_incident_history h
  WHERE h.incident_id = p_incident_id AND h.idempotency_key = p_idempotency_key
  LIMIT 1;
  v_history_exists := FOUND;
  IF v_history_exists AND v_existing_fingerprint IS DISTINCT FROM v_request_fingerprint THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'incident_idempotency_key_conflict';
  END IF;
  IF v_history_exists THEN
    RETURN QUERY SELECT
      v_incident.id, v_incident.tenant_id, v_tenant_slug, v_incident.event_id,
      v_incident.ticket_id, v_incident.status, v_incident.severity,
      v_incident.title, v_incident.summary, v_incident.opened_at,
      v_incident.resolved_at, v_incident.created_at, v_incident.updated_at,
      v_incident.version, true;
    RETURN;
  END IF;

  IF v_incident.version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'incident_stale_version';
  END IF;

  v_from_status := v_incident.status;
  v_from_severity := v_incident.severity;
  v_allowed := CASE v_incident.status
    WHEN 'open' THEN p_to_status IN ('investigating', 'contained', 'dismissed')
    WHEN 'investigating' THEN p_to_status IN ('contained', 'resolved', 'dismissed')
    WHEN 'contained' THEN p_to_status IN ('investigating', 'resolved', 'dismissed')
    WHEN 'resolved' THEN p_to_status = 'investigating'
    WHEN 'dismissed' THEN p_to_status = 'investigating'
    ELSE false
  END;

  IF p_to_status = v_incident.status AND v_severity <> v_incident.severity THEN
    v_allowed := true;
    v_action := 'severity_changed';
  ELSIF p_to_status <> v_incident.status THEN
    v_action := 'transitioned';
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'incident_transition_no_change';
  END IF;
  IF NOT v_allowed THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'incident_transition_invalid';
  END IF;

  UPDATE event_incidents i
  SET
    status = p_to_status,
    severity = v_severity,
    updated_by = p_actor_id,
    updated_at = now(),
    resolved_at = CASE WHEN p_to_status IN ('resolved', 'dismissed') THEN now() ELSE NULL END,
    version = i.version + 1
  WHERE i.id = p_incident_id
    AND i.version = p_expected_version
  RETURNING * INTO v_incident;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'incident_stale_version';
  END IF;

  UPDATE tickets
  SET
    status = CASE WHEN p_to_status IN ('resolved', 'dismissed') THEN 'closed' ELSE 'open' END,
    priority = v_severity,
    updated_at = now()
  WHERE id = v_incident.ticket_id
    AND tenant_id = v_incident.tenant_id
    AND tap_event_id = v_incident.event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'incident_ticket_link_broken';
  END IF;

  INSERT INTO event_incident_history (
    incident_id, tenant_id, event_id, event_created_at, ticket_id, action, from_status,
    to_status, from_severity, to_severity, actor_id, actor_email,
    actor_label, reason, idempotency_key, request_fingerprint
  )
  VALUES (
    v_incident.id, v_incident.tenant_id, v_incident.event_id, v_incident.event_created_at,
    v_incident.ticket_id, v_action, v_from_status,
    p_to_status, v_from_severity, v_severity, p_actor_id, p_actor_email, p_actor_label,
    p_reason, p_idempotency_key, v_request_fingerprint
  );

  RETURN QUERY SELECT
    v_incident.id, v_incident.tenant_id, v_tenant_slug, v_incident.event_id,
    v_incident.ticket_id, v_incident.status, v_incident.severity,
    v_incident.title, v_incident.summary, v_incident.opened_at,
    v_incident.resolved_at, v_incident.created_at, v_incident.updated_at,
    v_incident.version, false;
END;
$$;

REVOKE ALL ON FUNCTION public.nexid_transition_event_incident(
  uuid, text, bigint, text, text, uuid, text, text, text, text
) FROM PUBLIC;
