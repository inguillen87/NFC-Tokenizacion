-- These columns historically came from runtime compatibility DDL. The release
-- ledger now owns them so production requests can remain schema-read-only.
ALTER TABLE webhook_endpoints
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Webhook',
  ADD COLUMN IF NOT EXISTS signing_secret text;

ALTER TABLE webhook_endpoints
  ADD COLUMN IF NOT EXISTS signature_version text NOT NULL DEFAULT 'v1';

-- Rows that existed before this migration must remain on the legacy v1
-- envelope until an administrator explicitly upgrades the endpoint.
UPDATE webhook_endpoints
SET signature_version = 'v1'
WHERE signature_version IS NULL;

ALTER TABLE webhook_endpoints
  ALTER COLUMN signature_version SET DEFAULT 'v2';

ALTER TABLE webhook_endpoints
  ALTER COLUMN signature_version SET NOT NULL;

ALTER TABLE webhook_endpoints
  DROP CONSTRAINT IF EXISTS webhook_endpoints_signature_version_check;

ALTER TABLE webhook_endpoints
  ADD CONSTRAINT webhook_endpoints_signature_version_check
  CHECK (signature_version IN ('v1', 'v2'));
