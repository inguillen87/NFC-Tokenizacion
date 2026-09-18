export const runtime='nodejs';export const dynamic='force-dynamic';
import {checkAdminWithPermission,checkAdminPermission,getAdminPrincipal} from '../../../../lib/auth';
import {pilotScope,pilotOptions,PilotReportError} from '../../../../lib/pilot-report';
import {json} from '../../../../lib/http';
export async function GET(req:Request){const auth=await checkAdminWithPermission(req,'reports.export');if(auth)return auth;const permission=checkAdminPermission(req,'analytics:read');if(permission)return permission;
 try{const p=getAdminPrincipal(req),requested=new URL(req.url).searchParams.get('tenant')||'';const tenant=p.scope==='super_admin'&&!requested?'':pilotScope(p,requested);return json(await pilotOptions(tenant,p.scope==='super_admin'),200,{'cache-control':'private, no-store'});}catch(e){return json({ok:false,reason:e instanceof PilotReportError?e.code:'pilot_source_unavailable'},e instanceof PilotReportError?e.status:503,{'cache-control':'private, no-store'});}}
