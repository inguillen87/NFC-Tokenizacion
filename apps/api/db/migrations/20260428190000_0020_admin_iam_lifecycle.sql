DO $$ BEGIN
  CREATE TYPE admin_user_status AS ENUM ('invited', 'pending_activation', 'active', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS admin_status admin_user_status NOT NULL DEFAULT 'active';

CREATE TABLE IF NOT EXISTS user_invites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL,
  role membership_role NOT NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS access_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL,
  full_name text,
  company text,
  tenant_slug text,
  role_requested text,
  status text NOT NULL DEFAULT 'requested',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_invites_email_created ON user_invites(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_requests_email_created ON access_requests(email, created_at DESC);
