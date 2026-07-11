DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'evidence_anchors'
      AND column_name = 'event_hashes'
  ) THEN
    ALTER TABLE evidence_anchors
      ALTER COLUMN event_hashes DROP NOT NULL;
  END IF;
END $$;
