// Actual association component, models and native CSS. Browser/Next navigation
// hooks and transport are explicit local fixtures, never a session/TAP proof.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build,stop} from 'esbuild';

assert.ok(process.env.PLAYWRIGHT_MODULE && process.env.CHROME_PATH && process.env.AXE_MODULE_PATH && process.env.QA_OUTPUT,
  'Use explicitly installed tools and a new QA_OUTPUT; this harness never downloads tools');
const mode=process.env.QA_TAP_REAUTH_MODE || 'guarded';
assert.ok(['guarded','unsafe-baseline'].includes(mode),'Unknown QA_TAP_REAUTH_MODE');
const guarded=mode==='guarded',web=fileURLToPath(new URL('../',import.meta.url)),root=resolve(web,'../..'),output=resolve(process.env.QA_OUTPUT);
assert.ok(output!==root && !output.startsWith(root+'\\') && !output.startsWith(root+'/'),'QA_OUTPUT must be outside the worktree');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
const hash=value=>createHash('sha256').update(value).digest('hex');
const sourcePaths=['apps/web/src/app/me/_components/tap-association-banner.tsx','apps/web/src/app/me/_components/tap-association-banner.module.css',
  'apps/web/src/app/me/_components/tap-association-model.ts','apps/web/src/app/me/_components/tap-association-copy.ts',
  'apps/web/src/app/me/_components/portal-shell.module.css','apps/web/src/app/login/consumer-login-continuation.ts','packages/config/src/safe-return-path.ts'];
async function sourceHashes(){return Object.fromEntries(await Promise.all(sourcePaths.map(async path=>[path,hash(await readFile(join(root,path)))])));}
const sourceBefore=await sourceHashes();
const target='/me/marketplace?fromTap=1&eventId=715&bid=LOT-QA&tenant=brand.a&action=marketplace';
const navigation=`import{useSyncExternalStore}from'react';
const subscribe=fn=>{window.addEventListener('qa-navigation',fn);window.addEventListener('popstate',fn);return()=>{window.removeEventListener('qa-navigation',fn);window.removeEventListener('popstate',fn);}};
export function usePathname(){return useSyncExternalStore(subscribe,()=>location.pathname,()=>'/me/marketplace');}
export function useSearchParams(){const query=useSyncExternalStore(subscribe,()=>location.search,()=>'');return new URLSearchParams(query);}
export function useRouter(){return{refresh(){window.__tapQaRefreshes++;},replace(path){history.replaceState(null,'',path);window.dispatchEvent(new Event('qa-navigation'));},push(path){window.__tapQaNavigate(path);}};}`;
const entry=`import'tailwindcss/preflight.css';import React from'react';import{createRoot}from'react-dom/client';import{TapAssociationBanner}from'./src/app/me/_components/tap-association-banner';import portalStyles from'./src/app/me/_components/portal-shell.module.css';
window.__tapQaRefreshes=0;window.__tapQaNavigate=path=>{history.pushState(null,'',path);window.dispatchEvent(new Event('qa-navigation'));};
createRoot(document.getElementById('root')).render(<div className={'consumer-portal-root '+portalStyles.portal}><main className={portalStyles.main}><h1>Catálogo sintético de la marca</h1><TapAssociationBanner/></main></div>);`;
const bundle=await build({stdin:{contents:entry,loader:'tsx',resolveDir:web},bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',
  define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},logLevel:'silent',plugins:[{name:'explicit-navigation-fixture',setup(builder){
    builder.onResolve({filter:/^next\/(navigation|link)$/},args=>({path:args.path,namespace:'tap-qa'}));
    builder.onLoad({filter:/.*/,namespace:'tap-qa'},args=>({contents:args.path==='next/navigation'?navigation:"import React from 'react';export default function Link({children,prefetch,...props}){return React.createElement('a',props,children);}",loader:'js',resolveDir:web}));
    builder.onResolve({filter:/^@product\/config\/safe-return-path$/},()=>({path:join(root,'packages/config/src/safe-return-path.ts')}));
  }}]});
const script=bundle.outputFiles.find(file=>file.path.endsWith('.js')).contents;
const css=(bundle.outputFiles.find(file=>file.path.endsWith('.css'))?.text || '')+'\nbody{margin:0;font-family:system-ui,sans-serif}';
await mkdir(output,{recursive:true});await writeFile(join(output,'run-owner.json'),JSON.stringify({mode,qaSource:process.env.QA_SOURCE||null,createdAt:new Date().toISOString()})+'\n',{flag:'wx'});
const report={schema:'nexid.consumer-tap-reauth.v1',mode,passed:false,regressionPassed:false,baselineDefectReproduced:false,releaseAcceptanceEligible:false,
  actualAssociationComponent:true,actualModels:true,nativeComponentAndPortalCss:true,syntheticNavigationHooks:true,syntheticTransport:true,
  actualNextServer:false,realAuthentication:false,realEmailOrWhatsAppDelivery:false,realTenantSynchronization:false,realDatabase:false,physicalTap:false,
  qaSource:process.env.QA_SOURCE||null,sourceBefore,sourceAfter:null,checks:[],cases:[],serverRequests:[],blockedRequests:[],errors:[],geolocationCalls:0,
  closure:{contexts:false,browser:false,server:false,esbuild:false}};
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://fixture.invalid');report.serverRequests.push({method:req.method,path:url.pathname});
  if(req.method!=='GET'){res.writeHead(405);return res.end();}
  if(url.pathname==='/fixture.js'){res.setHeader('content-type','text/javascript');return res.end(script);}
  if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
  if(!['/me/marketplace','/me/products'].includes(url.pathname)){res.writeHead(404);return res.end();}
  const theme=url.searchParams.get('theme')==='dark'?'dark':'light',locale=['es-AR','en','pt-BR'].includes(url.searchParams.get('locale'))?url.searchParams.get('locale'):'es-AR';res.setHeader('content-type','text/html;charset=utf-8');
  res.end('<!doctype html><html lang="'+locale+'" class="theme-'+theme+'" data-theme="'+theme+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TAP · QA local</title><style>'+css+'</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
});
let browser,origin;const contexts=new Set();
function check(value,description){report.checks.push({description,passed:Boolean(value)});assert.ok(value,description);}
const settle=page=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
async function choose(page,action){const choice=page.getByTestId('tap-association-option-'+action);if(!await choice.isVisible())await page.getByTestId('tap-association').locator('fieldset details > summary').click();await choice.check();return choice;}
async function open(width,theme,scenario,{active=false,status=200,held=false,locale='es-AR'}={}){
  const context=await browser.newContext({viewport:{width,height:1000},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'});contexts.add(context);
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const row={width,theme,locale,scenario,posts:[],sessions:[],passed:false};report.cases.push(row);let releasePost;
  const postGate=new Promise(done=>{releasePost=done;});
  page.on('pageerror',error=>report.errors.push({width,theme,scenario,message:error.message}));
  await context.exposeBinding('__tapQaLocation',()=>{report.geolocationCalls++;});
  await page.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){void window.__tapQaLocation();throw Error('Unexpected GPS request');},watchPosition(){void window.__tapQaLocation();throw Error('Unexpected GPS watch');}}});});
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin===origin && request.method()==='GET' && url.pathname==='/api/consumer/session'){
      row.sessions.push({method:'GET',path:url.pathname,status:active?200:401});return route.fulfill({status:active?200:401,json:active?{ok:true,authenticated:true}:{ok:false}});
    }
    if(url.origin===origin && request.method()==='POST' && /^\/api\/mobile\/passport\/715\/(consumer\/(save-product|join-tenant|claim)|loyalty\/enroll)$/.test(url.pathname)){
      row.posts.push({method:'POST',path:url.pathname,body:request.postDataJSON()});if(held)await postGate;
      return route.fulfill({status,json:status===401?{ok:false,error:'unauthorized'}:{ok:true,saved:true,eventId:715}});
    }
    if(url.origin===origin && request.method()==='GET' && ['/me/marketplace','/me/products','/fixture.js','/favicon.ico'].includes(url.pathname))return route.continue();
    report.blockedRequests.push({scenario,method:request.method(),origin:url.origin,path:url.pathname});return route.abort();
  });
  // Theme is test-only metadata and is deliberately stripped from reauth next.
  await page.goto(origin+target+'&theme='+theme+'&locale='+locale,{waitUntil:'networkidle'});await page.getByTestId('tap-association').waitFor();
  await (active?page.getByTestId('tap-association-option-save'):page.getByTestId('tap-association-login')).waitFor();await settle(page);
  return{context,page,row,releasePost,async close(){releasePost();await context.close();contexts.delete(context);}};
}
try{
  await new Promise(done=>server.listen(0,'127.0.0.1',done));origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
  const variants=[...[320,390,1280].flatMap(width=>['light','dark'].map(theme=>({width,theme,locale:'es-AR'}))),...['en','pt-BR'].flatMap(locale=>['light','dark'].map(theme=>({width:390,theme,locale})))];
  for(const {width,theme,locale} of variants)for(const action of ['save','join','claim','rewards']){
    const f=await open(width,theme,'expired-session-'+action,{locale}),{page,row}=f;
    check(row.sessions.length===1 && row.sessions[0].status===401,`${width}/${theme}/${action}: actual banner independently observes the synthetic expired session`);
    await choose(page,action);if(action==='claim')await page.getByTestId('tap-association-claim-pin').fill('P'.repeat(128));
    const href=new URL(await page.getByTestId('tap-association-login').getAttribute('href'),origin),returned=href.searchParams.get('next'),expected=target+'&tapAction='+action;
    Object.assign(row,{selected:action,href:href.pathname+href.search,returned,expected,returnPreserved:returned===expected});
    if(guarded)check(row.returnPreserved,`${width}/${theme}/${action}: reauth retains catalog, navigation action and explicit choice`);
    else check(returned!==expected && new URL(returned,origin).pathname==='/me',`${width}/${theme}/${action}: baseline records the original loss of catalog destination`);
    check(await page.getByTestId('tap-association-option-'+action).isChecked(),`${width}/${theme}/${action}: selection is explicit and remains visible`);
    check(!/P{128}|pin=|theme=|locale=/.test(returned),`${width}/${theme}/${action}: transient PIN and fixture metadata never enter next`);
    check(row.posts.length===0,`${width}/${theme}/${action}: selection and expired-session recovery cause zero business POSTs`);
    await page.addScriptTag({content:axe});row.violations=await page.evaluate(async()=>(await axe.run('[data-testid="tap-association"]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact})));
    check(row.violations.every(v=>!['critical','serious'].includes(v.impact)),`${width}/${theme}/${action}: no serious association accessibility violations`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}/${theme}/${action}: no horizontal overflow`);
    if(action==='claim'){row.screenshot=`expired-claim-${width}-${theme}-${locale}.png`;await page.screenshot({path:join(output,row.screenshot),fullPage:true});}
    row.passed=true;await f.close();
  }
  for(const {width,theme,locale} of variants){
    const f=await open(width,theme,'post-401-reauth',{active:true,status:401,locale}),{page,row}=f;
    await choose(page,'claim');await page.getByTestId('tap-association-claim-pin').fill('P'.repeat(128));await page.getByTestId('tap-association-confirm').click();
    await page.getByTestId('tap-association-login').waitFor();const returned=new URL(await page.getByTestId('tap-association-login').getAttribute('href'),origin).searchParams.get('next');
    Object.assign(row,{returned,returnPreserved:returned===target+'&tapAction=claim'});
    if(guarded)check(row.returnPreserved,`${width}/${theme}: authoritative POST 401 still retains navigation and the submitted choice`);
    else check(!row.returnPreserved,`${width}/${theme}: baseline POST 401 reproduces lost destination`);
    check(row.posts.length===1 && row.posts[0].body.pin==='P'.repeat(128),`${width}/${theme}: one deliberate claim POST carries the bounded PIN only in its body`);
    check(await page.getByTestId('tap-association-claim-pin').inputValue()==='',`${width}/${theme}: submitted PIN is cleared before reauth`);
    check(!/P{128}|pin=/.test(returned),`${width}/${theme}: PIN never enters reauth return`);await settle(page);check(row.posts.length===1,`${width}/${theme}: 401 never causes an automatic rePOST`);
    row.passed=true;await f.close();
    const completed=await open(width,theme,'completed-scope-stable',{active:true,locale}),p=completed.page;
    await choose(p,'save');await p.getByTestId('tap-association-confirm').click();await p.getByTestId('tap-association-result-save').waitFor();
    await p.evaluate(path=>window.__tapQaNavigate(path),target.replace('/me/marketplace','/me/products').replace('action=marketplace','action=products')+'&tapAction=claim');await settle(p);
    completed.row.resultRetained=await p.getByTestId('tap-association-result-save').count()===1;
    if(guarded)check(completed.row.resultRetained,`${width}/${theme}: route/selector changes never remount a completed action runner`);
    else check(!completed.row.resultRetained,`${width}/${theme}: baseline records completed result reset by cosmetic intent`);
    await choose(p,'save');const confirm=p.getByTestId('tap-association-confirm');await confirm.waitFor();
    if(guarded){check(await confirm.isDisabled(),`${width}/${theme}: completed save remains terminal after URL intent changes`);await confirm.evaluate(button=>button.click());}
    await settle(p);await p.waitForLoadState('networkidle');
    check(completed.row.posts.length===1,`${width}/${theme}: navigation and terminal confirm cause no repeated save`);
    if(guarded)check(completed.row.sessions.length===1,`${width}/${theme}: UI intent changes do not reset the session effect`);
    completed.row.passed=true;await completed.close();
  }
  report.sourceAfter=await sourceHashes();assert.deepEqual(report.sourceAfter,sourceBefore,'source remains unchanged');
  check(report.cases.length===60 && report.cases.every(row=>row.passed),'all planned native fixture scenarios completed');
  check(report.errors.length===0 && report.blockedRequests.length===0 && report.geolocationCalls===0,'no client exceptions, unexpected requests or GPS');
  check(report.serverRequests.every(row=>row.method==='GET'),'every API request was intercepted before the local server');
  report.passed=true;report.regressionPassed=guarded;report.baselineDefectReproduced=!guarded && report.cases.every(row=>row.returnPreserved===false || row.resultRetained===false);
}catch(error){report.failure=String(error.stack||error);process.exitCode=1;}
finally{
  for(const context of contexts)await context.close();contexts.clear();report.closure.contexts=true;
  if(browser){await browser.close();report.closure.browser=true;}server.closeAllConnections();if(server.listening)await new Promise(done=>server.close(done));report.closure.server=!server.listening;
  stop();report.closure.esbuild=true;report.completedAt=new Date().toISOString();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({mode,passed:report.passed,regressionPassed:report.regressionPassed,baselineDefectReproduced:report.baselineDefectReproduced,checks:report.checks.length,cases:report.cases.length,failure:report.failure,closure:report.closure}));
}
