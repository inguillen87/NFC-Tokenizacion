export const SUPPLIER_SERVICE_PROTOCOL='nexid.supplier-service-status.v1';
export const SUPPLIER_SERVICE_IDS=['cancellation','quotation','supplier_binding','delivery_ack'] as const;
export type SupplierServiceId=typeof SUPPLIER_SERVICE_IDS[number];
export type SupplierServiceState='setup_required'|'temporarily_disabled'|'read_only'|'workflow_available';
export type SupplierService={id:SupplierServiceId;state:SupplierServiceState;readAvailable:boolean;writesEnabled:boolean};
export type SupplierServiceSnapshot={ok:true;protocol:string;scope:{mode:'tenant';tenant_id:string;tenant_slug:string};observedAt:string;services:SupplierService[];metadataOnly:true;recordAccessVerified:false;operationAuthorized:false};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slug=/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;
const fail=():never=>{throw Error('supplier_service_contract_invalid');};
export function parseSupplierServiceStatus(value:unknown,expected:{tenant:string;tenantId?:string},now=Date.now()):SupplierServiceSnapshot{
 if(!value||typeof value!=='object'||Array.isArray(value))return fail();
 const v=value as Record<string,any>;
 if(v.ok!==true||v.protocol!==SUPPLIER_SERVICE_PROTOCOL||v.metadataOnly!==true||v.recordAccessVerified!==false||v.operationAuthorized!==false||v.demo===true||v.demoMode===true||v.dataSource==='demo')return fail();
 if(v.scope?.mode!=='tenant'||typeof v.scope.tenant_id!=='string'||!uuid.test(v.scope.tenant_id)||typeof v.scope.tenant_slug!=='string'||!slug.test(v.scope.tenant_slug)||v.scope.tenant_slug!==expected.tenant||expected.tenantId&&v.scope.tenant_id!==expected.tenantId)return fail();
 const at=typeof v.observedAt==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v.observedAt)?Date.parse(v.observedAt):NaN;
 if(!Number.isFinite(at)||now-at>60_000||at-now>30_000)return fail();
 if(!Array.isArray(v.services)||v.services.length!==SUPPLIER_SERVICE_IDS.length)return fail();
 const seen=new Set<string>();const services:SupplierService[]=v.services.map((s:any)=>{
  if(!s||!SUPPLIER_SERVICE_IDS.includes(s.id)||seen.has(s.id)||typeof s.readAvailable!=='boolean'||typeof s.writesEnabled!=='boolean')return fail();seen.add(s.id);
  if(!['setup_required','temporarily_disabled','read_only','workflow_available'].includes(s.state)||s.writesEnabled&&!s.readAvailable)return fail();
  if((s.state==='setup_required'||s.state==='temporarily_disabled')&&(s.readAvailable||s.writesEnabled))return fail();
  if(s.state==='read_only'&&(!s.readAvailable||s.writesEnabled)||s.state==='workflow_available'&&(!s.readAvailable||!s.writesEnabled))return fail();
  if(s.id==='cancellation'&&s.state==='read_only'||s.id!=='cancellation'&&s.state==='temporarily_disabled')return fail();
  return{id:s.id,state:s.state,readAvailable:s.readAvailable,writesEnabled:s.writesEnabled};
 });
 return{ok:true,protocol:SUPPLIER_SERVICE_PROTOCOL,scope:{mode:'tenant',tenant_id:v.scope.tenant_id,tenant_slug:v.scope.tenant_slug},observedAt:new Date(at).toISOString(),services:SUPPLIER_SERVICE_IDS.map(id=>services.find(s=>s.id===id)!),metadataOnly:true,recordAccessVerified:false,operationAuthorized:false};
}
