CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS carrier_profiles (
  code text PRIMARY KEY,
  label text NOT NULL,
  family text NOT NULL CHECK (family IN ('qr', 'gs1', 'nfc')),
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
);

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
);

ALTER TABLE batches ADD COLUMN IF NOT EXISTS carrier_profile_code text;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS carrier_profile_code text;
ALTER TABLE tenant_manifests ADD COLUMN IF NOT EXISTS carrier_profile_code text;
ALTER TABLE tag_profiles ADD COLUMN IF NOT EXISTS carrier_profile_code text;

CREATE INDEX IF NOT EXISTS idx_batches_carrier_profile ON batches(carrier_profile_code);
CREATE INDEX IF NOT EXISTS idx_tags_carrier_profile ON tags(carrier_profile_code);
CREATE INDEX IF NOT EXISTS idx_tenant_manifests_carrier_profile ON tenant_manifests(carrier_profile_code);
CREATE INDEX IF NOT EXISTS idx_tag_profiles_carrier_profile ON tag_profiles(carrier_profile_code);
CREATE INDEX IF NOT EXISTS idx_tenant_carrier_policies_tenant ON tenant_carrier_policies(tenant_id, enabled);
