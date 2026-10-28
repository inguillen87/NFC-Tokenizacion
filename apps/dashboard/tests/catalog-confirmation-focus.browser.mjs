// Proposal only. Adopt as apps/dashboard/tests/catalog-confirmation-focus.browser.mjs.
// Real component/models/native CSS; all catalogue transports and data are synthetic.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, stop } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

const mode=process.env.QA_CATALOG_CONFIRMATION_MODE||'guarded';
assert(['baseline','guarded'].includes(mode));const guarded=mode==='guarded';
for(const key of ['PLAYWRIGHT_MODULE','CHROME_PATH','AXE_MODULE_PATH','QA_OUTPUT'])assert(process.env[key],key+' must name an existing explicit QA tool/output; this harness installs nothing');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
const app=fileURLToPath(new URL('../',import.meta.url)),root=resolve(app,'../..'),output=resolve(process.env.QA_OUTPUT);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourcePaths=['src/components/tenant-marketplace-workspace.tsx','src/components/tenant-marketplace-workspace.module.css','src/components/dashboard-shell-header.module.css','src/lib/tenant-marketplace.ts','src/app/globals.css','tests/catalog-confirmation-focus.browser.mjs'];
const sourceHashes=async()=>Object.fromEntries(await Promise.all(sourcePaths.map(async name=>[name,hash(await readFile(join(app,name)))])));
const before=await sourceHashes();
const observedHead=execFileSync('git',['--no-optional-locks','-C',root,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true,timeout:10000}).trim();
const sourceClean=execFileSync('git',['--no-optional-locks','-C',root,'status','--porcelain'],{encoding:'utf8',windowsHide:true,timeout:10000}).trim()==='';
if(process.env.QA_SOURCE){assert.equal(process.env.QA_SOURCE,observedHead);assert(sourceClean,'QA_SOURCE requires a clean committed candidate');}
const TENANT='qa-only',PROTOCOL='nexid.tenant-marketplace-catalog.v1';
const TIME='2026-10-06T12:34:56.123456Z',NEXT_TIME='2026-10-06T13:34:56.123456Z';
const BRAND='20000000-0000-4000-8000-000000000001',PRODUCT='10000000-0000-4000-8000-000000000001',OTHER_PRODUCT='10000000-0000-4000-8000-000000000002';
function fixture(kind,action){return {ok:true,protocol:PROTOCOL,tenant:TENANT,brand:{id:BRAND,status:kind==='brand'&&action==='publish'?'draft':'active',display_name:'Marca sintética QA',slug:TENANT,vertical:'cosmetics',description:null,country:null,city:null,visible_in_network:!(kind==='brand'&&action==='publish'),updatedAt:TIME},items:[PRODUCT,OTHER_PRODUCT].map((id,index)=>({id,status:kind==='product'&&action==='withdraw'?'active':'draft',title:'Producto QA '+(index+1),description:'Contenido sintético',vertical:'cosmetics',category:null,image_url:null,price_amount:null,price_currency:null,external_checkout_url:null,request_to_buy_enabled:true,age_gate_required:false,updatedAt:TIME})),hasMore:false};}
const fixtures=Object.fromEntries(['product','brand'].flatMap(kind=>['publish','withdraw'].map(action=>[kind+'-'+action,fixture(kind,action)])));
const entry=`import React from'react';import{createRoot}from'react-dom/client';import TenantMarketplaceWorkspace from'./src/components/tenant-marketplace-workspace';import headerStyles from'./src/components/dashboard-shell-header.module.css';
const fixtures=${JSON.stringify(fixtures)};window.__catalogKeys=[];
for(const type of ['keydown','keyup'])window.addEventListener(type,event=>{if(event.key==='Enter')window.__catalogKeys.push({type,key:event.key,repeat:event.repeat,tag:event.target?.tagName,text:event.target?.textContent?.trim().slice(0,160)});});
function HeaderGeometry(){return <header data-testid="catalog-header-geometry" className={'dashboard-header sticky top-0 z-30 border-b border-white/5 '+headerStyles.header}><div className={headerStyles.layout}><div className={headerStyles.identity}><button type="button" aria-label="Abrir navegación" className="min-h-11">☰</button><h1 className={headerStyles.title}>Catálogo sintético QA</h1></div><div className={headerStyles.controls}><select className="locale-switcher" aria-label="Idioma de ensayo"><option>ES</option></select><button type="button" className="theme-toggle" aria-label="Apariencia de ensayo">◐</button><div className="dashboard-shell-account-menu"><button type="button">Cuenta QA</button></div></div></div></header>;}
const key=new URLSearchParams(location.search).get('fixture');if(!fixtures[key])throw Error('Unknown synthetic fixture');
createRoot(document.getElementById('root')).render(<div className="dashboard-main mx-auto max-w-7xl"><HeaderGeometry/><div className="p-4"><TenantMarketplaceWorkspace tenant="qa-only" canWrite={true} canSelectTenant={false} initialData={fixtures[key]}/></div></div>);`;
const bundle=await build({stdin:{contents:entry,loader:'tsx',resolveDir:app},bundle:true,write:false,outfile:'catalog-confirmation.js',platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},logLevel:'silent'});
const css=(await postcss([tailwindcss({content:[join(app,'src/**/*.{ts,tsx}').replaceAll('\\','/'),join(root,'packages/ui/src/**/*.{ts,tsx}').replaceAll('\\','/'),{raw:entry,extension:'tsx'}],darkMode:['selector','[data-theme="dark"]'],theme:{extend:{colors:{brand:{dark:'#020617',card:'#0f172a',border:'#1e293b',cyan:'#06b6d4',blue:'#3b82f6'}}}},plugins:[]})]).process(await readFile(join(app,'src/app/globals.css'),'utf8'),{from:undefined})).css+(bundle.outputFiles.find(file=>file.path.endsWith('.css'))?.text||'');
const js=bundle.outputFiles.find(file=>file.path.endsWith('.js')).contents;
const report={schema:'nexid.catalog-confirmation-focus.v1',mode,passed:false,baselineDefectReproduced:false,releaseAcceptanceEligible:false,localOnly:true,syntheticData:true,syntheticTransport:true,actualComponent:'TenantMarketplaceWorkspace',actualModels:true,nativeComponentAndGlobalCss:true,productionHeaderCssWithEquivalentGeometry:true,realDashboardShell:false,realNextServer:false,realAuthentication:false,realDatabase:false,realTenantPublication:false,providerMutations:0,physicalTapMeasured:false,qaSource:process.env.QA_SOURCE||null,observedHead,sourceClean,sourceBefore:before,sourceAfter:null,checks:[],cases:[],serverRequests:[],errors:[],blockedRequests:[],closure:{contexts:false,browser:false,server:false,esbuild:false}};
const server=createServer((req,res)=>{const url=new URL(req.url,'http://synthetic.invalid');report.serverRequests.push({method:req.method,path:url.pathname});if(req.method!=='GET'){res.writeHead(405);res.end();return;}if(url.pathname==='/catalog-confirmation.js'){res.setHeader('content-type','text/javascript');res.end(js);return;}if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}if(url.pathname!=='/'){res.writeHead(404);res.end();return;}const theme=url.searchParams.get('theme')==='dark'?'dark':'light';res.setHeader('content-type','text/html;charset=utf-8');res.end('<!doctype html><html lang="es-AR" class="theme-'+theme+'" data-theme="'+theme+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirmación de catálogo · QA sintética</title><style>'+css+'</style></head><body><div id="root"></div><script src="/catalog-confirmation.js"></script></body></html>');});
let browser,origin;const contexts=new Set();
function check(value,description){report.checks.push({description,passed:Boolean(value)});assert.ok(value,description);}
async function settle(page){await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));}
async function waitFor(description,predicate){for(let n=0;n<200;n++){if(predicate())return;await new Promise(done=>setTimeout(done,25));}throw Error(description);}
async function setup(kind,action,outcome,width,theme){
 const context=await browser.newContext({viewport:{width,height:900},locale:'es-AR',colorScheme:theme,reducedMotion:'reduce',serviceWorkers:'block',acceptDownloads:false});contexts.add(context);
 const page=await context.newPage();page.setDefaultTimeout(10000);
 const row={kind,action,outcome,width,theme,posts:[],reads:[],passed:false};report.cases.push(row);
 const state={context,page,row,held:null,catalog:structuredClone(fixtures[kind+'-'+action])};
 page.on('pageerror',error=>report.errors.push({kind,action,outcome,width,theme,message:error.message}));
 await page.route('**/*',route=>{const request=route.request(),url=new URL(request.url());
  if(url.origin!==origin){report.blockedRequests.push({method:request.method(),origin:url.origin,path:url.pathname});return route.abort();}
  if(url.pathname==='/api/tenant-marketplace'){
   assert.equal(url.searchParams.get('tenant'),TENANT);assert.equal(url.searchParams.getAll('tenant').length,1);
   if(request.method()==='POST'){assert.equal(url.searchParams.size,1);assert.equal(state.held,null);const body=request.postDataJSON();row.posts.push({method:'POST',path:url.pathname+url.search,body,intercepted:true,providerFetch:false});state.held=route;return;}
   assert.equal(request.method(),'GET');row.reads.push({method:'GET',path:url.pathname+url.search,intercepted:true,providerFetch:false});
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,protocol:PROTOCOL,...state.catalog})});
  }
  if(request.method()!=='GET'){report.blockedRequests.push({method:request.method(),path:url.pathname});return route.abort();}return route.continue();
 });
 await page.goto(origin+'/?fixture='+kind+'-'+action+'&theme='+theme,{waitUntil:'networkidle'});
 const workspace=page.getByTestId('tenant-marketplace-workspace'),editor=page.getByTestId('tenant-catalog-editor');await editor.waitFor();
 check(await page.evaluate(()=>document.activeElement===document.body),`${kind}/${action}/${outcome}/${width}/${theme}: mounting does not steal focus`);
 if(kind==='brand'){await workspace.getByRole('button',{name:'Perfil de la marca',exact:true}).click();await settle(page);}
 else {await workspace.getByRole('button',{name:'Revisar Producto QA 2',exact:true}).click();await settle(page);check(await editor.getByRole('textbox',{name:'Título del producto',exact:true}).inputValue()==='Producto QA 2','An effective product selection loads product2 before opening');}
 return Object.assign(state,{workspace,editor});
}
async function openConfirmation(f,label){
 const opener=f.editor.getByRole('button',{name:f.row.action==='publish'?'Publicar versión guardada':'Retirar publicación',exact:true});check(await opener.isEnabled(),label+': valid saved fixture can open the selected action');
 await opener.evaluate(node=>{window.__catalogOpener=node;});await opener.focus();await f.page.keyboard.down('Enter');
 const group=f.editor.locator('section[role="group"]'),heading=group.getByRole('heading',{level:3});await group.waitFor();await settle(f.page);
 await f.page.keyboard.down('Enter');await f.page.keyboard.up('Enter');await settle(f.page);
 const focus=await heading.evaluate(node=>({heading:document.activeElement===node,opener:document.activeElement===window.__catalogOpener,tag:document.activeElement?.tagName,text:document.activeElement?.textContent?.trim().slice(0,160)}));
 f.row.openFocus??=[];f.row.openFocus.push(focus);
 check(f.row.posts.length===0&&f.row.reads.length===0,label+': opening and held Enter do not send or read a catalogue change');
 if(guarded){check(focus.heading,label+': confirmation opens on its neutral heading');const id=await heading.getAttribute('id');check(Boolean(id)&&await group.getAttribute('aria-labelledby')===id&&await f.page.locator('[id]').evaluateAll((nodes,value)=>nodes.filter(node=>node.id===value).length,id)===1,label+': one neutral heading names this confirmation');const geometry=await heading.evaluate(node=>{const r=node.getBoundingClientRect(),header=document.querySelector('[data-testid="catalog-header-geometry"]').getBoundingClientRect(),style=getComputedStyle(node);return {top:r.top,bottom:r.bottom,headerBottom:header.bottom,viewport:innerHeight,outline:style.outlineStyle,outlineWidth:style.outlineWidth};});f.row.headingGeometry=geometry;check(geometry.top>=geometry.headerBottom&&geometry.bottom<=geometry.viewport&&geometry.outline!=='none'&&parseFloat(geometry.outlineWidth)>=2,label+': focused neutral heading is visible below the equivalent sticky header');}
 else check(!focus.heading&&focus.opener,label+': baseline leaves focus on the opener rather than the confirmation heading');
 return {opener,group,heading};
}
async function cancelConfirmation(f,current,label){
 const cancel=current.group.getByRole('button',{name:'Cancelar',exact:true});await cancel.focus();await f.page.keyboard.press('Enter');await current.group.waitFor({state:'detached'});await settle(f.page);
 const focus=await f.page.evaluate(()=>({body:document.activeElement===document.body,opener:document.activeElement===window.__catalogOpener,openerConnected:Boolean(window.__catalogOpener?.isConnected),tag:document.activeElement?.tagName}));f.row.cancelFocus=focus;
 check(f.row.posts.length===0&&f.row.reads.length===0,label+': cancelling sends no mutation or read');
 if(guarded)check(focus.opener&&focus.openerConnected,label+': explicit cancellation restores the connected initiating control');else check(focus.body,label+': baseline loses cancellation focus to body');
}
async function changeSelection(f,label){
 if(f.row.kind==='product'){await f.workspace.getByRole('button',{name:'Revisar Producto QA 1',exact:true}).click();await f.editor.locator('section[role="group"]').waitFor({state:'detached'});await settle(f.page);check(await f.editor.getByRole('textbox',{name:'Título del producto',exact:true}).inputValue()==='Producto QA 1',label+': selection while confirmation is open chooses product1');}
 else {await f.workspace.getByRole('button',{name:'Productos',exact:true}).click();await f.editor.locator('section[role="group"]').waitFor({state:'detached'});await settle(f.page);check(await f.editor.getByRole('heading',{name:'Contenido del producto',exact:true}).evaluate(node=>document.activeElement===node),label+': leaving the brand retains editor-navigation focus');await f.workspace.getByRole('button',{name:'Perfil de la marca',exact:true}).click();await settle(f.page);}
 const name=f.row.kind==='brand'?'Perfil de la marca':'Contenido del producto';check(await f.editor.getByRole('heading',{name,exact:true}).evaluate(node=>document.activeElement===node),label+': changing selection focuses the effective editor, not an obsolete confirmation opener');check(f.row.posts.length===0&&f.row.reads.length===0,label+': changing selection sends nothing');
}
async function inspect(f,current,label){
 await f.page.addScriptTag({content:axe});const violations=await f.page.evaluate(async()=> (await axe.run('main[data-testid="tenant-marketplace-workspace"]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})));
 f.row.violations=violations;check(violations.length===0,label+': native confirmation surface has no axe violations');check(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+': page has no horizontal overflow');
 if(f.row.outcome==='success'){const screenshot=`${mode}-${f.row.kind}-${f.row.action}-${f.row.width}-${f.row.theme}.png`;await f.page.screenshot({path:join(output,screenshot),fullPage:false});f.row.screenshot=screenshot;}
}
async function runCase(kind,action,outcome,width,theme){
 const f=await setup(kind,action,outcome,width,theme),label=`${mode}/${kind}/${action}/${outcome}/${width}/${theme}`;
 try {
  let current=await openConfirmation(f,label);await inspect(f,current,label);await cancelConfirmation(f,current,label);
  current=await openConfirmation(f,label);await changeSelection(f,label);current=await openConfirmation(f,label);
  const confirmation=current.group.getByRole('button',{name:action==='publish'?'Confirmar publicación':'Confirmar retiro',exact:true});
  if(guarded){await f.page.keyboard.press('Tab');check(await confirmation.evaluate(node=>document.activeElement===node),label+': deliberate Tab selects the affirmative action');}else await confirmation.focus();
  await f.page.keyboard.down('Enter');await waitFor(label+': one intercepted POST arrives',()=>f.row.posts.length===1);await f.page.keyboard.down('Enter');await f.page.keyboard.up('Enter');await settle(f.page);
  const expected={kind,action,id:kind==='brand'?BRAND:PRODUCT,expectedUpdatedAt:TIME,...(kind==='brand'&&action==='publish'?{visible_in_network:true}:{})};assert.deepEqual(f.row.posts[0].body,expected);check(true,label+': explicit POST targets the effective kind, resource, revision and action');
  check(f.row.posts.length===1&&f.row.reads.length===0,label+': held Enter during pending does not repeat or read');check(await current.group.count()===0,label+': sending removes confirmation');check(await current.opener.isDisabled(),label+': pending disables the initiating action');
  const otherTab=f.workspace.getByRole('button',{name:kind==='brand'?'Productos':'Perfil de la marca',exact:true});await otherTab.click();await settle(f.page);
  check(await f.editor.getByRole('heading',{name:kind==='brand'?'Perfil de la marca':'Contenido del producto',exact:true}).count()===1,label+': a pending tab attempt cannot change the resource');check(f.row.posts.length===1&&f.row.reads.length===0,label+': pending selection attempt never repeats a mutation');
  const selected=kind==='brand'?f.catalog.brand:f.catalog.items.find(item=>item.id===PRODUCT),committed={...selected,status:action==='publish'?'active':'withdrawn',updatedAt:NEXT_TIME,...(kind==='brand'?{visible_in_network:action==='publish'}:{})};
  if(kind==='brand')f.catalog.brand=committed;else f.catalog.items=f.catalog.items.map(item=>item.id===PRODUCT?committed:item);
  const held=f.held;f.held=null;await held.fulfill({status:outcome==='success'?200:503,contentType:'application/json',body:JSON.stringify(outcome==='success'?{ok:true,protocol:PROTOCOL,tenant:TENANT,kind,item:committed}:{ok:false,reason:'catalog_unavailable'})});
  const message=f.workspace.getByTestId('tenant-catalog-message');
  if(outcome==='success'){await message.getByText(action==='publish'?'Publicación confirmada.':'Retiro confirmado.',{exact:false}).waitFor();check(f.row.posts.length===1&&f.row.reads.length===0,label+': confirmed synthetic success performs no extra transport');}
  else {
   await message.getByText('No se confirmó la respuesta.',{exact:false}).waitFor();check(await current.opener.isDisabled(),label+': uncertain result keeps publication action disabled');
   await otherTab.click();await f.page.keyboard.press('Enter');await settle(f.page);check(f.row.posts.length===1&&f.row.reads.length===0,label+': uncertain selection/key attempts do not repeat or query automatically');
   await f.workspace.getByRole('button',{name:'Consultar estado guardado',exact:true}).click();await message.getByText('El estado guardado coincide con el cambio solicitado. No se volvió a enviar.',{exact:true}).waitFor();
   check(f.row.posts.length===1&&f.row.reads.length===1,label+': explicit read-only recovery reconciles without rePOST');const read=new URL(f.row.reads[0].path,origin);check(read.searchParams.get('tenant')===TENANT&&(kind==='product'?read.searchParams.get('id')===PRODUCT:!read.searchParams.has('id')),label+': reconciliation reads the same tenant and selected resource');
  }
  f.row.keys=await f.page.evaluate(()=>window.__catalogKeys);f.row.passed=true;
 }finally{await f.context.close();contexts.delete(f.context);}
}
await mkdir(output,{recursive:true});
try{
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 for(const width of [390,1280])for(const theme of ['light','dark'])for(const kind of ['product','brand'])for(const action of ['publish','withdraw'])for(const outcome of ['success','uncertain'])await runCase(kind,action,outcome,width,theme);
 report.sourceAfter=await sourceHashes();assert.deepEqual(report.sourceAfter,before);check(report.errors.length===0&&report.blockedRequests.length===0,'No client errors or attempted external/unapproved requests');check(report.cases.length===32&&report.cases.every(row=>row.passed),'Four actions, two outcomes, two widths and two themes completed');
 report.passed=true;report.baselineDefectReproduced=!guarded;report.releaseAcceptanceEligible=guarded&&Boolean(process.env.QA_SOURCE);
}catch(error){report.failure=String(error.stack||error);process.exitCode=1;}
finally{
 for(const context of contexts)await context.close();contexts.clear();report.closure.contexts=true;
 if(browser){await browser.close();report.closure.browser=true;}server.closeAllConnections();if(server.listening)await new Promise(done=>server.close(done));report.closure.server=!server.listening;stop();report.closure.esbuild=true;
 report.completedAt=new Date().toISOString();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({report:join(output,'report.json'),mode,passed:report.passed,baselineDefectReproduced:report.baselineDefectReproduced,releaseAcceptanceEligible:report.releaseAcceptanceEligible,cases:report.cases.length,checks:report.checks.length,failure:report.failure,closure:report.closure}));
}
