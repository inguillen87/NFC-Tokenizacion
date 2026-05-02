CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS tenant_sun_profiles (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  vertical text NOT NULL DEFAULT 'generic',
  club_name text,
  product_label text,
  origin_label text,
  origin_address text,
  origin_lat double precision,
  origin_lng double precision,
  tokenization_mode text NOT NULL DEFAULT 'manual',
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS vertical text NOT NULL DEFAULT 'generic';
ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS club_name text;
ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS product_label text;
ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS origin_label text;
ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS origin_address text;
ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS origin_lat double precision;
ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS origin_lng double precision;
ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS tokenization_mode text NOT NULL DEFAULT 'manual';
ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS theme jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_tenant_sun_profiles_vertical ON tenant_sun_profiles(vertical);

INSERT INTO tenant_sun_profiles (
  tenant_id,
  vertical,
  club_name,
  product_label,
  origin_label,
  origin_address,
  origin_lat,
  origin_lng,
  tokenization_mode,
  theme,
  metadata
)
SELECT
  t.id,
  'wine',
  'Club Terroir',
  'Vino premium',
  'Valle de Uco, Mendoza',
  'Finca Altamira, Mendoza, AR',
  -33.3667,
  -69.15,
  'valid_and_opened',
  '{"accent":"cyan","secondary":"violet","mapStyle":"luxury"}'::jsonb,
  '{"pilot":"demobodega","supportsOpenedSealLifecycle":true,"defaultBatch":"DEMO-2026-02"}'::jsonb
FROM tenants t
WHERE t.slug = 'demobodega'
ON CONFLICT (tenant_id) DO UPDATE SET
  vertical = EXCLUDED.vertical,
  club_name = EXCLUDED.club_name,
  product_label = EXCLUDED.product_label,
  origin_label = EXCLUDED.origin_label,
  origin_address = EXCLUDED.origin_address,
  origin_lat = EXCLUDED.origin_lat,
  origin_lng = EXCLUDED.origin_lng,
  tokenization_mode = EXCLUDED.tokenization_mode,
  theme = tenant_sun_profiles.theme || EXCLUDED.theme,
  metadata = tenant_sun_profiles.metadata || EXCLUDED.metadata,
  updated_at = now();
