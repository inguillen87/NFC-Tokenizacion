-- Truthful, fail-closed Supplier QA for static/non-SUN carriers.
-- This proves manifest + encoded-target binding only. It does not prove SUN,
-- CMAC, anti-replay, tamper state, physical presence, KMS use or HSM custody.

CREATE TABLE IF NOT EXISTS supplier_qa_carrier_evidence_receipts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  qa_check_id uuid NOT NULL REFERENCES supplier_qa_checks(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_sub_batch_id uuid NOT NULL REFERENCES supplier_sub_batches(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,
  carrier_profile_code text NOT NULL
    CHECK (carrier_profile_code IN ('qr_basic', 'gs1_digital_link', 'ntag213', 'ntag215', 'ntag216')),
  capture_method text NOT NULL CHECK (capture_method IN ('qr_camera', 'nfc_ndef')),
  captured_at timestamptz NOT NULL,
  uid_fingerprint text NOT NULL CHECK (uid_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  encoded_url_hash text NOT NULL CHECK (encoded_url_hash ~ '^sha256:[0-9a-f]{64}$'),
  target_binding jsonb NOT NULL CHECK (
    jsonb_typeof(target_binding) = 'object'
    AND octet_length(target_binding::text) BETWEEN 2 AND 8192
  ),
  target_binding_digest text NOT NULL CHECK (target_binding_digest ~ '^sha256:[0-9a-f]{64}$'),
  observation_digest text NOT NULL CHECK (observation_digest ~ '^sha256:[0-9a-f]{64}$'),
  gs1_identity_id uuid REFERENCES gs1_digital_link_identities(id) ON DELETE RESTRICT,
  verification_context_digest text NOT NULL
    CHECK (verification_context_digest ~ '^sha256:[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (qa_check_id, tag_id),
  UNIQUE (observation_digest)
);

CREATE INDEX IF NOT EXISTS idx_supplier_qa_carrier_receipts_scope
  ON supplier_qa_carrier_evidence_receipts(tenant_id, supplier_sub_batch_id, qa_check_id);

DROP TRIGGER IF EXISTS trg_supplier_qa_carrier_receipts_append_only
  ON supplier_qa_carrier_evidence_receipts;
CREATE TRIGGER trg_supplier_qa_carrier_receipts_append_only
  BEFORE UPDATE OR DELETE ON supplier_qa_carrier_evidence_receipts
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_qa_history_append_only();

CREATE OR REPLACE FUNCTION public.nexid_supplier_carrier_qa_v1_capability()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT 'supplier-carrier-qa/v1'::text
$$;

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
  v_bid text;
  v_status text;
  v_sample_count integer;
  v_notes text;
  v_actor_email text;
  v_operation_key text;
  v_evidence jsonb;
  v_evidence_digest text;
  v_rows jsonb;
  v_expected_manifest_hash text;
  v_expected_carrier_profile text;
  v_expected_key_fingerprint text;
  v_expected_sdm_config jsonb;
  v_expected_context_digest text;
  v_expected_context_binding jsonb;
  v_expected_context_canonical text;
  v_request_fingerprint text;
  v_locked record;
  v_existing record;
  v_tag record;
  v_identity record;
  v_row jsonb;
  v_target_binding jsonb;
  v_locked_target_binding jsonb;
  v_locked_carrier_binding jsonb;
  v_locked_context_binding jsonb;
  v_locked_context_canonical text;
  v_locked_context_digest text;
  v_locked_carrier_digest text;
  v_uid_fingerprint text;
  v_target_binding_digest text;
  v_observation_digest text;
  v_gs1_identity_id uuid;
  v_previous_uid_fingerprint text := '';
  v_seen_tag_ids uuid[] := ARRAY[]::uuid[];
  v_expected_observation_receipts jsonb := '[]'::jsonb;
  v_expected_uid_fingerprints jsonb := '[]'::jsonb;
  v_database_binding_digest text;
  v_event_payload jsonb;
  v_event_hash text;
  v_notes_digest text;
  v_qa_check_id uuid;
  v_updated_count integer;
  v_receipt_count integer;
BEGIN
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_input_invalid';
  END IF;
  IF COALESCE(p_input->>'tenant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'supplier_order_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'supplier_sub_batch_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'batch_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'actor_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_identity_invalid';
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
  v_rows := COALESCE(p_input->'carrier_evidence_rows', '[]'::jsonb);
  v_expected_manifest_hash := lower(trim(COALESCE(p_input->>'expected_manifest_hash', '')));
  v_expected_carrier_profile := lower(trim(COALESCE(p_input->>'expected_carrier_profile_code', '')));
  v_expected_key_fingerprint := upper(trim(COALESCE(p_input->>'expected_key_fingerprint', '')));
  v_expected_sdm_config := COALESCE(p_input->'expected_sdm_config', '{}'::jsonb);
  v_expected_context_digest := lower(trim(COALESCE(p_input->>'expected_verification_context_digest', '')));
  v_expected_context_binding := p_input->'expected_verification_context_binding';
  v_expected_context_canonical := COALESCE(p_input->>'expected_verification_context_canonical', '');

  IF v_status <> 'passed' OR v_bid = ''
    OR COALESCE(p_input->>'replay_checked', '') <> 'false'
    OR COALESCE(p_input->>'ttstatus_checked', '') <> 'false' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_input_invalid';
  END IF;
  IF COALESCE(p_input->>'sample_count', '') !~ '^[1-9][0-9]?$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_sample_count_invalid';
  END IF;
  v_sample_count := (p_input->>'sample_count')::integer;
  IF v_sample_count > 10 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_sample_count_invalid';
  END IF;
  IF v_expected_carrier_profile NOT IN ('qr_basic', 'gs1_digital_link', 'ntag213', 'ntag215', 'ntag216') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_carrier_unsupported';
  END IF;
  IF v_actor_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR char_length(v_actor_email) > 320 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_actor_invalid';
  END IF;
  IF v_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_idempotency_key_invalid';
  END IF;
  IF v_notes IS NOT NULL AND char_length(v_notes) > 2000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_notes_too_long';
  END IF;
  IF NOT public.nexid_audit_freeform_is_safe_v1(v_notes) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_sensitive_audit_input_rejected';
  END IF;
  IF jsonb_typeof(v_evidence) IS DISTINCT FROM 'object'
    OR jsonb_typeof(v_rows) IS DISTINCT FROM 'array'
    OR jsonb_typeof(v_expected_sdm_config) IS DISTINCT FROM 'object'
    OR jsonb_typeof(v_expected_context_binding) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_payload_invalid';
  END IF;
  IF v_evidence_digest !~ '^sha256:[0-9a-f]{64}$'
    OR v_expected_manifest_hash !~ '^sha256:[0-9a-f]{64}$'
    OR v_expected_context_digest !~ '^sha256:[0-9a-f]{64}$'
    OR v_expected_key_fingerprint !~ '^[0-9A-F]{16}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_digest_invalid';
  END IF;
  IF public.nexid_supplier_qa_canonical_json_v2(v_expected_context_binding) IS DISTINCT FROM v_expected_context_canonical
    OR ('sha256:' || encode(digest(convert_to(v_expected_context_canonical, 'UTF8'), 'sha256'), 'hex')) IS DISTINCT FROM v_expected_context_digest THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_verification_context_invalid';
  END IF;
  IF jsonb_array_length(v_rows) <> v_sample_count
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_rows) AS carrier_row(value)
      WHERE jsonb_typeof(carrier_row.value) IS DISTINCT FROM 'object'
        OR EXISTS (
          SELECT 1 FROM jsonb_object_keys(carrier_row.value) AS supplied_key(key)
          WHERE supplied_key.key NOT IN (
            'tag_id', 'carrier_profile_code', 'capture_method', 'captured_at',
            'uid_fingerprint', 'encoded_url_hash', 'target_binding',
            'target_binding_digest', 'observation_digest', 'gs1_identity_id'
          )
        )
        OR COALESCE(carrier_row.value->>'tag_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        OR COALESCE(carrier_row.value->>'carrier_profile_code', '') <> v_expected_carrier_profile
        OR COALESCE(carrier_row.value->>'capture_method', '') NOT IN ('qr_camera', 'nfc_ndef')
        OR COALESCE(carrier_row.value->>'captured_at', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
        OR COALESCE(carrier_row.value->>'uid_fingerprint', '') !~ '^sha256:[0-9a-f]{64}$'
        OR COALESCE(carrier_row.value->>'encoded_url_hash', '') !~ '^sha256:[0-9a-f]{64}$'
        OR jsonb_typeof(carrier_row.value->'target_binding') IS DISTINCT FROM 'object'
        OR COALESCE(carrier_row.value->>'target_binding_digest', '') !~ '^sha256:[0-9a-f]{64}$'
        OR COALESCE(carrier_row.value->>'observation_digest', '') !~ '^sha256:[0-9a-f]{64}$'
        OR (
          carrier_row.value->>'gs1_identity_id' IS NOT NULL
          AND carrier_row.value->>'gs1_identity_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        )
    ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_evidence_rows_invalid';
  END IF;
  IF COALESCE(v_evidence->>'schema_version', '') <> 'supplier-qa-carrier/v1'
    OR COALESCE(v_evidence->>'evidence_source', '') <> 'server_validated_operator_capture'
    OR COALESCE(v_evidence->>'assurance_scope', '') <> 'manifest_and_static_encoding_binding'
    OR COALESCE(v_evidence->>'carrier_profile_code', '') <> v_expected_carrier_profile
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
    OR COALESCE(v_evidence->>'pack_purpose', '') <> 'trial_integration'
    OR COALESCE(v_evidence->>'acceptance_scope', '') <> 'trial_integration'
    OR COALESCE(v_evidence->>'commercial_disposition', '') <> 'NON_SELLABLE'
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
      'status', v_status,
      'sample_count', v_sample_count,
      'notes', v_notes,
      'evidence_json', v_evidence,
      'carrier_evidence_rows', v_rows,
      'actor_id', lower(v_actor_id::text),
      'verification_context_digest', v_expected_context_digest
    )),
    'UTF8'
  ), 'sha256'), 'hex');

  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || chr(31) || v_operation_key, 0));
  SELECT
    q.id,
    q.status,
    q.request_fingerprint,
    q.evidence_json,
    q.event_hash,
    context_receipt.context_digest,
    context_receipt.context_binding,
    context_receipt.canonical_payload,
    (SELECT count(*)::integer FROM supplier_qa_carrier_evidence_receipts carrier_receipt
      WHERE carrier_receipt.qa_check_id = q.id) AS carrier_receipt_count
  INTO v_existing
  FROM supplier_qa_checks q
  LEFT JOIN supplier_qa_verification_context_receipts context_receipt
    ON context_receipt.qa_check_id = q.id
   AND context_receipt.tenant_id = q.tenant_id
  WHERE q.tenant_id = v_tenant_id
    AND q.operation_key = v_operation_key
  LIMIT 1;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.request_fingerprint IS DISTINCT FROM v_request_fingerprint
      OR COALESCE(v_existing.evidence_json->>'schema_version', '') <> 'supplier-qa-carrier/v1'
      OR v_existing.context_digest IS DISTINCT FROM v_expected_context_digest
      OR v_existing.context_binding IS DISTINCT FROM v_expected_context_binding
      OR v_existing.canonical_payload IS DISTINCT FROM v_expected_context_canonical
      OR v_existing.carrier_receipt_count IS DISTINCT FROM v_sample_count THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'supplier_carrier_qa_idempotency_key_conflict';
    END IF;
    RETURN QUERY SELECT
      v_existing.id,
      v_existing.status,
      COALESCE(v_existing.evidence_json->>'evidence_digest', ''),
      COALESCE(v_existing.event_hash, ''),
      true;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'supplier-pack-purpose' || chr(31) || v_supplier_order_id::text,
    0
  ));
  SELECT
    ssb.status::text AS supplier_sub_batch_status,
    ssb.qa_status,
    ssb.manifest_status,
    lower(ssb.manifest_hash) AS manifest_hash,
    ssb.manifest_count,
    ssb.manifest_imported_at,
    ssb.expected_quantity,
    ssb.activated_at,
    ssb.key_export_count,
    ssb.key_exported_at,
    b.status::text AS batch_status,
    lower(b.carrier_profile_code) AS batch_carrier_profile,
    b.sdm_config,
    upper(b.bid) AS bid,
    upper(bk.key_fingerprint) AS key_fingerprint,
    bk.export_count AS batch_key_export_count,
    bk.exported_at AS batch_key_exported_at,
    lower(so.carrier_profile_code) AS order_carrier_profile,
    lower(so.packaging_governance_status) AS packaging_governance_status,
    so.packaging_spec_revision,
    lower(so.packaging_spec_hash) AS packaging_spec_hash,
    lower(COALESCE(purpose_decision.to_purpose, so.pack_purpose)) AS effective_pack_purpose,
    lower(tenant.slug) AS tenant_slug,
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
    ON so.id = ssb.supplier_order_id AND so.tenant_id = ssb.tenant_id
  JOIN tenants tenant ON tenant.id = ssb.tenant_id
  JOIN batches b
    ON b.id = ssb.batch_id AND b.tenant_id = ssb.tenant_id AND upper(b.bid) = upper(ssb.bid)
  JOIN batch_keys bk
    ON bk.supplier_sub_batch_id = ssb.id
   AND bk.batch_id = b.id
   AND bk.tenant_id = ssb.tenant_id
   AND upper(bk.bid) = upper(ssb.bid)
   AND bk.status = 'active'
  LEFT JOIN supplier_pack_purpose_decisions purpose_decision
    ON purpose_decision.supplier_order_id = so.id AND purpose_decision.tenant_id = so.tenant_id
  WHERE ssb.id = v_supplier_sub_batch_id
    AND ssb.supplier_order_id = v_supplier_order_id
    AND ssb.batch_id = v_batch_id
    AND ssb.tenant_id = v_tenant_id
    AND upper(ssb.bid) = v_bid
  FOR UPDATE OF ssb, so, b, bk;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'supplier_carrier_qa_scope_not_found';
  END IF;
  IF lower(COALESCE(v_locked.supplier_sub_batch_status, '')) <> 'pack_ready'
    OR lower(COALESCE(v_locked.batch_status, '')) <> 'production_registered'
    OR v_locked.activated_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_pre_release_state_required';
  END IF;
  IF lower(COALESCE(v_locked.qa_status, '')) = 'passed' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_already_passed';
  END IF;
  IF v_locked.batch_carrier_profile IS DISTINCT FROM v_expected_carrier_profile
    OR v_locked.order_carrier_profile IS DISTINCT FROM v_expected_carrier_profile THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_carrier_profile_scope_mismatch';
  END IF;
  IF v_locked.effective_pack_purpose IS DISTINCT FROM 'trial_integration' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_pre_release_state_required';
  END IF;
  IF v_locked.manifest_hash IS DISTINCT FROM v_expected_manifest_hash
    OR v_locked.key_fingerprint IS DISTINCT FROM v_expected_key_fingerprint
    OR v_locked.sdm_config IS DISTINCT FROM v_expected_sdm_config THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_verification_context_changed';
  END IF;
  IF lower(COALESCE(v_locked.manifest_status, '')) <> 'imported'
    OR v_locked.manifest_count IS DISTINCT FROM v_locked.expected_quantity THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_manifest_required';
  END IF;
  IF lower(COALESCE(v_locked.packaging_governance_status, '')) <> 'approved'
    OR COALESCE(v_locked.packaging_spec_revision, 0) <= 0
    OR COALESCE(v_locked.packaging_spec_hash, '') !~ '^sha256:[0-9a-f]{64}$'
    OR v_locked.packaging_governance_receipt_valid IS DISTINCT FROM true
    OR v_locked.key_export_count IS DISTINCT FROM 1
    OR v_locked.batch_key_export_count IS DISTINCT FROM 1
    OR v_locked.key_exported_at IS NULL
    OR v_locked.batch_key_exported_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_factory_release_evidence_required';
  END IF;
  IF v_sample_count IS DISTINCT FROM LEAST(10, v_locked.expected_quantity) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_sample_count_invalid';
  END IF;

  v_locked_carrier_binding := jsonb_build_object(
    'carrier_profile_code', v_locked.batch_carrier_profile,
    'sdm_config', v_expected_sdm_config
  );
  v_locked_carrier_digest := 'sha256:' || encode(digest(convert_to(
    public.nexid_supplier_qa_canonical_json_v2(v_locked_carrier_binding), 'UTF8'
  ), 'sha256'), 'hex');
  v_locked_context_binding := jsonb_build_object(
    'domain', 'nexid:supplier-qa:verification-context',
    'schema_version', 'v2',
    'tenant_id', lower(v_tenant_id::text),
    'batch_id', lower(v_batch_id::text),
    'bid', v_locked.bid,
    'manifest_hash', v_locked.manifest_hash,
    'carrier_profile_code', v_locked.batch_carrier_profile,
    'key_fingerprint', v_locked.key_fingerprint,
    'carrier_config_digest', v_locked_carrier_digest,
    'supplier_order_id', lower(v_supplier_order_id::text),
    'supplier_sub_batch_id', lower(v_supplier_sub_batch_id::text),
    'supplier_sub_batch_status', NULLIF(lower(v_locked.supplier_sub_batch_status), ''),
    'batch_status', NULLIF(lower(v_locked.batch_status), ''),
    'key_export_count', v_locked.key_export_count,
    'key_exported_at', to_char(v_locked.key_exported_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'batch_key_export_count', v_locked.batch_key_export_count,
    'batch_key_exported_at', to_char(v_locked.batch_key_exported_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'packaging_governance_status', NULLIF(v_locked.packaging_governance_status, ''),
    'packaging_spec_revision', v_locked.packaging_spec_revision,
    'packaging_spec_hash', NULLIF(v_locked.packaging_spec_hash, ''),
    'pack_purpose', v_locked.effective_pack_purpose,
    'acceptance_scope', 'trial_integration'
  );
  v_locked_context_canonical := public.nexid_supplier_qa_canonical_json_v2(v_locked_context_binding);
  v_locked_context_digest := 'sha256:' || encode(digest(convert_to(v_locked_context_canonical, 'UTF8'), 'sha256'), 'hex');
  IF v_expected_context_binding IS DISTINCT FROM v_locked_context_binding
    OR v_expected_context_canonical IS DISTINCT FROM v_locked_context_canonical
    OR v_expected_context_digest IS DISTINCT FROM v_locked_context_digest
    OR lower(COALESCE(v_evidence->>'carrier_config_digest', '')) IS DISTINCT FROM v_locked_carrier_digest THEN
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

    SELECT tag.id, upper(tag.uid_hex) AS uid_hex
    INTO v_tag
    FROM tags tag
    WHERE tag.id = (v_row->>'tag_id')::uuid
      AND tag.batch_id = v_batch_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_tag_binding_invalid';
    END IF;
    v_uid_fingerprint := 'sha256:' || encode(digest(
      convert_to(v_bid, 'UTF8') || decode('00', 'hex') || convert_to(v_tag.uid_hex, 'UTF8'),
      'sha256'
    ), 'hex');
    IF v_row->>'uid_fingerprint' IS DISTINCT FROM v_uid_fingerprint
      OR (v_row->>'captured_at')::timestamptz < GREATEST(v_locked.manifest_imported_at, now() - interval '72 hours')
      OR (v_row->>'captured_at')::timestamptz > now() + interval '1 minute' THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_tag_binding_invalid';
    END IF;
    IF (v_expected_carrier_profile IN ('ntag213', 'ntag215', 'ntag216') AND v_row->>'capture_method' <> 'nfc_ndef')
      OR (v_expected_carrier_profile IN ('qr_basic', 'gs1_digital_link') AND v_row->>'capture_method' <> 'qr_camera') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_carrier_qa_evidence_rows_invalid';
    END IF;

    v_target_binding := v_row->'target_binding';
    IF v_expected_carrier_profile = 'gs1_digital_link' THEN
      IF v_row->>'gs1_identity_id' IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_gs1_registry_binding_invalid';
      END IF;
      SELECT identity.id, identity.gtin, identity.lot, identity.serial
      INTO v_identity
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
        'kind', CASE WHEN v_expected_carrier_profile = 'qr_basic' THEN 'nexid_static_qr' ELSE 'nexid_static_nfc' END,
        'public_origin', v_evidence->>'public_origin',
        'tenant_slug', v_locked.tenant_slug,
        'bid', v_bid,
        'carrier_profile_code', v_expected_carrier_profile,
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
    IF v_target_binding_digest IS DISTINCT FROM v_row->>'target_binding_digest' THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_evidence_binding_changed';
    END IF;
    v_observation_digest := 'sha256:' || encode(digest(convert_to(
      public.nexid_supplier_qa_canonical_json_v2(jsonb_build_object(
        'schema_version', 'supplier-qa-carrier-observation/v1',
        'tenant_id', lower(v_tenant_id::text),
        'batch_id', lower(v_batch_id::text),
        'bid', v_bid,
        'tag_id', lower(v_tag.id::text),
        'carrier_profile_code', v_expected_carrier_profile,
        'capture_method', v_row->>'capture_method',
        'captured_at', v_row->>'captured_at',
        'uid_fingerprint', v_uid_fingerprint,
        'encoded_url_hash', v_row->>'encoded_url_hash',
        'target_binding_digest', v_target_binding_digest,
        'gs1_identity_id', CASE WHEN v_gs1_identity_id IS NULL THEN NULL ELSE lower(v_gs1_identity_id::text) END
      )), 'UTF8'
    ), 'sha256'), 'hex');
    IF v_observation_digest IS DISTINCT FROM v_row->>'observation_digest' THEN
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
      (CASE WHEN v_expected_carrier_profile = 'gs1_digital_link' THEN 'true' ELSE 'false' END) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_evidence_binding_changed';
  END IF;

  v_notes_digest := CASE WHEN v_notes IS NULL THEN NULL ELSE
    'sha256:' || encode(digest(jsonb_build_object('notes', v_notes)::text, 'sha256'), 'hex') END;
  v_database_binding_digest := 'sha256:' || encode(digest(convert_to(
    public.nexid_supplier_qa_canonical_json_v2(jsonb_build_object(
      'schema_version', 'supplier-carrier-qa-db-receipt/v1',
      'tenant_id', lower(v_tenant_id::text),
      'supplier_order_id', lower(v_supplier_order_id::text),
      'supplier_sub_batch_id', lower(v_supplier_sub_batch_id::text),
      'batch_id', lower(v_batch_id::text),
      'bid', v_bid,
      'status', 'passed',
      'sample_count', v_sample_count,
      'operation_key', v_operation_key,
      'actor_id', lower(v_actor_id::text),
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
    'carrier_profile_code', v_expected_carrier_profile,
    'carrier_encoding_binding_verified', true,
    'gs1_registry_binding_verified', v_expected_carrier_profile = 'gs1_digital_link',
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
      'schema_version', 'supplier-carrier-qa-evidence-event/v1',
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
    carrier_row.value->>'carrier_profile_code',
    carrier_row.value->>'capture_method',
    (carrier_row.value->>'captured_at')::timestamptz,
    carrier_row.value->>'uid_fingerprint',
    carrier_row.value->>'encoded_url_hash',
    carrier_row.value->'target_binding',
    carrier_row.value->>'target_binding_digest',
    carrier_row.value->>'observation_digest',
    NULLIF(carrier_row.value->>'gs1_identity_id', '')::uuid,
    v_expected_context_digest
  FROM jsonb_array_elements(v_rows) AS carrier_row(value);
  GET DIAGNOSTICS v_receipt_count = ROW_COUNT;
  IF v_receipt_count IS DISTINCT FROM v_sample_count THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_carrier_qa_evidence_binding_changed';
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
      'sample_count', v_sample_count,
      'carrier_profile_code', v_expected_carrier_profile,
      'carrier_encoding_binding_verified', true,
      'server_verified_sun_evidence', false,
      'cryptographic_authentication_verified', false,
      'replay_checked', false,
      'ttstatus_checked', false,
      'physical_ceremony_verified', false,
      'evidence_schema_version', 'supplier-qa-carrier/v1',
      'evidence_digest', v_evidence_digest,
      'database_binding_digest', v_database_binding_digest,
      'qa_check_id', v_qa_check_id,
      'operation_key', v_operation_key
    )
  );

  UPDATE supplier_sub_batches AS target_sub_batch
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
  UPDATE batches
  SET qa_status = 'passed'
  WHERE id = v_batch_id
    AND tenant_id = v_tenant_id
    AND upper(bid) = v_bid
    AND status = 'production_registered'
    AND carrier_profile_code = v_expected_carrier_profile;
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
    NULL, encode(digest(v_event_payload::text, 'sha256'), 'hex'), NULL,
    NULLIF(left(COALESCE(p_input->>'user_agent', ''), 1024), ''),
    NULLIF(left(COALESCE(p_input->>'request_id', ''), 160), '')
  );

  RETURN QUERY SELECT v_qa_check_id, 'passed'::text, v_evidence_digest, v_event_hash, false;
END;
$commit_carrier_qa$;

REVOKE ALL ON FUNCTION public.nexid_supplier_carrier_qa_v1_capability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_commit_supplier_carrier_qa_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON TABLE supplier_qa_carrier_evidence_receipts FROM PUBLIC;
