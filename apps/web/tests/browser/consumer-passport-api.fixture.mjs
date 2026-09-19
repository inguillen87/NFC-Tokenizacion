// Loopback QA only: synthetic consumer/session/SUN projections, actual recall handlers and PostgreSQL notices.
import http from 'node:http';import {pathToFileURL} from 'node:url';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
if(process.argv[2]!=='--local-qa'||!process.env.NEXID_QA_API_ROOT)throw Error('Explicit local QA source required');
const api=process.env.NEXID_QA_API_ROOT;
const {createNoticeFixture,T,B,E,R}=await import(pathToFileURL(join(api,'apps/api/scripts/notice-review-local-fixture.mjs')).href);
const {publicNoticesV2}=await import(pathToFileURL(join(api,'apps/api/src/lib/recall-notice-service.ts')).href);
const f=await createNoticeFixture(15687),caseId=randomUUID(),destinationId=randomUUID();let record=null,failed=false,productsMode='normal';const calls=[];
const document={kind:'recall',title:'Aviso vigente de calidad QA',reason:'PRIVATE_INTERNAL_REASON_NEVER_EXPOSE',publicMessage:'No utilizar las unidades de este lote de prueba.',instructions:'Separá el producto y contactá a la empresa para coordinar la devolución.',contact:'Calidad de la empresa QA',unitLabel:'cajas',destinations:[{id:destinationId,recipient:'PRIVATE_DISTRIBUTOR',assigneeId:E,units:10}]};
await f.query('INSERT INTO tenants VALUES($1,$2,$3)',['10000000-0000-4000-8000-000000000002','olive-qa','Oliva QA']);
await f.query("INSERT INTO batches VALUES($1,$2,'LOT-OLIVE-QA','active',$3)",['20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',{product_name:'Aceite de oliva QA'}]);
const origin=JSON.stringify((await f.query('SELECT * FROM tags ORDER BY id')).rows)+JSON.stringify((await f.query('SELECT * FROM batches ORDER BY id')).rows);
const image='/demo/wine-secure/real-malbec-bottle-pexels.jpg';
const items=[{product_name:'Vino reserva QA',brand_name:'Bodega de prueba',tenant_slug:'recall-qa',bid:'LOT-RECALL-QA',latest_tap_event_id:'900001',latest_verdict:'VALID_CLOSED',latest_tap_at:'2026-09-18T12:00:00Z',created_at:'2026-09-18T12:00:00Z',image_url:image,ownership_status:'viewed'},{product_name:'Aceite de oliva QA',brand_name:'Oliva QA',tenant_slug:'olive-qa',bid:'LOT-OLIVE-QA',latest_tap_event_id:'900002',latest_verdict:'QR_VIEW',latest_tap_at:'2026-09-17T12:00:00Z',created_at:'2026-09-17T12:00:00Z',ownership_status:'viewed'},...Array.from({length:12},(_,i)=>({product_name:'Producto guardado '+(i+1),brand_name:'Bodega de prueba',tenant_slug:'recall-qa',bid:'LOT-RECALL-QA',latest_tap_event_id:String(900010+i),ownership_status:'pending'}))];
async function management(action,extra={},who='editor'){const body={operationId:randomUUID(),caseId,expectedVersion:record?.version||0,...extra};const response=await f.request('/admin/batches/LOT-RECALL-QA/recalls/'+action+'?tenant=recall-qa',who,body);const value=await response.json();if(response.status!==200)throw Error(JSON.stringify(value));record=value.case;}
async function publish(){if(record)return;await management('create',{document});await management('submit');await management('publish',{},'reviewer');}
async function lift(){await publish();if(record.state!=='closed'){await management('acknowledge',{destinationId,reason:'Acuse de destino en el ensayo local.',evidenceReference:'QA-ACK-001'});await management('account',{destinationId,returnedUnits:7,heldUnits:3,reason:'Cantidades conciliadas en prueba local.',evidenceReference:'QA-COUNT-001'});await management('request_close',{reason:'Seguimiento completo para revisión independiente.'});await management('close',{reason:'Revisión independiente del cierre de ensayo.'},'reviewer');}
 const proposalId=randomUUID();const command=async()=>{const board=await(await f.noticeRequest(caseId,undefined,null,'editor')).json();const p=board.proposals.find(p=>p.id===proposalId);return {operationId:randomUUID(),caseId,proposalId,expectedReviewVersion:p?.version||0,expectedCaseVersion:board.current.caseVersion,expectedNoticeVersion:board.current.noticeVersion};};
 const actions=[['create_lift',{resolutionMessage:'Aviso levantado tras resolución documentada de la empresa QA.',reason:'Resolución de cierre verificada por el responsable.',evidenceReference:'QA-RESOLUTION-001'},'editor'],['submit',{},'editor'],['approve',{},'reviewer']];
 for(const [action,extra,who] of actions){const response=await f.noticeRequest(caseId,action,{...await command(),...extra},who);if(response.status!==200)throw Error(await response.text());}
}
function contract(request){const id=request.searchParams.get('bid')||'TT-CLOSED-QA',qr=request.searchParams.get('qr')==='1',gs1=request.searchParams.get('carrier')==='gs1_digital_link',opened=id.includes('OPEN'),replay=id.includes('REPLAY'),unknown=id.includes('UNKNOWN');const state=replay?'REPLAY_SUSPECT':unknown?'VALID_UNKNOWN_TAMPER':opened?'VALID_OPENED':'VALID_CLOSED';
 return {ok:true,verdict:qr?'identified':replay?'replay':'valid',status:{code:qr?'IDENTIFIED':state,productState:qr?'NOT_REGISTERED':state,tone:replay?'risk':opened?'warn':'good',tamperSupported:!qr,tamperStatus:qr?'UNKNOWN':unknown?'UNKNOWN':opened?'OPENED':'CLOSED',carrierProfileCode:qr?(gs1?'gs1_digital_link':'qr_basic'):'ntag424_dna_tt'},identity:{bid:'LOT-RECALL-QA',tenantSlug:'recall-qa',tenantId:T,eventId:'900001',uidMasked:'QA****01',readCounter:1,tagStatus:'active'},product:{name:'Vino reserva QA',winery:'Bodega de prueba',category:'Vino',vertical:'vino',imageUrl:image,lotLabel:'Lote de prueba local',region:'Origen declarado de prueba'},tag_tamper:{available:!qr,status:qr?'not_available':unknown?'unknown':opened?'opened':'closed',raw:qr?null:unknown?null:opened?'4F4F':'4343'},technical:{tt:{raw:opened?'4F4F':'4343',interpretedStatus:opened?'OPENED':'CLOSED',source:'enc_decrypted',length:2}},snapshot:id.includes('HISTORICAL')?{mode:'historical',requiresFreshTap:true}:undefined,allowedActions:[],blockedActions:['claim_ownership','register_warranty','tokenize','rewards'],cta:{claimOwnership:false,registerWarranty:false,tokenize:false},provenance:{origin:'Origen declarado',timelineSummary:[]},tapContext:{at:'2026-09-18T12:00:00Z',city:null,country:null}};
}
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1:4287');const reply=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};try{
 if(u.pathname==='/qa-state')return reply(200,{localOnly:true,calls,recallState:record?.state,tagConfigUnchanged:origin===JSON.stringify((await f.query('SELECT * FROM tags ORDER BY id')).rows)+JSON.stringify((await f.query('SELECT * FROM batches ORDER BY id')).rows)});
 if(u.pathname==='/qa-publish'&&req.method==='POST'){await publish();return reply(200,{localOnly:true});}
 if(u.pathname==='/qa-lift'&&req.method==='POST'){await lift();return reply(200,{localOnly:true});}
 if(u.pathname==='/qa-mode'&&req.method==='POST'){failed=u.searchParams.get('notices')==='failed';productsMode=u.searchParams.get('products')||'normal';return reply(200,{localOnly:true});}
 if(u.pathname==='/qa-stop'&&req.method==='POST'){reply(200,{localOnly:true});server.close();await f.close();return;}
 calls.push({path:u.pathname,method:req.method,tenant:u.searchParams.get('tenant'),bid:u.searchParams.get('bid')});
 if(u.pathname==='/public/product-notices/v2'){if(failed)return reply(503,{ok:false});return reply(200,await publicNoticesV2(u.searchParams.get('tenant'),u.searchParams.get('bid')));}
 if(u.pathname==='/sun')return reply(200,contract(u));
 if(u.pathname.startsWith('/consumer/')){
  const authorized=String(req.headers.cookie||'').includes('consumer_qa=local');
  if(u.pathname==='/consumer/session')return reply(200,{ok:true,authenticated:authorized});
  if(!authorized)return reply(401,{ok:false});
  if(u.pathname==='/consumer/me')return reply(200,{ok:true,consumer:{display_name:'Cuenta de prueba local',email:'qa@example.invalid',status:'verified'},stats:{products:14,taps:1}});
  if(u.pathname==='/consumer/products')return productsMode==='failed'?reply(503,{ok:false}):reply(200,{ok:true,items:productsMode==='empty'?[]:items});
  if(u.pathname==='/consumer/brands')return reply(200,{ok:true,items:[{name:'Bodega de prueba',slug:'recall-qa',status:'active',points_balance:0}]});
  const tap={tap_event_id:'900001',tenant_slug:'recall-qa',brand_name:'Bodega de prueba',product_name:'Vino reserva QA',bid:'LOT-RECALL-QA',verdict:'VALID_CLOSED',created_at:'2026-09-18T12:00:00Z',risk_level:'low'};
  if(u.pathname==='/consumer/taps')return reply(200,{ok:true,items:[tap]});
  if(u.pathname==='/consumer/taps/900001')return reply(200,{ok:true,item:tap});
  return reply(404,{ok:false});
 }
 return reply(404,{ok:false});
 }catch(e){console.log('LOCAL_CONSUMER_FIXTURE_ERROR',String(e));return reply(503,{ok:false});}
});server.listen(4287,'127.0.0.1',()=>console.log('CONSUMER_REAL_NOTICE_QA_READY_4287'));
