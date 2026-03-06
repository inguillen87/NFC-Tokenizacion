CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  CREATE TYPE tag_status AS ENUM ('inactive', 'active', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE batch_status AS ENUM ('active', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  root_key_ct text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS batches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bid text NOT NULL UNIQUE,
  status batch_status NOT NULL DEFAULT 'active',
  meta_key_ct text NOT NULL,
  file_key_ct text NOT NULL,
  sdm_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  uid_hex text NOT NULL,
  status tag_status NOT NULL DEFAULT 'inactive',
  last_seen_ctr integer,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  scan_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(batch_id, uid_hex)
);

CREATE TABLE IF NOT EXISTS events (
  id bigserial PRIMARY KEY,
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
  raw_query jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tags_batch_uid ON tags(batch_id, uid_hex);
CREATE INDEX IF NOT EXISTS idx_events_batch_created ON events(batch_id, created_at DESC);
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  locale text NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(locale, slug)
);

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  locale text NOT NULL DEFAULT 'es-AR',
  contact text NOT NULL,
  company text,
  country text,
  vertical text,
  tag_type text,
  volume integer,
  source text NOT NULL DEFAULT 'assistant',
  status text NOT NULL DEFAULT 'new',
  notes text,
  assigned_to text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  locale text NOT NULL DEFAULT 'es-AR',
  contact text NOT NULL,
  title text NOT NULL,
  detail text,
  status text NOT NULL DEFAULT 'open',
  assigned_to text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  locale text NOT NULL DEFAULT 'es-AR',
  contact text NOT NULL,
  company text,
  tag_type text,
  volume integer,
  notes text,
  status text NOT NULL DEFAULT 'new',
  assigned_to text,
  created_at timestamptz NOT NULL DEFAULT now()
);
