// Local-only fixture for browser acceptance; no database, cloud writes or real accounts.
import http from 'node:http';
import {healthFixture,sdkFixture} from './usage-health-fixtures.mjs';
const state={scenario:'normal',serviceReads:0,sdkReads:0};
const session={id:'local-qa',email:'qa@example.invalid',role:'tenant-admin',tenantId:'qa-local',tenantSlug:'qa-company',label:'EMPRESA QA · datos sintéticos',permissions:['*'],deniedPermissions:[],mfaVerified:true,setupCompleted:true,isDemo:false};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:4197');const path=url.pathname;
  const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
  if(path==='/qa-state')return send(200,{...state,localSyntheticOnly:true});
  if(path==='/qa-scenario'){state.scenario=url.searchParams.get('value')||'normal';return send(200,{localSyntheticOnly:true});}
  if(req.headers.authorization!=='Bearer local-qa-only')return send(401,{ok:false});
  if(path==='/auth/session')return send(200,{ok:true,session});
  if(path==='/admin/observability/service-levels'){
    state.serviceReads++;const payload=healthFixture(url.searchParams.get('window')||'24h');
    if(state.scenario==='forbidden')return send(403,{ok:false});
    if(state.scenario==='unavailable')return send(503,{ok:false});
    if(state.scenario==='invalid')payload.scope.kind='global';
    if(state.scenario==='empty')for(const service of payload.services){service.availability='ready';service.signals=[];for(const metric of service.indicators)Object.assign(metric,{eligibleEvents:0,goodEvents:0,badEvents:0,ratio:null,errorBudgetRemaining:null,burnRate:null,state:'no_data'});}
    return send(200,payload);
  }
  if(path==='/admin/sdk/api-keys'){state.sdkReads++;return send(200,sdkFixture());}
  return send(503,{ok:false,reason:'local_fixture_not_implemented'});
});
server.listen(4197,'127.0.0.1',()=>console.log('LOCAL_USAGE_FIXTURE_READY_4197'));
