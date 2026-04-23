import { promises as fs } from "node:fs";
import path from "node:path";
import { sql } from "./db";
import { encryptKey16 } from "./keys";
import { getDemoPack } from "./demo-packs";

type SeedOptions = { pack?: string; forceBid?: string };

type ManifestRow = { uid_hex: string; batch_id?: string; roll_id?: string; ic_type?: string };

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
  const tenantSlug = "demobodega";

  await sql`INSERT INTO tenants (slug, name, type, status, root_key_ct) VALUES (${tenantSlug}, 'Demo Bodega', 'winery', 'active', 'demo-root-key') ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, type = 'winery', status = 'active'`;
  const tenant = (await sql`SELECT id FROM tenants WHERE slug = ${tenantSlug} LIMIT 1`)[0];

  const metaCt = encryptKey16(Buffer.from(metaHex, "hex"));
  const fileCt = encryptKey16(Buffer.from(fileHex, "hex"));

  await sql`
    INSERT INTO batches (tenant_id, bid, status, meta_key_ct, file_key_ct, sdm_config)
    VALUES (${tenant.id}, ${bid}, 'active', ${metaCt}, ${fileCt}, ${JSON.stringify({ profile: 'demobodega', pack: packKey })}::jsonb)
    ON CONFLICT (bid)
    DO UPDATE SET tenant_id = EXCLUDED.tenant_id, status = 'active', sdm_config = EXCLUDED.sdm_config, updated_at = now()
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

  return { ok: true, pack: packKey, bid, imported: rows.length, inserted, uids: rows.map((row) => row.uid_hex).slice(0, 10) };
}
