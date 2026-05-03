-- 0031_ops_crm_iam_alerts_runtime_safety
-- Forward-only production safety migration for CRM, notifications, alerts and IAM tables.
-- Mirrors the runtime schema guards used by API routes so cold databases do not 500.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE membership_role AS ENUM ('super_admin', 'tenant_admin', 'reseller', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE admin_user_status AS ENUM ('invited', 'pending_activation', 'active', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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
ALTER TABLE leads ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS vertical text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS role_interest text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS estimated_volume text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tag_type text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS volume integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'assistant';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_leads_source_created_at ON leads(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status_created_at ON leads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_contact_created_at ON leads(contact, created_at DESC);

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
);

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'es-AR';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS contact text NOT NULL DEFAULT 'unknown';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'General inquiry';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS detail text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web_bot';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_to text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_tickets_status_created_at ON tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_contact_created_at ON tickets(contact, created_at DESC);

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
);

ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'es-AR';
ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS contact text NOT NULL DEFAULT 'unknown';
ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS tag_type text;
ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS volume integer;
ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';
ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web_bot';
ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS assigned_to text;
ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_order_requests_status_created_at ON order_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_requests_contact_created_at ON order_requests(contact, created_at DESC);

CREATE TABLE IF NOT EXISTS alert_rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'invalid_rate',
  severity text NOT NULL DEFAULT 'high',
  threshold numeric NOT NULL DEFAULT 1,
  window_minutes integer NOT NULL DEFAULT 60,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, type)
);

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
);

ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'invalid_rate';
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'high';
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS threshold numeric NOT NULL DEFAULT 1;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS window_minutes integer NOT NULL DEFAULT 60;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';
ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;
ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS acknowledged_by text;
ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_security_alerts_tenant_created ON security_alerts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(type, created_at DESC);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL UNIQUE,
  full_name text,
  locale text NOT NULL DEFAULT 'es-AR',
  admin_status admin_user_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'es-AR';
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_status admin_user_status NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS password_credentials (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE password_credentials ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS memberships (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  role membership_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id, role)
);

ALTER TABLE memberships ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

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
);

ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS mfa_verified boolean NOT NULL DEFAULT false;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS rotated_from uuid REFERENCES auth_sessions(id) ON DELETE SET NULL;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS created_ip inet;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

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
);

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
);

ALTER TABLE user_invites ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE user_invites ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE user_invites ADD COLUMN IF NOT EXISTS consumed_at timestamptz;
ALTER TABLE user_invites ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

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
);

ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS user_mfa_factors (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret text NOT NULL,
  recovery_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_mfa_factors ADD COLUMN IF NOT EXISTS recovery_codes jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE user_mfa_factors ADD COLUMN IF NOT EXISTS enabled_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE user_mfa_factors ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;
ALTER TABLE user_mfa_factors ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS resource_permissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource text NOT NULL,
  action text NOT NULL,
  effect text NOT NULL DEFAULT 'allow',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, resource, action, effect)
);

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
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_active ON auth_sessions(user_id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_invites_email_created ON user_invites(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_requests_status_created ON access_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_requests_email_created ON access_requests(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resource_permissions_user ON resource_permissions(user_id, resource);
CREATE INDEX IF NOT EXISTS idx_user_auth_events_email_created ON user_auth_events(email, created_at DESC);
