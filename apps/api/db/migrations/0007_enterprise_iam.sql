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

CREATE TABLE IF NOT EXISTS user_mfa_factors (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret text NOT NULL,
  recovery_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resource_permissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource text NOT NULL,
  action text NOT NULL,
  effect text NOT NULL DEFAULT 'allow',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, resource, action, effect)
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_active ON auth_sessions(user_id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resource_permissions_user ON resource_permissions(user_id, resource);
