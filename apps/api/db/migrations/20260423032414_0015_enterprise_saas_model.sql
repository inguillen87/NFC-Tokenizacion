-- Phase 1 Domain Model Migrations
-- Adding fields to tenants
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS type text DEFAULT 'other',
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS plan text DEFAULT 'basic',
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS province text,
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS lat double precision,
ADD COLUMN IF NOT EXISTS lng double precision,
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Adding fields to batches
ALTER TABLE batches
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS chip_model text,
ADD COLUMN IF NOT EXISTS sku text,
ADD COLUMN IF NOT EXISTS quantity_expected integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_imported integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_active integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS activated_at timestamptz,
ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

-- Adding fields to tags
ALTER TABLE tags
ADD COLUMN IF NOT EXISTS product_id text,
ADD COLUMN IF NOT EXISTS last_lat double precision,
ADD COLUMN IF NOT EXISTS last_lng double precision,
ADD COLUMN IF NOT EXISTS last_city text,
ADD COLUMN IF NOT EXISTS last_country text,
ADD COLUMN IF NOT EXISTS risk_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Creating ProductPassport table
CREATE TABLE IF NOT EXISTS product_passports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
  tag_id uuid REFERENCES tags(id) ON DELETE SET NULL,
  product_name text,
  product_type text,
  varietal text,
  vintage text,
  alcohol text,
  barrel_aging text,
  harvest text,
  region text,
  winery_name text,
  winery_address text,
  winery_lat double precision,
  winery_lng double precision,
  quality_score text,
  provenance_text text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Adding fields to events
DO $$ BEGIN
  CREATE TYPE event_type AS ENUM (
    'TAP_VALID', 'TAP_INVALID', 'REPLAY_SUSPECT', 'UNKNOWN_BATCH',
    'NOT_REGISTERED', 'NOT_ACTIVE', 'REVOKED', 'BROKEN', 'TAMPERED',
    'OWNERSHIP_ACTIVATED', 'WARRANTY_REGISTERED', 'PROVENANCE_VIEWED',
    'TOKENIZATION_REQUESTED', 'TOKENIZATION_SIMULATED', 'TOKENIZATION_ANCHORED', 'EXPORT_GENERATED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE risk_level AS ENUM ('none', 'low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE geo_precision AS ENUM ('none', 'ip', 'browser_rounded', 'browser_exact');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE events
ADD COLUMN IF NOT EXISTS tenant_slug text,
ADD COLUMN IF NOT EXISTS tag_id uuid REFERENCES tags(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS bid text,
ADD COLUMN IF NOT EXISTS event_type event_type,
ADD COLUMN IF NOT EXISTS verdict text,
ADD COLUMN IF NOT EXISTS risk_level risk_level DEFAULT 'none',
ADD COLUMN IF NOT EXISTS picc_data_hash text,
ADD COLUMN IF NOT EXISTS cmac_hash text,
ADD COLUMN IF NOT EXISTS raw_url_hash text,
ADD COLUMN IF NOT EXISTS ip_hash text,
ADD COLUMN IF NOT EXISTS geo_precision geo_precision DEFAULT 'none',
ADD COLUMN IF NOT EXISTS product_name text;

-- Enhancing leads
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS role text,
ADD COLUMN IF NOT EXISTS interest text,
ADD COLUMN IF NOT EXISTS message text,
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Enhancing tickets
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tap_event_id bigint REFERENCES events(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'low',
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Enhancing order_requests
ALTER TABLE order_requests
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reseller_id uuid,
ADD COLUMN IF NOT EXISTS chip_model text,
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Creating audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id uuid,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
