-- Atomic, idempotent supplier SUN QA receipts.
--
-- The application validates the cryptographic/canonical-event evidence. This
-- database boundary then freezes the relevant manufacturing context, claims
-- every referenced diagnostic exactly once, and commits every projection in
-- one transaction. It deliberately records physical_ceremony_verified=false:
-- this workflow does not turn application evidence into physical attestation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Migration 0015 created the original audit shape with entity_* columns while
-- newer application writers use resource_* plus non-secret hashes. CREATE
-- TABLE IF NOT EXISTS cannot reconcile those shapes, and entity_type was NOT
-- NULL. Normalize the additive compatibility surface before the atomic writer
-- depends on it. Legacy entity_* writers remain valid.
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS resource_type text,
  ADD COLUMN IF NOT EXISTS resource_id text,
  ADD COLUMN IF NOT EXISTS before_hash text,
  ADD COLUMN IF NOT EXISTS after_hash text,
  ADD COLUMN IF NOT EXISTS ip_address inet,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS request_id text;

DO $audit_schema_compat$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'entity_type'
  ) THEN
    EXECUTE 'UPDATE public.audit_logs
      SET resource_type = COALESCE(resource_type, entity_type),
          resource_id = COALESCE(resource_id, entity_id)
      WHERE resource_type IS NULL OR resource_id IS NULL';
    EXECUTE 'ALTER TABLE public.audit_logs ALTER COLUMN entity_type DROP NOT NULL';
  END IF;
END;
$audit_schema_compat$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
  ON audit_logs(resource_type, resource_id);

-- Historically this table was request-path DDL. Production request paths are
-- now DDL-free, so materialize the complete durable shape in the migration
-- ledger before the QA writer is enabled.
CREATE TABLE IF NOT EXISTS sun_diagnostics (
  id bigserial PRIMARY KEY,
  trace_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  tool_type text NOT NULL,
  bid text,
  uid_hex text,
  uid_masked text,
  read_counter integer,
  auth_status text,
  replay_status text,
  product_state text,
  tamper_status text,
  tamper_signal text,
  tamper_opened boolean,
  tamper_risk boolean,
  tagtamper_config_detected boolean,
  enc_plain_status_byte text,
  closed_url text,
  opened_url text,
  request_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sun_diagnostics_tool_created
  ON sun_diagnostics(tool_type, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_sun_diagnostics_trace
  ON sun_diagnostics(trace_id, id DESC);

ALTER TABLE supplier_qa_checks
  ADD COLUMN IF NOT EXISTS operation_key text,
  ADD COLUMN IF NOT EXISTS request_fingerprint text,
  ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS event_hash text,
  ADD COLUMN IF NOT EXISTS database_binding_digest text
    CHECK (database_binding_digest IS NULL OR database_binding_digest ~ '^sha256:[0-9a-f]{64}$');

CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_qa_operation_key
  ON supplier_qa_checks(tenant_id, operation_key)
  WHERE operation_key IS NOT NULL;

-- A pre-existing duplicate pass is a release blocker that must be reconciled,
-- never silently deleted by a migration.
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_qa_passed_sub_batch
  ON supplier_qa_checks(supplier_sub_batch_id)
  WHERE status = 'passed';

CREATE TABLE IF NOT EXISTS supplier_qa_diagnostic_consumptions (
  diagnostic_id bigint PRIMARY KEY REFERENCES sun_diagnostics(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_sub_batch_id uuid NOT NULL REFERENCES supplier_sub_batches(id) ON DELETE RESTRICT,
  qa_check_id uuid NOT NULL REFERENCES supplier_qa_checks(id) ON DELETE RESTRICT,
  trace_id text NOT NULL CHECK (char_length(trace_id) BETWEEN 1 AND 160),
  reference_hash text NOT NULL CHECK (reference_hash ~ '^sha256:[0-9a-f]{64}$'),
  canonical_event_id bigint NOT NULL,
  canonical_event_created_at timestamptz NOT NULL,
  canonical_binding_digest text NOT NULL
    CHECK (canonical_binding_digest ~ '^sha256:[0-9a-f]{64}$'),
  verification_context_digest text NOT NULL
    CHECK (verification_context_digest ~ '^sha256:[0-9a-f]{64}$'),
  consumed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (qa_check_id, diagnostic_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_qa_diagnostic_receipt
  ON supplier_qa_diagnostic_consumptions(qa_check_id, diagnostic_id);
CREATE INDEX IF NOT EXISTS idx_supplier_qa_diagnostic_sub_batch
  ON supplier_qa_diagnostic_consumptions(supplier_sub_batch_id, consumed_at DESC);

CREATE OR REPLACE FUNCTION public.nexid_supplier_qa_history_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_history_is_append_only';
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_qa_checks_append_only ON supplier_qa_checks;
CREATE TRIGGER trg_supplier_qa_checks_append_only
  BEFORE UPDATE OR DELETE ON supplier_qa_checks
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_qa_history_append_only();

DROP TRIGGER IF EXISTS trg_supplier_qa_consumptions_append_only ON supplier_qa_diagnostic_consumptions;
CREATE TRIGGER trg_supplier_qa_consumptions_append_only
  BEFORE UPDATE OR DELETE ON supplier_qa_diagnostic_consumptions
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_qa_history_append_only();

-- Diagnostics and canonical scan events remain mutable until they become QA
-- evidence. Once consumed, their exact rows are part of an append-only receipt
-- and must not be rewritten or deleted behind that receipt.
CREATE OR REPLACE FUNCTION public.nexid_consumed_sun_diagnostic_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM supplier_qa_diagnostic_consumptions consumption
    WHERE consumption.diagnostic_id = OLD.id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'consumed_sun_diagnostic_is_immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consumed_sun_diagnostic_immutable ON sun_diagnostics;
CREATE TRIGGER trg_consumed_sun_diagnostic_immutable
  BEFORE UPDATE OR DELETE ON sun_diagnostics
  FOR EACH ROW EXECUTE FUNCTION public.nexid_consumed_sun_diagnostic_immutable();

CREATE OR REPLACE FUNCTION public.nexid_consumed_sun_event_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM supplier_qa_diagnostic_consumptions consumption
    WHERE consumption.canonical_event_id = OLD.id
      AND consumption.canonical_event_created_at = OLD.created_at
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'consumed_sun_event_is_immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consumed_sun_event_immutable ON events;
CREATE TRIGGER trg_consumed_sun_event_immutable
  BEFORE UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION public.nexid_consumed_sun_event_immutable();

CREATE OR REPLACE FUNCTION public.nexid_commit_supplier_qa_v1(p_input jsonb)
RETURNS TABLE (
  qa_check_id uuid,
  qa_status text,
  evidence_digest text,
  evidence_event_hash text,
  idempotent_replay boolean
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_supplier_order_id uuid;
  v_supplier_sub_batch_id uuid;
  v_batch_id uuid;
  v_actor_id uuid;
  v_bid text;
  v_status text;
  v_sample_count integer;
  v_replay_checked boolean;
  v_ttstatus_checked boolean;
  v_notes text;
  v_actor_email text;
  v_operation_key text;
  v_request_fingerprint text;
  v_evidence jsonb;
  v_evidence_digest text;
  v_database_binding_digest text;
  v_notes_digest text;
  v_event_payload jsonb;
  v_event_hash text;
  v_diagnostic_refs jsonb;
  v_expected_manifest_hash text;
  v_expected_carrier_profile text;
  v_expected_key_fingerprint text;
  v_expected_sdm_config jsonb;
  v_expected_verification_context text;
  v_reference_count integer;
  v_locked_diagnostic_count integer;
  v_updated_count integer;
  v_ref_ids bigint[];
  v_evidence_ids bigint[];
  v_ref_hashes text[];
  v_evidence_hashes text[];
  v_canonical_binding_digests text[];
  v_locked record;
  v_existing supplier_qa_checks%ROWTYPE;
  v_qa_check_id uuid;
BEGIN
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_qa_input_invalid';
  END IF;
  IF COALESCE(p_input->>'tenant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'supplier_order_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'supplier_sub_batch_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'batch_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'actor_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_qa_identity_invalid';
  END IF;

  v_tenant_id := (p_input->>'tenant_id')::uuid;
  v_supplier_order_id := (p_input->>'supplier_order_id')::uuid;
  v_supplier_sub_batch_id := (p_input->>'supplier_sub_batch_id')::uuid;
  v_batch_id := (p_input->>'batch_id')::uuid;
  v_actor_id := (p_input->>'actor_id')::uuid;
  v_bid := upper(trim(COALESCE(p_input->>'bid', '')));
  v_status := lower(trim(COALESCE(p_input->>'status', '')));
  v_actor_email := lower(trim(COALESCE(p_input->>'actor_email', '')));
  v_operation_key := trim(COALESCE(p_input->>'operation_key', ''));
  v_notes := NULLIF(trim(COALESCE(p_input->>'notes', '')), '');
  v_evidence := COALESCE(p_input->'evidence_json', '{}'::jsonb);
  v_evidence_digest := lower(trim(COALESCE(p_input->>'evidence_digest', '')));
  v_diagnostic_refs := COALESCE(p_input->'diagnostic_refs', '[]'::jsonb);
  v_expected_manifest_hash := lower(trim(COALESCE(p_input->>'expected_manifest_hash', '')));
  v_expected_carrier_profile := lower(trim(COALESCE(p_input->>'expected_carrier_profile_code', '')));
  v_expected_key_fingerprint := upper(trim(COALESCE(p_input->>'expected_key_fingerprint', '')));
  v_expected_sdm_config := COALESCE(p_input->'expected_sdm_config', '{}'::jsonb);
  v_expected_verification_context := lower(trim(COALESCE(p_input->>'expected_verification_context_digest', '')));

  IF v_bid = '' OR v_status NOT IN ('passed', 'failed') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_qa_decision_invalid';
  END IF;
  IF COALESCE(p_input->>'sample_count', '') !~ '^[0-9]{1,9}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_qa_sample_count_invalid';
  END IF;
  v_sample_count := (p_input->>'sample_count')::integer;
  v_replay_checked := p_input->>'replay_checked' = 'true';
  v_ttstatus_checked := p_input->>'ttstatus_checked' = 'true';

  IF v_actor_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR char_length(v_actor_email) > 320 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_qa_actor_invalid';
  END IF;
  IF v_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_qa_idempotency_key_invalid';
  END IF;
  IF v_notes IS NOT NULL AND char_length(v_notes) > 2000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_qa_notes_too_long';
  END IF;
  IF jsonb_typeof(v_evidence) IS DISTINCT FROM 'object'
    OR jsonb_typeof(v_expected_sdm_config) IS DISTINCT FROM 'object'
    OR jsonb_typeof(v_diagnostic_refs) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_qa_payload_invalid';
  END IF;
  IF v_evidence_digest !~ '^sha256:[0-9a-f]{64}$'
    OR v_expected_verification_context !~ '^sha256:[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_qa_digest_invalid';
  END IF;
  IF lower(COALESCE(v_evidence->>'evidence_digest', '')) <> v_evidence_digest
    OR COALESCE(v_evidence->>'schema_version', '') <> 'supplier-qa-sun/v1'
    OR COALESCE(v_evidence->>'physical_ceremony_verified', '') <> 'false'
    OR COALESCE(v_evidence->>'operation_key', '') <> v_operation_key THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_qa_evidence_envelope_invalid';
  END IF;

  v_reference_count := jsonb_array_length(v_diagnostic_refs);
  IF v_reference_count > 60
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_diagnostic_refs) AS ref(value)
      WHERE jsonb_typeof(ref.value) IS DISTINCT FROM 'object'
        OR COALESCE(ref.value->>'diagnostic_id', '') !~ '^[1-9][0-9]{0,18}$'
        OR COALESCE(ref.value->>'trace_id', '') !~ '^[A-Za-z0-9._:-]{1,160}$'
        OR COALESCE(ref.value->>'reference_hash', '') !~ '^sha256:[0-9a-f]{64}$'
    ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_qa_diagnostic_refs_invalid';
  END IF;

  SELECT
    array_agg((ref.value->>'diagnostic_id')::bigint ORDER BY (ref.value->>'diagnostic_id')::bigint),
    array_agg(ref.value->>'reference_hash' ORDER BY ref.value->>'reference_hash')
  INTO v_ref_ids, v_ref_hashes
  FROM jsonb_array_elements(v_diagnostic_refs) AS ref(value);
  IF v_reference_count <> COALESCE((SELECT count(DISTINCT diagnostic_id) FROM unnest(v_ref_ids) AS diagnostic_id), 0) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_qa_diagnostic_refs_duplicate';
  END IF;

  v_request_fingerprint := encode(digest(jsonb_build_object(
    'tenant_id', v_tenant_id,
    'supplier_order_id', v_supplier_order_id,
    'supplier_sub_batch_id', v_supplier_sub_batch_id,
    'batch_id', v_batch_id,
    'bid', v_bid,
    'status', v_status,
    'evidence_digest', v_evidence_digest,
    'diagnostic_refs', v_diagnostic_refs,
    'notes', v_notes,
    'evidence_json', v_evidence,
    'actor_id', v_actor_id
  )::text, 'sha256'), 'hex');

  -- Serialize reuse of the same tenant operation key even when two requests
  -- target different sub-batches. Row and uniqueness locks below remain the
  -- authoritative resource guards.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || chr(31) || v_operation_key, 0));

  -- A confirmed receipt is immutable and replayable even if keys, packaging or
  -- manufacturing state changed after the original transaction. Mutable
  -- preconditions are evaluated only for a genuinely new operation.
  SELECT q.*
  INTO v_existing
  FROM supplier_qa_checks q
  WHERE q.tenant_id = v_tenant_id
    AND q.operation_key = v_operation_key
  LIMIT 1;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.request_fingerprint IS DISTINCT FROM v_request_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'supplier_qa_idempotency_key_conflict';
    END IF;
    RETURN QUERY SELECT
      v_existing.id,
      v_existing.status,
      COALESCE(v_existing.evidence_json->>'evidence_digest', ''),
      COALESCE(v_existing.event_hash, ''),
      true;
    RETURN;
  END IF;

  SELECT
    ssb.id AS supplier_sub_batch_id,
    ssb.status AS supplier_sub_batch_status,
    ssb.qa_status,
    ssb.manifest_status,
    ssb.manifest_hash,
    ssb.manifest_count,
    ssb.manifest_imported_at,
    ssb.expected_quantity,
    ssb.activated_at,
    ssb.key_export_count,
    ssb.key_exported_at,
    b.status::text AS batch_status,
    b.carrier_profile_code AS batch_carrier_profile,
    b.sdm_config,
    bk.key_fingerprint,
    bk.export_count AS batch_key_export_count,
    bk.exported_at AS batch_key_exported_at,
    so.carrier_profile_code AS order_carrier_profile,
    so.packaging_governance_status,
    so.packaging_spec_revision,
    so.packaging_spec_hash,
    EXISTS (
      SELECT 1
      FROM supplier_packaging_governance_decisions decision
      WHERE decision.supplier_order_id = so.id
        AND decision.tenant_id = so.tenant_id
        AND decision.spec_revision = so.packaging_spec_revision
        AND decision.decision_status = 'approved'
        AND decision.carrier_profile_code = so.carrier_profile_code
        AND decision.spec_hash = so.packaging_spec_hash
        AND decision.spec_snapshot = so.packaging_spec_snapshot
        AND decision.evidence_refs = so.packaging_evidence_refs
        AND decision.validation_snapshot = so.packaging_validation_snapshot
        AND decision.decided_by = so.packaging_approved_by
        AND decision.decided_at = so.packaging_approved_at
    ) AS packaging_governance_receipt_valid
  INTO v_locked
  FROM supplier_sub_batches ssb
  JOIN supplier_orders so
    ON so.id = ssb.supplier_order_id
   AND so.tenant_id = ssb.tenant_id
  JOIN batches b
    ON b.id = ssb.batch_id
   AND b.tenant_id = ssb.tenant_id
   AND upper(b.bid) = upper(ssb.bid)
  JOIN batch_keys bk
    ON bk.supplier_sub_batch_id = ssb.id
   AND bk.batch_id = b.id
   AND bk.tenant_id = ssb.tenant_id
   AND upper(bk.bid) = upper(ssb.bid)
   AND bk.status = 'active'
  WHERE ssb.id = v_supplier_sub_batch_id
    AND ssb.supplier_order_id = v_supplier_order_id
    AND ssb.batch_id = v_batch_id
    AND ssb.tenant_id = v_tenant_id
    AND upper(ssb.bid) = v_bid
  FOR UPDATE OF ssb, so, b, bk;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'supplier_qa_scope_not_found';
  END IF;

  IF lower(COALESCE(v_locked.supplier_sub_batch_status, '')) <> 'pack_ready'
    OR lower(COALESCE(v_locked.batch_status, '')) <> 'production_registered'
    OR v_locked.activated_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_pre_release_state_required';
  END IF;
  IF lower(COALESCE(v_locked.qa_status, '')) = 'passed' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_already_passed';
  END IF;
  IF lower(COALESCE(v_locked.batch_carrier_profile, '')) <> v_expected_carrier_profile
    OR lower(COALESCE(v_locked.order_carrier_profile, '')) <> v_expected_carrier_profile THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_carrier_profile_scope_mismatch';
  END IF;
  IF lower(COALESCE(v_locked.manifest_hash, '')) <> v_expected_manifest_hash
    OR upper(COALESCE(v_locked.key_fingerprint, '')) <> v_expected_key_fingerprint
    OR v_locked.sdm_config IS DISTINCT FROM v_expected_sdm_config THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_verification_context_changed';
  END IF;

  IF v_status = 'passed' THEN
    IF lower(COALESCE(v_locked.manifest_status, '')) <> 'imported'
      OR v_locked.manifest_count IS DISTINCT FROM v_locked.expected_quantity THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_manifest_required';
    END IF;
    IF lower(COALESCE(v_locked.packaging_governance_status, '')) <> 'approved'
      OR COALESCE(v_locked.packaging_spec_revision, 0) <= 0
      OR COALESCE(v_locked.packaging_spec_hash, '') !~ '^sha256:[0-9a-f]{64}$'
      OR v_locked.packaging_governance_receipt_valid IS DISTINCT FROM true
      OR v_locked.key_export_count IS DISTINCT FROM 1
      OR v_locked.batch_key_export_count IS DISTINCT FROM 1
      OR v_locked.key_exported_at IS NULL
      OR v_locked.batch_key_exported_at IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_factory_release_evidence_required';
    END IF;
    IF v_sample_count <> LEAST(10, v_locked.expected_quantity)
      OR NOT v_replay_checked
      OR (v_expected_carrier_profile = 'ntag424_dna_tt' AND NOT v_ttstatus_checked)
      OR (v_expected_carrier_profile <> 'ntag424_dna_tt' AND v_ttstatus_checked)
      OR v_expected_carrier_profile NOT IN ('ntag424_dna', 'ntag424_dna_tt') THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_verified_sample_required';
    END IF;
    IF v_reference_count = 0
      OR COALESCE(v_evidence->>'schema_version', '') <> 'supplier-qa-sun/v1'
      OR COALESCE(v_evidence->>'server_verified_sun_evidence', '') <> 'true'
      OR COALESCE(v_evidence->>'physical_ceremony_verified', '') <> 'false'
      OR lower(COALESCE(v_evidence->>'verification_context_digest', '')) <> v_expected_verification_context THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_server_evidence_required';
    END IF;
    IF jsonb_typeof(v_evidence->'diagnostic_ids') IS DISTINCT FROM 'array'
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_evidence->'diagnostic_ids') AS evidence_id(value)
        WHERE evidence_id.value !~ '^[1-9][0-9]{0,18}$'
      )
      OR jsonb_typeof(v_evidence->'diagnostic_reference_hashes') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_evidence_references_invalid';
    END IF;
    SELECT array_agg(evidence_id.value::bigint ORDER BY evidence_id.value::bigint)
    INTO v_evidence_ids
    FROM jsonb_array_elements_text(v_evidence->'diagnostic_ids') AS evidence_id(value);
    SELECT array_agg(evidence_hash.value ORDER BY evidence_hash.value)
    INTO v_evidence_hashes
    FROM jsonb_array_elements_text(v_evidence->'diagnostic_reference_hashes') AS evidence_hash(value);
    IF v_evidence_ids IS DISTINCT FROM v_ref_ids OR v_evidence_hashes IS DISTINCT FROM v_ref_hashes THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_evidence_references_mismatch';
    END IF;

    -- Re-resolve and lock both sides of every Node-validated reference. The
    -- database recomputes the public reference commitment and verifies the
    -- canonical event identity; caller-supplied hashes alone are never enough
    -- to create a durable receipt.
    PERFORM d.id
    FROM sun_diagnostics d
    JOIN jsonb_to_recordset(v_diagnostic_refs) AS ref(
      diagnostic_id bigint,
      trace_id text,
      reference_hash text
    ) ON ref.diagnostic_id = d.id AND ref.trace_id = d.trace_id
    JOIN events e
      ON e.id = CASE
        WHEN d.result_json #>> '{raw_result,event_id}' ~ '^[1-9][0-9]{0,18}$'
        THEN (d.result_json #>> '{raw_result,event_id}')::bigint
        ELSE NULL
      END
     AND e.tenant_id = v_tenant_id
     AND e.batch_id = v_batch_id
    WHERE d.tool_type = 'sun_scan'
      AND d.request_json->>'evidence_source' = 'public_sun_route'
      AND upper(COALESCE(d.bid, '')) = v_bid
      AND d.created_at >= v_locked.manifest_imported_at
      AND d.created_at >= now() - interval '72 hours'
      AND d.created_at <= now() + interval '1 minute'
      AND ref.reference_hash = 'sha256:' || encode(digest(
        convert_to('supplier-qa-sun/v1', 'UTF8')
          || decode('00', 'hex')
          || convert_to(d.id::text, 'UTF8')
          || decode('00', 'hex')
          || convert_to(d.trace_id, 'UTF8'),
        'sha256'
      ), 'hex')
      AND lower(COALESCE(d.result_json #>> '{raw_result,sun_diagnostics,verification_context_digest}', '')) = v_expected_verification_context
      AND lower(COALESCE(d.result_json #>> '{raw_result,tenant_id}', '')) = lower(v_tenant_id::text)
      AND upper(COALESCE(d.result_json #>> '{raw_result,bid}', '')) = v_bid
      AND COALESCE(d.result_json #>> '{raw_result,cryptographic_verification}', '') = 'true'
      AND COALESCE(d.result_json #>> '{raw_result,sun_diagnostics,cmac_valid}', '') = 'true'
      AND COALESCE(d.result_json #>> '{raw_result,sun_diagnostics,sdm_decryption_ok}', '') = 'true'
      AND COALESCE(d.result_json #>> '{raw_result,sun_diagnostics,uid_decoded}', '') = 'true'
      AND COALESCE(d.result_json #>> '{raw_result,side_effect_mode}', '') = 'persist'
      AND COALESCE(d.result_json #>> '{raw_result,sun_diagnostics,side_effect_mode}', '') = 'persist'
      AND COALESCE(d.result_json #>> '{raw_result,sun_diagnostics,verification_method}', '') = 'sun_crypto'
      AND upper(COALESCE(d.uid_hex, '')) = upper(COALESCE(d.result_json #>> '{raw_result,uid}', ''))
      AND upper(COALESCE(d.uid_hex, '')) = upper(COALESCE(d.result_json #>> '{raw_result,sun_diagnostics,uid_hex}', ''))
      AND COALESCE(d.result_json #>> '{raw_result,ctr}', '') ~ '^[0-9]{1,8}$'
      AND COALESCE(d.result_json #>> '{raw_result,sun_diagnostics,read_counter}', '') ~ '^[0-9]{1,8}$'
      AND d.read_counter BETWEEN 0 AND 16777215
      AND (d.result_json #>> '{raw_result,ctr}')::integer = d.read_counter
      AND (d.result_json #>> '{raw_result,sun_diagnostics,read_counter}')::integer = d.read_counter
      AND upper(COALESCE(e.bid, '')) = v_bid
      AND upper(COALESCE(e.uid_hex, '')) = upper(COALESCE(d.uid_hex, ''))
      AND COALESCE(e.read_counter, e.sdm_read_ctr) = d.read_counter
      AND e.cmac_ok IS TRUE
      AND lower(COALESCE(e.source::text, '')) = 'real'
      AND upper(COALESCE(e.result, '')) = upper(COALESCE(d.result_json #>> '{raw_result,result}', ''))
      AND e.created_at <= d.created_at
      AND d.created_at - e.created_at <= interval '5 minutes'
      AND EXISTS (
        SELECT 1
        FROM tags manifest_tag
        WHERE manifest_tag.batch_id = v_batch_id
          AND upper(manifest_tag.uid_hex) = upper(d.uid_hex)
      )
    ORDER BY d.id, e.created_at
    FOR UPDATE OF d, e;
    GET DIAGNOSTICS v_locked_diagnostic_count = ROW_COUNT;
    IF v_locked_diagnostic_count <> v_reference_count THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_diagnostic_context_changed';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM supplier_qa_diagnostic_consumptions consumption
      WHERE consumption.diagnostic_id = ANY(v_ref_ids)
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_snapshot_already_consumed';
    END IF;

    SELECT array_agg(
      'sha256:' || encode(digest(jsonb_build_object(
        'schema_version', 'supplier-qa-canonical-binding/v1',
        'diagnostic_id', d.id,
        'trace_id', d.trace_id,
        'diagnostic_created_at', d.created_at,
        'canonical_event_id', e.id,
        'canonical_event_created_at', e.created_at,
        'tenant_id', e.tenant_id,
        'batch_id', e.batch_id,
        'bid', upper(e.bid),
        'uid_hex', upper(e.uid_hex),
        'read_counter', COALESCE(e.read_counter, e.sdm_read_ctr),
        'result', upper(e.result),
        'cmac_ok', e.cmac_ok,
        'source', lower(e.source::text),
        'verification_context_digest', v_expected_verification_context
      )::text, 'sha256'), 'hex')
      ORDER BY d.id
    )
    INTO v_canonical_binding_digests
    FROM sun_diagnostics d
    JOIN jsonb_to_recordset(v_diagnostic_refs) AS ref(
      diagnostic_id bigint,
      trace_id text,
      reference_hash text
    ) ON ref.diagnostic_id = d.id AND ref.trace_id = d.trace_id
    JOIN events e
      ON e.id = (d.result_json #>> '{raw_result,event_id}')::bigint;
  ELSE
    IF v_reference_count <> 0
      OR v_sample_count <> 0
      OR v_replay_checked
      OR v_ttstatus_checked
      OR COALESCE(v_evidence->>'server_verified_sun_evidence', '') <> 'false'
      OR COALESCE(v_evidence->>'physical_ceremony_verified', '') <> 'false' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_qa_rejection_evidence_invalid';
    END IF;
  END IF;

  v_notes_digest := CASE
    WHEN v_notes IS NULL THEN NULL
    ELSE 'sha256:' || encode(digest(jsonb_build_object('notes', v_notes)::text, 'sha256'), 'hex')
  END;
  v_database_binding_digest := 'sha256:' || encode(digest(jsonb_build_object(
    'schema_version', 'supplier-qa-db-receipt/v1',
    'tenant_id', v_tenant_id,
    'supplier_order_id', v_supplier_order_id,
    'supplier_sub_batch_id', v_supplier_sub_batch_id,
    'batch_id', v_batch_id,
    'bid', v_bid,
    'status', v_status,
    'sample_count', v_sample_count,
    'replay_checked', v_replay_checked,
    'ttstatus_checked', v_ttstatus_checked,
    'operation_key', v_operation_key,
    'actor_id', v_actor_id,
    'notes', v_notes,
    'evidence_json', v_evidence,
    'diagnostic_refs', v_diagnostic_refs,
    'canonical_binding_digests', COALESCE(to_jsonb(v_canonical_binding_digests), '[]'::jsonb),
    'verification_context_digest', v_expected_verification_context
  )::text, 'sha256'), 'hex');

  -- Build the event projection and its commitment inside the same locked
  -- transaction. The application cannot choose a colliding payload hash.
  v_event_payload := jsonb_build_object(
    'supplier_order_id', v_supplier_order_id,
    'supplier_sub_batch_id', v_supplier_sub_batch_id,
    'bid', v_bid,
    'status', v_status,
    'sample_count', v_sample_count,
    'replay_checked', v_replay_checked,
    'ttstatus_checked', v_ttstatus_checked,
    'server_verified_sun_evidence', v_status = 'passed',
    'physical_ceremony_verified', false,
    'requires_ttstatus', v_expected_carrier_profile = 'ntag424_dna_tt',
    'requires_secure_sun', v_expected_carrier_profile IN ('ntag424_dna', 'ntag424_dna_tt'),
    'evidence_schema_version', 'supplier-qa-sun/v1',
    'evidence_digest', v_evidence_digest,
    'database_binding_digest', v_database_binding_digest,
    'operation_key', v_operation_key,
    'notes_digest', v_notes_digest
  );
  v_event_hash := 'sha256:' || encode(digest(jsonb_build_object(
    'schema_version', 'supplier-qa-evidence-event/v1',
    'tenant_id', v_tenant_id,
    'resource_type', 'supplier_sub_batch',
    'resource_id', v_supplier_sub_batch_id,
    'event_type', CASE WHEN v_status = 'passed' THEN 'qa_passed' ELSE 'qa_failed' END,
    'payload', v_event_payload
  )::text, 'sha256'), 'hex');

  INSERT INTO supplier_qa_checks (
    tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid, status,
    sample_count, replay_checked, ttstatus_checked, notes, evidence_json, checked_by,
    operation_key, request_fingerprint, actor_id, event_hash, database_binding_digest
  ) VALUES (
    v_tenant_id, v_supplier_order_id, v_supplier_sub_batch_id, v_batch_id, v_bid, v_status,
    v_sample_count, v_replay_checked, v_ttstatus_checked, v_notes, v_evidence, v_actor_email,
    v_operation_key, v_request_fingerprint, v_actor_id, v_event_hash, v_database_binding_digest
  )
  RETURNING id INTO v_qa_check_id;

  IF v_status = 'passed' THEN
    INSERT INTO supplier_qa_diagnostic_consumptions (
      diagnostic_id, tenant_id, supplier_sub_batch_id, qa_check_id,
      trace_id, reference_hash, canonical_event_id, canonical_event_created_at,
      canonical_binding_digest, verification_context_digest
    )
    SELECT
      ref.diagnostic_id, v_tenant_id, v_supplier_sub_batch_id, v_qa_check_id,
      ref.trace_id, ref.reference_hash, e.id, e.created_at,
      'sha256:' || encode(digest(jsonb_build_object(
        'schema_version', 'supplier-qa-canonical-binding/v1',
        'diagnostic_id', d.id,
        'trace_id', d.trace_id,
        'diagnostic_created_at', d.created_at,
        'canonical_event_id', e.id,
        'canonical_event_created_at', e.created_at,
        'tenant_id', e.tenant_id,
        'batch_id', e.batch_id,
        'bid', upper(e.bid),
        'uid_hex', upper(e.uid_hex),
        'read_counter', COALESCE(e.read_counter, e.sdm_read_ctr),
        'result', upper(e.result),
        'cmac_ok', e.cmac_ok,
        'source', lower(e.source::text),
        'verification_context_digest', v_expected_verification_context
      )::text, 'sha256'), 'hex'),
      v_expected_verification_context
    FROM jsonb_to_recordset(v_diagnostic_refs) AS ref(
      diagnostic_id bigint,
      trace_id text,
      reference_hash text
    )
    JOIN sun_diagnostics d
      ON d.id = ref.diagnostic_id
     AND d.trace_id = ref.trace_id
    JOIN events e
      ON e.id = (d.result_json #>> '{raw_result,event_id}')::bigint;
  END IF;

  INSERT INTO vault_artifacts (
    tenant_id, supplier_order_id, supplier_sub_batch_id, resource_type, resource_id,
    artifact_type, content_hash, mime_type, metadata_json
  ) VALUES (
    v_tenant_id, v_supplier_order_id, v_supplier_sub_batch_id,
    'supplier_sub_batch', v_supplier_sub_batch_id::text, 'qa_report',
    v_evidence_digest, 'application/json', jsonb_build_object(
      'bid', v_bid,
      'qa_status', v_status,
      'sample_count', v_sample_count,
      'replay_checked', v_replay_checked,
      'ttstatus_checked', v_ttstatus_checked,
      'server_verified_sun_evidence', v_status = 'passed',
      'physical_ceremony_verified', false,
      'evidence_schema_version', 'supplier-qa-sun/v1',
      'evidence_digest', v_evidence_digest,
      'database_binding_digest', v_database_binding_digest,
      'qa_check_id', v_qa_check_id,
      'operation_key', v_operation_key
    )
  );

  UPDATE supplier_sub_batches AS target_sub_batch
  SET
    qa_status = v_status,
    qa_passed_at = CASE WHEN v_status = 'passed' THEN now() ELSE NULL END,
    updated_at = now()
  WHERE target_sub_batch.id = v_supplier_sub_batch_id
    AND target_sub_batch.tenant_id = v_tenant_id
    AND target_sub_batch.batch_id = v_batch_id
    AND upper(target_sub_batch.bid) = v_bid
    AND target_sub_batch.status = 'pack_ready'
    AND target_sub_batch.activated_at IS NULL
    AND target_sub_batch.qa_status <> 'passed';
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_sub_batch_state_changed';
  END IF;

  UPDATE batches
  SET qa_status = v_status
  WHERE id = v_batch_id
    AND tenant_id = v_tenant_id
    AND upper(bid) = v_bid
    AND status = 'production_registered'
    AND carrier_profile_code = v_expected_carrier_profile;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_batch_state_changed';
  END IF;

  INSERT INTO evidence_events (
    tenant_id, resource_type, resource_id, event_type, payload_json, payload_hash
  ) VALUES (
    v_tenant_id, 'supplier_sub_batch', v_supplier_sub_batch_id::text,
    CASE WHEN v_status = 'passed' THEN 'qa_passed' ELSE 'qa_failed' END,
    v_event_payload, v_event_hash
  );

  INSERT INTO audit_logs (
    actor_id, tenant_id, action, resource_type, resource_id,
    before_hash, after_hash, ip_address, user_agent, request_id
  ) VALUES (
    v_actor_id, v_tenant_id,
    CASE WHEN v_status = 'passed' THEN 'supplier_qa_passed' ELSE 'supplier_qa_failed' END,
    'supplier_sub_batch', v_supplier_sub_batch_id::text,
    NULL, encode(digest(v_event_payload::text, 'sha256'), 'hex'), NULL,
    NULLIF(left(COALESCE(p_input->>'user_agent', ''), 1024), ''),
    NULLIF(left(COALESCE(p_input->>'request_id', ''), 160), '')
  );

  RETURN QUERY SELECT
    v_qa_check_id,
    v_status,
    v_evidence_digest,
    v_event_hash,
    false;
END;
$$;

REVOKE ALL ON FUNCTION public.nexid_commit_supplier_qa_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_qa_history_append_only() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_consumed_sun_diagnostic_immutable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_consumed_sun_event_immutable() FROM PUBLIC;
