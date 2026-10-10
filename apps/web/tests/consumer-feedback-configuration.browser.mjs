// Actual portal dialog/client and module CSS on loopback. Synthetic reads only;
// no provider, database, OTP, NFC, customer mutation or production acceptance.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const web=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(process.env.QA_OUTPUT||'artifacts/consumer-feedback-configuration');
await mkdir(output,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe=process.env.AXE_MODULE_PATH?await readFile(process.env.AXE_MODULE_PATH,'utf8'):null;
const entry=`import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{ProductPassportDialog}from'./src/app/me/products/product-library';import{buildHomeProductsSource}from'./src/app/me/_components/consumer-home-model';function App(){const[event,setEvent]=useState('900001');window.changeFixtureReading=setEvent;const product=buildHomeProductsSource({ok:true,items:[{product_name:'Producto de ensayo',brand_name:'Marca de ensayo',tenant_slug:'qa-brand',bid:'QA-ONLY',latest_tap_event_id:event,latest_verdict:'OPENED',latest_tap_at:'2026-10-10T13:00:00Z',created_at:'2026-10-10T12:00:00Z',ownership_record_status:'viewed'}]}).data[0];return <main><h1>Ficha de ensayo local</h1><ProductPassportDialog product={product} onClose={()=>{}}/></main>};createRoot(document.getElementById('app')).render(<App/>);`;
const bundle=await build({stdin:{contents:entry,resolveDir:web,loader:'tsx'},bundle:true,write:false,outfile:'fixture.js',format:'esm',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'loopback-next-stubs',setup(b){
 b.onResolve({filter:/^next\/(link|navigation)$/},args=>({path:args.path,namespace:'local-next'}));
 b.onLoad({filter:/.*/,namespace:'local-next'},args=>({contents:args.path==='next/link'?`import React from 'react';export default function Link({children,prefetch,...props}){return React.createElement('a',props,children);}`:`export function useSearchParams(){return new URLSearchParams(location.search)};export function useRouter(){return {refresh(){}}}`,loader:'js',resolveDir:web}));
 b.onLoad({filter:/\.module\.css$/},async args=>({contents:await readFile(args.path,'utf8'),loader:'local-css'}));
}}],logLevel:'error'});
const js=bundle.outputFiles.find(file=>file.path.endsWith('.js')).contents;
const css=bundle.outputFiles.find(file=>file.path.endsWith('.css'))?.contents;
const server=createServer((req,res)=>{
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 if(req.url==='/fixture.js'){res.setHeader('content-type','text/javascript');return res.end(js);}
 if(req.url==='/fixture.css'){res.setHeader('content-type','text/css');return res.end(css||'');}
 if(req.url==='/favicon.ico'){res.writeHead(204);return res.end();}
 res.setHeader('content-type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="es-AR"><head><title>Ficha de ensayo local</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><style>*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui;background:#f3f9fc}html[data-theme="dark"] body{background:#081a29}h1{font-size:20px}svg{flex-shrink:0}</style></head><body><div id="app"></div><script type="module" src="/fixture.js"></script></body></html>`);
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const report={localOnly:true,actualClientDialog:true,actualModuleCss:true,nextLinkAndRouterStubs:true,syntheticReads:true,backendWrites:0,geolocationCalls:0,checks:[],views:[],exceptions:[],blockedExternalRequests:[]};
const check=(condition,name)=>{report.checks.push({name,passed:Boolean(condition)});assert.ok(condition,name);};
const published=()=>({version:'nexid.tenant-actions.v1',status:'published',allowedActions:['feedback'],program:null,trivia:null,catalogAvailable:false,tenantSlug:'qa-brand'});
async function open(width,theme,handler){
 const context=await browser.newContext({viewport:{width,height:900},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),calls=[];
 await page.addInitScript(value=>{document.addEventListener('DOMContentLoaded',()=>{document.documentElement.dataset.theme=value;},{once:true});Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){throw Error('Unexpected GPS')}}});},theme);
 page.on('pageerror',error=>report.exceptions.push(error.message));
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==origin){report.blockedExternalRequests.push(url.pathname);return route.abort();}
  if(!['GET','HEAD'].includes(request.method())){report.backendWrites++;return route.abort();}
  if(url.pathname.startsWith('/api/')){
   calls.push({path:url.pathname,method:request.method(),hasCookie:Boolean(request.headers().cookie)});
   const body=url.pathname.endsWith('/configuration')?await handler(url.pathname):{ok:true,notices:[],hasMore:false,observedAt:'2026-10-10T13:00:00Z'};
   return route.fulfill({status:body?.status||200,contentType:'application/json',body:JSON.stringify(body?.payload||body)});
  }
  return route.continue();
 });
 await page.goto(origin);await page.getByRole('dialog').waitFor();return{context,page,calls};
}
try{
 for(const width of [390,1440])for(const theme of ['light','dark'])for(const scenario of ['published','unpublished','unavailable','foreign']){
  const configuration=scenario==='published'?published():scenario==='unpublished'?{...published(),allowedActions:[]}:scenario==='foreign'?{...published(),tenantSlug:'other-brand'}:null;
  const t=await open(width,theme,()=>({ok:true,configuration}));
  let feedback;
  if(scenario==='published'){
   await t.page.getByRole('link',{name:'Compartir experiencia',exact:true}).waitFor();
   feedback=t.page.getByRole('link',{name:'Compartir experiencia',exact:true});
   check((await t.page.getByRole('link',{name:'Compartir experiencia',exact:true}).getAttribute('href')).includes('eventId=900001'),`${width}/${theme} published feedback links the selected account reading`);
  }else{
   const expected=scenario==='unpublished'?'La marca no está recibiendo opiniones':'No pudimos confirmar si la marca recibe opiniones';
   await t.page.getByRole('status').filter({hasText:expected}).waitFor();
   feedback=t.page.getByRole('status').filter({hasText:expected});
   check(await t.page.getByRole('link',{name:'Compartir experiencia',exact:true}).count()===0,`${width}/${theme}/${scenario} no unauthorized feedback link`);
  }
  check(t.calls.filter(call=>call.path.endsWith('/configuration')).length===1,`${width}/${theme}/${scenario} one configuration read without polling`);
  check(await t.page.evaluate(()=>document.documentElement.dataset.theme)===theme,`${width}/${theme}/${scenario} requested appearance applies`);
  check(await t.page.getByRole('button',{name:'Cerrar ficha del producto'}).evaluate(element=>element===document.activeElement),`${width}/${theme}/${scenario} dialog starts with keyboard focus on its close action`);
  check(await t.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}/${theme}/${scenario} no horizontal overflow`);
  const dialog=t.page.getByRole('dialog');
  check(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1),`${width}/${theme}/${scenario} product sheet fits the viewport`);
  await feedback.scrollIntoViewIfNeeded();
  await feedback.evaluate(element=>{const sheet=element.closest('dialog');sheet.scrollTop+=element.getBoundingClientRect().top-sheet.getBoundingClientRect().top-110;});
  check(await feedback.evaluate(element=>{const rect=element.getBoundingClientRect(),footer=element.closest('dialog').querySelector('footer').getBoundingClientRect();return rect.top>=element.closest('dialog').getBoundingClientRect().top+65&&rect.bottom<=footer.top+1;}),`${width}/${theme}/${scenario} feedback can scroll clear of the sticky header and footer`);
  const contrast=await feedback.evaluate(element=>{const style=getComputedStyle(element);const rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number);const lum=color=>rgb(color).map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);const a=lum(style.color),b=lum(style.backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);});
  check(contrast>=4.5,`${width}/${theme}/${scenario} feedback text has at least 4.5:1 measured contrast`);
  if(scenario==='published'){await feedback.focus();check(await feedback.evaluate(element=>element===document.activeElement&&parseFloat(getComputedStyle(element).outlineWidth)>=2&&element.getBoundingClientRect().height>=44),`${width}/${theme} feedback action exposes keyboard focus and a 44px touch target`);}
  let violations=null;
  if(axe){await t.page.addScriptTag({content:axe});violations=await t.page.evaluate(async()=>(await axe.run('dialog',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})));check(violations.length===0,`${width}/${theme}/${scenario} zero axe violations`);}
  report.views.push({width,theme,scenario,violations});
  await t.page.screenshot({path:join(output,`${scenario}-${width}-${theme}.png`),fullPage:true});await t.context.close();
 }
 let release;
 const held=new Promise(done=>{release=done;});
 const race=await open(390,'dark',path=>path.includes('/900001/')?held:{ok:true,configuration:{...published(),allowedActions:[]}});
 await race.page.getByRole('status').filter({hasText:'Consultando las opciones actuales de la marca'}).waitFor();
 await race.page.evaluate(()=>window.changeFixtureReading('900002'));
 await race.page.getByRole('status').filter({hasText:'La marca no está recibiendo opiniones'}).waitFor();
 release({ok:true,configuration:published()});
 await race.page.waitForTimeout(100);
 check(await race.page.getByRole('link',{name:'Compartir experiencia',exact:true}).count()===0,'A previous product configuration arriving late cannot enable the selected product');
 check(race.calls.filter(call=>call.path.endsWith('/configuration')).length===2,'Switching products reads each context once and issues no mutation');
 await race.context.close();
 check(report.backendWrites===0&&report.exceptions.length===0&&report.blockedExternalRequests.length===0,'No backend writes, browser exceptions or external requests');
}finally{
 await browser.close();await new Promise(done=>server.close(done));await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
}
console.log(JSON.stringify({checks:report.checks.length,failures:report.checks.filter(c=>!c.passed),views:report.views.length,axeExecuted:Boolean(axe),backendWrites:report.backendWrites,exceptions:report.exceptions,evidence:output},null,2));
