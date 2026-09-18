import Link from "next/link";
import { PhysicalMapWorkspace } from "../../../../components/physical-map-workspace";
import { requireDashboardDestination, dashboardSessionCanOpenDestination } from "../../../../lib/dashboard-destination-guard";
import { createAdminPageContext } from "../../../../lib/admin-page-access";
import { readPhysicalTaps } from "../../../../lib/physical-taps-read";
import { mapRange } from "../../../../lib/physical-map-workspace";
import styles from "../../../../components/operations-workspace.module.css";

export default async function GeographicWorkspace({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireDashboardDestination("map");
  const query = await searchParams;
  const context = await createAdminPageContext(session, query.tenant);
  const range = mapRange(query.range);
  const bid = typeof query.bid === "string" ? query.bid.trim().slice(0,160) : "";
  const result = await readPhysicalTaps({ context, range, bid, limit: 100, isDemoSession: Boolean(session.isDemo) });
  return <main className={styles.workspace}>
    <div className={styles.links} style={{marginBottom:18}}><Link prefetch={false} className={styles.link} href="/">CRM y mapa en vivo</Link><Link prefetch={false} className={styles.link} href="/analytics">Métricas y reportes</Link>{dashboardSessionCanOpenDestination(session,"batches") && <Link prefetch={false} className={styles.link} href="/batches">Configurar rollos y productos</Link>}</div>
    <h1 className="sr-only">Centro geográfico de lecturas</h1>
    <details className={styles.scopeFilters}><summary>Período: {range} · {context.tenantSlug || "Seleccionar empresa"} · Cambiar filtros</summary><form className={styles.toolbar} aria-label="Alcance del centro geográfico">
      <label className={styles.field}>Período<select name="range" defaultValue={range}><option value="24h">Últimas 24 horas</option><option value="7d">Últimos 7 días</option><option value="30d">Últimos 30 días</option></select></label>
      <label className={`${styles.field} ${styles.search}`}>Lote técnico (opcional)<input name="bid" defaultValue={bid} maxLength={160} placeholder="Identificador BID" /></label>
      {context.canSelectTenant ? <label className={styles.field}>Empresa<input name="tenant" defaultValue={context.tenantSlug || ""} maxLength={120} placeholder="Alcance autorizado" /></label> : <span className={styles.note}>Empresa: <b>{context.tenantSlug}</b></span>}
      <button type="submit" className={`${styles.button} ${styles.primary}`}>Consultar lecturas</button>
    </form></details>
    <PhysicalMapWorkspace result={result} tenantSlug={context.tenantSlug} dedicated />
  </main>;
}
