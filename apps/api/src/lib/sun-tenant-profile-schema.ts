import { sql } from "./db";

let schemaReady: Promise<void> | null = null;

async function migrateSunTenantProfilesSchema() {
  await sql/*sql*/`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS tenant_sun_profiles (
      tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      vertical text,
      club_name text,
      product_label text,
      origin_label text,
      origin_address text,
      origin_lat double precision,
      origin_lng double precision,
      tokenization_mode text,
      claim_policy text,
      ownership_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
      manifest_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
      theme jsonb NOT NULL DEFAULT '{}'::jsonb,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql/*sql*/`ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS vertical text`;
  await sql/*sql*/`ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS club_name text`;
  await sql/*sql*/`ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS product_label text`;
  await sql/*sql*/`ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS origin_label text`;
  await sql/*sql*/`ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS origin_address text`;
  await sql/*sql*/`ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS origin_lat double precision`;
  await sql/*sql*/`ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS origin_lng double precision`;
  await sql/*sql*/`ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS tokenization_mode text`;
  await sql/*sql*/`ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS claim_policy text`;
  await sql/*sql*/`ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS ownership_policy jsonb NOT NULL DEFAULT '{}'::jsonb`;
  await sql/*sql*/`ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS manifest_policy jsonb NOT NULL DEFAULT '{}'::jsonb`;
  await sql/*sql*/`ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS theme jsonb NOT NULL DEFAULT '{}'::jsonb`;
  await sql/*sql*/`ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb`;
  await sql/*sql*/`ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()`;
  await sql/*sql*/`ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;
  await sql/*sql*/`ALTER TABLE tenant_sun_profiles ALTER COLUMN vertical DROP DEFAULT`;
  await sql/*sql*/`ALTER TABLE tenant_sun_profiles ALTER COLUMN tokenization_mode DROP DEFAULT`;

  await sql/*sql*/`
    CREATE INDEX IF NOT EXISTS idx_tenant_sun_profiles_vertical
    ON tenant_sun_profiles(vertical)
  `;

  await sql/*sql*/`
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
      claim_policy,
      ownership_policy,
      manifest_policy,
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
      'purchase_proof_required',
      '{"requiresPurchaseProof":true,"requiresFreshTap":true,"requiresTenantMembership":true,"allowsPublicClaim":false,"antiReplayRequired":true}'::jsonb,
      '{"acceptedFormats":["csv","txt"],"requiredColumns":["uid_hex"],"csvOptionalColumns":["batch_id","product_name","sku","lot","serial","expires_at"],"activateDefault":false,"rejectDuplicates":true}'::jsonb,
      '{"accent":"cyan","secondary":"violet","mapStyle":"luxury"}'::jsonb,
      '{"pilot":"demobodega","supportsOpenedSealLifecycle":true,"defaultBatch":"DEMO-2026-02","loyalty":{"pointsName":"Uvas","rules":{"pointsPerValidTap":10,"cooldownSeconds":3600},"rewards":[{"code":"WELCOME-10","title":"10% off proxima compra","description":"Descuento para compra directa de bodega.","type":"DISCOUNT","points":40,"stock":500},{"code":"TASTING-UP","title":"Upgrade de degustacion","description":"Acceso a cata premium durante la visita.","type":"TASTING","points":80,"stock":120},{"code":"TOUR-BARRICA","title":"Tour de barrica","description":"Visita guiada de barricas y proceso.","type":"TOUR","points":120,"stock":80}]}}'::jsonb
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
      claim_policy = EXCLUDED.claim_policy,
      ownership_policy = tenant_sun_profiles.ownership_policy || EXCLUDED.ownership_policy,
      manifest_policy = tenant_sun_profiles.manifest_policy || EXCLUDED.manifest_policy,
      theme = tenant_sun_profiles.theme || EXCLUDED.theme,
      metadata = tenant_sun_profiles.metadata || EXCLUDED.metadata,
      updated_at = now()
  `;

  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS tenant_manifests (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      bid text NOT NULL,
      manifest_type text NOT NULL,
      source_filename text,
      row_count integer NOT NULL DEFAULT 0,
      inserted_count integer NOT NULL DEFAULT 0,
      reactivated_count integer NOT NULL DEFAULT 0,
      duplicate_count integer NOT NULL DEFAULT 0,
      rejected_count integer NOT NULL DEFAULT 0,
      content_hash text NOT NULL,
      imported_by text,
      import_status text NOT NULL DEFAULT 'imported',
      errors_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_tenant_manifests_batch ON tenant_manifests(batch_id, created_at DESC)`;
  await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_tenant_manifests_tenant ON tenant_manifests(tenant_id, created_at DESC)`;
}

export async function ensureSunTenantProfilesSchema() {
  if (!schemaReady) {
    schemaReady = migrateSunTenantProfilesSchema().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}
