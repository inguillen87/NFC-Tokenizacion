-- Read-only evidence query for the 0050-0055 staging migration.
-- Enforcement (endpoint allowlist, exact ledger and fingerprint) lives in
-- scripts/staging-postgres-smoke.mjs. This SQL is suitable for Neon SQL Editor
-- or psql evidence capture and never mutates the database.
BEGIN TRANSACTION READ ONLY;

SELECT
  current_database() AS database,
  current_user AS database_role,
  current_setting('server_version_num') AS server_version_num,
  current_setting('neon.endpoint_id', true) AS neon_endpoint_id,
  pg_is_in_recovery() AS in_recovery;

SELECT id, applied_at
FROM schema_migrations
WHERE id IN (
  '20260723193000_0050_evidence_anchor_reconciling_status.sql',
  '20260723193500_0051_iota_evidence_anchor_v2_writer.sql',
  '20260723194500_0052_webhook_delivery_outbox.sql',
  '20260723200500_0053_admin_login_abuse_guard.sql',
  '20260723213000_0054_iota_executor_publications.sql',
  '20260724213000_0055_iota_executor_durable_broadcast.sql'
)
ORDER BY id;

SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'evidence_anchors',
    'evidence_anchor_members',
    'evidence_anchor_attempts',
    'iota_executor_publications',
    'admin_login_attempt_buckets'
  )
ORDER BY table_name, ordinal_position;

SELECT c.conrelid::regclass::text AS table_name, c.conname, c.convalidated,
       pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.connamespace = 'public'::regnamespace
  AND (
    c.conname LIKE 'evidence_anchors_iota_v2_%'
    OR c.conname LIKE 'iota_executor_publications_%'
  )
ORDER BY table_name, c.conname;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname LIKE '%iota%'
    OR indexname LIKE '%evidence_anchor%'
  )
ORDER BY tablename, indexname;

SELECT status, protocol_version, count(*)::bigint AS rows
FROM iota_executor_publications
GROUP BY status, protocol_version
ORDER BY status, protocol_version;

ROLLBACK;
