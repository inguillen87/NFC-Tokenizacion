import { hashPassword } from "./password";

type Preset = {
  email: string;
  password: string;
  role: "super_admin" | "tenant_admin" | "reseller" | "viewer";
  fullName: string;
  permissions: string[];
};

function read(value: string | undefined, fallback: string) {
  const normalized = (value || "").trim();
  return normalized || fallback;
}

export function getAuthPresets(): Preset[] {
  return [
    {
      email: read(process.env.SUPER_ADMIN_EMAIL || process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL, "inguillen@nexid.lat"),
      password: read(process.env.SUPER_ADMIN_PASSWORD || process.env.NEXT_PUBLIC_SUPER_ADMIN_PASSWORD, "Marcelog2026"),
      role: "super_admin",
      fullName: "Ignacio Guillen",
      permissions: ["users:manage", "tenants:write", "batches:write", "analytics:read", "events:read"],
    },
    {
      email: read(process.env.TENANT_ADMIN_EMAIL || process.env.BODEGA_ADMIN_EMAIL || process.env.NEXT_PUBLIC_TENANT_ADMIN_EMAIL, "demobodega@nexid.lat"),
      password: read(process.env.TENANT_ADMIN_PASSWORD || process.env.BODEGA_ADMIN_PASSWORD || process.env.NEXT_PUBLIC_TENANT_ADMIN_PASSWORD, "DemoBodega2026"),
      role: "tenant_admin",
      fullName: "DemoBodega Admin",
      permissions: ["users:manage", "batches:write", "analytics:read", "events:read"],
    },
    {
      email: read(process.env.RESELLER_EMAIL || process.env.NEXT_PUBLIC_RESELLER_EMAIL, "partner.demo@nexid.lat"),
      password: read(process.env.RESELLER_PASSWORD || process.env.NEXT_PUBLIC_RESELLER_PASSWORD, "NexidPartner2026"),
      role: "reseller",
      fullName: "Partner Demo",
      permissions: ["batches:write", "analytics:read", "events:read"],
    },
    {
      email: read(process.env.GENERIC_DEMO_EMAIL || process.env.NEXT_PUBLIC_GENERIC_DEMO_EMAIL, "demo@nexid.lat"),
      password: read(process.env.GENERIC_DEMO_PASSWORD || process.env.NEXT_PUBLIC_GENERIC_DEMO_PASSWORD, "NexidDemo2026"),
      role: "viewer",
      fullName: "Generic Demo",
      permissions: ["analytics:read", "events:read"],
    },
  ];
}

async function resolveDemoTenantId(sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any>) {
  const preferred = read(process.env.DEMO_TENANT_SLUG || process.env.DEMO_BODEGA_SLUG, "demobodega");
  const candidates = [preferred, "demobodega", "demo-bodega"];
  for (const slug of candidates) {
    const rows = await sql`SELECT id FROM tenants WHERE slug = ${slug} LIMIT 1`;
    if (rows[0]?.id) return rows[0].id as string;
  }
  return null;
}

export async function ensurePresetUser(sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any>, email: string) {
  const preset = getAuthPresets().find((item) => item.email.toLowerCase() === email.toLowerCase());
  if (!preset) return null;

  const existing = await sql`SELECT id FROM users WHERE email = ${preset.email} LIMIT 1`;
  const userId = existing[0]?.id || (await sql`INSERT INTO users (email, full_name) VALUES (${preset.email}, ${preset.fullName}) RETURNING id`)[0]?.id;
  if (!userId) return null;

  const pwdRows = await sql`SELECT user_id FROM password_credentials WHERE user_id = ${userId}::uuid LIMIT 1`;
  if (!pwdRows[0]) {
    await sql`INSERT INTO password_credentials (user_id, password_hash) VALUES (${userId}::uuid, ${hashPassword(preset.password)})`;
  }

  const tenantIdForMembership = preset.role === "tenant_admin" ? await resolveDemoTenantId(sql) : null;
  const membershipRows = await sql`SELECT id, tenant_id FROM memberships WHERE user_id = ${userId}::uuid AND role = ${preset.role}::membership_role ORDER BY created_at ASC LIMIT 1`;
  if (!membershipRows[0]) {
    await sql`INSERT INTO memberships (user_id, tenant_id, role) VALUES (${userId}::uuid, ${tenantIdForMembership}::uuid, ${preset.role}::membership_role)`;
  } else if (preset.role === "tenant_admin" && tenantIdForMembership && !membershipRows[0].tenant_id) {
    await sql`UPDATE memberships SET tenant_id = ${tenantIdForMembership}::uuid, updated_at = now() WHERE id = ${membershipRows[0].id}::uuid`;
  }

  for (const entry of preset.permissions) {
    const [resource, action] = entry.split(":");
    if (resource && action) {
      await sql`INSERT INTO resource_permissions (user_id, resource, action) VALUES (${userId}::uuid, ${resource}, ${action}) ON CONFLICT DO NOTHING`;
    }
  }

  return preset;
}
