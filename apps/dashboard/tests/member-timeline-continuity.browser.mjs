// Local synthetic transport; actual member component, reader and source parser.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
assert.ok(process.env.PLAYWRIGHT_MODULE && process.env.AXE_MODULE_PATH, 'Use already installed browser tools');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe = await readFile(process.env.AXE_MODULE_PATH, 'utf8');
const dashboard = fileURLToPath(new URL('../', import.meta.url)), root = resolve(dashboard, '../..');
const output = resolve(process.env.QA_OUTPUT || 'artifacts/member-timeline-continuity-browser');
await mkdir(output, { recursive: true });
const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {CustomerMemberTimeline} from './src/components/customer-member-timeline';
const ID='10000000-0000-4000-8000-000000000001',OTHER='10000000-0000-4000-8000-000000000002';
const row=(id,consumerId=ID)=>({sourceKind:'consumer_tap',sourceId:id,occurredAt:'2026-09-22T12:00:00.000Z',dataMode:'production',provenance:{persistence:'durable',relation:'consumer_tap_history',dataModeField:'events.source'},correlation:{consumerId,tapEventId:'42',basis:['consumer_id','tap_event_id']},data:{verdict:'VALID',city:id}});
const initial=(member,scenario)=>({availability:scenario==='unavailable'?'unreachable':'ready',items:['empty','partial-empty','unavailable'].includes(scenario)?[]:[row(scenario==='fresh'?'fresh-source':'initial-'+member,member)],hasMore:!['empty','partial','partial-empty','unavailable'].includes(scenario),nextCursor:!['empty','partial','partial-empty','unavailable'].includes(scenario)?'page-a':null,partial:scenario.startsWith('partial'),sourceErrors:scenario.startsWith('partial')?[{sourceKind:'incident',code:'unavailable',retryable:true}]:[]});
window.__calls=[];window.__mode='normal';window.__pending=[];window.__refreshes=0;
window.fetch=(url,options)=>{
 const u=new URL(String(url),location.origin);if(u.origin!==location.origin||!u.pathname.startsWith('/api/customer-member-timeline/')||options.method!=='GET')throw Error('Unexpected request');
 const consumerId=u.pathname.split('/').at(-1),tenant=u.searchParams.get('tenant'),cursor=u.searchParams.get('cursor');
 window.__calls.push({consumerId,tenant,cursor,cache:options.cache,redirect:options.redirect,credentials:options.credentials});
 const mode=window.__mode;const body={ok:true,tenant,consumerId,order:'desc',items:[row(mode==='cycle'?'cyclic-page':'older-'+consumerId,consumerId)],partial:mode==='partial',sourceErrors:mode==='partial'?[{sourceKind:'incident',code:'unavailable',retryable:true}]:[],page:{hasMore:mode==='cycle',nextCursor:mode==='cycle'?cursor:null}};
 if(mode==='foreign')body.tenant='other-company';
 const result=()=>Response.json(body,{status:mode==='forbidden'?403:mode==='missing'?404:mode==='unavailable'?503:200});
 if(mode==='headers')return new Promise(resolve=>window.__pending.push(()=>resolve(result())));
 if(mode==='body'){const r=result();r.json=()=>new Promise(resolve=>window.__pending.push(()=>resolve(body)));return Promise.resolve(r);}
 return Promise.resolve(result());
};
function Fixture(){
 const [settings,setSettings]=React.useState({tenant:'qa-only',member:ID,scenario:'normal',generation:0});
 window.__set=(patch)=>flushSync(()=>setSettings(old=>({...old,...patch,generation:old.generation+1})));
 window.__refreshHook=()=>{window.__refreshes++;window.__set({scenario:'fresh'})};
 window.__navigate=url=>{const q=new URL(url,location.origin);window.__lastNavigation=url;window.__set({member:q.searchParams.get('consumer')||'',scenario:'normal'})};
 const timeline=React.useMemo(()=>initial(settings.member,settings.scenario),[settings]);
 const members=React.useMemo(()=>[{id:ID,displayName:'Miembro sintético A',email:null,phone:null,status:'active',pointsBalance:null},{id:OTHER,displayName:'Miembro sintético B',email:null,phone:null,status:'active',pointsBalance:null}],[]);
 return <main className="dashboard-main mx-auto max-w-7xl p-4 md:p-8"><h1>Historial de prueba</h1><p>Datos y sesiones sintéticos; sin operaciones de clientes.</p><CustomerMemberTimeline tenantScope={settings.tenant} selectedMemberId={settings.member} members={members}
 directory={{availability:settings.scenario==='denied'?'access_denied':'ready',source:settings.scenario==='demo'?'demo':'production'}} timeline={timeline}/></main>
}createRoot(document.getElementById('root')).render(<Fixture/>);`;
const nav = `const router={refresh(){window.__refreshHook()},push(url){window.__navigate(url)}};export const useRouter=()=>router;export const usePathname=()=>'/leads-tickets';export const useSearchParams=()=>new URLSearchParams('tenant=qa-only');`;
const bundle = await build({ stdin: { contents: fixture, loader: 'tsx', resolveDir: dashboard }, bundle: true, write: false, outfile: 'fixture.js', format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' }, logLevel: 'silent', plugins: [{ name: 'navigation-only', setup(builder) {
 builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'qa' }));
 builder.onLoad({ filter: /.*/, namespace: 'qa' }, () => ({ contents: nav, loader: 'js' }));
} }] });
const content = [join(dashboard, 'src/**/*.{ts,tsx}').replaceAll('\\', '/'), join(root, 'packages/ui/src/**/*.{ts,tsx}').replaceAll('\\', '/'), { raw: fixture, extension: 'tsx' }];
const css = (await postcss([tailwindcss({ content, darkMode: ['selector', '[data-theme="dark"]'], theme: { extend: { colors: { brand: { dark: '#020617', card: '#0f172a', border: '#1e293b', cyan: '#06b6d4', blue: '#3b82f6' } } } }, plugins: [] })]).process(await readFile(join(dashboard, 'src/app/globals.css'), 'utf8'), { from: undefined })).css + (bundle.outputFiles.find(file => file.path.endsWith('.css'))?.text || '');
const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).contents;
const server = createServer((req, res) => {
 const url = new URL(req.url, 'http://qa.invalid');
 if(req.method!=='GET'){res.writeHead(405);res.end();return}
 if(url.pathname==='/fixture.js'){res.setHeader('content-type','text/javascript');res.end(js);return}
 if(url.pathname!=='/'){res.writeHead(404);res.end();return}
 const theme=url.searchParams.get('theme')==='dark'?'dark':'light';
 res.setHeader('content-type','text/html;charset=utf-8');res.end(`<!doctype html><html lang="es-AR" class="theme-${theme}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Member history · synthetic QA</title><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const report={actualComponent:true,syntheticRecords:true,noncooperativeTransportSimulated:true,nextNavigationStubbed:true,productionTested:false,checks:0,views:0,errors:[]};
const check=(condition,message)=>{report.checks++;assert.ok(condition,message)};
const ID='10000000-0000-4000-8000-000000000001',OTHER='10000000-0000-4000-8000-000000000002';
try{
 for(const width of [320,390,768,1440])for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport:{width,height:1100},reducedMotion:'reduce'});page.on('pageerror',e=>report.errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.clock.install();await page.goto(`${origin}/?theme=${theme}`);
  const panel=page.getByTestId('customer-member-timeline'),rows=panel.locator('ol>li'),load=()=>panel.getByRole('button',{name:/Cargar actividad anterior|Reintentar carga/,exact:true});
  await panel.waitFor();check(await page.evaluate(()=>__calls.length)===0,'no automatic page fetch');check(await rows.count()===1,'seed is visible');
  await page.evaluate(()=>__mode='headers');await load().focus();await page.keyboard.press('Enter');
  await panel.getByRole('button',{name:'Cancelar carga',exact:true}).waitFor();
  check(await rows.count()===1,'confirmed history remains during read');
  await panel.getByRole('button',{name:'Cancelar carga',exact:true}).click();
  await load().waitFor();check(await load().isEnabled(),'cancel releases busy state');
  await page.clock.runFor(30);check(await load().evaluate(e=>e===document.activeElement),'cancel restores focus');
  await page.evaluate(()=>{__mode='normal';__pending.splice(0).forEach(f=>f())});await load().click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-testid="customer-member-timeline"] ol>li').length===2);
  check(await page.evaluate(()=>__calls.length)===2,'cancel and retry are two explicit attempts');
  check(await page.evaluate(()=>JSON.stringify(__calls[0])===JSON.stringify(__calls[1])),'retry retains exact request');
  check((await panel.textContent()).includes('Historial cargado'),'complete page is explicitly complete');
  for(const stage of ['headers','body']){
   await page.evaluate(stage=>{__set({scenario:'normal'});__mode=stage},stage);await load().click();
   await panel.getByRole('button',{name:'Cancelar carga'}).waitFor();
   await page.clock.fastForward(15001);await load().waitFor();
   check(await rows.count()===1,`${stage} timeout preserves seed`);check(await load().isEnabled(),`${stage} timeout permits same-page retry`);
   await page.evaluate(()=>{__pending.splice(0).forEach(f=>f());__mode='normal'});await page.clock.runFor(10);
   check(await rows.count()===1,'late timeout result ignored');
  }
  await page.evaluate(()=>{__set({scenario:'normal'});__mode='headers'});await load().click();await panel.getByRole('button',{name:'Cancelar carga'}).waitFor();
  await page.evaluate(other=>__set({tenant:'qa-second',member:other}),OTHER);
  check(!(await panel.innerText()).includes('initial-'+ID),'context change never relabels old visible history');
  await page.evaluate(()=>__pending.splice(0).forEach(f=>f()));await page.clock.runFor(20);
  check(await rows.count()===1 && (await panel.innerText()).includes('initial-'+OTHER),'late cross-context reply ignored');
  await page.evaluate(()=>__mode='normal');await load().click();await page.waitForFunction(()=>document.querySelectorAll('[data-testid="customer-member-timeline"] ol>li').length===2);
  check(await page.evaluate(other=>__calls.at(-1).tenant==='qa-second'&&__calls.at(-1).consumerId===other,OTHER),'next read uses only new scope');
  for(const mode of ['unavailable','foreign','cycle']){
   await page.evaluate(mode=>{__set({scenario:'normal'});__mode=mode},mode);await load().click();await panel.getByRole('button',{name:'Reintentar carga',exact:true}).waitFor();
   check(await rows.count()===1,`${mode} keeps confirmed snapshot`);
  }
  for(const mode of ['forbidden','missing']){
   await page.evaluate(mode=>{__set({scenario:'normal'});__mode=mode},mode);await load().click();
   await page.waitForFunction(()=>document.querySelectorAll('[data-testid="customer-member-timeline"] ol>li').length===0);
   check(!(await panel.innerText()).includes('initial-'+OTHER),`${mode} clears personal activity`);
   if(mode==='forbidden')check(await panel.locator('select option').count()===1,'revoked capability hides directory identities');
  }
  for(const scenario of ['partial','partial-empty']){
   await page.evaluate(scenario=>__set({scenario}),scenario);await panel.getByRole('button',{name:'Reconsultar historial',exact:true}).waitFor();
   check(!(await panel.textContent()).includes('Historial cargado'),'partial is not complete');
   check(!(await panel.innerText()).includes('Sin actividad durable registrada'),'partial empty is not confirmed absence');
   check(await load().count()===0,'partial disables cursor advancement');
  }
  const beforeRefresh=await page.evaluate(()=>__refreshes);await panel.getByRole('button',{name:'Reconsultar historial',exact:true}).click();
  await page.getByText('fresh-source',{exact:true}).waitFor();check(await page.evaluate(()=>__refreshes)===beforeRefresh+1,'explicit restart refreshes route once');
  for(const scenario of ['denied','demo']){
   const before=await page.evaluate(()=>__calls.length);await page.evaluate(scenario=>__set({scenario}),scenario);
   check(await rows.count()===0,`${scenario} hides history`);check(await load().count()===0,`${scenario} offers no page read`);
   check(await page.evaluate(()=>__calls.length)===before,`${scenario} makes no request`);
  }
  await page.evaluate(()=>__set({scenario:'empty'}));check((await panel.innerText()).includes('Sin actividad durable registrada'),'confirmed empty is distinguished');
  await page.evaluate(()=>__set({scenario:'partial'}));await page.addScriptTag({content:axe});
  const violations=await panel.evaluate(async el=>(await axe.run(el,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations);
  check(violations.length===0,JSON.stringify(violations));check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
  if((width===390&&theme==='light')||(width===1440&&theme==='dark'))await panel.screenshot({path:join(output,`member-${width}-${theme}.png`)});
  report.views++;await page.close();
 }
 check(report.errors.length===0,JSON.stringify(report.errors));report.status='passed';console.log(JSON.stringify(report));
}finally{await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(done=>server.close(done));}
