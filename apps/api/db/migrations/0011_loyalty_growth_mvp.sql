DO $$ BEGIN
  CREATE TYPE loyalty_program_status AS ENUM ('draft', 'active', 'paused', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE loyalty_program_mode AS ENUM ('demo', 'production');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE loyalty_member_status AS ENUM ('anonymous', 'enrolled', 'verified', 'blocked', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE points_source AS ENUM (
    'TAP_VALID',
    'PROVENANCE_VIEWED',
    'OWNERSHIP_ACTIVATED',
    'WARRANTY_REGISTERED',
    'QUIZ_COMPLETED',
    'EXPERIENCE_ATTENDED',
    'REFERRAL_SIGNUP',
    'REWARD_REDEEMED',
    'ADMIN_ADJUSTMENT',
    'FRAUD_REVERSAL',
    'EXPIRATION'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reward_status AS ENUM ('draft', 'active', 'paused', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reward_redemption_status AS ENUM ('pending', 'confirmed', 'fulfilled', 'cancelled', 'expired', 'reversed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS loyalty_programs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  vertical text NOT NULL DEFAULT 'winery',
  status loyalty_program_status NOT NULL DEFAULT 'draft',
  mode loyalty_program_mode NOT NULL DEFAULT 'demo',
  points_name text NOT NULL DEFAULT 'Puntos',
  default_locale text NOT NULL DEFAULT 'es-AR',
  age_gate_required boolean NOT NULL DEFAULT false,
  allow_experience_booking boolean NOT NULL DEFAULT true,
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
  email text,
  phone text,
  display_name text,
  country text,
  preferred_locale text NOT NULL DEFAULT 'es-AR',
  status loyalty_member_status NOT NULL DEFAULT 'anonymous',
  points_balance integer NOT NULL DEFAULT 0,
  lifetime_points integer NOT NULL DEFAULT 0,
  first_tap_at timestamptz,
  last_tap_at timestamptz,
  consent_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  profile_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id, event_id)
);

CREATE TABLE IF NOT EXISTS points_ledger (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  tap_event_id bigint REFERENCES events(id) ON DELETE SET NULL,
  source points_source NOT NULL,
  delta integer NOT NULL,
  balance_after integer NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  reason text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rewards (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'DISCOUNT',
  status reward_status NOT NULL DEFAULT 'draft',
  points_cost integer NOT NULL DEFAULT 0,
  stock_total integer,
  stock_remaining integer,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  eligibility_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  fulfillment_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id, code)
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  status reward_redemption_status NOT NULL DEFAULT 'pending',
  points_spent integer NOT NULL,
  redemption_code text NOT NULL UNIQUE,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_programs_tenant ON loyalty_programs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_program_event ON loyalty_members(program_id, event_id);
CREATE INDEX IF NOT EXISTS idx_points_ledger_member_created ON points_ledger(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rewards_program_status ON rewards(program_id, status, starts_at);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_member ON reward_redemptions(member_id, created_at DESC);

INSERT INTO loyalty_programs (tenant_id, name, vertical, status, mode, points_name, default_locale, rules_json)
SELECT t.id, 'Club Terroir', 'winery', 'active', 'demo', 'Uvas', 'es-AR', '{"pointsPerValidTap": 10, "cooldownSeconds": 3600}'::jsonb
FROM tenants t
WHERE t.slug = 'demobodega'
AND NOT EXISTS (
  SELECT 1 FROM loyalty_programs lp
  WHERE lp.tenant_id = t.id AND lp.name = 'Club Terroir'
);

INSERT INTO rewards (tenant_id, program_id, code, title, description, type, status, points_cost, stock_total, stock_remaining)
SELECT lp.tenant_id, lp.id, x.code, x.title, x.description, x.type, 'active', x.points_cost, x.stock_total, x.stock_total
FROM loyalty_programs lp
JOIN (
  VALUES
    ('WELCOME-10', '10% off próxima compra', 'Descuento para compra directa de bodega.', 'DISCOUNT', 40, 500),
    ('TASTING-UP', 'Upgrade de degustación', 'Acceso upgrade para cata premium.', 'TASTING', 80, 120),
    ('TOUR-BARRICA', 'Tour de barrica', 'Visita guiada de barricas y proceso.', 'TOUR', 120, 80)
) AS x(code, title, description, type, points_cost, stock_total) ON true
WHERE lp.name = 'Club Terroir'
AND NOT EXISTS (
  SELECT 1 FROM rewards r WHERE r.program_id = lp.id AND r.code = x.code
);
