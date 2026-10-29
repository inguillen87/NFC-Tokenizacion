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
const entry=`import'tailwindcss/preflight.css';import React,{useMemo,useState}from'react';import{unstable_batchedUpdates}from'react-dom';import{createRoot}from'react-dom/client';
import{ConsumerRewardsClient}from'./src/app/me/rewards/rewards-client';import{buildConsumerRewardsModel}from'./src/app/me/_components/consumer-rewards-model';import portalStyles from'./src/app/me/_components/portal-shell.module.css';import rewardsStyles from'./src/app/me/rewards/rewards.module.css';
const initial=${JSON.stringify([catalogRow(),otherRow()])};window.__rewardKeyEvents=[];
for(const type of ['keydown','keyup'])window.addEventListener(type,event=>{if(event.key==='Enter')window.__rewardKeyEvents.push({type,key:event.key,repeat:event.repeat,tag:event.target?.tagName,text:event.target?.textContent?.trim().slice(0,180)});});
window.__rewardBatchConfirmAndFilter=()=>{const article=[...document.querySelectorAll('article')].find(node=>node.querySelector('h3')?.textContent===${JSON.stringify(TITLE)});const group=article?.querySelector('[role="group"]');const submit=[...(group?.querySelectorAll('button')||[])].find(node=>/^Confirmar reserva por/.test(node.textContent||''));const filter=[...document.querySelectorAll('button')].find(node=>node.textContent==='Mis vouchers');if(!group||!submit||!filter)throw Error('Synthetic batch controls unavailable');const probe={sameCallStack:true,batchHelper:'ReactDOM.unstable_batchedUpdates',afterConfirmGroupConnected:false,afterFilterGroupConnected:false};unstable_batchedUpdates(()=>{submit.click();probe.afterConfirmGroupConnected=group.isConnected;filter.focus();filter.click();probe.afterFilterGroupConnected=group.isConnected;});return probe;};
function Fixture(){const[rows]=useState(initial);
const model=useMemo(()=>buildConsumerRewardsModel({ok:true,items:rows,scope:'own_brands',limit:100},'2026-10-28T10:00:00.000Z'),[rows]);
if(model.status!=='ready')throw Error('Synthetic fixture model rejected');return <div className={'consumer-portal-root '+portalStyles.portal}><main className={portalStyles.main}><div className={portalStyles.pageHeading}><h1>Reservas de beneficios · QA local</h1><p>Componente real, marcas y transportes sintéticos; no acredita operaciones de clientes.</p></div><div className={rewardsStyles.rewards}><ConsumerRewardsClient items={model.items} checkedAt='2026-10-28T10:00:00.000Z' initialTenant='' selectedVoucher={null}/></div></main></div>};createRoot(document.getElementById('root')).render(<Fixture/>);`;
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
async function open(width,theme,scenario,{postStatus=200,lookupStatus=200,fixtureSearch=''}={}){
  const context=await browser.newContext({viewport:{width,height:1000},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'});contexts.add(context);
  const page=await context.newPage();page.setDefaultTimeout(10000);const posts=[],lookups=[],routeTasks=new Set();let closeStarted=false;
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
  await page.goto(origin+'/?theme='+theme+fixtureSearch,{waitUntil:'networkidle'});
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
  }
  report.sourceAfter=await sourceHashes();assert.deepEqual(report.sourceAfter,sourceBefore);
  check(report.errors.length===0 && report.blockedRequests.length===0,'No application errors or unexpected/external requests');
  check(report.serverRequests.every(row=>row.method==='GET'),'Every POST/lookup is intercepted before reaching even the local fixture server');
  check(report.reauthCases.length===8 && report.reauthCases.every(row=>row.preserved),'Both POST401 and POST200→GET401 preserve the original quoted tenant after pending filter changes in all four existing viewports/themes');
  check(report.cases.length===36 && report.cases.every(row=>row.passed),'All nine scenarios cover mobile/desktop and light/dark');
  report.passed=true;report.regressionPassed=guarded;report.releaseAcceptanceEligible=guarded && Boolean(process.env.QA_SOURCE);
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
