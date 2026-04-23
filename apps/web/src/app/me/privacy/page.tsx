import { fetchConsumerPath } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";

type Privacy = { marketing_opt_in?: boolean; profile_visibility?: string; data_export_ready?: boolean; last_updated?: string };

export default async function PrivacyPage() {
  const privacy = (await fetchConsumerPath("privacy")) as Privacy | null;

  return (
    <PortalShell title="Privacidad" subtitle="Controlá consentimiento, visibilidad de perfil y exportación de tus datos.">
      <section className="rounded-xl border border-white/10 bg-slate-950/70 p-4 text-sm">
        <p className="text-white">Marketing opt-in: <b className="text-cyan-100">{privacy?.marketing_opt_in ? "Activo" : "Inactivo"}</b></p>
        <p className="mt-1 text-slate-300">Visibilidad: <b>{privacy?.profile_visibility || "private"}</b></p>
        <p className="mt-1 text-slate-300">Data export: <b>{privacy?.data_export_ready ? "Disponible" : "Pendiente"}</b></p>
        <p className="mt-3 text-xs text-slate-500">Última actualización: {privacy?.last_updated || "N/A"}</p>
      </section>
    </PortalShell>
  );
}
