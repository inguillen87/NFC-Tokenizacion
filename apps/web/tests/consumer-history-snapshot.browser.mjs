import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';

// Mounted-component regression only: actual History/parser/CSS, synthetic props
// and deferred GET transport; no Next server, authentication, DB, GPS or NFC.
assert.ok(process.env.PLAYWRIGHT_MODULE&&process.env.CHROME_PATH);
const appRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(join(appRoot,'package.json'));
const {build,stop}=await import(pathToFileURL(require.resolve('esbuild')).href);
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const component=join(appRoot,'src/app/me/taps/consumer-history.tsx').replaceAll('\\','/');
const model=join(appRoot,'src/app/me/taps/history-model.ts').replaceAll('\\','/');
const hash=value=>createHash('sha256').update(value).digest('hex'),before=hash(await readFile(component));
const entry=[
 'import React from "react";import {createRoot} from "react-dom/client";',
 'import {ConsumerHistory} from '+JSON.stringify(component)+';',
 'import {parseHistory} from '+JSON.stringify(model)+';',
 'const root=createRoot(document.getElementById("history-snapshot-root"));',
 'window.__qa={calls:[],errors:[]};window.addEventListener("error",e=>window.__qa.errors.push(String(e.message)));',
 'window.fetch=(url,options)=>{if(!String(url).startsWith("/api/consumer/taps/history?"))throw Error("Unexpected QA fetch");return new Promise(resolve=>{const call={url:String(url),aborted:options.signal.aborted,resolve:(raw,status=200)=>{const response=new Response(JSON.stringify(raw),{status,headers:{"content-type":"application/json"}}),getReader=response.body.getReader.bind(response.body);Object.defineProperty(response,"ok",{get(){call.statusRead=true;return status>=200&&status<300;}});response.body.getReader=()=>{const reader=getReader(),release=reader.releaseLock.bind(reader);reader.releaseLock=()=>{release();call.readReleased=true;};return reader;};resolve(response);}};options.signal.addEventListener("abort",()=>{call.aborted=true;});window.__qa.calls.push(call);});};',
 'window.__qa.replace=(raw,filters)=>root.render(React.createElement(ConsumerHistory,{initial:raw===null?null:parseHistory(raw),initialFilters:filters}));',
].join('\n');
const plugins=[{name:'history-mounted-regression',setup(b){
 b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'history-snapshot-qa'}));
 b.onLoad({filter:/.*/,namespace:'history-snapshot-qa'},()=>({loader:'js',resolveDir:appRoot,contents:'import React from "react";export default function Link({children,prefetch,...p}){return React.createElement("a",p,children);}'}));
 b.onLoad({filter:/consumer-history\.module\.css$/},async({path})=>({loader:'local-css',contents:await readFile(path,'utf8')}));
}}];
const qA={tenant:'wine-qa',from:'2026-10-13',to:'2026-10-13',event:''},qAll={tenant:'',from:'',to:'',event:''},qC={tenant:'agro-qa',from:'',to:'',event:''};
function payload(label,query,account,hasNext=true,page=1){
 const tenant=query.tenant||'wine-qa',count=hasNext?25:1;
 return {ok:true,protocol:'nexid.consumer-history.v1',source:'database',readOnly:true,timeBasis:'saved_to_account',accountKey:account.repeat(64),observedAt:'2026-10-13T10:00:00.654321Z',query:{...query},
  items:Array.from({length:count},(_,n)=>({row_id:String(1000-n),tap_event_id:String(1000-n),created_at:'2026-10-13T08:00:00.123456Z',verdict:'VALID_CLOSED',risk_level:'low',city:null,country:null,tenant_slug:tenant,tenant_name:tenant,product_name:label+' '+(n+1),brand_name:tenant})),
  brands:[{slug:tenant,name:tenant}],moreBrands:false,navigation:{page,pageSize:25,returned:count,hasNext,cursor:'cursor_'+account+'_'+page,nextCursor:hasNext?'next_'+account+'_'+page:null,cutoff:'2026-10-13T10:00:00.654321Z'}};
}
const report={kind:'synthetic-mounted-history-props-regression',status:'pending',realComponent:true,realParser:true,realCss:true,nextServer:false,authentication:false,postgres:false,physicalTap:false,sourceBefore:before,cases:[],closure:{contexts:false,browser:false,server:false,esbuild:false}};
let browser,server;const contexts=new Set();
try{
 const bundle=await build({bundle:true,write:false,platform:'browser',format:'iife',absWorkingDir:appRoot,jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent',plugins,outfile:join(appRoot,'history-snapshot-qa.js'),stdin:{contents:entry,sourcefile:'history-snapshot-qa.js',resolveDir:appRoot}});
 const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')),css=bundle.outputFiles.find(f=>f.path.endsWith('.css'));assert(js&&css);
 server=createServer((req,res)=>{const path=new URL(req.url,'http://127.0.0.1').pathname;if(req.method!=='GET'){res.writeHead(405);res.end();return;}if(path==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(js.contents);return;}if(path==='/style.css'){res.setHeader('content-type','text/css');res.end(css.contents);return;}if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}if(path!=='/'){res.writeHead(404);res.end();return;}res.setHeader('content-type','text/html');res.end('<!doctype html><html lang="es-AR"><head><link rel="stylesheet" href="/style.css"><style>*{box-sizing:border-box}body{margin:0;padding:12px;font-family:Arial,sans-serif}</style></head><body><div id="history-snapshot-root"></div><script src="/bundle.js"></script></body></html>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'es-AR',timezoneId:'America/Argentina/Mendoza',reducedMotion:'reduce',serviceWorkers:'block'});contexts.add(context);
  try{
   const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());await p.goto(origin,{waitUntil:'load'});await p.waitForFunction(()=>Boolean(window.__qa?.replace));
   await p.evaluate(t=>{document.documentElement.dataset.theme=t;document.documentElement.className='theme-'+t;},theme);
   const root=p.getByTestId('consumer-history');
   await p.evaluate(({raw,q})=>window.__qa.replace(raw,q),{raw:payload('SNAPSHOT_A',qA,'a'),q:qA});await root.getByText('SNAPSHOT_A 1',{exact:true}).waitFor();
   await root.getByRole('button',{name:'Horarios UTC',exact:true}).click();assert.equal(await root.getByRole('button',{name:'Hora de mi dispositivo',exact:true}).getAttribute('aria-pressed'),'true');
   await root.getByRole('button',{name:'Página siguiente de mis lecturas',exact:true}).click();await p.waitForFunction(()=>window.__qa.calls.length===1);
   await p.evaluate(({raw,q})=>window.__qa.replace(raw,q),{raw:payload('SNAPSHOT_ALL',qAll,'a'),q:qAll});await root.getByText('SNAPSHOT_ALL 1',{exact:true}).waitFor();
   await root.getByTestId('history-filter-panel').locator(':scope > summary').click();
   assert.equal(await p.evaluate(()=>window.__qa.calls[0].aborted),true);assert.equal(await root.getByRole('combobox',{name:'Empresa',exact:true}).inputValue(),'');assert.equal(await root.getByRole('button',{name:'Hora de mi dispositivo',exact:true}).getAttribute('aria-pressed'),'true');
   await root.getByRole('button',{name:'Página siguiente de mis lecturas',exact:true}).click();await p.waitForFunction(()=>window.__qa.calls.length===2);
   // The transport intentionally resolves despite abort. The old finally must
   // not clear the new request's busy state, nor can its rows replace it.
   await p.evaluate(raw=>window.__qa.calls[0].resolve(raw),payload('OLD_A_RESPONSE',qA,'a',true,2));await p.waitForFunction(()=>window.__qa.calls[0].readReleased===true);await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.equal(await root.getByRole('button',{name:'Consultando…',exact:true}).isDisabled(),true);assert.equal(await root.getByRole('listitem').count(),0);assert.equal(await root.getByText('OLD_A_RESPONSE 1',{exact:true}).count(),0);
   await p.evaluate(({raw,q})=>window.__qa.replace(raw,q),{raw:payload('SNAPSHOT_C_ACCOUNT',qC,'b',false),q:qC});await root.getByText('SNAPSHOT_C_ACCOUNT 1',{exact:true}).waitFor();
   await root.getByTestId('history-filter-panel').locator(':scope > summary').click();assert.equal(await p.evaluate(()=>window.__qa.calls[1].aborted),true);
   await p.evaluate(()=>window.__qa.calls[1].resolve({error:'old-session-expired'},401));await p.waitForFunction(()=>window.__qa.calls[1].statusRead===true);await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.equal(await root.getByText('SNAPSHOT_C_ACCOUNT 1',{exact:true}).count(),1);assert.equal(await root.getByRole('link',{name:'Entrar a mi cuenta',exact:true}).count(),0);assert.equal(await root.getByRole('combobox',{name:'Empresa',exact:true}).inputValue(),'agro-qa');assert.equal(await root.getByRole('button',{name:'Hora de mi dispositivo',exact:true}).getAttribute('aria-pressed'),'true');
   assert.equal(await root.getByRole('button',{name:'Página anterior de mis lecturas',exact:true}).isDisabled(),true);assert.equal(await root.getByRole('button',{name:'Página siguiente de mis lecturas',exact:true}).isDisabled(),true);assert.ok((await root.textContent()).includes('2026-10-13T10:00:00.654321Z'));
   await p.evaluate(q=>window.__qa.replace(null,q),qC);await root.getByRole('button',{name:'Reintentar consulta',exact:true}).waitFor();assert.equal(await root.getByRole('listitem').count(),0);
   await root.getByRole('button',{name:'Reintentar consulta',exact:true}).click();await p.waitForFunction(()=>window.__qa.calls.length===3);const fresh=new URL(await p.evaluate(()=>window.__qa.calls[2].url),origin);assert.equal(fresh.searchParams.get('tenant'),'agro-qa');assert.equal(fresh.searchParams.has('cursor'),false);
   await p.evaluate(raw=>window.__qa.calls[2].resolve(raw),payload('FRESH_C_RESPONSE',qC,'b',false));await root.getByText('FRESH_C_RESPONSE 1',{exact:true}).waitFor();assert.equal(await root.getByRole('button',{name:'Hora de mi dispositivo',exact:true}).getAttribute('aria-pressed'),'true');
   assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>window.__qa.errors),[]);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));report.cases.push({theme,width:390,passed:true,serverPropsAndAccountReset:true,oldAbortedResponsesIgnored:true,stale401CannotSetLogin:true,newBusyStateRetained:true,localTimeRetained:true,freshRetryWithoutOldCursor:true});
  }finally{await context.close();contexts.delete(context);}
 }
 report.sourceAfter=hash(await readFile(component));assert.equal(report.sourceAfter,before);report.status='passed';
}catch(e){report.status='failed';report.error=String(e.message);throw e;}
finally{report.closure.contexts=contexts.size===0;if(browser){await browser.close();report.closure.browser=true;}if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));report.closure.server=true;}await stop();report.closure.esbuild=true;console.log(JSON.stringify(report));}
