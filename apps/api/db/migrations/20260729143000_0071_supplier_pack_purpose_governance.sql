-- Supplier pack purpose and commercial-release governance.
--
-- Migration 0070 deliberately proves only the fixed-size SUN integration
-- ceremony. This migration prevents that receipt from being interpreted as a
-- production release. It does not change K_META/K_FILE, SUN/SDM decoding,
-- counters, CMAC verification or the physical TagTamper path.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE supplier_orders
  ADD COLUMN IF NOT EXISTS pack_purpose text,
  ADD COLUMN IF NOT EXISTS purpose_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS purpose_locked_by uuid REFERENCES users(id) ON DELETE RESTRICT;

UPDATE supplier_orders
SET pack_purpose = 'legacy_unclassified'
WHERE pack_purpose IS NULL;

ALTER TABLE supplier_orders
  ALTER COLUMN pack_purpose SET NOT NULL,
  ALTER COLUMN pack_purpose DROP DEFAULT,
  DROP CONSTRAINT IF EXISTS supplier_orders_pack_purpose_check,
  DROP CONSTRAINT IF EXISTS supplier_orders_pack_purpose_lock_check;

ALTER TABLE supplier_orders
  ADD CONSTRAINT supplier_orders_pack_purpose_check CHECK (
    pack_purpose IN ('legacy_unclassified', 'trial_integration', 'production')
  ),
  ADD CONSTRAINT supplier_orders_pack_purpose_lock_check CHECK (
    (pack_purpose = 'legacy_unclassified' AND purpose_locked_at IS NULL AND purpose_locked_by IS NULL)
    OR
    (pack_purpose IN ('trial_integration', 'production') AND purpose_locked_at IS NOT NULL AND purpose_locked_by IS NOT NULL)
  );

ALTER TABLE supplier_sub_batches
  ADD COLUMN IF NOT EXISTS pack_purpose text,
  ADD COLUMN IF NOT EXISTS qa_acceptance_scope text,
  ADD COLUMN IF NOT EXISTS integration_qa_check_id uuid REFERENCES supplier_qa_checks(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS release_qa_check_id uuid REFERENCES supplier_qa_checks(id) ON DELETE RESTRICT;

UPDATE supplier_sub_batches sub_batch
SET pack_purpose = order_row.pack_purpose
FROM supplier_orders order_row
WHERE order_row.id = sub_batch.supplier_order_id
  AND order_row.tenant_id = sub_batch.tenant_id
  AND sub_batch.pack_purpose IS NULL;

ALTER TABLE supplier_sub_batches
  ALTER COLUMN pack_purpose SET NOT NULL,
  ALTER COLUMN pack_purpose DROP DEFAULT,
  DROP CONSTRAINT IF EXISTS supplier_sub_batches_pack_purpose_check,
  DROP CONSTRAINT IF EXISTS supplier_sub_batches_qa_acceptance_scope_check;

ALTER TABLE supplier_sub_batches
  ADD CONSTRAINT supplier_sub_batches_pack_purpose_check CHECK (
    pack_purpose IN ('legacy_unclassified', 'trial_integration', 'production')
  ),
  ADD CONSTRAINT supplier_sub_batches_qa_acceptance_scope_check CHECK (
    qa_acceptance_scope IS NULL
    OR qa_acceptance_scope IN ('legacy_unclassified', 'trial_integration', 'production_lot')
  );

ALTER TABLE supplier_qa_checks
  ADD COLUMN IF NOT EXISTS acceptance_scope text;

ALTER TABLE supplier_qa_checks
  DROP CONSTRAINT IF EXISTS supplier_qa_checks_acceptance_scope_check;

ALTER TABLE supplier_qa_checks
  ADD CONSTRAINT supplier_qa_checks_acceptance_scope_check CHECK (
    acceptance_scope IS NULL
    OR acceptance_scope IN ('legacy_unclassified', 'trial_integration', 'production_lot')
  );

ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS qa_acceptance_scope text,
  ADD COLUMN IF NOT EXISTS release_qa_check_id uuid REFERENCES supplier_qa_checks(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS active_for_claim boolean NOT NULL DEFAULT false;

ALTER TABLE batches
  DROP CONSTRAINT IF EXISTS batches_qa_acceptance_scope_check;

ALTER TABLE batches
  ADD CONSTRAINT batches_qa_acceptance_scope_check CHECK (
    qa_acceptance_scope IS NULL
    OR qa_acceptance_scope IN ('legacy_unclassified', 'trial_integration', 'production_lot')
  );

ALTER TABLE tags
  ADD COLUMN IF NOT EXISTS active_for_claim boolean;

CREATE INDEX IF NOT EXISTS idx_batches_claim_activation
  ON batches(tenant_id, bid, active_for_claim);
CREATE INDEX IF NOT EXISTS idx_tags_claim_activation
  ON tags(batch_id, uid_hex, active_for_claim);

CREATE TABLE IF NOT EXISTS supplier_pack_purpose_decisions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_order_id uuid NOT NULL REFERENCES supplier_orders(id) ON DELETE RESTRICT,
  from_purpose text NOT NULL CHECK (from_purpose = 'legacy_unclassified'),
  to_purpose text NOT NULL CHECK (to_purpose = 'trial_integration'),
  operation_key text NOT NULL CHECK (operation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  scope_digest text NOT NULL CHECK (scope_digest ~ '^sha256:[0-9a-f]{64}$'),
  scope_item_count integer NOT NULL CHECK (scope_item_count BETWEEN 1 AND 52),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 16 AND 1000),
  confirmation text NOT NULL CHECK (confirmation = 'CLASSIFY_LEGACY_SUPPLIER_ORDER_AS_TRIAL'),
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_order_id),
  UNIQUE (tenant_id, operation_key)
);

CREATE TABLE IF NOT EXISTS supplier_pack_purpose_decision_items (
  decision_id uuid NOT NULL REFERENCES supplier_pack_purpose_decisions(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_order_id uuid NOT NULL REFERENCES supplier_orders(id) ON DELETE RESTRICT,
  supplier_sub_batch_id uuid NOT NULL REFERENCES supplier_sub_batches(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  qa_check_id uuid REFERENCES supplier_qa_checks(id) ON DELETE RESTRICT,
  item_digest text NOT NULL CHECK (item_digest ~ '^sha256:[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (decision_id, supplier_sub_batch_id),
  UNIQUE (decision_id, batch_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_pack_purpose_decision_items_order
  ON supplier_pack_purpose_decision_items(tenant_id, supplier_order_id, supplier_sub_batch_id);

CREATE OR REPLACE FUNCTION public.nexid_supplier_purpose_history_append_only_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_pack_purpose_history_is_append_only';
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_pack_purpose_history_append_only ON supplier_pack_purpose_decisions;
CREATE TRIGGER trg_supplier_pack_purpose_history_append_only
  BEFORE UPDATE OR DELETE ON supplier_pack_purpose_decisions
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_purpose_history_append_only_v1();

DROP TRIGGER IF EXISTS trg_supplier_pack_purpose_item_history_append_only ON supplier_pack_purpose_decision_items;
CREATE TRIGGER trg_supplier_pack_purpose_item_history_append_only
  BEFORE UPDATE OR DELETE ON supplier_pack_purpose_decision_items
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_purpose_history_append_only_v1();

CREATE OR REPLACE FUNCTION public.nexid_effective_supplier_pack_purpose_v1(p_supplier_order_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(decision.to_purpose, order_row.pack_purpose)
  FROM supplier_orders order_row
  LEFT JOIN supplier_pack_purpose_decisions decision
    ON decision.supplier_order_id = order_row.id
   AND decision.tenant_id = order_row.tenant_id
  WHERE order_row.id = p_supplier_order_id
  LIMIT 1
$$;

CREATE OR REPLACE VIEW public.supplier_order_pack_purpose_effective_v1 AS
SELECT
  order_row.id AS supplier_order_id,
  order_row.tenant_id,
  order_row.pack_purpose AS declared_pack_purpose,
  COALESCE(decision.to_purpose, order_row.pack_purpose) AS effective_pack_purpose,
  decision.id AS classification_decision_id,
  decision.created_at AS classified_at
FROM supplier_orders order_row
LEFT JOIN supplier_pack_purpose_decisions decision
  ON decision.supplier_order_id = order_row.id
 AND decision.tenant_id = order_row.tenant_id;

CREATE OR REPLACE VIEW public.supplier_sub_batch_pack_purpose_effective_v1 AS
SELECT
  sub_batch.id AS supplier_sub_batch_id,
  sub_batch.tenant_id,
  sub_batch.supplier_order_id,
  sub_batch.batch_id,
  sub_batch.bid,
  sub_batch.pack_purpose AS declared_pack_purpose,
  COALESCE(decision.to_purpose, sub_batch.pack_purpose) AS effective_pack_purpose,
  decision.id AS classification_decision_id
FROM supplier_sub_batches sub_batch
LEFT JOIN supplier_pack_purpose_decisions decision
  ON decision.supplier_order_id = sub_batch.supplier_order_id
 AND decision.tenant_id = sub_batch.tenant_id;

CREATE OR REPLACE VIEW public.supplier_qa_acceptance_scope_effective_v1 AS
SELECT
  qa_check.id AS qa_check_id,
  qa_check.tenant_id,
  qa_check.supplier_order_id,
  qa_check.supplier_sub_batch_id,
  qa_check.batch_id,
  qa_check.acceptance_scope AS declared_acceptance_scope,
  CASE
    WHEN decision_item.qa_check_id = qa_check.id THEN 'trial_integration'
    ELSE qa_check.acceptance_scope
  END AS effective_acceptance_scope,
  decision_item.decision_id AS classification_decision_id
FROM supplier_qa_checks qa_check
LEFT JOIN supplier_pack_purpose_decision_items decision_item
  ON decision_item.qa_check_id = qa_check.id
 AND decision_item.tenant_id = qa_check.tenant_id
 AND decision_item.supplier_order_id = qa_check.supplier_order_id
 AND decision_item.supplier_sub_batch_id = qa_check.supplier_sub_batch_id;

CREATE OR REPLACE FUNCTION public.nexid_supplier_pack_purpose_base_immutable_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_purpose text;
  v_batch record;
BEGIN
  IF TG_TABLE_NAME = 'supplier_orders' THEN
    IF TG_OP = 'INSERT' AND NEW.pack_purpose NOT IN ('trial_integration', 'production') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_pack_purpose_required';
    END IF;
    IF TG_OP = 'UPDATE' AND (
      NEW.pack_purpose IS DISTINCT FROM OLD.pack_purpose
      OR NEW.purpose_locked_at IS DISTINCT FROM OLD.purpose_locked_at
      OR NEW.purpose_locked_by IS DISTINCT FROM OLD.purpose_locked_by
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_pack_purpose_is_immutable';
    END IF;
    RETURN NEW;
  END IF;

  -- Serialize sub-batch membership changes with the one-time legacy
  -- classification function. This keeps the frozen decision scope exact even
  -- if an application writer races the classification transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'supplier-pack-purpose' || chr(31) || NEW.supplier_order_id::text,
    0
  ));
  SELECT order_row.pack_purpose
    INTO v_order_purpose
  FROM supplier_orders order_row
  WHERE order_row.id = NEW.supplier_order_id
    AND order_row.tenant_id = NEW.tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'supplier_sub_batch_order_scope_invalid';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.pack_purpose IS DISTINCT FROM v_order_purpose THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_sub_batch_pack_purpose_mismatch';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.pack_purpose IS DISTINCT FROM OLD.pack_purpose THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_sub_batch_pack_purpose_is_immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.supplier_order_id IS DISTINCT FROM OLD.supplier_order_id
    OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.batch_id IS DISTINCT FROM OLD.batch_id
    OR upper(NEW.bid) IS DISTINCT FROM upper(OLD.bid)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_sub_batch_commercial_scope_is_immutable';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1
      FROM supplier_pack_purpose_decisions decision
      WHERE decision.supplier_order_id = NEW.supplier_order_id
        AND decision.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_pack_purpose_classified_scope_is_frozen';
    END IF;
    IF v_order_purpose = 'legacy_unclassified' THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_pack_purpose_legacy_scope_is_frozen';
    END IF;
    IF NEW.batch_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'supplier_sub_batch_batch_scope_required';
    END IF;
    SELECT batch.id, batch.tenant_id, batch.bid, batch.supplier_order_id,
           batch.supplier_sub_batch_id, batch.status, batch.active_for_claim,
           batch.sdm_config
      INTO v_batch
    FROM batches batch
    WHERE batch.id = NEW.batch_id
    FOR KEY SHARE OF batch;
    IF NOT FOUND
      OR v_batch.tenant_id IS DISTINCT FROM NEW.tenant_id
      OR upper(v_batch.bid) IS DISTINCT FROM upper(NEW.bid)
      OR v_batch.supplier_order_id IS DISTINCT FROM NEW.supplier_order_id
      OR (v_batch.supplier_sub_batch_id IS NOT NULL AND v_batch.supplier_sub_batch_id IS DISTINCT FROM NEW.id) THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'supplier_sub_batch_batch_scope_invalid';
    END IF;
    IF v_batch.status::text IN ('active', 'active_in_market')
      OR v_batch.active_for_claim IS TRUE
      OR lower(COALESCE(v_batch.sdm_config->>'active_for_claim', '')) IN ('true', '1') THEN
      IF v_order_purpose = 'trial_integration' THEN
        RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_trial_integration_non_sellable';
      END IF;
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_acceptance_v2_required';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_order_pack_purpose_immutable ON supplier_orders;
CREATE TRIGGER trg_supplier_order_pack_purpose_immutable
  BEFORE INSERT OR UPDATE ON supplier_orders
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_pack_purpose_base_immutable_v1();

DROP TRIGGER IF EXISTS trg_supplier_sub_batch_pack_purpose_immutable ON supplier_sub_batches;
CREATE TRIGGER trg_supplier_sub_batch_pack_purpose_immutable
  BEFORE INSERT OR UPDATE ON supplier_sub_batches
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_pack_purpose_base_immutable_v1();

CREATE OR REPLACE FUNCTION public.nexid_classify_legacy_supplier_order_trial_v1(p_input jsonb)
RETURNS TABLE (
  decision_id uuid,
  supplier_order_id uuid,
  effective_pack_purpose text,
  scope_digest text,
  idempotent_replay boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_supplier_order_id uuid;
  v_actor_id uuid;
  v_operation_key text;
  v_reason text;
  v_confirmation text;
  v_items jsonb;
  v_normalized_items jsonb;
  v_request_fingerprint text;
  v_scope_digest text;
  v_order record;
  v_existing supplier_pack_purpose_decisions%ROWTYPE;
  v_decision_id uuid;
  v_event_payload jsonb;
  v_event_hash text;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR octet_length(p_input::text) > 8192 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_pack_purpose_input_invalid';
  END IF;
  BEGIN
    v_tenant_id := NULLIF(trim(p_input->>'tenant_id'), '')::uuid;
    v_supplier_order_id := NULLIF(trim(p_input->>'supplier_order_id'), '')::uuid;
    v_actor_id := NULLIF(trim(p_input->>'actor_id'), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_pack_purpose_identity_invalid';
  END;
  v_operation_key := trim(COALESCE(p_input->>'operation_key', ''));
  v_reason := trim(COALESCE(p_input->>'reason', ''));
  v_confirmation := trim(COALESCE(p_input->>'confirmation', ''));
  IF v_tenant_id IS NULL OR v_supplier_order_id IS NULL OR v_actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_pack_purpose_identity_required';
  END IF;
  IF v_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_pack_purpose_operation_key_invalid';
  END IF;
  IF char_length(v_reason) < 16 OR char_length(v_reason) > 1000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_pack_purpose_reason_invalid';
  END IF;
  v_items := p_input->'items';
  IF v_confirmation <> 'CLASSIFY_LEGACY_SUPPLIER_ORDER_AS_TRIAL' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_pack_purpose_confirmation_required';
  END IF;
  IF jsonb_typeof(v_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_pack_purpose_items_invalid';
  END IF;
  IF jsonb_array_length(v_items) < 1
    OR jsonb_array_length(v_items) > 52 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_pack_purpose_items_invalid';
  END IF;
  IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_items) item
      WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
        OR COALESCE(item->>'supplier_sub_batch_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        OR (
          NOT (item ? 'qa_check_id')
          OR (
            jsonb_typeof(item->'qa_check_id') <> 'null'
          AND COALESCE(item->>'qa_check_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          )
        )
    ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_pack_purpose_items_invalid';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'supplier_sub_batch_id', lower(item->>'supplier_sub_batch_id'),
    'qa_check_id', CASE
      WHEN jsonb_typeof(item->'qa_check_id') = 'string' THEN lower(item->>'qa_check_id')
      ELSE NULL
    END
  ) ORDER BY lower(item->>'supplier_sub_batch_id'))
    INTO v_normalized_items
  FROM jsonb_array_elements(v_items) item;
  IF (
    SELECT count(*) <> count(DISTINCT lower(item->>'supplier_sub_batch_id'))
    FROM jsonb_array_elements(v_items) item
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_pack_purpose_items_duplicate';
  END IF;

  v_request_fingerprint := 'sha256:' || encode(digest(jsonb_build_object(
    'schema_version', 'supplier-pack-purpose-classification-intent/v1',
    'tenant_id', v_tenant_id,
    'supplier_order_id', v_supplier_order_id,
    'actor_id', v_actor_id,
    'reason', v_reason,
    'confirmation', v_confirmation
  )::text, 'sha256'), 'hex');

  -- Authorization is re-evaluated even for an idempotent replay. A receipt is
  -- not a capability that a deactivated or out-of-scope actor may continue to
  -- read by retaining the operation key.
  PERFORM 1
  FROM users actor
  JOIN memberships membership ON membership.user_id = actor.id
  WHERE actor.id = v_actor_id
    AND actor.admin_status::text = 'active'
    AND (
      (membership.role::text = 'super_admin' AND membership.tenant_id IS NULL)
      OR (membership.role::text = 'tenant_admin' AND membership.tenant_id = v_tenant_id)
    )
  FOR SHARE OF actor, membership;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'supplier_pack_purpose_actor_scope_invalid';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || chr(31) || v_operation_key, 0));
  SELECT decision.*
    INTO v_existing
  FROM supplier_pack_purpose_decisions decision
  WHERE decision.tenant_id = v_tenant_id
    AND decision.operation_key = v_operation_key
  LIMIT 1;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.supplier_order_id IS DISTINCT FROM v_supplier_order_id
      OR v_existing.request_fingerprint IS DISTINCT FROM v_request_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'supplier_pack_purpose_idempotency_conflict';
    END IF;
    IF (
      SELECT count(*)::integer
      FROM supplier_pack_purpose_decision_items frozen_item
      WHERE frozen_item.decision_id = v_existing.id
    ) IS DISTINCT FROM v_existing.scope_item_count
      OR EXISTS (
        SELECT 1
        FROM supplier_pack_purpose_decision_items frozen_item
        WHERE frozen_item.decision_id = v_existing.id
          AND (
            frozen_item.tenant_id IS DISTINCT FROM v_existing.tenant_id
            OR frozen_item.supplier_order_id IS DISTINCT FROM v_existing.supplier_order_id
            OR frozen_item.item_digest IS DISTINCT FROM 'sha256:' || encode(digest(jsonb_build_object(
              'schema_version', 'supplier-pack-purpose-classification-item/v1',
              'decision_id', frozen_item.decision_id,
              'tenant_id', frozen_item.tenant_id,
              'supplier_order_id', frozen_item.supplier_order_id,
              'supplier_sub_batch_id', frozen_item.supplier_sub_batch_id,
              'batch_id', frozen_item.batch_id,
              'qa_check_id', frozen_item.qa_check_id,
              'scope_digest', v_existing.scope_digest
            )::text, 'sha256'), 'hex')
          )
      ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_pack_purpose_replay_receipt_invalid';
    END IF;
    IF jsonb_array_length(v_normalized_items) IS DISTINCT FROM v_existing.scope_item_count
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_normalized_items) requested_item
        LEFT JOIN supplier_pack_purpose_decision_items frozen_item
          ON frozen_item.decision_id = v_existing.id
         AND frozen_item.supplier_sub_batch_id = (requested_item->>'supplier_sub_batch_id')::uuid
        WHERE frozen_item.supplier_sub_batch_id IS NULL
      ) THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'supplier_pack_purpose_idempotency_conflict';
    END IF;
    RETURN QUERY SELECT v_existing.id, v_existing.supplier_order_id,
      v_existing.to_purpose, v_existing.scope_digest, true;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('supplier-pack-purpose' || chr(31) || v_supplier_order_id::text, 0));
  SELECT order_row.id, order_row.tenant_id, order_row.pack_purpose
    INTO v_order
  FROM supplier_orders order_row
  WHERE order_row.id = v_supplier_order_id
    AND order_row.tenant_id = v_tenant_id
  FOR UPDATE OF order_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'supplier_order_not_found';
  END IF;
  IF v_order.pack_purpose <> 'legacy_unclassified' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_pack_purpose_already_classified';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM supplier_pack_purpose_decisions decision
    WHERE decision.supplier_order_id = v_supplier_order_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_pack_purpose_already_classified';
  END IF;

  PERFORM 1
  FROM supplier_sub_batches sub_batch
  JOIN batches batch
    ON batch.id = sub_batch.batch_id
   AND batch.tenant_id = sub_batch.tenant_id
   AND upper(batch.bid) = upper(sub_batch.bid)
   AND batch.supplier_order_id = sub_batch.supplier_order_id
   AND batch.supplier_sub_batch_id = sub_batch.id
  WHERE sub_batch.supplier_order_id = v_supplier_order_id
    AND sub_batch.tenant_id = v_tenant_id
    AND sub_batch.pack_purpose = 'legacy_unclassified'
  ORDER BY sub_batch.id
  FOR UPDATE OF sub_batch, batch;
  PERFORM 1
  FROM batch_keys batch_key
  WHERE batch_key.supplier_order_id = v_supplier_order_id
    AND batch_key.tenant_id = v_tenant_id
  ORDER BY batch_key.id
  FOR KEY SHARE OF batch_key;
  PERFORM 1
  FROM supplier_qa_checks qa_check
  WHERE qa_check.supplier_order_id = v_supplier_order_id
    AND qa_check.tenant_id = v_tenant_id
  ORDER BY qa_check.id
  FOR KEY SHARE OF qa_check;

  IF (
    SELECT count(*)
    FROM supplier_sub_batches sub_batch
    WHERE sub_batch.supplier_order_id = v_supplier_order_id
      AND sub_batch.tenant_id = v_tenant_id
  ) <> jsonb_array_length(v_normalized_items)
    OR (
      SELECT count(*)
      FROM supplier_sub_batches sub_batch
      JOIN batches batch
        ON batch.id = sub_batch.batch_id
       AND batch.tenant_id = sub_batch.tenant_id
       AND upper(batch.bid) = upper(sub_batch.bid)
       AND batch.supplier_order_id = sub_batch.supplier_order_id
       AND batch.supplier_sub_batch_id = sub_batch.id
      WHERE sub_batch.supplier_order_id = v_supplier_order_id
        AND sub_batch.tenant_id = v_tenant_id
        AND sub_batch.pack_purpose = 'legacy_unclassified'
    ) <> jsonb_array_length(v_normalized_items)
    OR EXISTS (
      WITH requested AS (
        SELECT (item->>'supplier_sub_batch_id')::uuid AS supplier_sub_batch_id
        FROM jsonb_array_elements(v_normalized_items) item
      )
      SELECT 1
      FROM requested
      LEFT JOIN supplier_sub_batches sub_batch
        ON sub_batch.id = requested.supplier_sub_batch_id
       AND sub_batch.supplier_order_id = v_supplier_order_id
       AND sub_batch.tenant_id = v_tenant_id
      WHERE sub_batch.id IS NULL
    ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_pack_purpose_scope_enumeration_mismatch';
  END IF;

  IF EXISTS (
    WITH requested AS (
      SELECT
        (item->>'supplier_sub_batch_id')::uuid AS supplier_sub_batch_id,
        CASE WHEN jsonb_typeof(item->'qa_check_id') = 'string'
          THEN (item->>'qa_check_id')::uuid ELSE NULL END AS qa_check_id
      FROM jsonb_array_elements(v_normalized_items) item
    )
    SELECT 1
    FROM requested
    JOIN supplier_sub_batches sub_batch
      ON sub_batch.id = requested.supplier_sub_batch_id
     AND sub_batch.supplier_order_id = v_supplier_order_id
     AND sub_batch.tenant_id = v_tenant_id
    JOIN batches batch
      ON batch.id = sub_batch.batch_id
     AND batch.tenant_id = sub_batch.tenant_id
     AND upper(batch.bid) = upper(sub_batch.bid)
     AND batch.supplier_order_id = sub_batch.supplier_order_id
     AND batch.supplier_sub_batch_id = sub_batch.id
    LEFT JOIN LATERAL (
      SELECT qa_check.id
      FROM supplier_qa_checks qa_check
      WHERE qa_check.supplier_sub_batch_id = sub_batch.id
        AND qa_check.supplier_order_id = v_supplier_order_id
        AND qa_check.tenant_id = v_tenant_id
        AND qa_check.batch_id = sub_batch.batch_id
        AND upper(qa_check.bid) = upper(sub_batch.bid)
        AND qa_check.status = 'passed'
      ORDER BY qa_check.created_at DESC, qa_check.id DESC
      LIMIT 1
    ) passed_receipt ON true
    WHERE requested.qa_check_id IS DISTINCT FROM passed_receipt.id
       OR (lower(COALESCE(sub_batch.qa_status, '')) = 'passed')
          IS DISTINCT FROM (passed_receipt.id IS NOT NULL)
       OR (lower(COALESCE(batch.qa_status, '')) = 'passed')
          IS DISTINCT FROM (passed_receipt.id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_pack_purpose_qa_receipt_mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM supplier_sub_batches sub_batch
    JOIN batches batch
      ON batch.id = sub_batch.batch_id
     AND batch.tenant_id = sub_batch.tenant_id
     AND upper(batch.bid) = upper(sub_batch.bid)
     AND batch.supplier_order_id = sub_batch.supplier_order_id
     AND batch.supplier_sub_batch_id = sub_batch.id
    LEFT JOIN tags tag ON tag.batch_id = batch.id
    WHERE sub_batch.supplier_order_id = v_supplier_order_id
      AND sub_batch.tenant_id = v_tenant_id
      AND (
        batch.status::text IN ('active', 'active_in_market')
        OR batch.active_for_claim IS TRUE
        OR lower(COALESCE(batch.sdm_config->>'active_for_claim', '')) IN ('true', '1')
        OR tag.status::text = 'active'
        OR tag.lifecycle_state = 'active'
        OR tag.active_for_claim IS TRUE
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_pack_purpose_active_scope_forbidden';
  END IF;

  WITH requested AS (
    SELECT
      (item->>'supplier_sub_batch_id')::uuid AS supplier_sub_batch_id,
      CASE WHEN jsonb_typeof(item->'qa_check_id') = 'string'
        THEN (item->>'qa_check_id')::uuid ELSE NULL END AS qa_check_id
    FROM jsonb_array_elements(v_normalized_items) item
  )
  SELECT 'sha256:' || encode(digest(COALESCE(jsonb_agg(jsonb_build_object(
    'supplier_sub_batch_id', sub_batch.id,
    'batch_id', batch.id,
    'bid', upper(sub_batch.bid),
    'sequence_index', sub_batch.sequence_index,
    'expected_quantity', sub_batch.expected_quantity,
    'manifest_hash', sub_batch.manifest_hash,
    'qa_status', sub_batch.qa_status,
    'qa_check_id', requested.qa_check_id,
    'key_fingerprint', batch_key.key_fingerprint,
    'meta_key_ciphertext_digest', encode(digest(COALESCE(batch.meta_key_ct, ''), 'sha256'), 'hex'),
    'file_key_ciphertext_digest', encode(digest(COALESCE(batch.file_key_ct, ''), 'sha256'), 'hex'),
    'sdm_config_digest', encode(digest(COALESCE(batch.sdm_config, '{}'::jsonb)::text, 'sha256'), 'hex')
  ) ORDER BY sub_batch.sequence_index, sub_batch.id), '[]'::jsonb)::text, 'sha256'), 'hex')
    INTO v_scope_digest
  FROM supplier_sub_batches sub_batch
  JOIN batches batch
    ON batch.id = sub_batch.batch_id
   AND batch.tenant_id = sub_batch.tenant_id
   AND upper(batch.bid) = upper(sub_batch.bid)
   AND batch.supplier_order_id = sub_batch.supplier_order_id
   AND batch.supplier_sub_batch_id = sub_batch.id
  JOIN requested ON requested.supplier_sub_batch_id = sub_batch.id
  LEFT JOIN LATERAL (
    SELECT active_key.key_fingerprint
    FROM batch_keys active_key
    WHERE active_key.supplier_sub_batch_id = sub_batch.id
      AND active_key.batch_id = batch.id
      AND active_key.tenant_id = sub_batch.tenant_id
      AND active_key.status = 'active'
    ORDER BY active_key.created_at DESC, active_key.id DESC
    LIMIT 1
  ) batch_key ON true
  WHERE sub_batch.supplier_order_id = v_supplier_order_id
    AND sub_batch.tenant_id = v_tenant_id;

  INSERT INTO supplier_pack_purpose_decisions (
    tenant_id, supplier_order_id, from_purpose, to_purpose,
    operation_key, request_fingerprint, scope_digest, scope_item_count,
    reason, confirmation, actor_id
  ) VALUES (
    v_tenant_id, v_supplier_order_id, 'legacy_unclassified', 'trial_integration',
    v_operation_key, v_request_fingerprint, v_scope_digest, jsonb_array_length(v_normalized_items),
    v_reason, v_confirmation, v_actor_id
  )
  RETURNING id INTO v_decision_id;

  WITH requested AS (
    SELECT
      (item->>'supplier_sub_batch_id')::uuid AS supplier_sub_batch_id,
      CASE WHEN jsonb_typeof(item->'qa_check_id') = 'string'
        THEN (item->>'qa_check_id')::uuid ELSE NULL END AS qa_check_id
    FROM jsonb_array_elements(v_normalized_items) item
  )
  INSERT INTO supplier_pack_purpose_decision_items (
    decision_id, tenant_id, supplier_order_id, supplier_sub_batch_id,
    batch_id, qa_check_id, item_digest
  )
  SELECT
    v_decision_id,
    v_tenant_id,
    v_supplier_order_id,
    sub_batch.id,
    sub_batch.batch_id,
    requested.qa_check_id,
    'sha256:' || encode(digest(jsonb_build_object(
      'schema_version', 'supplier-pack-purpose-classification-item/v1',
      'decision_id', v_decision_id,
      'tenant_id', v_tenant_id,
      'supplier_order_id', v_supplier_order_id,
      'supplier_sub_batch_id', sub_batch.id,
      'batch_id', sub_batch.batch_id,
      'qa_check_id', requested.qa_check_id,
      'scope_digest', v_scope_digest
    )::text, 'sha256'), 'hex')
  FROM requested
  JOIN supplier_sub_batches sub_batch
    ON sub_batch.id = requested.supplier_sub_batch_id
   AND sub_batch.supplier_order_id = v_supplier_order_id
   AND sub_batch.tenant_id = v_tenant_id
  ORDER BY sub_batch.id;

  v_event_payload := jsonb_build_object(
    'supplier_order_id', v_supplier_order_id,
    'from_purpose', 'legacy_unclassified',
    'to_purpose', 'trial_integration',
    'commercial_disposition', 'NON_SELLABLE',
    'production_acceptance', false,
    'physical_ceremony_verified', false,
    'scope_digest', v_scope_digest,
    'scope_item_count', jsonb_array_length(v_normalized_items),
    'operation_key', v_operation_key
  );
  v_event_hash := 'sha256:' || encode(digest(jsonb_build_object(
    'schema_version', 'supplier-pack-purpose-event/v1',
    'tenant_id', v_tenant_id,
    'resource_type', 'supplier_order',
    'resource_id', v_supplier_order_id,
    'event_type', 'supplier_pack_purpose_classified',
    'payload', v_event_payload
  )::text, 'sha256'), 'hex');
  INSERT INTO evidence_events (
    tenant_id, resource_type, resource_id, event_type, payload_json, payload_hash
  ) VALUES (
    v_tenant_id, 'supplier_order', v_supplier_order_id::text,
    'supplier_pack_purpose_classified', v_event_payload, v_event_hash
  );
  INSERT INTO audit_logs (
    actor_id, tenant_id, action, resource_type, resource_id, before_hash, after_hash, request_id
  ) VALUES (
    v_actor_id, v_tenant_id, 'supplier_pack_purpose_classified',
    'supplier_order', v_supplier_order_id::text, NULL, replace(v_scope_digest, 'sha256:', ''),
    NULLIF(left(COALESCE(p_input->>'request_id', ''), 160), '')
  );

  RETURN QUERY SELECT v_decision_id, v_supplier_order_id, 'trial_integration', v_scope_digest, false;
END;
$$;

CREATE OR REPLACE FUNCTION public.nexid_supplier_qa_acceptance_scope_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_effective_purpose text;
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
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_production_acceptance_v2_required';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_qa_acceptance_scope ON supplier_qa_checks;
CREATE TRIGGER trg_supplier_qa_acceptance_scope
  BEFORE INSERT ON supplier_qa_checks
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_qa_acceptance_scope_v1();

CREATE OR REPLACE FUNCTION public.nexid_supplier_qa_scope_projection_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_receipt record;
  v_sub_batch record;
BEGIN
  IF NEW.qa_status IS DISTINCT FROM 'passed' OR (TG_OP = 'UPDATE' AND OLD.qa_status = 'passed') THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'supplier_sub_batches' THEN
    SELECT qa_check.id, qa_check.acceptance_scope
      INTO v_receipt
    FROM supplier_qa_checks qa_check
    WHERE qa_check.supplier_sub_batch_id = NEW.id
      AND qa_check.tenant_id = NEW.tenant_id
      AND qa_check.supplier_order_id = NEW.supplier_order_id
      AND qa_check.batch_id = NEW.batch_id
      AND upper(qa_check.bid) = upper(NEW.bid)
      AND qa_check.status = 'passed'
    ORDER BY qa_check.created_at DESC, qa_check.id DESC
    LIMIT 1;
    IF v_receipt.id IS NULL OR v_receipt.acceptance_scope IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_scoped_receipt_required';
    END IF;
    NEW.qa_acceptance_scope := v_receipt.acceptance_scope;
    IF v_receipt.acceptance_scope = 'trial_integration' THEN
      NEW.integration_qa_check_id := v_receipt.id;
    ELSE
      NEW.release_qa_check_id := v_receipt.id;
    END IF;
    RETURN NEW;
  END IF;

  SELECT sub_batch.qa_acceptance_scope, sub_batch.release_qa_check_id
    INTO v_sub_batch
  FROM supplier_sub_batches sub_batch
  WHERE sub_batch.batch_id = NEW.id
    AND sub_batch.tenant_id = NEW.tenant_id
    AND sub_batch.supplier_order_id = NEW.supplier_order_id
    AND sub_batch.id = NEW.supplier_sub_batch_id
    AND upper(sub_batch.bid) = upper(NEW.bid);
  IF v_sub_batch.qa_acceptance_scope IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_qa_scoped_receipt_required';
  END IF;
  NEW.qa_acceptance_scope := v_sub_batch.qa_acceptance_scope;
  NEW.release_qa_check_id := v_sub_batch.release_qa_check_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_sub_batch_qa_scope_projection ON supplier_sub_batches;
CREATE TRIGGER trg_supplier_sub_batch_qa_scope_projection
  BEFORE UPDATE OF qa_status ON supplier_sub_batches
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_qa_scope_projection_v1();

DROP TRIGGER IF EXISTS trg_supplier_batch_qa_scope_projection ON batches;
CREATE TRIGGER trg_supplier_batch_qa_scope_projection
  BEFORE UPDATE OF qa_status ON batches
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_qa_scope_projection_v1();

CREATE OR REPLACE FUNCTION public.nexid_assert_supplier_order_commercial_release_v1(p_supplier_order_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_effective_purpose text;
BEGIN
  v_effective_purpose := public.nexid_effective_supplier_pack_purpose_v1(p_supplier_order_id);
  IF v_effective_purpose = 'legacy_unclassified' OR v_effective_purpose IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_pack_purpose_unclassified';
  END IF;
  IF v_effective_purpose = 'trial_integration' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_trial_integration_non_sellable';
  END IF;
  RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_acceptance_v2_required';
END;
$$;

CREATE OR REPLACE FUNCTION public.nexid_assert_supplier_commercial_release_v1(p_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch record;
  v_sub_batch record;
  v_sub_batch_count integer;
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
         sub_batch.batch_id, sub_batch.bid
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

  PERFORM public.nexid_assert_supplier_order_commercial_release_v1(v_batch.supplier_order_id);
END;
$$;

ALTER TABLE sdk_pos_activations
  DROP CONSTRAINT IF EXISTS sdk_pos_commercial_identity_check;
ALTER TABLE sdk_pos_activations
  ADD CONSTRAINT sdk_pos_commercial_identity_check CHECK (
    activation_status NOT IN ('active', 'used')
    OR (
      batch_id IS NOT NULL
      AND (
        (tag_id IS NULL AND NULLIF(trim(uid_hex), '') IS NULL)
        OR (tag_id IS NOT NULL AND NULLIF(trim(uid_hex), '') IS NOT NULL)
      )
    )
  ) NOT VALID;

ALTER TABLE sdk_claim_requests
  DROP CONSTRAINT IF EXISTS sdk_claim_commercial_identity_check;
ALTER TABLE sdk_claim_requests
  ADD CONSTRAINT sdk_claim_commercial_identity_check CHECK (
    (claim_status <> 'claimed' AND active_for_claim IS DISTINCT FROM TRUE)
    OR (
      batch_id IS NOT NULL
      AND tag_id IS NOT NULL
      AND NULLIF(trim(uid_hex), '') IS NOT NULL
    )
  ) NOT VALID;

ALTER TABLE consumer_product_ownerships
  DROP CONSTRAINT IF EXISTS consumer_ownership_claimed_tag_check;
ALTER TABLE consumer_product_ownerships
  ADD CONSTRAINT consumer_ownership_claimed_tag_check CHECK (
    status <> 'claimed' OR tag_id IS NOT NULL
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.nexid_supplier_commercial_sink_guard_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_requires_guard boolean := false;
  v_batch record;
  v_tag record;
BEGIN
  IF TG_TABLE_NAME = 'sdk_pos_activations' THEN
    v_requires_guard := NEW.activation_status IN ('active', 'used');
  ELSIF TG_TABLE_NAME = 'sdk_claim_requests' THEN
    v_requires_guard := NEW.claim_status = 'claimed' OR NEW.active_for_claim IS TRUE;
  ELSE
    v_requires_guard := NEW.status = 'claimed';
  END IF;
  IF NOT v_requires_guard THEN
    RETURN NEW;
  END IF;
  IF NEW.batch_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'supplier_commercial_sink_batch_required';
  END IF;

  SELECT batch.id, batch.tenant_id, batch.bid
    INTO v_batch
  FROM batches batch
  WHERE batch.id = NEW.batch_id;
  IF NOT FOUND OR v_batch.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'supplier_commercial_sink_batch_scope_invalid';
  END IF;
  IF TG_TABLE_NAME IN ('sdk_pos_activations', 'sdk_claim_requests') THEN
    IF upper(v_batch.bid) IS DISTINCT FROM upper(NEW.bid) THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'supplier_commercial_sink_bid_scope_invalid';
    END IF;
  END IF;

  IF NEW.tag_id IS NOT NULL THEN
    SELECT tag.id, tag.batch_id, tag.uid_hex
      INTO v_tag
    FROM tags tag
    WHERE tag.id = NEW.tag_id;
    IF NOT FOUND
      OR v_tag.batch_id IS DISTINCT FROM NEW.batch_id
      OR upper(v_tag.uid_hex) IS DISTINCT FROM upper(NEW.uid_hex) THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'supplier_commercial_sink_tag_scope_invalid';
    END IF;
  ELSIF TG_TABLE_NAME <> 'sdk_pos_activations' OR NULLIF(trim(NEW.uid_hex), '') IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'supplier_commercial_sink_tag_required';
  END IF;

  IF TG_TABLE_NAME = 'consumer_product_ownerships' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM events event
      WHERE event.id = NEW.event_id
        AND event.tenant_id = NEW.tenant_id
        AND event.batch_id = NEW.batch_id
        AND upper(event.uid_hex) = upper(NEW.uid_hex)
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'consumer_ownership_event_scope_invalid';
    END IF;
  END IF;

  PERFORM public.nexid_assert_supplier_commercial_release_v1(NEW.batch_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_sdk_pos_commercial_guard ON sdk_pos_activations;
CREATE TRIGGER trg_supplier_sdk_pos_commercial_guard
  BEFORE INSERT OR UPDATE ON sdk_pos_activations
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_commercial_sink_guard_v1();

DROP TRIGGER IF EXISTS trg_supplier_sdk_claim_commercial_guard ON sdk_claim_requests;
CREATE TRIGGER trg_supplier_sdk_claim_commercial_guard
  BEFORE INSERT OR UPDATE ON sdk_claim_requests
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_commercial_sink_guard_v1();

DROP TRIGGER IF EXISTS trg_supplier_consumer_ownership_commercial_guard ON consumer_product_ownerships;
CREATE TRIGGER trg_supplier_consumer_ownership_commercial_guard
  BEFORE INSERT OR UPDATE ON consumer_product_ownerships
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_commercial_sink_guard_v1();

CREATE OR REPLACE FUNCTION public.nexid_supplier_commercial_transition_guard_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch_id uuid;
  v_requires_guard boolean := false;
BEGIN
  IF TG_TABLE_NAME = 'batches' THEN
    v_batch_id := NEW.id;
    v_requires_guard := TG_OP = 'INSERT'
      AND (
        NEW.status::text IN ('active', 'active_in_market')
        OR NEW.active_for_claim IS TRUE
        OR lower(COALESCE(NEW.sdm_config->>'active_for_claim', '')) IN ('true', '1')
      );
    IF TG_OP = 'UPDATE' THEN
      v_requires_guard := (
        NEW.status::text IN ('active', 'active_in_market')
        AND OLD.status::text NOT IN ('active', 'active_in_market')
      ) OR (
        NEW.active_for_claim IS TRUE AND OLD.active_for_claim IS DISTINCT FROM TRUE
      ) OR (
        lower(COALESCE(NEW.sdm_config->>'active_for_claim', '')) IN ('true', '1')
        AND lower(COALESCE(OLD.sdm_config->>'active_for_claim', '')) NOT IN ('true', '1')
      );
    END IF;
  ELSE
    v_batch_id := NEW.batch_id;
    v_requires_guard := TG_OP = 'INSERT'
      AND (
        NEW.status::text = 'active'
        OR NEW.lifecycle_state = 'active'
        OR NEW.active_for_claim IS TRUE
      );
    IF TG_OP = 'UPDATE' THEN
      v_requires_guard := (
        NEW.status::text = 'active' AND OLD.status::text IS DISTINCT FROM 'active'
      ) OR (
        NEW.lifecycle_state = 'active' AND OLD.lifecycle_state IS DISTINCT FROM 'active'
      ) OR (
        NEW.active_for_claim IS TRUE AND OLD.active_for_claim IS DISTINCT FROM TRUE
      );
    END IF;
  END IF;
  IF v_requires_guard THEN
    IF TG_TABLE_NAME = 'batches' AND TG_OP = 'INSERT' THEN
      IF NEW.supplier_order_id IS NOT NULL OR NEW.supplier_sub_batch_id IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_commercial_scope_invalid';
      END IF;
    ELSE
      PERFORM public.nexid_assert_supplier_commercial_release_v1(v_batch_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_batch_commercial_transition_guard ON batches;
CREATE TRIGGER trg_supplier_batch_commercial_transition_guard
  BEFORE INSERT OR UPDATE ON batches
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_commercial_transition_guard_v1();

DROP TRIGGER IF EXISTS trg_supplier_tag_commercial_transition_guard ON tags;
CREATE TRIGGER trg_supplier_tag_commercial_transition_guard
  BEFORE INSERT OR UPDATE ON tags
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_commercial_transition_guard_v1();

REVOKE ALL ON FUNCTION public.nexid_supplier_purpose_history_append_only_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_effective_supplier_pack_purpose_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_pack_purpose_base_immutable_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_classify_legacy_supplier_order_trial_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_qa_acceptance_scope_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_qa_scope_projection_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_assert_supplier_order_commercial_release_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_assert_supplier_commercial_release_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_commercial_sink_guard_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_commercial_transition_guard_v1() FROM PUBLIC;
