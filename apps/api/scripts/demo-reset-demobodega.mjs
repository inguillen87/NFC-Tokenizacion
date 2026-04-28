import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const bid = process.argv.find((a) => a.startsWith("--bid="))?.split("=")[1] || "DEMO-2026-02";
const tenantSlug = process.argv.find((a) => a.startsWith("--tenant="))?.split("=")[1] || "demobodega";

const sql = neon(url);

const tenant = (await sql`SELECT id, slug FROM tenants WHERE slug = ${tenantSlug} LIMIT 1`)[0];
if (!tenant) {
  console.log(`No tenant found for slug=${tenantSlug}. Nothing to reset.`);
  process.exit(0);
}

const batch = (await sql`SELECT id, bid FROM batches WHERE tenant_id = ${tenant.id} AND bid = ${bid} LIMIT 1`)[0];

if (batch?.id) {
  await sql`DELETE FROM events WHERE batch_id = ${batch.id}`;
  await sql`DELETE FROM consumer_product_ownerships WHERE batch_id = ${batch.id}`;
  await sql`DELETE FROM tags WHERE batch_id = ${batch.id}`;
  await sql`DELETE FROM batches WHERE id = ${batch.id}`;
}

await sql`DELETE FROM security_alerts WHERE tenant_id = ${tenant.id}`;
await sql`DELETE FROM alert_rules WHERE tenant_id = ${tenant.id}`;
await sql`DELETE FROM tenant_consumer_memberships WHERE tenant_id = ${tenant.id}`;
await sql`DELETE FROM consumer_tap_history WHERE tenant_id = ${tenant.id}`;
await sql`DELETE FROM consumer_products WHERE tenant_id = ${tenant.id}`;

console.log(`Demo reset complete for tenant=${tenantSlug} bid=${bid}`);
