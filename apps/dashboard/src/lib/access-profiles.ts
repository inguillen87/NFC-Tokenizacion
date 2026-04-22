import type { UserRole } from "./dashboard-content";

export type AccessProfile = {
  key: string;
  role: UserRole;
  label: string;
  email: string;
  password: string;
  note: string;
  available: boolean;
};

function readEnv(...names: string[]) {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }
  return "";
}

function profile(base: Omit<AccessProfile, "email" | "password" | "available"> & {
  emailEnv: string[];
  passwordEnv: string[];
  fallbackEmail?: string;
  fallbackPassword?: string;
}): AccessProfile {
  const email = readEnv(...base.emailEnv) || String(base.fallbackEmail || "").trim();
  const password = readEnv(...base.passwordEnv) || String(base.fallbackPassword || "").trim();
  return {
    key: base.key,
    role: base.role,
    label: base.label,
    note: base.note,
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
      passwordEnv: ["SUPER_ADMIN_PASSWORD", "NEXT_PUBLIC_SUPER_ADMIN_PASSWORD"],
      fallbackEmail: "inguillen@nexid.lat",
      fallbackPassword: "Marcelog2026",
      note: "Control total de tenants, batches, seguridad y flows críticos.",
    }),
    profile({
      key: "tenant-admin",
      role: "tenant-admin",
      label: "Tenant Admin DemoBodega",
      emailEnv: ["TENANT_ADMIN_EMAIL", "BODEGA_ADMIN_EMAIL", "NEXT_PUBLIC_TENANT_ADMIN_EMAIL"],
      passwordEnv: ["TENANT_ADMIN_PASSWORD", "BODEGA_ADMIN_PASSWORD", "NEXT_PUBLIC_TENANT_ADMIN_PASSWORD"],
      fallbackEmail: "demobodega@nexid.lat",
      fallbackPassword: "DemoBodega2026",
      note: "Admin de ejemplo para operar lotes, tags y manifest del tenant demo.",
    }),
    profile({
      key: "reseller",
      role: "reseller",
      label: "Reseller Demo",
      emailEnv: ["RESELLER_EMAIL", "NEXT_PUBLIC_RESELLER_EMAIL"],
      passwordEnv: ["RESELLER_PASSWORD", "NEXT_PUBLIC_RESELLER_PASSWORD"],
      fallbackEmail: "partner.demo@nexid.lat",
      fallbackPassword: "NexidPartner2026",
      note: "Perfil ejemplo para canal white-label y operación partner.",
    }),
    profile({
      key: "demo-generic",
      role: "viewer",
      label: "Demo Generic",
      emailEnv: ["GENERIC_DEMO_EMAIL", "NEXT_PUBLIC_GENERIC_DEMO_EMAIL"],
      passwordEnv: ["GENERIC_DEMO_PASSWORD", "NEXT_PUBLIC_GENERIC_DEMO_PASSWORD"],
      fallbackEmail: "demo@nexid.lat",
      fallbackPassword: "NexidDemo2026",
      note: "Usuario demo genérico para entrar rápido y alternar roles no críticos en la UI.",
    }),
  ];
}
