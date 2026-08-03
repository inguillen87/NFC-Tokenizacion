-- Authoritative commercial activation for production supplier lots.
--
-- Migration 0075 records an immutable tenant-approved QA plan, a consumed
-- inspection session and the resulting Supplier Production Acceptance v2
-- receipt. This migration connects that evidence to every existing 0071
-- commercial sink and adds the atomic tag activation writer used by the admin
-- routes. It does not modify NFC keys, SUN/SDM verification, counters, CMAC or
-- the physical TagTamper path.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS supplier_production_activation_receipts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_order_id uuid NOT NULL REFERENCES supplier_orders(id) ON DELETE RESTRICT,
  supplier_sub_batch_id uuid NOT NULL REFERENCES supplier_sub_batches(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  bid text NOT NULL,
  lot_size integer NOT NULL CHECK (lot_size > 0),
  operation_key text NOT NULL CHECK (operation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  request_binding jsonb NOT NULL CHECK (jsonb_typeof(request_binding) = 'object'),
  selection_mode text NOT NULL CHECK (selection_mode IN ('all', 'count', 'uids', 'state_only')),
  requested_count integer NOT NULL CHECK (requested_count >= 0),
  activated_count integer NOT NULL CHECK (activated_count >= 0 AND activated_count <= requested_count),
  activated_uids text[] NOT NULL DEFAULT ARRAY[]::text[],
  remaining_inactive integer NOT NULL CHECK (remaining_inactive >= 0),
  activation_complete boolean NOT NULL,
  qa_plan_decision_id uuid NOT NULL REFERENCES supplier_production_qa_plan_decisions(id) ON DELETE RESTRICT,
  production_session_id uuid NOT NULL REFERENCES supplier_production_qa_sessions(id) ON DELETE RESTRICT,
  production_receipt_id uuid NOT NULL REFERENCES supplier_production_qa_decisions(id) ON DELETE RESTRICT,
  qa_check_id uuid NOT NULL REFERENCES supplier_qa_checks(id) ON DELETE RESTRICT,
  evidence_event_hash text NOT NULL CHECK (evidence_event_hash ~ '^sha256:[0-9a-f]{64}$'),
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, operation_key),
  CHECK (cardinality(activated_uids) = activated_count),
  CHECK (selection_mode <> 'state_only' OR (requested_count = 0 AND activated_count = 0))
);

CREATE INDEX IF NOT EXISTS idx_supplier_production_activation_receipts_scope
  ON supplier_production_activation_receipts(
    tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, created_at DESC
  );

CREATE OR REPLACE FUNCTION public.nexid_supplier_production_activation_history_append_only_v2()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $activation_history$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_activation_history_is_append_only';
END;
$activation_history$;

DROP TRIGGER IF EXISTS trg_supplier_production_activation_receipts_append_only
  ON supplier_production_activation_receipts;
CREATE TRIGGER trg_supplier_production_activation_receipts_append_only
  BEFORE UPDATE OR DELETE ON supplier_production_activation_receipts
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_production_activation_history_append_only_v2();

CREATE OR REPLACE FUNCTION public.nexid_supplier_production_activation_receipt_v2(p_batch_id uuid)
RETURNS TABLE (
  tenant_id uuid,
  supplier_order_id uuid,
  supplier_sub_batch_id uuid,
  batch_id uuid,
  bid text,
  lot_size integer,
  qa_plan_id uuid,
  qa_plan_decision_id uuid,
  production_session_id uuid,
  production_receipt_id uuid,
  qa_check_id uuid,
  schema_version text,
  receipt_status text,
  acceptance_context_digest text,
  decided_at timestamptz
)
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $activation_receipt$
  SELECT
    sub_batch.tenant_id,
    sub_batch.supplier_order_id,
    sub_batch.id AS supplier_sub_batch_id,
    sub_batch.batch_id,
    upper(sub_batch.bid) AS bid,
    sub_batch.expected_quantity AS lot_size,
    plan.id AS qa_plan_id,
    plan_decision.id AS qa_plan_decision_id,
    session_row.id AS production_session_id,
    receipt.id AS production_receipt_id,
    qa_check.id AS qa_check_id,
    receipt.schema_version,
    receipt.status AS receipt_status,
    receipt.acceptance_context_digest,
    receipt.decided_at
  FROM batches batch
  JOIN supplier_sub_batches sub_batch
    ON sub_batch.id = batch.supplier_sub_batch_id
   AND sub_batch.batch_id = batch.id
   AND sub_batch.tenant_id = batch.tenant_id
   AND sub_batch.supplier_order_id = batch.supplier_order_id
   AND upper(sub_batch.bid) = upper(batch.bid)
  JOIN supplier_orders supplier_order
    ON supplier_order.id = sub_batch.supplier_order_id
   AND supplier_order.tenant_id = sub_batch.tenant_id
   AND supplier_order.pack_purpose = sub_batch.pack_purpose
  JOIN supplier_production_qa_plans plan
    ON plan.tenant_id = sub_batch.tenant_id
   AND plan.supplier_order_id = sub_batch.supplier_order_id
   AND plan.supplier_sub_batch_id = sub_batch.id
   AND plan.batch_id = sub_batch.batch_id
   AND upper(plan.bid) = upper(sub_batch.bid)
   AND plan.schema_version = 'supplier-production-qa-plan/v1'
   AND plan.lot_size = sub_batch.expected_quantity
  JOIN supplier_production_qa_plan_decisions plan_decision
    ON plan_decision.id = (
      SELECT session_candidate.qa_plan_decision_id
      FROM supplier_production_qa_sessions session_candidate
      JOIN supplier_production_qa_decisions receipt_candidate
        ON receipt_candidate.session_id = session_candidate.id
       AND receipt_candidate.tenant_id = session_candidate.tenant_id
       AND receipt_candidate.supplier_order_id = session_candidate.supplier_order_id
       AND receipt_candidate.supplier_sub_batch_id = session_candidate.supplier_sub_batch_id
       AND receipt_candidate.batch_id = session_candidate.batch_id
       AND upper(receipt_candidate.bid) = upper(session_candidate.bid)
      WHERE session_candidate.qa_plan_id = plan.id
        AND session_candidate.tenant_id = plan.tenant_id
        AND session_candidate.supplier_order_id = plan.supplier_order_id
        AND session_candidate.supplier_sub_batch_id = plan.supplier_sub_batch_id
        AND session_candidate.batch_id = plan.batch_id
        AND upper(session_candidate.bid) = upper(plan.bid)
        AND receipt_candidate.schema_version = 'supplier-production-acceptance/v2'
        AND receipt_candidate.status = 'passed'
        AND receipt_candidate.disposition = 'ACCEPT'
      ORDER BY receipt_candidate.decided_at DESC, receipt_candidate.id DESC
      LIMIT 1
    )
   AND plan_decision.plan_id = plan.id
   AND plan_decision.tenant_id = plan.tenant_id
   AND plan_decision.supplier_order_id = plan.supplier_order_id
   AND plan_decision.supplier_sub_batch_id = plan.supplier_sub_batch_id
   AND plan_decision.batch_id = plan.batch_id
   AND upper(plan_decision.bid) = upper(plan.bid)
   AND plan_decision.schema_version = 'supplier-production-qa-plan-decision/v1'
   AND plan_decision.decision_status = 'approved'
   AND plan_decision.approver_role = 'tenant_admin'
   AND plan_decision.plan_digest = plan.plan_digest
   AND plan_decision.decided_at <= now()
  JOIN supplier_production_qa_sessions session_row
    ON session_row.qa_plan_id = plan.id
   AND session_row.qa_plan_decision_id = plan_decision.id
   AND session_row.tenant_id = plan.tenant_id
   AND session_row.supplier_order_id = plan.supplier_order_id
   AND session_row.supplier_sub_batch_id = plan.supplier_sub_batch_id
   AND session_row.batch_id = plan.batch_id
   AND upper(session_row.bid) = upper(plan.bid)
   AND session_row.schema_version = 'supplier-production-qa-session/v1'
   AND session_row.lot_size = plan.lot_size
   AND session_row.policy_digest = plan.plan_digest
   AND session_row.manifest_hash = sub_batch.manifest_hash
   AND lower(session_row.carrier_profile_code) = lower(batch.carrier_profile_code)
   AND session_row.packaging_spec_revision = supplier_order.packaging_spec_revision
   AND session_row.packaging_spec_hash = supplier_order.packaging_spec_hash
  JOIN supplier_production_qa_decisions receipt
    ON receipt.session_id = session_row.id
   AND receipt.tenant_id = session_row.tenant_id
   AND receipt.supplier_order_id = session_row.supplier_order_id
   AND receipt.supplier_sub_batch_id = session_row.supplier_sub_batch_id
   AND receipt.batch_id = session_row.batch_id
   AND upper(receipt.bid) = upper(session_row.bid)
   AND receipt.schema_version = 'supplier-production-acceptance/v2'
   AND receipt.status = 'passed'
   AND receipt.disposition = 'ACCEPT'
   AND receipt.acceptance_context_digest = session_row.acceptance_context_digest
   AND receipt.decided_at >= session_row.created_at
   AND receipt.decided_at <= session_row.expires_at
  JOIN supplier_qa_checks qa_check
    ON qa_check.id = receipt.qa_check_id
   AND qa_check.id = sub_batch.release_qa_check_id
   AND qa_check.id = batch.release_qa_check_id
   AND qa_check.tenant_id = receipt.tenant_id
   AND qa_check.supplier_order_id = receipt.supplier_order_id
   AND qa_check.supplier_sub_batch_id = receipt.supplier_sub_batch_id
   AND qa_check.batch_id = receipt.batch_id
   AND upper(qa_check.bid) = upper(receipt.bid)
   AND qa_check.status = 'passed'
   AND qa_check.acceptance_scope = 'production_lot'
   AND qa_check.evidence_json->>'production_session_id' = session_row.id::text
   AND qa_check.evidence_json->>'production_acceptance_schema_version' = 'supplier-production-acceptance/v2'
   AND lower(qa_check.evidence_json->>'production_policy_digest') = session_row.policy_digest
   AND lower(qa_check.evidence_json->>'production_selection_digest') = session_row.selection_digest
   AND lower(qa_check.evidence_json->>'production_acceptance_context_digest') = session_row.acceptance_context_digest
  JOIN batch_keys batch_key
    ON batch_key.supplier_sub_batch_id = sub_batch.id
   AND batch_key.batch_id = sub_batch.batch_id
   AND batch_key.tenant_id = sub_batch.tenant_id
   AND upper(batch_key.bid) = upper(sub_batch.bid)
   AND batch_key.status = 'active'
   AND upper(batch_key.key_fingerprint) = upper(session_row.key_fingerprint)
  WHERE batch.id = p_batch_id
    AND public.nexid_effective_supplier_pack_purpose_v1(supplier_order.id) = 'production'
    AND sub_batch.pack_purpose = 'production'
    AND sub_batch.manifest_status = 'imported'
    AND sub_batch.manifest_count = sub_batch.expected_quantity
    AND sub_batch.qa_status = 'passed'
    AND sub_batch.qa_acceptance_scope = 'production_lot'
    AND sub_batch.release_qa_check_id = receipt.qa_check_id
    AND sub_batch.manufacturing_state IN ('RECEIVING_QA_PASSED', 'ACTIVATED')
    AND batch.qa_status = 'passed'
    AND batch.qa_acceptance_scope = 'production_lot'
    AND batch.release_qa_check_id = receipt.qa_check_id
    AND plan.plan_binding->>'tenant_id' = lower(sub_batch.tenant_id::text)
    AND plan.plan_binding->>'supplier_order_id' = lower(sub_batch.supplier_order_id::text)
    AND plan.plan_binding->>'supplier_sub_batch_id' = lower(sub_batch.id::text)
    AND plan.plan_binding->>'batch_id' = lower(sub_batch.batch_id::text)
    AND upper(plan.plan_binding->>'bid') = upper(sub_batch.bid)
    AND (plan.plan_binding->>'lot_size')::integer = sub_batch.expected_quantity
    AND NOT EXISTS (
      SELECT 1
      FROM supplier_production_qa_plans newer_plan
      WHERE newer_plan.tenant_id = plan.tenant_id
        AND newer_plan.supplier_sub_batch_id = plan.supplier_sub_batch_id
        AND newer_plan.revision > plan.revision
    )
    AND (SELECT count(*)::integer FROM tags lot_tag WHERE lot_tag.batch_id = batch.id) = sub_batch.expected_quantity
  FOR SHARE OF supplier_order, sub_batch, batch, plan, plan_decision,
    session_row, receipt, qa_check, batch_key
$activation_receipt$;

CREATE OR REPLACE FUNCTION public.nexid_assert_supplier_production_activation_v2(p_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $assert_activation$
DECLARE
  v_receipt_count integer;
BEGIN
  SELECT count(*)::integer
    INTO v_receipt_count
  FROM public.nexid_supplier_production_activation_receipt_v2(p_batch_id);

  IF v_receipt_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_acceptance_v2_required';
  END IF;
END;
$assert_activation$;

-- Preserve the public function name consumed by all 0071 and 0072 triggers and
-- writers, while replacing the intentional production hard-stop with the
-- exact v2 evidence gate above. Non-supplier batches keep their historical
-- behavior; legacy and trial supplier packs remain fail-closed.
CREATE OR REPLACE FUNCTION public.nexid_assert_supplier_commercial_release_v1(p_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $commercial_release$
DECLARE
  v_batch record;
  v_sub_batch record;
  v_sub_batch_count integer;
  v_effective_purpose text;
BEGIN
  SELECT batch.id, batch.tenant_id, batch.bid,
         batch.supplier_order_id, batch.supplier_sub_batch_id
    INTO v_batch
  FROM batches batch
  WHERE batch.id = p_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'supplier_commercial_batch_not_found';
  END IF;

  SELECT count(*)::integer
    INTO v_sub_batch_count
  FROM supplier_sub_batches sub_batch
  WHERE sub_batch.batch_id = v_batch.id
     OR (v_batch.supplier_sub_batch_id IS NOT NULL AND sub_batch.id = v_batch.supplier_sub_batch_id)
     OR (sub_batch.tenant_id = v_batch.tenant_id AND upper(sub_batch.bid) = upper(v_batch.bid));

  IF v_batch.supplier_order_id IS NULL
    AND v_batch.supplier_sub_batch_id IS NULL
    AND v_sub_batch_count = 0 THEN
    RETURN;
  END IF;
  IF v_batch.supplier_order_id IS NULL
    OR v_batch.supplier_sub_batch_id IS NULL
    OR v_sub_batch_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_commercial_scope_invalid';
  END IF;

  SELECT sub_batch.id, sub_batch.supplier_order_id, sub_batch.tenant_id,
         sub_batch.batch_id, sub_batch.bid,
         public.nexid_effective_supplier_pack_purpose_v1(sub_batch.supplier_order_id) AS effective_pack_purpose
    INTO v_sub_batch
  FROM supplier_sub_batches sub_batch
  WHERE sub_batch.batch_id = v_batch.id
     OR sub_batch.id = v_batch.supplier_sub_batch_id
     OR (sub_batch.tenant_id = v_batch.tenant_id AND upper(sub_batch.bid) = upper(v_batch.bid))
  LIMIT 1;
  IF v_sub_batch.id IS DISTINCT FROM v_batch.supplier_sub_batch_id
    OR v_sub_batch.batch_id IS DISTINCT FROM v_batch.id
    OR v_sub_batch.supplier_order_id IS DISTINCT FROM v_batch.supplier_order_id
    OR v_sub_batch.tenant_id IS DISTINCT FROM v_batch.tenant_id
    OR upper(v_sub_batch.bid) IS DISTINCT FROM upper(v_batch.bid) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_commercial_scope_invalid';
  END IF;

  v_effective_purpose := lower(COALESCE(v_sub_batch.effective_pack_purpose, ''));
  IF v_effective_purpose = '' OR v_effective_purpose = 'legacy_unclassified' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_pack_purpose_unclassified';
  END IF;
  IF v_effective_purpose = 'trial_integration' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_trial_integration_non_sellable';
  END IF;
  IF v_effective_purpose <> 'production' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_commercial_scope_invalid';
  END IF;

  PERFORM public.nexid_assert_supplier_production_activation_v2(v_batch.id);
END;
$commercial_release$;

CREATE OR REPLACE FUNCTION public.nexid_assert_supplier_order_commercial_release_v1(p_supplier_order_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $order_release$
DECLARE
  v_effective_purpose text;
  v_total integer;
  v_accepted integer;
BEGIN
  v_effective_purpose := public.nexid_effective_supplier_pack_purpose_v1(p_supplier_order_id);
  IF v_effective_purpose = 'legacy_unclassified' OR v_effective_purpose IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_pack_purpose_unclassified';
  END IF;
  IF v_effective_purpose = 'trial_integration' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_trial_integration_non_sellable';
  END IF;
  IF v_effective_purpose <> 'production' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_commercial_scope_invalid';
  END IF;

  SELECT count(*)::integer,
         count(*) FILTER (WHERE EXISTS (
           SELECT 1
           FROM public.nexid_supplier_production_activation_receipt_v2(sub_batch.batch_id)
         ))::integer
    INTO v_total, v_accepted
  FROM supplier_sub_batches sub_batch
  WHERE sub_batch.supplier_order_id = p_supplier_order_id;
  IF v_total = 0 OR v_accepted <> v_total THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_acceptance_v2_required';
  END IF;
END;
$order_release$;

CREATE OR REPLACE FUNCTION public.nexid_activate_supplier_tags_v2(p_input jsonb)
RETURNS TABLE (
  activation_receipt_id uuid,
  requested_count integer,
  activated_count integer,
  activated_uids text[],
  remaining_inactive integer,
  activation_complete boolean,
  production_receipt_id uuid,
  production_session_id uuid,
  evidence_event_hash text,
  idempotent_replay boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $activate_tags$
DECLARE
  v_tenant_id uuid;
  v_supplier_order_id uuid;
  v_supplier_sub_batch_id uuid;
  v_batch_id uuid;
  v_actor_id uuid;
  v_auth_session_id uuid;
  v_bid text;
  v_operation_key text;
  v_selection_mode text;
  v_lot_size integer;
  v_limit integer;
  v_uids text[] := ARRAY[]::text[];
  v_request_binding jsonb;
  v_request_fingerprint text;
  v_existing supplier_production_activation_receipts%ROWTYPE;
  v_activation_receipt_id uuid := gen_random_uuid();
  v_requested_count integer := 0;
  v_activated_count integer := 0;
  v_activated_uids text[] := ARRAY[]::text[];
  v_remaining_inactive integer := 0;
  v_activation_complete boolean := false;
  v_receipt record;
  v_event_payload jsonb;
  v_event_hash text;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR octet_length(p_input::text) > 4194304 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_activation_input_invalid';
  END IF;
  BEGIN
    v_tenant_id := NULLIF(trim(p_input->>'tenant_id'), '')::uuid;
    v_supplier_order_id := NULLIF(trim(p_input->>'supplier_order_id'), '')::uuid;
    v_supplier_sub_batch_id := NULLIF(trim(p_input->>'supplier_sub_batch_id'), '')::uuid;
    v_batch_id := NULLIF(trim(p_input->>'batch_id'), '')::uuid;
    v_actor_id := NULLIF(trim(p_input->>'actor_id'), '')::uuid;
    v_auth_session_id := NULLIF(trim(p_input->>'auth_session_id'), '')::uuid;
    v_lot_size := NULLIF(trim(p_input->>'lot_size'), '')::integer;
    v_limit := COALESCE(NULLIF(trim(p_input->>'limit'), '')::integer, 0);
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_activation_identity_invalid';
  END;
  v_bid := upper(trim(COALESCE(p_input->>'bid', '')));
  v_operation_key := trim(COALESCE(p_input->>'operation_key', ''));
  v_selection_mode := lower(trim(COALESCE(p_input->>'selection_mode', '')));
  IF v_tenant_id IS NULL OR v_supplier_order_id IS NULL OR v_supplier_sub_batch_id IS NULL
    OR v_batch_id IS NULL OR v_actor_id IS NULL OR v_auth_session_id IS NULL
    OR v_bid = '' OR v_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
    OR v_selection_mode NOT IN ('all', 'count', 'uids', 'state_only')
    OR v_lot_size IS NULL OR v_lot_size < 1 OR v_lot_size > 10000000
    OR v_limit < 0 OR v_limit > 10000000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_activation_contract_invalid';
  END IF;
  IF v_selection_mode = 'count' AND v_limit < 1 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_activation_limit_invalid';
  END IF;
  IF v_selection_mode <> 'count' AND v_limit <> 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_activation_limit_invalid';
  END IF;
  IF v_selection_mode = 'uids' THEN
    IF jsonb_typeof(p_input->'uids') IS DISTINCT FROM 'array'
      OR jsonb_array_length(p_input->'uids') < 1
      OR jsonb_array_length(p_input->'uids') > 100000
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_input->'uids') item(value)
        WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'string'
          OR upper(trim(item.value #>> '{}')) !~ '^[0-9A-F]{8,64}$'
      ) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_activation_uids_invalid';
    END IF;
    SELECT COALESCE(array_agg(normalized.uid ORDER BY normalized.uid), ARRAY[]::text[])
      INTO v_uids
    FROM (
      SELECT upper(trim(item.value #>> '{}')) AS uid
      FROM jsonb_array_elements(p_input->'uids') item(value)
    ) normalized;
    IF EXISTS (
      SELECT 1
      FROM unnest(v_uids) normalized_uid(uid)
      GROUP BY normalized_uid.uid
      HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_activation_uids_duplicate';
    END IF;
    v_requested_count := cardinality(v_uids);
  ELSIF p_input ? 'uids' AND p_input->'uids' IS DISTINCT FROM '[]'::jsonb THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_activation_uids_forbidden';
  END IF;
  IF v_selection_mode = 'count' THEN
    v_requested_count := v_limit;
  END IF;

  v_request_binding := jsonb_build_object(
    'schema_version', 'supplier-production-activation-request/v2',
    'tenant_id', lower(v_tenant_id::text),
    'supplier_order_id', lower(v_supplier_order_id::text),
    'supplier_sub_batch_id', lower(v_supplier_sub_batch_id::text),
    'batch_id', lower(v_batch_id::text),
    'bid', v_bid,
    'lot_size', v_lot_size,
    'actor_id', lower(v_actor_id::text),
    'selection_mode', v_selection_mode,
    'limit', v_limit,
    'uids', to_jsonb(v_uids)
  );
  v_request_fingerprint := 'sha256:' || encode(digest(v_request_binding::text, 'sha256'), 'hex');

  -- Re-authorize every attempt, including a replay. A stored receipt is never
  -- an authorization capability and operation keys are caller-owned opaque IDs.
  PERFORM 1
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
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'supplier_production_activation_actor_scope_invalid';
  END IF;

  -- Serialize the tenant-owned operation key before inspecting mutable lot
  -- state. Exact retries replay the immutable receipt; conflicting reuse never
  -- reaches a tag or batch mutation.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'supplier-production-activation-operation' || chr(31)
      || v_tenant_id::text || chr(31) || v_operation_key,
    0
  ));
  SELECT activation.*
    INTO v_existing
  FROM supplier_production_activation_receipts activation
  WHERE activation.tenant_id = v_tenant_id
    AND activation.operation_key = v_operation_key;
  IF FOUND THEN
    IF v_existing.request_fingerprint IS DISTINCT FROM v_request_fingerprint
      OR v_existing.request_binding IS DISTINCT FROM v_request_binding THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'supplier_production_activation_idempotency_conflict';
    END IF;
    RETURN QUERY SELECT
      v_existing.id,
      v_existing.requested_count,
      v_existing.activated_count,
      v_existing.activated_uids,
      v_existing.remaining_inactive,
      v_existing.activation_complete,
      v_existing.production_receipt_id,
      v_existing.production_session_id,
      v_existing.evidence_event_hash,
      true;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'supplier-production-activation-batch' || chr(31) || v_batch_id::text,
    0
  ));
  SELECT * INTO v_receipt
  FROM public.nexid_supplier_production_activation_receipt_v2(v_batch_id) receipt
  WHERE receipt.tenant_id = v_tenant_id
    AND receipt.supplier_order_id = v_supplier_order_id
    AND receipt.supplier_sub_batch_id = v_supplier_sub_batch_id
    AND receipt.batch_id = v_batch_id
    AND upper(receipt.bid) = v_bid
    AND receipt.lot_size = v_lot_size;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_acceptance_v2_required';
  END IF;

  IF v_selection_mode = 'uids' THEN
    PERFORM 1
    FROM tags tag
    WHERE tag.batch_id = v_batch_id
      AND tag.status::text = 'inactive'
      AND upper(tag.uid_hex) = ANY(v_uids)
    FOR UPDATE OF tag;
    IF (
      SELECT count(*)::integer
      FROM tags tag
      WHERE tag.batch_id = v_batch_id
        AND tag.status::text = 'inactive'
        AND upper(tag.uid_hex) = ANY(v_uids)
    ) <> v_requested_count THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_activation_uids_not_activatable';
    END IF;
  END IF;

  IF v_selection_mode = 'state_only' THEN
    PERFORM 1
    FROM tags tag
    WHERE tag.batch_id = v_batch_id
      AND tag.status::text = 'inactive'
    FOR UPDATE OF tag;
  ELSE
    WITH target AS MATERIALIZED (
      SELECT tag.id
      FROM tags tag
      WHERE tag.batch_id = v_batch_id
        AND tag.status::text = 'inactive'
        AND (v_selection_mode <> 'uids' OR upper(tag.uid_hex) = ANY(v_uids))
      ORDER BY tag.created_at ASC, upper(tag.uid_hex), tag.id
      LIMIT CASE WHEN v_selection_mode = 'count' THEN v_limit ELSE 2147483647 END
      FOR UPDATE OF tag
    ), activated AS (
      UPDATE tags tag
      SET status = 'active', updated_at = now()
      FROM target
      WHERE tag.id = target.id
      RETURNING upper(tag.uid_hex) AS uid_hex
    )
    SELECT count(*)::integer,
           COALESCE(array_agg(activated.uid_hex ORDER BY activated.uid_hex), ARRAY[]::text[])
      INTO v_activated_count, v_activated_uids
    FROM activated;
    IF v_selection_mode = 'uids' AND v_activated_count <> v_requested_count THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_activation_uids_not_activatable';
    END IF;
    IF v_selection_mode = 'all' THEN
      v_requested_count := v_activated_count;
    END IF;
  END IF;

  SELECT count(*)::integer
    INTO v_remaining_inactive
  FROM tags tag
  WHERE tag.batch_id = v_batch_id
    AND tag.status::text = 'inactive';
  v_activation_complete := v_remaining_inactive = 0;
  IF v_selection_mode = 'state_only' AND NOT v_activation_complete THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_activation_tags_incomplete';
  END IF;

  UPDATE supplier_sub_batches sub_batch
  SET status = CASE WHEN v_activation_complete THEN 'activated' ELSE 'partially_activated' END,
      activated_at = CASE WHEN v_activation_complete THEN COALESCE(sub_batch.activated_at, now()) ELSE sub_batch.activated_at END,
      updated_at = now()
  WHERE sub_batch.id = v_supplier_sub_batch_id
    AND sub_batch.tenant_id = v_tenant_id
    AND sub_batch.supplier_order_id = v_supplier_order_id
    AND sub_batch.batch_id = v_batch_id
    AND upper(sub_batch.bid) = v_bid;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_commercial_scope_invalid';
  END IF;

  IF v_activation_complete THEN
    UPDATE batches batch
    SET status = 'active_in_market'
    WHERE batch.id = v_batch_id
      AND batch.tenant_id = v_tenant_id
      AND batch.supplier_order_id = v_supplier_order_id
      AND batch.supplier_sub_batch_id = v_supplier_sub_batch_id
      AND upper(batch.bid) = v_bid;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_commercial_scope_invalid';
    END IF;
  END IF;

  v_event_payload := jsonb_build_object(
    'schema_version', 'supplier-production-activation/v2',
    'activation_receipt_id', v_activation_receipt_id,
    'operation_key', v_operation_key,
    'request_fingerprint', v_request_fingerprint,
    'supplier_order_id', v_supplier_order_id,
    'supplier_sub_batch_id', v_supplier_sub_batch_id,
    'batch_id', v_batch_id,
    'bid', v_bid,
    'lot_size', v_receipt.lot_size,
    'selection_mode', v_selection_mode,
    'qa_plan_decision_id', v_receipt.qa_plan_decision_id,
    'production_session_id', v_receipt.production_session_id,
    'production_receipt_id', v_receipt.production_receipt_id,
    'qa_check_id', v_receipt.qa_check_id,
    'requested_count', v_requested_count,
    'activated_count', v_activated_count,
    'activated_uids', to_jsonb(v_activated_uids),
    'remaining_inactive', v_remaining_inactive,
    'activation_complete', v_activation_complete
  );
  v_event_hash := 'sha256:' || encode(digest(jsonb_build_object(
    'schema_version', 'supplier-production-activation-event/v2',
    'tenant_id', v_tenant_id,
    'resource_type', 'supplier_sub_batch',
    'resource_id', v_supplier_sub_batch_id,
    'event_type', CASE WHEN v_activation_complete
      THEN 'supplier_production_batch_activated'
      ELSE 'supplier_production_batch_partially_activated' END,
    'payload', v_event_payload
  )::text, 'sha256'), 'hex');

  INSERT INTO evidence_events (
    tenant_id, resource_type, resource_id, event_type, payload_json, payload_hash
  ) VALUES (
    v_tenant_id, 'supplier_sub_batch', v_supplier_sub_batch_id::text,
    CASE WHEN v_activation_complete
      THEN 'supplier_production_batch_activated'
      ELSE 'supplier_production_batch_partially_activated' END,
    v_event_payload, v_event_hash
  );

  INSERT INTO audit_logs (
    actor_id, tenant_id, action, resource_type, resource_id, after_hash, request_id
  ) VALUES (
    v_actor_id, v_tenant_id, 'supplier_production_tags_activated',
    'supplier_sub_batch', v_supplier_sub_batch_id::text,
    replace(v_event_hash, 'sha256:', ''),
    NULLIF(left(trim(COALESCE(p_input->>'request_id', '')), 160), '')
  );

  INSERT INTO supplier_production_activation_receipts (
    id, tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid, lot_size,
    operation_key, request_fingerprint, request_binding, selection_mode,
    requested_count, activated_count, activated_uids, remaining_inactive,
    activation_complete, qa_plan_decision_id, production_session_id,
    production_receipt_id, qa_check_id, evidence_event_hash, actor_id
  ) VALUES (
    v_activation_receipt_id, v_tenant_id, v_supplier_order_id,
    v_supplier_sub_batch_id, v_batch_id, v_bid, v_lot_size, v_operation_key,
    v_request_fingerprint, v_request_binding, v_selection_mode,
    v_requested_count, v_activated_count, v_activated_uids,
    v_remaining_inactive, v_activation_complete,
    v_receipt.qa_plan_decision_id, v_receipt.production_session_id,
    v_receipt.production_receipt_id, v_receipt.qa_check_id,
    v_event_hash, v_actor_id
  );

  RETURN QUERY SELECT
    v_activation_receipt_id,
    v_requested_count,
    v_activated_count,
    v_activated_uids,
    v_remaining_inactive,
    v_activation_complete,
    v_receipt.production_receipt_id,
    v_receipt.production_session_id,
    v_event_hash,
    false;
END;
$activate_tags$;

REVOKE ALL ON FUNCTION public.nexid_supplier_production_activation_receipt_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_assert_supplier_production_activation_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_assert_supplier_commercial_release_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_assert_supplier_order_commercial_release_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_activate_supplier_tags_v2(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_production_activation_history_append_only_v2() FROM PUBLIC;
REVOKE ALL ON TABLE supplier_production_activation_receipts FROM PUBLIC;
