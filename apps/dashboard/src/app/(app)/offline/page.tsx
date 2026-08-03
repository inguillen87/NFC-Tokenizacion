import { requireDashboardSession } from "../../../lib/session";
import {
  createAdminPageContext,
  fetchAdminPage,
  type AdminPageContext,
} from "../../../lib/admin-page-access";

export const dynamic = "force-dynamic";

type OfflineEventRow = {
  id: string;
  bid: string;
  local_verdict: string;
  sync_status: string;
  server_verdict: string;
  reason: string | null;
  observed_at: string;
  received_at: string;
  device_id: string;
  device_label: string;
  device_type: string;
  bundle_id: string;
  bundle_ref: string;
  tenant_slug: string;
};

type OfflineHistoryPayload = {
  ok: true;
  tenant_slug: string;
  events: OfflineEventRow[];
  page: {
    limit: number;
    has_more: boolean;
    next_cursor: string | null;
  };
};

type OfflineHistoryResult =
  | { availability: "ready"; payload: OfflineHistoryPayload }
  | { availability: "tenant_required" | "upstream_error" | "invalid_payload" | "unreachable"; reason: string };

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? dateFormatter.format(date) : "Fecha inválida";
}

async function getOfflineHistory(context: AdminPageContext, cursor: string): Promise<OfflineHistoryResult> {
  if (!context.tenantSlug) {
    return { availability: "tenant_required", reason: "Seleccioná un tenant para consultar su historial offline." };
  }

  const query = new URLSearchParams({ limit: "50" });
  if (cursor) query.set("cursor", cursor);
  try {
    const response = await fetchAdminPage(context, `offline-verifier/sync?${query.toString()}`);
    const data = await response.json().catch(() => null) as Partial<OfflineHistoryPayload> & { reason?: unknown } | null;
    if (!response.ok) {
      return {
        availability: "upstream_error",
        reason: typeof data?.reason === "string" ? data.reason : `El backend respondió HTTP ${response.status}.`,
      };
    }
    if (
      data?.ok !== true
      || !Array.isArray(data.events)
      || !data.page
      || typeof data.page.has_more !== "boolean"
    ) {
      return { availability: "invalid_payload", reason: "El backend devolvió un contrato de historial inválido." };
    }
    return { availability: "ready", payload: data as OfflineHistoryPayload };
  } catch {
    return { availability: "unreachable", reason: "No fue posible contactar el historial offline." };
  }
}

function verdictClass(verdict: string) {
  if (verdict === "SYNC_REVIEW_REQUIRED" || verdict === "OFFLINE_LOCAL_FAIL") {
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  }
  if (verdict === "SYNC_PENDING") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  }
  return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
}

export default async function OfflineDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const session = await requireDashboardSession("supplier:offline_verifier");
  const adminContext = await createAdminPageContext(session, query.tenant);
  const history = await getOfflineHistory(adminContext, String(query.cursor || ""));
  const events = history.availability === "ready" ? history.payload.events : [];
  const nextCursor = history.availability === "ready" ? history.payload.page.next_cursor : null;
  const nextQuery = new URLSearchParams();
  if (adminContext.canSelectTenant && adminContext.tenantSlug) nextQuery.set("tenant", adminContext.tenantSlug);
  if (nextCursor) nextQuery.set("cursor", nextCursor);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Historial de verificación offline</h1>
        <p className="mt-2 text-muted-foreground">
          Eventos sincronizados y todavía provisionales. Esta vista es de solo lectura y no expone URLs capturadas,
          payloads SUN, material de claves ni secretos del bundle.
        </p>
      </header>

      {adminContext.canSelectTenant ? (
        <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4" method="get">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Tenant</span>
            <input
              name="tenant"
              defaultValue={adminContext.tenantSlug}
              placeholder="tenant-slug"
              className="min-w-64 rounded-md border bg-background px-3 py-2"
            />
          </label>
          <button className="rounded-md border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" type="submit">
            Consultar historial
          </button>
        </form>
      ) : null}

      {history.availability !== "ready" ? (
        <section className="rounded-lg border border-amber-300/30 bg-amber-500/10 p-5 text-sm text-amber-100">
          <h2 className="font-semibold">Historial no disponible</h2>
          <p className="mt-1">{history.reason}</p>
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              Tenant <b className="text-foreground">{history.payload.tenant_slug}</b> · {events.length} eventos en esta página
            </span>
            <span>Orden estable por recepción, del más reciente al más antiguo</span>
          </div>

          {events.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
              Todavía no hay escaneos offline sincronizados para este tenant.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Evento / BID</th>
                    <th className="px-5 py-3 font-medium">Veredicto local</th>
                    <th className="px-5 py-3 font-medium">Estado backend</th>
                    <th className="px-5 py-3 font-medium">Dispositivo</th>
                    <th className="px-5 py-3 font-medium">Observado</th>
                    <th className="px-5 py-3 font-medium">Recibido</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {events.map((event) => (
                    <tr key={event.id} className="transition-colors hover:bg-muted/50">
                      <td className="px-5 py-4">
                        <div className="font-mono text-xs font-medium">{event.id}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{event.bid} · {event.bundle_ref}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${verdictClass(event.local_verdict)}`}>
                          {event.local_verdict}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${verdictClass(event.server_verdict)}`}>
                          {event.server_verdict}
                        </span>
                        <div className="mt-1 text-xs text-muted-foreground">{event.sync_status}{event.reason ? ` · ${event.reason}` : ""}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div>{event.device_label}</div>
                        <div className="text-xs text-muted-foreground">{event.device_type}</div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">{formatDate(event.observed_at)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">{formatDate(event.received_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {nextCursor ? (
            <div className="flex justify-end">
              <a className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted" href={`/offline?${nextQuery.toString()}`}>
                Página siguiente
              </a>
            </div>
          ) : null}
        </section>
      )}
    </main>
  );
}
