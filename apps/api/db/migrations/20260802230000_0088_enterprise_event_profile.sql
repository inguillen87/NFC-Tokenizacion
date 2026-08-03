-- Enterprise physical-event profile, explainable risk, webhook attempt history,
-- API-key network policy and least-privilege role catalog.
--
-- This migration does not alter SUN/SDM verification, NFC batch keys, Polygon
-- custody or IOTA proof semantics. It also does not claim a native Cropwise
-- integration: the Cropwise profile is an approval-gated mapping template.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $membership_role_preflight$
DECLARE
  v_role text;
BEGIN
  IF current_setting('server_version_num')::integer < 120000 THEN
    RAISE EXCEPTION USING
      ERRCODE = '0A000',
      MESSAGE = 'enterprise_event_profile_requires_postgresql_12_or_newer';
  END IF;
  IF to_regtype('public.membership_role') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42704',
      MESSAGE = 'enterprise_event_profile_requires_public_membership_role';
  END IF;

  FOREACH v_role IN ARRAY ARRAY[
    'tenant_owner',
    'security_analyst',
    'operations_manager',
    'packaging_operator',
    'marketing_manager',
    'reseller_admin',
    'api_integration',
    'security_operator'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum enum_row
      JOIN pg_type enum_type ON enum_type.oid = enum_row.enumtypid
      JOIN pg_namespace enum_namespace ON enum_namespace.oid = enum_type.typnamespace
      WHERE enum_type.typname = 'membership_role'
        AND enum_namespace.nspname = 'public'
        AND enum_row.enumlabel = v_role
    ) THEN
      EXECUTE format('ALTER TYPE %I.%I ADD VALUE %L', 'public', 'membership_role', v_role);
    END IF;
  END LOOP;
END;
$membership_role_preflight$;

CREATE TABLE IF NOT EXISTS enterprise_role_profiles (
  code text PRIMARY KEY,
  display_name text NOT NULL,
  tenant_bound boolean NOT NULL,
  human_session_allowed boolean NOT NULL DEFAULT true,
  default_permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enterprise_role_profiles_code_check
    CHECK (code IN (
      'tenant_owner', 'tenant_admin', 'security_analyst', 'operations_manager',
      'packaging_operator', 'marketing_manager', 'viewer', 'reseller_admin',
      'api_integration', 'super_admin', 'security_operator'
    )),
  CONSTRAINT enterprise_role_profiles_permissions_check
    CHECK (jsonb_typeof(default_permissions) = 'array')
);

INSERT INTO enterprise_role_profiles (
  code, display_name, tenant_bound, human_session_allowed, default_permissions
) VALUES
  ('tenant_owner', 'Tenant owner', true, true, '["supplier_order.create","batch.keys.generate","supplier_pack.export","manifest.import","packaging_lab.manage","qa.approve","batch.activate","risk_rules.write","webhooks.manage","proofs.anchor","audit.read","reports.export"]'),
  ('tenant_admin', 'Tenant admin', true, true, '["supplier_order.create","manifest.import","packaging_lab.manage","qa.approve","batch.activate","webhooks.manage","audit.read","reports.export"]'),
  ('security_analyst', 'Security analyst', true, true, '["audit.read","reports.export"]'),
  ('operations_manager', 'Operations manager', true, true, '["supplier_order.create","manifest.import","packaging_lab.manage","qa.approve","batch.activate","reports.export"]'),
  ('packaging_operator', 'Packaging operator', true, true, '["packaging_lab.manage","manifest.import","reports.export"]'),
  ('marketing_manager', 'Marketing manager', true, true, '["reports.export"]'),
  ('viewer', 'Viewer', true, true, '[]'),
  ('reseller_admin', 'Reseller admin', true, true, '["supplier_order.create","manifest.import","reports.export"]'),
  ('api_integration', 'API integration service account', true, false, '["webhooks.manage"]'),
  ('super_admin', 'Super admin', false, true, '["supplier_order.create","batch.keys.generate","supplier_pack.export","manifest.import","packaging_lab.manage","qa.approve","batch.activate","risk_rules.write","webhooks.manage","proofs.anchor","audit.read","reports.export"]'),
  ('security_operator', 'Security operator', true, true, '["risk_rules.write","webhooks.manage","proofs.anchor","audit.read","reports.export"]')
ON CONFLICT (code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  tenant_bound = EXCLUDED.tenant_bound,
  human_session_allowed = EXCLUDED.human_session_allowed,
  default_permissions = EXCLUDED.default_permissions,
  active = true,
  updated_at = now();

CREATE TABLE IF NOT EXISTS enterprise_connector_profiles (
  code text PRIMARY KEY,
  display_name text NOT NULL,
  event_version text NOT NULL,
  delivery_mode text NOT NULL,
  native_integration boolean NOT NULL DEFAULT false,
  approval_status text NOT NULL DEFAULT 'template_only',
  schema_json jsonb NOT NULL,
  claim_text text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enterprise_connector_profiles_code_check
    CHECK (code ~ '^[a-z][a-z0-9_]{2,79}$'),
  CONSTRAINT enterprise_connector_profiles_event_version_check
    CHECK (event_version ~ '^[0-9]+\.[0-9]+$'),
  CONSTRAINT enterprise_connector_profiles_delivery_check
    CHECK (delivery_mode = 'signed_webhook'),
  CONSTRAINT enterprise_connector_profiles_approval_check
    CHECK (approval_status IN ('template_only', 'contract_approved', 'production_enabled')),
  CONSTRAINT enterprise_connector_profiles_schema_check
    CHECK (jsonb_typeof(schema_json) = 'object'),
  CONSTRAINT enterprise_connector_profiles_native_claim_check
    CHECK (native_integration = false OR approval_status = 'production_enabled')
);

INSERT INTO enterprise_connector_profiles (
  code, display_name, event_version, delivery_mode, native_integration,
  approval_status, schema_json, claim_text
) VALUES (
  'cropwise_physical_product_event',
  'Cropwise-ready physical product event',
  '1.0',
  'signed_webhook',
  false,
  'template_only',
  '{
    "required":["event_id","event_version","event_type","occurred_at","tenant_id","request_id"],
    "optional":["product_id","sku","batch_id","lot_number","uid_hash","auth_status","tamper_status","replay_status","risk_score","distributor_id","campaign_id","approximate_location","consent_flags"],
    "uid_policy":"sha256_only",
    "pii_policy":"no_raw_uid_no_precise_location_without_consent"
  }'::jsonb,
  'Generic event mapping template. This is not a native, contracted or production-approved Cropwise integration.'
)
ON CONFLICT (code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  event_version = EXCLUDED.event_version,
  delivery_mode = EXCLUDED.delivery_mode,
  native_integration = EXCLUDED.native_integration,
  approval_status = EXCLUDED.approval_status,
  schema_json = EXCLUDED.schema_json,
  claim_text = EXCLUDED.claim_text,
  active = true,
  updated_at = now();

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS risk_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS triggered_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recommended_action text NOT NULL DEFAULT 'ALLOW_WITH_STANDARD_MONITORING';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.events'::regclass
      AND conname = 'events_explainable_risk_score_check'
  ) THEN
    ALTER TABLE events ADD CONSTRAINT events_explainable_risk_score_check
      CHECK (risk_score BETWEEN 0 AND 100) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.events'::regclass
      AND conname = 'events_explainable_risk_rules_check'
  ) THEN
    ALTER TABLE events ADD CONSTRAINT events_explainable_risk_rules_check
      CHECK (jsonb_typeof(triggered_rules) = 'array') NOT VALID;
  END IF;
END;
$$;

ALTER TABLE events
  VALIDATE CONSTRAINT events_explainable_risk_score_check,
  VALIDATE CONSTRAINT events_explainable_risk_rules_check;

CREATE OR REPLACE FUNCTION public.nexid_explain_event_risk_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_signal text := upper(concat_ws(' ', NEW.event_type::text, NEW.verdict, NEW.result, NEW.reason));
  v_rules jsonb := '[]'::jsonb;
  v_score integer := 0;
  v_meta jsonb := COALESCE(NEW.meta, '{}'::jsonb);
  v_batch_quarantined boolean := false;
BEGIN
  IF NEW.batch_id IS NOT NULL THEN
    SELECT lower(COALESCE(batch.status::text, '')) = 'quarantined'
    INTO v_batch_quarantined
    FROM batches batch
    WHERE batch.id = NEW.batch_id
      AND batch.tenant_id = NEW.tenant_id;
  END IF;

  IF v_signal ~ '(INVALID|CMAC_FAIL|CMAC_INVALID|SUN_PROFILE_MISMATCH|CRYPTO_FAIL)' THEN
    v_rules := v_rules || '"INVALID_SUN_OR_CMAC"'::jsonb; v_score := GREATEST(v_score, 90);
  END IF;
  IF v_signal ~ '(REPLAY|DUPLICATE_URL|COPIED_URL)' THEN
    v_rules := v_rules || '"REPLAY_SUSPECT"'::jsonb; v_score := GREATEST(v_score, 85);
  END IF;
  IF v_signal ~ '(NOT_REGISTERED|UNKNOWN_UID)' THEN
    v_rules := v_rules || '"UID_NOT_REGISTERED"'::jsonb; v_score := GREATEST(v_score, 70);
  END IF;
  IF v_signal ~ '(NOT_ACTIVE|REVOKED|BROKEN)' THEN
    v_rules := v_rules || '"TAG_INACTIVE_OR_REVOKED"'::jsonb; v_score := GREATEST(v_score, 95);
  END IF;
  IF lower(COALESCE(v_meta->>'excessive_scan_frequency', '')) = 'true' THEN
    v_rules := v_rules || '"EXCESSIVE_SCAN_FREQUENCY"'::jsonb; v_score := LEAST(100, v_score + 35);
  END IF;
  IF lower(COALESCE(v_meta->>'geo_anomaly', '')) = 'true'
     OR lower(COALESCE(v_meta->>'impossible_travel', '')) = 'true' THEN
    v_rules := v_rules || '"IMPOSSIBLE_TRAVEL_OR_GEO_ANOMALY"'::jsonb; v_score := LEAST(100, v_score + 55);
  END IF;
  IF lower(COALESCE(v_meta->>'distributor_mismatch', '')) = 'true'
     OR lower(COALESCE(v_meta->>'region_mismatch', '')) = 'true' THEN
    v_rules := v_rules || '"DISTRIBUTOR_OR_REGION_MISMATCH"'::jsonb; v_score := LEAST(100, v_score + 45);
  END IF;
  IF v_signal ~ '(OPENED|TAMPER)'
     AND lower(COALESCE(v_meta->>'before_expected_sale_stage', '')) = 'true' THEN
    v_rules := v_rules || '"TAMPER_BEFORE_EXPECTED_SALE_STAGE"'::jsonb; v_score := LEAST(100, v_score + 65);
  END IF;
  IF lower(COALESCE(v_meta->>'repeated_ownership_attempts', '')) = 'true' THEN
    v_rules := v_rules || '"REPEATED_OWNERSHIP_ATTEMPTS"'::jsonb; v_score := LEAST(100, v_score + 50);
  END IF;
  IF lower(COALESCE(v_meta->>'unexpected_device', '')) = 'true'
     OR lower(COALESCE(v_meta->>'unexpected_network', '')) = 'true' THEN
    v_rules := v_rules || '"UNEXPECTED_DEVICE_OR_NETWORK"'::jsonb; v_score := LEAST(100, v_score + 35);
  END IF;
  IF v_batch_quarantined OR lower(COALESCE(v_meta->>'batch_quarantined', '')) = 'true' THEN
    v_rules := v_rules || '"BATCH_QUARANTINED"'::jsonb; v_score := 100;
  END IF;

  NEW.risk_score := LEAST(100, GREATEST(COALESCE(NEW.risk_score, 0), v_score));
  NEW.triggered_rules := CASE WHEN jsonb_array_length(v_rules) > 0 THEN v_rules ELSE COALESCE(NEW.triggered_rules, '[]'::jsonb) END;
  NEW.risk_level := CASE
    WHEN NEW.risk_score >= 80 THEN 'critical'::risk_level
    WHEN NEW.risk_score >= 50 THEN 'high'::risk_level
    WHEN NEW.risk_score >= 25 THEN 'medium'::risk_level
    WHEN NEW.risk_score > 0 THEN 'low'::risk_level
    ELSE COALESCE(NEW.risk_level, 'none'::risk_level)
  END;
  NEW.recommended_action := CASE
    WHEN v_rules ?| ARRAY['BATCH_QUARANTINED', 'TAG_INACTIVE_OR_REVOKED']
      THEN 'BLOCK_AND_ESCALATE_TO_TENANT_SECURITY'
    WHEN NEW.risk_score >= 80 THEN 'BLOCK_SENSITIVE_ACTIONS_AND_OPEN_INCIDENT'
    WHEN NEW.risk_score >= 50 THEN 'REQUIRE_PHYSICAL_RESCAN_AND_SECURITY_REVIEW'
    WHEN NEW.risk_score >= 25 THEN 'MONITOR_AND_REQUEST_OPERATOR_CONTEXT'
    ELSE 'ALLOW_WITH_STANDARD_MONITORING'
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_explainable_risk_v1 ON events;
CREATE TRIGGER trg_events_explainable_risk_v1
BEFORE INSERT OR UPDATE OF event_type, verdict, result, reason, meta, batch_id ON events
FOR EACH ROW EXECUTE FUNCTION public.nexid_explain_event_risk_v1();

ALTER TABLE sdk_external_events
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS outbound_event_version text NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS connector_profile_code text REFERENCES enterprise_connector_profiles(code) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS product_id text,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS lot_number text,
  ADD COLUMN IF NOT EXISTS auth_status text,
  ADD COLUMN IF NOT EXISTS tamper_status text,
  ADD COLUMN IF NOT EXISTS replay_status text,
  ADD COLUMN IF NOT EXISTS distributor_id text,
  ADD COLUMN IF NOT EXISTS campaign_id text,
  ADD COLUMN IF NOT EXISTS approximate_location jsonb,
  ADD COLUMN IF NOT EXISTS consent_flags jsonb,
  ADD COLUMN IF NOT EXISTS risk_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'LOW',
  ADD COLUMN IF NOT EXISTS triggered_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recommended_action text NOT NULL DEFAULT 'ALLOW_WITH_STANDARD_MONITORING';

ALTER TABLE sdk_external_events
  DROP CONSTRAINT IF EXISTS sdk_external_events_request_id_check,
  DROP CONSTRAINT IF EXISTS sdk_external_events_outbound_version_check,
  DROP CONSTRAINT IF EXISTS sdk_external_events_risk_score_check,
  DROP CONSTRAINT IF EXISTS sdk_external_events_risk_level_check,
  DROP CONSTRAINT IF EXISTS sdk_external_events_triggered_rules_check,
  DROP CONSTRAINT IF EXISTS sdk_external_events_approximate_location_check,
  DROP CONSTRAINT IF EXISTS sdk_external_events_consent_flags_check;

ALTER TABLE sdk_external_events
  ADD CONSTRAINT sdk_external_events_request_id_check
    CHECK (request_id IS NULL OR char_length(request_id) BETWEEN 1 AND 256),
  ADD CONSTRAINT sdk_external_events_outbound_version_check
    CHECK (outbound_event_version = '1.0'),
  ADD CONSTRAINT sdk_external_events_risk_score_check
    CHECK (risk_score BETWEEN 0 AND 100),
  ADD CONSTRAINT sdk_external_events_risk_level_check
    CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  ADD CONSTRAINT sdk_external_events_triggered_rules_check
    CHECK (jsonb_typeof(triggered_rules) = 'array'),
  ADD CONSTRAINT sdk_external_events_approximate_location_check
    CHECK (approximate_location IS NULL OR jsonb_typeof(approximate_location) = 'object'),
  ADD CONSTRAINT sdk_external_events_consent_flags_check
    CHECK (consent_flags IS NULL OR jsonb_typeof(consent_flags) = 'object');

CREATE INDEX IF NOT EXISTS idx_sdk_external_events_enterprise_risk
  ON sdk_external_events(tenant_id, risk_level, risk_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sdk_external_events_enterprise_filters
  ON sdk_external_events(tenant_id, sku, lot_number, distributor_id, created_at DESC);

ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS manual_replay_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attempt_cycle_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_manual_replayed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_manual_replayed_by uuid REFERENCES users(id) ON DELETE SET NULL;

UPDATE webhook_deliveries
SET attempt_cycle_count = attempt_count
WHERE manual_replay_count = 0
  AND attempt_cycle_count = 0
  AND attempt_count > 0;

ALTER TABLE webhook_deliveries
  DROP CONSTRAINT IF EXISTS webhook_deliveries_manual_replay_count_check,
  DROP CONSTRAINT IF EXISTS webhook_deliveries_attempt_cycle_count_check;
ALTER TABLE webhook_deliveries
  ADD CONSTRAINT webhook_deliveries_manual_replay_count_check
    CHECK (manual_replay_count BETWEEN 0 AND 1000),
  ADD CONSTRAINT webhook_deliveries_attempt_cycle_count_check
    CHECK (attempt_cycle_count BETWEEN 0 AND 10000);

CREATE TABLE IF NOT EXISTS webhook_delivery_attempts (
  id bigserial PRIMARY KEY,
  delivery_id bigint NOT NULL REFERENCES webhook_deliveries(id) ON DELETE RESTRICT,
  endpoint_id uuid NOT NULL REFERENCES webhook_endpoints(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  attempt_number integer NOT NULL,
  outcome text NOT NULL,
  status_code integer,
  latency_ms integer NOT NULL,
  error_code text,
  request_id text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_delivery_attempts_identity_unique UNIQUE (delivery_id, attempt_number),
  CONSTRAINT webhook_delivery_attempts_endpoint_tenant_fkey
    FOREIGN KEY (endpoint_id, tenant_id) REFERENCES webhook_endpoints(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT webhook_delivery_attempts_attempt_check CHECK (attempt_number BETWEEN 1 AND 10000),
  CONSTRAINT webhook_delivery_attempts_outcome_check CHECK (outcome IN ('delivered', 'retry_scheduled', 'dead_letter', 'lease_lost')),
  CONSTRAINT webhook_delivery_attempts_status_code_check CHECK (status_code IS NULL OR status_code BETWEEN 100 AND 599),
  CONSTRAINT webhook_delivery_attempts_latency_check CHECK (latency_ms BETWEEN 0 AND 600000),
  CONSTRAINT webhook_delivery_attempts_error_code_check CHECK (error_code IS NULL OR char_length(error_code) BETWEEN 1 AND 160),
  CONSTRAINT webhook_delivery_attempts_request_id_check CHECK (char_length(request_id) BETWEEN 1 AND 256),
  CONSTRAINT webhook_delivery_attempts_time_check CHECK (completed_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_attempts_tenant_created
  ON webhook_delivery_attempts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_attempts_delivery
  ON webhook_delivery_attempts(delivery_id, attempt_number DESC);

CREATE TABLE IF NOT EXISTS webhook_delivery_replay_receipts (
  id bigserial PRIMARY KEY,
  operation_id uuid NOT NULL UNIQUE,
  delivery_id bigint NOT NULL REFERENCES webhook_deliveries(id) ON DELETE RESTRICT,
  endpoint_id uuid NOT NULL REFERENCES webhook_endpoints(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  prior_attempt_count integer NOT NULL,
  reason text NOT NULL,
  request_id text NOT NULL,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_delivery_replay_endpoint_tenant_fkey
    FOREIGN KEY (endpoint_id, tenant_id) REFERENCES webhook_endpoints(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT webhook_delivery_replay_reason_check CHECK (char_length(reason) BETWEEN 10 AND 500),
  CONSTRAINT webhook_delivery_replay_idempotency_check
    CHECK (char_length(idempotency_key) BETWEEN 8 AND 255 AND idempotency_key !~ '[[:cntrl:]]'),
  CONSTRAINT webhook_delivery_replay_request_id_check CHECK (char_length(request_id) BETWEEN 1 AND 160),
  CONSTRAINT webhook_delivery_replay_user_agent_check CHECK (user_agent IS NULL OR char_length(user_agent) <= 512)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_delivery_replay_idempotency
  ON webhook_delivery_replay_receipts(tenant_id, delivery_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_replay_tenant_created
  ON webhook_delivery_replay_receipts(tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.nexid_reject_enterprise_append_only_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = TG_TABLE_NAME || '_append_only';
END;
$$;

DROP TRIGGER IF EXISTS trg_webhook_delivery_attempts_append_only ON webhook_delivery_attempts;
CREATE TRIGGER trg_webhook_delivery_attempts_append_only
BEFORE UPDATE OR DELETE ON webhook_delivery_attempts
FOR EACH ROW EXECUTE FUNCTION public.nexid_reject_enterprise_append_only_mutation_v1();

DROP TRIGGER IF EXISTS trg_webhook_delivery_replays_append_only ON webhook_delivery_replay_receipts;
CREATE TRIGGER trg_webhook_delivery_replays_append_only
BEFORE UPDATE OR DELETE ON webhook_delivery_replay_receipts
FOR EACH ROW EXECUTE FUNCTION public.nexid_reject_enterprise_append_only_mutation_v1();

DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON audit_logs;
CREATE TRIGGER trg_audit_logs_append_only
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION public.nexid_reject_enterprise_append_only_mutation_v1();

ALTER TABLE tenant_api_keys
  ADD COLUMN IF NOT EXISTS allowed_ip_cidrs cidr[] NOT NULL DEFAULT ARRAY[]::cidr[],
  ADD COLUMN IF NOT EXISTS allowed_origins text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS rate_limit_profile text NOT NULL DEFAULT 'standard';

ALTER TABLE tenant_api_keys
  DROP CONSTRAINT IF EXISTS tenant_api_keys_allowed_ip_count_check,
  DROP CONSTRAINT IF EXISTS tenant_api_keys_allowed_origin_count_check,
  DROP CONSTRAINT IF EXISTS tenant_api_keys_rate_limit_profile_check;

ALTER TABLE tenant_api_keys
  ADD CONSTRAINT tenant_api_keys_allowed_ip_count_check CHECK (cardinality(allowed_ip_cidrs) <= 64),
  ADD CONSTRAINT tenant_api_keys_allowed_origin_count_check CHECK (cardinality(allowed_origins) <= 64),
  ADD CONSTRAINT tenant_api_keys_rate_limit_profile_check
    CHECK (rate_limit_profile IN ('conservative', 'standard', 'high_throughput'));

CREATE TABLE IF NOT EXISTS tenant_api_key_policy_receipts (
  id bigserial PRIMARY KEY,
  operation_id uuid NOT NULL UNIQUE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  api_key_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  allowed_ip_cidrs cidr[] NOT NULL,
  allowed_origins text[] NOT NULL,
  rate_limit_profile text NOT NULL,
  request_fingerprint text NOT NULL,
  request_id text NOT NULL,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_api_key_policy_key_tenant_fkey
    FOREIGN KEY (api_key_id, tenant_id) REFERENCES tenant_api_keys(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT tenant_api_key_policy_ip_count_check CHECK (cardinality(allowed_ip_cidrs) <= 64),
  CONSTRAINT tenant_api_key_policy_origin_count_check CHECK (cardinality(allowed_origins) <= 64),
  CONSTRAINT tenant_api_key_policy_rate_profile_check
    CHECK (rate_limit_profile IN ('conservative', 'standard', 'high_throughput')),
  CONSTRAINT tenant_api_key_policy_fingerprint_check
    CHECK (request_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT tenant_api_key_policy_request_id_check
    CHECK (char_length(request_id) BETWEEN 1 AND 160),
  CONSTRAINT tenant_api_key_policy_user_agent_check
    CHECK (user_agent IS NULL OR char_length(user_agent) <= 512)
);

CREATE INDEX IF NOT EXISTS idx_tenant_api_key_policy_receipts_tenant_created
  ON tenant_api_key_policy_receipts(tenant_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_tenant_api_key_policy_receipts_append_only ON tenant_api_key_policy_receipts;
CREATE TRIGGER trg_tenant_api_key_policy_receipts_append_only
BEFORE UPDATE OR DELETE ON tenant_api_key_policy_receipts
FOR EACH ROW EXECUTE FUNCTION public.nexid_reject_enterprise_append_only_mutation_v1();

CREATE OR REPLACE FUNCTION public.nexid_tenant_api_key_lifecycle_v1_capability()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'schema_version', 'tenant-api-key-lifecycle/v2',
    'status_values', jsonb_build_array('active', 'revoked'),
    'quota_serialization', 'tenant_advisory_lock',
    'receipts', 'append_only',
    'raw_secret_persisted', false,
    'key_hash_in_receipts', false,
    'allowed_ip_cidrs', true,
    'allowed_origins', true,
    'rate_limit_profiles', jsonb_build_array('conservative', 'standard', 'high_throughput'),
    'network_policy_rotation', 'create_new_key_then_revoke_old'
  );
$$;

CREATE OR REPLACE FUNCTION public.nexid_create_tenant_api_key_v2(p_input jsonb)
RETURNS TABLE (
  outcome text,
  id uuid,
  name text,
  key_prefix text,
  scopes jsonb,
  status text,
  expires_at timestamptz,
  created_at timestamptz,
  active_count integer,
  receipt_id bigint,
  allowed_ip_cidrs cidr[],
  allowed_origins text[],
  rate_limit_profile text
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_created record;
  v_allowed_ips cidr[] := ARRAY[]::cidr[];
  v_allowed_origins text[] := ARRAY[]::text[];
  v_rate_profile text := lower(btrim(COALESCE(p_input->>'rate_limit_profile', 'standard')));
  v_policy_operation_id uuid := uuid_generate_v4();
  v_actor_id uuid;
  v_request_id text;
  v_ip_address inet;
  v_user_agent text;
  v_previous_writer text := current_setting('nexid.tenant_api_key_lifecycle_writer_v1', true);
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'tenant_api_key_input_invalid';
  END IF;
  IF COALESCE(p_input->'allowed_ip_cidrs', '[]'::jsonb) IS NULL
     OR jsonb_typeof(COALESCE(p_input->'allowed_ip_cidrs', '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_input->'allowed_ip_cidrs', '[]'::jsonb)) > 64
     OR COALESCE(p_input->'allowed_origins', '[]'::jsonb) IS NULL
     OR jsonb_typeof(COALESCE(p_input->'allowed_origins', '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_input->'allowed_origins', '[]'::jsonb)) > 64
     OR v_rate_profile NOT IN ('conservative', 'standard', 'high_throughput') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'tenant_api_key_network_policy_invalid';
  END IF;

  BEGIN
    SELECT COALESCE(array_agg(DISTINCT value::cidr ORDER BY value::cidr), ARRAY[]::cidr[])
    INTO v_allowed_ips
    FROM jsonb_array_elements_text(COALESCE(p_input->'allowed_ip_cidrs', '[]'::jsonb)) item(value);
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'tenant_api_key_allowed_ip_invalid';
  END;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(COALESCE(p_input->'allowed_origins', '[]'::jsonb)) item(value)
    WHERE value !~ '^https://[A-Za-z0-9.-]+(?::[0-9]{1,5})?$'
       OR char_length(value) > 253
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'tenant_api_key_allowed_origin_invalid';
  END IF;
  SELECT COALESCE(array_agg(DISTINCT lower(value) ORDER BY lower(value)), ARRAY[]::text[])
  INTO v_allowed_origins
  FROM jsonb_array_elements_text(COALESCE(p_input->'allowed_origins', '[]'::jsonb)) item(value);

  BEGIN
    v_actor_id := NULLIF(p_input->>'actor_id', '')::uuid;
    v_request_id := NULLIF(left(btrim(COALESCE(p_input->>'request_id', '')), 160), '');
    v_user_agent := NULLIF(left(COALESCE(p_input->>'user_agent', ''), 512), '');
    IF NULLIF(btrim(COALESCE(p_input->>'ip_address', '')), '') IS NOT NULL THEN
      v_ip_address := (p_input->>'ip_address')::inet;
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'tenant_api_key_network_policy_audit_invalid';
  END;
  IF v_actor_id IS NULL OR v_request_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'tenant_api_key_network_policy_audit_invalid';
  END IF;

  SELECT * INTO v_created
  FROM public.nexid_create_tenant_api_key_v1(p_input);
  IF v_created.outcome IS DISTINCT FROM 'created' OR v_created.id IS NULL THEN
    RETURN QUERY SELECT v_created.outcome, v_created.id, v_created.name, v_created.key_prefix,
      v_created.scopes, v_created.status, v_created.expires_at, v_created.created_at,
      v_created.active_count, v_created.receipt_id,
      ARRAY[]::cidr[], ARRAY[]::text[], v_rate_profile;
    RETURN;
  END IF;

  PERFORM set_config('nexid.tenant_api_key_lifecycle_writer_v1', 'on', true);
  UPDATE tenant_api_keys api_key
  SET allowed_ip_cidrs = v_allowed_ips,
      allowed_origins = v_allowed_origins,
      rate_limit_profile = v_rate_profile
  WHERE api_key.id = v_created.id;

  INSERT INTO tenant_api_key_policy_receipts (
    operation_id, tenant_id, api_key_id, actor_id, allowed_ip_cidrs,
    allowed_origins, rate_limit_profile, request_fingerprint, request_id,
    ip_address, user_agent
  ) VALUES (
    v_policy_operation_id,
    (p_input->>'tenant_id')::uuid,
    v_created.id,
    v_actor_id,
    v_allowed_ips,
    v_allowed_origins,
    v_rate_profile,
    'sha256:' || encode(digest(jsonb_build_object(
      'operation_id', v_policy_operation_id,
      'tenant_id', p_input->>'tenant_id',
      'api_key_id', v_created.id,
      'allowed_ip_cidrs', to_jsonb(v_allowed_ips),
      'allowed_origins', to_jsonb(v_allowed_origins),
      'rate_limit_profile', v_rate_profile
    )::text, 'sha256'), 'hex'),
    v_request_id,
    v_ip_address,
    v_user_agent
  );
  PERFORM set_config('nexid.tenant_api_key_lifecycle_writer_v1', COALESCE(v_previous_writer, ''), true);

  RETURN QUERY SELECT v_created.outcome, v_created.id, v_created.name, v_created.key_prefix,
    v_created.scopes, v_created.status, v_created.expires_at, v_created.created_at,
    v_created.active_count, v_created.receipt_id,
    v_allowed_ips, v_allowed_origins, v_rate_profile;
END;
$$;

-- Replace the v1 SDK writer with a backward-compatible return contract and a
-- canonical, secret-free outbound event. Raw UID remains in the internal
-- business row because existing NFC resolution depends on it; webhook payloads
-- receive only its SHA-256 digest.
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
  v_request_id text := NULLIF(left(btrim(COALESCE(p_input->>'trace_id', '')), 256), '');
  v_occurred_at timestamptz;
  v_data jsonb := COALESCE(p_input->'data', '{}'::jsonb);
  v_outbound jsonb := COALESCE(p_input->'outbound', '{}'::jsonb);
  v_product_id text;
  v_sku text;
  v_lot_number text;
  v_auth_status text;
  v_tamper_status text;
  v_replay_status text;
  v_distributor_id text;
  v_campaign_id text;
  v_approximate_location jsonb;
  v_consent_flags jsonb;
  v_connector_profile_code text;
  v_risk_score integer;
  v_risk_level text;
  v_triggered_rules jsonb;
  v_recommended_action text;
  v_replayed boolean := false;
  v_outbox_event_id text;
  v_attempted integer := 0;
  v_queued integer := 0;
  v_deduplicated integer := 0;
  v_canonical_payload jsonb;
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
     OR v_request_id IS NULL OR v_request_id ~ '[[:cntrl:]]'
     OR (v_bid IS NOT NULL AND (char_length(v_bid) > 160 OR v_bid ~ '[[:cntrl:]]'))
     OR (v_uid_hex IS NOT NULL AND (char_length(v_uid_hex) > 128 OR v_uid_hex ~ '[[:cntrl:]]'))
     OR jsonb_typeof(v_data) <> 'object'
     OR octet_length(v_data::text) > 98304
     OR jsonb_typeof(v_outbound) <> 'object'
     OR octet_length(v_outbound::text) > 32768 THEN
    RAISE EXCEPTION 'sdk_external_event_payload_invalid';
  END IF;
  BEGIN
    v_occurred_at := NULLIF(p_input->>'occurred_at', '')::timestamptz;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'sdk_external_event_occurred_at_invalid';
  END;

  v_product_id := NULLIF(left(btrim(COALESCE(v_outbound->>'product_id', '')), 160), '');
  v_sku := NULLIF(left(btrim(COALESCE(v_outbound->>'sku', '')), 160), '');
  v_lot_number := NULLIF(left(btrim(COALESCE(v_outbound->>'lot_number', '')), 160), '');
  v_auth_status := NULLIF(left(btrim(COALESCE(v_outbound->>'auth_status', '')), 80), '');
  v_tamper_status := NULLIF(left(btrim(COALESCE(v_outbound->>'tamper_status', '')), 80), '');
  v_replay_status := NULLIF(left(btrim(COALESCE(v_outbound->>'replay_status', '')), 80), '');
  v_distributor_id := NULLIF(left(btrim(COALESCE(v_outbound->>'distributor_id', '')), 160), '');
  v_campaign_id := NULLIF(left(btrim(COALESCE(v_outbound->>'campaign_id', '')), 160), '');
  v_approximate_location := v_outbound->'approximate_location';
  v_consent_flags := v_outbound->'consent_flags';
  v_connector_profile_code := NULLIF(left(btrim(COALESCE(v_outbound->>'connector_profile_code', '')), 80), '');
  v_triggered_rules := COALESCE(v_outbound->'triggered_rules', '[]'::jsonb);

  IF COALESCE(v_outbound->>'risk_score', '') !~ '^[0-9]{1,3}$' THEN
    RAISE EXCEPTION 'sdk_external_event_risk_invalid';
  END IF;
  v_risk_score := (v_outbound->>'risk_score')::integer;
  v_risk_level := CASE
    WHEN v_risk_score >= 80 THEN 'CRITICAL'
    WHEN v_risk_score >= 50 THEN 'HIGH'
    WHEN v_risk_score >= 25 THEN 'MEDIUM'
    ELSE 'LOW'
  END;
  v_recommended_action := CASE
    WHEN v_risk_score >= 80 THEN 'BLOCK_SENSITIVE_ACTIONS_AND_OPEN_INCIDENT'
    WHEN v_risk_score >= 50 THEN 'REQUIRE_PHYSICAL_RESCAN_AND_SECURITY_REVIEW'
    WHEN v_risk_score >= 25 THEN 'MONITOR_AND_REQUEST_OPERATOR_CONTEXT'
    ELSE 'ALLOW_WITH_STANDARD_MONITORING'
  END;
  IF v_risk_score NOT BETWEEN 0 AND 100
     OR upper(COALESCE(v_outbound->>'risk_level', '')) IS DISTINCT FROM v_risk_level
     OR COALESCE(v_outbound->>'recommended_action', '') IS DISTINCT FROM v_recommended_action
     OR jsonb_typeof(v_triggered_rules) <> 'array'
     OR jsonb_array_length(v_triggered_rules) > 32
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(v_triggered_rules) AS rule(value)
       WHERE jsonb_typeof(rule.value) <> 'string'
          OR (rule.value #>> '{}') NOT IN (
            'INVALID_SUN_OR_CMAC', 'REPLAY_SUSPECT', 'UID_NOT_REGISTERED',
            'TAG_INACTIVE_OR_REVOKED', 'EXCESSIVE_SCAN_FREQUENCY',
            'IMPOSSIBLE_TRAVEL_OR_GEO_ANOMALY', 'DISTRIBUTOR_OR_REGION_MISMATCH',
            'TAMPER_BEFORE_EXPECTED_SALE_STAGE', 'REPEATED_OWNERSHIP_ATTEMPTS',
            'UNEXPECTED_DEVICE_OR_NETWORK', 'BATCH_QUARANTINED'
          )
     )
     OR (v_approximate_location IS NOT NULL AND jsonb_typeof(v_approximate_location) <> 'object')
     OR (v_consent_flags IS NOT NULL AND jsonb_typeof(v_consent_flags) <> 'object') THEN
    RAISE EXCEPTION 'sdk_external_event_risk_invalid';
  END IF;
  IF v_connector_profile_code IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM enterprise_connector_profiles profile
    WHERE profile.code = v_connector_profile_code AND profile.active = true
  ) THEN
    RAISE EXCEPTION 'sdk_external_event_connector_profile_invalid';
  END IF;

  SELECT api_key.* INTO v_api_key
  FROM public.tenant_api_keys api_key
  WHERE api_key.id = v_api_key_id AND api_key.tenant_id = v_tenant_id
  FOR SHARE;
  IF v_api_key.id IS NULL OR v_api_key.status <> 'active'
     OR (v_api_key.expires_at IS NOT NULL AND v_api_key.expires_at <= now()) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'sdk_external_event_api_key_inactive';
  END IF;
  IF NOT (v_api_key.scopes ? 'sdk:events' OR v_api_key.scopes ? 'sdk:*' OR v_api_key.scopes ? '*') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'sdk_external_event_scope_denied';
  END IF;

  IF v_idempotency_operation_id IS NOT NULL THEN
    SELECT operation.* INTO v_idempotency_operation
    FROM public.sdk_idempotency_operations operation
    WHERE operation.id = v_idempotency_operation_id
      AND operation.tenant_id = v_tenant_id
      AND operation.api_key_id = v_api_key_id
      AND operation.route = '/api/v1/sdk/events'
    FOR UPDATE;
    IF v_idempotency_operation.id IS NULL THEN
      RAISE EXCEPTION 'sdk_external_event_idempotency_scope_invalid';
    END IF;
    SELECT external_event.* INTO v_existing
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
    v_request_id := COALESCE(v_existing.request_id, v_request_id);
    v_replayed := true;

    v_outbox_event_id := 'evt_' || encode(digest(
      convert_to(v_tenant_id::text, 'UTF8') || decode('00', 'hex')
        || convert_to('sdk.external_event', 'UTF8') || decode('00', 'hex')
        || convert_to(v_external_event_id::text, 'UTF8'),
      'sha256'
    ), 'hex');
    SELECT count(*)::integer INTO v_deduplicated
    FROM webhook_deliveries delivery
    JOIN webhook_endpoints endpoint ON endpoint.id = delivery.endpoint_id
    WHERE endpoint.tenant_id = v_tenant_id
      AND delivery.event_id = v_outbox_event_id;
    v_attempted := v_deduplicated;
    v_queued := 0;
  ELSE
    IF v_bid IS NOT NULL THEN
      SELECT batch.id, tag.id,
        COALESCE(v_product_id, NULLIF(tag.product_id, '')),
        COALESCE(v_sku, NULLIF(profile.sku, ''), NULLIF(batch.sku, ''))
      INTO v_batch_id, v_tag_id, v_product_id, v_sku
      FROM public.batches batch
      LEFT JOIN LATERAL (
        SELECT candidate.id, candidate.product_id
        FROM public.tags candidate
        WHERE candidate.batch_id = batch.id
          AND (v_uid_hex IS NULL OR upper(candidate.uid_hex) = v_uid_hex)
        ORDER BY candidate.created_at ASC, candidate.id ASC
        LIMIT 1
      ) tag ON v_uid_hex IS NOT NULL
      LEFT JOIN public.tag_profiles profile ON profile.tag_id = tag.id
      WHERE batch.tenant_id = v_tenant_id AND batch.bid = v_bid
      LIMIT 1
      FOR SHARE OF batch;
      IF v_batch_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'sdk_external_event_batch_not_found_for_tenant';
      END IF;
    END IF;

    INSERT INTO public.sdk_external_events (
      tenant_id, api_key_id, batch_id, tag_id, bid, uid_hex, event_type,
      source, occurred_at, data, idempotency_operation_id, request_id,
      outbound_event_version, connector_profile_code, product_id, sku,
      lot_number, auth_status, tamper_status, replay_status, distributor_id,
      campaign_id, approximate_location, consent_flags, risk_score, risk_level,
      triggered_rules, recommended_action
    ) VALUES (
      v_tenant_id, v_api_key_id, v_batch_id, v_tag_id, v_bid, v_uid_hex,
      v_event_type, v_source, v_occurred_at, v_data, v_idempotency_operation_id,
      v_request_id, '1.0', v_connector_profile_code, v_product_id, v_sku,
      v_lot_number, v_auth_status, v_tamper_status, v_replay_status,
      v_distributor_id, v_campaign_id, v_approximate_location, v_consent_flags,
      v_risk_score, v_risk_level, v_triggered_rules, v_recommended_action
    ) RETURNING id, created_at INTO v_external_event_id, v_created_at;

    v_canonical_payload := jsonb_strip_nulls(jsonb_build_object(
      'event_id', v_external_event_id::text,
      'event_version', '1.0',
      'event_type', v_event_type,
      'occurred_at', COALESCE(v_occurred_at, v_created_at),
      'tenant_id', v_tenant_id::text,
      'product_id', v_product_id,
      'sku', v_sku,
      'batch_id', v_batch_id::text,
      'lot_number', v_lot_number,
      'uid_hash', CASE WHEN v_uid_hex IS NULL THEN NULL ELSE 'sha256:' || encode(digest(v_uid_hex, 'sha256'), 'hex') END,
      'auth_status', v_auth_status,
      'tamper_status', v_tamper_status,
      'replay_status', v_replay_status,
      'risk_score', v_risk_score,
      'risk_level', v_risk_level,
      'triggered_rules', v_triggered_rules,
      'recommended_action', v_recommended_action,
      'distributor_id', v_distributor_id,
      'campaign_id', v_campaign_id,
      'approximate_location', v_approximate_location,
      'consent_flags', v_consent_flags,
      'request_id', v_request_id,
      'connector_profile_code', v_connector_profile_code
    ));

    SELECT receipt.outbox_event_id, receipt.webhook_attempted,
      receipt.webhook_queued, receipt.webhook_deduplicated
    INTO v_outbox_event_id, v_attempted, v_queued, v_deduplicated
    FROM public.nexid_enqueue_tenant_webhook_outbox_v1(
      v_tenant_id, 'sdk.external_event', v_external_event_id::text,
      v_canonical_payload, v_created_at
    ) receipt;
  END IF;

  IF v_outbox_event_id IS NULL OR v_attempted <> v_queued + v_deduplicated THEN
    RAISE EXCEPTION 'sdk_external_event_outbox_receipt_unconfirmed';
  END IF;
  RETURN QUERY SELECT v_external_event_id, v_created_at, v_tenant_id,
    v_batch_id, v_tag_id, v_bid, v_uid_hex, v_event_type, v_source, v_replayed,
    v_outbox_event_id, v_attempted, v_queued, v_deduplicated;
END;
$$;

COMMENT ON FUNCTION public.nexid_write_sdk_external_event_v1(jsonb)
  IS 'Atomically persists an SDK event and emits canonical secret-free tenant webhook data; raw NFC UID remains internal.';

CREATE OR REPLACE FUNCTION public.nexid_replay_webhook_delivery_v1(p_input jsonb)
RETURNS TABLE (
  outcome text,
  delivery_id bigint,
  delivery_status text,
  manual_replay_count integer,
  receipt_id bigint,
  idempotent_replay boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_actor_id uuid;
  v_delivery_id bigint;
  v_operation_id uuid;
  v_reason text := btrim(COALESCE(p_input->>'reason', ''));
  v_request_id text := NULLIF(left(btrim(COALESCE(p_input->>'request_id', '')), 160), '');
  v_idempotency_key text := btrim(COALESCE(p_input->>'idempotency_key', ''));
  v_ip_address inet;
  v_user_agent text := NULLIF(left(COALESCE(p_input->>'user_agent', ''), 512), '');
  v_delivery record;
  v_existing_receipt webhook_delivery_replay_receipts%ROWTYPE;
  v_receipt_id bigint;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object'
     OR COALESCE(p_input->>'delivery_id', '') !~ '^[1-9][0-9]{0,18}$'
     OR COALESCE(p_input->>'tenant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR COALESCE(p_input->>'actor_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR COALESCE(p_input->>'operation_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR char_length(v_reason) NOT BETWEEN 10 AND 500
     OR v_request_id IS NULL
     OR char_length(v_idempotency_key) NOT BETWEEN 8 AND 255
     OR v_idempotency_key ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'webhook_delivery_replay_input_invalid';
  END IF;
  BEGIN
    v_tenant_id := (p_input->>'tenant_id')::uuid;
    v_actor_id := (p_input->>'actor_id')::uuid;
    v_operation_id := (p_input->>'operation_id')::uuid;
    v_delivery_id := (p_input->>'delivery_id')::bigint;
    IF NULLIF(btrim(COALESCE(p_input->>'ip_address', '')), '') IS NOT NULL THEN
      v_ip_address := (p_input->>'ip_address')::inet;
    END IF;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'webhook_delivery_replay_input_invalid';
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM users actor
    JOIN memberships membership ON membership.user_id = actor.id
    WHERE actor.id = v_actor_id
      AND (
        membership.role::text = 'super_admin'
        OR membership.tenant_id = v_tenant_id
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'webhook_delivery_replay_actor_denied';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'webhook-replay:' || v_tenant_id::text || ':' || v_delivery_id::text || ':' || v_idempotency_key,
    0
  ));
  SELECT receipt.* INTO v_existing_receipt
  FROM webhook_delivery_replay_receipts receipt
  WHERE receipt.tenant_id = v_tenant_id
    AND receipt.delivery_id = v_delivery_id
    AND receipt.idempotency_key = v_idempotency_key;
  IF v_existing_receipt.id IS NOT NULL THEN
    RETURN QUERY
    SELECT 'replayed', delivery.id, delivery.status, delivery.manual_replay_count,
      v_existing_receipt.id, true
    FROM webhook_deliveries delivery
    WHERE delivery.id = v_delivery_id;
    RETURN;
  END IF;

  SELECT delivery.*, endpoint.tenant_id AS endpoint_tenant_id,
    endpoint.url AS current_endpoint_url,
    endpoint.destination_version AS current_destination_version,
    endpoint.enabled AS endpoint_enabled,
    endpoint.deleted_at AS endpoint_deleted_at
  INTO v_delivery
  FROM webhook_deliveries delivery
  JOIN webhook_endpoints endpoint ON endpoint.id = delivery.endpoint_id
  WHERE delivery.id = v_delivery_id
    AND endpoint.tenant_id = v_tenant_id
  FOR UPDATE OF delivery, endpoint;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'webhook_delivery_not_found';
  END IF;
  IF v_delivery.status <> 'dead_letter' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'webhook_delivery_not_replayable';
  END IF;
  IF v_delivery.endpoint_enabled IS DISTINCT FROM true
     OR v_delivery.endpoint_deleted_at IS NOT NULL
     OR v_delivery.endpoint_url IS DISTINCT FROM v_delivery.current_endpoint_url
     OR v_delivery.destination_version IS DISTINCT FROM v_delivery.current_destination_version THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'webhook_delivery_destination_not_current';
  END IF;

  UPDATE webhook_deliveries delivery
  SET status = 'pending',
      ok = false,
      status_code = NULL,
      next_attempt_at = now(),
      last_error = NULL,
      delivered_at = NULL,
      locked_at = NULL,
      lock_token = NULL,
      attempt_cycle_count = 0,
      manual_replay_count = delivery.manual_replay_count + 1,
      last_manual_replayed_at = now(),
      last_manual_replayed_by = v_actor_id
  WHERE delivery.id = v_delivery_id;

  INSERT INTO webhook_delivery_replay_receipts (
    operation_id, delivery_id, endpoint_id, tenant_id, actor_id,
    idempotency_key, prior_attempt_count, reason, request_id, ip_address, user_agent
  ) VALUES (
    v_operation_id, v_delivery_id, v_delivery.endpoint_id, v_tenant_id, v_actor_id,
    v_idempotency_key, v_delivery.attempt_count, v_reason, v_request_id,
    v_ip_address, v_user_agent
  ) RETURNING id INTO v_receipt_id;

  INSERT INTO audit_logs (
    actor_id, tenant_id, action, resource_type, resource_id,
    before_hash, after_hash, ip_address, user_agent, request_id
  ) VALUES (
    v_actor_id, v_tenant_id, 'webhook_delivery_replayed',
    'webhook_delivery', v_delivery_id::text,
    encode(digest(jsonb_build_object(
      'status', v_delivery.status,
      'attempt_count', v_delivery.attempt_count,
      'manual_replay_count', v_delivery.manual_replay_count
    )::text, 'sha256'), 'hex'),
    encode(digest(jsonb_build_object(
      'status', 'pending',
      'attempt_count', v_delivery.attempt_count,
      'manual_replay_count', v_delivery.manual_replay_count + 1,
      'receipt_id', v_receipt_id
    )::text, 'sha256'), 'hex'),
    v_ip_address, v_user_agent, v_request_id
  );

  RETURN QUERY SELECT 'queued', v_delivery_id, 'pending',
    v_delivery.manual_replay_count + 1, v_receipt_id, false;
END;
$$;

COMMENT ON FUNCTION public.nexid_replay_webhook_delivery_v1(jsonb)
  IS 'Tenant-bound, MFA-gated by the caller, idempotent manual DLQ replay with immutable receipt and audit projection.';

REVOKE ALL ON TABLE enterprise_role_profiles FROM PUBLIC;
REVOKE ALL ON TABLE enterprise_connector_profiles FROM PUBLIC;
REVOKE ALL ON TABLE webhook_delivery_attempts FROM PUBLIC;
REVOKE ALL ON SEQUENCE webhook_delivery_attempts_id_seq FROM PUBLIC;
REVOKE ALL ON TABLE webhook_delivery_replay_receipts FROM PUBLIC;
REVOKE ALL ON SEQUENCE webhook_delivery_replay_receipts_id_seq FROM PUBLIC;
REVOKE ALL ON TABLE tenant_api_key_policy_receipts FROM PUBLIC;
REVOKE ALL ON SEQUENCE tenant_api_key_policy_receipts_id_seq FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_reject_enterprise_append_only_mutation_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_explain_event_risk_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_create_tenant_api_key_v2(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_write_sdk_external_event_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_replay_webhook_delivery_v1(jsonb) FROM PUBLIC;
