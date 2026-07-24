import { sql } from "./db";
import { ensureLoyaltySchema } from "./loyalty-schema";
import { CARRIER_PROFILES } from "./carrier-profiles";

let authSchemaReady: Promise<void> | null = null;
let portalSchemaReady: Promise<void> | null = null;
let leadsSchemaReady: Promise<void> | null = null;
let ticketsSchemaReady: Promise<void> | null = null;
let orderRequestsSchemaReady: Promise<void> | null = null;
let alertsSchemaReady: Promise<void> | null = null;
let enterpriseIamSchemaReady: Promise<void> | null = null;
let carrierProfilesSchemaReady: Promise<void> | null = null;
let sdkSchemaReady: Promise<void> | null = null;
let auditLogsSchemaReady: Promise<void> | null = null;

async function ensureUuidExtensions() {
  await sql/*sql*/`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  await sql/*sql*/`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
}

function cacheSchemaInit(task: () => Promise<void>, reset: () => void) {
  return task().catch((error) => {
    reset();
    throw error;
  });
}

function isConcurrentSchemaCreateError(error: unknown) {
  const err = error as { code?: string; detail?: string; message?: string };
  const text = `${err?.detail || ""} ${err?.message || ""}`.toLowerCase();
  return (
    err?.code === "42P07" ||
    err?.code === "42710" ||
    (err?.code === "23505" && text.includes("pg_type_typname_nsp_index"))
  );
}

async function tolerateConcurrentSchemaCreate(task: () => Promise<unknown>) {
  try {
    await task();
  } catch (error) {
    if (!isConcurrentSchemaCreateError(error)) throw error;
  }
}

export async function ensureConsumerAuthSchema() {
  if (!authSchemaReady) {
    authSchemaReady = cacheSchemaInit(async () => {
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
          wallet_address text,
          wallet_chain_id text,
          wallet_network text,
          wallet_verified_at timestamptz,
          status consumer_status NOT NULL DEFAULT 'anonymous',
          last_login_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql/*sql*/`CREATE UNIQUE INDEX IF NOT EXISTS uq_consumers_phone ON consumers(phone) WHERE phone IS NOT NULL`;
      await sql/*sql*/`ALTER TABLE consumers ADD COLUMN IF NOT EXISTS wallet_address text`;
      await sql/*sql*/`ALTER TABLE consumers ADD COLUMN IF NOT EXISTS wallet_chain_id text`;
      await sql/*sql*/`ALTER TABLE consumers ADD COLUMN IF NOT EXISTS wallet_network text`;
      await sql/*sql*/`ALTER TABLE consumers ADD COLUMN IF NOT EXISTS wallet_verified_at timestamptz`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_consumers_wallet_address ON consumers(lower(wallet_address)) WHERE wallet_address IS NOT NULL`;

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
        CREATE TABLE IF NOT EXISTS consumer_wallet_challenges (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          consumer_id uuid NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
          wallet_address text NOT NULL,
          chain_id text NOT NULL,
          wallet_network text NOT NULL,
          wallet_provider text NOT NULL DEFAULT 'wallet_evm',
          message text NOT NULL,
          message_hash text NOT NULL,
          signature_hash text,
          expires_at timestamptz NOT NULL,
          used_at timestamptz,
          attempt_count integer NOT NULL DEFAULT 0,
          max_attempts integer NOT NULL DEFAULT 5,
          user_agent_hash text,
          ip_hash text,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_consumer_wallet_challenges_active ON consumer_wallet_challenges(consumer_id, created_at DESC) WHERE used_at IS NULL`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_consumer_wallet_challenges_expiry ON consumer_wallet_challenges(expires_at) WHERE used_at IS NULL`;

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
      await sql/*sql*/`ALTER TABLE consumer_auth_challenges ADD COLUMN IF NOT EXISTS magic_token_hash text`;
      await sql/*sql*/`ALTER TABLE consumer_auth_challenges ADD COLUMN IF NOT EXISTS used_at timestamptz`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_consumer_auth_challenges_contact_created_at ON consumer_auth_challenges(contact, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_consumer_auth_challenges_magic_token ON consumer_auth_challenges(magic_token_hash, created_at DESC)`;
    }, () => {
      authSchemaReady = null;
    });
  }
  return authSchemaReady;
}

export async function ensureLeadsSchema() {
  if (!leadsSchemaReady) {
    leadsSchemaReady = cacheSchemaInit(async () => {
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
          tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
          meta jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql/*sql*/`ALTER TABLE leads ADD COLUMN IF NOT EXISTS name text`;
      await sql/*sql*/`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email text`;
      await sql/*sql*/`ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone text`;
      await sql/*sql*/`ALTER TABLE leads ADD COLUMN IF NOT EXISTS role_interest text`;
      await sql/*sql*/`ALTER TABLE leads ADD COLUMN IF NOT EXISTS estimated_volume text`;
      await sql/*sql*/`ALTER TABLE leads ADD COLUMN IF NOT EXISTS message text`;
      await sql/*sql*/`ALTER TABLE leads ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL`;
      await sql/*sql*/`ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_leads_source_created_at ON leads(source, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_leads_status_created_at ON leads(status, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_leads_tenant_created_at ON leads(tenant_id, created_at DESC)`;
    }, () => {
      leadsSchemaReady = null;
    });
  }
  return leadsSchemaReady;
}

export async function ensureTicketsSchema() {
  if (!ticketsSchemaReady) {
    ticketsSchemaReady = cacheSchemaInit(async () => {
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
    }, () => {
      ticketsSchemaReady = null;
    });
  }
  return ticketsSchemaReady;
}

export async function ensureOrderRequestsSchema() {
  if (!orderRequestsSchemaReady) {
    orderRequestsSchemaReady = cacheSchemaInit(async () => {
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
    }, () => {
      orderRequestsSchemaReady = null;
    });
  }
  return orderRequestsSchemaReady;
}

export async function ensureCrmOpsSchema() {
  await ensureLeadsSchema();
  await Promise.all([ensureTicketsSchema(), ensureOrderRequestsSchema()]);
}

export async function ensureCarrierProfileSchema() {
  if (!carrierProfilesSchemaReady) {
    carrierProfilesSchemaReady = cacheSchemaInit(async () => {
      await ensureUuidExtensions();
      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS carrier_profiles (
          code text PRIMARY KEY,
          label text NOT NULL,
          family text NOT NULL CHECK (family IN ('qr', 'gs1', 'nfc', 'rfid', 'iot')),
          security_level integer NOT NULL DEFAULT 1,
          cost_band text NOT NULL DEFAULT 'entry',
          estimated_unit_cost_usd_min numeric(10,4),
          estimated_unit_cost_usd_max numeric(10,4),
          capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
          recommended_verticals jsonb NOT NULL DEFAULT '[]'::jsonb,
          allowed_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
          blocked_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
          consumer_copy jsonb NOT NULL DEFAULT '{}'::jsonb,
          admin_copy jsonb NOT NULL DEFAULT '{}'::jsonb,
          default_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS tenant_carrier_policies (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          carrier_profile_code text NOT NULL REFERENCES carrier_profiles(code) ON DELETE RESTRICT,
          vertical text NOT NULL DEFAULT 'default',
          enabled boolean NOT NULL DEFAULT true,
          claim_mode text NOT NULL DEFAULT 'verified_purchase',
          tokenization_mode text NOT NULL DEFAULT 'request_only',
          requires_fresh_tap boolean NOT NULL DEFAULT true,
          requires_purchase_proof boolean NOT NULL DEFAULT true,
          allowed_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
          blocked_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
          notes text,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (tenant_id, carrier_profile_code, vertical)
        )
      `;
      await sql/*sql*/`ALTER TABLE batches ADD COLUMN IF NOT EXISTS carrier_profile_code text`;
      await sql/*sql*/`ALTER TABLE tags ADD COLUMN IF NOT EXISTS carrier_profile_code text`;
      await sql/*sql*/`ALTER TABLE tenant_manifests ADD COLUMN IF NOT EXISTS carrier_profile_code text`;
      await sql/*sql*/`ALTER TABLE tag_profiles ADD COLUMN IF NOT EXISTS carrier_profile_code text`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_batches_carrier_profile ON batches(carrier_profile_code)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_tags_carrier_profile ON tags(carrier_profile_code)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_tenant_manifests_carrier_profile ON tenant_manifests(carrier_profile_code)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_tag_profiles_carrier_profile ON tag_profiles(carrier_profile_code)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_tenant_carrier_policies_tenant ON tenant_carrier_policies(tenant_id, enabled)`;

      for (const profile of CARRIER_PROFILES) {
        await sql/*sql*/`
          INSERT INTO carrier_profiles (
            code,
            label,
            family,
            security_level,
            cost_band,
            estimated_unit_cost_usd_min,
            estimated_unit_cost_usd_max,
            capabilities,
            recommended_verticals,
            allowed_actions,
            blocked_actions,
            consumer_copy,
            admin_copy,
            default_policy
          ) VALUES (
            ${profile.code},
            ${profile.label},
            ${profile.family},
            ${profile.securityLevel},
            ${profile.costBand},
            ${profile.estimatedUnitCostUsdMin},
            ${profile.estimatedUnitCostUsdMax},
            ${JSON.stringify(profile.capabilities)}::jsonb,
            ${JSON.stringify(profile.recommendedVerticals)}::jsonb,
            ${JSON.stringify(profile.allowedActions)}::jsonb,
            ${JSON.stringify(profile.blockedActions)}::jsonb,
            ${JSON.stringify(profile.consumerCopy)}::jsonb,
            ${JSON.stringify(profile.adminCopy)}::jsonb,
            ${JSON.stringify(profile.defaultPolicy)}::jsonb
          )
          ON CONFLICT (code) DO UPDATE SET
            label = EXCLUDED.label,
            family = EXCLUDED.family,
            security_level = EXCLUDED.security_level,
            cost_band = EXCLUDED.cost_band,
            estimated_unit_cost_usd_min = EXCLUDED.estimated_unit_cost_usd_min,
            estimated_unit_cost_usd_max = EXCLUDED.estimated_unit_cost_usd_max,
            capabilities = EXCLUDED.capabilities,
            recommended_verticals = EXCLUDED.recommended_verticals,
            allowed_actions = EXCLUDED.allowed_actions,
            blocked_actions = EXCLUDED.blocked_actions,
            consumer_copy = EXCLUDED.consumer_copy,
            admin_copy = EXCLUDED.admin_copy,
            default_policy = EXCLUDED.default_policy,
            updated_at = now()
        `;
      }
    }, () => {
      carrierProfilesSchemaReady = null;
    });
  }
  return carrierProfilesSchemaReady;
}

export async function ensureSdkSchema() {
  if (!sdkSchemaReady) {
    sdkSchemaReady = cacheSchemaInit(async () => {
      await ensureUuidExtensions();
      await ensureLeadsSchema();
      await ensureCarrierProfileSchema();

      await tolerateConcurrentSchemaCreate(() => sql/*sql*/`
        CREATE TABLE IF NOT EXISTS tenant_api_keys (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          name text NOT NULL DEFAULT 'SDK key',
          key_prefix text NOT NULL,
          key_hash text NOT NULL UNIQUE,
          scopes jsonb NOT NULL DEFAULT '["sdk:verify","sdk:claim","sdk:products","sdk:events","sdk:pos","sdk:logistics"]'::jsonb,
          status text NOT NULL DEFAULT 'active',
          last_used_at timestamptz,
          expires_at timestamptz,
          metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await sql/*sql*/`ALTER TABLE tenant_api_keys ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE`;
      await sql/*sql*/`ALTER TABLE tenant_api_keys ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'SDK key'`;
      await sql/*sql*/`ALTER TABLE tenant_api_keys ADD COLUMN IF NOT EXISTS key_prefix text NOT NULL DEFAULT 'legacy'`;
      await sql/*sql*/`ALTER TABLE tenant_api_keys ADD COLUMN IF NOT EXISTS key_hash text`;
      await sql/*sql*/`ALTER TABLE tenant_api_keys ADD COLUMN IF NOT EXISTS scopes jsonb NOT NULL DEFAULT '["sdk:verify","sdk:claim","sdk:products","sdk:events","sdk:pos","sdk:logistics"]'::jsonb`;
      await sql/*sql*/`ALTER TABLE tenant_api_keys ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'`;
      await sql/*sql*/`ALTER TABLE tenant_api_keys ADD COLUMN IF NOT EXISTS last_used_at timestamptz`;
      await sql/*sql*/`ALTER TABLE tenant_api_keys ADD COLUMN IF NOT EXISTS expires_at timestamptz`;
      await sql/*sql*/`ALTER TABLE tenant_api_keys ADD COLUMN IF NOT EXISTS metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb`;
      await sql/*sql*/`ALTER TABLE tenant_api_keys ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()`;
      await sql/*sql*/`ALTER TABLE tenant_api_keys ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;
      await sql/*sql*/`CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_api_keys_hash ON tenant_api_keys(key_hash) WHERE key_hash IS NOT NULL`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_tenant_status ON tenant_api_keys(tenant_id, status)`;

      await sql/*sql*/`ALTER TABLE batches ADD COLUMN IF NOT EXISTS active_for_claim boolean NOT NULL DEFAULT false`;
      await sql/*sql*/`ALTER TABLE batches ADD COLUMN IF NOT EXISTS claim_pin_required boolean NOT NULL DEFAULT false`;
      await sql/*sql*/`ALTER TABLE batches ADD COLUMN IF NOT EXISTS hash_pin text`;
      await sql/*sql*/`ALTER TABLE tags ADD COLUMN IF NOT EXISTS active_for_claim boolean`;
      await sql/*sql*/`ALTER TABLE tags ADD COLUMN IF NOT EXISTS claim_pin_required boolean`;
      await sql/*sql*/`ALTER TABLE tags ADD COLUMN IF NOT EXISTS hash_pin text`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_batches_claim_activation ON batches(tenant_id, bid, active_for_claim)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_tags_claim_activation ON tags(batch_id, uid_hex, active_for_claim)`;

      await tolerateConcurrentSchemaCreate(() => sql/*sql*/`
        CREATE TABLE IF NOT EXISTS sdk_usage_logs (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
          api_key_id uuid REFERENCES tenant_api_keys(id) ON DELETE SET NULL,
          endpoint text NOT NULL,
          status_code integer NOT NULL,
          latency_ms integer NOT NULL DEFAULT 0,
          ip_address text,
          ip_country text,
          reason text,
          trace_id text,
          meta jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_sdk_usage_logs_tenant_created ON sdk_usage_logs(tenant_id, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_sdk_usage_logs_api_key_created ON sdk_usage_logs(api_key_id, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_sdk_usage_logs_endpoint_created ON sdk_usage_logs(endpoint, created_at DESC)`;

      await tolerateConcurrentSchemaCreate(() => sql/*sql*/`
        CREATE TABLE IF NOT EXISTS sdk_pos_activations (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          api_key_id uuid REFERENCES tenant_api_keys(id) ON DELETE SET NULL,
          batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
          tag_id uuid REFERENCES tags(id) ON DELETE SET NULL,
          bid text NOT NULL,
          uid_hex text,
          pos_token_prefix text NOT NULL,
          pos_token_hash text NOT NULL UNIQUE,
          external_order_id text,
          retailer_id text,
          contact text,
          activation_status text NOT NULL DEFAULT 'active',
          expires_at timestamptz,
          used_at timestamptz,
          claim_request_id uuid,
          meta jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_sdk_pos_activations_tenant_created ON sdk_pos_activations(tenant_id, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_sdk_pos_activations_bid_uid ON sdk_pos_activations(bid, uid_hex)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_sdk_pos_activations_status_expiry ON sdk_pos_activations(activation_status, expires_at)`;

      await tolerateConcurrentSchemaCreate(() => sql/*sql*/`
        CREATE TABLE IF NOT EXISTS sdk_claim_requests (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          api_key_id uuid REFERENCES tenant_api_keys(id) ON DELETE SET NULL,
          lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
          batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
          tag_id uuid REFERENCES tags(id) ON DELETE SET NULL,
          bid text NOT NULL,
          uid_hex text,
          contact text NOT NULL,
          name text,
          claim_status text NOT NULL DEFAULT 'pending_verification',
          pin_validated boolean NOT NULL DEFAULT false,
          active_for_claim boolean NOT NULL DEFAULT false,
          pos_activation_id uuid REFERENCES sdk_pos_activations(id) ON DELETE SET NULL,
          pos_validated boolean NOT NULL DEFAULT false,
          carrier_profile_code text,
          token_id text,
          tx_hash text,
          meta jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await sql/*sql*/`ALTER TABLE sdk_claim_requests ADD COLUMN IF NOT EXISTS api_key_id uuid REFERENCES tenant_api_keys(id) ON DELETE SET NULL`;
      await sql/*sql*/`ALTER TABLE sdk_claim_requests ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE SET NULL`;
      await sql/*sql*/`ALTER TABLE sdk_claim_requests ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES batches(id) ON DELETE SET NULL`;
      await sql/*sql*/`ALTER TABLE sdk_claim_requests ADD COLUMN IF NOT EXISTS tag_id uuid REFERENCES tags(id) ON DELETE SET NULL`;
      await sql/*sql*/`ALTER TABLE sdk_claim_requests ADD COLUMN IF NOT EXISTS claim_status text NOT NULL DEFAULT 'pending_verification'`;
      await sql/*sql*/`ALTER TABLE sdk_claim_requests ADD COLUMN IF NOT EXISTS pin_validated boolean NOT NULL DEFAULT false`;
      await sql/*sql*/`ALTER TABLE sdk_claim_requests ADD COLUMN IF NOT EXISTS active_for_claim boolean NOT NULL DEFAULT false`;
      await sql/*sql*/`ALTER TABLE sdk_claim_requests ADD COLUMN IF NOT EXISTS pos_activation_id uuid REFERENCES sdk_pos_activations(id) ON DELETE SET NULL`;
      await sql/*sql*/`ALTER TABLE sdk_claim_requests ADD COLUMN IF NOT EXISTS pos_validated boolean NOT NULL DEFAULT false`;
      await sql/*sql*/`ALTER TABLE sdk_claim_requests ADD COLUMN IF NOT EXISTS carrier_profile_code text`;
      await sql/*sql*/`ALTER TABLE sdk_claim_requests ADD COLUMN IF NOT EXISTS token_id text`;
      await sql/*sql*/`ALTER TABLE sdk_claim_requests ADD COLUMN IF NOT EXISTS tx_hash text`;
      await sql/*sql*/`ALTER TABLE sdk_claim_requests ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_sdk_claim_requests_tenant_created ON sdk_claim_requests(tenant_id, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_sdk_claim_requests_bid_uid ON sdk_claim_requests(bid, uid_hex)`;

      await tolerateConcurrentSchemaCreate(() => sql/*sql*/`
        CREATE TABLE IF NOT EXISTS sdk_external_events (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          api_key_id uuid REFERENCES tenant_api_keys(id) ON DELETE SET NULL,
          batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
          tag_id uuid REFERENCES tags(id) ON DELETE SET NULL,
          bid text,
          uid_hex text,
          event_type text NOT NULL,
          source text NOT NULL DEFAULT 'sdk',
          occurred_at timestamptz,
          data jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_sdk_external_events_tenant_created ON sdk_external_events(tenant_id, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_sdk_external_events_type_created ON sdk_external_events(event_type, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_sdk_external_events_bid_uid ON sdk_external_events(bid, uid_hex)`;

      await tolerateConcurrentSchemaCreate(() => sql/*sql*/`
        CREATE TABLE IF NOT EXISTS webhook_endpoints (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          name text NOT NULL DEFAULT 'Webhook',
          url text NOT NULL,
          signing_secret text,
          enabled boolean NOT NULL DEFAULT false,
          events jsonb NOT NULL DEFAULT '["sdk.verify","sdk.claim.created","sdk.external_event"]'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (tenant_id, url)
        )
      `);
      await sql/*sql*/`ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Webhook'`;
      await sql/*sql*/`ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS signing_secret text`;
      await sql/*sql*/`ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false`;
      await sql/*sql*/`ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS events jsonb NOT NULL DEFAULT '["sdk.verify","sdk.claim.created","sdk.external_event"]'::jsonb`;
      await sql/*sql*/`ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()`;
      await sql/*sql*/`ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_tenant_enabled ON webhook_endpoints(tenant_id, enabled)`;

      await tolerateConcurrentSchemaCreate(() => sql/*sql*/`
        CREATE TABLE IF NOT EXISTS webhook_deliveries (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          endpoint_id uuid NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
          endpoint_url text NOT NULL,
          event_id text NOT NULL,
          event_name text NOT NULL,
          payload jsonb NOT NULL DEFAULT '{}'::jsonb,
          status text NOT NULL DEFAULT 'pending',
          status_code integer,
          ok boolean NOT NULL DEFAULT false,
          attempt_count integer NOT NULL DEFAULT 0,
          next_attempt_at timestamptz DEFAULT now(),
          last_attempt_at timestamptz,
          locked_at timestamptz,
          lock_token text,
          last_error text,
          created_at timestamptz NOT NULL DEFAULT now(),
          delivered_at timestamptz,
          UNIQUE (endpoint_id, event_id)
        )
      `);
      await sql/*sql*/`ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS endpoint_url text`;
      await sql/*sql*/`ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS event_id text`;
      await sql/*sql*/`ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb`;
      await sql/*sql*/`ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'`;
      await sql/*sql*/`ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS status_code integer`;
      await sql/*sql*/`ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS ok boolean NOT NULL DEFAULT false`;
      await sql/*sql*/`ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0`;
      await sql/*sql*/`ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz`;
      await sql/*sql*/`ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz`;
      await sql/*sql*/`ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS locked_at timestamptz`;
      await sql/*sql*/`ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS lock_token text`;
      await sql/*sql*/`ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS last_error text`;
      await sql/*sql*/`ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS delivered_at timestamptz`;
      await sql/*sql*/`
        UPDATE webhook_deliveries wd
        SET endpoint_url = we.url
        FROM webhook_endpoints we
        WHERE wd.endpoint_id = we.id
          AND NULLIF(wd.endpoint_url, '') IS NULL
      `;
      await sql/*sql*/`
        UPDATE webhook_deliveries
        SET event_id = COALESCE(NULLIF(payload->>'id', ''), 'legacy:' || id::text),
            status = CASE WHEN ok THEN 'delivered' ELSE 'dead_letter' END
        WHERE NULLIF(event_id, '') IS NULL
      `;
      await sql/*sql*/`CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_deliveries_endpoint_event ON webhook_deliveries(endpoint_id, event_id)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_due ON webhook_deliveries(status, next_attempt_at, created_at) WHERE status IN ('pending', 'retry_scheduled', 'processing')`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint_created ON webhook_deliveries(endpoint_id, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event_created ON webhook_deliveries(event_name, created_at DESC)`;
    }, () => {
      sdkSchemaReady = null;
    });
  }
  return sdkSchemaReady;
}

export async function ensureAlertsSchema() {
  if (!alertsSchemaReady) {
    alertsSchemaReady = cacheSchemaInit(async () => {
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
    }, () => {
      alertsSchemaReady = null;
    });
  }
  return alertsSchemaReady;
}

export async function ensureEnterpriseIamSchema() {
  if (!enterpriseIamSchemaReady) {
    enterpriseIamSchemaReady = cacheSchemaInit(async () => {
      await ensureUuidExtensions();
      await ensureAuditLogsSchema();
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

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS admin_login_attempt_buckets (
          bucket_kind text NOT NULL,
          bucket_key text NOT NULL,
          window_started_at timestamptz NOT NULL DEFAULT now(),
          attempt_count integer NOT NULL DEFAULT 0,
          blocked_until timestamptz,
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (bucket_kind, bucket_key),
          CONSTRAINT admin_login_attempt_buckets_kind_check
            CHECK (bucket_kind IN ('source', 'source_subject')),
          CONSTRAINT admin_login_attempt_buckets_key_check
            CHECK (bucket_key ~ '^[0-9a-f]{64}$'),
          CONSTRAINT admin_login_attempt_buckets_count_check
            CHECK (attempt_count >= 0)
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
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_admin_login_attempt_buckets_updated ON admin_login_attempt_buckets(updated_at)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_admin_login_attempt_buckets_blocked ON admin_login_attempt_buckets(blocked_until) WHERE blocked_until IS NOT NULL`;
    }, () => {
      enterpriseIamSchemaReady = null;
    });
  }
  return enterpriseIamSchemaReady;
}

export async function ensureConsumerPortalSchema() {
  if (!portalSchemaReady) {
    portalSchemaReady = cacheSchemaInit(async () => {
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
        CREATE TABLE IF NOT EXISTS consumer_product_experiences (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          consumer_id uuid NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
          ownership_id uuid REFERENCES consumer_product_ownerships(id) ON DELETE SET NULL,
          event_id bigint REFERENCES events(id) ON DELETE SET NULL,
          uid_hex text,
          product_name text NOT NULL DEFAULT 'Producto verificado',
          rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
          title text,
          body text NOT NULL,
          original_locale text NOT NULL DEFAULT 'es-AR',
          country text,
          city text,
          photo_urls_json jsonb NOT NULL DEFAULT '[]'::jsonb,
          verification_badges_json jsonb NOT NULL DEFAULT '[]'::jsonb,
          trust_score integer NOT NULL DEFAULT 0 CHECK (trust_score BETWEEN 0 AND 100),
          moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'needs_brand_response', 'private')),
          visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'tenant', 'public')),
          brand_response text,
          translation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_consumer_product_experiences_tenant_status ON consumer_product_experiences(tenant_id, moderation_status, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_consumer_product_experiences_consumer ON consumer_product_experiences(consumer_id, created_at DESC)`;
      await sql/*sql*/`CREATE UNIQUE INDEX IF NOT EXISTS uq_consumer_product_experiences_ownership ON consumer_product_experiences(consumer_id, ownership_id) WHERE ownership_id IS NOT NULL`;

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
      await sql/*sql*/`ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS image_url text`;
      await sql/*sql*/`ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS price_amount numeric(12,2)`;
      await sql/*sql*/`ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS price_currency text`;
      await sql/*sql*/`ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS external_checkout_url text`;
      await sql/*sql*/`ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS request_to_buy_enabled boolean NOT NULL DEFAULT true`;
      await sql/*sql*/`ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS accepts_rewards boolean NOT NULL DEFAULT true`;
      await sql/*sql*/`ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS accepts_tenant_points boolean NOT NULL DEFAULT true`;
      await sql/*sql*/`ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS accepts_network_credits boolean NOT NULL DEFAULT false`;
      await sql/*sql*/`ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS age_gate_required boolean NOT NULL DEFAULT false`;
      await sql/*sql*/`ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS authenticity_program_badge boolean NOT NULL DEFAULT true`;
      await sql/*sql*/`ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false`;
      await sql/*sql*/`ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS country_availability_json jsonb NOT NULL DEFAULT '[]'::jsonb`;

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
      await sql/*sql*/`ALTER TABLE marketplace_offers ADD COLUMN IF NOT EXISTS eligibility_json jsonb NOT NULL DEFAULT '{}'::jsonb`;

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

      await sql/*sql*/`ALTER TABLE marketplace_order_requests ADD COLUMN IF NOT EXISTS source_uid_hex text`;
      await sql/*sql*/`ALTER TABLE marketplace_order_requests ADD COLUMN IF NOT EXISTS source_batch_id uuid`;
      await sql/*sql*/`ALTER TABLE marketplace_order_requests ADD COLUMN IF NOT EXISTS source_bid text`;
      await sql/*sql*/`ALTER TABLE marketplace_order_requests ADD COLUMN IF NOT EXISTS source_context_json jsonb NOT NULL DEFAULT '{}'::jsonb`;
      
      await sql/*sql*/`ALTER TABLE marketplace_offers ADD COLUMN IF NOT EXISTS seller_consumer_id uuid REFERENCES consumers(id) ON DELETE CASCADE`;
      await sql/*sql*/`ALTER TABLE marketplace_offers ADD COLUMN IF NOT EXISTS resale_price numeric(12,2)`;
      await sql/*sql*/`ALTER TABLE marketplace_offers ADD COLUMN IF NOT EXISTS resale_currency text`;
      await sql/*sql*/`ALTER TABLE marketplace_offers ADD COLUMN IF NOT EXISTS resale_uid_hex text`;
      
      await sql/*sql*/`ALTER TABLE marketplace_order_requests ADD COLUMN IF NOT EXISTS fee_amount numeric(12,2)`;
      await sql/*sql*/`ALTER TABLE marketplace_order_requests ADD COLUMN IF NOT EXISTS fee_currency text`;

      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_marketplace_products_tenant ON marketplace_products(tenant_id, status)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_marketplace_order_requests_tenant ON marketplace_order_requests(tenant_id, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_marketplace_order_requests_consumer_product_status ON marketplace_order_requests(consumer_id, marketplace_product_id, status, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_marketplace_order_requests_source_tap ON marketplace_order_requests(source_tap_event_id)`;

      await seedBalmecMarketplaceRows();
    }, () => {
      portalSchemaReady = null;
    });
  }
  return portalSchemaReady;
}

async function seedBalmecMarketplaceRows() {
  await sql/*sql*/`
    INSERT INTO marketplace_brand_profiles (tenant_id, status, display_name, slug, vertical, description, country, city, visible_in_network, featured)
    SELECT t.id, 'active', 'Bodega Balmec', t.slug, 'winery', 'Bodega premium con pasaporte NFC, club, experiencias y ventas asistidas.', 'AR', 'Mendoza', true, true
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
    INSERT INTO loyalty_programs (tenant_id, name, vertical, status, mode, points_name, default_locale, age_gate_required, allow_experience_booking, rules_json)
    SELECT
      t.id,
      'Club Bodega Balmec',
      'winery',
      'active',
      'production',
      'Puntos',
      'es-AR',
      true,
      true,
      '{"pointsPerValidTap":20,"cooldownSeconds":900,"requestToBuyPoints":180,"ownershipRequires":"pos_pin_or_purchase_proof"}'::jsonb
    FROM tenants t
    WHERE t.slug = 'demobodega'
      AND NOT EXISTS (
        SELECT 1
        FROM loyalty_programs p
        WHERE p.tenant_id = t.id
          AND p.status = 'active'
      )
  `;

  await sql/*sql*/`
    WITH program AS (
      SELECT p.id AS program_id, p.tenant_id
      FROM loyalty_programs p
      JOIN tenants t ON t.id = p.tenant_id
      WHERE t.slug = 'demobodega'
        AND p.status = 'active'
      ORDER BY p.created_at DESC
      LIMIT 1
    ),
    seed(code, title, description, type, points_cost, stock_total, image_url, requires_age_gate, eligibility_json, fulfillment_json) AS (
      VALUES
        ('DB-TASTING-120', 'Cata express en bodega', 'Degustación guiada para conocer el lote y sumar al club después de un tap válido.', 'TASTING', 120, 120, '/images/wine_tasting.png', true, '{"requiresVerifiedTap":true}'::jsonb, '{"mode":"booking_request","channel":"tenant_crm"}'::jsonb),
        ('DB-TOUR-280', 'Paseo guiado por viñedo + copa', 'Reserva una visita guiada y conecta la experiencia física con el pasaporte digital.', 'TOUR', 280, 80, '/images/wine_tasting.png', true, '{"requiresVerifiedTap":true}'::jsonb, '{"mode":"booking_request","channel":"tenant_crm"}'::jsonb),
        ('DB-VIP-MONTH-520', 'Club VIP vendimia por 30 días', 'Acceso mensual a preventas, revista digital, descuentos y eventos privados.', 'VIP_ACCESS', 520, 250, '/images/premium_magnum.png', true, '{"requiresVerifiedTap":true,"requiresContact":true}'::jsonb, '{"mode":"manual_approval","channel":"tenant_crm"}'::jsonb),
        ('DB-BOX-900', 'Caja selección terroir', 'Caja curada para clientes verificados con trazabilidad del lote y atención comercial.', 'WINE_BOX', 900, 40, '/images/wine_crate.png', true, '{"requiresVerifiedTap":true,"requiresRequestToBuy":true}'::jsonb, '{"mode":"sales_request","channel":"tenant_crm"}'::jsonb),
        ('DB-DISCOUNT-90', '15% off en compra directa', 'Beneficio de primera compra para convertir interés de góndola en lead del tenant.', 'DISCOUNT', 90, 500, '/images/wine_crate.png', true, '{"requiresVerifiedTap":true,"requiresEmail":true}'::jsonb, '{"mode":"coupon","channel":"email"}'::jsonb)
    )
    INSERT INTO rewards (
      tenant_id,
      program_id,
      code,
      title,
      description,
      type,
      status,
      points_cost,
      stock_total,
      stock_remaining,
      image_url,
      requires_age_gate,
      network_visible,
      eligibility_json,
      fulfillment_json
    )
    SELECT
      program.tenant_id,
      program.program_id,
      seed.code,
      seed.title,
      seed.description,
      seed.type::reward_type,
      'active',
      seed.points_cost,
      seed.stock_total,
      seed.stock_total,
      seed.image_url,
      seed.requires_age_gate,
      true,
      seed.eligibility_json,
      seed.fulfillment_json
    FROM program
    CROSS JOIN seed
    ON CONFLICT (program_id, code) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      status = 'active',
      points_cost = EXCLUDED.points_cost,
      stock_total = EXCLUDED.stock_total,
      stock_remaining = GREATEST(COALESCE(rewards.stock_remaining, 0), EXCLUDED.stock_remaining),
      image_url = EXCLUDED.image_url,
      requires_age_gate = EXCLUDED.requires_age_gate,
      network_visible = true,
      eligibility_json = EXCLUDED.eligibility_json,
      fulfillment_json = EXCLUDED.fulfillment_json,
      updated_at = now()
  `;

  await sql/*sql*/`
    WITH seed(slug, title, description, vertical, category, image_url, price_amount, price_currency, age_gate_required, featured) AS (
      VALUES
        ('demobodega', 'Gran Reserva Malbec 2022', 'Compra asistida con tap verificado, puntos de club y seguimiento comercial desde CRM. Ownership se transfiere solo con pago y validación de la marca.', 'winery', 'wine', '/images/premium_magnum.png', 19500.00, 'ARS', true, true),
        ('demobodega', 'Cabernet Franc Reserva 2022', 'Compra asistida con tap verificado. Suma puntos, abre beneficios del club y deja lead comercial sin reclamar ownership automáticamente.', 'winery', 'wine', '/images/premium_magnum.png', 18500.00, 'ARS', true, true),
        ('demobodega', 'Chardonnay de Altura 2023', 'Vino de altura con lote trazable, recomendación gastronómica y venta asistida desde Passport.', 'winery', 'wine', '/images/premium_magnum.png', 16500.00, 'ARS', true, true),
        ('demobodega', 'Blend de Finca 2021', 'Edición de guarda para clientes verificados, con club, preventa y prueba de autenticidad NFC.', 'winery', 'wine', '/images/premium_magnum.png', 22000.00, 'ARS', true, false),
        ('demobodega', 'Aceite de Oliva Extra Virgen Arbequina', 'Aceite premium con procedencia de finca, lote trazable y cross-sell para visitantes de bodega.', 'gourmet', 'olive_oil', '/images/wine_crate.png', 14500.00, 'ARS', false, true),
        ('demobodega', 'Aceite de Oliva Blend de Finca', 'Blend gourmet para club de clientes, regalo corporativo y campañas post-tap.', 'gourmet', 'olive_oil', '/images/wine_crate.png', 12500.00, 'ARS', false, false),
        ('demobodega', 'Cata privada para dos', 'Experiencia guiada con reserva desde el portal del cliente y seguimiento en CRM de la marca.', 'winery', 'experience', '/images/wine_tasting.png', 32000.00, 'ARS', true, true),
        ('demobodega', 'Paseo guiado Valle de Uco', 'Tour de viñedo con copa incluida para clientes que dejaron contacto tras un tap real.', 'winery', 'experience', '/images/wine_tasting.png', 45000.00, 'ARS', true, true),
        ('demobodega', 'Club VIP Vendimia - 30 días', 'Acceso a preventas, revista, promociones por email y beneficios de temporada.', 'winery', 'membership', '/images/premium_magnum.png', 12000.00, 'ARS', true, true),
        ('demobodega', 'Caja selección Bodega Balmec', 'Caja curada con seguimiento por lote, promociones y postventa para miembros.', 'winery', 'wine_box', '/images/wine_crate.png', 69000.00, 'ARS', true, true)
    )
    INSERT INTO marketplace_products (
      tenant_id,
      status,
      title,
      description,
      vertical,
      category,
      image_url,
      price_amount,
      price_currency,
      request_to_buy_enabled,
      accepts_rewards,
      accepts_tenant_points,
      age_gate_required,
      authenticity_program_badge,
      featured,
      country_availability_json
    )
    SELECT
      t.id,
      'active',
      s.title,
      s.description,
      s.vertical,
      s.category,
      s.image_url,
      s.price_amount,
      s.price_currency,
      true,
      true,
      true,
      s.age_gate_required,
      true,
      s.featured,
      '["AR","UY","CL"]'::jsonb
    FROM tenants t
    JOIN seed s ON s.slug = t.slug
    WHERE NOT EXISTS (
      SELECT 1 FROM marketplace_products p
      WHERE p.tenant_id = t.id AND p.title = s.title
    )
  `;

  await sql/*sql*/`
    WITH seed(slug, title, description, image_url, price_amount, price_currency, age_gate_required, featured) AS (
      VALUES
        ('demobodega', 'Gran Reserva Malbec 2022', 'Compra asistida con tap verificado, puntos de club y seguimiento comercial desde CRM. Ownership se transfiere solo con pago y validación de la marca.', '/images/premium_magnum.png', 19500.00, 'ARS', true, true),
        ('demobodega', 'Cabernet Franc Reserva 2022', 'Compra asistida con tap verificado. Suma puntos, abre beneficios del club y deja lead comercial sin reclamar ownership automáticamente.', '/images/premium_magnum.png', 18500.00, 'ARS', true, true),
        ('demobodega', 'Chardonnay de Altura 2023', 'Vino de altura con lote trazable, recomendación gastronómica y venta asistida desde Passport.', '/images/premium_magnum.png', 16500.00, 'ARS', true, true),
        ('demobodega', 'Blend de Finca 2021', 'Edición de guarda para clientes verificados, con club, preventa y prueba de autenticidad NFC.', '/images/premium_magnum.png', 22000.00, 'ARS', true, false),
        ('demobodega', 'Aceite de Oliva Extra Virgen Arbequina', 'Aceite premium con procedencia de finca, lote trazable y cross-sell para visitantes de bodega.', '/images/wine_crate.png', 14500.00, 'ARS', false, true),
        ('demobodega', 'Aceite de Oliva Blend de Finca', 'Blend gourmet para club de clientes, regalo corporativo y campañas post-tap.', '/images/wine_crate.png', 12500.00, 'ARS', false, false),
        ('demobodega', 'Cata privada para dos', 'Experiencia guiada con reserva desde el portal del cliente y seguimiento en CRM de la marca.', '/images/wine_tasting.png', 32000.00, 'ARS', true, true),
        ('demobodega', 'Paseo guiado Valle de Uco', 'Tour de viñedo con copa incluida para clientes que dejaron contacto tras un tap real.', '/images/wine_tasting.png', 45000.00, 'ARS', true, true),
        ('demobodega', 'Club VIP Vendimia - 30 días', 'Acceso a preventas, revista, promociones por email y beneficios de temporada.', '/images/premium_magnum.png', 12000.00, 'ARS', true, true),
        ('demobodega', 'Caja selección Bodega Balmec', 'Caja curada con seguimiento por lote, promociones y postventa para miembros.', '/images/wine_crate.png', 69000.00, 'ARS', true, true),
        ('demobodega', 'Gran Reserva Malbec - club release', 'Oferta de club, puntos y venta asistida desde un tap válido.', '/images/premium_magnum.png', 19500.00, 'ARS', true, false)
    )
    UPDATE marketplace_products p
    SET
      description = s.description,
      image_url = s.image_url,
      price_amount = s.price_amount,
      price_currency = s.price_currency,
      request_to_buy_enabled = true,
      accepts_rewards = true,
      accepts_tenant_points = true,
      age_gate_required = s.age_gate_required,
      featured = s.featured,
      updated_at = now()
    FROM tenants t
    JOIN seed s ON s.slug = t.slug
    WHERE p.tenant_id = t.id
      AND p.title = s.title
  `;

  await sql/*sql*/`
    UPDATE marketplace_products p
    SET
      title = CASE
        WHEN p.title ILIKE 'Caja selecci%n%' THEN 'Caja selección Bodega Balmec'
        WHEN p.title ILIKE 'Club VIP Vendimia%' THEN 'Club VIP Vendimia - 30 días'
        WHEN p.title ILIKE '%' || 'Demo' || ' Bodega%' THEN replace(p.title, 'Demo' || ' Bodega', 'Bodega Balmec')
        WHEN p.title ILIKE '%' || 'Demo' || 'Bodega%' THEN replace(p.title, 'Demo' || 'Bodega', 'Bodega Balmec')
        ELSE p.title
      END,
      description = CASE
        WHEN p.description ILIKE '%' || 'Demo' || ' Bodega%' THEN replace(p.description, 'Demo' || ' Bodega', 'Bodega Balmec')
        WHEN p.description ILIKE '%' || 'Demo' || 'Bodega%' THEN replace(p.description, 'Demo' || 'Bodega', 'Bodega Balmec')
        ELSE p.description
      END,
      status = CASE
        WHEN p.title ILIKE 'Demo %'
          OR COALESCE(p.vertical, '') NOT IN ('winery', 'gourmet')
          OR COALESCE(p.category, '') IN ('retail', 'ticketing', 'beauty', 'cosmetics', 'luxury', 'events')
        THEN 'draft'
        ELSE p.status
      END,
      request_to_buy_enabled = CASE
        WHEN p.title ILIKE 'Demo %'
          OR COALESCE(p.vertical, '') NOT IN ('winery', 'gourmet')
          OR COALESCE(p.category, '') IN ('retail', 'ticketing', 'beauty', 'cosmetics', 'luxury', 'events')
        THEN false
        ELSE p.request_to_buy_enabled
      END,
      featured = CASE
        WHEN p.title ILIKE 'Demo %'
          OR COALESCE(p.vertical, '') NOT IN ('winery', 'gourmet')
          OR COALESCE(p.category, '') IN ('retail', 'ticketing', 'beauty', 'cosmetics', 'luxury', 'events')
        THEN false
        ELSE p.featured
      END,
      updated_at = now()
    FROM tenants t
    WHERE p.tenant_id = t.id
      AND t.slug = 'demobodega'
  `;

  await sql/*sql*/`
    WITH curated(title) AS (
      VALUES
        ('Gran Reserva Malbec 2022'),
        ('Cabernet Franc Reserva 2022'),
        ('Chardonnay de Altura 2023'),
        ('Blend de Finca 2021'),
        ('Aceite de Oliva Extra Virgen Arbequina'),
        ('Aceite de Oliva Blend de Finca'),
        ('Cata privada para dos'),
        ('Paseo guiado Valle de Uco'),
        ('Club VIP Vendimia - 30 días'),
        ('Caja selección Bodega Balmec'),
        ('Gran Reserva Malbec - club release')
    )
    UPDATE marketplace_products p
    SET status = 'draft',
        request_to_buy_enabled = false,
        featured = false,
        updated_at = now()
    FROM tenants t
    WHERE p.tenant_id = t.id
      AND t.slug = 'demobodega'
      AND p.status = 'active'
      AND NOT EXISTS (
        SELECT 1
        FROM curated c
        WHERE c.title = p.title
      )
  `;

  await sql/*sql*/`
    WITH ranked AS (
      SELECT
        p.id,
        row_number() OVER (
          PARTITION BY p.title
          ORDER BY
            p.featured DESC,
            COALESCE(p.price_amount, 0) DESC,
            p.updated_at DESC,
            p.created_at DESC,
            p.id DESC
        ) AS keep_rank
      FROM marketplace_products p
      JOIN tenants t ON t.id = p.tenant_id
      WHERE t.slug = 'demobodega'
        AND p.status = 'active'
        AND p.title IN (
          'Gran Reserva Malbec 2022',
          'Cabernet Franc Reserva 2022',
          'Chardonnay de Altura 2023',
          'Blend de Finca 2021',
          'Aceite de Oliva Extra Virgen Arbequina',
          'Aceite de Oliva Blend de Finca',
          'Cata privada para dos',
          'Paseo guiado Valle de Uco',
          'Club VIP Vendimia - 30 días',
          'Caja selección Bodega Balmec',
          'Gran Reserva Malbec - club release'
        )
    )
    UPDATE marketplace_products p
    SET status = 'draft',
        request_to_buy_enabled = false,
        featured = false,
        updated_at = now()
    FROM ranked r
    WHERE p.id = r.id
      AND r.keep_rank > 1
  `;

  await sql/*sql*/`
    WITH seed(slug, title, product_title, reward_code, type, visibility, description, eligibility_json) AS (
      VALUES
        ('demobodega', 'Malbec con 220 puntos de club', 'Gran Reserva Malbec 2022', 'DB-DISCOUNT-90', 'points_boost', 'verified_tappers', 'Convierte el tap de feria o vinoteca en pedido trazable: el usuario solicita compra, suma puntos y la bodega lo contacta.', '{"pointsAwarded":220,"requiresPurchaseProof":true,"ownershipNotGranted":true,"posOrPinRequiredForOwnership":true}'::jsonb),
        ('demobodega', 'Comprando Cabernet Franc sumás 180 puntos', 'Cabernet Franc Reserva 2022', 'DB-DISCOUNT-90', 'points_boost', 'verified_tappers', 'Convierte el tap de góndola en lead: el usuario pide compra, suma puntos y la bodega lo contacta.', '{"pointsAwarded":180,"requiresPurchaseProof":true,"ownershipNotGranted":true,"posOrPinRequiredForOwnership":true}'::jsonb),
        ('demobodega', 'Chardonnay de altura para maridaje', 'Chardonnay de Altura 2023', 'DB-TASTING-120', 'request_to_buy', 'verified_tappers', 'Lead de compra recomendado para consumidores cercanos a restaurantes, hoteles o eventos de la marca.', '{"requiresVerifiedTap":true,"requiresSalesReview":true}'::jsonb),
        ('demobodega', 'Aceite premium para club Balmec', 'Aceite de Oliva Extra Virgen Arbequina', 'DB-BOX-900', 'cross_sell', 'tenant_members_only', 'Cross-sell gastronómico para consumidores registrados por WhatsApp o email después del tap.', '{"requiresMembership":true,"requiresContactConsent":true}'::jsonb),
        ('demobodega', 'Cata privada 2x1 para miembros', 'Cata privada para dos', 'DB-TASTING-120', 'experience_booking', 'tenant_members_only', 'Beneficio para consumidores asociados al tenant, sin transferir propiedad del producto.', '{"requiresMembership":true,"requiresAgeGate":true}'::jsonb),
        ('demobodega', 'Club VIP por este mes', 'Club VIP Vendimia - 30 días', 'DB-VIP-MONTH-520', 'vip_access', 'verified_tappers', 'Promoción para taps reales: club, revista y descuentos por email con consentimiento.', '{"requiresVerifiedTap":true,"requiresContactConsent":true}'::jsonb),
        ('demobodega', 'Caja selección con seguimiento de lote', 'Caja selección Bodega Balmec', 'DB-BOX-900', 'request_to_buy', 'tenant_members_only', 'Lead de compra premium para el equipo comercial de la marca.', '{"requiresMembership":true,"requiresSalesReview":true}'::jsonb),
        ('demobodega', 'Carrito asistido por asesor Balmec', 'Caja selección Bodega Balmec', 'DB-BOX-900', 'assisted_checkout', 'tenant_members_only', 'El carrito del portal queda como solicitud comercial con método de pago preferido: MercadoPago, Stripe, transferencia, MetaMask o escrow P2P.', '{"requiresMembership":true,"requiresPaymentConfirmation":true,"ownershipNotGranted":true}'::jsonb)
    ),
    resolved AS (
      SELECT
        t.id AS tenant_id,
        s.title,
        s.description,
        s.type,
        s.visibility,
        s.eligibility_json,
        p.id AS product_id,
        r.id AS reward_id
      FROM seed s
      JOIN tenants t ON t.slug = s.slug
      LEFT JOIN marketplace_products p ON p.tenant_id = t.id AND p.title = s.product_title
      LEFT JOIN rewards r ON r.tenant_id = t.id AND r.code = s.reward_code
    )
    INSERT INTO marketplace_offers (
      tenant_id,
      marketplace_product_id,
      reward_id,
      title,
      description,
      status,
      type,
      starts_at,
      ends_at,
      visibility,
      eligibility_json
    )
    SELECT
      tenant_id,
      product_id,
      reward_id,
      title,
      description,
      'active',
      type,
      now(),
      now() + interval '60 days',
      visibility::marketplace_visibility,
      eligibility_json
    FROM resolved
    WHERE NOT EXISTS (
      SELECT 1
      FROM marketplace_offers o
      WHERE o.tenant_id = resolved.tenant_id
        AND o.title = resolved.title
    )
  `;

  await sql/*sql*/`
    UPDATE marketplace_offers
    SET status = 'active',
        updated_at = now()
    WHERE tenant_id IN (SELECT id FROM tenants WHERE slug = 'demobodega')
      AND title IN (
        'Malbec con 220 puntos de club',
        'Comprando Cabernet Franc sumás 180 puntos',
        'Chardonnay de altura para maridaje',
        'Aceite premium para club Balmec',
        'Cata privada 2x1 para miembros',
        'Club VIP por este mes',
        'Caja selección con seguimiento de lote',
        'Carrito asistido por asesor Balmec'
      )
  `;

  await sql/*sql*/`
    UPDATE marketplace_offers o
    SET
      title = CASE
        WHEN o.title ILIKE 'Comprando Cabernet Franc sum%s 180 puntos' THEN 'Comprando Cabernet Franc sumás 180 puntos'
        WHEN o.title ILIKE 'Caja seleccion con seguimiento de lote' THEN 'Caja selección con seguimiento de lote'
        ELSE o.title
      END,
      description = CASE
        WHEN o.description ILIKE '%' || 'g' || 'ondola%' THEN replace(o.description, 'gondola', 'góndola')
        WHEN o.description ILIKE '%' || 'metodo de pago%' THEN replace(o.description, 'metodo de pago', 'método de pago')
        ELSE o.description
      END,
      updated_at = now()
    FROM tenants t
    WHERE o.tenant_id = t.id
      AND t.slug = 'demobodega'
      AND (
        o.title ILIKE 'Comprando Cabernet Franc sum%s 180 puntos'
        OR o.title ILIKE 'Caja seleccion con seguimiento de lote'
        OR o.description ILIKE '%' || 'g' || 'ondola%'
        OR o.description ILIKE '%' || 'metodo de pago%'
      )
  `;

  await sql/*sql*/`
    WITH canonical AS (
      SELECT
        o.id,
        row_number() OVER (
          PARTITION BY o.title
          ORDER BY
            (o.marketplace_product_id IS NOT NULL) DESC,
            (o.reward_id IS NOT NULL) DESC,
            o.created_at DESC,
            o.id DESC
        ) AS keep_rank
      FROM marketplace_offers o
      JOIN tenants t ON t.id = o.tenant_id
      WHERE t.slug = 'demobodega'
        AND o.status = 'active'
        AND o.title IN (
          'Malbec con 220 puntos de club',
          'Comprando Cabernet Franc sumás 180 puntos',
          'Chardonnay de altura para maridaje',
          'Aceite premium para club Balmec',
          'Cata privada 2x1 para miembros',
          'Club VIP por este mes',
          'Caja selección con seguimiento de lote',
          'Carrito asistido por asesor Balmec'
        )
    )
    UPDATE marketplace_offers o
    SET status = 'draft',
        updated_at = now()
    FROM canonical c
    WHERE o.id = c.id
      AND c.keep_rank > 1
  `;
}

export async function ensureAuditLogsSchema() {
  if (!auditLogsSchemaReady) {
    auditLogsSchemaReady = cacheSchemaInit(async () => {
      await ensureUuidExtensions();
      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
          tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
          action text NOT NULL,
          resource_type text NOT NULL,
          resource_id text,
          before_hash text,
          after_hash text,
          ip_address inet,
          user_agent text,
          request_id text,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON audit_logs(actor_id, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id)`;
    }, () => {
      auditLogsSchemaReady = null;
    });
  }
  return auditLogsSchemaReady;
}
