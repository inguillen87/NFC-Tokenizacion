#!/usr/bin/env node
import { randomBytes, scryptSync } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { collectMissingBootstrapEnv, parseBootstrapArgs, shouldCreateDemoTenant } from './bootstrap-saas-lib.mjs';

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

const { withDemo, dryRun } = parseBootstrapArgs(process.argv.slice(2));
const missingEnvNames = collectMissingBootstrapEnv(process.env);
if (missingEnvNames.length > 0) {
  console.error(JSON.stringify({ ok: false, reason: 'missing required bootstrap env', missingEnvNames }, null, 2));
  process.exit(1);
}

const dbUrl = String(process.env.DATABASE_URL || '').trim();
const sql = neon(dbUrl);

const superAdminEmail = String(process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
const superAdminPassword = String(process.env.SUPER_ADMIN_PASSWORD || '').trim();
const demoTenantSlug = String(process.env.DEMO_TENANT_SLUG || process.env.DEMO_BODEGA_SLUG || '').trim().toLowerCase();
const demoTenantName = String(process.env.DEMO_TENANT_NAME || '').trim();
const demoEnabled = shouldCreateDemoTenant({ demoModeEnv: process.env.DEMO_MODE, withDemoFlag: withDemo });

async function ensureDemoTenant() {
  if (!demoTenantSlug || !demoTenantName) {
    throw new Error('Demo tenant bootstrap is explicit-only. Set DEMO_TENANT_SLUG and DEMO_TENANT_NAME, or run the supplier onboarding wizard for real tenants.');
  }
  const existing = await sql`SELECT id, slug FROM tenants WHERE slug = ${demoTenantSlug} LIMIT 1`;
  if (existing[0]?.id) return existing[0];
  throw new Error(`Demo tenant "${demoTenantSlug}" does not exist. Create it through demo:demobodega or /batches/supplier so SUN profile, manifest policy and product identity are complete.`);
}

async function ensureSuperAdmin(demoTenantId = null) {
  const userRows = await sql`INSERT INTO users (email, full_name) VALUES (${superAdminEmail}, 'Super Admin') ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, updated_at = now() RETURNING id`;
  const userId = userRows[0]?.id;
  if (!userId) throw new Error('failed to ensure super admin user');

  await sql`INSERT INTO password_credentials (user_id, password_hash) VALUES (${userId}::uuid, ${hashPassword(superAdminPassword)}) ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now()`;

  await sql`INSERT INTO memberships (user_id, tenant_id, role) VALUES (${userId}::uuid, ${demoTenantId}::uuid, 'super_admin'::membership_role) ON CONFLICT DO NOTHING`;

  const permissions = ['users:manage', 'tenants:write', 'batches:write', 'analytics:read', 'events:read'];
  for (const permission of permissions) {
    const [resource, action] = permission.split(':');
    await sql`INSERT INTO resource_permissions (user_id, resource, action) VALUES (${userId}::uuid, ${resource}, ${action}) ON CONFLICT DO NOTHING`;
  }

  return { userId, permissionsCount: permissions.length };
}

if (dryRun) {
  console.log(JSON.stringify({ ok: true, dryRun: true, demoEnabled, superAdminEmail, demoTenantSlug, missingEnvNames: [] }, null, 2));
  process.exit(0);
}

let demoTenant = null;
if (demoEnabled) {
  demoTenant = await ensureDemoTenant();
}
const superAdmin = await ensureSuperAdmin(demoTenant?.id || null);

console.log(JSON.stringify({ ok: true, superAdminEmail, demoEnabled, demoTenant: demoTenant || null, superAdmin }, null, 2));
