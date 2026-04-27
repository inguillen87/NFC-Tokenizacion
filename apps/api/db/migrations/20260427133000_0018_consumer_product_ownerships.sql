-- 0018_consumer_product_ownerships
-- Durable ownership claims for consumer <-> product <-> tenant association.

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
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(consumer_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_consumer_product_ownerships_consumer ON consumer_product_ownerships(consumer_id, claimed_at DESC);
CREATE INDEX IF NOT EXISTS idx_consumer_product_ownerships_tenant ON consumer_product_ownerships(tenant_id, claimed_at DESC);
CREATE INDEX IF NOT EXISTS idx_consumer_product_ownerships_uid ON consumer_product_ownerships(uid_hex);

CREATE UNIQUE INDEX IF NOT EXISTS uq_consumer_product_ownerships_active_uid
  ON consumer_product_ownerships(tenant_id, uid_hex)
  WHERE status = 'claimed';
