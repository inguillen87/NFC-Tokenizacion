DO $$ BEGIN
  CREATE TYPE consumer_status AS ENUM ('anonymous', 'registered', 'verified', 'blocked', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tenant_membership_status AS ENUM ('invited', 'active', 'paused', 'blocked', 'left');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE marketplace_visibility AS ENUM ('tenant_members_only', 'verified_tappers', 'nexid_network', 'invited_segment');
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

CREATE TABLE IF NOT EXISTS consumer_auth_challenges (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

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
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, consumer_id)
);

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
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(consumer_id, tap_event_id)
);

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

CREATE TABLE IF NOT EXISTS nexid_network_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  consumer_id uuid NOT NULL UNIQUE REFERENCES consumers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  discoverability text NOT NULL DEFAULT 'private',
  allow_cross_brand_recommendations boolean NOT NULL DEFAULT false,
  allow_partner_offers boolean NOT NULL DEFAULT false,
  profile_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS idx_consumer_sessions_consumer ON consumer_sessions(consumer_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_consumer_tap_history_consumer ON consumer_tap_history(consumer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_tenant ON marketplace_products(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_marketplace_offers_tenant ON marketplace_offers(tenant_id, status, starts_at);
CREATE INDEX IF NOT EXISTS idx_marketplace_order_requests_tenant ON marketplace_order_requests(tenant_id, created_at DESC);

INSERT INTO marketplace_brand_profiles (tenant_id, status, display_name, slug, vertical, description, country, city, visible_in_network, featured)
SELECT t.id, 'active',
  CASE t.slug
    WHEN 'demobodega' THEN 'Demo Bodega'
    WHEN 'demo-perfume' THEN 'Demo Perfume'
    WHEN 'demo-beauty' THEN 'Demo Beauty'
    WHEN 'demo-events' THEN 'Demo Premium Event'
    WHEN 'demo-luxury' THEN 'Demo Luxury Retail'
    ELSE t.name
  END,
  t.slug,
  CASE
    WHEN t.slug LIKE '%bodega%' THEN 'winery'
    WHEN t.slug LIKE '%perfume%' THEN 'perfume'
    WHEN t.slug LIKE '%beauty%' THEN 'cosmetics'
    WHEN t.slug LIKE '%event%' THEN 'events'
    WHEN t.slug LIKE '%luxury%' THEN 'luxury'
    ELSE 'retail'
  END,
  'Perfil demo dentro de la red premium nexID.',
  'AR',
  'Mendoza',
  true,
  true
FROM tenants t
WHERE t.slug IN ('demobodega', 'demo-perfume', 'demo-beauty', 'demo-events', 'demo-luxury')
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO marketplace_products (tenant_id, status, title, description, vertical, category, request_to_buy_enabled, accepts_tenant_points, featured)
SELECT t.id, 'active',
  CASE t.slug
    WHEN 'demobodega' THEN 'Caja Demo Bodega Gran Reserva'
    WHEN 'demo-perfume' THEN 'Discovery Set Demo Perfume'
    WHEN 'demo-beauty' THEN 'Kit Demo Beauty Routine'
    WHEN 'demo-events' THEN 'Pass Demo Premium Event'
    WHEN 'demo-luxury' THEN 'Accessory Demo Luxury'
    ELSE t.name || ' producto premium'
  END,
  'Producto demo para marketplace verificado nexID.',
  CASE
    WHEN t.slug LIKE '%bodega%' THEN 'winery'
    WHEN t.slug LIKE '%perfume%' THEN 'perfume'
    WHEN t.slug LIKE '%beauty%' THEN 'cosmetics'
    WHEN t.slug LIKE '%event%' THEN 'events'
    WHEN t.slug LIKE '%luxury%' THEN 'luxury'
    ELSE 'retail'
  END,
  'premium',
  true,
  true,
  true
FROM tenants t
WHERE t.slug IN ('demobodega', 'demo-perfume', 'demo-beauty', 'demo-events', 'demo-luxury')
AND NOT EXISTS (SELECT 1 FROM marketplace_products p WHERE p.tenant_id = t.id AND p.title LIKE 'Caja Demo Bodega%');

INSERT INTO marketplace_offers (tenant_id, marketplace_product_id, reward_id, title, description, status, type, visibility)
SELECT t.id, p.id, r.id, 'Oferta demo verificada', 'Oferta premium demo con trazabilidad NFC.', 'active', 'request_to_buy', 'nexid_network'
FROM tenants t
JOIN marketplace_products p ON p.tenant_id = t.id
LEFT JOIN loyalty_programs lp ON lp.tenant_id = t.id AND lp.status = 'active'
LEFT JOIN rewards r ON r.program_id = lp.id
WHERE t.slug IN ('demobodega', 'demo-perfume', 'demo-beauty', 'demo-events', 'demo-luxury')
AND NOT EXISTS (SELECT 1 FROM marketplace_offers o WHERE o.tenant_id = t.id);
