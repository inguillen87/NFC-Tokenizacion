-- Hotfix migration: ensure minimum auth tables exist in partially-provisioned environments.
-- This migration is intentionally additive and uses IF NOT EXISTS guards.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'viewer',
  label text,
  permissions jsonb NOT NULL DEFAULT '["*"]'::jsonb,
  mfa_enabled boolean NOT NULL DEFAULT false,
  admin_status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_mfa_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  secret text NOT NULL,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_mfa_factors_user_id ON user_mfa_factors(user_id);

CREATE TABLE IF NOT EXISTS consumer_auth_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  locked_until timestamptz,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consumer_auth_challenges_contact_created_at
  ON consumer_auth_challenges(contact, created_at DESC);
