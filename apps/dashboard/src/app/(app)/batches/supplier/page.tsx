import { requireDashboardDestination } from '../../../../lib/dashboard-destination-guard';
import {createAdminPageContext,fetchAdminPage} from '../../../../lib/admin-page-access';
import {parseReception,type ReceptionData} from '../../../../lib/supplier-reception-contract';
import {boundedDossierJson} from '../../../../lib/batch-dossier-readings';
import {SupplierReceptionWorkspace} from '../../../../components/supplier-reception-workspace';
export default async function SupplierBatchPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const session=await requireDashboardDestination('supplierBatches');
 const query=await searchParams,context=await createAdminPageContext(session,query.tenant);
 let data:ReceptionData|null=null;
 if(!session.isDemo){try{const response=await fetchAdminPage(context,'supplier-reception',{signal:AbortSignal.timeout(12000)});if(response.ok&&response.headers.get('x-nexid-data-mode')!=='demo')data=parseReception(await boundedDossierJson(response),{role:session.role,tenantSlug:session.tenantSlug||null,requestedTenant:context.tenantSlug,isDemo:false});}catch{/* Failure stays unavailable; never a fabricated tenant or zero inventory. */}}
 return <SupplierReceptionWorkspace key={`${session.id}:${context.tenantSlug}`} initial={data} requestedTenant={context.tenantSlug} access={{role:session.role,label:session.label,tenantSlug:session.tenantSlug||null,permissions:session.permissions,deniedPermissions:session.deniedPermissions||[],isDemo:session.isDemo===true}}/>;
}
