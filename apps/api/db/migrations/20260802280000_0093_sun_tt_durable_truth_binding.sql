-- Bind the durable NTAG 424 DNA TagTamper state to the exact two-byte
-- TTStatus decoded from the CMAC-verified SUN payload. This migration does
-- not decrypt NFC data, handle raw NFC keys, or claim KMS/HSM custody: the
-- existing physical AES/CMAC path remains authoritative in the application.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $sun_tt_truth_preflight$
BEGIN
  IF to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)') IS NULL
    AND to_regprocedure('public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)') IS NULL
  THEN
    RAISE EXCEPTION 'sun_tt_truth_requires_atomic_base_0089' USING ERRCODE = '42883';
  END IF;
END
$sun_tt_truth_preflight$;

CREATE OR REPLACE FUNCTION public.nexid_sun_tt_durable_truth_v1_capability()
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT 'sun-tt-durable-truth-binding/v1'::text
$$;

REVOKE ALL ON FUNCTION public.nexid_sun_tt_durable_truth_v1_capability() FROM PUBLIC;

CREATE TABLE IF NOT EXISTS public.sun_tt_truth_receipts (
  event_id bigint NOT NULL,
  event_created_at timestamptz NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
  carrier_profile_code text NOT NULL,
  tt_raw text,
  canonical_product_state text,
  claimed_product_state text,
  binding_status text NOT NULL,
  binding_reason text NOT NULL,
  status_source text,
  status_offset integer,
  status_length integer,
  picc_data_hash text NOT NULL,
  cmac_hash text NOT NULL,
  enforced_base_result text NOT NULL,
  base_auth_status text NOT NULL,
  evidence_digest text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, event_created_at),
  CONSTRAINT sun_tt_truth_receipts_event_fk
    FOREIGN KEY (event_id, event_created_at)
    REFERENCES public.events(id, created_at)
    ON DELETE RESTRICT,
  CONSTRAINT sun_tt_truth_receipts_raw_check CHECK (
    tt_raw IS NULL OR tt_raw ~ '^[0-9A-F]{4}$'
  ),
  CONSTRAINT sun_tt_truth_receipts_binding_status_check CHECK (
    binding_status IN ('BOUND', 'REJECTED', 'NOT_APPLICABLE')
  ),
  CONSTRAINT sun_tt_truth_receipts_digest_check CHECK (
    evidence_digest ~ '^sha256:[0-9a-f]{64}$'
  )
);

CREATE INDEX IF NOT EXISTS idx_sun_tt_truth_receipts_tenant_created
  ON public.sun_tt_truth_receipts (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sun_tt_truth_receipts_batch_created
  ON public.sun_tt_truth_receipts (batch_id, created_at DESC);

REVOKE ALL ON TABLE public.sun_tt_truth_receipts FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.nexid_sun_tt_truth_receipt_immutable_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'sun_tt_truth_receipt_append_only' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_sun_tt_truth_receipts_append_only
  ON public.sun_tt_truth_receipts;
CREATE TRIGGER trg_sun_tt_truth_receipts_append_only
BEFORE UPDATE OR DELETE ON public.sun_tt_truth_receipts
FOR EACH ROW EXECUTE FUNCTION public.nexid_sun_tt_truth_receipt_immutable_v1();

-- Preserve the 0089 implementation as an internal primitive. The replacement
-- keeps the historical function name because the 0066 lifecycle wrapper calls
-- it inside the same SQL statement and transaction.
DO $sun_tt_truth_wrap_base$
BEGIN
  IF to_regprocedure('public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)') IS NULL THEN
    ALTER FUNCTION public.nexid_persist_sun_scan_v1_base_0062(jsonb)
      RENAME TO nexid_persist_sun_scan_v1_base_pre_tt_0093;
  END IF;
END
$sun_tt_truth_wrap_base$;

REVOKE ALL ON FUNCTION public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb) FROM PUBLIC;

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
SECURITY DEFINER
SET search_path = public, pg_temp
AS $sun_tt_truth_function$
DECLARE
  v_receipt record;
  v_effective_input jsonb;
  v_truth jsonb;
  v_batch_id uuid;
  v_tenant_id uuid;
  v_carrier_profile_code text;
  v_claimed_carrier_profile text;
  v_tt_raw text;
  v_receipt_tt_raw text;
  v_claimed_product_state text;
  v_input_product_state text;
  v_status_source text;
  v_status_offset integer;
  v_status_length integer;
  v_canonical_product_state text;
  v_requested_force_result text;
  v_allowed_force_result text;
  v_binding_status text;
  v_binding_reason text;
  v_binding_rejected boolean := false;
  v_crypto_verified boolean;
  v_payload_verified boolean;
  v_supplier_payload_only boolean;
  v_final_result text;
  v_final_auth_status text;
  v_final_reason text;
  v_final_event_type text;
  v_final_verdict text;
  v_final_risk_level text;
  v_evidence_digest text;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'sun_atomic_input_object_required';
  END IF;

  BEGIN
    v_batch_id := NULLIF(BTRIM(p_input->>'batch_id'), '')::uuid;
    v_tenant_id := NULLIF(BTRIM(p_input->>'tenant_id'), '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'sun_atomic_input_type_invalid';
  END;

  SELECT LOWER(COALESCE(
      NULLIF(BTRIM(batch.carrier_profile_code), ''),
      NULLIF(BTRIM(batch.sdm_config->>'carrier_profile_code'), ''),
      CASE
        WHEN LOWER(COALESCE(batch.sdm_config->>'chip_model', '')) ~ 'tag.?tamper'
          OR LOWER(COALESCE(batch.sdm_config->>'chip_model', '')) ~ '424.*(dna.*)?([_-]|[[:space:]])tt$'
          THEN 'ntag424_dna_tt'
        WHEN LOWER(COALESCE(batch.sdm_config->>'chip_model', '')) LIKE '%424%'
          AND LOWER(COALESCE(batch.sdm_config->>'chip_model', '')) LIKE '%dna%'
          THEN 'ntag424_dna'
        ELSE NULL
      END
    ))
    INTO v_carrier_profile_code
  FROM public.batches batch
  WHERE batch.id = v_batch_id
    AND batch.tenant_id = v_tenant_id
    AND batch.bid = p_input->>'bid';

  v_truth := CASE
    WHEN jsonb_typeof(p_input->'tt_truth') = 'object' THEN p_input->'tt_truth'
    ELSE '{}'::jsonb
  END;
  v_claimed_carrier_profile := NULLIF(LOWER(BTRIM(v_truth->>'carrier_profile_code')), '');
  v_tt_raw := NULLIF(UPPER(BTRIM(v_truth->>'tt_raw')), '');
  v_claimed_product_state := NULLIF(UPPER(BTRIM(v_truth->>'claimed_product_state')), '');
  v_input_product_state := NULLIF(UPPER(BTRIM(p_input->>'pre_registry_result')), '');
  v_status_source := NULLIF(LOWER(BTRIM(v_truth->>'status_source')), '');
  v_status_offset := CASE
    WHEN COALESCE(v_truth->>'status_offset', '') ~ '^[0-9]{1,6}$'
      THEN (v_truth->>'status_offset')::integer
    ELSE NULL
  END;
  v_status_length := CASE
    WHEN COALESCE(v_truth->>'status_length', '') ~ '^[0-9]{1,3}$'
      THEN (v_truth->>'status_length')::integer
    ELSE NULL
  END;
  v_receipt_tt_raw := CASE
    WHEN v_tt_raw ~ '^[0-9A-F]{4}$' THEN v_tt_raw
    ELSE NULL
  END;
  v_crypto_verified := LOWER(COALESCE(p_input->>'cryptographic_verification', 'false')) = 'true';
  v_payload_verified := LOWER(COALESCE(p_input->>'payload_verified', 'false')) = 'true';
  v_supplier_payload_only := LOWER(COALESCE(p_input->>'supplier_payload_only', 'false')) = 'true';
  v_requested_force_result := NULLIF(UPPER(BTRIM(p_input->>'force_result')), '');
  v_allowed_force_result := CASE
    WHEN v_requested_force_result IN (
      'SUN_PROFILE_MISMATCH', 'NOT_ACTIVE', 'REVOKED', 'BROKEN', 'TAMPER_RISK'
    ) THEN v_requested_force_result
    ELSE NULL
  END;

  v_canonical_product_state := CASE v_tt_raw
    WHEN '4343' THEN 'VALID_CLOSED'
    WHEN '4F4F' THEN 'VALID_OPENED'
    WHEN '4F43' THEN 'VALID_OPENED_PREVIOUSLY'
    ELSE NULL
  END;

  IF v_carrier_profile_code = 'ntag424_dna_tt' THEN
    v_binding_status := 'BOUND';
    v_binding_reason := 'tt_raw_exact_match';

    IF v_truth->>'schema_version' IS DISTINCT FROM 'sun-tt-durable-truth-input/v1' THEN
      v_binding_rejected := true; v_binding_reason := 'tt_truth_schema_missing_or_invalid';
    ELSIF v_claimed_carrier_profile IS DISTINCT FROM v_carrier_profile_code THEN
      v_binding_rejected := true; v_binding_reason := 'tt_carrier_claim_mismatch';
    ELSIF NOT v_crypto_verified OR NOT v_payload_verified OR v_supplier_payload_only THEN
      v_binding_rejected := true; v_binding_reason := 'tt_physical_verification_missing';
    ELSIF v_status_source NOT IN ('enc_decrypted', 'picc_data_decrypted')
      OR v_status_offset IS NULL
      OR v_status_length IS DISTINCT FROM 2 THEN
      v_binding_rejected := true; v_binding_reason := 'tt_decode_contract_invalid';
    ELSIF v_canonical_product_state IS NULL THEN
      v_binding_rejected := true; v_binding_reason := 'tt_raw_missing_or_noncanonical';
    ELSIF v_claimed_product_state IS DISTINCT FROM v_canonical_product_state
      OR v_input_product_state IS DISTINCT FROM v_canonical_product_state THEN
      v_binding_rejected := true; v_binding_reason := 'tt_product_state_contradiction';
    ELSIF v_requested_force_result = ANY (ARRAY[
      'VALID', 'TAP_VALID', 'VALID_AUTHENTIC', 'VALID_CLOSED', 'VALID_UNKNOWN_TAMPER',
      'OPENED', 'OPENED_PREVIOUSLY', 'MANUAL_OPENED', 'VALID_OPENED',
      'VALID_OPENED_PREVIOUSLY', 'VALID_MANUAL_OPENED'
    ]) AND v_requested_force_result IS DISTINCT FROM v_canonical_product_state THEN
      v_binding_rejected := true; v_binding_reason := 'tt_force_result_contradiction';
    END IF;

    IF v_binding_rejected THEN
      v_binding_status := 'REJECTED';
    END IF;
  ELSIF v_carrier_profile_code = 'ntag424_dna' THEN
    v_binding_status := 'NOT_APPLICABLE';
    v_binding_reason := 'carrier_has_no_tt';
    v_canonical_product_state := 'VALID_AUTHENTIC';

    IF v_tt_raw IS NOT NULL
      OR v_claimed_product_state = ANY (ARRAY[
        'VALID_CLOSED', 'VALID_OPENED', 'VALID_OPENED_PREVIOUSLY',
        'VALID_UNKNOWN_TAMPER', 'VALID_MANUAL_OPENED'
      ])
      OR v_input_product_state = ANY (ARRAY[
        'VALID_CLOSED', 'VALID_OPENED', 'VALID_OPENED_PREVIOUSLY',
        'VALID_UNKNOWN_TAMPER', 'VALID_MANUAL_OPENED'
      ]) THEN
      v_binding_rejected := true;
      v_binding_status := 'REJECTED';
      v_binding_reason := 'non_tt_tamper_promotion_rejected';
    END IF;
  ELSE
    v_binding_rejected := true;
    v_binding_status := 'REJECTED';
    v_binding_reason := 'unsupported_sun_carrier_profile';
    v_canonical_product_state := NULL;
  END IF;

  v_effective_input := p_input || jsonb_build_object(
    'force_result', v_allowed_force_result
  );
  IF v_binding_rejected THEN
    v_effective_input := v_effective_input || jsonb_build_object(
      'pre_registry_result', 'SUN_PROFILE_MISMATCH',
      'force_result', 'SUN_PROFILE_MISMATCH'
    );
  ELSIF v_carrier_profile_code = 'ntag424_dna_tt' THEN
    v_effective_input := v_effective_input || jsonb_build_object(
      'pre_registry_result', v_canonical_product_state
    );
  ELSIF v_carrier_profile_code = 'ntag424_dna' THEN
    v_effective_input := v_effective_input || jsonb_build_object(
      'pre_registry_result', 'VALID_AUTHENTIC'
    );
  END IF;

  SELECT base.*
    INTO v_receipt
  FROM public.nexid_persist_sun_scan_v1_base_pre_tt_0093(v_effective_input) AS base;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sun_atomic_persistence_receipt_missing' USING ERRCODE = 'P0002';
  END IF;

  v_final_result := v_receipt.final_result;
  v_final_auth_status := v_receipt.auth_status;
  v_final_reason := v_receipt.final_reason;
  v_final_event_type := v_receipt.event_type;
  v_final_verdict := v_receipt.verdict;
  v_final_risk_level := v_receipt.risk_level;

  IF v_binding_rejected THEN
    v_final_result := 'SUN_PROFILE_MISMATCH';
    v_final_auth_status := 'SUN_PROFILE_MISMATCH';
    v_final_reason := 'sun_tt_truth_binding:' || v_binding_reason;
    v_final_event_type := 'TAP_INVALID';
    v_final_verdict := 'invalid';
    v_final_risk_level := 'medium';
  ELSIF v_carrier_profile_code = 'ntag424_dna_tt'
    AND UPPER(COALESCE(v_final_result, '')) = ANY (ARRAY[
      'VALID', 'TAP_VALID', 'VALID_AUTHENTIC', 'VALID_CLOSED', 'VALID_UNKNOWN_TAMPER',
      'OPENED', 'OPENED_PREVIOUSLY', 'MANUAL_OPENED', 'VALID_OPENED',
      'VALID_OPENED_PREVIOUSLY', 'VALID_MANUAL_OPENED'
    ])
    AND UPPER(v_final_result) IS DISTINCT FROM v_canonical_product_state THEN
    v_binding_status := 'REJECTED';
    v_binding_reason := 'tt_persisted_state_contradiction';
    v_final_result := 'SUN_PROFILE_MISMATCH';
    v_final_auth_status := 'SUN_PROFILE_MISMATCH';
    v_final_reason := 'sun_tt_truth_binding:' || v_binding_reason;
    v_final_event_type := 'TAP_INVALID';
    v_final_verdict := 'invalid';
    v_final_risk_level := 'medium';
  ELSIF v_carrier_profile_code = 'ntag424_dna'
    AND UPPER(COALESCE(v_final_result, '')) = ANY (ARRAY[
      'VALID', 'TAP_VALID', 'VALID_CLOSED', 'VALID_UNKNOWN_TAMPER',
      'OPENED', 'OPENED_PREVIOUSLY', 'MANUAL_OPENED', 'VALID_OPENED',
      'VALID_OPENED_PREVIOUSLY', 'VALID_MANUAL_OPENED'
    ]) THEN
    v_binding_status := 'REJECTED';
    v_binding_reason := 'non_tt_persisted_tamper_promotion';
    v_final_result := 'SUN_PROFILE_MISMATCH';
    v_final_auth_status := 'SUN_PROFILE_MISMATCH';
    v_final_reason := 'sun_tt_truth_binding:' || v_binding_reason;
    v_final_event_type := 'TAP_INVALID';
    v_final_verdict := 'invalid';
    v_final_risk_level := 'medium';
  END IF;

  v_evidence_digest := 'sha256:' || encode(digest(convert_to(jsonb_build_object(
    'schema_version', 'sun-tt-durable-truth-receipt/v1',
    'event_id', v_receipt.event_id,
    'event_created_at', v_receipt.created_at,
    'tenant_id', v_tenant_id,
    'batch_id', v_batch_id,
    'carrier_profile_code', COALESCE(v_carrier_profile_code, 'unsupported'),
    'tt_raw', v_tt_raw,
    'canonical_product_state', v_canonical_product_state,
    'claimed_product_state', v_claimed_product_state,
    'binding_status', v_binding_status,
    'binding_reason', v_binding_reason,
    'status_source', v_status_source,
    'status_offset', v_status_offset,
    'status_length', v_status_length,
    'picc_data_hash', p_input->>'picc_data_hash',
    'cmac_hash', p_input->>'cmac_hash',
    'cryptographic_verification', v_crypto_verified,
    'payload_verified', v_payload_verified,
    'enforced_base_result', v_final_result,
    'base_auth_status', v_final_auth_status
  )::text, 'UTF8'), 'sha256'), 'hex');

  UPDATE public.events event
  SET result = v_final_result,
      reason = v_final_reason,
      event_type = v_final_event_type::public.event_type,
      verdict = v_final_verdict,
      risk_level = v_final_risk_level::public.risk_level,
      meta = COALESCE(event.meta, '{}'::jsonb) || jsonb_build_object(
        'sun_tt_truth_receipt', jsonb_strip_nulls(jsonb_build_object(
          'schema_version', 'sun-tt-durable-truth-receipt/v1',
          'binding_status', v_binding_status,
          'binding_reason', v_binding_reason,
          'carrier_profile_code', COALESCE(v_carrier_profile_code, 'unsupported'),
          'tt_raw', v_receipt_tt_raw,
          'canonical_product_state', v_canonical_product_state,
          'evidence_digest', v_evidence_digest
        ))
      )
  WHERE event.id = v_receipt.event_id
    AND event.created_at = v_receipt.created_at
  RETURNING event.result, event.reason, event.event_type::text, event.verdict, event.risk_level::text
    INTO v_final_result, v_final_reason, v_final_event_type, v_final_verdict, v_final_risk_level;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sun_tt_truth_event_binding_missing' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.sun_tt_truth_receipts (
    event_id, event_created_at, tenant_id, batch_id, carrier_profile_code,
    tt_raw, canonical_product_state, claimed_product_state,
    binding_status, binding_reason, status_source, status_offset, status_length,
    picc_data_hash, cmac_hash, enforced_base_result, base_auth_status,
    evidence_digest
  ) VALUES (
    v_receipt.event_id,
    v_receipt.created_at,
    v_tenant_id,
    v_batch_id,
    COALESCE(v_carrier_profile_code, 'unsupported'),
    v_receipt_tt_raw,
    v_canonical_product_state,
    v_claimed_product_state,
    v_binding_status,
    v_binding_reason,
    v_status_source,
    v_status_offset,
    v_status_length,
    p_input->>'picc_data_hash',
    p_input->>'cmac_hash',
    v_final_result,
    v_final_auth_status,
    v_evidence_digest
  ) ON CONFLICT (event_id, event_created_at) DO NOTHING;

  event_id := v_receipt.event_id;
  final_result := v_final_result;
  auth_status := v_final_auth_status;
  final_reason := v_final_reason;
  replay_suspect := v_receipt.replay_suspect;
  replay_original_event_id := v_receipt.replay_original_event_id;
  allowlisted := v_receipt.allowlisted;
  tag_id := v_receipt.tag_id;
  tag_status := v_receipt.tag_status;
  previous_last_seen_ctr := v_receipt.previous_last_seen_ctr;
  last_seen_ctr := v_receipt.last_seen_ctr;
  scan_count := v_receipt.scan_count;
  event_type := v_final_event_type;
  verdict := v_final_verdict;
  risk_level := v_final_risk_level;
  created_at := v_receipt.created_at;
  RETURN NEXT;
END;
$sun_tt_truth_function$;

COMMENT ON FUNCTION public.nexid_persist_sun_scan_v1_base_0062(jsonb) IS
  'Atomic SUN persistence with exact durable TTStatus binding. Preserves the physical CMAC path; software evidence binding, not KMS or HSM custody.';
