// Actual production Next passport/router; API/session responses are synthetic.
// Root executes only after the final clean commit and source-bound cold build.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,readdir,writeFile,realpath,lstat} from 'node:fs/promises';
import {join,relative,resolve,sep,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {disabledScriptFailureDecision,htmlCspMetaStatus} from './browser/disabled-script-policy.mjs';

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
 const manifestBytes=await readFile(join(web,'.next/build-manifest.json'));
 const rootMainFiles=JSON.parse(manifestBytes).rootMainFiles;
 assert.ok(Array.isArray(rootMainFiles)&&rootMainFiles.length&&new Set(rootMainFiles).size===rootMainFiles.length&&rootMainFiles.every(file=>typeof file==='string'&&/^static\/chunks\/[A-Za-z0-9_.-]+\.js$/.test(file)&&!file.includes('..')),'Compiled root-main preload catalog must be exact and contained');
 const compiled=[join(web,'.next/BUILD_ID'),join(web,'.next/build-manifest.json'),...['sun','me','login'].map(route=>join(web,`.next/server/app/${route}/page.js`)),...(await files(join(web,'.next/static'))).filter(path=>/\.(js|css)$/.test(path))].sort();
 const hashes=Object.fromEntries(await Promise.all(compiled.map(async path=>{const key=relative(repo,path).split(sep).join('/');assert.ok(key.startsWith('apps/web/.next/')&&!key.includes('../'));return[key,digest(await readFile(path))];})));
 const rootMainPreloads=rootMainFiles.map(file=>({path:'/_next/'+file,sha256:hashes['apps/web/.next/'+file]}));
 assert.ok(rootMainPreloads.every(row=>/^[a-f0-9]{64}$/.test(row.sha256)),'Every root-main preload has physical compiled bytes');
 return{qaSource:process.env.QA_SOURCE,observedSource,observedTree,sourceWorktreeClean,sourceClaimBound:true,buildId:(await readFile(join(web,'.next/BUILD_ID'),'utf8')).trim(),sourceRows,sourceManifestSha256:digest(JSON.stringify(sourceRows)),hashes,buildManifestSha256:digest(manifestBytes),rootMainFiles,rootMainPreloads};
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
const report={schemaVersion:'nexid.sun-account-access-next-qa/v3',status:'failed',viewOrder:'scriptless-first',localOnly:true,realProductionBuild:true,actualNextRouter:true,syntheticSunContract:true,syntheticConsumerAccount:true,realAuthenticationCertified:false,otpDeliveryCertified:false,physicalTapMeasured:false,customerWrites:0,providerMutations:0,checks:[],frames:[],views:[],cases:[],documentNavigations:[],accountRequests:[],serverReads:[],errors:[],requestFailures:[],expectedDisabledScriptBlocks:[],documentPolicies:[],blockedWrites:[],blockedExternal:[],blockedCapabilities:[],geolocationCalls:0,contactSeeded:false,capabilityTransferred:false};
const check=(value,name)=>{report.checks.push({name,passed:Boolean(value)});assert.ok(value,name);};
const snapshotFixture=join(web,'tests/sun-mobile-local-fetch.mjs');
const disabledScriptPolicy=join(web,'tests/browser/disabled-script-policy.mjs');
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
report.helperHashesBefore={browser:digest(await readFile(fileURLToPath(import.meta.url))),snapshotFixture:digest(await readFile(snapshotFixture)),preload:digest(preloadSource),disabledScriptPolicy:digest(await readFile(disabledScriptPolicy))};
const axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
const photo='<svg xmlns="http://www.w3.org/2000/svg" width="320" height="480" viewBox="0 0 320 480"><rect width="320" height="480" fill="#faf7ed"/><rect x="105" y="60" width="110" height="355" rx="24" fill="#233c32"/><text x="160" y="230" text-anchor="middle" fill="white">ENSAYO SUN</text></svg>';
let browser=null,next=null,base='',serverFailed=false;const contexts=new Set(),contextStates=new WeakMap(),pending=new Set();
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
const knownRoutePaths=new Set(['/','/sun','/me','/login','/me/products','/me/taps','/me/rewards','/me/passport','/me/brands','/me/wallet','/me/marketplace','/me/experiences','/me/sommelier','/me/cork-analyzer','/me/privacy','/me/security']);
function safeRequestEvidence(request){
 const url=new URL(request.url()),headers=request.headers();
 const knownPreload=report.entryBindingBefore?.rootMainPreloads?.some(row=>row.path===url.pathname);
 return{path:url.origin===base&&(knownRoutePaths.has(url.pathname)||knownPreload)?url.pathname:'[redacted]',rsc:headers.rsc==='1',prefetch:Boolean(headers['next-router-prefetch']),segment:Boolean(headers['next-router-segment-prefetch'])};
}
function safeNetworkError(request){
 const value=request.failure()?.errorText;
 if(value==='csp')return'CSP';
 return typeof value==='string'?value.match(/^net::(ERR_[A-Z0-9_]{1,80})$/)?.[1]||'UNKNOWN':'UNKNOWN';
}
function sunPath(entry){return entry.mode==='demo'?`/sun?demo=1&lang=${entry.locale}`:`/sun?snapshot=qa-closed&trace=synthetic&access=invalid&lang=${entry.locale}`;}
async function open(entry,javaScriptEnabled=true){
 const name=`${entry.mode}-${entry.width}-${entry.theme}-${entry.locale}${javaScriptEnabled?'':'-no-js'}`;
 const context=await browser.newContext({viewport:{width:entry.width,height:844},locale:entry.locale,reducedMotion:'reduce',serviceWorkers:'block',javaScriptEnabled});contexts.add(context);
 await context.addCookies([{name:'theme',value:entry.theme,url:base},{name:'nexid_theme_version',value:'white-first-v2',url:base},{name:'locale',value:entry.locale,url:base}]);
 await context.exposeBinding('__sunAccountGeo',()=>{report.geolocationCalls++;});
 await context.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){void window.__sunAccountGeo();throw Error('qa_location_blocked');},watchPosition(){void window.__sunAccountGeo();throw Error('qa_location_blocked');}}});});
 const state={closing:false,phase:'sun-readiness',requests:[],documentSequence:0,currentDocument:null,documentSlots:new Set(),requestDocuments:new WeakMap()};
 contextStates.set(context,state);
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
 page.on('request',request=>{const url=new URL(request.url());
  if(!javaScriptEnabled&&request.isNavigationRequest()&&request.resourceType()==='document'&&request.frame()===page.mainFrame()){
   if(state.currentDocument&&!state.currentDocument.responseObserved)state.currentDocument.resolve(null);
   const slot={id:`${name}/doc-${++state.documentSequence}`,sequence:state.documentSequence,request,phase:state.phase,responseObserved:false,policy:null,resolve:null,promise:null};
   slot.promise=new Promise(done=>{slot.resolve=done;});state.currentDocument=slot;state.documentSlots.add(slot);
  }
  state.requestDocuments.set(request,state.currentDocument);
  if(url.pathname==='/me'||url.pathname==='/login'){
  const row={view:name,phase:state.phase,method:request.method(),resourceType:request.resourceType(),navigation:request.isNavigationRequest(),...safeRequestEvidence(request)};state.requests.push(row);report.accountRequests.push(row);
 }});
 page.on('response',response=>{
  const request=response.request(),slot=state.requestDocuments.get(request);
  if(javaScriptEnabled||!slot||slot.request!==request)return;
  slot.responseObserved=true;
  void track((async()=>{try{
   const url=new URL(request.url()),headers=await response.allHeaders(),html=Boolean(headers['content-type']?.toLowerCase().includes('text/html'));
   const body=html?await response.text():null;
   const policy={id:slot.id,view:name,sequence:slot.sequence,phase:slot.phase,documentSha256:digest(request.url()),path:url.origin===base&&knownRoutePaths.has(url.pathname)?url.pathname:'[redacted]',originOwned:url.origin===base,status:response.status(),html,cspPresent:Object.hasOwn(headers,'content-security-policy'),cspReportOnlyPresent:Object.hasOwn(headers,'content-security-policy-report-only'),cspMetaPresent:htmlCspMetaStatus(body),htmlSha256:typeof body==='string'?digest(body):null};
   slot.policy=policy;report.documentPolicies.push(policy);slot.resolve(policy);
  }catch{slot.resolve(null);report.errors.push({view:name,reason:'document_policy_observation_failed'});}})());
 });
 // Every failure stays in the ledger. Only the exact, hash-bound intentional
 // JS-disabled preload control can be expected; all aborts remain fatal.
 page.on('requestfailed',request=>{
  const url=new URL(request.url()),slot=state.requestDocuments.get(request),current=state.currentDocument;
  const row={view:name,reason:'request_failed',net:request.failure()?.errorText==='net::ERR_ABORTED'?'aborted':'failed',errorEnum:safeNetworkError(request),resourceSha256:digest(request.url()),resourceType:request.resourceType(),method:request.method(),navigation:request.isNavigationRequest(),phase:state.phase,closing:state.closing,...safeRequestEvidence(request),javaScriptEnabled,mainFrame:request.frame()===page.mainFrame(),originOwned:url.origin===base,queryEmpty:url.search===''&&!request.url().includes('?'),fragmentEmpty:url.hash===''&&!request.url().includes('#'),requestDocumentPolicyId:slot?.id||null,currentDocumentPolicyId:current?.id||null,currentDocumentSha256:digest(page.url())};
  const errorText=request.failure()?.errorText;
  void track((async()=>{
   const potential=!javaScriptEnabled&&errorText==='csp'&&row.closing===false&&slot&&slot===current;
   const policy=potential?await slot.promise:null;
   // Classification uses the document and closing state at the failure event,
   // never a different document reached while its policy body was pending.
   const decision=disabledScriptFailureDecision({javaScriptEnabled,closing:row.closing,errorText,method:row.method,resourceType:row.resourceType,navigation:row.navigation,mainFrame:row.mainFrame,origin:base,requestUrl:request.url(),binding:report.entryBindingBefore,documentPolicy:policy,requestDocumentPolicyId:row.requestDocumentPolicyId,currentDocumentPolicyId:row.currentDocumentPolicyId,currentDocumentSha256:row.currentDocumentSha256});
   const evidence={...row,classification:decision.expected?'expected_disabled_script_block':'fatal',...(decision.expected?decision:{policyReason:decision.reason})};
   report.requestFailures.push(evidence);if(decision.expected)report.expectedDisabledScriptBlocks.push(evidence);else report.errors.push(evidence);
  })());
 });
 page.on('close',()=>{for(const slot of state.documentSlots)if(!slot.policy)slot.resolve(null);});
 page.on('pageerror',()=>report.errors.push({view:name,reason:'page_error'}));page.on('console',event=>{if(event.type()==='error')report.errors.push({view:name,reason:'console_error'});});
 return{context,page,name,state,entry,javaScriptEnabled};
}
async function settle(page){await page.waitForLoadState('networkidle',{timeout:20000});await drain();}
async function navigateAccount(current,kind,keyboard=false){
 const{page,name,state}=current;state.phase=kind;const start=state.requests.length;
 const firstRequest=page.waitForRequest(request=>new URL(request.url()).pathname==='/me');
 const account=page.getByTestId(current.javaScriptEnabled?'sun-account-link':'sun-nojs-account-link');
 if(keyboard)await account.focus();
 const[first]=await Promise.all([firstRequest,keyboard?account.press('Enter'):account.click()]);
 const observation={view:name,kind,method:first.method(),resourceType:first.resourceType(),navigation:first.isNavigationRequest(),referrerSuppressed:!first.headers().referer,...safeRequestEvidence(first)};
 report.documentNavigations.push(observation);
 check(observation.path==='/me'&&observation.method==='GET'&&observation.resourceType==='document'&&observation.navigation&&!observation.rsc&&!observation.prefetch&&!observation.segment&&observation.referrerSuppressed&&new URL(first.url()).search==='',`${name}/${kind}: first /me is an exact document GET without RSC, prefetch or referrer`);
 return start;
}
function assertNoAutomaticAccountPrefetch(current,start,kind){
 const requests=current.state.requests.slice(start);
 // Entry is checked at its first /me request above. A later user-triggered
 // refresh may use RSC; only automatic account/login prefetch is prohibited.
 check(requests.length>=1&&requests.every(row=>!row.prefetch&&!row.segment),`${current.name}/${kind}: settled account access has no automatic /me or /login prefetch`);
}
async function assertLogin(current,kind){
 const{page,name,context}=current;
 await page.waitForURL(base+accountPath);
 if(current.javaScriptEnabled)await page.getByRole('heading',{name:'Entrá a tu cuenta',exact:true}).waitFor();
 else await page.getByTestId('account-nojs-fallback').waitFor();
 await settle(page);
 check(page.url()===base+accountPath,`${name}/${kind}: exact anonymous consumer continuation`);
 if(current.javaScriptEnabled){
  check(await page.getByRole('button',{name:'WhatsApp',exact:true}).count()===1&&await page.getByRole('button',{name:'Email',exact:true}).count()===1,`${name}/${kind}: both sign-in channels remain visible`);
  const inputs=page.locator('input[type="email"],input[type="tel"],input[autocomplete="one-time-code"]');
  check(await inputs.count()>=1&&(await inputs.evaluateAll(nodes=>nodes.map(node=>node.value))).every(value=>value===''),`${name}/${kind}: contact fields exist without a seeded contact or code`);
 }else{
  const fallback=page.getByTestId('account-nojs-fallback');
  check(await fallback.getByRole('heading',{name:'Tu cuenta necesita JavaScript',exact:true}).isVisible()&&(await fallback.innerText()).includes('Activá JavaScript')&&!(await page.getByTestId('account-loading').isVisible()),`${name}/${kind}: visible account explanation requires JavaScript without a perpetual loader`);
  check(await fallback.locator('a,button,form,input').count()===0,`${name}/${kind}: no-script account explanation does not promise OTP or create a navigation loop`);
  await page.screenshot({path:join(output,`${name}-account.png`),fullPage:false});
 }
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
 // Check the previously observed no-JavaScript blocker first; every scenario
 // and final completeness/error gate below is still required for acceptance.
 for(const entry of scriptlessFrames){
  const current=await open(entry,false),{page,name}=current;await page.goto(base+sunPath(entry),{waitUntil:'networkidle'});const fallback=page.getByTestId('sun-nojs-fallback'),account=page.getByTestId('sun-nojs-account-link');await fallback.waitFor();await account.waitFor();
  check(await account.getAttribute('href')==='/me'&&await account.innerText()===labels[entry.locale]&&await account.getAttribute('referrerpolicy')==='no-referrer',`${name}: visible no-script account anchor preserves documentary access`);
  const geometry=await account.evaluate(element=>{const b=element.getBoundingClientRect(),hit=document.elementFromPoint((b.left+b.right)/2,(b.top+b.bottom)/2);return{width:b.width,height:b.height,withinViewport:b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight,unobstructed:hit===element||element.contains(hit),overflow:document.documentElement.scrollWidth>innerWidth+1};});
  check(geometry.width>=44&&geometry.height>=44&&geometry.withinViewport&&geometry.unobstructed&&!geometry.overflow,`${name}: no-script account action is visible, touch-safe and unobstructed`);
  check(await fallback.getByRole('heading',{name:'Activá JavaScript para continuar',exact:true}).count()===1&&(await fallback.innerText()).includes('El pasaporte y el acceso a tu cuenta necesitan JavaScript')&&!(await page.getByTestId('sun-loading').isVisible()),`${name}: no-script copy explains passport and account requirements without a busy loader`);
  await page.screenshot({path:join(output,`${name}.png`),fullPage:false});
  const start=await navigateAccount(current,'scriptless');await assertLogin(current,'scriptless');assertNoAutomaticAccountPrefetch(current,start,'scriptless');
  report.views.push({...entry,name,javaScriptEnabled:false,geometry,accessibilityScope:'no-script fallback, document navigation and visible account JavaScript requirement; no JavaScript accessibility scan'});report.cases.push({view:name,kind:'scriptless',passed:true,completed:true,fallback:true,accountJavaScriptRequired:true,otpWithoutJavaScriptCertified:false});await finish(current);
 }
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
  const anonymousStart=await navigateAccount(current,'anonymous',true);await assertLogin(current,'anonymous');assertNoAutomaticAccountPrefetch(current,anonymousStart,'anonymous');
  report.cases.push({view:name,kind:'anonymous',passed:true,completed:true,keyboard:true});
  if(entry.mode==='demo'&&entry.width===390){
   state.phase='back';await page.goBack({waitUntil:'networkidle'});await page.waitForURL(base+path);await page.getByTestId('sun-account-link').waitFor();await settle(page);
   check(page.url()===base+path&&await page.getByTestId('sun-account-link').getAttribute('href')==='/me',`${name}: one Back returns to the original public SUN URL`);
   report.cases.push({view:name,kind:'back',passed:true,completed:true,physicalFreshnessCertified:false});
  }
  await context.addCookies([{name:'sun_account_qa',value:'local',url:base,httpOnly:true,sameSite:'Lax'}]);
  state.phase='sun-readiness';await page.goto(base+path,{waitUntil:'networkidle'});const authenticatedStart=await navigateAccount(current,'authenticated');await page.waitForURL(base+'/me');await page.locator('#consumer-portal-content').waitFor();await settle(page);assertNoAutomaticAccountPrefetch(current,authenticatedStart,'authenticated');
  check((await page.locator('#consumer-portal-content').innerText()).includes('Cuenta sintética SUN'),`${name}: explicit synthetic account opens the actual portal without enrollment`);
  check((await context.cookies()).every(cookie=>['theme','nexid_theme_version','locale','sun_account_qa'].includes(cookie.name)),`${name}: only the explicit synthetic session and appearance cookies exist`);
  report.cases.push({view:name,kind:'authenticated',passed:true,completed:true,synthetic:true});
  if(entry.width<=390){
   await context.addCookies([{name:'sun_account_qa',value:'unavailable',url:base,httpOnly:true,sameSite:'Lax'}]);state.phase='sun-readiness';await page.goto(base+path,{waitUntil:'networkidle'});
   const unavailableStart=await navigateAccount(current,'unavailable');await page.waitForURL(base+'/me');await page.getByTestId('consumer-portal-unavailable').waitFor();await settle(page);assertNoAutomaticAccountPrefetch(current,unavailableStart,'unavailable');
   check(page.url()===base+'/me'&&await page.getByRole('heading',{name:'No pudimos abrir tu espacio',exact:true}).count()===1&&await page.getByRole('button',{name:'Reintentar',exact:true}).count()===1,`${name}: an unavailable session preserves recovery without forcing a login`);
   check(await page.locator('#consumer-portal-content').count()===0,`${name}: unavailable sessions do not show private account content`);
   report.cases.push({view:name,kind:'unavailable',passed:true,completed:true,synthetic:true});
  }
  check(report.blockedWrites.length===0&&report.geolocationCalls===0,`${name}: account navigation never performs a write or location request`);
  await finish(current);
 }
 check(report.frames.length===48,'All 48 real/demo viewport/theme/locale frames completed');check(report.views.length===frames.length+scriptlessFrames.length,'All responsive and scriptless views completed');
 check(report.cases.filter(item=>item.kind==='anonymous').length===frames.length&&report.cases.filter(item=>item.kind==='authenticated').length===frames.length&&report.cases.filter(item=>item.kind==='unavailable').length===frames.filter(item=>item.width<=390).length&&report.cases.filter(item=>item.kind==='back').length===frames.filter(item=>item.width===390&&item.mode==='demo').length&&report.cases.filter(item=>item.kind==='scriptless').length===scriptlessFrames.length,'Every required account scenario completed');
 check(report.documentNavigations.length===frames.length*2+frames.filter(item=>item.width<=390).length+scriptlessFrames.length&&report.documentNavigations.every(item=>item.path==='/me'&&item.navigation&&item.resourceType==='document'&&!item.rsc&&!item.prefetch&&!item.segment&&item.referrerSuppressed),'All account entries began as documents without prefetch or a SUN referrer');
 check(report.serverReads.length>0&&report.serverReads.every(row=>row.scenario==='authenticated'||row.path==='/consumer/session'),'Only confirmed synthetic sessions read private consumer resources');
 check(report.requestFailures.length===report.expectedDisabledScriptBlocks.length+report.errors.filter(row=>row.reason==='request_failed').length&&report.expectedDisabledScriptBlocks.every(row=>report.requestFailures.includes(row)), 'Every failed request remains in the complete expected-or-fatal ledger');
 check(report.errors.length===0,'Zero unexpected application, route, request and console errors');check(report.blockedWrites.length===0&&report.customerWrites===0,'Zero write attempts');check(report.blockedExternal.length===0,'Zero external requests');check(report.blockedCapabilities.length===0,'Zero capability or contact transfers');check(report.geolocationCalls===0,'Zero GPS calls');report.status='passed';
}catch(error){report.status='failed';report.failureReason='bounded_sun_account_qa_failed';report.failureCategory=exceptionCategory(error);if(cleanupStage)report.cleanupFailure={stage:cleanupStage,category:report.failureCategory};}
finally{
 for(const context of contexts)try{const state=contextStates.get(context);if(state)state.closing=true;await context.close();}catch{report.errors.push({reason:'context_close_failed'});report.status='failed';}
 try{await drain();}catch{report.errors.push({reason:'final_pending_observation_failed'});report.status='failed';}
 if(browser)try{await browser.close();}catch{report.errors.push({reason:'browser_close_failed'});report.status='failed';}
 if(next&&next.exitCode===null&&next.signalCode===null){next.kill();await Promise.race([new Promise(done=>next.once('exit',done)),new Promise(done=>setTimeout(done,1500))]);if(next.exitCode===null&&next.signalCode===null){report.errors.push({reason:'local_server_close_failed'});report.status='failed';}}
 try{report.entryBindingAfter=await binding();report.sourceBuildStable=JSON.stringify(report.entryBindingBefore)===JSON.stringify(report.entryBindingAfter);report.helperHashesAfter={browser:digest(await readFile(fileURLToPath(import.meta.url))),snapshotFixture:digest(await readFile(snapshotFixture)),preload:digest(await readFile(preload)),disabledScriptPolicy:digest(await readFile(disabledScriptPolicy))};if(!report.sourceBuildStable||JSON.stringify(report.helperHashesBefore)!==JSON.stringify(report.helperHashesAfter))report.status='failed';}catch{report.sourceBuildStable=false;report.status='failed';report.errors.push({reason:'source_binding_failed'});}
 if(report.errors.length)report.status='failed';
 await writeFile(join(output,'report.json'),JSON.stringify(report,null,2),{flag:'wx'});
 console.log(JSON.stringify({status:report.status,checks:report.checks.length,views:report.views.length,frames:report.frames.length,errors:report.errors.length,blockedWrites:report.blockedWrites.length,blockedExternal:report.blockedExternal.length,geolocationCalls:report.geolocationCalls,sourceBuildStable:report.sourceBuildStable,output}));
 if(report.status!=='passed')process.exitCode=1;
}
