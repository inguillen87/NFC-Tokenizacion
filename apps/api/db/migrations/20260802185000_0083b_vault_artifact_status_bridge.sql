-- Reconcile historical Tenant Vault tables with the canonical artifact
-- lifecycle before audited downloads create their active-artifact index.
-- Early production environments materialized vault_artifacts before the
-- lifecycle status column existed. Existing rows were implicitly active.

DO $vault_artifact_status_bridge_preflight$
BEGIN
  IF to_regclass('public.vault_artifacts') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42P01',
      MESSAGE = 'vault_artifacts_required_before_status_bridge';
  END IF;
END
$vault_artifact_status_bridge_preflight$;

ALTER TABLE public.vault_artifacts
  ADD COLUMN IF NOT EXISTS status text;

UPDATE public.vault_artifacts
SET status = 'active'
WHERE status IS NULL;

DO $vault_artifact_status_values$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.vault_artifacts
    WHERE status NOT IN ('active', 'archived')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'vault_artifact_status_reconciliation_required';
  END IF;
END
$vault_artifact_status_values$;

ALTER TABLE public.vault_artifacts
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.vault_artifacts
  DROP CONSTRAINT IF EXISTS vault_artifacts_status_check;
ALTER TABLE public.vault_artifacts
  ADD CONSTRAINT vault_artifacts_status_check
  CHECK (status IN ('active', 'archived')) NOT VALID;
ALTER TABLE public.vault_artifacts
  VALIDATE CONSTRAINT vault_artifacts_status_check;
