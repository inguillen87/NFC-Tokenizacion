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

function averageRating(items: VerifiedExperience[]) {
  const ratings = items.map((item) => Number(item.rating || 0)).filter((value) => value > 0);
  if (!ratings.length) return "0.0";
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

  return (
    <PortalShell
      title="Marketplace verificado"
      subtitle={contextualTenant
        ? `Productos, beneficios y reventa del tenant ${contextualTenant}, conectados a taps reales.`
        : "Productos, beneficios y reventa para miembros nexID, sin comprar a ciegas."}
      notificationCount={items.length}
    >
      <section className="rounded-3xl border border-emerald-300/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.88),rgba(2,6,23,0.96))] p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Compra con contexto</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Ves producto, certificado, club y experiencias reales antes de avanzar.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/82">
              La marca puede publicar productos, drops, recompra o beneficios. El usuario entiende si el producto es autentico,
              de que lote viene, que club activa y que dijeron otros compradores verificados.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              ["Catalogo", `${items.length}`, "Productos publicados para este contexto."],
              ["Reputacion", rating, "Estrellas de experiencias verificadas."],
              ["Prueba social", `${proofCount}`, "Opiniones con tap, contacto o ownership."],
            ].map(([label, value, detail]) => (
              <article key={label} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-black text-white">{value}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {!items.length ? (
        <section className="rounded-xl border border-violet-300/30 bg-violet-500/10 p-5 text-sm text-violet-100">
          {contextualTenant
            ? `Todavia no hay catalogo publicado para ${contextualTenant}. Cuando la marca active productos, drops o recompra, van a aparecer aca.`
            : "Todavia no hay un tenant activo para abrir marketplace contextual. Guarda o reclama un producto para ver beneficios reales."}
        </section>
      ) : (
        <MarketplaceGridClient items={items} />
      )}

      <section className="rounded-3xl border border-cyan-300/20 bg-cyan-500/10 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Experiencias verificadas</p>
        <h2 className="mt-2 text-xl font-black text-white">Reviews solo de personas con evidencia real.</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-50/82">
          No cualquiera puede lastimar una marca premium: para opinar se pide tap fisico, producto guardado, contacto validado,
          ownership o politica de compra segun el tenant. La marca modera y el comprador lee feedback confiable.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {["Tap fisico confirmado", "Contacto o dueno verificado", "Moderacion de marca"].map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm font-black text-white">
              {item}
            </div>
          ))}
        </div>
      </section>
    </PortalShell>
  );
}
