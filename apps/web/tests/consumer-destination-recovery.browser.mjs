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
const report={localOnly:true,actualNextProductionBuild:true,syntheticSessionsAndData:true,realAuthenticationCertified:false,physicalTapMeasured:false,checks:[],views:[],cases:[],anonymousReturns:[],clientErrors:[],nativeWindowErrors:[],consoleErrors:[],blockedWrites:[],externalRequests:[],experienceMockPosts:[],expectedSyntheticHttpErrors:[],geolocationCalls:0};
const paths=['consumer-destination-recovery.browser.mjs','consumer-destination-recovery-local-fetch.mjs','browser/consumer-destination-recovery-api.fixture.mjs','consumer-portal-loading-evidence.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile(join(web,'tests',path))).digest('hex')])));
report.helperHashesStart=await hashes();
const check=(value,name)=>{report.checks.push({name,passed:Boolean(value)});assert.ok(value,name);};
// Ignore query entry order only. A continuation must remain relative, with its
// literal canonical path, origin, fragment and complete query multimap intact.
function destinationIdentity(value) {
 if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
  return null;
 }
 try {
  const parsedUrl = new URL(value, origin);
  const queryBoundary = value.indexOf('?');
  const fragmentBoundary = value.indexOf('#');
  let pathBoundary = value.length;
  if (queryBoundary !== -1) pathBoundary = queryBoundary;
  if (fragmentBoundary !== -1 && fragmentBoundary < pathBoundary) {
   pathBoundary = fragmentBoundary;
  }
  const rawPath = value.slice(0, pathBoundary);
  if (rawPath !== parsedUrl.pathname) return null;

  const queryEntries = [...parsedUrl.searchParams.entries()];
  queryEntries.sort((leftEntry, rightEntry) => {
   const [leftKey, leftValue] = leftEntry;
   const [rightKey, rightValue] = rightEntry;
   if (leftKey < rightKey) return -1;
   if (leftKey > rightKey) return 1;
   if (leftValue < rightValue) return -1;
   if (leftValue > rightValue) return 1;
   return 0;
  });
  return {
   rawPath,
   origin: parsedUrl.origin,
   username: parsedUrl.username,
   password: parsedUrl.password,
   pathname: parsedUrl.pathname,
   fragmentPresent: parsedUrl.href.includes('#'),
   hash: parsedUrl.hash,
   queryEntries,
  };
 } catch {
  return null;
 }
}

function sameDestination(actual, expected) {
 const observedDestination = destinationIdentity(actual);
 const requestedDestination = destinationIdentity(expected);
 if (observedDestination === null || requestedDestination === null) return false;
 return JSON.stringify(observedDestination) === JSON.stringify(requestedDestination);
}

function verifyDestinationComparison() {
 const requested = '/me/taps?event=900001&from=2026-10-01&to=2026-10-06';
 const reordered = '/me/taps?from=2026-10-01&to=2026-10-06&event=900001';
 check(sameDestination(reordered, requested), 'destination comparison permits equivalent reordered query entries');

 const rejectedDestinations = [
  ['/me/taps?event=900001&to=2026-10-06', 'missing date'],
  ['/me/taps?event=900001&from=2026-10-02&to=2026-10-06', 'changed date'],
  [requested + '&from=2026-10-01', 'added duplicate'],
  [requested + '&unexpected=1', 'added query key'],
  [requested + '#reading', 'added fragment'],
  [requested + '#', 'added empty fragment'],
  [origin.replace('127.0.0.1', 'localhost') + requested, 'different origin'],
  [origin.replace('http:', 'https:') + requested, 'different scheme'],
  [origin.replace('://', '://synthetic:password@') + requested, 'credentials'],
  [requested.replace('/me/taps', '/me/products'), 'different pathname'],
  [origin + requested, 'absolute same-origin continuation'],
  [origin.replace('http:', '') + requested, 'protocol-relative continuation'],
  [requested.replace('/me/taps', '/me/../me/taps'), 'normalized dot-segment pathname'],
  [null, 'missing next'],
 ];
 for (const [actualDestination, reason] of rejectedDestinations) {
  check(!sameDestination(actualDestination, requested), 'destination comparison rejects ' + reason);
 }

 const repeated = '/me/taps?event=900001&tag=a&tag=a&tag=b#reading';
 const repeatedReordered = '/me/taps?tag=b&tag=a&event=900001&tag=a#reading';
 check(sameDestination(repeatedReordered, repeated), 'destination comparison retains repeated keys as a multimap');
 check(!sameDestination('/me/taps?event=900001&tag=a&tag=b#reading', repeated), 'destination comparison rejects a missing duplicate occurrence');
 check(!sameDestination(repeated.replace('#reading', '#other'), repeated), 'destination comparison rejects a changed fragment');
 check(!sameDestination(repeated.replace('#reading', ''), repeated), 'destination comparison rejects a removed fragment');
}
const destinations=[
 ['/me/products?focus=900001','Tus productos guardados'],
 ['/me/rewards?fromTap=1&eventId=900001&tenant=loading-qa&action=rewards','Tus beneficios'],
 ['/me/marketplace?fromTap=1&eventId=900001&tenant=loading-qa&action=marketplace','Catálogo de la marca'],
 ['/me/brands?tenant=loading-qa','Mis marcas y clubes'],
 ['/me/experiences?tenant=loading-qa&eventId=900001','Tus experiencias'],
 ['/me/wallet?fromTap=1&eventId=900001&tenant=loading-qa&action=wallet','Mi billetera'],
 ['/me/passport?fromTap=1&eventId=900001&tenant=loading-qa&action=passport','Mi pasaporte NexID'],
 ['/me/sommelier?tenant=loading-qa&eventId=900001','Asistente de vinos'],
 ['/me/cork-analyzer?eventId=900001','Simulación visual de corcho y cápsula'],
 ['/me/privacy?tenant=loading-qa','Tus permisos con las marcas'],
 ['/me/security?fromTap=1&eventId=900001','Seguridad de tu cuenta'],
 ['/me/taps?event=900001&from=2026-10-01&to=2026-10-06','Historial de lecturas'],
 ['/me/taps/900001?fromTap=1&tenant=loading-qa','Tu lectura guardada'],
];
let browser;
async function setScenario(context,value){await context.addCookies([{name:'consumer_loading_qa',value,url:origin,httpOnly:true,sameSite:'Lax'}]);}
async function open(width,theme,scenario,expectedHttpStatus=0){
 const context=await browser.newContext({viewport:{width,height:900},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'});
 await context.addCookies([{name:'theme',value:theme,url:origin},{name:'nexid_theme_version',value:'white-first-v2',url:origin}]);await setScenario(context,scenario);
 await context.exposeBinding('__destinationNativeError',(_source,event)=>report.nativeWindowErrors.push(event));
 await context.exposeBinding('__destinationLocation',()=>report.geolocationCalls++);
 await context.addInitScript(()=>{window.__destinationDeliveries=[];window.addEventListener('error',event=>{window.__destinationDeliveries.push(window.__destinationNativeError({message:event.error?.message||event.message,digest:event.error?.digest||null}).catch(()=>{}));});Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){void window.__destinationLocation();throw Error('Unexpected GPS');},watchPosition(){void window.__destinationLocation();throw Error('Unexpected GPS');}}});});
 const page=await context.newPage();page.on('pageerror',error=>report.clientErrors.push({message:error.message}));page.on('console',message=>{
  if(message.type()!=='error')return;const url=message.location().url,reason=expectedHttpStatus===404?'Not Found':'Forbidden';
  const expected=expectedHttpStatus&&url===origin+'/api/consumer/experiences'&&[`Failed to load resource: the server responded with a status of ${expectedHttpStatus} (${reason})`,`Failed to load resource: the server responded with a status of ${expectedHttpStatus} ()`].includes(message.text());
  if(expected)report.expectedSyntheticHttpErrors.push({path:'/api/consumer/experiences',status:expectedHttpStatus});else report.consoleErrors.push({message:message.text(),url});
 });
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
   if(new URL(origin+path).pathname==='/me/taps'){const history=page.getByTestId('consumer-history');check((await history.getByRole('status').innerText()).startsWith('Consulta confirmada'),name+': actual history contract confirmed');check((await history.innerText()).includes('Producto local QA'),name+': reported historical row restored');}
   if(new URL(origin+path).pathname==='/me/products'&&new URL(origin+path).searchParams.has('focus')){const notices=page.getByTestId('product-notices');await notices.locator('[role="status"]').waitFor({state:'detached',timeout:12000});await page.locator('[data-testid="product-notices"][data-notice-state="none"]').waitFor({timeout:12000});check((await notices.innerText()).includes('Sin avisos de retiro publicados en esta consulta.'),name+': selected product confirms the actual public notice contract');}
   evidence.retryReads=fixture.requests.slice(retryStart);check(evidence.retryReads.some(row=>row.path==='/consumer/session'&&row.scenario==='ready'&&row.responseStatus===200),name+': refreshed session confirmed');check(evidence.retryReads.every(row=>['ready','public-read-only'].includes(row.scenario)&&row.method==='GET'&&row.responseStatus===200),name+': ready reads use fixture contract');
  }finally{release();await page.unroute(routeUrl,hold);}
  await page.evaluate(()=>Promise.all(window.__destinationDeliveries));
 }finally{await context.close();}
}
async function anonymous(destination, scenario) {
 const [path] = destination;
 const { context, page } = await open(390, 'light', scenario);
 const readStart = fixture.requests.length;
 try {
  await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(url => url.pathname === '/login');
  const observedLoginUrl = page.url();
  const loginUrl = new URL(observedLoginUrl);
  const nextValues = loginUrl.searchParams.getAll('next');
  let actualNext = null;
  if (nextValues.length === 1) actualNext = nextValues[0];

  report.anonymousReturns.push({
   scenario,
   requestedPath: path,
   observedLoginUrl,
   nextValues,
   requestedDestination: destinationIdentity(path),
   observedDestination: destinationIdentity(actualNext),
  });
  const canonicalLocalLogin = loginUrl.origin === origin
   && loginUrl.pathname === '/login'
   && loginUrl.username === ''
   && loginUrl.password === ''
   && !loginUrl.href.includes('#');
  check(canonicalLocalLogin && nextValues.length === 1 && sameDestination(actualNext, path), scenario + ': login preserves ' + path);
  check(fixture.requests.slice(readStart).every(row => row.path === '/consumer/session'), scenario + ': no private reads on ' + path);
  await page.evaluate(() => Promise.all(window.__destinationDeliveries));
 } finally {
  await context.close();
 }
}
async function availability(path,marker,scenario,width,theme,readyText,emptyText){
 const{context,page}=await open(width,theme,scenario),name=marker+'-'+scenario+'-'+width+'-'+theme;
 try{
  await page.goto(origin+path,{waitUntil:'domcontentloaded'});const notice=page.getByTestId(marker);await notice.waitFor();check(!(await page.locator('main').innerText()).includes(emptyText),name+': unavailable never asserts empty');
  await assess(page,`[data-testid="${marker}"]`,name,width,theme);const button=notice.getByRole('button',{name:'Reintentar carga',exact:true});check(await button.evaluate(node=>node.getBoundingClientRect().height>=44),name+': retry touch target');
  await setScenario(context,'ready');await button.click();await notice.waitFor({state:'detached',timeout:12000});check((await page.locator('main').innerText()).includes(readyText),name+': successful retry restores reported source');check(page.url()===origin+path,name+': source retry keeps route and query');await page.evaluate(()=>Promise.all(window.__destinationDeliveries));
 }finally{await context.close();}
}
async function ratingGeometry(page,name,sameRow=true){
 const group=page.getByTestId('verified-experience-form').getByRole('radiogroup',{name:'Puntaje',exact:true});
 const boxes=await group.locator('label').evaluateAll(labels=>labels.map(label=>{const r=label.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,width:r.width,height:r.height};}));
 check(boxes.length===5&&await group.getByRole('radio').count()===5,name+': five score labels and radios');
 check(boxes.every(r=>r.width>=44&&r.height>=44),name+': every score touch target is at least 44 by 44');
 if(sameRow)check(boxes.every(r=>Math.abs(r.top-boxes[0].top)<=1),name+': all five stars share one row');
 check(boxes.every(r=>r.left>=-1&&r.right<=page.viewportSize().width+1),name+': score targets stay within horizontal viewport');
 return group;
}
async function ratingKeyboard(page,name){
 const group=page.getByTestId('verified-experience-form').getByRole('radiogroup',{name:'Puntaje',exact:true}),five=group.getByRole('radio',{name:'5 estrellas',exact:true}),four=group.getByRole('radio',{name:'4 estrellas',exact:true});
 await five.focus();check(await five.evaluate(node=>{const label=node.closest('label'),style=getComputedStyle(label);return document.activeElement===node&&style.outlineStyle!=='none'&&parseFloat(style.outlineWidth)>=2;}),name+': focused score has a visible outline');
 await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>document.querySelector('input[name="experience-rating"][value="4"]')?.checked,{},{timeout:12000});check(await four.isChecked()&&await four.evaluate(node=>node===document.activeElement),name+': Left arrow selects and focuses four stars');
 await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('input[name="experience-rating"][value="5"]')?.checked,{},{timeout:12000});check(await five.isChecked()&&await five.evaluate(node=>node===document.activeElement),name+': Right arrow restores and focuses five stars');
}
async function portalZoomReflow(page,name,requireSingleLine=false){
 const geometry=await page.evaluate(()=>{
  const box=e=>e?.getBoundingClientRect(),visible=e=>{if(!e)return false;const s=getComputedStyle(e),r=box(e);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&r.width>0&&r.height>0;};
  const logo=document.querySelector('header [class*="brandArea"] a'),controls=document.querySelector('[aria-label="Apariencia y sesión"]'),a=box(logo),b=box(controls);
  const items=[...(document.querySelector('nav.consumer-bottom-nav > div')?.children??[])],names=['Inicio','Productos','Historial','Beneficios','Más'];
  const labels=items.map((item,index)=>{
   const label=item.querySelector(':scope > span:first-of-type'),r=box(item);
   if(!label||!visible(label)||label.textContent.trim()!==names[index])return{within:false,touch:false,singleLine:false};
   const range=document.createRange();range.selectNodeContents(label);
   const rects=[...range.getClientRects()].filter(x=>x.width>0&&x.height>0);range.detach();
   return{
    within:rects.length>0&&rects.every(x=>x.left>=r.left-1&&x.right<=r.right+1&&x.top>=r.top-1&&x.bottom<=r.bottom+1),
    touch:r.width>=44&&r.height>=44,
    singleLine:new Set(rects.map(rect=>Math.round(rect.top))).size===1,
   };
  });
  return{visible:visible(logo)&&visible(controls),separate:Boolean(a&&b&&(a.right<=b.left+1||b.right<=a.left+1||a.bottom<=b.top+1||b.bottom<=a.top+1)),labels:labels.length===5&&labels.every(x=>x.within),touch:labels.length===5&&labels.every(x=>x.touch),singleLine:labels.length===5&&labels.every(x=>x.singleLine)};
 });
 check(geometry.visible,name+': logo and account controls remain visible');
 check(geometry.separate,name+': logo and account controls do not overlap');
 check(geometry.labels,name+': five visible navigation labels stay within their own items');
 check(geometry.touch,name+': navigation touch targets remain at least 44 by 44');
 if(requireSingleLine)check(geometry.singleLine,name+': each navigation label remains on one line within its control');
}
async function ratingZoomReflow(page,name,width,theme){
 try{
  await page.evaluate(()=>{document.documentElement.style.zoom='2';});check(await page.evaluate(()=>getComputedStyle(document.documentElement).zoom)==='2',name+': declared 200 percent CSS zoom applied');
  const group=await ratingGeometry(page,name+'-zoom200',false),rows=await group.locator('label').evaluateAll(labels=>new Set(labels.map(label=>Math.round(label.getBoundingClientRect().top))).size);
  check(rows>=1&&rows<=5,name+': zoom reflow keeps every score reachable without forcing one row');await ratingKeyboard(page,name+'-zoom200');
  await portalZoomReflow(page,name+'-zoom200');
  await assess(page,'[data-testid="consumer-experiences"]',name+'-zoom200',width,theme);
 }finally{await page.evaluate(()=>{document.documentElement.style.zoom='';});}
}
const experiencePath='/me/experiences?tenant=other-brand&eventId=900001&product=Producto%20de%20URL%20B';
async function experienceContext(width,theme,scenario){
 const{context,page}=await open(width,theme,scenario),name='experiences-'+scenario+'-'+width+'-'+theme,start=fixture.requests.length,mockStart=report.experienceMockPosts.length;
 report.cases.push({name,path:experiencePath,scenario,width,theme,syntheticOnly:true});
 try{
  const response=await page.goto(origin+experiencePath,{waitUntil:'domcontentloaded'}),form=page.getByTestId('verified-experience-form');await form.waitFor({timeout:12000});
  const digests=extractInitialDocumentDigests(await response.text());check(digests.templateDigests.length===0&&digests.streamedSuspenseDigests.length===0&&digests.rscErrorDigests.length===0,name+': no streamed server/RSC error digest');
  check(await page.getByTestId('consumer-portal-error').count()===0,name+': expected reading failure avoids exception boundary');
  check(page.url()===origin+experiencePath,name+': conflicting URL retained without changing attribution');
  const reads=fixture.requests.slice(start),ownReads=reads.filter(row=>row.path==='/consumer/taps/900001');
  check(ownReads.length===1&&ownReads[0].query===''&&reads.every(row=>row.method==='GET'),name+': exactly one own reading GET without URL tenant');
  await ratingGeometry(page,name);await ratingKeyboard(page,name);
  const nav=page.getByRole('navigation',{name:'Seguir explorando'}),catalog=nav.getByRole('link',{name:/^Catálogo/}),rewards=nav.getByRole('link',{name:/^Beneficios/});
  if(scenario==='experience-context-ready'){
   check(await form.getByText('Producto local QA',{exact:true}).count()===1&&await form.getByText('Marca: Marca local QA',{exact:true}).count()===1,name+': own reading A supplies product and reported company');
   check(await catalog.getAttribute('href')==='/me/marketplace?tenant=loading-qa'&&await rewards.getAttribute('href')==='/me/rewards?tenant=loading-qa',name+': destinations use own reading A');
  }else{
   check(await form.getByText('Producto por confirmar',{exact:true}).count()===1&&await form.getByText('Marca por confirmar',{exact:true}).count()===1,name+': unavailable or mismatched reading is not attributed');
   check(await page.getByRole('status').filter({hasText:'No pudimos consultar esta lectura en tu cuenta. La marca y el producto están por confirmar.'}).count()===1,name+': accessible unconfirmed context notice');
   check(await catalog.getAttribute('href')==='/me/marketplace'&&await rewards.getAttribute('href')==='/me/rewards',name+': unconfirmed context uses general destinations');
  }
  check(!(await form.innerText()).includes('Marca distinta QA')&&!(await form.innerText()).includes('Producto de URL B')&&!(await form.innerText()).includes('Producto ajeno QA'),name+': URL B and mismatched product never label composer');
  check(await form.getByRole('alert').count()===0,name+': reading context is status, not submission error');
  const title=form.getByRole('textbox',{name:'Titulo corto',exact:true});await title.focus();check(await title.evaluate(node=>node===document.activeElement),name+': labeled draft input receives keyboard focus');await page.keyboard.press('Tab');check(await form.evaluate(node=>node.contains(document.activeElement)),name+': keyboard advances within form');
  check(report.experienceMockPosts.length===mockStart,name+': loading and keyboard navigation do not submit');
  await assess(page,'[data-testid="consumer-experiences"]',name,width,theme);if(scenario==='experience-context-ready')await ratingZoomReflow(page,name,width,theme);await page.evaluate(()=>Promise.all(window.__destinationDeliveries));
 }finally{await context.close();}
}
async function experienceRejected(width,theme,status){
 const{context,page}=await open(width,theme,'experience-context-ready',status),name='experiences-post-'+status+'-'+width+'-'+theme,mockStart=report.experienceMockPosts.length,consoleStart=report.expectedSyntheticHttpErrors.length;
 const titleValue='Borrador local QA',bodyValue='Comentario local QA que se conserva.',photoValue='https://example.invalid/experiencia-local-qa.jpg';
 const error=status===404?'verified_evidence_not_found':'review_blocked_by_risk_policy',copy=status===404?'No encontramos ese tap dentro de tu cuenta. Volve al producto y toca Dejar experiencia.':'Este producto tiene una alerta de riesgo. La marca debe revisarlo antes de aceptar experiencias.';
 let release;const gate=new Promise(resolve=>{release=resolve;});const endpoint=url=>url.origin===origin&&url.pathname==='/api/consumer/experiences';
 report.cases.push({name,path:experiencePath,scenario:'experience-context-ready',width,theme,httpStatus:status,syntheticOnly:true});
 await page.route(endpoint,async route=>{
  const request=route.request();if(request.method()!=='POST')return route.fallback();
  const payload=request.postDataJSON();check(payload&&typeof payload==='object'&&!Array.isArray(payload)&&JSON.stringify(Object.keys(payload).sort())===JSON.stringify(['body','eventId','locale','photoUrls','rating','title']),name+': explicit payload preserves authoritative event-only contract');
  check(payload.eventId==='900001'&&payload.rating===4&&payload.title===titleValue&&payload.body===bodyValue&&typeof payload.locale==='string'&&JSON.stringify(payload.photoUrls)===JSON.stringify([photoValue]),name+': synthetic payload keeps draft and selected score, never URL brand/product');
  report.experienceMockPosts.push({path:'/api/consumer/experiences',status,syntheticOnly:true});await gate;
  await route.fulfill({status,contentType:'application/json',headers:{'cache-control':'no-store'},body:JSON.stringify({ok:false,error})});
 });
 try{
  await page.goto(origin+experiencePath,{waitUntil:'domcontentloaded'});const form=page.getByTestId('verified-experience-form');await form.waitFor({timeout:12000});
  const title=form.getByRole('textbox',{name:'Titulo corto',exact:true}),body=form.getByRole('textbox',{name:'Comentario',exact:true}),photo=form.getByRole('textbox',{name:'Link de la foto (opcional)',exact:true}),rating=form.getByRole('radio',{name:'4 estrellas',exact:true});
  await ratingGeometry(page,name);
  await rating.focus();await page.keyboard.press('Space');check(await rating.isChecked(),name+': score can be selected by keyboard');await title.fill(titleValue);await body.fill(bodyValue);await photo.fill(photoValue);
  const submit=form.getByRole('button',{name:'Enviar experiencia',exact:true});check(await submit.isEnabled(),name+': valid draft enables explicit submit');check(await submit.evaluate(node=>node.getBoundingClientRect().height>=44),name+': submit touch target');
  check(report.experienceMockPosts.length===mockStart,name+': filling draft does not submit');await submit.focus();check(await submit.evaluate(node=>node===document.activeElement),name+': keyboard submit is focused');
  const started=page.waitForRequest(request=>endpoint(new URL(request.url()))&&request.method()==='POST',{timeout:12000});await Promise.all([started,submit.press('Enter',{timeout:12000})]);
  const pending=form.getByRole('button',{name:'Enviando experiencia…',exact:true});await pending.waitFor({timeout:12000});check(await pending.isDisabled()&&await form.locator('form').getAttribute('aria-busy')==='true',name+': pending submit is disabled and announced');
  check(await form.getByRole('radio').evaluateAll(radios=>radios.length===5&&radios.every(radio=>radio.disabled||radio.matches(':disabled'))),name+': pending fieldset disables all five score controls');await ratingGeometry(page,name+'-pending');
  await page.keyboard.press('Enter');check(report.experienceMockPosts.length===mockStart+1,name+': pending Enter does not duplicate request');release();
  const alert=form.getByRole('alert');await alert.waitFor({timeout:12000});check((await alert.innerText()).includes(copy),name+': explicit HTTP '+status+' retains authoritative error');
  check(await title.inputValue()===titleValue&&await body.inputValue()===bodyValue&&await photo.inputValue()===photoValue&&await rating.isChecked(),name+': failed submit preserves title, comment, photo and score');
  check(await submit.isEnabled()&&await form.locator('form').getAttribute('aria-busy')==='false',name+': retry remains available only as an explicit action');
  const recovery=alert.getByRole('link',{name:'Consultar mis experiencias',exact:true});check(await recovery.getAttribute('href')==='/me/experiences',name+': failure keeps general recovery destination');
  await recovery.focus();check(await recovery.evaluate(node=>node===document.activeElement),name+': recovery link is keyboard reachable');
  await page.waitForTimeout(150);check(report.experienceMockPosts.length===mockStart+1,name+': no automatic rePOST within bounded observation');
  check(report.expectedSyntheticHttpErrors.length-consoleStart<=1,name+': at most one exact mocked HTTP resource error');check(page.url()===origin+experiencePath,name+': error keeps current route and draft');
  await assess(page,'[data-testid="consumer-experiences"]',name,width,theme);await page.evaluate(()=>Promise.all(window.__destinationDeliveries));
 }finally{release();await context.close();}
}
async function securityNavigation(width,theme){
 const{context,page}=await open(width,theme,'ready'),name='security-navigation-'+width+'-'+theme;
 const originalFont={value:'',priority:''};
 const geometry=async phase=>{
  await page.evaluate(()=>document.fonts.ready.then(()=>undefined));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const measured=await page.evaluate(()=>{
   const header=document.querySelector('.consumer-portal-root > header'),main=document.querySelector('#consumer-portal-content'),heading=main?.querySelector('h1'),root=header?.closest('.consumer-portal-root'),dock=root?.querySelector('nav.consumer-bottom-nav');
   if(!header||!main||!heading||!root||!dock)throw Error('Owned portal heading or navigation unavailable');
   const box=element=>{const r=element.getBoundingClientRect();return{top:r.top,bottom:r.bottom,height:r.height,left:r.left,right:r.right};};
   const headerPosition=getComputedStyle(header).position,dockPosition=getComputedStyle(dock).position;
   return{header:box(header),dock:box(dock),headerPosition,dockPosition,desktop:matchMedia('(min-width: 64rem)').matches,main:box(main),heading:box(heading),innerWidth,clientWidth:document.documentElement.clientWidth,innerHeight,scrollY,mainFocused:document.activeElement===main,headerOffset:root.style.getPropertyValue('--portal-header-block-size'),scrollMargin:getComputedStyle(main).scrollMarginBlockStart};
  });
  const visibleTop=Math.max(0,measured.header.bottom);
  const visibleBottom=measured.dockPosition==='fixed'?Math.min(measured.innerHeight,measured.dock.top):measured.innerHeight;
  report.securityNavigation??=[];report.securityNavigation.push({width,theme,phase,...measured,visibleTop,visibleBottom});
  check(measured.headerPosition===(measured.desktop?'sticky':'static')&&measured.dockPosition===(measured.desktop?'static':'fixed'),name+'/'+phase+': persistent navigation matches the viewport layout');
  check(measured.heading.top>=visibleTop-1&&measured.heading.bottom<=visibleBottom+1&&measured.heading.left>=-1&&measured.heading.right<=measured.clientWidth+1,name+'/'+phase+': complete account heading stays in the visible area between header and navigation');
  if(phase!=='next-link')check(measured.mainFocused,name+'/'+phase+': skip link moves keyboard focus to main content');
 };
 try{
  await page.goto(origin+'/me/products',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Más',exact:true}).click();
  await page.getByRole('dialog',{name:'Más opciones',exact:true}).locator('a[href="/me/security"]').click();
  await page.waitForURL(url=>url.pathname==='/me/security');
  await page.getByRole('heading',{name:'Seguridad de tu cuenta',exact:true}).waitFor();
  await geometry('next-link');
  const access=page.getByRole('region',{name:'Tus medios de acceso',exact:true}),support=page.getByRole('region',{name:'Contactar a NexID',exact:true});
  check(await access.getByText('Tu email',{exact:true}).count()===1&&await access.getByText('Tu WhatsApp',{exact:true}).count()===1,name+': access labels explicitly describe personal details');
  check(await support.getByRole('link').count()===3&&await support.getByRole('link',{name:'info@nexid.lat',exact:true}).getAttribute('href')==='mailto:info@nexid.lat',name+': corporate contact is a separate region with primary public email');
  check(await support.getByRole('link').evaluateAll(nodes=>nodes.every(node=>node.getBoundingClientRect().height>=44)),name+': corporate contacts have44px targets');
  check(await support.locator('a[href="https://api.whatsapp.com/send?phone=5492613168608"]').count()===1&&await support.locator('a[href="https://api.whatsapp.com/send?phone=56988689095"]').count()===1,name+': published country contacts retained without opening external chats');
  await page.getByRole('link',{name:'Ir al contenido',exact:true}).focus();await page.keyboard.press('Enter');
  await geometry('main-anchor');
  const font=await page.evaluate(()=>({value:document.documentElement.style.getPropertyValue('font-size'),priority:document.documentElement.style.getPropertyPriority('font-size')}));Object.assign(originalFont,font);
  await page.evaluate(()=>document.documentElement.style.setProperty('font-size','200%'));
  await page.waitForFunction(()=>{const header=document.querySelector('.consumer-portal-root > header'),root=header?.closest('.consumer-portal-root');return header&&root&&Math.abs(parseFloat(root.style.getPropertyValue('--portal-header-block-size'))-Math.ceil(header.getBoundingClientRect().height))<=1;});
  await page.getByRole('link',{name:'Ir al contenido',exact:true}).focus();await page.keyboard.press('Enter');
  await geometry('large-text-main-anchor');
  if(width===320)await portalZoomReflow(page,name+'-text200',true);
  await page.evaluate(font=>{if(font.value)document.documentElement.style.setProperty('font-size',font.value,font.priority);else document.documentElement.style.removeProperty('font-size');},originalFont);
  await assess(page,'#consumer-portal-content',name,width,theme);
  await page.evaluate(()=>Promise.all(window.__destinationDeliveries));
 }finally{
  await page.evaluate(font=>{if(font.value)document.documentElement.style.setProperty('font-size',font.value,font.priority);else document.documentElement.style.removeProperty('font-size');},originalFont).catch(()=>{});
  await context.close();
 }
}
try{
 verifyDestinationComparison();
 let ready=false;for(let i=0;i<120;i++){if(serverFailed||next.exitCode!==null)break;try{if((await fetch(origin+'/release.json',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
 check(ready,'isolated production Next ready');browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 for(const width of [320,1280])for(const theme of ['light','dark'])await securityNavigation(width,theme);
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
 for(const width of [320,390])for(const theme of ['light','dark']){for(const scenario of ['experience-context-ready','experience-context-unavailable','experience-context-mismatched'])await experienceContext(width,theme,scenario);for(const status of [404,403])await experienceRejected(width,theme,status);}
 check(report.experienceMockPosts.length===8&&report.experienceMockPosts.every(row=>row.path==='/api/consumer/experiences'&&[404,403].includes(row.status)&&row.syntheticOnly===true),'exactly eight explicit synthetic experience POSTs, none forwarded');
 check(fixture.requests.every(row=>row.method==='GET'),'fixture received only GET reads');check(fixture.requests.filter(row=>row.scenario==='public-read-only').every(row=>row.cookieForwarded===false&&row.authorizationForwarded===false),'public reads forward no session cookies or authorization');check(report.blockedWrites.length===0,'no authentication/business writes attempted');check(report.geolocationCalls===0,'zero GPS calls');check(report.externalRequests.length===0,'zero external browser requests');check(report.clientErrors.length===0,'zero client exceptions');check(report.nativeWindowErrors.length===0,'zero native window exceptions');check(report.consoleErrors.length===0,'zero unexpected browser console errors');report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack);const page=browser?.contexts().at(-1)?.pages().at(-1);if(page)await page.screenshot({path:join(output,'failure.png'),fullPage:true}).catch(()=>{});throw error;
}finally{
 report.fixtureReads=fixture.requests;report.helperHashesEnd=await hashes();report.helpersUnchanged=JSON.stringify(report.helperHashesStart)===JSON.stringify(report.helperHashesEnd);check(report.helpersUnchanged,'helpers unchanged during execution');await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:report.checks.length,views:report.views.length,cases:report.cases.length,clientErrors:report.clientErrors.length,nativeWindowErrors:report.nativeWindowErrors.length,consoleErrors:report.consoleErrors.length,blockedWrites:report.blockedWrites.length,geolocationCalls:report.geolocationCalls,output}));await browser?.close();if(next.exitCode===null){next.kill();await Promise.race([new Promise(resolve=>next.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,1500))]);}await fixture.close();
}
