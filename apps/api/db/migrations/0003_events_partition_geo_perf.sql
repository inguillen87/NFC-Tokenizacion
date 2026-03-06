-- Geo enrichment columns for real-time map + perf indexes.
ALTER TABLE events ADD COLUMN IF NOT EXISTS geo_city text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS geo_country text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS geo_lat double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS geo_lng double precision;

CREATE INDEX IF NOT EXISTS idx_tags_scan_count ON tags(scan_count DESC);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_geo_lat_lng ON events(geo_lat, geo_lng) WHERE geo_lat IS NOT NULL AND geo_lng IS NOT NULL;

-- Partition events by month to keep analytics/SUN queries fast as volume grows.
DO $$
DECLARE
  partitioned boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM pg_partitioned_table pt
    JOIN pg_class c ON c.oid = pt.partrelid
    WHERE c.relname = 'events'
  ) INTO partitioned;

  IF NOT partitioned THEN
    ALTER TABLE events RENAME TO events_legacy;

    CREATE TABLE events (
      id bigserial,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      uid_hex text,
      sdm_read_ctr integer,
      cmac_ok boolean,
      allowlisted boolean,
      tag_status tag_status,
      result text NOT NULL,
      reason text,
      ip inet,
      user_agent text,
      geo_city text,
      geo_country text,
      geo_lat double precision,
      geo_lng double precision,
      raw_query jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (id, created_at)
    ) PARTITION BY RANGE (created_at);

    CREATE TABLE events_default PARTITION OF events DEFAULT;

    INSERT INTO events (
      id, tenant_id, batch_id, uid_hex, sdm_read_ctr, cmac_ok, allowlisted, tag_status,
      result, reason, ip, user_agent, geo_city, geo_country, geo_lat, geo_lng, raw_query, created_at
    )
    SELECT
      id, tenant_id, batch_id, uid_hex, sdm_read_ctr, cmac_ok, allowlisted, tag_status,
      result, reason, ip, user_agent, geo_city, geo_country, geo_lat, geo_lng, raw_query, created_at
    FROM events_legacy;

    PERFORM setval('events_id_seq', COALESCE((SELECT MAX(id) FROM events), 1));

    DROP TABLE events_legacy;

    CREATE INDEX IF NOT EXISTS idx_events_batch_created ON events(batch_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_events_geo_lat_lng ON events(geo_lat, geo_lng) WHERE geo_lat IS NOT NULL AND geo_lng IS NOT NULL;
  END IF;
END $$;
