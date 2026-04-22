#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, scryptSync } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { parse } from 'csv-parse/sync';

function arg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function parseUidText(content) {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const first = lines[0].toLowerCase();
  const start = first === 'uid_hex' || first === 'uid' ? 1 : 0;
  return lines.slice(start).map((uid) => ({ uid_hex: uid.trim().toUpperCase() }));
}

function parseManifest(content) {
  try {
    const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    if (Array.isArray(rows) && rows.length) {
      return rows.map((row) => ({
        uid_hex: String(row.uid_hex || row.uid || row.UID || '').trim().toUpperCase(),
        batch_id: String(row.batch_id || row.batchId || '').trim(),
      })).filter((row) => row.uid_hex);
    }
  } catch {}
  return parseUidText(content);
}

const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl) throw new Error('DATABASE_URL is required');

const tenantSlug = arg('tenant', 'demobodega').toLowerCase();
const tenantName = arg('tenant-name', tenantSlug);
const adminEmail = arg('tenant-admin-email', 'demobodega@nexid.lat').toLowerCase();
const adminPassword = arg('tenant-admin-password', 'DemoBodega2026');
const superAdminEmail = arg('super-admin-email', 'inguillen@nexid.lat').toLowerCase();
const superAdminPassword = arg('super-admin-password', 'Marcelog2026');
const bid = arg('batch-bid', 'DEMO-2026-02');
const manifestPath = arg('manifest', path.join(process.cwd(), 'prisma/demo/demobodega_manifest.csv'));

const manifest = fs.readFileSync(manifestPath, 'utf8');
const rows = parseManifest(manifest);
if (rows.length < 1) throw new Error('Manifest has no rows');

const sql = neon(dbUrl);

const tenantRow = await sql`INSERT INTO tenants (slug, name, root_key_ref)
  VALUES (${tenantSlug}, ${tenantName}, 'enterprise-root-key')
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id, slug`;
const tenantId = tenantRow[0].id;

await sql`INSERT INTO batches (tenant_id, bid, status, meta_key_ct, file_key_ct, sdm_config)
VALUES (${tenantId}, ${bid}, 'active', ${randomBytes(16).toString('hex')}, ${randomBytes(16).toString('hex')}, ${JSON.stringify({ profile: 'enterprise', importedFrom: path.basename(manifestPath) })}::jsonb)
ON CONFLICT (tenant_id, bid) DO UPDATE SET status='active', updated_at = now()`;

const batch = (await sql`SELECT id FROM batches WHERE tenant_id=${tenantId} AND bid=${bid} LIMIT 1`)[0];
for (const row of rows) {
  await sql`INSERT INTO tags (batch_id, uid_hex, status)
  VALUES (${batch.id}, ${row.uid_hex}, 'active')
  ON CONFLICT (batch_id, uid_hex) DO UPDATE SET status='active', updated_at = now()`;
}

async function upsertUser(email, fullName, password, role, tenantScoped) {
  const userRows = await sql`INSERT INTO users (email, full_name)
  VALUES (${email}, ${fullName})
  ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, updated_at = now()
  RETURNING id`;
  const userId = userRows[0].id;
  await sql`INSERT INTO password_credentials (user_id, password_hash)
  VALUES (${userId}::uuid, ${hashPassword(password)})
  ON CONFLICT (user_id) DO UPDATE SET password_hash=EXCLUDED.password_hash, updated_at = now()`;
  await sql`INSERT INTO memberships (user_id, tenant_id, role)
  VALUES (${userId}::uuid, ${tenantScoped ? tenantId : null}, ${role}::membership_role)
  ON CONFLICT DO NOTHING`;
  return userId;
}

await upsertUser(superAdminEmail, 'Ignacio Guillen', superAdminPassword, 'super_admin', false);
await upsertUser(adminEmail, 'DemoBodega Admin', adminPassword, 'tenant_admin', true);

console.log(JSON.stringify({ ok: true, tenant: tenantSlug, batch: bid, tagsActive: rows.length, users: [superAdminEmail, adminEmail], manifestPath }, null, 2));
