// LOCAL QA ONLY: binds loopback, synthetic fixtures, no database or external HTTP.
import http from 'node:http';
import {mapFixture} from './map-roll-fixtures.mjs';
const state={imports:0,validations:0,product:{product_name:'Producto QA sintético',sku:'QA-01',winery:'Empresa QA local',region:'Mendoza',public_lot_label:'Rollo QA'},calls:[]};
const session={id:'local-qa',email:'qa@example.invalid',role:'tenant-admin',tenantId:'qa-local',tenantSlug:'qa-company',label:'Empresa QA LOCAL · datos sintéticos',permissions:['*'],deniedPermissions:[],mfaVerified:true,setupCompleted:true,isDemo:false};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:4198');const path=url.pathname;
  const answer=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
  if(path==='/qa-state')return answer(200,{...state,localSyntheticOnly:true});
  if(req.headers.authorization!=='Bearer local-qa-only')return answer(401,{ok:false});
  if(path==='/auth/session')return answer(200,{ok:true,session});
  if(path==='/admin/analytics')return answer(200,{ok:true,scope:{tenant:'qa-company',source:'real',range:'7d'},kpis:{scans:8,validRate:75,invalidRate:25,duplicates:1,tamper:0,activeBatches:1,activeTenants:1,geoRegions:2},trend:[{day:'2026-09-16',scans:3,duplicates:0,tamper:0},{day:'2026-09-17',scans:5,duplicates:1,tamper:0}],batchStatus:[{name:'active',value:1}],geoPoints:[],deviceSignals:[],products:[],feed:[],tagJourney:[],geography:{countries:[{country:'AR',scans:8,risk:1}],cities:[]}});
  if(path==='/admin/sun/physical-taps')return answer(200,mapFixture().payload);
  if(path==='/admin/batches/QA-ROLL-01/summary')return answer(200,{ok:true,batch:{bid:'QA-ROLL-01',tenant_slug:'qa-company',status:'production_registered',product_name:state.product.product_name,requested_quantity:2,imported_tags:state.imports?2:0,active_tags:0,carrier_profile_code:'ntag424_dna_tt',carrier_label:'NTAG424 DNA TT',product_identity:state.product,sdm_config:state.product,unit_metadata:{samples:[]},manifests:[]}});
  if(path==='/admin/batches/QA-ROLL-01/import-manifest' && req.method==='POST'){
    let body='';for await(const chunk of req)body+=chunk;const p=JSON.parse(body);
    state.calls.push({path,dryRun:p.dryRun,activateImported:p.activateImported,bytes:p.csv?.length});
    if(p.activateImported!==false)return answer(422,{ok:false,reason:'activation_not_allowed_in_fixture'});
    if(p.dryRun)state.validations++;else state.imports++;
    return answer(200,{ok:true,batch:'QA-ROLL-01',...(p.dryRun?{dryRun:true}:{}),importedRows:2,inserted:2,duplicateUids:[],activated:false});
  }
  if(path==='/admin/batches/QA-ROLL-01/product-config' && req.method==='PATCH'){
    let body='';for await(const chunk of req)body+=chunk;const p=JSON.parse(body);state.product={...state.product,...p};state.calls.push({path,fields:Object.keys(p)});return answer(200,{ok:true,bid:'QA-ROLL-01'});
  }
  answer(503,{ok:false,reason:'local_fixture_not_implemented'});
});
server.listen(4198,'127.0.0.1',()=>console.log('LOCAL_SYNTHETIC_API_READY_4198'));
