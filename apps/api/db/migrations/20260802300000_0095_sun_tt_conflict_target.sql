-- Deterministic SUN TT receipt conflict target v1.
--
-- PostgreSQL resolves unqualified names inside a PL/pgSQL conflict column list
-- against both table columns and output variables. The 0093 base function has
-- an output variable named event_id, so its two-column conflict target is
-- ambiguous at runtime. Bind deduplication to the receipt table's named primary
-- key without replacing the physical verification path. This changes no CMAC,
-- SDM, TTStatus, replay, or counter semantics and is not KMS or HSM custody.

DO $sun_tt_conflict_target_patch$
DECLARE
  v_function_oid oid := to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)');
  v_function_definition text;
  v_old_conflict_target constant text := 'ON CONFLICT (event_id, event_created_at) DO NOTHING';
  v_new_conflict_target constant text := 'ON CONFLICT ON CONSTRAINT sun_tt_truth_receipts_pkey DO NOTHING';
  v_old_target_count integer;
  v_new_target_count integer;
  v_primary_key_columns text[];
BEGIN
  IF v_function_oid IS NULL
    OR to_regprocedure('public.nexid_persist_sun_scan_v1(jsonb)') IS NULL
    OR to_regprocedure('public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)') IS NULL
    OR to_regprocedure('public.nexid_sun_runtime_acl_v1_capability()') IS NULL
  THEN
    RAISE EXCEPTION 'sun_tt_conflict_target_requires_0094' USING ERRCODE = '42883';
  END IF;

  SELECT array_agg(attribute_row.attname::text ORDER BY key_column.ordinality)
    INTO v_primary_key_columns
  FROM pg_constraint constraint_row
  CROSS JOIN LATERAL unnest(constraint_row.conkey)
    WITH ORDINALITY AS key_column(attnum, ordinality)
  JOIN pg_attribute attribute_row
    ON attribute_row.attrelid = constraint_row.conrelid
   AND attribute_row.attnum = key_column.attnum
  WHERE constraint_row.conrelid = to_regclass('public.sun_tt_truth_receipts')
    AND constraint_row.conname = 'sun_tt_truth_receipts_pkey'
    AND constraint_row.contype = 'p';

  IF v_primary_key_columns IS DISTINCT FROM ARRAY['event_id', 'event_created_at']::text[] THEN
    RAISE EXCEPTION 'sun_tt_conflict_target_primary_key_mismatch' USING ERRCODE = '55000';
  END IF;

  SELECT pg_get_functiondef(to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)'))
    INTO v_function_definition;

  v_old_target_count :=
    (length(v_function_definition) - length(replace(v_function_definition, v_old_conflict_target, '')))
      / length(v_old_conflict_target);
  v_new_target_count :=
    (length(v_function_definition) - length(replace(v_function_definition, v_new_conflict_target, '')))
      / length(v_new_conflict_target);

  IF v_old_target_count IS DISTINCT FROM 1 OR v_new_target_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'sun_tt_conflict_target_source_occurrence_mismatch' USING ERRCODE = '55000';
  END IF;

  EXECUTE replace(v_function_definition, v_old_conflict_target, v_new_conflict_target);

  SELECT pg_get_functiondef(to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)'))
    INTO v_function_definition;

  v_old_target_count :=
    (length(v_function_definition) - length(replace(v_function_definition, v_old_conflict_target, '')))
      / length(v_old_conflict_target);
  v_new_target_count :=
    (length(v_function_definition) - length(replace(v_function_definition, v_new_conflict_target, '')))
      / length(v_new_conflict_target);

  IF v_old_target_count IS DISTINCT FROM 0 OR v_new_target_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'sun_tt_conflict_target_postcondition_failed' USING ERRCODE = '55000';
  END IF;
END
$sun_tt_conflict_target_patch$;

-- CREATE OR REPLACE retains these properties, but reassert them explicitly so
-- this migration remains the authoritative forward-only runtime boundary.
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
REVOKE ALL ON FUNCTION public.nexid_sun_runtime_acl_v1_capability() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.nexid_sun_tt_conflict_target_v1_capability()
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path TO pg_catalog, public, pg_temp
AS $$
  SELECT 'sun-tt-conflict-target/v1'::text
$$;

REVOKE ALL ON FUNCTION public.nexid_sun_tt_conflict_target_v1_capability() FROM PUBLIC;

DO $sun_tt_conflict_target_acl_postcheck$
BEGIN
  IF has_schema_privilege('public', 'public', 'CREATE')
    OR EXISTS (
      SELECT 1
      FROM pg_proc routine
      WHERE routine.oid IN (
        to_regprocedure('public.nexid_persist_sun_scan_v1(jsonb)'),
        to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)')
      )
        AND (
          NOT routine.prosecdef
          OR NOT EXISTS (
            SELECT 1
            FROM unnest(routine.proconfig) AS config(setting)
            WHERE regexp_replace(config.setting, '[[:space:]]+', '', 'g') =
              'search_path=pg_catalog,public,pg_temp'
          )
        )
    )
    OR EXISTS (
      SELECT 1
      FROM pg_proc routine
      CROSS JOIN LATERAL aclexplode(COALESCE(routine.proacl, acldefault('f', routine.proowner))) acl
      WHERE routine.oid IN (
        to_regprocedure('public.nexid_persist_sun_scan_v1(jsonb)'),
        to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)'),
        to_regprocedure('public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)'),
        to_regprocedure('public.nexid_sun_runtime_acl_v1_capability()'),
        to_regprocedure('public.nexid_sun_tt_conflict_target_v1_capability()')
      )
        AND acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'sun_tt_conflict_target_acl_postcondition_failed' USING ERRCODE = '55000';
  END IF;
END
$sun_tt_conflict_target_acl_postcheck$;

COMMENT ON FUNCTION public.nexid_persist_sun_scan_v1_base_0062(jsonb) IS
  'Atomic SUN persistence with deterministic TT receipt conflict binding. Physical CMAC/SDM/TT verification remains unchanged; not KMS or HSM custody.';

COMMENT ON FUNCTION public.nexid_sun_tt_conflict_target_v1_capability() IS
  'Private capability marker for the deterministic SUN TT receipt conflict target.';
