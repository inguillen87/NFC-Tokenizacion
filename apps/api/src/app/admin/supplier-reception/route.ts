export const runtime='nodejs';
export const dynamic='force-dynamic';
import {checkAdmin,getAdminPrincipal} from '../../../lib/auth';
import {json} from '../../../lib/http';
import {canReadReception,receptionTenant} from '../../../lib/supplier-reception-policy';
import {readSupplierReception} from '../../../lib/supplier-reception-read';
export async function GET(req:Request){
 const auth=await checkAdmin(req,['super_admin','tenant_admin','tenant_operator','reseller','readonly_demo']);if(auth)return auth;
 const p=getAdminPrincipal(req);
 if(!canReadReception(p))return json({ok:false,reason:'reception_read_forbidden'},403,{'cache-control':'private, no-store'});
 try {
  const tenant=receptionTenant(p,new URL(req.url).searchParams.get('tenant'));
  const result=await readSupplierReception(p,tenant,p.label);
  if(Buffer.byteLength(JSON.stringify(result),'utf8')>262144)return json({ok:false,reason:'reception_response_limit'},503,{'cache-control':'private, no-store'});
  return json(result,200,{'cache-control':'private, no-store'});
 }catch(error){
  const message=error instanceof Error?error.message:'';
  const reason=['reception_tenant_forbidden','reception_tenant_invalid','reception_scope_invalid','reception_tenant_not_found'].includes(message)?message:'reception_source_unavailable';
  return json({ok:false,reason},reason==='reception_tenant_not_found'?404:reason==='reception_source_unavailable'?503:403,{'cache-control':'private, no-store'});
 }
}
