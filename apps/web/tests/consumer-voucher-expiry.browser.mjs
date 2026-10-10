// Actual rewards client and CSS; synthetic vouchers and a controlled local clock.
// No customer session, provider, OTP, database or redemption acceptance.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const web=fileURLToPath(new URL('../',import.meta.url));
const parent=resolve(process.env.QA_OUTPUT||'artifacts/consumer-voucher-expiry');
await mkdir(parent,{recursive:true});
const output=await mkdtemp(join(parent,'run-'));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright-core');
const axe=process.env.AXE_MODULE_PATH?await readFile(process.env.AXE_MODULE_PATH,'utf8'):null;
const start='2030-01-01T12:00:00.000Z';
const entry=`import React from 'react';import{createRoot}from'react-dom/client';import{ConsumerRewardsClient}from'./src/app/me/rewards/rewards-client';import{buildConsumerRewardsModel}from'./src/app/me/_components/consumer-rewards-model';import './src/app/me/_components/portal-shell.module.css';
const rows=[{id:'reward-1',tenant_slug:'qa-brand',tenant_name:'Marca de ensayo',title:'Visita de ensayo',claim_id:'claim-1',claim_status:'claimed',claim_expires_at:'2030-01-01T12:00:10.000Z',redemption_code:'LOCAL-TEST-1234',points_spent:10},{id:'reward-2',tenant_slug:'qa-brand',title:'Estado no confirmado',claim_id:'claim-2',claim_status:'unknown',claim_expires_at:'2030-01-01T12:00:10.000Z',redemption_code:'UNAUTHORIZED-1234'}];
const root=createRoot(document.getElementById('app'));window.fixtureUnmount=()=>root.unmount();root.render(<main><h1>Beneficios de ensayo local</h1><ConsumerRewardsClient items={buildConsumerRewardsModel({ok:true,items:rows},'${start}').items} initialTenant='' selectedVoucher='claim-claim-1'/></main>);`;
const bundle=await build({stdin:{contents:entry,resolveDir:web,loader:'tsx'},bundle:true,write:false,outfile:'fixture.js',format:'esm',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'loopback-next-link',setup(b){
 b.onResolve({filter:/^next\/link$/},args=>({path:args.path,namespace:'local-link'}));
 b.onLoad({filter:/.*/,namespace:'local-link'},()=>({contents:`import React from 'react';export default function Link({children,prefetch,...props}){return React.createElement('a',props,children);}`,loader:'js',resolveDir:web}));
 b.onLoad({filter:/\.module\.css$/},async args=>({contents:await readFile(args.path,'utf8'),loader:'local-css'}));
}}],logLevel:'error'});
const js=bundle.outputFiles.find(file=>file.path.endsWith('.js')).contents;
const css=bundle.outputFiles.find(file=>file.path.endsWith('.css'))?.contents;
const server=createServer((req,res)=>{
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 if(req.url==='/fixture.js'){res.setHeader('content-type','text/javascript');return res.end(js);}
 if(req.url==='/fixture.css'){res.setHeader('content-type','text/css');return res.end(css||'');}
 if(req.url==='/favicon.ico'){res.writeHead(204);return res.end();}
 res.setHeader('content-type','text/html; charset=utf-8');res.end(`<!doctype html><html lang='es-AR'><head><title>Vouchers de ensayo</title><meta name='viewport' content='width=device-width,initial-scale=1'><link rel='stylesheet' href='/fixture.css'><style>*{box-sizing:border-box}body{margin:0;padding:16px;font:16px/1.5 system-ui;background:#f3f9fc;color:#12343d}html[data-theme=dark] body{background:#081a29;color:#f3f9fc}main{max-width:1000px;margin:auto;--portal-text:#12343d;--portal-muted:#465d66;--portal-surface:#fff;--portal-subtle:#f1f7f8;--portal-border:#b4cbd0;--portal-accent:#00697c;--portal-active:#e1f4f7;--portal-danger:#a22c38;--portal-danger-bg:#fff0f2}html[data-theme=dark] main{--portal-text:#f3f9fc;--portal-muted:#bed1dc;--portal-surface:#112b3b;--portal-subtle:#173849;--portal-border:#476d80;--portal-accent:#79e3f1;--portal-active:#174754;--portal-danger:#ffb0bb;--portal-danger-bg:#4b2639}h1{font-size:20px}button,input,select{font-family:inherit}</style></head><body><div id='app'></div><script type='module' src='/fixture.js'></script></body></html>`);
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const report={localOnly:true,actualRewardsClient:true,actualModuleCss:true,nextLinkStub:true,controlledSyntheticClock:true,backendWrites:0,externalRequests:0,checks:[],views:[],errors:[]};
const check=(value,name)=>{report.checks.push({name,passed:Boolean(value)});assert.ok(value,name);};
async function open(width,theme){
 const context=await browser.newContext({viewport:{width,height:900},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();
 page.setDefaultTimeout(10000);
 await page.clock.install({time:new Date(start)});await page.clock.pauseAt(new Date(start));
 await page.addInitScript(theme=>{
  document.addEventListener('DOMContentLoaded',()=>{document.documentElement.dataset.theme=theme;},{once:true});
  window.fixtureVisibility='visible';Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.fixtureVisibility});
  window.clipboardWrites=[];window.clipboardPending=false;
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText(value){window.clipboardWrites.push(value);return window.clipboardPending?new Promise(done=>window.releaseClipboard=done):Promise.resolve();}}});
  window.voucherTimers=new Set();const schedule=window.setTimeout.bind(window),cancel=window.clearTimeout.bind(window);
  window.setTimeout=(callback,delay,...args)=>{let id;id=schedule(()=>{window.voucherTimers.delete(id);callback(...args);},delay);if(delay>=1&&delay<=60000)window.voucherTimers.add(id);return id;};
  window.clearTimeout=id=>{window.voucherTimers.delete(id);return cancel(id);};
  window.voucherListeners={focus:new Set(),visibilitychange:new Set()};
  for(const[target,type]of[[window,'focus'],[document,'visibilitychange']]){const add=target.addEventListener.bind(target),remove=target.removeEventListener.bind(target);target.addEventListener=(event,callback,options)=>{if(event===type)window.voucherListeners[type].add(callback);return add(event,callback,options);};target.removeEventListener=(event,callback,options)=>{if(event===type)window.voucherListeners[type].delete(callback);return remove(event,callback,options);};}
 },theme);
 page.on('pageerror',error=>report.errors.push(error.message));
 await page.route('**/*',route=>{const request=route.request();if(new URL(request.url()).origin!==origin){report.externalRequests++;return route.abort();}if(!['GET','HEAD'].includes(request.method())){report.backendWrites++;return route.abort();}return route.continue();});
 await page.goto(origin);await page.getByRole('button',{name:'Copiar código',exact:true}).waitFor();return{page,context};
}
async function expired(page,label){
 await page.locator('article[data-reward-state=expired]').waitFor();
 check(await page.locator('code').count()===0,`${label}: code removed from all card/detail DOM`);
 check(await page.getByRole('button',{name:/Copiar código|Código copiado/}).count()===0,`${label}: copy action and old copy feedback removed`);
 check(await page.locator('article[data-selected=true]').count()===0,`${label}: URL selection no longer marks an expired voucher`);
 check(await page.locator('article[data-reward-state=expired] details').getAttribute('open')===null,`${label}: previously selected detail closes coherently`);
 await page.locator('article[data-reward-state=expired] summary').click();
 check(await page.getByText('Este voucher ya no se presenta como válido para canjear.',{exact:true}).isVisible(),`${label}: history explains the withdrawn code`);
 check(await page.getByText('UNAUTHORIZED-1234',{exact:true}).count()===0,`${label}: unknown claim is never authorized`);
}
try{
 for(const width of [390,1440])for(const theme of ['light','dark']){
  const t=await open(width,theme),label=`${width}/${theme}`;
  console.log(`[voucher] ${label}: controlled expiry`);
  check(await t.page.locator('article[data-selected=true]').count()===1,`${label}: valid requested voucher initially selected`);
  check(await t.page.locator('article[data-reward-state=unknown] code').count()===0,`${label}: no code for unknown status`);
  await t.page.getByRole('button',{name:'Copiar código',exact:true}).click();
  await t.page.getByRole('button',{name:'Código copiado',exact:true}).waitFor();
  check(await t.page.evaluate(()=>clipboardWrites.length)===1,`${label}: one copy while valid`);
  await t.page.clock.runFor(10000);await t.page.locator('article[data-reward-state=expired]').waitFor();
  check(await t.page.locator('article[data-reward-state=expired] summary').evaluate(node=>node===document.activeElement),`${label}: expiry moves keyboard focus from removed copy button to historical detail`);
  await expired(t.page,label);
  check(await t.page.evaluate(()=>clipboardWrites.length)===1,`${label}: expiry never writes or erases user clipboard`);
  await t.page.clock.setSystemTime(new Date('2029-12-31T12:00:00Z'));
  await t.page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});
  check(await t.page.locator('article[data-reward-state=expired]').count()===1&&await t.page.locator('code').count()===0,`${label}: backward wall clock cannot reactivate voucher`);
  check(await t.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label}: no horizontal overflow`);
  await t.page.clock.resume(); // Accessibility tooling uses timers; expiry is already latched.
  if(axe){await t.page.addScriptTag({content:axe});const violations=await t.page.evaluate(async()=>(await axe.run('main',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact})));check(violations.length===0,`${label}: zero axe violations after expiry`);report.views.push({width,theme,violations});}
  await t.page.screenshot({path:join(output,`expired-${width}-${theme}.png`),fullPage:true});
  await t.page.evaluate(()=>window.fixtureUnmount());
  check(await t.page.evaluate(()=>voucherTimers.size===0&&voucherListeners.focus.size===0&&voucherListeners.visibilitychange.size===0),`${label}: timers and listeners cleaned up on unmount`);
  await t.context.close();
 }
 const hidden=await open(390,'dark');
 await hidden.page.evaluate(()=>{window.fixtureVisibility='hidden';document.dispatchEvent(new Event('visibilitychange'));});
 check(await hidden.page.evaluate(()=>voucherTimers.size===0),'Hidden page stops its expiry timer');
 await hidden.page.clock.runFor(20000);
 await hidden.page.evaluate(()=>{window.fixtureVisibility='visible';window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});
 await expired(hidden.page,'Hidden/return');
 check(await hidden.page.evaluate(()=>voucherTimers.size===0&&clipboardWrites.length===0),'Return withdraws code before any copy without duplicate timers');
 await hidden.context.close();
 const guarded=await open(390,'light');
 await guarded.page.clock.setSystemTime(new Date('2030-01-01T12:00:11Z'));
 // No timer or focus event has run: an already-rendered button must still refuse copying.
 await guarded.page.getByRole('button',{name:'Copiar código',exact:true}).click();await expired(guarded.page,'Immediate copy guard');
 check(await guarded.page.evaluate(()=>clipboardWrites.length===0),'An expired click never reaches clipboard even before scheduled render');
 await guarded.context.close();
 const pending=await open(390,'dark');
 await pending.page.evaluate(()=>window.clipboardPending=true);
 await pending.page.getByRole('button',{name:'Copiar código',exact:true}).click();
 await pending.page.clock.runFor(10000);await expired(pending.page,'Pending clipboard');
 await pending.page.evaluate(()=>window.releaseClipboard());
 check(await pending.page.getByRole('button',{name:'Código copiado',exact:true}).count()===0,'Late pre-expiry clipboard completion cannot restore copied feedback or code');
 await pending.context.close();
 const backward=await open(390,'light');
 await backward.page.clock.setSystemTime(new Date('2029-12-31T12:00:00Z'));await backward.page.clock.runFor(10000);await expired(backward.page,'Monotonic elapsed');
 check(await backward.page.evaluate(()=>clipboardWrites.length===0),'Elapsed local time still expires a voucher after wall-clock setback');
 await backward.context.close();
 check(report.backendWrites===0&&report.externalRequests===0&&report.errors.length===0,'Zero backend writes, external requests and browser errors');
}finally{
 await browser.close();await new Promise(done=>server.close(done));await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
}
console.log(JSON.stringify({checks:report.checks.length,failures:report.checks.filter(c=>!c.passed),views:report.views.length,axeExecuted:Boolean(axe),backendWrites:report.backendWrites,externalRequests:report.externalRequests,errors:report.errors,evidence:output},null,2));
