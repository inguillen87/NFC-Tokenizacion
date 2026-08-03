-- Keyless supplier QA and production activation.
--
-- Static/identifier carriers never receive fabricated SUN keys.  This
-- migration gives those carriers an evidence path of their own while leaving
-- the NTAG 424 DNA / TagTamper SUN, SDM, CMAC, replay and key-export path
-- unchanged.  Application-envelope flags below are custody boundary facts;
-- they are not managed-KMS or HSM attestations.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Migration 0085 predates the wider carrier registry.  Keep one evidence
-- table, but make the allowed profile/capture pairs explicit and fail closed.
ALTER TABLE supplier_qa_carrier_evidence_receipts
  DROP CONSTRAINT IF EXISTS supplier_qa_carrier_evidence_receipts_carrier_profile_code_chec;
ALTER TABLE supplier_qa_carrier_evidence_receipts
  DROP CONSTRAINT IF EXISTS supplier_qa_carrier_evidence_receipts_carrier_profile_code_check;
ALTER TABLE supplier_qa_carrier_evidence_receipts
  DROP CONSTRAINT IF EXISTS supplier_qa_carrier_evidence_receipts_capture_method_check;

ALTER TABLE supplier_qa_carrier_evidence_receipts
  ADD CONSTRAINT supplier_carrier_qa_profile_v2_check CHECK (
    carrier_profile_code IN (
      'qr_basic', 'gs1_digital_link', 'ntag213', 'ntag215', 'ntag216',
      'uhf_rfid', 'event_wristband', 'hotel_keycard', 'iot_tracker_placeholder'
    )
  ),
  ADD CONSTRAINT supplier_carrier_qa_capture_v2_check CHECK (
    (carrier_profile_code IN ('qr_basic', 'gs1_digital_link') AND capture_method = 'qr_camera')
    OR (carrier_profile_code IN ('ntag213', 'ntag215', 'ntag216', 'event_wristband', 'hotel_keycard') AND capture_method = 'nfc_ndef')
    OR (carrier_profile_code = 'uhf_rfid' AND capture_method = 'uhf_reader')
    OR (carrier_profile_code = 'iot_tracker_placeholder' AND capture_method = 'device_telemetry')
  );

-- A keyless production acceptance is not a SUN production session with null
-- or sentinel keys.  It is a separate immutable receipt bound to the tenant-
-- approved sampling plan, the exact carrier observations and current physical
-- Packaging Lab approval.
CREATE TABLE IF NOT EXISTS supplier_keyless_production_qa_acceptance_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_order_id uuid NOT NULL REFERENCES supplier_orders(id) ON DELETE RESTRICT,
  supplier_sub_batch_id uuid NOT NULL REFERENCES supplier_sub_batches(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  bid text NOT NULL,
  qa_check_id uuid NOT NULL UNIQUE REFERENCES supplier_qa_checks(id) ON DELETE RESTRICT,
  qa_plan_id uuid NOT NULL REFERENCES supplier_production_qa_plans(id) ON DELETE RESTRICT,
  qa_plan_decision_id uuid NOT NULL REFERENCES supplier_production_qa_plan_decisions(id) ON DELETE RESTRICT,
  packaging_lab_approval_id uuid NOT NULL REFERENCES packaging_lab_approvals(id) ON DELETE RESTRICT,
  packaging_lab_receipt_digest text NOT NULL
    CHECK (packaging_lab_receipt_digest ~ '^sha256:[0-9a-f]{64}$'),
  schema_version text NOT NULL
    CHECK (schema_version = 'supplier-keyless-production-acceptance/v1'),
  carrier_profile_code text NOT NULL CHECK (carrier_profile_code IN (
    'qr_basic', 'gs1_digital_link', 'ntag213', 'ntag215', 'ntag216',
    'uhf_rfid', 'event_wristband', 'hotel_keycard', 'iot_tracker_placeholder'
  )),
  lot_size integer NOT NULL CHECK (lot_size > 0),
  sample_size integer NOT NULL CHECK (sample_size > 0 AND sample_size <= lot_size),
  manifest_hash text NOT NULL CHECK (manifest_hash ~ '^sha256:[0-9a-f]{64}$'),
  evidence_digest text NOT NULL CHECK (evidence_digest ~ '^sha256:[0-9a-f]{64}$'),
  verification_context_digest text NOT NULL
    CHECK (verification_context_digest ~ '^sha256:[0-9a-f]{64}$'),
  key_material_mode text NOT NULL DEFAULT 'none' CHECK (key_material_mode = 'none'),
  software_envelope boolean NOT NULL DEFAULT false CHECK (software_envelope IS FALSE),
  managed_kms boolean NOT NULL DEFAULT false CHECK (managed_kms IS FALSE),
  hsm_backed boolean NOT NULL DEFAULT false CHECK (hsm_backed IS FALSE),
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  auth_session_id uuid NOT NULL REFERENCES auth_sessions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, supplier_sub_batch_id),
  UNIQUE (tenant_id, qa_plan_id),
  UNIQUE (tenant_id, qa_plan_decision_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_keyless_production_qa_scope
  ON supplier_keyless_production_qa_acceptance_receipts(
    tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, created_at DESC
  );

DROP TRIGGER IF EXISTS trg_supplier_keyless_production_qa_append_only
  ON supplier_keyless_production_qa_acceptance_receipts;
CREATE TRIGGER trg_supplier_keyless_production_qa_append_only
  BEFORE UPDATE OR DELETE ON supplier_keyless_production_qa_acceptance_receipts
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_production_qa_history_append_only_v1();

-- Existing SUN activation receipts keep all three production references.
-- Keyless receipts retain the tenant-approved plan decision but correctly have
-- no SUN production session and no SUN production-decision row.
ALTER TABLE supplier_production_activation_receipts
  ALTER COLUMN production_session_id DROP NOT NULL,
  ALTER COLUMN production_receipt_id DROP NOT NULL;

ALTER TABLE supplier_production_activation_receipts
  ADD COLUMN IF NOT EXISTS acceptance_path text GENERATED ALWAYS AS (
    CASE
      WHEN production_session_id IS NOT NULL AND production_receipt_id IS NOT NULL
        THEN 'secure_sun_v2'
      WHEN production_session_id IS NULL AND production_receipt_id IS NULL
        THEN 'keyless_carrier_v1'
      ELSE 'invalid'
    END
  ) STORED;

ALTER TABLE supplier_production_activation_receipts
  DROP CONSTRAINT IF EXISTS supplier_production_activation_acceptance_path_v1_check;
ALTER TABLE supplier_production_activation_receipts
  ADD CONSTRAINT supplier_production_activation_acceptance_path_v1_check CHECK (
    acceptance_path IN ('secure_sun_v2', 'keyless_carrier_v1')
  );

CREATE OR REPLACE FUNCTION public.nexid_supplier_keyless_qa_activation_v1_capability()
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT 'supplier-keyless-qa-activation/v1'::text
$$;

-- Preserve the 0075 SUN session gate verbatim in substance.  The only new
-- branch accepts a production carrier receipt when the carrier is explicitly
-- keyless; a deferred constraint still requires its atomic keyless acceptance
-- row before commit.
CREATE OR REPLACE FUNCTION public.nexid_supplier_qa_acceptance_scope_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $qa_scope$
DECLARE
  v_effective_purpose text;
  v_carrier_profile_code text;
  v_session record;
  v_evidence_fingerprints jsonb;
  v_expected_fingerprints jsonb;
BEGIN
  SELECT
    COALESCE(decision.to_purpose, sub_batch.pack_purpose),
    lower(batch.carrier_profile_code)
  INTO v_effective_purpose, v_carrier_profile_code
  FROM supplier_sub_batches sub_batch
  JOIN supplier_orders order_row
    ON order_row.id = sub_batch.supplier_order_id
   AND order_row.tenant_id = sub_batch.tenant_id
   AND order_row.pack_purpose = sub_batch.pack_purpose
  JOIN batches batch
    ON batch.id = sub_batch.batch_id
   AND batch.tenant_id = sub_batch.tenant_id
   AND upper(batch.bid) = upper(sub_batch.bid)
   AND batch.supplier_order_id = sub_batch.supplier_order_id
   AND batch.supplier_sub_batch_id = sub_batch.id
  LEFT JOIN supplier_pack_purpose_decisions decision
    ON decision.supplier_order_id = sub_batch.supplier_order_id
   AND decision.tenant_id = sub_batch.tenant_id
  WHERE sub_batch.id = NEW.supplier_sub_batch_id
    AND sub_batch.supplier_order_id = NEW.supplier_order_id
    AND sub_batch.tenant_id = NEW.tenant_id
    AND sub_batch.batch_id = NEW.batch_id
    AND upper(sub_batch.bid) = upper(NEW.bid)
  LIMIT 1;
  IF NOT FOUND OR v_effective_purpose IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_pack_purpose_scope_invalid';
  END IF;

  NEW.acceptance_scope := CASE
    WHEN v_effective_purpose = 'trial_integration' THEN 'trial_integration'
    WHEN v_effective_purpose = 'production' THEN 'production_lot'
    ELSE 'legacy_unclassified'
  END;
  IF NEW.status = 'passed' AND v_effective_purpose = 'legacy_unclassified' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_pack_purpose_unclassified';
  END IF;
  IF NEW.status <> 'passed' OR v_effective_purpose <> 'production' THEN
    RETURN NEW;
  END IF;

  IF v_carrier_profile_code NOT IN ('ntag424_dna', 'ntag424_dna_tt') THEN
    IF v_carrier_profile_code NOT IN (
      'qr_basic', 'gs1_digital_link', 'ntag213', 'ntag215', 'ntag216',
      'uhf_rfid', 'event_wristband', 'hotel_keycard', 'iot_tracker_placeholder'
    )
      OR COALESCE(NEW.evidence_json->>'schema_version', '') <> 'supplier-qa-carrier/v1'
      OR COALESCE(NEW.evidence_json->>'pack_purpose', '') <> 'production'
      OR COALESCE(NEW.evidence_json->>'acceptance_scope', '') <> 'production_lot'
      OR COALESCE(NEW.evidence_json->>'key_material_mode', '') <> 'none'
      OR COALESCE(NEW.evidence_json->>'software_envelope', '') <> 'false'
      OR COALESCE(NEW.evidence_json->>'managed_kms', '') <> 'false'
      OR COALESCE(NEW.evidence_json->>'hsm_backed', '') <> 'false'
      OR COALESCE(NEW.evidence_json->>'packaging_lab_approval_verified', '') <> 'true'
      OR COALESCE(NEW.evidence_json->>'physical_ceremony_verified', '') <> 'false'
      OR NEW.evidence_json ? 'production_session_id' THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_keyless_production_qa_evidence_invalid';
    END IF;
    RETURN NEW;
  END IF;

  -- Secure SUN path from 0075: do not broaden or reinterpret it.
  IF COALESCE(NEW.evidence_json->>'production_session_id', '') !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_production_acceptance_v2_required';
  END IF;
  SELECT session_row.* INTO v_session
  FROM supplier_production_qa_sessions session_row
  LEFT JOIN supplier_production_qa_decisions decision_row ON decision_row.session_id = session_row.id
  WHERE session_row.id = (NEW.evidence_json->>'production_session_id')::uuid
    AND session_row.tenant_id = NEW.tenant_id
    AND session_row.supplier_order_id = NEW.supplier_order_id
    AND session_row.supplier_sub_batch_id = NEW.supplier_sub_batch_id
    AND session_row.batch_id = NEW.batch_id
    AND upper(session_row.bid) = upper(NEW.bid)
    AND session_row.expires_at >= now()
    AND decision_row.id IS NULL
  FOR SHARE OF session_row;
  IF NOT FOUND
    OR COALESCE(NEW.evidence_json->>'acceptance_scope', '') <> 'production_lot'
    OR COALESCE(NEW.evidence_json->>'production_acceptance_schema_version', '') <> 'supplier-production-acceptance/v2'
    OR lower(COALESCE(NEW.evidence_json->>'production_policy_digest', '')) IS DISTINCT FROM v_session.policy_digest
    OR lower(COALESCE(NEW.evidence_json->>'production_selection_digest', '')) IS DISTINCT FROM v_session.selection_digest
    OR lower(COALESCE(NEW.evidence_json->>'production_acceptance_context_digest', '')) IS DISTINCT FROM v_session.acceptance_context_digest THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_production_session_invalid';
  END IF;
  SELECT COALESCE(jsonb_agg(value ORDER BY value), '[]'::jsonb)
    INTO v_evidence_fingerprints
  FROM jsonb_array_elements_text(COALESCE(NEW.evidence_json->'batch_scoped_uid_fingerprints', '[]'::jsonb)) item(value);
  SELECT COALESCE(jsonb_agg(sample.uid_fingerprint ORDER BY sample.uid_fingerprint), '[]'::jsonb)
    INTO v_expected_fingerprints
  FROM supplier_production_qa_session_samples sample
  WHERE sample.session_id = v_session.id
    AND sample.cryptographic_required;
  IF v_evidence_fingerprints IS DISTINCT FROM v_expected_fingerprints THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_production_sample_mismatch';
  END IF;
  RETURN NEW;
END;
$qa_scope$;

CREATE OR REPLACE FUNCTION public.nexid_supplier_production_qa_decision_required_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $decision_required$
BEGIN
  IF NEW.status = 'passed' AND NEW.acceptance_scope = 'production_lot'
    AND NOT EXISTS (
      SELECT 1
      FROM supplier_production_qa_decisions decision_row
      WHERE decision_row.qa_check_id = NEW.id
        AND decision_row.tenant_id = NEW.tenant_id
        AND decision_row.supplier_order_id = NEW.supplier_order_id
        AND decision_row.supplier_sub_batch_id = NEW.supplier_sub_batch_id
        AND decision_row.batch_id = NEW.batch_id
        AND decision_row.status = 'passed'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM supplier_keyless_production_qa_acceptance_receipts keyless_receipt
      WHERE keyless_receipt.qa_check_id = NEW.id
        AND keyless_receipt.tenant_id = NEW.tenant_id
        AND keyless_receipt.supplier_order_id = NEW.supplier_order_id
        AND keyless_receipt.supplier_sub_batch_id = NEW.supplier_sub_batch_id
        AND keyless_receipt.batch_id = NEW.batch_id
        AND upper(keyless_receipt.bid) = upper(NEW.bid)
        AND keyless_receipt.schema_version = 'supplier-keyless-production-acceptance/v1'
        AND keyless_receipt.key_material_mode = 'none'
        AND keyless_receipt.software_envelope IS FALSE
        AND keyless_receipt.managed_kms IS FALSE
        AND keyless_receipt.hsm_backed IS FALSE
    ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_atomic_decision_required';
  END IF;
  RETURN NULL;
END;
$decision_required$;

CREATE OR REPLACE FUNCTION public.nexid_commit_supplier_carrier_qa_v1(p_input jsonb)
RETURNS TABLE (
  qa_check_id uuid,
  qa_status text,
  evidence_digest text,
  evidence_event_hash text,
  idempotent_replay boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $commit_carrier_qa$
DECLARE
  v_tenant_id uuid;
  v_supplier_order_id uuid;
  v_supplier_sub_batch_id uuid;
  v_batch_id uuid;
  v_actor_id uuid;
  v_auth_session_id uuid;
  v_bid text;
  v_actor_email text;
  v_operation_key text;
  v_notes text;
  v_sample_count integer;
  v_expected_profile text;
  v_expected_manifest_hash text;
  v_expected_context_digest text;
  v_expected_context_binding jsonb;
  v_expected_context_canonical text;
  v_expected_sdm_config jsonb;
  v_evidence jsonb;
  v_evidence_digest text;
  v_rows jsonb;
  v_scope record;
  v_plan record;
  v_lab record;
  v_existing record;
  v_tag record;
  v_identity record;
  v_row jsonb;
  v_target_binding jsonb;
  v_locked_target_binding jsonb;
  v_carrier_binding jsonb;
  v_context_binding jsonb;
  v_context_canonical text;
  v_context_digest text;
  v_carrier_digest text;
  v_uid_fingerprint text;
  v_target_binding_digest text;
  v_observation_digest text;
  v_gs1_identity_id uuid;
  v_expected_observation_receipts jsonb := '[]'::jsonb;
  v_expected_uid_fingerprints jsonb := '[]'::jsonb;
  v_seen_tag_ids uuid[] := ARRAY[]::uuid[];
  v_previous_uid_fingerprint text := '';
  v_request_fingerprint text;
  v_database_binding_digest text;
  v_event_payload jsonb;
  v_event_hash text;
  v_notes_digest text;
  v_qa_check_id uuid;
  v_updated_count integer;
  v_receipt_count integer;
  v_acceptance_scope text;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR octet_length(p_input::text) > 4194304 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_input_invalid';
  END IF;
  BEGIN
    v_tenant_id := NULLIF(trim(p_input->>'tenant_id'), '')::uuid;
    v_supplier_order_id := NULLIF(trim(p_input->>'supplier_order_id'), '')::uuid;
    v_supplier_sub_batch_id := NULLIF(trim(p_input->>'supplier_sub_batch_id'), '')::uuid;
    v_batch_id := NULLIF(trim(p_input->>'batch_id'), '')::uuid;
    v_actor_id := NULLIF(trim(p_input->>'actor_id'), '')::uuid;
    v_auth_session_id := NULLIF(trim(p_input->>'auth_session_id'), '')::uuid;
    v_sample_count := NULLIF(trim(p_input->>'sample_count'), '')::integer;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_identity_invalid';
  END;

  v_bid := upper(trim(COALESCE(p_input->>'bid', '')));
  v_actor_email := lower(trim(COALESCE(p_input->>'actor_email', '')));
  v_operation_key := trim(COALESCE(p_input->>'operation_key', ''));
  v_notes := NULLIF(trim(COALESCE(p_input->>'notes', '')), '');
  v_expected_profile := lower(trim(COALESCE(p_input->>'expected_carrier_profile_code', '')));
  v_expected_manifest_hash := lower(trim(COALESCE(p_input->>'expected_manifest_hash', '')));
  v_expected_context_digest := lower(trim(COALESCE(p_input->>'expected_verification_context_digest', '')));
  v_expected_context_binding := p_input->'expected_verification_context_binding';
  v_expected_context_canonical := COALESCE(p_input->>'expected_verification_context_canonical', '');
  v_expected_sdm_config := COALESCE(p_input->'expected_sdm_config', '{}'::jsonb);
  v_evidence := COALESCE(p_input->'evidence_json', '{}'::jsonb);
  v_evidence_digest := lower(trim(COALESCE(p_input->>'evidence_digest', '')));
  v_rows := COALESCE(p_input->'carrier_evidence_rows', '[]'::jsonb);

  IF v_tenant_id IS NULL OR v_supplier_order_id IS NULL OR v_supplier_sub_batch_id IS NULL
    OR v_batch_id IS NULL OR v_actor_id IS NULL OR v_auth_session_id IS NULL
    OR v_bid = '' OR v_sample_count IS NULL OR v_sample_count NOT BETWEEN 1 AND 5000
    OR v_actor_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR char_length(v_actor_email) > 320
    OR v_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
    OR COALESCE(p_input->>'status', '') <> 'passed'
    OR COALESCE(p_input->>'replay_checked', '') <> 'false'
    OR COALESCE(p_input->>'ttstatus_checked', '') <> 'false'
    OR v_expected_profile NOT IN (
      'qr_basic', 'gs1_digital_link', 'ntag213', 'ntag215', 'ntag216',
      'uhf_rfid', 'event_wristband', 'hotel_keycard', 'iot_tracker_placeholder'
    )
    OR NULLIF(trim(COALESCE(p_input->>'expected_key_fingerprint', '')), '') IS NOT NULL
    OR v_expected_manifest_hash !~ '^sha256:[0-9a-f]{64}$'
    OR v_expected_context_digest !~ '^sha256:[0-9a-f]{64}$'
    OR v_evidence_digest !~ '^sha256:[0-9a-f]{64}$'
    OR jsonb_typeof(v_expected_context_binding) IS DISTINCT FROM 'object'
    OR jsonb_typeof(v_expected_sdm_config) IS DISTINCT FROM 'object'
    OR jsonb_typeof(v_evidence) IS DISTINCT FROM 'object'
    OR jsonb_typeof(v_rows) IS DISTINCT FROM 'array'
    OR jsonb_array_length(v_rows) <> v_sample_count THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_contract_invalid';
  END IF;
  IF v_notes IS NOT NULL AND char_length(v_notes) > 2000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_notes_too_long';
  END IF;
  IF NOT public.nexid_audit_freeform_is_safe_v1(v_notes) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_sensitive_audit_input_rejected';
  END IF;
  IF public.nexid_supplier_qa_canonical_json_v2(v_expected_context_binding)
      IS DISTINCT FROM v_expected_context_canonical
    OR ('sha256:' || encode(digest(convert_to(v_expected_context_canonical, 'UTF8'), 'sha256'), 'hex'))
      IS DISTINCT FROM v_expected_context_digest THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_verification_context_invalid';
  END IF;

  -- Every invocation, including an idempotent replay, is tied to a current
  -- human session.  The shared 0087 resolver honors explicit deny precedence.
  IF NOT public.nexid_packaging_lab_actor_authorized_v1(
    v_tenant_id, v_actor_id, v_auth_session_id, 'qa.approve'
  ) OR NOT EXISTS (
    SELECT 1 FROM users actor
    WHERE actor.id = v_actor_id
      AND lower(actor.email) = v_actor_email
      AND actor.admin_status::text = 'active'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'supplier_carrier_qa_actor_scope_invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_rows) carrier_row(value)
    WHERE jsonb_typeof(carrier_row.value) IS DISTINCT FROM 'object'
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(carrier_row.value) supplied_key(key)
        WHERE supplied_key.key NOT IN (
          'tag_id', 'carrier_profile_code', 'capture_method', 'captured_at',
          'uid_fingerprint', 'encoded_url_hash', 'target_binding',
          'target_binding_digest', 'observation_digest', 'gs1_identity_id'
        )
      )
      OR COALESCE(carrier_row.value->>'tag_id', '') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      OR COALESCE(carrier_row.value->>'carrier_profile_code', '') <> v_expected_profile
      OR COALESCE(carrier_row.value->>'captured_at', '') !~
        '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
      OR COALESCE(carrier_row.value->>'uid_fingerprint', '') !~ '^sha256:[0-9a-f]{64}$'
      OR COALESCE(carrier_row.value->>'encoded_url_hash', '') !~ '^sha256:[0-9a-f]{64}$'
      OR jsonb_typeof(carrier_row.value->'target_binding') IS DISTINCT FROM 'object'
      OR COALESCE(carrier_row.value->>'target_binding_digest', '') !~ '^sha256:[0-9a-f]{64}$'
      OR COALESCE(carrier_row.value->>'observation_digest', '') !~ '^sha256:[0-9a-f]{64}$'
      OR (v_expected_profile IN ('qr_basic', 'gs1_digital_link') AND carrier_row.value->>'capture_method' <> 'qr_camera')
      OR (v_expected_profile IN ('ntag213', 'ntag215', 'ntag216', 'event_wristband', 'hotel_keycard') AND carrier_row.value->>'capture_method' <> 'nfc_ndef')
      OR (v_expected_profile = 'uhf_rfid' AND carrier_row.value->>'capture_method' <> 'uhf_reader')
      OR (v_expected_profile = 'iot_tracker_placeholder' AND carrier_row.value->>'capture_method' <> 'device_telemetry')
      OR (
        carrier_row.value->>'gs1_identity_id' IS NOT NULL
        AND carrier_row.value->>'gs1_identity_id' !~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_evidence_rows_invalid';
  END IF;

  IF COALESCE(v_evidence->>'schema_version', '') <> 'supplier-qa-carrier/v1'
    OR COALESCE(v_evidence->>'evidence_source', '') <> 'server_validated_operator_capture'
    OR COALESCE(v_evidence->>'assurance_scope', '') <> 'manifest_and_carrier_encoding_binding'
    OR COALESCE(v_evidence->>'carrier_profile_code', '') <> v_expected_profile
    OR COALESCE(v_evidence->>'sample_count', '') <> v_sample_count::text
    OR lower(COALESCE(v_evidence->>'manifest_hash', '')) <> v_expected_manifest_hash
    OR lower(COALESCE(v_evidence->>'verification_context_digest', '')) <> v_expected_context_digest
    OR COALESCE(v_evidence->>'manifest_uid_binding_verified', '') <> 'true'
    OR COALESCE(v_evidence->>'carrier_encoding_binding_verified', '') <> 'true'
    OR COALESCE(v_evidence->>'server_verified_sun_evidence', '') <> 'false'
    OR COALESCE(v_evidence->>'cryptographic_authentication_verified', '') <> 'false'
    OR COALESCE(v_evidence->>'anti_replay_verified', '') <> 'false'
    OR COALESCE(v_evidence->>'ttstatus_verified', '') <> 'false'
    OR COALESCE(v_evidence->>'physical_ceremony_verified', '') <> 'false'
    OR COALESCE(v_evidence->>'requires_secure_sun', '') <> 'false'
    OR COALESCE(v_evidence->>'key_material_mode', '') <> 'none'
    OR COALESCE(v_evidence->>'software_envelope', '') <> 'false'
    OR COALESCE(v_evidence->>'managed_kms', '') <> 'false'
    OR COALESCE(v_evidence->>'hsm_backed', '') <> 'false'
    OR COALESCE(v_evidence->>'activation_allowed', '') <> 'false'
    OR COALESCE(v_evidence->>'operation_key', '') <> v_operation_key
    OR lower(COALESCE(v_evidence->>'evidence_digest', '')) <> v_evidence_digest
    OR jsonb_typeof(v_evidence->'batch_scoped_uid_fingerprints') IS DISTINCT FROM 'array'
    OR jsonb_typeof(v_evidence->'observation_receipts') IS DISTINCT FROM 'array'
    OR jsonb_typeof(v_evidence->'claim_limitations') IS DISTINCT FROM 'array'
    OR v_evidence->'claim_limitations' IS DISTINCT FROM jsonb_build_array(
      'static_identifiers_can_be_copied',
      'no_cryptographic_tag_authentication',
      'no_anti_replay_guarantee',
      'no_tamper_state_attestation',
      'operator_capture_is_not_physical_presence_attestation'
    )
    OR ('sha256:' || encode(digest(convert_to(
      public.nexid_supplier_qa_canonical_json_v2(v_evidence - 'evidence_digest'),
      'UTF8'
    ), 'sha256'), 'hex')) IS DISTINCT FROM v_evidence_digest THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_evidence_envelope_invalid';
  END IF;

  v_request_fingerprint := encode(digest(convert_to(
    public.nexid_supplier_qa_canonical_json_v2(jsonb_build_object(
      'tenant_id', lower(v_tenant_id::text),
      'supplier_order_id', lower(v_supplier_order_id::text),
      'supplier_sub_batch_id', lower(v_supplier_sub_batch_id::text),
      'batch_id', lower(v_batch_id::text),
      'bid', v_bid,
      'sample_count', v_sample_count,
      'notes', v_notes,
      'evidence_json', v_evidence,
      'carrier_evidence_rows', v_rows,
      'actor_id', lower(v_actor_id::text),
      'auth_session_id', lower(v_auth_session_id::text),
      'verification_context_digest', v_expected_context_digest
    )), 'UTF8'
  ), 'sha256'), 'hex');

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'supplier-carrier-qa-operation' || chr(31) || v_tenant_id::text || chr(31) || v_operation_key, 0
  ));
  SELECT
    qa.id, qa.status, qa.request_fingerprint, qa.evidence_json, qa.event_hash,
    context_receipt.context_digest, context_receipt.context_binding,
    context_receipt.canonical_payload,
    (SELECT count(*)::integer FROM supplier_qa_carrier_evidence_receipts evidence_receipt
      WHERE evidence_receipt.qa_check_id = qa.id) AS carrier_receipt_count
  INTO v_existing
  FROM supplier_qa_checks qa
  LEFT JOIN supplier_qa_verification_context_receipts context_receipt
    ON context_receipt.qa_check_id = qa.id AND context_receipt.tenant_id = qa.tenant_id
  WHERE qa.tenant_id = v_tenant_id AND qa.operation_key = v_operation_key
  LIMIT 1;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.request_fingerprint IS DISTINCT FROM v_request_fingerprint
      OR v_existing.context_digest IS DISTINCT FROM v_expected_context_digest
      OR v_existing.context_binding IS DISTINCT FROM v_expected_context_binding
      OR v_existing.canonical_payload IS DISTINCT FROM v_expected_context_canonical
      OR v_existing.carrier_receipt_count IS DISTINCT FROM v_sample_count THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'supplier_carrier_qa_idempotency_key_conflict';
    END IF;
    RETURN QUERY SELECT v_existing.id, v_existing.status,
      COALESCE(v_existing.evidence_json->>'evidence_digest', ''),
      COALESCE(v_existing.event_hash, ''), true;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'supplier-pack-purpose' || chr(31) || v_supplier_order_id::text, 0
  ));
  SELECT
    sub_batch.status::text AS supplier_sub_batch_status,
    sub_batch.qa_status,
    sub_batch.manifest_status,
    lower(sub_batch.manifest_hash) AS manifest_hash,
    sub_batch.manifest_count,
    sub_batch.manifest_imported_at,
    sub_batch.expected_quantity,
    sub_batch.activated_at,
    sub_batch.key_export_count,
    sub_batch.key_exported_at,
    sub_batch.metadata_json,
    batch.status::text AS batch_status,
    lower(batch.carrier_profile_code) AS batch_carrier_profile,
    batch.sdm_config,
    batch.meta_key_ct,
    batch.file_key_ct,
    upper(batch.bid) AS bid,
    lower(supplier_order.carrier_profile_code) AS order_carrier_profile,
    lower(supplier_order.packaging_governance_status) AS packaging_governance_status,
    supplier_order.packaging_spec_revision,
    lower(supplier_order.packaging_spec_hash) AS packaging_spec_hash,
    lower(COALESCE(purpose_decision.to_purpose, supplier_order.pack_purpose)) AS effective_pack_purpose,
    lower(tenant.slug) AS tenant_slug,
    EXISTS (
      SELECT 1 FROM supplier_packaging_governance_decisions decision
      WHERE decision.supplier_order_id = supplier_order.id
        AND decision.tenant_id = supplier_order.tenant_id
        AND decision.spec_revision = supplier_order.packaging_spec_revision
        AND decision.decision_status = 'approved'
        AND decision.carrier_profile_code = supplier_order.carrier_profile_code
        AND decision.spec_hash = supplier_order.packaging_spec_hash
        AND decision.spec_snapshot = supplier_order.packaging_spec_snapshot
        AND decision.evidence_refs = supplier_order.packaging_evidence_refs
        AND decision.validation_snapshot = supplier_order.packaging_validation_snapshot
        AND decision.decided_by = supplier_order.packaging_approved_by
        AND decision.decided_at = supplier_order.packaging_approved_at
    ) AS packaging_governance_receipt_valid,
    (SELECT count(*)::integer FROM batch_keys unexpected_key
      WHERE unexpected_key.supplier_sub_batch_id = sub_batch.id
         OR unexpected_key.batch_id = batch.id
         OR (unexpected_key.tenant_id = sub_batch.tenant_id AND upper(unexpected_key.bid) = upper(sub_batch.bid))) AS batch_key_count,
    (SELECT count(*)::integer FROM batch_key_material unexpected_material
      WHERE unexpected_material.supplier_sub_batch_id = sub_batch.id
         OR unexpected_material.batch_id = batch.id
         OR (unexpected_material.tenant_id = sub_batch.tenant_id AND upper(unexpected_material.bid) = upper(sub_batch.bid))) AS batch_key_material_count,
    EXISTS (
      SELECT 1 FROM evidence_events pack_event
      WHERE pack_event.tenant_id = sub_batch.tenant_id
        AND pack_event.resource_type = 'supplier_sub_batch'
        AND pack_event.resource_id = sub_batch.id::text
        AND pack_event.event_type = 'supplier_pack_exported'
        AND pack_event.payload_json->>'key_material_mode' = 'none'
        AND pack_event.payload_json->>'activation_allowed' = 'false'
        AND lower(COALESCE(pack_event.payload_json->>'manifest_template_sha256', '')) ~ '^sha256:[0-9a-f]{64}$'
    ) AS keyless_pack_event_valid,
    EXISTS (
      SELECT 1 FROM vault_artifacts manifest_artifact
      WHERE manifest_artifact.tenant_id = sub_batch.tenant_id
        AND manifest_artifact.supplier_order_id = sub_batch.supplier_order_id
        AND manifest_artifact.supplier_sub_batch_id = sub_batch.id
        AND manifest_artifact.artifact_type = 'supplier_manifest_template_csv'
        AND manifest_artifact.metadata_json->>'key_material_mode' = 'none'
        AND manifest_artifact.content_hash ~ '^sha256:[0-9a-f]{64}$'
    ) AS keyless_manifest_artifact_valid
  INTO v_scope
  FROM supplier_sub_batches sub_batch
  JOIN supplier_orders supplier_order
    ON supplier_order.id = sub_batch.supplier_order_id
   AND supplier_order.tenant_id = sub_batch.tenant_id
  JOIN tenants tenant ON tenant.id = sub_batch.tenant_id
  JOIN batches batch
    ON batch.id = sub_batch.batch_id
   AND batch.tenant_id = sub_batch.tenant_id
   AND batch.supplier_order_id = sub_batch.supplier_order_id
   AND batch.supplier_sub_batch_id = sub_batch.id
   AND upper(batch.bid) = upper(sub_batch.bid)
  LEFT JOIN supplier_pack_purpose_decisions purpose_decision
    ON purpose_decision.supplier_order_id = supplier_order.id
   AND purpose_decision.tenant_id = supplier_order.tenant_id
  WHERE sub_batch.id = v_supplier_sub_batch_id
    AND sub_batch.supplier_order_id = v_supplier_order_id
    AND sub_batch.batch_id = v_batch_id
    AND sub_batch.tenant_id = v_tenant_id
    AND upper(sub_batch.bid) = v_bid
  FOR UPDATE OF sub_batch, supplier_order, batch;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'supplier_carrier_qa_scope_not_found';
  END IF;

  v_acceptance_scope := CASE v_scope.effective_pack_purpose
    WHEN 'trial_integration' THEN 'trial_integration'
    WHEN 'production' THEN 'production_lot'
    ELSE NULL
  END;
  IF v_acceptance_scope IS NULL
    OR lower(COALESCE(v_scope.supplier_sub_batch_status, '')) <> 'pack_ready'
    OR lower(COALESCE(v_scope.batch_status, '')) <> 'production_registered'
    OR v_scope.activated_at IS NOT NULL
    OR lower(COALESCE(v_scope.qa_status, '')) = 'passed'
    OR v_scope.batch_carrier_profile IS DISTINCT FROM v_expected_profile
    OR v_scope.order_carrier_profile IS DISTINCT FROM v_expected_profile
    OR v_scope.manifest_hash IS DISTINCT FROM v_expected_manifest_hash
    OR v_scope.sdm_config IS DISTINCT FROM v_expected_sdm_config
    OR lower(COALESCE(v_scope.manifest_status, '')) <> 'imported'
    OR v_scope.manifest_count IS DISTINCT FROM v_scope.expected_quantity
    OR lower(COALESCE(v_scope.packaging_governance_status, '')) <> 'approved'
    OR COALESCE(v_scope.packaging_spec_revision, 0) <= 0
    OR COALESCE(v_scope.packaging_spec_hash, '') !~ '^sha256:[0-9a-f]{64}$'
    OR v_scope.packaging_governance_receipt_valid IS DISTINCT FROM true
    OR v_scope.key_export_count IS DISTINCT FROM 1
    OR v_scope.key_exported_at IS NULL
    OR v_scope.meta_key_ct IS NOT NULL
    OR v_scope.file_key_ct IS NOT NULL
    OR v_scope.batch_key_count <> 0
    OR v_scope.batch_key_material_count <> 0
    OR COALESCE(v_scope.metadata_json->>'key_material_mode', '') <> 'none'
    OR COALESCE(v_scope.metadata_json->>'software_envelope', '') <> 'false'
    OR COALESCE(v_scope.metadata_json->>'managed_kms', '') <> 'false'
    OR COALESCE(v_scope.metadata_json->>'hsm_backed', '') <> 'false'
    OR v_scope.keyless_pack_event_valid IS DISTINCT FROM true
    OR v_scope.keyless_manifest_artifact_valid IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_keyless_scope_invalid';
  END IF;

  IF v_acceptance_scope = 'trial_integration' THEN
    IF v_sample_count IS DISTINCT FROM LEAST(10, v_scope.expected_quantity)
      OR COALESCE(v_evidence->>'pack_purpose', '') <> 'trial_integration'
      OR COALESCE(v_evidence->>'acceptance_scope', '') <> 'trial_integration'
      OR COALESCE(v_evidence->>'commercial_disposition', '') <> 'NON_SELLABLE'
      OR COALESCE(v_evidence->>'packaging_lab_approval_verified', '') <> 'false' THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_trial_evidence_invalid';
    END IF;
  ELSE
    SELECT
      plan.id AS qa_plan_id,
      plan.sample_size,
      plan.lot_size,
      plan.plan_digest,
      plan_decision.id AS qa_plan_decision_id
    INTO v_plan
    FROM supplier_production_qa_plans plan
    JOIN supplier_production_qa_plan_decisions plan_decision
      ON plan_decision.plan_id = plan.id
     AND plan_decision.tenant_id = plan.tenant_id
     AND plan_decision.supplier_order_id = plan.supplier_order_id
     AND plan_decision.supplier_sub_batch_id = plan.supplier_sub_batch_id
     AND plan_decision.batch_id = plan.batch_id
     AND upper(plan_decision.bid) = upper(plan.bid)
     AND plan_decision.schema_version = 'supplier-production-qa-plan-decision/v1'
     AND plan_decision.decision_status = 'approved'
     AND plan_decision.approver_role = 'tenant_admin'
     AND plan_decision.plan_digest = plan.plan_digest
     AND plan_decision.decided_at <= now()
    WHERE plan.tenant_id = v_tenant_id
      AND plan.supplier_order_id = v_supplier_order_id
      AND plan.supplier_sub_batch_id = v_supplier_sub_batch_id
      AND plan.batch_id = v_batch_id
      AND upper(plan.bid) = v_bid
      AND plan.schema_version = 'supplier-production-qa-plan/v1'
      AND plan.lot_size = v_scope.expected_quantity
      AND NOT EXISTS (
        SELECT 1 FROM supplier_production_qa_plans newer_plan
        WHERE newer_plan.tenant_id = plan.tenant_id
          AND newer_plan.supplier_sub_batch_id = plan.supplier_sub_batch_id
          AND newer_plan.revision > plan.revision
      )
    FOR SHARE OF plan, plan_decision;
    IF NOT FOUND OR v_plan.sample_size IS DISTINCT FROM v_sample_count THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_keyless_production_qa_plan_required';
    END IF;

    SELECT * INTO v_lab
    FROM public.nexid_packaging_lab_activation_receipt_v1(v_batch_id);
    IF NOT FOUND
      OR v_lab.tenant_id IS DISTINCT FROM v_tenant_id
      OR v_lab.supplier_order_id IS DISTINCT FROM v_supplier_order_id
      OR v_lab.supplier_sub_batch_id IS DISTINCT FROM v_supplier_sub_batch_id
      OR v_lab.batch_id IS DISTINCT FROM v_batch_id THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_keyless_production_physical_evidence_required';
    END IF;
    IF COALESCE(v_evidence->>'pack_purpose', '') <> 'production'
      OR COALESCE(v_evidence->>'acceptance_scope', '') <> 'production_lot'
      OR COALESCE(v_evidence->>'commercial_disposition', '') <> 'BLOCKED_PENDING_ACTIVATION'
      OR COALESCE(v_evidence->>'packaging_lab_approval_verified', '') <> 'true'
      OR lower(COALESCE(v_evidence->>'production_qa_plan_digest', '')) IS DISTINCT FROM v_plan.plan_digest
      OR COALESCE(v_evidence->>'production_qa_plan_id', '') IS DISTINCT FROM v_plan.qa_plan_id::text
      OR COALESCE(v_evidence->>'production_qa_plan_decision_id', '') IS DISTINCT FROM v_plan.qa_plan_decision_id::text
      OR COALESCE(v_evidence->>'packaging_lab_approval_id', '') IS DISTINCT FROM v_lab.approval_id::text
      OR lower(COALESCE(v_evidence->>'packaging_lab_receipt_digest', '')) IS DISTINCT FROM v_lab.receipt_digest THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_keyless_production_qa_evidence_invalid';
    END IF;
  END IF;

  v_carrier_binding := jsonb_build_object(
    'carrier_profile_code', v_scope.batch_carrier_profile,
    'sdm_config', v_expected_sdm_config
  );
  v_carrier_digest := 'sha256:' || encode(digest(convert_to(
    public.nexid_supplier_qa_canonical_json_v2(v_carrier_binding), 'UTF8'
  ), 'sha256'), 'hex');
  v_context_binding := jsonb_build_object(
    'domain', 'nexid:supplier-qa:verification-context',
    'schema_version', 'v2',
    'tenant_id', lower(v_tenant_id::text),
    'batch_id', lower(v_batch_id::text),
    'bid', v_scope.bid,
    'manifest_hash', v_scope.manifest_hash,
    'carrier_profile_code', v_scope.batch_carrier_profile,
    'key_fingerprint', NULL,
    'key_material_mode', 'none',
    'software_envelope', false,
    'managed_kms', false,
    'hsm_backed', false,
    'carrier_config_digest', v_carrier_digest,
    'supplier_order_id', lower(v_supplier_order_id::text),
    'supplier_sub_batch_id', lower(v_supplier_sub_batch_id::text),
    'supplier_sub_batch_status', NULLIF(lower(v_scope.supplier_sub_batch_status), ''),
    'batch_status', NULLIF(lower(v_scope.batch_status), ''),
    'key_export_count', v_scope.key_export_count,
    'key_exported_at', to_char(v_scope.key_exported_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'batch_key_export_count', 0,
    'batch_key_exported_at', NULL,
    'packaging_governance_status', NULLIF(v_scope.packaging_governance_status, ''),
    'packaging_spec_revision', v_scope.packaging_spec_revision,
    'packaging_spec_hash', NULLIF(v_scope.packaging_spec_hash, ''),
    'pack_purpose', v_scope.effective_pack_purpose,
    'acceptance_scope', v_acceptance_scope
  );
  v_context_canonical := public.nexid_supplier_qa_canonical_json_v2(v_context_binding);
  v_context_digest := 'sha256:' || encode(digest(convert_to(v_context_canonical, 'UTF8'), 'sha256'), 'hex');
  IF v_expected_context_binding IS DISTINCT FROM v_context_binding
    OR v_expected_context_canonical IS DISTINCT FROM v_context_canonical
    OR v_expected_context_digest IS DISTINCT FROM v_context_digest
    OR lower(COALESCE(v_evidence->>'carrier_config_digest', '')) IS DISTINCT FROM v_carrier_digest THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_verification_context_changed';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(v_rows) LOOP
    v_gs1_identity_id := NULL;
    IF v_previous_uid_fingerprint <> ''
      AND v_previous_uid_fingerprint COLLATE "C" >= (v_row->>'uid_fingerprint') COLLATE "C" THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_evidence_rows_invalid';
    END IF;
    v_previous_uid_fingerprint := v_row->>'uid_fingerprint';
    IF (v_row->>'tag_id')::uuid = ANY(v_seen_tag_ids) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_evidence_rows_invalid';
    END IF;
    v_seen_tag_ids := array_append(v_seen_tag_ids, (v_row->>'tag_id')::uuid);

    SELECT tag.id, upper(tag.uid_hex) AS uid_hex INTO v_tag
    FROM tags tag
    WHERE tag.id = (v_row->>'tag_id')::uuid AND tag.batch_id = v_batch_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_tag_binding_invalid';
    END IF;
    v_uid_fingerprint := 'sha256:' || encode(digest(
      convert_to(v_bid, 'UTF8') || decode('00', 'hex') || convert_to(v_tag.uid_hex, 'UTF8'), 'sha256'
    ), 'hex');
    IF v_row->>'uid_fingerprint' IS DISTINCT FROM v_uid_fingerprint
      OR (v_row->>'captured_at')::timestamptz < GREATEST(v_scope.manifest_imported_at, now() - interval '72 hours')
      OR (v_row->>'captured_at')::timestamptz > now() + interval '1 minute' THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_tag_binding_invalid';
    END IF;

    v_target_binding := v_row->'target_binding';
    IF v_expected_profile = 'gs1_digital_link' THEN
      IF v_row->>'gs1_identity_id' IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_gs1_registry_binding_invalid';
      END IF;
      SELECT identity.id, identity.gtin, identity.lot, identity.serial INTO v_identity
      FROM gs1_digital_link_identities identity
      JOIN gs1_gtin_prefix_entitlements entitlement
        ON entitlement.id = identity.entitlement_id
       AND entitlement.tenant_id = identity.tenant_id
       AND entitlement.status = 'active'
       AND identity.gtin LIKE entitlement.canonical_gtin_prefix || '%'
      WHERE identity.id = (v_row->>'gs1_identity_id')::uuid
        AND identity.tenant_id = v_tenant_id
        AND identity.batch_id = v_batch_id
        AND identity.tag_id = v_tag.id
        AND identity.status = 'active'
      FOR UPDATE OF identity;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_gs1_registry_binding_invalid';
      END IF;
      v_gs1_identity_id := v_identity.id;
      v_locked_target_binding := jsonb_build_object(
        'kind', 'gs1_digital_link',
        'public_origin', v_evidence->>'public_origin',
        'gtin', v_identity.gtin,
        'lot', v_identity.lot,
        'serial', v_identity.serial,
        'gs1_identity_id', lower(v_gs1_identity_id::text)
      );
    ELSE
      IF v_row->>'gs1_identity_id' IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_evidence_rows_invalid';
      END IF;
      v_locked_target_binding := jsonb_build_object(
        'kind', CASE
          WHEN v_expected_profile = 'qr_basic' THEN 'nexid_static_qr'
          WHEN v_expected_profile = 'uhf_rfid' THEN 'nexid_uhf_epc'
          WHEN v_expected_profile = 'iot_tracker_placeholder' THEN 'nexid_iot_identity'
          ELSE 'nexid_static_nfc'
        END,
        'public_origin', v_evidence->>'public_origin',
        'tenant_slug', v_scope.tenant_slug,
        'bid', v_bid,
        'carrier_profile_code', v_expected_profile,
        'uid_fingerprint', v_uid_fingerprint
      );
    END IF;
    IF COALESCE(v_evidence->>'public_origin', '') !~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?$'
      OR v_target_binding IS DISTINCT FROM v_locked_target_binding THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_evidence_binding_changed';
    END IF;
    v_target_binding_digest := 'sha256:' || encode(digest(convert_to(
      public.nexid_supplier_qa_canonical_json_v2(v_locked_target_binding), 'UTF8'
    ), 'sha256'), 'hex');
    v_observation_digest := 'sha256:' || encode(digest(convert_to(
      public.nexid_supplier_qa_canonical_json_v2(jsonb_build_object(
        'schema_version', 'supplier-qa-carrier-observation/v1',
        'tenant_id', lower(v_tenant_id::text),
        'batch_id', lower(v_batch_id::text),
        'bid', v_bid,
        'tag_id', lower(v_tag.id::text),
        'carrier_profile_code', v_expected_profile,
        'capture_method', v_row->>'capture_method',
        'captured_at', v_row->>'captured_at',
        'uid_fingerprint', v_uid_fingerprint,
        'encoded_url_hash', v_row->>'encoded_url_hash',
        'target_binding_digest', v_target_binding_digest,
        'gs1_identity_id', CASE WHEN v_gs1_identity_id IS NULL THEN NULL ELSE lower(v_gs1_identity_id::text) END
      )), 'UTF8'
    ), 'sha256'), 'hex');
    IF v_target_binding_digest IS DISTINCT FROM v_row->>'target_binding_digest'
      OR v_observation_digest IS DISTINCT FROM v_row->>'observation_digest' THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_evidence_binding_changed';
    END IF;
    v_expected_uid_fingerprints := v_expected_uid_fingerprints || jsonb_build_array(v_uid_fingerprint);
    v_expected_observation_receipts := v_expected_observation_receipts || jsonb_build_array(jsonb_build_object(
      'uid_fingerprint', v_uid_fingerprint,
      'encoded_url_hash', v_row->>'encoded_url_hash',
      'target_binding_digest', v_target_binding_digest,
      'observation_digest', v_observation_digest,
      'capture_method', v_row->>'capture_method',
      'captured_at', v_row->>'captured_at',
      'gs1_identity_id', CASE WHEN v_gs1_identity_id IS NULL THEN NULL ELSE lower(v_gs1_identity_id::text) END
    ));
  END LOOP;

  IF v_evidence->'batch_scoped_uid_fingerprints' IS DISTINCT FROM v_expected_uid_fingerprints
    OR v_evidence->'observation_receipts' IS DISTINCT FROM v_expected_observation_receipts
    OR COALESCE(v_evidence->>'gs1_registry_binding_verified', '') IS DISTINCT FROM
      (CASE WHEN v_expected_profile = 'gs1_digital_link' THEN 'true' ELSE 'false' END) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_evidence_binding_changed';
  END IF;

  v_notes_digest := CASE WHEN v_notes IS NULL THEN NULL ELSE
    'sha256:' || encode(digest(jsonb_build_object('notes', v_notes)::text, 'sha256'), 'hex') END;
  v_database_binding_digest := 'sha256:' || encode(digest(convert_to(
    public.nexid_supplier_qa_canonical_json_v2(jsonb_build_object(
      'schema_version', 'supplier-carrier-qa-db-receipt/v2',
      'tenant_id', lower(v_tenant_id::text),
      'supplier_order_id', lower(v_supplier_order_id::text),
      'supplier_sub_batch_id', lower(v_supplier_sub_batch_id::text),
      'batch_id', lower(v_batch_id::text),
      'bid', v_bid,
      'sample_count', v_sample_count,
      'operation_key', v_operation_key,
      'actor_id', lower(v_actor_id::text),
      'auth_session_id', lower(v_auth_session_id::text),
      'evidence_json', v_evidence,
      'carrier_evidence_rows', v_rows,
      'verification_context_digest', v_expected_context_digest
    )), 'UTF8'
  ), 'sha256'), 'hex');
  v_event_payload := jsonb_build_object(
    'supplier_order_id', v_supplier_order_id,
    'supplier_sub_batch_id', v_supplier_sub_batch_id,
    'bid', v_bid,
    'status', 'passed',
    'sample_count', v_sample_count,
    'carrier_profile_code', v_expected_profile,
    'acceptance_scope', v_acceptance_scope,
    'key_material_mode', 'none',
    'software_envelope', false,
    'managed_kms', false,
    'hsm_backed', false,
    'carrier_encoding_binding_verified', true,
    'packaging_lab_approval_verified', v_acceptance_scope = 'production_lot',
    'server_verified_sun_evidence', false,
    'cryptographic_authentication_verified', false,
    'replay_checked', false,
    'ttstatus_checked', false,
    'physical_ceremony_verified', false,
    'requires_secure_sun', false,
    'evidence_schema_version', 'supplier-qa-carrier/v1',
    'evidence_digest', v_evidence_digest,
    'database_binding_digest', v_database_binding_digest,
    'operation_key', v_operation_key,
    'notes_digest', v_notes_digest
  );
  v_event_hash := 'sha256:' || encode(digest(convert_to(
    public.nexid_supplier_qa_canonical_json_v2(jsonb_build_object(
      'schema_version', 'supplier-carrier-qa-evidence-event/v2',
      'tenant_id', lower(v_tenant_id::text),
      'resource_type', 'supplier_sub_batch',
      'resource_id', lower(v_supplier_sub_batch_id::text),
      'event_type', 'qa_passed',
      'payload', v_event_payload
    )), 'UTF8'
  ), 'sha256'), 'hex');

  INSERT INTO supplier_qa_checks (
    tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid, status,
    sample_count, replay_checked, ttstatus_checked, notes, evidence_json, checked_by,
    operation_key, request_fingerprint, actor_id, event_hash, database_binding_digest
  ) VALUES (
    v_tenant_id, v_supplier_order_id, v_supplier_sub_batch_id, v_batch_id, v_bid, 'passed',
    v_sample_count, false, false, v_notes, v_evidence, v_actor_email,
    v_operation_key, v_request_fingerprint, v_actor_id, v_event_hash, v_database_binding_digest
  ) RETURNING id INTO v_qa_check_id;

  INSERT INTO supplier_qa_verification_context_receipts (
    qa_check_id, tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id,
    context_domain, context_version, context_digest, context_binding, canonical_payload
  ) VALUES (
    v_qa_check_id, v_tenant_id, v_supplier_order_id, v_supplier_sub_batch_id, v_batch_id,
    'nexid:supplier-qa:verification-context', 'v2', v_expected_context_digest,
    v_expected_context_binding, v_expected_context_canonical
  );

  INSERT INTO supplier_qa_carrier_evidence_receipts (
    qa_check_id, tenant_id, supplier_sub_batch_id, batch_id, tag_id,
    carrier_profile_code, capture_method, captured_at, uid_fingerprint,
    encoded_url_hash, target_binding, target_binding_digest, observation_digest,
    gs1_identity_id, verification_context_digest
  )
  SELECT
    v_qa_check_id, v_tenant_id, v_supplier_sub_batch_id, v_batch_id,
    (carrier_row.value->>'tag_id')::uuid,
    carrier_row.value->>'carrier_profile_code', carrier_row.value->>'capture_method',
    (carrier_row.value->>'captured_at')::timestamptz,
    carrier_row.value->>'uid_fingerprint', carrier_row.value->>'encoded_url_hash',
    carrier_row.value->'target_binding', carrier_row.value->>'target_binding_digest',
    carrier_row.value->>'observation_digest', NULLIF(carrier_row.value->>'gs1_identity_id', '')::uuid,
    v_expected_context_digest
  FROM jsonb_array_elements(v_rows) carrier_row(value);
  GET DIAGNOSTICS v_receipt_count = ROW_COUNT;
  IF v_receipt_count IS DISTINCT FROM v_sample_count THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_evidence_binding_changed';
  END IF;

  IF v_acceptance_scope = 'production_lot' THEN
    INSERT INTO supplier_keyless_production_qa_acceptance_receipts (
      tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid,
      qa_check_id, qa_plan_id, qa_plan_decision_id,
      packaging_lab_approval_id, packaging_lab_receipt_digest,
      schema_version, carrier_profile_code, lot_size, sample_size,
      manifest_hash, evidence_digest, verification_context_digest,
      key_material_mode, software_envelope, managed_kms, hsm_backed,
      actor_id, auth_session_id
    ) VALUES (
      v_tenant_id, v_supplier_order_id, v_supplier_sub_batch_id, v_batch_id, v_bid,
      v_qa_check_id, v_plan.qa_plan_id, v_plan.qa_plan_decision_id,
      v_lab.approval_id, v_lab.receipt_digest,
      'supplier-keyless-production-acceptance/v1', v_expected_profile,
      v_scope.expected_quantity, v_sample_count, v_expected_manifest_hash,
      v_evidence_digest, v_expected_context_digest,
      'none', false, false, false, v_actor_id, v_auth_session_id
    );
  END IF;

  INSERT INTO vault_artifacts (
    tenant_id, supplier_order_id, supplier_sub_batch_id, resource_type, resource_id,
    artifact_type, content_hash, mime_type, metadata_json
  ) VALUES (
    v_tenant_id, v_supplier_order_id, v_supplier_sub_batch_id,
    'supplier_sub_batch', v_supplier_sub_batch_id::text, 'qa_report',
    v_evidence_digest, 'application/json', jsonb_build_object(
      'bid', v_bid,
      'qa_status', 'passed',
      'acceptance_scope', v_acceptance_scope,
      'sample_count', v_sample_count,
      'carrier_profile_code', v_expected_profile,
      'key_material_mode', 'none',
      'software_envelope', false,
      'managed_kms', false,
      'hsm_backed', false,
      'carrier_encoding_binding_verified', true,
      'server_verified_sun_evidence', false,
      'cryptographic_authentication_verified', false,
      'physical_ceremony_verified', false,
      'evidence_schema_version', 'supplier-qa-carrier/v1',
      'evidence_digest', v_evidence_digest,
      'database_binding_digest', v_database_binding_digest,
      'qa_check_id', v_qa_check_id,
      'operation_key', v_operation_key
    )
  );

  UPDATE supplier_sub_batches target_sub_batch
  SET qa_status = 'passed', qa_passed_at = now(), updated_at = now()
  WHERE target_sub_batch.id = v_supplier_sub_batch_id
    AND target_sub_batch.tenant_id = v_tenant_id
    AND target_sub_batch.batch_id = v_batch_id
    AND upper(target_sub_batch.bid) = v_bid
    AND target_sub_batch.status = 'pack_ready'
    AND target_sub_batch.activated_at IS NULL
    AND target_sub_batch.qa_status <> 'passed';
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_sub_batch_state_changed';
  END IF;
  UPDATE batches target_batch
  SET qa_status = 'passed'
  WHERE target_batch.id = v_batch_id
    AND target_batch.tenant_id = v_tenant_id
    AND upper(target_batch.bid) = v_bid
    AND target_batch.status = 'production_registered'
    AND lower(target_batch.carrier_profile_code) = v_expected_profile;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_batch_state_changed';
  END IF;

  INSERT INTO evidence_events (
    tenant_id, resource_type, resource_id, event_type, payload_json, payload_hash
  ) VALUES (
    v_tenant_id, 'supplier_sub_batch', v_supplier_sub_batch_id::text,
    'qa_passed', v_event_payload, v_event_hash
  );
  INSERT INTO audit_logs (
    actor_id, tenant_id, action, resource_type, resource_id,
    before_hash, after_hash, ip_address, user_agent, request_id
  ) VALUES (
    v_actor_id, v_tenant_id, 'supplier_carrier_qa_passed',
    'supplier_sub_batch', v_supplier_sub_batch_id::text,
    NULL, replace(v_event_hash, 'sha256:', ''), NULL,
    NULLIF(left(COALESCE(p_input->>'user_agent', ''), 1024), ''),
    NULLIF(left(COALESCE(p_input->>'request_id', ''), 160), '')
  );

  RETURN QUERY SELECT v_qa_check_id, 'passed'::text, v_evidence_digest, v_event_hash, false;
END;
$commit_carrier_qa$;

-- Preserve the already-reviewed 0076 SUN receipt implementation by identity,
-- rather than copying or editing its cryptographic joins in this migration.
DO $preserve_sun_receipt$
BEGIN
  IF to_regprocedure('public.nexid_supplier_sun_production_activation_receipt_v2(uuid)') IS NULL THEN
    ALTER FUNCTION public.nexid_supplier_production_activation_receipt_v2(uuid)
      RENAME TO nexid_supplier_sun_production_activation_receipt_v2;
  END IF;
END;
$preserve_sun_receipt$;

CREATE OR REPLACE FUNCTION public.nexid_supplier_keyless_production_activation_receipt_v1(
  p_batch_id uuid
)
RETURNS TABLE (
  tenant_id uuid,
  supplier_order_id uuid,
  supplier_sub_batch_id uuid,
  batch_id uuid,
  bid text,
  lot_size integer,
  qa_plan_id uuid,
  qa_plan_decision_id uuid,
  production_session_id uuid,
  production_receipt_id uuid,
  qa_check_id uuid,
  schema_version text,
  receipt_status text,
  acceptance_context_digest text,
  decided_at timestamptz
)
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $keyless_activation_receipt$
  SELECT
    sub_batch.tenant_id,
    sub_batch.supplier_order_id,
    sub_batch.id,
    sub_batch.batch_id,
    upper(sub_batch.bid),
    sub_batch.expected_quantity,
    plan.id,
    plan_decision.id,
    NULL::uuid,
    NULL::uuid,
    qa_check.id,
    keyless_receipt.schema_version,
    'passed'::text,
    keyless_receipt.verification_context_digest,
    keyless_receipt.created_at
  FROM batches batch
  JOIN supplier_sub_batches sub_batch
    ON sub_batch.id = batch.supplier_sub_batch_id
   AND sub_batch.batch_id = batch.id
   AND sub_batch.tenant_id = batch.tenant_id
   AND sub_batch.supplier_order_id = batch.supplier_order_id
   AND upper(sub_batch.bid) = upper(batch.bid)
  JOIN supplier_orders supplier_order
    ON supplier_order.id = sub_batch.supplier_order_id
   AND supplier_order.tenant_id = sub_batch.tenant_id
   AND lower(supplier_order.carrier_profile_code) = lower(batch.carrier_profile_code)
  JOIN supplier_keyless_production_qa_acceptance_receipts keyless_receipt
    ON keyless_receipt.tenant_id = sub_batch.tenant_id
   AND keyless_receipt.supplier_order_id = sub_batch.supplier_order_id
   AND keyless_receipt.supplier_sub_batch_id = sub_batch.id
   AND keyless_receipt.batch_id = sub_batch.batch_id
   AND upper(keyless_receipt.bid) = upper(sub_batch.bid)
   AND keyless_receipt.carrier_profile_code = lower(batch.carrier_profile_code)
   AND keyless_receipt.lot_size = sub_batch.expected_quantity
   AND keyless_receipt.key_material_mode = 'none'
   AND keyless_receipt.software_envelope IS FALSE
   AND keyless_receipt.managed_kms IS FALSE
   AND keyless_receipt.hsm_backed IS FALSE
  JOIN supplier_qa_checks qa_check
    ON qa_check.id = keyless_receipt.qa_check_id
   AND qa_check.id = sub_batch.release_qa_check_id
   AND qa_check.id = batch.release_qa_check_id
   AND qa_check.tenant_id = keyless_receipt.tenant_id
   AND qa_check.supplier_order_id = keyless_receipt.supplier_order_id
   AND qa_check.supplier_sub_batch_id = keyless_receipt.supplier_sub_batch_id
   AND qa_check.batch_id = keyless_receipt.batch_id
   AND upper(qa_check.bid) = upper(keyless_receipt.bid)
   AND qa_check.status = 'passed'
   AND qa_check.acceptance_scope = 'production_lot'
   AND qa_check.sample_count = keyless_receipt.sample_size
   AND qa_check.evidence_json->>'schema_version' = 'supplier-qa-carrier/v1'
   AND qa_check.evidence_json->>'pack_purpose' = 'production'
   AND qa_check.evidence_json->>'acceptance_scope' = 'production_lot'
   AND qa_check.evidence_json->>'key_material_mode' = 'none'
   AND qa_check.evidence_json->>'software_envelope' = 'false'
   AND qa_check.evidence_json->>'managed_kms' = 'false'
   AND qa_check.evidence_json->>'hsm_backed' = 'false'
   AND qa_check.evidence_json->>'packaging_lab_approval_verified' = 'true'
   AND qa_check.evidence_json->>'activation_allowed' = 'false'
   AND lower(qa_check.evidence_json->>'evidence_digest') = keyless_receipt.evidence_digest
   AND lower(qa_check.evidence_json->>'verification_context_digest') = keyless_receipt.verification_context_digest
  JOIN supplier_qa_verification_context_receipts context_receipt
    ON context_receipt.qa_check_id = qa_check.id
   AND context_receipt.tenant_id = qa_check.tenant_id
   AND context_receipt.supplier_order_id = qa_check.supplier_order_id
   AND context_receipt.supplier_sub_batch_id = qa_check.supplier_sub_batch_id
   AND context_receipt.batch_id = qa_check.batch_id
   AND context_receipt.context_digest = keyless_receipt.verification_context_digest
   AND context_receipt.context_binding->>'key_material_mode' = 'none'
   AND context_receipt.context_binding->'key_fingerprint' = 'null'::jsonb
   AND context_receipt.context_binding->>'software_envelope' = 'false'
   AND context_receipt.context_binding->>'managed_kms' = 'false'
   AND context_receipt.context_binding->>'hsm_backed' = 'false'
  JOIN supplier_production_qa_plans plan
    ON plan.id = keyless_receipt.qa_plan_id
   AND plan.tenant_id = keyless_receipt.tenant_id
   AND plan.supplier_order_id = keyless_receipt.supplier_order_id
   AND plan.supplier_sub_batch_id = keyless_receipt.supplier_sub_batch_id
   AND plan.batch_id = keyless_receipt.batch_id
   AND upper(plan.bid) = upper(keyless_receipt.bid)
   AND plan.schema_version = 'supplier-production-qa-plan/v1'
   AND plan.lot_size = keyless_receipt.lot_size
   AND plan.sample_size = keyless_receipt.sample_size
  JOIN supplier_production_qa_plan_decisions plan_decision
    ON plan_decision.id = keyless_receipt.qa_plan_decision_id
   AND plan_decision.plan_id = plan.id
   AND plan_decision.tenant_id = plan.tenant_id
   AND plan_decision.supplier_order_id = plan.supplier_order_id
   AND plan_decision.supplier_sub_batch_id = plan.supplier_sub_batch_id
   AND plan_decision.batch_id = plan.batch_id
   AND upper(plan_decision.bid) = upper(plan.bid)
   AND plan_decision.schema_version = 'supplier-production-qa-plan-decision/v1'
   AND plan_decision.decision_status = 'approved'
   AND plan_decision.approver_role = 'tenant_admin'
   AND plan_decision.plan_digest = plan.plan_digest
  JOIN LATERAL public.nexid_packaging_lab_activation_receipt_v1(batch.id) lab
    ON lab.tenant_id = keyless_receipt.tenant_id
   AND lab.supplier_order_id = keyless_receipt.supplier_order_id
   AND lab.supplier_sub_batch_id = keyless_receipt.supplier_sub_batch_id
   AND lab.batch_id = keyless_receipt.batch_id
   AND lab.approval_id = keyless_receipt.packaging_lab_approval_id
   AND lab.receipt_digest = keyless_receipt.packaging_lab_receipt_digest
  WHERE batch.id = p_batch_id
    AND lower(batch.carrier_profile_code) IN (
      'qr_basic', 'gs1_digital_link', 'ntag213', 'ntag215', 'ntag216',
      'uhf_rfid', 'event_wristband', 'hotel_keycard', 'iot_tracker_placeholder'
    )
    AND public.nexid_effective_supplier_pack_purpose_v1(supplier_order.id) = 'production'
    AND sub_batch.pack_purpose = 'production'
    AND sub_batch.manifest_status = 'imported'
    AND sub_batch.manifest_count = sub_batch.expected_quantity
    AND sub_batch.qa_status = 'passed'
    AND sub_batch.qa_acceptance_scope = 'production_lot'
    AND sub_batch.release_qa_check_id = qa_check.id
    AND sub_batch.manufacturing_state IN ('RECEIVING_QA_PASSED', 'ACTIVATED')
    AND sub_batch.key_export_count = 1
    AND sub_batch.key_exported_at IS NOT NULL
    AND sub_batch.metadata_json->>'key_material_mode' = 'none'
    AND sub_batch.metadata_json->>'software_envelope' = 'false'
    AND sub_batch.metadata_json->>'managed_kms' = 'false'
    AND sub_batch.metadata_json->>'hsm_backed' = 'false'
    AND batch.qa_status = 'passed'
    AND batch.qa_acceptance_scope = 'production_lot'
    AND batch.release_qa_check_id = qa_check.id
    AND batch.meta_key_ct IS NULL
    AND batch.file_key_ct IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM batch_keys unexpected_key
      WHERE unexpected_key.supplier_sub_batch_id = sub_batch.id
         OR unexpected_key.batch_id = batch.id
         OR (unexpected_key.tenant_id = sub_batch.tenant_id AND upper(unexpected_key.bid) = upper(sub_batch.bid))
    )
    AND NOT EXISTS (
      SELECT 1 FROM batch_key_material unexpected_material
      WHERE unexpected_material.supplier_sub_batch_id = sub_batch.id
         OR unexpected_material.batch_id = batch.id
         OR (unexpected_material.tenant_id = sub_batch.tenant_id AND upper(unexpected_material.bid) = upper(sub_batch.bid))
    )
    AND NOT EXISTS (
      SELECT 1 FROM supplier_production_qa_plans newer_plan
      WHERE newer_plan.tenant_id = plan.tenant_id
        AND newer_plan.supplier_sub_batch_id = plan.supplier_sub_batch_id
        AND newer_plan.revision > plan.revision
    )
    AND (SELECT count(*)::integer FROM supplier_qa_carrier_evidence_receipts evidence_receipt
      WHERE evidence_receipt.qa_check_id = qa_check.id
        AND evidence_receipt.tenant_id = qa_check.tenant_id
        AND evidence_receipt.supplier_sub_batch_id = qa_check.supplier_sub_batch_id
        AND evidence_receipt.batch_id = qa_check.batch_id
        AND evidence_receipt.carrier_profile_code = lower(batch.carrier_profile_code)
        AND evidence_receipt.verification_context_digest = keyless_receipt.verification_context_digest
    ) = keyless_receipt.sample_size
    AND EXISTS (
      SELECT 1 FROM evidence_events pack_event
      WHERE pack_event.tenant_id = sub_batch.tenant_id
        AND pack_event.resource_type = 'supplier_sub_batch'
        AND pack_event.resource_id = sub_batch.id::text
        AND pack_event.event_type = 'supplier_pack_exported'
        AND pack_event.payload_json->>'key_material_mode' = 'none'
        AND pack_event.payload_json->>'activation_allowed' = 'false'
    )
    AND EXISTS (
      SELECT 1 FROM vault_artifacts manifest_artifact
      WHERE manifest_artifact.tenant_id = sub_batch.tenant_id
        AND manifest_artifact.supplier_order_id = sub_batch.supplier_order_id
        AND manifest_artifact.supplier_sub_batch_id = sub_batch.id
        AND manifest_artifact.artifact_type = 'supplier_manifest_template_csv'
        AND manifest_artifact.metadata_json->>'key_material_mode' = 'none'
    )
    AND (SELECT count(*)::integer FROM tags lot_tag WHERE lot_tag.batch_id = batch.id)
      = sub_batch.expected_quantity
  FOR SHARE OF supplier_order, sub_batch, batch, keyless_receipt, qa_check,
    context_receipt, plan, plan_decision
$keyless_activation_receipt$;

CREATE OR REPLACE FUNCTION public.nexid_supplier_production_activation_receipt_v2(p_batch_id uuid)
RETURNS TABLE (
  tenant_id uuid,
  supplier_order_id uuid,
  supplier_sub_batch_id uuid,
  batch_id uuid,
  bid text,
  lot_size integer,
  qa_plan_id uuid,
  qa_plan_decision_id uuid,
  production_session_id uuid,
  production_receipt_id uuid,
  qa_check_id uuid,
  schema_version text,
  receipt_status text,
  acceptance_context_digest text,
  decided_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $activation_receipt$
DECLARE
  v_carrier_profile_code text;
BEGIN
  SELECT lower(batch.carrier_profile_code) INTO v_carrier_profile_code
  FROM batches batch
  WHERE batch.id = p_batch_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_carrier_profile_code IN ('ntag424_dna', 'ntag424_dna_tt') THEN
    RETURN QUERY SELECT *
    FROM public.nexid_supplier_sun_production_activation_receipt_v2(p_batch_id);
    RETURN;
  END IF;
  IF v_carrier_profile_code IN (
    'qr_basic', 'gs1_digital_link', 'ntag213', 'ntag215', 'ntag216',
    'uhf_rfid', 'event_wristband', 'hotel_keycard', 'iot_tracker_placeholder'
  ) THEN
    RETURN QUERY SELECT *
    FROM public.nexid_supplier_keyless_production_activation_receipt_v1(p_batch_id);
  END IF;
END;
$activation_receipt$;

CREATE OR REPLACE FUNCTION public.nexid_assert_supplier_production_activation_v2(p_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $assert_activation$
DECLARE
  v_receipt_count integer;
BEGIN
  SELECT count(*)::integer INTO v_receipt_count
  FROM public.nexid_supplier_production_activation_receipt_v2(p_batch_id);
  IF v_receipt_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_acceptance_v2_required';
  END IF;
  PERFORM public.nexid_assert_packaging_lab_activation_v1(p_batch_id);
END;
$assert_activation$;

REVOKE ALL ON FUNCTION public.nexid_supplier_keyless_qa_activation_v1_capability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_commit_supplier_carrier_qa_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_sun_production_activation_receipt_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_keyless_production_activation_receipt_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_production_activation_receipt_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_assert_supplier_production_activation_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_qa_acceptance_scope_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_production_qa_decision_required_v1() FROM PUBLIC;
REVOKE ALL ON TABLE supplier_keyless_production_qa_acceptance_receipts FROM PUBLIC;
