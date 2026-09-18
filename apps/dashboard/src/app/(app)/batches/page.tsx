import {canReadPilotReport} from '../../../lib/pilot-report-access';
import Link from 'next/link';
import {requireDashboardSession} from '../../../lib/session';
import {createAdminPageContext,fetchAdminPage} from '../../../lib/admin-page-access';
import {dashboardHighImpactPermissionMatches,dashboardPermissionMatches} from '../../../lib/permission-policy';
import {dashboardSessionCanOpenDestination} from '../../../lib/dashboard-destination-guard';
import {dashboardAuthPath} from '../../../lib/dashboard-return-path';
import {boundedDossierJson} from '../../../lib/batch-dossier-readings';
import {parseBatchWorkRows,type BatchWorkSource} from '../../../lib/batch-workbench';
import {BatchWorkbench} from '../../../components/batch-workbench';
import styles from '../../../components/operations-workspace.module.css';
export default async function BatchesPage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}){
 const session = await requireDashboardSession();
 const query=searchParams?await searchParams:{};
 if(!dashboardPermissionMatches(session.permissions,'batches:read',session.deniedPermissions))return <main className={`${styles.workspace} ${styles.intake}`} data-testid="batches-access-denied"><h1 className={styles.title}>Esta cuenta no puede consultar lotes</h1><p className={styles.note}>{session.label} · {session.role} · {session.tenantSlug||'administración global'}. Falta autorización de lectura; no se cambió tu sesión.</p><Link prefetch={false} className={styles.button} href={dashboardAuthPath('/login','/batches')}>Ingresar con otra cuenta</Link></main>;
 const context=await createAdminPageContext(session,query.tenant);
 let source:BatchWorkSource={state:'unavailable',rows:null};
 if(session.isDemo)source={state:'forbidden',rows:null};
 else try{const response=await fetchAdminPage(context,'batches',{signal:AbortSignal.timeout(12000)});
  if(response.status===401||response.status===403)source={state:'forbidden',rows:null};
  else if(response.ok){if(response.headers.get('x-nexid-data-mode')==='demo')source={state:'invalid',rows:null};else source={state:'ready',rows:parseBatchWorkRows(await boundedDossierJson(response),context.tenantSlug)};}
 }catch{source={state:'unavailable',rows:null};}
 return <BatchWorkbench key={`${session.id}:${context.tenantSlug}`} source={source} scope={context.tenantSlug} global={context.isGlobal} accountLabel={session.label} canConfigure={dashboardHighImpactPermissionMatches(session.role,session.permissions,'batch.product.configure',session.deniedPermissions)} canImport={dashboardPermissionMatches(session.permissions,'manifest.import',session.deniedPermissions)} canOrder={dashboardSessionCanOpenDestination(session,'supplierBatches')} canReport={canReadPilotReport(session)}/>;
}
