import { productUrls } from '@product/config';
import { getDashboardSessionCredential, type DashboardSessionCredential } from './session';
import { canReadRuntimeConsole } from './runtime-readiness-access';
import { readRuntimeSnapshot, RuntimeConsoleError } from './runtime-readiness-transport';
type Dependencies={credential:()=>Promise<DashboardSessionCredential|null>;fetcher:typeof fetch;apiBase:string};
function json(body:unknown,status=200){return Response.json(body,{status,headers:{'cache-control':'private, no-store, max-age=0',pragma:'no-cache',expires:'0',vary:'Cookie','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-nexid-data-mode':'production'}});}
export async function forwardRuntimeReadiness(req:Request, deps:Dependencies={credential:()=>getDashboardSessionCredential({persistRotation:true}),fetcher:fetch,apiBase:productUrls.api}){
  if(req.method!=='GET')return json({ok:false,reason:'runtime_console_method_not_allowed'},405);
  if(new URL(req.url).search||req.headers.has('x-http-method-override'))return json({ok:false,reason:'runtime_console_selector_not_allowed'},400);
  if(req.signal.aborted)return json({ok:false,reason:'runtime_console_cancelled'},499);
  const controller=new AbortController(),abort=()=>controller.abort();req.signal.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,15_000);
  try{
    const credential=await deps.credential();
    if(!credential?.session||!credential.bearerToken)return json({ok:false,reason:'runtime_console_session_required'},401);
    if(!canReadRuntimeConsole(credential.session))return json({ok:false,reason:'runtime_console_forbidden'},403);
    if(controller.signal.aborted)throw new RuntimeConsoleError('unavailable');
    const origin=new URL(deps.apiBase);
    if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.search||origin.hash)throw new RuntimeConsoleError('invalid');
    const target=deps.apiBase.replace(/\/$/,'')+'/admin/diagnostics/runtime-readiness';
    const response=await deps.fetcher(target,{method:'GET',cache:'no-store',redirect:'error',headers:{Accept:'application/json',Authorization:'Bearer '+credential.bearerToken},signal:controller.signal});
    const snapshot=await readRuntimeSnapshot(response);
    if(controller.signal.aborted)throw new RuntimeConsoleError('unavailable');
    return json(snapshot);
  }catch(error){
    const status=error instanceof RuntimeConsoleError&&[401,403].includes(error.status)?error.status:503;
    return json({ok:false,reason:status===401?'runtime_console_session_required':status===403?'runtime_console_forbidden':'runtime_console_unavailable'},status);
  }finally{clearTimeout(timer);req.signal.removeEventListener('abort',abort);}
}
