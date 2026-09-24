import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

assert.ok(process.env.PLAYWRIGHT_MODULE&&process.env.AXE_MODULE_PATH,'Installed browser and axe modules are required; no downloads');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axeSource=await readFile(process.env.AXE_MODULE_PATH,'utf8');
const dashboard=fileURLToPath(new URL('../',import.meta.url)), root=resolve(dashboard,'../..');
const output=resolve(process.env.QA_OUTPUT||'artifacts/supplier-request-quotes-browser');await mkdir(output,{recursive:true});
const actor='20000000-0000-4000-8000-000000000001',tenantId='10000000-0000-4000-8000-000000000001';
const principal={id:actor,role:'operations-manager',tenantSlug:'qa-only',permissions:['supplier_order.create'],deniedPermissions:[],isDemo:false};
const fixture=`import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{SupplierRequestWorkspace}from'./src/components/supplier-request-workspace';import CreateSupplierOrderPage from './src/app/(app)/supplier-orders/create/page';
function Fixture(){const[props,setProps]=useState(window.__qaInitial);window.__qaContext=next=>setProps(current=>({...current,...next}));return <div className="dashboard-main mx-auto w-full max-w-7xl min-w-0 p-4 md:p-8"><aside aria-label="Alcance de la prueba" className="mb-4 text-sm">QA local: solicitudes y transporte sintéticos. No crea pedidos, llaves ni registros de producción.</aside>{location.search.includes('view=order')?<CreateSupplierOrderPage/>:<SupplierRequestWorkspace {...props}/>}</div>}createRoot(document.getElementById('root')).render(<Fixture/>);`;
const bundle=await build({stdin:{contents:fixture,loader:'tsx',resolveDir:dashboard},bundle:true,write:false,outfile:'fixture.js',format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},logLevel:'silent',plugins:[{name:'synthetic-navigation',setup(builder){builder.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'qa'}));builder.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:`const router={push(url){(window.__qaNavigations ||= []).push(url)},replace(url){(window.__qaNavigations ||= []).push(url)},refresh(){}};export const useRouter=()=>router;export const useSearchParams=()=>new URLSearchParams(location.search);`,loader:'js'}));}}]});
const css=(await postcss([tailwindcss({content:[join(dashboard,'src/**/*.{ts,tsx}').replaceAll('\\','/'),join(root,'packages/ui/src/**/*.{ts,tsx}').replaceAll('\\','/'),{raw:fixture,extension:'tsx'}],darkMode:['selector','[data-theme="dark"]'],theme:{extend:{colors:{brand:{dark:'#020617',card:'#0f172a',border:'#1e293b',cyan:'#06b6d4',blue:'#3b82f6'}}}},plugins:[]})]).process(await readFile(join(dashboard,'src/app/globals.css'),'utf8'),{from:undefined})).css+(bundle.outputFiles.find(f=>f.path.endsWith('.css'))?.text||'');
const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).contents;
const server=createServer((req,res)=>{const url=new URL(req.url,'http://qa.invalid');if(req.method!=='GET'){res.writeHead(405);return res.end();}if(url.pathname==='/fixture.js'){res.setHeader('content-type','text/javascript');return res.end(js);}if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}if(url.pathname!=='/'){res.writeHead(404);return res.end();}const theme=url.searchParams.get('theme')==='dark'?'dark':'light';res.setHeader('content-type','text/html;charset=utf-8');res.end(`<!doctype html><html lang="es-AR" data-theme="${theme}" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Solicitudes · QA sintética</title><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);});
await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const report={localOnly:true,syntheticData:true,actualComponents:['SupplierRequestWorkspace','SupplierRequestQuotation'],actualClientContract:true,httpBoundaryMocked:true,navigationStubbed:true,realNextServer:false,realDatabase:false,productionTested:false,checks:[],views:[],clientErrors:[],blockedRequests:[]};
function check(value,description){report.checks.push({description,passed:Boolean(value)});}
const tick=page=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
async function waitFor(predicate){for(let n=0;n<300;n++){if(predicate())return;await new Promise(done=>setTimeout(done,20));}assert.ok(predicate(),'Expected synthetic HTTP operation');}
const item=(patch={})=>({id:randomUUID(),tenant_id:tenantId,tenant_slug:'qa-only',title:'Solicitud sintética guardada',construction_id:'',quantity:null,pack_purpose:null,notes:'Nota parcial sintética',status:'draft',revision:1,created_at:'2026-09-23T12:00:00.000Z',updated_at:'2026-09-23T12:00:00.000Z',submitted_at:null,order_id:null,review_summary:{state:'pending',revision:0,updated_at:null},...patch});
const submitted=patch=>item({construction_id:'tt_bridge',quantity:125,pack_purpose:'trial_integration',status:'submitted',revision:3,submitted_at:'2026-09-23T12:01:00.000Z',...patch});
const envelope=(tenant,body)=>({ok:true,protocol:'nexid.supplier-request.v1',scope:tenant?{mode:'tenant',tenant_id:tenantId,tenant_slug:tenant}:{mode:'global',tenant_id:null,tenant_slug:null},...body});
const reviewEvent=(request,revision,patch={})=>({id:randomUUID(),revision,request_revision:request.revision,action:revision%2?'request_information':'respond',message:`Mensaje sintético de aclaración ${revision}`,actor_id:revision%2?'20000000-0000-4000-8000-000000000002':actor,created_at:new Date(Date.UTC(2026,8,23,12,0,revision)).toISOString(),...patch});
function reviewSummary(events){const last=events.at(-1);return last?{state:last.action==='request_information'?'needs_information':'answered',revision:last.revision,updated_at:last.created_at}:{state:'pending',revision:0,updated_at:null};}
async function inspect(page,name,width,theme){
  await page.addScriptTag({content:axeSource});
  const violations=await page.evaluate(async()=>(await axe.run('main',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));
  const dimensions=await page.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}));
  const clippedControls=await page.locator('main input,main textarea,main select,main button,main fieldset,main code').evaluateAll(nodes=>nodes.filter(node=>{const b=node.getBoundingClientRect();return b.width>0&&b.height>0&&(b.left< -1||b.right>document.documentElement.clientWidth+1);}).map(node=>node.getAttribute('data-testid')||node.tagName));
  const screenshot=`${name}-${width}-${theme}.png`;await page.screenshot({path:join(output,screenshot),fullPage:true});report.views.push({name,width,theme,violations,dimensions,clippedControls,screenshot});
  check(!violations.some(v=>['serious','critical'].includes(v.impact)),`${name} ${width} ${theme}: axe serious/critical zero`);check(dimensions.scrollWidth<=dimensions.width+1&&!clippedControls.length,`${name} ${width} ${theme}: no clipped controls or overflow`);
}
async function scenario(width=390,theme='light',options={}){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce',serviceWorkers:'block',locale:'es-AR'});const page=await context.newPage();page.setDefaultTimeout(12000);
  const props={access:{...principal,...options.access},...(options.initialRequestId?{initialRequestId:options.initialRequestId}:{}),...(options.initialTenant?{initialTenant:options.initialTenant}:{})};
  await page.addInitScript(value=>window.__qaInitial=value,props);
  page.on('pageerror',error=>report.clientErrors.push(error.message));
  const state={quoteReads:[],quoteWrites:[],quoteEvents:new Map(),quoteReceipts:new Map(),quoteCommits:0,quoteMode:'success',quoteReadMode:'success',quotePending:[],quotesEnabled:true,activeRole:props.access.role,cancelReads:[],cancelWrites:[],cancelMode:'success',cancelReadMode:'success',cancelPending:[],cancelReceipts:new Map(),cancelCommits:0,reads:[],writes:[],orderWrites:[],rows:options.store?.rows||new Map((options.rows||[]).map(row=>[row.id,row])),receipts:new Map(),mode:'success',pending:[],truncated:false,reviewReads:[],reviewWrites:[],reviewEvents:options.store?.reviewEvents||new Map(),reviewReceipts:options.store?.reviewReceipts||new Map(),reviewMode:'success',reviewReadMode:options.reviewReadMode||'success',reviewPending:[]};
  if(options.history){for(const [id,events]of options.history){state.reviewEvents.set(id,events);state.rows.get(id).review_summary=reviewSummary(events);}}
  async function send(route,status,body){await route.fulfill({status,headers:{'content-type':'application/json','x-nexid-data-mode':'production'},body:JSON.stringify(body)}).catch(()=>{});}
  function reviewResult(id,tenant,before){const row=state.rows.get(id),all=state.reviewEvents.get(id)||[],eligible=before===undefined?all:all.filter(event=>event.revision<before),history=eligible.slice(-100),truncated=eligible.length>history.length;return {...envelope(tenant,{}),protocol:'nexid.supplier-request-review.v1',request_id:id,request_revision:row.revision,review:reviewSummary(all),history,count:history.length,truncated,next_before_revision:truncated?history[0].revision:null};}
  function commitReview(request,tenant,id){const body=request.postDataJSON(),key=request.headers()['idempotency-key'],prior=state.reviewReceipts.get(key),row=state.rows.get(id),events=state.reviewEvents.get(id)||[];
    if(prior)return {...reviewResult(id,tenant),receipt:prior,idempotent_replay:true};
    if(body.expected_revision!==events.length||body.expected_request_revision!==row.revision)return {ok:false,reason:'supplier_request_review_revision_conflict'};
    const event=reviewEvent(row,events.length+1,{action:body.action,message:body.message});state.reviewEvents.set(id,[...events,event]);row.review_summary=reviewSummary([...events,event]);const receipt={idempotency_key:key,action:body.action,revision:event.revision};state.reviewReceipts.set(key,receipt);return {...reviewResult(id,tenant),receipt,idempotent_replay:false};}
  function commit(request,tenant,path){
    const body=request.postDataJSON(),key=request.headers()['idempotency-key'],action=path.endsWith('/submit')?'submit':request.method()==='PATCH'?'patch':'create';
    const id=action==='create'?null:path.split('/')[4],prior=state.receipts.get(key);
    if(prior)return envelope(tenant,{request:state.rows.get(prior.id),receipt:prior.receipt,idempotent_replay:true});
    const previous=id?state.rows.get(id):null;
    const value=action==='create'?item({...body,tenant_slug:tenant}):action==='patch'?{...previous,...body,revision:previous.revision+1}:{...previous,status:'submitted',revision:previous.revision+1,submitted_at:'2026-09-23T12:01:00.000Z'};
    delete value.expected_revision;state.rows.set(value.id,value);const receipt={idempotency_key:key,action,revision:value.revision};state.receipts.set(key,{id:value.id,receipt});return envelope(tenant,{request:value,receipt,idempotent_replay:false});
  }
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==origin){report.blockedRequests.push(request.method()+' '+url.origin+url.pathname);return route.abort();}
    if(request.method()==='GET'&&url.pathname==='/api/session/current')return send(route,200,{ok:true,session:{...principal,role:'super-admin',tenantSlug:null,permissions:['supplier_order.create','batch.keys.generate'],mfaVerified:true,...options.access}});
    if(request.method()==='POST'&&url.pathname==='/api/admin/supplier-orders'){
      state.orderWrites.push(request.postDataJSON());return send(route,201,{ok:true,order:{id:'60000000-0000-4000-8000-000000000001',tenant_slug:'qa-only'}});
    }
    if(url.pathname.startsWith('/api/admin/supplier-requests')){
      const tenant=url.searchParams.get('tenant')||'';
      if(url.pathname.endsWith('/quotation')){
        const id=url.pathname.split('/')[4],row=state.rows.get(id);if(!row)return send(route,404,{ok:false,reason:'supplier_request_not_found'});
        const snapshot=(before=null)=>{const events=state.quoteEvents.get(id)||[],eligible=before===null?events:events.filter(e=>e.revision<before),history=eligible.slice(-50),first=history[0]?.revision;
          return{...envelope(tenant,{}),protocol:'nexid.supplier-quote.v1',request:structuredClone(row),revision:row.quotation_revision||0,current:events.length?structuredClone(events.at(-1)):null,history:structuredClone(history),count:history.length,truncated:Boolean(first&&first>1),next_before_revision:first&&first>1?first:null,as_of:new Date().toISOString(),writes_enabled:state.quotesEnabled};};
        if(request.method()==='GET'){
          state.quoteReads.push({id,query:url.search});
          if(state.quoteReadMode==='unavailable')return send(route,503,{ok:false,reason:'supplier_quotes_unavailable'});
          if(state.quoteReadMode==='forbidden')return send(route,403,{ok:false,reason:'supplier_quote_scope_forbidden'});
          const result=snapshot(url.searchParams.has('before_revision')?Number(url.searchParams.get('before_revision')):null);
          if(state.quoteReadMode==='foreign')result.scope.tenant_id='10000000-0000-4000-8000-000000000099';
          if(state.quoteReadMode==='delayed'){state.quotePending.push({route,result,read:true});return;}
          return send(route,200,result);
        }
        const body=request.postDataJSON(),key=request.headers()['idempotency-key'];state.quoteWrites.push({id,key,body,tenant});
        const commit=()=>{
          const old=state.quoteReceipts.get(key);if(old)return{...snapshot(),receipt:old,idempotent_replay:true};
          const events=state.quoteEvents.get(id)||[],current=events.at(-1);
          if(row.status!=='submitted')return{ok:false,reason:'supplier_request_not_submitted'};
          if(body.expected_request_revision!==row.revision||body.expected_revision!==events.length||body.expected_review_revision!==row.review_summary.revision)return{ok:false,reason:'supplier_quote_revision_conflict'};
          if(['issue','withdraw'].includes(body.action)!==(state.activeRole==='super-admin'))return{ok:false,reason:'supplier_quote_scope_forbidden'};
          if(current?.state==='accepted'||body.action!=='issue'&&current?.state!=='offered')return{ok:false,reason:'supplier_quote_transition_invalid'};
          if(body.action==='accept'&&Date.parse(current.valid_until)<=Date.now())return{ok:false,reason:'supplier_quote_expired'};
          const offer=body.offer||current,at=new Date().toISOString(),revision=events.length+1,version=body.action==='issue'?(current?.quote_version||0)+1:current.quote_version;
          const event={id:randomUUID(),revision,request_revision:row.revision+1,quote_version:version,source_request_revision:body.action==='issue'?row.revision:current.source_request_revision,review_revision:body.expected_review_revision,action:body.action,state:({issue:'offered',accept:'accepted',reject:'rejected',withdraw:'withdrawn'})[body.action],currency:offer.currency,net_minor:offer.net_minor,tax_minor:offer.tax_minor,shipping_minor:offer.shipping_minor,total_minor:offer.net_minor+offer.tax_minor+offer.shipping_minor,valid_until:offer.valid_until,conditions:offer.conditions,reason:body.reason,actor_id:state.activeRole==='super-admin'?'20000000-0000-4000-8000-000000000002':actor,created_at:at};
          Object.assign(row,{revision:row.revision+1,quotation_revision:revision,quotation_state:event.state,updated_at:at});state.quoteEvents.set(id,[...events,event]);state.quoteCommits++;
          const receipt={idempotency_key:key,action:body.action,revision,request_revision:row.revision,quote_version:version};state.quoteReceipts.set(key,receipt);return{...snapshot(),receipt,idempotent_replay:false};
        };
        if(state.quoteMode==='delayed'||state.quoteMode==='hang'){state.quotePending.push({route,commit});return;}
        if(state.quoteMode==='forbidden')return send(route,403,{ok:false,reason:'supplier_quote_scope_forbidden'});
        if(state.quoteMode==='conflict')return send(route,409,{ok:false,reason:'supplier_quote_revision_conflict'});
        const result=commit();if(state.quoteMode==='commit-lost')return send(route,503,{ok:false,reason:'synthetic_receipt_lost'});if(state.quoteMode==='malformed'&&result.receipt)result.receipt={...result.receipt,idempotency_key:randomUUID()};return send(route,result.ok?200:409,result);
      }

      if(url.pathname.endsWith('/cancellation')){
        const id=url.pathname.split('/')[4],row=state.rows.get(id);
        const current=()=>({...envelope(tenant,{}),protocol:'nexid.supplier-request-cancellation.v1',available:true,request:structuredClone(state.rows.get(id))});
        if(request.method()==='GET'){
          state.cancelReads.push({id,tenant});
          if(state.cancelReadMode==='unavailable')return send(route,503,{ok:false,reason:'supplier_request_cancellation_disabled'});
          if(state.cancelReadMode==='foreign'){const bad=current();bad.scope.tenant_slug='wrong';return send(route,200,bad);}
          if(state.cancelReadMode==='delayed'){state.cancelPending.push({route,result:current(),read:true});return;}
          return send(route,row?200:404,row?current():{ok:false,reason:'supplier_request_not_found'});
        }
        if(request.method()!=='POST'){report.blockedRequests.push(request.method()+' '+url.pathname);return route.abort();}
        const command={id,tenant,key:request.headers()['idempotency-key'],body:request.postDataJSON()};state.cancelWrites.push(command);
        const commit=()=>{
          const old=state.cancelReceipts.get(command.key);if(old)return{...current(),receipt:old,idempotent_replay:true};
          if(row.status!=='submitted')return{ok:false,reason:'supplier_request_cancellation_not_submitted'};
          if(command.body.expected_revision!==row.revision||command.body.expected_review_revision!==row.review_summary.revision)return{ok:false,reason:'supplier_request_review_revision_conflict'};
          const at='2026-09-24T13:00:00.000Z';Object.assign(row,{status:'cancelled',revision:row.revision+1,cancellation_reason:command.body.reason,cancelled_by:actor,cancelled_at:at,updated_at:at});state.cancelCommits++;
          const receipt={idempotency_key:command.key,action:'cancel',revision:row.revision};state.cancelReceipts.set(command.key,receipt);return{...current(),receipt,idempotent_replay:false};
        };
        if(state.cancelMode==='delayed'||state.cancelMode==='hang'){state.cancelPending.push({route,commit});return;}
        if(state.cancelMode==='forbidden')return send(route,403,{ok:false,reason:'supplier_request_scope_forbidden'});
        if(state.cancelMode==='conflict')return send(route,409,{ok:false,reason:'supplier_request_review_revision_conflict'});
        const result=commit();if(state.cancelMode==='commit-lost')return send(route,503,{ok:false,reason:'synthetic_response_lost'});
        if(state.cancelMode==='malformed'&&result.receipt)result.receipt={...result.receipt,idempotency_key:randomUUID()};
        return send(route,result.ok?200:409,result);
      }
      if(url.pathname.endsWith('/review')){
        const id=url.pathname.split('/')[4];
        if(request.method()==='GET'){
          state.reviewReads.push(url.pathname+url.search);
          if(state.reviewReadMode==='delayed'){state.reviewPending.push({route,request,tenant,id,before:url.searchParams.has('before_revision')?Number(url.searchParams.get('before_revision')):undefined,read:true});return;}
          if(state.reviewReadMode==='503')return send(route,503,{ok:false,reason:'synthetic_unavailable'});
          const value=reviewResult(id,tenant,url.searchParams.has('before_revision')?Number(url.searchParams.get('before_revision')):undefined);
          if(state.reviewReadMode==='foreign')value.scope.tenant_slug='foreign';if(state.reviewReadMode==='demo')value.demo=true;
          return send(route,200,value);
        }
        if(request.method()!=='POST'){report.blockedRequests.push(request.method()+' '+url.pathname);return route.abort();}
        state.reviewWrites.push({id,tenant,key:request.headers()['idempotency-key'],body:request.postDataJSON()});
        if(state.reviewMode==='delayed'||state.reviewMode==='hang'){state.reviewPending.push({route,request,tenant,id});return;}
        if(state.reviewMode==='conflict')return send(route,409,{ok:false,reason:'supplier_request_review_revision_conflict'});
        if(state.reviewMode==='forbidden')return send(route,403,{ok:false,reason:'supplier_request_scope_forbidden'});
        if(state.reviewMode==='503')return send(route,503,{ok:false,reason:'synthetic_unavailable'});
        const value=commitReview(request,tenant,id);
        if(state.reviewMode==='commit-lost')return send(route,503,{ok:false,reason:'synthetic_response_lost'});
        if(state.reviewMode==='malformed')value.receipt.idempotency_key=randomUUID();
        return send(route,value.ok?200:409,value);
      }
      if(request.method()==='GET'){
        state.reads.push(url.pathname+url.search);
        if(state.mode==='read-error')return send(route,503,{ok:false,reason:'synthetic_unavailable'});
        const id=url.pathname.split('/')[4];
        if(id){const row=state.rows.get(id);return send(route,row?200:404,row?envelope(tenant,{request:row}):{ok:false,reason:'supplier_request_not_found'});}
        const items=[...state.rows.values()].filter(row=>tenant?row.tenant_slug===tenant:row.status!=='draft');return send(route,200,envelope(tenant,{items,count:items.length,truncated:state.truncated}));
      }
      if(!['POST','PATCH'].includes(request.method())){report.blockedRequests.push(request.method()+' '+url.pathname);return route.abort();}
      state.writes.push({path:url.pathname,tenant,method:request.method(),body:request.postDataJSON(),key:request.headers()['idempotency-key']});
      if(state.mode==='delayed'||state.mode==='hang'){state.pending.push({route,request,tenant,path:url.pathname});return;}
      if(state.mode==='reject')return send(route,400,{ok:false,reason:'supplier_request_input_invalid'});
      if(state.mode==='forbidden')return send(route,403,{ok:false,reason:'supplier_request_scope_forbidden'});
      if(state.mode==='conflict')return send(route,409,{ok:false,reason:'supplier_request_revision_conflict'});
      if(state.mode==='503')return send(route,503,{ok:false,reason:'synthetic_unavailable'});
      const result=commit(request,tenant,url.pathname);
      if(state.mode==='commit-lost')return send(route,503,{ok:false,reason:'synthetic_response_lost'});
      if(state.mode==='malformed')result.receipt.revision+=1;
      return send(route,200,result);
    }
    if(request.method()==='GET'&&['/','/fixture.js','/favicon.ico'].includes(url.pathname))return route.continue();
    report.blockedRequests.push(request.method()+' '+url.pathname);return route.abort();
  });
  state.releaseQuotes=async()=>{for(const pending of state.quotePending.splice(0)){const result=pending.read?pending.result:pending.commit();await send(pending.route,result.ok?200:409,result);}};
  state.changeRole=async role=>{state.activeRole=role;await page.evaluate(role=>window.__qaContext({access:{id:role==='super-admin'?'session-sa':'session-company',role,tenantSlug:role==='super-admin'?null:'qa-only',tenantId:role==='super-admin'?null:'10000000-0000-4000-8000-000000000001',permissions:['supplier_order.create'],deniedPermissions:[],isDemo:false}}),role);await tick(page);};
  state.releaseCancellation=async()=>{for(const pending of state.cancelPending.splice(0)){const result=pending.read?pending.result:pending.commit();await send(pending.route,result.ok?200:409,result);}};
  state.release=async()=>{for(const pending of state.pending.splice(0))await send(pending.route,200,commit(pending.request,pending.tenant,pending.path));};
  state.releaseReview=async()=>{for(const pending of state.reviewPending.splice(0)){const body=pending.read?reviewResult(pending.id,pending.tenant,pending.before):commitReview(pending.request,pending.tenant,pending.id);await send(pending.route,body.ok?200:409,body);}};
  await page.goto(origin+'/?theme='+theme+(options.source?`&view=order&request=${options.source.id}&tenant=${options.source.tenant_slug}`:''),{waitUntil:'networkidle'});
  if(options.source)await page.getByTestId('supplier-order-submit').waitFor();else{await page.getByTestId('supplier-request-workspace').waitFor();if(!options.denied)await page.getByRole('button',{name:'Actualizar bandeja'}).waitFor();}await tick(page);
  return {context,page,state};
}
async function fill(page,complete=false){await page.getByTestId('supplier-request-title').fill('Proyecto sintético conservado');await page.getByTestId('supplier-request-notes').fill('Necesidad parcial <b>literal</b>\nSin secretos');if(complete){await page.getByTestId('supplier-request-construction').selectOption('tt_bridge');await page.getByTestId('supplier-request-quantity').fill('125');await page.getByTestId('supplier-request-purpose').selectOption('trial_integration');}}
async function saved(page){await page.getByTestId('supplier-request-status').filter({hasText:'Guardado confirmado'}).waitFor();}
async function reviewReady(page){await page.getByTestId('supplier-request-review-panel').waitFor();await page.waitForFunction(()=>{const state=document.querySelector('[data-testid="supplier-request-review-state"]');return state&&!state.textContent.includes('Consultando');});}
async function inspectReview(page,message){await page.getByTestId('supplier-request-review-message').fill(message);await page.getByTestId('supplier-request-review-inspect').click();await page.getByTestId('supplier-request-review-confirmation').waitFor();}
async function reviewSaved(page,revision){await page.getByTestId('supplier-request-review-receipt').filter({hasText:`Mensaje guardado · revisión ${revision}`}).waitFor();}
const nexid={role:'super-admin',tenantSlug:null};
const openedOptions=(row,extra={})=>({rows:[row],initialRequestId:row.id,initialTenant:row.tenant_slug,...extra});


const quoteRow=(patch={})=>submitted({quotation_revision:0,quotation_state:null,...patch});
const localFuture=()=>{const d=new Date(Date.now()+7*86400000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
async function openQuote(page){await page.getByTestId('quote-open').click();await page.getByTestId('quote-refresh').waitFor();}
async function fillOffer(page,patch={}){const form={currency:'USD',net:'100,01',tax:'21',shipping:'4.99',conditions:'Entrega y alcance pactados en esta propuesta. <b>Texto literal</b>',reason:'Cotización inicial sin compromisos automáticos.',...patch};await page.getByTestId('quote-currency').selectOption(form.currency);await page.getByTestId('quote-net').fill(form.net);await page.getByTestId('quote-tax').fill(form.tax);await page.getByTestId('quote-shipping').fill(form.shipping);await page.getByTestId('quote-valid-until').fill(localFuture());await page.getByTestId('quote-conditions').fill(form.conditions);await page.getByTestId('quote-reason').fill(form.reason);}
async function quoteReady(page){await page.getByTestId('quote-refresh').waitFor();}
async function quoteSaved(page,revision){await page.getByTestId('quote-receipt').filter({hasText:'revisión '+revision+' ·'}).waitFor();}
async function issue(test){await openQuote(test.page);await test.page.getByTestId('quote-issue').click();await fillOffer(test.page);await test.page.getByTestId('quote-inspect').click();await test.page.getByTestId('quote-confirm').click();await quoteSaved(test.page,1);}
try{
 for(const theme of ['light','dark'])for(const width of [320,390,1440]){
  const row=quoteRow(),test=await scenario(width,theme,openedOptions(row,{access:nexid}));await reviewReady(test.page);
  check(test.state.quoteReads.length===0&&test.state.quoteWrites.length===0,'Quotation has no polling or automatic quote read');await openQuote(test.page);
  check(await test.page.getByTestId('quote-accept').count()===0&&await test.page.getByTestId('quote-reject').count()===0,'NexID cannot accept or reject for the company');
  await test.page.getByTestId('quote-issue').click();check(await test.page.getByTestId('quote-net').inputValue()===''&&await test.page.getByTestId('quote-tax').inputValue()===''&&await test.page.getByTestId('quote-currency').inputValue()==='','No automatic currency, tax or price is invented');
  await test.page.getByTestId('quote-inspect').click();check(test.state.quoteWrites.length===0,'Empty amounts cannot produce a reviewed command');await fillOffer(test.page);
  check(await test.page.getByRole('button',{name:'Actualizar bandeja',exact:true}).isDisabled()&&await test.page.getByTestId('supplier-request-review-refresh').isDisabled(),'Quotation edit suspends competing parent and clarification operations');
  await test.page.getByTestId('quote-inspect').click();await test.page.getByTestId('quote-confirmation').waitFor();
  check((await test.page.getByTestId('quote-confirmation').innerText()).includes('USD 126,00')&&test.state.quoteWrites.length===0,'Confirmation totals exact declared decimal input before any write');
  check(await test.page.getByTestId('quote-confirmation').locator('h3').evaluate(n=>document.activeElement===n),'Quotation confirmation receives keyboard focus');await inspect(test.page,'issue-confirmation',width,theme);
  await test.page.getByRole('button',{name:'Volver a editar',exact:true}).click();check(await test.page.getByTestId('quote-net').inputValue()==='100,01','Back from confirmation preserves exact local input');
  await test.page.getByTestId('quote-inspect').click();test.state.quoteMode='delayed';await test.page.getByTestId('quote-confirm').evaluate(b=>{b.click();b.click();});await waitFor(()=>test.state.quotePending.length===1);check(test.state.quoteWrites.length===1,'Synchronous duplicate quote confirmation is suppressed');await test.state.releaseQuotes();await quoteSaved(test.page,1);await reviewReady(test.page);
  check(test.state.quoteCommits===1&&row.quotation_revision===1&&row.quotation_state==='offered','Exact response updates request commercial revision and quote summary');check(await test.page.getByTestId('supplier-request-prepare').count()===0,'Unaccepted quotation cannot present the prepare-technical-order action');
  await test.state.changeRole('operations-manager');await test.page.getByTestId('supplier-request-detail-heading').waitFor();await reviewReady(test.page);await openQuote(test.page);
  check(await test.page.getByTestId('quote-issue').count()===0&&await test.page.getByTestId('quote-withdraw').count()===0,'Company cannot set price or withdraw issuer proposal');
  await test.page.getByTestId('quote-accept').click();await test.page.getByTestId('quote-inspect').click();await test.page.getByTestId('quote-confirmation').waitFor();check(test.state.quoteWrites.length===1,'Review of acceptance alone is not an acceptance');await inspect(test.page,'company-acceptance',width,theme);
  test.state.quoteMode='success';await test.page.getByTestId('quote-confirm').click();await quoteSaved(test.page,2);check(test.state.quoteCommits===2&&row.quotation_state==='accepted','Company acceptance is persisted by the simulated server only after explicit confirmation');
  check(await test.page.getByTestId('quote-issue').count()===0&&await test.page.getByTestId('quote-accept').count()===0,'Accepted version has no duplicate acceptance or silent replacement action');check(test.state.writes.length===0&&test.state.orderWrites.length===0&&test.state.cancelWrites.length===0,'Quote and acceptance do not create technical orders, change source content or cancel anything');
  await test.page.getByTestId('quote-history').locator('summary').first().click();check(await test.page.getByTestId('quote-history').locator('ol > li').count()===2,'Both original offer and buyer decision remain visible');await inspect(test.page,'accepted-history',width,theme);await test.context.close();
 }
 const rejectedRow=quoteRow(),rejected=await scenario(390,'light',openedOptions(rejectedRow,{access:nexid}));await reviewReady(rejected.page);await issue(rejected);await rejected.state.changeRole('operations-manager');await reviewReady(rejected.page);await openQuote(rejected.page);await rejected.page.getByTestId('quote-reject').click();await rejected.page.getByTestId('quote-inspect').click();check(rejected.state.quoteWrites.length===1,'Rejection needs an explicit reason');await rejected.page.getByTestId('quote-reason').fill('Necesitamos otro alcance.');await rejected.page.getByTestId('quote-inspect').click();await rejected.page.getByTestId('quote-confirm').click();await quoteSaved(rejected.page,2);
 await rejected.state.changeRole('super-admin');await reviewReady(rejected.page);await openQuote(rejected.page);await rejected.page.getByTestId('quote-issue').click();await fillOffer(rejected.page,{currency:'ARS',net:'123,45',tax:'0',shipping:'0'});await rejected.page.getByTestId('quote-inspect').click();await rejected.page.getByTestId('quote-confirm').click();await quoteSaved(rejected.page,3);
 check(rejected.state.quoteEvents.get(rejectedRow.id)[0].total_minor===12600&&rejected.state.quoteEvents.get(rejectedRow.id).at(-1).total_minor===12345&&rejectedRow.quotation_state==='offered','Revised proposal preserves former USD quote and creates version two in explicit ARS');
 await rejected.page.getByTestId('quote-withdraw').click();await rejected.page.getByTestId('quote-reason').fill('La propuesta necesita revisión.');await rejected.page.getByTestId('quote-inspect').click();await rejected.page.getByTestId('quote-confirm').click();await quoteSaved(rejected.page,4);check(rejectedRow.quotation_state==='withdrawn','Issuer withdrawal is explicit and retains its history');await rejected.context.close();
 for(const mode of ['commit-lost','malformed']){
  const row=quoteRow({title:'Dato privado del expediente'}),test=await scenario(390,'light',openedOptions(row,{access:nexid}));await reviewReady(test.page);await openQuote(test.page);await test.page.getByTestId('quote-issue').click();await fillOffer(test.page);await test.page.getByTestId('quote-inspect').click();test.state.quoteMode=mode;await test.page.getByTestId('quote-confirm').click();await test.page.getByTestId('quote-retry').waitFor();check(test.state.quoteCommits===1,'Uncertain quote response may already have committed exactly once');
  test.state.quoteMode='forbidden';await test.page.getByTestId('quote-retry').click();await test.page.getByTestId('quote-retry').waitFor();await tick(test.page);
  check(!(await test.page.locator('main').textContent()).includes(row.title)&&!(await test.page.locator('main').textContent()).includes(row.id),'Later access revocation hides cached request and quote content');
  test.state.quoteMode='success';await test.page.getByTestId('quote-retry').click();await quoteSaved(test.page,1);check(test.state.quoteCommits===1&&new Set(test.state.quoteWrites.map(w=>w.key)).size===1&&new Set(test.state.quoteWrites.map(w=>JSON.stringify(w.body))).size===1,'Uncertain retries preserve one command and receipt even after a later denial');await test.context.close();
 }
 const casRow=quoteRow(),cas=await scenario(390,'light',openedOptions(casRow,{access:nexid}));await reviewReady(cas.page);await openQuote(cas.page);await cas.page.getByTestId('quote-issue').click();await fillOffer(cas.page);await cas.page.getByTestId('quote-inspect').click();cas.state.quoteMode='conflict';await cas.page.getByTestId('quote-confirm').click();await cas.page.getByTestId('quote-reload').waitFor();check(await cas.page.getByTestId('quote-net').inputValue()==='100,01'&&cas.state.quoteCommits===0,'CAS conflict preserves local quote edits and does not claim a commit');
 cas.state.quoteMode='success';await cas.page.getByTestId('quote-reload').click();await cas.page.getByTestId('quote-inspect').waitFor();await cas.page.getByTestId('quote-inspect').click();await cas.page.getByTestId('quote-confirm').click();await quoteSaved(cas.page,1);check(cas.state.quoteWrites[0].key!==cas.state.quoteWrites[1].key,'Certain refusal requires fresh review and new explicit command, never automatic replay');await cas.context.close();
 for(const mode of ['unavailable','foreign']){const row=quoteRow(),test=await scenario(390,'light',openedOptions(row,{access:nexid}));await reviewReady(test.page);test.state.quoteReadMode=mode;await test.page.getByTestId('quote-open').click();await test.page.getByTestId('quote-reload').waitFor();check(test.state.quoteWrites.length===0&&await test.page.getByTestId('quote-confirm').count()===0,'Unconfirmed quote snapshot cannot authorize any mutation: '+mode);await test.page.getByTestId('quote-close').click();await tick(test.page);check(await test.page.getByTestId('quote-open').evaluate(n=>document.activeElement===n),'Closing failed quote read restores keyboard focus');await test.context.close();}
 const disabledRow=quoteRow(),disabled=await scenario(390,'light',openedOptions(disabledRow,{access:nexid}));await reviewReady(disabled.page);disabled.state.quotesEnabled=false;await openQuote(disabled.page);check(await disabled.page.getByTestId('quote-issue').count()===0&&disabled.state.quoteWrites.length===0,'Disabled write flag leaves readable history without exposing issuance');await disabled.context.close();
 const old=quoteRow(),late=await scenario(390,'light',openedOptions(old,{access:nexid}));await reviewReady(late.page);late.state.quoteReadMode='delayed';await late.page.getByTestId('quote-open').click();await waitFor(()=>late.state.quotePending.length===1);await late.page.getByTestId('quote-close').click();await late.state.releaseQuotes();await tick(late.page);check(await late.page.getByTestId('quote-panel').count()===0&&late.state.quoteWrites.length===0,'A late aborted snapshot cannot reopen a closed quotation');await late.context.close();
 const dirtyRow=quoteRow(),dirty=await scenario(390,'light',openedOptions(dirtyRow,{access:nexid}));await reviewReady(dirty.page);await dirty.page.getByTestId('supplier-request-review-message').fill('Aclaración sin guardar');await dirty.page.getByTestId('quote-open').click();check(dirty.state.quoteReads.length===0&&await dirty.page.getByTestId('supplier-request-review-message').inputValue()==='Aclaración sin guardar','Opening quotes does not discard an unsaved clarification');await dirty.context.close();

 const expiredRow=quoteRow(),expired=await scenario(390,'light',openedOptions(expiredRow,{access:nexid}));await reviewReady(expired.page);await issue(expired);
 const event=expired.state.quoteEvents.get(expiredRow.id)[0];event.created_at=new Date(Date.now()-86400000).toISOString();event.valid_until=new Date(Date.now()-3600000).toISOString();await expired.state.changeRole('operations-manager');await reviewReady(expired.page);await openQuote(expired.page);
 check(await expired.page.getByTestId('quote-accept').count()===0&&(await expired.page.getByTestId('quote-current').textContent()).includes('vencida'),'Expired proposal is explicitly labelled and cannot be accepted from the UI');check(await expired.page.getByTestId('quote-reject').count()===1,'Expired offer may still receive an explicit rejection');await expired.context.close();
 const historicalRow=quoteRow(),historical=await scenario(1440,'dark',openedOptions(historicalRow,{access:nexid}));await reviewReady(historical.page);
 const history=Array.from({length:53},(_,i)=>({id:randomUUID(),revision:i+1,request_revision:4+i,quote_version:i+1,source_request_revision:3+i,review_revision:0,action:'issue',state:'offered',currency:'USD',net_minor:10000+i,tax_minor:0,shipping_minor:0,total_minor:10000+i,conditions:'Versión conservada '+(i+1),valid_until:new Date(Date.now()+86400000).toISOString(),reason:'Nueva propuesta de alcance '+(i+1),actor_id:actor,created_at:new Date(Date.now()-60000+(i*1000)).toISOString()}));
 historical.state.quoteEvents.set(historicalRow.id,history);Object.assign(historicalRow,{quotation_revision:53,quotation_state:'offered',revision:56,updated_at:history.at(-1).created_at});await openQuote(historical.page);await historical.page.getByTestId('quote-history').locator('summary').first().click();
 check(await historical.page.getByTestId('quote-history').locator('ol>li').count()===50,'Quote history starts with the bounded latest fifty events');await historical.page.getByTestId('quote-older').click();await historical.page.waitForFunction(()=>document.querySelectorAll('[data-testid="quote-history"] ol>li').length===53);
 check(await historical.page.getByTestId('quote-history').locator('ol>li').count()===53&&await historical.page.getByTestId('quote-older').count()===0,'Older page merges all fifty-three unique events and ends the cursor');check((await historical.page.getByTestId('quote-current').textContent()).includes('v53')&&historical.state.quoteWrites.length===0,'Older history never replaces current v53 or performs a write');await historical.context.close();
 const staleRow=quoteRow(),stale=await scenario(390,'light',openedOptions(staleRow,{access:nexid}));await reviewReady(stale.page);stale.state.quoteReadMode='delayed';await stale.page.getByTestId('quote-open').click();await waitFor(()=>stale.state.quotePending.length===1);stale.state.quoteReadMode='success';await stale.state.changeRole('operations-manager');await reviewReady(stale.page);await stale.state.changeRole('super-admin');await reviewReady(stale.page);await stale.state.releaseQuotes();await tick(stale.page);
 check(await stale.page.getByTestId('quote-panel').count()===0&&stale.state.quoteWrites.length===0,'Late quote read from an old authenticated mount does not restore state after issuer to company to issuer');await stale.context.close();
 assert.deepEqual(report.clientErrors,[]);assert.deepEqual(report.blockedRequests,[]);assert.ok(report.checks.every(c=>c.passed),JSON.stringify(report.checks.filter(c=>!c.passed)));report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack||error);throw error;}
finally{await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(done=>server.close(done));console.log(JSON.stringify({status:report.status,checks:report.checks.length,views:report.views.length,output},null,2));}
