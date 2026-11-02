// Actual React component/models and native CSS, with synthetic props and intercepted
// loopback transport only. An unsafe-baseline result is never release acceptance.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build,stop} from 'esbuild';

assert.ok(process.env.PLAYWRIGHT_MODULE && process.env.CHROME_PATH && process.env.AXE_MODULE_PATH && process.env.QA_OUTPUT,
  'Use explicit installed browser tools and a new external QA_OUTPUT; never download tools in this harness');
const mode=process.env.QA_REWARD_FOCUS_MODE || 'guarded';
assert.ok(['guarded','unsafe-baseline'].includes(mode),'Unknown QA_REWARD_FOCUS_MODE');
const guarded=mode==='guarded', {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
const web=fileURLToPath(new URL('../',import.meta.url)),root=resolve(web,'../..'),output=resolve(process.env.QA_OUTPUT);
assert.ok(output!==root && !output.startsWith(root+'\\') && !output.startsWith(root+'/'),'QA output must be outside the worktree');
const hash=value=>createHash('sha256').update(value).digest('hex');
const sourcePaths=[
  'src/app/me/rewards/rewards-client.tsx','src/app/me/rewards/rewards.module.css',
  'src/app/me/_components/consumer-rewards-model.ts','src/app/me/_components/consumer-reward-reservation.ts',
  'src/app/me/_components/consumer-reward-presentation-clock.ts',
  'src/app/me/_components/consumer-reward-next-actions.ts','src/app/me/_components/consumer-wallet-points-model.ts',
  'src/app/me/_components/consumer-bounded-fetch.ts','src/app/me/_components/portal-shell.module.css',
  'src/app/me/brands/brands-model.ts','src/app/login/consumer-login-continuation.ts','tests/consumer-reward-confirmation-focus.browser.mjs',
  '../../package.json','../../package-lock.json','package.json',
];
const sourceHashes=async()=>Object.fromEntries(await Promise.all(sourcePaths.map(async file=>[file,hash(await readFile(join(web,file)))])));
const sourceBefore=await sourceHashes();
const observedHead=execFileSync('git',['--no-optional-locks','-C',root,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true,timeout:10000}).trim();
if(process.env.QA_SOURCE){
  assert.equal(process.env.QA_SOURCE,observedHead,'Explicit QA_SOURCE must name this committed source');
  assert.equal(execFileSync('git',['--no-optional-locks','-C',root,'status','--porcelain'],{encoding:'utf8',windowsHide:true,timeout:10000}).trim(),'','Exact-source QA requires a clean committed candidate');
}
const REWARD='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',OTHER='dddddddd-dddd-4ddd-8ddd-dddddddddddd',CLAIM='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TITLE='Visita a la bodega QA',BRAND='Bodega sintética A',PROGRAM='Club sintético A';
const catalogRow=(extra={})=>({id:REWARD,title:TITLE,tenant_slug:'bodega-a',tenant_name:BRAND,
  program_name:PROGRAM,program_points_balance:100,points_cost:40,state:'reported',catalog_state:'reported',
  claim_id:null,claim_status:null,claim_expires_at:null,redemption_code:null,points_spent:null,
  can_claim:true,claimIntent:'portal-first-reservation.v1',...extra});
const otherRow=()=>catalogRow({id:OTHER,title:'Beneficio de otra marca QA',tenant_slug:'bodega-b',tenant_name:'Bodega sintética B',program_name:'Club sintético B'});
const claimedRow=()=>catalogRow({claim_id:CLAIM,claim_status:'claimed',claim_expires_at:'2099-01-01T00:00:00.000Z',
  redemption_code:'NXR-QA-ONLY',points_spent:40,points_cost:80,program_points_balance:60,state:'claimed',can_claim:false,claimIntent:undefined});
const payload=items=>({ok:true,items,scope:'own_brands',limit:100,checkedAt:'2026-10-28T10:00:00.000Z'});
const CLOCK_CLAIM_B='cccccccc-cccc-4ccc-8ccc-cccccccccccc',CLOCK_REPLACEMENT='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',CLOCK_REWARD_C='ffffffff-ffff-4fff-8fff-ffffffffffff';
const clockProfiles={
  stable:{checkedAt:'2026-10-28T10:00:00.000Z',selectedVoucher:null,rows:[
    {...claimedRow(),title:TITLE,redemption_code:'NXR-CLOCK-A',claim_expires_at:'2026-10-28T10:01:00.000Z'},
    {...otherRow(),claim_id:CLOCK_CLAIM_B,claim_status:'claimed',state:'claimed',redemption_code:'NXR-CLOCK-B',claim_expires_at:'2026-10-28T10:01:00.000Z',points_spent:25,can_claim:false,claimIntent:undefined},
  ]},
  short:{checkedAt:'2026-10-28T10:00:00.000Z',selectedVoucher:null,rows:[
    {...claimedRow(),title:TITLE,redemption_code:'NXR-CLOCK-A',claim_expires_at:'2026-10-28T10:00:02.000Z'},
    {...otherRow(),claim_id:CLOCK_CLAIM_B,claim_status:'claimed',state:'claimed',redemption_code:'NXR-CLOCK-B',claim_expires_at:'2026-10-28T10:00:04.000Z',points_spent:25,can_claim:false,claimIntent:undefined},
  ]},
  replacement:{checkedAt:'2026-10-28T10:01:00.000Z',selectedVoucher:'claim-'+CLOCK_REPLACEMENT,rows:[
    {...claimedRow(),id:CLOCK_REWARD_C,claim_id:CLOCK_REPLACEMENT,tenant_slug:'bodega-c',tenant_name:'Marca sintética C',title:'Voucher nuevo de otra marca QA',redemption_code:'NXR-CLOCK-C',claim_expires_at:'2026-10-28T10:01:02.000Z',points_spent:70},
  ]},
};
// Test fixture only. Insert immediately after clockProfiles, before entry string.
const REFRESH_REWARD=CLOCK_REWARD_C,REFRESH_CLAIM='99999999-9999-4999-8999-999999999999';
const REFRESH_TITLE='Beneficio independiente para reserva QA';
const REFRESH_NOTICE='Tus vouchers siguen registrados. Actualizá la consulta antes de usar un código.';
const REFRESH_ACTION='Actualizar mis vouchers';
clockProfiles.refresh={...clockProfiles.stable,rows:[...clockProfiles.stable.rows,catalogRow({id:REFRESH_REWARD,title:REFRESH_TITLE})]};

const entry=`import'tailwindcss/preflight.css';import React,{useEffect,useMemo,useState}from'react';import{flushSync,unstable_batchedUpdates}from'react-dom';import{createRoot}from'react-dom/client';
import{ConsumerRewardsClient}from'./src/app/me/rewards/rewards-client';import{buildConsumerRewardsModel}from'./src/app/me/_components/consumer-rewards-model';import portalStyles from'./src/app/me/_components/portal-shell.module.css';import rewardsStyles from'./src/app/me/rewards/rewards.module.css';
const initial=${JSON.stringify([catalogRow(),otherRow()])},clockProfiles=${JSON.stringify(clockProfiles)};window.__rewardKeyEvents=[];
const makeClockSnapshot=(profile,revision)=>{if(!Object.hasOwn(clockProfiles,profile))throw Error('Unknown synthetic clock profile');return {...JSON.parse(JSON.stringify(clockProfiles[profile])),revision};};
window.__rewardLifecycleProbe=kind=>{const events=[],emit=(target,event)=>flushSync(()=>{events.push({type:event.type,persisted:event.persisted??null,visibility:document.visibilityState});target.dispatchEvent(event);});if(kind==='visible-focus'){emit(window,new Event('blur'));emit(window,new Event('focus'));}else if(kind==='hidden-visible'){window.__rewardFixtureVisibility='hidden';emit(document,new Event('visibilitychange'));window.__rewardFixtureVisibility='visible';emit(document,new Event('visibilitychange'));emit(window,new Event('focus'));}else if(kind==='bfcache'){emit(window,new PageTransitionEvent('pageshow',{persisted:true}));emit(window,new Event('focus'));}else throw Error('Unknown synthetic lifecycle');return {events,visibility:document.visibilityState,synthetic:true,physicalBackgroundMeasured:false};};
for(const type of ['keydown','keyup'])window.addEventListener(type,event=>{if(event.key==='Enter')window.__rewardKeyEvents.push({type,key:event.key,repeat:event.repeat,tag:event.target?.tagName,text:event.target?.textContent?.trim().slice(0,180)});});
window.__rewardBatchConfirmAndFilter=()=>{const article=[...document.querySelectorAll('article')].find(node=>node.querySelector('h3')?.textContent===${JSON.stringify(TITLE)});const group=article?.querySelector('[role="group"]');const submit=[...(group?.querySelectorAll('button')||[])].find(node=>/^Confirmar reserva por/.test(node.textContent||''));const filter=[...document.querySelectorAll('button')].find(node=>node.textContent==='Mis vouchers');if(!group||!submit||!filter)throw Error('Synthetic batch controls unavailable');const probe={sameCallStack:true,batchHelper:'ReactDOM.unstable_batchedUpdates',afterConfirmGroupConnected:false,afterFilterGroupConnected:false};unstable_batchedUpdates(()=>{submit.click();probe.afterConfirmGroupConnected=group.isConnected;filter.focus();filter.click();probe.afterFilterGroupConnected=group.isConnected;});return probe;};
// Test fixture only. Insert inside entry template, immediately before function Fixture().
window.__rewardBatchRefreshControls=first=>{const buttons=[...document.querySelectorAll('button')],refresh=buttons.find(node=>node.textContent==='Actualizar mis vouchers'),confirm=buttons.find(node=>/^Confirmar reserva por/.test(node.textContent||''));if(!refresh||!confirm)throw Error('Synthetic refresh/confirm controls unavailable');const probe={first,sameCallStack:true,helper:'ReactDOM.unstable_batchedUpdates',refreshConnected:refresh.isConnected,confirmConnected:confirm.isConnected};unstable_batchedUpdates(()=>{if(first==='refresh'){refresh.click();confirm.click();}else if(first==='confirm'){confirm.click();refresh.click();}else throw Error('Unknown synthetic order');});return probe;};

function Fixture(){const[snapshot,setSnapshot]=useState(()=>new URLSearchParams(location.search).get('clockFixture')==='1'?makeClockSnapshot('stable',0):{rows:initial,checkedAt:'2026-10-28T10:00:00.000Z',selectedVoucher:null,revision:0});
const model=useMemo(()=>buildConsumerRewardsModel({ok:true,items:snapshot.rows,scope:'own_brands',limit:100},snapshot.checkedAt),[snapshot]);
window.__rewardReplaceSnapshot=profile=>{let revision;flushSync(()=>setSnapshot(current=>{revision=current.revision+1;return makeClockSnapshot(profile,revision);}));return revision;};
window.__rewardFixtureReceiptFacts=()=>model.status==='ready'?model.items.map(({key,id,tenant,cost,state,code,expiresAt})=>({key,id,tenant,cost,state,code,expiresAt})):[];
useEffect(()=>{window.__rewardSnapshotApplied={revision:snapshot.revision,checkedAt:snapshot.checkedAt,monotonic:performance.now()};},[snapshot,model]);
if(model.status!=='ready')throw Error('Synthetic fixture model rejected');return <div className={'consumer-portal-root '+portalStyles.portal}><main className={portalStyles.main}><div className={portalStyles.pageHeading}><h1>Reservas de beneficios · QA local</h1><p>Componente real, marcas y transportes sintéticos; no acredita operaciones de clientes.</p></div><div className={rewardsStyles.rewards}><ConsumerRewardsClient items={model.items} checkedAt={snapshot.checkedAt} initialTenant='' selectedVoucher={snapshot.selectedVoucher}/></div></main></div>};createRoot(document.getElementById('root')).render(<Fixture/>);`;
const bundle=await build({stdin:{contents:entry,loader:'tsx',resolveDir:web},bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',
  define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},logLevel:'silent'});
const script=bundle.outputFiles.find(file=>file.path.endsWith('.js')).contents;
const css=(bundle.outputFiles.find(file=>file.path.endsWith('.css'))?.text || '')+'\nbody{margin:0;font-family:system-ui,sans-serif}';
await mkdir(output,{recursive:true});
await writeFile(join(output,'run-owner.json'),JSON.stringify({mode,observedHead,createdAt:new Date().toISOString()})+'\n',{flag:'wx'});
const report={schema:'nexid.consumer-reward-confirmation-focus.v1',mode,passed:false,regressionPassed:false,baselineDefectReproduced:false,releaseAcceptanceEligible:false,
  localOnly:true,actualComponent:'ConsumerRewardsClient',actualModels:true,nativeComponentAndPortalCss:true,actualRewardsPageAncestor:true,actualTailwindPreflight:true,syntheticBatchedEventStress:true,
  preflightCssSha256:hash(await readFile(join(root,'node_modules/tailwindcss/preflight.css'))),syntheticProps:true,syntheticTransport:true,
  actualNextServer:false,realAuthentication:false,realDatabase:false,realTenantSynchronization:false,providerMutations:0,physicalTapMeasured:false,
  mountedExpiryUiPlanPending:true,mountedExpiryFullFlowAccepted:false,controlledClockAndLifecycle:true,physicalSuspendMeasured:false,mountedClockCases:[],
  qaSource:process.env.QA_SOURCE || null,observedHead,sourceBefore,sourceAfter:null,checks:[],cases:[],reauthCases:[],serverRequests:[],blockedRequests:[],errors:[],
  closure:{contexts:false,browser:false,server:false,esbuild:false}};
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://fixture.invalid');report.serverRequests.push({method:req.method,path:url.pathname});
  if(req.method!=='GET'){res.writeHead(405);return res.end();}
  if(url.pathname==='/fixture.js'){res.setHeader('content-type','text/javascript');return res.end(script);}
  if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
  if(url.pathname!=='/'){res.writeHead(404);return res.end();}
  const theme=url.searchParams.get('theme')==='dark'?'dark':'light';res.setHeader('content-type','text/html;charset=utf-8');
  res.end('<!doctype html><html lang="es-AR" class="theme-'+theme+'" data-theme="'+theme+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reservas · QA local</title><style>'+css+'</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
});
let browser,origin;const contexts=new Set();
function check(value,description){report.checks.push({description,passed:Boolean(value)});assert.ok(value,description);}
const settle=page=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
async function waitFor(description,predicate){const limit=Date.now()+5000;while(!predicate()){assert.ok(Date.now()<limit,description);await new Promise(done=>setTimeout(done,15));}}
async function open(width,theme,scenario,{postStatus=200,lookupStatus=200,fixtureSearch='',clockFixture=false}={}){
  const context=await browser.newContext({viewport:{width,height:1000},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'});contexts.add(context);
  const page=await context.newPage();page.setDefaultTimeout(10000);const posts=[],lookups=[],routeTasks=new Set();let closeStarted=false;
  if(clockFixture){
    assert.ok(page.clock && typeof page.clock.install==='function' && typeof page.clock.pauseAt==='function' && typeof page.clock.runFor==='function' && typeof page.clock.setSystemTime==='function','The explicitly supplied Playwright must expose the inspected Clock API');
    await page.clock.install({time:'2100-01-01T00:00:00.000Z'});
    await page.addInitScript(()=>{window.__rewardClipboardWrites=[];window.__rewardFixtureVisibility='visible';Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__rewardFixtureVisibility});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__rewardClipboardWrites.push(String(value));}}});});
  }
  const entry={width,theme,scenario,mode,posts,lookups,passed:false};report.cases.push(entry);
  page.on('pageerror',error=>report.errors.push({scenario,width,theme,message:error.message}));
  const handle=async route=>{
    const request=route.request(),url=new URL(request.url());
    if(closeStarted)return route.abort();
    if(url.origin===origin && request.method()==='POST' && url.pathname==='/api/consumer/rewards/'+REWARD+'/claim'){
      let release;const gate=new Promise(done=>{release=done;});const row={method:'POST',path:url.pathname,body:request.postDataJSON(),intercepted:true,providerFetch:false,status:postStatus,release};posts.push(row);
      await gate;return route.fulfill({status:postStatus,contentType:'application/json',body:JSON.stringify(postStatus===200
        ? {ok:true,duplicate:false,claim:{id:CLAIM,reward_id:REWARD,redemption_code:'ACK-MUST-NOT-SHOW'}} : {ok:false,error:'synthetic_conflict'})});
    }
    if(url.origin===origin && request.method()==='GET' && url.pathname==='/api/consumer/rewards'){
      let release;const gate=new Promise(done=>{release=done;});const row={method:'GET',path:url.pathname,intercepted:true,providerFetch:false,status:lookupStatus,release,items:null};lookups.push(row);
      await gate;return route.fulfill({status:lookupStatus,contentType:'application/json',body:JSON.stringify(lookupStatus===200
        ? payload(row.items ?? [claimedRow(),otherRow()]) : {ok:false,error:'synthetic_unauthorized'})});
    }
    if(url.origin===origin && request.method()==='GET' && ['/','/fixture.js','/favicon.ico'].includes(url.pathname))return route.continue();
    report.blockedRequests.push({scenario,width,theme,method:request.method(),origin:url.origin,path:url.pathname});return route.abort();
  };
  await page.route('**/*',route=>{const task=handle(route);routeTasks.add(task);task.finally(()=>routeTasks.delete(task)).catch(error=>{if(!closeStarted)report.errors.push({scenario,width,theme,message:String(error)});});return task;});
  await page.goto(origin+'/?theme='+theme+fixtureSearch+(clockFixture?'&clockFixture=1':''),{waitUntil:'networkidle'});
  const card=page.locator('article').filter({has:page.getByRole('heading',{name:TITLE,exact:true})});
  const reserve=card.getByRole('button',{name:'Reservar beneficio',exact:true});
  const group=card.getByRole('group').filter({has:page.getByRole('button',{name:/^Confirmar reserva por \d+ puntos$/})});
  const affirmative=()=>group.getByRole('button',{name:/^Confirmar reserva por \d+ puntos$/});
  const cancel=()=>group.getByRole('button',{name:'Todavía no',exact:true});
  async function focusCheck(label){
    if(!guarded){check(await affirmative().evaluate(el=>el===document.activeElement),label+': baseline focuses the affirmative spend action');return;}
    const heading=group.getByRole('heading').first();check(await heading.count()===1,label+': confirmation has a neutral heading');
    check(await heading.evaluate(el=>el===document.activeElement && el.getAttribute('tabindex')==='-1' && Boolean(el.textContent?.trim())),label+': initial focus is on the neutral heading');
    const headingId=await heading.getAttribute('id'),labelledBy=(await group.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean);
    check(Boolean(headingId) && labelledBy.includes(headingId) && await group.getAttribute('aria-label')===null,label+': group is named by its neutral heading without a competing label');
    check(await page.evaluate(id=>[...document.querySelectorAll('[id]')].filter(el=>el.id===id).length,headingId)===1,label+': confirmation heading id is unique');
    check(!(await affirmative().evaluate(el=>el===document.activeElement)),label+': affirmative spend action is not initially focused');
  }
  async function openConfirm(label){await reserve.click();await group.waitFor();await settle(page);await focusCheck(label);}
  async function deliberateConfirm(label){
    if(guarded){await page.keyboard.press('Tab');check(await affirmative().evaluate(el=>el===document.activeElement),label+': a separate Tab reaches confirmation');}
    else await affirmative().focus();
    await page.keyboard.press('Enter');await waitFor(label+': one intercepted reservation',()=>posts.length===1);
  }
  async function finish(){
    closeStarted=true;for(const row of posts)row.release();for(const row of lookups)row.release();
    await Promise.allSettled([...routeTasks]);await context.close();contexts.delete(context);
  }
  return {page,context,entry,posts,lookups,card,reserve,group,affirmative,cancel,focusCheck,openConfirm,deliberateConfirm,finish};
}


async function clockBrowserTurn(page){
  // Native MessageChannel is not replaced by Playwright Clock. Two task turns
  // allow React's queued work to commit without advancing paused monotonic time.
  await page.evaluate(()=>new Promise(done=>{const channel=new MessageChannel();let remaining=2;channel.port1.onmessage=()=>{if(--remaining){channel.port2.postMessage(null);return;}channel.port1.close();channel.port2.close();done();};channel.port2.postMessage(null);}));
}
async function waitAppliedSnapshot(page,revision){
  const limit=Date.now()+5000;
  while(true){const applied=await page.evaluate(()=>window.__rewardSnapshotApplied);if(applied?.revision===revision)return applied;assert.ok(Date.now()<limit,'Synthetic snapshot passive effects did not settle');await new Promise(done=>setTimeout(done,15));}
}
async function readClockView(f,codes){
  const facts=await f.page.evaluate(()=>({receiptFacts:window.__rewardFixtureReceiptFacts(),writes:window.__rewardClipboardWrites.slice(),visibility:document.visibilityState,monotonic:performance.now(),deviceDate:new Date().toISOString(),applied:window.__rewardSnapshotApplied,statusTexts:[...document.querySelectorAll('main [role="status"]')].map(node=>node.textContent?.trim())}));
  facts.codes=[];for(const code of codes){const nodes=f.page.getByText(code,{exact:true}),count=await nodes.count();let visible=false;for(let index=0;index<count;index++)visible ||= await nodes.nth(index).isVisible();facts.codes.push({code,count,visible});}
  facts.expiredLabelCount=await f.page.getByText('Vencido',{exact:true}).count();
  facts.posts=f.posts.length;facts.lookups=f.lookups.length;return facts;
}
async function openClockDetails(f){
  const summaries=f.page.locator('article details > summary');
  check(await summaries.count()===2,'The synthetic mounted snapshot has two owned receipt details');
  for(let index=0;index<2;index++){const summary=summaries.nth(index);if(!(await summary.locator('..').evaluate(node=>node.open)))await summary.click();}
  const buttons=f.page.getByRole('button',{name:'Copiar código',exact:true});
  check(await buttons.count()===2,'Both synthetic owned codes have their existing copy action before lifecycle changes');
  return [await buttons.nth(0).elementHandle(),await buttons.nth(1).elementHandle()];
}
async function pauseAndSetClockSnapshot(f,profile){
  // Date is used only to schedule the test clock pause, never to derive the
  // expected voucher instant. Production expectations use server checkedAt.
  const pauseTarget=await f.page.evaluate(()=>Date.now()+10000);
  await f.page.clock.pauseAt(pauseTarget);
  const revision=await f.page.evaluate(value=>window.__rewardReplaceSnapshot(value),profile);
  const applied=await waitAppliedSnapshot(f.page,revision);await clockBrowserTurn(f.page);
  return applied;
}
async function tryHeldCopies(page,buttons){
  for(const button of buttons){assert.ok(button,'An existing copy action was not captured');await button.evaluate(node=>node.click());}
  await clockBrowserTurn(page);
}
function originalReceiptSourceUnchanged(a,b){return JSON.stringify(a.receiptFacts)===JSON.stringify(b.receiptFacts);}
function keepMountedCase(f,data,contractPassed,defectObserved=false){
  const evidence={width:f.entry.width,theme:f.entry.theme,scenario:f.entry.scenario,syntheticClipboard:true,nativeClipboardMeasured:false,uiRefreshAssertionsPrepared:false,...data,contractPassed,defectObserved};
  report.mountedClockCases.push(evidence);Object.assign(f.entry,{passed:contractPassed,mountedClock:evidence});
}

// Harness-only helpers. Insert before privateFixtureSearch; no new application import.
report.mountedRefreshCases=[];
report.mountedRefreshUiTestsPrepared=true;
report.mountedRefreshUiTestsExecuted=false;
const refreshPayload=()=>({ok:true,scope:'own_brands',limit:100,checkedAt:'2026-10-28T10:00:30.000Z',items:[
  {...clockProfiles.stable.rows[0],title:'Voucher actualizado A QA',redemption_code:'NXR-FRESH-A',claim_expires_at:'2026-10-28T10:02:00.000Z'},
  {...clockProfiles.stable.rows[1],title:'Voucher actualizado B QA',redemption_code:'NXR-FRESH-B',claim_expires_at:'2026-10-28T10:02:00.000Z'},
  catalogRow({id:REFRESH_REWARD,title:REFRESH_TITLE}),
  {...claimedRow(),id:'77777777-7777-4777-8777-777777777777',claim_id:'88888888-8888-4888-8888-888888888888',tenant_slug:'bodega-c',tenant_name:'Marca propia C QA',title:'Nuevo voucher propio de marca C QA',redemption_code:'NXR-FRESH-C',claim_expires_at:'2026-10-28T10:02:00.000Z',points_spent:15},
]});
const refreshAction=f=>f.page.getByRole('button',{name:REFRESH_ACTION,exact:true});
async function renderedRefreshRows(f){
  return f.page.locator('article').evaluateAll(nodes=>nodes.map(node=>{
    const labelledValue=label=>{const span=[...node.querySelectorAll('span')].find(el=>el.textContent===label);return span?.parentElement?.querySelector('strong')?.textContent?.trim()??null;};
    return {id:node.id,title:node.querySelector('h3')?.textContent?.trim(),state:node.getAttribute('data-reward-state'),
      historicalSpend:labelledValue('Puntos del reclamo'),programBalance:labelledValue('Saldo actual del programa'),code:node.querySelector('code')?.textContent?.trim()??null};
  }));
}
const withoutPresentedCodes=rows=>rows.map(({code,...row})=>row);
async function showRefreshOwnedDetails(f){
  const details=f.page.locator('article[id^="voucher-"] details');
  for(let index=0;index<await details.count();index++)await details.nth(index).evaluate(node=>{node.open=true;});
  await clockBrowserTurn(f.page);
}
async function openRefreshFixture(width,theme,scenario,{privateSearch=false}={}){
  const f=await open(width,theme,scenario,{clockFixture:true,fixtureSearch:privateSearch?privateFixtureSearch:''});
  const tasks=new Set();let closing=false;
  const ownRewardsRoute=url=>url.origin===origin && (url.pathname==='/api/consumer/rewards' || url.pathname==='/api/consumer/rewards/'+REFRESH_REWARD+'/claim');
  const routeHandler=async route=>{
    const task=(async()=>{
      const request=route.request(),url=new URL(request.url());
      if(closing)return route.abort();
      const isGet=url.origin===origin && request.method()==='GET' && url.pathname==='/api/consumer/rewards';
      const isPost=url.origin===origin && request.method()==='POST' && url.pathname==='/api/consumer/rewards/'+REFRESH_REWARD+'/claim';
      if(!isGet&&!isPost){report.blockedRequests.push({scenario,width,theme,method:request.method(),origin:url.origin,path:url.pathname});return route.abort();}
      check(url.search==='' && url.hash==='',scenario+': test-only transport permits no private query values');
      if(isGet)check(request.postData()===null,scenario+': the private read has no body');
      let release;const gate=new Promise(done=>{release=done;});
      const row={method:request.method(),path:url.pathname,intercepted:true,providerFetch:false,status:200,release,payload:isGet?refreshPayload():{ok:true,duplicate:false,claim:{id:REFRESH_CLAIM,reward_id:REFRESH_REWARD,redemption_code:'ACK-NEVER-PRESENT'}}};
      if(isPost)row.body=request.postDataJSON();
      (isGet?f.lookups:f.posts).push(row);await gate;
      try{return await route.fulfill({status:row.status,contentType:'application/json',body:row.raw??JSON.stringify(row.payload)});}
      catch(error){const failure=request.failure()?.errorText;if(row.allowOwnedSourceAbort && /ERR_ABORTED|aborted/i.test(failure??'')){row.ownedSourceTransportAborted=true;return;}throw error;}
    })();
    tasks.add(task);task.finally(()=>tasks.delete(task)).catch(error=>{if(!closing)report.errors.push({scenario,width,theme,message:String(error)});});return task;
  };
  await f.page.route(ownRewardsRoute,routeHandler);
  await f.page.evaluate(()=>{window.__rewardReadOptions=[];const original=window.fetch.bind(window);window.fetch=(input,init)=>{const url=new URL(String(input),location.href);if(url.pathname==='/api/consumer/rewards')window.__rewardReadOptions.push({method:init?.method??'GET',credentials:init?.credentials,cache:init?.cache,hasBody:init?.body!=null,path:url.pathname,queryKeys:[...url.searchParams.keys()],sameOrigin:url.origin===location.origin});return original(input,init);};});
  await pauseAndSetClockSnapshot(f,'refresh');await f.page.clock.resume();await showRefreshOwnedDetails(f);
  check((await renderedRefreshRows(f)).length===3,scenario+': two owned vouchers and a distinct reservable reward are mounted');
  const oldFinish=f.finish;f.finish=async()=>{closing=true;for(const row of [...f.lookups,...f.posts])row.release();await Promise.allSettled([...tasks]);await f.page.unroute(ownRewardsRoute,routeHandler);await oldFinish();};
  return f;
}
async function invalidateRefreshFixture(f){
  const before=await renderedRefreshRows(f),lifecycle=await f.page.evaluate(()=>window.__rewardLifecycleProbe('hidden-visible'));
  await clockBrowserTurn(f.page);const after=await renderedRefreshRows(f);
  check(before.filter(row=>row.code).length===2 && after.every(row=>row.code===null),f.entry.scenario+': hidden/visible blocks both previously displayed codes');
  check(JSON.stringify(withoutPresentedCodes(before))===JSON.stringify(withoutPresentedCodes(after)),f.entry.scenario+': invalidation retains the whole rendered receipt/catalog snapshot');
  check(await f.page.getByText(REFRESH_NOTICE,{exact:true}).count()===1 && await refreshAction(f).count()===1,f.entry.scenario+': there is one shared notice and one real action');
  check(f.posts.length===0 && f.lookups.length===0,f.entry.scenario+': lifecycle does not start a request');
  return {before,lifecycle,blocked:after};
}
async function activateRefresh(f){
  const oldCount=f.lookups.length;await refreshAction(f).click();
  await waitFor(f.entry.scenario+': one deliberate private read',()=>f.lookups.length===oldCount+1);
  await clockBrowserTurn(f.page);return f.lookups.at(-1);
}
async function readOptionEvidence(f){
  const options=await f.page.evaluate(()=>window.__rewardReadOptions.slice());
  check(options.length===f.lookups.length && options.every(row=>row.method==='GET' && row.credentials==='same-origin' && row.cache==='no-store' && !row.hasBody && row.sameOrigin && row.path==='/api/consumer/rewards' && row.queryKeys.length===0),f.entry.scenario+': every observed read is same-origin/no-store GET without a private body or query');
  return options;
}
async function waitRefreshUi(f,label,predicate){
  const deadline=Date.now()+5000;
  while(!(await predicate())){assert.ok(Date.now()<deadline,f.entry.scenario+': '+label);await clockBrowserTurn(f.page);await new Promise(done=>setTimeout(done,15));}
}
async function safeRefreshReentry(f,expectedTenant){
  const link=f.page.getByRole('link',{name:'Volver a ingresar',exact:true});await link.waitFor();
  const href=await link.getAttribute('href'),login=new URL(href,origin),next=new URL(login.searchParams.get('next')??'',origin);
  check(login.origin===origin && login.pathname==='/login' && login.hash==='' && login.searchParams.get('consumer')==='1' && JSON.stringify([...login.searchParams.keys()].sort())===JSON.stringify(['consumer','next']),f.entry.scenario+': consumer reentry keeps one safe next');
  check(next.origin===origin && next.pathname==='/me/rewards' && next.hash==='' && JSON.stringify([...next.searchParams.keys()])===JSON.stringify(expectedTenant?['tenant']:[]) && next.searchParams.get('tenant')===(expectedTenant||null),f.entry.scenario+': reentry retains only the intended validated or quoted tenant');
  check(![CLAIM,CLOCK_CLAIM_B,REFRESH_CLAIM,'SYNTHETIC_','NXR-','fromTap','eventId','tapAction','contact','pin','lat=','lng='].some(value=>href.includes(value)),f.entry.scenario+': reentry exposes no TAP, claim, voucher, location, contact or PIN');
  return {href,next:next.pathname+next.search};
}
function keepRefreshCase(f,evidence){
  const row={width:f.entry.width,theme:f.entry.theme,scenario:f.entry.scenario,syntheticProps:true,syntheticTransport:true,actualUiRead:true,...evidence,passed:true};
  report.mountedRefreshCases.push(row);Object.assign(f.entry,{passed:true,mountedRefresh:row});
}


// These helpers replace only the synthetic clipboard inside this owned loopback fixture.
report.mountedClipboardCases=[];
report.mountedClipboardUiTestsPrepared=true;
report.mountedClipboardUiTestsExecuted=false;
async function installDeferredClipboard(f){
  await f.page.evaluate(expectedOrigin=>{
    if(location.origin!==expectedOrigin || !['127.0.0.1','localhost'].includes(location.hostname))throw Error('Synthetic clipboard is restricted to the owned loopback fixture');
    const pending=[];window.__rewardPendingClipboard=pending;
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:value=>{
      const text=String(value);window.__rewardClipboardWrites.push(text);
      return new Promise((resolve,reject)=>pending.push({text,resolve,reject}));
    }}});
    window.__rewardFinishClipboard=outcome=>{
      const task=pending.shift();if(!task)throw Error('No owned synthetic clipboard operation is pending');
      if(outcome==='resolve')task.resolve();else if(outcome==='reject')task.reject(Error('Synthetic clipboard rejection'));else throw Error('Unknown synthetic clipboard outcome');
      return {outcome,text:task.text,remaining:pending.length,synthetic:true,realClipboard:false};
    };
  },origin);
}
async function waitClipboardPending(f,count){
  await waitRefreshUi(f,'the synthetic clipboard promise is retained',async()=>await f.page.evaluate(()=>window.__rewardPendingClipboard.length)===count);
}
function keepClipboardCase(f,evidence){
  const row={width:f.entry.width,theme:f.entry.theme,scenario:f.entry.scenario,syntheticProps:true,syntheticTransport:true,
    syntheticClipboardPromise:true,realClipboard:false,actualUiRead:true,...evidence,passed:true};
  report.mountedClipboardCases.push(row);Object.assign(f.entry,{passed:true,mountedClipboard:row});
}

report.mountedQuoteRefreshCases=[];
report.mountedQuoteRefreshTestsPrepared=true;
report.mountedQuoteRefreshTestsExecuted=false;

const privateFixtureSearch='&tenant=bodega-b&fromTap=1&eventId=42&action=rewards&tapAction=claim&bid=QA-LOT&voucher=SYNTHETIC_VOUCHER&code=SYNTHETIC_CODE&uid=SYNTHETIC_UID&mac=SYNTHETIC_MAC&ctr=17&freshToken=SYNTHETIC_FRESH&tapAccess=SYNTHETIC_ACCESS&token=SYNTHETIC_TOKEN&pin=SYNTHETIC_PIN&lat=-32&lng=-68&contact=SYNTHETIC_CONTACT&next=https%3A%2F%2Fevil.example#SYNTHETIC_FRAGMENT';
async function rewardReentryEvidence(page,label){
  const href=await page.getByRole('link',{name:'Volver a ingresar',exact:true}).getAttribute('href');
  check(typeof href==='string',label+': an explicit reentry link is available');
  const login=new URL(href,origin),next=login.searchParams.get('next'),destination=new URL(next ?? '',origin);
  check(login.origin===origin && login.pathname==='/login' && login.searchParams.get('consumer')==='1'
    && JSON.stringify([...login.searchParams.keys()].sort())===JSON.stringify(['consumer','next']) && login.hash==='',
    label+': reentry uses only the consumer login and a singleton next');
  check(destination.origin===origin && destination.pathname==='/me/rewards' && destination.hash===''
    && [...destination.searchParams.keys()].every(key=>key==='tenant'),
    label+': destination is only rewards and at most its brand; no TAP action or capability is replayed');
  check(!href.includes('SYNTHETIC_') && !href.includes('evil.example'),label+': route credentials, voucher codes, device fields and nested returns do not leak');
  return {href,next,expectedNext:'/me/rewards?tenant=bodega-a',destinationEntries:[...destination.searchParams.entries()],
    preserved:next==='/me/rewards?tenant=bodega-a'};
}

try{
  await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
  for(const width of [390,1280])for(const theme of ['light','dark']){
    const label=width+'/'+theme;
    {
      const f=await open(width,theme,'held-enter-and-checking');const {page}=f;
      try{
        await f.reserve.focus();await page.keyboard.down('Enter');await f.group.waitFor();await settle(page);await f.focusCheck(label);
        check(f.posts.length===0,label+': opening confirmation sends no reservation');
        const quote=(await f.group.innerText()).replace(/\s+/g,' ');
        check(quote.includes(BRAND) && quote.includes(PROGRAM) && quote.includes('40 puntos') && quote.includes('100 puntos'),label+': exact brand/program/cost/balance are reviewable');
        await page.addScriptTag({content:axe});const violations=await page.evaluate(async()=>(await axe.run('main',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})));
        check(violations.length===0,label+': zero axe violations in the confirmation view');
        check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+': no horizontal page overflow');
        const colors=await page.locator('.consumer-portal-root').evaluate(el=>({surface:getComputedStyle(el).getPropertyValue('--portal-surface').trim(),text:getComputedStyle(el).getPropertyValue('--portal-text').trim()}));
        check(colors.surface===(theme==='dark'?'#102737':'#ffffff'),label+': actual portal theme is applied');
        const screenshot=mode+'-confirmation-'+width+'-'+theme+'.png';await page.screenshot({path:join(output,screenshot),fullPage:true});
        await page.keyboard.down('Enter');await settle(page);await page.keyboard.up('Enter');
        if(!guarded)await waitFor(label+': repeated held Enter reaches the unsafe POST',()=>f.posts.length===1);
        check(f.posts.length===(guarded?0:1),label+': repeated Enter '+(guarded?'does not spend points':'reproduces one unsafe intercepted spend'));
        const keys=await page.evaluate(()=>window.__rewardKeyEvents.slice());
        check(keys.filter(row=>row.type==='keydown').length===2 && keys.filter(row=>row.type==='keydown')[1].repeat===true,label+': native second keydown is a repeat before keyup');
        if(guarded)await f.deliberateConfirm(label);
        check(f.posts.length===1 && JSON.stringify(f.posts[0].body)===JSON.stringify({claimIntent:'portal-first-reservation.v1',expectedPointsCost:40,locale:'es-AR'}),label+': single exact quoted POST stays intercepted');
        await page.getByText('Estamos preparando tu reserva. Esperá la confirmación.',{exact:true}).waitFor();
        await page.getByRole('searchbox',{name:'Buscar beneficio',exact:true}).fill('Bodega sintética B');
        check(await page.getByText('Estamos preparando tu reserva. Esperá la confirmación.',{exact:true}).count()===1,label+': filter changes preserve pending status');
        await page.keyboard.press('Enter');check(f.posts.length===1 && f.lookups.length===0,label+': pending filters and Enter never repeat POST');
        f.posts[0].release();await waitFor(label+': acknowledgement starts one private lookup',()=>f.lookups.length===1);
        await page.getByText('Recibimos la solicitud. Estamos comprobando tu voucher.',{exact:true}).waitFor();
        await page.getByRole('button',{name:'Publicados',exact:true}).click();
        check(await page.getByText('Recibimos la solicitud. Estamos comprobando tu voucher.',{exact:true}).count()===1 && f.posts.length===1,label+': filters preserve checking without another mutation');
        check(await page.getByText('ACK-MUST-NOT-SHOW',{exact:true}).count()===0,label+': acknowledgement alone exposes no voucher code');
        f.lookups[0].release();await page.getByText('Tu reserva figura en tu cuenta. Revisá el estado y vencimiento del voucher.',{exact:true}).waitFor();
        await page.getByRole('link',{name:'Ver mi voucher',exact:true}).click();await page.getByText('NXR-QA-ONLY',{exact:true}).waitFor();
        check(f.posts.length===1 && f.lookups.length===1,label+': receipt is confirmed only by one GET, with no rePOST');
        const spent=await f.card.getByText('Puntos del reclamo',{exact:true}).locator('..').locator('strong').innerText();
        const balance=await f.card.locator('[data-benefit-points="program"] strong').innerText();
        check(spent.replace(/\s+/g,' ').trim()==='40 pts' && balance.replace(/\s+/g,' ').trim()==='60 pts',label+': confirmed receipt preserves historical spend40 and reported programme balance60 instead of catalog cost80');
        Object.assign(f.entry,{passed:true,quote,keys,colors,violations,screenshot,unsafeSpendReproduced:!guarded});
      }finally{await f.finish();}
    }
    {
      const f=await open(width,theme,'cancel-and-reopen-quoted-reservation');const {page}=f;
      try{
        await f.openConfirm(label);await f.cancel().click();check(await f.reserve.evaluate(el=>el===document.activeElement) && f.posts.length===0,label+': cancellation returns to its initiator without a request');
        await page.keyboard.press('Enter');await f.group.waitFor();await settle(page);await f.focusCheck(label+' reopen');
        if(guarded)await page.keyboard.press('Tab');await page.keyboard.press('Tab');check(await f.cancel().evaluate(el=>el===document.activeElement),label+': cancel remains keyboard reachable');
        await page.keyboard.press('Enter');check(await f.reserve.evaluate(el=>el===document.activeElement) && f.posts.length===0,label+': repeated opening/canceling does not reserve');
        await f.openConfirm(label+' same quote');const quote=(await f.group.innerText()).replace(/\s+/g,' ');
        check(quote.includes(BRAND) && quote.includes(PROGRAM) && quote.includes('40 puntos') && quote.includes('100 puntos'),label+': reopen preserves the original displayed quote');
        await f.cancel().click();check(f.posts.length===0,label+': quoted cancellation remains non-mutating');
        f.entry.passed=true;
      }finally{await f.finish();}
    }
    for(const filter of ['search','view','brand']){
      const f=await open(width,theme,'confirmation-filter-'+filter);const {page}=f;
      try{
        await f.openConfirm(label+' '+filter);let control;
        if(filter==='search'){control=page.getByRole('searchbox',{name:'Buscar beneficio',exact:true});await control.focus();await control.fill('Sin coincidencias QA');}
        else if(filter==='view'){control=page.getByRole('button',{name:'Mis vouchers',exact:true});await control.click();}
        else{control=page.getByRole('combobox',{name:'Filtrar por marca',exact:true});await control.focus();await control.selectOption('bodega-b');}
        await f.group.waitFor({state:'detached'});await settle(page);
        const prompt=page.getByText('Confirmá la marca, el programa y los puntos antes de reservar.',{exact:true});
        check(await prompt.count()===(guarded?0:1),label+'/'+filter+': '+(guarded?'hidden preflight confirmation is cancelled':'baseline reproduces an orphaned confirmation notice'));
        check(await control.evaluate(el=>el===document.activeElement),label+'/'+filter+': filter retains focus');
        check(f.posts.length===0 && f.lookups.length===0,label+'/'+filter+': filtering is read-free and sends no reservation');
        const reset=page.getByRole('button',{name:'Limpiar filtros',exact:true});await reset.focus();await page.keyboard.press('Enter');await settle(page);
        const search=page.getByRole('searchbox',{name:'Buscar beneficio',exact:true});
        check(guarded ? await search.evaluate(el=>el===document.activeElement) : await page.evaluate(()=>document.activeElement===document.body),label+'/'+filter+': reset '+(guarded?'restores focus to the persistent search':'reproduces lost body focus after its button unmounts'));
        check(await f.group.count()===(guarded?0:1),label+'/'+filter+': reset '+(guarded?'does not resurrect the cancelled panel':'exposes the stale baseline panel again'));
        check(f.posts.length===0,label+'/'+filter+': reset does not post');
        if(!guarded)await f.cancel().click();await f.openConfirm(label+'/'+filter+' intentional reopen');await f.cancel().click();
        check(f.posts.length===0,label+'/'+filter+': a fresh deliberate open/cancel remains safe');
        Object.assign(f.entry,{passed:true,orphanedNoticeReproduced:!guarded});
      }finally{await f.finish();}
    }
    {
      const f=await open(width,theme,'batched-confirm-and-filter');const {page}=f;
      try{
        await f.openConfirm(label+' batched event');const probe=await page.evaluate(()=>window.__rewardBatchConfirmAndFilter());
        check(probe.sameCallStack && probe.afterConfirmGroupConnected && probe.afterFilterGroupConnected,label+': both synthetic activations occur before the confirmation render commits');
        await waitFor(label+': one batched intercepted reservation',()=>f.posts.length===1);await settle(page);
        check(await page.getByText('Estamos preparando tu reserva. Esperá la confirmación.',{exact:true}).count()===1,label+': same-tick filter change cannot cancel the already pending request');
        check(await page.getByRole('button',{name:'Mis vouchers',exact:true}).getAttribute('aria-pressed')==='true' && f.posts.length===1 && f.lookups.length===0,label+': filter selection applies without clearing pending state or repeating POST');
        f.posts[0].release();await waitFor(label+': batched request starts lookup',()=>f.lookups.length===1);await page.getByText('Recibimos la solicitud. Estamos comprobando tu voucher.',{exact:true}).waitFor();
        f.lookups[0].release();await page.getByText('Tu reserva figura en tu cuenta. Revisá el estado y vencimiento del voucher.',{exact:true}).waitFor();
        check(f.posts.length===1 && f.lookups.length===1,label+': batched submission still resolves through GET without another POST');
        Object.assign(f.entry,{passed:true,batchProbe:probe,nativeKeyboardEvidence:false});
      }finally{await f.finish();}
    }
    {
      const f=await open(width,theme,'uncertain-result-read-only-recovery',{postStatus:409});const {page}=f;
      try{
        await f.openConfirm(label+' uncertainty');await f.deliberateConfirm(label+' uncertainty');f.posts[0].release();
        await page.getByText('No pudimos confirmar el resultado. Comprobá tu reserva antes de hacer otra solicitud.',{exact:true}).waitFor();
        check(f.posts.length===1 && f.lookups.length===0,label+': uncertain POST does not retry or infer a receipt');
        await page.getByRole('searchbox',{name:'Buscar beneficio',exact:true}).fill('Bodega sintética B');
        check(await page.getByRole('button',{name:'Comprobar mi reserva',exact:true}).count()===1,label+': filtering preserves uncertain-result recovery');
        await page.getByRole('button',{name:'Limpiar filtros',exact:true}).click();
        check(await f.reserve.isDisabled(),label+': attempted reward remains locked against rePOST after filtering/reset');
        const lookup=page.getByRole('button',{name:'Comprobar mi reserva',exact:true});await lookup.evaluate(el=>{el.click();el.click();});
        await waitFor(label+': a double read activation produces one lookup',()=>f.lookups.length===1);
        await page.getByText('Estamos consultando tu reserva. Esta consulta no descuenta puntos.',{exact:true}).waitFor();
        check(f.posts.length===1,label+': checking never spends points again');
        f.lookups[0].items=[catalogRow(),otherRow()];f.lookups[0].release();
        await page.getByText('No encontramos una reserva confirmada en esta consulta. Podés comprobarla otra vez sin descontar puntos.',{exact:true}).waitFor();
        check(await f.reserve.isDisabled() && f.posts.length===1,label+': not-confirmed lookup retains no-rePOST state');
        await page.getByRole('button',{name:'Comprobar mi reserva',exact:true}).click();await waitFor(label+': next explicit lookup',()=>f.lookups.length===2);f.lookups[1].release();
        await page.getByText('Tu reserva figura en tu cuenta. Revisá el estado y vencimiento del voucher.',{exact:true}).waitFor();
        check(f.posts.length===1 && f.lookups.length===2,label+': explicit GET reconciliation resolves uncertainty without another POST');
        f.entry.passed=true;
      }finally{await f.finish();}
    }
    {
      const f=await open(width,theme,'reauth-after-post401',{postStatus:401,fixtureSearch:privateFixtureSearch});const {page}=f;
      try{
        await f.openConfirm(label+' POST401');await f.deliberateConfirm(label+' POST401');
        await page.getByText('Estamos preparando tu reserva. Esperá la confirmación.',{exact:true}).waitFor();
        await page.getByRole('combobox',{name:'Filtrar por marca',exact:true}).selectOption('bodega-b');
        check(f.posts.length===1 && f.lookups.length===0 && f.posts[0].status===401,label+': held POST401 keeps one attempted reservation and no speculative lookup');
        check(JSON.stringify(f.posts[0].body)===JSON.stringify({claimIntent:'portal-first-reservation.v1',expectedPointsCost:40,locale:'es-AR'}),label+': reauthentication does not add return fields to the reservation body');
        f.posts[0].release();await page.getByText('Tu sesión venció. Volvé a ingresar para consultar la reserva.',{exact:true}).waitFor();
        const afterFailure=await rewardReentryEvidence(page,label+' POST401');
        await page.getByRole('button',{name:'Limpiar filtros',exact:true}).click();
        check(await f.reserve.isDisabled(),label+': the original attempted reward stays locked after auth failure and filter reset');
        await f.reserve.evaluate(el=>{el.click();el.click();});await settle(page);
        const afterReset=await rewardReentryEvidence(page,label+' POST401 reset');
        check(f.posts.length===1 && f.lookups.length===0,label+': authentication-required, reset and disabled activations never rePOST or start GET');
        const evidence={width,theme,scenario:f.entry.scenario,stage:'POST401',afterFailure,afterReset,posts:f.posts.length,lookups:f.lookups.length,
          expectedPosts:1,expectedLookups:0,preserved:afterFailure.preserved && afterReset.preserved};
        report.reauthCases.push(evidence);Object.assign(f.entry,{passed:evidence.preserved,reauth:evidence});
      }finally{await f.finish();}
    }
    {
      const f=await open(width,theme,'reauth-after-acknowledged-get401',{lookupStatus:401,fixtureSearch:privateFixtureSearch});const {page}=f;
      try{
        await f.openConfirm(label+' GET401');await f.deliberateConfirm(label+' GET401');
        f.posts[0].release();await waitFor(label+': acknowledged reservation starts one private GET before GET401',()=>f.lookups.length===1);
        await page.getByText('Recibimos la solicitud. Estamos comprobando tu voucher.',{exact:true}).waitFor();
        await page.getByRole('combobox',{name:'Filtrar por marca',exact:true}).selectOption('bodega-b');
        check(f.posts.length===1 && f.lookups.length===1 && f.lookups[0].status===401,label+': held GET401 keeps the acknowledged reservation while a different brand is selected');
        check(await page.getByText('ACK-MUST-NOT-SHOW',{exact:true}).count()===0,label+': an acknowledgement never exposes an unconfirmed voucher');
        f.lookups[0].release();await page.getByText('Tu sesión venció. Volvé a ingresar para consultar la reserva.',{exact:true}).waitFor();
        const afterFailure=await rewardReentryEvidence(page,label+' GET401');
        await page.getByRole('button',{name:'Limpiar filtros',exact:true}).click();
        check(await f.reserve.isDisabled(),label+': the original attempted reward remains locked after an authenticated lookup expires');
        await f.reserve.evaluate(el=>{el.click();el.click();});await settle(page);
        const afterReset=await rewardReentryEvidence(page,label+' GET401 reset');
        check(f.posts.length===1 && f.lookups.length===1,label+': lookup reauthentication and reset never resend POST or automatically repeat GET');
        const evidence={width,theme,scenario:f.entry.scenario,stage:'POST200→GET401',afterFailure,afterReset,posts:f.posts.length,lookups:f.lookups.length,
          expectedPosts:1,expectedLookups:1,preserved:afterFailure.preserved && afterReset.preserved};
        report.reauthCases.push(evidence);Object.assign(f.entry,{passed:evidence.preserved,reauth:evidence});
      }finally{await f.finish();}
    }
    {
      const f=await open(width,theme,'mounted-expiry-exact-boundary',{clockFixture:true});const {page}=f;
      try{
        const held=await openClockDetails(f),anchor=await pauseAndSetClockSnapshot(f,'short');
        const start=await readClockView(f,['NXR-CLOCK-A','NXR-CLOCK-B']);
        check(start.codes.every(row=>row.visible) && start.writes.length===0,label+': fixed server snapshot exposes its future codes despite device year2100');
        await page.clock.setSystemTime('1900-01-01T00:00:00.000Z');
        await page.clock.runFor(1999);await clockBrowserTurn(page);
        const before=await readClockView(f,['NXR-CLOCK-A','NXR-CLOCK-B']);
        check(before.codes.every(row=>row.visible),label+': code remains visible one millisecond before its server-relative deadline');
        await page.clock.runFor(1);await clockBrowserTurn(page);
        const atBoundary=await readClockView(f,['NXR-CLOCK-A','NXR-CLOCK-B']);
        check(Math.abs(atBoundary.monotonic-anchor.monotonic-2000)<0.01,label+': controlled monotonic elapsed reaches exact +2000ms independently of Date');
        await tryHeldCopies(page,[held[0]]);
        const afterCopy=await readClockView(f,['NXR-CLOCK-A','NXR-CLOCK-B']);
        const contractPassed=!atBoundary.codes[0].visible && atBoundary.codes[1].visible && atBoundary.expiredLabelCount>=1
          && afterCopy.writes.length===0 && originalReceiptSourceUnchanged(start,afterCopy) && afterCopy.posts===0 && afterCopy.lookups===0;
        keepMountedCase(f,{serverCheckedAt:'2026-10-28T10:00:00.000Z',reportedExpiry:'2026-10-28T10:00:02.000Z',anchor,start,before,atBoundary,afterCopy},contractPassed,atBoundary.codes[0].visible || afterCopy.writes.length>0);
      }finally{await f.finish();}
    }
    {
      const f=await open(width,theme,'mounted-visible-focus-and-copy',{clockFixture:true});const {page}=f;
      try{
        await openClockDetails(f);const before=await readClockView(f,['NXR-CLOCK-A','NXR-CLOCK-B']);
        await page.getByRole('searchbox',{name:'Buscar beneficio',exact:true}).focus();
        const lifecycle=await page.evaluate(()=>window.__rewardLifecycleProbe('visible-focus'));
        await clockBrowserTurn(page);
        await page.getByRole('button',{name:'Copiar código',exact:true}).first().click();await page.clock.runFor(1000);await clockBrowserTurn(page);
        const after=await readClockView(f,['NXR-CLOCK-A','NXR-CLOCK-B']);
        const contractPassed=lifecycle.visibility==='visible' && after.codes.every(row=>row.visible)
          && JSON.stringify(after.writes)===JSON.stringify(['NXR-CLOCK-A']) && originalReceiptSourceUnchanged(before,after) && after.posts===0 && after.lookups===0;
        keepMountedCase(f,{before,lifecycle,after,clockObservationWindowMs:1000},contractPassed);
      }finally{await f.finish();}
    }
    {
      const f=await open(width,theme,'mounted-hidden-visible-freshness',{clockFixture:true});const {page}=f;
      try{
        const held=await openClockDetails(f),anchor=await pauseAndSetClockSnapshot(f,'stable');
        const before=await readClockView(f,['NXR-CLOCK-A','NXR-CLOCK-B']);
        const lifecycle=await page.evaluate(()=>window.__rewardLifecycleProbe('hidden-visible'));await page.clock.runFor(1000);await clockBrowserTurn(page);
        const afterLifecycle=await readClockView(f,['NXR-CLOCK-A','NXR-CLOCK-B']);
        await tryHeldCopies(page,held);const afterCopy=await readClockView(f,['NXR-CLOCK-A','NXR-CLOCK-B']);
        const contractPassed=before.codes.every(row=>row.visible) && afterLifecycle.codes.every(row=>!row.visible) && afterCopy.writes.length===0
          && originalReceiptSourceUnchanged(before,afterCopy) && afterCopy.posts===0 && afterCopy.lookups===0;
        keepMountedCase(f,{anchor,before,lifecycle,afterLifecycle,afterCopy,clockObservationWindowMs:1000,physicalBackgroundMeasured:false},contractPassed,afterLifecycle.codes.some(row=>row.visible) || afterCopy.writes.length>0);
      }finally{await f.finish();}
    }
    {
      const f=await open(width,theme,'mounted-bfcache-freshness',{clockFixture:true});const {page}=f;
      try{
        const held=await openClockDetails(f),anchor=await pauseAndSetClockSnapshot(f,'stable');
        const before=await readClockView(f,['NXR-CLOCK-A','NXR-CLOCK-B']);
        const lifecycle=await page.evaluate(()=>window.__rewardLifecycleProbe('bfcache'));await page.clock.runFor(1000);await clockBrowserTurn(page);
        const afterLifecycle=await readClockView(f,['NXR-CLOCK-A','NXR-CLOCK-B']);
        await tryHeldCopies(page,held);const afterCopy=await readClockView(f,['NXR-CLOCK-A','NXR-CLOCK-B']);
        const contractPassed=before.codes.every(row=>row.visible) && afterLifecycle.codes.every(row=>!row.visible) && afterCopy.writes.length===0
          && originalReceiptSourceUnchanged(before,afterCopy) && afterCopy.posts===0 && afterCopy.lookups===0;
        keepMountedCase(f,{anchor,before,lifecycle,afterLifecycle,afterCopy,clockObservationWindowMs:1000,actualBfcacheNavigationMeasured:false},contractPassed,afterLifecycle.codes.some(row=>row.visible) || afterCopy.writes.length>0);
      }finally{await f.finish();}
    }
    {
      const f=await open(width,theme,'mounted-source-change-clock-owner',{clockFixture:true});const {page}=f;
      try{
        await openClockDetails(f);const oldAnchor=await pauseAndSetClockSnapshot(f,'short');
        await page.clock.runFor(1000);await clockBrowserTurn(page);
        const revision=await page.evaluate(()=>window.__rewardReplaceSnapshot('replacement')),newAnchor=await waitAppliedSnapshot(page,revision);
        await clockBrowserTurn(page);
        const replacement=page.locator('article').filter({has:page.getByRole('heading',{name:'Voucher nuevo de otra marca QA',exact:true})});
        const copy=await replacement.getByRole('button',{name:'Copiar código',exact:true}).elementHandle();
        const before=await readClockView(f,['NXR-CLOCK-C']);
        check(before.codes[0].visible && before.receiptFacts.length===1 && before.receiptFacts[0].tenant==='bodega-c',label+': new explicit server snapshot is visible and scoped before the old deadline');
        await page.clock.runFor(1000);await clockBrowserTurn(page);
        const oldBoundary=await readClockView(f,['NXR-CLOCK-C']);
        check(oldBoundary.codes[0].visible && originalReceiptSourceUnchanged(before,oldBoundary),label+': old source deadline does not hide or mutate the replacement receipt');
        await page.clock.runFor(999);await clockBrowserTurn(page);
        const beforeNewBoundary=await readClockView(f,['NXR-CLOCK-C']);
        check(beforeNewBoundary.codes[0].visible,label+': replacement remains visible until its own final millisecond');
        await page.clock.runFor(1);await clockBrowserTurn(page);
        const newBoundary=await readClockView(f,['NXR-CLOCK-C']);
        check(Math.abs(newBoundary.monotonic-newAnchor.monotonic-2000)<0.01,label+': replacement uses its own +2000ms monotonic boundary');
        await tryHeldCopies(page,[copy]);const afterCopy=await readClockView(f,['NXR-CLOCK-C']);
        const contractPassed=!newBoundary.codes[0].visible && newBoundary.expiredLabelCount>=1 && afterCopy.writes.length===0
          && originalReceiptSourceUnchanged(before,afterCopy) && afterCopy.posts===0 && afterCopy.lookups===0;
        keepMountedCase(f,{oldAnchor,newAnchor,before,oldBoundary,beforeNewBoundary,newBoundary,afterCopy},contractPassed,newBoundary.codes[0].visible || afterCopy.writes.length>0);
      }finally{await f.finish();}
    }
// Insert AFTER the five R1 mounted cases, inside the existing width/theme loop.
// POST-BASELINE-ONLY: these cases intentionally require the future real refresh UI.
    {
      const f=await openRefreshFixture(width,theme,'mounted-refresh-single-notice');
      try{
        const stale=await invalidateRefreshFixture(f);
        check(await f.page.getByText(/Última consulta/).count()===1,label+': one last-query label describes the observed snapshot, without a synchronized-time claim');
        await refreshAction(f).focus();
        check(await refreshAction(f).evaluate(node=>node===document.activeElement),label+': refresh can receive keyboard focus');
        await f.page.evaluate(()=>window.__rewardLifecycleProbe('visible-focus'));await clockBrowserTurn(f.page);
        check(await f.page.getByText(REFRESH_NOTICE,{exact:true}).count()===1 && await refreshAction(f).count()===1,label+': focus does not duplicate the shared notice or action');
        await f.page.clock.runFor(1000);await clockBrowserTurn(f.page);
        check(f.lookups.length===0 && f.posts.length===0,label+': there is no automatic request over the controlled next second');
        await f.page.addScriptTag({content:axe});
        const accessibility=await f.page.evaluate(()=>window.axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
        check(accessibility.violations.length===0,label+': stale receipt and refresh action have no AXE violations in this synthetic view');
        check(await f.page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),label+': the refresh notice has no horizontal overflow');
        if(width===390)await f.page.screenshot({path:join(output,'mounted-refresh-390-'+theme+'.png'),fullPage:true});
        keepRefreshCase(f,{stale,zeroAutomaticReads:true,accessibilityViolations:accessibility.violations.map(row=>row.id)});
      }finally{await f.finish();}
    }
    {
      const f=await openRefreshFixture(width,theme,'mounted-refresh-failure-retains-whole-snapshot');
      try{
        const stale=await invalidateRefreshFixture(f),failures=[];
        for(const failure of ['http503','invalid-checkedAt','timeout']){
          const row=await activateRefresh(f);
          check(await refreshAction(f).isDisabled(),label+': the same refresh action stays mounted and disabled while reading');
          if(failure==='http503'){row.status=503;row.payload={ok:false,error:'synthetic_unavailable'};row.release();}
          else if(failure==='invalid-checkedAt'){row.payload={...refreshPayload(),checkedAt:'not-a-clock'};row.release();}
          else await f.page.clock.runFor(6001);
          await waitRefreshUi(f,'failed read offers an explicit retry',async()=>await refreshAction(f).count()===1 && await refreshAction(f).isEnabled());
          const after=await renderedRefreshRows(f);
          check(JSON.stringify(after)===JSON.stringify(stale.blocked),label+': '+failure+' preserves every prior rendered receipt/catalog fact and keeps codes blocked');
          check(f.posts.length===0,label+': read failure never sends a reservation');
          failures.push({failure,after,lookups:f.lookups.length,posts:f.posts.length});
        }
        const options=await readOptionEvidence(f);check(f.lookups.length===3,label+': only the three deliberate retries reached GET');
        keepRefreshCase(f,{failures,options,previousSnapshotRetained:true});
      }finally{await f.finish();}
    }
    {
      const f=await openRefreshFixture(width,theme,'mounted-refresh-success-exact-replacement');
      try{
        const stale=await invalidateRefreshFixture(f),row=await activateRefresh(f);row.payload=refreshPayload();row.release();
        await waitRefreshUi(f,'real response changed the rendered title',async()=>await f.page.getByRole('heading',{name:'Voucher actualizado A QA',exact:true}).count()===1);
        await showRefreshOwnedDetails(f);const after=await renderedRefreshRows(f),expected=row.payload.items;
        check(JSON.stringify(after.map(value=>value.title))===JSON.stringify(expected.map(value=>value.title)),label+': the real GET replaces the entire rendered collection in response order');
        check(JSON.stringify(after.filter(value=>value.id).map(value=>value.id))===JSON.stringify(['voucher-claim-'+CLAIM,'voucher-claim-'+CLOCK_CLAIM_B,'voucher-claim-88888888-8888-4888-8888-888888888888']),label+': returned owned receipt identities are exact, including another valid own brand');
        check(JSON.stringify(after.filter(value=>value.code).map(value=>value.code))===JSON.stringify(['NXR-FRESH-A','NXR-FRESH-B','NXR-FRESH-C']),label+': only the returned codes are presented, never codes from props or POST acknowledgements');
        check(after[0].historicalSpend===stale.before[0].historicalSpend && after[1].historicalSpend===stale.before[1].historicalSpend,label+': refreshing does not replace historical spend with current catalog prices');
        check(await f.page.getByText(REFRESH_NOTICE,{exact:true}).count()===0 && f.posts.length===0 && f.lookups.length===1,label+': successful explicit read clears the stale notice without mutation');
        const originalProps=await f.page.evaluate(()=>window.__rewardFixtureReceiptFacts());
        check(originalProps[0].code==='NXR-CLOCK-A' && originalProps[1].code==='NXR-CLOCK-B',label+': response application is proven by actual DOM, not a fixture-prop replacement');
        const postSuccessLifecycle=await f.page.evaluate(()=>window.__rewardLifecycleProbe('hidden-visible'));await clockBrowserTurn(f.page);
        const staleAfterSuccess=await renderedRefreshRows(f);
        check(staleAfterSuccess.every(row=>row.code===null) && JSON.stringify(withoutPresentedCodes(staleAfterSuccess))===JSON.stringify(withoutPresentedCodes(after)),label+': later lifecycle invalidation blocks fresh codes while preserving the successful response receipts');
        check(await f.page.getByText(REFRESH_NOTICE,{exact:true}).count()===1 && await f.page.getByText('Actualizamos la consulta de tus vouchers.',{exact:true}).count()===0,label+': stale presentation replaces the completed-read acknowledgement with one current notice');
        check(f.posts.length===0 && f.lookups.length===1,label+': lifecycle after a successful explicit read makes no automatic request');
        keepRefreshCase(f,{after,postSuccessLifecycle,staleAfterSuccess,options:await readOptionEvidence(f),originalPropsRemainFixtureOnly:true});
      }finally{await f.finish();}
    }
    {
      const f=await openRefreshFixture(width,theme,'mounted-refresh-missing-old-claim-retains-whole-snapshot');
      try{
        const stale=await invalidateRefreshFixture(f),row=await activateRefresh(f),fresh=refreshPayload();
        row.payload={...fresh,items:[fresh.items[0],fresh.items[2],fresh.items[3]]};row.release();
        await waitRefreshUi(f,'partial read leaves an explicit retry',async()=>await refreshAction(f).count()===1 && await refreshAction(f).isEnabled());
        const after=await renderedRefreshRows(f);
        check(JSON.stringify(after)===JSON.stringify(stale.blocked),label+': an absent prior claim preserves the old whole snapshot instead of mixing private collections');
        check(await f.page.getByRole('heading',{name:'Voucher actualizado A QA',exact:true}).count()===0 && after.every(value=>value.code===null),label+': partial response neither renews one old code nor infers cancellation of the absent receipt');
        check(f.posts.length===0 && f.lookups.length===1,label+': missing old receipt triggers no mutation or automatic second read');
        keepRefreshCase(f,{after,returnedIds:row.payload.items.map(value=>value.claim_id??value.id),options:await readOptionEvidence(f)});
      }finally{await f.finish();}
    }
    {
      const f=await openRefreshFixture(width,theme,'mounted-refresh-stale-response-owner');
      try{
        await invalidateRefreshFixture(f);const row=await activateRefresh(f);row.allowOwnedSourceAbort=true;
        const revision=await f.page.evaluate(()=>window.__rewardReplaceSnapshot('replacement'));await waitAppliedSnapshot(f.page,revision);await clockBrowserTurn(f.page);
        await showRefreshOwnedDetails(f);const replacement=await renderedRefreshRows(f);
        row.payload=refreshPayload();row.release();
        await f.page.clock.runFor(1000);await clockBrowserTurn(f.page);
        const after=await renderedRefreshRows(f);
        check(JSON.stringify(after)===JSON.stringify(replacement) && after.length===1 && after[0].title==='Voucher nuevo de otra marca QA' && after[0].code==='NXR-CLOCK-C',label+': late response cannot overwrite the new source or its clock anchor');
        check(await f.page.getByRole('heading',{name:'Voucher actualizado A QA',exact:true}).count()===0 && f.posts.length===0 && f.lookups.length===1,label+': old read is ignored rather than replayed or applied to the next source');
        keepRefreshCase(f,{replacement,after,options:await readOptionEvidence(f)});
      }finally{await f.finish();}
    }
    {
      const f=await openRefreshFixture(width,theme,'mounted-refresh-401-safe-without-quote',{privateSearch:true});
      try{
        await invalidateRefreshFixture(f);
        await f.page.getByRole('combobox',{name:'Filtrar por marca',exact:true}).selectOption('bodega-b');
        const row=await activateRefresh(f);row.status=401;row.payload={ok:false,error:'synthetic_unauthorized'};row.release();
        const reentry=await safeRefreshReentry(f,'bodega-b'),after=await renderedRefreshRows(f);
        check(after.length===1 && after[0].id==='voucher-claim-'+CLOCK_CLAIM_B && after[0].code===null,label+': authentication failure retains the filtered receipt but exposes no old code');
        check(f.posts.length===0 && f.lookups.length===1,label+': reentry follows a single explicit read');
        keepRefreshCase(f,{reentry,after,options:await readOptionEvidence(f)});
      }finally{await f.finish();}
    }
    {
      const f=await openRefreshFixture(width,theme,'mounted-refresh-writer-first-phase-guards',{privateSearch:true});
      try{
        await invalidateRefreshFixture(f);
        const third=f.page.locator('article').filter({has:f.page.getByRole('heading',{name:REFRESH_TITLE,exact:true})});
        await third.getByRole('button',{name:'Reservar beneficio',exact:true}).click();await clockBrowserTurn(f.page);
        const batch=await f.page.evaluate(()=>window.__rewardBatchRefreshControls('confirm'));
        await waitFor(label+': exactly one synthetic third-reward POST',()=>f.posts.length===1);await clockBrowserTurn(f.page);
        check(f.lookups.length===0,label+': same-turn refresh cannot race a writer which already acquired its guard');
        const heldRefresh=await refreshAction(f).elementHandle();check(await refreshAction(f).isDisabled(),label+': refresh is disabled during pending POST');
        check(f.posts[0].path==='/api/consumer/rewards/'+REFRESH_REWARD+'/claim' && f.posts[0].body.expectedPointsCost===40 && f.posts[0].body.claimIntent==='portal-first-reservation.v1',label+': original third-reward quote reaches the existing writer unchanged');
        await f.page.getByRole('combobox',{name:'Filtrar por marca',exact:true}).selectOption('bodega-b');
        f.posts[0].release();await waitFor(label+': acknowledgement leads to one existing reconciliation GET',()=>f.lookups.length===1);await clockBrowserTurn(f.page);
        await heldRefresh.evaluate(node=>node.click());await clockBrowserTurn(f.page);
        check(f.lookups.length===1 && f.posts.length===1,label+': checking GET excludes another refresh');
        f.lookups[0].status=503;f.lookups[0].payload={ok:false,error:'synthetic_unavailable'};f.lookups[0].release();
        const checkButton=f.page.getByRole('button',{name:'Comprobar mi reserva',exact:true});await checkButton.waitFor();
        await heldRefresh.evaluate(node=>node.click());await clockBrowserTurn(f.page);
        check(f.lookups.length===1 && f.posts.length===1,label+': uncertain flow offers its existing reconciliation instead of competing refresh or another POST');
        await f.page.getByRole('combobox',{name:'Filtrar por marca',exact:true}).selectOption('');
        check(await third.getByRole('button',{name:'Reservar beneficio',exact:true}).isDisabled(),label+': failed read and filter changes did not clear the attempted guard');
        await checkButton.click();await waitFor(label+': deliberate reconciliation is GET-only',()=>f.lookups.length===2);
        f.lookups[1].status=401;f.lookups[1].payload={ok:false,error:'synthetic_unauthorized'};f.lookups[1].release();
        const reentry=await safeRefreshReentry(f,'bodega-a');
        check(f.posts.length===1 && f.lookups.length===2,label+': writer quote/claim flow is retained through GET failure and reentry');
        keepRefreshCase(f,{batch,reentry,quotedTenant:'bodega-a',options:await readOptionEvidence(f),originalQuoteNotResent:true});
      }finally{await f.finish();}
    }
    {
      const f=await openRefreshFixture(width,theme,'mounted-refresh-reader-first-phase-guards');
      try{
        await invalidateRefreshFixture(f);
        const third=f.page.locator('article').filter({has:f.page.getByRole('heading',{name:REFRESH_TITLE,exact:true})});
        await third.getByRole('button',{name:'Reservar beneficio',exact:true}).click();await clockBrowserTurn(f.page);
        const batch=await f.page.evaluate(()=>window.__rewardBatchRefreshControls('refresh'));
        await waitFor(label+': deliberate refresh acquires its read guard',()=>f.lookups.length===1);await clockBrowserTurn(f.page);
        check(f.posts.length===0,label+': a held confirmation cannot start a writer after refresh acquired its guard in the same turn');
        const held=await refreshAction(f).elementHandle();await held.evaluate(node=>node.click());await clockBrowserTurn(f.page);
        check(f.lookups.length===1 && f.posts.length===0,label+': a second activation during pending refresh starts no duplicate read or POST');
        f.lookups[0].status=503;f.lookups[0].payload={ok:false,error:'synthetic_unavailable'};f.lookups[0].release();
        await waitRefreshUi(f,'failed refresh releases only the read guard',async()=>await refreshAction(f).count()===1 && await refreshAction(f).isEnabled());
        check(f.lookups.length===1 && f.posts.length===0,label+': failure does not automatically retry or submit the retained confirmation');
        keepRefreshCase(f,{batch,options:await readOptionEvidence(f),noAutomaticWriter:true});
      }finally{await f.finish();}
    }

    // One additional scenario family with two explicitly counted contexts per viewport/theme.
    for(const clipboardOutcome of ['resolve','reject']){
      const f=await openRefreshFixture(width,theme,'mounted-refresh-late-clipboard-'+clipboardOutcome);
      try{
        await installDeferredClipboard(f);
        const cardA=f.page.locator('article[id="voucher-claim-'+CLAIM+'"]'),before=await renderedRefreshRows(f);
        check(before[0].code==='NXR-CLOCK-A' && before[1].code==='NXR-CLOCK-B',label+': the old owned codes are visible before the deliberate synthetic copy');
        await cardA.getByRole('button',{name:'Copiar código',exact:true}).click();await waitClipboardPending(f,1);
        check(JSON.stringify(await f.page.evaluate(()=>window.__rewardClipboardWrites))===JSON.stringify(['NXR-CLOCK-A']),label+': the pending clipboard operation contains exactly the old owned code');
        check(f.posts.length===0 && f.lookups.length===0,label+': copying starts no read or reservation');
        const request=await activateRefresh(f);request.payload=refreshPayload();request.release();
        await waitRefreshUi(f,'the real GET updates the same claim with a fresh code',async()=>await f.page.getByRole('heading',{name:'Voucher actualizado A QA',exact:true}).count()===1);
        await showRefreshOwnedDetails(f);
        const replacement=await renderedRefreshRows(f);
        check(replacement[0].id===before[0].id && replacement[0].code==='NXR-FRESH-A' && replacement[0].historicalSpend===before[0].historicalSpend,label+': a validated GET retains the same claim and historical spend while replacing its displayed code');
        check(before.filter(row=>row.id).every(row=>replacement.some(next=>next.id===row.id)),label+': every previous issued receipt remains present after refresh');
        check(await f.page.getByText('Última consulta',{exact:true}).count()===1 && await f.page.locator('time[datetime="2026-10-28T10:00:30.000Z"]').count()===1,label+': last-query metadata belongs to the explicit response');
        const oldCompletion=await f.page.evaluate(outcome=>window.__rewardFinishClipboard(outcome),clipboardOutcome);await clockBrowserTurn(f.page);
        const afterOldCompletion=await renderedRefreshRows(f);
        check(JSON.stringify(afterOldCompletion)===JSON.stringify(replacement),label+': settling the previous clipboard promise cannot change the replacement voucher or receipt collection');
        check(await cardA.getByRole('button',{name:'Copiar código',exact:true}).count()===1 && await cardA.getByRole('button',{name:'Código copiado',exact:true}).count()===0,label+': the old clipboard result cannot mark the replacement code as copied');
        check(await cardA.getByText('No se pudo copiar. Podés seleccionar el código y copiarlo manualmente.',{exact:true}).count()===0
          && await cardA.getByText('Listo. El código está en tu portapapeles.',{exact:true}).count()===0,label+': neither an old rejection nor success produces feedback for the replacement code');
        // Positive control: the current code can still be deliberately copied and acknowledged.
        await cardA.getByRole('button',{name:'Copiar código',exact:true}).click();await waitClipboardPending(f,1);
        const currentCompletion=await f.page.evaluate(()=>window.__rewardFinishClipboard('resolve'));await clockBrowserTurn(f.page);
        await waitRefreshUi(f,'the current clipboard result acknowledges only the current code',async()=>await cardA.getByRole('button',{name:'Código copiado',exact:true}).count()===1);
        const writes=await f.page.evaluate(()=>window.__rewardClipboardWrites.slice());
        check(JSON.stringify(writes)===JSON.stringify(['NXR-CLOCK-A','NXR-FRESH-A']) && currentCompletion.text==='NXR-FRESH-A',label+': the current positive control writes the fresh code exactly once');
        check(f.posts.length===0 && f.lookups.length===1,label+': both synthetic copies and their completions leave only the one deliberate GET and zero POSTs');
        keepClipboardCase(f,{clipboardOutcome,oldCompletion,currentCompletion,before,replacement,afterOldCompletion,writes,options:await readOptionEvidence(f)});
      }finally{await f.finish();}
    }

    {
      const f=await openRefreshFixture(width,theme,'mounted-refresh-obsolete-confirmation-quote');
      try{
        const third=f.page.locator('article').filter({has:f.page.getByRole('heading',{name:REFRESH_TITLE,exact:true})});
        await third.getByRole('button',{name:'Reservar beneficio',exact:true}).click();await clockBrowserTurn(f.page);
        const oldConfirmation=third.getByRole('button',{name:'Confirmar reserva por 40 puntos',exact:true});
        check(await oldConfirmation.count()===1 && await oldConfirmation.isEnabled(),label+': an explicit forty-point confirmation is open before the refresh');
        const heldConfirmation=await oldConfirmation.elementHandle(),before=await renderedRefreshRows(f);
        const request=await activateRefresh(f),fresh=refreshPayload();
        fresh.items=fresh.items.map(row=>row.id===REFRESH_REWARD?{...row,points_cost:80,program_points_balance:100}:row);
        request.payload=fresh;request.release();
        await waitRefreshUi(f,'the refreshed catalog displays the changed price',async()=>{
          const cost=third.locator('strong').filter({hasText:/^80\s*pts$/});return await cost.count()===1;
        });
        const explanation=f.page.getByText('La información de este beneficio cambió. Revisá el costo y volvé a preparar la reserva.',{exact:true});
        await explanation.waitFor();await clockBrowserTurn(f.page);
        check(await oldConfirmation.count()===0 && await heldConfirmation.evaluate(node=>!node.isConnected),label+': refreshed conditions replace the obsolete confirmation with an explicit explanation');
        await heldConfirmation.evaluate(node=>node.click());await clockBrowserTurn(f.page);
        check(f.posts.length===0 && f.lookups.length===1,label+': a retained old confirmation cannot submit the old quote after refresh');
        const after=await renderedRefreshRows(f);
        check(before.filter(row=>row.id).every(row=>after.some(next=>next.id===row.id && next.historicalSpend===row.historicalSpend)),label+': refreshing a catalog quote retains all prior voucher receipts and historical spend');
        check(await third.getByRole('button',{name:'Reservar beneficio',exact:true}).isEnabled(),label+': the user can deliberately review the current quote instead of encountering a silent dead end');
        await third.getByRole('button',{name:'Reservar beneficio',exact:true}).click();await clockBrowserTurn(f.page);
        const currentConfirmation=third.getByRole('button',{name:'Confirmar reserva por 80 puntos',exact:true}),heading=third.getByRole('heading',{name:'Revisá tu reserva',exact:true});
        check(await currentConfirmation.count()===1 && await currentConfirmation.isEnabled() && await oldConfirmation.count()===0,label+': the next deliberate reservation opens only the refreshed eighty-point confirmation');
        check(await third.getByText('Tu saldo informado es de 100 puntos.',{exact:false}).count()===1,label+': the confirmation uses the reported programme balance without mixing balances');
        check(await heading.evaluate(node=>node===document.activeElement && node.getAttribute('tabindex')==='-1'),label+': reviewing changed conditions keeps neutral confirmation focus');
        check(f.posts.length===0 && f.lookups.length===1,label+': preparing the new quote does not spend or automatically submit it');
        const row={width,theme,scenario:f.entry.scenario,syntheticProps:true,syntheticTransport:true,actualUiRead:true,
          originalQuoteCost:40,currentQuoteCost:80,currentProgrammeBalance:100,before,after,options:await readOptionEvidence(f),retainedNodeWasDisconnected:true,passed:true};
        report.mountedQuoteRefreshCases.push(row);Object.assign(f.entry,{passed:true,mountedQuoteRefresh:row});
      }finally{await f.finish();}
    }

  }
  report.sourceAfter=await sourceHashes();assert.deepEqual(report.sourceAfter,sourceBefore);
  check(report.errors.length===0 && report.blockedRequests.length===0,'No application errors or unexpected/external requests');
  check(report.serverRequests.every(row=>row.method==='GET'),'Every POST/lookup is intercepted before reaching even the local fixture server');
  check(report.reauthCases.length===8 && report.reauthCases.every(row=>row.preserved),'Both POST401 and POST200→GET401 preserve the original quoted tenant after pending filter changes in all four existing viewports/themes');
  report.mountedExpiryDefectReproduced=report.mountedClockCases.length===20 && report.mountedClockCases.filter(row=>row.scenario!=='mounted-visible-focus-and-copy').every(row=>row.defectObserved) && report.mountedClockCases.filter(row=>row.scenario==='mounted-visible-focus-and-copy').every(row=>row.contractPassed);
  check(report.mountedClockCases.length===20 && report.mountedClockCases.every(row=>row.contractPassed),'All five mounted clock/lifecycle/source scenarios satisfy their existing-code contract in each viewport/theme');
  report.mountedRefreshUiTestsExecuted=report.mountedRefreshCases.length===32;
  check(report.mountedRefreshCases.length===32 && report.mountedRefreshCases.every(row=>row.passed),'All eight explicit-refresh scenarios cover mobile/desktop and light/dark');
  report.mountedClipboardUiTestsExecuted=report.mountedClipboardCases.length===8;
  check(report.mountedClipboardCases.length===8 && report.mountedClipboardCases.every(row=>row.passed),'Both late clipboard outcomes cover mobile/desktop and light/dark without changing the earlier eighty-eight cases');
  report.mountedQuoteRefreshTestsExecuted=report.mountedQuoteRefreshCases.length===4;
  check(report.mountedQuoteRefreshCases.length===4 && report.mountedQuoteRefreshCases.every(row=>row.passed),'A refreshed quote change replaces obsolete confirmation with a deliberate current quote in each viewport/theme');
  check(report.cases.length===100 && report.cases.every(row=>row.passed),'The twenty-five explicitly counted scenarios cover mobile/desktop and light/dark');
  report.passed=true;report.regressionPassed=guarded;report.releaseAcceptanceEligible=false; // Prototype excludes the unwired explicit-refresh UI contract.
  report.baselineDefectReproduced=!guarded && report.cases.filter(row=>row.scenario==='held-enter-and-checking').every(row=>row.unsafeSpendReproduced)
    && report.cases.filter(row=>row.scenario.startsWith('confirmation-filter-')).every(row=>row.orphanedNoticeReproduced);
}catch(error){report.failure=String(error.stack || error);process.exitCode=1;}
finally{
  for(const context of contexts)await context.close();contexts.clear();report.closure.contexts=true;
  if(browser){await browser.close();report.closure.browser=true;}
  server.closeAllConnections();if(server.listening)await new Promise(done=>server.close(done));report.closure.server=!server.listening;stop();report.closure.esbuild=true;
  report.completedAt=new Date().toISOString();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({report:join(output,'report.json'),mode,passed:report.passed,regressionPassed:report.regressionPassed,baselineDefectReproduced:report.baselineDefectReproduced,releaseAcceptanceEligible:report.releaseAcceptanceEligible,checks:report.checks.length,cases:report.cases.length,failure:report.failure,closure:report.closure}));
}
