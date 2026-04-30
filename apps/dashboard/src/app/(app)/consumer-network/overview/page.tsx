import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../../components/data-table";
import { requireDashboardSession } from "../../../../lib/session";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

async function adminGet(path: string) {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

type OverviewPayload = {
  overview?: {
    anonymousTappers?: number;
    registeredConsumers?: number;
    tenantMembers?: number;
    tapToRegistrationRate?: number;
    registrationToMembershipRate?: number;
    savedProducts?: number;
    riskBlockedClaims?: number;
  };
  latestMemberActivity?: Array<{ display_name?: string; tenant_slug?: string; last_activity_at?: string }>;
  topProductsByClaims?: Array<{ product_name?: string; bid?: string; claims?: number }>;
};

export default async function PortalUsuariosOverviewPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = searchParams ? await searchParams : {};
  const session = await requireDashboardSession();
  const requestedTenant = typeof query.tenant === "string" ? query.tenant : "";
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : requestedTenant;
  const tenantQuery = tenantScope ? `?tenant=${encodeURIComponent(tenantScope)}` : "";

  const [overviewRaw, membersRaw, productsRaw, tapsRaw] = await Promise.all([
    adminGet(`/admin/consumer-network/overview${tenantQuery}`),
    adminGet(`/admin/consumer-network/members${tenantQuery}`),
    adminGet(`/admin/consumer-network/products${tenantQuery}`),
    adminGet(`/admin/consumer-network/taps${tenantQuery}`),
  ]);

  const overviewPayload = (overviewRaw || {}) as OverviewPayload;
  const overview = overviewPayload.overview || {};
  const latestMemberActivity = Array.isArray(overviewPayload.latestMemberActivity) ? overviewPayload.latestMemberActivity : [];
  const topProductsByClaims = Array.isArray(overviewPayload.topProductsByClaims) ? overviewPayload.topProductsByClaims : [];
  const members = Array.isArray((membersRaw as { items?: unknown[] } | null)?.items) ? ((membersRaw as { items: Record<string, unknown>[] }).items) : [];
  const products = Array.isArray((productsRaw as { items?: unknown[] } | null)?.items) ? ((productsRaw as { items: Record<string, unknown>[] }).items) : [];
  const taps = Array.isArray((tapsRaw as { items?: unknown[] } | null)?.items) ? ((tapsRaw as { items: Record<string, unknown>[] }).items) : [];

  return (
    <main className="space-y-6">
      <SectionHeading
        eyebrow="Consumer Network"
        title="Portal de Usuarios"
        description="Conversión real de taps → consumidores → memberships → productos guardados, con scope por tenant."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Anonymous tappers</p>
          <p className="mt-2 text-3xl font-bold text-white">{Number(overview.anonymousTappers || 0)}</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Registered consumers</p>
          <p className="mt-2 text-3xl font-bold text-white">{Number(overview.registeredConsumers || 0)}</p>
        </article>
        <article className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
          <p className="text-xs uppercase tracking-widest text-cyan-300">Tap → registration</p>
          <p className="mt-2 text-3xl font-bold text-cyan-100">{Number(overview.tapToRegistrationRate || 0)}%</p>
          <p className="mt-1 text-xs text-cyan-200">Derivado de eventos persistidos.</p>
        </article>
        <article className="rounded-xl border border-violet-500/20 bg-violet-950/20 p-4">
          <p className="text-xs uppercase tracking-widest text-violet-300">Registration → membership</p>
          <p className="mt-2 text-3xl font-bold text-violet-100">{Number(overview.registrationToMembershipRate || 0)}%</p>
          <p className="mt-1 text-xs text-violet-200">Sin revenue/GMV inventado.</p>
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Tenant members</p>
          <p className="mt-2 text-2xl font-bold text-white">{Number(overview.tenantMembers || 0)}</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Saved products</p>
          <p className="mt-2 text-2xl font-bold text-white">{Number(overview.savedProducts || 0)}</p>
        </article>
        <article className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-4">
          <p className="text-xs uppercase tracking-widest text-rose-300">Risk blocked claims</p>
          <p className="mt-2 text-2xl font-bold text-rose-100">{Number(overview.riskBlockedClaims || 0)}</p>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <h3 className="text-sm font-semibold text-white">Latest member activity</h3>
          <div className="mt-3 space-y-2">
            {latestMemberActivity.length ? latestMemberActivity.map((item, index) => (
              <div key={`${item.display_name || "member"}-${index}`} className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-200">
                {(item.display_name || "consumer")} · tenant {item.tenant_slug || "n/a"} · {item.last_activity_at ? new Date(item.last_activity_at).toLocaleString() : "n/a"}
              </div>
            )) : <p className="text-xs text-slate-400">Sin actividad reciente.</p>}
          </div>
        </section>
        <section className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <h3 className="text-sm font-semibold text-white">Top products by claims</h3>
          <div className="mt-3 space-y-2">
            {topProductsByClaims.length ? topProductsByClaims.map((item, index) => (
              <div key={`${item.product_name || "product"}-${index}`} className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-200">
                {item.product_name || "Producto NFC"} · BID {item.bid || "n/a"} · claims {Number(item.claims || 0)}
              </div>
            )) : <p className="text-xs text-slate-400">Sin claims para el scope actual.</p>}
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
        emptyLabel="No members for current scope"
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
        emptyLabel="No product conversion data"
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
        emptyLabel="No taps in current scope"
      />
    </main>
  );
}
