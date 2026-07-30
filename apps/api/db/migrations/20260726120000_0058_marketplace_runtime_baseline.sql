-- Historical additive bridge. Its timestamp intentionally sorts after 0058
-- and before 0059, because 0059 builds an index over these two columns.
--
-- Existing databases which already ledgered 0059 must apply this reviewed gap
-- explicitly before the enterprise release:
--   node scripts/db-apply.mjs --only 20260726120000_0058_marketplace_runtime_baseline.sql
-- Do not replay the whole historical ledger against an existing database.

ALTER TABLE marketplace_offers
  ADD COLUMN IF NOT EXISTS seller_consumer_id uuid;

ALTER TABLE marketplace_offers
  ADD COLUMN IF NOT EXISTS resale_uid_hex text;

-- This table previously existed only behind runtime compatibility DDL. Own it
-- in the migration ledger so production requests remain schema-read-only.
-- `events` is partitioned by created_at, therefore the legacy bigint event id
-- is retained as evidence metadata rather than an invalid events(id) FK.
CREATE TABLE IF NOT EXISTS consumer_product_experiences (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  consumer_id uuid NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  ownership_id uuid REFERENCES consumer_product_ownerships(id) ON DELETE SET NULL,
  event_id bigint,
  uid_hex text,
  product_name text NOT NULL DEFAULT 'Producto asociado',
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  body text NOT NULL,
  original_locale text NOT NULL DEFAULT 'es-AR',
  country text,
  city text,
  photo_urls_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  verification_badges_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  trust_score integer CHECK (trust_score BETWEEN 0 AND 100),
  moderation_status text NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'needs_brand_response', 'private')),
  visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'tenant', 'public')),
  brand_response text,
  translation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consumer_product_experiences_tenant_status
  ON consumer_product_experiences(tenant_id, moderation_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consumer_product_experiences_consumer
  ON consumer_product_experiences(consumer_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_consumer_product_experiences_ownership
  ON consumer_product_experiences(consumer_id, ownership_id)
  WHERE ownership_id IS NOT NULL;
