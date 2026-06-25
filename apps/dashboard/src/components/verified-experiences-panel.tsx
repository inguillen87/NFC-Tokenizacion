import Link from "next/link";
import { Badge, Card } from "@product/ui";

type PanelMode = "overview" | "loyalty" | "marketplace";

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
};

const rules = [
  { step: "01", title: "Tap físico", body: "La persona toca el producto real. Si hay replay o clon, no puede opinar." },
  { step: "02", title: "Identidad", body: "Email, celular, wallet o cuenta nexID validada antes de publicar." },
  { step: "03", title: "Vínculo", body: "Producto guardado, club activo, ticket, retailer u ownership según política." },
  { step: "04", title: "Review segura", body: "Estrellas, comentario, fotos opcionales, idioma y país aproximado." },
  { step: "05", title: "Marca protegida", body: "Moderación, respuesta de marca, score anti-spam y privacidad." },
];

const fallbackExperiences = [
  {
    product: "Gran Reserva Malbec",
    tenant: "Bodega Balmec",
    stars: "5.0",
    location: "Zúrich, CH",
    badge: "Dueño verificado",
    quote: "La botella llegó intacta; pude ver origen, apertura y certificado desde el teléfono.",
    trust: 96,
    status: "Aprobada",
  },
  {
    product: "Sérum premium",
    tenant: "Cosmética Lumina",
    stars: "4.8",
    location: "São Paulo, BR",
    badge: "Compra validada",
    quote: "El sello me mostró que era auténtico antes de abrir la caja. La garantía quedó guardada.",
    trust: 91,
    status: "Traducida",
  },
  {
    product: "Pulsera VIP evento",
    tenant: "Arena Passport",
    stars: "4.7",
    location: "Miami, US",
    badge: "Tap físico confirmado",
    quote: "Entré al evento con el tap y después vi beneficios del club sin pedir soporte.",
    trust: 88,
    status: "Pendiente marca",
  },
];

const moderationQueue = [
  { item: "Whisky edición limitada", reason: "Foto real pendiente", action: "Solicitar evidencia", tone: "warn" },
  { item: "Perfume colección", reason: "Comentario negativo con compra real", action: "Responder marca", tone: "good" },
  { item: "Entrada corporativa", reason: "Lenguaje detectado", action: "Revisar texto", tone: "risk" },
];

const socialProof = [
  "Marketplace con estrellas verificadas por dueños reales.",
  "Passport con historia del producto y experiencias de usuarios.",
  "Club VIP con reputación, países, lotes y feedback por segmento.",
  "NFT/certificado con eventos verificables, sin comentarios completos on-chain.",
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

function normalizeExperience(item: VerifiedExperienceItem) {
  const badges = readBadges(item.verification_badges);
  return {
    product: String(item.product_name || item.product || "Producto verificado"),
    tenant: String(item.tenant_slug || item.tenant || "tenant"),
    stars: Number(item.rating || 0) ? Number(item.rating || 0).toFixed(1) : "-",
    location: [item.city, item.country].filter(Boolean).join(", ") || "ubicación privada",
    badge: badges.includes("dueno_verificado")
      ? "Dueño verificado"
      : badges.includes("tap_fisico_confirmado")
        ? "Tap físico confirmado"
        : "Evidencia validada",
    quote: String(item.body || item.quote || item.title || "Experiencia pendiente de moderación."),
    trust: Math.max(0, Math.min(100, Number(item.trust_score || 0))),
    status: String(item.moderation_status || "pending"),
  };
}

function buildStats(items: VerifiedExperienceItem[], moderation?: VerifiedExperiencesPanelProps["moderation"]) {
  if (!items.length) {
    return [
      { label: "Módulo listo", value: "Owner-only", detail: "Solo publica quien tiene evidencia real" },
      { label: "Regla central", value: "Tap + ID", detail: "Tap fresco y contacto validado antes de opinar" },
      { label: "Moderación", value: "Activa", detail: "La marca aprueba, responde o mantiene privado" },
      { label: "Privacidad", value: "Hash/DB", detail: "Blockchain para eventos, no comentarios completos" },
    ];
  }
  const avgRating = items.reduce((acc, item) => acc + Number(item.rating || 0), 0) / items.length;
  const avgTrust = items.reduce((acc, item) => acc + Number(item.trust_score || 0), 0) / items.length;
  const locales = new Set(items.map((item) => String(item.original_locale || "").trim()).filter(Boolean));
  return [
    { label: "Experiencias verificadas", value: String(items.length), detail: "Solo con tap, contacto u ownership válido" },
    { label: "Promedio club", value: `${avgRating.toFixed(1)}/5`, detail: `Trust medio ${Math.round(avgTrust)}/100` },
    { label: "Moderación pendiente", value: String(moderation?.pending ?? items.filter((item) => item.moderation_status === "pending").length), detail: "Nada se publica sin política de marca" },
    { label: "Idiomas activos", value: String(Math.max(1, locales.size)), detail: "Original + traducción para el país del tap" },
  ];
}

function toneClass(tone: string) {
  if (tone === "good") return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
  if (tone === "warn") return "border-amber-300/25 bg-amber-500/10 text-amber-100";
  if (tone === "risk") return "border-rose-300/25 bg-rose-500/10 text-rose-100";
  return "border-cyan-300/25 bg-cyan-500/10 text-cyan-100";
}

export function VerifiedExperiencesPanel({ mode = "overview", items = [], moderation }: VerifiedExperiencesPanelProps) {
  const compact = mode === "marketplace";
  const stats = buildStats(items, moderation);
  const experiences = items.length ? items.slice(0, 3).map(normalizeExperience) : fallbackExperiences;

  return (
    <Card className="overflow-hidden p-0">
      <div className="dashboard-hero-panel dashboard-hero-panel--cyan border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">nexID Club</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Experiencias verificadas por dueños reales</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
              No son reviews abiertas de internet. Cada opinión nace de una prueba: tap fresco, contacto validado, producto guardado,
              compra u ownership según política del tenant. La marca gana prueba social sin perder control.
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
                <h3 className="mt-1 text-lg font-black text-white">De tap real a experiencia publicada</h3>
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
                  <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold text-cyan-100">Trust {experience.trust}/100</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-300">{experience.status}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Cola de moderación</p>
            <div className="mt-4 space-y-3">
              {moderationQueue.map((item) => (
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
              Contenido editable en base de datos. En blockchain se guarda ownership, hash, estado y eventos relevantes, no el comentario completo.
            </p>
          </div>
        </aside>
      </div>
    </Card>
  );
}
