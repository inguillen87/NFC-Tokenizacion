export const runtime='nodejs';export const dynamic='force-dynamic';
import {checkAdminWithPermission,checkAdminPermission,getAdminPrincipal} from '../../../lib/auth';
import {pilotScope,readPilotReport,PilotReportError} from '../../../lib/pilot-report';
import {json} from '../../../lib/http';
export async function GET(req:Request){
 const auth=await checkAdminWithPermission(req,'reports.export');if(auth)return auth;
 const permission=checkAdminPermission(req,'analytics:read');if(permission)return permission;
 try{const p=getAdminPrincipal(req),q=new URL(req.url).searchParams;const tenant=pilotScope(p,q.get('tenant'));
 const result=await readPilotReport(tenant,q.get('bid')||'',q.get('from')||'',q.get('to')||'');
 return json(result,200,{'cache-control':'private, no-store'});
 }catch(e){const reason=e instanceof PilotReportError?e.code:'pilot_source_unavailable';console.warn('[pilot_report]',reason);return json({ok:false,reason},e instanceof PilotReportError?e.status:503,{'cache-control':'private, no-store'});}
}
