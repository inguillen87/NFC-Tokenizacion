-- Supplier order provisioning v2: create the order, batches, sub-batches,
-- wrapped key records, evidence, and audit receipt in one database transaction.
--
-- Raw NFC keys never enter this function. The application supplies only
-- context-bound software envelopes and non-secret fingerprints. This is not
-- managed KMS or HSM custody evidence and does not alter SUN/SDM/CMAC or the
-- physical NTAG 424 DNA / TagTamper verification path.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Static and identifier-only carriers do not have SUN application keys. These
-- legacy columns stay available for secure SUN batches, but are nullable so a
-- keyless carrier never needs a fake/sentinel ciphertext.
ALTER TABLE batches ALTER COLUMN meta_key_ct DROP NOT NULL;
ALTER TABLE batches ALTER COLUMN file_key_ct DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.nexid_supplier_order_create_v2_capability()
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT 'supplier-order-create/v2'::text
$$;

CREATE OR REPLACE FUNCTION public.nexid_supplier_order_create_keyless_v1_capability()
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT 'supplier-order-create/keyless-carrier-v1'::text
$$;

CREATE OR REPLACE FUNCTION public.nexid_create_supplier_order_v2(p_input jsonb)
RETURNS TABLE (
  supplier_order jsonb,
  sub_batches jsonb
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $supplier_order_v2$
DECLARE
  v_supplier_order_id uuid;
  v_tenant_id uuid;
  v_actor_id uuid;
  v_auth_session_id uuid;
  v_actor_email text;
  v_customer_slug text;
  v_order_name text;
  v_base_batch_id text;
  v_total_quantity integer;
  v_sub_batch_size integer;
  v_chip_model text;
  v_carrier_profile_code text;
  v_pack_purpose text;
  v_material_type text;
  v_notes text;
  v_request_id text;
  v_user_agent text;
  v_items jsonb;
  v_item jsonb;
  v_order supplier_orders%ROWTYPE;
  v_batch_id uuid;
  v_sub_batch_id uuid;
  v_bid text;
  v_sequence_index integer;
  v_expected_quantity integer;
  v_meta_key_ct text;
  v_file_key_ct text;
  v_pair_fingerprint text;
  v_meta_fingerprint text;
  v_file_fingerprint text;
  v_url_template text;
  v_sdm_config jsonb;
  v_event_payload jsonb;
  v_event_hash text;
  v_results jsonb := '[]'::jsonb;
  v_planned_quantity integer;
  v_item_count integer;
  v_secure_sun boolean;
BEGIN
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR octet_length(p_input::text) > 4194304 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_order_input_invalid';
  END IF;

  BEGIN
    v_supplier_order_id := NULLIF(trim(p_input->>'supplier_order_id'), '')::uuid;
    v_tenant_id := NULLIF(trim(p_input->>'tenant_id'), '')::uuid;
    v_actor_id := NULLIF(trim(p_input->>'actor_id'), '')::uuid;
    v_auth_session_id := NULLIF(trim(p_input->>'auth_session_id'), '')::uuid;
    v_total_quantity := NULLIF(trim(p_input->>'total_quantity'), '')::integer;
    v_sub_batch_size := NULLIF(trim(p_input->>'sub_batch_size'), '')::integer;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_order_identity_invalid';
  END;

  v_customer_slug := lower(trim(COALESCE(p_input->>'customer_slug', '')));
  v_order_name := trim(COALESCE(p_input->>'order_name', ''));
  v_base_batch_id := upper(trim(COALESCE(p_input->>'base_batch_id', '')));
  v_chip_model := trim(COALESCE(p_input->>'chip_model', ''));
  v_carrier_profile_code := lower(trim(COALESCE(p_input->>'carrier_profile_code', '')));
  v_pack_purpose := lower(trim(COALESCE(p_input->>'pack_purpose', '')));
  v_material_type := NULLIF(trim(COALESCE(p_input->>'material_type', '')), '');
  v_notes := NULLIF(trim(COALESCE(p_input->>'notes', '')), '');
  v_request_id := NULLIF(left(trim(COALESCE(p_input->>'request_id', '')), 160), '');
  v_user_agent := NULLIF(left(trim(COALESCE(p_input->>'user_agent', '')), 1024), '');
  v_items := p_input->'sub_batches';
  v_secure_sun := v_carrier_profile_code IN ('ntag424_dna', 'ntag424_dna_tt');

  IF v_supplier_order_id IS NULL
    OR v_tenant_id IS NULL
    OR v_actor_id IS NULL
    OR v_auth_session_id IS NULL
    OR v_customer_slug !~ '^[a-z0-9][a-z0-9-]{0,62}$'
    OR octet_length(v_order_name) NOT BETWEEN 1 AND 200
    OR octet_length(v_base_batch_id) NOT BETWEEN 1 AND 128
    OR octet_length(v_chip_model) NOT BETWEEN 1 AND 128
    OR v_carrier_profile_code NOT IN (
      'qr_basic', 'gs1_digital_link', 'ntag213', 'ntag215', 'ntag216',
      'ntag424_dna', 'ntag424_dna_tt', 'uhf_rfid', 'event_wristband',
      'hotel_keycard', 'iot_tracker_placeholder'
    )
    OR v_pack_purpose NOT IN ('trial_integration', 'production')
    OR v_total_quantity IS NULL OR v_total_quantity < 1 OR v_total_quantity > 100000000
    OR v_sub_batch_size IS NULL OR v_sub_batch_size < 1 OR v_sub_batch_size > v_total_quantity
    OR COALESCE(octet_length(v_material_type), 0) > 200
    OR COALESCE(octet_length(v_notes), 0) > 4000
    OR jsonb_typeof(v_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_order_payload_invalid';
  END IF;

  v_item_count := jsonb_array_length(v_items);
  IF v_item_count NOT BETWEEN 1 AND 52 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_order_sub_batch_count_invalid';
  END IF;

  SELECT lower(actor.email)
    INTO v_actor_email
  FROM auth_sessions auth_session
  JOIN users actor ON actor.id = auth_session.user_id
  JOIN memberships membership
    ON membership.user_id = actor.id
   AND membership.role = auth_session.role
   AND membership.tenant_id IS NOT DISTINCT FROM auth_session.tenant_id
  WHERE auth_session.id = v_auth_session_id
    AND auth_session.user_id = v_actor_id
    AND auth_session.role::text = 'super_admin'
    AND auth_session.tenant_id IS NULL
    AND auth_session.revoked_at IS NULL
    AND auth_session.expires_at > now()
    AND actor.admin_status::text = 'active'
    AND membership.role::text = 'super_admin'
    AND membership.tenant_id IS NULL
  FOR SHARE OF auth_session, actor, membership;
  IF NOT FOUND
    OR v_actor_email !~ '^[^[:space:]@]+@[^[:space:]@]+$'
    OR NOT EXISTS (SELECT 1 FROM tenants tenant WHERE tenant.id = v_tenant_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'supplier_order_actor_scope_invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_items) AS item(value)
    WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'object'
      OR COALESCE(item.value->>'sequence_index', '') !~ '^[1-9][0-9]{0,2}$'
      OR COALESCE(item.value->>'expected_quantity', '') !~ '^[1-9][0-9]{0,8}$'
      OR upper(trim(COALESCE(item.value->>'bid', ''))) !~ '^[A-Z0-9][A-Z0-9._:-]{2,127}$'
      OR COALESCE(
        NULLIF(item.value->>'key_material_mode', ''),
        CASE WHEN v_secure_sun THEN 'secure_sun' ELSE 'none' END
      ) <> CASE WHEN v_secure_sun THEN 'secure_sun' ELSE 'none' END
      OR (
        v_secure_sun AND (
          upper(trim(COALESCE(item.value->>'pair_fingerprint', ''))) !~ '^[0-9A-F]{16}$'
          OR upper(trim(COALESCE(item.value->>'meta_key_fingerprint', ''))) !~ '^[0-9A-F]{16}$'
          OR upper(trim(COALESCE(item.value->>'file_key_fingerprint', ''))) !~ '^[0-9A-F]{16}$'
          OR octet_length(trim(COALESCE(item.value->>'meta_key_ct', ''))) NOT BETWEEN 40 AND 16384
          OR octet_length(trim(COALESCE(item.value->>'file_key_ct', ''))) NOT BETWEEN 40 AND 16384
          OR trim(COALESCE(item.value->>'meta_key_ct', '')) !~ '^nexid-app-envelope-v2\.'
          OR trim(COALESCE(item.value->>'file_key_ct', '')) !~ '^nexid-app-envelope-v2\.'
        )
      )
      OR (
        NOT v_secure_sun AND (
          item.value ? 'pair_fingerprint'
          OR item.value ? 'meta_key_fingerprint'
          OR item.value ? 'file_key_fingerprint'
          OR item.value ? 'meta_key_ct'
          OR item.value ? 'file_key_ct'
        )
      )
      OR octet_length(trim(COALESCE(item.value->>'url_template', ''))) NOT BETWEEN 8 AND 2048
      OR jsonb_typeof(item.value->'sdm_config') IS DISTINCT FROM 'object'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_order_sub_batch_payload_invalid';
  END IF;

  IF EXISTS (
    SELECT upper(trim(item.value->>'bid'))
    FROM jsonb_array_elements(v_items) AS item(value)
    GROUP BY upper(trim(item.value->>'bid'))
    HAVING count(*) <> 1
  ) OR EXISTS (
    SELECT (item.value->>'sequence_index')::integer
    FROM jsonb_array_elements(v_items) AS item(value)
    GROUP BY (item.value->>'sequence_index')::integer
    HAVING count(*) <> 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_order_sub_batch_identity_duplicate';
  END IF;

  SELECT COALESCE(sum((item.value->>'expected_quantity')::integer), 0)::integer
    INTO v_planned_quantity
  FROM jsonb_array_elements(v_items) AS item(value);
  IF v_planned_quantity IS DISTINCT FROM v_total_quantity THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_order_quantity_plan_mismatch';
  END IF;

  -- Lock every BID namespace in deterministic order before checking either
  -- table. This closes concurrent cross-table creates even though the legacy
  -- schema has one uniqueness constraint per table rather than one namespace.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'supplier-bid' || chr(31) || upper(trim(item.value->>'bid')),
    0
  ))
  FROM jsonb_array_elements(v_items) AS item(value)
  ORDER BY upper(trim(item.value->>'bid'));

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_items) AS item(value)
    WHERE EXISTS (
      SELECT 1 FROM batches batch
      WHERE upper(batch.bid) = upper(trim(item.value->>'bid'))
    ) OR EXISTS (
      SELECT 1 FROM supplier_sub_batches sub_batch
      WHERE upper(sub_batch.bid) = upper(trim(item.value->>'bid'))
    )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'supplier_order_bid_already_exists';
  END IF;

  INSERT INTO supplier_orders (
    id, tenant_id, customer_slug, order_name, base_batch_id, total_quantity,
    sub_batch_size, chip_model, carrier_profile_code, pack_purpose,
    purpose_locked_at, purpose_locked_by, material_type, notes, status, created_by
  ) VALUES (
    v_supplier_order_id, v_tenant_id, v_customer_slug, v_order_name, v_base_batch_id,
    v_total_quantity, v_sub_batch_size, v_chip_model, v_carrier_profile_code,
    v_pack_purpose, now(), v_actor_id, v_material_type, v_notes,
    'pack_ready', v_actor_email
  )
  RETURNING * INTO v_order;

  FOR v_item IN
    SELECT item.value
    FROM jsonb_array_elements(v_items) AS item(value)
    ORDER BY (item.value->>'sequence_index')::integer
  LOOP
    v_bid := upper(trim(v_item->>'bid'));
    v_sequence_index := (v_item->>'sequence_index')::integer;
    v_expected_quantity := (v_item->>'expected_quantity')::integer;
    v_meta_key_ct := NULLIF(trim(COALESCE(v_item->>'meta_key_ct', '')), '');
    v_file_key_ct := NULLIF(trim(COALESCE(v_item->>'file_key_ct', '')), '');
    v_pair_fingerprint := NULLIF(upper(trim(COALESCE(v_item->>'pair_fingerprint', ''))), '');
    v_meta_fingerprint := NULLIF(upper(trim(COALESCE(v_item->>'meta_key_fingerprint', ''))), '');
    v_file_fingerprint := NULLIF(upper(trim(COALESCE(v_item->>'file_key_fingerprint', ''))), '');
    v_url_template := trim(v_item->>'url_template');
    v_sdm_config := v_item->'sdm_config';

    IF upper(COALESCE(v_sdm_config->>'supplier_order_id', '')) <> upper(v_order.id::text)
      OR COALESCE(v_sdm_config->>'supplier_sequence_index', '') <> v_sequence_index::text
      OR lower(COALESCE(v_sdm_config->>'carrier_profile_code', '')) <> v_carrier_profile_code
      OR COALESCE(v_sdm_config->>'requested_quantity', '') <> v_expected_quantity::text
      OR COALESCE(v_sdm_config->>'url_template', '') <> v_url_template
      OR COALESCE(
        NULLIF(v_sdm_config->>'key_material_mode', ''),
        CASE WHEN v_secure_sun THEN 'secure_sun' ELSE 'none' END
      ) <> (CASE WHEN v_secure_sun THEN 'secure_sun' ELSE 'none' END)
      OR (v_secure_sun AND COALESCE(v_sdm_config->>'key_version', '') <> '1')
      OR (NOT v_secure_sun AND v_sdm_config ? 'key_version') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_order_sdm_binding_invalid';
    END IF;

    INSERT INTO batches (
      tenant_id, bid, status, meta_key_ct, file_key_ct, sdm_config,
      carrier_profile_code, supplier_order_id, expected_quantity,
      manifest_status, qa_status
    ) VALUES (
      v_tenant_id, v_bid, 'production_registered', v_meta_key_ct,
      v_file_key_ct, v_sdm_config, v_carrier_profile_code, v_order.id,
      v_expected_quantity, 'pending', 'pending'
    )
    RETURNING id INTO v_batch_id;

    INSERT INTO supplier_sub_batches (
      supplier_order_id, tenant_id, batch_id, bid, sequence_index,
      expected_quantity, pack_purpose, status, metadata_json
    ) VALUES (
      v_order.id, v_tenant_id, v_batch_id, v_bid, v_sequence_index,
      v_expected_quantity, v_pack_purpose, 'pack_ready',
      jsonb_strip_nulls(jsonb_build_object(
        'url_template', v_url_template,
        'key_fingerprint', v_pair_fingerprint,
        'key_material_mode', CASE WHEN v_secure_sun THEN 'secure_sun' ELSE 'none' END,
        'software_envelope', v_secure_sun,
        'managed_kms', false,
        'hsm_backed', false
      ))
    )
    RETURNING id INTO v_sub_batch_id;

    UPDATE batches
    SET supplier_sub_batch_id = v_sub_batch_id
    WHERE id = v_batch_id AND tenant_id = v_tenant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'supplier_order_batch_binding_conflict';
    END IF;

    IF v_secure_sun THEN
      INSERT INTO batch_keys (
        tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid,
        meta_key_ct, file_key_ct, key_fingerprint, key_version, created_by
      ) VALUES (
        v_tenant_id, v_order.id, v_sub_batch_id, v_batch_id, v_bid,
        v_meta_key_ct, v_file_key_ct, v_pair_fingerprint, 1, v_actor_email
      );

      INSERT INTO batch_key_material (
        tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid,
        key_role, key_version, encrypted_key_ct, key_fingerprint, status,
        created_by, metadata_json
      ) VALUES
        (
          v_tenant_id, v_order.id, v_sub_batch_id, v_batch_id, v_bid,
          'K_META_BATCH', 1, v_meta_key_ct, v_meta_fingerprint, 'active',
          v_actor_email, jsonb_build_object(
            'source', 'supplier_order_create_v2',
            'pair_fingerprint', v_pair_fingerprint,
            'software_envelope', true,
            'managed_kms', false,
            'hsm_backed', false
          )
        ),
        (
          v_tenant_id, v_order.id, v_sub_batch_id, v_batch_id, v_bid,
          'K_FILE_BATCH', 1, v_file_key_ct, v_file_fingerprint, 'active',
          v_actor_email, jsonb_build_object(
            'source', 'supplier_order_create_v2',
            'pair_fingerprint', v_pair_fingerprint,
            'software_envelope', true,
            'managed_kms', false,
            'hsm_backed', false
          )
        );
    END IF;

    v_event_payload := jsonb_build_object(
      'schema_version', 'supplier-order-create/v2',
      'supplier_order_id', v_order.id,
      'supplier_sub_batch_id', v_sub_batch_id,
      'batch_id', v_batch_id,
      'bid', v_bid,
      'sequence_index', v_sequence_index,
      'expected_quantity', v_expected_quantity,
      'carrier_profile_code', v_carrier_profile_code,
      'pack_purpose', v_pack_purpose,
      'commercial_release', CASE WHEN v_pack_purpose = 'trial_integration'
        THEN 'NON_SELLABLE_TRIAL' ELSE 'BLOCKED_PENDING_PRODUCTION_QA' END,
      'key_material_mode', CASE WHEN v_secure_sun THEN 'secure_sun' ELSE 'none' END,
      'key_version', CASE WHEN v_secure_sun THEN 1 ELSE NULL END,
      'key_fingerprint', v_pair_fingerprint,
      'physical_ceremony_verified', false,
      'software_envelope', v_secure_sun,
      'managed_kms', false,
      'hsm_backed', false
    );
    v_event_hash := 'sha256:' || encode(digest(jsonb_build_object(
      'schema_version', 'supplier-order-create-event/v2',
      'tenant_id', v_tenant_id,
      'resource_type', 'supplier_sub_batch',
      'resource_id', v_sub_batch_id,
      'event_type', 'batch_created',
      'payload', v_event_payload
    )::text, 'sha256'), 'hex');

    INSERT INTO evidence_events (
      tenant_id, resource_type, resource_id, event_type, payload_json, payload_hash
    ) VALUES (
      v_tenant_id, 'supplier_sub_batch', v_sub_batch_id::text,
      'batch_created', v_event_payload, v_event_hash
    );

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'id', v_sub_batch_id,
      'bid', v_bid,
      'batch_id', v_batch_id,
      'sequence_index', v_sequence_index,
      'expected_quantity', v_expected_quantity,
      'key_fingerprint', v_pair_fingerprint,
      'url_template', v_url_template
    ));
  END LOOP;

  INSERT INTO audit_logs (
    actor_id, tenant_id, action, resource_type, resource_id,
    after_hash, user_agent, request_id
  ) VALUES (
    v_actor_id, v_tenant_id, 'supplier_order_created',
    'supplier_order', v_order.id::text,
    encode(digest(jsonb_build_object(
      'schema_version', 'supplier-order-create-audit/v2',
      'supplier_order_id', v_order.id,
      'tenant_id', v_tenant_id,
      'sub_batches', v_results - 'key_fingerprint'
    )::text, 'sha256'), 'hex'),
    v_user_agent, v_request_id
  );

  RETURN QUERY SELECT to_jsonb(v_order), v_results;
END;
$supplier_order_v2$;

REVOKE ALL ON FUNCTION public.nexid_supplier_order_create_v2_capability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_order_create_keyless_v1_capability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_create_supplier_order_v2(jsonb) FROM PUBLIC;
