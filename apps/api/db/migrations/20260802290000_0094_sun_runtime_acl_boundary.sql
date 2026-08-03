-- SUN runtime ACL boundary v1.
--
-- The public SUN persistence wrapper is the only grantable database entry
-- point. Its mutable base remains private. The wrapper executes with its
-- migration-owner privileges so a least-privilege application role does not
-- need direct access to tags, events, replay state or the internal base.
-- This changes no SUN/SDM/CMAC/TTStatus semantics and makes no KMS/HSM claim.

DO $sun_runtime_acl_preflight$
BEGIN
  IF to_regprocedure('public.nexid_persist_sun_scan_v1(jsonb)') IS NULL
    OR to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)') IS NULL
  THEN
    RAISE EXCEPTION 'sun_runtime_acl_requires_0093' USING ERRCODE = '42883';
  END IF;
END
$sun_runtime_acl_preflight$;

-- A SECURITY DEFINER entry point must never resolve attacker-created objects
-- from the shared schema. Migration owners retain CREATE; runtime roles do not.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

ALTER FUNCTION public.nexid_persist_sun_scan_v1(jsonb) SECURITY DEFINER;
ALTER FUNCTION public.nexid_persist_sun_scan_v1(jsonb)
  SET search_path TO pg_catalog, public, pg_temp;

ALTER FUNCTION public.nexid_persist_sun_scan_v1_base_0062(jsonb) SECURITY DEFINER;
ALTER FUNCTION public.nexid_persist_sun_scan_v1_base_0062(jsonb)
  SET search_path TO pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.nexid_persist_sun_scan_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_persist_sun_scan_v1_base_0062(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.nexid_sun_runtime_acl_v1_capability()
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path TO pg_catalog, public, pg_temp
AS $$
  SELECT 'sun-runtime-acl-boundary/v1'::text
$$;

REVOKE ALL ON FUNCTION public.nexid_sun_runtime_acl_v1_capability() FROM PUBLIC;

COMMENT ON FUNCTION public.nexid_persist_sun_scan_v1(jsonb) IS
  'Grantable SUN persistence entry point with migration-owner execution and hardened search_path. Physical CMAC/SDM/TT verification remains unchanged; not KMS or HSM custody.';

COMMENT ON FUNCTION public.nexid_persist_sun_scan_v1_base_0062(jsonb) IS
  'Private atomic SUN persistence base. Never grant directly to an application runtime role.';
