-- Durable tenant API-key lifecycle v1.
--
-- This migration deliberately does not store raw API keys or key hashes in
-- lifecycle receipts. Key material remains one-way hashed in tenant_api_keys;
-- receipts contain only the non-secret public state needed for audit.

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_api_keys_id_tenant_lifecycle
  ON tenant_api_keys(id, tenant_id);

CREATE TABLE IF NOT EXISTS tenant_api_key_lifecycle_receipts (
  id bigserial PRIMARY KEY,
  operation_id uuid NOT NULL UNIQUE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  api_key_id uuid NOT NULL,
  actor_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  previous_status text,
  current_status text NOT NULL,
  changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  previous_state jsonb,
  current_state jsonb NOT NULL,
  request_fingerprint text NOT NULL,
  request_id text,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_api_key_receipt_key_tenant_fkey
    FOREIGN KEY (api_key_id, tenant_id)
    REFERENCES tenant_api_keys(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT tenant_api_key_receipt_action_check
    CHECK (action IN ('create', 'update', 'revoke', 'migration_repair')),
  CONSTRAINT tenant_api_key_receipt_current_status_check
    CHECK (current_status IN ('active', 'revoked')),
  CONSTRAINT tenant_api_key_receipt_changed_fields_check
    CHECK (jsonb_typeof(changed_fields) = 'array'),
  CONSTRAINT tenant_api_key_receipt_previous_state_check
    CHECK (previous_state IS NULL OR jsonb_typeof(previous_state) = 'object'),
  CONSTRAINT tenant_api_key_receipt_current_state_check
    CHECK (jsonb_typeof(current_state) = 'object'),
  CONSTRAINT tenant_api_key_receipt_fingerprint_check
    CHECK (request_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT tenant_api_key_receipt_request_id_check
    CHECK (request_id IS NULL OR char_length(request_id) BETWEEN 1 AND 160),
  CONSTRAINT tenant_api_key_receipt_user_agent_check
    CHECK (user_agent IS NULL OR char_length(user_agent) <= 512),
  CONSTRAINT tenant_api_key_receipt_actor_check
    CHECK (
      (action = 'migration_repair' AND actor_id IS NULL)
      OR (action <> 'migration_repair' AND actor_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_tenant_api_key_receipts_tenant_created
  ON tenant_api_key_lifecycle_receipts(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_api_key_receipts_key_created
  ON tenant_api_key_lifecycle_receipts(api_key_id, created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM tenant_api_keys WHERE tenant_id IS NULL) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23502',
      MESSAGE = 'tenant_api_key_legacy_tenant_reconciliation_required';
  END IF;
END;
$$;

-- Normalize recognized legacy values and fail closed for any unknown status.
-- Every repaired row receives a non-secret migration receipt before mutation.
INSERT INTO tenant_api_key_lifecycle_receipts (
  operation_id,
  tenant_id,
  api_key_id,
  action,
  previous_status,
  current_status,
  changed_fields,
  previous_state,
  current_state,
  request_fingerprint
)
SELECT
  uuid_generate_v4(),
  api_key.tenant_id,
  api_key.id,
  'migration_repair',
  api_key.status,
  CASE
    WHEN lower(trim(api_key.status)) IN ('active', 'revoked') THEN lower(trim(api_key.status))
    ELSE 'revoked'
  END,
  '["status"]'::jsonb,
  jsonb_build_object(
    'name', api_key.name,
    'scopes', api_key.scopes,
    'status', api_key.status,
    'expires_at', api_key.expires_at
  ),
  jsonb_build_object(
    'name', api_key.name,
    'scopes', api_key.scopes,
    'status', CASE
      WHEN lower(trim(api_key.status)) IN ('active', 'revoked') THEN lower(trim(api_key.status))
      ELSE 'revoked'
    END,
    'expires_at', api_key.expires_at
  ),
  'sha256:' || encode(digest(jsonb_build_object(
    'api_key_id', api_key.id,
    'tenant_id', api_key.tenant_id,
    'previous_status', api_key.status,
    'current_status', CASE
      WHEN lower(trim(api_key.status)) IN ('active', 'revoked') THEN lower(trim(api_key.status))
      ELSE 'revoked'
    END,
    'action', 'migration_repair'
  )::text, 'sha256'), 'hex')
FROM tenant_api_keys api_key
WHERE api_key.status IS DISTINCT FROM CASE
  WHEN lower(trim(api_key.status)) IN ('active', 'revoked') THEN lower(trim(api_key.status))
  ELSE 'revoked'
END;

UPDATE tenant_api_keys
SET
  status = CASE
    WHEN lower(trim(status)) IN ('active', 'revoked') THEN lower(trim(status))
    ELSE 'revoked'
  END,
  updated_at = now()
WHERE status IS DISTINCT FROM CASE
  WHEN lower(trim(status)) IN ('active', 'revoked') THEN lower(trim(status))
  ELSE 'revoked'
END;

-- Runtime-created legacy rows may predate the canonical 0060 shape. Invalid
-- credential rows cannot be made authentic, so quarantine them as revoked and
-- replace malformed technical fields with deterministic, non-usable values.
INSERT INTO tenant_api_key_lifecycle_receipts (
  operation_id, tenant_id, api_key_id, action, previous_status, current_status,
  changed_fields, previous_state, current_state, request_fingerprint
)
SELECT
  uuid_generate_v4(), api_key.tenant_id, api_key.id, 'migration_repair',
  api_key.status, 'revoked', '["credential_shape","status"]'::jsonb,
  jsonb_build_object(
    'name', api_key.name, 'scopes', api_key.scopes,
    'status', api_key.status, 'expires_at', api_key.expires_at
  ),
  jsonb_build_object(
    'name', CASE
      WHEN char_length(trim(COALESCE(api_key.name, ''))) BETWEEN 1 AND 160 THEN trim(api_key.name)
      ELSE 'Quarantined API key ' || left(api_key.id::text, 8)
    END,
    'scopes', CASE
      WHEN CASE
        WHEN jsonb_typeof(api_key.scopes) = 'array' THEN
          jsonb_array_length(api_key.scopes) > 0
          AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(api_key.scopes) AS scope(value)
            WHERE jsonb_typeof(scope.value) <> 'string'
              OR (scope.value #>> '{}') NOT IN (
                'sdk:verify', 'sdk:claim', 'sdk:products', 'sdk:events',
                'sdk:pos', 'sdk:logistics', 'sdk:epcis:read', 'sdk:epcis:write'
              )
          )
          AND (SELECT count(*) = count(DISTINCT scope.value #>> '{}') FROM jsonb_array_elements(api_key.scopes) AS scope(value))
        ELSE false
      END THEN api_key.scopes
      ELSE '["sdk:verify"]'::jsonb
    END,
    'status', 'revoked', 'expires_at', api_key.expires_at
  ),
  'sha256:' || encode(digest(jsonb_build_object(
    'api_key_id', api_key.id, 'tenant_id', api_key.tenant_id,
    'action', 'migration_repair', 'repair', 'credential_shape'
  )::text, 'sha256'), 'hex')
FROM tenant_api_keys api_key
WHERE api_key.key_hash IS NULL OR api_key.key_hash !~ '^[0-9a-f]{64}$'
  OR api_key.key_prefix IS NULL OR api_key.key_prefix !~ '^[A-Za-z0-9_-]{1,64}$'
  OR char_length(trim(COALESCE(api_key.name, ''))) NOT BETWEEN 1 AND 160
  OR NOT CASE
    WHEN jsonb_typeof(api_key.scopes) = 'array' THEN
      jsonb_array_length(api_key.scopes) > 0
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(api_key.scopes) AS scope(value)
        WHERE jsonb_typeof(scope.value) <> 'string'
          OR (scope.value #>> '{}') NOT IN (
            'sdk:verify', 'sdk:claim', 'sdk:products', 'sdk:events',
            'sdk:pos', 'sdk:logistics', 'sdk:epcis:read', 'sdk:epcis:write'
          )
      )
      AND (SELECT count(*) = count(DISTINCT scope.value #>> '{}') FROM jsonb_array_elements(api_key.scopes) AS scope(value))
    ELSE false
  END
  OR jsonb_typeof(api_key.metadata_json) IS DISTINCT FROM 'object';

UPDATE tenant_api_keys api_key
SET
  status = 'revoked',
  key_hash = CASE
    WHEN api_key.key_hash IS NULL OR api_key.key_hash !~ '^[0-9a-f]{64}$'
      THEN encode(digest('quarantined-tenant-api-key:' || api_key.id::text, 'sha256'), 'hex')
    ELSE api_key.key_hash
  END,
  key_prefix = CASE
    WHEN api_key.key_prefix IS NULL OR api_key.key_prefix !~ '^[A-Za-z0-9_-]{1,64}$'
      THEN 'quarantined_' || left(api_key.id::text, 8)
    ELSE api_key.key_prefix
  END,
  name = CASE
    WHEN char_length(trim(COALESCE(api_key.name, ''))) BETWEEN 1 AND 160 THEN trim(api_key.name)
    ELSE 'Quarantined API key ' || left(api_key.id::text, 8)
  END,
  scopes = CASE
    WHEN CASE
      WHEN jsonb_typeof(api_key.scopes) = 'array' THEN
        jsonb_array_length(api_key.scopes) > 0
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(api_key.scopes) AS scope(value)
          WHERE jsonb_typeof(scope.value) <> 'string'
            OR (scope.value #>> '{}') NOT IN (
              'sdk:verify', 'sdk:claim', 'sdk:products', 'sdk:events',
              'sdk:pos', 'sdk:logistics', 'sdk:epcis:read', 'sdk:epcis:write'
            )
        )
        AND (SELECT count(*) = count(DISTINCT scope.value #>> '{}') FROM jsonb_array_elements(api_key.scopes) AS scope(value))
      ELSE false
    END THEN api_key.scopes
    ELSE '["sdk:verify"]'::jsonb
  END,
  metadata_json = CASE
    WHEN jsonb_typeof(api_key.metadata_json) = 'object' THEN api_key.metadata_json
    ELSE jsonb_build_object('legacy_repaired', true)
  END,
  updated_at = now()
WHERE api_key.key_hash IS NULL OR api_key.key_hash !~ '^[0-9a-f]{64}$'
  OR api_key.key_prefix IS NULL OR api_key.key_prefix !~ '^[A-Za-z0-9_-]{1,64}$'
  OR char_length(trim(COALESCE(api_key.name, ''))) NOT BETWEEN 1 AND 160
  OR NOT CASE
    WHEN jsonb_typeof(api_key.scopes) = 'array' THEN
      jsonb_array_length(api_key.scopes) > 0
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(api_key.scopes) AS scope(value)
        WHERE jsonb_typeof(scope.value) <> 'string'
          OR (scope.value #>> '{}') NOT IN (
            'sdk:verify', 'sdk:claim', 'sdk:products', 'sdk:events',
            'sdk:pos', 'sdk:logistics', 'sdk:epcis:read', 'sdk:epcis:write'
          )
      )
      AND (SELECT count(*) = count(DISTINCT scope.value #>> '{}') FROM jsonb_array_elements(api_key.scopes) AS scope(value))
    ELSE false
  END
  OR jsonb_typeof(api_key.metadata_json) IS DISTINCT FROM 'object';

CREATE OR REPLACE FUNCTION public.nexid_valid_tenant_api_key_scopes_v1(p_scopes jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN jsonb_typeof(p_scopes) = 'array' THEN
      jsonb_array_length(p_scopes) > 0
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_scopes) AS scope(value)
        WHERE jsonb_typeof(scope.value) <> 'string'
          OR (scope.value #>> '{}') NOT IN (
            'sdk:verify', 'sdk:claim', 'sdk:products', 'sdk:events',
            'sdk:pos', 'sdk:logistics', 'sdk:epcis:read', 'sdk:epcis:write'
          )
      )
      AND (SELECT count(*) = count(DISTINCT scope.value #>> '{}') FROM jsonb_array_elements(p_scopes) AS scope(value))
    ELSE false
  END;
$$;

ALTER TABLE tenant_api_keys
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN key_hash SET NOT NULL,
  ALTER COLUMN key_prefix SET NOT NULL,
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN scopes SET NOT NULL,
  ALTER COLUMN metadata_json SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.tenant_api_keys'::regclass
      AND conname = 'tenant_api_keys_status_check'
  ) THEN
    ALTER TABLE tenant_api_keys
      ADD CONSTRAINT tenant_api_keys_status_check
      CHECK (status IN ('active', 'revoked')) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tenant_api_keys'::regclass
      AND conname = 'tenant_api_keys_key_hash_format_check'
  ) THEN
    ALTER TABLE tenant_api_keys ADD CONSTRAINT tenant_api_keys_key_hash_format_check
      CHECK (key_hash ~ '^[0-9a-f]{64}$') NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tenant_api_keys'::regclass
      AND conname = 'tenant_api_keys_key_prefix_format_check'
  ) THEN
    ALTER TABLE tenant_api_keys ADD CONSTRAINT tenant_api_keys_key_prefix_format_check
      CHECK (key_prefix ~ '^[A-Za-z0-9_-]{1,64}$') NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tenant_api_keys'::regclass
      AND conname = 'tenant_api_keys_name_check'
  ) THEN
    ALTER TABLE tenant_api_keys ADD CONSTRAINT tenant_api_keys_name_check
      CHECK (char_length(trim(name)) BETWEEN 1 AND 160) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tenant_api_keys'::regclass
      AND conname = 'tenant_api_keys_scopes_check'
  ) THEN
    ALTER TABLE tenant_api_keys ADD CONSTRAINT tenant_api_keys_scopes_check
      CHECK (public.nexid_valid_tenant_api_key_scopes_v1(scopes)) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tenant_api_keys'::regclass
      AND conname = 'tenant_api_keys_metadata_object_check'
  ) THEN
    ALTER TABLE tenant_api_keys ADD CONSTRAINT tenant_api_keys_metadata_object_check
      CHECK (jsonb_typeof(metadata_json) = 'object') NOT VALID;
  END IF;
END;
$$;

ALTER TABLE tenant_api_keys
  VALIDATE CONSTRAINT tenant_api_keys_status_check,
  VALIDATE CONSTRAINT tenant_api_keys_key_hash_format_check,
  VALIDATE CONSTRAINT tenant_api_keys_key_prefix_format_check,
  VALIDATE CONSTRAINT tenant_api_keys_name_check,
  VALIDATE CONSTRAINT tenant_api_keys_scopes_check,
  VALIDATE CONSTRAINT tenant_api_keys_metadata_object_check;

CREATE OR REPLACE FUNCTION public.nexid_tenant_api_key_receipts_append_only_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'tenant_api_key_lifecycle_history_is_append_only';
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_api_key_lifecycle_receipts_append_only
  ON tenant_api_key_lifecycle_receipts;

CREATE TRIGGER trg_tenant_api_key_lifecycle_receipts_append_only
BEFORE UPDATE OR DELETE ON tenant_api_key_lifecycle_receipts
FOR EACH ROW
EXECUTE FUNCTION public.nexid_tenant_api_key_receipts_append_only_v1();

CREATE OR REPLACE FUNCTION public.nexid_tenant_api_key_lifecycle_guard_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_writer_enabled boolean := COALESCE(
    current_setting('nexid.tenant_api_key_lifecycle_writer_v1', true),
    ''
  ) = 'on';
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tenant_api_key_delete_forbidden';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.key_hash IS DISTINCT FROM OLD.key_hash
      OR NEW.key_prefix IS DISTINCT FROM OLD.key_prefix
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.metadata_json IS DISTINCT FROM OLD.metadata_json
      OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tenant_api_key_identity_immutable';
    END IF;

    IF OLD.status = 'revoked' AND NEW.status IS DISTINCT FROM 'revoked' THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tenant_api_key_reactivation_forbidden';
    END IF;

    -- Authentication usage may only advance the usage timestamp. It is not a
    -- lifecycle mutation and intentionally does not produce a lifecycle receipt.
    IF NOT v_writer_enabled
      AND (to_jsonb(NEW) - 'last_used_at') = (to_jsonb(OLD) - 'last_used_at') THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NOT v_writer_enabled THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'tenant_api_key_lifecycle_writer_required';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_api_key_lifecycle_guard_v1 ON tenant_api_keys;

CREATE TRIGGER trg_tenant_api_key_lifecycle_guard_v1
BEFORE INSERT OR UPDATE OR DELETE ON tenant_api_keys
FOR EACH ROW
EXECUTE FUNCTION public.nexid_tenant_api_key_lifecycle_guard_v1();

CREATE OR REPLACE FUNCTION public.nexid_tenant_api_key_lifecycle_v1_capability()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'schema_version', 'tenant-api-key-lifecycle/v1',
    'status_values', jsonb_build_array('active', 'revoked'),
    'quota_serialization', 'tenant_advisory_lock',
    'receipts', 'append_only',
    'raw_secret_persisted', false,
    'key_hash_in_receipts', false
  );
$$;

CREATE OR REPLACE FUNCTION public.nexid_create_tenant_api_key_v1(p_input jsonb)
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
  receipt_id bigint
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_actor_id uuid;
  v_name text;
  v_key_prefix text;
  v_key_hash text;
  v_scopes jsonb;
  v_expires_at timestamptz;
  v_max_active integer;
  v_active_count integer;
  v_operation_id uuid := uuid_generate_v4();
  v_request_id text;
  v_ip_address inet;
  v_user_agent text;
  v_key tenant_api_keys%ROWTYPE;
  v_receipt_id bigint;
  v_previous_writer text := current_setting('nexid.tenant_api_key_lifecycle_writer_v1', true);
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'tenant_api_key_input_invalid';
  END IF;
  IF COALESCE(p_input->>'tenant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'actor_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'tenant_api_key_identity_invalid';
  END IF;

  v_tenant_id := (p_input->>'tenant_id')::uuid;
  v_actor_id := (p_input->>'actor_id')::uuid;
  v_name := trim(COALESCE(p_input->>'name', ''));
  v_key_prefix := trim(COALESCE(p_input->>'key_prefix', ''));
  v_key_hash := lower(trim(COALESCE(p_input->>'key_hash', '')));
  v_scopes := p_input->'scopes';
  v_max_active := COALESCE((p_input->>'max_active_keys')::integer, 0);
  v_request_id := NULLIF(left(trim(COALESCE(p_input->>'request_id', '')), 160), '');
  v_user_agent := NULLIF(left(COALESCE(p_input->>'user_agent', ''), 512), '');
  IF NULLIF(trim(COALESCE(p_input->>'ip_address', '')), '') IS NOT NULL THEN
    v_ip_address := (p_input->>'ip_address')::inet;
  END IF;
  IF NULLIF(trim(COALESCE(p_input->>'expires_at', '')), '') IS NOT NULL THEN
    v_expires_at := (p_input->>'expires_at')::timestamptz;
  END IF;

  IF char_length(v_name) NOT BETWEEN 1 AND 160
    OR v_key_prefix !~ '^[A-Za-z0-9_-]{1,64}$'
    OR v_key_hash !~ '^[0-9a-f]{64}$'
    OR v_max_active NOT BETWEEN 1 AND 1000
    OR v_expires_at IS NOT NULL AND v_expires_at <= now()
    OR v_request_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'tenant_api_key_input_invalid';
  END IF;

  IF v_scopes IS NULL OR jsonb_typeof(v_scopes) <> 'array' OR jsonb_array_length(v_scopes) = 0
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_scopes) AS scope(value)
      WHERE jsonb_typeof(scope.value) <> 'string'
        OR (scope.value #>> '{}') NOT IN (
          'sdk:verify', 'sdk:claim', 'sdk:products', 'sdk:events',
          'sdk:pos', 'sdk:logistics', 'sdk:epcis:read', 'sdk:epcis:write'
        )
    )
    OR (
      SELECT count(*) <> count(DISTINCT scope.value #>> '{}')
      FROM jsonb_array_elements(v_scopes) AS scope(value)
    ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'tenant_api_key_scopes_invalid';
  END IF;

  PERFORM 1 FROM tenants tenant WHERE tenant.id = v_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'tenant_api_key_tenant_not_found';
  END IF;
  PERFORM 1 FROM users actor WHERE actor.id = v_actor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'tenant_api_key_actor_not_found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('tenant-api-key-quota:' || v_tenant_id::text, 0));
  SELECT count(*)::integer INTO v_active_count
  FROM tenant_api_keys api_key
  WHERE api_key.tenant_id = v_tenant_id
    AND api_key.status = 'active'
    AND (api_key.expires_at IS NULL OR api_key.expires_at > now());

  IF v_active_count >= v_max_active THEN
    RETURN QUERY SELECT 'quota_exceeded', NULL::uuid, NULL::text, NULL::text,
      NULL::jsonb, NULL::text, NULL::timestamptz, NULL::timestamptz,
      v_active_count, NULL::bigint;
    RETURN;
  END IF;

  PERFORM set_config('nexid.tenant_api_key_lifecycle_writer_v1', 'on', true);
  INSERT INTO tenant_api_keys (
    tenant_id, name, key_prefix, key_hash, scopes, status, expires_at, metadata_json
  ) VALUES (
    v_tenant_id, v_name, v_key_prefix, v_key_hash, v_scopes, 'active', v_expires_at,
    jsonb_build_object('created_from', 'admin_sdk_api_keys_v1')
  ) RETURNING * INTO v_key;

  INSERT INTO tenant_api_key_lifecycle_receipts (
    operation_id, tenant_id, api_key_id, actor_id, action, current_status,
    changed_fields, current_state, request_fingerprint, request_id, ip_address, user_agent
  ) VALUES (
    v_operation_id, v_tenant_id, v_key.id, v_actor_id, 'create', v_key.status,
    '["name","scopes","status","expires_at"]'::jsonb,
    jsonb_build_object('name', v_key.name, 'scopes', v_key.scopes, 'status', v_key.status, 'expires_at', v_key.expires_at),
    'sha256:' || encode(digest(jsonb_build_object(
      'operation_id', v_operation_id, 'tenant_id', v_tenant_id, 'api_key_id', v_key.id,
      'actor_id', v_actor_id, 'action', 'create',
      'state', jsonb_build_object('name', v_key.name, 'scopes', v_key.scopes, 'status', v_key.status, 'expires_at', v_key.expires_at)
    )::text, 'sha256'), 'hex'),
    v_request_id, v_ip_address, v_user_agent
  ) RETURNING tenant_api_key_lifecycle_receipts.id INTO v_receipt_id;

  PERFORM set_config('nexid.tenant_api_key_lifecycle_writer_v1', COALESCE(v_previous_writer, ''), true);
  RETURN QUERY SELECT 'created', v_key.id, v_key.name, v_key.key_prefix, v_key.scopes,
    v_key.status, v_key.expires_at, v_key.created_at, v_active_count + 1, v_receipt_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.nexid_mutate_tenant_api_key_v1(p_input jsonb)
RETURNS TABLE (
  outcome text,
  id uuid,
  name text,
  key_prefix text,
  scopes jsonb,
  status text,
  last_used_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz,
  already_revoked boolean,
  changed boolean,
  receipt_id bigint
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_requested_tenant_id uuid;
  v_api_key_id uuid;
  v_actor_id uuid;
  v_operation text;
  v_name_provided boolean;
  v_scopes_provided boolean;
  v_revoke_requested boolean;
  v_name text;
  v_scopes jsonb;
  v_existing tenant_api_keys%ROWTYPE;
  v_updated tenant_api_keys%ROWTYPE;
  v_changed_fields jsonb := '[]'::jsonb;
  v_action text;
  v_operation_id uuid := uuid_generate_v4();
  v_request_id text;
  v_ip_address inet;
  v_user_agent text;
  v_receipt_id bigint;
  v_previous_writer text := current_setting('nexid.tenant_api_key_lifecycle_writer_v1', true);
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object'
    OR COALESCE(p_input->>'api_key_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_input->>'actor_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'tenant_api_key_identity_invalid';
  END IF;
  IF NULLIF(trim(COALESCE(p_input->>'tenant_id', '')), '') IS NOT NULL
    AND (p_input->>'tenant_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'tenant_api_key_tenant_invalid';
  END IF;

  v_api_key_id := (p_input->>'api_key_id')::uuid;
  v_actor_id := (p_input->>'actor_id')::uuid;
  v_operation := lower(trim(COALESCE(p_input->>'operation', '')));
  v_name_provided := COALESCE((p_input->>'name_provided')::boolean, false);
  v_scopes_provided := COALESCE((p_input->>'scopes_provided')::boolean, false);
  v_revoke_requested := COALESCE((p_input->>'revoke_requested')::boolean, false) OR v_operation = 'revoke';
  v_name := trim(COALESCE(p_input->>'name', ''));
  v_scopes := p_input->'scopes';
  v_request_id := NULLIF(left(trim(COALESCE(p_input->>'request_id', '')), 160), '');
  v_user_agent := NULLIF(left(COALESCE(p_input->>'user_agent', ''), 512), '');
  IF NULLIF(trim(COALESCE(p_input->>'tenant_id', '')), '') IS NOT NULL THEN
    v_requested_tenant_id := (p_input->>'tenant_id')::uuid;
  END IF;
  IF NULLIF(trim(COALESCE(p_input->>'ip_address', '')), '') IS NOT NULL THEN
    v_ip_address := (p_input->>'ip_address')::inet;
  END IF;

  IF v_operation NOT IN ('update', 'revoke') OR v_request_id IS NULL
    OR (v_operation = 'update' AND NOT v_name_provided AND NOT v_scopes_provided AND NOT v_revoke_requested)
    OR (v_name_provided AND char_length(v_name) NOT BETWEEN 1 AND 160) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'tenant_api_key_mutation_invalid';
  END IF;

  IF v_scopes_provided AND (
    v_scopes IS NULL OR jsonb_typeof(v_scopes) <> 'array' OR jsonb_array_length(v_scopes) = 0
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_scopes) AS scope(value)
      WHERE jsonb_typeof(scope.value) <> 'string'
        OR (scope.value #>> '{}') NOT IN (
          'sdk:verify', 'sdk:claim', 'sdk:products', 'sdk:events',
          'sdk:pos', 'sdk:logistics', 'sdk:epcis:read', 'sdk:epcis:write'
        )
    )
    OR (SELECT count(*) <> count(DISTINCT scope.value #>> '{}') FROM jsonb_array_elements(v_scopes) AS scope(value))
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'tenant_api_key_scopes_invalid';
  END IF;

  PERFORM 1 FROM users actor WHERE actor.id = v_actor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'tenant_api_key_actor_not_found';
  END IF;

  SELECT api_key.* INTO v_existing
  FROM tenant_api_keys api_key
  WHERE api_key.id = v_api_key_id
    AND (v_requested_tenant_id IS NULL OR api_key.tenant_id = v_requested_tenant_id)
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_name_provided AND v_name IS DISTINCT FROM v_existing.name THEN
    v_changed_fields := v_changed_fields || '"name"'::jsonb;
  END IF;
  IF v_scopes_provided AND v_scopes IS DISTINCT FROM v_existing.scopes THEN
    v_changed_fields := v_changed_fields || '"scopes"'::jsonb;
  END IF;
  IF v_revoke_requested AND v_existing.status = 'active' THEN
    v_changed_fields := v_changed_fields || '"status"'::jsonb;
  END IF;

  IF jsonb_array_length(v_changed_fields) = 0 THEN
    RETURN QUERY SELECT 'noop', v_existing.id, v_existing.name, v_existing.key_prefix,
      v_existing.scopes, v_existing.status, v_existing.last_used_at, v_existing.expires_at,
      v_existing.updated_at, v_existing.status = 'revoked', false, NULL::bigint;
    RETURN;
  END IF;

  PERFORM set_config('nexid.tenant_api_key_lifecycle_writer_v1', 'on', true);
  UPDATE tenant_api_keys api_key
  SET
    name = CASE WHEN v_name_provided THEN v_name ELSE api_key.name END,
    scopes = CASE WHEN v_scopes_provided THEN v_scopes ELSE api_key.scopes END,
    status = CASE WHEN v_revoke_requested THEN 'revoked' ELSE api_key.status END,
    updated_at = now()
  WHERE api_key.id = v_existing.id
    AND api_key.tenant_id = v_existing.tenant_id
  RETURNING api_key.* INTO v_updated;

  v_action := CASE WHEN v_existing.status = 'active' AND v_updated.status = 'revoked' THEN 'revoke' ELSE 'update' END;
  INSERT INTO tenant_api_key_lifecycle_receipts (
    operation_id, tenant_id, api_key_id, actor_id, action, previous_status, current_status,
    changed_fields, previous_state, current_state, request_fingerprint, request_id, ip_address, user_agent
  ) VALUES (
    v_operation_id, v_updated.tenant_id, v_updated.id, v_actor_id, v_action, v_existing.status, v_updated.status,
    v_changed_fields,
    jsonb_build_object('name', v_existing.name, 'scopes', v_existing.scopes, 'status', v_existing.status, 'expires_at', v_existing.expires_at),
    jsonb_build_object('name', v_updated.name, 'scopes', v_updated.scopes, 'status', v_updated.status, 'expires_at', v_updated.expires_at),
    'sha256:' || encode(digest(jsonb_build_object(
      'operation_id', v_operation_id, 'tenant_id', v_updated.tenant_id, 'api_key_id', v_updated.id,
      'actor_id', v_actor_id, 'action', v_action, 'changed_fields', v_changed_fields,
      'previous_state', jsonb_build_object('name', v_existing.name, 'scopes', v_existing.scopes, 'status', v_existing.status, 'expires_at', v_existing.expires_at),
      'current_state', jsonb_build_object('name', v_updated.name, 'scopes', v_updated.scopes, 'status', v_updated.status, 'expires_at', v_updated.expires_at)
    )::text, 'sha256'), 'hex'),
    v_request_id, v_ip_address, v_user_agent
  ) RETURNING tenant_api_key_lifecycle_receipts.id INTO v_receipt_id;

  PERFORM set_config('nexid.tenant_api_key_lifecycle_writer_v1', COALESCE(v_previous_writer, ''), true);
  RETURN QUERY SELECT v_action, v_updated.id, v_updated.name, v_updated.key_prefix,
    v_updated.scopes, v_updated.status, v_updated.last_used_at, v_updated.expires_at,
    v_updated.updated_at, v_existing.status = 'revoked', true, v_receipt_id;
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON TABLE tenant_api_keys FROM PUBLIC;
REVOKE ALL ON TABLE tenant_api_key_lifecycle_receipts FROM PUBLIC;
REVOKE ALL ON SEQUENCE tenant_api_key_lifecycle_receipts_id_seq FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_valid_tenant_api_key_scopes_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_tenant_api_key_receipts_append_only_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_tenant_api_key_lifecycle_guard_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_tenant_api_key_lifecycle_v1_capability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_create_tenant_api_key_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_mutate_tenant_api_key_v1(jsonb) FROM PUBLIC;
