-- Atomic SDK external-event writer and reusable tenant webhook outbox producer.
--
-- PostgreSQL owns the transaction boundary: a business event and every matching
-- webhook delivery are committed together, or none of them are committed. The
-- delivery worker, signature-v2 envelope, retry/DLQ state machine, immutable
-- destination snapshot and SSRF/rebinding controls remain unchanged.
--
-- This is application durability only. It does not touch the physical NFC
-- cryptographic path and makes no KMS/HSM custody claim.

CREATE OR REPLACE FUNCTION public.nexid_enqueue_tenant_webhook_outbox_v1(
  p_tenant_id uuid,
  p_event_name text,
  p_idempotency_key text,
  p_data jsonb,
  p_created_at timestamptz
)
RETURNS TABLE (
  outbox_event_id text,
  webhook_attempted integer,
  webhook_queued integer,
  webhook_deduplicated integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_name text := btrim(COALESCE(p_event_name, ''));
  v_idempotency_key text := btrim(COALESCE(p_idempotency_key, ''));
  v_event_id text;
  v_payload jsonb;
  v_attempted integer := 0;
  v_queued integer := 0;
BEGIN
  IF p_tenant_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.tenants tenant WHERE tenant.id = p_tenant_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'webhook_outbox_tenant_not_found';
  END IF;
  IF v_event_name !~ '^[a-z0-9][a-z0-9._:-]{0,159}$' THEN
    RAISE EXCEPTION 'webhook_outbox_event_name_invalid';
  END IF;
  IF char_length(v_idempotency_key) NOT BETWEEN 1 AND 255
     OR v_idempotency_key ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'webhook_outbox_idempotency_key_invalid';
  END IF;
  IF p_created_at IS NULL THEN
    RAISE EXCEPTION 'webhook_outbox_created_at_required';
  END IF;
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object'
     OR octet_length(p_data::text) > 65536 THEN
    RAISE EXCEPTION 'webhook_outbox_data_invalid';
  END IF;

  -- Bytea concatenation preserves the exact NUL-delimited event-id contract
  -- used by deriveWebhookEventId in the Node producer. PostgreSQL text cannot
  -- contain NUL, so the separators are appended as bytea explicitly.
  v_event_id := 'evt_' || encode(digest(
    convert_to(p_tenant_id::text, 'UTF8')
      || decode('00', 'hex')
      || convert_to(v_event_name, 'UTF8')
      || decode('00', 'hex')
      || convert_to(v_idempotency_key, 'UTF8'),
    'sha256'
  ), 'hex');
  v_payload := jsonb_build_object(
    'schemaVersion', '1.0',
    'id', v_event_id,
    'type', v_event_name,
    'createdAt', p_created_at,
    'data', p_data
  );

  WITH matching_endpoints AS MATERIALIZED (
    SELECT endpoint.id, endpoint.url, endpoint.destination_version
    FROM public.webhook_endpoints endpoint
    WHERE endpoint.tenant_id = p_tenant_id
      AND endpoint.enabled = true
      AND endpoint.deleted_at IS NULL
      AND (endpoint.events ? v_event_name OR endpoint.events ? '*')
    ORDER BY endpoint.updated_at DESC, endpoint.id ASC
    LIMIT 25
  ),
  inserted_deliveries AS (
    INSERT INTO public.webhook_deliveries (
      endpoint_id,
      endpoint_url,
      destination_version,
      event_id,
      event_name,
      payload,
      status,
      attempt_count,
      next_attempt_at
    )
    SELECT
      endpoint.id,
      endpoint.url,
      endpoint.destination_version,
      v_event_id,
      v_event_name,
      v_payload,
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

  -- A deterministic event id may be deduplicated only when the immutable
  -- event identity and payload are byte-for-byte equivalent. Never silently
  -- accept an idempotency collision with different business data.
  IF EXISTS (
    SELECT 1
    FROM public.webhook_deliveries delivery
    JOIN public.webhook_endpoints endpoint ON endpoint.id = delivery.endpoint_id
    WHERE endpoint.tenant_id = p_tenant_id
      AND endpoint.id IN (
        SELECT candidate.id
        FROM public.webhook_endpoints candidate
        WHERE candidate.tenant_id = p_tenant_id
          AND candidate.enabled = true
          AND candidate.deleted_at IS NULL
          AND (candidate.events ? v_event_name OR candidate.events ? '*')
        ORDER BY candidate.updated_at DESC, candidate.id ASC
        LIMIT 25
      )
      AND delivery.event_id = v_event_id
      AND (
        delivery.event_name IS DISTINCT FROM v_event_name
        OR delivery.payload IS DISTINCT FROM v_payload
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'webhook_outbox_idempotency_conflict';
  END IF;

  RETURN QUERY SELECT
    v_event_id,
    COALESCE(v_attempted, 0),
    COALESCE(v_queued, 0),
    GREATEST(COALESCE(v_attempted, 0) - COALESCE(v_queued, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.nexid_write_sdk_external_event_v1(p_input jsonb)
RETURNS TABLE (
  external_event_id uuid,
  event_created_at timestamptz,
  tenant_id uuid,
  batch_id uuid,
  tag_id uuid,
  bid text,
  uid_hex text,
  event_type text,
  event_source text,
  replayed boolean,
  outbox_event_id text,
  webhook_attempted integer,
  webhook_queued integer,
  webhook_deduplicated integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_api_key_id uuid;
  v_idempotency_operation_id uuid;
  v_idempotency_operation public.sdk_idempotency_operations%ROWTYPE;
  v_api_key public.tenant_api_keys%ROWTYPE;
  v_existing public.sdk_external_events%ROWTYPE;
  v_external_event_id uuid;
  v_created_at timestamptz;
  v_batch_id uuid;
  v_tag_id uuid;
  v_bid text := NULLIF(btrim(COALESCE(p_input->>'bid', '')), '');
  v_uid_hex text := upper(NULLIF(btrim(COALESCE(p_input->>'uid_hex', '')), ''));
  v_event_type text := btrim(COALESCE(p_input->>'event_type', ''));
  v_source text := COALESCE(NULLIF(btrim(COALESCE(p_input->>'source', '')), ''), 'sdk');
  v_trace_id text := NULLIF(left(btrim(COALESCE(p_input->>'trace_id', '')), 256), '');
  v_occurred_at timestamptz;
  v_data jsonb := COALESCE(p_input->'data', '{}'::jsonb);
  v_replayed boolean := false;
  v_outbox_event_id text;
  v_attempted integer := 0;
  v_queued integer := 0;
  v_deduplicated integer := 0;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object'
     OR octet_length(p_input::text) > 131072 THEN
    RAISE EXCEPTION 'sdk_external_event_input_invalid';
  END IF;
  BEGIN
    v_tenant_id := NULLIF(p_input->>'tenant_id', '')::uuid;
    v_api_key_id := NULLIF(p_input->>'api_key_id', '')::uuid;
    v_idempotency_operation_id := NULLIF(p_input->>'idempotency_operation_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'sdk_external_event_identity_invalid';
  END;
  IF v_tenant_id IS NULL OR v_api_key_id IS NULL THEN
    RAISE EXCEPTION 'sdk_external_event_identity_invalid';
  END IF;
  IF char_length(v_event_type) NOT BETWEEN 1 AND 160
     OR v_event_type ~ '[[:cntrl:]]'
     OR char_length(v_source) NOT BETWEEN 1 AND 80
     OR v_source ~ '[[:cntrl:]]'
     OR (v_bid IS NOT NULL AND (char_length(v_bid) > 160 OR v_bid ~ '[[:cntrl:]]'))
     OR (v_uid_hex IS NOT NULL AND (char_length(v_uid_hex) > 128 OR v_uid_hex ~ '[[:cntrl:]]'))
     OR jsonb_typeof(v_data) <> 'object'
     OR octet_length(v_data::text) > 98304 THEN
    RAISE EXCEPTION 'sdk_external_event_payload_invalid';
  END IF;
  BEGIN
    v_occurred_at := NULLIF(p_input->>'occurred_at', '')::timestamptz;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'sdk_external_event_occurred_at_invalid';
  END;

  -- Lock the exact key version for the duration of the write. A concurrent
  -- revoke/expiry mutation cannot race between HTTP authentication and commit.
  SELECT api_key.*
  INTO v_api_key
  FROM public.tenant_api_keys api_key
  WHERE api_key.id = v_api_key_id
    AND api_key.tenant_id = v_tenant_id
  FOR SHARE;
  IF v_api_key.id IS NULL
     OR v_api_key.status <> 'active'
     OR (v_api_key.expires_at IS NOT NULL AND v_api_key.expires_at <= now()) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'sdk_external_event_api_key_inactive';
  END IF;
  IF NOT (
    v_api_key.scopes ? 'sdk:events'
    OR v_api_key.scopes ? 'sdk:*'
    OR v_api_key.scopes ? '*'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'sdk_external_event_scope_denied';
  END IF;

  IF v_idempotency_operation_id IS NOT NULL THEN
    SELECT operation.*
    INTO v_idempotency_operation
    FROM public.sdk_idempotency_operations operation
    WHERE operation.id = v_idempotency_operation_id
      AND operation.tenant_id = v_tenant_id
      AND operation.api_key_id = v_api_key_id
      AND operation.route = '/api/v1/sdk/events'
    FOR UPDATE;
    IF v_idempotency_operation.id IS NULL THEN
      RAISE EXCEPTION 'sdk_external_event_idempotency_scope_invalid';
    END IF;

    SELECT external_event.*
    INTO v_existing
    FROM public.sdk_external_events external_event
    WHERE external_event.idempotency_operation_id = v_idempotency_operation_id
    LIMIT 1;
    IF v_existing.id IS NULL AND v_idempotency_operation.state <> 'processing' THEN
      RAISE EXCEPTION 'sdk_external_event_idempotency_not_writable';
    END IF;
  END IF;

  IF v_existing.id IS NOT NULL THEN
    v_external_event_id := v_existing.id;
    v_created_at := v_existing.created_at;
    v_batch_id := v_existing.batch_id;
    v_tag_id := v_existing.tag_id;
    v_bid := v_existing.bid;
    v_uid_hex := v_existing.uid_hex;
    v_event_type := v_existing.event_type;
    v_source := v_existing.source;
    v_trace_id := COALESCE(NULLIF(v_existing.data->>'traceId', ''), v_trace_id);
    v_replayed := true;
  ELSE
    IF v_bid IS NOT NULL THEN
      SELECT batch.id, tag.id
      INTO v_batch_id, v_tag_id
      FROM public.batches batch
      LEFT JOIN LATERAL (
        SELECT candidate.id
        FROM public.tags candidate
        WHERE candidate.batch_id = batch.id
          AND (v_uid_hex IS NULL OR upper(candidate.uid_hex) = v_uid_hex)
        ORDER BY candidate.created_at ASC, candidate.id ASC
        LIMIT 1
      ) tag ON v_uid_hex IS NOT NULL
      WHERE batch.tenant_id = v_tenant_id
        AND batch.bid = v_bid
      LIMIT 1
      FOR SHARE OF batch;
      IF v_batch_id IS NULL THEN
        RAISE EXCEPTION USING
          ERRCODE = 'P0002',
          MESSAGE = 'sdk_external_event_batch_not_found_for_tenant';
      END IF;
    END IF;

    INSERT INTO public.sdk_external_events (
      tenant_id,
      api_key_id,
      batch_id,
      tag_id,
      bid,
      uid_hex,
      event_type,
      source,
      occurred_at,
      data,
      idempotency_operation_id
    ) VALUES (
      v_tenant_id,
      v_api_key_id,
      v_batch_id,
      v_tag_id,
      v_bid,
      v_uid_hex,
      v_event_type,
      v_source,
      v_occurred_at,
      v_data,
      v_idempotency_operation_id
    )
    RETURNING id, created_at
    INTO v_external_event_id, v_created_at;
  END IF;

  SELECT
    receipt.outbox_event_id,
    receipt.webhook_attempted,
    receipt.webhook_queued,
    receipt.webhook_deduplicated
  INTO
    v_outbox_event_id,
    v_attempted,
    v_queued,
    v_deduplicated
  FROM public.nexid_enqueue_tenant_webhook_outbox_v1(
    v_tenant_id,
    'sdk.external_event',
    v_external_event_id::text,
    jsonb_build_object(
      'eventId', v_external_event_id::text,
      'eventType', v_event_type,
      'bid', v_bid,
      'uidHex', v_uid_hex,
      'source', v_source,
      'traceId', v_trace_id
    ),
    v_created_at
  ) receipt;

  IF v_outbox_event_id IS NULL
     OR v_attempted <> v_queued + v_deduplicated THEN
    RAISE EXCEPTION 'sdk_external_event_outbox_receipt_unconfirmed';
  END IF;

  RETURN QUERY SELECT
    v_external_event_id,
    v_created_at,
    v_tenant_id,
    v_batch_id,
    v_tag_id,
    v_bid,
    v_uid_hex,
    v_event_type,
    v_source,
    v_replayed,
    v_outbox_event_id,
    v_attempted,
    v_queued,
    v_deduplicated;
END;
$$;

COMMENT ON FUNCTION public.nexid_enqueue_tenant_webhook_outbox_v1(uuid, text, text, jsonb, timestamptz)
  IS 'Reusable transactional outbox producer. Call from the same PostgreSQL statement/function as the business mutation.';
COMMENT ON FUNCTION public.nexid_write_sdk_external_event_v1(jsonb)
  IS 'Atomically persists an SDK external event and all matching immutable webhook delivery rows.';

REVOKE ALL ON FUNCTION public.nexid_enqueue_tenant_webhook_outbox_v1(uuid, text, text, jsonb, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_write_sdk_external_event_v1(jsonb) FROM PUBLIC;
