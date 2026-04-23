-- Phase 1: LOYALTY DOMAIN MODEL

DO $$ BEGIN
  CREATE TYPE loyalty_program_status AS ENUM ('draft', 'active', 'paused', 'archived');
  CREATE TYPE loyalty_member_status AS ENUM ('anonymous', 'enrolled', 'verified', 'blocked', 'deleted');
  CREATE TYPE reward_type AS ENUM ('DISCOUNT', 'EXPERIENCE', 'TASTING', 'TOUR', 'FREE_SHIPPING', 'EARLY_ACCESS', 'DIGITAL_COLLECTIBLE', 'CONTENT_UNLOCK', 'GIFT', 'SERVICE', 'WARRANTY_EXTENSION', 'REFILL', 'VIP_ACCESS', 'WINE_BOTTLE', 'WINE_BOX');
  CREATE TYPE reward_redemption_status AS ENUM ('pending', 'confirmed', 'fulfilled', 'cancelled', 'expired', 'reversed');
  CREATE TYPE points_source AS ENUM ('TAP_VALID', 'PROVENANCE_VIEWED', 'OWNERSHIP_ACTIVATED', 'WARRANTY_REGISTERED', 'QUIZ_COMPLETED', 'EXPERIENCE_ATTENDED', 'REFERRAL_SIGNUP', 'REWARD_REDEEMED', 'ADMIN_ADJUSTMENT', 'FRAUD_REVERSAL', 'EXPIRATION');
  CREATE TYPE experience_status AS ENUM ('draft', 'active', 'sold_out', 'cancelled', 'archived');
  CREATE TYPE booking_status AS ENUM ('requested', 'confirmed', 'checked_in', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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
  consumer_id uuid,
  email text,
  phone text,
  display_name text,
  country text,
  preferred_locale text DEFAULT 'es-AR',
  status loyalty_member_status NOT NULL DEFAULT 'anonymous',
  tier_id uuid,
  points_balance integer NOT NULL DEFAULT 0,
  lifetime_points integer NOT NULL DEFAULT 0,
  first_tap_at timestamptz,
  last_tap_at timestamptz,
  consent_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  profile_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id, email)
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

ALTER TABLE loyalty_members ADD CONSTRAINT fk_tier FOREIGN KEY (tier_id) REFERENCES loyalty_tiers(id) ON DELETE SET NULL;

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

CREATE TABLE IF NOT EXISTS experiences (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  vertical text,
  type text NOT NULL,
  location_name text,
  address text,
  city text,
  province text,
  country text,
  lat double precision,
  lng double precision,
  capacity integer,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  booking_policy_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  reward_id uuid REFERENCES rewards(id) ON DELETE SET NULL,
  status experience_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS experience_bookings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  experience_id uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  status booking_status NOT NULL DEFAULT 'requested',
  check_in_tap_event_id bigint REFERENCES events(id) ON DELETE SET NULL,
  booking_code text UNIQUE,
  guests_count integer DEFAULT 1,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(experience_id, member_id)
);
