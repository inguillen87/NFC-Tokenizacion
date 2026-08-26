-- Enterprise RBAC and explainable-risk truth v1.
--
-- This additive migration reasserts the complete authoritative role catalog,
-- enforces fail-closed tenant binding for new IAM rows and versions the
-- deterministic software risk projection. Historical risk is projected into a
-- separate table: consumed NFC events remain byte-for-byte untouched.
--
-- This migration changes no SUN/SDM/CMAC/TTStatus, counter, replay, batch-key
-- or custody semantics and makes no managed-KMS or HSM claim.

DO $enterprise_rbac_risk_truth_preflight$
BEGIN
  IF to_regclass('public.enterprise_role_profiles') IS NULL
    OR to_regclass('public.events') IS NULL
    OR to_regclass('public.memberships') IS NULL
    OR to_regclass('public.auth_sessions') IS NULL
    OR to_regprocedure('public.nexid_explain_event_risk_v1()') IS NULL
  THEN
    RAISE EXCEPTION 'enterprise_rbac_risk_truth_requires_0088' USING ERRCODE = '55000';
  END IF;
END
$enterprise_rbac_risk_truth_preflight$;

-- Preserve the legacy `reseller` membership role as a human compatibility
-- profile. It remains non-delegable because the application catalog has no
-- delegable description for it, and receives no role-default capabilities.
ALTER TABLE public.enterprise_role_profiles
  DROP CONSTRAINT IF EXISTS enterprise_role_profiles_code_check;

ALTER TABLE public.enterprise_role_profiles
  ADD CONSTRAINT enterprise_role_profiles_code_check
  CHECK (code IN (
    'tenant_owner', 'tenant_admin', 'security_analyst', 'operations_manager',
    'packaging_operator', 'marketing_manager', 'viewer', 'reseller_admin',
    'api_integration', 'super_admin', 'security_operator', 'reseller'
  )) NOT VALID;

ALTER TABLE public.enterprise_role_profiles
  VALIDATE CONSTRAINT enterprise_role_profiles_code_check;

INSERT INTO public.enterprise_role_profiles (
  code, display_name, tenant_bound, human_session_allowed, default_permissions,
  active
) VALUES
  (
    'tenant_owner', 'Tenant owner', true, true,
    '["users:manage","supplier_order.create","batch.keys.generate","supplier_pack.export","manifest.import","packaging_lab.manage","qa.approve","qa.plan.approve","batch.activate","batch.lifecycle","batch.revoke","batch.tamper.configure","tag.tamper.override","batch.product.configure","ownership.claim_policy.manage","risk_rules.write","alerts.ack","webhooks.manage","api_keys.read","api_keys.manage","proofs.read","proofs.anchor","audit.read","events.read_sensitive","consumer_experiences.read_pii","consumer_experiences.moderate","consumers.read_pii","leads.manage","reports.export"]'::jsonb,
    true
  ),
  (
    'tenant_admin', 'Tenant admin', true, true,
    '["users:manage","supplier_order.create","manifest.import","packaging_lab.manage","qa.approve","qa.plan.approve","batch.activate","batch.lifecycle","batch.revoke","batch.tamper.configure","tag.tamper.override","batch.product.configure","ownership.claim_policy.manage","alerts.ack","webhooks.manage","api_keys.read","api_keys.manage","proofs.read","audit.read","events.read_sensitive","consumer_experiences.read_pii","consumer_experiences.moderate","consumers.read_pii","leads.manage","reports.export"]'::jsonb,
    true
  ),
  (
    'security_analyst', 'Security analyst', true, true,
    '["proofs.read","audit.read","events.read_sensitive","reports.export"]'::jsonb,
    true
  ),
  (
    'operations_manager', 'Operations manager', true, true,
    '["supplier_order.create","manifest.import","packaging_lab.manage","qa.approve","batch.activate","batch.lifecycle","alerts.ack","events.read_sensitive","reports.export"]'::jsonb,
    true
  ),
  (
    'packaging_operator', 'Packaging operator', true, true,
    '["packaging_lab.manage","manifest.import","reports.export"]'::jsonb,
    true
  ),
  (
    'marketing_manager', 'Marketing manager', true, true,
    '["batch.product.configure","consumer_experiences.read_pii","consumer_experiences.moderate","consumers.read_pii","leads.manage","reports.export"]'::jsonb,
    true
  ),
  (
    'viewer', 'Viewer', true, true,
    '[]'::jsonb,
    true
  ),
  (
    'reseller_admin', 'Reseller admin', true, true,
    '["supplier_order.create","manifest.import","leads.manage","reports.export"]'::jsonb,
    true
  ),
  (
    'api_integration', 'API integration service account', true, false,
    '[]'::jsonb,
    true
  ),
  (
    'super_admin', 'Super admin', false, true,
    '["users:manage","supplier_order.create","batch.keys.generate","supplier_pack.export","manifest.import","packaging_lab.manage","qa.approve","batch.activate","batch.lifecycle","batch.revoke","batch.tamper.configure","tag.tamper.override","batch.product.configure","ownership.claim_policy.manage","risk_rules.write","alerts.ack","webhooks.manage","api_keys.read","api_keys.manage","proofs.read","proofs.anchor","audit.read","events.read_sensitive","consumer_experiences.read_pii","consumer_experiences.moderate","consumers.read_pii","leads.manage","reports.export"]'::jsonb,
    true
  ),
  (
    'security_operator', 'Security operator', true, true,
    '["risk_rules.write","batch.tamper.configure","tag.tamper.override","alerts.ack","webhooks.manage","proofs.read","proofs.anchor","audit.read","events.read_sensitive","reports.export"]'::jsonb,
    true
  ),
  (
    'reseller', 'Legacy reseller compatibility', true, true,
    '[]'::jsonb,
    true
  )
ON CONFLICT (code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  tenant_bound = EXCLUDED.tenant_bound,
  human_session_allowed = EXCLUDED.human_session_allowed,
  default_permissions = EXCLUDED.default_permissions,
  active = EXCLUDED.active,
  updated_at = now();

-- New or modified authority rows must respect the global-vs-tenant boundary.
-- NOT VALID deliberately does not bless or rewrite historical authority. On a
-- clean database the constraints are validated below; otherwise production
-- preflight remains blocked until an audited reconciliation is performed.
ALTER TABLE public.memberships
  DROP CONSTRAINT IF EXISTS memberships_enterprise_tenant_binding_check;
ALTER TABLE public.memberships
  ADD CONSTRAINT memberships_enterprise_tenant_binding_check
  CHECK (
    (role::text = 'super_admin' AND tenant_id IS NULL)
    OR (role::text <> 'super_admin' AND tenant_id IS NOT NULL)
  ) NOT VALID;

ALTER TABLE public.auth_sessions
  DROP CONSTRAINT IF EXISTS auth_sessions_enterprise_tenant_binding_check;
ALTER TABLE public.auth_sessions
  ADD CONSTRAINT auth_sessions_enterprise_tenant_binding_check
  CHECK (
    revoked_at IS NOT NULL
    OR (role::text = 'super_admin' AND tenant_id IS NULL)
    OR (role::text <> 'super_admin' AND tenant_id IS NOT NULL)
  ) NOT VALID;

DO $enterprise_tenant_binding_validate_when_clean$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships membership
    WHERE (membership.role::text = 'super_admin' AND membership.tenant_id IS NOT NULL)
       OR (membership.role::text <> 'super_admin' AND membership.tenant_id IS NULL)
  ) THEN
    ALTER TABLE public.memberships
      VALIDATE CONSTRAINT memberships_enterprise_tenant_binding_check;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.auth_sessions session_row
    WHERE session_row.revoked_at IS NULL
      AND (
        (session_row.role::text = 'super_admin' AND session_row.tenant_id IS NOT NULL)
        OR (session_row.role::text <> 'super_admin' AND session_row.tenant_id IS NULL)
      )
  ) THEN
    ALTER TABLE public.auth_sessions
      VALIDATE CONSTRAINT auth_sessions_enterprise_tenant_binding_check;
  END IF;
END
$enterprise_tenant_binding_validate_when_clean$;

-- Explicit permission rows are tenant-scoped. Historical rows predate this
-- column, so only an unambiguous single-tenant membership is backfilled. A
-- global NULL scope is reserved for a user whose only authority is the global
-- super-admin membership. Ambiguous authority aborts instead of guessing.
ALTER TABLE public.resource_permissions
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

DO $resource_permissions_tenant_backfill$
DECLARE
  v_user_id uuid;
  v_global_memberships integer;
  v_tenant_count integer;
  v_tenant_id uuid;
BEGIN
  FOR v_user_id IN
    SELECT DISTINCT permission.user_id
    FROM public.resource_permissions permission
    WHERE permission.tenant_id IS NULL
  LOOP
    SELECT
      count(*) FILTER (
        WHERE membership.role::text = 'super_admin'
          AND membership.tenant_id IS NULL
      )::integer,
      count(DISTINCT membership.tenant_id) FILTER (
        WHERE membership.tenant_id IS NOT NULL
      )::integer,
      (array_agg(DISTINCT membership.tenant_id) FILTER (
        WHERE membership.tenant_id IS NOT NULL
      ))[1]
      INTO v_global_memberships, v_tenant_count, v_tenant_id
    FROM public.memberships membership
    WHERE membership.user_id = v_user_id;

    IF v_global_memberships > 0 AND v_tenant_count = 0 THEN
      CONTINUE;
    ELSIF v_global_memberships = 0 AND v_tenant_count = 1 THEN
      UPDATE public.resource_permissions permission
      SET tenant_id = v_tenant_id
      WHERE permission.user_id = v_user_id
        AND permission.tenant_id IS NULL;
    ELSE
      RAISE EXCEPTION 'resource_permissions_tenant_backfill_ambiguous'
        USING ERRCODE = '55000', DETAIL = 'user_id=' || v_user_id::text;
    END IF;
  END LOOP;
END
$resource_permissions_tenant_backfill$;

ALTER TABLE public.resource_permissions
  DROP CONSTRAINT IF EXISTS resource_permissions_user_id_resource_action_effect_key;

ALTER TABLE public.resource_permissions
  DROP CONSTRAINT IF EXISTS resource_permissions_tenant_id_fkey;
ALTER TABLE public.resource_permissions
  ADD CONSTRAINT resource_permissions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
  NOT VALID;
ALTER TABLE public.resource_permissions
  VALIDATE CONSTRAINT resource_permissions_tenant_id_fkey;

-- Authorization effects are a closed vocabulary. An unrecognized historical
-- value aborts this migration for audited reconciliation instead of being
-- silently interpreted differently by SQL and application evaluators.
ALTER TABLE public.resource_permissions
  DROP CONSTRAINT IF EXISTS resource_permissions_effect_check;
ALTER TABLE public.resource_permissions
  ADD CONSTRAINT resource_permissions_effect_check
  CHECK (effect IN ('allow', 'deny')) NOT VALID;
ALTER TABLE public.resource_permissions
  VALIDATE CONSTRAINT resource_permissions_effect_check;

CREATE UNIQUE INDEX IF NOT EXISTS ux_resource_permissions_tenant_scope
  ON public.resource_permissions (user_id, tenant_id, resource, action, effect)
  WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_resource_permissions_global_scope
  ON public.resource_permissions (user_id, resource, action, effect)
  WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_resource_permissions_tenant_user
  ON public.resource_permissions (tenant_id, user_id, resource, action, effect);

REVOKE ALL ON TABLE public.resource_permissions FROM PUBLIC;

-- A deferred cross-table check alone is vulnerable to write-skew: concurrent
-- permission and membership transactions can each validate against the
-- other's pre-commit row. Every authority-scope mutation first takes the same
-- transaction lock and updates a private lock row. The row write also turns a
-- stale REPEATABLE READ snapshot into a serialization failure instead of an
-- orphaned permission.
CREATE TABLE IF NOT EXISTS public.enterprise_authority_scope_locks (
  user_id uuid NOT NULL,
  scope_key text NOT NULL,
  lock_version bigint NOT NULL DEFAULT 0,
  CONSTRAINT enterprise_authority_scope_locks_pkey PRIMARY KEY (user_id, scope_key),
  CONSTRAINT enterprise_authority_scope_locks_scope_check CHECK (
    scope_key = 'GLOBAL'
    OR scope_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
);

ALTER TABLE public.enterprise_authority_scope_locks
  DROP CONSTRAINT IF EXISTS enterprise_authority_scope_locks_scope_check;
ALTER TABLE public.enterprise_authority_scope_locks
  ADD CONSTRAINT enterprise_authority_scope_locks_scope_check CHECK (
    scope_key = 'GLOBAL'
    OR scope_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) NOT VALID;
ALTER TABLE public.enterprise_authority_scope_locks
  VALIDATE CONSTRAINT enterprise_authority_scope_locks_scope_check;

REVOKE ALL ON TABLE public.enterprise_authority_scope_locks FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.nexid_touch_authority_scope_lock_v1(
  p_user_id uuid,
  p_tenant_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $authority_scope_touch$
DECLARE
  v_scope_key text := COALESCE(p_tenant_id::text, 'GLOBAL');
  v_identity text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'authority_scope_lock_user_required' USING ERRCODE = '22023';
  END IF;

  v_identity := p_user_id::text || chr(31) || v_scope_key;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'resource-permission-scope' || chr(31) || v_identity,
    0
  ));

  INSERT INTO public.enterprise_authority_scope_locks (
    user_id, scope_key, lock_version
  ) VALUES (
    p_user_id, v_scope_key, 1
  )
  ON CONFLICT (user_id, scope_key) DO UPDATE
  SET lock_version = public.enterprise_authority_scope_locks.lock_version + 1;
END;
$authority_scope_touch$;

CREATE OR REPLACE FUNCTION public.nexid_serialize_authority_scope_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $authority_scope_serialize$
DECLARE
  v_old_identity text;
  v_new_identity text;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old_identity := OLD.user_id::text || chr(31)
      || COALESCE(OLD.tenant_id::text, 'GLOBAL');
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new_identity := NEW.user_id::text || chr(31)
      || COALESCE(NEW.tenant_id::text, 'GLOBAL');
  END IF;

  IF v_old_identity IS NULL THEN
    PERFORM public.nexid_touch_authority_scope_lock_v1(NEW.user_id, NEW.tenant_id);
  ELSIF v_new_identity IS NULL THEN
    PERFORM public.nexid_touch_authority_scope_lock_v1(OLD.user_id, OLD.tenant_id);
  ELSIF v_old_identity = v_new_identity THEN
    PERFORM public.nexid_touch_authority_scope_lock_v1(NEW.user_id, NEW.tenant_id);
  ELSIF v_old_identity < v_new_identity THEN
    PERFORM public.nexid_touch_authority_scope_lock_v1(OLD.user_id, OLD.tenant_id);
    PERFORM public.nexid_touch_authority_scope_lock_v1(NEW.user_id, NEW.tenant_id);
  ELSE
    PERFORM public.nexid_touch_authority_scope_lock_v1(NEW.user_id, NEW.tenant_id);
    PERFORM public.nexid_touch_authority_scope_lock_v1(OLD.user_id, OLD.tenant_id);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$authority_scope_serialize$;

REVOKE ALL ON FUNCTION public.nexid_touch_authority_scope_lock_v1(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_serialize_authority_scope_v1() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_resource_permissions_scope_serialize
  ON public.resource_permissions;
CREATE TRIGGER trg_resource_permissions_scope_serialize
BEFORE INSERT OR UPDATE
ON public.resource_permissions
FOR EACH ROW EXECUTE FUNCTION public.nexid_serialize_authority_scope_v1();

DROP TRIGGER IF EXISTS trg_memberships_permission_scope_serialize
  ON public.memberships;
CREATE TRIGGER trg_memberships_permission_scope_serialize
BEFORE DELETE OR UPDATE
ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.nexid_serialize_authority_scope_v1();

CREATE OR REPLACE FUNCTION public.nexid_validate_resource_permission_scope_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $resource_permission_scope$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.memberships membership
      WHERE membership.user_id = NEW.user_id
        AND membership.role::text = 'super_admin'
        AND membership.tenant_id IS NULL
    ) THEN
      RAISE EXCEPTION 'resource_permission_global_scope_requires_super_admin'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM public.memberships membership
    WHERE membership.user_id = NEW.user_id
      AND membership.tenant_id = NEW.tenant_id
      AND membership.role::text <> 'super_admin'
  ) THEN
    RAISE EXCEPTION 'resource_permission_tenant_scope_requires_membership'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$resource_permission_scope$;

CREATE OR REPLACE FUNCTION public.nexid_validate_membership_permission_scope_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $membership_permission_scope$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.resource_permissions permission
    WHERE permission.user_id = OLD.user_id
      AND (
        (
          permission.tenant_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.memberships membership
            WHERE membership.user_id = permission.user_id
              AND membership.role::text = 'super_admin'
              AND membership.tenant_id IS NULL
          )
        )
        OR (
          permission.tenant_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.memberships membership
            WHERE membership.user_id = permission.user_id
              AND membership.tenant_id = permission.tenant_id
              AND membership.role::text <> 'super_admin'
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'membership_change_would_orphan_resource_permission_scope'
      USING ERRCODE = '23514';
  END IF;

  RETURN OLD;
END;
$membership_permission_scope$;

DROP TRIGGER IF EXISTS trg_resource_permissions_tenant_scope
  ON public.resource_permissions;
CREATE CONSTRAINT TRIGGER trg_resource_permissions_tenant_scope
AFTER INSERT OR UPDATE
ON public.resource_permissions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.nexid_validate_resource_permission_scope_v1();

DROP TRIGGER IF EXISTS trg_memberships_permission_scope
  ON public.memberships;
CREATE CONSTRAINT TRIGGER trg_memberships_permission_scope
AFTER DELETE OR UPDATE
ON public.memberships
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.nexid_validate_membership_permission_scope_v1();

DO $resource_permissions_scope_postbackfill$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.resource_permissions permission
    WHERE (
      permission.tenant_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.memberships membership
        WHERE membership.user_id = permission.user_id
          AND membership.role::text = 'super_admin'
          AND membership.tenant_id IS NULL
      )
    ) OR (
      permission.tenant_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.memberships membership
        WHERE membership.user_id = permission.user_id
          AND membership.tenant_id = permission.tenant_id
          AND membership.role::text <> 'super_admin'
      )
    )
  ) THEN
    RAISE EXCEPTION 'resource_permissions_tenant_scope_postcondition_failed'
      USING ERRCODE = '55000';
  END IF;
END
$resource_permissions_scope_postbackfill$;

-- Database writers use the same canonical high-impact role boundary as the
-- HTTP layer. Role defaults are authoritative; explicit tenant-scoped denies
-- always win. Legacy grants cannot promote an unrelated role into a physical,
-- PII, custody or quality-plan capability.
CREATE OR REPLACE FUNCTION public.nexid_actor_has_enterprise_capability_v1(
  p_user_id uuid,
  p_tenant_id uuid,
  p_role text,
  p_capability text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $enterprise_capability$
DECLARE
  v_deny_names text[];
BEGIN
  v_deny_names := CASE p_capability
    WHEN 'supplier_order.create' THEN ARRAY['supplier_orders:write']
    WHEN 'batch.keys.generate' THEN ARRAY['supplier:batch_keys_generate']
    WHEN 'supplier_pack.export' THEN ARRAY['supplier:pack_export']
    WHEN 'manifest.import' THEN ARRAY['supplier:manifest_import']
    WHEN 'packaging_lab.manage' THEN ARRAY['supplier:packaging_lab_manage']
    WHEN 'packaging_lab.override' THEN ARRAY['supplier:packaging_lab_override']
    WHEN 'qa.approve' THEN ARRAY['supplier:qa_approve', 'supplier:qa']
    WHEN 'qa.plan.approve' THEN ARRAY['supplier:production_qa_plan:approve']
    WHEN 'batch.activate' THEN ARRAY['supplier:batch_activate']
    WHEN 'batch.activation.override' THEN ARRAY['supplier:activate_override']
    WHEN 'batch.internal.register' THEN ARRAY['batch:register_internal']
    WHEN 'batch.keys.rotate' THEN ARRAY['supplier:key_rotate']
    WHEN 'batch.lifecycle' THEN ARRAY['batch:lifecycle']
    WHEN 'risk_rules.write' THEN ARRAY['risk_rules:write']
    WHEN 'webhooks.manage' THEN ARRAY['webhooks:read', 'webhooks:write']
    WHEN 'proofs.read' THEN ARRAY['proof:read']
    WHEN 'proofs.anchor' THEN ARRAY['proof:write']
    WHEN 'audit.read' THEN ARRAY['audit:read']
    WHEN 'reports.export' THEN ARRAY['reports:export', 'analytics:read']
    ELSE ARRAY[p_capability]
  END;

  RETURN EXISTS (
    SELECT 1
    FROM public.users actor
    JOIN public.memberships membership
      ON membership.user_id = actor.id
     AND membership.role::text = p_role
     AND membership.tenant_id IS NOT DISTINCT FROM p_tenant_id
    JOIN public.enterprise_role_profiles profile
      ON profile.code = p_role
     AND profile.active IS TRUE
     AND profile.human_session_allowed IS TRUE
    WHERE actor.id = p_user_id
      AND actor.admin_status::text = 'active'
      AND profile.default_permissions ? p_capability
      AND (
        (profile.tenant_bound IS TRUE AND p_tenant_id IS NOT NULL)
        OR (profile.tenant_bound IS FALSE AND p_tenant_id IS NULL)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.resource_permissions permission
        WHERE permission.user_id = p_user_id
          AND permission.tenant_id IS NOT DISTINCT FROM p_tenant_id
          AND permission.effect = 'deny'
          AND (
            (permission.resource = '*' AND permission.action = '*')
            OR permission.resource || ':' || permission.action = ANY(v_deny_names)
            OR (
              permission.action = '*'
              AND EXISTS (
                SELECT 1
                FROM unnest(v_deny_names) denied_name
                WHERE denied_name = permission.resource
                   OR denied_name LIKE permission.resource || ':%'
              )
            )
          )
      )
  );
END;
$enterprise_capability$;

-- Private migration helper. Each replacement must occur exactly once and the
-- desired fragment must not already exist; drift blocks deployment.
CREATE OR REPLACE FUNCTION public.nexid_replace_function_fragment_v1(
  p_signature text,
  p_old_fragment text,
  p_new_fragment text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $replace_function_fragment$
DECLARE
  v_oid regprocedure;
  v_definition text;
  v_old_count integer;
  v_new_count integer;
BEGIN
  v_oid := to_regprocedure(p_signature);
  IF v_oid IS NULL OR p_old_fragment = '' OR p_new_fragment = '' THEN
    RAISE EXCEPTION 'enterprise_function_patch_target_invalid'
      USING ERRCODE = '55000', DETAIL = p_signature;
  END IF;

  SELECT pg_get_functiondef(v_oid) INTO v_definition;
  v_old_count := (length(v_definition) - length(replace(v_definition, p_old_fragment, '')))
    / length(p_old_fragment);
  v_new_count := (length(v_definition) - length(replace(v_definition, p_new_fragment, '')))
    / length(p_new_fragment);
  IF v_old_count <> 1 OR v_new_count <> 0 THEN
    RAISE EXCEPTION 'enterprise_function_patch_source_occurrence_mismatch'
      USING ERRCODE = '55000', DETAIL = p_signature;
  END IF;

  EXECUTE replace(v_definition, p_old_fragment, p_new_fragment);
  SELECT pg_get_functiondef(to_regprocedure(p_signature)) INTO v_definition;
  IF strpos(v_definition, p_old_fragment) <> 0
    OR strpos(v_definition, p_new_fragment) = 0 THEN
    RAISE EXCEPTION 'enterprise_function_patch_postcondition_failed'
      USING ERRCODE = '55000', DETAIL = p_signature;
  END IF;
END;
$replace_function_fragment$;

REVOKE ALL ON FUNCTION public.nexid_validate_resource_permission_scope_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_validate_membership_permission_scope_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_actor_has_enterprise_capability_v1(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_replace_function_fragment_v1(text, text, text) FROM PUBLIC;

-- Stop concurrent plan-decision writers before inspecting historical dual
-- control. The lock is held through trigger installation and transaction
-- commit, so no request can enter through the legacy 0075 writer in between.
LOCK TABLE public.supplier_production_qa_plan_decisions
  IN SHARE ROW EXCLUSIVE MODE;

DO $supplier_qa_dual_control_history_preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.supplier_production_qa_plan_decisions decision_row
    JOIN public.supplier_production_qa_plans plan
      ON plan.id = decision_row.plan_id
     AND plan.tenant_id = decision_row.tenant_id
    WHERE decision_row.decided_by = plan.submitted_by
       OR decision_row.decided_session_id = plan.submitted_session_id
  ) THEN
    RAISE EXCEPTION 'supplier_production_qa_dual_control_history_reconciliation_required'
      USING ERRCODE = '55000';
  END IF;
END
$supplier_qa_dual_control_history_preflight$;

ALTER TABLE public.supplier_production_qa_plan_decisions
  DROP CONSTRAINT IF EXISTS supplier_production_qa_plan_decisions_approver_role_check;
ALTER TABLE public.supplier_production_qa_plan_decisions
  ADD CONSTRAINT supplier_production_qa_plan_decisions_approver_role_check
  CHECK (approver_role IN ('tenant_owner', 'tenant_admin')) NOT VALID;
ALTER TABLE public.supplier_production_qa_plan_decisions
  VALIDATE CONSTRAINT supplier_production_qa_plan_decisions_approver_role_check;

CREATE OR REPLACE FUNCTION public.nexid_validate_supplier_qa_plan_dual_control_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $supplier_qa_plan_dual_control$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.supplier_production_qa_plans plan
    WHERE plan.id = NEW.plan_id
      AND plan.tenant_id = NEW.tenant_id
      AND NEW.decided_by IS DISTINCT FROM plan.submitted_by
      AND NEW.decided_session_id IS DISTINCT FROM plan.submitted_session_id
  ) THEN
    RAISE EXCEPTION 'supplier_production_qa_plan_dual_control_required'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$supplier_qa_plan_dual_control$;

DROP TRIGGER IF EXISTS trg_supplier_qa_plan_dual_control
  ON public.supplier_production_qa_plan_decisions;
CREATE CONSTRAINT TRIGGER trg_supplier_qa_plan_dual_control
AFTER INSERT OR UPDATE
ON public.supplier_production_qa_plan_decisions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.nexid_validate_supplier_qa_plan_dual_control_v1();

REVOKE ALL ON FUNCTION public.nexid_validate_supplier_qa_plan_dual_control_v1() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.nexid_packaging_lab_permission_denied_v2(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_action text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $packaging_permission_denied_v2$
  SELECT CASE p_action
    WHEN 'packaging_lab.manage' THEN EXISTS (
      SELECT 1
      FROM public.resource_permissions permission
      WHERE permission.user_id = p_actor_id
        AND permission.tenant_id IS NOT DISTINCT FROM p_tenant_id
        AND permission.effect = 'deny'
        AND (
          (permission.resource = '*' AND permission.action = '*')
          OR (permission.resource = 'supplier' AND permission.action IN ('packaging_lab_manage', '*'))
        )
    )
    WHEN 'qa.approve' THEN EXISTS (
      SELECT 1
      FROM public.resource_permissions permission
      WHERE permission.user_id = p_actor_id
        AND permission.tenant_id IS NOT DISTINCT FROM p_tenant_id
        AND permission.effect = 'deny'
        AND (
          (permission.resource = '*' AND permission.action = '*')
          OR (permission.resource = 'supplier' AND permission.action IN ('qa_approve', 'qa', '*'))
        )
    )
    WHEN 'supplier:packaging_lab_override' THEN EXISTS (
      SELECT 1
      FROM public.resource_permissions permission
      WHERE permission.user_id = p_actor_id
        AND permission.tenant_id IS NOT DISTINCT FROM p_tenant_id
        AND permission.effect = 'deny'
        AND (
          (permission.resource = '*' AND permission.action = '*')
          OR (permission.resource = 'supplier' AND permission.action IN ('packaging_lab_override', '*'))
        )
    )
    ELSE true
  END
$packaging_permission_denied_v2$;

REVOKE ALL ON FUNCTION public.nexid_packaging_lab_permission_denied_v2(uuid, uuid, text) FROM PUBLIC;

SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_packaging_lab_actor_authorized_v1(uuid,uuid,uuid,text)',
  $old$
  IF public.nexid_packaging_lab_permission_denied_v1(p_actor_id, p_action) THEN
    RETURN false;
  END IF;
$old$,
  $new$
  -- Deny is evaluated after loading the authoritative session scope.
$new$
);

SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_packaging_lab_actor_authorized_v1(uuid,uuid,uuid,text)',
  $old$
        SELECT 1 FROM resource_permissions permission
        WHERE permission.user_id = p_actor_id AND permission.effect = 'allow'
          AND ((permission.resource = 'supplier' AND permission.action IN ('packaging_lab_manage', '*'))
  $old$,
  $new$
        SELECT 1 FROM resource_permissions permission
        WHERE permission.user_id = p_actor_id
          AND permission.tenant_id IS NOT DISTINCT FROM v_session_tenant_id
          AND permission.effect = 'allow'
          AND ((permission.resource = 'supplier' AND permission.action IN ('packaging_lab_manage', '*'))
  $new$
);

SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_packaging_lab_actor_authorized_v1(uuid,uuid,uuid,text)',
  $old$
        SELECT 1 FROM resource_permissions permission
        WHERE permission.user_id = p_actor_id AND permission.effect = 'allow'
          AND ((permission.resource = 'supplier' AND permission.action IN ('qa_approve', '*'))
  $old$,
  $new$
        SELECT 1 FROM resource_permissions permission
        WHERE permission.user_id = p_actor_id
          AND permission.tenant_id IS NOT DISTINCT FROM v_session_tenant_id
          AND permission.effect = 'allow'
          AND ((permission.resource = 'supplier' AND permission.action IN ('qa_approve', '*'))
  $new$
);

SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_packaging_lab_override_authorized_v1(uuid,uuid,uuid)',
  $old$
  IF public.nexid_packaging_lab_permission_denied_v1(
    p_actor_id, 'supplier:packaging_lab_override'
  ) THEN
    RETURN false;
  END IF;
$old$,
  $new$
  -- Deny is evaluated after loading the authoritative session scope.
$new$
);

SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_packaging_lab_override_authorized_v1(uuid,uuid,uuid)',
  $old$
    WHERE permission.user_id = p_actor_id
      AND permission.effect = 'allow'
      AND ((permission.resource = 'supplier' AND permission.action IN ('packaging_lab_override', '*'))
  $old$,
  $new$
    WHERE permission.user_id = p_actor_id
      AND permission.tenant_id IS NOT DISTINCT FROM v_session_tenant_id
      AND permission.effect = 'allow'
      AND ((permission.resource = 'supplier' AND permission.action IN ('packaging_lab_override', '*'))
  $new$
);

SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_packaging_lab_actor_authorized_v1(uuid,uuid,uuid,text)',
  $old$
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_role = 'super_admin' AND v_session_tenant_id IS NULL THEN
  $old$,
  $new$
  IF NOT FOUND THEN RETURN false; END IF;
  IF public.nexid_packaging_lab_permission_denied_v2(
    v_session_tenant_id, p_actor_id, p_action
  ) THEN
    RETURN false;
  END IF;

  IF v_role = 'super_admin' AND v_session_tenant_id IS NULL THEN
  $new$
);

SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_packaging_lab_override_authorized_v1(uuid,uuid,uuid)',
  $old$
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_role = 'super_admin' AND v_session_tenant_id IS NULL THEN RETURN true; END IF;
  $old$,
  $new$
  IF NOT FOUND THEN RETURN false; END IF;
  IF public.nexid_packaging_lab_permission_denied_v2(
    v_session_tenant_id, p_actor_id, 'supplier:packaging_lab_override'
  ) THEN
    RETURN false;
  END IF;
  IF v_role = 'super_admin' AND v_session_tenant_id IS NULL THEN RETURN true; END IF;
  $new$
);

-- Manifest import: preserve global super-admin operation and admit only the
-- tenant roles whose canonical profile contains manifest.import.
SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_import_tag_manifest_v2_core_0081(jsonb)',
  $old$
    AND (
      (auth_session.role::text = 'super_admin' AND auth_session.tenant_id IS NULL)
      OR (auth_session.role::text = 'tenant_admin' AND auth_session.tenant_id = v_tenant_id)
    )
  $old$,
  $new$
    AND (
      (auth_session.role::text = 'super_admin' AND auth_session.tenant_id IS NULL)
      OR auth_session.tenant_id = v_tenant_id
    )
    AND public.nexid_actor_has_enterprise_capability_v1(
      actor.id, auth_session.tenant_id, auth_session.role::text, 'manifest.import'
    )
  $new$
);

-- Supplier-order creation is tenant-operable, while secure-SUN key generation
-- remains a separate owner/global-custodian capability with verified MFA.
SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_create_supplier_order_v2(jsonb)',
  $old$
    AND auth_session.role::text = 'super_admin'
    AND auth_session.tenant_id IS NULL
    AND auth_session.revoked_at IS NULL
    AND auth_session.expires_at > now()
    AND actor.admin_status::text = 'active'
    AND membership.role::text = 'super_admin'
    AND membership.tenant_id IS NULL
  $old$,
  $new$
    AND (
      (auth_session.role::text = 'super_admin' AND auth_session.tenant_id IS NULL)
      OR auth_session.tenant_id = v_tenant_id
    )
    AND auth_session.revoked_at IS NULL
    AND auth_session.expires_at > now()
    AND actor.admin_status::text = 'active'
    AND public.nexid_actor_has_enterprise_capability_v1(
      actor.id, auth_session.tenant_id, auth_session.role::text, 'supplier_order.create'
    )
    AND (
      NOT v_secure_sun
      OR (
        auth_session.mfa_verified IS TRUE
        AND public.nexid_actor_has_enterprise_capability_v1(
          actor.id, auth_session.tenant_id, auth_session.role::text, 'batch.keys.generate'
        )
      )
    )
  $new$
);

-- Lot activation and lifecycle are independent capabilities. In particular,
-- a broad historical tags:write grant does not satisfy batch.activate.
SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_activate_supplier_tags_v2(jsonb)',
  $old$
    AND (
      (auth_session.role::text = 'super_admin' AND auth_session.tenant_id IS NULL)
      OR (auth_session.role::text = 'tenant_admin' AND auth_session.tenant_id = v_tenant_id)
    )
  $old$,
  $new$
    AND (
      (auth_session.role::text = 'super_admin' AND auth_session.tenant_id IS NULL)
      OR auth_session.tenant_id = v_tenant_id
    )
    AND public.nexid_actor_has_enterprise_capability_v1(
      actor.id, auth_session.tenant_id, auth_session.role::text, 'batch.activate'
    )
  $new$
);

SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_transition_tag_lifecycle_v1(jsonb)',
  $old$
      AND (
        (membership.role::text = 'super_admin' AND membership.tenant_id IS NULL)
        OR (membership.role::text = 'tenant_admin' AND membership.tenant_id = v_tenant_id)
      )
  $old$,
  $new$
      AND (
        (membership.role::text = 'super_admin' AND membership.tenant_id IS NULL)
        OR membership.tenant_id = v_tenant_id
      )
      AND public.nexid_actor_has_enterprise_capability_v1(
        actor.id, membership.tenant_id, membership.role::text, 'batch.lifecycle'
      )
  $new$
);

-- QA execution is available to the bounded operator roles. Customer quality
-- plan approval remains a separate MFA + dual-control tenant-owner/admin act.
SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_submit_supplier_production_qa_plan_v1(jsonb)',
  $old$
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
  $old$,
  $new$
    AND (
      (auth_session.role::text = 'super_admin' AND auth_session.tenant_id IS NULL)
      OR auth_session.tenant_id = v_tenant_id
    )
    AND public.nexid_actor_has_enterprise_capability_v1(
      actor.id, auth_session.tenant_id, auth_session.role::text, 'qa.approve'
    )
  $new$
);

SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_create_supplier_production_qa_session_v1(jsonb)',
  $old$
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
  $old$,
  $new$
    AND (
      (auth_session.role::text = 'super_admin' AND auth_session.tenant_id IS NULL)
      OR auth_session.tenant_id = v_tenant_id
    )
    AND public.nexid_actor_has_enterprise_capability_v1(
      actor.id, auth_session.tenant_id, auth_session.role::text, 'qa.approve'
    )
  $new$
);

SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_commit_supplier_production_qa_v1(jsonb)',
  $old$
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
  $old$,
  $new$
    AND (
      (auth_session.role::text = 'super_admin' AND auth_session.tenant_id IS NULL)
      OR auth_session.tenant_id = v_tenant_id
    )
    AND public.nexid_actor_has_enterprise_capability_v1(
      actor.id, auth_session.tenant_id, auth_session.role::text, 'qa.approve'
    )
  $new$
);

SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_decide_supplier_production_qa_plan_v1(jsonb)',
  $old$
  v_permissions jsonb;
BEGIN
  $old$,
  $new$
  v_permissions jsonb;
  v_approver_role text;
BEGIN
  $new$
);

SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_decide_supplier_production_qa_plan_v1(jsonb)',
  $old$
  IF v_plan.plan_digest IS DISTINCT FROM lower(p_input->>'plan_digest') THEN
  $old$,
  $new$
  IF v_plan.submitted_by = v_actor_id
    OR v_plan.submitted_session_id = v_auth_session_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'supplier_production_qa_plan_dual_control_required';
  END IF;
  IF (v_plan.plan_digest IS DISTINCT FROM lower(p_input->>'plan_digest')) THEN
  $new$
);

SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_decide_supplier_production_qa_plan_v1(jsonb)',
  $old$
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
  $old$,
  $new$
  SELECT auth_session.role::text INTO v_approver_role
  FROM auth_sessions auth_session
  JOIN users actor ON actor.id = auth_session.user_id
  JOIN memberships membership
    ON membership.user_id = actor.id
   AND membership.role = auth_session.role
   AND membership.tenant_id = v_tenant_id
  WHERE auth_session.id = v_auth_session_id
    AND auth_session.user_id = v_actor_id
    AND auth_session.role::text IN ('tenant_owner', 'tenant_admin')
    AND auth_session.tenant_id = v_tenant_id
    AND auth_session.mfa_verified IS TRUE
    AND auth_session.revoked_at IS NULL
    AND auth_session.expires_at > now()
    AND actor.admin_status::text = 'active'
    AND public.nexid_actor_has_enterprise_capability_v1(
      actor.id, auth_session.tenant_id, auth_session.role::text, 'qa.plan.approve'
    )
  FOR SHARE OF auth_session, actor, membership;
  $new$
);

SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_decide_supplier_production_qa_plan_v1(jsonb)',
  $old$
  WHERE permission.user_id = v_actor_id
    AND permission.effect = 'allow';$old$,
  $new$
  WHERE permission.user_id = v_actor_id
    AND permission.tenant_id = v_tenant_id
    AND permission.effect = 'allow';

  -- Preserve which versioned evaluator and role produced the effective
  -- capability decision. The preceding strings retain the explicit allow
  -- snapshot for backwards-compatible readers.
  v_permissions := v_permissions || jsonb_build_array(
    'effective-capability-policy:enterprise-rbac-risk-truth/v1:'
      || v_approver_role || ':qa.plan.approve'
  );$new$
);

SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_decide_supplier_production_qa_plan_v1(jsonb)',
  $old$
    v_auth_session_id, 'tenant_admin', v_permissions
  $old$,
  $new$
    v_auth_session_id, v_approver_role, v_permissions
  $new$
);

SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_supplier_sun_production_activation_receipt_v2(uuid)',
  $old$
   AND plan_decision.approver_role = 'tenant_admin'
  $old$,
  $new$
   AND plan_decision.approver_role IN ('tenant_owner', 'tenant_admin')
  $new$
);

SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_supplier_keyless_production_activation_receipt_v1(uuid)',
  $old$
   AND plan_decision.approver_role = 'tenant_admin'
  $old$,
  $new$
   AND plan_decision.approver_role IN ('tenant_owner', 'tenant_admin')
  $new$
);

SELECT public.nexid_replace_function_fragment_v1(
  'public.nexid_commit_supplier_carrier_qa_v1(jsonb)',
  $old$
     AND plan_decision.approver_role = 'tenant_admin'
  $old$,
  $new$
     AND plan_decision.approver_role IN ('tenant_owner', 'tenant_admin')
  $new$
);

DROP FUNCTION public.nexid_replace_function_fragment_v1(text, text, text);

-- The runtime role receives only the carrier-validating wrapper. It must run
-- as its owner to reach the private 0081 core; the core remains invoker-only
-- and non-executable by runtime roles, preventing a direct carrier-gate bypass.
ALTER FUNCTION public.nexid_import_tag_manifest_v2(jsonb) SECURITY DEFINER;
ALTER FUNCTION public.nexid_import_tag_manifest_v2(jsonb)
  SET search_path TO pg_catalog, public, pg_temp;

-- Require the complete three-stage SUN persistence chain to retain one trusted
-- owner. Do not silently widen the definer boundary by transferring ownership
-- to a potentially more privileged migration login.
-- The two outer stages need definer privileges to reach private persistence;
-- the historical CMAC/SDM/replay primitive stays invoker-only and private.
-- Function bodies are untouched, so the physical NFC cryptographic path and
-- TTStatus/counter semantics remain exactly as installed by 0062/0093.
DO $sun_persistence_owner_preflight$
BEGIN
  IF NOT COALESCE((
    SELECT wrapper_routine.proowner = base_routine.proowner
      AND wrapper_routine.proowner = historical_routine.proowner
    FROM pg_catalog.pg_proc wrapper_routine
    JOIN pg_catalog.pg_proc base_routine
      ON base_routine.oid = to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)')
    JOIN pg_catalog.pg_proc historical_routine
      ON historical_routine.oid = to_regprocedure('public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)')
    WHERE wrapper_routine.oid = to_regprocedure('public.nexid_persist_sun_scan_v1(jsonb)')
  ), false) THEN
    RAISE EXCEPTION 'sun_persistence_common_owner_required' USING ERRCODE = '55000';
  END IF;
END
$sun_persistence_owner_preflight$;

ALTER FUNCTION public.nexid_persist_sun_scan_v1(jsonb) SECURITY DEFINER;
ALTER FUNCTION public.nexid_persist_sun_scan_v1(jsonb)
  SET search_path TO pg_catalog, public, pg_temp;
ALTER FUNCTION public.nexid_persist_sun_scan_v1_base_0062(jsonb) SECURITY DEFINER;
ALTER FUNCTION public.nexid_persist_sun_scan_v1_base_0062(jsonb)
  SET search_path TO pg_catalog, public, pg_temp;
ALTER FUNCTION public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb) SECURITY INVOKER;
ALTER FUNCTION public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)
  SET search_path TO pg_catalog, public, pg_temp;

-- Reassert private SQL writer boundaries after CREATE OR REPLACE.
REVOKE ALL ON FUNCTION public.nexid_transition_tag_lifecycle_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_import_tag_manifest_v2(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_import_tag_manifest_v2_core_0081(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_create_supplier_order_v2(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_activate_supplier_tags_v2(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_submit_supplier_production_qa_plan_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_decide_supplier_production_qa_plan_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_create_supplier_production_qa_session_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_commit_supplier_production_qa_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_production_activation_receipt_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_sun_production_activation_receipt_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_keyless_production_activation_receipt_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_commit_supplier_carrier_qa_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_persist_sun_scan_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_persist_sun_scan_v1_base_0062(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb) FROM PUBLIC;

-- ALTER FUNCTION ... RENAME preserves direct ACL entries. Move every historic
-- non-owner EXECUTE grant from the renamed 0081 core to the carrier-validating
-- wrapper before removing the bypass. Grant-option intent is preserved on the
-- wrapper, while CASCADE removes any downstream core grants atomically.
DO $manifest_core_acl_reconcile$
DECLARE
  v_grantee record;
BEGIN
  FOR v_grantee IN
    SELECT role_row.rolname, bool_or(acl.is_grantable) AS is_grantable
    FROM pg_catalog.pg_proc routine
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(routine.proacl, pg_catalog.acldefault('f', routine.proowner))
    ) acl
    JOIN pg_catalog.pg_roles role_row ON role_row.oid = acl.grantee
    WHERE routine.oid = to_regprocedure('public.nexid_import_tag_manifest_v2_core_0081(jsonb)')
      AND acl.privilege_type = 'EXECUTE'
      AND acl.grantee <> routine.proowner
    GROUP BY role_row.rolname
  LOOP
    EXECUTE pg_catalog.format(
      'GRANT EXECUTE ON FUNCTION public.nexid_import_tag_manifest_v2(jsonb) TO %I%s',
      v_grantee.rolname,
      CASE WHEN v_grantee.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
    );
  END LOOP;

  FOR v_grantee IN
    SELECT DISTINCT role_row.rolname
    FROM pg_catalog.pg_proc routine
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(routine.proacl, pg_catalog.acldefault('f', routine.proowner))
    ) acl
    JOIN pg_catalog.pg_roles role_row ON role_row.oid = acl.grantee
    WHERE routine.oid = to_regprocedure('public.nexid_import_tag_manifest_v2_core_0081(jsonb)')
      AND acl.privilege_type = 'EXECUTE'
      AND acl.grantee <> routine.proowner
  LOOP
    EXECUTE pg_catalog.format(
      'REVOKE ALL PRIVILEGES ON FUNCTION public.nexid_import_tag_manifest_v2_core_0081(jsonb) FROM %I CASCADE',
      v_grantee.rolname
    );
  END LOOP;
END
$manifest_core_acl_reconcile$;

-- The SUN persistence entry point was wrapped twice (lifecycle, then durable
-- TT truth). Both ALTER ... RENAME operations preserved historic ACLs. Move
-- those direct grants to the current top-level wrapper so no application role
-- can bypass lifecycle or the CMAC-bound TT receipt layer.
DO $sun_internal_acl_reconcile$
DECLARE
  v_source_signature text;
  v_grantee record;
BEGIN
  FOREACH v_source_signature IN ARRAY ARRAY[
    'public.nexid_persist_sun_scan_v1_base_0062(jsonb)',
    'public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)'
  ]::text[]
  LOOP
    FOR v_grantee IN
      SELECT role_row.rolname, bool_or(acl.is_grantable) AS is_grantable
      FROM pg_catalog.pg_proc routine
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(routine.proacl, pg_catalog.acldefault('f', routine.proowner))
      ) acl
      JOIN pg_catalog.pg_roles role_row ON role_row.oid = acl.grantee
      WHERE routine.oid = to_regprocedure(v_source_signature)
        AND acl.privilege_type = 'EXECUTE'
        AND acl.grantee <> routine.proowner
      GROUP BY role_row.rolname
    LOOP
      EXECUTE pg_catalog.format(
        'GRANT EXECUTE ON FUNCTION public.nexid_persist_sun_scan_v1(jsonb) TO %I%s',
        v_grantee.rolname,
        CASE WHEN v_grantee.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
      );
    END LOOP;
  END LOOP;

  FOREACH v_source_signature IN ARRAY ARRAY[
    'public.nexid_persist_sun_scan_v1_base_0062(jsonb)',
    'public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)'
  ]::text[]
  LOOP
    FOR v_grantee IN
      SELECT DISTINCT role_row.rolname
      FROM pg_catalog.pg_proc routine
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(routine.proacl, pg_catalog.acldefault('f', routine.proowner))
      ) acl
      JOIN pg_catalog.pg_roles role_row ON role_row.oid = acl.grantee
      WHERE routine.oid = to_regprocedure(v_source_signature)
        AND acl.privilege_type = 'EXECUTE'
        AND acl.grantee <> routine.proowner
    LOOP
      EXECUTE pg_catalog.format(
        'REVOKE ALL PRIVILEGES ON FUNCTION %s FROM %I CASCADE',
        v_source_signature,
        v_grantee.rolname
      );
    END LOOP;
  END LOOP;
END
$sun_internal_acl_reconcile$;
REVOKE ALL ON FUNCTION public.nexid_packaging_lab_actor_authorized_v1(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_packaging_lab_override_authorized_v1(uuid, uuid, uuid) FROM PUBLIC;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS risk_profile_version text;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_risk_profile_version_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_risk_profile_version_check
  CHECK (
    risk_profile_version IS NULL
    OR risk_profile_version = 'nexid-risk-v1'
  ) NOT VALID;

ALTER TABLE public.events
  VALIDATE CONSTRAINT events_risk_profile_version_check;

-- Historical projections are separate from canonical NFC events. The
-- composite event identity mirrors the partitioned events primary key.
CREATE TABLE IF NOT EXISTS public.event_risk_projections (
  event_id bigint NOT NULL,
  event_created_at timestamptz NOT NULL,
  tenant_id uuid NOT NULL,
  risk_profile_version text NOT NULL,
  risk_score integer NOT NULL,
  risk_level public.risk_level NOT NULL,
  triggered_rules jsonb NOT NULL,
  recommended_action text NOT NULL,
  projected_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_risk_projections_pkey PRIMARY KEY (
    event_id, event_created_at, risk_profile_version
  ),
  CONSTRAINT event_risk_projections_version_check
    CHECK (risk_profile_version = 'nexid-risk-v1'),
  CONSTRAINT event_risk_projections_score_check
    CHECK (risk_score BETWEEN 0 AND 100),
  CONSTRAINT event_risk_projections_rules_check
    CHECK (jsonb_typeof(triggered_rules) = 'array')
);

-- CREATE TABLE IF NOT EXISTS must not silently accept same-named but weaker
-- checks from a prior partial deployment. Reassert and validate the exact
-- bounded risk contract; incompatible history aborts for reconciliation.
ALTER TABLE public.event_risk_projections
  DROP CONSTRAINT IF EXISTS event_risk_projections_version_check;
ALTER TABLE public.event_risk_projections
  ADD CONSTRAINT event_risk_projections_version_check
  CHECK (risk_profile_version = 'nexid-risk-v1') NOT VALID;
ALTER TABLE public.event_risk_projections
  VALIDATE CONSTRAINT event_risk_projections_version_check;

ALTER TABLE public.event_risk_projections
  DROP CONSTRAINT IF EXISTS event_risk_projections_score_check;
ALTER TABLE public.event_risk_projections
  ADD CONSTRAINT event_risk_projections_score_check
  CHECK (risk_score BETWEEN 0 AND 100) NOT VALID;
ALTER TABLE public.event_risk_projections
  VALIDATE CONSTRAINT event_risk_projections_score_check;

ALTER TABLE public.event_risk_projections
  DROP CONSTRAINT IF EXISTS event_risk_projections_rules_check;
ALTER TABLE public.event_risk_projections
  ADD CONSTRAINT event_risk_projections_rules_check
  CHECK (jsonb_typeof(triggered_rules) = 'array') NOT VALID;
ALTER TABLE public.event_risk_projections
  VALIDATE CONSTRAINT event_risk_projections_rules_check;

CREATE INDEX IF NOT EXISTS idx_event_risk_projections_tenant_created
  ON public.event_risk_projections (
    tenant_id, risk_profile_version, event_created_at DESC, event_id DESC
  );

-- Pure scoring contract shared by the write-time trigger and the historical
-- projector. Caller-supplied or legacy risk fields are never inputs. Batch
-- quarantine contributes only when captured in immutable event metadata;
-- mutable current batch state cannot rewrite historical meaning.
CREATE OR REPLACE FUNCTION public.nexid_compute_event_risk_v1(
  p_tenant_id uuid,
  p_batch_id uuid,
  p_event_type text,
  p_verdict text,
  p_result text,
  p_reason text,
  p_meta jsonb
)
RETURNS TABLE (
  risk_score integer,
  risk_level public.risk_level,
  triggered_rules jsonb,
  recommended_action text,
  risk_profile_version text
)
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $enterprise_event_risk_compute_v1$
DECLARE
  v_signal text := upper(concat_ws(' ', p_event_type, p_verdict, p_result, p_reason));
  v_rules jsonb := '[]'::jsonb;
  v_score integer := 0;
  v_meta jsonb := COALESCE(p_meta, '{}'::jsonb);
BEGIN
  IF v_signal ~ '(INVALID|CMAC_FAIL|CMAC_INVALID|SUN_PROFILE_MISMATCH|CRYPTO_FAIL)' THEN
    v_rules := v_rules || '"INVALID_SUN_OR_CMAC"'::jsonb;
    v_score := GREATEST(v_score, 90);
  END IF;
  IF v_signal ~ '(REPLAY|DUPLICATE_URL|COPIED_URL)' THEN
    v_rules := v_rules || '"REPLAY_SUSPECT"'::jsonb;
    v_score := GREATEST(v_score, 85);
  END IF;
  IF v_signal ~ '(NOT_REGISTERED|UNKNOWN_UID)' THEN
    v_rules := v_rules || '"UID_NOT_REGISTERED"'::jsonb;
    v_score := GREATEST(v_score, 70);
  END IF;
  IF v_signal ~ '(NOT_ACTIVE|REVOKED|BROKEN)' THEN
    v_rules := v_rules || '"TAG_INACTIVE_OR_REVOKED"'::jsonb;
    v_score := GREATEST(v_score, 95);
  END IF;
  IF lower(COALESCE(v_meta->>'excessive_scan_frequency', '')) = 'true' THEN
    v_rules := v_rules || '"EXCESSIVE_SCAN_FREQUENCY"'::jsonb;
    v_score := LEAST(100, v_score + 35);
  END IF;
  IF lower(COALESCE(v_meta->>'geo_anomaly', '')) = 'true'
     OR lower(COALESCE(v_meta->>'impossible_travel', '')) = 'true' THEN
    v_rules := v_rules || '"IMPOSSIBLE_TRAVEL_OR_GEO_ANOMALY"'::jsonb;
    v_score := LEAST(100, v_score + 55);
  END IF;
  IF lower(COALESCE(v_meta->>'distributor_mismatch', '')) = 'true'
     OR lower(COALESCE(v_meta->>'region_mismatch', '')) = 'true' THEN
    v_rules := v_rules || '"DISTRIBUTOR_OR_REGION_MISMATCH"'::jsonb;
    v_score := LEAST(100, v_score + 45);
  END IF;
  IF v_signal ~ '(OPENED|TAMPER)'
     AND lower(COALESCE(v_meta->>'before_expected_sale_stage', '')) = 'true' THEN
    v_rules := v_rules || '"TAMPER_BEFORE_EXPECTED_SALE_STAGE"'::jsonb;
    v_score := LEAST(100, v_score + 65);
  END IF;
  IF lower(COALESCE(v_meta->>'repeated_ownership_attempts', '')) = 'true' THEN
    v_rules := v_rules || '"REPEATED_OWNERSHIP_ATTEMPTS"'::jsonb;
    v_score := LEAST(100, v_score + 50);
  END IF;
  IF lower(COALESCE(v_meta->>'unexpected_device', '')) = 'true'
     OR lower(COALESCE(v_meta->>'unexpected_network', '')) = 'true' THEN
    v_rules := v_rules || '"UNEXPECTED_DEVICE_OR_NETWORK"'::jsonb;
    v_score := LEAST(100, v_score + 35);
  END IF;
  IF lower(COALESCE(v_meta->>'batch_quarantined', '')) = 'true' THEN
    v_rules := v_rules || '"BATCH_QUARANTINED"'::jsonb;
    v_score := 100;
  END IF;

  RETURN QUERY SELECT
    v_score,
    CASE
      WHEN v_score >= 80 THEN 'critical'::public.risk_level
      WHEN v_score >= 50 THEN 'high'::public.risk_level
      WHEN v_score >= 25 THEN 'medium'::public.risk_level
      WHEN v_score > 0 THEN 'low'::public.risk_level
      ELSE 'none'::public.risk_level
    END,
    v_rules,
    CASE
      WHEN v_rules ?| ARRAY['BATCH_QUARANTINED', 'TAG_INACTIVE_OR_REVOKED']
        THEN 'BLOCK_AND_ESCALATE_TO_TENANT_SECURITY'
      WHEN v_score >= 80 THEN 'BLOCK_SENSITIVE_ACTIONS_AND_OPEN_INCIDENT'
      WHEN v_score >= 50 THEN 'REQUIRE_PHYSICAL_RESCAN_AND_SECURITY_REVIEW'
      WHEN v_score >= 25 THEN 'MONITOR_AND_REQUEST_OPERATOR_CONTEXT'
      ELSE 'ALLOW_WITH_STANDARD_MONITORING'
    END,
    'nexid-risk-v1'::text;
END;
$enterprise_event_risk_compute_v1$;

-- New or legitimately mutable events keep their write-time projection. The
-- tenant_id input is included so a permitted tenant rebinding cannot retain an
-- obsolete score. Consumed evidence still fails first in the immutable trigger.
CREATE OR REPLACE FUNCTION public.nexid_explain_event_risk_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $enterprise_event_risk_trigger_v1$
DECLARE
  v_projection record;
  v_batch_quarantined boolean := false;
  v_refresh_batch_snapshot boolean := false;
BEGIN
  -- Bind mutable batch status into immutable event evidence at write time. A
  -- caller cannot forge or clear this bit, and later batch changes cannot
  -- rewrite historical meaning. Rebinding a still-mutable event takes a fresh
  -- snapshot for the new tenant/batch identity.
  v_refresh_batch_snapshot := TG_OP = 'INSERT';
  IF TG_OP = 'UPDATE' THEN
    v_refresh_batch_snapshot := NEW.batch_id IS DISTINCT FROM OLD.batch_id
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id;
  END IF;

  IF v_refresh_batch_snapshot THEN
    IF NEW.batch_id IS NOT NULL THEN
      SELECT lower(COALESCE(batch.status::text, '')) = 'quarantined'
      INTO v_batch_quarantined
      FROM public.batches batch
      WHERE batch.id = NEW.batch_id
        AND batch.tenant_id = NEW.tenant_id;
    END IF;
    NEW.meta := jsonb_set(
      COALESCE(NEW.meta, '{}'::jsonb),
      '{batch_quarantined}',
      to_jsonb(COALESCE(v_batch_quarantined, false)),
      true
    );
  ELSE
    NEW.meta := jsonb_set(
      COALESCE(NEW.meta, '{}'::jsonb),
      '{batch_quarantined}',
      to_jsonb(
        lower(COALESCE(OLD.meta->>'batch_quarantined', 'false')) = 'true'
        OR COALESCE(OLD.triggered_rules, '[]'::jsonb) ? 'BATCH_QUARANTINED'
      ),
      true
    );
  END IF;

  SELECT * INTO STRICT v_projection
  FROM public.nexid_compute_event_risk_v1(
    NEW.tenant_id,
    NEW.batch_id,
    NEW.event_type::text,
    NEW.verdict::text,
    NEW.result,
    NEW.reason,
    NEW.meta
  );

  NEW.risk_score := v_projection.risk_score;
  NEW.risk_level := v_projection.risk_level;
  NEW.triggered_rules := v_projection.triggered_rules;
  NEW.recommended_action := v_projection.recommended_action;
  NEW.risk_profile_version := v_projection.risk_profile_version;
  RETURN NEW;
END;
$enterprise_event_risk_trigger_v1$;

DROP TRIGGER IF EXISTS trg_events_explainable_risk_v1 ON public.events;
CREATE TRIGGER trg_events_explainable_risk_v1
BEFORE INSERT OR UPDATE OF
  tenant_id, event_type, verdict, result, reason, meta, batch_id,
  risk_score, risk_level, triggered_rules, recommended_action,
  risk_profile_version
ON public.events
FOR EACH ROW EXECUTE FUNCTION public.nexid_explain_event_risk_v1();

-- Operators invoke this repeatedly inside short transactions. Rows are locked
-- only to coordinate concurrent projectors. INSERT targets the derived table;
-- canonical events (including consumed SUN evidence) are never updated.
CREATE OR REPLACE FUNCTION public.nexid_backfill_event_risk_v1(p_limit integer)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $enterprise_event_risk_backfill_v1$
DECLARE
  v_processed integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 5000 THEN
    RAISE EXCEPTION 'event_risk_backfill_limit_invalid' USING ERRCODE = '22023';
  END IF;

  WITH candidates AS MATERIALIZED (
    SELECT event_row.id, event_row.created_at
    FROM public.events event_row
    WHERE event_row.risk_profile_version IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.event_risk_projections existing_projection
        WHERE existing_projection.event_id = event_row.id
          AND existing_projection.event_created_at = event_row.created_at
          AND existing_projection.risk_profile_version = 'nexid-risk-v1'
      )
    ORDER BY event_row.id, event_row.created_at
    FOR UPDATE OF event_row SKIP LOCKED
    LIMIT p_limit
  ), inserted AS (
    INSERT INTO public.event_risk_projections (
      event_id, event_created_at, tenant_id, risk_profile_version, risk_score,
      risk_level, triggered_rules, recommended_action
    )
    SELECT
      event_row.id,
      event_row.created_at,
      event_row.tenant_id,
      projection.risk_profile_version,
      projection.risk_score,
      projection.risk_level,
      projection.triggered_rules,
      projection.recommended_action
    FROM candidates
    JOIN public.events event_row
      ON event_row.id = candidates.id
     AND event_row.created_at = candidates.created_at
    CROSS JOIN LATERAL public.nexid_compute_event_risk_v1(
      event_row.tenant_id,
      event_row.batch_id,
      event_row.event_type::text,
      event_row.verdict::text,
      event_row.result,
      event_row.reason,
      jsonb_set(
        COALESCE(event_row.meta, '{}'::jsonb),
        '{batch_quarantined}',
        to_jsonb(
          lower(COALESCE(event_row.meta->>'batch_quarantined', 'false')) = 'true'
          OR COALESCE(event_row.triggered_rules, '[]'::jsonb) ? 'BATCH_QUARANTINED'
        ),
        true
      )
    ) projection
    ON CONFLICT (event_id, event_created_at, risk_profile_version) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_processed FROM inserted;

  RETURN v_processed;
END;
$enterprise_event_risk_backfill_v1$;

CREATE OR REPLACE FUNCTION public.nexid_enterprise_rbac_risk_truth_v1_capability()
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT 'enterprise-rbac-risk-truth/v1'::text
$$;

REVOKE ALL ON TABLE public.event_risk_projections FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_compute_event_risk_v1(uuid, uuid, text, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_explain_event_risk_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_backfill_event_risk_v1(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_enterprise_rbac_risk_truth_v1_capability() FROM PUBLIC;

DO $enterprise_rbac_risk_truth_postcheck$
DECLARE
  v_expected jsonb;
BEGIN
  IF to_regclass('public.event_risk_projections') IS NULL
    OR to_regclass('public.enterprise_authority_scope_locks') IS NULL
    OR (
      SELECT count(*)
      FROM pg_catalog.pg_attribute attribute_row
      WHERE attribute_row.attrelid = to_regclass('public.enterprise_authority_scope_locks')
        AND attribute_row.attnum > 0
        AND NOT attribute_row.attisdropped
    ) <> 3
    OR EXISTS (
      SELECT 1
      FROM (VALUES
        ('user_id', 'pg_catalog.uuid'::regtype, true, false),
        ('scope_key', 'pg_catalog.text'::regtype, true, false),
        ('lock_version', 'pg_catalog.int8'::regtype, true, true)
      ) AS expected(column_name, type_oid, is_not_null, has_zero_default)
      WHERE NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_attribute attribute_row
        LEFT JOIN pg_catalog.pg_attrdef default_row
          ON default_row.adrelid = attribute_row.attrelid
         AND default_row.adnum = attribute_row.attnum
        WHERE attribute_row.attrelid = to_regclass('public.enterprise_authority_scope_locks')
          AND attribute_row.attname = expected.column_name
          AND attribute_row.atttypid = expected.type_oid
          AND attribute_row.atttypmod = -1
          AND attribute_row.attnotnull = expected.is_not_null
          AND attribute_row.attidentity = ''
          AND attribute_row.attgenerated = ''
          AND NOT attribute_row.attisdropped
          AND (
            (NOT expected.has_zero_default AND default_row.oid IS NULL)
            OR (
              expected.has_zero_default
              AND pg_catalog.regexp_replace(
                pg_catalog.lower(pg_catalog.pg_get_expr(default_row.adbin, default_row.adrelid)),
                '[[:space:]()]', '', 'g'
              ) = ANY (ARRAY['0', '0::bigint', '''0''::bigint']::text[])
            )
          )
      )
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint constraint_row
      WHERE constraint_row.conrelid = to_regclass('public.enterprise_authority_scope_locks')
        AND constraint_row.conname = 'enterprise_authority_scope_locks_pkey'
        AND constraint_row.contype = 'p'
        AND constraint_row.convalidated
        AND (
          SELECT array_agg(attribute_row.attname::text ORDER BY key_column.ordinality)
          FROM unnest(constraint_row.conkey) WITH ORDINALITY key_column(attnum, ordinality)
          JOIN pg_catalog.pg_attribute attribute_row
            ON attribute_row.attrelid = constraint_row.conrelid
           AND attribute_row.attnum = key_column.attnum
        ) = ARRAY['user_id', 'scope_key']::text[]
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint constraint_row
      WHERE constraint_row.conrelid = to_regclass('public.enterprise_authority_scope_locks')
        AND constraint_row.conname = 'enterprise_authority_scope_locks_scope_check'
        AND constraint_row.contype = 'c'
        AND constraint_row.convalidated
        AND pg_catalog.regexp_replace(
          pg_catalog.lower(pg_catalog.pg_get_expr(constraint_row.conbin, constraint_row.conrelid)),
          '[[:space:]()]', '', 'g'
        ) = 'scope_key=''global''::textorscope_key~''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text'
    )
    OR to_regprocedure('public.nexid_touch_authority_scope_lock_v1(uuid,uuid)') IS NULL
    OR to_regprocedure('public.nexid_serialize_authority_scope_v1()') IS NULL
    OR NOT COALESCE((
      SELECT touch_routine.prosecdef
        AND serializer_routine.prosecdef
        AND touch_routine.proowner = serializer_routine.proowner
        AND touch_routine.proowner = lock_relation.relowner
        AND touch_routine.proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
        AND serializer_routine.proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
      FROM pg_catalog.pg_proc touch_routine
      JOIN pg_catalog.pg_proc serializer_routine
        ON serializer_routine.oid = to_regprocedure('public.nexid_serialize_authority_scope_v1()')
      JOIN pg_catalog.pg_class lock_relation
        ON lock_relation.oid = to_regclass('public.enterprise_authority_scope_locks')
       AND lock_relation.relkind = 'r'
      WHERE touch_routine.oid = to_regprocedure('public.nexid_touch_authority_scope_lock_v1(uuid,uuid)')
    ), false)
    OR pg_catalog.pg_get_functiondef(
      to_regprocedure('public.nexid_touch_authority_scope_lock_v1(uuid,uuid)')
    ) NOT LIKE '%pg_advisory_xact_lock%INSERT INTO public.enterprise_authority_scope_locks%ON CONFLICT (user_id, scope_key) DO UPDATE%lock_version + 1%'
    OR pg_catalog.pg_get_functiondef(
      to_regprocedure('public.nexid_serialize_authority_scope_v1()')
    ) NOT LIKE '%ELSIF v_old_identity < v_new_identity THEN%nexid_touch_authority_scope_lock_v1(OLD.user_id, OLD.tenant_id)%nexid_touch_authority_scope_lock_v1(NEW.user_id, NEW.tenant_id)%ELSE%nexid_touch_authority_scope_lock_v1(NEW.user_id, NEW.tenant_id)%nexid_touch_authority_scope_lock_v1(OLD.user_id, OLD.tenant_id)%'
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_trigger trigger_row
      WHERE trigger_row.tgrelid = to_regclass('public.resource_permissions')
        AND trigger_row.tgname = 'trg_resource_permissions_scope_serialize'
        AND trigger_row.tgfoid = to_regprocedure('public.nexid_serialize_authority_scope_v1()')
        AND trigger_row.tgtype = 23
        AND NOT trigger_row.tgisinternal
        AND trigger_row.tgenabled <> 'D'
        AND NOT trigger_row.tgdeferrable
        AND NOT trigger_row.tginitdeferred
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_trigger trigger_row
      WHERE trigger_row.tgrelid = to_regclass('public.memberships')
        AND trigger_row.tgname = 'trg_memberships_permission_scope_serialize'
        AND trigger_row.tgfoid = to_regprocedure('public.nexid_serialize_authority_scope_v1()')
        AND trigger_row.tgtype = 27
        AND NOT trigger_row.tgisinternal
        AND trigger_row.tgenabled <> 'D'
        AND NOT trigger_row.tgdeferrable
        AND NOT trigger_row.tginitdeferred
    )
    OR (
      SELECT count(*)
      FROM pg_catalog.pg_attribute attribute_row
      WHERE attribute_row.attrelid = 'public.event_risk_projections'::regclass
        AND attribute_row.attnum > 0
        AND NOT attribute_row.attisdropped
    ) <> 9
    OR EXISTS (
      SELECT 1
      FROM (VALUES
        ('event_id', 'pg_catalog.int8'::regtype, true, NULL::text),
        ('event_created_at', 'pg_catalog.timestamptz'::regtype, true, NULL::text),
        ('tenant_id', 'pg_catalog.uuid'::regtype, true, NULL::text),
        ('risk_profile_version', 'pg_catalog.text'::regtype, true, NULL::text),
        ('risk_score', 'pg_catalog.int4'::regtype, true, NULL::text),
        ('risk_level', 'public.risk_level'::regtype, true, NULL::text),
        ('triggered_rules', 'pg_catalog.jsonb'::regtype, true, NULL::text),
        ('recommended_action', 'pg_catalog.text'::regtype, true, NULL::text),
        ('projected_at', 'pg_catalog.timestamptz'::regtype, true, 'now()'::text)
      ) AS expected(column_name, type_oid, is_not_null, default_expression)
      WHERE NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_attribute attribute_row
        LEFT JOIN pg_catalog.pg_attrdef default_row
          ON default_row.adrelid = attribute_row.attrelid
         AND default_row.adnum = attribute_row.attnum
        WHERE attribute_row.attrelid = 'public.event_risk_projections'::regclass
          AND attribute_row.attname = expected.column_name
          AND attribute_row.atttypid = expected.type_oid
          AND attribute_row.atttypmod = -1
          AND attribute_row.attnotnull = expected.is_not_null
          AND NOT attribute_row.attisdropped
          AND (
            (expected.default_expression IS NULL AND default_row.oid IS NULL)
            OR pg_catalog.pg_get_expr(default_row.adbin, default_row.adrelid)
              = expected.default_expression
          )
      )
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint constraint_row
      WHERE constraint_row.conrelid = 'public.event_risk_projections'::regclass
        AND constraint_row.conname = 'event_risk_projections_pkey'
        AND constraint_row.contype = 'p'
        AND constraint_row.convalidated
        AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
          = 'PRIMARY KEY (event_id, event_created_at, risk_profile_version)'
        AND (
          SELECT array_agg(attribute_row.attname::text ORDER BY key_column.ordinality)
          FROM unnest(constraint_row.conkey) WITH ORDINALITY key_column(attnum, ordinality)
          JOIN pg_catalog.pg_attribute attribute_row
            ON attribute_row.attrelid = constraint_row.conrelid
           AND attribute_row.attnum = key_column.attnum
        ) = ARRAY['event_id', 'event_created_at', 'risk_profile_version']::text[]
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint constraint_row
      WHERE constraint_row.conrelid = 'public.event_risk_projections'::regclass
        AND constraint_row.conname = 'event_risk_projections_version_check'
        AND constraint_row.contype = 'c'
        AND constraint_row.convalidated
        AND pg_catalog.regexp_replace(
          pg_catalog.lower(pg_catalog.pg_get_expr(constraint_row.conbin, constraint_row.conrelid)),
          '[[:space:]()]', '', 'g'
        ) = 'risk_profile_version=''nexid-risk-v1''::text'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint constraint_row
      WHERE constraint_row.conrelid = 'public.event_risk_projections'::regclass
        AND constraint_row.conname = 'event_risk_projections_score_check'
        AND constraint_row.contype = 'c'
        AND constraint_row.convalidated
        AND pg_catalog.regexp_replace(
          pg_catalog.lower(pg_catalog.pg_get_expr(constraint_row.conbin, constraint_row.conrelid)),
          '[[:space:]()]', '', 'g'
        ) = 'risk_score>=0andrisk_score<=100'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint constraint_row
      WHERE constraint_row.conrelid = 'public.event_risk_projections'::regclass
        AND constraint_row.conname = 'event_risk_projections_rules_check'
        AND constraint_row.contype = 'c'
        AND constraint_row.convalidated
        AND pg_catalog.regexp_replace(
          pg_catalog.lower(pg_catalog.pg_get_expr(constraint_row.conbin, constraint_row.conrelid)),
          '[[:space:]()]', '', 'g'
        ) = 'jsonb_typeoftriggered_rules=''array''::text'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'resource_permissions'
        AND column_name = 'tenant_id'
        AND data_type = 'uuid'
        AND is_nullable = 'YES'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_index index_row
      WHERE index_row.indexrelid = to_regclass('public.ux_resource_permissions_tenant_scope')
        AND index_row.indrelid = 'public.resource_permissions'::regclass
        AND index_row.indisvalid
        AND index_row.indisready
        AND index_row.indislive
        AND index_row.indisunique
        AND index_row.indnkeyatts = 5
        AND index_row.indnatts = 5
        AND ARRAY[
          pg_catalog.pg_get_indexdef(index_row.indexrelid, 1, false),
          pg_catalog.pg_get_indexdef(index_row.indexrelid, 2, false),
          pg_catalog.pg_get_indexdef(index_row.indexrelid, 3, false),
          pg_catalog.pg_get_indexdef(index_row.indexrelid, 4, false),
          pg_catalog.pg_get_indexdef(index_row.indexrelid, 5, false)
        ] = ARRAY['user_id', 'tenant_id', 'resource', 'action', 'effect']::text[]
        AND pg_catalog.pg_get_indexdef(index_row.indexrelid)
          LIKE '%(user_id, tenant_id, resource, action, effect)%'
        AND pg_catalog.pg_get_expr(index_row.indpred, index_row.indrelid)
          = '(tenant_id IS NOT NULL)'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_index index_row
      WHERE index_row.indexrelid = to_regclass('public.ux_resource_permissions_global_scope')
        AND index_row.indrelid = 'public.resource_permissions'::regclass
        AND index_row.indisvalid
        AND index_row.indisready
        AND index_row.indislive
        AND index_row.indisunique
        AND index_row.indnkeyatts = 4
        AND index_row.indnatts = 4
        AND ARRAY[
          pg_catalog.pg_get_indexdef(index_row.indexrelid, 1, false),
          pg_catalog.pg_get_indexdef(index_row.indexrelid, 2, false),
          pg_catalog.pg_get_indexdef(index_row.indexrelid, 3, false),
          pg_catalog.pg_get_indexdef(index_row.indexrelid, 4, false)
        ] = ARRAY['user_id', 'resource', 'action', 'effect']::text[]
        AND pg_catalog.pg_get_indexdef(index_row.indexrelid)
          LIKE '%(user_id, resource, action, effect)%'
        AND pg_catalog.pg_get_expr(index_row.indpred, index_row.indrelid)
          = '(tenant_id IS NULL)'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_index index_row
      WHERE index_row.indexrelid = to_regclass('public.idx_resource_permissions_tenant_user')
        AND index_row.indrelid = 'public.resource_permissions'::regclass
        AND index_row.indisvalid
        AND index_row.indisready
        AND index_row.indislive
        AND NOT index_row.indisunique
        AND index_row.indnkeyatts = 5
        AND index_row.indnatts = 5
        AND index_row.indpred IS NULL
        AND ARRAY[
          pg_catalog.pg_get_indexdef(index_row.indexrelid, 1, false),
          pg_catalog.pg_get_indexdef(index_row.indexrelid, 2, false),
          pg_catalog.pg_get_indexdef(index_row.indexrelid, 3, false),
          pg_catalog.pg_get_indexdef(index_row.indexrelid, 4, false),
          pg_catalog.pg_get_indexdef(index_row.indexrelid, 5, false)
        ] = ARRAY['tenant_id', 'user_id', 'resource', 'action', 'effect']::text[]
        AND pg_catalog.pg_get_indexdef(index_row.indexrelid)
          LIKE '%(tenant_id, user_id, resource, action, effect)%'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_index index_row
      WHERE index_row.indexrelid = to_regclass('public.idx_event_risk_projections_tenant_created')
        AND index_row.indrelid = 'public.event_risk_projections'::regclass
        AND index_row.indisvalid
        AND index_row.indisready
        AND index_row.indislive
        AND NOT index_row.indisunique
        AND index_row.indnkeyatts = 4
        AND index_row.indnatts = 4
        AND index_row.indpred IS NULL
        AND ARRAY[
          pg_catalog.pg_get_indexdef(index_row.indexrelid, 1, false),
          pg_catalog.pg_get_indexdef(index_row.indexrelid, 2, false),
          pg_catalog.pg_get_indexdef(index_row.indexrelid, 3, false),
          pg_catalog.pg_get_indexdef(index_row.indexrelid, 4, false)
        -- The per-column pg_get_indexdef overload returns only each key
        -- expression. Sort direction is verified structurally through
        -- pg_index_column_has_property below.
        ] = ARRAY['tenant_id', 'risk_profile_version', 'event_created_at', 'event_id']::text[]
        AND pg_catalog.pg_index_column_has_property(index_row.indexrelid, 1, 'asc') IS TRUE
        AND pg_catalog.pg_index_column_has_property(index_row.indexrelid, 2, 'asc') IS TRUE
        AND pg_catalog.pg_index_column_has_property(index_row.indexrelid, 3, 'desc') IS TRUE
        AND pg_catalog.pg_index_column_has_property(index_row.indexrelid, 4, 'desc') IS TRUE
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_constraint constraint_row
      WHERE constraint_row.conrelid = 'public.resource_permissions'::regclass
        AND constraint_row.conname = 'resource_permissions_tenant_id_fkey'
        AND constraint_row.contype = 'f'
        AND constraint_row.convalidated
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint constraint_row
      WHERE constraint_row.conrelid = 'public.resource_permissions'::regclass
        AND constraint_row.conname = 'resource_permissions_effect_check'
        AND constraint_row.contype = 'c'
        AND constraint_row.convalidated
        AND pg_catalog.pg_get_constraintdef(constraint_row.oid) LIKE '%effect = ANY%'
        AND pg_catalog.pg_get_constraintdef(constraint_row.oid) LIKE '%allow%'
        AND pg_catalog.pg_get_constraintdef(constraint_row.oid) LIKE '%deny%'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_trigger trigger_row
      WHERE trigger_row.tgrelid = 'public.resource_permissions'::regclass
        AND trigger_row.tgname = 'trg_resource_permissions_tenant_scope'
        AND NOT trigger_row.tgisinternal
        AND trigger_row.tgenabled <> 'D'
        AND trigger_row.tgdeferrable
        AND trigger_row.tginitdeferred
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_trigger trigger_row
      WHERE trigger_row.tgrelid = 'public.memberships'::regclass
        AND trigger_row.tgname = 'trg_memberships_permission_scope'
        AND NOT trigger_row.tgisinternal
        AND trigger_row.tgenabled <> 'D'
        AND trigger_row.tgdeferrable
        AND trigger_row.tginitdeferred
    )
    OR EXISTS (
      SELECT 1
      FROM public.resource_permissions permission
      WHERE permission.effect NOT IN ('allow', 'deny')
    )
    OR EXISTS (
      SELECT 1
      FROM public.resource_permissions permission
      WHERE (
        permission.tenant_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.memberships membership
          WHERE membership.user_id = permission.user_id
            AND membership.role::text = 'super_admin'
            AND membership.tenant_id IS NULL
        )
      ) OR (
        permission.tenant_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.memberships membership
          WHERE membership.user_id = permission.user_id
            AND membership.tenant_id = permission.tenant_id
            AND membership.role::text <> 'super_admin'
        )
      )
    )
    OR to_regprocedure('public.nexid_validate_resource_permission_scope_v1()') IS NULL
    OR to_regprocedure('public.nexid_validate_membership_permission_scope_v1()') IS NULL
    OR to_regprocedure('public.nexid_actor_has_enterprise_capability_v1(uuid,uuid,text,text)') IS NULL
    OR pg_get_functiondef(to_regprocedure('public.nexid_actor_has_enterprise_capability_v1(uuid,uuid,text,text)'))
      NOT LIKE '%supplier_order.create%supplier_orders:write%batch.keys.generate%supplier:batch_keys_generate%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_actor_has_enterprise_capability_v1(uuid,uuid,text,text)'))
      NOT LIKE '%batch.lifecycle%batch:lifecycle%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_actor_has_enterprise_capability_v1(uuid,uuid,text,text)'))
      NOT LIKE '%batch.activation.override%supplier:activate_override%batch.internal.register%batch:register_internal%batch.keys.rotate%supplier:key_rotate%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_actor_has_enterprise_capability_v1(uuid,uuid,text,text)'))
      NOT LIKE '%qa.approve%supplier:qa_approve%supplier:qa%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_explain_event_risk_v1()'))
      NOT LIKE '%jsonb_set(%batch_quarantined%OLD.meta%'
    OR to_regprocedure('public.nexid_packaging_lab_permission_denied_v2(uuid,uuid,text)') IS NULL
    OR pg_get_functiondef(to_regprocedure('public.nexid_packaging_lab_permission_denied_v2(uuid,uuid,text)'))
      NOT LIKE '%qa_approve%qa%'
    OR to_regprocedure('public.nexid_validate_supplier_qa_plan_dual_control_v1()') IS NULL
    OR to_regprocedure('public.nexid_replace_function_fragment_v1(text,text,text)') IS NOT NULL
    OR NOT EXISTS (
      SELECT 1
      FROM pg_constraint constraint_row
      WHERE constraint_row.conrelid = 'public.supplier_production_qa_plan_decisions'::regclass
        AND constraint_row.conname = 'supplier_production_qa_plan_decisions_approver_role_check'
        AND constraint_row.convalidated
        AND pg_get_constraintdef(constraint_row.oid) LIKE '%tenant_owner%'
        AND pg_get_constraintdef(constraint_row.oid) LIKE '%tenant_admin%'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_trigger trigger_row
      WHERE trigger_row.tgrelid = 'public.supplier_production_qa_plan_decisions'::regclass
        AND trigger_row.tgname = 'trg_supplier_qa_plan_dual_control'
        AND NOT trigger_row.tgisinternal
        AND trigger_row.tgenabled <> 'D'
        AND trigger_row.tgdeferrable
        AND trigger_row.tginitdeferred
    )
    OR EXISTS (
      SELECT 1
      FROM public.supplier_production_qa_plan_decisions decision_row
      JOIN public.supplier_production_qa_plans plan
        ON plan.id = decision_row.plan_id
       AND plan.tenant_id = decision_row.tenant_id
      WHERE decision_row.decided_by = plan.submitted_by
         OR decision_row.decided_session_id = plan.submitted_session_id
    )
    OR pg_get_functiondef(to_regprocedure('public.nexid_import_tag_manifest_v2_core_0081(jsonb)'))
      NOT LIKE '%nexid_actor_has_enterprise_capability_v1(%manifest.import%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_create_supplier_order_v2(jsonb)'))
      NOT LIKE '%nexid_actor_has_enterprise_capability_v1(%supplier_order.create%batch.keys.generate%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_create_supplier_order_v2(jsonb)'))
      NOT LIKE '%NOT v_secure_sun%auth_session.mfa_verified IS TRUE%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_activate_supplier_tags_v2(jsonb)'))
      NOT LIKE '%nexid_actor_has_enterprise_capability_v1(%batch.activate%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_transition_tag_lifecycle_v1(jsonb)'))
      NOT LIKE '%nexid_actor_has_enterprise_capability_v1(%batch.lifecycle%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_submit_supplier_production_qa_plan_v1(jsonb)'))
      NOT LIKE '%nexid_actor_has_enterprise_capability_v1(%qa.approve%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_create_supplier_production_qa_session_v1(jsonb)'))
      NOT LIKE '%nexid_actor_has_enterprise_capability_v1(%qa.approve%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_commit_supplier_production_qa_v1(jsonb)'))
      NOT LIKE '%nexid_actor_has_enterprise_capability_v1(%qa.approve%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_decide_supplier_production_qa_plan_v1(jsonb)'))
      NOT LIKE '%nexid_actor_has_enterprise_capability_v1(%qa.plan.approve%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_decide_supplier_production_qa_plan_v1(jsonb)'))
      NOT LIKE '%v_auth_session_id, v_approver_role, v_permissions%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_decide_supplier_production_qa_plan_v1(jsonb)'))
      NOT LIKE '%effective-capability-policy:enterprise-rbac-risk-truth/v1:%qa.plan.approve%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_decide_supplier_production_qa_plan_v1(jsonb)'))
      NOT LIKE '%v_plan.submitted_by = v_actor_id%supplier_production_qa_plan_dual_control_required%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_supplier_sun_production_activation_receipt_v2(uuid)'))
      NOT LIKE '%approver_role IN (%tenant_owner%tenant_admin%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_supplier_keyless_production_activation_receipt_v1(uuid)'))
      NOT LIKE '%approver_role IN (%tenant_owner%tenant_admin%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_commit_supplier_carrier_qa_v1(jsonb)'))
      NOT LIKE '%approver_role IN (%tenant_owner%tenant_admin%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_packaging_lab_actor_authorized_v1(uuid,uuid,uuid,text)'))
      NOT LIKE '%nexid_packaging_lab_permission_denied_v2(%v_session_tenant_id, p_actor_id, p_action%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_packaging_lab_actor_authorized_v1(uuid,uuid,uuid,text)'))
      NOT LIKE '%permission.tenant_id IS NOT DISTINCT FROM v_session_tenant_id%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_packaging_lab_override_authorized_v1(uuid,uuid,uuid)'))
      NOT LIKE '%nexid_packaging_lab_permission_denied_v2(%v_session_tenant_id, p_actor_id%'
    OR pg_get_functiondef(to_regprocedure('public.nexid_packaging_lab_override_authorized_v1(uuid,uuid,uuid)'))
      NOT LIKE '%permission.tenant_id IS NOT DISTINCT FROM v_session_tenant_id%'
    OR NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'events'
        AND column_name = 'risk_profile_version'
        AND is_nullable = 'YES'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_constraint constraint_row
      WHERE constraint_row.conrelid = 'public.events'::regclass
        AND constraint_row.conname = 'events_risk_profile_version_check'
        AND constraint_row.convalidated
        AND pg_get_constraintdef(constraint_row.oid) LIKE '%risk_profile_version IS NULL%'
        AND pg_get_constraintdef(constraint_row.oid) LIKE '%nexid-risk-v1%'
    )
    OR NOT EXISTS (
      SELECT 1 FROM pg_constraint constraint_row
      WHERE constraint_row.conrelid = 'public.memberships'::regclass
        AND constraint_row.conname = 'memberships_enterprise_tenant_binding_check'
        AND pg_get_constraintdef(constraint_row.oid) LIKE '%super_admin%'
        AND pg_get_constraintdef(constraint_row.oid) LIKE '%tenant_id%'
    )
    OR NOT EXISTS (
      SELECT 1 FROM pg_constraint constraint_row
      WHERE constraint_row.conrelid = 'public.auth_sessions'::regclass
        AND constraint_row.conname = 'auth_sessions_enterprise_tenant_binding_check'
        AND pg_get_constraintdef(constraint_row.oid) LIKE '%revoked_at%'
        AND pg_get_constraintdef(constraint_row.oid) LIKE '%super_admin%'
    )
    OR to_regprocedure('public.nexid_compute_event_risk_v1(uuid,uuid,text,text,text,text,jsonb)') IS NULL
    OR to_regprocedure('public.nexid_backfill_event_risk_v1(integer)') IS NULL
    OR to_regprocedure('public.nexid_enterprise_rbac_risk_truth_v1_capability()') IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM pg_trigger trigger_row
      WHERE trigger_row.tgrelid = 'public.events'::regclass
        AND trigger_row.tgname = 'trg_events_explainable_risk_v1'
        AND NOT trigger_row.tgisinternal
        AND trigger_row.tgenabled <> 'D'
        AND pg_get_triggerdef(trigger_row.oid) LIKE '%tenant_id%'
        AND pg_get_triggerdef(trigger_row.oid) LIKE '%risk_profile_version%'
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class relation_row
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(relation_row.relacl, pg_catalog.acldefault('r', relation_row.relowner))
      ) acl
      WHERE relation_row.oid IN (
        'public.resource_permissions'::regclass,
        'public.enterprise_authority_scope_locks'::regclass,
        'public.event_risk_projections'::regclass
      )
        AND acl.grantee = 0
    )
    OR EXISTS (
      SELECT 1
      FROM pg_proc routine
      CROSS JOIN LATERAL aclexplode(COALESCE(routine.proacl, acldefault('f', routine.proowner))) acl
      WHERE routine.oid IN (
        to_regprocedure('public.nexid_compute_event_risk_v1(uuid,uuid,text,text,text,text,jsonb)'),
        to_regprocedure('public.nexid_explain_event_risk_v1()'),
        to_regprocedure('public.nexid_backfill_event_risk_v1(integer)'),
        to_regprocedure('public.nexid_enterprise_rbac_risk_truth_v1_capability()'),
        to_regprocedure('public.nexid_touch_authority_scope_lock_v1(uuid,uuid)'),
        to_regprocedure('public.nexid_serialize_authority_scope_v1()'),
        to_regprocedure('public.nexid_validate_resource_permission_scope_v1()'),
        to_regprocedure('public.nexid_validate_membership_permission_scope_v1()'),
        to_regprocedure('public.nexid_validate_supplier_qa_plan_dual_control_v1()'),
        to_regprocedure('public.nexid_actor_has_enterprise_capability_v1(uuid,uuid,text,text)'),
        to_regprocedure('public.nexid_packaging_lab_permission_denied_v2(uuid,uuid,text)'),
        to_regprocedure('public.nexid_packaging_lab_actor_authorized_v1(uuid,uuid,uuid,text)'),
        to_regprocedure('public.nexid_packaging_lab_override_authorized_v1(uuid,uuid,uuid)'),
        to_regprocedure('public.nexid_transition_tag_lifecycle_v1(jsonb)'),
        to_regprocedure('public.nexid_import_tag_manifest_v2(jsonb)'),
        to_regprocedure('public.nexid_import_tag_manifest_v2_core_0081(jsonb)'),
        to_regprocedure('public.nexid_create_supplier_order_v2(jsonb)'),
        to_regprocedure('public.nexid_activate_supplier_tags_v2(jsonb)'),
        to_regprocedure('public.nexid_submit_supplier_production_qa_plan_v1(jsonb)'),
        to_regprocedure('public.nexid_decide_supplier_production_qa_plan_v1(jsonb)'),
        to_regprocedure('public.nexid_create_supplier_production_qa_session_v1(jsonb)'),
        to_regprocedure('public.nexid_commit_supplier_production_qa_v1(jsonb)'),
        to_regprocedure('public.nexid_supplier_production_activation_receipt_v2(uuid)')
        ,to_regprocedure('public.nexid_supplier_sun_production_activation_receipt_v2(uuid)')
        ,to_regprocedure('public.nexid_supplier_keyless_production_activation_receipt_v1(uuid)')
        ,to_regprocedure('public.nexid_commit_supplier_carrier_qa_v1(jsonb)')
      )
        AND acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    )
    OR EXISTS (
      SELECT 1
      FROM pg_proc routine
      WHERE routine.oid IN (
        to_regprocedure('public.nexid_compute_event_risk_v1(uuid,uuid,text,text,text,text,jsonb)'),
        to_regprocedure('public.nexid_explain_event_risk_v1()'),
        to_regprocedure('public.nexid_backfill_event_risk_v1(integer)'),
        to_regprocedure('public.nexid_enterprise_rbac_risk_truth_v1_capability()'),
        to_regprocedure('public.nexid_validate_resource_permission_scope_v1()'),
        to_regprocedure('public.nexid_validate_membership_permission_scope_v1()'),
        to_regprocedure('public.nexid_validate_supplier_qa_plan_dual_control_v1()'),
        to_regprocedure('public.nexid_actor_has_enterprise_capability_v1(uuid,uuid,text,text)'),
        to_regprocedure('public.nexid_packaging_lab_permission_denied_v2(uuid,uuid,text)'),
        to_regprocedure('public.nexid_packaging_lab_actor_authorized_v1(uuid,uuid,uuid,text)'),
        to_regprocedure('public.nexid_packaging_lab_override_authorized_v1(uuid,uuid,uuid)'),
        to_regprocedure('public.nexid_transition_tag_lifecycle_v1(jsonb)'),
        to_regprocedure('public.nexid_import_tag_manifest_v2_core_0081(jsonb)'),
        to_regprocedure('public.nexid_create_supplier_order_v2(jsonb)'),
        to_regprocedure('public.nexid_activate_supplier_tags_v2(jsonb)'),
        to_regprocedure('public.nexid_submit_supplier_production_qa_plan_v1(jsonb)'),
        to_regprocedure('public.nexid_decide_supplier_production_qa_plan_v1(jsonb)'),
        to_regprocedure('public.nexid_create_supplier_production_qa_session_v1(jsonb)'),
        to_regprocedure('public.nexid_commit_supplier_production_qa_v1(jsonb)'),
        to_regprocedure('public.nexid_supplier_production_activation_receipt_v2(uuid)')
        ,to_regprocedure('public.nexid_supplier_sun_production_activation_receipt_v2(uuid)')
        ,to_regprocedure('public.nexid_supplier_keyless_production_activation_receipt_v1(uuid)')
        ,to_regprocedure('public.nexid_commit_supplier_carrier_qa_v1(jsonb)')
      )
        AND routine.prosecdef
    )
    OR NOT COALESCE((
      SELECT routine.prosecdef
        AND routine.proowner = core_routine.proowner
        AND routine.proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
      FROM pg_proc routine
      JOIN pg_proc core_routine
        ON core_routine.oid = to_regprocedure('public.nexid_import_tag_manifest_v2_core_0081(jsonb)')
      WHERE routine.oid = to_regprocedure('public.nexid_import_tag_manifest_v2(jsonb)')
    ), false)
    OR NOT COALESCE((
      SELECT wrapper_routine.prosecdef
        AND base_routine.prosecdef
        AND NOT historical_routine.prosecdef
        AND wrapper_routine.proowner = base_routine.proowner
        AND wrapper_routine.proowner = historical_routine.proowner
        AND wrapper_routine.proconfig = ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
        AND base_routine.proconfig = ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
        AND historical_routine.proconfig = ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
      FROM pg_catalog.pg_proc wrapper_routine
      JOIN pg_catalog.pg_proc base_routine
        ON base_routine.oid = to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)')
      JOIN pg_catalog.pg_proc historical_routine
        ON historical_routine.oid = to_regprocedure('public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)')
      WHERE wrapper_routine.oid = to_regprocedure('public.nexid_persist_sun_scan_v1(jsonb)')
    ), false)
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc core_routine
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(core_routine.proacl, pg_catalog.acldefault('f', core_routine.proowner))
      ) acl
      WHERE core_routine.oid = to_regprocedure('public.nexid_import_tag_manifest_v2_core_0081(jsonb)')
        AND acl.privilege_type = 'EXECUTE'
        AND acl.grantee <> core_routine.proowner
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc internal_routine
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(internal_routine.proacl, pg_catalog.acldefault('f', internal_routine.proowner))
      ) acl
      WHERE internal_routine.oid IN (
        to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)'),
        to_regprocedure('public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)')
      )
        AND acl.privilege_type = 'EXECUTE'
        AND acl.grantee <> internal_routine.proowner
    )
  THEN
    RAISE EXCEPTION 'enterprise_rbac_risk_truth_postcondition_failed' USING ERRCODE = '55000';
  END IF;

  FOR v_expected IN
    SELECT value
    FROM jsonb_array_elements('[
      {"code":"tenant_owner","display_name":"Tenant owner","tenant_bound":true,"human_session_allowed":true,"permissions":["users:manage","supplier_order.create","batch.keys.generate","supplier_pack.export","manifest.import","packaging_lab.manage","qa.approve","qa.plan.approve","batch.activate","batch.lifecycle","batch.revoke","batch.tamper.configure","tag.tamper.override","batch.product.configure","ownership.claim_policy.manage","risk_rules.write","alerts.ack","webhooks.manage","api_keys.read","api_keys.manage","proofs.read","proofs.anchor","audit.read","events.read_sensitive","consumer_experiences.read_pii","consumer_experiences.moderate","consumers.read_pii","leads.manage","reports.export"]},
      {"code":"tenant_admin","display_name":"Tenant admin","tenant_bound":true,"human_session_allowed":true,"permissions":["users:manage","supplier_order.create","manifest.import","packaging_lab.manage","qa.approve","qa.plan.approve","batch.activate","batch.lifecycle","batch.revoke","batch.tamper.configure","tag.tamper.override","batch.product.configure","ownership.claim_policy.manage","alerts.ack","webhooks.manage","api_keys.read","api_keys.manage","proofs.read","audit.read","events.read_sensitive","consumer_experiences.read_pii","consumer_experiences.moderate","consumers.read_pii","leads.manage","reports.export"]},
      {"code":"security_analyst","display_name":"Security analyst","tenant_bound":true,"human_session_allowed":true,"permissions":["proofs.read","audit.read","events.read_sensitive","reports.export"]},
      {"code":"operations_manager","display_name":"Operations manager","tenant_bound":true,"human_session_allowed":true,"permissions":["supplier_order.create","manifest.import","packaging_lab.manage","qa.approve","batch.activate","batch.lifecycle","alerts.ack","events.read_sensitive","reports.export"]},
      {"code":"packaging_operator","display_name":"Packaging operator","tenant_bound":true,"human_session_allowed":true,"permissions":["packaging_lab.manage","manifest.import","reports.export"]},
      {"code":"marketing_manager","display_name":"Marketing manager","tenant_bound":true,"human_session_allowed":true,"permissions":["batch.product.configure","consumer_experiences.read_pii","consumer_experiences.moderate","consumers.read_pii","leads.manage","reports.export"]},
      {"code":"viewer","display_name":"Viewer","tenant_bound":true,"human_session_allowed":true,"permissions":[]},
      {"code":"reseller_admin","display_name":"Reseller admin","tenant_bound":true,"human_session_allowed":true,"permissions":["supplier_order.create","manifest.import","leads.manage","reports.export"]},
      {"code":"api_integration","display_name":"API integration service account","tenant_bound":true,"human_session_allowed":false,"permissions":[]},
      {"code":"super_admin","display_name":"Super admin","tenant_bound":false,"human_session_allowed":true,"permissions":["users:manage","supplier_order.create","batch.keys.generate","supplier_pack.export","manifest.import","packaging_lab.manage","qa.approve","batch.activate","batch.lifecycle","batch.revoke","batch.tamper.configure","tag.tamper.override","batch.product.configure","ownership.claim_policy.manage","risk_rules.write","alerts.ack","webhooks.manage","api_keys.read","api_keys.manage","proofs.read","proofs.anchor","audit.read","events.read_sensitive","consumer_experiences.read_pii","consumer_experiences.moderate","consumers.read_pii","leads.manage","reports.export"]},
      {"code":"security_operator","display_name":"Security operator","tenant_bound":true,"human_session_allowed":true,"permissions":["risk_rules.write","batch.tamper.configure","tag.tamper.override","alerts.ack","webhooks.manage","proofs.read","proofs.anchor","audit.read","events.read_sensitive","reports.export"]},
      {"code":"reseller","display_name":"Legacy reseller compatibility","tenant_bound":true,"human_session_allowed":true,"permissions":[]}
    ]'::jsonb)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.enterprise_role_profiles profile
      WHERE profile.code = v_expected->>'code'
        AND profile.display_name = v_expected->>'display_name'
        AND profile.active IS TRUE
        AND profile.human_session_allowed = (v_expected->>'human_session_allowed')::boolean
        AND profile.tenant_bound = (v_expected->>'tenant_bound')::boolean
        AND profile.default_permissions = v_expected->'permissions'
    ) THEN
      RAISE EXCEPTION 'enterprise_role_profile_truth_postcondition_failed' USING ERRCODE = '55000';
    END IF;
  END LOOP;
END
$enterprise_rbac_risk_truth_postcheck$;

COMMENT ON COLUMN public.events.risk_profile_version IS
  'Nullable write-time software risk projection version. NULL means legacy or awaiting derived projection; this is not NFC cryptographic, KMS or HSM evidence.';
COMMENT ON TABLE public.event_risk_projections IS
  'Derived versioned risk for historical canonical events. It never replaces or mutates NFC evidence.';
COMMENT ON FUNCTION public.nexid_backfill_event_risk_v1(integer) IS
  'Private bounded SKIP LOCKED projector into event_risk_projections; canonical events remain untouched.';
COMMENT ON FUNCTION public.nexid_enterprise_rbac_risk_truth_v1_capability() IS
  'Private non-secret capability marker for enterprise RBAC defaults and deterministic explainable-risk v1.';
