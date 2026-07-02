ALTER TABLE tenant_api_keys
  ALTER COLUMN scopes SET DEFAULT '["sdk:verify","sdk:claim","sdk:products","sdk:events","sdk:pos","sdk:logistics"]'::jsonb;
