// Actual production Next passport/router; API/session responses are synthetic.
// Root executes only after the final clean commit and source-bound cold build.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,readdir,writeFile} from 'node:fs/promises';
import {join,relative,resolve,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const web=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(web,'../..');
assert.equal(process.env.QA_SUN_ACCOUNT_AUTHORIZED,'1','Explicit bounded local SUN account QA authorization required');
assert.match(process.env.QA_SOURCE||'',/^[a-f0-9]{40}$/,'Committed QA_SOURCE required');
assert.ok(!process.env.QA_BASE_URL,'QA must own its isolated loopback Next server');
const systemEnv=Object.fromEntries(Object.entries(process.env).filter(([key,value])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(key)&&typeof value==='string'));
const digest=value=>createHash('sha256').update(value).digest('hex');
const git=args=>execFileSync('git',args,{cwd:repo,env:systemEnv,encoding:'utf8',windowsHide:true,timeout:10000}).trim();
async function files(root){const rows=[];for(const entry of await readdir(root,{withFileTypes:true})){assert.ok(!entry.isSymbolicLink(),'Compiled QA inputs cannot be symlinks');const path=join(root,entry.name);if(entry.isDirectory())rows.push(...await files(path));else if(entry.isFile())rows.push(path);}return rows;}
async function binding(){
 const observedSource=git(['rev-parse','HEAD']),observedTree=git(['rev-parse','HEAD^{tree}']),sourceWorktreeClean=git(['status','--porcelain'])==='';
 assert.equal(observedSource,process.env.QA_SOURCE);assert.ok(sourceWorktreeClean,'Source-bound QA requires a clean worktree');
 const paths=git(['ls-files','-z']).split('\0').filter(Boolean).sort();
 const sourceRows=await Promise.all(paths.map(async path=>({path,sha256:digest(await readFile(join(repo,path)))})));
 const compiled=[join(web,'.next/BUILD_ID'),...['sun','me','login'].map(route=>join(web,`.next/server/app/${route}/page.js`)),...(await files(join(web,'.next/static'))).filter(path=>/\.(js|css)$/.test(path))].sort();
 const hashes=Object.fromEntries(await Promise.all(compiled.map(async path=>{const key=relative(repo,path).split(sep).join('/');assert.ok(key.startsWith('apps/web/.next/')&&!key.includes('../'));return[key,digest(await readFile(path))];})));
 return{qaSource:process.env.QA_SOURCE,observedSource,observedTree,sourceWorktreeClean,sourceClaimBound:true,buildId:(await readFile(join(web,'.next/BUILD_ID'),'utf8')).trim(),sourceRows,sourceManifestSha256:digest(JSON.stringify(sourceRows)),hashes};
}
const outputParent=resolve(process.env.QA_OUTPUT||join(repo,'artifacts/tap-access-simplification-20261006/sun-account'));
assert.ok(outputParent.startsWith(repo+sep),'Fresh outputs must stay inside the owned worktree');
await mkdir(outputParent,{recursive:true});const output=await mkdtemp(join(outputParent,'run-'));
const report={schemaVersion:'nexid.sun-account-access-next-qa/v1',status:'failed',localOnly:true,realProductionBuild:true,actualNextRouter:true,syntheticSunContract:true,syntheticConsumerAccount:true,realAuthenticationCertified:false,otpDeliveryCertified:false,physicalTapMeasured:false,customerWrites:0,providerMutations:0,checks:[],frames:[],views:[],errors:[],blockedWrites:[],blockedExternal:[],geolocationCalls:0};
const check=(value,name)=>{report.checks.push({name,passed:Boolean(value)});assert.ok(value,name);};
const snapshotFixture=join(web,'tests/sun-mobile-local-fetch.mjs');
const preload=join(output,'local-fetch.mjs');
// The existing SUN fixture alone supplies the snapshot. Only explicit local
// consumer GETs are added. No capability, account enrollment or business POST.
const preloadSource=`import ${JSON.stringify(pathToFileURL(snapshotFixture).href)};
const snapshotFetch=globalThis.fetch;
globalThis.fetch=async function(input,init){
 const url=new URL(input instanceof Request?input.url:String(input));
 const method=init?.method||(input instanceof Request?input.method:'GET');
 if(url.hostname==='api.nexid.lat'&&url.pathname.startsWith('/consumer/')){
  if(!['GET','HEAD'].includes(method))throw Error('sun_account_business_write_blocked');
  const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));
  const authenticated=(headers.get('cookie')||'').split(';').some(value=>value.trim()==='sun_account_qa=local');
  const reply=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
  if(url.pathname==='/consumer/session')return reply({ok:true,authenticated});
  if(!authenticated)throw Error('sun_account_private_read_before_session');
  if(url.pathname==='/consumer/me')return reply({ok:true,consumer:{id:'synthetic-sun-account',display_name:'Cuenta sintética SUN',status:'verified'},stats:{products:0,taps:0}});
  if(['/consumer/products','/consumer/taps','/consumer/brands'].includes(url.pathname))return reply({ok:true,items:[]});
  throw Error('sun_account_unknown_private_read');
 }
 return snapshotFetch(input,init);
};
`;
await writeFile(preload,preloadSource,{flag:'wx'});
report.helperHashesBefore={browser:digest(await readFile(fileURLToPath(import.meta.url))),snapshotFixture:digest(await readFile(snapshotFixture)),preload:digest(preloadSource)};
const axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
const photo='<svg xmlns="http://www.w3.org/2000/svg" width="320" height="480" viewBox="0 0 320 480"><rect width="320" height="480" fill="#faf7ed"/><rect x="105" y="60" width="110" height="355" rx="24" fill="#233c32"/><text x="160" y="230" text-anchor="middle" fill="white">ENSAYO SUN</text></svg>';
let browser=null,next=null,base='',serverFailed=false;const contexts=new Set(),pending=new Set();
let cleanupStage=null;
function exceptionCategory(error){
 try{
  const name=Object.getOwnPropertyDescriptor(error,'name')?.value,code=Object.getOwnPropertyDescriptor(error,'code')?.value;
  if(code==='ERR_ASSERTION')return'assertion';
  if(name==='TimeoutError')return'timeout';
  if(name==='Error')return'error';
  return'unknown';
 }catch{return'unreadable';}
}
function track(promise){pending.add(promise);return promise.finally(()=>pending.delete(promise));}
async function drain(){await Promise.race([Promise.allSettled([...pending]),new Promise(done=>setTimeout(done,10000))]);assert.equal(pending.size,0,'All guarded routes finish before context teardown');}
const frames=['es-AR','en','pt-BR'].flatMap(locale=>['light','dark'].flatMap(theme=>[320,390,768,1440].flatMap(width=>['snapshot','demo'].map(mode=>({locale,theme,width,mode})))));
try{
 report.entryBindingBefore=await binding();
 const reserve=createServer();await new Promise(done=>reserve.listen(0,'127.0.0.1',done));const port=reserve.address().port;await new Promise(done=>reserve.close(done));base=`http://127.0.0.1:${port}`;
 next=spawn(process.execPath,['--import',pathToFileURL(preload).href,join(repo,'node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:web,env:{...systemEnv,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
 next.stdout.on('data',()=>{});next.stderr.on('data',()=>{});next.on('error',()=>{serverFailed=true;});
 let ready=false;for(let attempt=0;attempt<120;attempt++){if(serverFailed||next.exitCode!==null)break;try{const response=await fetch(base+'/release.json',{signal:AbortSignal.timeout(1000),credentials:'omit',redirect:'manual'});if(response.ok){ready=true;break;}}catch{}await new Promise(done=>setTimeout(done,250));}check(ready,'Own loopback production server is ready');
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright-core');browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 for(const entry of frames){
  const name=`${entry.mode}-${entry.width}-${entry.theme}-${entry.locale}`,frame={...entry,name};report.frames.push(frame);
  const context=await browser.newContext({viewport:{width:entry.width,height:844},locale:entry.locale,reducedMotion:'reduce',serviceWorkers:'block'});contexts.add(context);
  await context.addCookies([{name:'theme',value:entry.theme,url:base},{name:'nexid_theme_version',value:'white-first-v2',url:base},{name:'locale',value:entry.locale,url:base}]);
  await context.exposeBinding('__sunAccountGeo',()=>{report.geolocationCalls++;});
  await context.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){void window.__sunAccountGeo();throw Error('qa_location_blocked');},watchPosition(){void window.__sunAccountGeo();throw Error('qa_location_blocked');}}});});
  let closing=false;
  await context.route('**/*',route=>track((async()=>{try{
   const request=route.request(),url=new URL(request.url());
   if(!['GET','HEAD'].includes(request.method())){report.blockedWrites.push({method:request.method(),path:url.pathname});return route.abort();}
   if(url.origin!==base){report.blockedExternal.push({category:'external_origin',method:request.method()});return route.abort();}
   if(closing)return route.abort();
   if(url.pathname==='/qa-product.svg')return route.fulfill({status:200,contentType:'image/svg+xml',body:photo});
   if(url.pathname==='/api/product-notices/v2'&&url.searchParams.get('tenant')==='qa'&&url.searchParams.get('bid')==='synthetic-only')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,protocol:'nexid.product-notices.v2',scope:{tenant:'qa',bid:'synthetic-only'},observedAt:'2026-10-06T12:00:00Z',notices:[],total:0,hasMore:false,doesNotDetermineNfcAuthenticity:true,closureDoesNotReleaseProduct:true,liftingNoticeDoesNotReleaseProduct:true})});
   if(url.pathname.startsWith('/api/'))throw Error('qa_unexpected_client_api');
   return await route.continue();
  }catch{report.errors.push({view:name,reason:'route_failed'});try{await route.abort();}catch{report.errors.push({view:name,reason:'route_abort_failed'});}}
  })()));
  const page=await context.newPage();page.setDefaultTimeout(10000);
  page.on('pageerror',()=>report.errors.push({view:name,reason:'page_error'}));page.on('console',event=>{if(event.type()==='error')report.errors.push({view:name,reason:'console_error'});});
  const path=entry.mode==='demo'?`/sun?demo=1&lang=${entry.locale}`:`/sun?snapshot=qa-closed&trace=synthetic&access=invalid&lang=${entry.locale}`;
  await page.goto(base+path,{waitUntil:'networkidle',timeout:90000});
  const header=page.getByTestId('sun-passport-header'),account=page.getByTestId('sun-account-link');await header.waitFor();
  await page.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0);});
  const label={'es-AR':'Mi cuenta',en:'My account','pt-BR':'Minha conta'}[entry.locale];
  check(await account.getAttribute('href')==='/me'&&await account.innerText()===label,`${name}: explicit localized /me access without TAP context`);
  const geometry=await header.evaluate(element=>{const account=element.querySelector('[data-testid="sun-account-link"]'),rect=account.getBoundingClientRect(),hit=document.elementFromPoint((rect.left+rect.right)/2,(rect.top+rect.bottom)/2);return{width:rect.width,height:rect.height,withinViewport:rect.left>=0&&rect.right<=innerWidth&&rect.top>=0&&rect.bottom<=innerHeight,unobstructed:hit===account||account.contains(hit),overflow:document.documentElement.scrollWidth>innerWidth+1,targets:[...element.querySelectorAll('a,button,select')].filter(target=>target.getClientRects().length).map(target=>{const b=target.getBoundingClientRect();return{width:b.width,height:b.height,left:b.left,right:b.right};})};});
  check(geometry.width>=44&&geometry.height>=44&&geometry.withinViewport&&geometry.unobstructed,`${name}: account link is a visible unobstructed 44px target`);
  check(!geometry.overflow&&geometry.targets.every(target=>target.width>=44&&target.height>=44&&target.left>=0&&target.right<=entry.width),`${name}: header controls stay touch-safe without overflow`);
  await account.focus();check(await account.evaluate(element=>element.matches(':focus-visible')&&parseFloat(getComputedStyle(element).outlineWidth)>=2),`${name}: account link has visible keyboard focus`);
  await page.addScriptTag({content:axe});const violations=await page.evaluate(async()=> (await axe.run('[data-testid="sun-passport-header"]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(item=>({id:item.id,impact:item.impact,targets:item.nodes.map(node=>node.target)})));check(violations.length===0,`${name}: zero scoped accessibility violations`);
  if(entry.mode==='snapshot'){
   check(await page.getByTestId('consumer-passport-primary').count()===1,`${name}: contextual products action is preserved`);
   const primary=page.getByTestId('sun-summary-primary');check(await primary.count()===1&&await primary.evaluate(element=>{const b=element.getBoundingClientRect();return b.width>=44&&b.height>=44&&b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight;}),`${name}: reading primary action remains visible in the first viewport`);
  }else check(await page.getByTestId('consumer-passport-primary').count()===0,`${name}: demo does not invent a reading handoff`);
  report.views.push({...entry,name,geometry,violations});
  if(entry.width===390&&entry.locale==='es-AR'){await account.evaluate(element=>element.blur());await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:join(output,`${name}.png`),fullPage:false});}
  // Anonymous account navigation is an ordinary /me GET. Next enforces the
  // existing consumer continuation; no OTP request, save or association here.
  await account.focus();await account.press('Enter');await page.waitForURL(url=>url.pathname==='/login',{timeout:15000});
  const login=new URL(page.url());check(login.searchParams.get('consumer')==='1'&&login.searchParams.get('next')==='/me'&&!login.searchParams.has('tap'),`${name}: anonymous /me reaches consumer login with exact account continuation`);
  await context.addCookies([{name:'sun_account_qa',value:'local',url:base,httpOnly:true,sameSite:'Lax'}]);
  await page.goto(base+path,{waitUntil:'networkidle'});await page.getByTestId('sun-account-link').click();await page.waitForURL(url=>url.pathname==='/me'&&url.search==='');await page.locator('#consumer-portal-content').waitFor();
  check((await page.locator('#consumer-portal-content').innerText()).includes('Cuenta sintética SUN'),`${name}: explicit synthetic account opens the actual portal without enrollment`);
  check(report.blockedWrites.length===0&&report.geolocationCalls===0,`${name}: account navigation never performs a write or location request`);
  cleanupStage='drain_before_page_close';await drain();closing=true;
  cleanupStage='page_close';await page.close();
  cleanupStage='drain_after_page_close';await drain();
  cleanupStage='context_close';await context.close();contexts.delete(context);cleanupStage=null;
 }
 check(report.frames.length===48,'All 48 real/demo viewport/theme/locale frames completed');check(report.errors.length===0,'Zero application, route and console errors');check(report.blockedWrites.length===0,'Zero write attempts');check(report.blockedExternal.length===0,'Zero external requests');check(report.geolocationCalls===0,'Zero GPS calls');report.status='passed';
}catch(error){report.status='failed';report.failureReason='bounded_sun_account_qa_failed';report.failureCategory=exceptionCategory(error);if(cleanupStage)report.cleanupFailure={stage:cleanupStage,category:report.failureCategory};}
finally{
 for(const context of contexts)try{await context.close();}catch{report.errors.push({reason:'context_close_failed'});report.status='failed';}
 if(browser)try{await browser.close();}catch{report.errors.push({reason:'browser_close_failed'});report.status='failed';}
 if(next&&next.exitCode===null&&next.signalCode===null){next.kill();await Promise.race([new Promise(done=>next.once('exit',done)),new Promise(done=>setTimeout(done,1500))]);if(next.exitCode===null&&next.signalCode===null){report.errors.push({reason:'local_server_close_failed'});report.status='failed';}}
 try{report.entryBindingAfter=await binding();report.sourceBuildStable=JSON.stringify(report.entryBindingBefore)===JSON.stringify(report.entryBindingAfter);report.helperHashesAfter={browser:digest(await readFile(fileURLToPath(import.meta.url))),snapshotFixture:digest(await readFile(snapshotFixture)),preload:digest(await readFile(preload))};if(!report.sourceBuildStable||JSON.stringify(report.helperHashesBefore)!==JSON.stringify(report.helperHashesAfter))report.status='failed';}catch{report.sourceBuildStable=false;report.status='failed';report.errors.push({reason:'source_binding_failed'});}
 if(report.errors.length)report.status='failed';
 await writeFile(join(output,'report.json'),JSON.stringify(report,null,2),{flag:'wx'});
 console.log(JSON.stringify({status:report.status,checks:report.checks.length,views:report.views.length,frames:report.frames.length,errors:report.errors.length,blockedWrites:report.blockedWrites.length,blockedExternal:report.blockedExternal.length,geolocationCalls:report.geolocationCalls,sourceBuildStable:report.sourceBuildStable,output}));
 if(report.status!=='passed')process.exitCode=1;
}
