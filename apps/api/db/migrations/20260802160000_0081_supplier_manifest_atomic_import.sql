-- Manifest import v2: global UID ownership plus one atomic import transaction.
-- This migration preserves the physical SUN/SDM/CMAC verification path. It
-- stores only manifest data, public payload fingerprints, and existing
-- software-envelope metadata; it does not introduce or claim HSM custody.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.nexid_jsonb_contains_secret_key_v1(
  p_value jsonb,
  p_depth integer
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $secret_key_scan$
DECLARE
  v_key text;
  v_child jsonb;
  v_normalized_key text;
BEGIN
  IF p_value IS NULL OR p_value = 'null'::jsonb THEN
    RETURN false;
  END IF;
  -- Treat excessive nesting as sensitive rather than risking an unbounded
  -- recursive parse of untrusted manifest metadata.
  IF p_depth > 12 THEN
    RETURN true;
  END IF;
  IF jsonb_typeof(p_value) = 'object' THEN
    FOR v_key, v_child IN SELECT key, value FROM jsonb_each(p_value)
    LOOP
      v_normalized_key := regexp_replace(lower(v_key), '[^a-z0-9]+', '_', 'g');
      IF v_normalized_key ~ '^(k_?meta(?:_?hex)?|k_?file(?:_?hex)?|key_?(?:meta|file)|meta_?key(?:_?(?:hex|ct))?|file_?key(?:_?(?:hex|ct))?|master_?key|root_?key|private_?key|secret(?:_?key)?|client_?secret|access_?token|refresh_?token|bearer_?token|auth_?token|encryption_?key|decryption_?key|api_?key|password|passphrase|mnemonic(?:_?phrase)?|seed_?phrase|(?:wallet|signing|recovery|secret)_?seed)$' THEN
        RETURN true;
      END IF;
      IF jsonb_typeof(v_child) IN ('object', 'array')
        AND public.nexid_jsonb_contains_secret_key_v1(v_child, p_depth + 1) THEN
        RETURN true;
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(p_value) = 'array' THEN
    FOR v_child IN SELECT value FROM jsonb_array_elements(p_value)
    LOOP
      IF jsonb_typeof(v_child) IN ('object', 'array')
        AND public.nexid_jsonb_contains_secret_key_v1(v_child, p_depth + 1) THEN
        RETURN true;
      END IF;
    END LOOP;
  END IF;
  RETURN false;
END;
$secret_key_scan$;

CREATE OR REPLACE FUNCTION public.nexid_jsonb_contains_secret_key_v1(p_value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT public.nexid_jsonb_contains_secret_key_v1(p_value, 0)
$$;

-- The historical request-path helper created this table outside the migration
-- ledger. Materialize it here so production requests remain DDL-free.
CREATE TABLE IF NOT EXISTS tag_sun_payloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE,
  uid_hex text NOT NULL,
  bid text NOT NULL,
  raw_url_hash text,
  picc_data_hash text NOT NULL,
  enc_hash text NOT NULL,
  cmac_hash text NOT NULL,
  source text NOT NULL DEFAULT 'supplier_manifest',
  status text NOT NULL DEFAULT 'active',
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, raw_url_hash),
  UNIQUE (batch_id, picc_data_hash, cmac_hash)
);

CREATE INDEX IF NOT EXISTS idx_tag_sun_payloads_uid
  ON tag_sun_payloads(batch_id, upper(uid_hex));
CREATE INDEX IF NOT EXISTS idx_tag_sun_payloads_hashes
  ON tag_sun_payloads(batch_id, picc_data_hash, enc_hash, cmac_hash);

-- An NXP IC UID is a physical identity, not a tenant-local label. Refuse to
-- install a misleading global ownership constraint if historical collisions
-- already exist; operators must investigate and correct those rows explicitly.
DO $tag_uid_global_preflight$
DECLARE
  v_duplicate_uid text;
BEGIN
  SELECT upper(trim(tag.uid_hex))
    INTO v_duplicate_uid
  FROM tags tag
  GROUP BY upper(trim(tag.uid_hex))
  HAVING count(*) > 1
  ORDER BY upper(trim(tag.uid_hex))
  LIMIT 1;
  IF v_duplicate_uid IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'tag_uid_global_uniqueness_preflight_failed',
      DETAIL = 'At least one physical UID is assigned to multiple tag rows.',
      HINT = 'Investigate duplicate UID ownership before applying migration 0081.';
  END IF;
END;
$tag_uid_global_preflight$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tags_uid_hex_global
  ON tags (upper(trim(uid_hex)));

CREATE OR REPLACE FUNCTION public.nexid_supplier_manifest_import_v2_capability()
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT 'supplier-manifest-import/v2'::text
$$;

CREATE OR REPLACE FUNCTION public.nexid_import_tag_manifest_v2(p_input jsonb)
RETURNS TABLE (
  manifest_id uuid,
  inserted_count integer,
  reactivated_count integer,
  registered_sun_payload_count integer,
  evidence_event_hashes jsonb
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $manifest_v2$
DECLARE
  v_tenant_id uuid;
  v_batch_id uuid;
  v_supplier_order_id uuid;
  v_supplier_sub_batch_id uuid;
  v_actor_id uuid;
  v_auth_session_id uuid;
  v_actor_email text;
  v_actor_role text;
  v_bid text;
  v_carrier_profile_code text;
  v_manifest_type text;
  v_content_hash text;
  v_activate_imported boolean;
  v_rows jsonb;
  v_row jsonb;
  v_row_count integer;
  v_expected_quantity integer;
  v_override_reason text;
  v_request_id text;
  v_user_agent text;
  v_batch record;
  v_sub_batch record;
  v_tag record;
  v_uid text;
  v_row_carrier text;
  v_profile jsonb;
  v_sun jsonb;
  v_sun_payload_id uuid;
  v_inserted integer := 0;
  v_reactivated integer := 0;
  v_registered_sun integer := 0;
  v_manifest_id uuid;
  v_event_payload jsonb;
  v_event_type text;
  v_event_hash text;
  v_event_hashes jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR octet_length(p_input::text) > 67108864 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_manifest_input_invalid';
  END IF;

  BEGIN
    v_tenant_id := NULLIF(trim(p_input->>'tenant_id'), '')::uuid;
    v_batch_id := NULLIF(trim(p_input->>'batch_id'), '')::uuid;
    v_supplier_order_id := NULLIF(trim(p_input->>'supplier_order_id'), '')::uuid;
    v_supplier_sub_batch_id := NULLIF(trim(p_input->>'supplier_sub_batch_id'), '')::uuid;
    v_actor_id := NULLIF(trim(p_input->>'actor_id'), '')::uuid;
    v_auth_session_id := NULLIF(trim(p_input->>'auth_session_id'), '')::uuid;
    v_expected_quantity := NULLIF(trim(p_input->>'expected_quantity'), '')::integer;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_manifest_identity_invalid';
  END;

  v_bid := upper(trim(COALESCE(p_input->>'bid', '')));
  v_carrier_profile_code := lower(trim(COALESCE(p_input->>'carrier_profile_code', '')));
  v_manifest_type := lower(trim(COALESCE(p_input->>'manifest_type', '')));
  v_content_hash := lower(trim(COALESCE(p_input->>'content_hash', '')));
  v_rows := p_input->'rows';
  v_request_id := NULLIF(left(trim(COALESCE(p_input->>'request_id', '')), 160), '');
  v_user_agent := NULLIF(left(trim(COALESCE(p_input->>'user_agent', '')), 1024), '');
  v_override_reason := trim(COALESCE(p_input #>> '{quantity_override,reason}', ''));
  IF lower(COALESCE(p_input->>'activate_imported', 'false')) NOT IN ('true', 'false') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_manifest_activation_flag_invalid';
  END IF;
  v_activate_imported := lower(COALESCE(p_input->>'activate_imported', 'false')) = 'true';

  IF v_tenant_id IS NULL OR v_batch_id IS NULL OR v_actor_id IS NULL OR v_auth_session_id IS NULL
    OR v_bid !~ '^[A-Z0-9][A-Z0-9._:-]{2,127}$'
    OR v_carrier_profile_code NOT IN (
      'qr_basic', 'gs1_digital_link', 'ntag213', 'ntag215', 'ntag216',
      'ntag424_dna', 'ntag424_dna_tt', 'uhf_rfid', 'event_wristband',
      'hotel_keycard', 'iot_tracker_placeholder'
    )
    OR v_manifest_type NOT IN ('csv', 'txt')
    OR v_content_hash !~ '^sha256:[0-9a-f]{64}$'
    OR jsonb_typeof(v_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_manifest_contract_invalid';
  END IF;

  v_row_count := jsonb_array_length(v_rows);
  IF v_row_count NOT BETWEEN 1 AND 100000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_manifest_row_count_invalid';
  END IF;

  SELECT auth_session.role::text, lower(actor.email)
    INTO v_actor_role, v_actor_email
  FROM auth_sessions auth_session
  JOIN users actor ON actor.id = auth_session.user_id
  JOIN memberships membership
    ON membership.user_id = actor.id
   AND membership.role = auth_session.role
   AND membership.tenant_id IS NOT DISTINCT FROM auth_session.tenant_id
  WHERE auth_session.id = v_auth_session_id
    AND auth_session.user_id = v_actor_id
    AND auth_session.revoked_at IS NULL
    AND auth_session.expires_at > now()
    AND actor.admin_status::text = 'active'
    AND (
      (auth_session.role::text = 'super_admin' AND auth_session.tenant_id IS NULL)
      OR (auth_session.role::text = 'tenant_admin' AND auth_session.tenant_id = v_tenant_id)
    )
  FOR SHARE OF auth_session, actor, membership;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'supplier_manifest_actor_scope_invalid';
  END IF;

  -- All supplier-pack operations use this namespace before locking order,
  -- sub-batch, or batch rows. Acquiring it here avoids an inverse row/advisory
  -- lock order against purpose classification and production QA workflows.
  IF v_supplier_order_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'supplier-pack-purpose' || chr(31) || v_supplier_order_id::text,
      0
    ));
  END IF;

  SELECT
    batch.id, batch.tenant_id, upper(batch.bid) AS bid,
    lower(batch.status::text) AS status,
    lower(batch.carrier_profile_code) AS carrier_profile_code,
    batch.supplier_order_id, batch.supplier_sub_batch_id,
    batch.expected_quantity, batch.manifest_status, batch.qa_status
  INTO v_batch
  FROM batches batch
  WHERE batch.id = v_batch_id
    AND batch.tenant_id = v_tenant_id
    AND upper(batch.bid) = v_bid
  FOR UPDATE OF batch;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'supplier_manifest_batch_not_found';
  END IF;
  IF v_batch.status NOT IN ('production_registered', 'active_in_market', 'active') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_manifest_batch_state_invalid';
  END IF;
  IF v_batch.carrier_profile_code IS DISTINCT FROM v_carrier_profile_code THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'supplier_manifest_carrier_mismatch';
  END IF;

  IF v_batch.supplier_order_id IS NULL AND v_batch.supplier_sub_batch_id IS NULL THEN
    IF v_supplier_order_id IS NOT NULL OR v_supplier_sub_batch_id IS NOT NULL OR v_expected_quantity IS NOT NULL
      OR v_override_reason <> '' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'supplier_manifest_non_supplier_scope_invalid';
    END IF;
  ELSE
    IF v_supplier_order_id IS NULL OR v_supplier_sub_batch_id IS NULL
      OR v_batch.supplier_order_id IS DISTINCT FROM v_supplier_order_id
      OR v_batch.supplier_sub_batch_id IS DISTINCT FROM v_supplier_sub_batch_id THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'supplier_manifest_supplier_scope_mismatch';
    END IF;

    SELECT
      sub_batch.id, sub_batch.tenant_id, sub_batch.supplier_order_id,
      sub_batch.batch_id, upper(sub_batch.bid) AS bid,
      sub_batch.expected_quantity, lower(sub_batch.manifest_status) AS manifest_status,
      sub_batch.manifest_count, lower(sub_batch.qa_status) AS qa_status,
      lower(sub_batch.status) AS status
    INTO v_sub_batch
    FROM supplier_sub_batches sub_batch
    JOIN supplier_orders supplier_order
      ON supplier_order.id = sub_batch.supplier_order_id
     AND supplier_order.tenant_id = sub_batch.tenant_id
    WHERE sub_batch.id = v_supplier_sub_batch_id
      AND sub_batch.supplier_order_id = v_supplier_order_id
      AND sub_batch.batch_id = v_batch_id
      AND sub_batch.tenant_id = v_tenant_id
      AND upper(sub_batch.bid) = v_bid
    FOR UPDATE OF sub_batch, supplier_order;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'supplier_manifest_sub_batch_not_found';
    END IF;
    IF v_sub_batch.manifest_status = 'imported' OR v_sub_batch.manifest_count <> 0 THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_manifest_immutable';
    END IF;
    IF v_sub_batch.qa_status = 'passed'
      OR v_sub_batch.status IN ('activated', 'partially_activated', 'active') THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_manifest_state_ineligible';
    END IF;
    IF v_activate_imported THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_manifest_activation_requires_qa';
    END IF;
    IF v_expected_quantity IS DISTINCT FROM v_sub_batch.expected_quantity THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'supplier_manifest_expected_quantity_mismatch';
    END IF;
    IF v_row_count <> v_sub_batch.expected_quantity THEN
      IF v_actor_role <> 'super_admin' THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'supplier_manifest_quantity_override_forbidden';
      END IF;
      IF octet_length(v_override_reason) NOT BETWEEN 16 AND 1000 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_manifest_quantity_override_reason_required';
      END IF;
    ELSIF v_override_reason <> '' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_manifest_quantity_override_not_applicable';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_rows) AS manifest_row(value)
    WHERE jsonb_typeof(manifest_row.value) IS DISTINCT FROM 'object'
      OR upper(trim(COALESCE(manifest_row.value->>'uid_hex', ''))) !~ '^[0-9A-F]{8,32}$'
      OR lower(trim(COALESCE(manifest_row.value->>'carrier_profile_code', ''))) NOT IN (
        'qr_basic', 'gs1_digital_link', 'ntag213', 'ntag215', 'ntag216',
        'ntag424_dna', 'ntag424_dna_tt', 'uhf_rfid', 'event_wristband',
        'hotel_keycard', 'iot_tracker_placeholder'
      )
      OR (
        manifest_row.value->'profile' IS NOT NULL
        AND manifest_row.value->'profile' <> 'null'::jsonb
        AND jsonb_typeof(manifest_row.value->'profile') IS DISTINCT FROM 'object'
      )
      OR (
        manifest_row.value->'sun_payload' IS NOT NULL
        AND manifest_row.value->'sun_payload' <> 'null'::jsonb
        AND (
          jsonb_typeof(manifest_row.value->'sun_payload') IS DISTINCT FROM 'object'
          OR lower(COALESCE(manifest_row.value #>> '{sun_payload,raw_url_hash}', '')) !~ '^sha256:[0-9a-f]{64}$'
          OR lower(COALESCE(manifest_row.value #>> '{sun_payload,picc_data_hash}', '')) !~ '^sha256:[0-9a-f]{64}$'
          OR lower(COALESCE(manifest_row.value #>> '{sun_payload,enc_hash}', '')) !~ '^sha256:[0-9a-f]{64}$'
          OR lower(COALESCE(manifest_row.value #>> '{sun_payload,cmac_hash}', '')) !~ '^sha256:[0-9a-f]{64}$'
        )
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_manifest_row_invalid';
  END IF;

  -- The atomic writer accepts only its explicit normalized projection. This
  -- prevents a direct/internal caller from smuggling raw CSV columns, NFC key
  -- material, credentials, or raw SUN values into JSON storage fields.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_rows) AS manifest_row(value)
    WHERE octet_length(manifest_row.value::text) > 262144
      OR public.nexid_jsonb_contains_secret_key_v1(manifest_row.value)
      OR EXISTS (
      SELECT 1
      FROM jsonb_object_keys(CASE
        WHEN jsonb_typeof(manifest_row.value) = 'object' THEN manifest_row.value
        ELSE '{}'::jsonb
      END) AS row_key(key)
      WHERE row_key.key NOT IN ('uid_hex', 'carrier_profile_code', 'profile', 'sun_payload')
    )
      OR EXISTS (
        SELECT 1
        FROM jsonb_object_keys(CASE
          WHEN jsonb_typeof(manifest_row.value->'profile') = 'object'
            THEN manifest_row.value->'profile'
          ELSE '{}'::jsonb
        END) AS profile_key(key)
        WHERE profile_key.key NOT IN ('sku', 'product_name', 'notes', 'image_url', 'locale_data')
      )
      OR EXISTS (
        SELECT 1
        FROM jsonb_object_keys(CASE
          WHEN jsonb_typeof(manifest_row.value->'sun_payload') = 'object'
            THEN manifest_row.value->'sun_payload'
          ELSE '{}'::jsonb
        END) AS sun_key(key)
        WHERE sun_key.key NOT IN ('raw_url_hash', 'picc_data_hash', 'enc_hash', 'cmac_hash')
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_manifest_row_projection_invalid';
  END IF;

  IF EXISTS (
    SELECT upper(trim(manifest_row.value->>'uid_hex'))
    FROM jsonb_array_elements(v_rows) AS manifest_row(value)
    GROUP BY upper(trim(manifest_row.value->>'uid_hex'))
    HAVING count(*) <> 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_manifest_uid_duplicate';
  END IF;

  IF EXISTS (
    SELECT
      lower(manifest_row.value #>> '{sun_payload,picc_data_hash}'),
      lower(manifest_row.value #>> '{sun_payload,cmac_hash}')
    FROM jsonb_array_elements(v_rows) AS manifest_row(value)
    WHERE manifest_row.value->'sun_payload' IS NOT NULL
      AND manifest_row.value->'sun_payload' <> 'null'::jsonb
    GROUP BY
      lower(manifest_row.value #>> '{sun_payload,picc_data_hash}'),
      lower(manifest_row.value #>> '{sun_payload,cmac_hash}')
    HAVING count(*) > 1
  ) OR EXISTS (
    SELECT lower(manifest_row.value #>> '{sun_payload,raw_url_hash}')
    FROM jsonb_array_elements(v_rows) AS manifest_row(value)
    WHERE manifest_row.value->'sun_payload' IS NOT NULL
      AND manifest_row.value->'sun_payload' <> 'null'::jsonb
    GROUP BY lower(manifest_row.value #>> '{sun_payload,raw_url_hash}')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_manifest_sun_payload_duplicate';
  END IF;

  -- UID locks are global and ordered, so concurrent imports cannot race the
  -- precheck or deadlock each other. The unique expression index is the final
  -- database invariant for all writers, including legacy routes.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'physical-tag-uid' || chr(31) || upper(trim(manifest_row.value->>'uid_hex')),
    0
  ))
  FROM jsonb_array_elements(v_rows) AS manifest_row(value)
  ORDER BY upper(trim(manifest_row.value->>'uid_hex'));

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_rows) AS manifest_row(value)
    JOIN tags existing_tag
      ON upper(trim(existing_tag.uid_hex)) = upper(trim(manifest_row.value->>'uid_hex'))
    WHERE existing_tag.batch_id <> v_batch_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'supplier_manifest_global_uid_duplicate';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_rows) AS manifest_row(value)
    JOIN tag_sun_payloads existing_payload
      ON existing_payload.batch_id = v_batch_id
     AND (
       (
         existing_payload.picc_data_hash = lower(manifest_row.value #>> '{sun_payload,picc_data_hash}')
         AND existing_payload.cmac_hash = lower(manifest_row.value #>> '{sun_payload,cmac_hash}')
       )
       OR existing_payload.raw_url_hash = lower(manifest_row.value #>> '{sun_payload,raw_url_hash}')
     )
    WHERE manifest_row.value->'sun_payload' IS NOT NULL
      AND manifest_row.value->'sun_payload' <> 'null'::jsonb
      AND (
        existing_payload.tenant_id IS DISTINCT FROM v_tenant_id
        OR upper(trim(existing_payload.uid_hex)) IS DISTINCT FROM upper(trim(manifest_row.value->>'uid_hex'))
        OR upper(trim(existing_payload.bid)) IS DISTINCT FROM v_bid
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'supplier_manifest_sun_binding_conflict';
  END IF;

  FOR v_row IN
    SELECT manifest_row.value
    FROM jsonb_array_elements(v_rows) AS manifest_row(value)
    ORDER BY upper(trim(manifest_row.value->>'uid_hex'))
  LOOP
    v_uid := upper(trim(v_row->>'uid_hex'));
    v_row_carrier := lower(trim(v_row->>'carrier_profile_code'));
    v_profile := v_row->'profile';
    v_sun := v_row->'sun_payload';

    SELECT tag.id, tag.status::text AS status, tag.batch_id
      INTO v_tag
    FROM tags tag
    WHERE upper(trim(tag.uid_hex)) = v_uid
    FOR UPDATE OF tag;

    IF FOUND THEN
      IF v_tag.batch_id IS DISTINCT FROM v_batch_id THEN
        RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'supplier_manifest_global_uid_duplicate';
      END IF;
      UPDATE tags tag
      SET status = CASE WHEN v_activate_imported THEN 'active'::tag_status ELSE tag.status END,
          carrier_profile_code = COALESCE(tag.carrier_profile_code, v_row_carrier)
      WHERE tag.id = v_tag.id;
      IF v_activate_imported AND v_tag.status <> 'active' THEN
        v_reactivated := v_reactivated + 1;
      END IF;
    ELSE
      INSERT INTO tags (batch_id, uid_hex, status, carrier_profile_code)
      VALUES (
        v_batch_id, v_uid,
        CASE WHEN v_activate_imported THEN 'active'::tag_status ELSE 'inactive'::tag_status END,
        v_row_carrier
      )
      RETURNING id, status::text, batch_id INTO v_tag;
      v_inserted := v_inserted + 1;
    END IF;

    IF v_sun IS NOT NULL AND v_sun <> 'null'::jsonb THEN
      v_sun_payload_id := NULL;
      INSERT INTO tag_sun_payloads (
        tenant_id, batch_id, tag_id, uid_hex, bid, raw_url_hash,
        picc_data_hash, enc_hash, cmac_hash, source, status, raw_payload
      ) VALUES (
        v_tenant_id, v_batch_id, v_tag.id, v_uid, v_bid,
        lower(v_sun->>'raw_url_hash'), lower(v_sun->>'picc_data_hash'),
        lower(v_sun->>'enc_hash'), lower(v_sun->>'cmac_hash'),
        'supplier_manifest', 'active', jsonb_build_object(
          'schema_version', 'supplier-manifest-sun-reference/v1',
          'raw_values_persisted', false
        )
      )
      ON CONFLICT (batch_id, picc_data_hash, cmac_hash)
      DO UPDATE SET
        tag_id = COALESCE(EXCLUDED.tag_id, tag_sun_payloads.tag_id),
        uid_hex = EXCLUDED.uid_hex,
        raw_url_hash = EXCLUDED.raw_url_hash,
        enc_hash = EXCLUDED.enc_hash,
        source = EXCLUDED.source,
        status = 'active',
        raw_payload = EXCLUDED.raw_payload,
        updated_at = now()
      WHERE tag_sun_payloads.tenant_id = EXCLUDED.tenant_id
        AND upper(trim(tag_sun_payloads.uid_hex)) = upper(trim(EXCLUDED.uid_hex))
        AND upper(trim(tag_sun_payloads.bid)) = upper(trim(EXCLUDED.bid))
      RETURNING id INTO v_sun_payload_id;
      IF v_sun_payload_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'supplier_manifest_sun_binding_conflict';
      END IF;
      v_registered_sun := v_registered_sun + 1;
    END IF;

    IF v_profile IS NOT NULL AND v_profile <> 'null'::jsonb THEN
      IF jsonb_typeof(COALESCE(v_profile->'locale_data', '{}'::jsonb)) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_manifest_profile_invalid';
      END IF;
      INSERT INTO tag_profiles (
        tag_id, sku, product_name, notes, image_url, locale_data, carrier_profile_code
      ) VALUES (
        v_tag.id,
        NULLIF(v_profile->>'sku', ''),
        NULLIF(v_profile->>'product_name', ''),
        NULLIF(v_profile->>'notes', ''),
        NULLIF(v_profile->>'image_url', ''),
        COALESCE(v_profile->'locale_data', '{}'::jsonb),
        v_row_carrier
      )
      ON CONFLICT (tag_id) DO UPDATE SET
        sku = COALESCE(EXCLUDED.sku, tag_profiles.sku),
        product_name = COALESCE(EXCLUDED.product_name, tag_profiles.product_name),
        notes = COALESCE(EXCLUDED.notes, tag_profiles.notes),
        image_url = COALESCE(EXCLUDED.image_url, tag_profiles.image_url),
        locale_data = tag_profiles.locale_data || EXCLUDED.locale_data,
        carrier_profile_code = COALESCE(tag_profiles.carrier_profile_code, EXCLUDED.carrier_profile_code),
        updated_at = now();
    END IF;
  END LOOP;

  INSERT INTO tenant_manifests (
    tenant_id, batch_id, bid, manifest_type, row_count, inserted_count,
    reactivated_count, duplicate_count, rejected_count, content_hash,
    imported_by, import_status, errors_json, carrier_profile_code,
    supplier_order_id, supplier_sub_batch_id, expected_quantity
  ) VALUES (
    v_tenant_id, v_batch_id, v_bid, v_manifest_type, v_row_count,
    v_inserted, v_reactivated, 0, 0, v_content_hash, v_actor_email,
    'imported', jsonb_build_object(
      'registeredSunPayloads', v_registered_sun,
      'quantity_override', CASE WHEN v_override_reason <> '' THEN jsonb_build_object(
        'reason', v_override_reason,
        'override_by', v_actor_email,
        'expected', v_expected_quantity,
        'received', v_row_count
      ) ELSE NULL END
    ),
    v_carrier_profile_code, v_supplier_order_id, v_supplier_sub_batch_id,
    v_expected_quantity
  )
  RETURNING id INTO v_manifest_id;

  IF v_supplier_sub_batch_id IS NOT NULL THEN
    UPDATE supplier_sub_batches sub_batch
    SET manifest_status = 'imported',
        manifest_count = v_row_count,
        manifest_hash = v_content_hash,
        manifest_imported_at = now(),
        metadata_json = COALESCE(sub_batch.metadata_json, '{}'::jsonb) || jsonb_build_object(
          'quantity_override', CASE WHEN v_override_reason <> '' THEN jsonb_build_object(
            'reason', v_override_reason,
            'override_by', v_actor_email,
            'expected', v_expected_quantity,
            'received', v_row_count
          ) ELSE NULL END
        ),
        updated_at = now()
    WHERE sub_batch.id = v_supplier_sub_batch_id
      AND sub_batch.tenant_id = v_tenant_id
      AND sub_batch.manifest_status <> 'imported'
      AND sub_batch.manifest_count = 0;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'supplier_manifest_sub_batch_state_changed';
    END IF;

    UPDATE batches batch
    SET manifest_status = 'imported'
    WHERE batch.id = v_batch_id
      AND batch.tenant_id = v_tenant_id
      AND batch.supplier_sub_batch_id = v_supplier_sub_batch_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'supplier_manifest_batch_state_changed';
    END IF;

    INSERT INTO vault_artifacts (
      tenant_id, supplier_order_id, supplier_sub_batch_id,
      resource_type, resource_id, artifact_type, content_hash,
      mime_type, metadata_json
    ) VALUES (
      v_tenant_id, v_supplier_order_id, v_supplier_sub_batch_id,
      'supplier_sub_batch', v_supplier_sub_batch_id::text,
      'uid_manifest', v_content_hash, 'text/csv',
      jsonb_build_object(
        'bid', v_bid,
        'row_count', v_row_count,
        'manifest_type', v_manifest_type,
        'manifest_id', v_manifest_id
      )
    );

    FOREACH v_event_type IN ARRAY ARRAY['manifest_imported', 'manifest_validated']
    LOOP
      v_event_payload := jsonb_build_object(
        'schema_version', 'supplier-manifest-import/v2',
        'manifest_id', v_manifest_id,
        'supplier_order_id', v_supplier_order_id,
        'supplier_sub_batch_id', v_supplier_sub_batch_id,
        'batch_id', v_batch_id,
        'bid', v_bid,
        'row_count', v_row_count,
        'content_hash', v_content_hash,
        'carrier_profile_code', v_carrier_profile_code,
        'quantity_override', CASE WHEN v_override_reason <> '' THEN jsonb_build_object(
          'reason', v_override_reason,
          'override_by', v_actor_email,
          'expected', v_expected_quantity,
          'received', v_row_count
        ) ELSE NULL END
      );
      v_event_hash := 'sha256:' || encode(digest(jsonb_build_object(
        'schema_version', 'supplier-manifest-event/v2',
        'tenant_id', v_tenant_id,
        'resource_type', 'supplier_sub_batch',
        'resource_id', v_supplier_sub_batch_id,
        'event_type', v_event_type,
        'payload', v_event_payload
      )::text, 'sha256'), 'hex');
      INSERT INTO evidence_events (
        tenant_id, resource_type, resource_id, event_type,
        payload_json, payload_hash
      ) VALUES (
        v_tenant_id, 'supplier_sub_batch', v_supplier_sub_batch_id::text,
        v_event_type,
        v_event_payload, v_event_hash
      );
      v_event_hashes := v_event_hashes || jsonb_build_array(v_event_hash);
    END LOOP;
  END IF;

  INSERT INTO audit_logs (
    actor_id, tenant_id, action, resource_type, resource_id,
    after_hash, user_agent, request_id
  ) VALUES (
    v_actor_id, v_tenant_id, 'supplier_manifest_imported',
    CASE WHEN v_supplier_sub_batch_id IS NULL THEN 'batch' ELSE 'supplier_sub_batch' END,
    COALESCE(v_supplier_sub_batch_id::text, v_batch_id::text),
    replace(v_content_hash, 'sha256:', ''), v_user_agent, v_request_id
  );

  RETURN QUERY SELECT
    v_manifest_id, v_inserted, v_reactivated, v_registered_sun, v_event_hashes;
END;
$manifest_v2$;

REVOKE ALL ON FUNCTION public.nexid_supplier_manifest_import_v2_capability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_import_tag_manifest_v2(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_jsonb_contains_secret_key_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_jsonb_contains_secret_key_v1(jsonb, integer) FROM PUBLIC;
