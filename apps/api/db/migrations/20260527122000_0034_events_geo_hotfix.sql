-- Production hotfix: some deployed databases have events geo city/country
-- but missed the latitude/longitude normalization columns used by analytics.
ALTER TABLE events ADD COLUMN IF NOT EXISTS geo_lat double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS geo_lng double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS lng double precision;

UPDATE events SET lat = geo_lat WHERE lat IS NULL AND geo_lat IS NOT NULL;
UPDATE events SET lng = geo_lng WHERE lng IS NULL AND geo_lng IS NOT NULL;
UPDATE events SET geo_lat = lat WHERE geo_lat IS NULL AND lat IS NOT NULL;
UPDATE events SET geo_lng = lng WHERE geo_lng IS NULL AND lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_geo_lat_lng ON events(geo_lat, geo_lng) WHERE geo_lat IS NOT NULL AND geo_lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_lat_lng ON events(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
