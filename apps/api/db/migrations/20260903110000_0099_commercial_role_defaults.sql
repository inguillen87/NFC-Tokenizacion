-- 20260903110000_0099_commercial_role_defaults.sql
-- Reconcile the server-owned commercial role defaults without materializing
-- them as per-user grants. Explicit tenant-scoped allow/deny rows remain
-- untouched and live sessions pick up these defaults on their next request.

DO $commercial_role_defaults_preflight$
DECLARE
  v_missing_codes text;
BEGIN
  IF to_regclass('public.enterprise_role_profiles') IS NULL THEN
    RAISE EXCEPTION 'commercial_role_defaults_requires_0096'
      USING ERRCODE = '55000';
  END IF;

  SELECT string_agg(expected.code, ',' ORDER BY expected.code)
  INTO v_missing_codes
  FROM (VALUES
    ('tenant_owner'), ('tenant_admin'), ('security_analyst'),
    ('operations_manager'), ('packaging_operator'), ('marketing_manager'),
    ('viewer'), ('reseller_admin'), ('api_integration'), ('super_admin'),
    ('security_operator'), ('reseller')
  ) AS expected(code)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.enterprise_role_profiles profile
    WHERE profile.code = expected.code
      AND jsonb_typeof(profile.default_permissions) = 'array'
  );

  IF v_missing_codes IS NOT NULL THEN
    RAISE EXCEPTION 'commercial_role_defaults_profiles_invalid'
      USING ERRCODE = '55000', DETAIL = 'codes=' || v_missing_codes;
  END IF;
END
$commercial_role_defaults_preflight$;

WITH role_commercial_defaults(code, permissions) AS (
  VALUES
    (
      'tenant_owner',
      '["crm:read","campaigns:read","campaigns:write","rewards:read","rewards:write","rewards:validate","marketplace:read","marketplace:write"]'::jsonb
    ),
    (
      'tenant_admin',
      '["crm:read","campaigns:read","campaigns:write","rewards:read","rewards:write","rewards:validate","marketplace:read","marketplace:write"]'::jsonb
    ),
    ('security_analyst', '[]'::jsonb),
    ('operations_manager', '["rewards:validate"]'::jsonb),
    ('packaging_operator', '[]'::jsonb),
    (
      'marketing_manager',
      '["crm:read","campaigns:read","campaigns:write","rewards:read","marketplace:read"]'::jsonb
    ),
    ('viewer', '[]'::jsonb),
    ('reseller_admin', '[]'::jsonb),
    ('api_integration', '[]'::jsonb),
    ('super_admin', '[]'::jsonb),
    ('security_operator', '[]'::jsonb),
    ('reseller', '[]'::jsonb)
),
reconciled AS (
  SELECT
    profile.code,
    COALESCE((
      SELECT jsonb_agg(permission_row.permission ORDER BY permission_row.bucket, permission_row.ordinality)
      FROM (
        SELECT existing_permission.permission, 0 AS bucket, existing_permission.ordinality
        FROM jsonb_array_elements_text(profile.default_permissions)
          WITH ORDINALITY AS existing_permission(permission, ordinality)
        WHERE split_part(lower(regexp_replace(
          existing_permission.permission,
          '^[[:space:]]+|[[:space:]]+$', '', 'g'
        )), ':', 1) NOT IN (
          'crm', 'campaigns', 'rewards', 'marketplace'
        )
        UNION ALL
        SELECT desired_permission.permission, 1 AS bucket, desired_permission.ordinality
        FROM jsonb_array_elements_text(role_default.permissions)
          WITH ORDINALITY AS desired_permission(permission, ordinality)
      ) AS permission_row
    ), '[]'::jsonb) AS default_permissions
  FROM public.enterprise_role_profiles profile
  JOIN role_commercial_defaults role_default ON role_default.code = profile.code
)
UPDATE public.enterprise_role_profiles profile
SET default_permissions = reconciled.default_permissions,
  updated_at = now()
FROM reconciled
WHERE profile.code = reconciled.code
  AND profile.default_permissions IS DISTINCT FROM reconciled.default_permissions;

DO $commercial_role_defaults_postcondition$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.enterprise_role_profiles profile
    CROSS JOIN (VALUES
      ('crm:read'), ('campaigns:read'), ('campaigns:write'),
      ('campaigns:test_whatsapp'), ('rewards:read'), ('rewards:write'),
      ('rewards:validate'), ('marketplace:read'), ('marketplace:write')
    ) AS commercial(permission)
    WHERE (profile.default_permissions ? commercial.permission) IS DISTINCT FROM CASE
      WHEN profile.code IN ('tenant_owner', 'tenant_admin')
        THEN commercial.permission <> 'campaigns:test_whatsapp'
      WHEN profile.code = 'marketing_manager'
        THEN commercial.permission IN (
          'crm:read', 'campaigns:read', 'campaigns:write',
          'rewards:read', 'marketplace:read'
        )
      WHEN profile.code = 'operations_manager'
        THEN commercial.permission = 'rewards:validate'
      ELSE false
    END
  ) OR EXISTS (
    SELECT 1
    FROM public.enterprise_role_profiles profile
    CROSS JOIN LATERAL jsonb_array_elements_text(profile.default_permissions) commercial(permission)
    WHERE split_part(lower(regexp_replace(
      commercial.permission,
      '^[[:space:]]+|[[:space:]]+$', '', 'g'
    )), ':', 1) IN (
      'crm', 'campaigns', 'rewards', 'marketplace'
    )
      AND commercial.permission NOT IN (
        'crm:read', 'campaigns:read', 'campaigns:write',
        'campaigns:test_whatsapp', 'rewards:read', 'rewards:write',
        'rewards:validate', 'marketplace:read', 'marketplace:write'
      )
  ) THEN
    RAISE EXCEPTION 'commercial_role_defaults_postcondition_failed'
      USING ERRCODE = '55000';
  END IF;
END
$commercial_role_defaults_postcondition$;
