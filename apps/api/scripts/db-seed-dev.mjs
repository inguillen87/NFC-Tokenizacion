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

const articles = [
  ["es-AR", "getting-started", "Qué es nexID", "nexID es una plataforma de autenticación NFC + identidad digital de producto."],
  ["es-AR", "pricing-roi", "Pricing y ROI", "Para cotizar usamos volumen, tipo de tag y plan SaaS."],
  ["pt-BR", "getting-started", "O que é nexID", "nexID é uma plataforma de autenticação NFC + identidade digital."],
  ["pt-BR", "pricing-roi", "Preço e ROI", "A cotação usa volume, tipo de tag e plano SaaS."],
  ["en", "getting-started", "What is nexID", "nexID is an NFC authentication and product identity platform."],
  ["en", "pricing-roi", "Pricing and ROI", "Quotes depend on volume, tag type, and SaaS plan."],
];

for (const [locale, slug, title, body] of articles) {
  await sql`
    INSERT INTO knowledge_articles (locale, slug, title, body)
    VALUES (${locale}, ${slug}, ${title}, ${body})
    ON CONFLICT (locale, slug) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, updated_at = now()
  `;
}

await sql`
  INSERT INTO leads (locale, contact, company, country, vertical, tag_type, volume, source, status, notes)
  VALUES ('es-AR', 'demo@nexid.lat', 'Bodega Demo', 'AR', 'wine', 'secure', 10000, 'seed', 'qualified', 'Lead de ejemplo')
  ON CONFLICT DO NOTHING
`;



await sql`
  INSERT INTO leads (locale, contact, company, country, vertical, tag_type, volume, source, status, notes, assigned_to)
  VALUES
    ('es-AR', 'superadmin@nexid.lat', 'nexID HQ', 'AR', 'wine', 'secure', 50000, 'seed', 'qualified', 'Lead asignado a super admin', 'super_admin'),
    ('en', 'tenantadmin@nexid.lat', 'Demo Tenant Ops', 'US', 'events', 'basic', 10000, 'seed', 'contacted', 'Tenant admin follow-up', 'tenant_admin')
  ON CONFLICT DO NOTHING
`;

await sql`
  INSERT INTO tickets (locale, contact, title, detail, status, assigned_to)
  VALUES
    ('es-AR', 'tenantadmin@nexid.lat', 'Demo ticket', 'Soporte inicial del tenant', 'open', 'tenant_admin'),
    ('en', 'viewer@nexid.lat', 'Read-only dashboard question', 'Viewer cannot mutate resources', 'pending', 'super_admin')
  ON CONFLICT DO NOTHING
`;

await sql`
  INSERT INTO order_requests (locale, contact, company, tag_type, volume, notes, status, assigned_to)
  VALUES
    ('es-AR', 'reseller@nexid.lat', 'Reseller Demo', 'secure', 25000, 'Pedido inicial reseller', 'quoting', 'reseller'),
    ('pt-BR', 'demo@nexid.lat', 'Canal BR', 'basic', 10000, 'Primeiro pedido', 'new', 'super_admin')
  ON CONFLICT DO NOTHING
`;

console.log("Seed applied.");
