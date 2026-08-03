-- Atomic supplier-order dispatch and tenant-handover receipts.
--
-- These receipts record operational custody transitions only. They never
-- approve QA, never activate tags, and never claim contractual or physical
-- acceptance. Production handover is possible only after the independently
-- approved production QA receipt and complete activation already exist.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS supplier_order_lifecycle_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_order_id uuid NOT NULL REFERENCES supplier_orders(id) ON DELETE RESTRICT,
  transition text NOT NULL CHECK (transition IN ('mark_sent', 'record_tenant_handover')),
  from_status text NOT NULL,
  to_status text NOT NULL,
  pack_purpose text NOT NULL CHECK (pack_purpose IN ('trial_integration', 'production')),
  operation_key text NOT NULL,
  request_digest text NOT NULL CHECK (request_digest ~ '^sha256:[0-9a-f]{64}$'),
  event_hash text NOT NULL UNIQUE CHECK (event_hash ~ '^sha256:[0-9a-f]{64}$'),
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_email text NOT NULL,
  actor_role text NOT NULL CHECK (actor_role = 'super_admin'),
  recipient_ref text NOT NULL,
  delivery_channel text NOT NULL CHECK (delivery_channel IN (
    'secure_transfer', 'tenant_portal', 'courier', 'email_notice', 'in_person', 'other'
  )),
  evidence_ref text NOT NULL,
  reason text NOT NULL,
  tenant_acceptance_claimed boolean NOT NULL DEFAULT false CHECK (tenant_acceptance_claimed = false),
  physical_handover_verified boolean NOT NULL DEFAULT false CHECK (physical_handover_verified = false),
  qa_override boolean NOT NULL DEFAULT false CHECK (qa_override = false),
  activation_override boolean NOT NULL DEFAULT false CHECK (activation_override = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_order_lifecycle_freeform_secret_check CHECK (
    public.nexid_audit_freeform_is_safe_v1(recipient_ref)
    AND public.nexid_audit_freeform_is_safe_v1(evidence_ref)
    AND public.nexid_audit_freeform_is_safe_v1(reason)
  ),
  UNIQUE (tenant_id, operation_key),
  UNIQUE (supplier_order_id, transition)
);

CREATE INDEX IF NOT EXISTS idx_supplier_order_lifecycle_tenant_created
  ON supplier_order_lifecycle_receipts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_order_lifecycle_order_created
  ON supplier_order_lifecycle_receipts(supplier_order_id, created_at ASC);

CREATE OR REPLACE FUNCTION public.nexid_supplier_order_lifecycle_append_only_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_order_lifecycle_receipt_append_only';
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_order_lifecycle_append_only
  ON supplier_order_lifecycle_receipts;
CREATE TRIGGER trg_supplier_order_lifecycle_append_only
  BEFORE UPDATE OR DELETE ON supplier_order_lifecycle_receipts
  FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_order_lifecycle_append_only_v1();

CREATE OR REPLACE FUNCTION public.nexid_supplier_order_lifecycle_v1_capability()
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT 'supplier-order-lifecycle/v1'::text
$$;

CREATE OR REPLACE FUNCTION public.nexid_transition_supplier_order_v1(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $supplier_order_lifecycle_v1$
DECLARE
  v_supplier_order_id uuid;
  v_actor_id uuid;
  v_auth_session_id uuid;
  v_actor_email text;
  v_transition text;
  v_operation_key text;
  v_recipient_ref text;
  v_delivery_channel text;
  v_evidence_ref text;
  v_reason text;
  v_request_id text;
  v_user_agent text;
  v_request_digest text;
  v_event_payload jsonb;
  v_event_hash text;
  v_receipt_id uuid := gen_random_uuid();
  v_order supplier_orders%ROWTYPE;
  v_existing supplier_order_lifecycle_receipts%ROWTYPE;
  v_pack_purpose text;
  v_to_status text;
  v_sub_batch_count integer;
  v_all_exported_once boolean;
  v_all_manifest_imported boolean;
  v_all_qa_passed boolean;
  v_all_production_activated boolean;
  v_all_trial_inactive boolean;
  v_now timestamptz := now();
BEGIN
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR octet_length(p_input::text) > 32768 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_order_lifecycle_input_invalid';
  END IF;

  BEGIN
    v_supplier_order_id := NULLIF(trim(p_input->>'supplier_order_id'), '')::uuid;
    v_actor_id := NULLIF(trim(p_input->>'actor_id'), '')::uuid;
    v_auth_session_id := NULLIF(trim(p_input->>'auth_session_id'), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_order_lifecycle_identity_invalid';
  END;

  v_transition := lower(trim(COALESCE(p_input->>'transition', '')));
  v_operation_key := trim(COALESCE(p_input->>'operation_key', ''));
  v_recipient_ref := trim(COALESCE(p_input->>'recipient_ref', ''));
  v_delivery_channel := lower(trim(COALESCE(p_input->>'delivery_channel', '')));
  v_evidence_ref := trim(COALESCE(p_input->>'evidence_ref', ''));
  v_reason := trim(COALESCE(p_input->>'reason', ''));
  v_request_id := NULLIF(left(trim(COALESCE(p_input->>'request_id', '')), 160), '');
  v_user_agent := NULLIF(left(trim(COALESCE(p_input->>'user_agent', '')), 1024), '');

  IF v_supplier_order_id IS NULL
    OR v_actor_id IS NULL
    OR v_auth_session_id IS NULL
    OR v_transition NOT IN ('mark_sent', 'record_tenant_handover')
    OR v_operation_key !~ '^[A-Za-z0-9._:-]{8,128}$'
    OR octet_length(v_recipient_ref) NOT BETWEEN 3 AND 200
    OR v_delivery_channel NOT IN ('secure_transfer', 'tenant_portal', 'courier', 'email_notice', 'in_person', 'other')
    OR octet_length(v_evidence_ref) NOT BETWEEN 3 AND 500
    OR octet_length(v_reason) NOT BETWEEN 16 AND 1000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_order_lifecycle_payload_invalid';
  END IF;
  IF NOT public.nexid_audit_freeform_is_safe_v1(v_recipient_ref)
    OR NOT public.nexid_audit_freeform_is_safe_v1(v_evidence_ref)
    OR NOT public.nexid_audit_freeform_is_safe_v1(v_reason) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'supplier_order_lifecycle_sensitive_audit_input_rejected';
  END IF;

  SELECT * INTO v_order
  FROM supplier_orders supplier_order
  WHERE supplier_order.id = v_supplier_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'supplier_order_lifecycle_order_not_found';
  END IF;

  SELECT lower(actor.email)
    INTO v_actor_email
  FROM auth_sessions auth_session
  JOIN users actor ON actor.id = auth_session.user_id
  JOIN memberships membership
    ON membership.user_id = actor.id
   AND membership.role = auth_session.role
   AND membership.tenant_id IS NOT DISTINCT FROM auth_session.tenant_id
  WHERE auth_session.id = v_auth_session_id
    AND auth_session.user_id = v_actor_id
    AND auth_session.role::text = 'super_admin'
    AND auth_session.tenant_id IS NULL
    AND auth_session.mfa_verified IS TRUE
    AND auth_session.revoked_at IS NULL
    AND auth_session.expires_at > v_now
    AND actor.admin_status::text = 'active'
    AND membership.role::text = 'super_admin'
    AND membership.tenant_id IS NULL
  FOR SHARE OF auth_session, actor, membership;
  IF NOT FOUND OR v_actor_email !~ '^[^[:space:]@]+@[^[:space:]@]+$' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'supplier_order_lifecycle_actor_scope_invalid';
  END IF;

  v_pack_purpose := public.nexid_effective_supplier_pack_purpose_v1(v_order.id);
  IF v_pack_purpose NOT IN ('trial_integration', 'production') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_order_lifecycle_pack_purpose_invalid';
  END IF;

  v_request_digest := 'sha256:' || encode(digest(jsonb_build_object(
    'schema_version', 'supplier-order-lifecycle-request/v1',
    'tenant_id', v_order.tenant_id,
    'supplier_order_id', v_order.id,
    'transition', v_transition,
    'operation_key', v_operation_key,
    'recipient_ref', v_recipient_ref,
    'delivery_channel', v_delivery_channel,
    'evidence_ref', v_evidence_ref,
    'reason', v_reason
  )::text, 'sha256'), 'hex');

  SELECT * INTO v_existing
  FROM supplier_order_lifecycle_receipts receipt
  WHERE receipt.tenant_id = v_order.tenant_id
    AND receipt.operation_key = v_operation_key;
  IF FOUND THEN
    IF v_existing.supplier_order_id IS DISTINCT FROM v_order.id
      OR v_existing.transition IS DISTINCT FROM v_transition
      OR v_existing.request_digest IS DISTINCT FROM v_request_digest THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'supplier_order_lifecycle_idempotency_conflict';
    END IF;
    RETURN jsonb_build_object(
      'id', v_existing.id,
      'supplier_order_id', v_existing.supplier_order_id,
      'transition', v_existing.transition,
      'from_status', v_existing.from_status,
      'to_status', v_existing.to_status,
      'pack_purpose', v_existing.pack_purpose,
      'event_hash', v_existing.event_hash,
      'created_at', v_existing.created_at,
      'idempotent_replay', true,
      'tenant_acceptance_claimed', false,
      'physical_handover_verified', false,
      'qa_override', false,
      'activation_override', false
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM supplier_order_lifecycle_receipts receipt
    WHERE receipt.supplier_order_id = v_order.id
      AND receipt.transition = v_transition
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'supplier_order_lifecycle_transition_already_recorded';
  END IF;

  SELECT
    count(*)::integer,
    COALESCE(bool_and(sub_batch.key_export_count = 1 AND sub_batch.key_exported_at IS NOT NULL), false),
    COALESCE(bool_and(lower(COALESCE(sub_batch.manifest_status, '')) = 'imported'), false),
    COALESCE(bool_and(lower(COALESCE(sub_batch.qa_status, '')) = 'passed'), false),
    COALESCE(bool_and(
      sub_batch.manufacturing_state = 'ACTIVATED'
      AND lower(COALESCE(sub_batch.status, '')) = 'activated'
      AND sub_batch.activated_at IS NOT NULL
    ), false),
    COALESCE(bool_and(
      sub_batch.activated_at IS NULL
      AND lower(COALESCE(sub_batch.status, '')) NOT IN ('activated', 'partially_activated', 'active')
    ), false)
  INTO
    v_sub_batch_count,
    v_all_exported_once,
    v_all_manifest_imported,
    v_all_qa_passed,
    v_all_production_activated,
    v_all_trial_inactive
  FROM supplier_sub_batches sub_batch
  WHERE sub_batch.supplier_order_id = v_order.id
    AND sub_batch.tenant_id = v_order.tenant_id;

  IF v_sub_batch_count < 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_order_lifecycle_sub_batches_required';
  END IF;

  IF v_transition = 'mark_sent' THEN
    IF lower(COALESCE(v_order.status, '')) <> 'pack_ready' THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_order_mark_sent_state_invalid';
    END IF;
    IF NOT v_all_exported_once THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_order_mark_sent_export_receipt_required';
    END IF;
    v_to_status := 'sent_to_supplier';
  ELSE
    IF lower(COALESCE(v_order.status, '')) <> 'sent_to_supplier'
      OR NOT EXISTS (
        SELECT 1 FROM supplier_order_lifecycle_receipts sent_receipt
        WHERE sent_receipt.supplier_order_id = v_order.id
          AND sent_receipt.transition = 'mark_sent'
      ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_order_handover_dispatch_receipt_required';
    END IF;
    IF NOT v_all_manifest_imported OR NOT v_all_qa_passed THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_order_handover_qa_gate_required';
    END IF;
    IF v_pack_purpose = 'production' AND NOT v_all_production_activated THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_order_handover_activation_complete_required';
    END IF;
    IF v_pack_purpose = 'trial_integration' AND NOT v_all_trial_inactive THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_order_handover_trial_must_remain_inactive';
    END IF;
    v_to_status := 'handed_over_to_tenant';
  END IF;

  v_event_payload := jsonb_build_object(
    'schema_version', 'supplier-order-lifecycle-event/v1',
    'receipt_id', v_receipt_id,
    'supplier_order_id', v_order.id,
    'transition', v_transition,
    'from_status', v_order.status,
    'to_status', v_to_status,
    'pack_purpose', v_pack_purpose,
    'commercial_disposition', CASE
      WHEN v_pack_purpose = 'trial_integration' THEN 'NON_SELLABLE'
      WHEN v_transition = 'mark_sent' THEN 'BLOCKED_PENDING_RECEIVING_QA'
      ELSE 'ACTIVATED_PRODUCTION_HANDOVER'
    END,
    'request_digest', v_request_digest,
    'recipient_ref_sha256', 'sha256:' || encode(digest(v_recipient_ref, 'sha256'), 'hex'),
    'evidence_ref_sha256', 'sha256:' || encode(digest(v_evidence_ref, 'sha256'), 'hex'),
    'reason_sha256', 'sha256:' || encode(digest(v_reason, 'sha256'), 'hex'),
    'tenant_acceptance_claimed', false,
    'physical_handover_verified', false,
    'qa_override', false,
    'activation_override', false
  );
  v_event_hash := 'sha256:' || encode(digest(jsonb_build_object(
    'schema_version', 'supplier-order-lifecycle-evidence/v1',
    'tenant_id', v_order.tenant_id,
    'resource_type', 'supplier_order',
    'resource_id', v_order.id,
    'event_type', CASE WHEN v_transition = 'mark_sent'
      THEN 'supplier_order_sent_to_supplier'
      ELSE 'supplier_order_tenant_handover_recorded' END,
    'payload', v_event_payload
  )::text, 'sha256'), 'hex');

  INSERT INTO supplier_order_lifecycle_receipts (
    id, tenant_id, supplier_order_id, transition, from_status, to_status,
    pack_purpose, operation_key, request_digest, event_hash, actor_id,
    actor_email, actor_role, recipient_ref, delivery_channel, evidence_ref,
    reason, tenant_acceptance_claimed, physical_handover_verified,
    qa_override, activation_override, created_at
  ) VALUES (
    v_receipt_id, v_order.tenant_id, v_order.id, v_transition, v_order.status,
    v_to_status, v_pack_purpose, v_operation_key, v_request_digest, v_event_hash,
    v_actor_id, v_actor_email, 'super_admin', v_recipient_ref,
    v_delivery_channel, v_evidence_ref, v_reason, false, false, false, false, v_now
  );

  UPDATE supplier_orders
  SET status = v_to_status,
      updated_at = v_now
  WHERE id = v_order.id
    AND tenant_id = v_order.tenant_id
    AND status IS NOT DISTINCT FROM v_order.status;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'supplier_order_lifecycle_state_changed';
  END IF;

  INSERT INTO evidence_events (
    tenant_id, resource_type, resource_id, event_type, payload_json, payload_hash
  ) VALUES (
    v_order.tenant_id, 'supplier_order', v_order.id::text,
    CASE WHEN v_transition = 'mark_sent'
      THEN 'supplier_order_sent_to_supplier'
      ELSE 'supplier_order_tenant_handover_recorded' END,
    v_event_payload, v_event_hash
  );

  INSERT INTO audit_logs (
    actor_id, tenant_id, action, resource_type, resource_id,
    before_hash, after_hash, user_agent, request_id
  ) VALUES (
    v_actor_id, v_order.tenant_id,
    CASE WHEN v_transition = 'mark_sent'
      THEN 'supplier_order_marked_sent'
      ELSE 'supplier_order_tenant_handover_recorded' END,
    'supplier_order', v_order.id::text,
    encode(digest(jsonb_build_object('status', v_order.status)::text, 'sha256'), 'hex'),
    encode(digest(v_event_payload::text, 'sha256'), 'hex'),
    v_user_agent, v_request_id
  );

  RETURN jsonb_build_object(
    'id', v_receipt_id,
    'supplier_order_id', v_order.id,
    'transition', v_transition,
    'from_status', v_order.status,
    'to_status', v_to_status,
    'pack_purpose', v_pack_purpose,
    'event_hash', v_event_hash,
    'created_at', v_now,
    'idempotent_replay', false,
    'tenant_acceptance_claimed', false,
    'physical_handover_verified', false,
    'qa_override', false,
    'activation_override', false
  );
END;
$supplier_order_lifecycle_v1$;

REVOKE ALL ON FUNCTION public.nexid_supplier_order_lifecycle_append_only_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_order_lifecycle_v1_capability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_transition_supplier_order_v1(jsonb) FROM PUBLIC;
