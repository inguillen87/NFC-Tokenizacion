import { fetchConsumerPath, requireConsumerSession } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";

type Privacy = { consumer?: { email?: string; display_name?: string; preferred_locale?: string }; consents?: Array<{ tenant_id?: string; scope?: string; granted?: boolean }> };

export default async function PrivacyPage() {
  await requireConsumerSession("/me/privacy");
  const privacy = (await fetchConsumerPath("privacy")) as Privacy | null;
  const consentRows = Array.isArray(privacy?.consents) ? privacy!.consents! : [];

  return (
    <PortalShell title="Privacidad" subtitle="Controles básicos de sesión/perfil y consentimiento por tenant (si existe en esquema).">
      <section className="rounded-xl border border-white/10 bg-slate-950/70 p-4 text-sm">
        <p className="text-white">Perfil: <b className="text-cyan-100">{privacy?.consumer?.display_name || privacy?.consumer?.email || "consumer"}</b></p>
        <p className="mt-1 text-slate-300">Locale preferido: <b>{privacy?.consumer?.preferred_locale || "es-AR"}</b></p>
        <p className="mt-3 text-xs uppercase tracking-[0.12em] text-slate-500">Consentimientos por tenant</p>
        <div className="mt-2 space-y-1">
          {consentRows.length ? consentRows.slice(0, 8).map((item, idx) => (
            <p key={`${item.tenant_id || "tenant"}-${item.scope || idx}`} className="text-xs text-slate-300">
              tenant {item.tenant_id || "n/a"} · {item.scope || "scope"} · {item.granted ? "granted" : "revoked"}
            </p>
          )) : <p className="text-xs text-slate-400">Sin registros de consentimiento todavía.</p>}
        </div>
      </section>
    </PortalShell>
  );
}
