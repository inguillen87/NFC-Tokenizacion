DO $$ BEGIN
  CREATE TYPE membership_role AS ENUM ('super_admin', 'tenant_admin', 'reseller', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM ('new', 'qualified', 'contacted', 'won', 'lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('open', 'pending', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_request_status AS ENUM ('new', 'quoting', 'confirmed', 'paid', 'shipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scan_source AS ENUM ('real', 'demo', 'imported');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL UNIQUE,
  full_name text,
  locale text NOT NULL DEFAULT 'es-AR',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_credentials (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  role membership_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id, role)
);

ALTER TABLE leads
  ALTER COLUMN status TYPE lead_status USING status::lead_status,
  ALTER COLUMN status SET DEFAULT 'new';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS transcript text;

ALTER TABLE tickets
  ALTER COLUMN status TYPE ticket_status USING status::ticket_status,
  ALTER COLUMN status SET DEFAULT 'open';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web_bot';

ALTER TABLE order_requests
  ALTER COLUMN status TYPE order_request_status USING status::order_request_status,
  ALTER COLUMN status SET DEFAULT 'new';
ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web_bot';

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret_ct text,
  enabled boolean NOT NULL DEFAULT false,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, url)
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id bigserial PRIMARY KEY,
  endpoint_id uuid NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  payload jsonb NOT NULL,
  status_code integer,
  ok boolean NOT NULL DEFAULT false,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);

CREATE TABLE IF NOT EXISTS tag_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag_id uuid NOT NULL UNIQUE REFERENCES tags(id) ON DELETE CASCADE,
  sku text,
  product_name text,
  vintage text,
  grape_varietal text,
  alcohol_pct numeric(4,2),
  barrel_months integer,
  harvest_year integer,
  vineyard_humidity numeric(5,2),
  soil_humidity numeric(5,2),
  region text,
  winery text,
  temperature_storage text,
  notes text,
  image_url text,
  locale_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS read_counter integer;
ALTER TABLE events ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS device_label text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS source scan_source NOT NULL DEFAULT 'real';
ALTER TABLE events ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE events SET read_counter = COALESCE(read_counter, sdm_read_ctr) WHERE read_counter IS NULL;
UPDATE events SET country_code = COALESCE(country_code, geo_country) WHERE country_code IS NULL;
UPDATE events SET city = COALESCE(city, geo_city) WHERE city IS NULL;
UPDATE events SET lat = COALESCE(lat, geo_lat) WHERE lat IS NULL;
UPDATE events SET lng = COALESCE(lng, geo_lng) WHERE lng IS NULL;

CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON webhook_deliveries(endpoint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tag_profiles_tag ON tag_profiles(tag_id);
