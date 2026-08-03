-- Supplier Production Acceptance v2.
--
-- This migration adds a server-owned, expiring and stratified receiving-QA
-- session for production lots. It deliberately keeps the existing physical
-- NTAG 424 SUN/SDM/CMAC and TagTamper path unchanged. Selection commitments
-- and acceptance-context digests are application/database consistency hashes;
-- they are not signatures, managed-KMS operations, HSM attestations or proof
-- that a human physically inspected a tag.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE supplier_sub_batches
  ADD COLUMN IF NOT EXISTS manufacturing_state text,
  ADD COLUMN IF NOT EXISTS manufacturing_state_updated_at timestamptz;

UPDATE supplier_sub_batches sub_batch
SET
  manufacturing_state = CASE
    WHEN public.nexid_effective_supplier_pack_purpose_v1(sub_batch.supplier_order_id) = 'legacy_unclassified' THEN 'LEGACY_UNCLASSIFIED'
    WHEN public.nexid_effective_supplier_pack_purpose_v1(sub_batch.supplier_order_id) = 'trial_integration' AND sub_batch.qa_status = 'passed' THEN 'TRIAL_QA_PASSED'
    WHEN public.nexid_effective_supplier_pack_purpose_v1(sub_batch.supplier_order_id) = 'trial_integration' AND sub_batch.manifest_status = 'imported' THEN 'TRIAL_10_ENCODED'
    WHEN public.nexid_effective_supplier_pack_purpose_v1(sub_batch.supplier_order_id) = 'trial_integration' AND sub_batch.key_export_count > 0 THEN 'TRIAL_PACK_APPROVED'
    WHEN public.nexid_effective_supplier_pack_purpose_v1(sub_batch.supplier_order_id) = 'trial_integration' THEN 'DRAFT_SPEC'
    WHEN sub_batch.status IN ('activated', 'partially_activated', 'active') OR sub_batch.activated_at IS NOT NULL THEN 'ACTIVATED'
    WHEN sub_batch.qa_status = 'passed' THEN 'RECEIVING_QA_PASSED'
    WHEN sub_batch.manifest_status = 'imported' THEN 'PRODUCTION_MANIFEST_IMPORTED'
    WHEN sub_batch.key_export_count > 0 THEN 'PRODUCTION_PACK_RELEASED'
    ELSE 'PRODUCTION_PROVISIONED'
  END,
  manufacturing_state_updated_at = COALESCE(sub_batch.updated_at, sub_batch.created_at, now())
WHERE sub_batch.manufacturing_state IS NULL;

ALTER TABLE supplier_sub_batches
  ALTER COLUMN manufacturing_state SET NOT NULL,
  ALTER COLUMN manufacturing_state_updated_at SET NOT NULL,
  DROP CONSTRAINT IF EXISTS supplier_sub_batches_manufacturing_state_check;

ALTER TABLE supplier_sub_batches
  ADD CONSTRAINT supplier_sub_batches_manufacturing_state_check CHECK (
    manufacturing_state IN (
      'LEGACY_UNCLASSIFIED',
      'DRAFT_SPEC',
      'TRIAL_PACK_APPROVED',
      'TRIAL_10_ENCODED',
      'TRIAL_QA_PASSED',
      'PRODUCTION_PROVISIONED',
      'PRODUCTION_PACK_RELEASED',
      'PRODUCTION_MANIFEST_IMPORTED',
      'RECEIVING_QA_PASSED',
      'ACTIVATED'
    )
  );

CREATE TABLE IF NOT EXISTS supplier_manufacturing_state_transitions (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_order_id uuid NOT NULL REFERENCES supplier_orders(id) ON DELETE RESTRICT,
  supplier_sub_batch_id uuid NOT NULL REFERENCES supplier_sub_batches(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  bid text NOT NULL,
  previous_state text,
  next_state text NOT NULL,
  transition_source text NOT NULL,
  context_digest text CHECK (context_digest IS NULL OR context_digest ~ '^sha256:[0-9a-f]{64}$'),
  actor_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_manufacturing_state_history
  ON supplier_manufacturing_state_transitions(tenant_id, supplier_sub_batch_id, id DESC);

INSERT INTO supplier_manufacturing_state_transitions (
  tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid,
  previous_state, next_state, transition_source, context_digest, actor_id, created_at
)
SELECT
  sub_batch.tenant_id,
  sub_batch.supplier_order_id,
  sub_batch.id,
  sub_batch.batch_id,
  upper(sub_batch.bid),
  NULL,
  sub_batch.manufacturing_state,
  'migration_0075_backfill',
  NULL,
  NULL,
  sub_batch.manufacturing_state_updated_at
FROM supplier_sub_batches sub_batch
WHERE sub_batch.batch_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM supplier_manufacturing_state_transitions history
    WHERE history.supplier_sub_batch_id = sub_batch.id
  );

CREATE OR REPLACE FUNCTION public.nexid_supplier_production_qa_history_append_only_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $history$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_history_is_append_only';
END;
$history$;

DROP TRIGGER IF EXISTS trg_supplier_manufacturing_state_history_append_only
  ON supplier_manufacturing_state_transitions;
CREATE TRIGGER trg_supplier_manufacturing_state_history_append_only
  BEFORE UPDATE OR DELETE ON supplier_manufacturing_state_transitions
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_production_qa_history_append_only_v1();

CREATE OR REPLACE FUNCTION public.nexid_supplier_manufacturing_state_projection_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $projection$
DECLARE
  v_next_state text;
  v_effective_purpose text;
BEGIN
  SELECT public.nexid_effective_supplier_pack_purpose_v1(NEW.supplier_order_id)
    INTO v_effective_purpose;
  v_effective_purpose := COALESCE(v_effective_purpose, NEW.pack_purpose);

  IF v_effective_purpose = 'legacy_unclassified' THEN
    v_next_state := 'LEGACY_UNCLASSIFIED';
  ELSIF v_effective_purpose = 'trial_integration' THEN
    v_next_state := CASE
      WHEN NEW.qa_status = 'passed' THEN 'TRIAL_QA_PASSED'
      WHEN NEW.manifest_status = 'imported' THEN 'TRIAL_10_ENCODED'
      WHEN NEW.key_export_count > 0 THEN 'TRIAL_PACK_APPROVED'
      ELSE 'DRAFT_SPEC'
    END;
  ELSE
    v_next_state := CASE
      WHEN NEW.status IN ('activated', 'partially_activated', 'active') OR NEW.activated_at IS NOT NULL THEN 'ACTIVATED'
      WHEN NEW.qa_status = 'passed' THEN 'RECEIVING_QA_PASSED'
      WHEN NEW.manifest_status = 'imported' THEN 'PRODUCTION_MANIFEST_IMPORTED'
      WHEN NEW.key_export_count > 0 THEN 'PRODUCTION_PACK_RELEASED'
      ELSE 'PRODUCTION_PROVISIONED'
    END;
  END IF;

  IF NEW.manufacturing_state IS DISTINCT FROM v_next_state THEN
    NEW.manufacturing_state := v_next_state;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.manufacturing_state IS DISTINCT FROM OLD.manufacturing_state THEN
    NEW.manufacturing_state_updated_at := now();
  END IF;
  RETURN NEW;
END;
$projection$;

DROP TRIGGER IF EXISTS trg_supplier_manufacturing_state_projection ON supplier_sub_batches;
CREATE TRIGGER trg_supplier_manufacturing_state_projection
  BEFORE INSERT OR UPDATE ON supplier_sub_batches
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_manufacturing_state_projection_v1();

CREATE OR REPLACE FUNCTION public.nexid_supplier_manufacturing_state_history_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $state_history$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.manufacturing_state IS NOT DISTINCT FROM OLD.manufacturing_state THEN
    RETURN NEW;
  END IF;
  IF NEW.batch_id IS NOT NULL THEN
    INSERT INTO supplier_manufacturing_state_transitions (
      tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid,
      previous_state, next_state, transition_source, context_digest, actor_id
    ) VALUES (
      NEW.tenant_id, NEW.supplier_order_id, NEW.id, NEW.batch_id, upper(NEW.bid),
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.manufacturing_state END,
      NEW.manufacturing_state,
      CASE
        WHEN NEW.manufacturing_state = 'RECEIVING_QA_PASSED' THEN 'production_qa_decision'
        ELSE 'supplier_state_projection'
      END,
      NULL,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$state_history$;

DROP TRIGGER IF EXISTS trg_supplier_manufacturing_state_history ON supplier_sub_batches;
CREATE TRIGGER trg_supplier_manufacturing_state_history
  AFTER INSERT OR UPDATE OF manufacturing_state ON supplier_sub_batches
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_manufacturing_state_history_v1();

-- A legacy order is classified through an append-only decision rather than by
-- mutating its base purpose. Refresh every frozen sub-batch projection in the
-- same transaction so the durable manufacturing state follows that decision.
CREATE OR REPLACE FUNCTION public.nexid_supplier_manufacturing_state_refresh_on_purpose_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $purpose_refresh$
BEGIN
  UPDATE supplier_sub_batches sub_batch
  SET manufacturing_state = sub_batch.manufacturing_state
  WHERE sub_batch.supplier_order_id = NEW.supplier_order_id
    AND sub_batch.tenant_id = NEW.tenant_id;
  RETURN NEW;
END;
$purpose_refresh$;

DROP TRIGGER IF EXISTS trg_supplier_manufacturing_state_refresh_on_purpose
  ON supplier_pack_purpose_decisions;
CREATE TRIGGER trg_supplier_manufacturing_state_refresh_on_purpose
  AFTER INSERT ON supplier_pack_purpose_decisions
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_manufacturing_state_refresh_on_purpose_v1();

CREATE TABLE IF NOT EXISTS supplier_production_qa_plans (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_order_id uuid NOT NULL REFERENCES supplier_orders(id) ON DELETE RESTRICT,
  supplier_sub_batch_id uuid NOT NULL REFERENCES supplier_sub_batches(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  bid text NOT NULL,
  schema_version text NOT NULL CHECK (schema_version = 'supplier-production-qa-plan/v1'),
  operation_key text NOT NULL CHECK (operation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  revision integer NOT NULL CHECK (revision > 0),
  lot_size integer NOT NULL CHECK (lot_size > 0),
  inspection_level text NOT NULL CHECK (char_length(inspection_level) BETWEEN 1 AND 80),
  target_aql numeric(7,3) NOT NULL CHECK (target_aql >= 0 AND target_aql <= 100),
  sample_size integer NOT NULL CHECK (sample_size > 0 AND sample_size <= lot_size),
  accept_number integer NOT NULL CHECK (accept_number >= 0 AND accept_number < sample_size),
  reject_number integer NOT NULL CHECK (reject_number = accept_number + 1 AND reject_number <= sample_size),
  policy_reference text NOT NULL CHECK (char_length(policy_reference) BETWEEN 3 AND 240),
  policy_document_sha256 text NOT NULL CHECK (policy_document_sha256 ~ '^sha256:[0-9a-f]{64}$'),
  stratification_dimension text NOT NULL CHECK (stratification_dimension IN ('roll_id', 'case_id', 'pallet_id')),
  cryptographic_sample_size integer NOT NULL CHECK (
    cryptographic_sample_size = LEAST(10, lot_size, sample_size)
  ),
  plan_binding jsonb NOT NULL CHECK (jsonb_typeof(plan_binding) = 'object'),
  plan_canonical text NOT NULL CHECK (octet_length(plan_canonical) BETWEEN 2 AND 32768),
  plan_digest text NOT NULL CHECK (plan_digest ~ '^sha256:[0-9a-f]{64}$'),
  submitted_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  submitted_session_id uuid NOT NULL REFERENCES auth_sessions(id) ON DELETE RESTRICT,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, operation_key),
  UNIQUE (supplier_sub_batch_id, revision),
  UNIQUE (id, tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id)
);

CREATE TABLE IF NOT EXISTS supplier_production_qa_plan_decisions (
  id uuid PRIMARY KEY,
  plan_id uuid NOT NULL UNIQUE REFERENCES supplier_production_qa_plans(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_order_id uuid NOT NULL REFERENCES supplier_orders(id) ON DELETE RESTRICT,
  supplier_sub_batch_id uuid NOT NULL REFERENCES supplier_sub_batches(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  bid text NOT NULL,
  schema_version text NOT NULL CHECK (schema_version = 'supplier-production-qa-plan-decision/v1'),
  operation_key text NOT NULL CHECK (operation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  decision_status text NOT NULL CHECK (decision_status IN ('approved', 'rejected')),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 16 AND 1000),
  approval_evidence_ref text NOT NULL CHECK (char_length(approval_evidence_ref) BETWEEN 3 AND 2048),
  approval_evidence_sha256 text NOT NULL CHECK (approval_evidence_sha256 ~ '^sha256:[0-9a-f]{64}$'),
  plan_digest text NOT NULL CHECK (plan_digest ~ '^sha256:[0-9a-f]{64}$'),
  decided_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decided_session_id uuid NOT NULL REFERENCES auth_sessions(id) ON DELETE RESTRICT,
  approver_role text NOT NULL CHECK (approver_role = 'tenant_admin'),
  permission_snapshot jsonb NOT NULL CHECK (jsonb_typeof(permission_snapshot) = 'array'),
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, operation_key),
  UNIQUE (id, plan_id, tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id),
  FOREIGN KEY (plan_id, tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id)
    REFERENCES supplier_production_qa_plans(id, tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS supplier_production_qa_sessions (
  id uuid PRIMARY KEY,
  qa_plan_id uuid NOT NULL REFERENCES supplier_production_qa_plans(id) ON DELETE RESTRICT,
  qa_plan_decision_id uuid NOT NULL REFERENCES supplier_production_qa_plan_decisions(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_order_id uuid NOT NULL REFERENCES supplier_orders(id) ON DELETE RESTRICT,
  supplier_sub_batch_id uuid NOT NULL REFERENCES supplier_sub_batches(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  bid text NOT NULL,
  schema_version text NOT NULL CHECK (schema_version = 'supplier-production-qa-session/v1'),
  operation_key text NOT NULL CHECK (operation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  lot_size integer NOT NULL CHECK (lot_size > 0),
  inspection_level text NOT NULL CHECK (char_length(inspection_level) BETWEEN 1 AND 80),
  target_aql numeric(7,3) NOT NULL CHECK (target_aql >= 0 AND target_aql <= 100),
  sample_size integer NOT NULL CHECK (sample_size > 0 AND sample_size <= lot_size),
  accept_number integer NOT NULL CHECK (accept_number >= 0 AND accept_number < sample_size),
  reject_number integer NOT NULL CHECK (reject_number = accept_number + 1 AND reject_number <= sample_size),
  policy_reference text NOT NULL CHECK (char_length(policy_reference) BETWEEN 3 AND 240),
  policy_document_sha256 text NOT NULL CHECK (policy_document_sha256 ~ '^sha256:[0-9a-f]{64}$'),
  policy_approved_by text NOT NULL CHECK (char_length(policy_approved_by) BETWEEN 3 AND 320),
  policy_approved_at timestamptz NOT NULL,
  policy_approval_evidence_ref text NOT NULL CHECK (char_length(policy_approval_evidence_ref) BETWEEN 3 AND 2048),
  policy_approval_evidence_sha256 text NOT NULL CHECK (policy_approval_evidence_sha256 ~ '^sha256:[0-9a-f]{64}$'),
  policy_digest text NOT NULL CHECK (policy_digest ~ '^sha256:[0-9a-f]{64}$'),
  stratification_dimensions jsonb NOT NULL CHECK (
    jsonb_typeof(stratification_dimensions) = 'array'
    AND jsonb_array_length(stratification_dimensions) BETWEEN 1 AND 3
  ),
  manifest_hash text NOT NULL CHECK (manifest_hash ~ '^sha256:[0-9a-f]{64}$'),
  carrier_profile_code text NOT NULL,
  key_fingerprint text NOT NULL CHECK (key_fingerprint ~ '^[0-9A-F]{16}$'),
  packaging_spec_revision integer NOT NULL CHECK (packaging_spec_revision > 0),
  packaging_spec_hash text NOT NULL CHECK (packaging_spec_hash ~ '^sha256:[0-9a-f]{64}$'),
  manufacturing_state_at_open text NOT NULL CHECK (manufacturing_state_at_open = 'PRODUCTION_MANIFEST_IMPORTED'),
  sun_verification_context_digest text NOT NULL CHECK (sun_verification_context_digest ~ '^sha256:[0-9a-f]{64}$'),
  acceptance_context_digest text NOT NULL CHECK (acceptance_context_digest ~ '^sha256:[0-9a-f]{64}$'),
  acceptance_context_binding jsonb NOT NULL CHECK (jsonb_typeof(acceptance_context_binding) = 'object'),
  acceptance_context_canonical text NOT NULL CHECK (octet_length(acceptance_context_canonical) BETWEEN 2 AND 32768),
  selection_algorithm text NOT NULL CHECK (selection_algorithm = 'hmac-sha256-stratified-v1'),
  selection_seed_ciphertext text NOT NULL CHECK (selection_seed_ciphertext LIKE 'nexid-app-envelope-v2.%'),
  selection_seed_commitment text NOT NULL CHECK (selection_seed_commitment ~ '^sha256:[0-9a-f]{64}$'),
  selection_digest text NOT NULL CHECK (selection_digest ~ '^sha256:[0-9a-f]{64}$'),
  challenge_ciphertext text NOT NULL CHECK (challenge_ciphertext LIKE 'nexid-app-envelope-v2.%'),
  challenge_hash text NOT NULL CHECK (challenge_hash ~ '^sha256:[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, operation_key),
  UNIQUE (supplier_sub_batch_id, selection_digest),
  UNIQUE (qa_plan_id, selection_digest),
  UNIQUE (id, tenant_id),
  UNIQUE (id, tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id),
  FOREIGN KEY (qa_plan_id, tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id)
    REFERENCES supplier_production_qa_plans(id, tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (
    qa_plan_decision_id, qa_plan_id, tenant_id, supplier_order_id,
    supplier_sub_batch_id, batch_id
  ) REFERENCES supplier_production_qa_plan_decisions(
    id, plan_id, tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id
  ) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS supplier_production_qa_session_samples (
  session_id uuid NOT NULL REFERENCES supplier_production_qa_sessions(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,
  ordinal integer NOT NULL CHECK (ordinal > 0),
  uid_fingerprint text NOT NULL CHECK (uid_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  stratum_key text NOT NULL CHECK (char_length(stratum_key) BETWEEN 1 AND 320),
  stratum_values jsonb NOT NULL CHECK (jsonb_typeof(stratum_values) = 'object'),
  selection_rank text NOT NULL CHECK (selection_rank ~ '^sha256:[0-9a-f]{64}$'),
  cryptographic_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, ordinal),
  UNIQUE (session_id, tag_id),
  UNIQUE (session_id, uid_fingerprint),
  UNIQUE (session_id, tenant_id),
  UNIQUE (session_id, tag_id, tenant_id),
  FOREIGN KEY (session_id, tenant_id)
    REFERENCES supplier_production_qa_sessions(id, tenant_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS supplier_production_qa_decisions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL UNIQUE REFERENCES supplier_production_qa_sessions(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_order_id uuid NOT NULL REFERENCES supplier_orders(id) ON DELETE RESTRICT,
  supplier_sub_batch_id uuid NOT NULL REFERENCES supplier_sub_batches(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  bid text NOT NULL,
  qa_check_id uuid NOT NULL UNIQUE REFERENCES supplier_qa_checks(id) ON DELETE RESTRICT,
  schema_version text NOT NULL CHECK (schema_version = 'supplier-production-acceptance/v2'),
  operation_key text NOT NULL CHECK (operation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('passed', 'failed')),
  observed_sample_count integer NOT NULL CHECK (observed_sample_count > 0),
  nonconforming_count integer NOT NULL CHECK (nonconforming_count >= 0),
  accept_number integer NOT NULL,
  reject_number integer NOT NULL,
  disposition text NOT NULL CHECK (disposition IN ('ACCEPT', 'REJECT')),
  observations_digest text NOT NULL CHECK (observations_digest ~ '^sha256:[0-9a-f]{64}$'),
  evidence_digest text NOT NULL CHECK (evidence_digest ~ '^sha256:[0-9a-f]{64}$'),
  selection_seed_reveal text NOT NULL CHECK (char_length(selection_seed_reveal) BETWEEN 16 AND 128),
  challenge_hash text NOT NULL CHECK (challenge_hash ~ '^sha256:[0-9a-f]{64}$'),
  acceptance_context_digest text NOT NULL CHECK (acceptance_context_digest ~ '^sha256:[0-9a-f]{64}$'),
  decided_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, operation_key),
  UNIQUE (id, session_id, tenant_id),
  FOREIGN KEY (
    session_id, tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id
  ) REFERENCES supplier_production_qa_sessions(
    id, tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id
  ) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS supplier_production_qa_observations (
  decision_id uuid NOT NULL REFERENCES supplier_production_qa_decisions(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL REFERENCES supplier_production_qa_sessions(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,
  outcome text NOT NULL CHECK (outcome IN ('conforming', 'nonconforming')),
  defect_codes jsonb NOT NULL CHECK (jsonb_typeof(defect_codes) = 'array' AND jsonb_array_length(defect_codes) <= 20),
  observation_digest text NOT NULL CHECK (observation_digest ~ '^sha256:[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (decision_id, tag_id),
  UNIQUE (session_id, tag_id),
  FOREIGN KEY (decision_id, session_id, tenant_id)
    REFERENCES supplier_production_qa_decisions(id, session_id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (session_id, tag_id, tenant_id)
    REFERENCES supplier_production_qa_session_samples(session_id, tag_id, tenant_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_supplier_production_qa_sessions_scope
  ON supplier_production_qa_sessions(tenant_id, supplier_order_id, supplier_sub_batch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_production_qa_plans_scope
  ON supplier_production_qa_plans(tenant_id, supplier_order_id, supplier_sub_batch_id, revision DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_production_qa_plan_decisions_scope
  ON supplier_production_qa_plan_decisions(tenant_id, supplier_sub_batch_id, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_production_qa_sessions_expiry
  ON supplier_production_qa_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_supplier_production_qa_samples_tag
  ON supplier_production_qa_session_samples(tag_id, session_id);
CREATE INDEX IF NOT EXISTS idx_supplier_production_qa_decisions_scope
  ON supplier_production_qa_decisions(tenant_id, supplier_sub_batch_id, decided_at DESC);

DROP TRIGGER IF EXISTS trg_supplier_production_qa_sessions_append_only ON supplier_production_qa_sessions;
CREATE TRIGGER trg_supplier_production_qa_sessions_append_only
  BEFORE UPDATE OR DELETE ON supplier_production_qa_sessions
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_production_qa_history_append_only_v1();
DROP TRIGGER IF EXISTS trg_supplier_production_qa_plans_append_only ON supplier_production_qa_plans;
CREATE TRIGGER trg_supplier_production_qa_plans_append_only
  BEFORE UPDATE OR DELETE ON supplier_production_qa_plans
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_production_qa_history_append_only_v1();
DROP TRIGGER IF EXISTS trg_supplier_production_qa_plan_decisions_append_only ON supplier_production_qa_plan_decisions;
CREATE TRIGGER trg_supplier_production_qa_plan_decisions_append_only
  BEFORE UPDATE OR DELETE ON supplier_production_qa_plan_decisions
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_production_qa_history_append_only_v1();
DROP TRIGGER IF EXISTS trg_supplier_production_qa_samples_append_only ON supplier_production_qa_session_samples;
CREATE TRIGGER trg_supplier_production_qa_samples_append_only
  BEFORE UPDATE OR DELETE ON supplier_production_qa_session_samples
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_production_qa_history_append_only_v1();
DROP TRIGGER IF EXISTS trg_supplier_production_qa_decisions_append_only ON supplier_production_qa_decisions;
CREATE TRIGGER trg_supplier_production_qa_decisions_append_only
  BEFORE UPDATE OR DELETE ON supplier_production_qa_decisions
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_production_qa_history_append_only_v1();
DROP TRIGGER IF EXISTS trg_supplier_production_qa_observations_append_only ON supplier_production_qa_observations;
CREATE TRIGGER trg_supplier_production_qa_observations_append_only
  BEFORE UPDATE OR DELETE ON supplier_production_qa_observations
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_production_qa_history_append_only_v1();

CREATE OR REPLACE FUNCTION public.nexid_submit_supplier_production_qa_plan_v1(p_input jsonb)
RETURNS TABLE (
  plan_id uuid,
  plan_revision integer,
  plan_digest text,
  submitted_at timestamptz,
  idempotent_replay boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $submit_plan$
DECLARE
  v_plan_id uuid;
  v_tenant_id uuid;
  v_supplier_order_id uuid;
  v_supplier_sub_batch_id uuid;
  v_batch_id uuid;
  v_actor_id uuid;
  v_auth_session_id uuid;
  v_operation_key text;
  v_bid text;
  v_revision integer;
  v_lot_size integer;
  v_sample_size integer;
  v_accept_number integer;
  v_reject_number integer;
  v_crypto_sample_size integer;
  v_request_fingerprint text;
  v_plan_canonical text;
  v_plan_digest text;
  v_existing supplier_production_qa_plans%ROWTYPE;
  v_scope record;
BEGIN
  IF p_input IS NULL
    OR jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR octet_length(p_input::text) > 65536 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_qa_plan_input_invalid';
  END IF;
  BEGIN
    v_plan_id := NULLIF(trim(p_input->>'plan_id'), '')::uuid;
    v_tenant_id := NULLIF(trim(p_input->>'tenant_id'), '')::uuid;
    v_supplier_order_id := NULLIF(trim(p_input->>'supplier_order_id'), '')::uuid;
    v_supplier_sub_batch_id := NULLIF(trim(p_input->>'supplier_sub_batch_id'), '')::uuid;
    v_batch_id := NULLIF(trim(p_input->>'batch_id'), '')::uuid;
    v_actor_id := NULLIF(trim(p_input->>'actor_id'), '')::uuid;
    v_auth_session_id := NULLIF(trim(p_input->>'auth_session_id'), '')::uuid;
    v_revision := NULLIF(trim(p_input->>'revision'), '')::integer;
    v_lot_size := NULLIF(trim(p_input->>'lot_size'), '')::integer;
    v_sample_size := NULLIF(trim(p_input->>'sample_size'), '')::integer;
    v_accept_number := NULLIF(trim(p_input->>'accept_number'), '')::integer;
    v_reject_number := NULLIF(trim(p_input->>'reject_number'), '')::integer;
    v_crypto_sample_size := NULLIF(trim(p_input->>'cryptographic_sample_size'), '')::integer;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_qa_plan_identity_invalid';
  END;
  v_operation_key := trim(COALESCE(p_input->>'operation_key', ''));
  v_bid := upper(trim(COALESCE(p_input->>'bid', '')));
  v_plan_canonical := COALESCE(p_input->>'plan_canonical', '');
  v_plan_digest := lower(trim(COALESCE(p_input->>'plan_digest', '')));

  IF v_plan_id IS NULL OR v_tenant_id IS NULL OR v_supplier_order_id IS NULL
    OR v_supplier_sub_batch_id IS NULL OR v_batch_id IS NULL
    OR v_actor_id IS NULL OR v_auth_session_id IS NULL
    OR v_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
    OR v_bid = ''
    OR v_revision IS NULL OR v_revision < 1
    OR v_lot_size IS NULL OR v_lot_size < 1 OR v_lot_size > 10000000
    OR v_sample_size IS NULL OR v_sample_size < 1 OR v_sample_size > LEAST(v_lot_size, 5000)
    OR v_sample_size < LEAST(10, v_lot_size)
    OR v_accept_number IS NULL OR v_accept_number < 0 OR v_accept_number >= v_sample_size
    OR v_reject_number IS NULL OR v_reject_number <> v_accept_number + 1 OR v_reject_number > v_sample_size
    OR v_crypto_sample_size IS NULL
    OR v_crypto_sample_size <> LEAST(10, v_lot_size, v_sample_size)
    OR COALESCE(p_input->>'schema_version', '') <> 'supplier-production-qa-plan/v1'
    OR char_length(trim(COALESCE(p_input->>'inspection_level', ''))) NOT BETWEEN 1 AND 80
    OR COALESCE(p_input->>'target_aql', '') !~ '^[0-9]{1,3}([.][0-9]{1,3})?$'
    OR (p_input->>'target_aql')::numeric NOT BETWEEN 0 AND 100
    OR char_length(trim(COALESCE(p_input->>'policy_reference', ''))) NOT BETWEEN 3 AND 240
    OR lower(COALESCE(p_input->>'policy_document_sha256', '')) !~ '^sha256:[0-9a-f]{64}$'
    OR COALESCE(p_input->>'stratification_dimension', '') NOT IN ('roll_id', 'case_id', 'pallet_id')
    OR jsonb_typeof(p_input->'plan_binding') IS DISTINCT FROM 'object'
    OR octet_length(v_plan_canonical) NOT BETWEEN 2 AND 32768
    OR public.nexid_supplier_qa_canonical_json_v2(p_input->'plan_binding') IS DISTINCT FROM v_plan_canonical
    OR ('sha256:' || encode(digest(convert_to(v_plan_canonical, 'UTF8'), 'sha256'), 'hex')) IS DISTINCT FROM v_plan_digest THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_qa_plan_contract_invalid';
  END IF;

  IF p_input->'plan_binding' IS DISTINCT FROM jsonb_build_object(
    'schema_version', 'supplier-production-qa-plan/v1',
    'tenant_id', lower(v_tenant_id::text),
    'supplier_order_id', lower(v_supplier_order_id::text),
    'supplier_sub_batch_id', lower(v_supplier_sub_batch_id::text),
    'batch_id', lower(v_batch_id::text),
    'bid', v_bid,
    'revision', v_revision,
    'lot_size', v_lot_size,
    'inspection_level', trim(p_input->>'inspection_level'),
    'target_aql', (p_input->>'target_aql')::numeric,
    'sample_size', v_sample_size,
    'accept_number', v_accept_number,
    'reject_number', v_reject_number,
    'policy_reference', trim(p_input->>'policy_reference'),
    'policy_document_sha256', lower(p_input->>'policy_document_sha256'),
    'stratification_dimension', p_input->>'stratification_dimension',
    'cryptographic_sample_size', v_crypto_sample_size
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_qa_plan_binding_mismatch';
  END IF;

  -- A NexID superadmin may prepare a draft, but a tenant-bound principal with
  -- the exact approval permission must make the later quality decision.
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
      OR (
        auth_session.role::text = 'tenant_admin'
        AND auth_session.tenant_id = v_tenant_id
        AND EXISTS (
          SELECT 1
          FROM resource_permissions permission
          WHERE permission.user_id = actor.id
            AND permission.effect = 'allow'
            AND (
              (permission.resource = 'supplier' AND permission.action IN ('qa', '*'))
              OR (permission.resource = '*' AND permission.action = '*')
            )
        )
      )
    )
  FOR SHARE OF auth_session, actor, membership;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'supplier_production_qa_plan_submitter_scope_invalid';
  END IF;

  v_request_fingerprint := 'sha256:' || encode(digest(jsonb_build_object(
    'schema_version', 'supplier-production-qa-plan-request/v1',
    'tenant_id', v_tenant_id,
    'supplier_order_id', v_supplier_order_id,
    'supplier_sub_batch_id', v_supplier_sub_batch_id,
    'batch_id', v_batch_id,
    'bid', v_bid,
    'revision', v_revision,
    'plan_digest', v_plan_digest,
    'actor_id', v_actor_id
  )::text, 'sha256'), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || chr(31) || v_operation_key, 0));
  SELECT * INTO v_existing
  FROM supplier_production_qa_plans plan_row
  WHERE plan_row.tenant_id = v_tenant_id
    AND plan_row.operation_key = v_operation_key
  LIMIT 1;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.request_fingerprint IS DISTINCT FROM v_request_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'supplier_production_qa_plan_idempotency_conflict';
    END IF;
    RETURN QUERY SELECT v_existing.id, v_existing.revision, v_existing.plan_digest,
      v_existing.submitted_at, true;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'supplier-production-qa-plan' || chr(31) || v_supplier_sub_batch_id::text,
    0
  ));
  SELECT
    sub_batch.expected_quantity,
    upper(sub_batch.bid) AS bid,
    public.nexid_effective_supplier_pack_purpose_v1(supplier_order.id) AS effective_pack_purpose
  INTO v_scope
  FROM supplier_sub_batches sub_batch
  JOIN supplier_orders supplier_order
    ON supplier_order.id = sub_batch.supplier_order_id
   AND supplier_order.tenant_id = sub_batch.tenant_id
  JOIN batches batch
    ON batch.id = sub_batch.batch_id
   AND batch.tenant_id = sub_batch.tenant_id
   AND upper(batch.bid) = upper(sub_batch.bid)
  WHERE sub_batch.id = v_supplier_sub_batch_id
    AND sub_batch.supplier_order_id = v_supplier_order_id
    AND sub_batch.batch_id = v_batch_id
    AND sub_batch.tenant_id = v_tenant_id
    AND upper(sub_batch.bid) = v_bid
  FOR UPDATE OF sub_batch, supplier_order, batch;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'supplier_production_qa_scope_not_found';
  END IF;
  IF lower(COALESCE(v_scope.effective_pack_purpose, '')) <> 'production'
    OR v_scope.expected_quantity IS DISTINCT FROM v_lot_size THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_plan_scope_invalid';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM supplier_production_qa_plans older_plan
    JOIN supplier_production_qa_plan_decisions older_decision ON older_decision.plan_id = older_plan.id
    WHERE older_plan.supplier_sub_batch_id = v_supplier_sub_batch_id
      AND older_decision.decision_status = 'approved'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_plan_already_approved';
  END IF;
  IF v_revision IS DISTINCT FROM (
    SELECT COALESCE(max(older_plan.revision), 0) + 1
    FROM supplier_production_qa_plans older_plan
    WHERE older_plan.supplier_sub_batch_id = v_supplier_sub_batch_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_plan_revision_conflict';
  END IF;

  INSERT INTO supplier_production_qa_plans (
    id, tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid,
    schema_version, operation_key, request_fingerprint, revision, lot_size,
    inspection_level, target_aql, sample_size, accept_number, reject_number,
    policy_reference, policy_document_sha256, stratification_dimension,
    cryptographic_sample_size, plan_binding, plan_canonical, plan_digest,
    submitted_by, submitted_session_id
  ) VALUES (
    v_plan_id, v_tenant_id, v_supplier_order_id, v_supplier_sub_batch_id, v_batch_id, v_bid,
    'supplier-production-qa-plan/v1', v_operation_key, v_request_fingerprint, v_revision,
    v_lot_size, trim(p_input->>'inspection_level'), (p_input->>'target_aql')::numeric,
    v_sample_size, v_accept_number, v_reject_number, trim(p_input->>'policy_reference'),
    lower(p_input->>'policy_document_sha256'), p_input->>'stratification_dimension',
    v_crypto_sample_size, p_input->'plan_binding', v_plan_canonical, v_plan_digest,
    v_actor_id, v_auth_session_id
  );

  INSERT INTO audit_logs (
    actor_id, tenant_id, action, resource_type, resource_id, after_hash,
    request_id
  ) VALUES (
    v_actor_id, v_tenant_id, 'supplier_production_qa_plan_submitted',
    'supplier_production_qa_plan', v_plan_id::text, v_plan_digest,
    NULLIF(trim(COALESCE(p_input->>'request_id', '')), '')
  );

  RETURN QUERY SELECT v_plan_id, v_revision, v_plan_digest, now(), false;
END;
$submit_plan$;

CREATE OR REPLACE FUNCTION public.nexid_decide_supplier_production_qa_plan_v1(p_input jsonb)
RETURNS TABLE (
  decision_id uuid,
  decision_status text,
  decided_at timestamptz,
  idempotent_replay boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $decide_plan$
DECLARE
  v_decision_id uuid;
  v_plan_id uuid;
  v_tenant_id uuid;
  v_actor_id uuid;
  v_auth_session_id uuid;
  v_operation_key text;
  v_decision_status text;
  v_reason text;
  v_request_fingerprint text;
  v_plan supplier_production_qa_plans%ROWTYPE;
  v_existing supplier_production_qa_plan_decisions%ROWTYPE;
  v_permissions jsonb;
BEGIN
  IF p_input IS NULL
    OR jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR octet_length(p_input::text) > 16384 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_qa_plan_decision_input_invalid';
  END IF;
  BEGIN
    v_decision_id := NULLIF(trim(p_input->>'decision_id'), '')::uuid;
    v_plan_id := NULLIF(trim(p_input->>'plan_id'), '')::uuid;
    v_tenant_id := NULLIF(trim(p_input->>'tenant_id'), '')::uuid;
    v_actor_id := NULLIF(trim(p_input->>'actor_id'), '')::uuid;
    v_auth_session_id := NULLIF(trim(p_input->>'auth_session_id'), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_qa_plan_decision_identity_invalid';
  END;
  v_operation_key := trim(COALESCE(p_input->>'operation_key', ''));
  v_decision_status := lower(trim(COALESCE(p_input->>'decision_status', '')));
  v_reason := trim(COALESCE(p_input->>'reason', ''));
  IF v_decision_id IS NULL OR v_plan_id IS NULL OR v_tenant_id IS NULL
    OR v_actor_id IS NULL OR v_auth_session_id IS NULL
    OR v_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
    OR v_decision_status NOT IN ('approved', 'rejected')
    OR char_length(v_reason) NOT BETWEEN 16 AND 1000
    OR char_length(trim(COALESCE(p_input->>'approval_evidence_ref', ''))) NOT BETWEEN 3 AND 2048
    OR lower(COALESCE(p_input->>'approval_evidence_sha256', '')) !~ '^sha256:[0-9a-f]{64}$'
    OR lower(COALESCE(p_input->>'plan_digest', '')) !~ '^sha256:[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_qa_plan_decision_contract_invalid';
  END IF;

  -- This intentionally does not accept a superadmin, reseller, wildcard or
  -- merely caller-supplied tenant header. The approval represents Quality of
  -- the customer tenant and therefore requires its current bound session,
  -- current membership, MFA and one exact permission grant.
  PERFORM 1
  FROM auth_sessions auth_session
  JOIN users actor ON actor.id = auth_session.user_id
  JOIN memberships membership
    ON membership.user_id = actor.id
   AND membership.role = 'tenant_admin'::membership_role
   AND membership.tenant_id = v_tenant_id
  JOIN resource_permissions exact_permission
    ON exact_permission.user_id = actor.id
   AND exact_permission.effect = 'allow'
   AND exact_permission.resource = 'supplier'
   AND exact_permission.action = 'production_qa_plan:approve'
  WHERE auth_session.id = v_auth_session_id
    AND auth_session.user_id = v_actor_id
    AND auth_session.role = 'tenant_admin'::membership_role
    AND auth_session.tenant_id = v_tenant_id
    AND auth_session.mfa_verified IS TRUE
    AND auth_session.revoked_at IS NULL
    AND auth_session.expires_at > now()
    AND actor.admin_status::text = 'active'
  FOR SHARE OF auth_session, actor, membership, exact_permission;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'supplier_production_qa_plan_approver_scope_invalid';
  END IF;
  SELECT COALESCE(
    jsonb_agg(permission.resource || ':' || permission.action ORDER BY permission.resource, permission.action),
    '[]'::jsonb
  ) INTO v_permissions
  FROM resource_permissions permission
  WHERE permission.user_id = v_actor_id
    AND permission.effect = 'allow';

  v_request_fingerprint := 'sha256:' || encode(digest(jsonb_build_object(
    'schema_version', 'supplier-production-qa-plan-decision-request/v1',
    'tenant_id', v_tenant_id,
    'plan_id', v_plan_id,
    'decision_status', v_decision_status,
    'reason', v_reason,
    'approval_evidence_ref', trim(p_input->>'approval_evidence_ref'),
    'approval_evidence_sha256', lower(p_input->>'approval_evidence_sha256'),
    'plan_digest', lower(p_input->>'plan_digest'),
    'actor_id', v_actor_id
  )::text, 'sha256'), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || chr(31) || v_operation_key, 0));
  SELECT * INTO v_existing
  FROM supplier_production_qa_plan_decisions decision_row
  WHERE decision_row.tenant_id = v_tenant_id
    AND decision_row.operation_key = v_operation_key
  LIMIT 1;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.request_fingerprint IS DISTINCT FROM v_request_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'supplier_production_qa_plan_decision_idempotency_conflict';
    END IF;
    RETURN QUERY SELECT v_existing.id, v_existing.decision_status,
      v_existing.decided_at, true;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('supplier-production-qa-plan' || chr(31) || v_plan_id::text, 0));
  SELECT * INTO v_plan
  FROM supplier_production_qa_plans plan_row
  WHERE plan_row.id = v_plan_id
    AND plan_row.tenant_id = v_tenant_id
  FOR KEY SHARE OF plan_row;
  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'supplier_production_qa_plan_not_found';
  END IF;
  IF v_plan.plan_digest IS DISTINCT FROM lower(p_input->>'plan_digest') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_plan_digest_mismatch';
  END IF;
  IF EXISTS (SELECT 1 FROM supplier_production_qa_plan_decisions prior WHERE prior.plan_id = v_plan_id) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_plan_already_decided';
  END IF;

  INSERT INTO supplier_production_qa_plan_decisions (
    id, plan_id, tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid,
    schema_version, operation_key, request_fingerprint, decision_status, reason,
    approval_evidence_ref, approval_evidence_sha256, plan_digest, decided_by,
    decided_session_id, approver_role, permission_snapshot
  ) VALUES (
    v_decision_id, v_plan.id, v_plan.tenant_id, v_plan.supplier_order_id,
    v_plan.supplier_sub_batch_id, v_plan.batch_id, v_plan.bid,
    'supplier-production-qa-plan-decision/v1', v_operation_key, v_request_fingerprint,
    v_decision_status, v_reason, trim(p_input->>'approval_evidence_ref'),
    lower(p_input->>'approval_evidence_sha256'), v_plan.plan_digest, v_actor_id,
    v_auth_session_id, 'tenant_admin', v_permissions
  );

  INSERT INTO audit_logs (
    actor_id, tenant_id, action, resource_type, resource_id, before_hash,
    after_hash, request_id
  ) VALUES (
    v_actor_id, v_tenant_id, 'supplier_production_qa_plan_' || v_decision_status,
    'supplier_production_qa_plan', v_plan_id::text, v_plan.plan_digest,
    lower(p_input->>'approval_evidence_sha256'),
    NULLIF(trim(COALESCE(p_input->>'request_id', '')), '')
  );

  RETURN QUERY SELECT v_decision_id, v_decision_status, now(), false;
END;
$decide_plan$;

CREATE OR REPLACE FUNCTION public.nexid_supplier_production_qa_v1_capability()
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT 'supplier-production-acceptance/v2'::text
$$;

CREATE OR REPLACE FUNCTION public.nexid_create_supplier_production_qa_session_v1(p_input jsonb)
RETURNS TABLE (
  session_id uuid,
  expires_at timestamptz,
  sample_size integer,
  selection_digest text,
  acceptance_context_digest text,
  idempotent_replay boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $create_session$
DECLARE
  v_session_id uuid;
  v_qa_plan_id uuid;
  v_qa_plan_decision_id uuid;
  v_tenant_id uuid;
  v_supplier_order_id uuid;
  v_supplier_sub_batch_id uuid;
  v_batch_id uuid;
  v_actor_id uuid;
  v_auth_session_id uuid;
  v_operation_key text;
  v_request_fingerprint text;
  v_bid text;
  v_lot_size integer;
  v_sample_size integer;
  v_accept_number integer;
  v_reject_number integer;
  v_expires_at timestamptz;
  v_samples jsonb;
  v_dimensions jsonb;
  v_dimension text;
  v_existing supplier_production_qa_sessions%ROWTYPE;
  v_plan record;
  v_locked record;
  v_count integer;
BEGIN
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR COALESCE(p_input->>'session_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'qa_plan_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'qa_plan_decision_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'tenant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'supplier_order_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'supplier_sub_batch_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'batch_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'actor_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'auth_session_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_qa_session_identity_invalid';
  END IF;

  v_session_id := (p_input->>'session_id')::uuid;
  v_qa_plan_id := (p_input->>'qa_plan_id')::uuid;
  v_qa_plan_decision_id := (p_input->>'qa_plan_decision_id')::uuid;
  v_tenant_id := (p_input->>'tenant_id')::uuid;
  v_supplier_order_id := (p_input->>'supplier_order_id')::uuid;
  v_supplier_sub_batch_id := (p_input->>'supplier_sub_batch_id')::uuid;
  v_batch_id := (p_input->>'batch_id')::uuid;
  v_actor_id := (p_input->>'actor_id')::uuid;
  v_auth_session_id := (p_input->>'auth_session_id')::uuid;
  v_operation_key := trim(COALESCE(p_input->>'operation_key', ''));
  v_bid := upper(trim(COALESCE(p_input->>'bid', '')));
  v_samples := COALESCE(p_input->'samples', '[]'::jsonb);
  v_dimensions := COALESCE(p_input->'stratification_dimensions', '[]'::jsonb);

  IF v_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
    OR v_bid = ''
    OR COALESCE(p_input->>'lot_size', '') !~ '^[1-9][0-9]{0,8}$'
    OR COALESCE(p_input->>'sample_size', '') !~ '^[1-9][0-9]{0,8}$'
    OR COALESCE(p_input->>'accept_number', '') !~ '^[0-9]{1,8}$'
    OR COALESCE(p_input->>'reject_number', '') !~ '^[1-9][0-9]{0,8}$'
    OR jsonb_typeof(v_samples) IS DISTINCT FROM 'array'
    OR jsonb_typeof(v_dimensions) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_qa_session_input_invalid';
  END IF;

  v_lot_size := (p_input->>'lot_size')::integer;
  v_sample_size := (p_input->>'sample_size')::integer;
  v_accept_number := (p_input->>'accept_number')::integer;
  v_reject_number := (p_input->>'reject_number')::integer;
  v_expires_at := NULLIF(p_input->>'expires_at', '')::timestamptz;
  IF v_sample_size > v_lot_size
    OR v_accept_number >= v_sample_size
    OR v_reject_number <> v_accept_number + 1
    OR v_reject_number > v_sample_size
    OR v_expires_at IS NULL
    OR v_expires_at < now() + interval '15 minutes'
    OR v_expires_at > now() + interval '24 hours'
    OR jsonb_array_length(v_dimensions) <> 1
    OR jsonb_array_length(v_samples) <> v_sample_size
    OR COALESCE(p_input->>'schema_version', '') <> 'supplier-production-qa-session/v1'
    OR COALESCE(p_input->>'selection_algorithm', '') <> 'hmac-sha256-stratified-v1'
    OR COALESCE(p_input->>'policy_digest', '') !~ '^sha256:[0-9a-f]{64}$'
    OR COALESCE(p_input->>'selection_seed_commitment', '') !~ '^sha256:[0-9a-f]{64}$'
    OR COALESCE(p_input->>'selection_digest', '') !~ '^sha256:[0-9a-f]{64}$'
    OR COALESCE(p_input->>'challenge_hash', '') !~ '^sha256:[0-9a-f]{64}$'
    OR COALESCE(p_input->>'sun_verification_context_digest', '') !~ '^sha256:[0-9a-f]{64}$'
    OR COALESCE(p_input->>'acceptance_context_digest', '') !~ '^sha256:[0-9a-f]{64}$'
    OR jsonb_typeof(p_input->'acceptance_context_binding') IS DISTINCT FROM 'object'
    OR octet_length(COALESCE(p_input->>'acceptance_context_canonical', '')) NOT BETWEEN 2 AND 32768
    OR public.nexid_supplier_qa_canonical_json_v2(p_input->'acceptance_context_binding') IS DISTINCT FROM p_input->>'acceptance_context_canonical'
    OR ('sha256:' || encode(digest(convert_to(p_input->>'acceptance_context_canonical', 'UTF8'), 'sha256'), 'hex')) IS DISTINCT FROM p_input->>'acceptance_context_digest'
    OR COALESCE(p_input->>'selection_seed_ciphertext', '') NOT LIKE 'nexid-app-envelope-v2.%'
    OR COALESCE(p_input->>'challenge_ciphertext', '') NOT LIKE 'nexid-app-envelope-v2.%' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_qa_session_contract_invalid';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(v_dimensions) AS dimension(value)
    WHERE dimension.value NOT IN ('roll_id', 'case_id', 'pallet_id')
  ) OR jsonb_array_length(v_dimensions) <> (
    SELECT count(DISTINCT dimension.value)
    FROM jsonb_array_elements_text(v_dimensions) AS dimension(value)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_qa_stratification_invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_samples) AS sample(value)
    WHERE jsonb_typeof(sample.value) IS DISTINCT FROM 'object'
      OR COALESCE(sample.value->>'tag_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      OR COALESCE(sample.value->>'ordinal', '') !~ '^[1-9][0-9]{0,8}$'
      OR COALESCE(sample.value->>'uid_fingerprint', '') !~ '^sha256:[0-9a-f]{64}$'
      OR COALESCE(sample.value->>'selection_rank', '') !~ '^sha256:[0-9a-f]{64}$'
      OR char_length(COALESCE(sample.value->>'stratum_key', '')) NOT BETWEEN 1 AND 320
      OR jsonb_typeof(sample.value->'stratum_values') IS DISTINCT FROM 'object'
      OR jsonb_typeof(sample.value->'cryptographic_required') IS DISTINCT FROM 'boolean'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_qa_samples_invalid';
  END IF;

  IF (
    SELECT count(DISTINCT (sample.value->>'tag_id')::uuid)
    FROM jsonb_array_elements(v_samples) AS sample(value)
  ) <> v_sample_size
    OR (
      SELECT count(DISTINCT (sample.value->>'ordinal')::integer)
      FROM jsonb_array_elements(v_samples) AS sample(value)
    ) <> v_sample_size
    OR (
      SELECT min((sample.value->>'ordinal')::integer)
      FROM jsonb_array_elements(v_samples) AS sample(value)
    ) <> 1
    OR (
      SELECT max((sample.value->>'ordinal')::integer)
      FROM jsonb_array_elements(v_samples) AS sample(value)
    ) <> v_sample_size
    OR (
      SELECT count(*)
      FROM jsonb_array_elements(v_samples) AS sample(value)
      WHERE (sample.value->>'cryptographic_required')::boolean
    ) <> LEAST(10, v_lot_size, v_sample_size) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_qa_sample_set_invalid';
  END IF;

  IF p_input ?| ARRAY[
    'policy_approved_by', 'policy_approved_at',
    'policy_approval_evidence_ref', 'policy_approval_evidence_sha256'
  ] THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_qa_server_owned_approval_fields_forbidden';
  END IF;

  -- Re-authorize the current human session even for idempotent retries. A
  -- stale operation key is not a capability after revocation or tenant change.
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
      OR (
        auth_session.role::text = 'tenant_admin'
        AND auth_session.tenant_id = v_tenant_id
        AND EXISTS (
          SELECT 1
          FROM resource_permissions permission
          WHERE permission.user_id = actor.id
            AND permission.effect = 'allow'
            AND (
              (permission.resource = 'supplier' AND permission.action IN ('qa', '*'))
              OR (permission.resource = '*' AND permission.action = '*')
            )
        )
      )
    )
  FOR SHARE OF auth_session, actor, membership;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'supplier_production_qa_session_actor_scope_invalid';
  END IF;

  SELECT
    plan_row.*,
    decision_row.id AS approved_decision_id,
    decision_row.decision_status,
    decision_row.decided_at AS policy_approved_at,
    decision_row.approval_evidence_ref,
    decision_row.approval_evidence_sha256,
    lower(approver.email) AS policy_approved_by
  INTO v_plan
  FROM supplier_production_qa_plans plan_row
  JOIN supplier_production_qa_plan_decisions decision_row
    ON decision_row.plan_id = plan_row.id
   AND decision_row.tenant_id = plan_row.tenant_id
   AND decision_row.plan_digest = plan_row.plan_digest
   AND decision_row.decision_status = 'approved'
  JOIN users approver ON approver.id = decision_row.decided_by
  WHERE plan_row.id = v_qa_plan_id
    AND decision_row.id = v_qa_plan_decision_id
    AND plan_row.tenant_id = v_tenant_id
    AND plan_row.supplier_order_id = v_supplier_order_id
    AND plan_row.supplier_sub_batch_id = v_supplier_sub_batch_id
    AND plan_row.batch_id = v_batch_id
    AND upper(plan_row.bid) = v_bid
  FOR KEY SHARE OF plan_row, decision_row, approver;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_approved_plan_required';
  END IF;
  IF v_plan.lot_size IS DISTINCT FROM v_lot_size
    OR v_plan.sample_size IS DISTINCT FROM v_sample_size
    OR v_plan.accept_number IS DISTINCT FROM v_accept_number
    OR v_plan.reject_number IS DISTINCT FROM v_reject_number
    OR v_plan.cryptographic_sample_size IS DISTINCT FROM LEAST(10, v_lot_size, v_sample_size)
    OR v_dimensions IS DISTINCT FROM jsonb_build_array(v_plan.stratification_dimension)
    OR trim(COALESCE(p_input->>'inspection_level', '')) IS DISTINCT FROM v_plan.inspection_level
    OR (p_input->>'target_aql')::numeric IS DISTINCT FROM v_plan.target_aql
    OR trim(COALESCE(p_input->>'policy_reference', '')) IS DISTINCT FROM v_plan.policy_reference
    OR lower(COALESCE(p_input->>'policy_document_sha256', '')) IS DISTINCT FROM v_plan.policy_document_sha256
    OR lower(COALESCE(p_input->>'policy_digest', '')) IS DISTINCT FROM v_plan.plan_digest THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_approved_plan_snapshot_mismatch';
  END IF;

  v_request_fingerprint := 'sha256:' || encode(digest(jsonb_build_object(
    'schema_version', 'supplier-production-qa-session-request/v1',
    'tenant_id', v_tenant_id,
    'supplier_order_id', v_supplier_order_id,
    'supplier_sub_batch_id', v_supplier_sub_batch_id,
    'batch_id', v_batch_id,
    'bid', v_bid,
    'qa_plan_id', v_qa_plan_id,
    'qa_plan_decision_id', v_qa_plan_decision_id,
    'actor_id', v_actor_id
  )::text, 'sha256'), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || chr(31) || v_operation_key, 0));
  SELECT * INTO v_existing
  FROM supplier_production_qa_sessions session_row
  WHERE session_row.tenant_id = v_tenant_id
    AND session_row.operation_key = v_operation_key
  LIMIT 1;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.request_fingerprint IS DISTINCT FROM v_request_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'supplier_production_qa_idempotency_key_conflict';
    END IF;
    RETURN QUERY SELECT
      v_existing.id, v_existing.expires_at, v_existing.sample_size,
      v_existing.selection_digest, v_existing.acceptance_context_digest, true;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'supplier-production-qa' || chr(31) || v_supplier_sub_batch_id::text,
    0
  ));

  SELECT
    sub_batch.id,
    sub_batch.expected_quantity,
    sub_batch.manifest_count,
    lower(sub_batch.manifest_status) AS manifest_status,
    lower(sub_batch.qa_status) AS qa_status,
    sub_batch.manifest_hash,
    sub_batch.manufacturing_state,
    sub_batch.key_export_count,
    sub_batch.key_exported_at,
    lower(COALESCE(purpose_decision.to_purpose, supplier_order.pack_purpose)) AS effective_pack_purpose,
    lower(supplier_order.carrier_profile_code) AS order_carrier_profile_code,
    lower(supplier_order.packaging_governance_status) AS packaging_governance_status,
    supplier_order.packaging_spec_revision,
    lower(supplier_order.packaging_spec_hash) AS packaging_spec_hash,
    lower(batch.carrier_profile_code) AS carrier_profile_code,
    upper(batch.bid) AS bid,
    upper(batch_key.key_fingerprint) AS key_fingerprint,
    batch_key.export_count AS batch_key_export_count,
    batch_key.exported_at AS batch_key_exported_at,
    EXISTS (
      SELECT 1
      FROM supplier_packaging_governance_decisions packaging_decision
      WHERE packaging_decision.supplier_order_id = supplier_order.id
        AND packaging_decision.tenant_id = supplier_order.tenant_id
        AND packaging_decision.spec_revision = supplier_order.packaging_spec_revision
        AND packaging_decision.decision_status = 'approved'
        AND packaging_decision.carrier_profile_code = supplier_order.carrier_profile_code
        AND packaging_decision.spec_hash = supplier_order.packaging_spec_hash
        AND packaging_decision.spec_snapshot = supplier_order.packaging_spec_snapshot
        AND packaging_decision.evidence_refs = supplier_order.packaging_evidence_refs
        AND packaging_decision.validation_snapshot = supplier_order.packaging_validation_snapshot
        AND packaging_decision.decided_by = supplier_order.packaging_approved_by
        AND packaging_decision.decided_at = supplier_order.packaging_approved_at
    ) AS packaging_receipt_valid
  INTO v_locked
  FROM supplier_sub_batches sub_batch
  JOIN supplier_orders supplier_order
    ON supplier_order.id = sub_batch.supplier_order_id
   AND supplier_order.tenant_id = sub_batch.tenant_id
  JOIN batches batch
    ON batch.id = sub_batch.batch_id
   AND batch.tenant_id = sub_batch.tenant_id
   AND upper(batch.bid) = upper(sub_batch.bid)
  JOIN batch_keys batch_key
    ON batch_key.supplier_sub_batch_id = sub_batch.id
   AND batch_key.batch_id = batch.id
   AND batch_key.tenant_id = sub_batch.tenant_id
   AND upper(batch_key.bid) = upper(sub_batch.bid)
   AND batch_key.status = 'active'
  LEFT JOIN supplier_pack_purpose_decisions purpose_decision
    ON purpose_decision.supplier_order_id = supplier_order.id
   AND purpose_decision.tenant_id = supplier_order.tenant_id
  WHERE sub_batch.id = v_supplier_sub_batch_id
    AND sub_batch.supplier_order_id = v_supplier_order_id
    AND sub_batch.batch_id = v_batch_id
    AND sub_batch.tenant_id = v_tenant_id
    AND upper(sub_batch.bid) = v_bid
  FOR UPDATE OF sub_batch, supplier_order, batch, batch_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'supplier_production_qa_scope_not_found';
  END IF;
  IF v_locked.effective_pack_purpose <> 'production'
    OR v_locked.manufacturing_state <> 'PRODUCTION_MANIFEST_IMPORTED'
    OR v_locked.manifest_status <> 'imported'
    OR v_locked.manifest_count IS DISTINCT FROM v_locked.expected_quantity
    OR v_locked.expected_quantity IS DISTINCT FROM v_lot_size
    OR v_locked.qa_status = 'passed'
    OR v_locked.order_carrier_profile_code <> v_locked.carrier_profile_code
    OR v_locked.carrier_profile_code NOT IN ('ntag424_dna', 'ntag424_dna_tt')
    OR v_locked.packaging_governance_status <> 'approved'
    OR v_locked.packaging_receipt_valid IS DISTINCT FROM true
    OR v_locked.key_export_count <> 1
    OR v_locked.batch_key_export_count <> 1
    OR v_locked.key_exported_at IS NULL
    OR v_locked.batch_key_exported_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_preconditions_not_met';
  END IF;
  IF lower(COALESCE(p_input->>'manifest_hash', '')) IS DISTINCT FROM lower(v_locked.manifest_hash)
    OR lower(COALESCE(p_input->>'carrier_profile_code', '')) IS DISTINCT FROM v_locked.carrier_profile_code
    OR upper(COALESCE(p_input->>'key_fingerprint', '')) IS DISTINCT FROM v_locked.key_fingerprint
    OR COALESCE(p_input->>'packaging_spec_revision', '') !~ '^[1-9][0-9]{0,8}$'
    OR (p_input->>'packaging_spec_revision')::integer IS DISTINCT FROM v_locked.packaging_spec_revision
    OR lower(COALESCE(p_input->>'packaging_spec_hash', '')) IS DISTINCT FROM v_locked.packaging_spec_hash
    OR COALESCE(p_input->>'manufacturing_state_at_open', '') <> 'PRODUCTION_MANIFEST_IMPORTED' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_context_changed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM supplier_production_qa_sessions other_session
    LEFT JOIN supplier_production_qa_decisions other_decision
      ON other_decision.session_id = other_session.id
    WHERE other_session.supplier_sub_batch_id = v_supplier_sub_batch_id
      AND other_session.expires_at > now()
      AND other_decision.id IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_session_already_open';
  END IF;

  FOREACH v_dimension IN ARRAY ARRAY(SELECT jsonb_array_elements_text(v_dimensions)) LOOP
    IF EXISTS (
      SELECT 1
      FROM tags manifest_tag
      LEFT JOIN tag_profiles profile ON profile.tag_id = manifest_tag.id
      WHERE manifest_tag.batch_id = v_batch_id
        AND NULLIF(trim(COALESCE(profile.locale_data #>> ARRAY['manifest', 'unit_metadata', v_dimension], '')), '') IS NULL
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_stratification_metadata_incomplete';
    END IF;
  END LOOP;

  SELECT count(*)::integer INTO v_count
  FROM jsonb_array_elements(v_samples) AS sample(value)
  JOIN tags manifest_tag
    ON manifest_tag.id = (sample.value->>'tag_id')::uuid
   AND manifest_tag.batch_id = v_batch_id
  LEFT JOIN tag_profiles profile ON profile.tag_id = manifest_tag.id
  WHERE sample.value->>'uid_fingerprint' = 'sha256:' || encode(digest(
      convert_to(v_bid, 'UTF8') || decode('00', 'hex') || convert_to(upper(manifest_tag.uid_hex), 'UTF8'),
      'sha256'
    ), 'hex')
    AND COALESCE(profile.locale_data #> '{manifest,unit_metadata}', '{}'::jsonb) @> sample.value->'stratum_values';
  IF v_count <> v_sample_size THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_sample_manifest_mismatch';
  END IF;

  INSERT INTO supplier_production_qa_sessions (
    id, qa_plan_id, qa_plan_decision_id, tenant_id, supplier_order_id,
    supplier_sub_batch_id, batch_id, bid,
    schema_version, operation_key, request_fingerprint, lot_size, inspection_level,
    target_aql, sample_size, accept_number, reject_number, policy_reference,
    policy_document_sha256, policy_approved_by, policy_approved_at,
    policy_approval_evidence_ref, policy_approval_evidence_sha256, policy_digest,
    stratification_dimensions, manifest_hash, carrier_profile_code, key_fingerprint,
    packaging_spec_revision, packaging_spec_hash, manufacturing_state_at_open,
    sun_verification_context_digest, acceptance_context_digest,
    acceptance_context_binding, acceptance_context_canonical, selection_algorithm,
    selection_seed_ciphertext, selection_seed_commitment, selection_digest,
    challenge_ciphertext, challenge_hash, expires_at, created_by
  ) VALUES (
    v_session_id, v_qa_plan_id, v_qa_plan_decision_id, v_tenant_id,
    v_supplier_order_id, v_supplier_sub_batch_id, v_batch_id, v_bid,
    'supplier-production-qa-session/v1', v_operation_key, v_request_fingerprint, v_lot_size,
    trim(p_input->>'inspection_level'), (p_input->>'target_aql')::numeric, v_sample_size,
    v_accept_number, v_reject_number, v_plan.policy_reference,
    v_plan.policy_document_sha256, v_plan.policy_approved_by,
    v_plan.policy_approved_at, v_plan.approval_evidence_ref,
    v_plan.approval_evidence_sha256, v_plan.plan_digest,
    v_dimensions, lower(p_input->>'manifest_hash'), lower(p_input->>'carrier_profile_code'),
    upper(p_input->>'key_fingerprint'), (p_input->>'packaging_spec_revision')::integer,
    lower(p_input->>'packaging_spec_hash'), 'PRODUCTION_MANIFEST_IMPORTED',
    lower(p_input->>'sun_verification_context_digest'), lower(p_input->>'acceptance_context_digest'),
    p_input->'acceptance_context_binding', p_input->>'acceptance_context_canonical',
    'hmac-sha256-stratified-v1', p_input->>'selection_seed_ciphertext',
    lower(p_input->>'selection_seed_commitment'), lower(p_input->>'selection_digest'),
    p_input->>'challenge_ciphertext', lower(p_input->>'challenge_hash'), v_expires_at, v_actor_id
  );

  INSERT INTO supplier_production_qa_session_samples (
    session_id, tenant_id, tag_id, ordinal, uid_fingerprint, stratum_key,
    stratum_values, selection_rank, cryptographic_required
  )
  SELECT
    v_session_id, v_tenant_id, (sample.value->>'tag_id')::uuid,
    (sample.value->>'ordinal')::integer, sample.value->>'uid_fingerprint',
    sample.value->>'stratum_key', sample.value->'stratum_values',
    sample.value->>'selection_rank', (sample.value->>'cryptographic_required')::boolean
  FROM jsonb_array_elements(v_samples) AS sample(value)
  ORDER BY (sample.value->>'ordinal')::integer;

  INSERT INTO evidence_events (
    tenant_id, resource_type, resource_id, event_type, payload_json, payload_hash
  ) VALUES (
    v_tenant_id, 'supplier_sub_batch', v_supplier_sub_batch_id::text,
    'supplier_production_qa_session_opened',
    jsonb_build_object(
      'session_id', v_session_id,
      'qa_plan_id', v_qa_plan_id,
      'qa_plan_decision_id', v_qa_plan_decision_id,
      'bid', v_bid,
      'lot_size', v_lot_size,
      'sample_size', v_sample_size,
      'policy_digest', v_plan.plan_digest,
      'selection_digest', lower(p_input->>'selection_digest'),
      'acceptance_context_digest', lower(p_input->>'acceptance_context_digest'),
      'expires_at', v_expires_at,
      'physical_ceremony_verified', false
    ),
    'sha256:' || encode(digest(jsonb_build_object(
      'schema_version', 'supplier-production-qa-session-event/v1',
      'tenant_id', v_tenant_id,
      'session_id', v_session_id,
      'qa_plan_id', v_qa_plan_id,
      'qa_plan_decision_id', v_qa_plan_decision_id,
      'selection_digest', lower(p_input->>'selection_digest'),
      'acceptance_context_digest', lower(p_input->>'acceptance_context_digest')
    )::text, 'sha256'), 'hex')
  );

  INSERT INTO audit_logs (
    actor_id, tenant_id, action, resource_type, resource_id, after_hash, request_id
  ) VALUES (
    v_actor_id, v_tenant_id, 'supplier_production_qa_session_opened',
    'supplier_production_qa_session', v_session_id::text,
    replace(lower(p_input->>'acceptance_context_digest'), 'sha256:', ''),
    NULLIF(left(COALESCE(p_input->>'request_id', ''), 160), '')
  );

  RETURN QUERY SELECT
    v_session_id, v_expires_at, v_sample_size,
    lower(p_input->>'selection_digest'), lower(p_input->>'acceptance_context_digest'), false;
END;
$create_session$;

-- Production passing receipts are accepted only while the immutable session
-- exists, is unexpired and the SUN evidence contains exactly the session's
-- precommitted cryptographic subset. The deferred trigger below additionally
-- requires the production decision to exist in the same transaction.
CREATE OR REPLACE FUNCTION public.nexid_supplier_qa_acceptance_scope_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $qa_scope$
DECLARE
  v_effective_purpose text;
  v_session record;
  v_evidence_fingerprints jsonb;
  v_expected_fingerprints jsonb;
BEGIN
  SELECT COALESCE(decision.to_purpose, sub_batch.pack_purpose)
    INTO v_effective_purpose
  FROM supplier_sub_batches sub_batch
  JOIN supplier_orders order_row
    ON order_row.id = sub_batch.supplier_order_id
   AND order_row.tenant_id = sub_batch.tenant_id
   AND order_row.pack_purpose = sub_batch.pack_purpose
  JOIN batches batch
    ON batch.id = sub_batch.batch_id
   AND batch.tenant_id = sub_batch.tenant_id
   AND upper(batch.bid) = upper(sub_batch.bid)
   AND batch.supplier_order_id = sub_batch.supplier_order_id
   AND batch.supplier_sub_batch_id = sub_batch.id
  LEFT JOIN supplier_pack_purpose_decisions decision
    ON decision.supplier_order_id = sub_batch.supplier_order_id
   AND decision.tenant_id = sub_batch.tenant_id
  WHERE sub_batch.id = NEW.supplier_sub_batch_id
    AND sub_batch.supplier_order_id = NEW.supplier_order_id
    AND sub_batch.tenant_id = NEW.tenant_id
    AND sub_batch.batch_id = NEW.batch_id
    AND upper(sub_batch.bid) = upper(NEW.bid)
  LIMIT 1;
  IF NOT FOUND OR v_effective_purpose IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_pack_purpose_scope_invalid';
  END IF;
  NEW.acceptance_scope := CASE
    WHEN v_effective_purpose = 'trial_integration' THEN 'trial_integration'
    WHEN v_effective_purpose = 'production' THEN 'production_lot'
    ELSE 'legacy_unclassified'
  END;
  IF NEW.status = 'passed' AND v_effective_purpose = 'legacy_unclassified' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_pack_purpose_unclassified';
  END IF;
  IF NEW.status = 'passed' AND v_effective_purpose = 'production' THEN
    IF COALESCE(NEW.evidence_json->>'production_session_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_production_acceptance_v2_required';
    END IF;
    SELECT session_row.* INTO v_session
    FROM supplier_production_qa_sessions session_row
    LEFT JOIN supplier_production_qa_decisions decision_row ON decision_row.session_id = session_row.id
    WHERE session_row.id = (NEW.evidence_json->>'production_session_id')::uuid
      AND session_row.tenant_id = NEW.tenant_id
      AND session_row.supplier_order_id = NEW.supplier_order_id
      AND session_row.supplier_sub_batch_id = NEW.supplier_sub_batch_id
      AND session_row.batch_id = NEW.batch_id
      AND upper(session_row.bid) = upper(NEW.bid)
      AND session_row.expires_at >= now()
      AND decision_row.id IS NULL
    FOR SHARE OF session_row;
    IF NOT FOUND
      OR COALESCE(NEW.evidence_json->>'acceptance_scope', '') <> 'production_lot'
      OR COALESCE(NEW.evidence_json->>'production_acceptance_schema_version', '') <> 'supplier-production-acceptance/v2'
      OR lower(COALESCE(NEW.evidence_json->>'production_policy_digest', '')) IS DISTINCT FROM v_session.policy_digest
      OR lower(COALESCE(NEW.evidence_json->>'production_selection_digest', '')) IS DISTINCT FROM v_session.selection_digest
      OR lower(COALESCE(NEW.evidence_json->>'production_acceptance_context_digest', '')) IS DISTINCT FROM v_session.acceptance_context_digest THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_production_session_invalid';
    END IF;
    SELECT COALESCE(jsonb_agg(value ORDER BY value), '[]'::jsonb)
      INTO v_evidence_fingerprints
    FROM jsonb_array_elements_text(COALESCE(NEW.evidence_json->'batch_scoped_uid_fingerprints', '[]'::jsonb)) item(value);
    SELECT COALESCE(jsonb_agg(sample.uid_fingerprint ORDER BY sample.uid_fingerprint), '[]'::jsonb)
      INTO v_expected_fingerprints
    FROM supplier_production_qa_session_samples sample
    WHERE sample.session_id = v_session.id
      AND sample.cryptographic_required;
    IF v_evidence_fingerprints IS DISTINCT FROM v_expected_fingerprints THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_production_sample_mismatch';
    END IF;
  END IF;
  RETURN NEW;
END;
$qa_scope$;

CREATE OR REPLACE FUNCTION public.nexid_supplier_production_qa_decision_required_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $decision_required$
BEGIN
  IF NEW.status = 'passed' AND NEW.acceptance_scope = 'production_lot' AND NOT EXISTS (
    SELECT 1
    FROM supplier_production_qa_decisions decision_row
    WHERE decision_row.qa_check_id = NEW.id
      AND decision_row.tenant_id = NEW.tenant_id
      AND decision_row.supplier_order_id = NEW.supplier_order_id
      AND decision_row.supplier_sub_batch_id = NEW.supplier_sub_batch_id
      AND decision_row.batch_id = NEW.batch_id
      AND decision_row.status = 'passed'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_atomic_decision_required';
  END IF;
  RETURN NULL;
END;
$decision_required$;

DROP TRIGGER IF EXISTS trg_supplier_production_qa_decision_required ON supplier_qa_checks;
CREATE CONSTRAINT TRIGGER trg_supplier_production_qa_decision_required
  AFTER INSERT ON supplier_qa_checks
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_production_qa_decision_required_v1();

CREATE OR REPLACE FUNCTION public.nexid_commit_supplier_production_qa_v1(p_input jsonb)
RETURNS TABLE (
  decision_id uuid,
  qa_check_id uuid,
  qa_status text,
  disposition text,
  observed_sample_count integer,
  nonconforming_count integer,
  evidence_digest text,
  evidence_event_hash text,
  idempotent_replay boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $commit_production$
DECLARE
  v_session_id uuid;
  v_tenant_id uuid;
  v_actor_id uuid;
  v_auth_session_id uuid;
  v_operation_key text;
  v_challenge text;
  v_observations jsonb;
  v_normalized_observations jsonb;
  v_observed_count integer;
  v_nonconforming_count integer;
  v_status text;
  v_disposition text;
  v_request_fingerprint text;
  v_session supplier_production_qa_sessions%ROWTYPE;
  v_existing supplier_production_qa_decisions%ROWTYPE;
  v_qa_receipt record;
  v_decision_id uuid;
  v_event_payload jsonb;
  v_event_hash text;
BEGIN
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR COALESCE(p_input->>'production_session_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'tenant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'actor_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'auth_session_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_qa_decision_identity_invalid';
  END IF;
  v_session_id := (p_input->>'production_session_id')::uuid;
  v_tenant_id := (p_input->>'tenant_id')::uuid;
  v_actor_id := (p_input->>'actor_id')::uuid;
  v_auth_session_id := (p_input->>'auth_session_id')::uuid;
  v_operation_key := trim(COALESCE(p_input->>'operation_key', ''));
  v_challenge := trim(COALESCE(p_input->>'production_challenge', ''));
  v_observations := COALESCE(p_input->'production_observations', '[]'::jsonb);
  IF v_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
    OR v_challenge !~ '^[A-Za-z0-9_-]{16,128}$'
    OR jsonb_typeof(v_observations) IS DISTINCT FROM 'array'
    OR COALESCE(p_input->>'selection_seed_reveal', '') !~ '^[A-Za-z0-9_-]{16,128}$'
    OR COALESCE(p_input->>'sample_count', '') !~ '^[0-9]{1,8}$'
    OR COALESCE(p_input->>'production_observations_digest', '') !~ '^sha256:[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_qa_decision_input_invalid';
  END IF;

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
      OR (
        auth_session.role::text = 'tenant_admin'
        AND auth_session.tenant_id = v_tenant_id
        AND EXISTS (
          SELECT 1
          FROM resource_permissions permission
          WHERE permission.user_id = actor.id
            AND permission.effect = 'allow'
            AND (
              (permission.resource = 'supplier' AND permission.action IN ('qa', '*'))
              OR (permission.resource = '*' AND permission.action = '*')
            )
        )
      )
    )
  FOR SHARE OF auth_session, actor, membership;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'supplier_production_qa_decider_scope_invalid';
  END IF;

  v_request_fingerprint := 'sha256:' || encode(digest(
    (p_input - ARRAY['request_id', 'auth_session_id', 'user_agent'])::text,
    'sha256'
  ), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || chr(31) || v_operation_key, 0));
  SELECT * INTO v_existing
  FROM supplier_production_qa_decisions decision_row
  WHERE decision_row.tenant_id = v_tenant_id
    AND decision_row.operation_key = v_operation_key
  LIMIT 1;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.request_fingerprint IS DISTINCT FROM v_request_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'supplier_production_qa_idempotency_key_conflict';
    END IF;
    SELECT qa_check.event_hash INTO v_event_hash
    FROM supplier_qa_checks qa_check WHERE qa_check.id = v_existing.qa_check_id;
    RETURN QUERY SELECT
      v_existing.id, v_existing.qa_check_id, v_existing.status, v_existing.disposition,
      v_existing.observed_sample_count, v_existing.nonconforming_count,
      v_existing.evidence_digest, COALESCE(v_event_hash, ''), true;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'supplier-production-qa' || chr(31) || v_session_id::text,
    0
  ));
  SELECT * INTO v_session
  FROM supplier_production_qa_sessions session_row
  WHERE session_row.id = v_session_id
    AND session_row.tenant_id = v_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'supplier_production_qa_session_not_found';
  END IF;
  IF v_session.expires_at < now() THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_session_expired';
  END IF;
  IF EXISTS (SELECT 1 FROM supplier_production_qa_decisions decision_row WHERE decision_row.session_id = v_session.id) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_session_consumed';
  END IF;
  IF ('sha256:' || encode(digest(
      convert_to('supplier-production-qa-challenge/v1', 'UTF8')
        || decode('00', 'hex')
        || convert_to(v_challenge, 'UTF8'),
      'sha256'
    ), 'hex')) IS DISTINCT FROM v_session.challenge_hash THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'supplier_production_qa_challenge_invalid';
  END IF;
  IF ('sha256:' || encode(digest(
      convert_to('supplier-production-qa-selection-seed/v1', 'UTF8')
        || decode('00', 'hex')
        || convert_to(p_input->>'selection_seed_reveal', 'UTF8'),
      'sha256'
    ), 'hex')) IS DISTINCT FROM v_session.selection_seed_commitment THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_seed_reveal_invalid';
  END IF;

  IF jsonb_array_length(v_observations) <> v_session.sample_size
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_observations) AS observation(value)
      WHERE jsonb_typeof(observation.value) IS DISTINCT FROM 'object'
        OR COALESCE(observation.value->>'tag_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        OR COALESCE(observation.value->>'outcome', '') NOT IN ('conforming', 'nonconforming')
        OR jsonb_typeof(COALESCE(observation.value->'defect_codes', '[]'::jsonb)) IS DISTINCT FROM 'array'
        OR jsonb_array_length(COALESCE(observation.value->'defect_codes', '[]'::jsonb)) > 20
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(COALESCE(observation.value->'defect_codes', '[]'::jsonb)) defect(value)
          WHERE defect.value !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$'
        )
        OR (
          observation.value->>'outcome' = 'nonconforming'
          AND jsonb_array_length(COALESCE(observation.value->'defect_codes', '[]'::jsonb)) = 0
        )
        OR (
          observation.value->>'outcome' = 'conforming'
          AND jsonb_array_length(COALESCE(observation.value->'defect_codes', '[]'::jsonb)) <> 0
        )
        OR jsonb_array_length(COALESCE(observation.value->'defect_codes', '[]'::jsonb)) <> (
          SELECT count(DISTINCT defect.value)
          FROM jsonb_array_elements_text(COALESCE(observation.value->'defect_codes', '[]'::jsonb)) defect(value)
        )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_production_qa_observations_invalid';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'tag_id', lower(observation.value->>'tag_id'),
    'outcome', observation.value->>'outcome',
    'defect_codes', COALESCE((
      SELECT jsonb_agg(defect.value ORDER BY defect.value)
      FROM jsonb_array_elements_text(COALESCE(observation.value->'defect_codes', '[]'::jsonb)) defect(value)
    ), '[]'::jsonb)
  ) ORDER BY lower(observation.value->>'tag_id')), '[]'::jsonb)
    INTO v_normalized_observations
  FROM jsonb_array_elements(v_observations) AS observation(value);
  IF ('sha256:' || encode(digest(convert_to(
      public.nexid_supplier_qa_canonical_json_v2(v_normalized_observations),
      'UTF8'
    ), 'sha256'), 'hex')) IS DISTINCT FROM lower(p_input->>'production_observations_digest') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_observations_digest_mismatch';
  END IF;

  SELECT count(DISTINCT (observation.value->>'tag_id')::uuid)::integer
    INTO v_observed_count
  FROM jsonb_array_elements(v_normalized_observations) AS observation(value)
  JOIN supplier_production_qa_session_samples sample
    ON sample.session_id = v_session.id
   AND sample.tag_id = (observation.value->>'tag_id')::uuid;
  IF v_observed_count <> v_session.sample_size THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_observation_scope_mismatch';
  END IF;

  SELECT count(*) FILTER (WHERE observation.value->>'outcome' = 'nonconforming')::integer
    INTO v_nonconforming_count
  FROM jsonb_array_elements(v_normalized_observations) AS observation(value);
  v_status := CASE WHEN v_nonconforming_count <= v_session.accept_number THEN 'passed' ELSE 'failed' END;
  v_disposition := CASE WHEN v_status = 'passed' THEN 'ACCEPT' ELSE 'REJECT' END;
  IF lower(COALESCE(p_input->>'status', '')) IS DISTINCT FROM v_status
    OR (p_input->>'sample_count')::integer IS DISTINCT FROM (CASE
      WHEN v_status = 'passed' THEN LEAST(10, v_session.lot_size, v_session.sample_size)
      ELSE 0
    END)
    OR lower(COALESCE(p_input->'evidence_json'->>'production_session_id', '')) IS DISTINCT FROM lower(v_session.id::text)
    OR lower(COALESCE(p_input->'evidence_json'->>'production_acceptance_context_digest', '')) IS DISTINCT FROM v_session.acceptance_context_digest THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_decision_mismatch';
  END IF;

  SELECT * INTO v_qa_receipt FROM public.nexid_commit_supplier_qa_v2(p_input);
  IF v_qa_receipt.idempotent_replay IS DISTINCT FROM false THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_qa_unexpected_qa_replay';
  END IF;

  INSERT INTO supplier_production_qa_decisions (
    session_id, tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid,
    qa_check_id, schema_version, operation_key, request_fingerprint, status,
    observed_sample_count, nonconforming_count, accept_number, reject_number,
    disposition, observations_digest, evidence_digest, selection_seed_reveal,
    challenge_hash, acceptance_context_digest, decided_by
  ) VALUES (
    v_session.id, v_session.tenant_id, v_session.supplier_order_id,
    v_session.supplier_sub_batch_id, v_session.batch_id, v_session.bid,
    v_qa_receipt.qa_check_id, 'supplier-production-acceptance/v2', v_operation_key,
    v_request_fingerprint, v_status, v_session.sample_size, v_nonconforming_count,
    v_session.accept_number, v_session.reject_number, v_disposition,
    lower(p_input->>'production_observations_digest'), lower(p_input->>'evidence_digest'),
    p_input->>'selection_seed_reveal', v_session.challenge_hash,
    v_session.acceptance_context_digest, v_actor_id
  ) RETURNING id INTO v_decision_id;

  INSERT INTO supplier_production_qa_observations (
    decision_id, session_id, tenant_id, tag_id, outcome, defect_codes, observation_digest
  )
  SELECT
    v_decision_id, v_session.id, v_session.tenant_id,
    (observation.value->>'tag_id')::uuid, observation.value->>'outcome',
    COALESCE(observation.value->'defect_codes', '[]'::jsonb),
    'sha256:' || encode(digest(jsonb_build_object(
      'schema_version', 'supplier-production-qa-observation/v1',
      'session_id', v_session.id,
      'tag_id', observation.value->>'tag_id',
      'outcome', observation.value->>'outcome',
      'defect_codes', COALESCE(observation.value->'defect_codes', '[]'::jsonb)
    )::text, 'sha256'), 'hex')
  FROM jsonb_array_elements(v_normalized_observations) AS observation(value);

  v_event_payload := jsonb_build_object(
    'schema_version', 'supplier-production-acceptance/v2',
    'session_id', v_session.id,
    'qa_check_id', v_qa_receipt.qa_check_id,
    'bid', v_session.bid,
    'status', v_status,
    'disposition', v_disposition,
    'lot_size', v_session.lot_size,
    'sample_size', v_session.sample_size,
    'nonconforming_count', v_nonconforming_count,
    'accept_number', v_session.accept_number,
    'reject_number', v_session.reject_number,
    'policy_digest', v_session.policy_digest,
    'selection_digest', v_session.selection_digest,
    'acceptance_context_digest', v_session.acceptance_context_digest,
    'physical_ceremony_verified', false
  );
  v_event_hash := 'sha256:' || encode(digest(jsonb_build_object(
    'schema_version', 'supplier-production-acceptance-event/v2',
    'tenant_id', v_session.tenant_id,
    'resource_type', 'supplier_sub_batch',
    'resource_id', v_session.supplier_sub_batch_id,
    'event_type', CASE WHEN v_status = 'passed' THEN 'supplier_production_qa_passed' ELSE 'supplier_production_qa_failed' END,
    'payload', v_event_payload
  )::text, 'sha256'), 'hex');
  INSERT INTO evidence_events (
    tenant_id, resource_type, resource_id, event_type, payload_json, payload_hash
  ) VALUES (
    v_session.tenant_id, 'supplier_sub_batch', v_session.supplier_sub_batch_id::text,
    CASE WHEN v_status = 'passed' THEN 'supplier_production_qa_passed' ELSE 'supplier_production_qa_failed' END,
    v_event_payload, v_event_hash
  );
  INSERT INTO vault_artifacts (
    tenant_id, supplier_order_id, supplier_sub_batch_id, resource_type, resource_id,
    artifact_type, content_hash, mime_type, metadata_json
  ) VALUES (
    v_session.tenant_id, v_session.supplier_order_id, v_session.supplier_sub_batch_id,
    'supplier_production_qa_session', v_session.id::text, 'production_qa_receipt',
    lower(p_input->>'evidence_digest'), 'application/json', v_event_payload
  );
  INSERT INTO audit_logs (
    actor_id, tenant_id, action, resource_type, resource_id, after_hash, request_id
  ) VALUES (
    v_actor_id, v_session.tenant_id,
    CASE WHEN v_status = 'passed' THEN 'supplier_production_qa_passed' ELSE 'supplier_production_qa_failed' END,
    'supplier_production_qa_session', v_session.id::text,
    replace(v_event_hash, 'sha256:', ''),
    NULLIF(left(COALESCE(p_input->>'request_id', ''), 160), '')
  );

  RETURN QUERY SELECT
    v_decision_id, v_qa_receipt.qa_check_id, v_status, v_disposition,
    v_session.sample_size, v_nonconforming_count,
    lower(p_input->>'evidence_digest'), v_event_hash, false;
END;
$commit_production$;

-- These read-only candidate checks are intentionally not wired into the v1
-- commercial release guards. Migration 0071 therefore remains fail-closed
-- until a separate, reviewed atomic activation writer owns every projection.
CREATE OR REPLACE FUNCTION public.nexid_candidate_assert_supplier_order_production_acceptance_v2(p_supplier_order_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
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
  SELECT count(*)::integer,
         count(*) FILTER (WHERE EXISTS (
           SELECT 1
           FROM supplier_production_qa_decisions decision_row
           JOIN supplier_production_qa_sessions session_row ON session_row.id = decision_row.session_id
           WHERE decision_row.supplier_sub_batch_id = sub_batch.id
             AND decision_row.tenant_id = sub_batch.tenant_id
             AND decision_row.batch_id = sub_batch.batch_id
             AND decision_row.status = 'passed'
             AND decision_row.disposition = 'ACCEPT'
             AND decision_row.qa_check_id = sub_batch.release_qa_check_id
             AND session_row.acceptance_context_digest = decision_row.acceptance_context_digest
         ))::integer
    INTO v_total, v_accepted
  FROM supplier_sub_batches sub_batch
  WHERE sub_batch.supplier_order_id = p_supplier_order_id;
  IF v_total = 0 OR v_accepted <> v_total THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_acceptance_v2_required';
  END IF;
END;
$order_release$;

CREATE OR REPLACE FUNCTION public.nexid_candidate_assert_supplier_batch_production_acceptance_v2(p_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $batch_release$
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
  SELECT count(*)::integer INTO v_sub_batch_count
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
  SELECT sub_batch.*, COALESCE(purpose_decision.to_purpose, order_row.pack_purpose) AS effective_pack_purpose
    INTO v_sub_batch
  FROM supplier_sub_batches sub_batch
  JOIN supplier_orders order_row
    ON order_row.id = sub_batch.supplier_order_id
   AND order_row.tenant_id = sub_batch.tenant_id
  LEFT JOIN supplier_pack_purpose_decisions purpose_decision
    ON purpose_decision.supplier_order_id = order_row.id
   AND purpose_decision.tenant_id = order_row.tenant_id
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
  IF v_effective_purpose = 'legacy_unclassified' OR v_effective_purpose = '' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_pack_purpose_unclassified';
  END IF;
  IF v_effective_purpose = 'trial_integration' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_trial_integration_non_sellable';
  END IF;
  IF v_sub_batch.qa_status <> 'passed'
    OR v_sub_batch.qa_acceptance_scope <> 'production_lot'
    OR v_sub_batch.release_qa_check_id IS NULL
    OR v_sub_batch.manufacturing_state NOT IN ('RECEIVING_QA_PASSED', 'ACTIVATED')
    OR NOT EXISTS (
      SELECT 1
      FROM supplier_production_qa_decisions decision_row
      JOIN supplier_production_qa_sessions session_row ON session_row.id = decision_row.session_id
      WHERE decision_row.supplier_sub_batch_id = v_sub_batch.id
        AND decision_row.tenant_id = v_sub_batch.tenant_id
        AND decision_row.batch_id = v_sub_batch.batch_id
        AND decision_row.qa_check_id = v_sub_batch.release_qa_check_id
        AND decision_row.status = 'passed'
        AND decision_row.disposition = 'ACCEPT'
        AND session_row.acceptance_context_digest = decision_row.acceptance_context_digest
    ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_acceptance_v2_required';
  END IF;
END;
$batch_release$;

REVOKE ALL ON FUNCTION public.nexid_supplier_production_qa_history_append_only_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_manufacturing_state_projection_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_manufacturing_state_history_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_manufacturing_state_refresh_on_purpose_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_submit_supplier_production_qa_plan_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_decide_supplier_production_qa_plan_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_production_qa_v1_capability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_create_supplier_production_qa_session_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_production_qa_decision_required_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_commit_supplier_production_qa_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_candidate_assert_supplier_order_production_acceptance_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_candidate_assert_supplier_batch_production_acceptance_v2(uuid) FROM PUBLIC;
