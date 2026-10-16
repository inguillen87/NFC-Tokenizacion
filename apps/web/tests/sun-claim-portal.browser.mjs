// Dedicated gateway QA: real compiled Next/BFF; owned synthetic loopback upstream.
// This runner never confirms a claim, requests an OTP, invokes OCR or accesses a provider.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {join,resolve,isAbsolute,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const web=fileURLToPath(new URL('../',import.meta.url)),root=resolve(web,'../..');
const digest=b=>createHash('sha256').update(b).digest('hex');
assert.equal(process.env.QA_SUN_CLAIM_PORTAL_AUTHORIZED,'1','Explicit local gateway QA authorization required');
assert.match(process.env.QA_SOURCE||'',/^[a-f0-9]{40}$/,'Exact clean committed source required');
const runId=process.env.QA_RUN_ID||'',output=process.env.QA_OUTPUT||'';
assert.match(runId,/^[a-f0-9-]{36}$/i);assert.ok(isAbsolute(output));await mkdir(output,{recursive:true});
function loopback(value){const u=new URL(value);assert.ok(u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname)&&u.port&&u.pathname==='/'&&!u.search&&!u.hash&&!u.username&&!u.password);return u.origin;}
const base=loopback(process.env.QA_WEB_BASE||'http://127.0.0.1:3189'),api=loopback(process.env.QA_API_BASE||'http://127.0.0.1:4389');assert.notEqual(base,api);
for(const name of ['DATABASE_URL','POSTGRES_URL','SUN_HANDOFF_SECRET','META_CONSUMER_OTP_ACCESS_TOKEN','TWILIO_AUTH_TOKEN','OPENAI_API_KEY','RESEND_API_KEY'])assert.ok(!process.env[name],'Credential environment forbidden');
const systemEnv=Object.fromEntries(Object.entries(process.env).filter(([k,v])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(k)&&typeof v==='string'));
const git=args=>execFileSync(process.env.QA_GIT_EXE||'git',args,{cwd:root,env:systemEnv,encoding:'utf8',windowsHide:true,timeout:10000}).trim();
async function sourceBinding(){
 const head=git(['rev-parse','HEAD']),tree=git(['rev-parse','HEAD^{tree}']);assert.equal(head,process.env.QA_SOURCE);assert.equal(git(['status','--porcelain']),'','Source must remain clean');
 const files=git(['ls-files','-z']).split('\0').filter(Boolean).sort(),rows=[];for(const p of files)rows.push({path:p,sha256:digest(await readFile(join(root,p)))});
 const compiled={};for(const p of ['.next/BUILD_ID','.next/server/app/sun/page.js','.next/server/app/me/page.js','.next/server/app/login/page.js'])compiled[p]=digest(await readFile(join(web,p)));
 return{head,tree,trackedFiles:rows.length,sourceManifestSha256:digest(JSON.stringify(rows)),compiled};
}
async function fixture(path){const response=await fetch(api+path,{signal:AbortSignal.timeout(3000),redirect:'error',credentials:'omit'});assert.equal(response.status,200);const body=await response.json();if(path==='/qa-state')assert.ok(body.protocol==='nexid.sun-claim-portal-fixture.v1'&&body.runId===runId&&body.synthetic===true,'Owned fixture identity mismatch');return body;}
const before=await sourceBinding(),initialFixture=await fixture('/qa-state');assert.equal(initialFixture.forbidden.length,0);
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
const report={schema:'nexid.sun-claim-portal-browser.v1',status:'failed',localOnly:true,actualNextAndBff:true,realProductionBuild:true,syntheticApiAndIdentity:true,realAuthenticationCertified:false,physicalTapMeasured:false,customerOperationsCertified:false,providerCalls:0,sourceBefore:before,views:[],checks:[],unexpected:[],forbiddenWrites:[],telemetryFixturePosts:[],browserClosed:false};
const check=(ok,name)=>{report.checks.push({name,passed:Boolean(ok)});assert.ok(ok,name);};
const labels={'es-AR':{action:'Continuar en mi cuenta',help:'Pedir ayuda a la marca',title:'Solicitar titularidad'},en:{action:'Continue in my account',help:'Ask the brand for help',title:'Request ownership'},'pt-BR':{action:'Continuar na minha conta',help:'Pedir ajuda à marca',title:'Solicitar titularidade'}};
const contexts=new Set();let browser=null;
const forbidden=/^\/api\/(?:public-cta\/(?:claim-ownership|receipt-ocr|report-problem|tokenize-request|register-warranty)|consumer\/auth\/|mobile\/passport\/|leads(?:\/|$)|sommelier(?:\/|$))/;
async function openView(state,width,theme,locale='es-AR',{authenticated=true,handoff='normal',ttl=300}={}){
 const issued=await fixture('/qa-issue?state='+encodeURIComponent(state==='demo'?'closed':state)+'&ttl='+ttl);
 const entry={id:report.views.length+1,state,width,theme,locale,handoff,authenticated,checks:0,handoffs:0,requests:[],geoCalls:0,passed:false};report.views.push(entry);
 const context=await browser.newContext({viewport:{width,height:844},locale,reducedMotion:'reduce',serviceWorkers:'block'});contexts.add(context);
 if(authenticated)await context.addCookies([{name:'consumer_qa',value:'local',url:base,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();page.setDefaultTimeout(15000);let holdRelease=null,navRelease=null;
 await page.addInitScript(theme=>{window.__claimPortalGeoCalls=0;Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){window.__claimPortalGeoCalls++;throw Error('Unexpected automatic geolocation');}}});window.WebSocket=class{constructor(){throw Error('WebSocket forbidden in owned gateway QA');}};document.addEventListener('DOMContentLoaded',()=>{document.documentElement.dataset.theme=theme;document.documentElement.classList.toggle('theme-light',theme==='light');document.documentElement.classList.toggle('theme-dark',theme==='dark');},{once:true});},theme);
 page.on('pageerror',error=>report.unexpected.push({view:entry.id,kind:'pageerror',sha256:digest(error.message)}));
 await page.route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url()),method=request.method();
  if(u.origin!==base){report.unexpected.push({view:entry.id,kind:'external_request',hostSha256:digest(u.hostname)});return route.abort();}
  entry.requests.push({path:u.pathname,method,resource:request.resourceType()});
  if(method==='POST'&&u.pathname==='/api/consumer/tap-handoff'){
   entry.handoffs++;const body=request.postDataJSON();check(body?.eventId===issued.eventId&&body?.freshToken===issued.token&&Object.keys(body).sort().join(',')==='eventId,freshToken','Handoff carries only exact synthetic event and capability');
   if(handoff==='double'||handoff==='timeout')await new Promise(done=>{holdRelease=done;});
   if(handoff==='503')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'synthetic_unavailable'})});
   if(handoff==='malformed')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true})});
   if(handoff==='wrong-event')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,eventId:'910099999'})});
   return route.continue().catch(()=>undefined);
  }
  if(forbidden.test(u.pathname)&&method!=='GET'&&method!=='HEAD'){report.forbiddenWrites.push({view:entry.id,path:u.pathname,method});return route.abort();}
  if(method==='POST'&&['/api/public-cta/experience-event','/api/sun-context'].includes(u.pathname)){report.telemetryFixturePosts.push({view:entry.id,path:u.pathname});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,qaOnly:true})});}
  if(method==='POST'&&u.pathname==='/api/sun/locale')return route.continue();
  if(!['GET','HEAD'].includes(method)){report.forbiddenWrites.push({view:entry.id,path:u.pathname,method});return route.abort();}
  if(handoff==='navigation-held'&&u.pathname==='/me')await new Promise(done=>{navRelease=done;});
  if(u.pathname==='/qa-product.svg')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320"><rect width="240" height="320" fill="#183c35"/></svg>'});
  return route.continue();
 });
 const query=new URLSearchParams({snapshot:issued.eventId,trace:'qa-claim-portal',access:'qa-only',lang:locale});
 if(!['snapshot','qr','missing-fresh','demo'].includes(state))query.set('fresh',issued.token);
 const url=state==='demo'?base+'/sun?demo=1&lang='+locale:state==='qr'?base+'/sun?qr=1&bid=QA-ONLY&lang='+locale:base+'/sun?'+query;
 await page.goto(url,{waitUntil:'load',timeout:90000});
 const portal=page.getByTestId('sun-claim-portal');
 if(state!=='demo'){
  // The production tool loads only when reached. Exercise the same scroll as a
  // customer instead of waiting for an off-screen deferred component to exist.
  await page.locator('#protected-actions').scrollIntoViewIfNeeded();
  await portal.waitFor({state:'visible',timeout:30000});
 }
 await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.documentElement.classList.toggle('theme-light',theme==='light');document.documentElement.classList.toggle('theme-dark',theme==='dark');},theme);
 return{entry,context,page,portal,issued,releaseHandoff:()=>holdRelease?.(),releaseNavigation:()=>navRelease?.()};
}
async function assess(t,name){
 const region=t.portal;if(await region.count()){
  await region.scrollIntoViewIfNeeded();const geometry=await region.evaluate(el=>{const r=el.getBoundingClientRect();return{within:r.left>=-1&&r.right<=innerWidth+1,overflow:document.documentElement.scrollWidth>innerWidth+1};});check(geometry.within&&!geometry.overflow,'New claim region fits mobile viewport');
  await t.page.addScriptTag({content:axe});const a=await t.page.evaluate(async()=>{const result=await axe.run('[data-testid="sun-claim-portal"]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return{violations:result.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})),incomplete:result.incomplete.map(v=>v.id)};});t.entry.axe=a;check(a.violations.length===0,'No WCAG violations in the new claim region');
 }
 const file='view-'+t.entry.id+'-'+name+'-'+t.entry.width+'-'+t.entry.theme+'.png';await t.page.screenshot({path:join(output,file)});t.entry.screenshot={file,sha256:digest(await readFile(join(output,file)))};
}
async function privacy(t){
 check(!new URL(t.page.url()).searchParams.has('fresh')&&!new URL(t.page.url()).searchParams.has('fresh_token'),'Hydrated SUN or account URL is capability-free');
 check(!t.page.url().includes(t.issued.token),'Destination URL does not contain the synthetic capability');
 const safe=await t.page.evaluate(token=>!document.cookie.includes(token)&&!JSON.stringify({...localStorage}).includes(token)&&!JSON.stringify({...sessionStorage}).includes(token),t.issued.token);check(safe,'Capability is absent from JavaScript cookies and browser storage');
 t.entry.geoCalls=await t.page.evaluate(()=>window.__claimPortalGeoCalls||0);check(t.entry.geoCalls===0,'Gateway does not request geolocation');
}
async function closeView(t){t.releaseHandoff();t.releaseNavigation();await privacy(t);t.entry.passed=true;await t.context.close();contexts.delete(t.context);}
async function help(t,expected){
 const link=t.portal.getByTestId('sun-claim-help');check(await link.count()===(expected?1:0),'Help reflects actual support availability');
 if(expected){check(await link.getAttribute('href')==='#report-problem','Help uses the existing report form');const old=t.entry.requests.filter(x=>x.method==='POST').length;await link.click();await t.page.getByTestId('report-problem-form').locator('#report-description').waitFor();check(new URL(t.page.url()).hash==='#report-problem','Help opens the exact existing form');check(t.entry.requests.filter(x=>x.method==='POST'&&x.path==='/api/public-cta/report-problem').length===0,'Opening help never submits a report');check(t.entry.handoffs===0,'Help does not prepare a claim handoff');}
}
async function positive(t,double=false){
 check(await t.portal.getAttribute('data-claim-available')==='true','Fresh allowed claim offers account navigation');
 const button=t.portal.getByRole('button',{name:labels[t.entry.locale].action,exact:true});await button.waitFor();check(await button.isEnabled(),'Primary claim entry is enabled only after hydration');
 await button.scrollIntoViewIfNeeded();const hit=await button.evaluate(el=>{const r=el.getBoundingClientRect(),h=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return{height:r.height,width:r.width,hit:h===el||el.contains(h),x:(r.left+r.right)/2,y:(r.top+r.bottom)/2};});check(hit.hit&&hit.width>=44&&hit.height>=44,'Primary claim target is unobstructed and touch-sized');
 const responsePromise=t.page.waitForResponse(r=>new URL(r.url()).pathname==='/api/consumer/tap-handoff',{timeout:12000});
 if(double){await t.page.mouse.dblclick(hit.x,hit.y);await t.page.waitForTimeout(150);check(t.entry.handoffs===1&&new URL(t.page.url()).pathname==='/sun','Rapid natural double click prepares once while pending');t.releaseHandoff();}else{await button.focus();await t.page.keyboard.press('Enter');}
 const response=await responsePromise,receipt=await response.json();
 t.entry.handoffReceipt={status:response.status(),ok:receipt?.ok===true,eventMatches:receipt?.eventId===t.issued.eventId,error:typeof receipt?.error==='string'&&/^[a-z_]{1,80}$/.test(receipt.error)?receipt.error:null};
 check(response.status()===200&&receipt?.ok===true&&receipt?.eventId===t.issued.eventId,'Real BFF handoff accepted: '+JSON.stringify(t.entry.handoffReceipt));
 await t.page.waitForURL(u=>u.pathname==='/me'&&u.searchParams.get('action')==='claim',{timeout:60000});
 const u=new URL(t.page.url());check(u.searchParams.get('fromTap')==='1'&&u.searchParams.get('eventId')===t.issued.eventId&&u.searchParams.get('tenant')==='qa-brand','Exact account destination retains canonical claim context');
 check([...u.searchParams.keys()].every(k=>['fromTap','eventId','tenant','bid','action','lang'].includes(k)),'Account query contains no capability or private credential');check(t.entry.handoffs===1,'One successful handoff reaches the real account route');
 const selected=t.page.locator('input[name="tap-association-action"][value="claim"]');await selected.waitFor();check(await selected.isChecked(),'Portal claim is preselected without confirming it');
 check(t.entry.requests.filter(x=>x.method==='POST'&&forbidden.test(x.path)).length===0,'Navigation never submits a business, OTP or OCR action');
}
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 for(const width of [320,390])for(const theme of ['light','dark'])for(const state of ['closed','opened','manual','qr','snapshot','demo']){
  const t=await openView(state,width,theme,'es-AR',{handoff:state==='closed'&&width===320&&theme==='dark'?'double':'normal'});
  if(state==='demo'){check(await t.portal.count()===0,'Demo does not offer a privileged claim gateway');check(t.entry.handoffs===0,'Demo has no handoff');await assess(t,'demo');}
  else{await assess(t,state);check(await t.portal.locator('input[type="file"],input[autocomplete="one-time-code"]').count()===0,'Public gateway no longer requests a receipt or OTP');await help(t,!['qr'].includes(state));if(['closed','opened'].includes(state))await positive(t,t.entry.handoff==='double');else{check(await t.portal.getAttribute('data-claim-available')==='false','Non-actionable source does not enable privileged claim navigation');check(t.entry.handoffs===0,'Protected source never hands off a claim');}}
  await closeView(t);
 }
 for(const width of [320,390])for(const theme of ['light','dark']){
  const t=await openView('blocked',width,theme);check(await t.portal.getAttribute('data-claim-available')==='false','Explicit blocked claim overrides otherwise fresh source');check(t.entry.handoffs===0,'Blocked action never prepares access');await assess(t,'blocked');await closeView(t);
 }
 for(const locale of ['en','pt-BR'])for(const theme of ['light','dark'])for(const state of ['closed','opened']){
  const t=await openView(state,390,theme,locale);await t.portal.getByRole('heading',{name:labels[locale].title,exact:true}).waitFor();await assess(t,state+'-'+locale);await positive(t);await closeView(t);
 }
 for(const kind of ['503','malformed','wrong-event','expired','timeout','navigation-held']){
  const t=await openView('closed',390,'dark','es-AR',{handoff:kind,ttl:kind==='expired'?30:300});await assess(t,'handoff-'+kind);
  const button=t.portal.getByRole('button',{name:labels['es-AR'].action,exact:true});await button.waitFor();
  if(kind==='expired')await t.page.waitForTimeout(Math.max(0,t.issued.expiresAt-Date.now()+100));
  await button.click();
  if(kind==='navigation-held'){
   await t.portal.locator('[data-handoff-navigation="delayed"]').waitFor({timeout:12000});check(t.entry.handoffs===1,'Delayed navigation does not prepare twice');check(new URL(t.page.url()).pathname==='/sun','No destination commitment while navigation is held');t.releaseNavigation();await t.page.waitForURL(u=>u.pathname==='/me',{timeout:30000});
  }else{
   await t.portal.getByRole('alert').waitFor({timeout:12000});await t.page.waitForTimeout(300);check(t.entry.handoffs===1&&new URL(t.page.url()).pathname==='/sun','Failed handoff stays on SUN without automatic retry');
   check(await t.portal.getByRole('link',{name:'Abrir mis productos guardados',exact:true}).getAttribute('href')==='/me/products','Failure offers a read-only route to saved products');t.releaseHandoff();
  }
  await closeView(t);
 }
 const noSupport=await openView('no-support',390,'light');await help(noSupport,false);await assess(noSupport,'no-support');await closeView(noSupport);
 const missing=await openView('missing-fresh',390,'dark');check(await missing.portal.getAttribute('data-claim-available')==='false','Missing capability cannot degrade into an ordinary privileged claim link');check(missing.entry.handoffs===0,'Missing capability never hands off');await assess(missing,'missing-fresh');await closeView(missing);
 const anonymous=await openView('closed',390,'light','es-AR',{authenticated:false});await anonymous.portal.getByRole('button',{name:labels['es-AR'].action,exact:true}).click();await anonymous.page.waitForURL(u=>u.pathname==='/login',{timeout:60000});check(anonymous.entry.handoffs===1,'Anonymous account flow prepares once and uses normal login');check(anonymous.entry.requests.filter(x=>x.method==='POST'&&/\/auth\//.test(x.path)).length===0,'Opening login sends no OTP');await closeView(anonymous);
 const finalState=await fixture('/qa-state');check(finalState.forbidden.length===0,'Synthetic upstream observed no business or unknown API request');check(report.forbiddenWrites.length===0,'No claim, OCR, OTP or report submission from gateway QA');check(report.unexpected.length===0,'No external or application errors');report.status='passed';
}catch(error){report.failure={name:error?.name||'Error',messageSha256:digest(String(error?.message||''))};throw error;}
finally{
 for(const context of contexts)await context.close().catch(()=>{});await browser?.close().catch(()=>{});report.browserClosed=true;
 try{report.sourceAfter=await sourceBinding();report.sourceStable=JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceAfter);if(!report.sourceStable)report.status='failed';}catch(error){report.sourceStable=false;report.status='failed';}
 report.observedViews=report.views.length;report.passedViews=report.views.filter(v=>v.passed).length;report.completedAt=new Date().toISOString();await writeFile(join(output,'sun-claim-portal-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 process.stdout.write(JSON.stringify({status:report.status,views:report.observedViews,passedViews:report.passedViews,checks:report.checks.length,forbiddenWrites:report.forbiddenWrites.length,unexpected:report.unexpected.length,sourceStable:report.sourceStable,output})+'\n');
 if(report.status!=='passed')process.exitCode=1;
}
