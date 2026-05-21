import Link from "next/link";
import { Badge, Card, SectionHeading } from "@product/ui";
import { VerifiedExperiencesPanel } from "../../../../components/verified-experiences-panel";
import { requireDashboardSession } from "../../../../lib/session";
import { getServerOrigin } from "../../../../lib/server-origin";
import type { VerifiedExperienceItem } from "../../../../components/verified-experiences-panel";

const clubControls = [
  {
    title: "Quien puede opinar",
    body: "Tap fisico fresco, contacto validado y producto guardado, reclamado o comprado segun politica del lote.",
    status: "Owner-safe",
  },
  {
    title: "Que puede publicar",
    body: "Estrellas, comentario, fotos opcionales, pais aproximado, idioma original y traduccion automatica.",
    status: "Privacidad",
  },
  {
    title: "Como se protege la marca",
    body: "Moderacion previa, filtro de lenguaje, score anti-spam, derecho de respuesta y bloqueo por riesgo.",
    status: "Brand-safe",
  },
  {
    title: "Que gana el negocio",
    body: "Prueba social real, feedback por lote, club VIP, marketplace mas confiable y mas valor para el certificado.",
    status: "Growth",
  },
];

const eventClubs = [
  {
    name: "Club Terroir",
    product: "Vinos premium",
    members: "842 miembros",
    signal: "4.9 estrellas verificadas",
    body: "Dueños y compradores comparten experiencia, apertura, guarda, reventa y recomendaciones.",
  },
  {
    name: "Beauty Passport",
    product: "Cosmetica y perfume",
    members: "510 miembros",
    signal: "87% compra validada",
    body: "Comentarios visibles solo si existe tap, ticket, garantia o producto guardado.",
  },
  {
    name: "VIP Access",
    product: "Eventos y pulseras",
    members: "1.120 miembros",
    signal: "Check-in real",
    body: "Experiencias del evento con ingreso verificado y beneficios posteriores.",
  },
];

type AdminExperiencesPayload = {
  items?: VerifiedExperienceItem[];
  moderation?: {
    pending?: number;
    approved?: number;
    needsBrandResponse?: number;
  };
};

async function adminGet(origin: string, path: string) {
  try {
    const response = await fetch(`${origin}/api/admin/${path.replace(/^\/?admin\//, "")}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function statusCopy(status?: string | null) {
  if (status === "approved") return "Lista para publicar";
  if (status === "needs_brand_response") return "Respuesta de marca";
  if (status === "rejected") return "No publicar";
  if (status === "private") return "Uso privado";
  return "Revisar evidencia";
}

export default async function ExperiencesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = searchParams ? await searchParams : {};
  const session = await requireDashboardSession();
  const requestedTenant = typeof query.tenant === "string" ? query.tenant : "";
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : requestedTenant;
  const origin = await getServerOrigin();
  const tenantQuery = tenantScope ? `?tenant=${encodeURIComponent(tenantScope)}&limit=50` : "?limit=50";
  const experiencesRaw = (await adminGet(origin, `/admin/consumer-experiences${tenantQuery}`)) as AdminExperiencesPayload | null;
  const experiences = Array.isArray(experiencesRaw?.items) ? experiencesRaw.items : [];
  const pendingReviews = experiences.length
    ? experiences.slice(0, 8).map((review) => ({
        product: String(review.product_name || review.product || "Producto verificado"),
        user: [review.city, review.country].filter(Boolean).join(", ") || String(review.tenant_slug || "tenant"),
        score: `${Number(review.trust_score || 0)}/100`,
        state: statusCopy(review.moderation_status),
      }))
    : [
        { product: "Sin experiencias reales todavia", user: "Esperando primer tap + ownership", score: "0/100", state: "Activar modulo" },
      ];

  return (
    <main className="space-y-8">
      <SectionHeading
        eyebrow="Loyalty + social proof"
        title="Experiencias verificadas"
        description="Una capa social premium: opiniones reales, moderadas y traducidas, solo de usuarios con evidencia del producto."
      />

      <VerifiedExperiencesPanel mode="loyalty" items={experiences} moderation={experiencesRaw?.moderation} />

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-cyan-200">Politica para marcas premium</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              La marca decide si publica automatico, si modera antes de mostrar o si solo usa el feedback privado.
              El usuario entiende el beneficio y la empresa evita reviews falsas o destructivas.
            </p>
          </div>
          <Badge tone="green">verified only</Badge>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {clubControls.map((item) => (
            <article key={item.title} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100">{item.status}</span>
              <h3 className="mt-3 text-base font-black text-white">{item.title}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-400">{item.body}</p>
            </article>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="p-5 sm:p-6">
          <h2 className="text-sm font-black uppercase tracking-[0.16em] text-cyan-200">Cola operativa</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Auditor, tenant admin o marca pueden aprobar, traducir, pedir evidencia o responder desde un mismo lugar.
          </p>
          <div className="mt-5 space-y-3">
            {pendingReviews.map((review) => (
              <div key={`${review.product}-${review.user}`} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">{review.product}</p>
                    <p className="mt-1 text-xs text-slate-400">{review.user}</p>
                  </div>
                  <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-100">{review.score}</span>
                </div>
                <p className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">{review.state}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-cyan-200">Clubes vivos por vertical</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                El producto deja de ser una validacion aislada y se convierte en comunidad, beneficio y reputacion.
              </p>
            </div>
            <Link href="/consumer-network/marketplace" className="rounded-xl border border-violet-300/30 bg-violet-500/10 px-3 py-2 text-xs font-bold text-violet-100">
              Ver marketplace
            </Link>
          </div>
          <div className="mt-5 grid gap-3">
            {eventClubs.map((club) => (
              <article key={club.name} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-white">{club.name}</h3>
                    <p className="text-xs text-slate-400">{club.product}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="cyan">{club.members}</Badge>
                    <Badge tone="green">{club.signal}</Badge>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{club.body}</p>
              </article>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
