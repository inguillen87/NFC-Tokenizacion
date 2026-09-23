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
const output=resolve(process.env.QA_OUTPUT||'artifacts/supplier-requests-browser');await mkdir(output,{recursive:true});
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
const report={localOnly:true,syntheticData:true,actualComponents:['SupplierRequestWorkspace','CreateSupplierOrderPage'],actualClientContract:true,httpBoundaryMocked:true,navigationStubbed:true,realNextServer:false,realDatabase:false,productionTested:false,checks:[],views:[],clientErrors:[],blockedRequests:[]};
function check(value,description){report.checks.push({description,passed:Boolean(value)});}
const tick=page=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
async function waitFor(predicate){for(let n=0;n<300;n++){if(predicate())return;await new Promise(done=>setTimeout(done,20));}assert.ok(predicate(),'Expected synthetic HTTP operation');}
const item=(patch={})=>({id:randomUUID(),tenant_id:tenantId,tenant_slug:'qa-only',title:'Solicitud sintética guardada',construction_id:'',quantity:null,pack_purpose:null,notes:'Nota parcial sintética',status:'draft',revision:1,created_at:'2026-09-23T12:00:00.000Z',updated_at:'2026-09-23T12:00:00.000Z',submitted_at:null,order_id:null,...patch});
const submitted=patch=>item({construction_id:'tt_bridge',quantity:125,pack_purpose:'trial_integration',status:'submitted',revision:3,submitted_at:'2026-09-23T12:01:00.000Z',...patch});
const envelope=(tenant,body)=>({ok:true,protocol:'nexid.supplier-request.v1',scope:tenant?{mode:'tenant',tenant_id:tenantId,tenant_slug:tenant}:{mode:'global',tenant_id:null,tenant_slug:null},...body});
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
  const state={reads:[],writes:[],orderWrites:[],rows:new Map((options.rows||[]).map(row=>[row.id,row])),receipts:new Map(),mode:'success',pending:[],truncated:false};
  async function send(route,status,body){await route.fulfill({status,headers:{'content-type':'application/json','x-nexid-data-mode':'production'},body:JSON.stringify(body)}).catch(()=>{});}
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
  state.release=async()=>{for(const pending of state.pending.splice(0))await send(pending.route,200,commit(pending.request,pending.tenant,pending.path));};
  await page.goto(origin+'/?theme='+theme+(options.source?`&view=order&request=${options.source.id}&tenant=${options.source.tenant_slug}`:''),{waitUntil:'networkidle'});
  if(options.source)await page.getByTestId('supplier-order-submit').waitFor();else{await page.getByTestId('supplier-request-workspace').waitFor();if(!options.denied)await page.getByRole('button',{name:'Actualizar bandeja'}).waitFor();}await tick(page);
  return {context,page,state};
}
async function fill(page,complete=false){await page.getByTestId('supplier-request-title').fill('Proyecto sintético conservado');await page.getByTestId('supplier-request-notes').fill('Necesidad parcial <b>literal</b>\nSin secretos');if(complete){await page.getByTestId('supplier-request-construction').selectOption('tt_bridge');await page.getByTestId('supplier-request-quantity').fill('125');await page.getByTestId('supplier-request-purpose').selectOption('trial_integration');}}
async function saved(page){await page.getByTestId('supplier-request-status').filter({hasText:'Guardado confirmado'}).waitFor();}
try{
  for(const theme of ['light','dark'])for(const width of [390,1440]){
    const {page,state,context}=await scenario(width,theme),tag=`${width} ${theme}`;
    check(state.writes.length===0,`${tag}: initial reads do not create requests`);check(await page.getByTestId('supplier-request-tenant').count()===0,`${tag}: tenant operator cannot choose another company`);
    await fill(page);check(state.writes.length===0,`${tag}: editing partial draft has no server writes`);await page.getByTestId('supplier-request-save').click();await saved(page);
    check(state.writes.length===1&&state.rows.size===1,`${tag}: explicit save makes one synthetic draft`);const first=[...state.rows.values()][0];check(first.quantity===null&&first.pack_purpose===null&&first.construction_id==='',`${tag}: partial fields persist as unknown`);check(await page.getByTestId('supplier-request-review').isDisabled(),`${tag}: partial draft cannot be sent`);
    await inspect(page,'partial-saved',width,theme);
    await page.reload({waitUntil:'networkidle'});await page.getByTestId('supplier-request-open').click();await page.getByTestId('supplier-request-title').filter({visible:true}).waitFor();await tick(page);
    check(await page.getByTestId('supplier-request-title').inputValue()===first.title&&await page.getByTestId('supplier-request-notes').inputValue()===first.notes,`${tag}: reload reads durable synthetic fixture without local storage`);
    await fill(page,true);await page.getByTestId('supplier-request-save').click();await saved(page);check(state.writes[1].method==='PATCH'&&state.writes[1].body.expected_revision===1,`${tag}: patch carries current revision`);
    await page.getByTestId('supplier-request-review').click();check(state.writes.length===2,`${tag}: review alone does not submit`);await inspect(page,'review-send',width,theme);
    await page.getByRole('button',{name:'Volver',exact:true}).click();check(state.writes.length===2&&await page.getByTestId('supplier-request-submit').count()===0,`${tag}: cancelling review makes no write`);
    await page.getByTestId('supplier-request-review').click();await page.getByTestId('supplier-request-submit').click();await saved(page);
    check(state.writes.length===3&&state.writes[2].path.endsWith('/submit'),`${tag}: one explicit final submission`);check(JSON.stringify(state.writes[2].body)==='{"expected_revision":2}',`${tag}: submission cannot alter commercial content`);check(await page.getByTestId('supplier-request-title').isDisabled()&&await page.getByTestId('supplier-request-save').count()===0,`${tag}: submitted request read-only`);check(state.writes.every(w=>w.tenant==='qa-only'&&!/supplier-orders|keys|manifests/.test(w.path)),`${tag}: save/send never invokes technical order or key endpoint`);await inspect(page,'submitted',width,theme);await context.close();
  }
  for(const access of [{role:'viewer'},{deniedPermissions:['supplier_order.create']},{isDemo:true}]){const {page,state,context}=await scenario(390,'light',{access,denied:true});check(state.reads.length===0&&state.writes.length===0,'Denied/demo context makes no backend reads or writes');check(await page.getByRole('alert').count()===1,'Denied context is explicit');await context.close();}
  const retry=await scenario();await fill(retry.page,true);retry.state.mode='commit-lost';await retry.page.getByTestId('supplier-request-save').click();await retry.page.getByTestId('supplier-request-retry').waitFor();check(retry.state.rows.size===1,'Synthetic commit with lost response remains one persisted request');check(await retry.page.getByTestId('supplier-request-title').isDisabled(),'Uncertain write locks edited command');await inspect(retry.page,'uncertain',390,'light');
  retry.state.mode='forbidden';await retry.page.getByTestId('supplier-request-retry').click();await retry.page.getByRole('alert').filter({hasText:'acceso'}).waitFor();check(await retry.page.getByTestId('supplier-request-title').isDisabled(),'403 after uncertainty does not unlock or discard command');retry.state.mode='success';await retry.page.getByTestId('supplier-request-retry').click();await saved(retry.page);check(retry.state.rows.size===1&&new Set(retry.state.writes.map(w=>w.key)).size===1&&new Set(retry.state.writes.map(w=>JSON.stringify(w.body))).size===1,'Repeated uncertainty check reuses exact key/body and gets original receipt');await retry.context.close();
  const delayed=await scenario();await fill(delayed.page);delayed.state.mode='delayed';await delayed.page.getByTestId('supplier-request-save').evaluate(button=>{button.click();button.click();});await waitFor(()=>delayed.state.pending.length===1);check(delayed.state.writes.length===1,'Synchronous double click suppressed before React render');await delayed.state.release();await saved(delayed.page);await delayed.context.close();
  const conflictRow=item(),conflict=await scenario(390,'light',{rows:[conflictRow],initialRequestId:conflictRow.id});await fill(conflict.page,true);conflict.state.mode='conflict';await conflict.page.getByTestId('supplier-request-save').click();await conflict.page.getByTestId('supplier-request-conflict').waitFor();check(await conflict.page.getByTestId('supplier-request-title').inputValue()==='Proyecto sintético conservado','CAS conflict preserves unsaved local input');conflict.state.rows.set(conflictRow.id,{...conflictRow,title:'Cambio de otra sesión',revision:2});await conflict.page.getByRole('button',{name:'Consultar versión actual'}).click();await conflict.page.getByRole('heading',{name:'Versión actual del servidor: 2'}).waitFor();check(await conflict.page.getByTestId('supplier-request-title').inputValue()==='Proyecto sintético conservado','Comparison read does not silently replace local draft');await inspect(conflict.page,'revision-conflict',390,'light');conflict.page.once('dialog',dialog=>dialog.accept());await conflict.page.getByRole('button',{name:'Cargar esta versión y descartar mis cambios'}).click();check(await conflict.page.getByTestId('supplier-request-title').inputValue()==='Cambio de otra sesión','Explicit comparison acceptance replaces local fields');await conflict.context.close();
  const stale=await scenario();await fill(stale.page);stale.state.mode='delayed';await stale.page.getByTestId('supplier-request-save').click();await waitFor(()=>stale.state.pending.length===1);await stale.page.evaluate(p=>window.__qaContext({access:{...p,tenantSlug:'qa-other',id:'20000000-0000-4000-8000-000000000002'}}),principal);await tick(stale.page);await stale.page.evaluate(p=>window.__qaContext({access:p}),principal);await tick(stale.page);await stale.state.release();await tick(stale.page);check(await stale.page.getByTestId('supplier-request-title').inputValue()===''&&!/Guardado confirmado/.test(await stale.page.getByTestId('supplier-request-status').innerText()),'Late A response cannot replace new A after A→B→A authenticated context transition');await stale.context.close();
  const inbox=await scenario(1440,'dark',{access:{role:'super-admin',tenantSlug:null},rows:[item(),submitted()]});check(await inbox.page.getByTestId('supplier-request-open').count()===1,'Global NexID inbox excludes internal drafts');await inbox.page.getByTestId('supplier-request-open').click();await inbox.page.getByTestId('supplier-request-prepare').waitFor();check((await inbox.page.getByTestId('supplier-request-prepare').getAttribute('href')).includes('tenant=qa-only'),'Preparation link binds source request and tenant');check(inbox.state.writes.length===0,'NexID inspection and preparation link render generate no order');await inspect(inbox.page,'nexid-inbox',1440,'dark');await inbox.context.close();
  const outage=await scenario();outage.state.mode='read-error';await outage.page.getByRole('button',{name:'Actualizar bandeja'}).click();await outage.page.getByRole('status').filter({hasText:'No se confirmó la bandeja'}).waitFor();check(!await outage.page.getByText('La fuente no encontró solicitudes en este alcance.').count(),'Unavailable inbox is not presented as empty');await outage.context.close();
  for(const theme of ['light','dark'])for(const width of [390,1440]){
    const source=submitted({title:'á'.repeat(200),notes:'ñ'.repeat(4000)}),test=await scenario(width,theme,{source,rows:[source]});
    await test.page.getByTestId('supplier-order-source-request').waitFor();
    check(test.state.writes.length===0&&test.state.orderWrites.length===0,`Source ${width} ${theme}: authenticated load does not convert or alter request`);
    check(await test.page.locator('#supplier-order-tenant-slug').inputValue()==='qa-only'&&await test.page.locator('#supplier-order-tenant-slug').evaluate(n=>n.readOnly),`Source ${width} ${theme}: bound tenant is fixed`);
    check(await test.page.locator('#supplier-order-total-quantity').inputValue()==='125'&&await test.page.locator('#supplier-order-total-quantity').evaluate(n=>n.readOnly),`Source ${width} ${theme}: quantity stays source-bound`);
    check(await test.page.locator('input[name="pack_purpose"][value="trial_integration"]').isChecked()&&await test.page.locator('input[name="pack_purpose"][value="production"]').isDisabled(),`Source ${width} ${theme}: purpose is source-bound`);
    await test.page.locator('#supplier-order-base-batch-id').fill('QA-SOURCE-ONLY');
    await test.page.getByTestId('supplier-order-submit').click();await test.page.getByRole('alert').waitFor();
    check(test.state.orderWrites.length===0,`Source ${width} ${theme}: commercial Unicode length exceeding technical UTF-8 limit cannot POST`);
    await test.page.locator('#supplier-order-name').fill('Resumen técnico');await test.page.getByTestId('supplier-order-submit').click();await test.page.getByRole('alert').filter({hasText:'notas'}).waitFor();check(test.state.orderWrites.length===0,`Source ${width} ${theme}: technical notes UTF-8 bound is checked independently`);
    await test.page.locator('#supplier-order-notes').fill('Resumen técnico para proveedor');await test.page.getByTestId('supplier-order-source-request').locator('summary').click();
    check((await test.page.getByTestId('supplier-order-source-request').innerText()).includes(source.title)&&(await test.page.getByTestId('supplier-order-source-request').innerText()).includes(source.notes),`Source ${width} ${theme}: original commercial text remains visible after technical summary edit`);
    check(test.state.rows.get(source.id).title===source.title&&test.state.rows.get(source.id).notes===source.notes,`Source ${width} ${theme}: original request remains unchanged`);
    await inspect(test.page,'source-technical-review',width,theme);
    await test.page.getByTestId('supplier-order-submit').click();await waitFor(()=>test.state.orderWrites.length===1);await test.page.waitForFunction(()=>window.__qaNavigations?.length===1);
    const payload=test.state.orderWrites[0];check(payload.source_request_id===source.id&&payload.source_request_revision===source.revision&&payload.tenant_slug===source.tenant_slug,`Source ${width} ${theme}: conversion binds exact request revision and tenant`);
    check(payload.total_quantity===125&&payload.pack_purpose==='trial_integration'&&payload.carrier_profile_code==='ntag424_dna_tt'&&payload.chip_model==='NTAG424_DNA_TT'&&payload.material_type==='tagtamper_tail',`Source ${width} ${theme}: conversion preserves source technical profile`);
    check(payload.order_name==='Resumen técnico'&&payload.notes==='Resumen técnico para proveedor'&&test.state.writes.length===0,`Source ${width} ${theme}: technical text has separate payload without request edits`);await test.context.close();
  }
  for(const access of [{role:'operations-manager',tenantSlug:'qa-only'},{permissions:['supplier_order.create']},{mfaVerified:false}]){
    const source=submitted(),test=await scenario(390,'light',{source,rows:[source],access});
    check(await test.page.getByTestId('supplier-order-submit').isDisabled(),`Source: operator/key/MFA restriction prevents technical create ${JSON.stringify(access)}`);check(test.state.orderWrites.length===0,'Restricted technical preparation never writes');await test.context.close();
  }
  const timed=await scenario();await fill(timed.page);timed.state.mode='hang';const started=Date.now();await timed.page.getByTestId('supplier-request-save').click();await timed.page.getByTestId('supplier-request-retry').waitFor({timeout:35000});check(Date.now()-started>=15000&&Date.now()-started<35000&&timed.state.writes.length===1,'Actual 20-second client deadline exposes uncertainty without automatic duplicate');await timed.context.close();
  assert.deepEqual(report.clientErrors,[],'No client exceptions');assert.deepEqual(report.blockedRequests,[],'No remote calls or unexpected mutations');assert.deepEqual(report.checks.filter(c=>!c.passed),[],'All behavioral and visual assertions pass');report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack||error);throw error;}
finally{await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(done=>server.close(done));console.log(JSON.stringify({status:report.status,checks:report.checks.length,failed:report.checks.filter(c=>!c.passed),views:report.views.length,output},null,2));}
