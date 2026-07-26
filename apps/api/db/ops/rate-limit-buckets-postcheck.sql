-- Read-only evidence query for 0057. Run after applying the exact migration
-- on rehearsal/staging and retain the output with the deployment evidence.
BEGIN TRANSACTION READ ONLY;

SELECT
  current_database() AS database,
  current_user AS database_role,
  current_setting('neon.endpoint_id', true) AS neon_endpoint_id;

SELECT id, applied_at
FROM schema_migrations
WHERE id = '20260725230000_0057_sun_rate_limit_atomic_buckets.sql';

SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sun_rate_limit_buckets'
ORDER BY ordinal_position;

SELECT
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'sun_rate_limit_buckets'
ORDER BY constraint_name;

SELECT
  indexrelid::regclass::text AS index_name,
  indisunique,
  indisvalid,
  indisready
FROM pg_index
WHERE indrelid = 'public.sun_rate_limit_buckets'::regclass
ORDER BY index_name;

SELECT count(*)::bigint AS current_bucket_rows
FROM sun_rate_limit_buckets;

ROLLBACK;
