-- Neutral taxonomy for registered-but-unverified public identities.
--
-- QR, GS1 Digital Link and static NFC HTTP locators can identify a provisioned
-- NexID record, but cannot prove physical presence or cryptographic
-- authentication. The canonical writer therefore accepts a distinct neutral
-- verdict instead of overloading valid/not_registered.
--
-- Unit resolution also requires the batch, tag and existing tag profile to
-- carry the exact same public carrier code. Missing tenant policy or missing
-- tag profile remains a runtime fail-closed condition; this migration does not
-- fabricate policy enablement or product-profile evidence.

-- Unresolved public-carrier requests are deliberately tenantless operational
-- quarantine records. This schema is migration-owned: HTTP handlers never
-- create or alter production tables at request time.
CREATE TABLE IF NOT EXISTS sun_scan_attempts (
  id bigserial PRIMARY KEY,
  bid text NOT NULL,
  result text NOT NULL,
  reason text,
  ip inet,
  user_agent text,
  geo_city text,
  geo_country text,
  geo_lat double precision,
  geo_lng double precision,
  source text NOT NULL DEFAULT 'real',
  raw_query jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sun_scan_attempts_created_at
  ON sun_scan_attempts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consumer_tap_history_tenant_event_actor
  ON consumer_tap_history (tenant_id, tap_event_id)
  WHERE consumer_id IS NOT NULL;

UPDATE batches
SET carrier_profile_code = LOWER(BTRIM(sdm_config->>'carrier_profile_code'))
WHERE NULLIF(BTRIM(carrier_profile_code), '') IS NULL
  AND LOWER(BTRIM(COALESCE(sdm_config->>'carrier_profile_code', ''))) IN (
    'qr_basic', 'gs1_digital_link', 'ntag213', 'ntag215', 'ntag216'
  );

UPDATE tags tag
SET carrier_profile_code = LOWER(BTRIM(batch.carrier_profile_code))
FROM batches batch
WHERE tag.batch_id = batch.id
  AND NULLIF(BTRIM(tag.carrier_profile_code), '') IS NULL
  AND LOWER(BTRIM(COALESCE(batch.carrier_profile_code, ''))) IN (
    'qr_basic', 'gs1_digital_link', 'ntag213', 'ntag215', 'ntag216'
  );

UPDATE tag_profiles profile
SET carrier_profile_code = LOWER(BTRIM(tag.carrier_profile_code)),
    updated_at = now()
FROM tags tag
JOIN batches batch ON batch.id = tag.batch_id
WHERE profile.tag_id = tag.id
  AND NULLIF(BTRIM(profile.carrier_profile_code), '') IS NULL
  AND LOWER(BTRIM(COALESCE(batch.carrier_profile_code, ''))) IN (
    'qr_basic', 'gs1_digital_link', 'ntag213', 'ntag215', 'ntag216'
  )
  AND LOWER(BTRIM(COALESCE(tag.carrier_profile_code, '')))
      = LOWER(BTRIM(batch.carrier_profile_code));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM batches batch
    JOIN tags tag ON tag.batch_id = batch.id
    LEFT JOIN tag_profiles profile ON profile.tag_id = tag.id
    WHERE LOWER(BTRIM(COALESCE(
            NULLIF(batch.carrier_profile_code, ''),
            NULLIF(batch.sdm_config->>'carrier_profile_code', '')
          ))) IN ('qr_basic', 'gs1_digital_link', 'ntag213', 'ntag215', 'ntag216')
      AND (
        LOWER(BTRIM(COALESCE(tag.carrier_profile_code, ''))) IS DISTINCT FROM
          LOWER(BTRIM(COALESCE(
            NULLIF(batch.carrier_profile_code, ''),
            NULLIF(batch.sdm_config->>'carrier_profile_code', '')
          )))
        OR (
          profile.id IS NOT NULL
          AND LOWER(BTRIM(COALESCE(profile.carrier_profile_code, ''))) IS DISTINCT FROM
            LOWER(BTRIM(COALESCE(
              NULLIF(batch.carrier_profile_code, ''),
              NULLIF(batch.sdm_config->>'carrier_profile_code', '')
            )))
        )
      )
  ) THEN
    RAISE EXCEPTION 'public_carrier_unit_profile_reconciliation_required';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION nexid_enforce_public_carrier_unit_consistency_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'batches' THEN
    v_batch_id := COALESCE(NEW.id, OLD.id);
  ELSIF TG_TABLE_NAME = 'tags' THEN
    v_batch_id := COALESCE(NEW.batch_id, OLD.batch_id);
  ELSIF TG_TABLE_NAME = 'tag_profiles' THEN
    SELECT tag.batch_id
    INTO v_batch_id
    FROM tags tag
    WHERE tag.id = COALESCE(NEW.tag_id, OLD.tag_id);
  END IF;

  IF v_batch_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM batches batch
    WHERE batch.id = v_batch_id
      AND LOWER(BTRIM(COALESCE(
            NULLIF(batch.carrier_profile_code, ''),
            NULLIF(batch.sdm_config->>'carrier_profile_code', '')
          ))) IN ('qr_basic', 'gs1_digital_link', 'ntag213', 'ntag215', 'ntag216')
      AND (
        EXISTS (
          SELECT 1
          FROM tags tag
          WHERE tag.batch_id = batch.id
            AND LOWER(BTRIM(COALESCE(tag.carrier_profile_code, ''))) IS DISTINCT FROM
              LOWER(BTRIM(COALESCE(
                NULLIF(batch.carrier_profile_code, ''),
                NULLIF(batch.sdm_config->>'carrier_profile_code', '')
              )))
        )
        OR EXISTS (
          SELECT 1
          FROM tag_profiles profile
          JOIN tags tag ON tag.id = profile.tag_id
          WHERE tag.batch_id = batch.id
            AND LOWER(BTRIM(COALESCE(profile.carrier_profile_code, ''))) IS DISTINCT FROM
              LOWER(BTRIM(COALESCE(
                NULLIF(batch.carrier_profile_code, ''),
                NULLIF(batch.sdm_config->>'carrier_profile_code', '')
              )))
        )
      )
  ) THEN
    RAISE EXCEPTION 'public_carrier_unit_profile_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_public_carrier_batch_consistency ON batches;
CREATE CONSTRAINT TRIGGER trg_public_carrier_batch_consistency
AFTER INSERT OR UPDATE ON batches
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION nexid_enforce_public_carrier_unit_consistency_v1();

DROP TRIGGER IF EXISTS trg_public_carrier_tag_consistency ON tags;
CREATE CONSTRAINT TRIGGER trg_public_carrier_tag_consistency
AFTER INSERT OR UPDATE ON tags
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION nexid_enforce_public_carrier_unit_consistency_v1();

DROP TRIGGER IF EXISTS trg_public_carrier_tag_profile_consistency ON tag_profiles;
CREATE CONSTRAINT TRIGGER trg_public_carrier_tag_profile_consistency
AFTER INSERT OR UPDATE ON tag_profiles
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION nexid_enforce_public_carrier_unit_consistency_v1();

CREATE OR REPLACE FUNCTION nexid_write_canonical_event_v1(p_input jsonb)
RETURNS TABLE (
  canonical_operation_id uuid,
  event_id bigint,
  event_created_at timestamptz,
  tenant_id uuid,
  batch_id uuid,
  tag_id text,
  bid text,
  event_name text,
  event_mode text,
  replayed boolean,
  webhook_attempted integer,
  webhook_queued integer,
  webhook_deduplicated integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_operation_key text := btrim(COALESCE(p_input->>'operation_key', ''));
  v_request_fingerprint text := lower(btrim(COALESCE(p_input->>'request_fingerprint', '')));
  v_event_name text := lower(btrim(COALESCE(p_input->>'event_name', '')));
  v_event_mode text := lower(btrim(COALESCE(p_input->>'event_mode', '')));
  v_event_family text := lower(btrim(COALESCE(p_input->>'event_family', '')));
  v_reference_event_id bigint;
  v_requested_reference_created_at timestamptz;
  v_source_event_created_at timestamptz;
  v_reference_matches integer := 0;
  v_requested_batch_id uuid;
  v_requested_uid text := upper(NULLIF(btrim(COALESCE(p_input->>'uid_hex', '')), ''));
  v_tenant_id uuid;
  v_tenant_slug text;
  v_batch_id uuid;
  v_bid text;
  v_uid_hex text;
  v_tag_id text;
  v_tag_status tag_status;
  v_operation_id uuid;
  v_existing canonical_event_operations%ROWTYPE;
  v_event_id bigint;
  v_event_created_at timestamptz;
  v_webhook_event_id text;
  v_webhook_data jsonb := COALESCE(p_input->'webhook_data', '{}'::jsonb);
  v_event_meta jsonb := COALESCE(p_input->'meta', '{}'::jsonb);
  v_webhook_payload jsonb;
  v_attempted integer := 0;
  v_queued integer := 0;
  v_deduplicated integer := 0;
  v_result text := upper(btrim(COALESCE(p_input->>'result', '')));
  v_event_type text := upper(btrim(COALESCE(p_input->>'event_type', '')));
  v_verdict text := lower(btrim(COALESCE(p_input->>'verdict', '')));
  v_risk_level text := lower(btrim(COALESCE(p_input->>'risk_level', '')));
  v_reason text := NULLIF(left(btrim(COALESCE(p_input->>'reason', '')), 500), '');
  v_source scan_source;
  v_metric_scope text;
  v_coordinate_lat double precision;
  v_coordinate_lng double precision;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'canonical_event_payload_invalid';
  END IF;
  IF char_length(v_operation_key) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION 'canonical_event_operation_key_invalid';
  END IF;
  IF v_request_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'canonical_event_request_fingerprint_invalid';
  END IF;
  IF v_event_name NOT IN (
    'demo.tap.simulated',
    'ownership.activated',
    'provenance.viewed',
    'tokenization.anchored',
    'tokenization.requested',
    'tokenization.simulated',
    'warranty.review_requested'
  ) THEN
    RAISE EXCEPTION 'canonical_event_name_invalid';
  END IF;
  IF v_event_mode NOT IN ('live', 'demo', 'simulated') THEN
    RAISE EXCEPTION 'canonical_event_mode_invalid';
  END IF;
  IF v_event_family NOT IN ('tap', 'lifecycle') THEN
    RAISE EXCEPTION 'canonical_event_family_invalid';
  END IF;
  IF v_result = '' OR char_length(v_result) > 80
     OR v_event_type = '' OR char_length(v_event_type) > 80 THEN
    RAISE EXCEPTION 'canonical_event_type_invalid';
  END IF;
  IF v_verdict NOT IN ('valid', 'invalid', 'replay_suspect', 'blocked_replay', 'revoked', 'broken', 'tampered', 'unknown_batch', 'not_registered', 'not_active', 'identified_unverified') THEN
    RAISE EXCEPTION 'canonical_event_verdict_invalid';
  END IF;
  IF v_risk_level NOT IN ('none', 'low', 'medium', 'high', 'critical') THEN
    RAISE EXCEPTION 'canonical_event_risk_level_invalid';
  END IF;
  IF jsonb_typeof(v_webhook_data) <> 'object' OR octet_length(v_webhook_data::text) > 32768 THEN
    RAISE EXCEPTION 'canonical_event_webhook_payload_invalid';
  END IF;
  IF jsonb_typeof(v_event_meta) <> 'object' OR octet_length(v_event_meta::text) > 65536 THEN
    RAISE EXCEPTION 'canonical_event_meta_invalid';
  END IF;
  IF p_input ? 'raw_query'
     AND p_input->'raw_query' <> 'null'::jsonb
     AND (jsonb_typeof(p_input->'raw_query') <> 'object' OR octet_length((p_input->'raw_query')::text) > 32768) THEN
    RAISE EXCEPTION 'canonical_event_raw_query_invalid';
  END IF;

  BEGIN
    v_reference_event_id := NULLIF(p_input->>'reference_event_id', '')::bigint;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'canonical_event_reference_event_invalid';
  END;
  BEGIN
    v_requested_reference_created_at := NULLIF(p_input->>'reference_event_created_at', '')::timestamptz;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'canonical_event_reference_created_at_invalid';
  END;
  BEGIN
    v_requested_batch_id := NULLIF(p_input->>'batch_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'canonical_event_batch_id_invalid';
  END;

  IF v_reference_event_id IS NOT NULL THEN
    SELECT count(*)::integer
    INTO v_reference_matches
    FROM events source_event
    WHERE source_event.id = v_reference_event_id
      AND (v_requested_reference_created_at IS NULL OR source_event.created_at = v_requested_reference_created_at);

    IF v_reference_matches = 0 THEN
      RAISE EXCEPTION 'canonical_event_reference_event_not_found';
    END IF;
    IF v_reference_matches > 1 THEN
      RAISE EXCEPTION 'canonical_event_reference_event_ambiguous';
    END IF;

    SELECT
      source_event.tenant_id,
      tenant.slug,
      source_event.batch_id,
      batch.bid,
      upper(NULLIF(source_event.uid_hex, '')),
      tag.id::text,
      tag.status,
      source_event.created_at
    INTO
      v_tenant_id,
      v_tenant_slug,
      v_batch_id,
      v_bid,
      v_uid_hex,
      v_tag_id,
      v_tag_status,
      v_source_event_created_at
    FROM events source_event
    JOIN batches batch
      ON batch.id = source_event.batch_id
     AND batch.tenant_id = source_event.tenant_id
    JOIN tenants tenant ON tenant.id = source_event.tenant_id
    LEFT JOIN LATERAL (
      SELECT candidate.id, candidate.status
      FROM tags candidate
      WHERE candidate.batch_id = source_event.batch_id
        AND upper(candidate.uid_hex) = upper(source_event.uid_hex)
      ORDER BY candidate.created_at ASC
      LIMIT 1
    ) tag ON source_event.uid_hex IS NOT NULL
    WHERE source_event.id = v_reference_event_id
      AND (v_requested_reference_created_at IS NULL OR source_event.created_at = v_requested_reference_created_at)
    LIMIT 1;
    IF v_requested_batch_id IS NOT NULL AND v_requested_batch_id <> v_batch_id THEN
      RAISE EXCEPTION 'canonical_event_reference_batch_mismatch';
    END IF;
    IF v_requested_uid IS NOT NULL AND v_uid_hex IS DISTINCT FROM v_requested_uid THEN
      RAISE EXCEPTION 'canonical_event_reference_uid_mismatch';
    END IF;
  ELSIF v_requested_batch_id IS NOT NULL THEN
    SELECT
      batch.tenant_id,
      tenant.slug,
      batch.id,
      batch.bid,
      v_requested_uid,
      tag.id::text,
      tag.status
    INTO
      v_tenant_id,
      v_tenant_slug,
      v_batch_id,
      v_bid,
      v_uid_hex,
      v_tag_id,
      v_tag_status
    FROM batches batch
    JOIN tenants tenant ON tenant.id = batch.tenant_id
    LEFT JOIN LATERAL (
      SELECT candidate.id, candidate.status
      FROM tags candidate
      WHERE candidate.batch_id = batch.id
        AND v_requested_uid IS NOT NULL
        AND upper(candidate.uid_hex) = v_requested_uid
      ORDER BY candidate.created_at ASC
      LIMIT 1
    ) tag ON true
    WHERE batch.id = v_requested_batch_id
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
      RAISE EXCEPTION 'canonical_event_batch_not_found';
    END IF;
  ELSE
    RAISE EXCEPTION 'canonical_event_server_reference_required';
  END IF;

  -- Serialize only this tenant/operation pair. Hash collisions merely serialize
  -- unrelated operations; they cannot merge their unique operation rows.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || chr(31) || v_operation_key, 0));

  SELECT *
  INTO v_existing
  FROM canonical_event_operations operation
  WHERE operation.tenant_id = v_tenant_id
    AND operation.operation_key = v_operation_key
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.request_fingerprint <> v_request_fingerprint
       OR v_existing.event_name <> v_event_name
       OR v_existing.event_mode <> v_event_mode THEN
      RAISE EXCEPTION 'canonical_event_idempotency_conflict';
    END IF;

    SELECT
      count(*)::integer,
      count(*) FILTER (WHERE delivery.status IN ('pending', 'processing', 'retry_scheduled', 'delivered'))::integer
    INTO v_attempted, v_deduplicated
    FROM webhook_deliveries delivery
    WHERE delivery.event_id = 'evt_canonical_' || v_existing.id::text;

    RETURN QUERY SELECT
      v_existing.id,
      v_existing.event_id,
      v_existing.event_created_at,
      v_existing.tenant_id,
      v_batch_id,
      v_tag_id,
      v_bid,
      v_existing.event_name,
      v_existing.event_mode,
      true,
      COALESCE(v_attempted, 0),
      0,
      COALESCE(v_deduplicated, 0);
    RETURN;
  END IF;

  v_operation_id := uuid_generate_v4();
  v_source := CASE WHEN v_event_mode IN ('demo', 'simulated') THEN 'demo'::scan_source
                   WHEN v_event_family = 'tap' THEN 'real'::scan_source
                   ELSE 'imported'::scan_source END;
  v_metric_scope := CASE WHEN v_event_mode IN ('demo', 'simulated') THEN 'simulation'
                         WHEN v_event_family = 'tap' THEN 'scan'
                         ELSE 'lifecycle' END;

  BEGIN
    v_coordinate_lat := NULLIF(p_input->>'lat', '')::double precision;
    v_coordinate_lng := NULLIF(p_input->>'lng', '')::double precision;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'canonical_event_coordinates_invalid';
  END;
  IF (v_coordinate_lat IS NOT NULL AND (v_coordinate_lat < -90 OR v_coordinate_lat > 90))
     OR (v_coordinate_lng IS NOT NULL AND (v_coordinate_lng < -180 OR v_coordinate_lng > 180))
     OR ((v_coordinate_lat IS NULL) <> (v_coordinate_lng IS NULL)) THEN
    RAISE EXCEPTION 'canonical_event_coordinates_invalid';
  END IF;

  v_event_meta := v_event_meta || jsonb_build_object(
    'canonical_event', true,
    'canonical_operation_id', v_operation_id,
    'canonical_event_name', v_event_name,
    'event_family', v_event_family,
    'event_mode', v_event_mode,
    'metric_scope', v_metric_scope,
    'simulated', v_event_mode IN ('demo', 'simulated'),
    'source_event_id', v_reference_event_id
  );

  INSERT INTO events (
    tenant_id, batch_id, uid_hex, sdm_read_ctr, read_counter, cmac_ok, allowlisted, tag_status,
    result, reason, user_agent, city, country_code, lat, lng, source, meta, tenant_slug, tag_id,
    bid, event_type, verdict, risk_level, picc_data_hash, cmac_hash, raw_url_hash, ip_hash,
    geo_precision, product_name, device_label, raw_query
  ) VALUES (
    v_tenant_id,
    v_batch_id,
    v_uid_hex,
    NULLIF(p_input->>'sdm_read_ctr', '')::integer,
    NULLIF(p_input->>'read_counter', '')::integer,
    CASE WHEN p_input ? 'cmac_ok' THEN (p_input->>'cmac_ok')::boolean ELSE NULL END,
    CASE WHEN p_input ? 'allowlisted' THEN (p_input->>'allowlisted')::boolean ELSE NULL END,
    v_tag_status,
    v_result,
    v_reason,
    NULLIF(left(p_input->>'user_agent', 512), ''),
    NULLIF(left(p_input->>'city', 120), ''),
    NULLIF(left(upper(p_input->>'country_code'), 3), ''),
    v_coordinate_lat,
    v_coordinate_lng,
    v_source,
    v_event_meta,
    v_tenant_slug,
    v_tag_id,
    v_bid,
    v_event_type,
    v_verdict,
    v_risk_level,
    NULLIF(left(p_input->>'picc_data_hash', 160), ''),
    NULLIF(left(p_input->>'cmac_hash', 160), ''),
    NULLIF(left(p_input->>'raw_url_hash', 160), ''),
    NULLIF(left(p_input->>'ip_hash', 160), ''),
    COALESCE(NULLIF(left(p_input->>'geo_precision', 32), ''), 'none'),
    NULLIF(left(p_input->>'product_name', 240), ''),
    NULLIF(left(p_input->>'device_label', 160), ''),
    CASE WHEN p_input ? 'raw_query' THEN p_input->'raw_query' ELSE NULL END
  )
  RETURNING events.id, events.created_at INTO v_event_id, v_event_created_at;

  INSERT INTO canonical_event_operations (
    id, tenant_id, operation_key, request_fingerprint, event_name, event_mode,
    event_id, event_created_at, source_event_id, source_event_created_at
  ) VALUES (
    v_operation_id, v_tenant_id, v_operation_key, v_request_fingerprint, v_event_name,
    v_event_mode, v_event_id, v_event_created_at, v_reference_event_id, v_source_event_created_at
  );

  v_webhook_event_id := 'evt_canonical_' || v_operation_id::text;
  v_webhook_payload := jsonb_build_object(
    'schemaVersion', '1.0',
    'id', v_webhook_event_id,
    'type', v_event_name,
    'createdAt', v_event_created_at,
    'data', v_webhook_data || jsonb_build_object(
      'canonicalEventId', v_event_id,
      'eventMode', v_event_mode,
      'simulated', v_event_mode IN ('demo', 'simulated'),
      'bid', v_bid
    )
  );

  WITH matching_endpoints AS MATERIALIZED (
    SELECT endpoint.id, endpoint.url
    FROM webhook_endpoints endpoint
    WHERE endpoint.tenant_id = v_tenant_id
      AND endpoint.enabled = true
      AND endpoint.deleted_at IS NULL
      AND (endpoint.events ? v_event_name OR endpoint.events ? '*')
    ORDER BY endpoint.updated_at DESC
    LIMIT 25
  ),
  inserted_deliveries AS (
    INSERT INTO webhook_deliveries (
      endpoint_id, endpoint_url, event_id, event_name, payload, status,
      attempt_count, next_attempt_at
    )
    SELECT
      endpoint.id,
      endpoint.url,
      v_webhook_event_id,
      v_event_name,
      v_webhook_payload,
      'pending',
      0,
      now()
    FROM matching_endpoints endpoint
    ON CONFLICT (endpoint_id, event_id) DO NOTHING
    RETURNING endpoint_id
  )
  SELECT
    (SELECT count(*)::integer FROM matching_endpoints),
    (SELECT count(*)::integer FROM inserted_deliveries)
  INTO v_attempted, v_queued;

  RETURN QUERY SELECT
    v_operation_id,
    v_event_id,
    v_event_created_at,
    v_tenant_id,
    v_batch_id,
    v_tag_id,
    v_bid,
    v_event_name,
    v_event_mode,
    false,
    COALESCE(v_attempted, 0),
    COALESCE(v_queued, 0),
    0;
END;
$$;
