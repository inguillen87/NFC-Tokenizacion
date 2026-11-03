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
  'apps/web/src/app/me/_components/consumer-bounded-fetch.ts','apps/web/src/app/sun/tenant-action-availability.ts',
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
const programFixtureIds=new Set(['715','716','9007199254740992','9007199254740993','9223372036854775806','9223372036854775807']);
const programFixture=(tenant='brand.a',program=true,publication='published')=>({ok:true,configuration:{version:'nexid.tenant-actions.v1',status:publication,allowedActions:[],catalogAvailable:false,tenantSlug:tenant,trivia:null,
  program:program?{id:'30000000-0000-4000-8000-000000000001',name:'Programa local configurado',pointsName:'Puntos de ensayo',pointsPerValidTap:0}:null}});
async function open(width,theme,scenario,{active=false,status=200,held=false,locale='es-AR',program='active',eventId='715',preferred=null,postReply=null,postMode='json'}={}){
  assert(programFixtureIds.has(eventId));assert(['active','active-unpublished','none','unavailable','wrong-tenant','malformed'].includes(program));
  assert(['json','lost','malformed','rate-limit-sequence'].includes(postMode));
  const context=await browser.newContext({viewport:{width,height:1000},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'});contexts.add(context);
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const row={width,theme,locale,scenario,posts:[],sessions:[],programReads:[],passed:false};report.cases.push(row);let releasePost,programMode=program;
  const postGate=new Promise(done=>{releasePost=done;});
  page.on('pageerror',error=>report.errors.push({width,theme,scenario,message:error.message}));
  await context.exposeBinding('__tapQaLocation',()=>{report.geolocationCalls++;});
  await page.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){void window.__tapQaLocation();throw Error('Unexpected GPS request');},watchPosition(){void window.__tapQaLocation();throw Error('Unexpected GPS watch');}}});});
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin===origin && request.method()==='GET' && url.pathname==='/api/consumer/session'){
      row.sessions.push({method:'GET',path:url.pathname,status:active?200:401});return route.fulfill({status:active?200:401,json:active?{ok:true,authenticated:true}:{ok:false}});
    }
    const configurationId=/^\/api\/public\/passport\/([1-9][0-9]*)\/configuration$/.exec(url.pathname)?.[1];
    if(url.origin===origin && request.method()==='GET' && configurationId && programFixtureIds.has(configurationId) && !url.search){
      const mode=programMode,responseStatus=mode==='unavailable'?503:200;
      row.programReads.push({method:'GET',path:url.pathname,eventId:configurationId,mode,status:responseStatus});
      return route.fulfill({status:responseStatus,json:mode==='unavailable'?{ok:false}:mode==='malformed'?{ok:true,configuration:{}}:programFixture(mode==='wrong-tenant'?'foreign-brand':'brand.a',mode!=='none',mode==='active-unpublished'?'unpublished':'published')});
    }
    const actionMatch=/^\/api\/mobile\/passport\/([1-9][0-9]*)\/(consumer\/(save-product|join-tenant|claim)|loyalty\/enroll)$/.exec(url.pathname);
    if(url.origin===origin && request.method()==='POST' && actionMatch && programFixtureIds.has(actionMatch[1])){
      row.posts.push({method:'POST',path:url.pathname,body:request.postDataJSON()});if(held)await postGate;
      if(postMode==='lost'){row.ownedTransportFailure='aborted';return route.abort('aborted');}
      if(postMode==='malformed'){row.ownedTransportFailure='invalid-json';return route.fulfill({status,contentType:'application/json',body:'{'});}
      if(postMode==='rate-limit-sequence'){
        assert.equal(actionMatch[2],'consumer/save-product');assert(['715','716'].includes(actionMatch[1]));
        const attempt=row.posts.filter(post=>post.path===url.pathname).length;
        assert(attempt<=(actionMatch[1]==='715'?2:1),'bounded explicit rate-limit sequence');
        const response=actionMatch[1]==='716'?{status:429,payload:{ok:false,reason:'upstream_busy'}}:
          attempt===1?{status:429,payload:{ok:false,reason:'rate_limited'}}:{status:200,payload:{ok:true,saved:true,eventId:715}};
        (row.rateLimitReplies??=[]).push({eventId:actionMatch[1],attempt,...response});
        return route.fulfill({status:response.status,json:response.payload});
      }
      return route.fulfill({status,json:postReply??(status===401?{ok:false,error:'unauthorized'}:{ok:true,saved:true,eventId:actionMatch[1]==='715'?715:actionMatch[1]})});
    }
    if(url.origin===origin && request.method()==='GET' && ['/me/marketplace','/me/products','/fixture.js','/favicon.ico'].includes(url.pathname))return route.continue();
    report.blockedRequests.push({scenario,method:request.method(),origin:url.origin,path:url.pathname});return route.abort();
  });
  // Theme is test-only metadata and is deliberately stripped from reauth next.
  await page.goto(origin+target.replace('eventId=715','eventId='+eventId)+(preferred?'&tapAction='+preferred:'')+'&theme='+theme+'&locale='+locale,{waitUntil:'networkidle'});await page.getByTestId('tap-association').waitFor();
  await (active?page.getByTestId(preferred?'tap-association-confirm':'tap-association-option-save'):page.getByTestId('tap-association-login')).waitFor();await settle(page);
  return{context,page,row,releasePost,setProgram(mode){assert(['active','active-unpublished','none','unavailable','wrong-tenant','malformed'].includes(mode));programMode=mode;},async close(){releasePost();await context.close();contexts.delete(context);}};
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
  // Same real association component, native inputs and CSS; no Next server or live capability is claimed.
  if(guarded)for(const width of [320,390])for(const theme of ['light','dark']){
    const missing=await open(width,theme,'program-known-missing',{active:true,program:'none',preferred:'rewards'}),p=missing.page;
    check(missing.row.programReads.length===1,`${theme}: programme availability requires one exact event GET`);
    check(await p.getByTestId('tap-association-option-rewards').isChecked()&&await p.getByTestId('tap-association-option-rewards').isDisabled(),`${theme}: missing programme retains intent without enabling enrollment`);
    check(await p.getByTestId('tap-association-confirm').isDisabled()&&missing.row.posts.length===0,`${theme}: known missing programme sends no POST`);
    check((await p.getByTestId('tap-association').innerText()).includes('no tiene un programa de beneficios activo'),`${theme}: known absence is distinguished from a failed read`);
    await p.addScriptTag({content:axe});missing.row.violations=await p.evaluate(async()=>(await axe.run('[data-testid="tap-association"]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact})));
    check(missing.row.violations.every(v=>!['critical','serious'].includes(v.impact)),`${theme}: unavailable programme controls retain accessibility`);
    check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}/${theme}: programme absence fits the mobile viewport`);
    missing.row.screenshot=`programme-missing-${width}-${theme}.png`;await p.screenshot({path:join(output,missing.row.screenshot),fullPage:true});
    missing.row.passed=true;await missing.close();
    const failed=await open(width,theme,'program-failure-explicit-retry',{active:true,program:'unavailable',preferred:'rewards',status:404,postReply:{ok:false,error:'no_active_program'}}),q=failed.page;
    check(failed.row.programReads.length===1&&await q.getByTestId('tap-association-confirm').isDisabled(),`${theme}: failed configuration stays unavailable`);
    check((await q.getByTestId('tap-association').innerText()).includes('No pudimos consultar los beneficios')&&!(await q.getByTestId('tap-association').innerText()).includes('no tiene un programa de beneficios activo'),`${theme}: failed GET never becomes no-programme`);
    check(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}/${theme}: retry feedback fits the mobile viewport`);
    failed.row.screenshot=`programme-unavailable-${width}-${theme}.png`;await q.screenshot({path:join(output,failed.row.screenshot),fullPage:true});
    failed.setProgram('active-unpublished');await q.getByTestId('tap-association-program-retry').evaluate(button=>{button.click();button.click();});
    await q.waitForFunction(()=>!document.querySelector('[data-testid="tap-association-confirm"]')?.disabled);
    check(failed.row.programReads.length===2&&failed.row.posts.length===0,`${theme}: same-turn explicit recheck is singleflight and never enrolls`);
    await q.getByTestId('tap-association-confirm').click();await q.getByTestId('tap-association-result-rewards').waitFor();
    check(failed.row.posts.length===1&&await q.getByTestId('tap-association-result-rewards').getAttribute('data-outcome')==='no_program',`${theme}: active programme advisory cannot overrule a later authoritative denial`);
    await q.getByTestId('tap-association-confirm').evaluate(button=>button.click());await settle(q);
    check(failed.row.posts.length===1&&await q.getByTestId('tap-association-confirm').isDisabled(),`${theme}: terminal result cannot be reposted`);
    await q.evaluate(path=>window.__tapQaNavigate(path),target+'&tapAction=claim');await settle(q);
    await q.getByTestId('tap-association-claim-pin').fill('Transient-Product-PIN');
    check(await q.getByTestId('tap-association-result-rewards').getAttribute('data-outcome')==='no_program'&&failed.row.programReads.length===2,`${theme}: same event intent change retains authoritative result and does not reread or repost`);
    failed.setProgram('none');
    await q.evaluate(path=>window.__tapQaNavigate(path),target.replace('eventId=715','eventId=716')+'&tapAction=claim');
    await q.waitForFunction(()=>document.querySelector('[data-testid="tap-association"]')?.textContent.includes('no tiene un programa de beneficios activo'));
    check(failed.row.programReads.length===3&&failed.row.programReads[2].eventId==='716',`${theme}: a distinct event gets its own advisory read`);
    check(await q.getByTestId('tap-association-claim-pin').inputValue()===''&&await q.getByTestId('tap-association-result-rewards').count()===0,`${theme}: new event remount clears old PIN and results without transferring their authority`);
    check(failed.row.posts.length===1&&await q.getByTestId('tap-association-option-rewards').isDisabled(),`${theme}: new reference and GET alone do not enroll or certify a fresh capability`);
    failed.row.passed=true;await failed.close();
    for(const eventId of ['9007199254740992','9007199254740993','9223372036854775806','9223372036854775807']){
      const large=await open(width,theme,'program-exact-bigint-'+eventId,{active:true,program:'active',eventId,preferred:'rewards',status:409,postReply:{ok:false,error:'fresh_tap_capability_required',fresh_token_status:'fresh_token_already_used'}}),r=large.page;
      check(large.row.programReads.length===1&&large.row.programReads[0].eventId===eventId,`${theme}/${eventId}: browser GET retains exact adjacent bigint identity`);
      await r.getByTestId('tap-association-confirm').click();await r.getByTestId('tap-association-result-rewards').waitFor();
      check(large.row.posts.length===1&&large.row.posts[0].path===`/api/mobile/passport/${eventId}/loyalty/enroll`,`${theme}/${eventId}: deliberate POST retains original identity`);
      check(await r.getByTestId('tap-association-result-rewards').getAttribute('data-outcome')==='fresh_used'&&await r.getByTestId('tap-association-confirm').isDisabled(),`${theme}/${eventId}: public GET cannot issue or renew a fresh capability`);
      await settle(r);check(large.row.posts.length===1,`${theme}/${eventId}: no automatic rePOST`);large.row.passed=true;await large.close();
    }
  }
  // Browser/component evidence only: these synthetic uncertain replies never
  // certify an API write. Timed aborts are covered separately by the runner unit.
  if(guarded)for(const width of [360,390])for(const theme of ['light','dark']){
    for(const scenario of [
      {action:'save',name:'lost-reply',postMode:'lost'},
      {action:'join',name:'generic-503',status:503,postReply:{ok:false}},
      {action:'claim',name:'invalid-json',postMode:'malformed'},
      {action:'rewards',name:'incomplete-200',postReply:{ok:true}},
    ]){
      const f=await open(width,theme,'uncertain-terminal-'+scenario.action+'-'+scenario.name,{active:true,preferred:scenario.action,...scenario}),{page,row}=f;
      const panel=page.getByTestId('tap-association'),confirm=panel.getByTestId('tap-association-confirm');
      await page.waitForFunction(()=>{const button=document.querySelector('[data-testid="tap-association-confirm"]');return button&&!button.disabled;});
      await confirm.evaluate(button=>{button.click();button.click();});
      const result=panel.getByTestId('tap-association-result-'+scenario.action);await result.waitFor();
      check(await result.getAttribute('data-outcome')==='unconfirmed'&&row.posts.length===1,`${width}/${theme}/${scenario.name}: an uncertain reply never fabricates success or sends a second same-turn POST`);
      const suffix={save:'consumer/save-product',join:'consumer/join-tenant',claim:'consumer/claim',rewards:'loyalty/enroll'}[scenario.action];
      check(row.posts[0].path==='/api/mobile/passport/715/'+suffix,`${width}/${theme}/${scenario.name}: the one POST belongs only to the selected action and event`);
      assert.deepEqual(row.posts[0].body,{tenantSlug:'brand.a',bid:'LOT-QA',...(scenario.action==='rewards'?{locale:'es-AR'}:{})});
      check(await confirm.isDisabled()&&!(await confirm.innerText()).includes('Reintentar'),`${width}/${theme}/${scenario.name}: uncertain action is terminal in the mounted reading`);
      const guidance=await result.innerText();
      check(guidance.includes('puede haberse registrado')&&guidance.includes('Revisá tus productos y tu historial')&&guidance.includes('no se volverá a enviar desde esta pantalla'),`${width}/${theme}/${scenario.name}: visible copy explains uncertainty and read-only review`);
      check(await panel.locator('[data-outcome="saved"],[data-outcome="linked"],[data-outcome="claimed"],[data-outcome="enrolled"]').count()===0&&await panel.getByTestId('tap-association-benefits').count()===0,`${width}/${theme}/${scenario.name}: no product, title, membership or benefits confirmation is invented`);
      check(await page.evaluate(()=>window.__tapQaRefreshes)===0,`${width}/${theme}/${scenario.name}: uncertainty does not refresh the portal as a confirmed receipt`);
      check(await panel.locator('a[href="/me/products?focus=715"]').count()===1&&await panel.locator('a[href="/me/taps"]').count()===1,`${width}/${theme}/${scenario.name}: products and reading-history review remain available`);
      const other=scenario.action==='save'?'join':'save';await choose(page,other);
      check(await confirm.isEnabled()&&row.posts.length===1,`${width}/${theme}/${scenario.name}: another explicit action remains independent without being sent`);
      await choose(page,scenario.action);check(await confirm.isDisabled()&&await result.getAttribute('data-outcome')==='unconfirmed',`${width}/${theme}/${scenario.name}: returning to the uncertain action retains its result`);
      await confirm.evaluate(button=>button.click());await settle(page);
      check(row.posts.length===1&&row.sessions.length===1&&row.programReads.length===1&&await page.evaluate(()=>window.__tapQaRefreshes)===0,`${width}/${theme}/${scenario.name}: disabled click and selection changes neither rePOST nor refresh session/programme reads`);
      await page.addScriptTag({content:axe});row.violations=await page.evaluate(async()=>(await axe.run('[data-testid="tap-association"]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact})));
      check(row.violations.every(v=>!['critical','serious'].includes(v.impact)),`${width}/${theme}/${scenario.name}: uncertain feedback keeps native accessibility`);
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}/${theme}/${scenario.name}: uncertainty and review actions fit the mobile viewport`);
      row.screenshot=`uncertain-${scenario.action}-${width}-${theme}.png`;await page.screenshot({path:join(output,row.screenshot),fullPage:true});row.passed=true;await f.close();
    }
    const limited=await open(width,theme,'known-rate-limit-explicit-retry-unknown-terminal',{active:true,preferred:'save',postMode:'rate-limit-sequence'}),limitedPage=limited.page;
    const limitedPanel=limitedPage.getByTestId('tap-association'),limitedConfirm=limitedPanel.getByTestId('tap-association-confirm'),limitedResult=limitedPanel.getByTestId('tap-association-result-save');
    await limitedPage.waitForFunction(()=>{const button=document.querySelector('[data-testid="tap-association-confirm"]');return button&&!button.disabled;});
    await limitedConfirm.evaluate(button=>{button.click();button.click();});await limitedResult.waitFor();
    check(await limitedResult.getAttribute('data-outcome')==='rate_limited'&&limited.row.posts.length===1,`${width}/${theme}: the exact pre-consume limiter envelope is distinct from an uncertain result`);
    assert.deepEqual(limited.row.rateLimitReplies,[{eventId:'715',attempt:1,status:429,payload:{ok:false,reason:'rate_limited'}}]);
    check(await limitedConfirm.isEnabled()&&(await limitedConfirm.innerText()).includes('Reintentar')&&(await limitedResult.innerText()).includes('No la enviaremos automáticamente'),`${width}/${theme}: the known limiter offers an explicit manual retry without claiming a retry time`);
    await settle(limitedPage);
    check(limited.row.posts.length===1&&await limitedPage.evaluate(()=>window.__tapQaRefreshes)===0&&await limitedPanel.locator('[data-outcome="saved"]').count()===0,`${width}/${theme}: the limiter does not retry, refresh or invent success automatically`);
    await limitedConfirm.click();
    await limitedPage.waitForFunction(()=>document.querySelector('[data-testid="tap-association-result-save"]')?.getAttribute('data-outcome')==='saved');
    check(limited.row.posts.length===2&&await limitedConfirm.isDisabled()&&await limitedPage.evaluate(()=>window.__tapQaRefreshes)===1,`${width}/${theme}: one deliberate retry can accept the exact saved receipt and then becomes terminal`);
    check(limited.row.posts.every(post=>post.path==='/api/mobile/passport/715/consumer/save-product'),`${width}/${theme}: the known limiter retries only the same chosen action and event`);
    for(const post of limited.row.posts)assert.deepEqual(post.body,{tenantSlug:'brand.a',bid:'LOT-QA'});
    await limitedConfirm.evaluate(button=>button.click());await settle(limitedPage);
    check(limited.row.posts.length===2,`${width}/${theme}: a disabled confirmed action never sends a third request`);
    await limitedPage.evaluate(path=>window.__tapQaNavigate(path),target.replace('eventId=715','eventId=716')+'&tapAction=save');
    await limitedPage.waitForFunction(()=>!document.querySelector('[data-testid="tap-association-result-save"]')&&document.querySelector('[data-testid="tap-association-confirm"]')?.disabled===false);
    check(limited.row.posts.length===2&&limited.row.programReads.length===2&&limited.row.programReads[1].eventId==='716',`${width}/${theme}: another synthetic reference resets only its own UI and waits for an explicit action`);
    await limitedConfirm.click();await limitedResult.waitFor();
    check(limited.row.posts.length===3&&limited.row.posts[2].path==='/api/mobile/passport/716/consumer/save-product'&&await limitedResult.getAttribute('data-outcome')==='unconfirmed'&&await limitedConfirm.isDisabled(),`${width}/${theme}: an unknown 429 cannot borrow the known pre-consume retry exception`);
    assert.deepEqual(limited.row.rateLimitReplies[2],{eventId:'716',attempt:1,status:429,payload:{ok:false,reason:'upstream_busy'}});
    check(await limitedPanel.locator('[data-outcome="saved"],[data-outcome="enrolled"]').count()===0&&await limitedPanel.getByTestId('tap-association-benefits').count()===0&&(await limitedResult.innerText()).includes('no se volverá a enviar desde esta pantalla'),`${width}/${theme}: the unknown 429 retains uncertainty without transferring the previous receipt or benefits`);
    await limitedConfirm.evaluate(button=>button.click());await settle(limitedPage);
    check(limited.row.posts.length===3&&limited.row.sessions.length===2&&await limitedPage.evaluate(()=>window.__tapQaRefreshes)===1,`${width}/${theme}: the unknown 429 stays terminal without retrying or refreshing as a new success`);
    await limitedPage.addScriptTag({content:axe});limited.row.violations=await limitedPage.evaluate(async()=>(await axe.run('[data-testid="tap-association"]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact})));
    check(limited.row.violations.every(v=>!['critical','serious'].includes(v.impact)),`${width}/${theme}: limiter and uncertainty controls retain native accessibility`);
    check(await limitedPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}/${theme}: limiter and uncertain feedback fit the mobile viewport`);
    limited.row.screenshot=`rate-limit-${width}-${theme}.png`;await limitedPage.screenshot({path:join(output,limited.row.screenshot),fullPage:true});limited.row.passed=true;await limited.close();
    const rejected=await open(width,theme,'explicit-401-still-relogin',{active:true,preferred:'claim',status:401}),{page,row}=rejected;
    await page.getByTestId('tap-association-confirm').click();await page.getByTestId('tap-association-login').waitFor();
    const result=page.getByTestId('tap-association-result-claim');await result.waitFor();
    const next=new URL(await page.getByTestId('tap-association-login').getAttribute('href'),origin).searchParams.get('next');
    check(await result.getAttribute('data-outcome')==='session_required'&&next===target+'&tapAction=claim',`${width}/${theme}: an explicit 401 offers reauthentication with the same destination and action`);
    check(await page.getByTestId('tap-association-confirm').count()===0&&row.posts.length===1,`${width}/${theme}: reauthentication causes no automatic retry or fabricated ownership`);
    await settle(page);check(row.posts.length===1,`${width}/${theme}: 401 keeps one explicit POST while waiting for sign-in`);row.passed=true;await rejected.close();
  }
  report.sourceAfter=await sourceHashes();assert.deepEqual(report.sourceAfter,sourceBefore,'source remains unchanged');
  check(report.cases.length===(guarded?108:60) && report.cases.every(row=>row.passed),'all planned native fixture scenarios completed');
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
