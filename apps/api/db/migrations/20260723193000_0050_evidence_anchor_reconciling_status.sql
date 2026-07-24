-- PostgreSQL enum values must be committed before they can be referenced by
-- index predicates or DML. Keep this migration intentionally separate from
-- the IOTA V2 schema expansion in 0051. Older migration-only databases use a
-- text status column and therefore do not have this bootstrap enum.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evidence_anchor_status') THEN
    ALTER TYPE evidence_anchor_status ADD VALUE IF NOT EXISTS 'reconciling';
  END IF;
END $$;
