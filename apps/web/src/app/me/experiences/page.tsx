import Link from "next/link";
import { CalendarDays, MessageSquareText, ShieldCheck, Sparkles, Star, Store, TicketCheck, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { asArray, buildConsumerNextPath, fetchConsumerPath, requireConsumerSession } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";
import { VerifiedExperienceForm } from "./verified-experience-form";

type VerifiedExperience = {
  id?: string;
  product_name?: string;
  tenant_slug?: string;
  rating?: number;
  title?: string | null;
  body?: string | null;
  city?: string | null;
  country?: string | null;
  trust_score?: number | null;
  trust_score_status?: string;
  moderation_status?: string;
  visibility?: string;
  verification_badges?: string[];
  created_at?: string;
};

function statusCopy(status?: string) {
  if (status === "approved") return "Publicada";
  if (status === "needs_brand_response") return "Respuesta de marca";
  if (status === "rejected") return "No publicada";
  return "En revisión";
}

function badgeCopy(value: string) {
  const map: Record<string, string> = {
    tap_fisico_confirmado: "Evento NFC asociado",
    contacto_validado: "Contacto validado",
    dueno_verificado: "Ownership registrado",
    producto_guardado: "Producto guardado",
    foto_de_uso_real: "Foto aportada",
  };
  return map[value] || value.replace(/_/g, " ");
}

export default async function ConsumerExperiencesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  await requireConsumerSession(buildConsumerNextPath("/me/experiences", params));
  const tenant = typeof params.tenant === "string" ? params.tenant : "";
  const eventId = typeof params.eventId === "string" ? params.eventId : "";
  const productName = typeof params.product === "string" ? params.product : "";
  const payload = (await fetchConsumerPath("experiences")) as { verifiedExperiences?: unknown } | null;
  const verifiedExperiences = asArray<VerifiedExperience>(payload?.verifiedExperiences);

  return (
    <PortalShell
      title="Mis Experiencias & Reseñas"
      subtitle="Opiniones, check-ins y feedback con evidencia de interacción y moderación. No prueban uso, procedencia ni autenticidad física del producto."
    >
      <div className="space-y-6">
        
        {/* Review Form Container */}
        <VerifiedExperienceForm initialEventId={eventId} initialProductName={productName} tenant={tenant} />

        {/* Proof-of-Tap explanation card */}
        <section className="rounded-3xl border border-emerald-500/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_32%),linear-gradient(135deg,#0a0a0c,#131316)] p-6 shadow-2xl">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Reseñas con Evidencia de Interacción</p>
              <h2 className="mt-3 text-xl font-black text-white tracking-tight leading-none">Tu opinión queda ligada a una interacción registrada</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Cada opinión publicada exige una referencia de evento NFC, contacto validado o un registro de ownership en el Passport. Esa evidencia reduce anonimato, pero no demuestra uso, procedencia ni condición física.
              </p>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {[
                { title: "Evidencia de Interacción", detail: "Evento NFC, contacto o ownership registrado.", Icon: ShieldCheck },
                { title: "Comunidad Moderada", detail: "Opiniones asociadas a producto y lote declarados.", Icon: Sparkles },
              ].map(({ title, detail, Icon }) => (
                <div key={title} className="rounded-2xl border border-white/5 bg-slate-950/60 p-4">
                  <Icon className="h-4.5 w-4.5 text-emerald-300" aria-hidden="true" />
                  <p className="mt-2 text-xs font-black text-white">{title}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* My reviews list */}
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Mis Opiniones Publicadas</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Moderadas bajo los estándares de calidad de cada bodega.</p>
            </div>
            <Link href={tenant ? `/me/products?tenant=${encodeURIComponent(tenant)}` : "/me/products"} className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20 transition">
              Ver Vinos a Opinar
            </Link>
          </div>
          
          {verifiedExperiences.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {verifiedExperiences.map((experience) => {
                const hasTrustScore = experience.trust_score_status !== "not_computed"
                  && typeof experience.trust_score === "number"
                  && Number.isFinite(experience.trust_score);
                return (
                <article key={experience.id || `${experience.product_name}-${experience.created_at}`} className="rounded-2xl border border-white/5 bg-slate-950/60 p-5 transition duration-300 hover:border-white/10 hover:shadow-lg">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-wider text-cyan-300 font-mono">{experience.tenant_slug || "tenant"}</span>
                      <h4 className="mt-1 text-sm font-black text-white truncate leading-snug">{experience.product_name || "Producto asociado"}</h4>
                      <p className="mt-1 text-[10px] text-slate-400 flex items-center gap-1">
                        {[experience.city, experience.country].filter(Boolean).join(", ") || "Ubicación privada"}
                      </p>
                    </div>
                    
                    {/* Star Rating */}
                    <div className="flex items-center gap-1 rounded-full border border-amber-300/25 bg-amber-500/10 px-2.5 py-1 text-xs font-black text-amber-200 shadow-inner">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                      {Number(experience.rating || 0).toFixed(1)}
                    </div>
                  </div>
                  
                  <p className="mt-3.5 text-xs font-black text-white">{experience.title || "Experiencia de Producto"}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{experience.body || "Opinión pendiente de completar."}</p>
                  
                  {/* Badges block */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/5 px-2 py-0.5 text-[9px] font-medium text-cyan-300">
                      {hasTrustScore ? `Trust Score ${experience.trust_score}/100` : "Trust Score no calculado"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-medium text-slate-300">{statusCopy(experience.moderation_status)}</span>
                    {(experience.verification_badges || []).slice(0, 4).map((badge) => (
                      <span key={badge} className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5 text-[9px] font-medium text-emerald-300">{badgeCopy(badge)}</span>
                    ))}
                  </div>
                </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-cyan-500/20 bg-cyan-500/5 p-6 text-center">
              <MessageSquareText className="mx-auto h-8 w-8 text-slate-600 animate-pulse" aria-hidden="true" />
              <p className="mt-3 text-xs font-black text-white">Todavía no dejaste experiencias con evidencia</p>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500 max-w-sm mx-auto">
                Asociá una interacción elegible, validá tu contacto y dejá una opinión sujeta a moderación.
              </p>
            </div>
          )}
        </section>

        {/* Bottom Quick Links Navigation */}
        <section className="grid gap-3 md:grid-cols-3">
          {[
            { title: "Marketplace", detail: "Explora drops y beneficios del club.", href: tenant ? `/me/marketplace?tenant=${encodeURIComponent(tenant)}` : "/me/marketplace", Icon: Store },
            { title: "Wallet/NFT", detail: "Confirma propiedad antes de pedir accesos.", href: tenant ? `/me/wallet?tenant=${encodeURIComponent(tenant)}` : "/me/wallet", Icon: WalletCards },
            { title: "Rewards", detail: "Puntos y eventos ligados a tu Pasaporte.", href: tenant ? `/me/rewards?tenant=${encodeURIComponent(tenant)}` : "/me/rewards", Icon: TicketCheck },
          ].map(({ title, detail, href, Icon }) => (
            <Link key={title} href={href} className="rounded-2xl border border-white/5 bg-slate-950/60 p-4 transition-all duration-300 hover:border-cyan-500/20 hover:bg-slate-950/80">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black text-white">{title}</p>
                <Icon className="h-4.5 w-4.5 text-cyan-300" aria-hidden="true" />
              </div>
              <p className="mt-1.5 text-[9px] leading-normal text-slate-400">{detail}</p>
            </Link>
          ))}
        </section>

        {/* Upcoming Experiences Block */}
        <section>
          <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">Próximas Reservas & Visitas</h3>
          <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-5">
            <CalendarDays className="h-6 w-6 text-slate-600 animate-pulse" aria-hidden="true" />
            <p className="mt-3 text-xs font-semibold text-white leading-none">Sin reservas activas por el momento.</p>
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
              Cuando la bodega confirme tu reserva para degustación o cena exclusiva, se detallará el ticket QR y la locación aquí.
            </p>
          </div>
        </section>

        {/* Check-ins History block */}
        <section>
          <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">Historial de Visitas</h3>
          <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-5 text-[10px] leading-relaxed text-slate-500">
            Todavía no posees asistencias registradas. Realiza check-in al ingresar a los viñedos para acumular puntos adicionales de fidelización.
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
