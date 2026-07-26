import Link from "next/link";
import { Badge, Card, SectionHeading } from "@product/ui";
import { VerifiedExperiencesPanel } from "../../../../components/verified-experiences-panel";
import { requireDashboardSession } from "../../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../../lib/admin-page-access";
import type { VerifiedExperienceItem } from "../../../../components/verified-experiences-panel";
import type { ExperienceAvailability, ExperienceSource } from "../../../../components/verified-experiences-panel";

const clubControls = [
  {
    title: "Quién puede opinar",
    body: "Mensaje NFC fresco con veredicto válido, contacto validado y acción digital confirmada por la fuente según política del lote.",
    status: "Policy-gated",
  },
  {
    title: "Qué puede publicar",
    body: "Estrellas, comentario, fotos opcionales, país aproximado, idioma original y traducción automática.",
    status: "Privacidad",
  },
  {
    title: "Cómo se protege la marca",
    body: "Moderación previa, filtro de lenguaje, score anti-spam, derecho de respuesta y bloqueo por riesgo.",
    status: "Brand-safe",
  },
  {
    title: "Qué gana el negocio",
    body: "Prueba social sujeta a evidencia, feedback por lote, club VIP y una experiencia de marketplace más confiable.",
    status: "Growth",
  },
];

const eventClubExamples = [
  {
    name: "Club Terroir",
    product: "Vinos premium",
    members: "Membresía configurable",
    signal: "Rating de ejemplo",
    body: "Ejemplo de UX para experiencias, apertura, guarda, reventa y recomendaciones aprobadas.",
  },
  {
    name: "Beauty Passport",
    product: "Cosmética y perfume",
    members: "Membresía configurable",
    signal: "Compra: señal opcional",
    body: "Ejemplo de política: comentarios visibles sólo con evidencia aceptada por el tenant.",
  },
  {
    name: "VIP Access",
    product: "Eventos y pulseras",
    members: "Membresía configurable",
    signal: "Check-in de ejemplo",
    body: "Ejemplo visual de experiencias con ingreso registrado y beneficios posteriores.",
  },
];

type AdminExperiencesPayload = {
  items?: VerifiedExperienceItem[];
  moderation?: {
    pending?: number;
    approved?: number;
    needsBrandResponse?: number;
  };
  demoMode?: boolean;
  dataSource?: string;
};

type AdminExperiencesResult = {
  payload: AdminExperiencesPayload | null;
  availability: ExperienceAvailability;
  source: ExperienceSource;
};

async function adminGet(context: AdminPageContext, path: string): Promise<AdminExperiencesResult> {
  let response: Response;
  try {
    response = await fetchAdminPage(context, path);
  } catch {
    return { payload: null, availability: "unreachable", source: "unavailable" };
  }
  if (!response.ok) return { payload: null, availability: "upstream_error", source: "unavailable" };

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { payload: null, availability: "invalid_payload", source: "unavailable" };
  }
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as AdminExperiencesPayload).items)) {
    return { payload: null, availability: "invalid_payload", source: "unavailable" };
  }

  const typedPayload = payload as AdminExperiencesPayload;
  const source: ExperienceSource = typedPayload.demoMode === true || typedPayload.dataSource === "demo"
    ? "demo"
    : typedPayload.dataSource === "production"
      ? "production"
      : "unconfirmed";
  return { payload: typedPayload, availability: "ready", source };
}

function statusCopy(status?: string | null) {
  if (status === "approved") return "Lista para publicar";
  if (status === "needs_brand_response") return "Respuesta de marca";
  if (status === "rejected") return "No publicar";
  if (status === "private") return "Uso privado";
  return "Revisar evidencia";
}

function formatTrustScore(value?: number | string | null) {
  if (value === null || value === undefined || String(value).trim() === "") return "No informado";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "No informado";
  return `${Math.max(0, Math.min(100, parsed))}/100`;
}

export default async function ExperiencesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = searchParams ? await searchParams : {};
  const session = await requireDashboardSession();
  const adminContext = await createAdminPageContext(session, query.tenant);
  const experiencesResult = await adminGet(adminContext, "/admin/consumer-experiences?limit=50");
  const experiencesRaw = experiencesResult.payload;
  const experiences = Array.isArray(experiencesRaw?.items) ? experiencesRaw.items : [];
  const pendingReviews = experiencesResult.availability === "ready" && experiences.length
    ? experiences.slice(0, 8).map((review) => ({
        product: String(review.product_name || review.product || "Producto sin nombre reportado"),
        user: [review.city, review.country].filter(Boolean).join(", ") || String(review.tenant_slug || "tenant"),
        score: formatTrustScore(review.trust_score),
        state: statusCopy(review.moderation_status),
      }))
    : experiencesResult.availability === "ready"
      ? [{ product: "Sin experiencias registradas", user: "La fuente confirmó una lista vacía", score: "—", state: "Sin cola pendiente" }]
      : [{ product: "Fuente de experiencias no disponible", user: "No se infieren registros ni ceros", score: "—", state: "Reintentar cuando la API esté disponible" }];

  return (
    <main className="space-y-8" data-experiences-availability={experiencesResult.availability} data-experiences-source={experiencesResult.source}>
      <SectionHeading
        eyebrow="Loyalty + social proof"
        title="Experiencias verificadas"
        description={experiencesResult.availability === "ready"
          ? "Fuente conectada: experiencias y moderación se muestran sólo desde la respuesta del tenant."
          : "La fuente no está disponible; esta vista no reemplaza la falla con reviews ni métricas ficticias."}
      />

      <VerifiedExperiencesPanel
        mode="loyalty"
        items={experiences}
        moderation={experiencesRaw?.moderation}
        availability={experiencesResult.availability}
        source={experiencesResult.source}
      />

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-cyan-200">Política para marcas premium</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              La marca decide si publica automáticamente, si modera antes de mostrar o si sólo usa el feedback privado.
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
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-cyan-200">Clubes de ejemplo por vertical</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Fixtures de diseño: no representan miembros, ratings, compras ni check-ins observados.
              </p>
            </div>
            <Link href="/consumer-network/marketplace" className="rounded-xl border border-violet-300/30 bg-violet-500/10 px-3 py-2 text-xs font-bold text-violet-100">
              Ver marketplace
            </Link>
          </div>
          <div className="mt-5 grid gap-3">
            {eventClubExamples.map((club) => (
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
