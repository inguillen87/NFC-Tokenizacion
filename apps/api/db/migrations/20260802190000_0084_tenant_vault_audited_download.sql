-- Privileged, recoverable supplier-pack downloads from Tenant Vault.
-- The stored payload is already an encrypted supplier envelope. Passwords and
-- plaintext NFC keys are never stored in this history table.

CREATE OR REPLACE FUNCTION public.nexid_audit_freeform_is_safe_v1(p_value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $audit_freeform_policy$
DECLARE
  v_value text := trim(COALESCE(p_value, ''));
  v_match text[];
  v_token text;
  v_classes integer;
  v_distinct_characters integer;
BEGIN
  IF v_value = '' THEN
    RETURN true;
  END IF;
  IF v_value ~* '(^|[^A-Za-z0-9_])(PACK[_ -]?PASSWORD|K[_ -]?META([_ -]?BATCH)?|K[_ -]?FILE([_ -]?BATCH)?)([^A-Za-z0-9_]|$)'
    OR v_value ~* '(^|[^A-Za-z0-9_])(PASSWORD|PASSWD|SECRET|WEBHOOK[_ -]?SECRET|PRIVATE[_ -]?KEY|API[_ -]?KEY|TOKEN|BEARER[_ -]?TOKEN|SESSION[_ -]?TOKEN|AUTHORIZATION|COOKIE|DATABASE[_ -]?URL)[[:space:]]*[:=]'
    OR v_value ~ '[A-Za-z][A-Za-z0-9+.-]*://[^/@[:space:]:]+:[^/@[:space:]]+@'
    OR v_value ~* '-----BEGIN( [A-Z0-9]+)? PRIVATE KEY-----'
    OR v_value ~* '(^|[^0-9a-f])(0x)?[0-9a-f]{32,}([^0-9a-f]|$)' THEN
    RETURN false;
  END IF;

  FOR v_match IN
    SELECT match_row.value
    FROM regexp_matches(
      v_value,
      '(^|[^A-Za-z0-9+/=_-])([A-Za-z0-9+/_-]{32,}={0,2})([^A-Za-z0-9+/=_-]|$)',
      'g'
    ) AS match_row(value)
  LOOP
    v_token := regexp_replace(v_match[2], '=+$', '');
    v_classes :=
      CASE WHEN v_token ~ '[A-Z]' THEN 1 ELSE 0 END
      + CASE WHEN v_token ~ '[a-z]' THEN 1 ELSE 0 END
      + CASE WHEN v_token ~ '[0-9]' THEN 1 ELSE 0 END
      + CASE WHEN v_token ~ '[+/_-]' THEN 1 ELSE 0 END;
    SELECT count(DISTINCT token_character.value)::integer
      INTO v_distinct_characters
    FROM regexp_split_to_table(v_token, '') AS token_character(value);
    IF char_length(v_token) >= 32 AND v_classes >= 3 AND v_distinct_characters >= 16 THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$audit_freeform_policy$;

ALTER TABLE vault_artifacts
  ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0;
ALTER TABLE vault_artifacts
  ADD COLUMN IF NOT EXISTS last_downloaded_at timestamptz;

ALTER TABLE vault_artifacts
  DROP CONSTRAINT IF EXISTS vault_artifacts_download_count_check;
ALTER TABLE vault_artifacts
  ADD CONSTRAINT vault_artifacts_download_count_check
  CHECK (download_count >= 0);

CREATE TABLE IF NOT EXISTS vault_artifact_downloads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  artifact_id uuid NOT NULL REFERENCES vault_artifacts(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  auth_session_id uuid REFERENCES auth_sessions(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL,
  reason text NOT NULL,
  content_hash text NOT NULL,
  receipt_sha256 text NOT NULL,
  request_id text,
  downloaded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_artifact_downloads_idempotency_key_check
    CHECK (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'),
  CONSTRAINT vault_artifact_downloads_reason_check
    CHECK (
      char_length(reason) BETWEEN 12 AND 240
      AND public.nexid_audit_freeform_is_safe_v1(reason)
    ),
  CONSTRAINT vault_artifact_downloads_content_hash_check
    CHECK (content_hash ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT vault_artifact_downloads_receipt_hash_check
    CHECK (receipt_sha256 ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT vault_artifact_downloads_artifact_idempotency_unique
    UNIQUE (artifact_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_vault_artifact_downloads_tenant_time
  ON vault_artifact_downloads (tenant_id, downloaded_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_vault_artifact_downloads_artifact_time
  ON vault_artifact_downloads (artifact_id, downloaded_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.nexid_reject_vault_artifact_download_history_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'vault_artifact_download_history_is_immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_vault_artifact_downloads_immutable
  ON vault_artifact_downloads;
CREATE TRIGGER trg_vault_artifact_downloads_immutable
BEFORE UPDATE OR DELETE ON vault_artifact_downloads
FOR EACH ROW
EXECUTE FUNCTION public.nexid_reject_vault_artifact_download_history_mutation_v1();

CREATE INDEX IF NOT EXISTS idx_vault_artifacts_privileged_download
  ON vault_artifacts (tenant_id, artifact_type, delivery_status, created_at DESC)
  WHERE encrypted_payload_base64 IS NOT NULL AND status = 'active';
