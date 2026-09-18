import Link from 'next/link';
import { requireDashboardDestination } from '../../../../../lib/dashboard-destination-guard';
import { createAdminPageContext,fetchAdminPage } from '../../../../../lib/admin-page-access';
import { boundedDossierJson } from '../../../../../lib/batch-dossier-readings';
import { parseStudioEnvelope } from '../../../../../lib/passport-studio-envelope';
import { PassportStudioConnected } from '../../../../../components/passport-studio/passport-studio-connected';
import styles from '../../../../../components/batch-dossier.module.css';
export default async function PassportStudioPage({params}:{params:Promise<{bid:string}>}){
 const session=await requireDashboardDestination('batches');const {bid}=await params;
 const context=await createAdminPageContext(session);
 try{
  if(session.isDemo)throw new Error('demo_not_authorized');
  const response=await fetchAdminPage(context,`batches/${encodeURIComponent(bid)}/passport-editorial`,{signal:AbortSignal.timeout(15000)});
  if(!response.ok||response.headers.get('x-nexid-data-mode')==='demo')throw new Error('source_unavailable');
  const raw=await boundedDossierJson(response) as any,scope=raw.snapshot?.scope||raw.enrollment?.scope;
  if(!scope||scope.bid!==bid||!scope.tenantId||!scope.batchId)throw new Error('scope_invalid');
  if(!context.canSelectTenant&&session.tenantId&&scope.tenantId!==session.tenantId)throw new Error('scope_invalid');
  const expected={tenantId:scope.tenantId,batchId:scope.batchId,bid};
  return <PassportStudioConnected key={`${scope.tenantId}:${scope.batchId}`} initial={parseStudioEnvelope(raw,expected)} scope={expected}/>;
 }catch{
  return <main className={styles.root}><section className={styles.card}><p className={styles.eyebrow}>Passport Studio</p><h1 className={styles.title}>No se pudo confirmar el estado editorial.</h1><p className={styles.note}>La fuente o los permisos no permitieron obtener una respuesta válida para este lote. No se muestra un borrador inventado ni se habilita una publicación. Las sesiones demo no escriben contenido productivo.</p><Link prefetch={false} className={styles.button} href={`/batches/${encodeURIComponent(bid)}`}>Volver al expediente</Link></section></main>;
 }
}
