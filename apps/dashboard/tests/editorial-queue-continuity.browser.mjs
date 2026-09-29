import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
assert.ok(process.env.PLAYWRIGHT_MODULE&&process.env.AXE_MODULE_PATH,'Use installed browser tooling');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
const dashboard=fileURLToPath(new URL('../',import.meta.url)),root=resolve(dashboard,'../..'),output=resolve(process.env.QA_OUTPUT||'artifacts/editorial-queue-continuity-browser');await mkdir(output,{recursive:true});
const fixture=`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{EditorialQueueWorkspace}from'./src/components/editorial-queue';function App(){const[p,set]=useState(window.__initial);window.__change=set;return <div style={{padding:16,maxWidth:1280,margin:'auto'}}><aside>QA local: estados y sesiones sintéticos. No modifica pasaportes productivos.</aside><EditorialQueueWorkspace {...p}/></div>};createRoot(document.getElementById('root')).render(window.__strict?<React.StrictMode><App/></React.StrictMode>:<App/>);`;
const plugins=[{name:'qa-next-link',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({loader:'jsx',resolveDir:dashboard,contents:`import React from'react';export default function Link({children,prefetch,...props}){return <a {...props} onClick={e=>{e.preventDefault();(window.__navigations||=[]).push(props.href)}}>{children}</a>}`}));}}];
const bundle=await build({stdin:{contents:fixture,loader:'tsx',resolveDir:dashboard},plugins,bundle:true,write:false,outfile:'fixture.js',format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},logLevel:'silent'});
const css=(await postcss([tailwindcss({content:[join(dashboard,'src/**/*.{ts,tsx}').replaceAll('\\','/'),join(root,'packages/ui/src/**/*.{ts,tsx}').replaceAll('\\','/'),{raw:fixture,extension:'tsx'}],darkMode:['selector','[data-theme="dark"]'],theme:{extend:{colors:{brand:{dark:'#020617',card:'#0f172a',border:'#1e293b',cyan:'#06b6d4',blue:'#3b82f6'}}}},plugins:[]})]).process(await readFile(join(dashboard,'src/app/globals.css'),'utf8'),{from:undefined})).css+(bundle.outputFiles.find(f=>f.path.endsWith('.css'))?.text||'');
const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).contents;
const server=createServer((req,res)=>{const u=new URL(req.url,'http://qa.invalid');if(req.method!=='GET'){res.writeHead(405);return res.end();}if(u.pathname==='/fixture.js'){res.setHeader('content-type','text/javascript');return res.end(js);}if(u.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}if(u.pathname!=='/'){res.writeHead(404);return res.end();}const theme=u.searchParams.get('theme')==='dark'?'dark':'light';res.setHeader('content-type','text/html;charset=utf-8');res.end(`<!doctype html><html lang="es-AR" data-theme="${theme}" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Puesta en marcha DPP · QA</title><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);});
await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
import {queueFixture,filters as defaults} from './editorial-queue-continuity-fixture.mjs';
const report={localOnly:true,syntheticData:true,actualComponent:true,nextLinkStubbed:true,checks:[],views:[],clientErrors:[],unexpectedRequests:[]};
const check=(v,name)=>report.checks.push({name,passed:Boolean(v)});
const tick=p=>p.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
const waitFor=async predicate=>{for(let i=0;i<200;i++){if(predicate())return;await new Promise(r=>setTimeout(r,15));}assert.ok(predicate(),'Expected local transport request');};
async function scenario(patch={},width=390,theme='light'){
 const props={initial:queueFixture(),tenant:'company',filters:defaults,enabled:true,contextKey:'actor-A',...patch};
 const context=await browser.newContext({viewport:{width,height:1000},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(8000);
 const state={mode:'success',calls:[],pending:[],copied:[]};
 await page.addInitScript(props=>{window.__initial=props;window.__strict=true;window.__copied=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copied.push(text);if(window.__delayCopy)await new Promise(r=>window.__finishCopy=r);}}});const native=window.fetch.bind(window);window.fetch=(url,init)=>native(url,window.__ignoreAbort?{...init,signal:undefined}:init);},props);
 page.on('pageerror',e=>report.clientErrors.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.origin===origin&&req.method()==='GET'&&['/','/fixture.js','/favicon.ico'].includes(u.pathname))return route.continue();
  if(u.origin!==origin||u.pathname!=='/api/admin/passport-editorial/queue'||req.method()!=='GET'){report.unexpectedRequests.push(req.method()+' '+u.pathname);return route.abort();}
  state.calls.push(u.pathname+u.search);const f={state:u.searchParams.get('state')||'',view:u.searchParams.get('view')||'all',q:u.searchParams.get('q')||''};
  const data=queueFixture(u.searchParams.get('tenant')||'',f,Number(u.searchParams.get('cursor')?.split('_')[1]||1));
  if(state.mode==='delayed'){state.pending.push({route,data});return;}
  const status=/^\d+$/.test(state.mode)?Number(state.mode):200;if(state.mode==='demo')data.demo=true;
  if(state.mode==='foreign')data.scope.tenant='other';
  await route.fulfill({status,headers:{'content-type':'application/json','x-nexid-data-mode':state.mode==='header-demo'?'demo':'production'},body:JSON.stringify(status===200?data:{ok:false,reason:'synthetic_unavailable'})}).catch(()=>{});
 });
 await page.goto(origin+'/?theme='+theme);await page.getByTestId('editorial-queue').waitFor();await tick(page);return{context,page,state,props,width,theme};
}
const load=async t=>{if(!await t.page.getByRole('button',{name:'Consultar bandeja',exact:true}).isVisible())await t.page.getByRole('button',{name:'Buscar y filtrar',exact:true}).click();await t.page.getByRole('button',{name:'Consultar bandeja',exact:true}).click();await t.page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Consultando…')));await tick(t.page);};
async function inspect(t,name){
 await t.page.addScriptTag({content:axe});const violations=await t.page.evaluate(async()=>(await axe.run('[data-testid="editorial-queue"]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})));
 check(!violations.length,name+' axe '+t.width+' '+t.theme);check(await t.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' horizontal fit '+t.width+' '+t.theme);
 const file=`${name}-${t.width}-${t.theme}.png`;await t.page.screenshot({path:join(output,file),fullPage:true});report.views.push({name,width:t.width,theme:t.theme,file,violations});
}
try{
 const explicit=await scenario();check(!await explicit.page.getByRole('region',{name:'Próximo paso del pasaporte',exact:true}).count(),'No implicit first-passport selection');await explicit.context.close();
 const disabled=await scenario({enabled:false});check(!await disabled.page.getByRole('button',{name:/Ver próximo paso de/}).count(),'Disabled context never displays a prior queue');await disabled.context.close();
 for(const mode of ['demo','header-demo','foreign']){const t=await scenario();t.state.mode=mode;await load(t);check(!await t.page.getByRole('button',{name:/Ver próximo paso de/}).count(),mode+' response never renders a workflow');await t.context.close();}
 const race=await scenario();await race.page.evaluate(p=>window.__change(p),{...race.props,contextKey:'actor-B',tenant:'other',initial:queueFixture('other')});await tick(race.page);
 check(!(await race.page.getByTestId('editorial-queue').innerText()).includes('Empresa de prueba company'),'Context change removes previous company content');await race.context.close();
 for(const theme of ['light','dark'])for(const width of [320,390,768,1440]){
  const t=await scenario({initial:queueFixture('company',defaults,1,3)},width,theme);
  check(!await t.page.getByRole('region',{name:'Próximo paso del pasaporte',exact:true}).count(),'Explicit selection at '+width+' '+theme);
  const choice=t.page.getByRole('button',{name:'Ver próximo paso de Producto 2',exact:true});await choice.focus();await t.page.keyboard.press('Enter');await tick(t.page);
  const panel=t.page.getByRole('region',{name:'Próximo paso del pasaporte',exact:true});check(await panel.evaluate(n=>document.activeElement===n),'Selection focuses the detail '+width+' '+theme);
  check(await choice.getAttribute('aria-pressed')==='true','Selected card is announced '+width+' '+theme);
  check(await panel.getByRole('link',{name:'Abrir Passport Studio'}).getAttribute('href')==='/batches/LOT-2/passport?tenant=company','Selection links to the correct tenant and batch '+width+' '+theme);
  check(t.state.calls.length===0,'Selection makes no read or mutation '+width+' '+theme);await inspect(t,'selected');await panel.getByRole('button',{name:'Volver a la lista',exact:true}).click();check(await choice.evaluate(n=>document.activeElement===n),'Return focuses the selected row '+width+' '+theme);await t.context.close();
 }
 {
  const t=await scenario({},1440);await t.page.getByRole('button',{name:'Página siguiente',exact:true}).click();await t.page.getByText('Página 2 · 10 pasaportes visibles',{exact:true}).waitFor();
  check(t.state.calls.at(-1).includes('cursor=page_2'),'Next page uses server cursor');check(!await t.page.getByRole('region',{name:'Próximo paso del pasaporte',exact:true}).count(),'Pagination removes earlier detail');
  await t.page.getByRole('button',{name:'Página anterior',exact:true}).click();await t.page.getByText('Página 1 · 25 pasaportes visibles',{exact:true}).waitFor();check(!t.state.calls.at(-1).includes('cursor='),'Previous page uses its exact cursor trail');
  const before=t.state.calls.length;await t.page.getByRole('searchbox').fill('Producto 1');check(t.state.calls.length===before&&!await t.page.getByRole('button',{name:/Ver próximo paso de/}).count(),'Changed filters hide old results without fetching');await load(t);check((await t.page.getByRole('status').innerText()).includes('11 coincidencias'),'Explicit search confirms its actual match count');
  await t.page.getByRole('button',{name:'Copiar búsqueda',exact:true}).click();check((await t.page.evaluate(()=>window.__copied.at(-1))).includes('q=Producto+1')&&!(await t.page.evaluate(()=>window.__copied.at(-1))).includes('cursor='),'Bookmark includes filters but no pagination token');await t.context.close();
 }
 {
  const t=await scenario({},1440);await t.page.evaluate(()=>window.__ignoreAbort=true);t.state.mode='delayed';
  await t.page.getByRole('button',{name:'Consultar bandeja',exact:true}).evaluate(b=>{b.click();b.click();});await waitFor(()=>t.state.pending.length===1);check(t.state.calls.length===1,'Same-loop double submit starts one read');
  await t.page.getByTestId('editorial-cancel-read').click();await tick(t.page);check(await t.page.getByRole('button',{name:'Consultar bandeja',exact:true}).evaluate(n=>document.activeElement===n),'Cancel restores focus');check(!await t.page.getByRole('button',{name:/Ver próximo paso de/}).count(),'Cancel cannot restore an obsolete queue');
  t.state.mode='success';await load(t);for(const pending of t.state.pending.splice(0))await pending.route.fulfill({status:403,contentType:'application/json',body:'{"ok":false}'}).catch(()=>{});await tick(t.page);
  check(await t.page.getByRole('button',{name:/Ver próximo paso de/}).count()===25,'Late denial after cancellation cannot replace the new result');check(!await t.page.getByTestId('editorial-cancel-read').count(),'Finished read releases cancellation control');await t.context.close();
 }

 for(const status of ['401','403','404','409','503']){
  const t=await scenario({},1440);t.state.mode=status;await t.page.getByRole('button',{name:'Página siguiente'}).click();await tick(t.page);await t.page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Consultando…')));await tick(t.page);
  check(!await t.page.getByRole('button',{name:/Ver próximo paso de/}).count()&&!await t.page.getByRole('region',{name:'Próximo paso del pasaporte',exact:true}).count(),'Read '+status+' removes all stale cards and detail');
  const retry=t.page.getByRole('button',{name:'Reintentar esta página',exact:true});check(await retry.count()===(status==='503'?1:0),'Retry policy distinguishes access/position loss from outage '+status);
  if(status==='503'){t.state.mode='success';await retry.click();await t.page.getByText('Página 2 · 10 pasaportes visibles',{exact:true}).waitFor();check(t.state.calls.at(-1).includes('cursor=page_2'),'Transient failure retries only the requested position');await inspect(t,'recovered-page');}await t.context.close();
 }
 {
  const t=await scenario({},1440);await t.page.evaluate(()=>window.__delayCopy=true);await t.page.getByRole('button',{name:'Copiar búsqueda'}).click();await t.page.getByRole('searchbox').fill('Producto 1');await t.page.evaluate(()=>window.__finishCopy());await tick(t.page);check(!(await t.page.getByRole('status').innerText()).includes('Enlace copiado'),'A late clipboard result never confirms changed filters');await t.context.close();
 }
 {
  const t=await scenario({initial:queueFixture('company',defaults,1,0)});check(await t.page.getByRole('heading',{name:'Todavía no hay pasaportes incorporados a Studio'}).count()===1,'Confirmed empty scope retains its onboarding guidance');await inspect(t,'confirmed-empty');await t.context.close();
 }
 {
  const data=queueFixture('company',defaults,1,1);data.items[0].bid='B'.repeat(160);data.items[0].product='P'.repeat(160);data.items[0].tenantName='E'.repeat(240);const t=await scenario({initial:data},320,'dark');await t.page.getByRole('button',{name:/Ver próximo paso de/}).click();await inspect(t,'long-identifiers');await t.context.close();
 }
 check(!report.clientErrors.length,'No browser exceptions');check(!report.unexpectedRequests.length,'No writes or unexpected external requests');
}finally{await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(done=>server.close(done));}
console.log(JSON.stringify({checks:report.checks.length,failed:report.checks.filter(c=>!c.passed),views:report.views.length,output},null,2));assert.ok(report.checks.every(c=>c.passed));
