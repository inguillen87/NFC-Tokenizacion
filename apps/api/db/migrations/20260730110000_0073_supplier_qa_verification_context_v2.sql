-- Supplier QA verification-context v2: rolling capability marker and exact
-- locked preimage validation.
--
-- This migration is additive. It preserves the 0070 writer for exact retries
-- created before this rollout, while new application traffic uses v2. The
-- context digest is an application/database SHA-256 consistency binding. It is
-- not a signature, KMS operation, HSM attestation, physical-presence proof, or
-- replacement for SUN/SDM/CMAC, K_META/K_FILE, counters or TagTamper evidence.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.nexid_supplier_qa_canonical_json_v2(p_value jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public, pg_temp
AS $canonical_json$
DECLARE
  v_result text;
BEGIN
  CASE jsonb_typeof(p_value)
    WHEN 'object' THEN
      SELECT '{' || COALESCE(string_agg(
        to_jsonb(entry.key)::text || ':' || public.nexid_supplier_qa_canonical_json_v2(entry.value),
        ',' ORDER BY entry.key COLLATE "C"
      ), '') || '}'
      INTO v_result
      FROM jsonb_each(p_value) AS entry(key, value);
      RETURN v_result;
    WHEN 'array' THEN
      SELECT '[' || COALESCE(string_agg(
        public.nexid_supplier_qa_canonical_json_v2(item.value),
        ',' ORDER BY item.ordinality
      ), '') || ']'
      INTO v_result
      FROM jsonb_array_elements(p_value) WITH ORDINALITY AS item(value, ordinality);
      RETURN v_result;
    ELSE
      RETURN p_value::text;
  END CASE;
END;
$canonical_json$;

CREATE TABLE IF NOT EXISTS supplier_qa_verification_context_receipts (
  qa_check_id uuid PRIMARY KEY REFERENCES supplier_qa_checks(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_order_id uuid NOT NULL REFERENCES supplier_orders(id) ON DELETE RESTRICT,
  supplier_sub_batch_id uuid NOT NULL REFERENCES supplier_sub_batches(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  context_domain text NOT NULL CHECK (context_domain = 'nexid:supplier-qa:verification-context'),
  context_version text NOT NULL CHECK (context_version = 'v2'),
  context_digest text NOT NULL CHECK (context_digest ~ '^sha256:[0-9a-f]{64}$'),
  context_binding jsonb NOT NULL CHECK (jsonb_typeof(context_binding) = 'object'),
  canonical_payload text NOT NULL CHECK (octet_length(canonical_payload) BETWEEN 2 AND 32768),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_qa_context_receipts_order
  ON supplier_qa_verification_context_receipts(tenant_id, supplier_order_id, supplier_sub_batch_id);
CREATE INDEX IF NOT EXISTS idx_supplier_qa_context_receipts_digest
  ON supplier_qa_verification_context_receipts(context_digest);

DROP TRIGGER IF EXISTS trg_supplier_qa_context_receipts_append_only
  ON supplier_qa_verification_context_receipts;
CREATE TRIGGER trg_supplier_qa_context_receipts_append_only
  BEFORE UPDATE OR DELETE ON supplier_qa_verification_context_receipts
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_qa_history_append_only();

CREATE OR REPLACE FUNCTION public.nexid_supplier_qa_verification_context_v2_capability()
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT 'supplier-qa-verification-context/v2'::text
$$;

CREATE OR REPLACE FUNCTION public.nexid_commit_supplier_qa_v2(p_input jsonb)
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
AS $commit_v2$
DECLARE
  v_tenant_id uuid;
  v_supplier_order_id uuid;
  v_supplier_sub_batch_id uuid;
  v_batch_id uuid;
  v_operation_key text;
  v_expected_digest text;
  v_expected_binding jsonb;
  v_expected_canonical text;
  v_expected_sdm_config jsonb;
  v_locked record;
  v_locked_carrier_binding jsonb;
  v_locked_carrier_digest text;
  v_locked_binding jsonb;
  v_locked_canonical text;
  v_locked_digest text;
  v_existing record;
  v_receipt record;
BEGIN
  -- Let v1 retain the established bounded error contract for malformed base
  -- identities. The v2-only preimage is validated before any mutable lookup.
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR COALESCE(p_input->>'tenant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'supplier_order_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'supplier_sub_batch_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'batch_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN QUERY SELECT * FROM public.nexid_commit_supplier_qa_v1(p_input);
    RETURN;
  END IF;

  v_tenant_id := (p_input->>'tenant_id')::uuid;
  v_supplier_order_id := (p_input->>'supplier_order_id')::uuid;
  v_supplier_sub_batch_id := (p_input->>'supplier_sub_batch_id')::uuid;
  v_batch_id := (p_input->>'batch_id')::uuid;
  v_operation_key := trim(COALESCE(p_input->>'operation_key', ''));
  v_expected_digest := lower(trim(COALESCE(p_input->>'expected_verification_context_digest', '')));
  v_expected_binding := p_input->'expected_verification_context_binding';
  v_expected_canonical := COALESCE(p_input->>'expected_verification_context_canonical', '');
  v_expected_sdm_config := COALESCE(p_input->'expected_sdm_config', '{}'::jsonb);

  IF jsonb_typeof(v_expected_binding) IS DISTINCT FROM 'object'
    OR jsonb_typeof(v_expected_sdm_config) IS DISTINCT FROM 'object'
    OR v_expected_digest !~ '^sha256:[0-9a-f]{64}$'
    OR octet_length(v_expected_canonical) NOT BETWEEN 2 AND 32768
    OR public.nexid_supplier_qa_canonical_json_v2(v_expected_binding) IS DISTINCT FROM v_expected_canonical
    OR ('sha256:' || encode(digest(convert_to(v_expected_canonical, 'UTF8'), 'sha256'), 'hex')) IS DISTINCT FROM v_expected_digest THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_qa_verification_context_v2_invalid';
  END IF;

  -- Use the same operation-key lock as v1. A receipt created by v2 has an
  -- append-only sidecar, so retries must present the exact same canonical
  -- binding. A legacy passed v1 receipt may replay only when its evidence
  -- embeds the same context digest; an unbound legacy rejection fails closed.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || chr(31) || v_operation_key, 0));
  SELECT
    q.id,
    lower(NULLIF(trim(q.evidence_json->>'verification_context_digest'), '')) AS legacy_context_digest,
    context_receipt.context_digest,
    context_receipt.context_binding,
    context_receipt.canonical_payload
  INTO v_existing
  FROM supplier_qa_checks q
  LEFT JOIN supplier_qa_verification_context_receipts context_receipt
    ON context_receipt.qa_check_id = q.id
   AND context_receipt.tenant_id = q.tenant_id
  WHERE q.tenant_id = v_tenant_id
    AND q.operation_key = v_operation_key
  LIMIT 1;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.context_digest IS NULL THEN
      IF v_existing.legacy_context_digest IS DISTINCT FROM v_expected_digest THEN
        RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'supplier_qa_legacy_context_receipt_unbound';
      END IF;
    ELSIF v_existing.context_digest IS DISTINCT FROM v_expected_digest
      OR v_existing.context_binding IS DISTINCT FROM v_expected_binding
      OR v_existing.canonical_payload IS DISTINCT FROM v_expected_canonical THEN
        RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'supplier_qa_idempotency_key_conflict';
    END IF;
    RETURN QUERY SELECT * FROM public.nexid_commit_supplier_qa_v1(p_input);
    RETURN;
  END IF;

  -- Classification uses this same advisory namespace and packaging decisions
  -- lock supplier_orders. Acquiring both before the read closes the purpose and
  -- packaging races while leaving exact retries independent of later state.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'supplier-pack-purpose' || chr(31) || v_supplier_order_id::text,
    0
  ));

  SELECT
    ssb.id AS supplier_sub_batch_id,
    lower(ssb.status::text) AS supplier_sub_batch_status,
    ssb.key_export_count,
    ssb.key_exported_at,
    lower(b.status::text) AS batch_status,
    lower(b.carrier_profile_code) AS carrier_profile_code,
    b.sdm_config,
    upper(b.bid) AS bid,
    bk.key_fingerprint,
    bk.export_count AS batch_key_export_count,
    bk.exported_at AS batch_key_exported_at,
    lower(ssb.manifest_hash) AS manifest_hash,
    lower(so.packaging_governance_status) AS packaging_governance_status,
    so.packaging_spec_revision,
    lower(so.packaging_spec_hash) AS packaging_spec_hash,
    lower(COALESCE(purpose_decision.to_purpose, so.pack_purpose)) AS effective_pack_purpose
  INTO v_locked
  FROM supplier_sub_batches ssb
  JOIN supplier_orders so
    ON so.id = ssb.supplier_order_id
   AND so.tenant_id = ssb.tenant_id
  JOIN batches b
    ON b.id = ssb.batch_id
   AND b.tenant_id = ssb.tenant_id
   AND upper(b.bid) = upper(ssb.bid)
  JOIN batch_keys bk
    ON bk.supplier_sub_batch_id = ssb.id
   AND bk.batch_id = b.id
   AND bk.tenant_id = ssb.tenant_id
   AND upper(bk.bid) = upper(ssb.bid)
   AND bk.status = 'active'
  LEFT JOIN supplier_pack_purpose_decisions purpose_decision
    ON purpose_decision.supplier_order_id = so.id
   AND purpose_decision.tenant_id = so.tenant_id
  WHERE ssb.id = v_supplier_sub_batch_id
    AND ssb.supplier_order_id = v_supplier_order_id
    AND ssb.batch_id = v_batch_id
    AND ssb.tenant_id = v_tenant_id
    AND upper(ssb.bid) = upper(trim(COALESCE(p_input->>'bid', '')))
  FOR UPDATE OF ssb, so, b, bk;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'supplier_qa_scope_not_found';
  END IF;

  IF v_locked.sdm_config IS DISTINCT FROM v_expected_sdm_config THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_verification_context_changed';
  END IF;

  v_locked_carrier_binding := jsonb_build_object(
    'carrier_profile_code', v_locked.carrier_profile_code,
    -- JSONB equality treats numerically equivalent values such as 1 and 1.0
    -- as equal, while their textual encodings can differ. Hash the exact
    -- application representation only after proving semantic equality to the
    -- locked database config so Node/PostgreSQL cannot disagree spuriously.
    'sdm_config', v_expected_sdm_config
  );
  v_locked_carrier_digest := 'sha256:' || encode(digest(convert_to(
    public.nexid_supplier_qa_canonical_json_v2(v_locked_carrier_binding),
    'UTF8'
  ), 'sha256'), 'hex');
  v_locked_binding := jsonb_build_object(
    'domain', 'nexid:supplier-qa:verification-context',
    'schema_version', 'v2',
    'tenant_id', lower(v_tenant_id::text),
    'batch_id', lower(v_batch_id::text),
    'bid', v_locked.bid,
    'manifest_hash', v_locked.manifest_hash,
    'carrier_profile_code', v_locked.carrier_profile_code,
    'key_fingerprint', upper(v_locked.key_fingerprint),
    'carrier_config_digest', v_locked_carrier_digest,
    'supplier_order_id', lower(v_supplier_order_id::text),
    'supplier_sub_batch_id', lower(v_supplier_sub_batch_id::text),
    'supplier_sub_batch_status', NULLIF(v_locked.supplier_sub_batch_status, ''),
    'batch_status', NULLIF(v_locked.batch_status, ''),
    'key_export_count', v_locked.key_export_count,
    'key_exported_at', CASE WHEN v_locked.key_exported_at IS NULL THEN NULL ELSE
      to_char(v_locked.key_exported_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END,
    'batch_key_export_count', v_locked.batch_key_export_count,
    'batch_key_exported_at', CASE WHEN v_locked.batch_key_exported_at IS NULL THEN NULL ELSE
      to_char(v_locked.batch_key_exported_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END,
    'packaging_governance_status', NULLIF(v_locked.packaging_governance_status, ''),
    'packaging_spec_revision', v_locked.packaging_spec_revision,
    'packaging_spec_hash', NULLIF(v_locked.packaging_spec_hash, ''),
    'pack_purpose', v_locked.effective_pack_purpose,
    'acceptance_scope', CASE v_locked.effective_pack_purpose
      WHEN 'trial_integration' THEN 'trial_integration'
      WHEN 'production' THEN 'production_lot'
      ELSE 'legacy_unclassified'
    END
  );
  v_locked_canonical := public.nexid_supplier_qa_canonical_json_v2(v_locked_binding);
  v_locked_digest := 'sha256:' || encode(digest(convert_to(v_locked_canonical, 'UTF8'), 'sha256'), 'hex');

  IF v_expected_binding IS DISTINCT FROM v_locked_binding
    OR v_expected_canonical IS DISTINCT FROM v_locked_canonical
    OR v_expected_digest IS DISTINCT FROM v_locked_digest THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_verification_context_changed';
  END IF;

  -- v1 performs the established evidence, canonical-event, one-time
  -- consumption and projection checks while all v2 context rows remain locked.
  SELECT * INTO v_receipt
  FROM public.nexid_commit_supplier_qa_v1(p_input);

  IF v_receipt.idempotent_replay IS DISTINCT FROM false THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_v2_unexpected_replay';
  END IF;
  INSERT INTO supplier_qa_verification_context_receipts (
    qa_check_id, tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id,
    context_domain, context_version, context_digest, context_binding, canonical_payload
  ) VALUES (
    v_receipt.qa_check_id, v_tenant_id, v_supplier_order_id, v_supplier_sub_batch_id, v_batch_id,
    'nexid:supplier-qa:verification-context', 'v2', v_expected_digest,
    v_expected_binding, v_expected_canonical
  );

  RETURN QUERY SELECT
    v_receipt.qa_check_id,
    v_receipt.qa_status,
    v_receipt.evidence_digest,
    v_receipt.evidence_event_hash,
    false;
END;
$commit_v2$;

REVOKE ALL ON FUNCTION public.nexid_supplier_qa_canonical_json_v2(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_qa_verification_context_v2_capability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_commit_supplier_qa_v2(jsonb) FROM PUBLIC;
