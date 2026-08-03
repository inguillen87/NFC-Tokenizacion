-- Tenant-scoped carrier construction, placement and Packaging Lab foundation.
--
-- This migration intentionally leaves NFC/SUN key custody, CMAC verification,
-- read counters and physical TagTamper decoding untouched.  It adds an
-- independent packaging approval gate to the production activation path.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Keep the existing canonical GS1 Digital Link profile.  `gs1_qr` is an API
-- alias, not a second row whose security policy could drift.
UPDATE carrier_profiles
SET capabilities = capabilities || jsonb_build_object(
      'technology', CASE
        WHEN code = 'uhf_rfid' THEN 'UHF'
        WHEN code = 'iot_tracker_placeholder' THEN 'IOT'
        WHEN family = 'nfc' THEN 'NFC'
        ELSE 'QR'
      END,
      'cryptographic_authentication', code IN ('ntag424_dna', 'ntag424_dna_tt'),
      'supports_dynamic_uid', code IN ('ntag424_dna', 'ntag424_dna_tt'),
      'supports_read_counter', code IN ('ntag424_dna', 'ntag424_dna_tt'),
      'supports_cmac', code IN ('ntag424_dna', 'ntag424_dna_tt'),
      'supports_replay_detection', code IN ('ntag424_dna', 'ntag424_dna_tt'),
      'supports_tamper', code = 'ntag424_dna_tt',
      'supports_bulk_read', code = 'uhf_rfid',
      'requires_reader', code IN ('uhf_rfid', 'iot_tracker_placeholder'),
      'requires_batch_keys', code IN ('ntag424_dna', 'ntag424_dna_tt'),
      'tamper_evidence_mode', CASE
        WHEN code = 'ntag424_dna_tt' THEN 'ttstatus_2byte_or_explicit_manual_evidence'
        ELSE 'none'
      END,
      'identity_assurance', CASE
        WHEN code IN ('qr_basic', 'gs1_digital_link') THEN 'declared_identity'
        WHEN code = 'uhf_rfid' THEN 'declared_logistics'
        WHEN code = 'iot_tracker_placeholder' THEN 'sensor_evidence'
        WHEN code = 'ntag424_dna_tt' THEN 'sun_sdm_tamper'
        WHEN code = 'ntag424_dna' THEN 'sun_sdm'
        ELSE 'server_uid'
      END
    ),
    updated_at = now()
WHERE code IN (
  'qr_basic', 'gs1_digital_link', 'ntag213', 'ntag215', 'ntag216',
  'ntag424_dna', 'ntag424_dna_tt', 'uhf_rfid', 'event_wristband',
  'hotel_keycard', 'iot_tracker_placeholder'
);

CREATE TABLE IF NOT EXISTS packaging_carrier_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(BTRIM(name)) BETWEEN 1 AND 160),
  carrier_profile_code text NOT NULL REFERENCES carrier_profiles(code) ON DELETE RESTRICT,
  delivery_format text NOT NULL CHECK (delivery_format IN (
    'dry_inlay', 'wet_inlay', 'white_label', 'transparent_pet', 'void_label', 'hard_tag'
  )),
  antenna_width_mm numeric(10,3),
  antenna_height_mm numeric(10,3),
  die_cut_width_mm numeric(10,3),
  die_cut_height_mm numeric(10,3),
  total_thickness_mm numeric(10,4),
  adhesive_code text,
  adhesive_description text,
  liner_type text,
  roll_core_mm numeric(10,3),
  pitch_mm numeric(10,3),
  web_width_mm numeric(10,3),
  unwind_direction text,
  target_substrates text[] NOT NULL DEFAULT ARRAY[]::text[],
  forbidden_conditions text[] NOT NULL DEFAULT ARRAY[]::text[],
  metal_clearance_mm numeric(10,3),
  operating_temperature jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(operating_temperature) = 'object'),
  humidity_test_required boolean NOT NULL DEFAULT false,
  chemical_test_required boolean NOT NULL DEFAULT false,
  abrasion_test_required boolean NOT NULL DEFAULT false,
  assurance_model text NOT NULL CHECK (assurance_model IN (
    'declared_identity', 'server_uid', 'sun_sdm', 'sun_sdm_tamper',
    'declared_logistics', 'sensor_evidence'
  )),
  tamper_evidence_mode text NOT NULL DEFAULT 'none' CHECK (tamper_evidence_mode IN (
    'none', 'ttstatus_2byte_or_explicit_manual_evidence'
  )),
  key_material_policy text NOT NULL DEFAULT 'none' CHECK (key_material_policy IN ('none', 'batch_sun')),
  notes text,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id),
  CHECK (antenna_width_mm IS NULL OR antenna_width_mm > 0),
  CHECK (antenna_height_mm IS NULL OR antenna_height_mm > 0),
  CHECK (die_cut_width_mm IS NULL OR die_cut_width_mm > 0),
  CHECK (die_cut_height_mm IS NULL OR die_cut_height_mm > 0),
  CHECK (total_thickness_mm IS NULL OR total_thickness_mm > 0),
  CHECK (roll_core_mm IS NULL OR roll_core_mm > 0),
  CHECK (pitch_mm IS NULL OR pitch_mm > 0),
  CHECK (web_width_mm IS NULL OR web_width_mm > 0),
  CHECK (metal_clearance_mm IS NULL OR metal_clearance_mm >= 0),
  CHECK (
    (carrier_profile_code = 'ntag424_dna_tt'
      AND assurance_model = 'sun_sdm_tamper'
      AND tamper_evidence_mode = 'ttstatus_2byte_or_explicit_manual_evidence'
      AND key_material_policy = 'batch_sun')
    OR
    (carrier_profile_code = 'ntag424_dna'
      AND assurance_model = 'sun_sdm'
      AND tamper_evidence_mode = 'none'
      AND key_material_policy = 'batch_sun')
    OR
    (carrier_profile_code = 'gs1_digital_link'
      AND assurance_model = 'declared_identity'
      AND tamper_evidence_mode = 'none'
      AND key_material_policy = 'none')
    OR
    (carrier_profile_code = 'uhf_rfid'
      AND assurance_model = 'declared_logistics'
      AND tamper_evidence_mode = 'none'
      AND key_material_policy = 'none')
    OR
    (carrier_profile_code NOT IN ('ntag424_dna_tt', 'ntag424_dna', 'gs1_digital_link', 'uhf_rfid')
      AND tamper_evidence_mode = 'none'
      AND key_material_policy = 'none')
  )
);

CREATE INDEX IF NOT EXISTS idx_packaging_carrier_specs_tenant_profile
  ON packaging_carrier_specs (tenant_id, carrier_profile_code, updated_at DESC);

CREATE TABLE IF NOT EXISTS packaging_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  product_id text,
  sku text,
  packaging_type text NOT NULL CHECK (packaging_type IN (
    'seed_bag', 'woven_bag', 'laminated_bag', 'jerry_can', 'cap', 'box', 'pallet', 'other'
  )),
  carrier_spec_id uuid NOT NULL,
  placement_zone text NOT NULL CHECK (char_length(BTRIM(placement_zone)) BETWEEN 1 AND 240),
  placement_image_url text,
  crosses_opening boolean NOT NULL DEFAULT false,
  requires_tail_break boolean NOT NULL DEFAULT false,
  validated boolean NOT NULL DEFAULT false,
  validation_report_id text,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id),
  CONSTRAINT packaging_placements_carrier_tenant_fk
    FOREIGN KEY (carrier_spec_id, tenant_id)
    REFERENCES packaging_carrier_specs(id, tenant_id) ON DELETE RESTRICT,
  CHECK (NULLIF(BTRIM(product_id), '') IS NOT NULL OR NULLIF(BTRIM(sku), '') IS NOT NULL),
  CHECK (NOT validated OR NULLIF(BTRIM(validation_report_id), '') IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_packaging_placements_tenant_product
  ON packaging_placements (tenant_id, product_id, sku, packaging_type, updated_at DESC);

ALTER TABLE supplier_orders
  ADD COLUMN IF NOT EXISTS packaging_carrier_spec_id uuid;

ALTER TABLE supplier_orders
  DROP CONSTRAINT IF EXISTS supplier_orders_packaging_carrier_spec_fk;
ALTER TABLE supplier_orders
  ADD CONSTRAINT supplier_orders_packaging_carrier_spec_fk
  FOREIGN KEY (packaging_carrier_spec_id, tenant_id)
  REFERENCES packaging_carrier_specs(id, tenant_id) ON DELETE RESTRICT NOT VALID;

-- The column is introduced nullable, so existing rows are safe to validate.
-- If an idempotent/partial environment already contains a bad non-null
-- reference, fail the migration instead of silently retaining a weak FK.
ALTER TABLE supplier_orders
  VALIDATE CONSTRAINT supplier_orders_packaging_carrier_spec_fk;

CREATE INDEX IF NOT EXISTS idx_supplier_orders_packaging_carrier_spec
  ON supplier_orders (tenant_id, packaging_carrier_spec_id)
  WHERE packaging_carrier_spec_id IS NOT NULL;

-- Composite uniqueness lets every Lab reference bind the order and tenant in a
-- single database-enforced relationship. `id` is already the primary key, so
-- this does not change logical identity; it closes cross-tenant direct writes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_orders_id_tenant
  ON supplier_orders (id, tenant_id);

CREATE TABLE IF NOT EXISTS packaging_lab_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_order_id uuid NOT NULL,
  carrier_spec_id uuid NOT NULL,
  placement_id uuid NOT NULL,
  product_id text,
  sku text,
  packaging_type text NOT NULL CHECK (packaging_type IN (
    'seed_bag', 'woven_bag', 'laminated_bag', 'jerry_can', 'cap', 'box', 'pallet', 'other'
  )),
  template_code text NOT NULL CHECK (template_code IN ('seed_bag', 'jerry_can', 'roll_line', 'custom')),
  objective text NOT NULL CHECK (char_length(BTRIM(objective)) BETWEEN 1 AND 2000),
  recommendation text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'MATERIALS_PENDING', 'TESTING', 'FAILED', 'APPROVED', 'ARCHIVED'
  )),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved_packaging_revision integer NOT NULL CHECK (approved_packaging_revision > 0),
  approved_packaging_hash text NOT NULL CHECK (approved_packaging_hash ~ '^sha256:[0-9a-f]{64}$'),
  approval_id uuid,
  approved_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id),
  CONSTRAINT packaging_lab_project_order_tenant_fk
    FOREIGN KEY (supplier_order_id, tenant_id)
    REFERENCES supplier_orders(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT packaging_lab_project_carrier_tenant_fk
    FOREIGN KEY (carrier_spec_id, tenant_id)
    REFERENCES packaging_carrier_specs(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT packaging_lab_project_placement_tenant_fk
    FOREIGN KEY (placement_id, tenant_id)
    REFERENCES packaging_placements(id, tenant_id) ON DELETE RESTRICT,
  CHECK (NULLIF(BTRIM(product_id), '') IS NOT NULL OR NULLIF(BTRIM(sku), '') IS NOT NULL),
  CHECK (
    (status = 'APPROVED' AND approval_id IS NOT NULL AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
    OR
    (status = 'ARCHIVED' AND (
      (approval_id IS NULL AND approved_by IS NULL AND approved_at IS NULL)
      OR (approval_id IS NOT NULL AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
    ))
    OR
    (status NOT IN ('APPROVED', 'ARCHIVED') AND approval_id IS NULL AND approved_by IS NULL AND approved_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_packaging_lab_projects_tenant_order
  ON packaging_lab_projects (tenant_id, supplier_order_id, status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_packaging_lab_approved_supplier_order
  ON packaging_lab_projects (supplier_order_id)
  WHERE status = 'APPROVED';

CREATE TABLE IF NOT EXISTS packaging_lab_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  code text NOT NULL CHECK (code ~ '^[a-z][a-z0-9_]{2,79}$'),
  category text NOT NULL CHECK (category IN ('MATERIAL', 'ADHESION', 'RF', 'CRYPTO', 'LINE', 'ENVIRONMENT', 'UX')),
  name text NOT NULL CHECK (char_length(BTRIM(name)) BETWEEN 1 AND 240),
  method text NOT NULL CHECK (char_length(BTRIM(method)) BETWEEN 1 AND 2000),
  target text NOT NULL CHECK (char_length(BTRIM(target)) BETWEEN 1 AND 2000),
  result text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PASS', 'FAIL', 'WAIVED')),
  evidence_urls text[] NOT NULL DEFAULT ARRAY[]::text[],
  required boolean NOT NULL DEFAULT true,
  waiver_allowed boolean NOT NULL DEFAULT false,
  operator_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  tested_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, code),
  UNIQUE (project_id, sequence),
  CONSTRAINT packaging_lab_test_project_tenant_fk
    FOREIGN KEY (project_id, tenant_id)
    REFERENCES packaging_lab_projects(id, tenant_id) ON DELETE RESTRICT,
  CHECK (
    (status = 'PENDING' AND operator_id IS NULL AND tested_at IS NULL)
    OR
    (status <> 'PENDING' AND NULLIF(BTRIM(result), '') IS NOT NULL AND operator_id IS NOT NULL AND tested_at IS NOT NULL)
  ),
  CHECK (status <> 'WAIVED' OR waiver_allowed)
);

CREATE INDEX IF NOT EXISTS idx_packaging_lab_tests_project
  ON packaging_lab_test_cases (tenant_id, project_id, sequence);

CREATE TABLE IF NOT EXISTS packaging_lab_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL,
  supplier_order_id uuid NOT NULL REFERENCES supplier_orders(id) ON DELETE RESTRICT,
  carrier_spec_id uuid NOT NULL,
  placement_id uuid NOT NULL,
  carrier_profile_code text NOT NULL REFERENCES carrier_profiles(code) ON DELETE RESTRICT,
  product_id text,
  sku text,
  spec_revision integer NOT NULL CHECK (spec_revision > 0),
  placement_revision integer NOT NULL CHECK (placement_revision > 0),
  approved_packaging_revision integer NOT NULL CHECK (approved_packaging_revision > 0),
  approved_packaging_hash text NOT NULL CHECK (approved_packaging_hash ~ '^sha256:[0-9a-f]{64}$'),
  spec_snapshot jsonb NOT NULL CHECK (jsonb_typeof(spec_snapshot) = 'object'),
  placement_snapshot jsonb NOT NULL CHECK (jsonb_typeof(placement_snapshot) = 'object'),
  tests_snapshot jsonb NOT NULL CHECK (jsonb_typeof(tests_snapshot) = 'array'),
  tests_digest text NOT NULL CHECK (tests_digest ~ '^sha256:[0-9a-f]{64}$'),
  receipt_digest text NOT NULL UNIQUE CHECK (receipt_digest ~ '^sha256:[0-9a-f]{64}$'),
  override_used boolean NOT NULL DEFAULT false,
  override_reason text,
  approved_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id),
  UNIQUE (id, tenant_id),
  CONSTRAINT packaging_lab_approval_project_tenant_fk
    FOREIGN KEY (project_id, tenant_id)
    REFERENCES packaging_lab_projects(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT packaging_lab_approval_carrier_tenant_fk
    FOREIGN KEY (carrier_spec_id, tenant_id)
    REFERENCES packaging_carrier_specs(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT packaging_lab_approval_placement_tenant_fk
    FOREIGN KEY (placement_id, tenant_id)
    REFERENCES packaging_placements(id, tenant_id) ON DELETE RESTRICT,
  CHECK (
    (override_used = false AND override_reason IS NULL)
    OR
    (override_used = true AND char_length(BTRIM(override_reason)) BETWEEN 16 AND 2000)
  )
);

ALTER TABLE packaging_lab_projects
  DROP CONSTRAINT IF EXISTS packaging_lab_projects_approval_fk;
ALTER TABLE packaging_lab_projects
  ADD CONSTRAINT packaging_lab_projects_approval_fk
  FOREIGN KEY (approval_id) REFERENCES packaging_lab_approvals(id) ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS packaging_lab_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  operation_key text NOT NULL CHECK (operation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  operation_type text NOT NULL CHECK (operation_type IN ('create_project', 'decide_project')),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  result_json jsonb NOT NULL CHECK (jsonb_typeof(result_json) = 'object'),
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, operation_key)
);

CREATE OR REPLACE FUNCTION public.nexid_packaging_lab_history_append_only_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $history$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'packaging_lab_history_is_append_only';
END;
$history$;

DROP TRIGGER IF EXISTS trg_packaging_lab_approvals_append_only ON packaging_lab_approvals;
CREATE TRIGGER trg_packaging_lab_approvals_append_only
  BEFORE UPDATE OR DELETE ON packaging_lab_approvals
  FOR EACH ROW EXECUTE FUNCTION public.nexid_packaging_lab_history_append_only_v1();

DROP TRIGGER IF EXISTS trg_packaging_lab_operations_append_only ON packaging_lab_operations;
CREATE TRIGGER trg_packaging_lab_operations_append_only
  BEFORE UPDATE OR DELETE ON packaging_lab_operations
  FOR EACH ROW EXECUTE FUNCTION public.nexid_packaging_lab_history_append_only_v1();

CREATE OR REPLACE FUNCTION public.nexid_packaging_lab_permission_denied_v1(
  p_actor_id uuid,
  p_action text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $permission_denied$
  SELECT CASE p_action
    WHEN 'packaging_lab.manage' THEN EXISTS (
      SELECT 1
      FROM resource_permissions permission
      WHERE permission.user_id = p_actor_id
        AND permission.effect = 'deny'
        AND (
          (permission.resource = '*' AND permission.action = '*')
          OR (permission.resource = 'supplier' AND permission.action IN ('packaging_lab_manage', '*'))
        )
    )
    WHEN 'qa.approve' THEN EXISTS (
      SELECT 1
      FROM resource_permissions permission
      WHERE permission.user_id = p_actor_id
        AND permission.effect = 'deny'
        AND (
          (permission.resource = '*' AND permission.action = '*')
          OR (permission.resource = 'supplier' AND permission.action IN ('qa_approve', '*'))
        )
    )
    WHEN 'supplier:packaging_lab_override' THEN EXISTS (
      SELECT 1
      FROM resource_permissions permission
      WHERE permission.user_id = p_actor_id
        AND permission.effect = 'deny'
        AND (
          (permission.resource = '*' AND permission.action = '*')
          OR (permission.resource = 'supplier' AND permission.action IN ('packaging_lab_override', '*'))
        )
    )
    ELSE true
  END
$permission_denied$;

CREATE OR REPLACE FUNCTION public.nexid_packaging_lab_actor_authorized_v1(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_auth_session_id uuid,
  p_action text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $authorized$
DECLARE
  v_role text;
  v_session_tenant_id uuid;
  v_session_permissions jsonb := '[]'::jsonb;
  v_role_permissions jsonb := '[]'::jsonb;
  v_allowed_role boolean := false;
  v_allowed_permission boolean := false;
BEGIN
  IF p_action NOT IN ('packaging_lab.manage', 'qa.approve') THEN
    RETURN false;
  END IF;
  -- Explicit resource denial has precedence over session grants, role defaults,
  -- wildcard grants and the super-admin shortcut.
  IF public.nexid_packaging_lab_permission_denied_v1(p_actor_id, p_action) THEN
    RETURN false;
  END IF;

  SELECT auth_session.role::text, auth_session.tenant_id,
    COALESCE(auth_session.permissions, '[]'::jsonb)
  INTO v_role, v_session_tenant_id, v_session_permissions
  FROM auth_sessions auth_session
  JOIN users actor ON actor.id = auth_session.user_id
  JOIN memberships membership
    ON membership.user_id = actor.id
   AND membership.role = auth_session.role
   AND membership.tenant_id IS NOT DISTINCT FROM auth_session.tenant_id
  WHERE auth_session.id = p_auth_session_id
    AND auth_session.user_id = p_actor_id
    AND auth_session.revoked_at IS NULL
    AND auth_session.expires_at > now()
    AND actor.admin_status::text = 'active'
    AND (p_action <> 'qa.approve' OR auth_session.mfa_verified = true);
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_role = 'super_admin' AND v_session_tenant_id IS NULL THEN
    RETURN true;
  END IF;
  IF v_session_tenant_id IS DISTINCT FROM p_tenant_id THEN RETURN false; END IF;

  v_allowed_role := CASE p_action
    WHEN 'packaging_lab.manage' THEN v_role IN ('tenant_owner', 'tenant_admin', 'operations_manager', 'packaging_operator')
    WHEN 'qa.approve' THEN v_role IN ('tenant_owner', 'tenant_admin', 'operations_manager')
    ELSE false
  END;
  IF NOT v_allowed_role THEN RETURN false; END IF;

  -- 0087 can run before the enterprise role catalog exists. Once 0088 is
  -- present, read its live defaults dynamically so role-policy revocations are
  -- honored without making this migration depend on a later relation.
  IF to_regclass('public.enterprise_role_profiles') IS NOT NULL THEN
    EXECUTE $role_permissions$
      SELECT COALESCE(default_permissions, '[]'::jsonb)
      FROM public.enterprise_role_profiles
      WHERE code = $1 AND active = true AND human_session_allowed = true
    $role_permissions$ INTO v_role_permissions USING v_role;
    v_role_permissions := COALESCE(v_role_permissions, '[]'::jsonb);
  END IF;

  v_allowed_permission := CASE p_action
    WHEN 'packaging_lab.manage' THEN
      (v_session_permissions || v_role_permissions) ?| ARRAY['packaging_lab.manage', 'supplier:packaging_lab_manage']
      OR EXISTS (
        SELECT 1 FROM resource_permissions permission
        WHERE permission.user_id = p_actor_id AND permission.effect = 'allow'
          AND ((permission.resource = 'supplier' AND permission.action IN ('packaging_lab_manage', '*'))
            OR (permission.resource = '*' AND permission.action = '*'))
      )
    WHEN 'qa.approve' THEN
      (v_session_permissions || v_role_permissions) ?| ARRAY['qa.approve', 'supplier:qa_approve']
      OR EXISTS (
        SELECT 1 FROM resource_permissions permission
        WHERE permission.user_id = p_actor_id AND permission.effect = 'allow'
          AND ((permission.resource = 'supplier' AND permission.action IN ('qa_approve', '*'))
            OR (permission.resource = '*' AND permission.action = '*'))
      )
    ELSE false
  END;
  RETURN v_allowed_permission;
END;
$authorized$;

CREATE OR REPLACE FUNCTION public.nexid_packaging_lab_override_authorized_v1(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_auth_session_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $override_authorized$
DECLARE
  v_role text;
  v_session_tenant_id uuid;
  v_permissions jsonb := '[]'::jsonb;
BEGIN
  IF public.nexid_packaging_lab_permission_denied_v1(
    p_actor_id, 'supplier:packaging_lab_override'
  ) THEN
    RETURN false;
  END IF;
  SELECT auth_session.role::text, auth_session.tenant_id,
    COALESCE(auth_session.permissions, '[]'::jsonb)
  INTO v_role, v_session_tenant_id, v_permissions
  FROM auth_sessions auth_session
  JOIN users actor ON actor.id = auth_session.user_id
  JOIN memberships membership
    ON membership.user_id = actor.id
   AND membership.role = auth_session.role
   AND membership.tenant_id IS NOT DISTINCT FROM auth_session.tenant_id
  WHERE auth_session.id = p_auth_session_id
    AND auth_session.user_id = p_actor_id
    AND auth_session.revoked_at IS NULL
    AND auth_session.expires_at > now()
    AND auth_session.mfa_verified = true
    AND actor.admin_status::text = 'active';
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_role = 'super_admin' AND v_session_tenant_id IS NULL THEN RETURN true; END IF;
  IF v_session_tenant_id IS DISTINCT FROM p_tenant_id
    OR v_role NOT IN ('tenant_owner', 'tenant_admin', 'operations_manager') THEN
    RETURN false;
  END IF;
  RETURN v_permissions ?| ARRAY['supplier:packaging_lab_override'] OR EXISTS (
    SELECT 1 FROM resource_permissions permission
    WHERE permission.user_id = p_actor_id
      AND permission.effect = 'allow'
      AND ((permission.resource = 'supplier' AND permission.action IN ('packaging_lab_override', '*'))
        OR (permission.resource = '*' AND permission.action = '*'))
  );
END;
$override_authorized$;

CREATE OR REPLACE FUNCTION public.nexid_packaging_evidence_refs_safe_v1(p_refs text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $safe_refs$
  SELECT COALESCE(cardinality(p_refs), 0) <= 24
    AND NOT EXISTS (
      SELECT 1 FROM unnest(COALESCE(p_refs, ARRAY[]::text[])) ref(value)
      WHERE char_length(BTRIM(ref.value)) NOT BETWEEN 1 AND 2048
        OR ref.value ~* '(K_META|K_FILE|PRIVATE_KEY|DATABASE_URL|[?&](picc_data|enc|cmac|key|secret|token)=)'
        OR ref.value !~* '^((evidence|vault|sha256):[A-Za-z0-9._:/-]+|https://[^/?#[:space:]@]+(:[0-9]{1,5})?(/[^?#[:space:]]*)?)$'
    )
$safe_refs$;

ALTER TABLE packaging_placements
  DROP CONSTRAINT IF EXISTS packaging_placement_evidence_safe_check;
ALTER TABLE packaging_placements
  ADD CONSTRAINT packaging_placement_evidence_safe_check
  CHECK (
    placement_image_url IS NULL
    OR public.nexid_packaging_evidence_refs_safe_v1(ARRAY[placement_image_url])
  );

ALTER TABLE packaging_lab_test_cases
  DROP CONSTRAINT IF EXISTS packaging_lab_test_evidence_safe_check;
ALTER TABLE packaging_lab_test_cases
  ADD CONSTRAINT packaging_lab_test_evidence_safe_check
  CHECK (public.nexid_packaging_evidence_refs_safe_v1(evidence_urls));

CREATE OR REPLACE FUNCTION public.nexid_guard_packaging_placement_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $placement_guard$
DECLARE
  v_profile text;
BEGIN
  SELECT spec.carrier_profile_code INTO v_profile
  FROM packaging_carrier_specs spec
  WHERE spec.id = NEW.carrier_spec_id AND spec.tenant_id = NEW.tenant_id
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'packaging_carrier_spec_tenant_scope_invalid';
  END IF;
  IF v_profile <> 'ntag424_dna_tt' AND (NEW.crosses_opening OR NEW.requires_tail_break) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'packaging_non_tt_tamper_claim_forbidden';
  END IF;
  IF v_profile = 'ntag424_dna_tt' AND NEW.validated
    AND (NOT NEW.crosses_opening OR NOT NEW.requires_tail_break) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'packaging_tt_opening_placement_required';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'packaging_placement_revision_conflict';
  END IF;
  IF TG_OP = 'UPDATE' AND EXISTS (
    SELECT 1 FROM packaging_lab_projects project
    WHERE project.placement_id = OLD.id AND project.status IN ('APPROVED', 'ARCHIVED')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'approved_packaging_placement_is_frozen';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$placement_guard$;

DROP TRIGGER IF EXISTS trg_packaging_placement_guard ON packaging_placements;
CREATE TRIGGER trg_packaging_placement_guard
  BEFORE INSERT OR UPDATE ON packaging_placements
  FOR EACH ROW EXECUTE FUNCTION public.nexid_guard_packaging_placement_v1();

CREATE OR REPLACE FUNCTION public.nexid_guard_packaging_carrier_spec_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $carrier_spec_guard$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.carrier_profile_code IS DISTINCT FROM OLD.carrier_profile_code THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'packaging_carrier_identity_is_immutable';
    END IF;
    IF NEW.revision <> OLD.revision + 1 THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'packaging_carrier_spec_revision_conflict';
    END IF;
    IF EXISTS (
      SELECT 1 FROM packaging_lab_projects project
      WHERE project.carrier_spec_id = OLD.id AND project.status IN ('APPROVED', 'ARCHIVED')
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'approved_packaging_carrier_spec_is_frozen';
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$carrier_spec_guard$;

DROP TRIGGER IF EXISTS trg_packaging_carrier_spec_guard ON packaging_carrier_specs;
CREATE TRIGGER trg_packaging_carrier_spec_guard
  BEFORE UPDATE ON packaging_carrier_specs
  FOR EACH ROW EXECUTE FUNCTION public.nexid_guard_packaging_carrier_spec_v1();

CREATE OR REPLACE FUNCTION public.nexid_guard_packaging_lab_test_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $test_guard$
DECLARE
  v_status text;
BEGIN
  SELECT project.status INTO v_status
  FROM packaging_lab_projects project
  WHERE project.id = COALESCE(NEW.project_id, OLD.project_id)
    AND project.tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id)
  FOR SHARE;
  IF v_status IN ('APPROVED', 'ARCHIVED') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'approved_packaging_lab_tests_are_frozen';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$test_guard$;

DROP TRIGGER IF EXISTS trg_packaging_lab_test_mutation_guard ON packaging_lab_test_cases;
CREATE TRIGGER trg_packaging_lab_test_mutation_guard
  BEFORE UPDATE OR DELETE ON packaging_lab_test_cases
  FOR EACH ROW EXECUTE FUNCTION public.nexid_guard_packaging_lab_test_mutation_v1();

CREATE OR REPLACE FUNCTION public.nexid_create_packaging_lab_project_v1(p_input jsonb)
RETURNS TABLE (
  project_id uuid,
  carrier_spec_id uuid,
  placement_id uuid,
  status text,
  test_count integer,
  idempotent_replay boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $create_project$
DECLARE
  v_tenant_id uuid;
  v_supplier_order_id uuid;
  v_actor_id uuid;
  v_auth_session_id uuid;
  v_owner_user_id uuid;
  v_existing_spec_id uuid;
  v_existing_placement_id uuid;
  v_spec_id uuid;
  v_placement_id uuid;
  v_project_id uuid := gen_random_uuid();
  v_operation_key text;
  v_profile text;
  v_packaging_type text;
  v_template_code text;
  v_product_id text;
  v_sku text;
  v_spec jsonb;
  v_tests jsonb;
  v_required_codes text[];
  v_fingerprint text;
  v_existing packaging_lab_operations%ROWTYPE;
  v_result jsonb;
  v_test_count integer;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR octet_length(p_input::text) > 524288 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'packaging_lab_input_invalid';
  END IF;
  BEGIN
    v_tenant_id := NULLIF(BTRIM(p_input->>'tenant_id'), '')::uuid;
    v_supplier_order_id := NULLIF(BTRIM(p_input->>'supplier_order_id'), '')::uuid;
    v_actor_id := NULLIF(BTRIM(p_input->>'actor_id'), '')::uuid;
    v_auth_session_id := NULLIF(BTRIM(p_input->>'auth_session_id'), '')::uuid;
    v_owner_user_id := NULLIF(BTRIM(p_input->>'owner_user_id'), '')::uuid;
    v_existing_spec_id := NULLIF(BTRIM(p_input->>'carrier_spec_id'), '')::uuid;
    v_existing_placement_id := NULLIF(BTRIM(p_input->>'placement_id'), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'packaging_lab_identity_invalid';
  END;
  v_operation_key := BTRIM(COALESCE(p_input->>'operation_key', ''));
  v_profile := LOWER(BTRIM(COALESCE(p_input->>'carrier_profile_code', '')));
  v_packaging_type := LOWER(BTRIM(COALESCE(p_input->>'packaging_type', '')));
  v_template_code := LOWER(BTRIM(COALESCE(p_input->>'template_code', '')));
  v_product_id := NULLIF(BTRIM(p_input->>'product_id'), '');
  v_sku := NULLIF(BTRIM(p_input->>'sku'), '');
  v_spec := p_input->'carrier_spec';
  v_tests := p_input->'template_tests';

  IF v_tenant_id IS NULL OR v_supplier_order_id IS NULL OR v_actor_id IS NULL
    OR v_auth_session_id IS NULL OR v_owner_user_id IS NULL
    OR v_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
    OR v_profile = ''
    OR v_packaging_type NOT IN ('seed_bag', 'woven_bag', 'laminated_bag', 'jerry_can', 'cap', 'box', 'pallet', 'other')
    OR v_template_code NOT IN ('seed_bag', 'jerry_can', 'roll_line', 'custom')
    OR (v_product_id IS NULL AND v_sku IS NULL)
    OR jsonb_typeof(v_tests) IS DISTINCT FROM 'array'
    OR jsonb_array_length(v_tests) < 1
    OR jsonb_array_length(v_tests) > 40 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'packaging_lab_contract_invalid';
  END IF;
  IF NOT public.nexid_packaging_lab_actor_authorized_v1(v_tenant_id, v_actor_id, v_auth_session_id, 'packaging_lab.manage') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'packaging_lab_actor_scope_invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM users owner_user
    JOIN memberships owner_membership
      ON owner_membership.user_id = owner_user.id
     AND owner_membership.tenant_id = v_tenant_id
    WHERE owner_user.id = v_owner_user_id
      AND owner_user.admin_status::text = 'active'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'packaging_lab_owner_active_tenant_membership_required';
  END IF;

  PERFORM 1
  FROM supplier_orders supplier_order
  WHERE supplier_order.id = v_supplier_order_id
    AND supplier_order.tenant_id = v_tenant_id
    AND LOWER(supplier_order.carrier_profile_code) = v_profile
    AND supplier_order.packaging_governance_status = 'approved'
    AND supplier_order.packaging_spec_revision = (p_input->>'approved_packaging_revision')::integer
    AND supplier_order.packaging_spec_hash = LOWER(p_input->>'approved_packaging_hash')
  FOR UPDATE OF supplier_order;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'approved_supplier_packaging_snapshot_required';
  END IF;

  v_required_codes := CASE v_template_code
    WHEN 'seed_bag' THEN ARRAY['substrate_identification', 'flat_zone_placement', 'filled_bag_read', 'label_inlay_integration', 'mobile_device_matrix', 'line_application']
    WHEN 'jerry_can' THEN ARRAY['substrate_identification', 'filled_empty_read', 'body_label_read', 'cap_geometry', 'curved_surface_adhesion', 'post_open_readability', 'line_application']
    WHEN 'roll_line' THEN ARRAY['roll_core', 'web_width', 'pitch', 'unwind_direction', 'die_cut_tolerance', 'application_speed', 'reject_handling', 'operator_instructions']
    ELSE ARRAY['substrate_identification', 'custom_rf_validation', 'mobile_device_matrix']
  END;
  IF v_profile IN ('ntag424_dna', 'ntag424_dna_tt') THEN
    v_required_codes := v_required_codes || ARRAY['secure_sample_validates', 'replay_rejected'];
  END IF;
  IF v_profile = 'ntag424_dna_tt' THEN
    v_required_codes := v_required_codes || ARRAY['tt_closed', 'tt_opened'];
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(v_required_codes) required(code)
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_tests) test(value)
      WHERE test.value->>'code' = required.code
        AND COALESCE((test.value->>'required')::boolean, false)
    )
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_tests) test(value)
    WHERE test.value->>'code' !~ '^[a-z][a-z0-9_]{2,79}$'
      OR test.value->>'category' NOT IN ('MATERIAL', 'ADHESION', 'RF', 'CRYPTO', 'LINE', 'ENVIRONMENT', 'UX')
      OR NULLIF(BTRIM(test.value->>'name'), '') IS NULL
      OR NULLIF(BTRIM(test.value->>'method'), '') IS NULL
      OR NULLIF(BTRIM(test.value->>'target'), '') IS NULL
  ) OR (
    SELECT count(*) FROM jsonb_array_elements(v_tests) test(value)
  ) <> (
    SELECT count(DISTINCT test.value->>'code') FROM jsonb_array_elements(v_tests) test(value)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'packaging_lab_test_template_invalid';
  END IF;

  v_fingerprint := 'sha256:' || encode(digest(jsonb_build_object(
    'schema_version', 'packaging-lab-create/v1',
    'tenant_id', v_tenant_id,
    'supplier_order_id', v_supplier_order_id,
    'carrier_profile_code', v_profile,
    'carrier_spec_id', v_existing_spec_id,
    'placement_id', v_existing_placement_id,
    'carrier_spec', v_spec,
    'product_id', v_product_id,
    'sku', v_sku,
    'packaging_type', v_packaging_type,
    'placement_zone', BTRIM(p_input->>'placement_zone'),
    'crosses_opening', COALESCE((p_input->>'crosses_opening')::boolean, false),
    'requires_tail_break', COALESCE((p_input->>'requires_tail_break')::boolean, false),
    'objective', BTRIM(p_input->>'objective'),
    'owner_user_id', v_owner_user_id,
    'template_code', v_template_code,
    'template_tests', v_tests
  )::text, 'sha256'), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'packaging-lab-operation' || chr(31) || v_tenant_id::text || chr(31) || v_operation_key, 0
  ));
  SELECT operation.* INTO v_existing
  FROM packaging_lab_operations operation
  WHERE operation.tenant_id = v_tenant_id AND operation.operation_key = v_operation_key;
  IF FOUND THEN
    IF v_existing.operation_type <> 'create_project' OR v_existing.request_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'packaging_lab_idempotency_conflict';
    END IF;
    RETURN QUERY SELECT
      (v_existing.result_json->>'project_id')::uuid,
      (v_existing.result_json->>'carrier_spec_id')::uuid,
      (v_existing.result_json->>'placement_id')::uuid,
      v_existing.result_json->>'status',
      (v_existing.result_json->>'test_count')::integer,
      true;
    RETURN;
  END IF;

  IF v_existing_spec_id IS NOT NULL THEN
    SELECT spec.id INTO v_spec_id
    FROM packaging_carrier_specs spec
    WHERE spec.id = v_existing_spec_id
      AND spec.tenant_id = v_tenant_id
      AND spec.carrier_profile_code = v_profile
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'packaging_carrier_spec_tenant_scope_invalid';
    END IF;
  ELSE
    IF jsonb_typeof(v_spec) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'packaging_carrier_spec_required';
    END IF;
    INSERT INTO packaging_carrier_specs (
      tenant_id, name, carrier_profile_code, delivery_format,
      antenna_width_mm, antenna_height_mm, die_cut_width_mm, die_cut_height_mm,
      total_thickness_mm, adhesive_code, adhesive_description, liner_type,
      roll_core_mm, pitch_mm, web_width_mm, unwind_direction,
      target_substrates, forbidden_conditions, metal_clearance_mm,
      operating_temperature, humidity_test_required, chemical_test_required,
      abrasion_test_required, assurance_model, tamper_evidence_mode,
      key_material_policy, notes, created_by
    ) VALUES (
      v_tenant_id, BTRIM(v_spec->>'name'), v_profile, v_spec->>'delivery_format',
      NULLIF(v_spec->>'antenna_width_mm', '')::numeric,
      NULLIF(v_spec->>'antenna_height_mm', '')::numeric,
      NULLIF(v_spec->>'die_cut_width_mm', '')::numeric,
      NULLIF(v_spec->>'die_cut_height_mm', '')::numeric,
      NULLIF(v_spec->>'total_thickness_mm', '')::numeric,
      NULLIF(BTRIM(v_spec->>'adhesive_code'), ''),
      NULLIF(BTRIM(v_spec->>'adhesive_description'), ''),
      NULLIF(BTRIM(v_spec->>'liner_type'), ''),
      NULLIF(v_spec->>'roll_core_mm', '')::numeric,
      NULLIF(v_spec->>'pitch_mm', '')::numeric,
      NULLIF(v_spec->>'web_width_mm', '')::numeric,
      NULLIF(BTRIM(v_spec->>'unwind_direction'), ''),
      ARRAY(SELECT BTRIM(value) FROM jsonb_array_elements_text(COALESCE(v_spec->'target_substrates', '[]'::jsonb)) value WHERE BTRIM(value) <> ''),
      ARRAY(SELECT BTRIM(value) FROM jsonb_array_elements_text(COALESCE(v_spec->'forbidden_conditions', '[]'::jsonb)) value WHERE BTRIM(value) <> ''),
      NULLIF(v_spec->>'metal_clearance_mm', '')::numeric,
      COALESCE(v_spec->'operating_temperature', '{}'::jsonb),
      COALESCE((v_spec->>'humidity_test_required')::boolean, false),
      COALESCE((v_spec->>'chemical_test_required')::boolean, false),
      COALESCE((v_spec->>'abrasion_test_required')::boolean, false),
      CASE
        WHEN v_profile = 'ntag424_dna_tt' THEN 'sun_sdm_tamper'
        WHEN v_profile = 'ntag424_dna' THEN 'sun_sdm'
        WHEN v_profile IN ('qr_basic', 'gs1_digital_link') THEN 'declared_identity'
        WHEN v_profile = 'uhf_rfid' THEN 'declared_logistics'
        WHEN v_profile = 'iot_tracker_placeholder' THEN 'sensor_evidence'
        ELSE 'server_uid'
      END,
      CASE WHEN v_profile = 'ntag424_dna_tt'
        THEN 'ttstatus_2byte_or_explicit_manual_evidence' ELSE 'none' END,
      CASE WHEN v_profile IN ('ntag424_dna', 'ntag424_dna_tt') THEN 'batch_sun' ELSE 'none' END,
      NULLIF(BTRIM(v_spec->>'notes'), ''), v_actor_id
    ) RETURNING id INTO v_spec_id;
  END IF;

  IF v_existing_placement_id IS NOT NULL THEN
    SELECT placement.id INTO v_placement_id
    FROM packaging_placements placement
    WHERE placement.id = v_existing_placement_id
      AND placement.tenant_id = v_tenant_id
      AND placement.carrier_spec_id = v_spec_id
      AND placement.packaging_type = v_packaging_type
      AND placement.product_id IS NOT DISTINCT FROM v_product_id
      AND placement.sku IS NOT DISTINCT FROM v_sku
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'packaging_placement_tenant_scope_invalid';
    END IF;
  ELSE
    INSERT INTO packaging_placements (
      tenant_id, product_id, sku, packaging_type, carrier_spec_id,
      placement_zone, placement_image_url, crosses_opening,
      requires_tail_break, validated, created_by
    ) VALUES (
      v_tenant_id, v_product_id, v_sku, v_packaging_type, v_spec_id,
      BTRIM(p_input->>'placement_zone'), NULLIF(BTRIM(p_input->>'placement_image_url'), ''),
      COALESCE((p_input->>'crosses_opening')::boolean, false),
      COALESCE((p_input->>'requires_tail_break')::boolean, false),
      false, v_actor_id
    ) RETURNING id INTO v_placement_id;
  END IF;

  INSERT INTO packaging_lab_projects (
    id, tenant_id, supplier_order_id, carrier_spec_id, placement_id,
    product_id, sku, packaging_type, template_code, objective,
    owner_user_id, approved_packaging_revision, approved_packaging_hash
  ) VALUES (
    v_project_id, v_tenant_id, v_supplier_order_id, v_spec_id, v_placement_id,
    v_product_id, v_sku, v_packaging_type, v_template_code,
    BTRIM(p_input->>'objective'), v_owner_user_id,
    (p_input->>'approved_packaging_revision')::integer,
    LOWER(p_input->>'approved_packaging_hash')
  );

  INSERT INTO packaging_lab_test_cases (
    tenant_id, project_id, sequence, code, category, name, method,
    target, required, waiver_allowed
  )
  SELECT
    v_tenant_id, v_project_id, (test.value->>'sequence')::integer,
    test.value->>'code', test.value->>'category', test.value->>'name',
    test.value->>'method', test.value->>'target',
    COALESCE((test.value->>'required')::boolean, true),
    COALESCE((test.value->>'waiverAllowed')::boolean, false)
  FROM jsonb_array_elements(v_tests) test(value);
  GET DIAGNOSTICS v_test_count = ROW_COUNT;

  UPDATE supplier_orders supplier_order
  SET packaging_carrier_spec_id = v_spec_id, updated_at = now()
  WHERE supplier_order.id = v_supplier_order_id AND supplier_order.tenant_id = v_tenant_id;

  v_result := jsonb_build_object(
    'project_id', v_project_id,
    'carrier_spec_id', v_spec_id,
    'placement_id', v_placement_id,
    'status', 'DRAFT',
    'test_count', v_test_count
  );
  INSERT INTO packaging_lab_operations (
    tenant_id, operation_key, operation_type, request_fingerprint,
    result_json, actor_id
  ) VALUES (
    v_tenant_id, v_operation_key, 'create_project', v_fingerprint,
    v_result, v_actor_id
  );
  INSERT INTO audit_logs (
    actor_id, tenant_id, action, resource_type, resource_id, after_hash
  ) VALUES (
    v_actor_id, v_tenant_id, 'packaging_lab_project_created',
    'packaging_lab_project', v_project_id::text,
    replace(v_fingerprint, 'sha256:', '')
  );

  RETURN QUERY SELECT v_project_id, v_spec_id, v_placement_id, 'DRAFT'::text, v_test_count, false;
EXCEPTION
  WHEN invalid_text_representation OR numeric_value_out_of_range OR invalid_parameter_value THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'packaging_lab_input_type_invalid';
END;
$create_project$;

CREATE OR REPLACE FUNCTION public.nexid_record_packaging_lab_test_v1(p_input jsonb)
RETURNS TABLE (
  test_case_id uuid,
  project_id uuid,
  status text,
  version integer,
  tested_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $record_test$
DECLARE
  v_tenant_id uuid;
  v_project_id uuid;
  v_test_case_id uuid;
  v_actor_id uuid;
  v_auth_session_id uuid;
  v_expected_version integer;
  v_status text;
  v_result text;
  v_evidence text[];
  v_row packaging_lab_test_cases%ROWTYPE;
BEGIN
  BEGIN
    v_tenant_id := NULLIF(BTRIM(p_input->>'tenant_id'), '')::uuid;
    v_project_id := NULLIF(BTRIM(p_input->>'project_id'), '')::uuid;
    v_test_case_id := NULLIF(BTRIM(p_input->>'test_case_id'), '')::uuid;
    v_actor_id := NULLIF(BTRIM(p_input->>'actor_id'), '')::uuid;
    v_auth_session_id := NULLIF(BTRIM(p_input->>'auth_session_id'), '')::uuid;
    v_expected_version := NULLIF(BTRIM(p_input->>'expected_version'), '')::integer;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'packaging_lab_test_input_invalid';
  END;
  v_status := UPPER(BTRIM(COALESCE(p_input->>'status', '')));
  v_result := NULLIF(BTRIM(p_input->>'result'), '');
  IF v_status NOT IN ('PENDING', 'PASS', 'FAIL', 'WAIVED')
    OR v_expected_version IS NULL OR v_expected_version < 1
    OR (v_status <> 'PENDING' AND v_result IS NULL)
    OR jsonb_typeof(COALESCE(p_input->'evidence_urls', '[]'::jsonb)) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'packaging_lab_test_contract_invalid';
  END IF;
  SELECT COALESCE(array_agg(value), ARRAY[]::text[]) INTO v_evidence
  FROM jsonb_array_elements_text(COALESCE(p_input->'evidence_urls', '[]'::jsonb)) value;
  IF NOT public.nexid_packaging_evidence_refs_safe_v1(v_evidence) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'packaging_lab_test_evidence_unsafe';
  END IF;
  IF NOT public.nexid_packaging_lab_actor_authorized_v1(v_tenant_id, v_actor_id, v_auth_session_id, 'packaging_lab.manage') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'packaging_lab_actor_scope_invalid';
  END IF;

  UPDATE packaging_lab_test_cases test
  SET status = v_status,
      result = CASE WHEN v_status = 'PENDING' THEN NULL ELSE v_result END,
      evidence_urls = v_evidence,
      operator_id = CASE WHEN v_status = 'PENDING' THEN NULL ELSE v_actor_id END,
      tested_at = CASE WHEN v_status = 'PENDING' THEN NULL ELSE now() END,
      version = test.version + 1,
      updated_at = now()
  WHERE test.id = v_test_case_id
    AND test.project_id = v_project_id
    AND test.tenant_id = v_tenant_id
    AND test.version = v_expected_version
    AND (v_status <> 'WAIVED' OR test.waiver_allowed)
    AND EXISTS (
      SELECT 1 FROM packaging_lab_projects project
      WHERE project.id = test.project_id
        AND project.tenant_id = test.tenant_id
        AND project.status IN ('DRAFT', 'MATERIALS_PENDING', 'TESTING', 'FAILED')
    )
  RETURNING test.* INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'packaging_lab_test_revision_or_scope_conflict';
  END IF;

  UPDATE packaging_lab_projects project
  SET status = 'TESTING', updated_at = now()
  WHERE project.id = v_project_id
    AND project.tenant_id = v_tenant_id
    AND project.status IN ('DRAFT', 'MATERIALS_PENDING', 'FAILED');
  INSERT INTO audit_logs (
    actor_id, tenant_id, action, resource_type, resource_id, request_id
  ) VALUES (
    v_actor_id, v_tenant_id, 'packaging_lab_test_' || LOWER(v_status),
    'packaging_lab_test_case', v_test_case_id::text,
    NULLIF(BTRIM(p_input->>'request_id'), '')
  );
  RETURN QUERY SELECT v_row.id, v_row.project_id, v_row.status, v_row.version, v_row.tested_at;
END;
$record_test$;

CREATE OR REPLACE FUNCTION public.nexid_packaging_lab_tests_digest_v1(p_project_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $tests_digest$
  SELECT 'sha256:' || encode(digest(COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', test.id,
      'sequence', test.sequence,
      'code', test.code,
      'category', test.category,
      'name', test.name,
      'method', test.method,
      'target', test.target,
      'result', test.result,
      'status', test.status,
      'evidence_urls', to_jsonb(test.evidence_urls),
      'required', test.required,
      'waiver_allowed', test.waiver_allowed,
      'operator_id', test.operator_id,
      'tested_at', test.tested_at,
      'version', test.version
    ) ORDER BY test.sequence
  ), '[]'::jsonb)::text, 'sha256'), 'hex')
  FROM packaging_lab_test_cases test
  WHERE test.project_id = p_project_id
$tests_digest$;

CREATE OR REPLACE FUNCTION public.nexid_decide_packaging_lab_project_v1(p_input jsonb)
RETURNS TABLE (
  project_id uuid,
  decision text,
  approval_id uuid,
  receipt_digest text,
  decided_at timestamptz,
  idempotent_replay boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $decide_project$
DECLARE
  v_tenant_id uuid;
  v_project_id uuid;
  v_actor_id uuid;
  v_auth_session_id uuid;
  v_operation_key text;
  v_decision text;
  v_reason text;
  v_recommendation text;
  v_override boolean;
  v_override_reason text;
  v_fingerprint text;
  v_existing packaging_lab_operations%ROWTYPE;
  v_project packaging_lab_projects%ROWTYPE;
  v_spec packaging_carrier_specs%ROWTYPE;
  v_placement packaging_placements%ROWTYPE;
  v_order supplier_orders%ROWTYPE;
  v_tests jsonb;
  v_tests_digest text;
  v_approval_id uuid := gen_random_uuid();
  v_receipt_digest text;
  v_decided_at timestamptz := now();
  v_result jsonb;
  v_lock_supplier_order_id uuid;
BEGIN
  BEGIN
    v_tenant_id := NULLIF(BTRIM(p_input->>'tenant_id'), '')::uuid;
    v_project_id := NULLIF(BTRIM(p_input->>'project_id'), '')::uuid;
    v_actor_id := NULLIF(BTRIM(p_input->>'actor_id'), '')::uuid;
    v_auth_session_id := NULLIF(BTRIM(p_input->>'auth_session_id'), '')::uuid;
    v_override := COALESCE((p_input->>'override')::boolean, false);
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'packaging_lab_decision_input_invalid';
  END;
  v_operation_key := BTRIM(COALESCE(p_input->>'operation_key', ''));
  v_decision := UPPER(BTRIM(COALESCE(p_input->>'decision', '')));
  v_reason := NULLIF(BTRIM(p_input->>'reason'), '');
  v_recommendation := NULLIF(BTRIM(p_input->>'recommendation'), '');
  v_override_reason := NULLIF(BTRIM(p_input->>'override_reason'), '');
  IF v_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
    OR v_decision NOT IN ('APPROVE', 'FAIL', 'ARCHIVE')
    OR (v_decision <> 'APPROVE' AND v_reason IS NULL)
    OR (v_override IS DISTINCT FROM (v_override_reason IS NOT NULL))
    OR (v_override AND char_length(v_override_reason) < 16) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'packaging_lab_decision_contract_invalid';
  END IF;
  IF NOT public.nexid_packaging_lab_actor_authorized_v1(v_tenant_id, v_actor_id, v_auth_session_id, 'qa.approve') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'packaging_lab_approver_scope_invalid';
  END IF;
  IF v_override AND NOT public.nexid_packaging_lab_override_authorized_v1(
    v_tenant_id, v_actor_id, v_auth_session_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'packaging_lab_override_forbidden';
  END IF;

  v_fingerprint := 'sha256:' || encode(digest(jsonb_build_object(
    'schema_version', 'packaging-lab-decision/v1',
    'tenant_id', v_tenant_id,
    'project_id', v_project_id,
    'actor_id', v_actor_id,
    'decision', v_decision,
    'reason', v_reason,
    'recommendation', v_recommendation,
    'override', v_override,
    'override_reason', v_override_reason
  )::text, 'sha256'), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'packaging-lab-operation' || chr(31) || v_tenant_id::text || chr(31) || v_operation_key, 0
  ));
  SELECT operation.* INTO v_existing
  FROM packaging_lab_operations operation
  WHERE operation.tenant_id = v_tenant_id AND operation.operation_key = v_operation_key;
  IF FOUND THEN
    IF v_existing.operation_type <> 'decide_project' OR v_existing.request_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'packaging_lab_idempotency_conflict';
    END IF;
    RETURN QUERY SELECT
      (v_existing.result_json->>'project_id')::uuid,
      v_existing.result_json->>'decision',
      NULLIF(v_existing.result_json->>'approval_id', '')::uuid,
      NULLIF(v_existing.result_json->>'receipt_digest', ''),
      (v_existing.result_json->>'decided_at')::timestamptz,
      true;
    RETURN;
  END IF;

  -- Every approval/rejection/archive transition takes the exclusive side of
  -- the same order-scoped lock used by activation receipts. Derive the key
  -- from trusted database state, then re-read and row-lock the project after
  -- acquiring it so a concurrent activation cannot observe a stale approval.
  SELECT project.supplier_order_id INTO v_lock_supplier_order_id
  FROM packaging_lab_projects project
  WHERE project.id = v_project_id AND project.tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'packaging_lab_project_not_found';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'packaging-lab-order' || chr(31) || v_lock_supplier_order_id::text, 0
  ));

  SELECT project.* INTO v_project
  FROM packaging_lab_projects project
  WHERE project.id = v_project_id AND project.tenant_id = v_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'packaging_lab_project_not_found';
  END IF;
  IF v_decision = 'APPROVE' AND v_project.status <> 'TESTING' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'packaging_lab_testing_status_required';
  END IF;
  IF v_decision = 'FAIL' AND v_project.status NOT IN ('DRAFT', 'MATERIALS_PENDING', 'TESTING', 'FAILED') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'packaging_lab_decision_transition_invalid';
  END IF;
  IF v_decision = 'ARCHIVE' AND v_project.status NOT IN ('FAILED', 'APPROVED') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'packaging_lab_decision_transition_invalid';
  END IF;

  IF v_decision = 'APPROVE' THEN
    SELECT spec.* INTO v_spec
    FROM packaging_carrier_specs spec
    WHERE spec.id = v_project.carrier_spec_id AND spec.tenant_id = v_tenant_id
    FOR SHARE;
    SELECT placement.* INTO v_placement
    FROM packaging_placements placement
    WHERE placement.id = v_project.placement_id
      AND placement.tenant_id = v_tenant_id
      AND placement.carrier_spec_id = v_spec.id
    FOR UPDATE;
    SELECT supplier_order.* INTO v_order
    FROM supplier_orders supplier_order
    WHERE supplier_order.id = v_project.supplier_order_id
      AND supplier_order.tenant_id = v_tenant_id
    FOR UPDATE;
    IF v_spec.id IS NULL OR v_placement.id IS NULL OR v_order.id IS NULL
      OR v_order.packaging_carrier_spec_id IS DISTINCT FROM v_spec.id
      OR LOWER(v_order.carrier_profile_code) IS DISTINCT FROM v_spec.carrier_profile_code
      OR v_order.packaging_governance_status <> 'approved'
      OR v_order.packaging_spec_revision IS DISTINCT FROM v_project.approved_packaging_revision
      OR v_order.packaging_spec_hash IS DISTINCT FROM v_project.approved_packaging_hash
      OR v_placement.packaging_type IS DISTINCT FROM v_project.packaging_type
      OR v_placement.product_id IS DISTINCT FROM v_project.product_id
      OR v_placement.sku IS DISTINCT FROM v_project.sku THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'packaging_lab_current_binding_invalid';
    END IF;
    IF v_spec.carrier_profile_code <> 'ntag424_dna_tt'
      AND (v_placement.crosses_opening OR v_placement.requires_tail_break) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'packaging_non_tt_tamper_claim_forbidden';
    END IF;
    IF v_spec.carrier_profile_code = 'ntag424_dna_tt'
      AND (NOT v_placement.crosses_opening OR NOT v_placement.requires_tail_break) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'packaging_tt_opening_placement_required';
    END IF;
    IF v_project.owner_user_id = v_actor_id AND NOT v_override THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'packaging_lab_approval_separation_required';
    END IF;
    IF v_project.owner_user_id <> v_actor_id AND v_override THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'packaging_lab_override_not_applicable';
    END IF;
    IF EXISTS (
      SELECT 1 FROM packaging_lab_test_cases test
      WHERE test.project_id = v_project.id
        AND test.required
        AND test.status IN ('PENDING', 'FAIL')
    ) OR EXISTS (
      SELECT 1 FROM packaging_lab_test_cases test
      WHERE test.project_id = v_project.id
        AND test.required
        AND test.status = 'WAIVED'
        AND NOT v_override
    ) OR EXISTS (
      SELECT 1 FROM packaging_lab_test_cases test
      WHERE test.project_id = v_project.id
        AND test.code IN ('substrate_identification', 'secure_sample_validates', 'replay_rejected', 'tt_closed', 'tt_opened')
        AND test.status <> 'PASS'
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'packaging_lab_required_tests_not_passed';
    END IF;
    IF v_spec.carrier_profile_code IN ('ntag424_dna', 'ntag424_dna_tt') AND NOT EXISTS (
      SELECT 1 FROM packaging_lab_test_cases test
      WHERE test.project_id = v_project.id AND test.code = 'secure_sample_validates' AND test.status = 'PASS'
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'packaging_lab_secure_sample_required';
    END IF;
    IF v_spec.carrier_profile_code IN ('ntag424_dna', 'ntag424_dna_tt') AND NOT EXISTS (
      SELECT 1 FROM packaging_lab_test_cases test
      WHERE test.project_id = v_project.id AND test.code = 'replay_rejected' AND test.status = 'PASS'
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'packaging_lab_replay_test_required';
    END IF;
    IF v_spec.carrier_profile_code = 'ntag424_dna_tt' AND (
      NOT EXISTS (SELECT 1 FROM packaging_lab_test_cases test WHERE test.project_id = v_project.id AND test.code = 'tt_closed' AND test.status = 'PASS')
      OR NOT EXISTS (SELECT 1 FROM packaging_lab_test_cases test WHERE test.project_id = v_project.id AND test.code = 'tt_opened' AND test.status = 'PASS')
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'packaging_lab_tt_closed_open_required';
    END IF;

    UPDATE packaging_placements placement
    SET validated = true,
        validation_report_id = v_approval_id::text,
        revision = placement.revision + 1,
        updated_at = now()
    WHERE placement.id = v_placement.id AND placement.tenant_id = v_tenant_id
    RETURNING placement.* INTO v_placement;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', test.id, 'sequence', test.sequence, 'code', test.code,
      'category', test.category, 'name', test.name, 'method', test.method,
      'target', test.target, 'result', test.result, 'status', test.status,
      'evidence_urls', to_jsonb(test.evidence_urls), 'required', test.required,
      'waiver_allowed', test.waiver_allowed, 'operator_id', test.operator_id,
      'tested_at', test.tested_at, 'version', test.version
    ) ORDER BY test.sequence), '[]'::jsonb) INTO v_tests
    FROM packaging_lab_test_cases test WHERE test.project_id = v_project.id;
    v_tests_digest := public.nexid_packaging_lab_tests_digest_v1(v_project.id);
    v_receipt_digest := 'sha256:' || encode(digest(jsonb_build_object(
      'schema_version', 'packaging-lab-approval/v1',
      'tenant_id', v_tenant_id,
      'project_id', v_project.id,
      'supplier_order_id', v_project.supplier_order_id,
      'carrier_spec_id', v_spec.id,
      'placement_id', v_placement.id,
      'carrier_profile_code', v_spec.carrier_profile_code,
      'product_id', v_project.product_id,
      'sku', v_project.sku,
      'spec_revision', v_spec.revision,
      'placement_revision', v_placement.revision,
      'approved_packaging_revision', v_project.approved_packaging_revision,
      'approved_packaging_hash', v_project.approved_packaging_hash,
      'tests_digest', v_tests_digest,
      'override_used', v_override,
      'approved_by', v_actor_id,
      'approved_at', v_decided_at
    )::text, 'sha256'), 'hex');
    INSERT INTO packaging_lab_approvals (
      id, tenant_id, project_id, supplier_order_id, carrier_spec_id,
      placement_id, carrier_profile_code, product_id, sku, spec_revision,
      placement_revision, approved_packaging_revision, approved_packaging_hash,
      spec_snapshot, placement_snapshot, tests_snapshot, tests_digest,
      receipt_digest, override_used, override_reason, approved_by, approved_at
    ) VALUES (
      v_approval_id, v_tenant_id, v_project.id, v_project.supplier_order_id,
      v_spec.id, v_placement.id, v_spec.carrier_profile_code,
      v_project.product_id, v_project.sku, v_spec.revision, v_placement.revision,
      v_project.approved_packaging_revision, v_project.approved_packaging_hash,
      to_jsonb(v_spec), to_jsonb(v_placement), v_tests, v_tests_digest,
      v_receipt_digest, v_override, v_override_reason, v_actor_id, v_decided_at
    );
    UPDATE packaging_lab_projects project
    SET status = 'APPROVED', recommendation = v_recommendation,
        approval_id = v_approval_id, approved_by = v_actor_id,
        approved_at = v_decided_at, updated_at = v_decided_at
    WHERE project.id = v_project.id AND project.tenant_id = v_tenant_id;
  ELSIF v_decision = 'FAIL' THEN
    UPDATE packaging_lab_projects project
    SET status = 'FAILED', recommendation = COALESCE(v_recommendation, v_reason),
        updated_at = v_decided_at
    WHERE project.id = v_project.id AND project.tenant_id = v_tenant_id;
    v_approval_id := NULL;
    v_receipt_digest := NULL;
  ELSE
    UPDATE packaging_lab_projects project
    SET status = 'ARCHIVED', updated_at = v_decided_at
    WHERE project.id = v_project.id AND project.tenant_id = v_tenant_id;
    v_approval_id := v_project.approval_id;
    SELECT approval.receipt_digest INTO v_receipt_digest
    FROM packaging_lab_approvals approval WHERE approval.id = v_project.approval_id;
  END IF;

  v_result := jsonb_build_object(
    'project_id', v_project.id,
    'decision', v_decision,
    'approval_id', v_approval_id,
    'receipt_digest', v_receipt_digest,
    'decided_at', v_decided_at
  );
  INSERT INTO packaging_lab_operations (
    tenant_id, operation_key, operation_type, request_fingerprint,
    result_json, actor_id
  ) VALUES (
    v_tenant_id, v_operation_key, 'decide_project', v_fingerprint,
    v_result, v_actor_id
  );
  INSERT INTO audit_logs (
    actor_id, tenant_id, action, resource_type, resource_id,
    after_hash, request_id
  ) VALUES (
    v_actor_id, v_tenant_id, 'packaging_lab_project_' || LOWER(v_decision),
    'packaging_lab_project', v_project.id::text,
    replace(COALESCE(v_receipt_digest, v_fingerprint), 'sha256:', ''),
    NULLIF(BTRIM(p_input->>'request_id'), '')
  );
  IF v_decision = 'APPROVE' THEN
    INSERT INTO evidence_events (
      tenant_id, resource_type, resource_id, event_type, payload_json, payload_hash
    ) VALUES (
      v_tenant_id, 'packaging_lab_project', v_project.id::text,
      'packaging_lab_approved',
      jsonb_build_object(
        'schema_version', 'packaging-lab-approval/v1',
        'approval_id', v_approval_id,
        'supplier_order_id', v_project.supplier_order_id,
        'carrier_spec_id', v_project.carrier_spec_id,
        'placement_id', v_project.placement_id,
        'tests_digest', v_tests_digest,
        'override_used', v_override
      ),
      v_receipt_digest
    );
  END IF;
  RETURN QUERY SELECT v_project.id, v_decision, v_approval_id, v_receipt_digest, v_decided_at, false;
END;
$decide_project$;

CREATE OR REPLACE FUNCTION public.nexid_packaging_lab_activation_receipt_v1(p_batch_id uuid)
RETURNS TABLE (
  tenant_id uuid,
  supplier_order_id uuid,
  supplier_sub_batch_id uuid,
  batch_id uuid,
  project_id uuid,
  carrier_spec_id uuid,
  placement_id uuid,
  approval_id uuid,
  receipt_digest text,
  override_used boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $activation_receipt$
DECLARE
  v_supplier_order_id uuid;
BEGIN
  SELECT batch.supplier_order_id INTO v_supplier_order_id
  FROM batches batch
  WHERE batch.id = p_batch_id;
  IF NOT FOUND OR v_supplier_order_id IS NULL THEN
    RETURN;
  END IF;

  -- Activation/read paths share the order lock; approval revocation/archive
  -- takes its exclusive counterpart. The project row lock below then forces
  -- PostgreSQL to re-evaluate a concurrently updated status before returning a
  -- receipt, while the advisory lock remains held through transaction commit.
  PERFORM pg_advisory_xact_lock_shared(hashtextextended(
    'packaging-lab-order' || chr(31) || v_supplier_order_id::text, 0
  ));

  RETURN QUERY SELECT
    batch.tenant_id,
    batch.supplier_order_id,
    batch.supplier_sub_batch_id,
    batch.id,
    project.id,
    spec.id,
    placement.id,
    approval.id,
    approval.receipt_digest,
    approval.override_used
  FROM batches batch
  JOIN supplier_sub_batches sub_batch
    ON sub_batch.id = batch.supplier_sub_batch_id
   AND sub_batch.batch_id = batch.id
   AND sub_batch.tenant_id = batch.tenant_id
   AND sub_batch.supplier_order_id = batch.supplier_order_id
  JOIN supplier_orders supplier_order
    ON supplier_order.id = batch.supplier_order_id
   AND supplier_order.tenant_id = batch.tenant_id
  JOIN packaging_carrier_specs spec
    ON spec.id = supplier_order.packaging_carrier_spec_id
   AND spec.tenant_id = supplier_order.tenant_id
   AND spec.carrier_profile_code = LOWER(supplier_order.carrier_profile_code)
  JOIN packaging_lab_projects project
    ON project.supplier_order_id = supplier_order.id
   AND project.tenant_id = supplier_order.tenant_id
   AND project.carrier_spec_id = spec.id
   AND project.status = 'APPROVED'
   AND project.approved_packaging_revision = supplier_order.packaging_spec_revision
   AND project.approved_packaging_hash = supplier_order.packaging_spec_hash
  JOIN packaging_placements placement
    ON placement.id = project.placement_id
   AND placement.tenant_id = project.tenant_id
   AND placement.carrier_spec_id = project.carrier_spec_id
   AND placement.validated
  JOIN packaging_lab_approvals approval
    ON approval.id = project.approval_id
   AND approval.project_id = project.id
   AND approval.tenant_id = project.tenant_id
   AND approval.carrier_spec_id = spec.id
   AND approval.placement_id = placement.id
   AND approval.spec_revision = spec.revision
   AND approval.placement_revision = placement.revision
   AND approval.approved_packaging_revision = project.approved_packaging_revision
   AND approval.approved_packaging_hash = project.approved_packaging_hash
   AND approval.tests_digest = public.nexid_packaging_lab_tests_digest_v1(project.id)
  WHERE batch.id = p_batch_id
    AND public.nexid_effective_supplier_pack_purpose_v1(supplier_order.id) = 'production'
    AND sub_batch.pack_purpose = 'production'
    AND sub_batch.manifest_status = 'imported'
    AND sub_batch.manifest_count = sub_batch.expected_quantity
    AND supplier_order.packaging_governance_status = 'approved'
    AND NOT EXISTS (
      SELECT 1 FROM packaging_lab_test_cases test
      WHERE test.project_id = project.id
        AND test.required
        AND test.status NOT IN ('PASS', 'WAIVED')
    )
    AND (
      spec.carrier_profile_code NOT IN ('ntag424_dna', 'ntag424_dna_tt')
      OR (
        EXISTS (SELECT 1 FROM packaging_lab_test_cases test WHERE test.project_id = project.id AND test.code = 'secure_sample_validates' AND test.status = 'PASS')
        AND EXISTS (SELECT 1 FROM packaging_lab_test_cases test WHERE test.project_id = project.id AND test.code = 'replay_rejected' AND test.status = 'PASS')
      )
    )
    AND (
      spec.carrier_profile_code <> 'ntag424_dna_tt'
      OR (
        placement.crosses_opening
        AND placement.requires_tail_break
        AND EXISTS (SELECT 1 FROM packaging_lab_test_cases test WHERE test.project_id = project.id AND test.code = 'tt_closed' AND test.status = 'PASS')
        AND EXISTS (SELECT 1 FROM packaging_lab_test_cases test WHERE test.project_id = project.id AND test.code = 'tt_opened' AND test.status = 'PASS')
      )
    )
    AND (
      spec.carrier_profile_code = 'ntag424_dna_tt'
      OR (NOT placement.crosses_opening AND NOT placement.requires_tail_break)
    )
  FOR SHARE OF project;
END;
$activation_receipt$;

CREATE OR REPLACE FUNCTION public.nexid_assert_packaging_lab_activation_v1(p_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $assert_lab$
DECLARE
  v_supplier_production boolean;
  v_receipt_count integer;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM batches batch
    JOIN supplier_orders supplier_order
      ON supplier_order.id = batch.supplier_order_id
     AND supplier_order.tenant_id = batch.tenant_id
    WHERE batch.id = p_batch_id
      AND public.nexid_effective_supplier_pack_purpose_v1(supplier_order.id) = 'production'
  ) INTO v_supplier_production;
  IF NOT v_supplier_production THEN RETURN; END IF;

  SELECT count(*)::integer INTO v_receipt_count
  FROM public.nexid_packaging_lab_activation_receipt_v1(p_batch_id);
  IF v_receipt_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'packaging_lab_approval_required';
  END IF;
END;
$assert_lab$;

-- Preserve the 0076 receipt gate and add Packaging Lab as a second independent
-- requirement for every commercial sink that already calls this assertion.
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
  SELECT count(*)::integer INTO v_receipt_count
  FROM public.nexid_supplier_production_activation_receipt_v2(p_batch_id);
  IF v_receipt_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_acceptance_v2_required';
  END IF;
  PERFORM public.nexid_assert_packaging_lab_activation_v1(p_batch_id);
END;
$assert_activation$;

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
         count(*) FILTER (WHERE
           EXISTS (
             SELECT 1 FROM public.nexid_supplier_production_activation_receipt_v2(sub_batch.batch_id)
           )
           AND EXISTS (
             SELECT 1 FROM public.nexid_packaging_lab_activation_receipt_v1(sub_batch.batch_id)
           )
         )::integer
    INTO v_total, v_accepted
  FROM supplier_sub_batches sub_batch
  WHERE sub_batch.supplier_order_id = p_supplier_order_id;
  IF v_total = 0 OR v_accepted <> v_total THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supplier_production_or_packaging_lab_acceptance_required';
  END IF;
END;
$order_release$;

-- The 0076 atomic writer reads its QA receipt directly.  A statement-level
-- transition trigger closes that path (and any future direct UPDATE path)
-- without evaluating the lab gate once per tag in a 100k-unit lot.
CREATE OR REPLACE FUNCTION public.nexid_guard_packaging_lab_tag_activation_v1()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $tag_activation_guard$
DECLARE
  v_activation record;
BEGIN
  FOR v_activation IN
    SELECT DISTINCT batch.supplier_order_id, new_tag.batch_id
    FROM new_packaging_lab_tags new_tag
    JOIN old_packaging_lab_tags old_tag ON old_tag.id = new_tag.id
    JOIN batches batch ON batch.id = new_tag.batch_id
    WHERE old_tag.status::text IS DISTINCT FROM 'active'
      AND new_tag.status::text = 'active'
    ORDER BY batch.supplier_order_id, new_tag.batch_id
  LOOP
    PERFORM public.nexid_assert_packaging_lab_activation_v1(v_activation.batch_id);
  END LOOP;
  RETURN NULL;
END;
$tag_activation_guard$;

DROP TRIGGER IF EXISTS trg_packaging_lab_tag_activation_guard ON tags;
CREATE TRIGGER trg_packaging_lab_tag_activation_guard
  AFTER UPDATE ON tags
  REFERENCING OLD TABLE AS old_packaging_lab_tags NEW TABLE AS new_packaging_lab_tags
  FOR EACH STATEMENT EXECUTE FUNCTION public.nexid_guard_packaging_lab_tag_activation_v1();

ALTER TABLE supplier_production_activation_receipts
  ADD COLUMN IF NOT EXISTS packaging_lab_approval_id uuid
  REFERENCES packaging_lab_approvals(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.nexid_bind_packaging_lab_activation_receipt_v1()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $bind_receipt$
BEGIN
  SELECT receipt.approval_id INTO NEW.packaging_lab_approval_id
  FROM public.nexid_packaging_lab_activation_receipt_v1(NEW.batch_id) receipt
  WHERE receipt.tenant_id = NEW.tenant_id
    AND receipt.supplier_order_id = NEW.supplier_order_id
    AND receipt.supplier_sub_batch_id = NEW.supplier_sub_batch_id;
  IF NEW.packaging_lab_approval_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'packaging_lab_approval_required';
  END IF;
  RETURN NEW;
END;
$bind_receipt$;

DROP TRIGGER IF EXISTS trg_supplier_activation_packaging_lab_receipt
  ON supplier_production_activation_receipts;
CREATE TRIGGER trg_supplier_activation_packaging_lab_receipt
  BEFORE INSERT ON supplier_production_activation_receipts
  FOR EACH ROW EXECUTE FUNCTION public.nexid_bind_packaging_lab_activation_receipt_v1();

REVOKE ALL ON TABLE packaging_carrier_specs FROM PUBLIC;
REVOKE ALL ON TABLE packaging_placements FROM PUBLIC;
REVOKE ALL ON TABLE packaging_lab_projects FROM PUBLIC;
REVOKE ALL ON TABLE packaging_lab_test_cases FROM PUBLIC;
REVOKE ALL ON TABLE packaging_lab_approvals FROM PUBLIC;
REVOKE ALL ON TABLE packaging_lab_operations FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_packaging_lab_history_append_only_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_packaging_lab_permission_denied_v1(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_packaging_evidence_refs_safe_v1(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_guard_packaging_placement_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_guard_packaging_carrier_spec_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_guard_packaging_lab_test_mutation_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_create_packaging_lab_project_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_record_packaging_lab_test_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_packaging_lab_tests_digest_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_decide_packaging_lab_project_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_packaging_lab_activation_receipt_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_assert_packaging_lab_activation_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_assert_supplier_production_activation_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_assert_supplier_order_commercial_release_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_guard_packaging_lab_tag_activation_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_bind_packaging_lab_activation_receipt_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_packaging_lab_actor_authorized_v1(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_packaging_lab_override_authorized_v1(uuid, uuid, uuid) FROM PUBLIC;

COMMENT ON TABLE packaging_carrier_specs IS
  'Tenant-scoped physical carrier construction. UHF and GS1 cannot request SUN key material; non-TT profiles cannot claim tamper.';
COMMENT ON TABLE packaging_lab_approvals IS
  'Immutable Packaging Lab approval receipt bound to carrier spec, placement, product/SKU and the approved supplier packaging revision.';
COMMENT ON FUNCTION public.nexid_assert_packaging_lab_activation_v1(uuid) IS
  'Fail-closed production activation gate. It does not replace manifest, Supplier Production Acceptance v2 or physical NFC/SUN verification.';
COMMENT ON FUNCTION public.nexid_create_packaging_lab_project_v1(jsonb) IS
  'SECURITY INVOKER Packaging Lab writer. PUBLIC execute is revoked; deployment grants must target only the dedicated runtime owner/role.';
COMMENT ON FUNCTION public.nexid_packaging_lab_activation_receipt_v1(uuid) IS
  'Order-serialized activation receipt. PUBLIC execute is revoked; no production runtime role is assumed by this migration.';
