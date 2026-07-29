-- Add an auditable, fail-closed packaging approval plane without changing the
-- operational supplier_orders.status values consumed by the existing routes.
-- Existing orders start explicitly unverified and can only advance through the
-- database-owned revision/decision function introduced below.

CREATE OR REPLACE FUNCTION public.nexid_packaging_evidence_ref_present(
  p_evidence jsonb,
  p_kind text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $packaging_evidence_function$
DECLARE
  v_refs jsonb;
BEGIN
  IF p_evidence IS NULL
     OR jsonb_typeof(p_evidence) IS DISTINCT FROM 'object'
     OR NULLIF(BTRIM(p_kind), '') IS NULL THEN
    RETURN false;
  END IF;
  v_refs := p_evidence -> p_kind;
  IF jsonb_typeof(v_refs) IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_refs) = 0
     OR jsonb_array_length(v_refs) > 100 THEN
    RETURN false;
  END IF;
  RETURN NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_refs) AS evidence_ref(value)
    WHERE jsonb_typeof(evidence_ref.value) <> 'string'
       OR NULLIF(BTRIM(evidence_ref.value #>> '{}'), '') IS NULL
       OR LENGTH(evidence_ref.value #>> '{}') > 2048
  );
END
$packaging_evidence_function$;

ALTER TABLE supplier_orders
  ADD COLUMN IF NOT EXISTS packaging_governance_status text NOT NULL DEFAULT 'legacy_unverified',
  ADD COLUMN IF NOT EXISTS packaging_spec_revision integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packaging_spec_hash text,
  ADD COLUMN IF NOT EXISTS packaging_spec_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS packaging_evidence_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS packaging_validation_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS packaging_decided_by text,
  ADD COLUMN IF NOT EXISTS packaging_decision_reason text,
  ADD COLUMN IF NOT EXISTS packaging_single_operator_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS packaging_override_reason text,
  ADD COLUMN IF NOT EXISTS packaging_governance_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS packaging_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS packaging_approved_by text;

-- ADD COLUMN DEFAULT already materializes this state. The explicit backfill
-- documents the trust boundary and also covers partially prepared databases.
UPDATE supplier_orders
SET packaging_governance_status = 'legacy_unverified',
    packaging_spec_revision = 0,
    packaging_spec_hash = NULL,
    packaging_spec_snapshot = NULL,
    packaging_evidence_refs = '{}'::jsonb,
    packaging_validation_snapshot = NULL,
    packaging_decided_by = NULL,
    packaging_decision_reason = NULL,
    packaging_single_operator_override = false,
    packaging_override_reason = NULL,
    packaging_governance_updated_at = NULL,
    packaging_approved_at = NULL,
    packaging_approved_by = NULL
WHERE packaging_spec_revision = 0;

ALTER TABLE supplier_orders DROP CONSTRAINT IF EXISTS supplier_orders_packaging_governance_status_check;
ALTER TABLE supplier_orders
  ADD CONSTRAINT supplier_orders_packaging_governance_status_check
  CHECK (packaging_governance_status IN ('legacy_unverified', 'draft', 'submitted', 'approved', 'rejected'));

ALTER TABLE supplier_orders DROP CONSTRAINT IF EXISTS supplier_orders_packaging_revision_check;
ALTER TABLE supplier_orders
  ADD CONSTRAINT supplier_orders_packaging_revision_check
  CHECK (packaging_spec_revision >= 0);

ALTER TABLE supplier_orders DROP CONSTRAINT IF EXISTS supplier_orders_packaging_current_shape_check;
ALTER TABLE supplier_orders
  ADD CONSTRAINT supplier_orders_packaging_current_shape_check
  CHECK (
    (
      packaging_governance_status = 'legacy_unverified'
      AND packaging_spec_revision = 0
      AND packaging_spec_hash IS NULL
      AND packaging_spec_snapshot IS NULL
      AND packaging_validation_snapshot IS NULL
      AND packaging_decided_by IS NULL
      AND packaging_governance_updated_at IS NULL
    )
    OR
    (
      packaging_governance_status <> 'legacy_unverified'
      AND packaging_spec_revision > 0
      AND packaging_spec_hash ~ '^sha256:[0-9a-f]{64}$'
      AND jsonb_typeof(packaging_spec_snapshot) = 'object'
      AND jsonb_typeof(packaging_evidence_refs) = 'object'
      AND jsonb_typeof(packaging_validation_snapshot) = 'object'
      AND NULLIF(BTRIM(packaging_decided_by), '') IS NOT NULL
      AND packaging_governance_updated_at IS NOT NULL
    )
  );

ALTER TABLE supplier_orders DROP CONSTRAINT IF EXISTS supplier_orders_packaging_override_check;
ALTER TABLE supplier_orders
  ADD CONSTRAINT supplier_orders_packaging_override_check
  CHECK (
    (
      packaging_single_operator_override = false
      AND packaging_override_reason IS NULL
    )
    OR
    (
      packaging_single_operator_override = true
      AND packaging_governance_status = 'approved'
      AND NULLIF(BTRIM(packaging_override_reason), '') IS NOT NULL
    )
  );

ALTER TABLE supplier_orders DROP CONSTRAINT IF EXISTS supplier_orders_packaging_approval_check;
ALTER TABLE supplier_orders
  ADD CONSTRAINT supplier_orders_packaging_approval_check
  CHECK (
    packaging_governance_status <> 'approved'
    OR (
      packaging_approved_at IS NOT NULL
      AND NULLIF(BTRIM(packaging_approved_by), '') IS NOT NULL
      AND packaging_validation_snapshot->>'validator' = 'validateSupplierPackagingSpec'
      AND packaging_validation_snapshot->>'validatorVersion' = '1'
      AND packaging_validation_snapshot->'ok' = 'true'::jsonb
      AND packaging_validation_snapshot->'productionReady' = 'true'::jsonb
      AND public.nexid_packaging_evidence_ref_present(packaging_evidence_refs, 'rf_sample')
      AND public.nexid_packaging_evidence_ref_present(packaging_evidence_refs, 'line_trial')
      AND public.nexid_packaging_evidence_ref_present(packaging_evidence_refs, 'adhesive')
      AND public.nexid_packaging_evidence_ref_present(packaging_evidence_refs, 'artwork_dieline')
      AND public.nexid_packaging_evidence_ref_present(packaging_evidence_refs, 'encoding_readback')
      AND (
        LOWER(carrier_profile_code) <> 'ntag424_dna_tt'
        OR public.nexid_packaging_evidence_ref_present(packaging_evidence_refs, 'tagtamper_placement')
      )
    )
  );

CREATE TABLE IF NOT EXISTS supplier_packaging_governance_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_order_id uuid NOT NULL REFERENCES supplier_orders(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  spec_revision integer NOT NULL CHECK (spec_revision > 0),
  previous_status text NOT NULL CHECK (previous_status IN ('legacy_unverified', 'draft', 'submitted', 'approved', 'rejected')),
  decision_status text NOT NULL CHECK (decision_status IN ('draft', 'submitted', 'approved', 'rejected')),
  carrier_profile_code text NOT NULL CHECK (NULLIF(BTRIM(carrier_profile_code), '') IS NOT NULL),
  spec_snapshot jsonb NOT NULL CHECK (jsonb_typeof(spec_snapshot) = 'object'),
  spec_hash text NOT NULL CHECK (spec_hash ~ '^sha256:[0-9a-f]{64}$'),
  evidence_refs jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence_refs) = 'object'),
  validation_snapshot jsonb NOT NULL CHECK (jsonb_typeof(validation_snapshot) = 'object'),
  decided_by text NOT NULL CHECK (NULLIF(BTRIM(decided_by), '') IS NOT NULL),
  decision_reason text,
  single_operator_override boolean NOT NULL DEFAULT false,
  override_reason text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_packaging_governance_decisions_revision_unique UNIQUE (supplier_order_id, spec_revision),
  CONSTRAINT supplier_packaging_governance_decisions_rejection_check CHECK (
    decision_status <> 'rejected' OR NULLIF(BTRIM(decision_reason), '') IS NOT NULL
  ),
  CONSTRAINT supplier_packaging_governance_decisions_override_check CHECK (
    (
      single_operator_override = false
      AND override_reason IS NULL
    )
    OR
    (
      single_operator_override = true
      AND decision_status = 'approved'
      AND NULLIF(BTRIM(override_reason), '') IS NOT NULL
    )
  ),
  CONSTRAINT supplier_packaging_governance_decisions_approval_check CHECK (
    decision_status <> 'approved'
    OR (
      validation_snapshot->>'validator' = 'validateSupplierPackagingSpec'
      AND validation_snapshot->>'validatorVersion' = '1'
      AND validation_snapshot->'ok' = 'true'::jsonb
      AND validation_snapshot->'productionReady' = 'true'::jsonb
      AND public.nexid_packaging_evidence_ref_present(evidence_refs, 'rf_sample')
      AND public.nexid_packaging_evidence_ref_present(evidence_refs, 'line_trial')
      AND public.nexid_packaging_evidence_ref_present(evidence_refs, 'adhesive')
      AND public.nexid_packaging_evidence_ref_present(evidence_refs, 'artwork_dieline')
      AND public.nexid_packaging_evidence_ref_present(evidence_refs, 'encoding_readback')
      AND (
        LOWER(carrier_profile_code) <> 'ntag424_dna_tt'
        OR public.nexid_packaging_evidence_ref_present(evidence_refs, 'tagtamper_placement')
      )
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_supplier_orders_packaging_governance
  ON supplier_orders (tenant_id, packaging_governance_status, packaging_governance_updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_packaging_decisions_tenant_order
  ON supplier_packaging_governance_decisions (tenant_id, supplier_order_id, spec_revision DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_packaging_decisions_hash
  ON supplier_packaging_governance_decisions (tenant_id, spec_hash, decided_at DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_packaging_decisions_status
  ON supplier_packaging_governance_decisions (tenant_id, decision_status, decided_at DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_packaging_decisions_evidence
  ON supplier_packaging_governance_decisions USING gin (evidence_refs);

CREATE OR REPLACE FUNCTION public.nexid_guard_supplier_packaging_decision_v1()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $packaging_guard_function$
DECLARE
  v_order supplier_orders%ROWTYPE;
  v_submitter text;
  v_transition_allowed boolean;
BEGIN
  SELECT so.*
    INTO v_order
  FROM supplier_orders so
  WHERE so.id = NEW.supplier_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'packaging_supplier_order_not_found';
  END IF;
  IF v_order.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'packaging_supplier_order_tenant_scope_mismatch';
  END IF;
  IF LOWER(v_order.carrier_profile_code) IS DISTINCT FROM LOWER(NEW.carrier_profile_code) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'packaging_supplier_order_carrier_mismatch';
  END IF;
  IF NEW.previous_status IS DISTINCT FROM v_order.packaging_governance_status
     OR NEW.spec_revision <> v_order.packaging_spec_revision + 1 THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'packaging_governance_revision_conflict';
  END IF;

  v_transition_allowed := CASE v_order.packaging_governance_status
    WHEN 'legacy_unverified' THEN NEW.decision_status = 'draft'
    WHEN 'draft' THEN NEW.decision_status IN ('draft', 'submitted')
    WHEN 'submitted' THEN NEW.decision_status IN ('draft', 'approved', 'rejected')
    WHEN 'approved' THEN NEW.decision_status = 'draft'
    WHEN 'rejected' THEN NEW.decision_status = 'draft'
    ELSE false
  END;
  IF NOT v_transition_allowed THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'packaging_governance_transition_invalid';
  END IF;

  IF NEW.decision_status IN ('approved', 'rejected') THEN
    IF NEW.spec_hash IS DISTINCT FROM v_order.packaging_spec_hash
       OR NEW.spec_snapshot IS DISTINCT FROM v_order.packaging_spec_snapshot
       OR LOWER(NEW.carrier_profile_code) IS DISTINCT FROM LOWER(v_order.carrier_profile_code) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'packaging_governance_decision_snapshot_changed';
    END IF;
  END IF;

  IF NEW.decision_status = 'approved' THEN
    SELECT decision.decided_by
      INTO v_submitter
    FROM supplier_packaging_governance_decisions decision
    WHERE decision.supplier_order_id = NEW.supplier_order_id
      AND decision.spec_revision = v_order.packaging_spec_revision
      AND decision.decision_status = 'submitted';
    IF v_submitter IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'packaging_governance_submission_required';
    END IF;
    IF v_submitter = NEW.decided_by AND NOT NEW.single_operator_override THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'packaging_approval_separation_required',
        HINT = 'Use a different approver, or record an explicit single-operator override reason.';
    END IF;
    IF v_submitter <> NEW.decided_by AND NEW.single_operator_override THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'packaging_single_operator_override_not_applicable';
    END IF;
  END IF;

  RETURN NEW;
END
$packaging_guard_function$;

CREATE OR REPLACE FUNCTION public.nexid_apply_supplier_packaging_decision_v1()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $packaging_apply_function$
BEGIN
  UPDATE supplier_orders
  SET packaging_governance_status = NEW.decision_status,
      packaging_spec_revision = NEW.spec_revision,
      packaging_spec_hash = NEW.spec_hash,
      packaging_spec_snapshot = NEW.spec_snapshot,
      packaging_evidence_refs = NEW.evidence_refs,
      packaging_validation_snapshot = NEW.validation_snapshot,
      packaging_decided_by = NEW.decided_by,
      packaging_decision_reason = NEW.decision_reason,
      packaging_single_operator_override = NEW.single_operator_override,
      packaging_override_reason = NEW.override_reason,
      packaging_governance_updated_at = NEW.decided_at,
      packaging_approved_at = CASE WHEN NEW.decision_status = 'approved' THEN NEW.decided_at ELSE NULL END,
      packaging_approved_by = CASE WHEN NEW.decision_status = 'approved' THEN NEW.decided_by ELSE NULL END,
      updated_at = now()
  WHERE id = NEW.supplier_order_id
    AND tenant_id = NEW.tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'packaging_supplier_order_tenant_scope_mismatch';
  END IF;
  RETURN NEW;
END
$packaging_apply_function$;

CREATE OR REPLACE FUNCTION public.nexid_reject_supplier_packaging_history_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $packaging_immutable_function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'supplier_packaging_governance_history_is_immutable';
END
$packaging_immutable_function$;

DROP TRIGGER IF EXISTS supplier_packaging_decision_guard ON supplier_packaging_governance_decisions;
CREATE TRIGGER supplier_packaging_decision_guard
BEFORE INSERT ON supplier_packaging_governance_decisions
FOR EACH ROW EXECUTE FUNCTION public.nexid_guard_supplier_packaging_decision_v1();

DROP TRIGGER IF EXISTS supplier_packaging_decision_apply ON supplier_packaging_governance_decisions;
CREATE TRIGGER supplier_packaging_decision_apply
AFTER INSERT ON supplier_packaging_governance_decisions
FOR EACH ROW EXECUTE FUNCTION public.nexid_apply_supplier_packaging_decision_v1();

DROP TRIGGER IF EXISTS supplier_packaging_decision_immutable ON supplier_packaging_governance_decisions;
CREATE TRIGGER supplier_packaging_decision_immutable
BEFORE UPDATE OR DELETE ON supplier_packaging_governance_decisions
FOR EACH ROW EXECUTE FUNCTION public.nexid_reject_supplier_packaging_history_mutation_v1();

CREATE OR REPLACE FUNCTION public.nexid_verify_supplier_packaging_current_history_v1()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $packaging_current_history_function$
BEGIN
  IF NEW.packaging_governance_status = 'legacy_unverified' THEN
    IF TG_OP = 'UPDATE' AND OLD.packaging_governance_status <> 'legacy_unverified' THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'packaging_governance_history_downgrade_forbidden';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.packaging_spec_revision < OLD.packaging_spec_revision THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'packaging_governance_revision_regression_forbidden';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM supplier_packaging_governance_decisions decision
    WHERE decision.supplier_order_id = NEW.id
      AND decision.tenant_id = NEW.tenant_id
      AND decision.spec_revision = NEW.packaging_spec_revision
      AND decision.decision_status = NEW.packaging_governance_status
      AND LOWER(decision.carrier_profile_code) = LOWER(NEW.carrier_profile_code)
      AND decision.spec_hash = NEW.packaging_spec_hash
      AND decision.spec_snapshot = NEW.packaging_spec_snapshot
      AND decision.evidence_refs = NEW.packaging_evidence_refs
      AND decision.validation_snapshot = NEW.packaging_validation_snapshot
      AND decision.decided_by = NEW.packaging_decided_by
      AND decision.decision_reason IS NOT DISTINCT FROM NEW.packaging_decision_reason
      AND decision.single_operator_override = NEW.packaging_single_operator_override
      AND decision.override_reason IS NOT DISTINCT FROM NEW.packaging_override_reason
      AND decision.decided_at = NEW.packaging_governance_updated_at
      AND (
        (
          decision.decision_status = 'approved'
          AND NEW.packaging_approved_at = decision.decided_at
          AND NEW.packaging_approved_by = decision.decided_by
        )
        OR
        (
          decision.decision_status <> 'approved'
          AND NEW.packaging_approved_at IS NULL
          AND NEW.packaging_approved_by IS NULL
        )
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'packaging_governance_current_state_without_history';
  END IF;
  RETURN NEW;
END
$packaging_current_history_function$;

DROP TRIGGER IF EXISTS supplier_orders_packaging_current_history_insert ON supplier_orders;
CREATE TRIGGER supplier_orders_packaging_current_history_insert
AFTER INSERT ON supplier_orders
FOR EACH ROW EXECUTE FUNCTION public.nexid_verify_supplier_packaging_current_history_v1();

DROP TRIGGER IF EXISTS supplier_orders_packaging_current_history_update ON supplier_orders;
CREATE TRIGGER supplier_orders_packaging_current_history_update
AFTER UPDATE OF
  tenant_id,
  carrier_profile_code,
  packaging_governance_status,
  packaging_spec_revision,
  packaging_spec_hash,
  packaging_spec_snapshot,
  packaging_evidence_refs,
  packaging_validation_snapshot,
  packaging_decided_by,
  packaging_decision_reason,
  packaging_single_operator_override,
  packaging_override_reason,
  packaging_governance_updated_at,
  packaging_approved_at,
  packaging_approved_by
ON supplier_orders
FOR EACH ROW EXECUTE FUNCTION public.nexid_verify_supplier_packaging_current_history_v1();

CREATE OR REPLACE FUNCTION public.nexid_record_supplier_packaging_decision_v1(p_input jsonb)
RETURNS TABLE (
  decision_id uuid,
  supplier_order_id uuid,
  tenant_id uuid,
  spec_revision integer,
  decision_status text,
  spec_hash text,
  decided_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $packaging_record_function$
DECLARE
  v_supplier_order_id uuid;
  v_tenant_id uuid;
  v_spec_revision integer;
  v_previous_revision integer;
  v_previous_status text;
  v_decision_status text;
  v_carrier_profile_code text;
  v_spec_snapshot jsonb;
  v_spec_hash text;
  v_evidence_refs jsonb;
  v_validation_snapshot jsonb;
  v_decided_by text;
  v_decision_reason text;
  v_single_operator_override boolean;
  v_override_reason text;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'packaging_governance_input_object_required';
  END IF;

  BEGIN
    v_supplier_order_id := NULLIF(BTRIM(p_input->>'supplier_order_id'), '')::uuid;
    v_tenant_id := NULLIF(BTRIM(p_input->>'tenant_id'), '')::uuid;
    v_spec_revision := NULLIF(BTRIM(p_input->>'spec_revision'), '')::integer;
    v_previous_revision := NULLIF(BTRIM(p_input->>'previous_revision'), '')::integer;
    v_single_operator_override := COALESCE((p_input->>'single_operator_override')::boolean, false);
  EXCEPTION
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'packaging_governance_input_type_invalid';
  END;

  v_previous_status := LOWER(NULLIF(BTRIM(p_input->>'previous_status'), ''));
  v_decision_status := LOWER(NULLIF(BTRIM(p_input->>'decision_status'), ''));
  v_carrier_profile_code := LOWER(NULLIF(BTRIM(p_input->>'carrier_profile_code'), ''));
  v_spec_snapshot := p_input->'spec_snapshot';
  v_spec_hash := LOWER(NULLIF(BTRIM(p_input->>'spec_hash'), ''));
  v_evidence_refs := p_input->'evidence_refs';
  v_validation_snapshot := p_input->'validation_snapshot';
  v_decided_by := NULLIF(BTRIM(p_input->>'decided_by'), '');
  v_decision_reason := NULLIF(BTRIM(p_input->>'decision_reason'), '');
  v_override_reason := NULLIF(BTRIM(p_input->>'override_reason'), '');

  IF v_supplier_order_id IS NULL OR v_tenant_id IS NULL
     OR v_spec_revision IS NULL OR v_previous_revision IS NULL
     OR v_spec_revision <> v_previous_revision + 1
     OR v_previous_status IS NULL OR v_decision_status IS NULL
     OR v_carrier_profile_code IS NULL OR v_decided_by IS NULL
     OR jsonb_typeof(v_spec_snapshot) <> 'object'
     OR v_spec_hash !~ '^sha256:[0-9a-f]{64}$'
     OR jsonb_typeof(v_evidence_refs) <> 'object'
     OR jsonb_typeof(v_validation_snapshot) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'packaging_governance_input_invalid';
  END IF;

  RETURN QUERY
  INSERT INTO supplier_packaging_governance_decisions AS decision (
    supplier_order_id,
    tenant_id,
    spec_revision,
    previous_status,
    decision_status,
    carrier_profile_code,
    spec_snapshot,
    spec_hash,
    evidence_refs,
    validation_snapshot,
    decided_by,
    decision_reason,
    single_operator_override,
    override_reason
  ) VALUES (
    v_supplier_order_id,
    v_tenant_id,
    v_spec_revision,
    v_previous_status,
    v_decision_status,
    v_carrier_profile_code,
    v_spec_snapshot,
    v_spec_hash,
    v_evidence_refs,
    v_validation_snapshot,
    v_decided_by,
    v_decision_reason,
    v_single_operator_override,
    v_override_reason
  )
  RETURNING
    decision.id,
    decision.supplier_order_id,
    decision.tenant_id,
    decision.spec_revision,
    decision.decision_status,
    decision.spec_hash,
    decision.decided_at;
END
$packaging_record_function$;

COMMENT ON TABLE supplier_packaging_governance_decisions IS
  'Append-only packaging specification revisions and decisions. Approval requires validator receipts plus independent physical evidence references.';

COMMENT ON FUNCTION public.nexid_record_supplier_packaging_decision_v1(jsonb) IS
  'Atomically records a tenant-scoped packaging governance revision. A single-operator override is audited but never bypasses technical validation or evidence gates.';
