// Actual Next production page/router, explicit synthetic local account only.
// Root runs this after committing and completing the source-bound cold build.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,readdir,writeFile} from 'node:fs/promises';
import {join,resolve,relative,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const web=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(web,'../..');
assert.equal(process.env.QA_CONSUMER_BRANDS_AUTHORIZED,'1','Explicit bounded local brands QA authorization required');
assert.match(process.env.QA_SOURCE||'',/^[a-f0-9]{40}$/,'Actual committed QA_SOURCE required');
assert.ok(!process.env.QA_BASE_URL,'This runner must launch its own isolated production Next server');
const systemEnv=Object.fromEntries(Object.entries(process.env).filter(([key,value])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(key)&&typeof value==='string'));
const git=args=>execFileSync('git',args,{cwd:repo,env:systemEnv,encoding:'utf8',windowsHide:true,timeout:10000}).trim();
const digest=body=>createHash('sha256').update(body).digest('hex');
async function files(root){const result=[];for(const item of await readdir(root,{withFileTypes:true})){assert.ok(!item.isSymbolicLink(),'QA compiled inputs cannot be symlinks');const path=join(root,item.name);if(item.isDirectory())result.push(...await files(path));else if(item.isFile())result.push(path);}return result;}
async function binding(){
 const observedSource=git(['rev-parse','HEAD']),observedTree=git(['rev-parse','HEAD^{tree}']),sourceWorktreeClean=git(['status','--porcelain'])==='';
 assert.equal(observedSource,process.env.QA_SOURCE);assert.ok(sourceWorktreeClean,'Exact-source QA requires a clean committed worktree');
 const sourcePaths=git(['ls-files','-z']).split('\0').filter(Boolean).sort();
 const sourceRows=await Promise.all(sourcePaths.map(async path=>({path,sha256:digest(await readFile(join(repo,path)))})));
 const inputs=[join(web,'.next/BUILD_ID'),...['me/brands','me/rewards','me/taps'].map(route=>join(web,`.next/server/app/${route}/page.js`)),...(await files(join(web,'.next/static'))).filter(path=>/\.(?:js|css)$/.test(path))].sort();
 const hashes=Object.fromEntries(await Promise.all(inputs.map(async path=>{const key=relative(repo,path).split(sep).join('/');assert.ok(key.startsWith('apps/web/.next/')&&!key.includes('../'));return[key,digest(await readFile(path))];})));
 return {qaSource:process.env.QA_SOURCE,observedSource,observedTree,sourceWorktreeClean,sourceClaimBound:true,buildId:(await readFile(join(web,'.next/BUILD_ID'),'utf8')).trim(),sourceRows,sourceManifestSha256:digest(JSON.stringify(sourceRows)),hashes};
}
const outputParent=resolve(process.env.QA_OUTPUT||join(repo,'artifacts/consumer-recovery-20261006/brands-next'));
assert.ok(outputParent.startsWith(repo+sep),'Fresh output must remain in this owned workspace');
await mkdir(outputParent,{recursive:true});const output=await mkdtemp(join(outputParent,'run-'));
const report={schemaVersion:'nexid.consumer-brands-next-qa/v1',status:'failed',localOnly:true,realProductionBuild:true,actualNextRouter:true,syntheticConsumerAccount:true,realAuthenticationCertified:false,otpDeliveryCertified:false,physicalTapMeasured:false,customerWrites:0,providerMutations:0,checks:[],views:[],frames:[],errors:[],blockedWrites:[],blockedExternal:[],geolocationCalls:0};
const check=(value,name)=>{report.checks.push({name,passed:Boolean(value)});assert.ok(value,name);};
let browser=null,next=null,base='',serverFailed=false;
const contexts=new Set();
const axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
async function assess(page,width,theme,name){
 await page.addScriptTag({content:axe});
 const violations=await page.evaluate(async()=> (await axe.run('#consumer-portal-content',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(item=>({id:item.id,impact:item.impact,targets:item.nodes.map(node=>node.target)})));
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
 report.views.push({width,theme,name,violations,overflow});check(!overflow,`${width}/${theme}/${name}: no horizontal overflow`);check(violations.length===0,`${width}/${theme}/${name}: zero scoped axe violations`);
 await page.screenshot({path:join(output,`${name}-${width}-${theme}.png`),fullPage:name==='brands-ready'});
}
async function setCase(context,mode){await context.addCookies([{name:'consumer_brands_case',value:mode,url:base,httpOnly:true,sameSite:'Lax'}]);}
async function brandsPage(page,query=''){await page.goto(base+'/me/brands'+query,{waitUntil:'networkidle',timeout:90000});await page.getByRole('heading',{name:'Mis marcas y clubes',exact:true}).waitFor();}
async function targetProof(link){
 await link.evaluate(element=>element.scrollIntoView({block:'center',inline:'nearest'}));await link.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
 return link.evaluate(element=>{const b=element.getBoundingClientRect(),header=document.querySelector('.consumer-portal-root>header').getBoundingClientRect(),nav=document.querySelector('.consumer-bottom-nav'),n=nav?.getBoundingClientRect(),bottom=nav&&getComputedStyle(nav).position==='fixed'?n.top:innerHeight;const x=(b.left+b.right)/2,y=(b.top+b.bottom)/2,hit=document.elementFromPoint(x,y);return{height:b.height,width:b.width,unobstructed:(hit===element||element.contains(hit))&&b.top>=header.bottom&&b.bottom<=bottom&&b.left>=0&&b.right<=innerWidth};});
}
try{
 report.brandsBindingBefore=await binding();
 const reserve=createServer();await new Promise(done=>reserve.listen(0,'127.0.0.1',done));const port=reserve.address().port;await new Promise(done=>reserve.close(done));base=`http://127.0.0.1:${port}`;
 next=spawn(process.execPath,['--import',pathToFileURL(join(web,'tests/consumer-brands-local-fetch.mjs')).href,join(repo,'node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:web,env:{...systemEnv,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',CONSUMER_PORTAL_QA:'1',CONSUMER_BRANDS_QA:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
 next.stdout.on('data',()=>{});next.stderr.on('data',()=>{});next.on('error',()=>{serverFailed=true;});
 let ready=false;for(let attempt=0;attempt<120;attempt++){if(serverFailed||next.exitCode!==null)break;try{if((await fetch(base+'/release.json',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}await new Promise(done=>setTimeout(done,250));}check(ready,'Isolated local production server becomes ready');
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright-core');
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 for(const theme of ['light','dark'])for(const width of [320,390,768,1440]){
  const frame={width,theme,scenarios:[],geometry:[]};report.frames.push(frame);
  const context=await browser.newContext({viewport:{width,height:900},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'});contexts.add(context);
  await context.addCookies([{name:'consumer_qa',value:'local',url:base,httpOnly:true,sameSite:'Lax'},{name:'theme',value:theme,url:base},{name:'nexid_theme_version',value:'white-first-v2',url:base}]);
  await context.exposeBinding('__qaLocationCall',()=>{report.geolocationCalls++;});
  await context.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){void window.__qaLocationCall();throw Error('qa_location_blocked');},watchPosition(){void window.__qaLocationCall();throw Error('qa_location_blocked');}}});});
  await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(!['GET','HEAD'].includes(request.method())){report.blockedWrites.push({method:request.method(),path:url.pathname});return route.abort();}if(url.origin===base||['data:','blob:'].includes(url.protocol))return route.continue();report.blockedExternal.push({method:request.method(),category:'external_origin'});return route.abort();});
  const page=await context.newPage();page.on('pageerror',()=>report.errors.push({width,theme,reason:'page_error'}));page.on('console',event=>{if(event.type()==='error')report.errors.push({width,theme,reason:'console_error'});});
  await setCase(context,'ready');await brandsPage(page);
  const cards=page.getByTestId('consumer-brand-card');check(await cards.count()===3,`${width}/${theme}: three actual reported memberships`);
  const a=cards.filter({has:page.locator('[id="brand-0-title"]')}),b=cards.filter({has:page.locator('[id="brand-1-title"]')}),c=cards.filter({has:page.locator('[id="brand-2-title"]')});
  check((await a.innerText()).includes('Membresía pausada')&&(await b.innerText()).includes('Membresía pendiente'),`${width}/${theme}: paused and pending are not promoted to active`);
  check(await a.locator('header p').filter({hasText:/^41$/}).count()===1&&await b.locator('header p').filter({hasText:/^0$/}).count()===1&&(await c.innerText()).includes('No informado'),`${width}/${theme}: individual balances 41 and zero, absent stays unknown`);
  check(await a.locator('dt').filter({hasText:'Productos del catálogo'}).evaluate(dt=>dt.nextElementSibling.textContent)==='1',`${width}/${theme}: only exact-tenant explicitly active catalog rows count`);
  check(!/Drops|Promos|Mensajes del Viñedo|Progreso|Nivel|Emisor verificado/i.test(await page.locator('#consumer-portal-content').innerText()),`${width}/${theme}: no fabricated feeds, levels or guarantees`);
  for(const [card,slug] of [[a,'brand-a'],[b,'branda'],[c,'brand_c']])for(const [name,path] of [['Ver catálogo de la marca','marketplace'],['Ver puntos y beneficios','rewards'],['Ver lecturas de la marca','taps']]){
   const link=card.getByRole('link',{name,exact:true});check(await link.getAttribute('href')===`/me/${path}?tenant=${slug}`,`${width}/${theme}: ${slug}/${path} preserves canonical tenant`);
   const geometry=await targetProof(link);frame.geometry.push({slug,path,...geometry});check(geometry.height>=44&&geometry.width>=44&&geometry.unobstructed,`${width}/${theme}: ${slug}/${path} is an unobstructed 44px target`);
  }
  await a.getByRole('link',{name:'Ver catálogo de la marca',exact:true}).focus();check(await page.evaluate(()=>document.activeElement.matches(':focus-visible')&&parseFloat(getComputedStyle(document.activeElement).outlineWidth)>=2),`${width}/${theme}: keyboard focus is visible`);
  await assess(page,width,theme,'brands-ready');frame.scenarios.push('reported-memberships-balances-active-catalog');
  await brandsPage(page,'?tenant=branda');check(await cards.count()===1&&await cards.first().getAttribute('data-brand-tenant')==='branda',`${width}/${theme}: exact homonymous tenant filter does not borrow brand-a`);
  await page.getByRole('link',{name:'Todas mis marcas',exact:true}).click();await cards.nth(2).waitFor();check(new URL(page.url()).search===''&&await cards.count()===3,`${width}/${theme}: explicit all-brands link restores complete membership view`);frame.scenarios.push('canonical-filter-and-all');
  for(const query of ['?tenant=foreign','?tenant=brand-a&tenant=branda','?tenant=..%2Fbrand-a']){await brandsPage(page,query);check(await page.getByTestId('consumer-brands-filter-unavailable').count()===1&&await cards.count()===0,`${width}/${theme}: unknown or invalid query never silently widens`);check(await page.getByRole('link',{name:'Ver todas mis marcas',exact:true}).getAttribute('href')==='/me/brands',`${width}/${theme}: invalid scope has an explicit recovery link`);}frame.scenarios.push('invalid-unknown-repeated-filter');
  for(const [mode,notice,absent] of [['products-unavailable','Productos no disponibles para consulta.','No hay productos guardados'],['taps-unavailable','Lecturas no disponibles para consulta.','No hay lecturas guardadas'],['catalog-unavailable','Catálogo no disponible para consulta.','No hay productos publicados']]){
   await setCase(context,mode);await brandsPage(page,'?tenant=brand-a');check(await cards.count()===1&&(await a.innerText()).includes(notice),`${width}/${theme}/${mode}: source-specific failure preserves membership`);check(!(await a.innerText()).includes(absent),`${width}/${theme}/${mode}: unavailable is not successful empty`);check((await a.innerText()).includes('41')&&await a.getByRole('link',{name:'Ver puntos y beneficios',exact:true}).count()===1,`${width}/${theme}/${mode}: available balance and destinations stay usable`);
   if(mode!=='products-unavailable')check((await a.innerText()).includes('Producto guardado brand-a'),`${width}/${theme}/${mode}: available product section remains visible`);
   if(mode!=='taps-unavailable')check((await a.innerText()).includes('Sello cerrado reportado'),`${width}/${theme}/${mode}: available reading remains visible`);
   await assess(page,width,theme,mode);frame.scenarios.push(mode);
  }
  await setCase(context,'brands-unavailable');await brandsPage(page,'?tenant=branda');check(await page.getByTestId('consumer-brands-unavailable').count()===1&&await cards.count()===0,`${width}/${theme}: failed memberships do not fabricate clubs or points`);await assess(page,width,theme,'brands-unavailable');
  await setCase(context,'ready');await page.getByRole('button',{name:'Reintentar carga',exact:true}).click();await cards.first().waitFor();check(new URL(page.url()).searchParams.get('tenant')==='branda'&&await cards.count()===1&&await cards.first().getAttribute('data-brand-tenant')==='branda',`${width}/${theme}: actual router refresh recovers the same tenant filter`);frame.scenarios.push('failed-membership-retry-same-scope');
  await setCase(context,'brands-malformed');await brandsPage(page);check(await page.getByTestId('consumer-brands-unavailable').count()===1&&await cards.count()===0,`${width}/${theme}: malformed memberships cannot establish empty clubs`);frame.scenarios.push('malformed-membership');
  await setCase(context,'empty');await brandsPage(page);check(await page.getByTestId('consumer-brands-empty').count()===1&&await page.getByTestId('consumer-brands-unavailable').count()===0,`${width}/${theme}: confirmed successful empty has its own state`);await assess(page,width,theme,'brands-empty');frame.scenarios.push('successful-empty');
  await setCase(context,'ready');await brandsPage(page,'?tenant=brand_c');await cards.first().getByRole('link',{name:'Ver puntos y beneficios',exact:true}).click();await page.getByRole('heading',{name:'Tus beneficios',exact:true}).waitFor();check(new URL(page.url()).pathname==='/me/rewards'&&new URL(page.url()).searchParams.get('tenant')==='brand_c'&&await page.getByRole('combobox',{name:'Filtrar por marca',exact:true}).inputValue()==='brand_c',`${width}/${theme}: actual benefits destination retains underscore tenant filter`);frame.scenarios.push('benefits-canonical-destination');
  await brandsPage(page,'?tenant=brand-a');await cards.first().getByRole('link',{name:'Ver lecturas de la marca',exact:true}).click();await page.getByRole('heading',{name:'Historial de lecturas',exact:true}).waitFor();check(new URL(page.url()).pathname==='/me/taps'&&new URL(page.url()).searchParams.get('tenant')==='brand-a',`${width}/${theme}: actual history destination retains tenant`);
  const historyFilters=page.getByTestId('history-filter-panel');if(await historyFilters.getAttribute('open')===null)await historyFilters.locator('summary').first().click();
  check(await page.getByRole('combobox',{name:'Empresa',exact:true}).inputValue()==='brand-a',`${width}/${theme}: history filter uses exact requested identity`);frame.scenarios.push('history-canonical-destination');
  await setCase(context,'session-unavailable');await page.goto(base+'/me/brands?tenant=brand-a',{waitUntil:'networkidle'});check(await page.getByTestId('consumer-portal-unavailable').count()===1&&await cards.count()===0,`${width}/${theme}: session uncertainty never opens private memberships`);frame.scenarios.push('session-unavailable');
  await context.close();contexts.delete(context);
 }
 check(report.frames.length===8,'All eight viewport/theme frames completed');check(report.errors.length===0,'Zero application/console errors');check(report.blockedWrites.length===0,'Zero write attempts');check(report.blockedExternal.length===0,'Zero external requests');check(report.geolocationCalls===0,'Zero GPS calls');report.status='passed';
}catch{report.status='failed';report.failureReason='bounded_brands_qa_failed';}
finally{
 for(const context of contexts)try{await context.close();}catch{report.errors.push({reason:'context_close_failed'});report.status='failed';}
 if(browser)try{await browser.close();}catch{report.errors.push({reason:'browser_close_failed'});report.status='failed';}
 if(next&&next.exitCode===null&&next.signalCode===null){next.kill();await Promise.race([new Promise(done=>next.once('exit',done)),new Promise(done=>setTimeout(done,1500))]);if(next.exitCode===null&&next.signalCode===null){report.errors.push({reason:'local_server_close_failed'});report.status='failed';}}
 try{report.brandsBindingAfter=await binding();report.brandsSourceBuildStable=JSON.stringify(report.brandsBindingBefore)===JSON.stringify(report.brandsBindingAfter);if(!report.brandsSourceBuildStable)report.status='failed';}catch{report.brandsSourceBuildStable=false;report.status='failed';report.errors.push({reason:'source_binding_failed'});}
 if(report.errors.length)report.status='failed';
 await writeFile(join(output,'report.json'),JSON.stringify(report,null,2),{flag:'wx'});
 console.log(JSON.stringify({status:report.status,checks:report.checks.length,views:report.views.length,frames:report.frames.length,errors:report.errors.length,blockedWrites:report.blockedWrites.length,blockedExternal:report.blockedExternal.length,geolocationCalls:report.geolocationCalls,brandsSourceBuildStable:report.brandsSourceBuildStable,output}));
 if(report.status!=='passed')process.exitCode=1;
}
