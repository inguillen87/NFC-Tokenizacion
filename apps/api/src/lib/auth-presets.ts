import { hashPassword } from "./password";

type Preset = {
  email: string;
  password: string;
  role: "super_admin" | "tenant_admin" | "reseller" | "viewer";
  fullName: string;
  permissions: string[];
};

function read(value: string | undefined, fallback = "") {
  const normalized = (value || "").trim();
  return normalized || fallback;
}

export function getAuthPresets(): Preset[] {
  return [
    {
      email: read(process.env.SUPER_ADMIN_EMAIL || process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL, "super-admin@example.com"),
      password: read(process.env.SUPER_ADMIN_PASSWORD || process.env.NEXT_PUBLIC_SUPER_ADMIN_PASSWORD),
      role: "super_admin",
      fullName: "Super Admin",
      permissions: ["users:manage", "tenants:write", "batches:write", "analytics:read", "events:read"],
    },
    {
      email: read(process.env.TENANT_ADMIN_EMAIL || process.env.BODEGA_ADMIN_EMAIL || process.env.NEXT_PUBLIC_TENANT_ADMIN_EMAIL, "tenant-admin@example.com"),
      password: read(process.env.TENANT_ADMIN_PASSWORD || process.env.BODEGA_ADMIN_PASSWORD || process.env.NEXT_PUBLIC_TENANT_ADMIN_PASSWORD),
      role: "tenant_admin",
      fullName: "Tenant Admin",
      permissions: ["users:manage", "batches:write", "analytics:read", "events:read"],
    },
    {
      email: read(process.env.RESELLER_EMAIL || process.env.NEXT_PUBLIC_RESELLER_EMAIL, "reseller@example.com"),
      password: read(process.env.RESELLER_PASSWORD || process.env.NEXT_PUBLIC_RESELLER_PASSWORD),
      role: "reseller",
      fullName: "Reseller",
      permissions: ["batches:write", "analytics:read", "events:read"],
    },
    {
      email: read(process.env.GENERIC_DEMO_EMAIL || process.env.NEXT_PUBLIC_GENERIC_DEMO_EMAIL, "viewer@example.com"),
      password: read(process.env.GENERIC_DEMO_PASSWORD || process.env.NEXT_PUBLIC_GENERIC_DEMO_PASSWORD),
      role: "viewer",
      fullName: "Demo Viewer",
      permissions: ["analytics:read", "events:read"],
    },
  ];
}

export function shouldAllowPresetProvisioning(context: "login" | "bootstrap") {
  if (context === "bootstrap") return true;
  const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const demoModeEnabled = String(process.env.DEMO_MODE || process.env.DASHBOARD_DEMO_MODE || "").toLowerCase() === "true";
  return !isProduction || demoModeEnabled;
}

export function getBootstrapMissingEnvNames() {
  const required = ["DATABASE_URL", "SUPER_ADMIN_EMAIL", "SUPER_ADMIN_PASSWORD"];
  return required.filter((name) => String(process.env[name] || "").trim().length === 0);
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

export async function ensurePresetUser(
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any>,
  email: string,
  options: { context?: "login" | "bootstrap" } = {},
) {
  const context = options.context || "login";
  if (!shouldAllowPresetProvisioning(context)) return null;
  const preset = getAuthPresets().find((item) => item.email.toLowerCase() === email.toLowerCase());
  if (!preset) return null;
  if (!preset.password) return null;

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

export async function ensureAllPresetUsers(sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any>) {
  const presets = getAuthPresets();
  const ensured: string[] = [];
  for (const preset of presets) {
    if (!preset.password) continue;
    const result = await ensurePresetUser(sql, preset.email, { context: "bootstrap" });
    if (result) ensured.push(result.email);
  }
  return ensured;
}
