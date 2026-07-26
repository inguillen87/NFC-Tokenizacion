import Link from "next/link";
import { Badge, Card } from "@product/ui";

type PanelMode = "overview" | "loyalty" | "marketplace";
export type ExperienceAvailability = "ready" | "upstream_error" | "unreachable" | "invalid_payload" | "fixture";
export type ExperienceSource = "production" | "demo" | "unconfirmed" | "unavailable";

export type VerifiedExperienceItem = {
  id?: string;
  product_name?: string | null;
  product?: string | null;
  tenant_slug?: string | null;
  tenant?: string | null;
  rating?: number | string | null;
  city?: string | null;
  country?: string | null;
  trust_score?: number | string | null;
  moderation_status?: string | null;
  title?: string | null;
  body?: string | null;
  quote?: string | null;
  verification_badges?: unknown;
  original_locale?: string | null;
};

type VerifiedExperiencesPanelProps = {
  mode?: PanelMode;
  items?: VerifiedExperienceItem[];
  moderation?: {
    pending?: number;
    approved?: number;
    needsBrandResponse?: number;
  };
  availability?: ExperienceAvailability;
  source?: ExperienceSource;
};

const rules = [
  { step: "01", title: "Evento NFC", body: "La persona presenta un mensaje NFC asociado. Replay o señales de riesgo bloquean según policy; no prueba el producto físico." },
  { step: "02", title: "Identidad", body: "Email, celular, wallet o cuenta nexID validada antes de publicar." },
  { step: "03", title: "Vínculo", body: "Producto guardado, club activo, ticket, retailer u ownership según política." },
  { step: "04", title: "Review segura", body: "Estrellas, comentario, fotos opcionales, idioma y país aproximado." },
  { step: "05", title: "Marca protegida", body: "Moderación, respuesta de marca, score anti-spam y privacidad." },
];

const exampleExperiences = [
  {
    product: "Gran Reserva Malbec",
    tenant: "Bodega Balmec",
    stars: "5.0",
    location: "Zúrich, CH",
    badge: "Ejemplo: titularidad digital confirmada",
    quote: "Ejemplo de cómo se mostraría una experiencia con evidencia aprobada.",
    trust: 96,
    status: "Aprobada",
  },
  {
    product: "Sérum premium",
    tenant: "Cosmética Lumina",
    stars: "4.8",
    location: "São Paulo, BR",
    badge: "Ejemplo: compra validada",
    quote: "Ejemplo visual de garantía y estado de sello; no es una review publicada.",
    trust: 91,
    status: "Traducida",
  },
  {
    product: "Pulsera VIP evento",
    tenant: "Arena Passport",
    stars: "4.7",
    location: "Miami, US",
    badge: "Ejemplo: evento NFC registrado",
    quote: "Ejemplo visual de ingreso y beneficios; no representa actividad observada.",
    trust: 88,
    status: "Pendiente marca",
  },
];

const moderationQueueExamples = [
  { item: "Whisky edición limitada", reason: "Foto real pendiente", action: "Solicitar evidencia", tone: "warn" },
  { item: "Perfume colección", reason: "Comentario negativo con compra real", action: "Responder marca", tone: "good" },
  { item: "Entrada corporativa", reason: "Lenguaje detectado", action: "Revisar texto", tone: "risk" },
];

const socialProof = [
  "Marketplace capaz de mostrar estrellas cuando la evidencia y moderación están confirmadas.",
  "Passport preparado para historia del producto y experiencias aprobadas.",
  "Club VIP configurable por países, lotes y segmentos.",
  "NFT/certificado opcional para eventos verificables, sin publicar comentarios completos.",
];

function readBadges(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function optionalScore(value: number | string | null | undefined, min: number, max: number) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeExperience(item: VerifiedExperienceItem) {
  const badges = readBadges(item.verification_badges);
  const rating = optionalScore(item.rating, 0, 5);
  const trust = optionalScore(item.trust_score, 0, 100);
  return {
    product: String(item.product_name || item.product || "Producto sin nombre reportado"),
    tenant: String(item.tenant_slug || item.tenant || "Tenant no informado"),
    stars: rating === null ? "Sin rating" : rating.toFixed(1),
    location: [item.city, item.country].filter(Boolean).join(", ") || "Ubicación no reportada",
    badge: badges.includes("dueno_verificado")
      ? "Titularidad digital confirmada"
      : badges.includes("tap_fisico_confirmado")
        ? "Evento NFC registrado"
        : "Sin badge de verificación",
    quote: String(item.body || item.quote || item.title || "Sin comentario publicado."),
    trust,
    status: String(item.moderation_status || "Estado no informado"),
  };
}

function buildStats(items: VerifiedExperienceItem[], moderation: VerifiedExperiencesPanelProps["moderation"], availability: ExperienceAvailability) {
  if (availability === "fixture") {
    return [
      { label: "Vista", value: "Ejemplo", detail: "Fixture de producto; no es actividad del tenant" },
      { label: "Regla propuesta", value: "Tap + ID", detail: "Política configurable antes de publicar" },
      { label: "Moderación", value: "Diseñada", detail: "Capacidad del módulo, no una cola activa" },
      { label: "Privacidad", value: "Hash/DB", detail: "Arquitectura propuesta para eventos y comentarios" },
    ];
  }
  if (availability !== "ready") {
    return [
      { label: "Experiencias", value: "No disponible", detail: "La fuente no confirmó registros ni ceros" },
      { label: "Promedio", value: "—", detail: "No calculado sin una respuesta válida" },
      { label: "Moderación", value: "—", detail: "Cola no disponible" },
      { label: "Idiomas", value: "—", detail: "Fuente no disponible" },
    ];
  }
  if (!items.length) {
    return [
      { label: "Experiencias", value: "Sin registros", detail: "La fuente confirmó una lista vacía" },
      { label: "Promedio", value: "—", detail: "Todavía no hay ratings para calcular" },
      { label: "Moderación", value: String(moderation?.pending ?? 0), detail: "Cero confirmado por la fuente" },
      { label: "Idiomas", value: "—", detail: "Todavía no hay experiencias publicadas" },
    ];
  }
  const ratings = items.map((item) => optionalScore(item.rating, 0, 5)).filter((value): value is number => value !== null);
  const trustScores = items.map((item) => optionalScore(item.trust_score, 0, 100)).filter((value): value is number => value !== null);
  const avgRating = ratings.length ? ratings.reduce((acc, value) => acc + value, 0) / ratings.length : null;
  const avgTrust = trustScores.length ? trustScores.reduce((acc, value) => acc + value, 0) / trustScores.length : null;
  const locales = new Set(items.map((item) => String(item.original_locale || "").trim()).filter(Boolean));
  const statusesAreReported = items.every((item) => typeof item.moderation_status === "string" && item.moderation_status.trim().length > 0);
  const pendingModeration = moderation?.pending ?? (statusesAreReported ? items.filter((item) => item.moderation_status === "pending").length : null);
  return [
    { label: "Experiencias con evidencia", value: String(items.length), detail: "Solo con mensaje NFC, identidad o titularidad digital según policy" },
    { label: "Promedio club", value: avgRating === null ? "—" : `${avgRating.toFixed(1)}/5`, detail: avgTrust === null ? "Trust no informado" : `Trust medio ${Math.round(avgTrust)}/100` },
    { label: "Moderación pendiente", value: pendingModeration === null ? "—" : String(pendingModeration), detail: pendingModeration === null ? "Estado no informado por la fuente" : "Nada se publica sin política de marca" },
    { label: "Idiomas activos", value: locales.size ? String(locales.size) : "—", detail: locales.size ? "Locales reportados por la fuente" : "Locale no informado" },
  ];
}

function toneClass(tone: string) {
  if (tone === "good") return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
  if (tone === "warn") return "border-amber-300/25 bg-amber-500/10 text-amber-100";
  if (tone === "risk") return "border-rose-300/25 bg-rose-500/10 text-rose-100";
  return "border-cyan-300/25 bg-cyan-500/10 text-cyan-100";
}

export function VerifiedExperiencesPanel({ mode = "overview", items = [], moderation, availability = "fixture", source = "unavailable" }: VerifiedExperiencesPanelProps) {
  const compact = mode === "marketplace";
  const stats = buildStats(items, moderation, availability);
  const experiences = availability === "ready"
    ? items.slice(0, 3).map(normalizeExperience)
    : availability === "fixture"
      ? exampleExperiences
      : [];
  const sourceLabel = availability === "fixture"
    ? "VISTA EJEMPLO"
    : source === "production"
      ? "FUENTE OPERATIVA"
      : source === "demo"
        ? "DATOS DEMO"
        : availability === "ready"
          ? "FUENTE SIN CONFIRMAR"
          : "FUENTE NO DISPONIBLE";
  const heading = availability === "fixture"
    ? "Cómo se verían experiencias con evidencia"
    : availability !== "ready"
      ? "Experiencias no disponibles"
      : items.length
        ? "Experiencias registradas con evidencia"
        : "Fuente confirmada sin experiencias";

  return (
    <Card className="overflow-hidden p-0">
      <div className="dashboard-hero-panel dashboard-hero-panel--cyan border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">nexID Club · {sourceLabel}</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">{heading}</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
              El contrato exige evidencia, identidad y política del tenant antes de publicar. Esta pantalla distingue registros confirmados,
              respuestas vacías, fallas de fuente y ejemplos visuales.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="green">brand-safe</Badge>
            <Badge tone="cyan">owner-only</Badge>
            <Badge>moderado</Badge>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{stat.label}</p>
              <p className="mt-2 text-2xl font-black text-white">{stat.value}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{stat.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={`grid gap-5 p-5 sm:p-6 ${compact ? "xl:grid-cols-[1.1fr_0.9fr]" : "xl:grid-cols-[1.2fr_0.8fr]"}`}>
        <section className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Política de publicación</p>
                <h3 className="mt-1 text-lg font-black text-white">De evento NFC a experiencia publicada</h3>
              </div>
              <Link href="/loyalty/experiences" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-100">
                Abrir módulo
              </Link>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              {rules.map((rule) => (
                <div key={rule.step} className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-500/10 text-xs font-black text-cyan-100">{rule.step}</span>
                  <p className="mt-3 text-sm font-black text-white">{rule.title}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{rule.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {experiences.map((experience) => (
              <article key={`${experience.tenant}-${experience.product}`} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">{experience.tenant}</p>
                    <h3 className="mt-1 text-base font-black text-white">{experience.product}</h3>
                    <p className="mt-1 text-xs text-slate-400">{experience.location}</p>
                  </div>
                  <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-1 text-xs font-black text-amber-100">{experience.stars}</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-200">&quot;{experience.quote}&quot;</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-100">{experience.badge}</span>
                  <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold text-cyan-100">
                    {experience.trust === null ? "Trust no informado" : `Trust ${experience.trust}/100`}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-300">{experience.status}</span>
                </div>
              </article>
            ))}
            {experiences.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/35 p-5 text-sm leading-6 text-slate-300 lg:col-span-3">
                {availability === "ready"
                  ? "La fuente confirmó que todavía no hay experiencias para mostrar."
                  : "No se muestran reviews de ejemplo como si fueran registros del tenant mientras la fuente no está disponible."}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Ejemplo de cola de moderación</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">Fixture de UX; no representa tickets abiertos.</p>
            <div className="mt-4 space-y-3">
              {moderationQueueExamples.map((item) => (
                <div key={item.item} className={`rounded-2xl border p-3 text-xs ${toneClass(item.tone)}`}>
                  <p className="font-black">{item.item}</p>
                  <p className="mt-1 opacity-80">{item.reason}</p>
                  <p className="mt-2 rounded-lg border border-current/20 px-2 py-1 font-bold">{item.action}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-violet-300/20 bg-violet-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-200">Valor comercial</p>
            <div className="mt-3 space-y-2">
              {socialProof.map((item) => (
                <p key={item} className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2 text-xs leading-5 text-slate-200">{item}</p>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-violet-100">
              Contenido editable en base de datos. En blockchain puede registrarse titularidad digital, hash, estado y eventos relevantes, no el comentario completo ni propiedad física.
            </p>
          </div>
        </aside>
      </div>
    </Card>
  );
}
