import {checkAdmin,checkAdminPermission,getAdminPrincipal,getAdminTenantAccess,type AdminSessionResolver} from './auth';
import {permissionDenied} from './permission-matcher.js';
import {enforceCriticalRateLimit} from './critical-rate-limit';
import {readBoundedJsonBody,RequestBodyTooLargeError} from './bounded-request-body';
import {json} from './http';
import {intakeCapabilities,INTAKE_MAX_BYTES,IntakeError} from './epcis-intake-policy';
import {intakeBoard,previewIntake,commitIntake,intakeFailure,intakeScope} from './epcis-intake-service';
export async function handleEpcisIntake(req:Request,bid:string,action:'read'|'preview'|'commit',dependencies:{sessionResolver?:AdminSessionResolver;limit?:typeof enforceCriticalRateLimit}={}){
 const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
 try{
  if(req.method!==(action==='read'?'GET':'POST'))throw new IntakeError('intake_method_not_allowed',405);
  const auth=await checkAdmin(req,['super_admin','tenant_admin','tenant_operator'],dependencies.sessionResolver);if(auth)return auth;
  const p=getAdminPrincipal(req),capabilities=intakeCapabilities(p.role,permission=>!checkAdminPermission(req,permission),permission=>permissionDenied(p.deniedPermissions,permission),p.mfaVerified);
  if(!capabilities.canRead||action==='commit'&&!capabilities.canCommit)throw new IntakeError(action==='commit'?'intake_write_or_mfa_required':'intake_read_forbidden',403);
  const url=new URL(req.url);if([...url.searchParams.keys()].some(k=>k!=='tenant')||url.searchParams.getAll('tenant').length>1)throw new IntakeError('intake_query_invalid');
  const requested=url.searchParams.get('tenant');if(p.tenantSlug&&requested&&p.tenantSlug!==requested)throw new IntakeError('intake_tenant_mismatch',403);
  const tenant=getAdminTenantAccess(req,requested).effectiveTenantSlug;
  const scope=await intakeScope(tenant,bid);
  const limited=await (dependencies.limit||enforceCriticalRateLimit)(req,{rateClass:action==='commit'?'sdk_epcis_capture':'observability_read',tenantId:scope.tenantId,subjectId:p.userId,tenantWide:action==='commit'});if(limited)return limited;
  if(action==='read')return json({...await intakeBoard(tenant,bid,p.userId),capabilities},200,headers);
  const body=await readBoundedJsonBody(req,INTAKE_MAX_BYTES+8192);
  if(action==='preview'){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>k!=='document'))throw new IntakeError('intake_command_invalid');return json({...await previewIntake(tenant,bid,(body as any).document),capabilities},200,headers);}
  return json(await commitIntake(tenant,bid,p.userId,body),200,headers);
 }catch(e){const failure=e instanceof RequestBodyTooLargeError?{reason:'intake_document_size_or_type',status:413}:intakeFailure(e);return json({ok:false,...failure},failure.status,headers);}
}
