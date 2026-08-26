-- Reconcile the historical Tenant Vault table with the canonical supplier
-- artifact contract consumed by 0070+ and the keyless activation in 0091.
-- Legacy columns are preserved as nullable compatibility fields; canonical
-- fields are backfilled only when their legacy value is unambiguous.

ALTER TABLE public.vault_artifacts
  ADD COLUMN IF NOT EXISTS supplier_sub_batch_id uuid,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS storage_ref text,
  ADD COLUMN IF NOT EXISTS metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $vault_artifact_legacy_aliases$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vault_artifacts'
      AND column_name = 'sub_batch_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.vault_artifacts
      WHERE supplier_sub_batch_id IS NOT NULL
        AND sub_batch_id IS NOT NULL
        AND supplier_sub_batch_id IS DISTINCT FROM sub_batch_id
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'vault_artifact_sub_batch_identity_conflict';
    END IF;
    UPDATE public.vault_artifacts
    SET supplier_sub_batch_id = sub_batch_id
    WHERE supplier_sub_batch_id IS NULL
      AND sub_batch_id IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vault_artifacts'
      AND column_name = 'sha256'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.vault_artifacts
      WHERE content_hash IS NOT NULL
        AND sha256 IS NOT NULL
        AND lower(regexp_replace(content_hash, '^sha256:', '', 'i'))
          IS DISTINCT FROM lower(regexp_replace(sha256, '^sha256:', '', 'i'))
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'vault_artifact_content_hash_conflict';
    END IF;
    UPDATE public.vault_artifacts
    SET content_hash = CASE
      WHEN sha256 ~* '^sha256:[0-9a-f]{64}$' THEN lower(sha256)
      WHEN sha256 ~* '^[0-9a-f]{64}$' THEN 'sha256:' || lower(sha256)
      ELSE NULL
    END
    WHERE content_hash IS NULL
      AND sha256 IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vault_artifacts'
      AND column_name = 'storage_path'
  ) THEN
    UPDATE public.vault_artifacts
    SET storage_ref = storage_path
    WHERE storage_ref IS NULL
      AND storage_path IS NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.vault_artifacts WHERE content_hash IS NULL) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'vault_artifact_content_hash_unrecoverable';
  END IF;
END;
$vault_artifact_legacy_aliases$;

DO $vault_artifact_type_bridge$
DECLARE
  v_artifact_type text;
BEGIN
  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_artifact_type
  FROM pg_attribute attribute
  WHERE attribute.attrelid = 'public.vault_artifacts'::regclass
    AND attribute.attname = 'artifact_type'
    AND NOT attribute.attisdropped;

  IF v_artifact_type <> 'text' THEN
    ALTER TABLE public.vault_artifacts
      ALTER COLUMN artifact_type TYPE text USING artifact_type::text;
  END IF;
END;
$vault_artifact_type_bridge$;

DO $vault_artifact_canonical_invariants$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.vault_artifacts
    WHERE content_hash !~ '^sha256:[0-9a-f]{64}$'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'vault_artifact_content_hash_noncanonical';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.vault_artifacts
    WHERE artifact_type = 'supplier_manifest_template_csv'
      AND supplier_sub_batch_id IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'vault_artifact_sub_batch_scope_reconciliation_required';
  END IF;
END;
$vault_artifact_canonical_invariants$;

DO $vault_artifact_legacy_nullable$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vault_artifacts'
      AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE public.vault_artifacts ALTER COLUMN storage_path DROP NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vault_artifacts'
      AND column_name = 'sha256'
  ) THEN
    ALTER TABLE public.vault_artifacts ALTER COLUMN sha256 DROP NOT NULL;
  END IF;
END;
$vault_artifact_legacy_nullable$;

ALTER TABLE public.vault_artifacts
  ALTER COLUMN content_hash SET NOT NULL,
  ALTER COLUMN metadata_json SET DEFAULT '{}'::jsonb,
  ALTER COLUMN metadata_json SET NOT NULL;

DO $vault_artifact_supplier_sub_batch_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.vault_artifacts'::regclass
      AND conname = 'vault_artifacts_supplier_sub_batch_id_fkey'
  ) THEN
    ALTER TABLE public.vault_artifacts
      ADD CONSTRAINT vault_artifacts_supplier_sub_batch_id_fkey
      FOREIGN KEY (supplier_sub_batch_id)
      REFERENCES public.supplier_sub_batches(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END;
$vault_artifact_supplier_sub_batch_fk$;

ALTER TABLE public.vault_artifacts
  VALIDATE CONSTRAINT vault_artifacts_supplier_sub_batch_id_fkey;

CREATE INDEX IF NOT EXISTS idx_vault_artifacts_supplier_sub_batch
  ON public.vault_artifacts (supplier_sub_batch_id, artifact_type, created_at DESC);
