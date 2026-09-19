import {channelAccess} from './batch-channel-http';
import type {AdminSessionResolver} from './auth';
import {previewProduction,commitProduction,printProduction,productionHistory,productionFailure} from './gs1-production-service';
import {readBoundedJsonBody} from './bounded-request-body';
import {json} from './http';
export async function handleProduction(req:Request,bid:string,action:string,resolver?:AdminSessionResolver){
 try{
  if(!['preview','commit','print','history'].includes(action)||req.method!==(action==='history'?'GET':'POST'))return json({ok:false,reason:'method_not_allowed'},405);
  const access=await channelAccess(req,action==='commit',resolver);if(access.response)return access.response;
  const tenant=access.tenant!;
  let result:unknown;
  if(action==='history')result=await productionHistory(tenant,bid,new URL(req.url).searchParams.get('operationId')||undefined);
  else{const input=await readBoundedJsonBody(req,action==='print'?16384:98304);
   result=action==='preview'?await previewProduction(tenant,bid,input):action==='commit'?await commitProduction(tenant,bid,access.principal!.userId,input):await printProduction(tenant,bid,input);}
  if(!result||typeof result!=='object'||Buffer.byteLength(JSON.stringify(result),'utf8')>2097152)throw Error('production_result_unavailable');
  return json({ok:true,...result},200,{'cache-control':'private, no-store'});
 }catch(error){const f=productionFailure(error);return json({ok:false,reason:f.reason},f.status,{'cache-control':'private, no-store'});}
}
