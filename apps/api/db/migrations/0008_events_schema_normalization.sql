DO $$ BEGIN
  CREATE TYPE scan_source AS ENUM ('real', 'demo', 'imported');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE events ADD COLUMN IF NOT EXISTS read_counter integer;
ALTER TABLE events ADD COLUMN IF NOT EXISTS geo_city text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS geo_country text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS geo_lat double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS geo_lng double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS device_label text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS source scan_source NOT NULL DEFAULT 'real';
ALTER TABLE events ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS raw_query jsonb;

UPDATE events SET read_counter = COALESCE(read_counter, sdm_read_ctr) WHERE read_counter IS NULL;
UPDATE events SET country_code = COALESCE(country_code, geo_country) WHERE country_code IS NULL;
UPDATE events SET city = COALESCE(city, geo_city) WHERE city IS NULL;
UPDATE events SET lat = COALESCE(lat, geo_lat) WHERE lat IS NULL;
UPDATE events SET lng = COALESCE(lng, geo_lng) WHERE lng IS NULL;

CREATE INDEX IF NOT EXISTS idx_events_batch_uid_ctr ON events(batch_id, uid_hex, sdm_read_ctr);
CREATE INDEX IF NOT EXISTS idx_events_source_created ON events(source, created_at DESC);
