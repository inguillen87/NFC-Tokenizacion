import Link from "next/link";
import { CalendarDays, Store, TicketCheck, WalletCards } from "lucide-react";
import { buildConsumerNextPath, requireConsumerSession } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";

export default async function ConsumerExperiencesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  await requireConsumerSession(buildConsumerNextPath("/me/experiences", params));
  const tenant = typeof params.tenant === "string" ? params.tenant : "";

  return (
    <PortalShell
      title="Mis experiencias"
      subtitle="Reservas, accesos VIP y beneficios que se desbloquean desde productos verificados y ownership activo."
    >
      <div className="space-y-8">
        <section className="grid gap-3 md:grid-cols-3">
          {[
            { title: "Marketplace", detail: "Explora drops y experiencias del tenant asociado al tap.", href: tenant ? `/me/marketplace?tenant=${encodeURIComponent(tenant)}` : "/me/marketplace", Icon: Store },
            { title: "Wallet/NFT", detail: "Confirma ownership antes de pedir un acceso especial.", href: tenant ? `/me/wallet?tenant=${encodeURIComponent(tenant)}` : "/me/wallet", Icon: WalletCards },
            { title: "Beneficios", detail: "Promos y eventos quedan ligados a tu Passport.", href: tenant ? `/me/rewards?tenant=${encodeURIComponent(tenant)}` : "/me/rewards", Icon: TicketCheck },
          ].map(({ title, detail, href, Icon }) => (
            <Link key={title} href={href} className="rounded-2xl border border-white/10 bg-slate-950/65 p-4 transition hover:border-cyan-300/35 hover:bg-cyan-500/10">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-white">{title}</p>
                <Icon className="h-5 w-5 text-cyan-200" aria-hidden="true" />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
            </Link>
          ))}
        </section>

        <section>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-400">Proximas experiencias</h2>
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-6">
            <CalendarDays className="h-6 w-6 text-cyan-100" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-white">Sin reservas activas todavia.</p>
            <p className="mt-1 text-xs leading-5 text-cyan-50/78">
              Cuando una marca apruebe una solicitud, canje o invitacion, aparece aca con fecha, codigo y estado operativo.
            </p>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-400">Historial</h2>
          <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-6 text-sm leading-6 text-slate-300">
            Todavia no hay asistencias registradas. Hace check-in desde una experiencia aprobada para sumar puntos, demostrar presencia y mejorar tu trust score.
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
