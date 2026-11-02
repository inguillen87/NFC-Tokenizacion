// Real React/component/styles; synthetic props, router observer and owned loopback
// transports. Identical assertions can run against the pre-owner baseline source.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build,stop} from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

for(const key of ['PLAYWRIGHT_MODULE','CHROME_PATH','AXE_MODULE_PATH','QA_OUTPUT'])assert(process.env[key],key+' must name existing installed tools/new output');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
const app=fileURLToPath(new URL('../',import.meta.url)),root=resolve(app,'../..'),output=resolve(process.env.QA_OUTPUT);
assert(output!==root&&!output.startsWith(root+'/')&&!output.startsWith(root+'\\'),'output must be outside worktree');
const hash=b=>createHash('sha256').update(b).digest('hex');
const sourcePaths=['src/app/(app)/loyalty/rewards/rewards-client.tsx','src/lib/reward-reservation-notices.ts','src/components/reward-reservation-notice.tsx','src/components/reward-reservation-notice.module.css','src/app/globals.css','src/lib/permission-policy.ts','tests/reward-save-dialog-owner.browser.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(sourcePaths.map(async p=>[p,hash(await readFile(join(app,p)))])));
const before=await hashes(),observedHead=execFileSync('git',['--no-optional-locks','-C',root,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
if(process.env.QA_SOURCE){assert.equal(process.env.QA_SOURCE,observedHead);assert.equal(execFileSync('git',['--no-optional-locks','-C',root,'status','--porcelain'],{encoding:'utf8',windowsHide:true}).trim(),'');}
const REWARD='10000000-0000-4000-8000-000000000001',PROGRAM='20000000-0000-4000-8000-000000000001';
const row={id:REWARD,program_id:PROGRAM,tenant_slug:'qa-a',code:'EXISTING',title:'Beneficio guardado QA',points:40,status:'active',description:'Texto sintético',type:'TOUR',image_url:null,stock_total:12,stock_remaining:10,requires_age_gate:false,network_visible:false};
const entry=`import React,{useState}from'react';import{flushSync}from'react-dom';import{createRoot}from'react-dom/client';import RewardsClient from'./src/app/(app)/loyalty/rewards/rewards-client';
window.__rewardRefreshes=0;window.__rewardRequests=[];const realFetch=window.fetch.bind(window);window.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input.url,location.href),record={path:url.pathname,query:url.search,method:init?.method||'GET',cache:init?.cache,credentials:init?.credentials,hasBody:init?.body!==undefined,hasSignal:Boolean(init?.signal),headers:false,bodySettled:false};if(url.origin===location.origin&&url.pathname.startsWith('/api/'))window.__rewardRequests.push(record);return realFetch(input,init).then(response=>{record.headers=true;const json=response.json.bind(response);response.json=()=>json().finally(()=>{record.bodySettled=true});return response;});};
const initial=${JSON.stringify(row)},rowsA=[initial],rowsB=[{...initial,tenant_slug:'qa-b',title:'Beneficio de otra empresa QA'}];const reactRoot=createRoot(document.getElementById('root'));
function Fixture(){const[props,setProps]=useState({initialRewards:rowsA,tenantScope:'qa-a',isDemo:false,canWrite:true,dataSource:'production',availability:'ready',sourceReason:''});window.__rewardChangeSource=kind=>flushSync(()=>setProps(old=>kind==='tenant'?{...old,tenantScope:'qa-b',initialRewards:rowsB}:kind==='permission'?{...old,canWrite:false}:{...old,dataSource:'unavailable',availability:'upstream_error',initialRewards:[]}));return <main className='dashboard-app mx-auto max-w-6xl p-4'><h1 className='text-2xl font-bold'>Beneficios · ensayo local</h1><p>Componentes reales, empresa y solicitudes sintéticas.</p><RewardsClient {...props}/></main>};window.__rewardReopenSameTurn=()=>{const previous=document.querySelector('dialog'),close=previous.querySelector('[aria-label="Cerrar edición del beneficio"]'),create=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Nuevo Beneficio');flushSync(()=>{close.click();create.click()});window.__previousRewardDialog=previous;return previous===document.querySelector('dialog')};window.__rewardUnmount=()=>flushSync(()=>reactRoot.unmount());reactRoot.render(<Fixture/>);`;
const report={schema:'nexid.reward-save-dialog-owner.native.v1',passed:false,releaseAcceptanceEligible:false,actualReact:true,actualComponent:true,nativeComponentCss:true,syntheticShell:true,syntheticProps:true,syntheticTransport:true,routerObserverStub:true,actualNext:false,realAuthentication:false,realDatabase:false,realProvider:false,physicalTap:false,backendReadOnlyCertified:false,notes:['No initializer or business write is added by the client GET; existing live IAM initialization/last_seen side effects are outside this synthetic fixture.','Cancellation may stop delivery of an old response; direct unit callbacks separately cover post-unmount/pre-effect ownership.'],observedHead,qaSource:process.env.QA_SOURCE||null,sourceBefore:before,sourceAfter:null,cases:[],checks:[],errors:[],blockedRequests:[],serverRequests:[],closure:{contexts:false,browser:false,server:false,esbuild:false}};
await mkdir(output,{recursive:true});let browser,origin,js,css;const contexts=new Set(),bodyPlans=[];
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://fixture.invalid');report.serverRequests.push({method:req.method,path:url.pathname,query:url.search});
 if(req.method==='POST'&&['/api/admin/loyalty/rewards/create','/api/admin/loyalty/rewards'].includes(url.pathname)&&!url.search){
  const plan=bodyPlans.shift();if(!plan){res.writeHead(405);return res.end();}let body='';for await(const chunk of req)body+=chunk;plan.body=JSON.parse(body);plan.headers=true;
  res.writeHead(200,{'content-type':'application/json','cache-control':'private,no-store'});res.flushHeaders();res.write('{"ok":true,"reward":');res.on('close',()=>{plan.socketClosed=true});
  plan.release=()=>{if(plan.released)return;plan.released=true;if(!res.destroyed&&!res.writableEnded)res.end(JSON.stringify(row)+'}');};return;
 }
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 if(url.pathname==='/fixture.js'){res.setHeader('content-type','text/javascript');return res.end(js);}
 if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
 if(url.pathname.startsWith('/images/')){res.writeHead(200,{'content-type':'image/svg+xml'});return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#173549"/></svg>');}
 if(url.pathname!=='/'){res.writeHead(404);return res.end();}const theme=url.searchParams.get('theme')==='dark'?'dark':'light';res.setHeader('content-type','text/html;charset=utf-8');
 res.end('<!doctype html><html lang="es-AR" class="theme-'+theme+'" data-theme="'+theme+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guardar beneficio · QA</title><style>'+css+'</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
});
const check=(item,value,description)=>{report.checks.push({scenario:item.name,description,passed:Boolean(value)});assert.ok(value,description);};
const settle=page=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
async function waitFor(label,predicate){const end=Date.now()+12000;while(!predicate()){assert(Date.now()<end,label);await new Promise(done=>setTimeout(done,15));}}
async function open(width,theme,name){
 const context=await browser.newContext({viewport:{width,height:950},locale:'es-AR',colorScheme:theme,reducedMotion:'reduce',serviceWorkers:'block'});contexts.add(context);const page=await context.newPage();page.setDefaultTimeout(10000);
 const item={width,theme,name,posts:[],reads:[],passed:false,errors:[]},tasks=new Set();report.cases.push(item);let closing=false;
 page.on('pageerror',error=>report.errors.push({name,width,theme,message:error.message}));
 const handler=async route=>{const request=route.request(),url=new URL(request.url());if(closing)return route.abort();
  if(url.origin!==origin){report.blockedRequests.push({name,method:request.method(),origin:url.origin,path:url.pathname});return route.abort();}
  if(request.method()==='POST'&&['/api/admin/loyalty/rewards/create','/api/admin/loyalty/rewards'].includes(url.pathname)&&!url.search){
   const call={path:url.pathname,body:request.postDataJSON(),ownerCancellationExpected:['close-late-409','close-late-200','native-close-late','unmounted-late-success','source-replace-late','stalled-body-held','catalogue-read-does-not-resolve-closed-save'].includes(name),status:200,response:{ok:true,reward:row},raw:null,release:()=>{},intercepted:name!=='stalled-body-held'};item.posts.push(call);
   if(name==='stalled-body-held'){bodyPlans.push(call);return route.continue();}
   let release;const gate=new Promise(done=>{release=done});call.release=release;await gate;if(closing)return route.abort();
   try{return await route.fulfill({status:call.status,contentType:typeof call.raw==='string'?'text/html':'application/json',body:call.raw??JSON.stringify(call.response)});}catch(error){if(call.ownerCancellationExpected&&request.failure()?.errorText){call.deliveryCancelledByOwner=true;return;}throw error;}
  }
  if(request.method()==='GET'&&url.pathname==='/api/admin/loyalty/rewards'){
   assert.equal(url.searchParams.size,1);const tenant=url.searchParams.get('tenant');assert(['qa-a','qa-b'].includes(tenant));
   let release;const gate=new Promise(done=>{release=done});const call={path:url.pathname,query:url.search,status:200,response:{ok:true,tenant,scope:'tenant',rewards:[{...row,tenant_slug:tenant,title:'Estado consultado QA'}]},release};item.reads.push(call);await gate;if(closing)return route.abort();
   return route.fulfill({status:call.status,contentType:'application/json',headers:{'x-nexid-data-mode':'production'},body:JSON.stringify(call.response)});
  }
  if(request.method()==='GET'&&['/','/fixture.js','/favicon.ico','/images/wine_tasting.png'].includes(url.pathname))return route.continue();
  report.blockedRequests.push({name,method:request.method(),path:url.pathname});return route.abort();
 };
 await page.route('**/*',route=>{const task=handler(route);tasks.add(task);task.finally(()=>tasks.delete(task)).catch(error=>{if(!closing)report.errors.push({name,width,theme,message:String(error)})});return task;});
 await page.goto(origin+'/?theme='+theme,{waitUntil:'networkidle'});
 const dialog=page.getByRole('dialog'),newButton=page.getByRole('button',{name:'Nuevo Beneficio',exact:true});
 async function fillNew(code='NEW',title='Título conservado QA'){await newButton.click();await dialog.waitFor();await dialog.getByLabel('Código de Control',{exact:true}).fill(code);await dialog.getByLabel('Título del Beneficio',{exact:true}).fill(title);await dialog.getByLabel('Costo en Puntos',{exact:true}).fill('40');await dialog.getByLabel('Stock total',{exact:true}).fill('12');}
 async function submit(){await dialog.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await waitFor('at least one deliberate POST',()=>item.posts.length>0);}
 async function releasePost(status=409,body={ok:false,error:'reward_create_conflict'}){const call=item.posts[0];call.status=status;call.response=body;call.release();await settle(page);}
 async function finish(){closing=true;for(const call of [...item.posts,...item.reads])call.release();await Promise.allSettled([...tasks]);await context.close();contexts.delete(context);}
 return {context,page,item,dialog,newButton,fillNew,submit,releasePost,finish};
}
async function runCase(width,theme,name){const f=await open(width,theme,name),{page,item,dialog}=f;
 try{
  if(name==='exact-edit-route'){
   await page.getByRole('button',{name:'Editar',exact:true}).click();await dialog.waitFor();await dialog.getByLabel('Título del Beneficio',{exact:true}).fill('Edición explícita QA');await f.submit();
   check(item,item.posts.length===1&&item.posts[0].path==='/api/admin/loyalty/rewards','exact edit uses legacy endpoint once');
   check(item,item.posts[0].body.reward_id===REWARD&&item.posts[0].body.program_id===PROGRAM&&!Object.hasOwn(item.posts[0].body,'creationIntent'),'exact edit retains persisted identities and no creation intent');
   await f.releasePost(409,{ok:false,error:'reward_update_conflict'});await dialog.getByRole('alert').waitFor();
  }else{
   await f.fillNew();await f.submit();
   if(name==='double-submit'){
    await dialog.locator('form').evaluate(form=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});await settle(page);
    check(item,item.posts.length===1,'repeated current-owner submit events cannot issue another POST');await f.releasePost();
   }else if(name==='close-late-409'||name==='close-late-200'||name==='native-close-late'){
    if(name==='native-close-late')await dialog.evaluate(node=>node.close());else await dialog.getByRole('button',{name:'Cerrar edición del beneficio',exact:true}).click();await dialog.waitFor({state:'detached'});await f.newButton.evaluate(node=>node.click());
    await f.releasePost(name==='close-late-200'?200:409,name==='close-late-200'?{ok:true,reward:row}:{ok:false,error:'reward_create_conflict'});await page.waitForTimeout(1700);
    check(item,await dialog.count()===0,'closing a pending write does not allow a replacement write before explicit catalogue review');
    check(item,await page.getByRole('button',{name:'Consultar catálogo',exact:true}).count()>0&&item.posts.length===1,'uncertain close retains a real recovery action and never rePOSTs');
    check(item,await page.evaluate(()=>window.__rewardRefreshes)===0,'late result cannot refresh the page after its owner closes');
   }else if(name==='success-no-timer'){
    await f.releasePost(200,{ok:true,reward:row});await dialog.getByRole('status').filter({hasText:/Nuevo beneficio creado/}).waitFor();
    await dialog.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    await dialog.getByRole('button',{name:'Cerrar edición del beneficio',exact:true}).click();await dialog.waitFor({state:'detached'});
    await f.fillNew('SECOND','Otra operación QA');await page.waitForTimeout(1700);
    check(item,await dialog.count()===1&&await dialog.getByLabel('Título del Beneficio',{exact:true}).inputValue()==='Otra operación QA','acknowledged previous save cannot close the replacement dialog on a timer');
    check(item,await page.evaluate(()=>window.__rewardRefreshes)===0,'acknowledged save performs no automatic router refresh');
    check(item,item.posts.length===1,'a confirmed dialog cannot resubmit its completed operation');
   }else if(name==='same-turn-close-reopen'){
    await f.releasePost(200,{ok:true,reward:row});await dialog.getByRole('status').filter({hasText:/Nuevo beneficio creado/}).waitFor();
    const reused=await page.evaluate(()=>window.__rewardReopenSameTurn());await dialog.waitFor();await dialog.getByLabel('Título del Beneficio',{exact:true}).fill('Formulario B protegido QA');
    await page.evaluate(()=>window.__previousRewardDialog.dispatchEvent(new Event('close')));await settle(page);
    check(item,!reused&&await dialog.count()===1&&await dialog.getByLabel('Título del Beneficio',{exact:true}).inputValue()==='Formulario B protegido QA','a new opening has its own native dialog and a late close from A cannot close B');
    check(item,item.posts.length===1,'a late native close does not submit the replacement');
   }else if(name==='catalogue-read-does-not-resolve-closed-save'){
    await dialog.getByRole('button',{name:'Cerrar edición del beneficio',exact:true}).click();await dialog.waitFor({state:'detached'});
    await page.getByRole('button',{name:'Consultar catálogo',exact:true}).click();await waitFor('explicit GET while earlier POST outcome is still unobserved',()=>item.reads.length===1);item.reads[0].release();
    await page.getByText('Esta consulta no confirma el guardado anterior',{exact:false}).waitFor();await f.newButton.evaluate(node=>node.click());await settle(page);
    check(item,await dialog.count()===0&&item.posts.length===1,'GET before the old POST finishes never unlocks another writer');
    await f.releasePost(200,{ok:true,reward:row});await settle(page);await f.newButton.evaluate(node=>node.click());
    check(item,await dialog.count()===0&&item.posts.length===1&&item.reads.length===1,'a retired POST reply cannot clear the latched review guard');
   }else if(name==='unmounted-late-success'){
    await page.evaluate(()=>window.__rewardUnmount());await f.releasePost(200,{ok:true,reward:row});await page.waitForTimeout(1700);
    check(item,await page.evaluate(()=>window.__rewardRefreshes)===0&&item.posts.length===1,'unmounted response cannot schedule an old success timer or another request');
   }else if(name==='source-replace-late'){
    await page.evaluate(()=>window.__rewardChangeSource('tenant'));await settle(page);if(await dialog.count())await dialog.getByRole('button',{name:'Cerrar edición del beneficio',exact:true}).click();
    await f.fillNew('OTHER','Formulario de empresa B QA');await f.releasePost();await settle(page);
    check(item,await dialog.getByLabel('Título del Beneficio',{exact:true}).inputValue()==='Formulario de empresa B QA'&&await dialog.getByRole('alert').count()===0,'old tenant response cannot paint an error into the replacement source');
    check(item,item.posts.length===1&&item.posts[0].body.tenant_slug==='qa-a','source change does not forward the old action into another tenant');
   }else if(name==='current-409-retains-fields'){
    await f.releasePost();const alert=dialog.getByRole('alert');await alert.waitFor();
    check(item,await dialog.getByLabel('Código de Control',{exact:true}).inputValue()==='NEW'&&await dialog.getByLabel('Título del Beneficio',{exact:true}).inputValue()==='Título conservado QA','current refusal preserves the typed fields');
    check(item,(await alert.innerText()).includes('otro código')&&await alert.evaluate(node=>node===document.activeElement),'current duplicate refusal offers deliberate recovery and focuses neutral feedback');
   }else if(name==='old-api-404'){
    const call=item.posts[0];call.status=404;call.raw='<html>old deployment QA</html>';call.release();await dialog.getByRole('alert').waitFor();
    check(item,item.posts.length===1&&call.path==='/api/admin/loyalty/rewards/create','unsupported strict endpoint never falls back to the old upsert path');
    check(item,(await dialog.innerText()).includes('creación segura no está disponible')&&!(await dialog.innerText()).includes('old deployment QA'),'HTML404 is explained without claiming a create or leaking its body');
   }else if(name==='stalled-body-held'){
    await waitFor('native response headers start before incomplete JSON body',()=>item.posts[0].headers===true);await page.waitForFunction(()=>window.__rewardRequests.some(r=>r.method==='POST'&&r.headers));
    await dialog.getByText('No pudimos confirmar el resultado.',{exact:false}).waitFor();
    const before=await dialog.getByLabel('Título del Beneficio',{exact:true}).inputValue();
    await dialog.getByRole('button',{name:'Consultar catálogo',exact:true}).click();await waitFor('one explicit private catalogue GET',()=>item.reads.length===1);
    item.reads[0].status=503;item.reads[0].response={ok:false,error:'unavailable'};item.reads[0].release();await dialog.getByText('No pudimos consultar el catálogo.',{exact:false}).waitFor();
    check(item,await dialog.getByLabel('Título del Beneficio',{exact:true}).inputValue()===before,'failed review GET preserves the current draft and uncertainty barrier');
    await dialog.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));check(item,item.posts.length===1,'failed read never enables silent resubmission');
    await dialog.getByRole('button',{name:'Consultar catálogo',exact:true}).click();await waitFor('second deliberate read',()=>item.reads.length===2);item.reads[1].release();
    await page.getByText('Estado consultado QA',{exact:true}).waitFor();await dialog.getByText('Esta consulta no confirma el guardado anterior',{exact:false}).waitFor();
    check(item,await dialog.count()===1&&await dialog.getByLabel('Título del Beneficio',{exact:true}).inputValue()===before,'a successful catalogue read retains the uncertain form and typed fields');
    await dialog.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await f.newButton.evaluate(node=>node.click());await settle(page);
    check(item,item.posts.length===1&&item.reads.length===2,'a valid read cannot enable another write while the earlier result is uncertain');
    const observed=await page.evaluate(()=>window.__rewardRequests.filter(r=>r.method==='GET'));
    check(item,observed.every(r=>r.path==='/api/admin/loyalty/rewards'&&r.cache==='no-store'&&r.credentials==='same-origin'&&!r.hasBody&&r.hasSignal),'review requests use the existing bounded private GET without a body');
   }
  }
  check(item,report.blockedRequests.length===0,'case attempted no external or unexpected path');
  if(name==='current-409-retains-fields'||name==='old-api-404'){
   await page.addScriptTag({content:axe});const violations=await page.evaluate(async()=>(await axe.run('dialog',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})));item.violations=violations;
   check(item,violations.length===0,'the current feedback/dialog has no axe violations in this fixture');check(item,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page has no horizontal overflow');
   const screenshot=name+'-'+width+'-'+theme+'.png';await page.screenshot({path:join(output,screenshot),fullPage:false});item.screenshot=screenshot;
  }
  item.passed=true;
 }catch(error){item.failure=String(error.stack||error);}finally{await f.finish();}
}
try{
 const bundle=await build({stdin:{contents:entry,loader:'tsx',resolveDir:app},bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},logLevel:'silent',plugins:[{name:'router-observer',setup(builder){builder.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'router-observer'}));builder.onLoad({filter:/.*/,namespace:'router-observer'},()=>({contents:'export const useRouter=()=>({refresh(){window.__rewardRefreshes++}})',loader:'js'}));}}]});js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).contents;
 css=(await postcss([tailwindcss({content:[join(app,'src/**/*.{ts,tsx}').replaceAll('\\','/'),join(root,'packages/ui/src/**/*.{ts,tsx}').replaceAll('\\','/'),{raw:entry,extension:'tsx'}],darkMode:['selector','[data-theme="dark"]'],theme:{extend:{colors:{brand:{dark:'#020617',card:'#0f172a',border:'#1e293b',cyan:'#06b6d4',blue:'#3b82f6'}}}},plugins:[]})]).process(await readFile(join(app,'src/app/globals.css'),'utf8'),{from:undefined})).css+(bundle.outputFiles.find(f=>f.path.endsWith('.css'))?.text||'');
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done)});origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 const scenarios=['double-submit','close-late-409','close-late-200','native-close-late','success-no-timer','same-turn-close-reopen','catalogue-read-does-not-resolve-closed-save','unmounted-late-success','source-replace-late','current-409-retains-fields','old-api-404','stalled-body-held','exact-edit-route'];
 const chosen=process.env.QA_REWARD_DIALOG_CASE?scenarios.filter(n=>n===process.env.QA_REWARD_DIALOG_CASE):scenarios;assert(chosen.length>0,'known explicit case filter');
 for(const width of [390,1280])for(const theme of ['light','dark'])for(const name of chosen)await runCase(width,theme,name);
 report.sourceAfter=await hashes();assert.deepEqual(report.sourceAfter,before);report.allPlannedCases=chosen.length===scenarios.length;report.passed=report.cases.length===chosen.length*4&&report.cases.every(c=>c.passed)&&report.errors.length===0&&report.blockedRequests.length===0;if(!report.passed)process.exitCode=1;
}catch(error){report.failure=String(error.stack||error);process.exitCode=1;}finally{
 for(const context of contexts)await context.close();contexts.clear();report.closure.contexts=true;if(browser){await browser.close();report.closure.browser=true;}server.closeAllConnections();if(server.listening)await new Promise(done=>server.close(done));report.closure.server=!server.listening;stop();report.closure.esbuild=true;report.completedAt=new Date().toISOString();
 await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({report:join(output,'report.json'),passed:report.passed,checks:report.checks.length,cases:report.cases.length,releaseAcceptanceEligible:false,closure:report.closure}));
}
