import room from "../../../../components/control-room.module.css";
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
    <header className={room.header}><div><h1>Mapa profesional</h1><p>Lecturas registradas · procedencia y precisión visibles</p></div><nav aria-label="Espacios de trabajo"><Link href="/" prefetch={false}>Centro en vivo</Link><Link href="/analytics" prefetch={false}>Analítica histórica</Link></nav><details className={room.compactScope}><summary>Período: {range} · {context.tenantSlug || "Seleccionar empresa"} · Cambiar filtros</summary><form className={styles.toolbar} aria-label="Alcance del centro geográfico">
      <label className={styles.field}>Período<select name="range" defaultValue={range}><option value="24h">Últimas 24 horas</option><option value="7d">Últimos 7 días</option><option value="30d">Últimos 30 días</option></select></label>
      <label className={`${styles.field} ${styles.search}`}>Lote técnico (opcional)<input name="bid" defaultValue={bid} maxLength={160} placeholder="Identificador BID" /></label>
      {context.canSelectTenant ? <label className={styles.field}>Empresa<input name="tenant" defaultValue={context.tenantSlug || ""} maxLength={120} placeholder="Alcance autorizado" /></label> : <span className={styles.note}>Empresa: <b>{context.tenantSlug}</b></span>}
      <button type="submit" className={`${styles.button} ${styles.primary}`}>Consultar lecturas</button>
    </form></details></header>

    <PhysicalMapWorkspace result={result} tenantSlug={context.tenantSlug} dedicated />
  </main>;
}
