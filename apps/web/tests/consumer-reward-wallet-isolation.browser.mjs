// Real React, wallet panel, reward writer and CSS; synthetic props and loopback
// transport. This post-runtime candidate is not a Next server or an auth proof.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build,stop} from 'esbuild';

assert.ok(process.env.PLAYWRIGHT_MODULE && process.env.CHROME_PATH && process.env.AXE_MODULE_PATH && process.env.QA_OUTPUT,
  'Use explicit installed tools and new external output; never download dependencies');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
const web=fileURLToPath(new URL('../',import.meta.url)),root=resolve(web,'../..'),output=resolve(process.env.QA_OUTPUT);
assert.ok(output!==root && !output.startsWith(root+'\\') && !output.startsWith(root+'/'),'QA output must be outside the worktree');
const hash=value=>createHash('sha256').update(value).digest('hex');
const sourcePaths=[
  'src/app/me/_components/consumer-reward-brand-points-client.tsx','src/app/me/_components/consumer-wallet-brand-read.ts',
  'src/app/me/_components/consumer-bounded-fetch.ts','src/app/me/_components/consumer-wallet-points-model.ts',
  'src/app/me/_components/consumer-rewards-model.ts','src/app/me/_components/consumer-reward-reservation.ts',
  'src/app/me/_components/consumer-reward-presentation-clock.ts','src/app/me/_components/consumer-reward-next-actions.ts',
  'src/app/me/rewards/rewards-client.tsx','src/app/me/rewards/rewards.module.css','src/app/me/rewards/page.tsx',
  'src/app/me/_components/portal-shell.module.css','src/app/me/brands/brands-model.ts','src/app/login/consumer-login-continuation.ts',
  'tests/consumer-reward-wallet-isolation.browser.mjs','../../package.json','../../package-lock.json','package.json',
];
const sourceHashes=async()=>Object.fromEntries(await Promise.all(sourcePaths.map(async file=>[file,hash(await readFile(join(web,file)))])));
const sourceBefore=await sourceHashes();
const observedHead=execFileSync('git',['--no-optional-locks','-C',root,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true,timeout:10000}).trim();
if(process.env.QA_SOURCE){
  assert.equal(process.env.QA_SOURCE,observedHead,'QA_SOURCE must name this committed source');
  assert.equal(execFileSync('git',['--no-optional-locks','-C',root,'status','--porcelain'],{encoding:'utf8',windowsHide:true,timeout:10000}).trim(),'','Committed-source QA requires a clean candidate');
}
const REWARD='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',CLAIM='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TITLE='Reserva sintética A',BRAND='Marca sintética A',PROGRAM='Programa sintético A';
const row={id:REWARD,title:TITLE,tenant_slug:'bodega-a',tenant_name:BRAND,program_name:PROGRAM,program_points_balance:100,
  points_cost:40,state:'reported',catalog_state:'reported',claim_id:null,claim_status:null,claim_expires_at:null,redemption_code:null,
  points_spent:null,can_claim:true,claimIntent:'portal-first-reservation.v1'};
const initialReady={status:'ready',data:[{slug:'known-brand',name:'Marca con saldo QA',balance:540,lifetime:null},
  {slug:'unknown-brand',name:'Marca sin saldo QA',balance:null,lifetime:null}]};
const walletPayload=(name='Saldo actualizado QA')=>({ok:true,tenantWallets:[{slug:'updated-brand',name,points_balance:780},
  {slug:'unknown-brand',name:'Marca sin saldo QA',points_balance:null}],networkWallet:{enabled:true,points_balance:999999}});
const entry=`import'tailwindcss/preflight.css';import React,{useMemo,useState}from'react';import{flushSync}from'react-dom';import{createRoot}from'react-dom/client';
import{ConsumerRewardsClient}from'./src/app/me/rewards/rewards-client';import{ConsumerRewardBrandPoints}from'./src/app/me/_components/consumer-reward-brand-points-client';import{buildConsumerRewardsModel}from'./src/app/me/_components/consumer-rewards-model';import portalStyles from'./src/app/me/_components/portal-shell.module.css';import rewardsStyles from'./src/app/me/rewards/rewards.module.css';
const rows=${JSON.stringify([row])},ready=${JSON.stringify(initialReady)},unavailable={status:'unavailable',data:null};
window.__walletFetches=[];window.__walletRouterRefreshes=0;window.__walletRouterNavigations=[];
const nativeFetch=window.fetch.bind(window);window.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input.url,location.href);let observed;if(url.origin===location.origin&&url.pathname.startsWith('/api/consumer/')){observed={path:url.pathname,query:url.search,method:init?.method||'GET',credentials:init?.credentials,cache:init?.cache,hasBody:init?.body!==undefined,signalPresent:Boolean(init?.signal),headersReceived:false};window.__walletFetches.push(observed);}return nativeFetch(input,init).then(response=>{if(observed)observed.headersReceived=true;return response;});};
function Fixture(){const[epoch,setEpoch]=useState('fixture-epoch-A'),[visible,setVisible]=useState(true);const params=new URLSearchParams(location.search),points=params.get('unavailable')==='1'?unavailable:ready;
const model=useMemo(()=>buildConsumerRewardsModel({ok:true,items:rows,scope:'own_brands',limit:100},'2026-10-28T10:00:00.000Z'),[]);
window.__walletReplaceEpoch=()=>flushSync(()=>setEpoch('fixture-epoch-B'));window.__walletUnmount=()=>flushSync(()=>setVisible(false));
window.__walletFixtureFacts=()=>({epoch,tenant:'',initialUnavailableSameObject:points===unavailable,syntheticEpoch:true});
if(model.status!=='ready')throw Error('Synthetic model rejected');return <div className={'consumer-portal-root '+portalStyles.portal}><main className={portalStyles.main}><div className={portalStyles.pageHeading}><h1>Beneficios y puntos · QA local</h1><p>Componentes reales, cuentas y transportes sintéticos.</p></div><div className={rewardsStyles.rewards}>{visible?<ConsumerRewardBrandPoints key={epoch} sourceEpoch={epoch} initialPoints={points} tenant=''/>:null}<ConsumerRewardsClient items={model.items} checkedAt='2026-10-28T10:00:00.000Z' initialTenant='' selectedVoucher={null}/></div></main></div>};createRoot(document.getElementById('root')).render(<Fixture/>);`;

await mkdir(output,{recursive:true});
await writeFile(join(output,'run-owner.json'),JSON.stringify({observedHead,createdAt:new Date().toISOString(),suite:'wallet-isolation'})+'\n',{flag:'wx'});
const report={schema:'nexid.consumer-reward-wallet-isolation.v1',passed:false,releaseAcceptanceEligible:false,localOnly:true,
  actualComponents:['ConsumerRewardBrandPoints','ConsumerRewardsClient'],actualModels:true,nativeComponentAndPortalCss:true,
  actualTailwindPreflight:true,syntheticProps:true,syntheticEpoch:true,syntheticTransport:true,nativeBrowserFetch:true,
  instrumentedNextNavigationStub:true,actualNext:false,actualNextServer:false,actualHydration:false,realAuthentication:false,realDatabase:false,
  realTenantSynchronization:false,providerMutations:0,physicalTapMeasured:false,physicalSuspendMeasured:false,
  qaSource:process.env.QA_SOURCE||null,observedHead,sourceBefore,sourceAfter:null,checks:[],cases:[],serverRequests:[],
  blockedRequests:[],errors:[],bodyReleaseAttempts:[],closure:{contexts:false,browser:false,server:false,esbuild:false}};
let script,css,browser,origin;const contexts=new Set(),bodyPlans=[];
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://fixture.invalid');report.serverRequests.push({method:req.method,path:url.pathname,query:url.search});
  if(req.method!=='GET'){res.writeHead(405);return res.end();}
  if(url.pathname==='/fixture.js'){res.setHeader('content-type','text/javascript');return res.end(script);}
  if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
  if(url.pathname==='/api/consumer/wallet' && !url.search){
    const plan=bodyPlans.shift();if(!plan){res.writeHead(500);return res.end('{}');}
    plan.headersStarted=true;res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.flushHeaders();
    res.write('{"ok":true,"tenantWallets":');
    res.on('close',()=>{plan.socketClosed=true;});
    plan.release=()=>{if(plan.bodyReleaseAttempted)return;plan.bodyReleaseAttempted=true;report.bodyReleaseAttempts.push({scenario:plan.scenario,alreadyDestroyed:res.destroyed});
      if(!res.destroyed && !res.writableEnded){const payload=plan.payload??walletPayload('Respuesta antigua A QA');res.end(JSON.stringify(payload.tenantWallets)+',"networkWallet":'+JSON.stringify(payload.networkWallet)+'}');}};
    return;
  }
  if(url.pathname!=='/'){res.writeHead(404);return res.end();}
  const theme=url.searchParams.get('theme')==='dark'?'dark':'light';res.setHeader('content-type','text/html;charset=utf-8');
  res.end('<!doctype html><html lang="es-AR" class="theme-'+theme+'" data-theme="'+theme+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Puntos · QA local</title><style>'+css+'</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
});
function check(value,description){report.checks.push({description,passed:Boolean(value)});assert.ok(value,description);}
const settle=page=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
async function waitFor(description,predicate){const limit=Date.now()+10000;while(!predicate()){assert.ok(Date.now()<limit,description);await new Promise(done=>setTimeout(done,15));}}

async function open(width,theme,scenario,{postStatus=200,walletMode='gated',unavailable=false}={}){
  const context=await browser.newContext({viewport:{width,height:1000},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'});contexts.add(context);
  const page=await context.newPage();page.setDefaultTimeout(10000);const posts=[],lookups=[],wallets=[],tasks=new Set();let closing=false;
  const entry={width,theme,scenario,posts,lookups,wallets,passed:false};report.cases.push(entry);
  page.on('pageerror',error=>report.errors.push({width,theme,scenario,message:error.message}));
  const handle=async route=>{
    const request=route.request(),url=new URL(request.url());if(closing)return route.abort();
    if(url.origin===origin && request.method()==='POST' && url.pathname==='/api/consumer/rewards/'+REWARD+'/claim' && !url.search){
      let release;const gate=new Promise(done=>{release=done;});posts.push({path:url.pathname,body:request.postDataJSON(),status:postStatus,release,intercepted:true});
      await gate;if(closing)return route.abort();return route.fulfill({status:postStatus,contentType:'application/json',body:JSON.stringify(postStatus===200?{ok:true,duplicate:false,claim:{id:CLAIM,reward_id:REWARD,redemption_code:'ACK-NOT-A-RECEIPT'}}:{ok:false,error:'synthetic_conflict'})});
    }
    if(url.origin===origin && request.method()==='GET' && url.pathname==='/api/consumer/rewards' && !url.search){
      let release;const gate=new Promise(done=>{release=done;});lookups.push({path:url.pathname,release,intercepted:true});await gate;
      if(closing)return route.abort();return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:[row],scope:'own_brands',limit:100,checkedAt:'2026-10-28T10:00:30.000Z'})});
    }
    if(url.origin===origin && request.method()==='GET' && url.pathname==='/api/consumer/wallet' && !url.search){
      const wallet={path:url.pathname,status:200,payload:walletPayload(walletMode==='held-body'?'Respuesta antigua A QA':'Saldo actualizado QA'),mode:walletMode,scenario,intercepted:walletMode!=='held-body',release:()=>{},headersStarted:false};wallets.push(wallet);
      if(walletMode==='held-body'){bodyPlans.push(wallet);return route.continue();}
      let release;const gate=new Promise(done=>{release=done;});wallet.release=release;await gate;if(closing)return route.abort();
      if(wallet.ownerCancellationExpected && request.failure()?.errorText){wallet.ownerAbortObserved=true;return;}
      if(wallet.networkFailure)return route.abort('failed');
      return route.fulfill({status:wallet.status,contentType:'application/json',body:wallet.rawBody??JSON.stringify(wallet.payload)});
    }
    if(url.origin===origin && request.method()==='GET' && ['/','/fixture.js','/favicon.ico'].includes(url.pathname))return route.continue();
    report.blockedRequests.push({width,theme,scenario,method:request.method(),origin:url.origin,path:url.pathname});return route.abort();
  };
  await page.route('**/*',route=>{const task=handle(route);tasks.add(task);task.finally(()=>tasks.delete(task)).catch(error=>{if(!closing)report.errors.push({width,theme,scenario,message:String(error)});});return task;});
  await page.goto(origin+'/?theme='+theme+(unavailable?'&unavailable=1':''),{waitUntil:'networkidle'});
  const panel=page.getByRole('region',{name:'Puntos por marca',exact:true}),retry=panel.getByRole('button');
  const card=page.locator('article').filter({has:page.getByRole('heading',{name:TITLE,exact:true})});
  check(wallets.length===0 && posts.length===0 && lookups.length===0,scenario+': mount performs no client read or mutation');
  async function startReservation(){
    await card.getByRole('button',{name:'Reservar beneficio',exact:true}).click();const heading=card.getByRole('heading',{name:'Revisá tu reserva',exact:true});await heading.waitFor();
    check(await heading.evaluate(node=>node===document.activeElement),scenario+': neutral reservation heading gets focus');
    await page.keyboard.press('Tab');const confirm=card.getByRole('button',{name:'Confirmar reserva por 40 puntos',exact:true});
    check(await confirm.evaluate(node=>node===document.activeElement),scenario+': deliberate keyboard action reaches exact quote');
    await page.keyboard.press('Enter');await waitFor('one original POST',()=>posts.length===1);
    check(JSON.stringify(posts[0].body)===JSON.stringify({claimIntent:'portal-first-reservation.v1',expectedPointsCost:40,locale:'es-AR'}),scenario+': original mutation uses the quoted programme and cost only');
  }
  const facts=()=>card.evaluate(node=>({title:node.querySelector('h3')?.textContent,state:node.getAttribute('data-reward-state'),
    programmeBalance:node.querySelector('[data-benefit-points="program"] strong')?.textContent?.replace(/\s+/g,' ').trim(),
    publishedCost:[...node.querySelectorAll('span')].find(span=>span.textContent==='Costo publicado')?.parentElement?.querySelector('strong')?.textContent?.replace(/\s+/g,' ').trim()}));
  async function finish(){closing=true;for(const request of [...posts,...lookups,...wallets])request.release();await Promise.allSettled([...tasks]);await context.close();contexts.delete(context);}
  return {page,context,entry,posts,lookups,wallets,panel,retry,card,startReservation,facts,finish};
}
async function readWallet(f){await f.retry.click();await waitFor('one deliberate wallet GET',()=>f.wallets.length===1);return f.wallets[0];}
async function invariant(f,before,expectedPosts,expectedLookups){
  check(f.posts.length===expectedPosts && f.lookups.length===expectedLookups,f.entry.scenario+': updating points adds no reward GET or mutation');
  check(JSON.stringify(await f.facts())===JSON.stringify(before),f.entry.scenario+': reward identity, quote and programme balance stay unchanged');
  const transport=await f.page.evaluate(()=>({fetches:window.__walletFetches,refreshes:window.__walletRouterRefreshes,navigations:window.__walletRouterNavigations}));
  check(transport.refreshes===0 && transport.navigations.length===0,f.entry.scenario+': the instrumented route router is not refreshed or navigated');
  const reads=transport.fetches.filter(request=>request.path==='/api/consumer/wallet');
  check(reads.length===f.wallets.length && reads.every(request=>request.method==='GET' && request.query==='' && request.credentials==='same-origin' && request.cache==='no-store' && !request.hasBody && request.signalPresent),f.entry.scenario+': wallet uses only bounded explicit private GETs without query or body');
  f.entry.transport=transport;
}
async function accessibility(f){
  await f.page.addScriptTag({content:axe});const violations=await f.page.evaluate(async()=>(await axe.run('main',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(value=>({id:value.id,impact:value.impact,targets:value.nodes.map(node=>node.target)})));
  check(violations.length===0,f.entry.scenario+': zero axe violations in this rendered component fixture');
  check(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),f.entry.scenario+': no horizontal overflow');
  const colors=await f.page.locator('.consumer-portal-root').evaluate(node=>({surface:getComputedStyle(node).getPropertyValue('--portal-surface').trim()}));
  check(colors.surface===(f.entry.theme==='dark'?'#102737':'#ffffff'),f.entry.scenario+': real portal theme tokens are applied');f.entry.violations=violations;
}

try{
  const bundle=await build({stdin:{contents:entry,loader:'tsx',resolveDir:web},bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',
    define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},logLevel:'silent',plugins:[{name:'wallet-router-observation',setup(builder){
      builder.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'wallet-router-observation'}));
      builder.onLoad({filter:/.*/,namespace:'wallet-router-observation'},()=>({contents:"export const useRouter=()=>({refresh(){window.__walletRouterRefreshes++},push(value){window.__walletRouterNavigations.push(String(value))},replace(value){window.__walletRouterNavigations.push(String(value))}});",loader:'js'}));
    }}]});
  script=bundle.outputFiles.find(file=>file.path.endsWith('.js')).contents;
  css=(bundle.outputFiles.find(file=>file.path.endsWith('.css'))?.text||'')+'\nbody{margin:0;font-family:system-ui,sans-serif}';
  await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
  for(const width of [390,1280])for(const theme of ['light','dark']){
    for(const phase of ['pending','checking','uncertain']){
      const f=await open(width,theme,'wallet-isolated-during-'+phase,{postStatus:phase==='uncertain'?409:200});
      try{
        await f.startReservation();let status='Estamos preparando tu reserva. Esperá la confirmación.';
        if(phase!=='pending'){f.posts[0].release();status=phase==='checking'?'Recibimos la solicitud. Estamos comprobando tu voucher.':'No pudimos confirmar el resultado. Comprobá tu reserva antes de hacer otra solicitud.';}
        if(phase==='checking')await waitFor('one original reconciliation GET',()=>f.lookups.length===1);
        await f.page.getByText(status,{exact:true}).waitFor();const before=await f.facts(),lookupCount=f.lookups.length;
        const request=await readWallet(f);request.release();await f.panel.getByText('Saldo actualizado QA',{exact:true}).waitFor();
        check(await f.page.getByText(status,{exact:true}).count()===1,phase+': pending/checking/uncertain feedback survives the points update');
        if(phase==='uncertain')check(await f.page.getByRole('button',{name:'Comprobar mi reserva',exact:true}).isEnabled(),'uncertain: explicit GET reconciliation remains available');
        check(await f.card.getByRole('button',{name:'Reservar beneficio',exact:true}).isDisabled(),phase+': original attempted reward stays locked against rePOST');
        check(await f.panel.getByText('No informado',{exact:true}).count()===1,phase+': unknown brand balance stays unknown');
        await invariant(f,before,1,lookupCount);f.entry.passed=true;
      }finally{await f.finish();}
    }
    for(const failure of ['401','403','503','invalid-json','network']){
      const f=await open(width,theme,'wallet-error-'+failure);try{
        const before=await f.facts(),request=await readWallet(f);
        if(/^\d+$/.test(failure))request.status=Number(failure);else if(failure==='invalid-json')request.rawBody='private diagnostic, not JSON';else request.networkFailure=true;
        request.release();await f.panel.getByRole('button',{name:'Actualizar puntos',exact:true}).waitFor();
        check(await f.panel.getByText('540',{exact:false}).count()===1 && await f.panel.getByText('No informado',{exact:true}).count()===1,failure+': prior positive and unknown balances remain distinct');
        check(!(await f.panel.innerText()).includes('private diagnostic'),failure+': private diagnostics are not rendered');
        if(failure==='401'){
          const href=await f.panel.getByRole('link',{name:'Volver a ingresar',exact:true}).getAttribute('href'),login=new URL(href,origin),next=new URL(login.searchParams.get('next'),origin);
          check(login.pathname==='/login' && login.searchParams.get('consumer')==='1' && next.pathname==='/me/rewards' && !next.search && !next.hash && !href.includes('fixture-epoch'),failure+': reentry retains only the safe rewards destination');
        }
        await invariant(f,before,0,0);await accessibility(f);f.entry.passed=true;
      }finally{await f.finish();}
    }
    for(const transition of ['epoch','unmount']){
      const f=await open(width,theme,'wallet-late-body-'+transition,{walletMode:'held-body',unavailable:true});try{
        const before=await f.facts(),request=await readWallet(f);await waitFor('body JSON is held after server headers',()=>request.headersStarted);
        await f.page.waitForFunction(()=>window.__walletFetches.some(request=>request.path==='/api/consumer/wallet' && request.headersReceived));
        check((await f.page.evaluate(()=>window.__walletFixtureFacts())).initialUnavailableSameObject,'old source is the shared unavailable object with empty tenant');
        await f.page.evaluate(kind=>kind==='epoch'?window.__walletReplaceEpoch():window.__walletUnmount(),transition);await settle(f.page);
        await waitFor('the ended owner cancels the native incomplete JSON body',()=>request.socketClosed===true);
        request.release();await settle(f.page);
        check(request.bodyReleaseAttempted===true,'a late body release was attempted after the panel lifetime ended');
        check(await f.page.getByText('Respuesta antigua A QA',{exact:true}).count()===0,'old body never populates the new or unmounted panel');
        if(transition==='epoch'){
          const facts=await f.page.evaluate(()=>window.__walletFixtureFacts());check(facts.epoch==='fixture-epoch-B' && facts.tenant==='' && facts.initialUnavailableSameObject,'new epoch retains the exact same unavailable source and empty tenant');
          await f.retry.click();await waitFor('new epoch GET',()=>f.wallets.length===2 && f.wallets[1].headersStarted);f.wallets[1].payload=walletPayload('Respuesta nueva B QA');f.wallets[1].release();
          await f.panel.getByText('Respuesta nueva B QA',{exact:true}).waitFor();check(await f.panel.getByText('Respuesta antigua A QA',{exact:true}).count()===0,'B keeps only its own explicit read');
        }else check(await f.panel.count()===0,'wallet panel stays unmounted');
        f.entry.lateBodyQualification='Native fetch body was held; owner abort may close the socket before JSON delivery. This does not prove a parsed late response or authenticated account transition.';
        await invariant(f,before,0,0);f.entry.passed=true;
      }finally{await f.finish();}
    }
    {
      const f=await open(width,theme,'wallet-stalled-headers-deadline',{unavailable:true});try{
        const before=await f.facts(),request=await readWallet(f);request.ownerCancellationExpected=true;await f.panel.getByText('No pudimos actualizar tus puntos. Conservamos la información anterior; podés volver a intentarlo.',{exact:true}).waitFor();
        check(f.wallets.length===1 && await f.panel.getByRole('button',{name:'Reintentar puntos',exact:true}).isEnabled(),'deadline restores the explicit retry without an automatic second read');
        check(await f.panel.locator('[data-benefit-points="brand"]').count()===0,'unknown prior data never becomes an empty confirmed balance');
        f.wallets[0].release();await settle(f.page);check(await f.panel.getByText('Saldo actualizado QA',{exact:true}).count()===0,'late headers after deadline do not change the unavailable view');
        await invariant(f,before,0,0);f.entry.passed=true;
      }finally{await f.finish();}
    }
    {
      const f=await open(width,theme,'wallet-keyboard-single-flight',{unavailable:true});try{
        const before=await f.facts();await f.retry.focus();check(await f.retry.evaluate(node=>node===document.activeElement),'points action is keyboard reachable');
        const geometry=await f.retry.boundingBox();check(geometry.height>=44,'points action has at least a 44px target');
        await f.page.keyboard.press('Enter');await waitFor('one keyboard-triggered wallet read',()=>f.wallets.length===1);
        await f.retry.evaluate(node=>{node.click();node.click();});check(f.wallets.length===1,'same-turn duplicate activation does not create another read');
        f.wallets[0].release();await f.panel.getByText('Saldo actualizado QA',{exact:true}).waitFor();
        check(await f.retry.isEnabled() && await f.retry.evaluate(node=>node===document.activeElement),'the completed action preserves keyboard focus');
        await invariant(f,before,0,0);await accessibility(f);
        const screenshot='wallet-keyboard-'+width+'-'+theme+'.png';await f.page.screenshot({path:join(output,screenshot),fullPage:true});f.entry.screenshot=screenshot;f.entry.passed=true;
      }finally{await f.finish();}
    }
  }
  report.sourceAfter=await sourceHashes();assert.deepEqual(report.sourceAfter,sourceBefore);
  check(report.errors.length===0 && report.blockedRequests.length===0,'No application errors or unexpected/external requests');
  check(report.serverRequests.every(request=>request.method==='GET' && ['/','/fixture.js','/favicon.ico','/api/consumer/wallet'].includes(request.path)),'Only loopback static GETs and specifically owned held-body wallet GETs reached the fixture server');
  check(report.cases.length===48 && report.cases.every(value=>value.passed),'All twelve scenarios cover both widths and light/dark');
  report.passed=true;
}catch(error){report.failure=String(error.stack||error);process.exitCode=1;}
finally{
  for(const context of contexts)await context.close();contexts.clear();report.closure.contexts=true;
  if(browser){await browser.close();report.closure.browser=true;}
  server.closeAllConnections();if(server.listening)await new Promise(done=>server.close(done));report.closure.server=!server.listening;stop();report.closure.esbuild=true;
  report.completedAt=new Date().toISOString();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({report:join(output,'report.json'),passed:report.passed,releaseAcceptanceEligible:false,actualNextServer:false,checks:report.checks.length,cases:report.cases.length,failure:report.failure,closure:report.closure}));
}
