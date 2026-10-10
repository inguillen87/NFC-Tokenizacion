// Actual production Next router with isolated synthetic sessions/data. No customer operations.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createDestinationRecoveryFixture} from './browser/consumer-destination-recovery-api.fixture.mjs';
import {extractInitialDocumentDigests} from './consumer-portal-loading-evidence.mjs';
const web=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(web,'../..'),output=resolve(process.env.QA_OUTPUT||'artifacts/consumer-destination-recovery');
await mkdir(output,{recursive:true});
const{chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright-core');
const axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
const fixture=await createDestinationRecoveryFixture();
const reserve=createServer();await new Promise(resolve=>reserve.listen(0,'127.0.0.1',resolve));const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(key)));
Object.assign(env,{NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',CONSUMER_DESTINATION_RECOVERY_QA:'1',CONSUMER_DESTINATION_RECOVERY_API:fixture.origin});
const next=spawn(process.execPath,['--import',pathToFileURL(join(web,'tests/consumer-destination-recovery-local-fetch.mjs')).href,join(repo,'node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:web,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
next.stdout.on('data',()=>{});next.stderr.on('data',()=>{});let serverFailed=false;next.on('error',()=>{serverFailed=true;});
const origin=`http://127.0.0.1:${port}`;
const report={localOnly:true,actualNextProductionBuild:true,syntheticSessionsAndData:true,realAuthenticationCertified:false,physicalTapMeasured:false,checks:[],views:[],cases:[],clientErrors:[],nativeWindowErrors:[],consoleErrors:[],blockedWrites:[],externalRequests:[],geolocationCalls:0};
const paths=['consumer-destination-recovery.browser.mjs','consumer-destination-recovery-local-fetch.mjs','browser/consumer-destination-recovery-api.fixture.mjs','consumer-portal-loading-evidence.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile(join(web,'tests',path))).digest('hex')])));
report.helperHashesStart=await hashes();
const check=(value,name)=>{report.checks.push({name,passed:Boolean(value)});assert.ok(value,name);};
const destinations=[
 ['/me/products?focus=900001','Tus productos guardados'],
 ['/me/rewards?fromTap=1&eventId=900001&tenant=loading-qa&action=rewards','Tus beneficios'],
 ['/me/marketplace?fromTap=1&eventId=900001&tenant=loading-qa&action=marketplace','Catálogo de la marca'],
 ['/me/brands?tenant=loading-qa','Mis marcas y clubes'],
 ['/me/experiences?tenant=loading-qa&eventId=900001','Tus experiencias'],
 ['/me/wallet?fromTap=1&eventId=900001&tenant=loading-qa&action=wallet','Pasaporte Criptográfico & Wallet'],
 ['/me/passport?fromTap=1&eventId=900001&tenant=loading-qa&action=passport','Mi cuenta y mis registros'],
 ['/me/sommelier?tenant=loading-qa&eventId=900001','Asistente de vinos'],
 ['/me/cork-analyzer?eventId=900001','Diagnóstico de Corcho & Cápsula'],
 ['/me/privacy?tenant=loading-qa','Privacidad'],
 ['/me/security?fromTap=1&eventId=900001','Seguridad y canales de contacto'],
 ['/me/taps?event=900001&from=2026-10-01&to=2026-10-06','Historial de lecturas'],
 ['/me/taps/900001?fromTap=1&tenant=loading-qa','Tu lectura guardada'],
];
let browser;
async function setScenario(context,value){await context.addCookies([{name:'consumer_loading_qa',value,url:origin,httpOnly:true,sameSite:'Lax'}]);}
async function open(width,theme,scenario){
 const context=await browser.newContext({viewport:{width,height:900},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'});
 await context.addCookies([{name:'theme',value:theme,url:origin},{name:'nexid_theme_version',value:'white-first-v2',url:origin}]);await setScenario(context,scenario);
 await context.exposeBinding('__destinationNativeError',(_source,event)=>report.nativeWindowErrors.push(event));
 await context.exposeBinding('__destinationLocation',()=>report.geolocationCalls++);
 await context.addInitScript(()=>{window.__destinationDeliveries=[];window.addEventListener('error',event=>{window.__destinationDeliveries.push(window.__destinationNativeError({message:event.error?.message||event.message,digest:event.error?.digest||null}).catch(()=>{}));});Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){void window.__destinationLocation();throw Error('Unexpected GPS');},watchPosition(){void window.__destinationLocation();throw Error('Unexpected GPS');}}});});
 const page=await context.newPage();page.on('pageerror',error=>report.clientErrors.push({message:error.message}));page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push({message:message.text(),url:message.location().url});});
 await page.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(!['GET','HEAD'].includes(request.method())){report.blockedWrites.push({path:url.pathname,method:request.method()});return route.abort();}if(url.origin===origin||['data:','blob:'].includes(url.protocol))return route.continue();report.externalRequests.push({origin:url.origin,path:url.pathname});return route.abort();});
 return{context,page};
}
async function assess(page,selector,name,width,theme){
 await page.locator(selector).waitFor();await page.screenshot({path:join(output,name+'.png'),fullPage:true});
 await page.addScriptTag({content:axe});const result=await page.evaluate(async selector=>{const r=await axe.run(selector,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return{violations:r.violations.map(x=>({id:x.id,impact:x.impact,targets:x.nodes.map(node=>node.target)})),incomplete:r.incomplete.map(x=>x.id)};},selector);
 check(result.violations.length===0,name+': scoped axe violations zero');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+': no horizontal overflow');check(await page.locator('html').getAttribute('data-theme')===theme,name+': requested theme');
 report.views.push({name,width,theme,...result,scope:selector,nativeCapture:true});
}
async function recover(destination,width,theme,scenario,capture=true){
 const[path,title]=destination,name=path.split('?')[0].replace(/[^a-z0-9]/gi,'-')+'-'+scenario+'-'+width+'-'+theme;
 const{context,page}=await open(width,theme,scenario);const start=fixture.requests.length;
 const evidence={path,scenario,width,theme,initialReads:[],retryReads:[],refreshCount:0};report.cases.push(evidence);
 try{
  const response=await page.goto(origin+path,{waitUntil:'commit'});const document=response.text();
  const unavailable=page.getByTestId('consumer-portal-unavailable');await unavailable.waitFor({timeout:12000});
  check(page.url()===origin+path,name+': exact route and query retained before retry');
  check(await page.getByTestId('consumer-portal-error').count()===0,name+': expected unavailable avoids exception boundary');
  evidence.initialReads=fixture.requests.slice(start);check(evidence.initialReads.length>=1&&evidence.initialReads.every(row=>row.path==='/consumer/session'),name+': no private reads before session confirmation');
  const digests=extractInitialDocumentDigests(await document);check(digests.templateDigests.length===0&&digests.streamedSuspenseDigests.length===0&&digests.rscErrorDigests.length===0,name+': no streamed server/RSC error digest');
  await page.waitForFunction(()=>document.activeElement?.id==='consumer-session-unavailable-title');check(true,name+': unavailable title focused');
  const retry=unavailable.getByRole('button',{name:'Reintentar',exact:true});check(await retry.evaluate(node=>node.getBoundingClientRect().height>=44),name+': retry touch target');
  if(capture)await assess(page,'[data-testid="consumer-portal-unavailable"]',name,width,theme);
  await setScenario(context,'ready');let release;const gate=new Promise(resolve=>{release=resolve;});const routeUrl=url=>url.origin===origin&&url.pathname===new URL(origin+path).pathname;
  const hold=async route=>{if(route.request().headers().rsc==='1'){evidence.refreshCount++;await gate;}return route.fallback();};await page.route(routeUrl,hold);const retryStart=fixture.requests.length;
  try{
   const requestStarted=page.waitForRequest(request=>routeUrl(new URL(request.url()))&&request.method()==='GET'&&request.headers().rsc==='1',{timeout:12000});
   await Promise.all([requestStarted,retry.click()]);const pending=unavailable.getByRole('button',{name:'Consultando…',exact:true});await pending.waitFor();check(await pending.isDisabled()&&await pending.getAttribute('aria-busy')==='true',name+': one pending disabled refresh');check(evidence.refreshCount===1,name+': exactly one RSC retry');release();
   await page.getByRole('heading',{name:title,exact:true}).waitFor({timeout:12000});check(await unavailable.count()===0,name+': requested page restored');check(page.url()===origin+path,name+': exact context retained after retry');
   if(new URL(origin+path).pathname==='/me/passport'){
    const account=page.locator('main');
    check(await account.getByRole('heading',{name:'Cuenta local QA',exact:true}).count()===1,name+': reported account restored');
    check((await account.innerText()).includes('qa@example.invalid')&&(await account.locator('[data-account-state="registered"]').innerText())==='Registrada',name+': reported contact and state restored');
    const records=account.getByRole('navigation',{name:'Consultar mis registros',exact:true});
    check((await records.innerText()).includes('Productos guardados: 1')&&(await records.innerText()).includes('Lecturas guardadas: 1')&&(await records.innerText()).includes('Marcas registradas: 0'),name+': current account counts restored');
    check((await records.getByRole('link',{name:/Mis marcas y clubes/}).getAttribute('href'))==='/me/brands?tenant=loading-qa'&&(await account.getByRole('link',{name:'Ver mis beneficios',exact:true}).getAttribute('href'))==='/me/rewards?tenant=loading-qa',name+': reported tenant remains scoped in account destinations');
   }
   if(new URL(origin+path).pathname==='/me/taps'){const history=page.getByTestId('consumer-history');check((await history.getByRole('status').innerText()).startsWith('Consulta confirmada'),name+': actual history contract confirmed');check((await history.innerText()).includes('Producto local QA'),name+': reported historical row restored');}
   if(new URL(origin+path).pathname==='/me/products'&&new URL(origin+path).searchParams.has('focus')){const notices=page.getByTestId('product-notices');await notices.locator('[role="status"]').waitFor({state:'detached',timeout:12000});await page.locator('[data-testid="product-notices"][data-notice-state="none"]').waitFor({timeout:12000});check((await notices.innerText()).includes('Sin avisos de retiro publicados en esta consulta.'),name+': selected product confirms the actual public notice contract');}
   evidence.retryReads=fixture.requests.slice(retryStart);check(evidence.retryReads.some(row=>row.path==='/consumer/session'&&row.scenario==='ready'&&row.responseStatus===200),name+': refreshed session confirmed');check(evidence.retryReads.every(row=>['ready','public-read-only'].includes(row.scenario)&&row.method==='GET'&&row.responseStatus===200),name+': ready reads use fixture contract');
  }finally{release();await page.unroute(routeUrl,hold);}
  await page.evaluate(()=>Promise.all(window.__destinationDeliveries));
 }finally{await context.close();}
}
async function anonymous(destination,scenario){
 const[path]=destination,{context,page}=await open(390,'light',scenario),start=fixture.requests.length;
 try{await page.goto(origin+path,{waitUntil:'domcontentloaded'});await page.waitForURL(url=>url.pathname==='/login');check(new URL(page.url()).searchParams.get('next')===path,scenario+': login preserves '+path);check(fixture.requests.slice(start).every(row=>row.path==='/consumer/session'),scenario+': no private reads on '+path);await page.evaluate(()=>Promise.all(window.__destinationDeliveries));}finally{await context.close();}
}
async function availability(path,marker,scenario,width,theme,readyText,emptyText){
 const{context,page}=await open(width,theme,scenario),name=marker+'-'+scenario+'-'+width+'-'+theme;
 try{
  await page.goto(origin+path,{waitUntil:'domcontentloaded'});const notice=page.getByTestId(marker);await notice.waitFor();check(!(await page.locator('main').innerText()).includes(emptyText),name+': unavailable never asserts empty');
  await assess(page,`[data-testid="${marker}"]`,name,width,theme);const button=notice.getByRole('button',{name:'Reintentar carga',exact:true});check(await button.evaluate(node=>node.getBoundingClientRect().height>=44),name+': retry touch target');
  await setScenario(context,'ready');await button.click();await notice.waitFor({state:'detached',timeout:12000});check((await page.locator('main').innerText()).includes(readyText),name+': successful retry restores reported source');check(page.url()===origin+path,name+': source retry keeps route and query');await page.evaluate(()=>Promise.all(window.__destinationDeliveries));
 }finally{await context.close();}
}
try{
 let ready=false;for(let i=0;i<120;i++){if(serverFailed||next.exitCode!==null)break;try{if((await fetch(origin+'/release.json',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
 check(ready,'isolated production Next ready');browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 for(const destination of destinations)for(const theme of ['light','dark'])await recover(destination,390,theme,'session-500');
 for(const destination of destinations){await anonymous(destination,'session-401');await anonymous(destination,'session-false');}
 for(const index of [0,1,2,12])for(const scenario of ['session-headers-stall','session-body-stall'])await recover(destinations[index],320,'dark',scenario);
 for(const scenario of ['session-network','session-malformed'])await recover(destinations[1],768,'light',scenario);
 await recover(destinations[0],1280,'light','session-500');
 for(const theme of ['light','dark'])for(const scenario of ['brands-unavailable','brands-malformed'])await availability('/me/brands?tenant=loading-qa','consumer-brands-unavailable',scenario,390,theme,'Marca local QA','No hay membresías registradas en esta cuenta');
 for(const theme of ['light','dark'])for(const scenario of ['catalog-unavailable','catalog-malformed'])await availability('/me/marketplace?tenant=loading-qa','consumer-catalog-unavailable',scenario,390,theme,'Catálogo local QA','Todavía no hay productos publicados');
 for(const theme of ['light','dark'])for(const scenario of ['products-unavailable','taps-unavailable','catalog-unavailable'])await availability('/me/brands?tenant=loading-qa','consumer-brands-partial',scenario,320,theme,'Marca local QA','No hay membresías registradas en esta cuenta');
 for(const width of [320,768,1280])for(const theme of ['light','dark'])await availability('/me/marketplace?tenant=loading-qa','consumer-catalog-unavailable','catalog-unavailable',width,theme,'Catálogo local QA','Todavía no hay productos publicados');
 for(const[path,,emptyText]of [['/me/brands','unused','No hay membresías registradas en esta cuenta'],['/me/marketplace','unused','Todavía no hay productos publicados']]){const{context,page}=await open(390,'light','empty');try{await page.goto(origin+path,{waitUntil:'domcontentloaded'});const content=page.locator('#consumer-portal-content');await content.getByText(emptyText,{exact:false}).waitFor();check((await content.innerText()).includes(emptyText),path+': confirmed empty remains distinct');check(await content.getByRole('button',{name:'Reintentar carga',exact:true}).count()===0,path+': successful empty is not a failure');await page.evaluate(()=>Promise.all(window.__destinationDeliveries));}finally{await context.close();}}
 check(fixture.requests.every(row=>row.method==='GET'),'fixture received only GET reads');check(fixture.requests.filter(row=>row.scenario==='public-read-only').every(row=>row.cookieForwarded===false&&row.authorizationForwarded===false),'public reads forward no session cookies or authorization');check(report.blockedWrites.length===0,'no authentication/business writes attempted');check(report.geolocationCalls===0,'zero GPS calls');check(report.externalRequests.length===0,'zero external browser requests');check(report.clientErrors.length===0,'zero client exceptions');check(report.nativeWindowErrors.length===0,'zero native window exceptions');check(report.consoleErrors.length===0,'zero unexpected browser console errors');report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack);const page=browser?.contexts().at(-1)?.pages().at(-1);if(page)await page.screenshot({path:join(output,'failure.png'),fullPage:true}).catch(()=>{});throw error;
}finally{
 report.fixtureReads=fixture.requests;report.helperHashesEnd=await hashes();report.helpersUnchanged=JSON.stringify(report.helperHashesStart)===JSON.stringify(report.helperHashesEnd);check(report.helpersUnchanged,'helpers unchanged during execution');await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:report.checks.length,views:report.views.length,cases:report.cases.length,clientErrors:report.clientErrors.length,nativeWindowErrors:report.nativeWindowErrors.length,consoleErrors:report.consoleErrors.length,blockedWrites:report.blockedWrites.length,geolocationCalls:report.geolocationCalls,output}));await browser?.close();if(next.exitCode===null){next.kill();await Promise.race([new Promise(resolve=>next.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,1500))]);}await fixture.close();
}
