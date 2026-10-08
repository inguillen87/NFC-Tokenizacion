// Actual production Next passport/router; API/session responses are synthetic.
// Root executes only after the final clean commit and source-bound cold build.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,readdir,writeFile,realpath,lstat} from 'node:fs/promises';
import {join,relative,resolve,sep,isAbsolute} from 'node:path';
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
function within(root,path){const child=relative(root,path);return child===''||(!isAbsolute(child)&&child!=='..'&&!child.startsWith('..'+sep));}
const allowedOutputs=[join(repo,'artifacts')];
if(process.env.CI==='true'&&process.env.GITHUB_ACTIONS==='true'&&isAbsolute(process.env.RUNNER_TEMP||''))allowedOutputs.push(resolve(process.env.RUNNER_TEMP,'sun-evidence/sun-account'));
const outputRoot=allowedOutputs.find(root=>within(root,outputParent));
assert.ok(outputRoot,'Outputs require the owned artifacts directory or the exact GitHub runner sun-account subtree');
// Validate every existing ancestor before creating anything; a contained lexical
// path must not redirect through a symlink or junction outside its output root.
let ancestor=outputParent;
while(true){try{const entry=await lstat(ancestor);assert.ok(entry.isDirectory()&&!entry.isSymbolicLink(),'Output ancestors must be real directories');assert.equal(resolve(await realpath(ancestor)),resolve(ancestor),'Output ancestors cannot traverse a symlink');break;}catch(error){if(error.code!=='ENOENT')throw error;const parent=resolve(ancestor,'..');assert.notEqual(parent,ancestor);ancestor=parent;}}
for(let current=ancestor;current!==resolve(current,'..');current=resolve(current,'..')){const entry=await lstat(current);assert.ok(!entry.isSymbolicLink(),'Output ancestors cannot contain a symlink or junction');}
await mkdir(outputParent,{recursive:true});const output=await mkdtemp(join(outputParent,'run-'));
const report={schemaVersion:'nexid.sun-account-access-next-qa/v2',status:'failed',localOnly:true,realProductionBuild:true,actualNextRouter:true,syntheticSunContract:true,syntheticConsumerAccount:true,realAuthenticationCertified:false,otpDeliveryCertified:false,physicalTapMeasured:false,customerWrites:0,providerMutations:0,checks:[],frames:[],views:[],cases:[],documentNavigations:[],accountRequests:[],serverReads:[],errors:[],blockedWrites:[],blockedExternal:[],blockedCapabilities:[],geolocationCalls:0,contactSeeded:false,capabilityTransferred:false};
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
  const cookie=(headers.get('cookie')||'').split(';').map(value=>value.trim());
  const authenticated=cookie.includes('sun_account_qa=local');
  const unavailable=cookie.includes('sun_account_qa=unavailable');
  const reply=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
  console.log('SUN_ACCOUNT_QA_READ '+JSON.stringify({path:url.pathname,method,scenario:unavailable?'unavailable':authenticated?'authenticated':'anonymous'}));
  if(url.pathname==='/consumer/session')return unavailable?reply({ok:false},503):reply({ok:true,authenticated});
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
const scriptlessFrames=['light','dark'].map(theme=>({locale:'es-AR',theme,width:390,mode:'demo',javaScriptEnabled:false}));
const labels={'es-AR':'Mi cuenta',en:'My account','pt-BR':'Minha conta'};
const accountPath='/login?consumer=1&next=%2Fme';
function sunPath(entry){return entry.mode==='demo'?`/sun?demo=1&lang=${entry.locale}`:`/sun?snapshot=qa-closed&trace=synthetic&access=invalid&lang=${entry.locale}`;}
async function open(entry,javaScriptEnabled=true){
 const name=`${entry.mode}-${entry.width}-${entry.theme}-${entry.locale}${javaScriptEnabled?'':'-no-js'}`;
 const context=await browser.newContext({viewport:{width:entry.width,height:844},locale:entry.locale,reducedMotion:'reduce',serviceWorkers:'block',javaScriptEnabled});contexts.add(context);
 await context.addCookies([{name:'theme',value:entry.theme,url:base},{name:'nexid_theme_version',value:'white-first-v2',url:base},{name:'locale',value:entry.locale,url:base}]);
 await context.exposeBinding('__sunAccountGeo',()=>{report.geolocationCalls++;});
 await context.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){void window.__sunAccountGeo();throw Error('qa_location_blocked');},watchPosition(){void window.__sunAccountGeo();throw Error('qa_location_blocked');}}});});
 const state={closing:false,phase:'sun-readiness',requests:[]};
 await context.route('**/*',route=>track((async()=>{try{
  const request=route.request(),url=new URL(request.url());
  if(!['GET','HEAD'].includes(request.method())){report.customerWrites++;report.blockedWrites.push({view:name,method:request.method(),path:url.pathname});return route.abort('failed');}
  if(url.origin!==base){report.blockedExternal.push({view:name,category:'external_origin',method:request.method()});return route.abort('failed');}
  if(state.closing){report.errors.push({view:name,reason:'late_request'});return route.abort('failed');}
  if(request.headers().authorization||[...url.searchParams.keys()].some(key=>['eventid','freshtoken','fresh_token','t','token','contact','code','autoverify','cmac','mac','picc_data','enc','sig','signature','uid','readcounter','tap'].includes(key.toLowerCase()))||url.pathname==='/api/consumer/tap-handoff'){
   report.blockedCapabilities.push({view:name,path:url.pathname});return route.abort('failed');
  }
  if(url.pathname==='/qa-product.svg')return route.fulfill({status:200,contentType:'image/svg+xml',body:photo});
  if(url.pathname==='/api/product-notices/v2'&&url.searchParams.get('tenant')==='qa'&&url.searchParams.get('bid')==='synthetic-only'&&url.searchParams.size===2)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,protocol:'nexid.product-notices.v2',scope:{tenant:'qa',bid:'synthetic-only'},observedAt:'2026-10-06T12:00:00Z',notices:[],total:0,hasMore:false,doesNotDetermineNfcAuthenticity:true,closureDoesNotReleaseProduct:true,liftingNoticeDoesNotReleaseProduct:true})});
  if(url.pathname.startsWith('/api/'))throw Error('qa_unexpected_client_api');
  return await route.continue();
 }catch{report.errors.push({view:name,reason:'route_failed'});try{await route.abort('failed');}catch{report.errors.push({view:name,reason:'route_abort_failed'});}}
 })()));
 const page=await context.newPage();page.setDefaultTimeout(15000);
 page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/me'||url.pathname==='/login'){
  const row={view:name,phase:state.phase,path:url.pathname,method:request.method(),resourceType:request.resourceType(),navigation:request.isNavigationRequest(),rsc:request.headers().rsc==='1'};state.requests.push(row);report.accountRequests.push(row);
 }});
 // Every failed request is fatal, including cancellation during a redirect or
 // context teardown. This native loopback suite has no telemetry exclusions.
 page.on('requestfailed',request=>report.errors.push({view:name,reason:'request_failed',net:request.failure()?.errorText==='net::ERR_ABORTED'?'aborted':'failed',resourceSha256:digest(request.url()),resourceType:request.resourceType(),method:request.method(),navigation:request.isNavigationRequest(),phase:state.phase,closing:state.closing}));
 page.on('pageerror',()=>report.errors.push({view:name,reason:'page_error'}));page.on('console',event=>{if(event.type()==='error')report.errors.push({view:name,reason:'console_error'});});
 return{context,page,name,state,entry};
}
async function settle(page){await page.waitForLoadState('networkidle',{timeout:20000});await drain();}
async function navigateAccount(current,kind,keyboard=false){
 const{page,name,state}=current;state.phase=kind;const start=state.requests.length;
 const firstRequest=page.waitForRequest(request=>new URL(request.url()).pathname==='/me');
 const account=page.getByTestId('sun-account-link');
 if(keyboard)await account.focus();
 const[first]=await Promise.all([firstRequest,keyboard?account.press('Enter'):account.click()]);
 const observation={view:name,kind,path:new URL(first.url()).pathname,method:first.method(),resourceType:first.resourceType(),navigation:first.isNavigationRequest(),rsc:first.headers().rsc==='1',referrerSuppressed:!first.headers().referer};
 report.documentNavigations.push(observation);
 check(observation.path==='/me'&&observation.method==='GET'&&observation.resourceType==='document'&&observation.navigation&&!observation.rsc&&observation.referrerSuppressed&&new URL(first.url()).search==='',`${name}/${kind}: first /me is an exact document GET without RSC or referrer`);
 return start;
}
function assertNoAccountRsc(current,start,kind){
 const requests=current.state.requests.slice(start).filter(row=>row.path==='/me');
 check(requests.length>=1&&requests.every(row=>row.navigation&&row.resourceType==='document'&&!row.rsc),`${current.name}/${kind}: account entry never fetches /me through RSC`);
}
async function assertLogin(current,kind){
 const{page,name,context}=current;
 await page.waitForURL(base+accountPath);await page.getByRole('heading',{name:'Entrá a tu cuenta',exact:true}).waitFor();await settle(page);
 check(page.url()===base+accountPath,`${name}/${kind}: exact anonymous consumer continuation`);
 check(await page.getByRole('button',{name:'WhatsApp',exact:true}).count()===1&&await page.getByRole('button',{name:'Email',exact:true}).count()===1,`${name}/${kind}: both sign-in channels remain visible`);
 const inputs=page.locator('input[type="email"],input[type="tel"],input[autocomplete="one-time-code"]');
 check(await inputs.count()>=1&&(await inputs.evaluateAll(nodes=>nodes.map(node=>node.value))).every(value=>value===''),`${name}/${kind}: contact fields exist without a seeded contact or code`);
 check((await context.cookies()).every(cookie=>['theme','nexid_theme_version','locale'].includes(cookie.name)),`${name}/${kind}: account entry never creates a session or capability cookie`);
}
async function finish(current){
 const{page,state,context}=current;
 cleanupStage='drain_before_page_close';await settle(page);state.closing=true;
 cleanupStage='page_close';await page.close();cleanupStage='drain_after_page_close';await drain();
 cleanupStage='context_close';await context.close();contexts.delete(context);cleanupStage=null;
}
try{
 report.entryBindingBefore=await binding();
 const reserve=createServer();await new Promise(done=>reserve.listen(0,'127.0.0.1',done));const port=reserve.address().port;await new Promise(done=>reserve.close(done));base=`http://127.0.0.1:${port}`;
 next=spawn(process.execPath,['--import',pathToFileURL(preload).href,join(repo,'node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:web,env:{...systemEnv,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
 let nextOutput='';next.stdout.on('data',chunk=>{nextOutput+=chunk;let end;while((end=nextOutput.indexOf('\n'))!==-1){const line=nextOutput.slice(0,end).trim();nextOutput=nextOutput.slice(end+1);if(line.startsWith('SUN_ACCOUNT_QA_READ ')){try{const row=JSON.parse(line.slice(20));assert.ok(['/consumer/session','/consumer/me','/consumer/products','/consumer/taps','/consumer/brands'].includes(row.path));assert.equal(row.method,'GET');assert.ok(['anonymous','authenticated','unavailable'].includes(row.scenario));report.serverReads.push(row);}catch{report.errors.push({reason:'invalid_synthetic_server_read'});}}}});next.stderr.on('data',()=>{});next.on('error',()=>{serverFailed=true;});
 let ready=false;for(let attempt=0;attempt<120;attempt++){if(serverFailed||next.exitCode!==null)break;try{const response=await fetch(base+'/release.json',{signal:AbortSignal.timeout(1000),credentials:'omit',redirect:'manual'});if(response.ok){ready=true;break;}}catch{}await new Promise(done=>setTimeout(done,250));}check(ready,'Own loopback production server is ready');
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright-core');browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 for(const entry of frames){
  const current=await open(entry),{name,context,page,state}=current;report.frames.push({...entry,name});const path=sunPath(entry);
  await page.goto(base+path,{waitUntil:'networkidle',timeout:90000});
  const header=page.getByTestId('sun-passport-header'),account=page.getByTestId('sun-account-link');await header.waitFor();
  await page.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0);});
  check(await account.getAttribute('href')==='/me'&&await account.innerText()===labels[entry.locale]&&await account.getAttribute('referrerpolicy')==='no-referrer',`${name}: explicit localized /me document access without TAP context`);
  const geometry=await header.evaluate(element=>{const account=element.querySelector('[data-testid="sun-account-link"]'),rect=account.getBoundingClientRect(),hit=document.elementFromPoint((rect.left+rect.right)/2,(rect.top+rect.bottom)/2);return{width:rect.width,height:rect.height,withinViewport:rect.left>=0&&rect.right<=innerWidth&&rect.top>=0&&rect.bottom<=innerHeight,unobstructed:hit===account||account.contains(hit),overflow:document.documentElement.scrollWidth>innerWidth+1,targets:[...element.querySelectorAll('a,button,select')].filter(target=>target.getClientRects().length).map(target=>{const b=target.getBoundingClientRect();return{width:b.width,height:b.height,left:b.left,right:b.right};})};});
  check(geometry.width>=44&&geometry.height>=44&&geometry.withinViewport&&geometry.unobstructed,`${name}: account link is a visible unobstructed 44px target`);
  check(!geometry.overflow&&geometry.targets.every(target=>target.width>=44&&target.height>=44&&target.left>=0&&target.right<=entry.width),`${name}: header controls stay touch-safe without overflow`);
  await account.focus();check(await account.evaluate(element=>element.matches(':focus-visible')&&parseFloat(getComputedStyle(element).outlineWidth)>=2),`${name}: account link has visible keyboard focus`);
  await page.addScriptTag({content:axe});const accessibility=await page.evaluate(async()=> {const result=await axe.run('[data-testid="sun-passport-header"]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});const rows=items=>items.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.map(node=>({target:node.target,html:node.html,failureSummary:node.failureSummary,any:node.any,all:node.all,none:node.none}))}));return{violations:rows(result.violations),incomplete:rows(result.incomplete)};});
  report.views.push({...entry,name,javaScriptEnabled:true,geometry,...accessibility});check(accessibility.violations.length===0,`${name}: zero scoped accessibility violations`);
  if(entry.mode==='snapshot'){
   check(await page.getByTestId('consumer-passport-primary').count()===1,`${name}: contextual products action is preserved`);
   const primary=page.getByTestId('sun-summary-primary');check(await primary.count()===1&&await primary.evaluate(element=>{const b=element.getBoundingClientRect();return b.width>=44&&b.height>=44&&b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight;}),`${name}: reading primary action remains visible in the first viewport`);
  }else check(await page.getByTestId('consumer-passport-primary').count()===0,`${name}: demo does not invent a reading handoff`);
  if(entry.width===390&&entry.locale==='es-AR'){await account.evaluate(element=>element.blur());await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:join(output,`${name}.png`),fullPage:false});}
  // Anonymous account navigation is an ordinary /me GET. Next enforces the
  // existing consumer continuation; no OTP request, save or association here.
  const anonymousStart=await navigateAccount(current,'anonymous',true);await assertLogin(current,'anonymous');assertNoAccountRsc(current,anonymousStart,'anonymous');
  report.cases.push({view:name,kind:'anonymous',passed:true,completed:true,keyboard:true});
  if(entry.mode==='demo'&&entry.width===390){
   state.phase='back';await page.goBack({waitUntil:'networkidle'});await page.waitForURL(base+path);await page.getByTestId('sun-account-link').waitFor();await settle(page);
   check(page.url()===base+path&&await page.getByTestId('sun-account-link').getAttribute('href')==='/me',`${name}: one Back returns to the original public SUN URL`);
   report.cases.push({view:name,kind:'back',passed:true,completed:true,physicalFreshnessCertified:false});
  }
  await context.addCookies([{name:'sun_account_qa',value:'local',url:base,httpOnly:true,sameSite:'Lax'}]);
  state.phase='sun-readiness';await page.goto(base+path,{waitUntil:'networkidle'});const authenticatedStart=await navigateAccount(current,'authenticated');await page.waitForURL(base+'/me');await page.locator('#consumer-portal-content').waitFor();await settle(page);assertNoAccountRsc(current,authenticatedStart,'authenticated');
  check((await page.locator('#consumer-portal-content').innerText()).includes('Cuenta sintética SUN'),`${name}: explicit synthetic account opens the actual portal without enrollment`);
  check((await context.cookies()).every(cookie=>['theme','nexid_theme_version','locale','sun_account_qa'].includes(cookie.name)),`${name}: only the explicit synthetic session and appearance cookies exist`);
  report.cases.push({view:name,kind:'authenticated',passed:true,completed:true,synthetic:true});
  if(entry.width<=390){
   await context.addCookies([{name:'sun_account_qa',value:'unavailable',url:base,httpOnly:true,sameSite:'Lax'}]);state.phase='sun-readiness';await page.goto(base+path,{waitUntil:'networkidle'});
   const unavailableStart=await navigateAccount(current,'unavailable');await page.waitForURL(base+'/me');await page.getByTestId('consumer-portal-unavailable').waitFor();await settle(page);assertNoAccountRsc(current,unavailableStart,'unavailable');
   check(page.url()===base+'/me'&&await page.getByRole('heading',{name:'No pudimos abrir tu espacio',exact:true}).count()===1&&await page.getByRole('button',{name:'Reintentar',exact:true}).count()===1,`${name}: an unavailable session preserves recovery without forcing a login`);
   check(await page.locator('#consumer-portal-content').count()===0,`${name}: unavailable sessions do not show private account content`);
   report.cases.push({view:name,kind:'unavailable',passed:true,completed:true,synthetic:true});
  }
  check(report.blockedWrites.length===0&&report.geolocationCalls===0,`${name}: account navigation never performs a write or location request`);
  await finish(current);
 }
 for(const entry of scriptlessFrames){
  const current=await open(entry,false),{page,name}=current;await page.goto(base+sunPath(entry),{waitUntil:'networkidle'});const account=page.getByTestId('sun-account-link');await account.waitFor();
  check(await account.getAttribute('href')==='/me'&&await account.innerText()===labels[entry.locale],`${name}: public account anchor renders without JavaScript`);
  const start=await navigateAccount(current,'scriptless');await assertLogin(current,'scriptless');assertNoAccountRsc(current,start,'scriptless');
  report.views.push({...entry,name,javaScriptEnabled:false,accessibilityScope:'navigation and server-rendered form; no JavaScript accessibility scan'});report.cases.push({view:name,kind:'scriptless',passed:true,completed:true,otpWithoutJavaScriptCertified:false});await finish(current);
 }
 check(report.frames.length===48,'All 48 real/demo viewport/theme/locale frames completed');check(report.views.length===frames.length+scriptlessFrames.length,'All responsive and scriptless views completed');
 check(report.cases.filter(item=>item.kind==='anonymous').length===frames.length&&report.cases.filter(item=>item.kind==='authenticated').length===frames.length&&report.cases.filter(item=>item.kind==='unavailable').length===frames.filter(item=>item.width<=390).length&&report.cases.filter(item=>item.kind==='back').length===frames.filter(item=>item.width===390&&item.mode==='demo').length&&report.cases.filter(item=>item.kind==='scriptless').length===scriptlessFrames.length,'Every required account scenario completed');
 check(report.documentNavigations.length===frames.length*2+frames.filter(item=>item.width<=390).length+scriptlessFrames.length&&report.documentNavigations.every(item=>item.path==='/me'&&item.navigation&&item.resourceType==='document'&&!item.rsc&&item.referrerSuppressed),'All account entries began as documents without a SUN referrer');
 check(report.serverReads.length>0&&report.serverReads.every(row=>row.scenario==='authenticated'||row.path==='/consumer/session'),'Only confirmed synthetic sessions read private consumer resources');
 check(report.errors.length===0,'Zero application, route, request and console errors');check(report.blockedWrites.length===0&&report.customerWrites===0,'Zero write attempts');check(report.blockedExternal.length===0,'Zero external requests');check(report.blockedCapabilities.length===0,'Zero capability or contact transfers');check(report.geolocationCalls===0,'Zero GPS calls');report.status='passed';
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
