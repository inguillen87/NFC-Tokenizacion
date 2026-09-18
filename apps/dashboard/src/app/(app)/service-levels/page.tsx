import Link from "next/link";
import { Activity, ArrowLeft } from "lucide-react";
import { requireDashboardDestination, dashboardSessionCanOpenDestination } from "../../../lib/dashboard-destination-guard";
import { createAdminPageContext, fetchAdminPage } from "../../../lib/admin-page-access";
import { dashboardPermissionMatches } from "../../../lib/permission-policy";
import { DASHBOARD_DESTINATIONS } from "../../../lib/dashboard-destination-policy";
import { healthWindow, type ServiceId } from "../../../lib/usage-health-model";
import { loadUsageHealth } from "../../../lib/usage-health-read";
import { SERVICE_CATALOG } from "../../../lib/usage-health-catalog";
import { UsageHealthCenter } from "../../../components/usage-health-center";
import styles from "../../../components/usage-health.module.css";

export default async function ServiceLevelsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const session=await requireDashboardDestination("serviceLevels");
  const query=await searchParams;const context=await createAdminPageContext(session,query.tenant);
  const window=healthWindow(query.window);const includeSdk=query.sdk==="1";
  const canReadSdk=dashboardSessionCanOpenDestination(session,"apiKeys");
  const canExport=dashboardPermissionMatches(session.permissions,"reports.export",session.deniedPermissions);
  const result=await loadUsageHealth({fetcher:(path,init)=>fetchAdminPage(context,path,init),window,tenant:context.tenantSlug,demo:Boolean(session.isDemo),includeSdk,canReadSdk});
  const params=new URLSearchParams({window,sdk:"1"});if(context.tenantSlug)params.set("tenant",context.tenantSlug);
  const links:Partial<Record<ServiceId,string>>={};
  for(const [id,meta] of Object.entries(SERVICE_CATALOG))if(dashboardSessionCanOpenDestination(session,meta.destination)){
    const href=DASHBOARD_DESTINATIONS[meta.destination].href;links[id as ServiceId]=context.tenantSlug?`${href}?tenant=${encodeURIComponent(context.tenantSlug)}`:href;
  }
  if(!["ready","demo"].includes(result.health.state))console.warn(JSON.stringify({message:"usage_health_source_unavailable",source:"service_levels",state:result.health.state,window,scope:context.tenantSlug?"tenant":"global"}));
  return <main className={styles.page}>
    <div className={styles.header}><div><p className={styles.eyebrow}><Activity size={13} aria-hidden="true" style={{display:"inline",marginRight:6}}/>Supervisión operativa</p><h1 className={styles.title}>Uso y estado</h1><p className={styles.subtitle}>Qué está registrado, qué requiere revisión y qué todavía no podemos medir. Sin confundir actividad con facturación ni una consulta con disponibilidad continua.</p></div><Link href="/" prefetch={false} className={styles.button}><ArrowLeft size={15}/>Centro en Vivo</Link></div>
    <form className={styles.scope} aria-label="Alcance de uso y estado"><label>Ventana<select name="window" defaultValue={window}><option value="1h">Última hora</option><option value="24h">Últimas 24 horas</option><option value="7d">Últimos 7 días</option><option value="30d">Últimos 30 días</option></select></label>{context.canSelectTenant?<label>Empresa<input name="tenant" defaultValue={context.tenantSlug} maxLength={63} placeholder="Todas las autorizadas"/></label>:<span className={styles.timestamp}>Empresa: <strong>{context.tenantSlug}</strong></span>}{includeSdk&&canReadSdk&&<input type="hidden" name="sdk" value="1"/>}<button type="submit" className={styles.button}>Consultar ventana</button></form>
    <UsageHealthCenter key={`${context.tenantSlug}:${window}`} {...result} canExport={canExport} loadSdkHref={canReadSdk&&!session.isDemo?`/service-levels?${params.toString()}`:null} links={links}/>
  </main>;
}
