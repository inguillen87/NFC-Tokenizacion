-- Rollback is a Neon snapshot/branch restore, never a destructive down
-- migration. Run this read-only SQL after restoring the pre-0050 checkpoint;
-- then run `npm run gate:migrations:rollback-verify` for the exact fingerprint.
BEGIN TRANSACTION READ ONLY;

SELECT
  current_database() AS database,
  current_setting('neon.endpoint_id', true) AS neon_endpoint_id,
  pg_is_in_recovery() AS in_recovery;

SELECT count(*)::int AS planned_migrations_still_recorded
FROM schema_migrations
WHERE id IN (
  '20260723193000_0050_evidence_anchor_reconciling_status.sql',
  '20260723193500_0051_iota_evidence_anchor_v2_writer.sql',
  '20260723194500_0052_webhook_delivery_outbox.sql',
  '20260723200500_0053_admin_login_abuse_guard.sql',
  '20260723213000_0054_iota_executor_publications.sql',
  '20260724213000_0055_iota_executor_durable_broadcast.sql',
  '20260725014500_0056_iota_evidence_constraints_validate.sql'
);

SELECT
  to_regclass('public.evidence_anchor_members') IS NOT NULL AS evidence_anchor_members_present,
  to_regclass('public.evidence_anchor_attempts') IS NOT NULL AS evidence_anchor_attempts_present,
  to_regclass('public.iota_executor_publications') IS NOT NULL AS iota_executor_publications_present,
  to_regclass('public.admin_login_attempt_buckets') IS NOT NULL AS admin_login_attempt_buckets_present,
  EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'evidence_anchor_status' AND e.enumlabel = 'reconciling'
  ) AS enum_reconciling_present;

ROLLBACK;
