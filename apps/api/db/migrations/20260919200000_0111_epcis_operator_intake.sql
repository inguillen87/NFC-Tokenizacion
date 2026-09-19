DO $base$ DECLARE h text; BEGIN
 SELECT encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') INTO h FROM pg_proc WHERE oid='public.nexid_capture_epcis_document_v1(jsonb)'::regprocedure;
 IF h NOT IN ('27adc41f0c3eb0fddd26ca19ba1718eeadd470828bdf4afe120bc9dd67caca39','268586fa4b0976bf8100c2038829bee8536256dd4e9ea3f0b356b3357c942cdf') THEN RAISE EXCEPTION 'epcis_engine_changed_reconcile_before_upgrade';END IF;
 SELECT encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') INTO h FROM pg_proc WHERE oid='public.nexid_enforce_epcis_capture_scope_v1()'::regprocedure;
 IF h NOT IN ('ba61cb405aeea2c73292f0b51eab2f651596eb7667e6ff509b71298a3bfdbc19','a8d6d905a6879d6f7d1ea32052521d74ef45ef2f3268c6afc7bb726d7f28f78e') THEN RAISE EXCEPTION 'epcis_scope_changed_reconcile_before_upgrade';END IF;
END; $base$;
-- Add an explicit human-origin alternative; never impersonate an integration key.
-- Existing SDK captures keep their original actor and contract.
ALTER TABLE public.epcis_capture_operations ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES public.users(id) ON DELETE RESTRICT;
ALTER TABLE public.epcis_capture_operations ADD COLUMN IF NOT EXISTS operator_context jsonb;
ALTER TABLE public.epcis_capture_operations ALTER COLUMN api_key_id DROP NOT NULL;
DO $constraint$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.epcis_capture_operations'::regclass AND conname='epcis_capture_actor_choice') THEN
  ALTER TABLE public.epcis_capture_operations ADD CONSTRAINT epcis_capture_actor_choice CHECK ((
   (api_key_id IS NOT NULL AND actor_user_id IS NULL AND operator_context IS NULL)
   OR (api_key_id IS NULL AND actor_user_id IS NOT NULL AND jsonb_typeof(operator_context)='object'
       AND octet_length(operator_context::text)<=2048
       AND operator_context->>'origin'='operator_import'
       AND operator_context->>'batchId' IS NOT NULL
       AND operator_context->>'documentDigest' ~ '^[0-9a-f]{64}$'
       AND char_length(operator_context->>'reference') BETWEEN 4 AND 160)
  ) IS TRUE);
 END IF;
END;
$constraint$;
CREATE OR REPLACE FUNCTION public.nexid_epcis_require_operator_v1(p_tenant uuid,p_actor uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $operator$
BEGIN
 PERFORM 1 FROM public.users u JOIN public.memberships m ON m.user_id=u.id JOIN public.tenants t ON t.id=p_tenant
 WHERE u.id=p_actor AND u.admin_status='active' AND t.status='active'
 AND ((m.tenant_id=p_tenant AND m.role::text IN ('tenant_owner','tenant_admin','operations_manager')) OR (m.tenant_id IS NULL AND m.role::text='super_admin'))
 FOR SHARE OF u,m,t;
 IF NOT FOUND THEN RAISE EXCEPTION 'epcis_operator_membership_required';END IF;
END;
$operator$;
REVOKE ALL ON FUNCTION public.nexid_epcis_require_operator_v1(uuid,uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION nexid_capture_epcis_document_v1(p_input jsonb)
RETURNS TABLE (
  capture_id uuid,
  document_record_id uuid,
  tenant_id uuid,
  event_count integer,
  canonical_projection_count integer,
  captured_at timestamptz,
  replayed boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $capture$
DECLARE
  v_tenant_id uuid;
  v_api_key_id uuid;
  v_actor_user_id uuid;
  v_operator_context jsonb := p_input->'operator_context';
  v_idempotency_key text := btrim(COALESCE(p_input->>'idempotency_key', ''));
  v_request_fingerprint text := lower(btrim(COALESCE(p_input->>'request_fingerprint', '')));
  v_schema_version text := btrim(COALESCE(p_input->>'schema_version', ''));
  v_document_type text := btrim(COALESCE(p_input->>'document_type', ''));
  v_client_document_id text := NULLIF(btrim(COALESCE(p_input->>'client_document_id', '')), '');
  v_document jsonb := p_input->'document';
  v_events jsonb := p_input->'events';
  v_existing epcis_capture_operations%ROWTYPE;
  v_capture_id uuid := uuid_generate_v4();
  v_document_id uuid := uuid_generate_v4();
  v_captured_at timestamptz := clock_timestamp();
  v_event_input jsonb;
  v_identifier_input jsonb;
  v_event_record uuid;
  v_registry gs1_digital_link_identities%ROWTYPE;
  v_tenant_slug text;
  v_batch_bid text;
  v_tag_uid text;
  v_tag_status tag_status;
  v_operation_id uuid;
  v_event_id bigint;
  v_event_created_at timestamptz;
  v_event_json jsonb;
  v_projection_count integer := 0;
  v_expected_projection_count integer := 0;
  v_webhook_event_id text;
  v_webhook_payload jsonb;
  v_canonical_event_type text := 'EPCIS_EVENT_CAPTURED';
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'epcis_capture_payload_invalid';
  END IF;
  BEGIN
    v_tenant_id := NULLIF(p_input->>'tenant_id', '')::uuid;
    v_api_key_id := NULLIF(p_input->>'api_key_id', '')::uuid;
    v_actor_user_id := NULLIF(p_input->>'actor_user_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'epcis_capture_actor_invalid';
  END;
  IF v_tenant_id IS NULL OR (v_api_key_id IS NULL)=(v_actor_user_id IS NULL) THEN
    RAISE EXCEPTION 'epcis_capture_actor_invalid';
  END IF;
  IF char_length(v_idempotency_key) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION 'epcis_idempotency_key_invalid';
  END IF;
  IF v_request_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'epcis_request_fingerprint_invalid';
  END IF;
  IF v_schema_version <> '2.0' OR v_document_type <> 'EPCISDocument' THEN
    RAISE EXCEPTION 'epcis_document_profile_invalid';
  END IF;
  IF v_client_document_id IS NOT NULL AND char_length(v_client_document_id) > 512 THEN
    RAISE EXCEPTION 'epcis_document_id_invalid';
  END IF;
  IF jsonb_typeof(v_document) <> 'object' OR octet_length(v_document::text) > 524288 THEN
    RAISE EXCEPTION 'epcis_document_invalid';
  END IF;
  IF jsonb_typeof(v_events) <> 'array' OR jsonb_array_length(v_events) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'epcis_event_count_invalid';
  END IF;
  IF v_actor_user_id IS NOT NULL THEN
    PERFORM public.nexid_epcis_require_operator_v1(v_tenant_id,v_actor_user_id);
    IF jsonb_typeof(v_operator_context) IS DISTINCT FROM 'object' OR v_operator_context->>'origin' IS DISTINCT FROM 'operator_import' THEN RAISE EXCEPTION 'epcis_operator_context_invalid'; END IF;
  ELSE
  IF NOT EXISTS (
    SELECT 1
    FROM tenant_api_keys api_key
    WHERE api_key.id = v_api_key_id
      AND api_key.tenant_id = v_tenant_id
      AND api_key.status = 'active'
      AND (api_key.expires_at IS NULL OR api_key.expires_at > now())
  ) THEN
    RAISE EXCEPTION 'epcis_api_key_tenant_mismatch';
  END IF;

  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || chr(31) || v_idempotency_key, 0));
  SELECT * INTO v_existing
  FROM epcis_capture_operations operation
  WHERE operation.tenant_id = v_tenant_id
    AND operation.idempotency_key = v_idempotency_key
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.request_fingerprint <> v_request_fingerprint OR (v_existing.actor_user_id IS DISTINCT FROM v_actor_user_id) OR (v_existing.operator_context IS DISTINCT FROM v_operator_context) THEN
      RAISE EXCEPTION 'epcis_idempotency_conflict';
    END IF;
    RETURN QUERY
      SELECT v_existing.id, document.id, v_existing.tenant_id,
        v_existing.event_count, v_existing.canonical_projection_count,
        v_existing.captured_at, true
      FROM epcis_documents document
      WHERE document.capture_operation_id = v_existing.id;
    RETURN;
  END IF;

  SELECT tenant.slug INTO v_tenant_slug FROM tenants tenant WHERE tenant.id = v_tenant_id;
  IF v_tenant_slug IS NULL THEN
    RAISE EXCEPTION 'epcis_tenant_not_found';
  END IF;

  -- Validate every referenced identity before any durable insert. Combined with
  -- the function transaction, this guarantees rollback rather than partial capture.
  FOR v_event_input IN SELECT value FROM jsonb_array_elements(v_events) LOOP
    IF jsonb_typeof(v_event_input) <> 'object'
       OR jsonb_typeof(v_event_input->'event') <> 'object'
       OR octet_length((v_event_input->'event')::text) > 65536
       OR jsonb_typeof(v_event_input->'identifiers') <> 'array'
       OR jsonb_array_length(v_event_input->'identifiers') NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'epcis_event_payload_invalid';
    END IF;
    FOR v_identifier_input IN SELECT value FROM jsonb_array_elements(v_event_input->'identifiers') LOOP
      IF jsonb_typeof(v_identifier_input) <> 'object'
         OR lower(COALESCE(v_identifier_input->>'projection_fingerprint', '')) !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'epcis_identifier_payload_invalid';
      END IF;
      BEGIN
        SELECT identity.* INTO STRICT v_registry
        FROM gs1_digital_link_identities identity
        JOIN gs1_gtin_prefix_entitlements entitlement
          ON entitlement.id = identity.entitlement_id
         AND entitlement.tenant_id = identity.tenant_id
         AND entitlement.status = 'active'
         AND identity.gtin LIKE entitlement.canonical_gtin_prefix || '%'
        WHERE identity.id = (v_identifier_input->>'registry_id')::uuid
          AND identity.tenant_id = v_tenant_id
          AND identity.status = 'active'
        FOR SHARE OF identity, entitlement;
      EXCEPTION
        WHEN no_data_found OR invalid_text_representation THEN
          RAISE EXCEPTION 'epcis_unknown_gs1_identity';
      END;
    END LOOP;
    IF v_actor_user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_event_input->'identifiers') i JOIN gs1_digital_link_identities g ON g.id=(i->>'registry_id')::uuid WHERE g.tenant_id=v_tenant_id AND g.batch_id=(v_operator_context->>'batchId')::uuid) THEN RAISE EXCEPTION 'epcis_operator_batch_mismatch';END IF;
  END LOOP;

  SELECT COALESCE(sum(jsonb_array_length(event_input->'identifiers')), 0)::integer
  INTO v_expected_projection_count
  FROM jsonb_array_elements(v_events) event_input;
  IF v_expected_projection_count NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'epcis_projection_count_invalid';
  END IF;

  INSERT INTO epcis_capture_operations (
    id, tenant_id, api_key_id, actor_user_id, operator_context, idempotency_key, request_fingerprint,
    document_id, event_count, canonical_projection_count, captured_at
  ) VALUES (
    v_capture_id, v_tenant_id, v_api_key_id, v_actor_user_id, v_operator_context, v_idempotency_key, v_request_fingerprint,
    v_client_document_id, jsonb_array_length(v_events),
    v_expected_projection_count,
    v_captured_at
  );

  INSERT INTO epcis_documents (
    id, capture_operation_id, tenant_id, schema_version, document_type,
    client_document_id, document_json, captured_at
  ) VALUES (
    v_document_id, v_capture_id, v_tenant_id, v_schema_version, v_document_type,
    v_client_document_id, v_document, v_captured_at
  );

  FOR v_event_input IN SELECT value FROM jsonb_array_elements(v_events) LOOP
    v_event_record := uuid_generate_v4();
    v_event_json := (v_event_input->'event') || jsonb_build_object('recordTime', v_captured_at);
    BEGIN
      INSERT INTO epcis_events (
        id, document_id, tenant_id, client_event_id, event_type, event_time,
        record_time, event_time_zone_offset, action, biz_step, disposition,
        read_point, biz_location, event_json
      ) VALUES (
        v_event_record,
        v_document_id,
        v_tenant_id,
        NULLIF(v_event_input->>'client_event_id', ''),
        v_event_input->>'event_type',
        (v_event_input->>'event_time')::timestamptz,
        v_captured_at,
        v_event_input->>'event_time_zone_offset',
        NULLIF(v_event_input->>'action', ''),
        NULLIF(v_event_input->>'biz_step', ''),
        NULLIF(v_event_input->>'disposition', ''),
        NULLIF(v_event_input->>'read_point', ''),
        NULLIF(v_event_input->>'biz_location', ''),
        v_event_json
      );
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'epcis_event_id_conflict';
    END;

    FOR v_identifier_input IN SELECT value FROM jsonb_array_elements(v_event_input->'identifiers') LOOP
      SELECT identity.* INTO STRICT v_registry
      FROM gs1_digital_link_identities identity
      JOIN gs1_gtin_prefix_entitlements entitlement
        ON entitlement.id = identity.entitlement_id
       AND entitlement.tenant_id = identity.tenant_id
       AND entitlement.status = 'active'
       AND identity.gtin LIKE entitlement.canonical_gtin_prefix || '%'
      WHERE identity.id = (v_identifier_input->>'registry_id')::uuid
        AND identity.tenant_id = v_tenant_id
        AND identity.status = 'active'
      FOR SHARE OF identity, entitlement;

      SELECT batch.bid INTO v_batch_bid FROM batches batch
      WHERE batch.id = v_registry.batch_id AND batch.tenant_id = v_tenant_id;
      SELECT tag.uid_hex, tag.status INTO v_tag_uid, v_tag_status FROM tags tag
      WHERE tag.id = v_registry.tag_id AND tag.batch_id = v_registry.batch_id;

      v_operation_id := uuid_generate_v4();
      INSERT INTO events (
        tenant_id, batch_id, uid_hex, cmac_ok, allowlisted, tag_status,
        result, reason, source, meta, tenant_slug, tag_id, bid, event_type,
        verdict, risk_level, geo_precision
      ) VALUES (
        v_tenant_id,
        v_registry.batch_id,
        v_tag_uid,
        NULL,
        NULL,
        v_tag_status,
        'EPCIS_RECORDED',
        'Declared EPCIS business event; not NFC cryptographic authentication.',
        'imported'::scan_source,
        jsonb_build_object(
          'canonical_event', true,
          'canonical_operation_id', v_operation_id,
          'canonical_event_name', 'epcis.event.captured',
          'event_family', 'lifecycle',
          'event_mode', 'live',
          'metric_scope', 'supply_chain',
          'evidence_level', 'declared_business_event',
          'cryptographic_authentication', false,
          'epcis_capture_id', v_capture_id,
          'epcis_document_id', v_document_id,
          'epcis_event_id', v_event_record,
          'epcis_event_type', v_event_input->>'event_type',
          'epcis_client_event_id', NULLIF(v_event_input->>'client_event_id', ''),
          'epcis_event_time', v_event_input->>'event_time',
          'epcis_biz_step', NULLIF(v_event_input->>'biz_step', ''),
          'epcis_disposition', NULLIF(v_event_input->>'disposition', ''),
          'gs1_identity_id', v_registry.id
        ),
        v_tenant_slug,
                v_registry.tag_id,
        v_batch_bid,
        v_canonical_event_type::event_type,
        'declared',
        'none',
        'none'
      ) RETURNING events.id, events.created_at INTO v_event_id, v_event_created_at;

      INSERT INTO canonical_event_operations (
        id, tenant_id, operation_key, request_fingerprint, event_name, event_mode,
        event_id, event_created_at
      ) VALUES (
        v_operation_id,
        v_tenant_id,
        'epcis:' || v_capture_id::text || ':' || v_event_record::text || ':' || v_registry.id::text,
        lower(v_identifier_input->>'projection_fingerprint'),
        'epcis.event.captured',
        'live',
        v_event_id,
        v_event_created_at
      );

      INSERT INTO epcis_event_identifiers (
        epcis_event_id, tenant_id, gs1_identity_id, canonical_operation_id,
        canonical_event_id, canonical_event_created_at
      ) VALUES (
        v_event_record, v_tenant_id, v_registry.id, v_operation_id,
        v_event_id, v_event_created_at
      );

      v_webhook_event_id := 'evt_canonical_' || v_operation_id::text;
      v_webhook_payload := jsonb_build_object(
        'id', v_webhook_event_id,
        'type', 'epcis.event.captured',
        'schemaVersion', '1.0',
        'createdAt', v_event_created_at,
        'data', jsonb_build_object(
          'canonicalEventId', v_event_id,
          'captureId', v_capture_id,
          'documentId', v_document_id,
          'epcisEventId', v_event_record,
          'clientEventId', NULLIF(v_event_input->>'client_event_id', ''),
          'eventType', v_event_input->>'event_type',
          'eventTime', v_event_input->>'event_time',
          'gs1IdentityId', v_registry.id,
          'bid', v_batch_bid,
          'evidenceLevel', 'declared_business_event',
          'cryptographicAuthentication', false
        )
      );

      INSERT INTO webhook_deliveries (
        endpoint_id, endpoint_url, event_id, event_name, payload, status,
        attempt_count, next_attempt_at
      )
      SELECT endpoint.id, endpoint.url, v_webhook_event_id,
        'epcis.event.captured', v_webhook_payload, 'pending', 0, now()
      FROM webhook_endpoints endpoint
      WHERE endpoint.tenant_id = v_tenant_id
        AND endpoint.enabled = true
        AND endpoint.deleted_at IS NULL
        AND (endpoint.events ? 'epcis.event.captured' OR endpoint.events ? '*')
      ORDER BY endpoint.updated_at DESC
      LIMIT 25
      ON CONFLICT (endpoint_id, event_id) DO NOTHING;

      v_projection_count := v_projection_count + 1;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_capture_id, v_document_id, v_tenant_id,
    jsonb_array_length(v_events), v_projection_count, v_captured_at, false;
END;
$capture$;
CREATE OR REPLACE FUNCTION public.nexid_enforce_epcis_capture_scope_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $scope$
BEGIN
 IF NEW.actor_user_id IS NOT NULL THEN
  PERFORM public.nexid_epcis_require_operator_v1(NEW.tenant_id,NEW.actor_user_id);
  PERFORM 1 FROM public.batches b WHERE b.id=(NEW.operator_context->>'batchId')::uuid AND b.tenant_id=NEW.tenant_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'epcis_operator_batch_mismatch';END IF;
 ELSE
  PERFORM 1 FROM public.tenant_api_keys k WHERE k.id=NEW.api_key_id AND k.tenant_id=NEW.tenant_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'epcis_capture_api_key_tenant_mismatch';END IF;
 END IF;
 RETURN NEW;
END;
$scope$;
CREATE INDEX IF NOT EXISTS epcis_capture_operator_recent ON public.epcis_capture_operations(tenant_id,actor_user_id,captured_at DESC) WHERE actor_user_id IS NOT NULL;
COMMENT ON COLUMN public.epcis_capture_operations.actor_user_id IS 'Authenticated human importer. Mutually exclusive with SDK api_key_id.';
