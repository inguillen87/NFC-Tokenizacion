ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS resource_type text;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS resource_id text;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS event_hashes_json jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'evidence_anchors'
      AND column_name = 'event_hashes'
  ) THEN
    EXECUTE $sql$
      UPDATE evidence_anchors
      SET event_hashes_json = to_jsonb(event_hashes)
      WHERE event_hashes_json = '[]'::jsonb
        AND event_hashes IS NOT NULL
    $sql$;
  END IF;
END $$;
