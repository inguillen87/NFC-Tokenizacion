import type { UserRole } from "./dashboard-content";

export type AccessProfile = {
  key: string;
  role: UserRole;
  label: string;
  email: string;
  password: string;
  note: string;
};

function read(value: string | undefined, fallback: string) {
  const normalized = (value || "").trim();
  return normalized || fallback;
}

export function getAccessProfiles(): AccessProfile[] {
  return [
    {
      key: "super-admin",
      role: "super-admin",
      label: "Super Admin",
      email: read(process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL, "inguillen@nexid.lat"),
      password: read(process.env.NEXT_PUBLIC_SUPER_ADMIN_PASSWORD, "Marcelog2026"),
      note: "Control total de tenants, batches, seguridad y flows críticos.",
    },
    {
      key: "tenant-admin",
      role: "tenant-admin",
      label: "Tenant Admin DemoBodega",
      email: read(process.env.NEXT_PUBLIC_TENANT_ADMIN_EMAIL, "demobodega@nexid.lat"),
      password: read(process.env.NEXT_PUBLIC_TENANT_ADMIN_PASSWORD, "DemoBodega2026"),
      note: "Admin de ejemplo para operar lotes, tags y manifest del tenant demo.",
    },
    {
      key: "reseller",
      role: "reseller",
      label: "Reseller Demo",
      email: read(process.env.NEXT_PUBLIC_RESELLER_EMAIL, "partner.demo@nexid.lat"),
      password: read(process.env.NEXT_PUBLIC_RESELLER_PASSWORD, "NexidPartner2026"),
      note: "Perfil ejemplo para canal white-label y operación partner.",
    },
    {
      key: "demo-generic",
      role: "viewer",
      label: "Demo Generic",
      email: read(process.env.NEXT_PUBLIC_GENERIC_DEMO_EMAIL, "demo@nexid.lat"),
      password: read(process.env.NEXT_PUBLIC_GENERIC_DEMO_PASSWORD, "NexidDemo2026"),
      note: "Usuario demo genérico para entrar rápido y alternar roles no críticos en la UI.",
    },
  ];
}
