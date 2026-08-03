-- Supplier carrier-scope integrity v1.
--
-- This migration closes two database-boundary gaps without changing the
-- physical NTAG 424 DNA / TagTamper SUN, SDM, or CMAC verification path:
--   1. every supplier key row must bind the complete order/sub-batch/batch
--      identity graph and may exist only for a secure SUN carrier; and
--   2. every manifest row must use the authoritative batch carrier, with SUN
--      reference hashes required for secure SUN carriers and forbidden for
--      keyless/static carriers.
--
-- Key ciphertexts remain application-managed software envelopes. Nothing in
-- this migration represents those envelopes as managed KMS or HSM custody.

CREATE OR REPLACE FUNCTION public.nexid_supplier_carrier_scope_integrity_v1_capability()
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT 'supplier-carrier-scope-integrity/v1'::text
$$;

-- Replace the permissive 0090 body. A key row is never valid merely because
-- supplier_order_id is NULL: every identity component is mandatory and must
-- resolve to the same tenant, order, sub-batch, batch, BID, and carrier.
CREATE OR REPLACE FUNCTION public.nexid_enforce_supplier_batch_key_carrier_scope_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $carrier_key_scope$
DECLARE
  v_carrier_profile_code text;
BEGIN
  IF NEW.tenant_id IS NULL
    OR NEW.supplier_order_id IS NULL
    OR NEW.supplier_sub_batch_id IS NULL
    OR NEW.batch_id IS NULL
    OR NULLIF(btrim(NEW.bid), '') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'supplier_batch_key_scope_incomplete';
  END IF;

  SELECT lower(btrim(supplier_order.carrier_profile_code))
    INTO v_carrier_profile_code
  FROM supplier_orders supplier_order
  JOIN supplier_sub_batches sub_batch
    ON sub_batch.supplier_order_id = supplier_order.id
   AND sub_batch.tenant_id = supplier_order.tenant_id
  JOIN batches batch
    ON batch.id = sub_batch.batch_id
   AND batch.tenant_id = sub_batch.tenant_id
   AND batch.supplier_order_id = supplier_order.id
   AND batch.supplier_sub_batch_id = sub_batch.id
   AND upper(btrim(batch.bid)) = upper(btrim(sub_batch.bid))
   AND lower(btrim(batch.carrier_profile_code)) = lower(btrim(supplier_order.carrier_profile_code))
  WHERE supplier_order.id = NEW.supplier_order_id
    AND supplier_order.tenant_id = NEW.tenant_id
    AND sub_batch.id = NEW.supplier_sub_batch_id
    AND sub_batch.batch_id = NEW.batch_id
    AND upper(btrim(sub_batch.bid)) = upper(btrim(NEW.bid))
    AND batch.id = NEW.batch_id
    AND upper(btrim(batch.bid)) = upper(btrim(NEW.bid))
  FOR SHARE OF supplier_order, sub_batch, batch;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'supplier_batch_key_scope_invalid';
  END IF;

  IF v_carrier_profile_code NOT IN ('ntag424_dna', 'ntag424_dna_tt') THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'supplier_batch_key_carrier_scope_forbidden';
  END IF;

  RETURN NEW;
END;
$carrier_key_scope$;

-- Revalidate on every update, not only when two selected columns change. This
-- makes export, rotation, revocation, and repair writes fail closed if a legacy
-- row has an incomplete or stale parent binding.
DROP TRIGGER IF EXISTS trg_batch_keys_supplier_carrier_scope_v1 ON batch_keys;
CREATE TRIGGER trg_batch_keys_supplier_carrier_scope_v1
  BEFORE INSERT OR UPDATE ON batch_keys
  FOR EACH ROW EXECUTE FUNCTION public.nexid_enforce_supplier_batch_key_carrier_scope_v1();

DROP TRIGGER IF EXISTS trg_batch_key_material_supplier_carrier_scope_v1 ON batch_key_material;
CREATE TRIGGER trg_batch_key_material_supplier_carrier_scope_v1
  BEFORE INSERT OR UPDATE ON batch_key_material
  FOR EACH ROW EXECUTE FUNCTION public.nexid_enforce_supplier_batch_key_carrier_scope_v1();

-- Keep the complete 0081 implementation as the atomic core. The new public
-- entry point below adds the carrier policy before delegating to that exact
-- body, so authorization, quantity governance, idempotency, global UID locks,
-- GS1/profile projection, lifecycle transitions, evidence, and audit behavior
-- remain owned by the already-reviewed implementation.
DO $manifest_core_snapshot$
BEGIN
  IF to_regprocedure('public.nexid_import_tag_manifest_v2_core_0081(jsonb)') IS NULL THEN
    IF to_regprocedure('public.nexid_import_tag_manifest_v2(jsonb)') IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'supplier_manifest_import_v2_core_missing';
    END IF;
    EXECUTE
      'ALTER FUNCTION public.nexid_import_tag_manifest_v2(jsonb) '
      'RENAME TO nexid_import_tag_manifest_v2_core_0081';
  END IF;
END;
$manifest_core_snapshot$;

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
AS $manifest_carrier_scope$
DECLARE
  v_tenant_id uuid;
  v_batch_id uuid;
  v_rows jsonb;
  v_requested_carrier text;
  v_batch_carrier text;
  v_supplier_order_id uuid;
  v_order_carrier text;
  v_secure_sun boolean;
BEGIN
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR octet_length(p_input::text) > 67108864 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_manifest_input_invalid';
  END IF;

  BEGIN
    v_tenant_id := NULLIF(btrim(p_input->>'tenant_id'), '')::uuid;
    v_batch_id := NULLIF(btrim(p_input->>'batch_id'), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_manifest_identity_invalid';
  END;

  v_rows := p_input->'rows';
  v_requested_carrier := lower(btrim(COALESCE(p_input->>'carrier_profile_code', '')));
  IF v_tenant_id IS NULL OR v_batch_id IS NULL
    OR jsonb_typeof(v_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_manifest_contract_invalid';
  END IF;

  SELECT
    lower(btrim(batch.carrier_profile_code)),
    batch.supplier_order_id
  INTO v_batch_carrier, v_supplier_order_id
  FROM batches batch
  WHERE batch.id = v_batch_id
    AND batch.tenant_id = v_tenant_id
  FOR SHARE OF batch;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'supplier_manifest_batch_not_found';
  END IF;

  -- The request and every normalized row must repeat the canonical carrier
  -- stored by the batch. No caller-selected fallback or row-local carrier is
  -- authoritative at the database boundary.
  IF v_requested_carrier IS DISTINCT FROM v_batch_carrier THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'supplier_manifest_carrier_mismatch';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_rows) AS manifest_row(value)
    WHERE jsonb_typeof(manifest_row.value) IS DISTINCT FROM 'object'
      OR (manifest_row.value->>'carrier_profile_code') IS DISTINCT FROM v_batch_carrier
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'supplier_manifest_carrier_mismatch';
  END IF;

  -- A supplier batch must also retain the order carrier under a stable parent
  -- lock. The atomic 0081 core performs the remaining order/sub-batch scope
  -- checks and takes its stronger write locks before committing any row.
  IF v_supplier_order_id IS NOT NULL THEN
    SELECT lower(btrim(supplier_order.carrier_profile_code))
      INTO v_order_carrier
    FROM supplier_orders supplier_order
    WHERE supplier_order.id = v_supplier_order_id
      AND supplier_order.tenant_id = v_tenant_id
    FOR SHARE OF supplier_order;
    IF NOT FOUND OR v_order_carrier IS DISTINCT FROM v_batch_carrier THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'supplier_manifest_supplier_scope_mismatch';
    END IF;
  END IF;

  v_secure_sun := v_batch_carrier IN ('ntag424_dna', 'ntag424_dna_tt');
  IF v_secure_sun THEN
    -- Secure SUN manifests require the complete hash-only reference contract
    -- for every physical tag. Raw SUN values and NFC keys remain prohibited by
    -- the 0081 normalized-projection and secret-key guards in the atomic core.
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_rows) AS manifest_row(value)
      WHERE jsonb_typeof(manifest_row.value->'sun_payload') IS DISTINCT FROM 'object'
        OR lower(COALESCE(manifest_row.value #>> '{sun_payload,raw_url_hash}', '')) !~ '^sha256:[0-9a-f]{64}$'
        OR lower(COALESCE(manifest_row.value #>> '{sun_payload,picc_data_hash}', '')) !~ '^sha256:[0-9a-f]{64}$'
        OR lower(COALESCE(manifest_row.value #>> '{sun_payload,enc_hash}', '')) !~ '^sha256:[0-9a-f]{64}$'
        OR lower(COALESCE(manifest_row.value #>> '{sun_payload,cmac_hash}', '')) !~ '^sha256:[0-9a-f]{64}$'
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
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_manifest_row_invalid';
    END IF;
  ELSE
    -- JSON null represents absence in the normalized TypeScript contract. Any
    -- actual SUN object/value on QR, GS1, UHF, NTAG 21x, event, hotel, or IoT
    -- identifier carriers is rejected before tags or payload rows are written.
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_rows) AS manifest_row(value)
      WHERE manifest_row.value ? 'sun_payload'
        AND manifest_row.value->'sun_payload' <> 'null'::jsonb
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_manifest_row_invalid';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    core.manifest_id,
    core.inserted_count,
    core.reactivated_count,
    core.registered_sun_payload_count,
    core.evidence_event_hashes
  FROM public.nexid_import_tag_manifest_v2_core_0081(p_input) AS core;
END;
$manifest_carrier_scope$;

REVOKE ALL ON FUNCTION public.nexid_supplier_carrier_scope_integrity_v1_capability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_enforce_supplier_batch_key_carrier_scope_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_import_tag_manifest_v2_core_0081(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_import_tag_manifest_v2(jsonb) FROM PUBLIC;
