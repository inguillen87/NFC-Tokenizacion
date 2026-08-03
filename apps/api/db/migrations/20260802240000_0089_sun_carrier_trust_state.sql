-- Align the durable SUN decision with the enterprise carrier contract.
-- The lifecycle wrapper introduced by 0066 keeps calling this base function,
-- so replacing it preserves the atomic replay/counter/event transaction.
DO $sun_carrier_state_preflight$
BEGIN
  IF to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'sun_carrier_state_requires_atomic_base_0062' USING ERRCODE = '42883';
  END IF;
END
$sun_carrier_state_preflight$;

CREATE OR REPLACE FUNCTION public.nexid_persist_sun_scan_v1_base_0062(p_input jsonb)
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
  created_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $sun_atomic_function$
DECLARE
  v_batch_id uuid;
  v_tenant_id uuid;
  v_registered_tag_id uuid;
  v_uid_hex text;
  v_ctr integer;
  v_picc_data_hash text;
  v_cmac_hash text;
  v_raw_url_hash text;
  v_enc_hash text;
  v_tag_id uuid;
  v_tag_status text;
  v_previous_last_seen_ctr integer;
  v_last_seen_ctr integer;
  v_scan_count integer;
  v_prior_event_id bigint;
  v_replay_original_event_id bigint;
  v_replay_suspect boolean := false;
  v_allowlisted boolean := false;
  v_crypto_verified boolean;
  v_payload_verified boolean;
  v_supplier_payload_match boolean;
  v_supplier_payload_only boolean;
  v_carrier_profile_code text;
  v_requested_product_state text;
  v_pre_registry_result text;
  v_auth_status text;
  v_response_result text;
  v_event_result text;
  v_reason text;
  v_is_authentic boolean;
  v_is_opened boolean;
  v_event_type text;
  v_verdict text;
  v_risk_level text;
  v_source text;
  v_lat double precision;
  v_lng double precision;
  v_meta jsonb;
  v_created_at timestamptz;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'sun_atomic_input_object_required';
  END IF;

  BEGIN
    v_batch_id := NULLIF(BTRIM(p_input->>'batch_id'), '')::uuid;
    v_tenant_id := NULLIF(BTRIM(p_input->>'tenant_id'), '')::uuid;
    v_registered_tag_id := NULLIF(BTRIM(p_input->>'registered_tag_id'), '')::uuid;
    v_ctr := NULLIF(BTRIM(p_input->>'resolved_ctr'), '')::integer;
  EXCEPTION
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'sun_atomic_input_type_invalid';
  END;

  IF v_batch_id IS NULL OR v_tenant_id IS NULL OR NULLIF(BTRIM(p_input->>'bid'), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'sun_atomic_scope_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM batches b
    WHERE b.id = v_batch_id
      AND b.tenant_id = v_tenant_id
      AND b.bid = p_input->>'bid'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'sun_atomic_batch_scope_mismatch';
  END IF;

  -- Derive the trust carrier again at the database boundary. The caller may
  -- supply the decoded TT product state, but it cannot promote a non-TT or
  -- unsupported carrier to a seal-bearing state.
  SELECT LOWER(COALESCE(
      NULLIF(BTRIM(b.carrier_profile_code), ''),
      NULLIF(BTRIM(b.sdm_config->>'carrier_profile_code'), ''),
      CASE
        WHEN LOWER(COALESCE(b.sdm_config->>'chip_model', '')) ~ 'tag.?tamper'
          OR LOWER(COALESCE(b.sdm_config->>'chip_model', '')) ~ '424.*(dna.*)?([_-]|[[:space:]])tt$'
          THEN 'ntag424_dna_tt'
        WHEN LOWER(COALESCE(b.sdm_config->>'chip_model', '')) LIKE '%424%'
          AND LOWER(COALESCE(b.sdm_config->>'chip_model', '')) LIKE '%dna%'
          THEN 'ntag424_dna'
        ELSE NULL
      END
    ))
    INTO v_carrier_profile_code
  FROM batches b
  WHERE b.id = v_batch_id
    AND b.tenant_id = v_tenant_id
    AND b.bid = p_input->>'bid';

  v_uid_hex := NULLIF(UPPER(BTRIM(p_input->>'resolved_uid_hex')), '');
  v_picc_data_hash := NULLIF(BTRIM(p_input->>'picc_data_hash'), '');
  v_cmac_hash := NULLIF(BTRIM(p_input->>'cmac_hash'), '');
  v_raw_url_hash := NULLIF(BTRIM(p_input->>'raw_url_hash'), '');
  v_enc_hash := NULLIF(BTRIM(p_input->>'enc_hash'), '');

  IF v_picc_data_hash IS NULL OR v_cmac_hash IS NULL OR v_raw_url_hash IS NULL OR v_enc_hash IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'sun_atomic_payload_hashes_required';
  END IF;

  BEGIN
    v_lat := NULLIF(p_input->>'lat', '')::double precision;
    v_lng := NULLIF(p_input->>'lng', '')::double precision;
  EXCEPTION
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'sun_atomic_geo_invalid';
  END;
  IF (v_lat IS NULL) <> (v_lng IS NULL)
    OR (v_lat IS NOT NULL AND (v_lat::text IN ('NaN', 'Infinity', '-Infinity') OR v_lat < -90 OR v_lat > 90))
    OR (v_lng IS NOT NULL AND (v_lng::text IN ('NaN', 'Infinity', '-Infinity') OR v_lng < -180 OR v_lng > 180)) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'sun_atomic_geo_invalid';
  END IF;

  -- Every request first takes the same canonical payload lock, regardless of
  -- whether UID decoding succeeded. This closes the mixed-path race where one
  -- request could lock by UID while another request carrying the same
  -- PICCData/CMAC locked by raw URL. A resolved UID then adds the per-tag lock
  -- required to serialize counter/state transitions across distinct payloads.
  -- The fixed payload-then-UID order avoids advisory-lock order inversion.
  PERFORM pg_advisory_xact_lock(
    hashtext(v_batch_id::text),
    hashtext('payload:' || v_picc_data_hash || ':' || v_cmac_hash)
  );
  IF v_uid_hex IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_batch_id::text), hashtext('uid:' || v_uid_hex));
  END IF;

  IF v_uid_hex IS NOT NULL THEN
    SELECT t.id, t.status::text, t.last_seen_ctr, t.scan_count
      INTO v_tag_id, v_tag_status, v_previous_last_seen_ctr, v_scan_count
    FROM tags t
    WHERE t.batch_id = v_batch_id
      AND UPPER(t.uid_hex) = v_uid_hex
    FOR UPDATE;
  END IF;

  IF v_tag_id IS NULL AND v_registered_tag_id IS NOT NULL THEN
    SELECT t.id, t.status::text, t.last_seen_ctr, t.scan_count
      INTO v_tag_id, v_tag_status, v_previous_last_seen_ctr, v_scan_count
    FROM tags t
    WHERE t.batch_id = v_batch_id
      AND t.id = v_registered_tag_id
      AND (v_uid_hex IS NULL OR UPPER(t.uid_hex) = v_uid_hex)
    FOR UPDATE;
  END IF;

  v_crypto_verified := COALESCE((p_input->>'cryptographic_verification')::boolean, false);
  v_payload_verified := COALESCE((p_input->>'payload_verified')::boolean, false);
  v_supplier_payload_match := COALESCE((p_input->>'supplier_payload_match')::boolean, false);
  v_supplier_payload_only := COALESCE((p_input->>'supplier_payload_only')::boolean, false);
  v_allowlisted := v_tag_id IS NOT NULL OR v_supplier_payload_match;
  v_tag_status := COALESCE(
    v_tag_status,
    NULLIF(BTRIM(p_input->>'registered_tag_status'), ''),
    CASE WHEN v_supplier_payload_match THEN 'active' END
  );

  SELECT e.id
    INTO v_replay_original_event_id
  FROM events e
  WHERE e.batch_id = v_batch_id
    AND (
      (e.picc_data_hash = v_picc_data_hash AND e.cmac_hash = v_cmac_hash)
      OR e.raw_url_hash = v_raw_url_hash
    )
  ORDER BY e.created_at ASC, e.id ASC
  LIMIT 1;

  IF v_replay_original_event_id IS NOT NULL THEN
    v_replay_suspect := true;
  END IF;

  IF v_crypto_verified AND v_uid_hex IS NOT NULL AND v_ctr IS NOT NULL THEN
    SELECT e.id
      INTO v_prior_event_id
    FROM events e
    WHERE e.batch_id = v_batch_id
      AND UPPER(e.uid_hex) = v_uid_hex
      AND e.sdm_read_ctr = v_ctr
    ORDER BY e.created_at ASC, e.id ASC
    LIMIT 1;

    IF v_prior_event_id IS NOT NULL THEN
      v_replay_suspect := true;
      v_replay_original_event_id := COALESCE(v_replay_original_event_id, v_prior_event_id);
    END IF;

    IF v_previous_last_seen_ctr IS NOT NULL AND v_ctr <= v_previous_last_seen_ctr THEN
      v_replay_suspect := true;
    END IF;
  END IF;

  v_requested_product_state := NULLIF(UPPER(BTRIM(p_input->>'pre_registry_result')), '');
  v_pre_registry_result := CASE
    WHEN v_carrier_profile_code = 'ntag424_dna' THEN 'VALID_AUTHENTIC'
    WHEN v_carrier_profile_code = 'ntag424_dna_tt'
      AND v_requested_product_state IN (
        'VALID_CLOSED', 'VALID_OPENED', 'VALID_OPENED_PREVIOUSLY', 'VALID_UNKNOWN_TAMPER'
      ) THEN v_requested_product_state
    WHEN v_carrier_profile_code = 'ntag424_dna_tt' THEN 'VALID_UNKNOWN_TAMPER'
    ELSE 'SUN_PROFILE_MISMATCH'
  END;
  v_auth_status := CASE
    WHEN v_supplier_payload_only THEN 'SUPPLIER_PAYLOAD_ONLY'
    -- `payload_verified` is the caller's aggregate proof that either the
    -- physical SUN message or an exact supplier-manifest payload was verified.
    -- Keep this independent fail-closed gate ahead of every positive state so
    -- a contradictory envelope can never be promoted by crypto/carrier flags.
    WHEN NOT v_payload_verified THEN 'SUN_PROFILE_MISMATCH'
    WHEN NOT v_crypto_verified THEN 'SUN_PROFILE_MISMATCH'
    WHEN NOT v_allowlisted THEN 'NOT_REGISTERED'
    WHEN v_tag_status IS DISTINCT FROM 'active' THEN 'NOT_ACTIVE'
    WHEN v_replay_suspect THEN 'REPLAY_SUSPECT'
    WHEN v_pre_registry_result IS NOT NULL THEN v_pre_registry_result
    ELSE 'VALID'
  END;
  v_response_result := CASE
    -- force_result is an internal lifecycle/demo control, not an authentication
    -- override. It is eligible only after every foundational physical-message,
    -- manifest and active-tag gate has succeeded.
    WHEN v_supplier_payload_only
      OR NOT v_payload_verified
      OR NOT v_crypto_verified
      OR NOT v_allowlisted
      OR v_tag_status IS DISTINCT FROM 'active'
      THEN v_auth_status
    WHEN v_replay_suspect THEN 'REPLAY_SUSPECT'
    ELSE COALESCE(NULLIF(UPPER(BTRIM(p_input->>'force_result')), ''), v_auth_status)
  END;
  v_event_result := UPPER(v_response_result);
  v_reason := CASE
    WHEN v_replay_suspect THEN 'copied URL / replay suspected'
    ELSE NULLIF(p_input->>'reason_if_not_replay', '')
  END;

  v_is_authentic := v_event_result = ANY (ARRAY[
    'VALID', 'TAP_VALID', 'VALID_AUTHENTIC', 'VALID_CLOSED', 'VALID_UNKNOWN_TAMPER',
    'OPENED', 'OPENED_PREVIOUSLY', 'MANUAL_OPENED', 'VALID_OPENED',
    'VALID_OPENED_PREVIOUSLY', 'VALID_MANUAL_OPENED'
  ]);
  v_is_opened := v_event_result = ANY (ARRAY[
    'OPENED', 'OPENED_PREVIOUSLY', 'MANUAL_OPENED', 'VALID_OPENED',
    'VALID_OPENED_PREVIOUSLY', 'VALID_MANUAL_OPENED'
  ]);
  v_event_type := CASE
    WHEN v_event_result = 'REPLAY_SUSPECT' THEN 'REPLAY_SUSPECT'
    WHEN NOT v_is_authentic THEN 'TAP_INVALID'
    ELSE 'TAP_VALID'
  END;
  v_verdict := CASE v_event_result
    WHEN 'VALID' THEN 'valid'
    WHEN 'TAP_VALID' THEN 'valid'
    WHEN 'VALID_AUTHENTIC' THEN 'valid'
    WHEN 'VALID_CLOSED' THEN 'valid'
    WHEN 'VALID_UNKNOWN_TAMPER' THEN 'valid'
    WHEN 'OPENED' THEN 'valid'
    WHEN 'OPENED_PREVIOUSLY' THEN 'valid'
    WHEN 'MANUAL_OPENED' THEN 'valid'
    WHEN 'VALID_OPENED' THEN 'valid'
    WHEN 'VALID_OPENED_PREVIOUSLY' THEN 'valid'
    WHEN 'VALID_MANUAL_OPENED' THEN 'valid'
    WHEN 'REPLAY_SUSPECT' THEN 'replay_suspect'
    WHEN 'SUN_PROFILE_MISMATCH' THEN 'invalid'
    WHEN 'SUN_BATCH_DUPLICATE_CONFIG' THEN 'invalid'
    WHEN 'TAMPER_RISK' THEN 'tampered'
    WHEN 'NOT_REGISTERED' THEN 'not_registered'
    WHEN 'NOT_ACTIVE' THEN 'not_active'
    WHEN 'UNKNOWN_BATCH' THEN 'unknown_batch'
    WHEN 'REVOKED' THEN 'revoked'
    WHEN 'BROKEN' THEN 'broken'
    ELSE 'invalid'
  END;
  v_risk_level := CASE
    WHEN v_event_result IN ('TAMPER_RISK', 'REPLAY_SUSPECT') THEN 'high'
    WHEN NOT v_is_authentic THEN 'medium'
    WHEN v_is_opened THEN 'low'
    ELSE 'none'
  END;

  IF v_tag_id IS NOT NULL THEN
    UPDATE tags t
    SET scan_count = t.scan_count + 1,
        first_seen_at = COALESCE(t.first_seen_at, now()),
        last_seen_at = now(),
        last_seen_ctr = CASE
          WHEN v_ctr IS NULL THEN t.last_seen_ctr
          ELSE GREATEST(COALESCE(t.last_seen_ctr, -1), v_ctr)
        END
    WHERE t.id = v_tag_id
    RETURNING t.last_seen_ctr, t.scan_count
      INTO v_last_seen_ctr, v_scan_count;
  ELSE
    v_last_seen_ctr := NULL;
    v_scan_count := NULL;
  END IF;

  v_source := CASE LOWER(COALESCE(NULLIF(p_input->>'source', ''), 'real'))
    WHEN 'demo' THEN 'demo'
    WHEN 'imported' THEN 'imported'
    ELSE 'real'
  END;
  v_meta := COALESCE(
    CASE WHEN jsonb_typeof(p_input->'meta') = 'object' THEN p_input->'meta' END,
    '{}'::jsonb
  ) || jsonb_build_object(
    'enc_data_hash', v_enc_hash,
    'replay_original_event_id', v_replay_original_event_id
  );

  INSERT INTO events (
    tenant_id, batch_id, uid_hex, sdm_read_ctr, read_counter, cmac_ok, allowlisted, tag_status, result, reason,
    user_agent, city, country_code, lat, lng, source, meta, tenant_slug, tag_id, bid, event_type, verdict, risk_level,
    picc_data_hash, cmac_hash, raw_url_hash, ip_hash, geo_precision, product_name,
    ip, geo_city, geo_country, device_label, raw_query
  ) VALUES (
    v_tenant_id,
    v_batch_id,
    v_uid_hex,
    v_ctr,
    v_ctr,
    v_crypto_verified,
    v_allowlisted,
    CASE WHEN v_tag_status IS NULL THEN NULL ELSE v_tag_status::tag_status END,
    v_event_result,
    v_reason,
    NULLIF(p_input->>'user_agent', ''),
    NULLIF(p_input->>'city', ''),
    NULLIF(p_input->>'country_code', ''),
    v_lat,
    v_lng,
    v_source::scan_source,
    v_meta,
    NULLIF(p_input->>'tenant_slug', ''),
    v_tag_id,
    p_input->>'bid',
    v_event_type::event_type,
    v_verdict,
    v_risk_level::risk_level,
    v_picc_data_hash,
    v_cmac_hash,
    v_raw_url_hash,
    NULL,
    'none'::geo_precision,
    NULLIF(p_input->>'product_name', ''),
    NULLIF(p_input->>'ip', '')::inet,
    NULLIF(p_input->>'geo_city', ''),
    NULLIF(p_input->>'geo_country', ''),
    NULLIF(p_input->>'device_label', ''),
    CASE WHEN jsonb_typeof(p_input->'raw_query') = 'object' THEN p_input->'raw_query' ELSE NULL END
  )
  RETURNING events.id, events.created_at
    INTO event_id, v_created_at;

  final_result := v_event_result;
  auth_status := v_auth_status;
  final_reason := v_reason;
  replay_suspect := v_replay_suspect;
  replay_original_event_id := v_replay_original_event_id;
  allowlisted := v_allowlisted;
  tag_id := v_tag_id;
  tag_status := v_tag_status;
  previous_last_seen_ctr := v_previous_last_seen_ctr;
  last_seen_ctr := v_last_seen_ctr;
  scan_count := v_scan_count;
  event_type := v_event_type;
  verdict := v_verdict;
  risk_level := v_risk_level;
  created_at := v_created_at;
  RETURN NEXT;
END
$sun_atomic_function$;

COMMENT ON FUNCTION public.nexid_persist_sun_scan_v1_base_0062(jsonb) IS
  'Atomic SUN persistence with manifest and lifecycle gates before replay and carrier trust state. Software transaction boundary; not an HSM.';
