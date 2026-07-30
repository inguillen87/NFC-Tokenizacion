-- Durable tenant-scoped event-to-incident workflow.
--
-- All event ownership checks, ticket creation, incident state changes and
-- append-only history writes execute inside one database statement. API
-- handlers must call the functions below instead of composing these writes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- `events` may be the original table (PK id) or the partitioned layout (PK
-- id, created_at). This unique key supports one portable composite FK.
CREATE UNIQUE INDEX IF NOT EXISTS uq_events_id_created_at
  ON events(id, created_at);

-- Older installations may have skipped the 0015 multi-column ALTER when its
-- legacy events(id)-only FK was incompatible with the partitioned table.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tap_event_id bigint;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS priority text DEFAULT 'low';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web_bot';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS event_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  event_id bigint NOT NULL,
  event_created_at timestamptz NOT NULL,
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'contained', 'resolved', 'dismissed')),
  severity text NOT NULL
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 4000),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  CONSTRAINT uq_event_incidents_event UNIQUE (event_id),
  CONSTRAINT uq_event_incidents_ticket UNIQUE (ticket_id),
  CONSTRAINT fk_event_incidents_event FOREIGN KEY (event_id, event_created_at)
    REFERENCES events(id, created_at) ON DELETE RESTRICT,
  CONSTRAINT event_incidents_resolution_time_chk CHECK (
    (status IN ('resolved', 'dismissed') AND resolved_at IS NOT NULL)
    OR (status NOT IN ('resolved', 'dismissed') AND resolved_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_event_incidents_tenant_status_updated
  ON event_incidents(tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS event_incident_history (
  id bigserial PRIMARY KEY,
  incident_id uuid NOT NULL REFERENCES event_incidents(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  event_id bigint NOT NULL,
  event_created_at timestamptz NOT NULL,
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('opened', 'transitioned', 'severity_changed')),
  from_status text,
  to_status text NOT NULL
    CHECK (to_status IN ('open', 'investigating', 'contained', 'resolved', 'dismissed')),
  from_severity text,
  to_severity text NOT NULL
    CHECK (to_severity IN ('low', 'medium', 'high', 'critical')),
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_email text NOT NULL CHECK (char_length(actor_email) BETWEEN 3 AND 320),
  actor_label text NOT NULL CHECK (char_length(actor_label) BETWEEN 1 AND 160),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 2000),
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 128),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_incident_history_idempotency UNIQUE (incident_id, idempotency_key),
  CONSTRAINT fk_event_incident_history_event FOREIGN KEY (event_id, event_created_at)
    REFERENCES events(id, created_at) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_event_incident_history_incident_created
  ON event_incident_history(incident_id, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_event_incident_history_tenant_created
  ON event_incident_history(tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION nexid_reject_event_incident_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'event_incident_history_append_only';
END;
$$;

DROP TRIGGER IF EXISTS trg_event_incident_history_append_only ON event_incident_history;
CREATE TRIGGER trg_event_incident_history_append_only
BEFORE UPDATE OR DELETE ON event_incident_history
FOR EACH ROW EXECUTE FUNCTION nexid_reject_event_incident_history_mutation();

CREATE OR REPLACE FUNCTION nexid_open_event_incident(
  p_event_id bigint,
  p_expected_tenant_slug text,
  p_severity text,
  p_title text,
  p_summary text,
  p_actor_id uuid,
  p_actor_email text,
  p_actor_label text,
  p_reason text
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
  v_tenant_id uuid;
  v_event_tenant_id uuid;
  v_batch_tenant_id uuid;
  v_event_count integer;
  v_event_created_at timestamptz;
  v_tenant_slug text;
  v_incident event_incidents%ROWTYPE;
  v_ticket_id uuid;
  v_ticket_priority text;
  v_request_fingerprint text;
  v_existing_fingerprint text;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'incident_actor_required';
  END IF;

  -- Serialize all opens for the same immutable tap evidence before creating a
  -- support ticket, so a concurrent retry cannot leave an orphan duplicate.
  PERFORM pg_advisory_xact_lock(hashtextextended('event_incident:' || p_event_id::text, 0));

  IF NULLIF(lower(trim(COALESCE(p_expected_tenant_slug, ''))), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'incident_tenant_scope_required';
  END IF;

  -- The partitioned legacy layout enforces (id, created_at), not id alone.
  -- Existing producers use a global sequence, but reject ambiguous historical
  -- data instead of selecting an arbitrary partition row.
  SELECT count(*)::integer
  INTO v_event_count
  FROM events e
  WHERE e.id = p_event_id;

  IF v_event_count = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'incident_event_not_found';
  END IF;
  IF v_event_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'incident_event_identity_ambiguous';
  END IF;

  SELECT e.tenant_id, b.tenant_id, e.tenant_id, e.created_at, lower(t.slug)
  INTO v_event_tenant_id, v_batch_tenant_id, v_tenant_id, v_event_created_at, v_tenant_slug
  FROM events e
  JOIN batches b ON b.id = e.batch_id
  JOIN tenants t ON t.id = e.tenant_id
  WHERE e.id = p_event_id
  FOR SHARE OF e, b, t;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'incident_event_not_found';
  END IF;
  IF v_event_tenant_id IS NOT NULL AND v_batch_tenant_id IS NOT NULL
    AND v_event_tenant_id <> v_batch_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'incident_event_tenant_conflict';
  END IF;
  IF NULLIF(lower(trim(COALESCE(p_expected_tenant_slug, ''))), '') IS NOT NULL
    AND v_tenant_slug <> lower(trim(p_expected_tenant_slug)) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'incident_tenant_scope_mismatch';
  END IF;

  v_request_fingerprint := encode(digest(jsonb_build_object(
    'event_id', p_event_id,
    'severity', p_severity,
    'title', p_title,
    'summary', p_summary,
    'reason', p_reason
  )::text, 'sha256'), 'hex');

  SELECT * INTO v_incident
  FROM event_incidents existing
  WHERE existing.event_id = p_event_id;

  IF v_incident.id IS NOT NULL THEN
    SELECT h.request_fingerprint INTO v_existing_fingerprint
    FROM event_incident_history h
    WHERE h.incident_id = v_incident.id AND h.action = 'opened'
    ORDER BY h.id ASC
    LIMIT 1;
    IF v_existing_fingerprint IS DISTINCT FROM v_request_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'incident_event_already_open_conflict';
    END IF;
    RETURN QUERY SELECT
      v_incident.id, v_incident.tenant_id, v_tenant_slug, v_incident.event_id,
      v_incident.ticket_id, v_incident.status, v_incident.severity,
      v_incident.title, v_incident.summary, v_incident.opened_at,
      v_incident.resolved_at, v_incident.created_at, v_incident.updated_at,
      v_incident.version, true;
    RETURN;
  END IF;

  v_ticket_priority := CASE p_severity
    WHEN 'critical' THEN 'critical'
    WHEN 'high' THEN 'high'
    WHEN 'medium' THEN 'medium'
    ELSE 'low'
  END;

  INSERT INTO tickets (
    locale, contact, title, detail, description, status, source, priority,
    tenant_id, tap_event_id, created_at, updated_at
  )
  VALUES (
    'es-AR', 'security-ops@nexid.internal', p_title, p_summary, p_summary,
    'open', 'event_incident', v_ticket_priority, v_tenant_id, p_event_id, now(), now()
  )
  RETURNING id INTO v_ticket_id;

  INSERT INTO event_incidents (
    tenant_id, event_id, event_created_at, ticket_id, status, severity, title, summary,
    created_by, updated_by
  )
  VALUES (
    v_tenant_id, p_event_id, v_event_created_at, v_ticket_id, 'open', p_severity, p_title,
    p_summary, p_actor_id, p_actor_id
  )
  RETURNING * INTO v_incident;

  INSERT INTO event_incident_history (
    incident_id, tenant_id, event_id, event_created_at, ticket_id, action, from_status,
    to_status, from_severity, to_severity, actor_id, actor_email,
    actor_label, reason, idempotency_key, request_fingerprint
  )
  VALUES (
    v_incident.id, v_tenant_id, p_event_id, v_event_created_at, v_ticket_id, 'opened', NULL,
    'open', NULL, p_severity, p_actor_id, p_actor_email, p_actor_label,
    p_reason, 'open:event:' || p_event_id::text, v_request_fingerprint
  );

  RETURN QUERY SELECT
    v_incident.id, v_incident.tenant_id, v_tenant_slug, v_incident.event_id,
    v_incident.ticket_id, v_incident.status, v_incident.severity,
    v_incident.title, v_incident.summary, v_incident.opened_at,
    v_incident.resolved_at, v_incident.created_at, v_incident.updated_at,
    v_incident.version, false;
END;
$$;

CREATE OR REPLACE FUNCTION nexid_transition_event_incident(
  p_incident_id uuid,
  p_expected_tenant_slug text,
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
  IF NULLIF(lower(trim(COALESCE(p_expected_tenant_slug, ''))), '') IS NOT NULL
    AND v_tenant_slug <> lower(trim(p_expected_tenant_slug)) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'incident_tenant_scope_mismatch';
  END IF;

  v_severity := COALESCE(NULLIF(p_to_severity, ''), v_incident.severity);
  v_request_fingerprint := encode(digest(jsonb_build_object(
    'incident_id', p_incident_id,
    'to_status', p_to_status,
    'to_severity', v_severity,
    'reason', p_reason
  )::text, 'sha256'), 'hex');

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
  RETURNING * INTO v_incident;

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

-- The application connection owner retains EXECUTE; unaffiliated database
-- roles do not receive mutation capabilities through PostgreSQL's PUBLIC
-- function grant.
REVOKE ALL ON FUNCTION nexid_open_event_incident(bigint, text, text, text, text, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION nexid_transition_event_incident(uuid, text, text, text, uuid, text, text, text, text) FROM PUBLIC;
