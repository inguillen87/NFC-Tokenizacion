import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = neon(url);

await sql(`
  INSERT INTO tenants (slug, name, root_key_ct)
  VALUES ('demo-tenant', 'Demo Tenant', 'encrypted-root-key-placeholder')
  ON CONFLICT (slug) DO NOTHING
`);

const tenant = await sql`SELECT id FROM tenants WHERE slug='demo-tenant' LIMIT 1`;
if (!tenant[0]?.id) {
  console.log("Seed tenant not found after insert");
  process.exit(1);
}

await sql`
  INSERT INTO batches (tenant_id, bid, meta_key_ct, file_key_ct, sdm_config)
  VALUES (${tenant[0].id}, 'DEMO-BATCH-001', 'encrypted-meta-key', 'encrypted-file-key', '{"mode":"secure"}'::jsonb)
  ON CONFLICT (bid) DO NOTHING
`;

console.log("Seed applied.");
