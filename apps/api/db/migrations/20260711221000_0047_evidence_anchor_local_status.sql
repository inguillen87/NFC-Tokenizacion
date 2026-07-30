DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evidence_anchor_status') THEN
    ALTER TYPE evidence_anchor_status ADD VALUE IF NOT EXISTS 'local';
  END IF;
END $$;
