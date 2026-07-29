import { promises as fs } from "node:fs";
import path from "node:path";
import { buildBatchKeyLifecycleRecords } from "./batch-keys";
import { sql } from "./db";
import { getDemoPack } from "./demo-packs";
import { ensureCarrierProfileSchema } from "./commercial-runtime-schema";
import { ensureSunTenantProfilesSchema } from "./sun-tenant-profile-schema";

type SeedOptions = { pack?: string; forceBid?: string };

type ManifestRow = { uid_hex: string; batch_id?: string; roll_id?: string; ic_type?: string };

const DEMO_TENANT_SLUG = "demobodega";
const DEMO_CARRIER_PROFILE_CODE = "ntag424_dna_tt";
const DEMO_PRODUCT = {
  sku: "GRM-2022-DEMO",
  name: "Gran Reserva Malbec",
  winery: "Bodega Balmec",
  region: "Valle de Uco, Mendoza",
  varietal: "Malbec",
  vintage: "2022",
  alcohol: "14.5%",
  bottle: "750ml",
  serving: "16C - decantar 20 min",
  storage: "16C",
  oakType: "Roble frances tostado medio",
  imageUrl: "https://nexid.lat/images/premium_wine_mendoza_nfc.png",
};

const DEMO_ORIGIN = {
  label: "Valle de Uco, Mendoza",
  address: "Finca Altamira, Mendoza, AR",
  lat: -33.3667,
  lng: -69.15,
  altitude: "1,050 msnm",
};

const DEMO_OWNERSHIP_POLICY = {
  requiresPurchaseProof: true,
  requiresFreshTap: true,
  requiresTenantMembership: true,
  allowsPublicClaim: false,
  antiReplayRequired: true,
};

const DEMO_MANIFEST_POLICY = {
  acceptedFormats: ["csv", "txt"],
  requiredColumns: ["uid_hex"],
  csvOptionalColumns: [
    "batch_id",
    "product_name",
    "sku",
    "lot",
    "serial",
    "serial_number",
    "external_unit_id",
    "bottle_number",
    "label_number",
    "case_id",
    "pallet_id",
    "roll_id",
    "supplier_lot",
    "expires_at",
    "image_url",
    "label_image_url",
    "model_url",
    "gallery_urls",
    "sensor_json",
    "iot_json",
    "telemetry_json",
    "sensor_at",
    "sensor_id",
    "temperature_c",
    "humidity_pct",
    "light_exposure",
    "transit_shock",
    "storage_zone",
  ],
  activateDefault: false,
  rejectDuplicates: true,
};

const DEMO_SDM_CONFIG = {
  profile: "demobodega",
  carrier_profile_code: DEMO_CARRIER_PROFILE_CODE,
  product_name: DEMO_PRODUCT.name,
  sku: DEMO_PRODUCT.sku,
  winery: DEMO_PRODUCT.winery,
  region: DEMO_PRODUCT.region,
  grape_varietal: DEMO_PRODUCT.varietal,
  vintage: DEMO_PRODUCT.vintage,
  harvest_year: 2022,
  barrel_months: 12,
  temperature_storage: DEMO_PRODUCT.storage,
  image_url: DEMO_PRODUCT.imageUrl,
  chip_model: "NTAG 424 DNA TT",
  tagtamper_enabled: true,
  tamper_status_enabled: true,
  tamper_status_source: "enc_decrypted",
  tamper_status_offset: 0,
  tamper_status_length: 2,
  tamper_closed_values: ["4343"],
  tamper_open_values: ["4F4F", "4F43"],
  tamper_unknown_policy: "UNKNOWN",
  ttstatus_enabled: true,
  ttstatus_source: "enc_decrypted",
  ttstatus_offset: 0,
  ttstatus_length: 2,
  ttstatus_closed_values: ["4343"],
  ttstatus_opened_values: ["4F4F", "4F43"],
  ttstatus_invalid_values: ["4949"],
  ttstatus_notes: "DEMO-2026-02 reads full two-byte NTAG 424 DNA TT status from decrypted ENC: 4343 closed, 4F4F opened, 4F43 opened previously, 4949 invalid.",
  sun: {
    product: {
      name: DEMO_PRODUCT.name,
      producer: DEMO_PRODUCT.winery,
      varietal: DEMO_PRODUCT.varietal,
      vintage: DEMO_PRODUCT.vintage,
      alcohol: DEMO_PRODUCT.alcohol,
      bottle: DEMO_PRODUCT.bottle,
      serving: DEMO_PRODUCT.serving,
      storage: DEMO_PRODUCT.storage,
      oakType: DEMO_PRODUCT.oakType,
      imageUrl: DEMO_PRODUCT.imageUrl,
    },
    origin: {
      label: DEMO_ORIGIN.label,
      region: DEMO_PRODUCT.region,
      address: DEMO_ORIGIN.address,
      lat: DEMO_ORIGIN.lat,
      lng: DEMO_ORIGIN.lng,
      altitude: DEMO_ORIGIN.altitude,
    },
    passport: {
      claimPolicy: "purchase_proof_required",
      tokenizationMode: "valid_and_opened",
      publicClaimAllowed: false,
    },
  },
};

function parseManifest(csv: string): ManifestRow[] {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((value) => value.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    const row = Object.fromEntries(headers.map((key, idx) => [key, values[idx] || ""]));
    return {
      uid_hex: String(row.uid_hex || "").toUpperCase(),
      batch_id: String(row.batch_id || ""),
      roll_id: String(row.roll_id || ""),
      ic_type: String(row.ic_type || ""),
    };
  }).filter((row) => row.uid_hex);
}

export async function seedDemoPack(options: SeedOptions = {}) {
  const packKey = options.pack || "wine-secure";
  const pack = getDemoPack(packKey);
  if (!pack) {
    throw new Error(`unknown pack: ${packKey}`);
  }

  const metaHex = process.env.DEMO_BODEGA_META_KEY_HEX || "00112233445566778899AABBCCDDEEFF";
  const fileHex = process.env.DEMO_BODEGA_FILE_KEY_HEX || "FFEEDDCCBBAA99887766554433221100";

  const manifestCsv = await fs.readFile(pack.manifestPath, "utf8");
  const rows = parseManifest(manifestCsv);
  if (!rows.length) throw new Error("manifest has no uid rows");

  const bid = (options.forceBid || rows[0]?.batch_id || pack.batchId || "DEMO-2026-02").trim();
  const tenantSlug = DEMO_TENANT_SLUG;

  await sql`INSERT INTO tenants (slug, name, type, status, root_key_ct) VALUES (${tenantSlug}, 'Bodega Balmec', 'winery', 'active', 'demo-root-key') ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, type = 'winery', status = 'active'`;
  const tenant = (await sql`SELECT id FROM tenants WHERE slug = ${tenantSlug} LIMIT 1`)[0];

  const keyVersion = 1;
  const keyMaterial = buildBatchKeyLifecycleRecords({
    tenantId: String(tenant.id),
    bid,
    kMetaHex: metaHex,
    kFileHex: fileHex,
    keyVersion,
    createdBy: null,
  });
  const metaCt = keyMaterial.find((item) => item.keyRole === "K_META_BATCH")?.encryptedKeyCt;
  const fileCt = keyMaterial.find((item) => item.keyRole === "K_FILE_BATCH")?.encryptedKeyCt;
  if (!metaCt || !fileCt) throw new Error("demo batch key lifecycle records are incomplete");

  await sql`
    INSERT INTO batches (tenant_id, bid, status, meta_key_ct, file_key_ct, sdm_config)
    VALUES (${tenant.id}, ${bid}, 'active', ${metaCt}, ${fileCt}, ${JSON.stringify({ ...DEMO_SDM_CONFIG, pack: packKey, key_version: keyVersion })}::jsonb)
    ON CONFLICT (bid)
    DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      status = 'active',
      meta_key_ct = COALESCE(batches.meta_key_ct, EXCLUDED.meta_key_ct),
      file_key_ct = COALESCE(batches.file_key_ct, EXCLUDED.file_key_ct),
      sdm_config = COALESCE(batches.sdm_config, '{}'::jsonb) || EXCLUDED.sdm_config,
      updated_at = now()
  `;

  const batch = (await sql`SELECT id FROM batches WHERE bid = ${bid} LIMIT 1`)[0];

  let inserted = 0;
  for (const row of rows) {
    const result = await sql`
      INSERT INTO tags (batch_id, uid_hex, status)
      VALUES (${batch.id}, ${row.uid_hex}, 'active')
      ON CONFLICT (batch_id, uid_hex)
      DO UPDATE SET status='active'
      RETURNING id, xmax = 0 AS inserted
    `;
    if (result[0]?.inserted) inserted += 1;
    const tagId = result[0]?.id;

    if (tagId) {
      await sql`
        INSERT INTO product_passports (
          tenant_id, batch_id, tag_id, product_name, varietal, vintage, alcohol, barrel_aging, harvest, region, winery_name
        ) VALUES (
          ${tenant.id}, ${batch.id}, ${tagId}, 'Gran Reserva Malbec', 'Malbec', '2022', '14.5%', '12 meses', '2022', 'Valle de Uco, Mendoza', 'Finca Altamira'
        ) ON CONFLICT DO NOTHING
      `;
    }
  }

  await ensureSunTenantProfilesSchema();
  await ensureCarrierProfileSchema();

  await sql`
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
    ) VALUES (
      ${tenant.id},
      'wine',
      'Club Terroir',
      'Vino premium',
      ${DEMO_ORIGIN.label},
      ${DEMO_ORIGIN.address},
      ${DEMO_ORIGIN.lat},
      ${DEMO_ORIGIN.lng},
      'valid_and_opened',
      'purchase_proof_required',
      ${JSON.stringify(DEMO_OWNERSHIP_POLICY)}::jsonb,
      ${JSON.stringify(DEMO_MANIFEST_POLICY)}::jsonb,
      ${JSON.stringify({ accent: "cyan", secondary: "violet", mapStyle: "luxury" })}::jsonb,
      ${JSON.stringify({
        pilot: "demobodega",
        supportsOpenedSealLifecycle: true,
        defaultBatch: bid,
        loyalty: {
          pointsName: "Uvas",
          rules: { pointsPerValidTap: 10, cooldownSeconds: 3600 },
          rewards: [
            { code: "WELCOME-10", title: "10% off proxima compra", description: "Descuento para compra directa de bodega.", type: "DISCOUNT", points: 40, stock: 500 },
            { code: "TASTING-UP", title: "Upgrade de degustacion", description: "Acceso a cata premium durante la visita.", type: "TASTING", points: 80, stock: 120 },
            { code: "TOUR-BARRICA", title: "Tour de barrica", description: "Visita guiada de barricas y proceso.", type: "TOUR", points: 120, stock: 80 },
          ],
        },
      })}::jsonb
    )
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
      ownership_policy = EXCLUDED.ownership_policy,
      manifest_policy = EXCLUDED.manifest_policy,
      theme = tenant_sun_profiles.theme || EXCLUDED.theme,
      metadata = tenant_sun_profiles.metadata || EXCLUDED.metadata,
      updated_at = now()
  `;

  await sql`
    UPDATE batches
    SET carrier_profile_code = ${DEMO_CARRIER_PROFILE_CODE},
        sdm_config = COALESCE(sdm_config, '{}'::jsonb) || ${JSON.stringify({ ...DEMO_SDM_CONFIG, pack: packKey })}::jsonb,
        updated_at = now()
    WHERE id = ${batch.id}
  `;

  await sql`
    UPDATE tags
    SET carrier_profile_code = ${DEMO_CARRIER_PROFILE_CODE}
    WHERE batch_id = ${batch.id}
  `;

  await sql`
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
      image_url,
      locale_data,
      carrier_profile_code
    )
    SELECT
      tg.id,
      ${DEMO_PRODUCT.sku},
      ${DEMO_PRODUCT.name},
      ${DEMO_PRODUCT.vintage},
      ${DEMO_PRODUCT.varietal},
      14.50,
      12,
      2022,
      ${DEMO_PRODUCT.region},
      ${DEMO_PRODUCT.winery},
      ${DEMO_PRODUCT.storage},
      ${`Perfil SUN real del piloto ${tenantSlug} para lote ${bid}.`},
      ${DEMO_PRODUCT.imageUrl},
      ${JSON.stringify({
        vertical: "wine",
        lot: "MZA-2026-0424",
        origin: DEMO_ORIGIN,
        claimPolicy: "purchase_proof_required",
        tokenizationMode: "valid_and_opened",
        media: { hero: DEMO_PRODUCT.imageUrl, packshot: DEMO_PRODUCT.imageUrl },
      })}::jsonb,
      ${DEMO_CARRIER_PROFILE_CODE}
    FROM tags tg
    WHERE tg.batch_id = ${batch.id}
    ON CONFLICT (tag_id) DO UPDATE SET
      sku = EXCLUDED.sku,
      product_name = EXCLUDED.product_name,
      vintage = EXCLUDED.vintage,
      grape_varietal = EXCLUDED.grape_varietal,
      alcohol_pct = EXCLUDED.alcohol_pct,
      barrel_months = EXCLUDED.barrel_months,
      harvest_year = EXCLUDED.harvest_year,
      region = EXCLUDED.region,
      winery = EXCLUDED.winery,
      temperature_storage = EXCLUDED.temperature_storage,
      notes = EXCLUDED.notes,
      image_url = EXCLUDED.image_url,
      locale_data = COALESCE(tag_profiles.locale_data, '{}'::jsonb) || EXCLUDED.locale_data,
      carrier_profile_code = EXCLUDED.carrier_profile_code,
      updated_at = now()
  `;

  // Phase 8: Seed Loyalty Vertical Template for Bodega Balmec ("Club Terroir")
  await sql`
    INSERT INTO loyalty_programs (tenant_id, name, vertical, status, points_name)
    VALUES (${tenant.id}, 'Club Terroir', 'winery', 'active', 'Uvas')
    ON CONFLICT DO NOTHING
  `;
  const program = (await sql`SELECT id FROM loyalty_programs WHERE tenant_id = ${tenant.id} LIMIT 1`)[0];

  if (program) {
    await sql`
      INSERT INTO badges (tenant_id, program_id, code, name, description, icon, rarity)
      VALUES
        (${tenant.id}, ${program.id}, 'MALBEC_LOVER', 'Malbec Lover', 'Has escaneado tu primer Malbec Gran Reserva auténtico.', '🍷', 'rare'),
        (${tenant.id}, ${program.id}, 'MENDOZA_EXPLORER', 'Valle de Uco Explorer', 'Estás descubriendo el terroir de Mendoza.', '🏔️', 'common')
      ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO rewards (tenant_id, program_id, code, title, description, type, points_cost, status)
      VALUES
        (${tenant.id}, ${program.id}, 'TASTING_UPGRADE', 'Upgrade de degustación', 'Accedé a una copa de añada histórica durante tu visita.', 'TASTING', 100, 'active'),
        (${tenant.id}, ${program.id}, 'DISCOUNT_10', '10% Off próxima compra', 'Válido en la tienda online oficial.', 'DISCOUNT', 50, 'active')
      ON CONFLICT DO NOTHING
    `;
  }

  return { ok: true, pack: packKey, bid, imported: rows.length, inserted, uids: rows.map((row) => row.uid_hex).slice(0, 10) };
}
