// Exclusive loopback fixture with actual task handlers, workflow and PostgreSQL.
import http from 'node:http';import {createTaskFixture,T,B,E,R,V} from './recall-task-local-fixture.mjs';
const f=await createTaskFixture(15624),cid='60000000-0000-4000-8000-000000000001',dest='70000000-0000-4000-8000-000000000001',other='70000000-0000-4000-8000-000000000002';
const doc={kind:'recall',title:'Retiro preventivo del lote QA',reason:'REASON_INTERNAL_NOT_FOR_RECIPIENT',publicMessage:'No utilizar las cajas identificadas en este lote.',instructions:'Separá las unidades en un lugar identificado y coordiná su devolución.',contact:'Equipo de calidad · empresa QA',unitLabel:'cajas',destinations:[{id:dest,recipient:'Distribuidor de prueba · destino propio',assigneeId:V,units:10},{id:other,recipient:'HIDDEN_OTHER_DISTRIBUTOR',assigneeId:R,units:20}]};
let lost=false,unavailable=false;const calls=[];
async function operation(action,extra={},who='editor'){const rows=(await f.query('SELECT version FROM product_recall_cases WHERE id=$1',[cid])).rows;const r=await f.request('/admin/batches/LOT-RECALL-QA/recalls/'+action+'?tenant=recall-qa',who,{operationId:crypto.randomUUID(),caseId:cid,expectedVersion:rows[0]?.version||0,...extra});if(r.status!==200)throw Error(await r.text());}
async function reset(){if((await f.query('SELECT current_database() n')).rows[0].n!=='nexid_e2e_recalls')throw Error('fixture_database_required');await f.query('DELETE FROM product_recall_notice_operations WHERE case_id=$1',[cid]);await f.query('DELETE FROM product_recall_notice_heads WHERE case_id=$1',[cid]);await f.query('DELETE FROM product_recall_notice_reviews WHERE case_id=$1',[cid]);await f.query('DELETE FROM product_recall_operations WHERE case_id=$1',[cid]);await f.query('DELETE FROM product_recall_cases WHERE id=$1',[cid]);await operation('create',{document:doc});await operation('submit');await operation('publish',{},'reviewer');calls.length=0;lost=false;unavailable=false;}
await reset();
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1:4263');const reply=(status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
 if(u.pathname==='/qa-reset'&&req.method==='POST'){await reset();return reply(200,{localOnly:true});}
 if(u.pathname==='/qa-lose-next'&&req.method==='POST'){lost=true;return reply(200,{localOnly:true});}
 if(u.pathname==='/qa-mode'&&req.method==='POST'){unavailable=u.searchParams.get('unavailable')==='1';return reply(200,{localOnly:true});}
 if(u.pathname==='/qa-state')return reply(200,{calls,case:(await f.query('SELECT state,version,progress,document FROM product_recall_cases WHERE id=$1',[cid])).rows[0],operations:(await f.query('SELECT count(*)::int n FROM product_recall_operations WHERE case_id=$1',[cid])).rows[0].n});
 if(u.pathname==='/qa-close'&&req.method==='POST'){await operation('acknowledge',{destinationId:other,reason:'Gestión confirma el otro destino de prueba.',evidenceReference:'OTHER-ACK-001'});await operation('account',{destinationId:other,returnedUnits:20,heldUnits:0,reason:'Gestión concilia el otro destino de prueba.',evidenceReference:'OTHER-COUNT-001'});await operation('request_close',{reason:'Destinos conciliados para revisión independiente.'});await operation('close',{reason:'Cierre de prueba con segunda revisión.'},'reviewer');return reply(200,{localOnly:true});}
 if(u.pathname==='/qa-stop'&&req.method==='POST'){reply(200,{localOnly:true});server.close();await f.close();return;}
 const token=String(req.headers.authorization||'').replace('Bearer ','');if(u.pathname==='/auth/session'){const session=f.taskSession(token);return reply(session?200:401,session?{ok:true,session}:{ok:false});}
 if(u.pathname.startsWith('/admin/recall-tasks')){
  calls.push({path:u.pathname,method:req.method,who:token.replace('qa-task-','')});if(unavailable)return reply(503,{ok:false,reason:'local_unavailable'});
  let raw='';for await(const part of req)raw+=part;const body=raw?JSON.parse(raw):null;const response=await f.taskRequest(u.pathname+u.search,token.replace('qa-task-',''),body);const result=await response.json();
  if(lost&&req.method==='POST'&&response.status===200){lost=false;return reply(503,{ok:false,reason:'local_lost_response_after_commit'});}return reply(response.status,result);
 }
 reply(404,{ok:false});
});server.listen(4263,'127.0.0.1',()=>console.log('ASSIGNED_TASK_REAL_PG_READY_4263'));
