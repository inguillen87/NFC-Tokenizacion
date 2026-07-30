-- Supplier batch-key rotation v2: one locked, fail-closed transaction.
--
-- The application creates context-bound software envelopes before calling this
-- function. This migration does not decrypt NFC keys, change SUN/SDM/CMAC,
-- K_META/K_FILE or TagTamper behavior, and it is not KMS/HSM custody evidence.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.nexid_supplier_key_rotation_v2_capability()
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT 'supplier-key-rotation/v2'::text
$$;

CREATE OR REPLACE FUNCTION public.nexid_rotate_supplier_batch_keys_v2(p_input jsonb)
RETURNS TABLE (
  tenant_id uuid,
  supplier_order_id uuid,
  supplier_sub_batch_id uuid,
  batch_id uuid,
  bid text,
  previous_key_version integer,
  new_key_version integer,
  previous_pair_fingerprint text,
  previous_role_fingerprints jsonb,
  new_pair_fingerprint text,
  new_role_fingerprints jsonb,
  evidence_event_hash text,
  rotated_material_count integer,
  inserted_material_count integer,
  updated_pair_count integer,
  updated_batch_count integer,
  updated_sub_batch_count integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $rotate_v2$
DECLARE
  v_tenant_id uuid;
  v_supplier_order_id uuid;
  v_supplier_sub_batch_id uuid;
  v_batch_id uuid;
  v_expected_pair_id uuid;
  v_bid text;
  v_expected_tenant_slug text;
  v_actor_id uuid;
  v_actor_email text;
  v_rotation_reason text;
  v_expected_pair_version integer;
  v_next_version integer;
  v_expected_pair_fingerprint text;
  v_expected_meta_fingerprint text;
  v_expected_file_fingerprint text;
  v_new_pair_fingerprint text;
  v_meta_ciphertext text;
  v_file_ciphertext text;
  v_meta_fingerprint text;
  v_file_fingerprint text;
  v_locked record;
  v_active_count integer := 0;
  v_active_unexported boolean := false;
  v_max_key_version integer := 0;
  v_previous_role_fingerprints jsonb := '{}'::jsonb;
  v_rotated_count integer := 0;
  v_inserted_count integer := 0;
  v_pair_count integer := 0;
  v_batch_count integer := 0;
  v_sub_batch_count integer := 0;
  v_event_payload jsonb;
  v_event_hash text;
BEGIN
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR COALESCE(p_input->>'tenant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'supplier_order_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'supplier_sub_batch_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'batch_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'expected_pair_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'actor_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_key_rotation_identity_invalid';
  END IF;

  v_tenant_id := (p_input->>'tenant_id')::uuid;
  v_supplier_order_id := (p_input->>'supplier_order_id')::uuid;
  v_supplier_sub_batch_id := (p_input->>'supplier_sub_batch_id')::uuid;
  v_batch_id := (p_input->>'batch_id')::uuid;
  v_expected_pair_id := (p_input->>'expected_pair_id')::uuid;
  v_actor_id := (p_input->>'actor_id')::uuid;
  v_bid := upper(trim(COALESCE(p_input->>'bid', '')));
  v_expected_tenant_slug := lower(NULLIF(trim(COALESCE(p_input->>'expected_tenant_slug', '')), ''));
  v_actor_email := lower(trim(COALESCE(p_input->>'actor_email', '')));
  v_rotation_reason := trim(COALESCE(p_input->>'rotation_reason', ''));
  v_expected_pair_fingerprint := upper(trim(COALESCE(p_input->>'expected_pair_fingerprint', '')));
  v_expected_meta_fingerprint := upper(trim(COALESCE(p_input->>'expected_meta_key_fingerprint', '')));
  v_expected_file_fingerprint := upper(trim(COALESCE(p_input->>'expected_file_key_fingerprint', '')));
  v_new_pair_fingerprint := upper(trim(COALESCE(p_input->>'new_pair_fingerprint', '')));
  v_meta_ciphertext := trim(COALESCE(p_input->>'meta_encrypted_key_ct', ''));
  v_file_ciphertext := trim(COALESCE(p_input->>'file_encrypted_key_ct', ''));
  v_meta_fingerprint := upper(trim(COALESCE(p_input->>'meta_key_fingerprint', '')));
  v_file_fingerprint := upper(trim(COALESCE(p_input->>'file_key_fingerprint', '')));

  BEGIN
    v_expected_pair_version := (p_input->>'expected_pair_version')::integer;
    v_next_version := (p_input->>'next_key_version')::integer;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_key_rotation_version_invalid';
  END;

  IF v_bid !~ '^[A-Z0-9][A-Z0-9._:-]{2,127}$'
    OR v_actor_email !~ '^[^[:space:]@]+@[^[:space:]@]+$'
    OR octet_length(v_rotation_reason) NOT BETWEEN 12 AND 1000
    OR v_expected_pair_version < 1
    OR v_next_version <> v_expected_pair_version + 1
    OR v_expected_pair_fingerprint !~ '^[0-9A-F]{16}$'
    OR v_expected_meta_fingerprint !~ '^[0-9A-F]{16}$'
    OR v_expected_file_fingerprint !~ '^[0-9A-F]{16}$'
    OR v_new_pair_fingerprint !~ '^[0-9A-F]{16}$'
    OR v_meta_fingerprint !~ '^[0-9A-F]{16}$'
    OR v_file_fingerprint !~ '^[0-9A-F]{16}$'
    OR octet_length(v_meta_ciphertext) NOT BETWEEN 40 AND 16384
    OR octet_length(v_file_ciphertext) NOT BETWEEN 40 AND 16384
    OR v_meta_ciphertext !~ '^nexid-app-envelope-v2\.'
    OR v_file_ciphertext !~ '^nexid-app-envelope-v2\.' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_key_rotation_payload_invalid';
  END IF;

  -- Match the 0073 QA writer and 0071 purpose governance namespace before
  -- taking the same four row locks. Whichever operation wins is authoritative;
  -- the waiter must re-evaluate every mutable gate after acquiring these locks.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'supplier-pack-purpose' || chr(31) || v_supplier_order_id::text,
    0
  ));

  SELECT
    ssb.id AS supplier_sub_batch_id,
    ssb.tenant_id,
    ssb.supplier_order_id,
    ssb.batch_id,
    upper(ssb.bid) AS bid,
    lower(ssb.status) AS sub_batch_status,
    lower(ssb.manifest_status) AS manifest_status,
    ssb.manifest_count,
    lower(ssb.qa_status) AS qa_status,
    ssb.key_export_count,
    ssb.metadata_json,
    lower(b.status::text) AS batch_status,
    b.sdm_config,
    bk.id AS pair_id,
    bk.export_count AS pair_export_count,
    bk.key_version AS pair_version,
    upper(bk.key_fingerprint) AS pair_fingerprint,
    lower(bk.status) AS pair_status,
    t.slug AS tenant_slug
  INTO v_locked
  FROM supplier_sub_batches ssb
  JOIN supplier_orders so
    ON so.id = ssb.supplier_order_id
   AND so.tenant_id = ssb.tenant_id
  JOIN batches b
    ON b.id = ssb.batch_id
   AND b.tenant_id = ssb.tenant_id
  JOIN batch_keys bk
    ON bk.supplier_sub_batch_id = ssb.id
   AND bk.supplier_order_id = so.id
   AND bk.batch_id = b.id
   AND bk.tenant_id = ssb.tenant_id
  JOIN tenants t ON t.id = ssb.tenant_id
  WHERE ssb.id = v_supplier_sub_batch_id
    AND ssb.supplier_order_id = v_supplier_order_id
    AND ssb.batch_id = v_batch_id
    AND ssb.tenant_id = v_tenant_id
    AND upper(ssb.bid) = v_bid
  FOR UPDATE OF ssb, so, b, bk;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'supplier_key_rotation_scope_not_found';
  END IF;
  IF v_expected_tenant_slug IS NOT NULL AND lower(v_locked.tenant_slug) IS DISTINCT FROM v_expected_tenant_slug THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'supplier_key_rotation_tenant_scope_mismatch';
  END IF;
  IF v_locked.pair_id IS DISTINCT FROM v_expected_pair_id
    OR v_locked.pair_version IS DISTINCT FROM v_expected_pair_version
    OR v_locked.pair_fingerprint IS DISTINCT FROM v_expected_pair_fingerprint THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'supplier_key_rotation_pair_changed';
  END IF;
  IF v_locked.key_export_count <> 0 OR v_locked.pair_export_count <> 0 THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_key_rotation_exported';
  END IF;
  IF v_locked.manifest_status = 'imported' OR v_locked.manifest_count <> 0 THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_key_rotation_manifest_imported';
  END IF;
  IF v_locked.qa_status = 'passed' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_key_rotation_qa_passed';
  END IF;
  IF v_locked.sub_batch_status IN ('activated', 'partially_activated', 'active')
    OR v_locked.batch_status IN ('active', 'active_in_market')
    OR v_locked.pair_status <> 'active' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_key_rotation_state_ineligible';
  END IF;

  SELECT
    count(*)::integer,
    COALESCE(bool_and(material.export_count = 0), false),
    COALESCE(max(material.key_version), 0)::integer,
    COALESCE(jsonb_object_agg(material.key_role, upper(material.key_fingerprint)), '{}'::jsonb)
  INTO v_active_count, v_active_unexported, v_max_key_version, v_previous_role_fingerprints
  FROM (
    SELECT bkm.id, bkm.key_role, bkm.key_version, bkm.key_fingerprint, bkm.export_count
    FROM batch_key_material bkm
    WHERE bkm.supplier_sub_batch_id = v_supplier_sub_batch_id
      AND bkm.tenant_id = v_tenant_id
      AND bkm.status = 'active'
    ORDER BY bkm.key_role, bkm.id
    FOR UPDATE OF bkm
  ) AS material;

  IF v_active_count <> 2
    OR NOT v_active_unexported
    OR v_max_key_version <> v_expected_pair_version
    OR NOT (v_previous_role_fingerprints ? 'K_META_BATCH')
    OR NOT (v_previous_role_fingerprints ? 'K_FILE_BATCH')
    OR upper(v_previous_role_fingerprints->>'K_META_BATCH') IS DISTINCT FROM v_expected_meta_fingerprint
    OR upper(v_previous_role_fingerprints->>'K_FILE_BATCH') IS DISTINCT FROM v_expected_file_fingerprint THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_key_rotation_active_material_invalid';
  END IF;
  IF v_new_pair_fingerprint = v_expected_pair_fingerprint
    OR v_meta_fingerprint = upper(v_previous_role_fingerprints->>'K_META_BATCH')
    OR v_file_fingerprint = upper(v_previous_role_fingerprints->>'K_FILE_BATCH') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_key_rotation_key_material_unchanged';
  END IF;

  UPDATE batch_key_material bkm
  SET status = 'rotated',
      rotated_at = now(),
      rotation_reason = v_rotation_reason,
      metadata_json = COALESCE(bkm.metadata_json, '{}'::jsonb) || jsonb_build_object(
        'rotated_by', v_actor_email,
        'rotated_to_version', v_next_version,
        'rotation_reason', v_rotation_reason
      ),
      updated_at = now()
  WHERE bkm.supplier_sub_batch_id = v_supplier_sub_batch_id
    AND bkm.tenant_id = v_tenant_id
    AND bkm.status = 'active'
    AND bkm.export_count = 0;
  GET DIAGNOSTICS v_rotated_count = ROW_COUNT;
  IF v_rotated_count <> 2 THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'supplier_key_rotation_material_conflict';
  END IF;

  INSERT INTO batch_key_material (
    tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid,
    key_role, key_version, encrypted_key_ct, key_fingerprint, status,
    created_by, rotated_from_key_id, rotation_reason, metadata_json
  )
  SELECT
    v_tenant_id, v_supplier_order_id, v_supplier_sub_batch_id, v_batch_id, v_bid,
    new_key.key_role, v_next_version, new_key.encrypted_key_ct,
    new_key.key_fingerprint, 'active', v_actor_email, previous_key.id,
    v_rotation_reason, jsonb_build_object(
      'source', 'supplier_key_rotation_v2',
      'pair_fingerprint', v_new_pair_fingerprint,
      'software_envelope', true,
      'managed_kms', false,
      'hsm_backed', false
    )
  FROM (VALUES
    ('K_META_BATCH'::text, v_meta_ciphertext, v_meta_fingerprint),
    ('K_FILE_BATCH'::text, v_file_ciphertext, v_file_fingerprint)
  ) AS new_key(key_role, encrypted_key_ct, key_fingerprint)
  JOIN batch_key_material previous_key
    ON previous_key.supplier_sub_batch_id = v_supplier_sub_batch_id
   AND previous_key.tenant_id = v_tenant_id
   AND previous_key.key_role = new_key.key_role
   AND previous_key.key_version = v_expected_pair_version
   AND previous_key.status = 'rotated';
  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  IF v_inserted_count <> 2 THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'supplier_key_rotation_insert_conflict';
  END IF;

  UPDATE batch_keys bk
  SET meta_key_ct = v_meta_ciphertext,
      file_key_ct = v_file_ciphertext,
      key_fingerprint = v_new_pair_fingerprint,
      key_version = v_next_version,
      status = 'active',
      created_by = v_actor_email,
      rotated_at = now()
  WHERE bk.id = v_expected_pair_id
    AND bk.supplier_sub_batch_id = v_supplier_sub_batch_id
    AND bk.tenant_id = v_tenant_id
    AND bk.key_version = v_expected_pair_version
    AND upper(bk.key_fingerprint) = v_expected_pair_fingerprint
    AND bk.export_count = 0;
  GET DIAGNOSTICS v_pair_count = ROW_COUNT;
  IF v_pair_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'supplier_key_rotation_pair_conflict';
  END IF;

  UPDATE batches b
  SET meta_key_ct = v_meta_ciphertext,
      file_key_ct = v_file_ciphertext,
      sdm_config = COALESCE(b.sdm_config, '{}'::jsonb) || jsonb_build_object(
        'key_version', v_next_version,
        'key_rotated_at', now(),
        'key_rotation_policy', 'pre_export_only'
      )
  WHERE b.id = v_batch_id
    AND b.tenant_id = v_tenant_id
    AND lower(b.status::text) NOT IN ('active', 'active_in_market');
  GET DIAGNOSTICS v_batch_count = ROW_COUNT;
  IF v_batch_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'supplier_key_rotation_batch_conflict';
  END IF;

  UPDATE supplier_sub_batches ssb
  SET metadata_json = COALESCE(ssb.metadata_json, '{}'::jsonb) || jsonb_build_object(
        'key_fingerprint', v_new_pair_fingerprint,
        'key_version', v_next_version,
        'rotated_by', v_actor_email,
        'rotation_reason', v_rotation_reason
      ),
      updated_at = now()
  WHERE ssb.id = v_supplier_sub_batch_id
    AND ssb.tenant_id = v_tenant_id
    AND ssb.qa_status <> 'passed'
    AND ssb.key_export_count = 0
    AND ssb.manifest_status <> 'imported'
    AND ssb.manifest_count = 0;
  GET DIAGNOSTICS v_sub_batch_count = ROW_COUNT;
  IF v_sub_batch_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'supplier_key_rotation_sub_batch_conflict';
  END IF;

  v_event_payload := jsonb_build_object(
    'schema_version', 'supplier-key-rotation/v2',
    'supplier_order_id', v_supplier_order_id,
    'supplier_sub_batch_id', v_supplier_sub_batch_id,
    'batch_id', v_batch_id,
    'bid', v_bid,
    'previous_key_version', v_expected_pair_version,
    'new_key_version', v_next_version,
    'previous_pair_fingerprint', v_expected_pair_fingerprint,
    'previous_role_fingerprints', v_previous_role_fingerprints,
    'new_pair_fingerprint', v_new_pair_fingerprint,
    'new_role_fingerprints', jsonb_build_object(
      'K_META_BATCH', v_meta_fingerprint,
      'K_FILE_BATCH', v_file_fingerprint
    ),
    'rotated_by', v_actor_email,
    'rotation_reason', v_rotation_reason,
    'physical_ceremony_verified', false,
    'software_envelope', true,
    'managed_kms', false,
    'hsm_backed', false
  );
  v_event_hash := 'sha256:' || encode(digest(jsonb_build_object(
    'schema_version', 'supplier-key-rotation-event/v2',
    'tenant_id', v_tenant_id,
    'resource_type', 'supplier_sub_batch',
    'resource_id', v_supplier_sub_batch_id,
    'event_type', 'batch_keys_rotated',
    'payload', v_event_payload
  )::text, 'sha256'), 'hex');

  INSERT INTO evidence_events (
    tenant_id, resource_type, resource_id, event_type, payload_json, payload_hash
  ) VALUES (
    v_tenant_id, 'supplier_sub_batch', v_supplier_sub_batch_id::text,
    'batch_keys_rotated', v_event_payload, v_event_hash
  );

  INSERT INTO vault_artifacts (
    tenant_id, supplier_order_id, supplier_sub_batch_id, resource_type, resource_id,
    artifact_type, content_hash, mime_type, metadata_json
  ) VALUES (
    v_tenant_id, v_supplier_order_id, v_supplier_sub_batch_id,
    'supplier_sub_batch', v_supplier_sub_batch_id::text,
    'batch_key_rotation_report', v_event_hash, 'application/json',
    v_event_payload - 'previous_role_fingerprints' - 'new_role_fingerprints'
  );

  INSERT INTO audit_logs (
    actor_id, tenant_id, action, resource_type, resource_id,
    before_hash, after_hash, ip_address, user_agent, request_id
  ) VALUES (
    v_actor_id, v_tenant_id, 'supplier_batch_keys_rotated',
    'supplier_sub_batch', v_supplier_sub_batch_id::text,
    encode(digest(jsonb_build_object(
      'key_version', v_expected_pair_version,
      'key_fingerprint', v_expected_pair_fingerprint
    )::text, 'sha256'), 'hex'),
    encode(digest(v_event_payload::text, 'sha256'), 'hex'), NULL,
    NULLIF(left(COALESCE(p_input->>'user_agent', ''), 1024), ''),
    NULLIF(left(COALESCE(p_input->>'request_id', ''), 160), '')
  );

  RETURN QUERY SELECT
    v_tenant_id,
    v_supplier_order_id,
    v_supplier_sub_batch_id,
    v_batch_id,
    v_bid,
    v_expected_pair_version,
    v_next_version,
    v_expected_pair_fingerprint,
    v_previous_role_fingerprints,
    v_new_pair_fingerprint,
    jsonb_build_object(
      'K_META_BATCH', v_meta_fingerprint,
      'K_FILE_BATCH', v_file_fingerprint
    ),
    v_event_hash,
    v_rotated_count,
    v_inserted_count,
    v_pair_count,
    v_batch_count,
    v_sub_batch_count;
END;
$rotate_v2$;

REVOKE ALL ON FUNCTION public.nexid_supplier_key_rotation_v2_capability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_rotate_supplier_batch_keys_v2(jsonb) FROM PUBLIC;
