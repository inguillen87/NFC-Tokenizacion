import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../../components/data-table";
import { EnterpriseOpsState } from "../../../../components/enterprise-ops-state";
import { requireDashboardSession } from "../../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../../lib/admin-page-access";
import { readDemoDataMetaFromResponse } from "../../../../lib/demo-data-mode";

type SourceAvailability = "ready" | "upstream_error" | "invalid_payload" | "unreachable";
type AdminGetResult = { availability: SourceAvailability; data: unknown | null; source: "production" | "demo" | "unavailable" };

async function adminGet(context: AdminPageContext, path: string, allowDemoData: boolean): Promise<AdminGetResult> {
  try {
    const response = await fetchAdminPage(context, path);
    const meta = readDemoDataMetaFromResponse(response);
    if (!response.ok) return { availability: "upstream_error", data: null, source: "unavailable" };
    const data = await response.json().catch(() => null);
    const upstreamUnavailable = Boolean(data && typeof data === "object" && !Array.isArray(data) && (data as { ok?: boolean }).ok === false);
    if (upstreamUnavailable) return { availability: "upstream_error", data: null, source: "unavailable" };
    if (!data || typeof data !== "object" || (meta.demoMode && !allowDemoData)) {
      return { availability: "invalid_payload", data: null, source: "unavailable" };
    }
    return { availability: "ready", data, source: meta.demoMode ? "demo" : "production" };
  } catch {
    return { availability: "unreachable", data: null, source: "unavailable" };
  }
}

type OverviewPayload = {
  overview?: {
    totalActivity?: number;
    totalTaps?: number;
    customerActions?: number;
    activityWithKnownActor?: number;
    activityWithoutActor?: number;
    actorLinkedActivityRate?: number;
    recognizedUnits?: number;
    knownActors?: number;
    verifiedIdentityActors?: number;
    activeTenantMembers?: number;
    consentedActorsByChannel?: { email?: number; whatsapp?: number; phone?: number };
    savedProducts?: number;
    riskBlockedClaims?: number;
  };
  identityBoundary?: string;
  topProductsByClaims?: Array<{ product_name?: string; bid?: string; claims?: number }>;
};

function pct(value: unknown, available = true) {
  return available ? `${Number(value || 0).toFixed(1)}%` : "—";
}

export default async function PortalUsuariosOverviewPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = searchParams ? await searchParams : {};
  const session = await requireDashboardSession();
  const adminContext = await createAdminPageContext(session, query.tenant);
  const allowDemoData = Boolean(session.isDemo);

  const [overviewResult, membersResult, productsResult, tapsResult] = await Promise.all([
    adminGet(adminContext, "/admin/consumer-network/overview", allowDemoData),
    adminGet(adminContext, "/admin/consumer-network/members", allowDemoData),
    adminGet(adminContext, "/admin/consumer-network/products", allowDemoData),
    adminGet(adminContext, "/admin/consumer-network/taps", allowDemoData),
  ]);

  const overviewReady = overviewResult.availability === "ready";
  const membersReady = membersResult.availability === "ready";
  const productsReady = productsResult.availability === "ready";
  const tapsReady = tapsResult.availability === "ready";
  const visibleSources = [overviewResult, membersResult, productsResult, tapsResult]
    .filter((result) => result.availability === "ready")
    .map((result) => result.source);
  const dataSource = visibleSources.includes("demo") ? "demo" : visibleSources.length ? "production" : "unavailable";
  const unavailableSources = [
    ["overview", overviewResult.availability],
    ["members", membersResult.availability],
    ["products", productsResult.availability],
    ["taps", tapsResult.availability],
  ].filter(([, availability]) => availability !== "ready");
  const overviewPayload = (overviewResult.data || {}) as OverviewPayload;
  const overview = overviewPayload.overview || {};
  const topProductsByClaims = Array.isArray(overviewPayload.topProductsByClaims) ? overviewPayload.topProductsByClaims : [];
  const members = Array.isArray((membersResult.data as { items?: unknown[] } | null)?.items) ? ((membersResult.data as { items: Record<string, unknown>[] }).items) : [];
  const products = Array.isArray((productsResult.data as { items?: unknown[] } | null)?.items) ? ((productsResult.data as { items: Record<string, unknown>[] }).items) : [];
  const taps = Array.isArray((tapsResult.data as { items?: unknown[] } | null)?.items) ? ((tapsResult.data as { items: Record<string, unknown>[] }).items) : [];
  const heatmapCells = tapsReady ? Array.from({ length: 24 }).map((_, hour) => {
    const count = taps.filter((item) => {
      const date = item.created_at ? new Date(String(item.created_at)) : null;
      return date && !Number.isNaN(date.getTime()) && date.getHours() === hour;
    }).length;
    const max = Math.max(1, ...Array.from({ length: 24 }).map((__, h) => taps.filter((item) => {
      const date = item.created_at ? new Date(String(item.created_at)) : null;
      return date && !Number.isNaN(date.getTime()) && date.getHours() === h;
    }).length));
    return { hour, count, intensity: count / max };
  }) : [];

  return (
    <main className="space-y-6">
      <SectionHeading
        eyebrow="Clientes CRM"
        title="Clientes & campañas"
        description={dataSource === "demo"
          ? "Escenario demo aislado: separa lecturas, acciones, unidades y actores sin afirmar personas ni conversiones reales."
          : "Actividad post-tap persistida, actores vinculados y consentimientos vigentes, siempre dentro del tenant."}
      />

      <div data-testid="consumer-network-source" data-data-source={dataSource} className="rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 text-xs text-slate-300">
        Fuente: <b className={dataSource === "demo" ? "text-amber-200" : dataSource === "production" ? "text-emerald-200" : "text-slate-200"}>{dataSource}</b>
        {dataSource === "demo" ? " · DEMO DATA; no se agrega como actividad productiva." : null}
      </div>

      {unavailableSources.length ? (
        <EnterpriseOpsState
          variant="warning"
          title="CRM parcialmente disponible"
          description="Una o más fuentes operativas no respondieron. Los módulos afectados muestran valores no disponibles en lugar de convertir la falla en cero actividad."
          checklist={unavailableSources.map(([name, availability]) => `${name}: ${availability}`)}
          action={<a href="/consumer-network/overview" className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs font-black text-amber-100">Reintentar fuentes</a>}
          testId="consumer-network-partial-sources"
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Lecturas NFC / QR</p>
          <p className="mt-2 text-3xl font-bold text-white">{overviewReady ? Number(overview.totalTaps || 0) : "—"}</p>
          <p className="mt-1 text-xs text-slate-400">Interacciones físicas registradas.</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Acciones post-tap</p>
          <p className="mt-2 text-3xl font-bold text-white">{overviewReady ? Number(overview.customerActions || 0) : "—"}</p>
          <p className="mt-1 text-xs text-slate-400">Contenido, servicios y CTAs registrados.</p>
        </article>
        <article className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
          <p className="text-xs uppercase tracking-widest text-cyan-300">Unidades reconocidas</p>
          <p className="mt-2 text-3xl font-bold text-cyan-100">{overviewReady ? Number(overview.recognizedUnits || 0) : "—"}</p>
          <p className="mt-1 text-xs text-cyan-200">Tags registrados distintos; no son personas.</p>
        </article>
        <article className="rounded-xl border border-violet-500/20 bg-violet-950/20 p-4">
          <p className="text-xs uppercase tracking-widest text-violet-300">Actividad sin actor</p>
          <p className="mt-2 text-3xl font-bold text-violet-100">{overviewReady ? Number(overview.activityWithoutActor || 0) : "—"}</p>
          <p className="mt-1 text-xs text-violet-200">Eventos aún no vinculados a una identidad conocida.</p>
        </article>
      </div>

      <section className="rounded-2xl border border-cyan-300/20 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">Analytics command center</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{overviewReady ? "Cobertura de actividad e identidad" : "Métricas sin fuente disponible"}</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">{overviewReady ? (overviewPayload.identityBoundary || "Separamos actividad, unidades, actores y permisos de contacto; un UID nunca se interpreta como una persona.") : "No mostramos métricas en cero cuando la fuente overview no respondió."}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
            <span className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-slate-200">Actividad vinculada <b className="text-cyan-100">{pct(overview.actorLinkedActivityRate, overviewReady)}</b></span>
            <span className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-slate-200">Actores conocidos <b className="text-violet-100">{overviewReady ? Number(overview.knownActors || 0) : "—"}</b></span>
            <span className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-slate-200">Identidad verificada <b className="text-sky-100">{overviewReady ? Number(overview.verifiedIdentityActors || 0) : "—"}</b></span>
            <span className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-slate-200">Email opt-in <b className="text-emerald-100">{overviewReady ? Number(overview.consentedActorsByChannel?.email || 0) : "—"}</b></span>
            <span className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-slate-200">WhatsApp opt-in <b className="text-emerald-100">{overviewReady ? Number(overview.consentedActorsByChannel?.whatsapp || 0) : "—"}</b></span>
            <span className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-slate-200">Teléfono opt-in <b className="text-emerald-100">{overviewReady ? Number(overview.consentedActorsByChannel?.phone || 0) : "—"}</b></span>
          </div>
        </div>
        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Heatmap horario de taps asociados</p>
          {tapsReady ? (
            <>
              <div className="mt-2 grid grid-cols-12 gap-1">
                {heatmapCells.map((cell) => (
                  <div
                    key={cell.hour}
                    title={`${cell.hour}:00 - ${cell.count} taps`}
                    className="h-9 rounded-md border border-white/10"
                    style={{ backgroundColor: `rgba(34, 211, 238, ${0.08 + cell.intensity * 0.62})` }}
                  >
                    <span className="sr-only">{cell.hour}:00 {cell.count} taps</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-slate-500"><span>00h</span><span>12h</span><span>23h</span></div>
            </>
          ) : (
            <EnterpriseOpsState compact variant="warning" title="Heatmap no disponible" description="La fuente de taps no respondió; no generamos una grilla de ceros." />
          )}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Miembros activos del tenant</p>
          <p className="mt-2 text-2xl font-bold text-white">{overviewReady ? Number(overview.activeTenantMembers || 0) : "—"}</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Saved products</p>
          <p className="mt-2 text-2xl font-bold text-white">{overviewReady ? Number(overview.savedProducts || 0) : "—"}</p>
        </article>
        <article className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-4">
          <p className="text-xs uppercase tracking-widest text-rose-300">Risk blocked claims</p>
          <p className="mt-2 text-2xl font-bold text-rose-100">{overviewReady ? Number(overview.riskBlockedClaims || 0) : "—"}</p>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <h3 className="text-sm font-semibold text-white">Límites de uso de los datos</h3>
          <div className="mt-3 space-y-2 text-xs text-slate-300">
            <p className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2"><b className="text-cyan-100">Analítica:</b> usa actividad agregada, incluso cuando no existe un actor conocido.</p>
            <p className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2"><b className="text-violet-100">Relación:</b> sólo usa actividad vinculada a un actor conocido.</p>
            <p className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2"><b className="text-emerald-100">Campañas:</b> requieren miembro activo y consentimiento vigente para el canal y propósito exactos.</p>
          </div>
        </section>
        <section className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <h3 className="text-sm font-semibold text-white">Top products by claims</h3>
          <div className="mt-3 space-y-2">
            {topProductsByClaims.length ? topProductsByClaims.map((item, index) => (
              <div key={`${item.product_name || "product"}-${index}`} className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-200">
                {item.product_name || "Producto NFC"} · BID {item.bid || "n/a"} · claims {Number(item.claims || 0)}
              </div>
            )) : <p className="text-xs text-slate-400">{overviewReady ? "Sin claims para el scope actual." : "La fuente overview no está disponible."}</p>}
          </div>
        </section>
      </div>

      <DataTable
        title="Members"
        columns={[
          { key: "consumer", label: "Consumer" },
          { key: "tenant", label: "Tenant" },
          { key: "status", label: "Status" },
          { key: "points", label: "Points" },
          { key: "last", label: "Last activity" },
        ]}
        rows={members.map((item) => ({
          consumer: String(item.display_name || item.email_masked || "consumer"),
          tenant: String(item.tenant_slug || "n/a"),
          status: String(item.status || "active"),
          points: `${Number(item.points_balance || 0)}`,
          last: item.last_activity_at ? new Date(String(item.last_activity_at)).toLocaleString() : "n/a",
        }))}
        filterKey="status"
        loadingLabel="Loading members"
        emptyLabel={membersReady ? "No members for current scope" : "Members source unavailable; this is not a confirmed zero."}
      />

      <DataTable
        title="Product conversion"
        columns={[
          { key: "product", label: "Product" },
          { key: "tenant", label: "Tenant" },
          { key: "claimed", label: "Claimed" },
          { key: "saved", label: "Saved" },
          { key: "status", label: "Status" },
        ]}
        rows={products.map((item) => {
          const claimed = Number(item.claimed_count || 0);
          const saved = Number(item.saved_count || 0);
          const status = claimed > 0 ? "active" : saved > 0 ? "pending" : "risk";
          return {
            product: String(item.product_name || "Producto NFC"),
            tenant: String(item.tenant_slug || "n/a"),
            claimed: String(claimed),
            saved: String(saved),
            status,
          };
        })}
        filterKey="status"
        loadingLabel="Loading product conversion"
        emptyLabel={productsReady ? "No product conversion data" : "Products source unavailable; this is not a confirmed zero."}
      />

      <DataTable
        title="Tap activity feed"
        columns={[
          { key: "event", label: "Tap event" },
          { key: "tenant", label: "Tenant" },
          { key: "verdict", label: "Verdict" },
          { key: "risk", label: "Risk" },
          { key: "at", label: "Created at" },
        ]}
        rows={taps.map((item) => ({
          event: String(item.tap_event_id || "n/a"),
          tenant: String(item.tenant_slug || "n/a"),
          verdict: String(item.verdict || "UNKNOWN"),
          risk: String(item.risk_level || "unknown"),
          at: item.created_at ? new Date(String(item.created_at)).toLocaleString() : "n/a",
        }))}
        filterKey="verdict"
        loadingLabel="Loading tap activity"
        emptyLabel={tapsReady ? "No taps in current scope" : "Taps source unavailable; this is not a confirmed zero."}
      />
    </main>
  );
}
