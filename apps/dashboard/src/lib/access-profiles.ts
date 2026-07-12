import type { UserRole } from "./dashboard-content";

export type AccessProfile = {
  key: string;
  role: UserRole;
  label: string;
  email: string;
  password: string;
  note: string;
  permissions: string[];
  available: boolean;
};

export type PublicAccessProfile = Omit<AccessProfile, "password">;

function readEnv(...names: string[]) {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }
  return "";
}

function profile(
  base: Omit<AccessProfile, "email" | "password" | "available"> & {
    emailEnv: string[];
    passwordEnv: string[];
  },
): AccessProfile {
  const email = readEnv(...base.emailEnv);
  const password = readEnv(...base.passwordEnv);
  return {
    key: base.key,
    role: base.role,
    label: base.label,
    note: base.note,
    permissions: base.permissions,
    email,
    password,
    available: Boolean(email && password),
  };
}

export function getAccessProfiles(): AccessProfile[] {
  return [
    profile({
      key: "super-admin",
      role: "super-admin",
      label: "Super Admin",
      emailEnv: ["SUPER_ADMIN_EMAIL", "NEXT_PUBLIC_SUPER_ADMIN_EMAIL"],
      passwordEnv: ["SUPER_ADMIN_PASSWORD"],
      note: "Control total de tenants, batches, seguridad y flujos críticos.",
      permissions: ["*"],
    }),
    profile({
      key: "tenant-admin",
      role: "tenant-admin",
      label: "Admin tenant Bodega Balmec",
      emailEnv: ["TENANT_ADMIN_EMAIL", "BODEGA_ADMIN_EMAIL", "NEXT_PUBLIC_TENANT_ADMIN_EMAIL"],
      passwordEnv: ["TENANT_ADMIN_PASSWORD", "BODEGA_ADMIN_PASSWORD"],
      note: "Administrador operativo del tenant: lotes, tags, taps, marketplace, rewards y empleados.",
      permissions: ["tenant:*", "batches:*", "tags:*", "events:*", "proof:*", "tokenization:*", "analytics:*", "crm:*", "marketplace:*", "rewards:*", "employees:*"],
    }),
    profile({
      key: "tenant-ops",
      role: "tenant-admin",
      label: "Empleado Operaciones NFC",
      emailEnv: ["TENANT_OPS_EMAIL", "NEXT_PUBLIC_TENANT_OPS_EMAIL"],
      passwordEnv: ["TENANT_OPS_PASSWORD"],
      note: "Puede operar lotes, tags, taps, validación en tienda y alertas sin tocar facturación ni seguridad global.",
      permissions: ["batches:read", "batches:write", "tags:read", "tags:write", "events:read", "proof:read", "tokenization:read", "tokenization:write", "analytics:read", "rewards:validate"],
    }),
    profile({
      key: "tenant-growth",
      role: "tenant-admin",
      label: "Empleado CRM & Growth",
      emailEnv: ["TENANT_GROWTH_EMAIL", "NEXT_PUBLIC_TENANT_GROWTH_EMAIL"],
      passwordEnv: ["TENANT_GROWTH_PASSWORD"],
      note: "Puede ver clientes, segmentos, campañas, vouchers y performance comercial del tenant.",
      permissions: ["events:read", "analytics:read", "crm:read", "campaigns:read", "campaigns:write", "rewards:read", "marketplace:read"],
    }),
  ];
}

export function getPublicAccessProfiles(): PublicAccessProfile[] {
  return getAccessProfiles().map(({ password: _password, ...profile }) => profile);
}
