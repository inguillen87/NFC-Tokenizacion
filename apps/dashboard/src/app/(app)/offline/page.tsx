import { requireDashboardSession } from "../../../lib/session";
import { createAdminPageContext } from "../../../lib/admin-page-access";

export const dynamic = "force-dynamic";

export default async function OfflineDashboardPage() {
  const session = await requireDashboardSession();
  const adminContext = await createAdminPageContext(session);
  const events: Array<Record<string, unknown>> = [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-4">Offline Sync Dashboard</h1>
      <p className="text-muted-foreground mb-8">
        Review offline scans and verification events that have been synced to the backend.
      </p>

      <div className="mb-6 rounded-lg border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        Historial no disponible para <b>{adminContext.tenantSlug || "scope global"}</b>: el contrato actual expone
        <code className="mx-1 rounded bg-slate-950/60 px-1.5 py-0.5">POST /admin/offline-verifier/sync</code>
        como mutaciÃ³n de sincronizaciÃ³n, no como lectura. Esta vista no ejecuta esa mutaciÃ³n al renderizar; requiere
        un endpoint GET de historial tenant-scoped.
      </div>

      {events.length === 0 ? (
        <div className="bg-card border rounded-lg p-8 text-center text-muted-foreground">
          No offline scans recorded yet.
        </div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground text-xs uppercase border-b">
              <tr>
                <th className="px-6 py-3 font-medium">Local ID</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Device / Operator</th>
                <th className="px-6 py-3 font-medium">Captured At</th>
                <th className="px-6 py-3 font-medium">Captured URL</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((event: any) => (
                <tr key={event.id || event.localId} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 font-medium whitespace-nowrap">
                    {event.localId || event.client_event_id}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        event.status === "SYNCED_VALID" || event.server_verdict === "SYNC_PENDING"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : event.status === "SYNCED_INVALID" || event.server_verdict === "SYNC_REVIEW_REQUIRED"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}
                    >
                      {event.status || event.server_verdict}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    <div>{event.deviceId || event.device_id}</div>
                    <div className="text-xs">{event.operatorId}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                    {event.capturedAt || event.observed_at ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.capturedAt || event.observed_at)) : "Unknown"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="truncate max-w-[200px]" title={event.capturedUrl || ""}>
                      {event.capturedUrl || ""}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
