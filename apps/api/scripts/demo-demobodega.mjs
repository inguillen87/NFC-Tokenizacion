import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const metaHex = process.env.DEMO_BODEGA_META_KEY_HEX;
const fileHex = process.env.DEMO_BODEGA_FILE_KEY_HEX;
if (!metaHex || !fileHex) {
  console.error("DEMO_BODEGA_META_KEY_HEX and DEMO_BODEGA_FILE_KEY_HEX are required");
  process.exit(1);
}

const demoDir = path.resolve(process.cwd(), "prisma", "demo");
const manifestCsv = fs.readFileSync(path.join(demoDir, "demobodega_manifest.csv"), "utf8");
const seedJson = JSON.parse(fs.readFileSync(path.join(demoDir, "demobodega_seed.json"), "utf8"));
const sql = neon(url);

function encryptKey16(hex) {
  const kmsHex = process.env.KMS_MASTER_KEY_HEX;
  if (!kmsHex) throw new Error("KMS_MASTER_KEY_HEX is not set");
  const kms = Buffer.from(kmsHex, "hex");
  if (kms.length !== 32) throw new Error("KMS_MASTER_KEY_HEX must be 32 bytes");
  const key16 = Buffer.from(hex, "hex");
  if (key16.length !== 16) throw new Error("Batch key must be 16 bytes hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", kms, iv);
  const ct = Buffer.concat([cipher.update(key16), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function parseManifest(csv) {
  const lines = csv.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row = Object.fromEntries(headers.map((h, i) => [h, cols[i]?.trim() || ""]));
    return { uid_hex: String(row.uid_hex || "").toUpperCase(), sku: row.roll_id || "", product_name: "Demo Bodega Reserva" };
  }).filter((r) => r.uid_hex);
}

function parseProducts(raw) {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw.products) ? raw.products : Array.isArray(raw.bottles) ? raw.bottles : [];
  return list.map((p) => ({ ...p, uidHex: String(p.uidHex || p.uid_hex || "").toUpperCase() })).filter((p) => p.uidHex);
}

const manifestRows = parseManifest(manifestCsv);
const products = parseProducts(seedJson);
const productByUid = new Map(products.map((p) => [p.uidHex, p]));

const accounts = [
  { email: "superadmin@nexid.lat", fullName: "nexID Super Admin", role: "super_admin", tenantScoped: false },
  { email: "admin@demobodega.lat", fullName: "Demo Bodega Admin", role: "tenant_admin", tenantScoped: true },
  { email: "reseller@partner.lat", fullName: "Partner Reseller", role: "reseller", tenantScoped: true },
  { email: "viewer@investor.lat", fullName: "Investor Viewer", role: "viewer", tenantScoped: true },
];

const generatedPasswords = Object.fromEntries(accounts.map((a) => [a.email, `Demo-${crypto.randomBytes(6).toString("hex")}`]));

await sql`INSERT INTO tenants (slug, name, root_key_ct)
VALUES ('demobodega', 'Demo Bodega', 'demo-root-key')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name`;

const tenant = (await sql`SELECT id, slug, name FROM tenants WHERE slug='demobodega' LIMIT 1`)[0];

for (const account of accounts) {
  await sql`INSERT INTO users (email, full_name, locale)
  VALUES (${account.email}, ${account.fullName}, 'es-AR')
  ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name`;
  const user = (await sql`SELECT id FROM users WHERE email = ${account.email} LIMIT 1`)[0];
  await sql`INSERT INTO password_credentials (user_id, password_hash)
  VALUES (${user.id}, ${hashPassword(generatedPasswords[account.email])})
  ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now()`;
  await sql`INSERT INTO memberships (user_id, tenant_id, role)
  VALUES (${user.id}, ${account.tenantScoped ? tenant.id : null}, ${account.role}::membership_role)
  ON CONFLICT (user_id, tenant_id, role) DO NOTHING`;
}

await sql`INSERT INTO batches (tenant_id, bid, status, meta_key_ct, file_key_ct, sdm_config)
VALUES (${tenant.id}, 'DEMO-2026-02', 'active', ${encryptKey16(metaHex)}, ${encryptKey16(fileHex)}, '{"profile":"demobodega"}'::jsonb)
ON CONFLICT (bid) DO NOTHING`;
const batch = (await sql`SELECT id, bid FROM batches WHERE bid='DEMO-2026-02' LIMIT 1`)[0];

for (const row of manifestRows) {
  await sql`INSERT INTO tags (batch_id, uid_hex, status)
  VALUES (${batch.id}, ${row.uid_hex}, 'active')
  ON CONFLICT (batch_id, uid_hex) DO UPDATE SET status = 'active'`;
  const tag = (await sql`SELECT id FROM tags WHERE batch_id = ${batch.id} AND uid_hex = ${row.uid_hex} LIMIT 1`)[0];
  const p = productByUid.get(row.uid_hex) || {};

  await sql`INSERT INTO tag_profiles (
    tag_id, sku, product_name, vintage, grape_varietal, alcohol_pct, barrel_months, harvest_year,
    vineyard_humidity, soil_humidity, region, winery, temperature_storage, notes, image_url, locale_data
  ) VALUES (
    ${tag.id}, ${p.sku || row.sku || null}, ${p.productName || row.product_name}, ${p.vintage || null}, ${p.grapeVarietal || null},
    ${p.alcoholPct || null}, ${p.barrelMonths || null}, ${p.harvestYear || null}, ${p.vineyardHumidity || null}, ${p.soilHumidity || null},
    ${p.region || 'Mendoza'}, 'Demo Bodega', ${p.temperatureStorage || null}, ${p.notes || 'Demo premium traceability story.'},
    'https://images.unsplash.com/photo-1516594915697-87eb3b1c14ea',
    ${JSON.stringify({ 'es-AR': p, 'pt-BR': p, en: p })}::jsonb
  )
  ON CONFLICT (tag_id) DO UPDATE SET sku=EXCLUDED.sku, product_name=EXCLUDED.product_name, locale_data=EXCLUDED.locale_data, updated_at=now()`;
}

await sql`INSERT INTO leads (locale, contact, company, country, vertical, tag_type, volume, source, status, notes, transcript, assigned_to)
VALUES ('es-AR', 'compras@vinademo.ar', 'Viña Demo', 'AR', 'wine', 'secure', 50000, 'web_bot', 'qualified', 'Interés en piloto premium', 'Necesitamos trazabilidad para exportación.', 'tenant_admin')
ON CONFLICT DO NOTHING`;
await sql`INSERT INTO tickets (locale, contact, title, detail, status, source, assigned_to)
VALUES ('en', 'ops@demobodega.lat', 'Cold-chain alert setup', 'Need webhook integration for anomalies.', 'open', 'web_bot', 'tenant_admin')
ON CONFLICT DO NOTHING`;
await sql`INSERT INTO order_requests (locale, contact, company, tag_type, volume, notes, status, source, assigned_to)
VALUES ('pt-BR', 'canal@partner.lat', 'Distribuidor BR', 'secure', 25000, 'Pedido demo para canal revenda', 'quoting', 'web_bot', 'reseller')
ON CONFLICT DO NOTHING`;

const hasEvents = await sql`SELECT COUNT(*)::int AS count FROM events WHERE batch_id=${batch.id}`;
if ((hasEvents[0]?.count || 0) === 0) {
  for (const [idx, uid] of manifestRows.slice(0, 4).map((m) => m.uid_hex).entries()) {
    await sql`INSERT INTO events (tenant_id, batch_id, uid_hex, sdm_read_ctr, read_counter, cmac_ok, allowlisted, tag_status, result, city, country_code, lat, lng, device_label, source, meta)
    VALUES (${tenant.id}, ${batch.id}, ${uid}, ${idx + 1}, ${idx + 1}, true, true, 'active', ${idx === 3 ? 'REPLAY_SUSPECT' : 'VALID'}, ${idx % 2 ? 'São Paulo' : 'Mendoza'}, ${idx % 2 ? 'BR' : 'AR'}, ${idx % 2 ? -23.55 : -32.8895}, ${idx % 2 ? -46.63 : -68.8458}, 'Demo Seeder', 'demo', '{"seed":true}'::jsonb)`;
  }
}

const activeTags = await sql`SELECT COUNT(*)::int AS count FROM tags WHERE batch_id = ${batch.id} AND status='active'`;
console.log("\n=== Demo Bodega seeded ===");
console.log(`Tenant: ${tenant.name} (${tenant.slug})`);
console.log(`Batch: ${batch.bid}`);
console.log(`Active tags: ${activeTags[0].count}`);
console.log("Routes: /demo-lab, /demo, /internal/demo/scan");
if (process.env.NODE_ENV !== "production") {
  console.log("\nLogins (dev/demo only):");
  for (const account of accounts) console.log(`- ${account.role}: ${account.email} / ${generatedPasswords[account.email]}`);
}
