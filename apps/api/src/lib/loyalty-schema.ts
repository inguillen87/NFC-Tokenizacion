import { sql } from "./db";

let schemaReady: Promise<void> | null = null;

async function migrateLoyaltySchema() {
  await sql/*sql*/`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

  await sql/*sql*/`DO $$ BEGIN CREATE TYPE loyalty_program_status AS ENUM ('draft', 'active', 'paused', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  await sql/*sql*/`DO $$ BEGIN CREATE TYPE loyalty_member_status AS ENUM ('anonymous', 'enrolled', 'verified', 'blocked', 'deleted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  await sql/*sql*/`DO $$ BEGIN CREATE TYPE reward_type AS ENUM ('DISCOUNT', 'EXPERIENCE', 'TASTING', 'TOUR', 'FREE_SHIPPING', 'EARLY_ACCESS', 'DIGITAL_COLLECTIBLE', 'CONTENT_UNLOCK', 'GIFT', 'SERVICE', 'WARRANTY_EXTENSION', 'REFILL', 'VIP_ACCESS', 'WINE_BOTTLE', 'WINE_BOX'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  await sql/*sql*/`DO $$ BEGIN CREATE TYPE reward_redemption_status AS ENUM ('pending', 'confirmed', 'fulfilled', 'cancelled', 'expired', 'reversed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  await sql/*sql*/`DO $$ BEGIN CREATE TYPE points_source AS ENUM ('TAP_VALID', 'PROVENANCE_VIEWED', 'OWNERSHIP_ACTIVATED', 'WARRANTY_REGISTERED', 'QUIZ_COMPLETED', 'EXPERIENCE_ATTENDED', 'REFERRAL_SIGNUP', 'REWARD_REDEEMED', 'ADMIN_ADJUSTMENT', 'FRAUD_REVERSAL', 'EXPIRATION'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`;

  await sql/*sql*/`
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
    )
  `;

  await sql/*sql*/`
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
    )
  `;

  await sql/*sql*/`
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
    )
  `;

  await sql/*sql*/`
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
    )
  `;

  await sql/*sql*/`
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
    )
  `;

  await sql/*sql*/`
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
    )
  `;

  await sql/*sql*/`
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
    )
  `;

  await sql/*sql*/`
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
    )
  `;

  await sql/*sql*/`ALTER TABLE loyalty_members ADD COLUMN IF NOT EXISTS event_id bigint`;
  await sql/*sql*/`ALTER TABLE loyalty_members ADD COLUMN IF NOT EXISTS member_key text`;
  await sql/*sql*/`ALTER TABLE loyalty_members ADD COLUMN IF NOT EXISTS consumer_id uuid`;
  await sql/*sql*/`ALTER TABLE loyalty_members ADD COLUMN IF NOT EXISTS preferred_locale text NOT NULL DEFAULT 'es-AR'`;
  await sql/*sql*/`ALTER TABLE loyalty_members ADD COLUMN IF NOT EXISTS display_name text`;
  await sql/*sql*/`ALTER TABLE loyalty_members ADD COLUMN IF NOT EXISTS country text`;
  await sql/*sql*/`ALTER TABLE loyalty_members ADD COLUMN IF NOT EXISTS tier_id uuid`;
  await sql/*sql*/`ALTER TABLE loyalty_members ADD COLUMN IF NOT EXISTS consent_json jsonb NOT NULL DEFAULT '{}'::jsonb`;
  await sql/*sql*/`ALTER TABLE loyalty_members ADD COLUMN IF NOT EXISTS profile_json jsonb NOT NULL DEFAULT '{}'::jsonb`;
  await sql/*sql*/`ALTER TABLE loyalty_members ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;

  await sql/*sql*/`ALTER TABLE rewards ADD COLUMN IF NOT EXISTS image_url text`;
  await sql/*sql*/`ALTER TABLE rewards ADD COLUMN IF NOT EXISTS requires_age_gate boolean NOT NULL DEFAULT false`;
  await sql/*sql*/`ALTER TABLE rewards ADD COLUMN IF NOT EXISTS network_visible boolean NOT NULL DEFAULT false`;
  await sql/*sql*/`ALTER TABLE rewards ADD COLUMN IF NOT EXISTS redemption_limit_per_member integer`;
  await sql/*sql*/`ALTER TABLE rewards ADD COLUMN IF NOT EXISTS eligibility_json jsonb NOT NULL DEFAULT '{}'::jsonb`;
  await sql/*sql*/`ALTER TABLE rewards ADD COLUMN IF NOT EXISTS fulfillment_json jsonb NOT NULL DEFAULT '{}'::jsonb`;

  await sql/*sql*/`
    UPDATE loyalty_members
    SET member_key = COALESCE(member_key, 'event:' || event_id::text, 'member:' || id::text)
    WHERE member_key IS NULL
  `;

  await sql/*sql*/`CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_members_program_email ON loyalty_members(program_id, email)`;
  await sql/*sql*/`CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_members_program_member_key ON loyalty_members(program_id, member_key)`;
  await sql/*sql*/`CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_members_program_consumer ON loyalty_members(program_id, consumer_id) WHERE consumer_id IS NOT NULL`;
  await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_loyalty_programs_tenant ON loyalty_programs(tenant_id, status)`;
  await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_loyalty_members_consumer_program ON loyalty_members(consumer_id, program_id)`;
  await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_points_ledger_member_created ON points_ledger(member_id, created_at DESC)`;
  await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_rewards_program_status ON rewards(program_id, status, starts_at)`;
  await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_reward_redemptions_member ON reward_redemptions(member_id, created_at DESC)`;
}

export async function ensureLoyaltySchema() {
  if (!schemaReady) {
    schemaReady = migrateLoyaltySchema().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export async function ensureDefaultLoyaltyProgram(input: { tenantId: string; tenantSlug?: string | null }) {
  await ensureLoyaltySchema();

  const existing = (await sql/*sql*/`
    SELECT id, name, points_name
    FROM loyalty_programs
    WHERE tenant_id = ${input.tenantId}
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `)[0];
  if (existing) return existing;

  const profile = (await sql/*sql*/`
    SELECT club_name, vertical, metadata
    FROM tenant_sun_profiles
    WHERE tenant_id = ${input.tenantId}
      AND NULLIF(club_name, '') IS NOT NULL
      AND NULLIF(vertical, '') IS NOT NULL
    LIMIT 1
  `)[0] as { club_name?: string; vertical?: string; metadata?: Record<string, unknown> } | undefined;

  if (!profile) return null;
  const loyalty = profile.metadata && typeof profile.metadata === "object" ? (profile.metadata.loyalty as Record<string, unknown> | undefined) : undefined;
  const pointsName = typeof loyalty?.pointsName === "string" && loyalty.pointsName.trim() ? loyalty.pointsName.trim() : "Puntos";
  const rules = loyalty?.rules && typeof loyalty.rules === "object" ? loyalty.rules : { pointsPerValidTap: 10, cooldownSeconds: 3600 };
  const rewards = Array.isArray(loyalty?.rewards) ? loyalty.rewards as Array<Record<string, unknown>> : [];
  const program = (await sql/*sql*/`
    INSERT INTO loyalty_programs (tenant_id, name, vertical, status, mode, points_name, default_locale, allow_experience_booking, rules_json)
    VALUES (${input.tenantId}, ${String(profile.club_name)}, ${String(profile.vertical)}, 'active', 'production', ${pointsName}, 'es-AR', true, ${JSON.stringify(rules)}::jsonb)
    ON CONFLICT DO NOTHING
    RETURNING id, name, points_name
  `)[0] || (await sql/*sql*/`
    SELECT id, name, points_name
    FROM loyalty_programs
    WHERE tenant_id = ${input.tenantId}
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `)[0];

  if (program?.id) {
    for (const reward of rewards) {
      const code = typeof reward.code === "string" ? reward.code : "";
      const title = typeof reward.title === "string" ? reward.title : "";
      const type = typeof reward.type === "string" ? reward.type : "";
      if (!code || !title || !type) continue;
      await sql/*sql*/`
        INSERT INTO rewards (tenant_id, program_id, code, title, description, type, status, points_cost, stock_total, stock_remaining, network_visible)
        VALUES (${input.tenantId}, ${program.id}, ${code}, ${title}, ${String(reward.description || "")}, ${type}::reward_type, 'active', ${Number(reward.points || 0)}, ${Number(reward.stock || 0)}, ${Number(reward.stock || 0)}, true)
        ON CONFLICT (program_id, code) DO NOTHING
      `;
    }
  }

  return program || null;
}
