// Loopback fixture. Data and accounts are synthetic; the permission derivation is the actual API module.
import {readFile} from 'node:fs/promises';
import http from 'node:http';import {pathToFileURL} from 'node:url';
import {dossierFixture} from './batch-dossier-fixtures.mjs';
const {batchWorkbenchPermissions}=await import(pathToFileURL(process.env.BATCH_POLICY_PATH).href);
const state={lists:0,summaries:0,patches:[],mode:'ready',product:'Producto de prueba local'};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:4197'),reply=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
 if(url.pathname==='/qa-state')return reply(200,state);
 if(url.pathname==='/qa-reset'&&req.method==='POST'){Object.assign(state,{lists:0,summaries:0,patches:[],mode:'ready',product:'Producto de prueba local'});return reply(200,{ok:true});}
 if(url.pathname==='/qa-mode'&&req.method==='POST'){state.mode=url.searchParams.get('mode');return reply(200,{ok:true});}
 const token=String(req.headers.authorization||''),denied=token==='Bearer workbench-qa-denied';
 if(token!=='Bearer workbench-qa-admin'&&!denied)return reply(401,{ok:false});
 const rawPermissions=['batch.product.configure','manifest.import','supplier_order.create'];
 if(url.pathname==='/auth/session')return reply(200,{ok:true,session:{id:'qa-session',userId:'qa-user',email:'qa@example.invalid',role:'tenant-admin',tenantId:'10000000-0000-4000-8000-000000000001',tenantSlug:'qa-company',label:'Empresa QA · cuenta sintética',permissions:batchWorkbenchPermissions({role:'tenant-admin',permissions:rawPermissions,deniedPermissions:denied?['batches:read']:[]}),deniedPermissions:denied?['batches:read']:[],mfaVerified:false,setupCompleted:true,isDemo:false}});
 if(denied)return reply(403,{ok:false});
 if(url.pathname==='/admin/supplier-reception'){
  const data=JSON.parse(await readFile(new URL('./reception-source.fixture.json',import.meta.url),'utf8'));
  data.actor={...data.actor,role:'tenant-admin',scope:'tenant',tenantSlug:'qa-company'};
  data.tenant={...data.tenant,slug:'qa-company',name:'Empresa QA',id:'10000000-0000-4000-8000-000000000001'};
  data.tenantOptions=[data.tenant];data.orders=[];data.batches=[];
  return reply(200,data);
 }
 if(url.pathname==='/admin/batches'){
  state.lists++;if(state.mode==='unavailable')return reply(503,{ok:false});
  const row={id:'20000000-0000-4000-8000-000000000001',bid:'QA-ROLL-01',tenant_slug:state.mode==='foreign'?'other-company':'qa-company',product_name:state.product,sku:'QA-SKU',winery:'Marca QA',carrier_label:'NTAG 424 DNA TT',status:'active',quantity:20,active_tags:10,inactive_tags:10,revoked_tags:0,requested_quantity:null,editorial_managed:false};
  return reply(200,state.mode==='empty'?[]:[row]);
 }
 if(url.pathname==='/admin/batches/QA-ROLL-01/summary'){
  state.summaries++;const batch=dossierFixture();batch.product_name=state.product;batch.product_identity.product_name=state.product;batch.imported_tags=20;batch.active_tags=10;batch.inactive_tags=10;batch.editorial_managed=false;return reply(200,{ok:true,batch});
 }
 if(url.pathname==='/admin/batches/QA-ROLL-01/product-config'&&req.method==='PATCH'){
  let text='';for await(const chunk of req)text+=chunk;const body=JSON.parse(text);state.patches.push(body);state.product=body.product_name||state.product;return reply(200,{ok:true,bid:'QA-ROLL-01'});
 }
 return reply(503,{ok:false,reason:'local_fixture_not_implemented'});
});server.listen(4197,'127.0.0.1',()=>console.log('BATCHES_LOCAL_FIXTURE_READY_4197'));
