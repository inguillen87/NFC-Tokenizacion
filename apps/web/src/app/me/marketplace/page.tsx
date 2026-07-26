import Link from "next/link";
import { ArrowRight, ShieldCheck, WalletCards } from "lucide-react";
import { asArray, buildConsumerNextPath, fetchConsumerPath, fetchMarketplacePath, requireConsumerSession } from "../_components/consumer-api";
import { resolveMarketplaceTenant } from "../_components/consumer-portal-model";
import { PortalShell } from "../_components/portal-shell";
import { MarketplaceGridClient } from "./marketplace-grid-client";

type Listing = {
  id: string;
  title?: string;
  brand?: string;
  brand_name?: string;
  points_price?: number;
  cash_price?: number;
  price_amount?: number;
  stock_status?: string;
  request_to_buy_enabled?: boolean;
  age_gate_required?: boolean;
};
type ConsumerProduct = { tenant_slug?: string | null; ownership_status?: string | null; ownership_record_status?: string | null };
type VerifiedExperience = {
  rating?: number;
  product_name?: string | null;
  tenant_slug?: string | null;
  country?: string | null;
  trust_score?: number | null;
  moderation_status?: string | null;
};

function marketplaceBrandName(slug?: string | null) {
  const normalized = String(slug || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "demobodega" || normalized === "bodega-balmec" || normalized === "bodegabalmec") return "Bodega Balmec";
  return String(slug || "").trim();
}

function averageRating(items: VerifiedExperience[]) {
  const ratings = items.map((item) => Number(item.rating || 0)).filter((value) => value > 0);
  if (!ratings.length) return "Sin datos";
  return (ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1);
}

export default async function MarketplacePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  await requireConsumerSession(buildConsumerNextPath("/me/marketplace", params));
  const tenantFromQuery = typeof params.tenant === "string" ? params.tenant : "";
  const consumerProductsPayload = await fetchConsumerPath("products");
  const consumerProducts = asArray<ConsumerProduct>(consumerProductsPayload);
  const contextualTenant = resolveMarketplaceTenant({ tenantFromQuery, products: consumerProducts });
  const payload = await fetchMarketplacePath(`products${contextualTenant ? `?tenant=${encodeURIComponent(contextualTenant)}` : ""}`);
  const experiencesPayload = (await fetchConsumerPath("experiences")) as { verifiedExperiences?: unknown } | null;
  const items = asArray<Listing>(payload);
  const experiences = asArray<VerifiedExperience>(experiencesPayload?.verifiedExperiences)
    .filter((item) => !contextualTenant || String(item.tenant_slug || "").toLowerCase() === contextualTenant.toLowerCase());
  const approvedExperiences = experiences.filter((item) => String(item.moderation_status || "").toLowerCase() === "approved");
  const proofCount = approvedExperiences.length || experiences.length;
  const rating = averageRating(approvedExperiences.length ? approvedExperiences : experiences);
  const tenantDisplayName = marketplaceBrandName(contextualTenant);

  return (
    <PortalShell
      title="Marketplace con evidencia"
      subtitle={contextualTenant
        ? `Productos, beneficios y reventa de ${tenantDisplayName}, conectados a eventos registrados.`
        : "Productos, beneficios y reventa para miembros nexID, sin comprar a ciegas."}
      notificationCount={items.length}
    >
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.4)] sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Compra con contexto</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
              Producto, certificado digital, club y experiencias moderadas antes de avanzar.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              La marca puede publicar productos, drops, recompra o beneficios. El usuario ve la evidencia digital disponible,
              el lote y origen declarados, las políticas del club y opiniones con interacción registrada. Eso no certifica autenticidad física ni procedencia.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              ["Catálogo", `${items.length}`, "Productos publicados para este contexto."],
              ["Reputación", rating, "Estrellas de experiencias moderadas."],
              ["Interacciones", `${proofCount}`, "Opiniones con evento, contacto u ownership registrado."],
            ].map(([label, value, detail]) => (
              <article key={label} className="rounded-2xl border border-white/5 bg-slate-950/60 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-black text-white">{value}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.13),transparent_32%),linear-gradient(135deg,rgba(2,6,23,0.94),rgba(8,13,30,0.92))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-200/25 bg-cyan-300/10 text-cyan-100">
              <WalletCards className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Web3 solo cuando aporta valor</p>
              <h2 className="mt-1 text-xl font-black text-white">Conecta MetaMask para NFT, reventa y ownership.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                WhatsApp/email siguen resolviendo el alta post-tap. La wallet aparece acá cuando el cliente quiere comprar,
                acuñar una representación digital, venderla o transferir el registro de ownership. La wallet no autentica el objeto físico.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/me/wallet?connect=metamask&next=/me/marketplace"
              className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
              title="Abrir MetaMask desde la wallet del Passport para marketplace, NFT y reventa."
            >
              Conectar wallet <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/me/wallet"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/5"
              title="Administrar certificados, ownership y transferencias del Passport."
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Ver ownership
            </Link>
          </div>
        </div>
      </section>

      {!items.length ? (
        <section className="rounded-xl border border-violet-300/30 bg-violet-500/10 p-5 text-sm text-violet-100">
          {contextualTenant
            ? `Todavía no hay catálogo publicado para ${tenantDisplayName}. Cuando la marca active productos, drops o recompra, van a aparecer acá.`
            : "Todavía no hay una marca activa para abrir marketplace contextual. Guardá o reclamá un producto para ver beneficios reales."}
        </section>
      ) : (
        <MarketplaceGridClient items={items} />
      )}

      <section className="rounded-3xl border border-cyan-300/20 bg-cyan-500/10 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Experiencias con evidencia</p>
        <h2 className="mt-2 text-xl font-black text-white">Reviews ligadas a una interacción registrada.</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-50/82">
          Para opinar se pide una referencia de evento NFC, producto guardado, contacto validado, ownership o política de compra según la marca.
          La marca modera el contenido. La reseña no prueba uso, procedencia ni autenticidad física.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {["Evento NFC asociado", "Contacto u ownership registrado", "Moderación de marca"].map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm font-black text-white">
              {item}
            </div>
          ))}
        </div>
      </section>
    </PortalShell>
  );
}
