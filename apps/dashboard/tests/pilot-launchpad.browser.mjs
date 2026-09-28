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
const dashboard=fileURLToPath(new URL('../',import.meta.url)),root=resolve(dashboard,'../..'),output=resolve(process.env.QA_OUTPUT||'artifacts/pilot-launchpad-browser');await mkdir(output,{recursive:true});
const fixture=`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{PilotLaunchpad}from'./src/components/pilot-launchpad';import{resolvePilotScope,parsePilotBatches,buildPilotLaunchpad}from'./src/lib/pilot-launchpad-model';function App(){const[p,set]=useState(window.__initial);window.__change=set;const scope=resolvePilotScope(p.access,p.tenant);const source=scope.state!=='selected'?undefined:p.state==='ready'?{state:'ready',rows:parsePilotBatches(p.rows,scope.tenant),checkedAt:p.checkedAt}:{state:p.state,rows:null,checkedAt:p.checkedAt};const model=buildPilotLaunchpad(p.access,scope,source);return <main style={{padding:16,maxWidth:1280,margin:'auto'}}><aside style={{marginBottom:12}}>QA local: lotes y sesiones sintéticos; componentes reales, sin datos de producción.</aside><PilotLaunchpad model={model}/></main>};createRoot(document.getElementById('root')).render(<App/>);`;
const plugins=[{name:'qa-next-link',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({loader:'jsx',resolveDir:dashboard,contents:`import React from'react';export default function Link({children,prefetch,...props}){return <a {...props} onClick={e=>{e.preventDefault();(window.__navigations||=[]).push(props.href)}}>{children}</a>}`}));}}];
const bundle=await build({stdin:{contents:fixture,loader:'tsx',resolveDir:dashboard},plugins,bundle:true,write:false,outfile:'fixture.js',format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},logLevel:'silent'});
const css=(await postcss([tailwindcss({content:[join(dashboard,'src/**/*.{ts,tsx}').replaceAll('\\','/'),join(root,'packages/ui/src/**/*.{ts,tsx}').replaceAll('\\','/'),{raw:fixture,extension:'tsx'}],darkMode:['selector','[data-theme="dark"]'],theme:{extend:{colors:{brand:{dark:'#020617',card:'#0f172a',border:'#1e293b',cyan:'#06b6d4',blue:'#3b82f6'}}}},plugins:[]})]).process(await readFile(join(dashboard,'src/app/globals.css'),'utf8'),{from:undefined})).css+(bundle.outputFiles.find(f=>f.path.endsWith('.css'))?.text||'');
const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).contents;
const server=createServer((req,res)=>{const u=new URL(req.url,'http://qa.invalid');if(req.method!=='GET'){res.writeHead(405);return res.end();}if(u.pathname==='/fixture.js'){res.setHeader('content-type','text/javascript');return res.end(js);}if(u.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}if(u.pathname!=='/'){res.writeHead(404);return res.end();}const theme=u.searchParams.get('theme')==='dark'?'dark':'light';res.setHeader('content-type','text/html;charset=utf-8');res.end(`<!doctype html><html lang="es-AR" data-theme="${theme}" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Puesta en marcha DPP · QA</title><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);});
await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const report={localOnly:true,syntheticIdentity:true,actualComponents:true,nextLinkStubbed:true,productionUsed:false,checks:[],views:[],clientErrors:[],unexpectedRequests:[]};
const check=(v,name)=>{report.checks.push({name,passed:Boolean(v)});assert.ok(v,name);};
const tenant={role:'tenant-admin',tenantSlug:'qa-company',permissions:['batches:read'],deniedPermissions:[],isDemo:false};
const global={...tenant,role:'super-admin',tenantSlug:null,permissions:['*']};
const row=(patch={})=>({id:'10000000-0000-4000-8000-000000000001',bid:'ENVASE-AMBAR-2026',tenant_slug:'qa-company',product_name:'Envase Ámbar · contenido del producto',sku:'AM-01',winery:'',carrier_profile_code:'ntag424',status:'active',quantity:12,active_tags:3,inactive_tags:8,revoked_tags:1,editorial_managed:true,...patch});
const initial=(patch={})=>({access:tenant,tenant:'qa-company',state:'ready',checkedAt:'2026-09-28T12:00:00.000Z',rows:[row(),row({id:'10000000-0000-4000-8000-000000000002',bid:'LOTE-B',product_name:'Producto secundario',sku:'B-02',quantity:0,active_tags:0,inactive_tags:0,revoked_tags:0})],...patch});
const tick=page=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
async function scenario(props=initial(),width=390,theme='light'){
 const context=await browser.newContext({viewport:{width,height:1000},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(12000);
 await page.addInitScript(props=>window.__initial=props,props);
 page.on('pageerror',e=>report.clientErrors.push(e.message));
 await page.route('**/*',route=>{const request=route.request(),u=new URL(request.url());if(u.origin===origin&&request.method()==='GET'&&['/','/fixture.js','/favicon.ico'].includes(u.pathname))return route.continue();report.unexpectedRequests.push(request.method()+' '+u.pathname);return route.abort();});
 await page.goto(origin+'/?theme='+theme);await page.getByTestId('pilot-launchpad').waitFor();return{page,context,width,theme};
}
async function inspect(t,name){
 await t.page.addScriptTag({content:axe});
 const violations=await t.page.evaluate(async()=>(await axe.run('[data-testid="pilot-launchpad"]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})));
 check(!violations.length,`${name} ${t.width} ${t.theme}: no axe violations`);
 check(await t.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} ${t.width} ${t.theme}: no horizontal overflow`);
 const clipped=await t.page.locator('[data-testid="pilot-launchpad"] a, [data-testid="pilot-launchpad"] input, [data-testid="pilot-launchpad"] button').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1);}).length);
 check(!clipped,`${name} ${t.width} ${t.theme}: no clipped controls`);
 const file=`${name}-${t.width}-${t.theme}.png`;await t.page.screenshot({path:join(output,file),fullPage:true});report.views.push({name,width:t.width,theme:t.theme,violations,file});
}
try{
 for(const theme of ['light','dark'])for(const width of [320,375,430,768,1024,1440]){
  const t=await scenario(initial(),width,theme);
  check(!await t.page.getByTestId('pilot-selected-reference').count(),'No implicit batch selection '+width+' '+theme);
  check(!await t.page.getByRole('progressbar').count(),'No invented readiness percentage '+width+' '+theme);
  await t.page.getByTestId('pilot-batch-choice').first().focus();await t.page.keyboard.press('Enter');await tick(t.page);
  check(await t.page.locator('#pilot-selected-title').evaluate(n=>document.activeElement===n),'Selection focuses its actual dossier '+width+' '+theme);
  const link=t.page.getByTestId('pilot-task-passport').getByRole('link');check(await link.getAttribute('href')==='/batches/ENVASE-AMBAR-2026/passport?tenant=qa-company','DPP link keeps exact batch and company '+width+' '+theme);
  check(!await t.page.getByTestId('pilot-task-recalls').getByRole('link').count(),'Denied recall is not an active link '+width+' '+theme);
  await link.click();check(await t.page.evaluate(()=>window.__navigations.at(-1))==='/batches/ENVASE-AMBAR-2026/passport?tenant=qa-company','Action follows the projected DPP route '+width+' '+theme);
  await inspect(t,'selected-lot');await t.context.close();
 }
 const searched=await scenario();await searched.page.getByTestId('pilot-batch-choice').first().click();await searched.page.locator('#pilot-search').fill('ambar AM-01');check(await searched.page.getByTestId('pilot-batch-choice').count()===1,'Search ignores accents and matches loaded SKU');await searched.page.locator('#pilot-search').fill('does-not-exist');check(await searched.page.getByTestId('pilot-selection-filtered').count()===1,'Filtering discloses that the explicit selection is outside search');await searched.page.getByRole('button',{name:'Limpiar búsqueda'}).click();check(await searched.page.getByTestId('pilot-batch-choice').count()===2,'Reset searches only the original bounded collection');await searched.context.close();
 for(const state of ['ready','unavailable','forbidden','invalid','timeout']){
  const t=await scenario(initial({state,rows:[]}),390,'light');
  check(await t.page.getByTestId(state==='ready'?'pilot-empty':'pilot-source-notice').count()===1,'Explicit source state '+state);
  check(!await t.page.getByTestId('pilot-batch-choice').count()&&!await t.page.getByTestId('pilot-selected-reference').count(),'No stale batch in '+state);
  check(await t.page.getByTestId('pilot-count').count()===(state==='ready'?1:0),'Only confirmed empty displays a count '+state);
  await inspect(t,'source-'+state);await t.context.close();
 }
 const scoped=await scenario(initial({access:global,tenant:undefined}));check(await scoped.page.getByTestId('pilot-tenant-form').count()===1,'Global account must choose its company');check(!await scoped.page.getByTestId('pilot-count').count(),'No global merged inventory');check(await scoped.page.getByTestId('pilot-tenant-form').getAttribute('method')==='GET','Company selector is read-only');await inspect(scoped,'global-choice');await scoped.context.close();
 const demo=await scenario(initial({access:{...tenant,isDemo:true}}));check(!await demo.page.getByTestId('pilot-batch-choice').count(),'Demo session cannot render operational samples');await demo.context.close();
 const race=await scenario();await race.page.getByTestId('pilot-batch-choice').first().click();
 await race.page.evaluate(p=>window.__change(p),initial({access:{...tenant,tenantSlug:'other'},tenant:'other',rows:[row({tenant_slug:'other',bid:'OTHER-BATCH',product_name:'Other company product'})]}));await tick(race.page);
 check(!await race.page.getByTestId('pilot-selected-reference').count()&&!(await race.page.getByTestId('pilot-launchpad').innerText()).includes('ENVASE-AMBAR-2026'),'A to B removes previous company selection and names');
 await race.page.evaluate(p=>window.__change(p),initial());await tick(race.page);check(!await race.page.getByTestId('pilot-selected-reference').count(),'A to B to A cannot revive an earlier selection');
 await race.page.getByTestId('pilot-batch-choice').first().click();await race.page.evaluate(p=>window.__change(p),initial({access:{...tenant,deniedPermissions:['batches:read']}}));await tick(race.page);check(!await race.page.getByTestId('pilot-selected-reference').count()&&!await race.page.getByTestId('pilot-batch-choice').count(),'Permission loss removes the complete previous dossier');await race.context.close();
 const long=await scenario(initial({access:global,rows:[row({bid:'B'.repeat(160),product_name:'Producto'.repeat(25),sku:'S'.repeat(200),carrier_profile_code:'N'.repeat(200)})]}),320,'dark');await long.page.getByTestId('pilot-batch-choice').click();await inspect(long,'long-identifiers');await long.context.close();
 check(!report.clientErrors.length,'No browser exceptions');check(!report.unexpectedRequests.length,'No data requests, hidden writes, prefetches or external calls');report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack||error);throw error;}
finally{await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(done=>server.close(done));console.log(JSON.stringify({status:report.status,checks:report.checks.length,views:report.views.length,output}));}
