-- 0026_tokenization_loyalty_schema_hardening
-- Production hardening for partially provisioned DBs.
-- Adds the Polygon tokenization queue and the loyalty/rewards domain used by SUN mobile and consumer portal.
-- Forward-only and idempotent: safe to run after older partial schema deployments.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  CREATE TYPE loyalty_program_status AS ENUM ('draft', 'active', 'paused', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE loyalty_member_status AS ENUM ('anonymous', 'enrolled', 'verified', 'blocked', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reward_type AS ENUM (
    'DISCOUNT', 'EXPERIENCE', 'TASTING', 'TOUR', 'FREE_SHIPPING', 'EARLY_ACCESS',
    'DIGITAL_COLLECTIBLE', 'CONTENT_UNLOCK', 'GIFT', 'SERVICE', 'WARRANTY_EXTENSION',
    'REFILL', 'VIP_ACCESS', 'WINE_BOTTLE', 'WINE_BOX'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reward_redemption_status AS ENUM ('pending', 'confirmed', 'fulfilled', 'cancelled', 'expired', 'reversed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE points_source AS ENUM (
    'TAP_VALID', 'PROVENANCE_VIEWED', 'OWNERSHIP_ACTIVATED', 'WARRANTY_REGISTERED',
    'QUIZ_COMPLETED', 'EXPERIENCE_ATTENDED', 'REFERRAL_SIGNUP', 'REWARD_REDEEMED',
    'ADMIN_ADJUSTMENT', 'FRAUD_REVERSAL', 'EXPIRATION'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS tokenization_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid,
  batch_id uuid,
  bid text NOT NULL,
  uid_hex text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  network text NOT NULL DEFAULT 'polygon-amoy',
  asset_ref text,
  issuer_wallet text,
  tx_hash text,
  token_id text,
  anchor_hash text,
  requested_by text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz,
  external_ref text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS batch_id uuid;
ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS network text NOT NULL DEFAULT 'polygon-amoy';
ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS asset_ref text;
ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS issuer_wallet text;
ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS tx_hash text;
ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS token_id text;
ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS anchor_hash text;
ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS requested_by text;
ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS requested_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS processed_at timestamptz;
ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;
ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS external_ref text;
ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tokenization_requests_bid_uid ON tokenization_requests(bid, uid_hex, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokenization_requests_status ON tokenization_requests(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokenization_requests_tenant ON tokenization_requests(tenant_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokenization_requests_next_attempt ON tokenization_requests(status, next_attempt_at, requested_at);

CREATE TABLE IF NOT EXISTS loyalty_programs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  vertical text NOT NULL DEFAULT 'other',
  status loyalty_program_status NOT NULL DEFAULT 'draft',
  mode text NOT NULL DEFAULT 'production',
  points_name text NOT NULL DEFAULT 'Points',
  default_locale text NOT NULL DEFAULT 'es-AR',
  age_gate_required boolean NOT NULL DEFAULT false,
  allow_family_pooling boolean NOT NULL DEFAULT false,
  allow_referrals boolean NOT NULL DEFAULT false,
  allow_experience_booking boolean NOT NULL DEFAULT false,
  allow_digital_collectibles boolean NOT NULL DEFAULT false,
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz,
  rules_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  event_id bigint REFERENCES events(id) ON DELETE SET NULL,
  member_key text,
  consumer_id uuid,
  email text,
  phone text,
  display_name text,
  country text,
  preferred_locale text NOT NULL DEFAULT 'es-AR',
  status loyalty_member_status NOT NULL DEFAULT 'anonymous',
  tier_id uuid,
  points_balance integer NOT NULL DEFAULT 0,
  lifetime_points integer NOT NULL DEFAULT 0,
  first_tap_at timestamptz,
  last_tap_at timestamptz,
  consent_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  profile_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  name text NOT NULL,
  rank integer NOT NULL,
  min_points integer NOT NULL DEFAULT 0,
  min_verified_taps integer NOT NULL DEFAULT 0,
  benefits_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  badge_icon text,
  color_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id, rank)
);

CREATE TABLE IF NOT EXISTS points_ledger (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  tap_event_id bigint REFERENCES events(id) ON DELETE SET NULL,
  source points_source NOT NULL,
  delta integer NOT NULL,
  balance_after integer NOT NULL,
  idempotency_key text UNIQUE,
  reason text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  rarity text DEFAULT 'common',
  vertical text,
  criteria_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id, code)
);

CREATE TABLE IF NOT EXISTS member_badges (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  tap_event_id bigint REFERENCES events(id) ON DELETE SET NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(member_id, badge_id)
);

CREATE TABLE IF NOT EXISTS rewards (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  type reward_type NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  points_cost integer NOT NULL DEFAULT 0,
  stock_total integer,
  stock_remaining integer,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  redemption_limit_per_member integer,
  eligibility_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  fulfillment_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  image_url text,
  requires_age_gate boolean NOT NULL DEFAULT false,
  network_visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id, code)
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  status reward_redemption_status NOT NULL DEFAULT 'pending',
  points_spent integer NOT NULL,
  redemption_code text UNIQUE,
  qr_payload_hash text,
  fulfilled_at timestamptz,
  expires_at timestamptz,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE loyalty_members ADD COLUMN IF NOT EXISTS event_id bigint;
ALTER TABLE loyalty_members ADD COLUMN IF NOT EXISTS member_key text;
ALTER TABLE loyalty_members ADD COLUMN IF NOT EXISTS consumer_id uuid;
ALTER TABLE loyalty_members ADD COLUMN IF NOT EXISTS preferred_locale text NOT NULL DEFAULT 'es-AR';
ALTER TABLE loyalty_members ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE loyalty_members ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE loyalty_members ADD COLUMN IF NOT EXISTS tier_id uuid;
ALTER TABLE loyalty_members ADD COLUMN IF NOT EXISTS consent_json jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE loyalty_members ADD COLUMN IF NOT EXISTS profile_json jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE loyalty_members ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE rewards ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS requires_age_gate boolean NOT NULL DEFAULT false;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS network_visible boolean NOT NULL DEFAULT false;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS redemption_limit_per_member integer;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS eligibility_json jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS fulfillment_json jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE loyalty_members
SET member_key = COALESCE(member_key, 'event:' || event_id::text, 'member:' || id::text)
WHERE member_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_members_program_email ON loyalty_members(program_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_members_program_member_key ON loyalty_members(program_id, member_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_members_program_consumer ON loyalty_members(program_id, consumer_id) WHERE consumer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loyalty_programs_tenant ON loyalty_programs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_consumer_program ON loyalty_members(consumer_id, program_id);
CREATE INDEX IF NOT EXISTS idx_points_ledger_member_created ON points_ledger(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rewards_program_status ON rewards(program_id, status, starts_at);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_member ON reward_redemptions(member_id, created_at DESC);

INSERT INTO loyalty_programs (tenant_id, name, vertical, status, mode, points_name, default_locale, allow_experience_booking, rules_json)
SELECT t.id, 'Club Terroir', 'winery', 'active', 'demo', 'Uvas', 'es-AR', true, '{"pointsPerValidTap":10,"cooldownSeconds":3600}'::jsonb
FROM tenants t
WHERE t.slug = 'demobodega'
  AND NOT EXISTS (
    SELECT 1 FROM loyalty_programs lp
    WHERE lp.tenant_id = t.id AND lp.status = 'active'
  );

INSERT INTO rewards (tenant_id, program_id, code, title, description, type, status, points_cost, stock_total, stock_remaining, network_visible)
SELECT lp.tenant_id, lp.id, x.code, x.title, x.description, x.type::reward_type, 'active', x.points_cost, x.stock_total, x.stock_total, true
FROM loyalty_programs lp
JOIN (
  VALUES
    ('WELCOME-10', '10% off proxima compra', 'Descuento para compra directa de bodega.', 'DISCOUNT', 40, 500),
    ('TASTING-UP', 'Upgrade de degustacion', 'Acceso a cata premium durante la visita.', 'TASTING', 80, 120),
    ('TOUR-BARRICA', 'Tour de barrica', 'Visita guiada de barricas y proceso.', 'TOUR', 120, 80)
) AS x(code, title, description, type, points_cost, stock_total) ON true
WHERE lp.name = 'Club Terroir'
  AND NOT EXISTS (
    SELECT 1 FROM rewards r WHERE r.program_id = lp.id AND r.code = x.code
  );
