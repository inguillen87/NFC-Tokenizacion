-- Durable tag lifecycle governance. This is a business/operational state
-- machine layered over the existing tag_status enum. It does not modify NFC
-- keys, CMAC verification, SDM decoding or the physical TagTamper path.

ALTER TABLE tags
  ADD COLUMN IF NOT EXISTS lifecycle_state text,
  ADD COLUMN IF NOT EXISTS lifecycle_revision bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifecycle_reason text,
  ADD COLUMN IF NOT EXISTS lifecycle_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS lifecycle_updated_by uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE tags
  DROP CONSTRAINT IF EXISTS tags_lifecycle_state_check,
  DROP CONSTRAINT IF EXISTS tags_lifecycle_revision_check,
  DROP CONSTRAINT IF EXISTS tags_lifecycle_reason_length_check,
  DROP CONSTRAINT IF EXISTS tags_lifecycle_operational_status_check;

ALTER TABLE tags
  ADD CONSTRAINT tags_lifecycle_state_check CHECK (
    lifecycle_state IS NULL OR lifecycle_state IN (
      'inactive', 'active', 'suspended', 'quarantined', 'lost',
      'expired', 'broken', 'tampered', 'revoked'
    )
  ),
  ADD CONSTRAINT tags_lifecycle_revision_check CHECK (lifecycle_revision >= 0),
  ADD CONSTRAINT tags_lifecycle_reason_length_check CHECK (
    lifecycle_reason IS NULL OR char_length(lifecycle_reason) BETWEEN 3 AND 1000
  ),
  ADD CONSTRAINT tags_lifecycle_operational_status_check CHECK (
    lifecycle_state IS NULL OR status::text = CASE
      WHEN lifecycle_state = 'active' THEN 'active'
      WHEN lifecycle_state = 'revoked' THEN 'revoked'
      ELSE 'inactive'
    END
  );

CREATE TABLE IF NOT EXISTS tag_lifecycle_events (
  id bigserial PRIMARY KEY,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  operation_key text NOT NULL,
  request_fingerprint text NOT NULL,
  previous_state text NOT NULL,
  next_state text NOT NULL,
  operational_status text NOT NULL,
  lifecycle_revision bigint NOT NULL,
  reason text NOT NULL,
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  request_id text,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tag_lifecycle_event_operation_key_check CHECK (
    operation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  ),
  CONSTRAINT tag_lifecycle_event_request_fingerprint_check CHECK (
    request_fingerprint ~ '^sha256:[0-9a-f]{64}$'
  ),
  CONSTRAINT tag_lifecycle_event_previous_state_check CHECK (
    previous_state IN ('inactive', 'active', 'suspended', 'quarantined', 'lost', 'expired', 'broken', 'tampered', 'revoked')
  ),
  CONSTRAINT tag_lifecycle_event_next_state_check CHECK (
    next_state IN ('inactive', 'active', 'suspended', 'quarantined', 'lost', 'expired', 'broken', 'tampered', 'revoked')
  ),
  CONSTRAINT tag_lifecycle_event_operational_status_check CHECK (
    operational_status IN ('inactive', 'active', 'revoked')
  ),
  CONSTRAINT tag_lifecycle_event_revision_check CHECK (lifecycle_revision > 0),
  CONSTRAINT tag_lifecycle_event_reason_check CHECK (char_length(reason) BETWEEN 3 AND 1000),
  CONSTRAINT tag_lifecycle_event_evidence_object_check CHECK (jsonb_typeof(evidence_json) = 'object'),
  UNIQUE (tenant_id, operation_key),
  UNIQUE (tag_id, lifecycle_revision)
);

CREATE INDEX IF NOT EXISTS idx_tag_lifecycle_events_tenant_created
  ON tag_lifecycle_events(tenant_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_tag_lifecycle_events_tag_created
  ON tag_lifecycle_events(tag_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION nexid_reject_tag_lifecycle_history_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'tag_lifecycle_history_is_append_only' USING ERRCODE = '55000';
END;
$function$;

DROP TRIGGER IF EXISTS trg_tag_lifecycle_history_append_only ON tag_lifecycle_events;
CREATE TRIGGER trg_tag_lifecycle_history_append_only
BEFORE UPDATE OR DELETE ON tag_lifecycle_events
FOR EACH ROW EXECUTE FUNCTION nexid_reject_tag_lifecycle_history_mutation_v1();

CREATE OR REPLACE FUNCTION nexid_transition_tag_lifecycle_v1(p_input jsonb)
RETURNS TABLE (
  tag_id uuid,
  tenant_id uuid,
  uid_hex text,
  previous_state text,
  lifecycle_state text,
  operational_status text,
  lifecycle_revision bigint,
  transitioned_at timestamptz,
  replayed boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_tag_id uuid;
  v_tenant_id uuid;
  v_actor_id uuid;
  v_batch_id uuid;
  v_batch_status text;
  v_uid_hex text;
  v_current_state text;
  v_current_revision bigint;
  v_current_operational_status text;
  v_next_state text;
  v_next_operational_status text;
  v_expected_revision bigint;
  v_reason text;
  v_operation_key text;
  v_request_fingerprint text;
  v_evidence jsonb;
  v_request_id text;
  v_ip_address inet;
  v_user_agent text;
  v_existing record;
  v_transitioned_at timestamptz;
  v_supplier_expected_quantity integer;
  v_supplier_manifest_count integer;
  v_supplier_manifest_status text;
  v_supplier_qa_status text;
  v_supplier_gate_ok boolean;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' OR octet_length(p_input::text) > 16384 THEN
    RAISE EXCEPTION 'tag_lifecycle_input_invalid' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_tag_id := NULLIF(BTRIM(p_input->>'tag_id'), '')::uuid;
    v_tenant_id := NULLIF(BTRIM(p_input->>'tenant_id'), '')::uuid;
    v_actor_id := NULLIF(BTRIM(p_input->>'actor_id'), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'tag_lifecycle_identity_invalid' USING ERRCODE = '22023';
  END;
  IF v_tag_id IS NULL OR v_tenant_id IS NULL OR v_actor_id IS NULL THEN
    RAISE EXCEPTION 'tag_lifecycle_identity_required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM users actor
    JOIN memberships membership ON membership.user_id = actor.id
    WHERE actor.id = v_actor_id
      AND actor.admin_status::text = 'active'
      AND (
        (membership.role::text = 'super_admin' AND membership.tenant_id IS NULL)
        OR (membership.role::text = 'tenant_admin' AND membership.tenant_id = v_tenant_id)
      )
  ) THEN
    RAISE EXCEPTION 'tag_lifecycle_actor_scope_invalid' USING ERRCODE = '42501';
  END IF;

  v_next_state := LOWER(BTRIM(COALESCE(p_input->>'next_state', '')));
  v_reason := BTRIM(COALESCE(p_input->>'reason', ''));
  v_operation_key := BTRIM(COALESCE(p_input->>'operation_key', ''));
  v_request_fingerprint := LOWER(BTRIM(COALESCE(p_input->>'request_fingerprint', '')));
  v_request_id := NULLIF(BTRIM(p_input->>'request_id'), '');
  v_user_agent := NULLIF(LEFT(p_input->>'user_agent', 512), '');
  v_evidence := COALESCE(p_input->'evidence', '{}'::jsonb);

  IF v_next_state NOT IN ('inactive', 'active', 'suspended', 'quarantined', 'lost', 'expired', 'broken', 'tampered', 'revoked') THEN
    RAISE EXCEPTION 'tag_lifecycle_next_state_invalid' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_reason) < 3 OR char_length(v_reason) > 1000 THEN
    RAISE EXCEPTION 'tag_lifecycle_reason_invalid' USING ERRCODE = '22023';
  END IF;
  IF v_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' THEN
    RAISE EXCEPTION 'tag_lifecycle_operation_key_invalid' USING ERRCODE = '22023';
  END IF;
  IF v_request_fingerprint !~ '^sha256:[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'tag_lifecycle_request_fingerprint_invalid' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_evidence) <> 'object' OR octet_length(v_evidence::text) > 8192 THEN
    RAISE EXCEPTION 'tag_lifecycle_evidence_invalid' USING ERRCODE = '22023';
  END IF;
  IF NOT (p_input ? 'expected_revision') OR COALESCE(p_input->>'expected_revision', '') !~ '^\d{1,18}$' THEN
    RAISE EXCEPTION 'tag_lifecycle_expected_revision_invalid' USING ERRCODE = '22023';
  END IF;
  v_expected_revision := (p_input->>'expected_revision')::bigint;
  BEGIN
    v_ip_address := NULLIF(BTRIM(p_input->>'ip_address'), '')::inet;
  EXCEPTION WHEN invalid_text_representation THEN
    v_ip_address := NULL;
  END;

  -- Serialize all retries sharing a tenant/idempotency key before checking the
  -- receipt. Concurrent identical retries now replay the committed receipt;
  -- a reused key with different payload fails deterministically.
  PERFORM pg_advisory_xact_lock(
    hashtext(v_tenant_id::text),
    hashtext('tag-lifecycle:' || v_operation_key)
  );

  SELECT event.tag_id, event.next_state, event.operational_status,
         event.lifecycle_revision, event.created_at, tag.uid_hex,
         event.previous_state, event.request_fingerprint
    INTO v_existing
  FROM tag_lifecycle_events event
  JOIN tags tag ON tag.id = event.tag_id
  WHERE event.tenant_id = v_tenant_id
    AND event.operation_key = v_operation_key
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.tag_id IS DISTINCT FROM v_tag_id
      OR v_existing.next_state IS DISTINCT FROM v_next_state
      OR v_existing.request_fingerprint IS DISTINCT FROM v_request_fingerprint THEN
      RAISE EXCEPTION 'tag_lifecycle_idempotency_conflict' USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT
      v_existing.tag_id,
      v_tenant_id,
      v_existing.uid_hex,
      v_existing.previous_state,
      v_existing.next_state,
      v_existing.operational_status,
      v_existing.lifecycle_revision,
      v_existing.created_at,
      true;
    RETURN;
  END IF;

  SELECT tag.id, tag.uid_hex, batch.id, batch.tenant_id, batch.status::text,
         COALESCE(tag.lifecycle_state, tag.status::text),
         tag.lifecycle_revision,
         tag.status::text
    INTO v_tag_id, v_uid_hex, v_batch_id, v_tenant_id, v_batch_status,
         v_current_state, v_current_revision, v_current_operational_status
  FROM tags tag
  JOIN batches batch ON batch.id = tag.batch_id
  WHERE tag.id = v_tag_id
    AND batch.tenant_id = v_tenant_id
  FOR UPDATE OF tag;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'tag_lifecycle_tag_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_current_revision <> v_expected_revision THEN
    RAISE EXCEPTION 'tag_lifecycle_revision_conflict' USING ERRCODE = '40001';
  END IF;
  IF v_current_state = v_next_state THEN
    RAISE EXCEPTION 'tag_lifecycle_transition_noop' USING ERRCODE = '22023';
  END IF;

  IF NOT (CASE v_current_state
    WHEN 'inactive' THEN v_next_state = ANY (ARRAY['active', 'quarantined', 'revoked'])
    WHEN 'active' THEN v_next_state = ANY (ARRAY['suspended', 'quarantined', 'lost', 'expired', 'broken', 'tampered', 'revoked'])
    WHEN 'suspended' THEN v_next_state = ANY (ARRAY['active', 'quarantined', 'lost', 'expired', 'broken', 'tampered', 'revoked'])
    WHEN 'quarantined' THEN v_next_state = ANY (ARRAY['active', 'suspended', 'lost', 'expired', 'broken', 'tampered', 'revoked'])
    WHEN 'lost' THEN v_next_state = ANY (ARRAY['quarantined', 'revoked'])
    WHEN 'expired' THEN v_next_state = 'revoked'
    WHEN 'broken' THEN v_next_state = 'revoked'
    WHEN 'tampered' THEN v_next_state = 'revoked'
    ELSE false
  END) THEN
    RAISE EXCEPTION 'tag_lifecycle_transition_not_allowed' USING ERRCODE = '22023';
  END IF;

  IF v_next_state = 'active' THEN
    IF v_batch_status NOT IN ('production_registered', 'active_in_market', 'active') THEN
      RAISE EXCEPTION 'tag_lifecycle_batch_not_active' USING ERRCODE = '55000';
    END IF;

    SELECT count(*) > 0
           AND bool_and(
             sub_batch.manifest_status = 'imported'
             AND sub_batch.qa_status = 'passed'
             AND COALESCE(sub_batch.manifest_count, -1) = COALESCE(sub_batch.expected_quantity, -2)
           )
      INTO v_supplier_gate_ok
    FROM supplier_sub_batches sub_batch
    WHERE sub_batch.batch_id = v_batch_id;

    IF v_supplier_gate_ok IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'tag_lifecycle_supplier_activation_gate_failed' USING ERRCODE = '55000';
    END IF;
  END IF;

  v_next_operational_status := CASE
    WHEN v_next_state = 'active' THEN 'active'
    WHEN v_next_state = 'revoked' THEN 'revoked'
    ELSE 'inactive'
  END;
  v_transitioned_at := clock_timestamp();

  UPDATE tags
  SET lifecycle_state = v_next_state,
      lifecycle_revision = v_current_revision + 1,
      lifecycle_reason = v_reason,
      lifecycle_updated_at = v_transitioned_at,
      lifecycle_updated_by = v_actor_id,
      status = v_next_operational_status::tag_status,
      updated_at = v_transitioned_at
  WHERE id = v_tag_id;

  INSERT INTO tag_lifecycle_events (
    tag_id, batch_id, tenant_id, operation_key, request_fingerprint, previous_state, next_state,
    operational_status, lifecycle_revision, reason, evidence_json, actor_id,
    request_id, ip_address, user_agent, created_at
  ) VALUES (
    v_tag_id, v_batch_id, v_tenant_id, v_operation_key, v_request_fingerprint, v_current_state, v_next_state,
    v_next_operational_status, v_current_revision + 1, v_reason, v_evidence, v_actor_id,
    v_request_id, v_ip_address, v_user_agent, v_transitioned_at
  );

  RETURN QUERY SELECT
    v_tag_id,
    v_tenant_id,
    v_uid_hex,
    v_current_state,
    v_next_state,
    v_next_operational_status,
    v_current_revision + 1,
    v_transitioned_at,
    false;
END;
$function$;

-- Preserve the 0062 atomic replay/counter/event implementation as the base
-- function, then add lifecycle governance in the same SQL statement and
-- transaction. The base function keeps the tag row locked until this wrapper
-- returns, so a concurrent administrative transition cannot produce a mixed
-- lifecycle/event snapshot.
DO $tag_lifecycle_sun_wrapper$
BEGIN
  IF to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)') IS NULL THEN
    IF to_regprocedure('public.nexid_persist_sun_scan_v1(jsonb)') IS NULL THEN
      RAISE EXCEPTION 'tag_lifecycle_requires_sun_atomic_0062' USING ERRCODE = '42883';
    END IF;
    ALTER FUNCTION public.nexid_persist_sun_scan_v1(jsonb)
      RENAME TO nexid_persist_sun_scan_v1_base_0062;
  END IF;
END;
$tag_lifecycle_sun_wrapper$;

CREATE OR REPLACE FUNCTION public.nexid_persist_sun_scan_v1(p_input jsonb)
RETURNS TABLE (
  event_id bigint,
  final_result text,
  auth_status text,
  final_reason text,
  replay_suspect boolean,
  replay_original_event_id bigint,
  allowlisted boolean,
  tag_id uuid,
  tag_status text,
  previous_last_seen_ctr integer,
  last_seen_ctr integer,
  scan_count integer,
  event_type text,
  verdict text,
  risk_level text,
  created_at timestamptz,
  tag_lifecycle_state text,
  tag_lifecycle_revision bigint
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $sun_lifecycle_wrapper$
DECLARE
  v_receipt record;
  v_lifecycle_state text;
  v_lifecycle_revision bigint;
  v_final_result text;
  v_final_reason text;
  v_event_type text;
  v_verdict text;
  v_risk_level text;
  v_payload_verified boolean;
BEGIN
  SELECT base.*
    INTO v_receipt
  FROM public.nexid_persist_sun_scan_v1_base_0062(p_input) AS base;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sun_atomic_persistence_receipt_missing' USING ERRCODE = 'P0002';
  END IF;

  IF v_receipt.tag_id IS NOT NULL THEN
    SELECT COALESCE(tag.lifecycle_state, tag.status::text), tag.lifecycle_revision
      INTO v_lifecycle_state, v_lifecycle_revision
    FROM tags tag
    WHERE tag.id = v_receipt.tag_id;
  END IF;

  v_final_result := v_receipt.final_result;
  v_final_reason := v_receipt.final_reason;
  v_event_type := v_receipt.event_type;
  v_verdict := v_receipt.verdict;
  v_risk_level := v_receipt.risk_level;
  BEGIN
    v_payload_verified := COALESCE((p_input->>'payload_verified')::boolean, false);
  EXCEPTION WHEN invalid_text_representation THEN
    v_payload_verified := false;
  END;

  -- Lifecycle only tightens an already verified/registered message. Replay and
  -- physical/electronic tamper evidence keep precedence and can never be made
  -- valid by an administrative state.
  IF v_payload_verified
    AND v_receipt.allowlisted
    AND NOT v_receipt.replay_suspect
    AND v_lifecycle_state IS NOT NULL
    AND v_lifecycle_state <> 'active'
    AND v_receipt.auth_status NOT IN (
      'SUN_PROFILE_MISMATCH', 'SUN_BATCH_DUPLICATE_CONFIG',
      'NOT_REGISTERED', 'REPLAY_SUSPECT', 'SUPPLIER_PAYLOAD_ONLY'
    )
    AND UPPER(COALESCE(v_receipt.final_result, '')) <> 'TAMPER_RISK'
  THEN
    v_final_result := CASE v_lifecycle_state
      WHEN 'revoked' THEN 'REVOKED'
      WHEN 'broken' THEN 'BROKEN'
      WHEN 'tampered' THEN 'TAMPER_RISK'
      ELSE 'NOT_ACTIVE'
    END;
    v_final_reason := 'tag_lifecycle_' || v_lifecycle_state || ':administrative_state';
    v_event_type := 'TAP_INVALID';
    v_verdict := CASE v_lifecycle_state
      WHEN 'revoked' THEN 'revoked'
      WHEN 'broken' THEN 'broken'
      WHEN 'tampered' THEN 'tampered'
      ELSE 'not_active'
    END;
    v_risk_level := CASE
      WHEN v_lifecycle_state IN ('revoked', 'broken') THEN 'critical'
      WHEN v_lifecycle_state IN ('tampered', 'lost', 'quarantined') THEN 'high'
      ELSE 'medium'
    END;
  END IF;

  IF v_lifecycle_state IS NOT NULL THEN
    UPDATE events event
    SET result = v_final_result,
        reason = v_final_reason,
        event_type = v_event_type::event_type,
        verdict = v_verdict,
        risk_level = v_risk_level::risk_level,
        meta = COALESCE(event.meta, '{}'::jsonb) || jsonb_build_object(
          'tag_lifecycle_state', v_lifecycle_state,
          'tag_lifecycle_revision', COALESCE(v_lifecycle_revision, 0)
        )
    WHERE event.id = v_receipt.event_id
      AND event.created_at = v_receipt.created_at;
  END IF;

  event_id := v_receipt.event_id;
  final_result := v_final_result;
  auth_status := v_receipt.auth_status;
  final_reason := v_final_reason;
  replay_suspect := v_receipt.replay_suspect;
  replay_original_event_id := v_receipt.replay_original_event_id;
  allowlisted := v_receipt.allowlisted;
  tag_id := v_receipt.tag_id;
  tag_status := v_receipt.tag_status;
  previous_last_seen_ctr := v_receipt.previous_last_seen_ctr;
  last_seen_ctr := v_receipt.last_seen_ctr;
  scan_count := v_receipt.scan_count;
  event_type := v_event_type;
  verdict := v_verdict;
  risk_level := v_risk_level;
  created_at := v_receipt.created_at;
  tag_lifecycle_state := v_lifecycle_state;
  tag_lifecycle_revision := COALESCE(v_lifecycle_revision, 0);
  RETURN NEXT;
END;
$sun_lifecycle_wrapper$;

COMMENT ON FUNCTION public.nexid_persist_sun_scan_v1(jsonb) IS
  'Atomic SUN persistence plus administrative lifecycle tightening. NFC CMAC/SDM and physical TagTamper verification remain unchanged; software transaction boundary, not an HSM.';
