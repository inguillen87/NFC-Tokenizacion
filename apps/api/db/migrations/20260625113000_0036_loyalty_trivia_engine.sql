CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS loyalty_quizzes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  vertical text NOT NULL DEFAULT 'other',
  product_filter_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  questions_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  points_per_correct integer NOT NULL DEFAULT 10,
  completion_bonus integer NOT NULL DEFAULT 0,
  pass_threshold integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id, code)
);

CREATE TABLE IF NOT EXISTS loyalty_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES loyalty_quizzes(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  tap_event_id bigint,
  consumer_id uuid,
  score integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  points_awarded integer NOT NULL DEFAULT 0,
  answers_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'completed',
  idempotency_key text UNIQUE,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_quizzes_tenant_status ON loyalty_quizzes(tenant_id, status, starts_at);
CREATE INDEX IF NOT EXISTS idx_loyalty_quiz_attempts_tenant_created ON loyalty_quiz_attempts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_quiz_attempts_member_created ON loyalty_quiz_attempts(member_id, created_at DESC);
