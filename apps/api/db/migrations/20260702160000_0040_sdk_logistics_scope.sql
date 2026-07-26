-- tenant_api_keys was historically materialized by the application runtime and
-- is only made canonical by migration 0060. On a clean migration-only database
-- it does not exist yet, so this historical compatibility change must be a
-- no-op; 0060 creates the table with sdk:logistics already in the default.
ALTER TABLE IF EXISTS tenant_api_keys
  ALTER COLUMN scopes SET DEFAULT '["sdk:verify","sdk:claim","sdk:products","sdk:events","sdk:pos","sdk:logistics"]'::jsonb;
