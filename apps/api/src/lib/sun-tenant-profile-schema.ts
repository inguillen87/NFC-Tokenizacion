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
  await sql/*sql*/`ALTER TABLE batches ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;

  await sql/*sql*/`
    CREATE INDEX IF NOT EXISTS idx_tenant_sun_profiles_vertical
    ON tenant_sun_profiles(vertical)
  `;

  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS tag_profiles (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      sku text,
      product_name text,
      vintage text,
      grape_varietal text,
      alcohol_pct numeric(4,2),
      barrel_months integer,
      harvest_year integer,
      vineyard_humidity numeric(5,2),
      soil_humidity numeric(5,2),
      region text,
      winery text,
      temperature_storage text,
      notes text,
      image_url text,
      locale_data jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql/*sql*/`CREATE UNIQUE INDEX IF NOT EXISTS idx_tag_profiles_tag_id_unique ON tag_profiles(tag_id)`;

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
    UPDATE batches b
    SET sdm_config =
      jsonb_set(
        COALESCE(b.sdm_config, '{}'::jsonb),
        '{sun}',
        '{
          "product":{
            "name":"Gran Reserva Malbec",
            "producer":"Demo Bodega",
            "varietal":"Malbec",
            "vintage":"2022",
            "alcohol":"14.5%",
            "bottle":"750ml",
            "serving":"16C - decantar 20 min",
            "storage":"16C",
            "oakType":"Roble frances tostado medio"
          },
          "origin":{
            "label":"Valle de Uco, Mendoza",
            "region":"Valle de Uco, Mendoza",
            "address":"Finca Altamira, Mendoza, AR",
            "lat":-33.3667,
            "lng":-69.15,
            "altitude":"1,050 msnm"
          },
          "passport":{
            "claimPolicy":"purchase_proof_required",
            "tokenizationMode":"valid_and_opened",
            "publicClaimAllowed":false
          }
        }'::jsonb,
        true
      )
      || '{
        "chip_model":"NTAG 424 DNA TT",
        "tagtamper_enabled":true,
        "tamper_status_enabled":true,
        "tamper_status_source":"enc_decrypted",
        "tamper_status_offset":0,
        "tamper_status_length":1,
        "tamper_closed_values":["43"],
        "tamper_open_values":["4F"],
        "tamper_unknown_policy":"UNKNOWN",
        "ttstatus_enabled":false,
        "ttstatus_source":"none",
        "ttstatus_notes":"Pilot DEMO-2026-02 reads a single encrypted TagTamper status byte: 43 closed, 4F opened."
      }'::jsonb,
      updated_at = now()
    FROM tenants t
    WHERE t.id = b.tenant_id
      AND t.slug = 'demobodega'
      AND b.bid = 'DEMO-2026-02'
  `;

  await sql/*sql*/`
    INSERT INTO tag_profiles (
      tag_id,
      sku,
      product_name,
      vintage,
      grape_varietal,
      alcohol_pct,
      barrel_months,
      harvest_year,
      region,
      winery,
      temperature_storage,
      notes,
      locale_data
    )
    SELECT
      tg.id,
      'GRM-2022-DEMO',
      'Gran Reserva Malbec',
      '2022',
      'Malbec',
      14.50,
      12,
      2022,
      'Valle de Uco, Mendoza',
      'Demo Bodega',
      '16C',
      'Perfil SUN real del piloto demobodega para lote DEMO-2026-02.',
      '{"vertical":"wine","lot":"MZA-2026-0424","origin":{"label":"Valle de Uco, Mendoza","address":"Finca Altamira, Mendoza, AR","lat":-33.3667,"lng":-69.15},"claimPolicy":"purchase_proof_required","tokenizationMode":"valid_and_opened"}'::jsonb
    FROM tags tg
    JOIN batches b ON b.id = tg.batch_id
    JOIN tenants t ON t.id = b.tenant_id
    WHERE t.slug = 'demobodega'
      AND b.bid = 'DEMO-2026-02'
    ON CONFLICT (tag_id) DO UPDATE SET
      sku = COALESCE(NULLIF(tag_profiles.sku, ''), EXCLUDED.sku),
      product_name = COALESCE(NULLIF(tag_profiles.product_name, ''), EXCLUDED.product_name),
      vintage = COALESCE(NULLIF(tag_profiles.vintage, ''), EXCLUDED.vintage),
      grape_varietal = COALESCE(NULLIF(tag_profiles.grape_varietal, ''), EXCLUDED.grape_varietal),
      alcohol_pct = COALESCE(tag_profiles.alcohol_pct, EXCLUDED.alcohol_pct),
      barrel_months = COALESCE(tag_profiles.barrel_months, EXCLUDED.barrel_months),
      harvest_year = COALESCE(tag_profiles.harvest_year, EXCLUDED.harvest_year),
      region = COALESCE(NULLIF(tag_profiles.region, ''), EXCLUDED.region),
      winery = COALESCE(NULLIF(tag_profiles.winery, ''), EXCLUDED.winery),
      temperature_storage = COALESCE(NULLIF(tag_profiles.temperature_storage, ''), EXCLUDED.temperature_storage),
      notes = COALESCE(NULLIF(tag_profiles.notes, ''), EXCLUDED.notes),
      locale_data = COALESCE(tag_profiles.locale_data, '{}'::jsonb) || EXCLUDED.locale_data,
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
