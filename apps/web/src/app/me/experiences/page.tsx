import Link from "next/link";
import { CalendarDays, MessageSquareText, ShieldCheck, Sparkles, Star, Store, TicketCheck, WalletCards } from "lucide-react";
import { asArray, buildConsumerNextPath, fetchConsumerPath, requireConsumerSession } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";

type VerifiedExperience = {
  id?: string;
  product_name?: string;
  tenant_slug?: string;
  rating?: number;
  title?: string | null;
  body?: string | null;
  city?: string | null;
  country?: string | null;
  trust_score?: number;
  moderation_status?: string;
  visibility?: string;
  verification_badges?: string[];
  created_at?: string;
};

function statusCopy(status?: string) {
  if (status === "approved") return "Publicada";
  if (status === "needs_brand_response") return "Respuesta de marca";
  if (status === "rejected") return "No publicada";
  return "En revision";
}

function badgeCopy(value: string) {
  const map: Record<string, string> = {
    tap_fisico_confirmado: "Tap fisico",
    contacto_validado: "Contacto validado",
    dueno_verificado: "Dueno verificado",
    producto_guardado: "Producto guardado",
    foto_de_uso_real: "Foto real",
  };
  return map[value] || value.replace(/_/g, " ");
}

export default async function ConsumerExperiencesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  await requireConsumerSession(buildConsumerNextPath("/me/experiences", params));
  const tenant = typeof params.tenant === "string" ? params.tenant : "";
  const payload = (await fetchConsumerPath("experiences")) as { verifiedExperiences?: unknown } | null;
  const verifiedExperiences = asArray<VerifiedExperience>(payload?.verifiedExperiences);

  return (
    <PortalShell
      title="Mis experiencias"
      subtitle="Opiniones, beneficios y accesos que nacen de productos reales: tap fisico, contacto validado y ownership cuando corresponde."
    >
      <div className="space-y-8">
        <section className="rounded-3xl border border-emerald-300/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.9),rgba(2,6,23,0.96))] p-5 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Experiencias verificadas</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white">No es una review anonima. Es prueba social con evidencia.</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/82">
                Cuando un producto queda guardado, reclamado o asociado a tu club, podes dejar una experiencia con estrellas,
                comentario y fotos opcionales. La marca la modera antes de publicarla para proteger productos premium.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { title: "Solo con evidencia", detail: "Tap fresco, producto guardado o ownership activo.", Icon: ShieldCheck },
                { title: "Club premium", detail: "Experiencias por pais, lote, edicion y comunidad.", Icon: Sparkles },
              ].map(({ title, detail, Icon }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <Icon className="h-5 w-5 text-emerald-200" aria-hidden="true" />
                  <p className="mt-3 text-sm font-black text-white">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Mis opiniones verificadas</h2>
              <p className="mt-1 text-xs text-slate-500">La publicacion depende de la politica de cada marca.</p>
            </div>
            <Link href={tenant ? `/me/products?tenant=${encodeURIComponent(tenant)}` : "/me/products"} className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-100">
              Ver productos para opinar
            </Link>
          </div>
          {verifiedExperiences.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {verifiedExperiences.map((experience) => (
                <article key={experience.id || `${experience.product_name}-${experience.created_at}`} className="rounded-3xl border border-white/10 bg-slate-950/65 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">{experience.tenant_slug || "tenant"}</p>
                      <h3 className="mt-1 text-lg font-black text-white">{experience.product_name || "Producto verificado"}</h3>
                      <p className="mt-1 text-xs text-slate-400">{[experience.city, experience.country].filter(Boolean).join(", ") || "Ubicacion privada"}</p>
                    </div>
                    <div className="flex items-center gap-1 rounded-full border border-amber-300/25 bg-amber-500/10 px-3 py-1 text-sm font-black text-amber-100">
                      <Star className="h-4 w-4 fill-current" aria-hidden="true" />
                      {Number(experience.rating || 0).toFixed(1)}
                    </div>
                  </div>
                  <p className="mt-4 text-sm font-black text-white">{experience.title || "Experiencia del producto"}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{experience.body || "Opinion pendiente de completar."}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-[11px] font-black text-cyan-100">Trust {Number(experience.trust_score || 0)}/100</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-black text-slate-300">{statusCopy(experience.moderation_status)}</span>
                    {(experience.verification_badges || []).slice(0, 4).map((badge) => (
                      <span key={badge} className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2 py-1 text-[11px] font-black text-emerald-100">{badgeCopy(badge)}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-cyan-300/25 bg-cyan-500/10 p-6">
              <MessageSquareText className="h-7 w-7 text-cyan-100" aria-hidden="true" />
              <p className="mt-3 text-sm font-black text-white">Todavia no dejaste experiencias verificadas.</p>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-cyan-50/78">
                Guarda o reclama un producto, valida tu contacto y deja una opinion. Si la marca la aprueba,
                ayuda a otros compradores y suma reputacion al club del producto.
              </p>
            </div>
          )}
        </section>

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
