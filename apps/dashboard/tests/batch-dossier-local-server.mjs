// Loopback-only application fixture. No external connections, real credentials or database.
import http from 'node:http';
import {dossierFixture,dossierReadingFixture} from './batch-dossier-fixtures.mjs';
const state={summaries:0,readings:0,patches:[],readMode:'ready',product:'Producto de prueba local'};
function session(viewer) { return {id:'qa-local',email:'qa@example.invalid',role:viewer?'viewer':'tenant-admin',tenantId:'qa-local',tenantSlug:'qa-company',label:'Empresa QA · datos sintéticos',permissions:viewer?['batches:read']:['*'],deniedPermissions:[],mfaVerified:true,setupCompleted:true,isDemo:false}; }
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:4196');
  const reply=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
  if(url.pathname==='/qa-state')return reply(200,state);
  if(url.pathname==='/qa-reset'&&req.method==='POST'){Object.assign(state,{summaries:0,readings:0,patches:[],readMode:'ready',product:'Producto de prueba local'});return reply(200,{ok:true});}
  if(url.pathname==='/qa-read-mode'&&req.method==='POST'){let s='';for await(const chunk of req)s+=chunk;state.readMode=JSON.parse(s).mode;return reply(200,{ok:true});}
  const token=req.headers.authorization;
  if(token!=='Bearer local-dossier-admin'&&token!=='Bearer local-dossier-viewer')return reply(401,{ok:false});
  if(url.pathname==='/auth/session')return reply(200,{ok:true,session:session(token.endsWith('viewer'))});
  if(url.pathname==='/admin/batches/QA-ROLL-01/summary'){
    state.summaries++;const batch=dossierFixture();batch.product_name=state.product;batch.product_identity.product_name=state.product;
    return reply(200,{ok:true,batch});
  }
  if(url.pathname==='/admin/batches/QA-ROLL-01/product-config'&&req.method==='PATCH'){
    if(token.endsWith('viewer'))return reply(403,{ok:false});
    let body='';for await(const chunk of req)body+=chunk;const fields=JSON.parse(body);state.patches.push(fields);state.product=fields.product_name||state.product;
    return reply(200,{ok:true,bid:'QA-ROLL-01'});
  }
  if(url.pathname==='/admin/sun/physical-taps'){
    state.readings++;if(token.endsWith('viewer'))return reply(403,{ok:false});if(state.readMode==='offline')return reply(503,{ok:false});
    const payload=dossierReadingFixture(url.searchParams.get('range')||'24h');
    if(state.readMode==='foreign')payload.scope.tenant='another-company';
    if(state.readMode==='empty'){payload.rows=[];payload.summary={...payload.summary,total:0,closed:0,opened:0,other:0,distinctUnits:0,latestAt:null};}
    return reply(200,payload);
  }
  return reply(503,{ok:false,reason:'local_fixture_not_implemented'});
});
server.listen(4196,'127.0.0.1',()=>console.log('LOCAL_DOSSIER_FIXTURE_READY_4196'));
