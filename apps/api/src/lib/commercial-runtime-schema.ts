import { sql } from "./db";
import { ensureLoyaltySchema } from "./loyalty-schema";

let authSchemaReady: Promise<void> | null = null;
let portalSchemaReady: Promise<void> | null = null;
let leadsSchemaReady: Promise<void> | null = null;
let ticketsSchemaReady: Promise<void> | null = null;
let orderRequestsSchemaReady: Promise<void> | null = null;
let alertsSchemaReady: Promise<void> | null = null;
let enterpriseIamSchemaReady: Promise<void> | null = null;

async function ensureUuidExtensions() {
  await sql/*sql*/`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  await sql/*sql*/`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
}

export async function ensureConsumerAuthSchema() {
  if (!authSchemaReady) {
    authSchemaReady = (async () => {
      await ensureUuidExtensions();
      await sql/*sql*/`DO $$ BEGIN CREATE TYPE consumer_status AS ENUM ('anonymous', 'registered', 'verified', 'blocked', 'deleted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`;

      await sql/*sql*/`
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
        )
      `;
      await sql/*sql*/`CREATE UNIQUE INDEX IF NOT EXISTS uq_consumers_phone ON consumers(phone) WHERE phone IS NOT NULL`;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS consumer_identities (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          consumer_id uuid NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
          provider text NOT NULL,
          provider_subject text NOT NULL,
          verified_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE(provider, provider_subject)
        )
      `;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS consumer_sessions (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          consumer_id uuid NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
          session_token_hash text NOT NULL UNIQUE,
          expires_at timestamptz NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          last_seen_at timestamptz NOT NULL DEFAULT now(),
          user_agent_hash text,
          ip_hash text
        )
      `;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_consumer_sessions_consumer ON consumer_sessions(consumer_id, expires_at DESC)`;

      await sql/*sql*/`
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
        )
      `;
      await sql/*sql*/`ALTER TABLE consumer_auth_challenges ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0`;
      await sql/*sql*/`ALTER TABLE consumer_auth_challenges ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5`;
      await sql/*sql*/`ALTER TABLE consumer_auth_challenges ADD COLUMN IF NOT EXISTS locked_until timestamptz`;
      await sql/*sql*/`ALTER TABLE consumer_auth_challenges ADD COLUMN IF NOT EXISTS ip_hash text`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_consumer_auth_challenges_contact_created_at ON consumer_auth_challenges(contact, created_at DESC)`;
    })();
  }
  return authSchemaReady;
}

export async function ensureLeadsSchema() {
  if (!leadsSchemaReady) {
    leadsSchemaReady = (async () => {
      await ensureUuidExtensions();
      await sql/*sql*/`
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
        )
      `;
      await sql/*sql*/`ALTER TABLE leads ADD COLUMN IF NOT EXISTS name text`;
      await sql/*sql*/`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email text`;
      await sql/*sql*/`ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone text`;
      await sql/*sql*/`ALTER TABLE leads ADD COLUMN IF NOT EXISTS role_interest text`;
      await sql/*sql*/`ALTER TABLE leads ADD COLUMN IF NOT EXISTS estimated_volume text`;
      await sql/*sql*/`ALTER TABLE leads ADD COLUMN IF NOT EXISTS message text`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_leads_source_created_at ON leads(source, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_leads_status_created_at ON leads(status, created_at DESC)`;
    })();
  }
  return leadsSchemaReady;
}

export async function ensureTicketsSchema() {
  if (!ticketsSchemaReady) {
    ticketsSchemaReady = (async () => {
      await ensureUuidExtensions();
      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS tickets (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          locale text NOT NULL DEFAULT 'es-AR',
          contact text NOT NULL,
          title text NOT NULL,
          detail text,
          status text NOT NULL DEFAULT 'open',
          source text NOT NULL DEFAULT 'web_bot',
          assigned_to text,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql/*sql*/`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'es-AR'`;
      await sql/*sql*/`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS contact text NOT NULL DEFAULT 'unknown'`;
      await sql/*sql*/`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'General inquiry'`;
      await sql/*sql*/`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS detail text`;
      await sql/*sql*/`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open'`;
      await sql/*sql*/`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web_bot'`;
      await sql/*sql*/`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_to text`;
      await sql/*sql*/`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_tickets_status_created_at ON tickets(status, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_tickets_contact_created_at ON tickets(contact, created_at DESC)`;
    })();
  }
  return ticketsSchemaReady;
}

export async function ensureOrderRequestsSchema() {
  if (!orderRequestsSchemaReady) {
    orderRequestsSchemaReady = (async () => {
      await ensureUuidExtensions();
      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS order_requests (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          locale text NOT NULL DEFAULT 'es-AR',
          contact text NOT NULL,
          company text,
          tag_type text,
          volume integer,
          notes text,
          status text NOT NULL DEFAULT 'new',
          source text NOT NULL DEFAULT 'web_bot',
          assigned_to text,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql/*sql*/`ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'es-AR'`;
      await sql/*sql*/`ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS contact text NOT NULL DEFAULT 'unknown'`;
      await sql/*sql*/`ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS company text`;
      await sql/*sql*/`ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS tag_type text`;
      await sql/*sql*/`ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS volume integer`;
      await sql/*sql*/`ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS notes text`;
      await sql/*sql*/`ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new'`;
      await sql/*sql*/`ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web_bot'`;
      await sql/*sql*/`ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS assigned_to text`;
      await sql/*sql*/`ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_order_requests_status_created_at ON order_requests(status, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_order_requests_contact_created_at ON order_requests(contact, created_at DESC)`;
    })();
  }
  return orderRequestsSchemaReady;
}

export async function ensureCrmOpsSchema() {
  await ensureLeadsSchema();
  await Promise.all([ensureTicketsSchema(), ensureOrderRequestsSchema()]);
}

export async function ensureAlertsSchema() {
  if (!alertsSchemaReady) {
    alertsSchemaReady = (async () => {
      await ensureUuidExtensions();
      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS alert_rules (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
          type text NOT NULL,
          severity text NOT NULL DEFAULT 'high',
          threshold numeric NOT NULL DEFAULT 1,
          window_minutes integer NOT NULL DEFAULT 60,
          enabled boolean NOT NULL DEFAULT true,
          config jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (tenant_id, type)
        )
      `;
      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS security_alerts (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
          event_id bigint REFERENCES events(id) ON DELETE SET NULL,
          rule_id uuid REFERENCES alert_rules(id) ON DELETE SET NULL,
          type text NOT NULL,
          severity text NOT NULL,
          status text NOT NULL DEFAULT 'open',
          title text NOT NULL,
          details jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          acknowledged_at timestamptz,
          acknowledged_by text,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql/*sql*/`ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE`;
      await sql/*sql*/`ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'invalid_rate'`;
      await sql/*sql*/`ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'high'`;
      await sql/*sql*/`ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS threshold numeric NOT NULL DEFAULT 1`;
      await sql/*sql*/`ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS window_minutes integer NOT NULL DEFAULT 60`;
      await sql/*sql*/`ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true`;
      await sql/*sql*/`ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb`;
      await sql/*sql*/`ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;
      await sql/*sql*/`ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open'`;
      await sql/*sql*/`ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz`;
      await sql/*sql*/`ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS acknowledged_by text`;
      await sql/*sql*/`ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_security_alerts_tenant_created ON security_alerts(tenant_id, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(status, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(type, created_at DESC)`;
    })();
  }
  return alertsSchemaReady;
}

export async function ensureEnterpriseIamSchema() {
  if (!enterpriseIamSchemaReady) {
    enterpriseIamSchemaReady = (async () => {
      await ensureUuidExtensions();
      await sql/*sql*/`DO $$ BEGIN CREATE TYPE membership_role AS ENUM ('super_admin', 'tenant_admin', 'reseller', 'viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
      await sql/*sql*/`DO $$ BEGIN CREATE TYPE admin_user_status AS ENUM ('invited', 'pending_activation', 'active', 'disabled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS users (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          email text NOT NULL UNIQUE,
          full_name text,
          locale text NOT NULL DEFAULT 'es-AR',
          admin_status text NOT NULL DEFAULT 'active',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql/*sql*/`ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name text`;
      await sql/*sql*/`ALTER TABLE users ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'es-AR'`;
      await sql/*sql*/`ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_status text NOT NULL DEFAULT 'active'`;
      await sql/*sql*/`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS password_credentials (
          user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          password_hash text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql/*sql*/`ALTER TABLE password_credentials ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS memberships (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
          role membership_role NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE(user_id, tenant_id, role)
        )
      `;
      await sql/*sql*/`ALTER TABLE memberships ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS auth_sessions (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          session_token_hash text NOT NULL UNIQUE,
          role membership_role NOT NULL,
          tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
          permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
          mfa_verified boolean NOT NULL DEFAULT false,
          last_seen_at timestamptz NOT NULL DEFAULT now(),
          expires_at timestamptz NOT NULL,
          revoked_at timestamptz,
          rotated_from uuid REFERENCES auth_sessions(id) ON DELETE SET NULL,
          created_ip inet,
          user_agent text,
          meta jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash text NOT NULL UNIQUE,
          expires_at timestamptz NOT NULL,
          consumed_at timestamptz,
          created_ip inet,
          user_agent text,
          meta jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS user_invites (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          email text NOT NULL,
          role membership_role NOT NULL DEFAULT 'viewer',
          tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
          permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
          invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
          token_hash text NOT NULL UNIQUE,
          expires_at timestamptz NOT NULL,
          consumed_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql/*sql*/`ALTER TABLE user_invites ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '[]'::jsonb`;
      await sql/*sql*/`ALTER TABLE user_invites ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES users(id) ON DELETE SET NULL`;
      await sql/*sql*/`ALTER TABLE user_invites ADD COLUMN IF NOT EXISTS consumed_at timestamptz`;
      await sql/*sql*/`ALTER TABLE user_invites ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS access_requests (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          email text NOT NULL,
          full_name text,
          company text,
          tenant_slug text,
          role_requested text NOT NULL DEFAULT 'tenant_admin',
          status text NOT NULL DEFAULT 'new',
          meta jsonb NOT NULL DEFAULT '{}'::jsonb,
          reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
          reviewed_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql/*sql*/`ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new'`;
      await sql/*sql*/`ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL`;
      await sql/*sql*/`ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS reviewed_at timestamptz`;
      await sql/*sql*/`ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS user_mfa_factors (
          user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          secret text NOT NULL,
          recovery_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
          enabled_at timestamptz NOT NULL DEFAULT now(),
          last_verified_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql/*sql*/`ALTER TABLE user_mfa_factors ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE`;
      await sql/*sql*/`ALTER TABLE user_mfa_factors ADD COLUMN IF NOT EXISTS recovery_codes jsonb NOT NULL DEFAULT '[]'::jsonb`;
      await sql/*sql*/`ALTER TABLE user_mfa_factors ADD COLUMN IF NOT EXISTS enabled_at timestamptz NOT NULL DEFAULT now()`;
      await sql/*sql*/`ALTER TABLE user_mfa_factors ADD COLUMN IF NOT EXISTS last_verified_at timestamptz`;
      await sql/*sql*/`ALTER TABLE user_mfa_factors ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS resource_permissions (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          resource text NOT NULL,
          action text NOT NULL,
          effect text NOT NULL DEFAULT 'allow',
          created_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE(user_id, resource, action, effect)
        )
      `;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS user_auth_events (
          id bigserial PRIMARY KEY,
          email text NOT NULL,
          event_name text NOT NULL,
          ok boolean NOT NULL DEFAULT false,
          role text,
          ip inet,
          user_agent text,
          meta jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;

      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON memberships(tenant_id)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_auth_sessions_active ON auth_sessions(user_id, revoked_at, expires_at)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_user_invites_email_created ON user_invites(email, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_access_requests_status_created ON access_requests(status, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_resource_permissions_user ON resource_permissions(user_id, resource)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_user_auth_events_email_created ON user_auth_events(email, created_at DESC)`;
    })();
  }
  return enterpriseIamSchemaReady;
}

export async function ensureConsumerPortalSchema() {
  if (!portalSchemaReady) {
    portalSchemaReady = (async () => {
      await ensureConsumerAuthSchema();
      await ensureLoyaltySchema();
      await sql/*sql*/`DO $$ BEGIN CREATE TYPE tenant_membership_status AS ENUM ('invited', 'active', 'paused', 'blocked', 'left'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
      await sql/*sql*/`DO $$ BEGIN CREATE TYPE marketplace_visibility AS ENUM ('tenant_members_only', 'verified_tappers', 'nexid_network', 'invited_segment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
      await sql/*sql*/`DO $$ BEGIN CREATE TYPE consumer_reward_claim_status AS ENUM ('claimed', 'redeemed', 'cancelled', 'expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`;

      await sql/*sql*/`
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
        )
      `;
      await sql/*sql*/`CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_consumer_memberships_tenant_consumer ON tenant_consumer_memberships(tenant_id, consumer_id)`;

      await sql/*sql*/`
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
        )
      `;

      await sql/*sql*/`
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
        )
      `;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_consumer_products_consumer ON consumer_products(consumer_id, updated_at DESC)`;

      await sql/*sql*/`
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
        )
      `;
      await sql/*sql*/`CREATE UNIQUE INDEX IF NOT EXISTS uq_consumer_tap_history_consumer_event ON consumer_tap_history(consumer_id, tap_event_id)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_consumer_tap_history_consumer ON consumer_tap_history(consumer_id, created_at DESC)`;

      await sql/*sql*/`
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
        )
      `;
      await sql/*sql*/`CREATE UNIQUE INDEX IF NOT EXISTS uq_consumer_product_ownerships_consumer_event ON consumer_product_ownerships(consumer_id, event_id)`;
      await sql/*sql*/`CREATE UNIQUE INDEX IF NOT EXISTS uq_consumer_product_ownerships_active_uid ON consumer_product_ownerships(tenant_id, uid_hex) WHERE status = 'claimed'`;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS consumer_reward_wallets (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          consumer_id uuid NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
          tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
          network_scope text NOT NULL DEFAULT 'tenant',
          points_balance integer NOT NULL DEFAULT 0,
          lifetime_points integer NOT NULL DEFAULT 0,
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE(consumer_id, tenant_id, network_scope)
        )
      `;

      await sql/*sql*/`
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
        )
      `;

      await sql/*sql*/`
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
        )
      `;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_consumer_reward_claims_consumer ON consumer_reward_claims(consumer_id, created_at DESC)`;

      await sql/*sql*/`
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
        )
      `;

      await sql/*sql*/`
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
        )
      `;

      await sql/*sql*/`
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
        )
      `;

      await sql/*sql*/`
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
        )
      `;

      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_marketplace_products_tenant ON marketplace_products(tenant_id, status)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_marketplace_order_requests_tenant ON marketplace_order_requests(tenant_id, created_at DESC)`;

      await seedDemoMarketplaceRows();
    })();
  }
  return portalSchemaReady;
}

async function seedDemoMarketplaceRows() {
  await sql/*sql*/`
    INSERT INTO marketplace_brand_profiles (tenant_id, status, display_name, slug, vertical, description, country, city, visible_in_network, featured)
    SELECT t.id, 'active', 'Demo Bodega', t.slug, 'winery', 'Bodega piloto con productos NFC verificados, ownership y marketplace.', 'AR', 'Mendoza', true, true
    FROM tenants t
    WHERE t.slug = 'demobodega'
    ON CONFLICT (tenant_id) DO UPDATE SET
      status = 'active',
      display_name = EXCLUDED.display_name,
      visible_in_network = true,
      featured = true,
      updated_at = now()
  `;

  await sql/*sql*/`
    WITH seed(slug, title, description, vertical, category, age_gate_required) AS (
      VALUES
        ('demobodega', 'Gran Reserva Malbec - club release', 'Compra asistida y club premium para botella verificada con NTAG 424 DNA TT.', 'winery', 'wine', true)
    )
    INSERT INTO marketplace_products (tenant_id, status, title, description, vertical, category, request_to_buy_enabled, accepts_tenant_points, age_gate_required, featured)
    SELECT t.id, 'active', s.title, s.description, s.vertical, s.category, true, true, s.age_gate_required, true
    FROM tenants t
    JOIN seed s ON s.slug = t.slug
    WHERE NOT EXISTS (
      SELECT 1 FROM marketplace_products p
      WHERE p.tenant_id = t.id AND p.title = s.title
    )
  `;
}
