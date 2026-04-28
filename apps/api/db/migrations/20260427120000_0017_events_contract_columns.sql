-- 0017_events_contract_columns
-- Purpose: move events contract column evolution from runtime ALTER TABLE to versioned migration.

ALTER TABLE events ADD COLUMN IF NOT EXISTS read_counter integer;
ALTER TABLE events ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS meta jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS tenant_slug text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS tag_id text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS bid text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS verdict text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS risk_level text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS picc_data_hash text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cmac_hash text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS raw_url_hash text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS ip_hash text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS geo_precision text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS product_name text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS ip text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS geo_city text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS geo_country text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS device_label text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS raw_query jsonb;
