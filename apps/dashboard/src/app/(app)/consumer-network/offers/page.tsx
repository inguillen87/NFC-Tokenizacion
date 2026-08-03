import { requireDashboardSession } from "../../../../lib/session";
import {
  createAdminPageContext,
  fetchAdminPage,
  type AdminPageContext,
} from "../../../../lib/admin-page-access";

type MarketplaceOffer = {
  id: string;
  title: string;
  description?: string;
  status?: string;
  type?: string;
  visibility?: string;
  tenant_slug?: string;
  product_title?: string;
};

async function getOffers(context: AdminPageContext): Promise<MarketplaceOffer[]> {
  try {
    const response = await fetchAdminPage(context, "consumer-network/offers");
    if (!response.ok) return [];
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

const PRESETS: MarketplaceOffer[] = [
  {
    id: "off-1",
    title: "Malbec con 220 puntos de club",
    description: "Beneficio para clientes con evento NFC elegible y contacto autorizado.",
    status: "active",
    type: "points_boost",
    visibility: "verified_tappers",
    tenant_slug: "demobodega",
    product_title: "Gran Reserva Malbec 2022",
  },
  {
    id: "off-2",
    title: "Carrito asistido por asesor Balmec",
    description: "Solicitud comercial para cerrar compra con MercadoPago, Stripe, transferencia o wallet.",
    status: "active",
    type: "assisted_checkout",
    visibility: "tenant_members_only",
    tenant_slug: "demobodega",
    product_title: "Caja selección Bodega Balmec",
  },
];

export default async function TenantOffersPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = searchParams ? await searchParams : {};
  const session = await requireDashboardSession();
  const adminContext = await createAdminPageContext(session, query.tenant);
  const tenantScope = adminContext.tenantSlug;

  const fetchedOffers = await getOffers(adminContext);
  const rawOffers = fetchedOffers.length ? fetchedOffers : session.isDemo ? PRESETS : [];
  const offers = tenantScope
    ? rawOffers.filter((offer) => String(offer.tenant_slug || "").toLowerCase() === tenantScope.toLowerCase())
    : rawOffers;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Ofertas & Drops</h1>
          <p className="mt-1 text-sm text-slate-400">Promociones exclusivas para usuarios de la red nexID y el marketplace cruzado.</p>
        </div>
        <span className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100">
          Creación gobernada por API / workflow aprobado
        </span>
      </header>

      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-xs text-slate-300">
        Scope actual: <b className="text-white">{tenantScope ? `tenant ${tenantScope}` : "global / multi-tenant"}</b>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/50">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="border-b border-white/10 bg-slate-800/50 text-xs uppercase tracking-widest text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Oferta</th>
              <th className="px-4 py-3 font-medium">Producto asociado</th>
              <th className="px-4 py-3 font-medium">Segmento / visibilidad</th>
              <th className="px-4 py-3 font-medium">Tipo / canal</th>
              <th className="px-4 py-3 text-right font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {offers.length ? offers.map((item, idx) => {
              const isPaused = item.status === "paused" || item.status === "draft";
              return (
                <tr key={`${item.id}-${idx}`} className="transition-colors hover:bg-white/5">
                  <td className="px-4 py-3">
                    <p className="font-bold text-white">{item.title}</p>
                    <p className="text-[10px] text-slate-500">{item.description}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    {item.product_title || "Genérico (sin producto)"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-400">
                      {item.visibility || "global_network"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-slate-400">
                    {item.type || "discount"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                      isPaused ? "bg-slate-500/20 text-slate-400" : "bg-emerald-500/20 text-emerald-400"
                    }`}>
                      {item.status || "active"}
                    </span>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">
                  No hay ofertas creadas para este scope todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
