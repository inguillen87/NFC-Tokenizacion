-- 0030_commercial_portal_leads_runtime_hardening
-- Forward-only safety migration for production DBs that missed older portal/leads migrations.
-- Keeps SUN, consumer portal, marketplace, leads and tokenization CTAs on real tables.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE consumer_status AS ENUM ('anonymous', 'registered', 'verified', 'blocked', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tenant_membership_status AS ENUM ('invited', 'active', 'paused', 'blocked', 'left');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE marketplace_visibility AS ENUM ('tenant_members_only', 'verified_tappers', 'nexid_network', 'invited_segment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE consumer_reward_claim_status AS ENUM ('claimed', 'redeemed', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS consumers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE,
  phone text,
  display_name text,
  avatar_url text,
  preferred_locale text NOT NULL DEFAULT 'es-AR',
  country text,
  city text,
  status consumer_status NOT NULL DEFAULT 'anonymous',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_consumers_phone ON consumers(phone) WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS consumer_identities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  consumer_id uuid NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_subject text NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_subject)
);

CREATE TABLE IF NOT EXISTS consumer_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  consumer_id uuid NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  user_agent_hash text,
  ip_hash text
);

CREATE INDEX IF NOT EXISTS idx_consumer_sessions_consumer ON consumer_sessions(consumer_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS consumer_auth_challenges (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  locked_until timestamptz,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE consumer_auth_challenges ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE consumer_auth_challenges ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5;
ALTER TABLE consumer_auth_challenges ADD COLUMN IF NOT EXISTS locked_until timestamptz;
ALTER TABLE consumer_auth_challenges ADD COLUMN IF NOT EXISTS ip_hash text;
CREATE INDEX IF NOT EXISTS idx_consumer_auth_challenges_contact_created_at ON consumer_auth_challenges(contact, created_at DESC);

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  locale text NOT NULL DEFAULT 'es-AR',
  contact text NOT NULL,
  name text,
  email text,
  phone text,
  company text,
  country text,
  vertical text,
  role_interest text,
  estimated_volume text,
  tag_type text,
  volume integer,
  source text NOT NULL DEFAULT 'assistant',
  status text NOT NULL DEFAULT 'new',
  message text,
  notes text,
  assigned_to text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS role_interest text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS estimated_volume text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS message text;
CREATE INDEX IF NOT EXISTS idx_leads_source_created_at ON leads(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status_created_at ON leads(status, created_at DESC);

CREATE TABLE IF NOT EXISTS tenant_consumer_memberships (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  consumer_id uuid NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  loyalty_program_id uuid REFERENCES loyalty_programs(id) ON DELETE SET NULL,
  status tenant_membership_status NOT NULL DEFAULT 'active',
  source text NOT NULL DEFAULT 'tap',
  first_tap_event_id bigint REFERENCES events(id) ON DELETE SET NULL,
  last_tap_event_id bigint REFERENCES events(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  membership_number text,
  points_balance integer NOT NULL DEFAULT 0,
  lifetime_points integer NOT NULL DEFAULT 0,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_consumer_memberships_tenant_consumer ON tenant_consumer_memberships(tenant_id, consumer_id);

CREATE TABLE IF NOT EXISTS consumer_tenant_consents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  consumer_id uuid NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  scope text NOT NULL,
  granted boolean NOT NULL DEFAULT false,
  granted_at timestamptz,
  revoked_at timestamptz,
  source text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(tenant_id, consumer_id, scope)
);

CREATE TABLE IF NOT EXISTS consumer_products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  consumer_id uuid NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_passport_id text,
  tag_id uuid REFERENCES tags(id) ON DELETE SET NULL,
  first_tap_event_id bigint NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  latest_tap_event_id bigint REFERENCES events(id) ON DELETE SET NULL,
  ownership_status text NOT NULL DEFAULT 'viewed',
  collection_type text NOT NULL DEFAULT 'other',
  product_name text NOT NULL,
  brand_name text NOT NULL,
  image_url text,
  acquired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consumer_products_consumer ON consumer_products(consumer_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS consumer_tap_history (
  id bigserial PRIMARY KEY,
  consumer_id uuid REFERENCES consumers(id) ON DELETE SET NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tap_event_id bigint NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  product_passport_id text,
  tag_id uuid REFERENCES tags(id) ON DELETE SET NULL,
  verdict text,
  risk_level text,
  city text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_consumer_tap_history_consumer_event ON consumer_tap_history(consumer_id, tap_event_id);
CREATE INDEX IF NOT EXISTS idx_consumer_tap_history_consumer ON consumer_tap_history(consumer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS consumer_product_ownerships (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  consumer_id uuid NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES tags(id) ON DELETE SET NULL,
  uid_hex text NOT NULL,
  event_id bigint NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('claimed', 'blocked_replay', 'revoked', 'disputed')),
  source text NOT NULL CHECK (source IN ('sun_passport', 'marketplace', 'admin')),
  trust_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_consumer_product_ownerships_consumer_event ON consumer_product_ownerships(consumer_id, event_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_consumer_product_ownerships_active_uid ON consumer_product_ownerships(tenant_id, uid_hex) WHERE status = 'claimed';

CREATE TABLE IF NOT EXISTS consumer_reward_wallets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  consumer_id uuid NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  network_scope text NOT NULL DEFAULT 'tenant',
  points_balance integer NOT NULL DEFAULT 0,
  lifetime_points integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(consumer_id, tenant_id, network_scope)
);

CREATE TABLE IF NOT EXISTS consumer_notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  consumer_id uuid NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  action_url text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consumer_reward_claims (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  consumer_id uuid NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  tap_event_id bigint REFERENCES events(id) ON DELETE SET NULL,
  status consumer_reward_claim_status NOT NULL DEFAULT 'claimed',
  points_spent integer NOT NULL,
  redemption_code text NOT NULL UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consumer_reward_claims_consumer ON consumer_reward_claims(consumer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_brand_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  display_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  vertical text NOT NULL,
  description text,
  country text,
  city text,
  visible_in_network boolean NOT NULL DEFAULT false,
  accepts_network_credits boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  tags_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace_products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  description text,
  vertical text NOT NULL,
  category text,
  image_url text,
  price_amount numeric(12,2),
  price_currency text,
  external_checkout_url text,
  request_to_buy_enabled boolean NOT NULL DEFAULT true,
  accepts_rewards boolean NOT NULL DEFAULT true,
  accepts_tenant_points boolean NOT NULL DEFAULT true,
  accepts_network_credits boolean NOT NULL DEFAULT false,
  age_gate_required boolean NOT NULL DEFAULT false,
  authenticity_program_badge boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  country_availability_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace_offers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  marketplace_product_id uuid REFERENCES marketplace_products(id) ON DELETE SET NULL,
  reward_id uuid REFERENCES rewards(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  type text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  visibility marketplace_visibility NOT NULL DEFAULT 'tenant_members_only',
  eligibility_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace_order_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  consumer_id uuid NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  marketplace_product_id uuid REFERENCES marketplace_products(id) ON DELETE SET NULL,
  offer_id uuid REFERENCES marketplace_offers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'requested',
  quantity integer NOT NULL DEFAULT 1,
  consumer_message text,
  contact_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  shipping_address_json jsonb,
  source_tap_event_id bigint REFERENCES events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_products_tenant ON marketplace_products(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_marketplace_order_requests_tenant ON marketplace_order_requests(tenant_id, created_at DESC);

INSERT INTO marketplace_brand_profiles (tenant_id, status, display_name, slug, vertical, description, country, city, visible_in_network, featured)
SELECT t.id, 'active', 'Demo Bodega', t.slug, 'winery', 'Bodega piloto con productos NFC verificados, ownership y marketplace.', 'AR', 'Mendoza', true, true
FROM tenants t
WHERE t.slug = 'demobodega'
ON CONFLICT (tenant_id) DO UPDATE SET
  status = 'active',
  display_name = EXCLUDED.display_name,
  visible_in_network = true,
  featured = true,
  updated_at = now();

INSERT INTO marketplace_products (tenant_id, status, title, description, vertical, category, request_to_buy_enabled, accepts_tenant_points, age_gate_required, featured)
SELECT t.id, 'active', 'Gran Reserva Malbec - club release', 'Compra asistida y club premium para botella verificada con NTAG 424 DNA TT.', 'winery', 'wine', true, true, true, true
FROM tenants t
WHERE t.slug = 'demobodega'
  AND NOT EXISTS (
    SELECT 1 FROM marketplace_products p
    WHERE p.tenant_id = t.id AND p.title = 'Gran Reserva Malbec - club release'
  );
