import { hashPassword } from "./password";
import { parsePermissionGrant } from "./admin-user-management-policy";

type Preset = {
  email: string;
  password: string;
  role: "super_admin" | "tenant_admin" | "operations_manager" | "marketing_manager" | "reseller" | "viewer";
  fullName: string;
  permissions: string[];
};

export const COMMERCIAL_AUTH_PRESET_PERMISSIONS = Object.freeze({
  tenant_admin: [
    "crm:read",
    "campaigns:read",
    "campaigns:write",
    "rewards:read",
    "rewards:write",
    "rewards:validate",
    "marketplace:read",
    "marketplace:write",
  ],
  operations_manager: ["rewards:validate"],
  marketing_manager: [
    "crm:read",
    "campaigns:read",
    "campaigns:write",
    "rewards:read",
    "marketplace:read",
  ],
} as const);

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
      permissions: ["users:manage", "tenants:write", "batches:write", "supplier:qa", "tags:read", "tags:write", "analytics:read", "events:read", "incidents:read", "incidents:write", "tokenization:read", "tokenization:write"],
    },
    {
      email: read(process.env.TENANT_ADMIN_EMAIL || process.env.BODEGA_ADMIN_EMAIL || process.env.NEXT_PUBLIC_TENANT_ADMIN_EMAIL, "tenant-admin@example.com"),
      password: read(process.env.TENANT_ADMIN_PASSWORD || process.env.BODEGA_ADMIN_PASSWORD || process.env.NEXT_PUBLIC_TENANT_ADMIN_PASSWORD),
      role: "tenant_admin",
      fullName: "Tenant Admin",
      permissions: [
        "users:manage", "batches:write", "supplier:qa", "tags:read", "tags:write",
        "analytics:read", "events:read", "incidents:read", "incidents:write",
        "tokenization:read", "tokenization:write",
        ...COMMERCIAL_AUTH_PRESET_PERMISSIONS.tenant_admin,
      ],
    },
    {
      email: read(process.env.TENANT_OPS_EMAIL || process.env.NEXT_PUBLIC_TENANT_OPS_EMAIL, "tenant-ops@example.com"),
      password: read(process.env.TENANT_OPS_PASSWORD),
      role: "operations_manager",
      fullName: "Operations Manager",
      permissions: [
        "batches:read", "batches:write", "tags:read", "tags:write", "events:read",
        "incidents:read", "incidents:write", "proof:read", "tokenization:read",
        "tokenization:write", "analytics:read", "demo:read", "demo:run",
        ...COMMERCIAL_AUTH_PRESET_PERMISSIONS.operations_manager,
      ],
    },
    {
      email: read(process.env.TENANT_GROWTH_EMAIL || process.env.NEXT_PUBLIC_TENANT_GROWTH_EMAIL, "tenant-growth@example.com"),
      password: read(process.env.TENANT_GROWTH_PASSWORD),
      role: "marketing_manager",
      fullName: "Marketing Manager",
      permissions: [
        "events:read", "analytics:read", "demo:read",
        ...COMMERCIAL_AUTH_PRESET_PERMISSIONS.marketing_manager,
      ],
    },
    {
      email: read(process.env.RESELLER_EMAIL || process.env.NEXT_PUBLIC_RESELLER_EMAIL, "reseller@example.com"),
      password: read(process.env.RESELLER_PASSWORD || process.env.NEXT_PUBLIC_RESELLER_PASSWORD),
      role: "reseller",
      fullName: "Reseller",
      permissions: ["batches:write", "tags:read", "analytics:read", "events:read", "tokenization:read"],
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

  const tenantIdForMembership = preset.role === "super_admin" ? null : await resolveDemoTenantId(sql);
  if (preset.role !== "super_admin" && !tenantIdForMembership) return null;

  const existing = await sql`SELECT id FROM users WHERE email = ${preset.email} LIMIT 1`;
  const userId = existing[0]?.id || (await sql`INSERT INTO users (email, full_name) VALUES (${preset.email}, ${preset.fullName}) RETURNING id`)[0]?.id;
  if (!userId) return null;

  const membershipRows = await sql`
    SELECT id, tenant_id, role::text AS role
    FROM memberships
    WHERE user_id = ${userId}::uuid
    ORDER BY created_at ASC, id ASC
    LIMIT 2
  `;
  // Preset provisioning must never manufacture a second authority path or
  // silently re-role an existing identity. Reconcile legacy demo memberships
  // through the audited admin flow before enabling the corresponding preset.
  if (membershipRows.length > 1
    || (membershipRows[0] && String(membershipRows[0].role) !== preset.role)) {
    return null;
  }
  if (preset.role === "super_admin" && membershipRows[0]?.tenant_id) {
    // Never turn a historical tenant-bound super-admin into global authority
    // implicitly. Runtime rejects it until an audited reconciliation occurs.
    return null;
  } else if (preset.role !== "super_admin"
    && membershipRows[0]
    && String(membershipRows[0].tenant_id) !== String(tenantIdForMembership)) {
    return null;
  }

  const pwdRows = await sql`SELECT user_id FROM password_credentials WHERE user_id = ${userId}::uuid LIMIT 1`;
  if (!pwdRows[0]) {
    await sql`INSERT INTO password_credentials (user_id, password_hash) VALUES (${userId}::uuid, ${hashPassword(preset.password)})`;
  }

  if (!membershipRows[0]) {
    await sql`INSERT INTO memberships (user_id, tenant_id, role) VALUES (${userId}::uuid, ${tenantIdForMembership}::uuid, ${preset.role}::membership_role)`;
  }

  for (const entry of preset.permissions) {
    const grant = parsePermissionGrant(entry);
    if (grant) {
      await sql`INSERT INTO resource_permissions (user_id, tenant_id, resource, action) VALUES (${userId}::uuid, ${tenantIdForMembership}::uuid, ${grant.resource}, ${grant.action}) ON CONFLICT DO NOTHING`;
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
