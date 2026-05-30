-- /sun receives only a public BID, so BID must resolve to exactly one batch row.
-- This guard intentionally fails if duplicates already exist; resolve those rows
-- explicitly before enforcing the unique index.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM batches
    GROUP BY bid
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate batch bid values exist. Resolve duplicates before applying batches_bid_unique_idx.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS batches_bid_unique_idx ON batches (bid);
