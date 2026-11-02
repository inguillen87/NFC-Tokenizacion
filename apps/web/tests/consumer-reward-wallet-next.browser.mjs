// Imported by the existing production-Next destination suite. All identities,
// eligibility and writes are explicitly synthetic; no provider or DB access.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const REWARD='cccccccc-cccc-4ccc-8ccc-cccccccccccc',CLAIM='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const TITLE='Reserva sintética de puntos QA';
async function waitFor(description,predicate){const until=Date.now()+12000;while(!predicate()){assert(Date.now()<until,description);await new Promise(done=>setTimeout(done,10));}}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Parse only JSON arguments of the known Next inline push records. Never eval
// scripts or derive a browser authentication identity from this UI lifetime.
export function walletEpochsFromDocument(html){
 const marker='self.__next_f.push(',chunks=[];let offset=0;
 while((offset=html.indexOf(marker,offset))!==-1){
  const start=offset+marker.length;let end=start,depth=1,quoted=false,escaped=false;
  for(;end<html.length;end++){
   const char=html[end];
   if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;}
   else if(char==='"')quoted=true;else if(char==='(')depth++;else if(char===')'&&--depth===0)break;
  }
  try{const push=JSON.parse(html.slice(start,end));if(Array.isArray(push)&&push[0]===1&&typeof push[1]==='string')chunks.push(push[1]);}catch{}
  offset=end+1;
 }
 const found=[];
 const visit=value=>{
  if(Array.isArray(value)){
   if(value[0]==='$'&&value.length===4&&value[3]&&typeof value[3]==='object'&&typeof value[3].sourceEpoch==='string')found.push({key:value[2],epoch:value[3].sourceEpoch});
   for(const item of value)visit(item);
  }else if(value&&typeof value==='object')for(const item of Object.values(value))visit(item);
 };
 for(const line of chunks.join('').split('\n')){
  const row=/^[0-9a-f]+:([\[{].*)$/i.exec(line);if(!row)continue;
  try{visit(JSON.parse(row[1]));}catch{}
 }
 return found;
}

export async function runRewardWalletNextScenarios({browser,origin,fixture,report,check,assess,repo,web}){
 const paths=['src/app/me/rewards/page.tsx','src/app/me/rewards/rewards-client.tsx','src/app/me/rewards/rewards.module.css',
  'src/app/me/_components/consumer-reward-brand-points-client.tsx','src/app/me/_components/consumer-wallet-brand-read.ts',
  'src/app/me/_components/consumer-bounded-fetch.ts','tests/consumer-reward-wallet-next.browser.mjs'];
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 const source=async()=>({head:execFileSync('git',['--no-optional-locks','-C',repo,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),
  tree:execFileSync('git',['--no-optional-locks','-C',repo,'rev-parse','HEAD^{tree}'],{encoding:'utf8',windowsHide:true}).trim(),
  files:Object.fromEntries(await Promise.all(paths.map(async path=>[path,hash(await readFile(join(web,path)))])))});
 const before=await source();if(process.env.QA_SOURCE)assert.equal(before.head,process.env.QA_SOURCE);
 report.rewardWalletNext={actualNextServer:true,actualNextRsc:true,syntheticConsumerAndEligibility:true,syntheticBrowserWrites:true,
  realAuthenticationCertified:false,realDatabase:false,realTenantSynchronization:false,physicalTapMeasured:false,releaseAcceptanceEligible:false,sourceBefore:before,cases:[],unhandledRejections:[]};
 for(const width of [390,1280])for(const theme of ['light','dark'])for(const phase of ['pending','checking','uncertain']){
  const context=await browser.newContext({viewport:{width,height:900},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addCookies([{name:'consumer_loading_qa',value:'rewards-wallet-ready',url:origin,httpOnly:true,sameSite:'Lax'},
   {name:'theme',value:theme,url:origin},{name:'nexid_theme_version',value:'white-first-v2',url:origin}]);
  await context.exposeBinding('__walletNextNativeError',(_source,event)=>report.nativeWindowErrors.push({source:'wallet-next',width,theme,phase,...event}));
  await context.exposeBinding('__walletNextLocation',()=>{report.geolocationCalls++;});
  await context.exposeBinding('__walletNextUnhandled',(_source,event)=>report.rewardWalletNext.unhandledRejections.push({width,theme,phase,...event}));
  await context.addInitScript(()=>{
   window.__walletNextDeliveries=[];window.__walletNextDeliveryErrors=0;
   const deliver=promise=>{window.__walletNextDeliveries.push(Promise.resolve(promise).catch(()=>{window.__walletNextDeliveryErrors++;}));};
   window.addEventListener('error',event=>deliver(window.__walletNextNativeError({message:event.error?.message||event.message,digest:event.error?.digest||null})));
   window.addEventListener('unhandledrejection',event=>deliver(window.__walletNextUnhandled({message:typeof event.reason?.message==='string'?event.reason.message:typeof event.reason==='string'?event.reason:'Unhandled rejection without a string message'})));
   Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){deliver(window.__walletNextLocation());throw Error('Unexpected GPS');},watchPosition(){deliver(window.__walletNextLocation());throw Error('Unexpected GPS watch');}}});
  });
  const page=await context.newPage();page.setDefaultTimeout(12000);
  const entry={width,theme,phase,posts:[],rewardsReads:0,walletReads:0,rscReads:0,passed:false,syntheticOnly:true};report.rewardWalletNext.cases.push(entry);
  const gates=[],tasks=new Set();let closing=false;
  page.on('pageerror',error=>report.clientErrors.push({source:'wallet-next',width,theme,phase,message:error.message}));
  page.on('console',message=>{
   if(message.type()!=='error')return;const endpoint=origin+'/api/consumer/rewards/'+REWARD+'/claim';
   if(phase==='uncertain'&&message.location().url===endpoint&&/^Failed to load resource: the server responded with a status of 409 /.test(message.text()))return;
   report.consoleErrors.push({source:'wallet-next',message:message.text(),url:message.location().url});
  });
  const held=()=>{let release;const promise=new Promise(done=>{release=done;});gates.push(release);return {promise,release};};
  let postGate,rewardGate;
  const handle=async route=>{
   const request=route.request(),url=new URL(request.url());if(closing)return route.abort();
   if(url.origin!==origin&&!['data:','blob:'].includes(url.protocol)){report.externalRequests.push({origin:url.origin,path:url.pathname});return route.abort();}
   if(url.origin===origin&&url.pathname==='/api/consumer/rewards/'+REWARD+'/claim'&&request.method()==='POST'){
    assert.equal(url.search,'');assert.deepEqual(request.postDataJSON(),{claimIntent:'portal-first-reservation.v1',expectedPointsCost:40,locale:'es-AR'});
    entry.posts.push({path:url.pathname,expectedPointsCost:40,intercepted:true});assert.equal(entry.posts.length,1);postGate=held();await postGate.promise;
    if(closing)return route.abort();return route.fulfill({status:phase==='uncertain'?409:200,contentType:'application/json',body:JSON.stringify(phase==='uncertain'?{ok:false,error:'synthetic_conflict'}:{ok:true,duplicate:false,claim:{id:CLAIM,reward_id:REWARD,redemption_code:'SYNTHETIC-ACK-NOT-A-RECEIPT'}})});
   }
   if(url.origin===origin&&url.pathname==='/api/consumer/rewards'&&request.method()==='GET'){
    entry.rewardsReads++;rewardGate=held();await rewardGate.promise;if(closing)return route.abort();return route.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'});
   }
   if(url.origin===origin&&url.pathname==='/api/consumer/wallet'&&request.method()==='GET'){
    assert.equal(url.search,'');assert.equal(request.postData(),null);entry.walletReads++;
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,tenantWallets:[{slug:'loading-qa',name:'Saldo aislado Next QA',points_balance:780},{slug:'unknown-qa',name:'Saldo desconocido Next QA',points_balance:null}],networkWallet:{enabled:true,points_balance:999999}})});
   }
   const headers=request.headers(),prefetch=headers['next-router-prefetch']==='1'||[headers.purpose,headers['sec-purpose']].some(value=>typeof value==='string'&&value.includes('prefetch'));
   if(url.origin===origin&&url.pathname==='/me/rewards'&&headers.rsc==='1'&&!prefetch)entry.rscReads++;
   if(!['GET','HEAD'].includes(request.method())){report.blockedWrites.push({source:'wallet-next',path:url.pathname,method:request.method()});return route.abort();}
   return route.continue();
  };
  await page.route('**/*',route=>{const task=handle(route);tasks.add(task);task.finally(()=>tasks.delete(task)).catch(error=>{if(!closing)report.clientErrors.push({source:'wallet-next-route',message:String(error)});});return task;});
  const label=`${width}/${theme}/${phase} actual Next wallet`;
  try{
   const epochs=[];
   for(let render=0;render<2;render++){
    const response=await page.goto(origin+'/me/rewards',{waitUntil:'networkidle'});assert(response?.ok());
    const parsed=walletEpochsFromDocument(await response.text());check(parsed.length===1&&uuid.test(parsed[0].epoch)&&parsed[0].key===parsed[0].epoch,label+': serialized wallet epoch and React key match');epochs.push(parsed[0].epoch);
    await page.getByRole('region',{name:'Puntos por marca',exact:true}).getByRole('button',{name:'Reintentar puntos',exact:true}).waitFor();
    const initialDeliveryErrors=await page.evaluate(async()=>{await Promise.all(window.__walletNextDeliveries||[]);return window.__walletNextDeliveryErrors||0;});
    check(initialDeliveryErrors===0,label+': native observation deliveries drain before the next document');
   }
   check(epochs[0]!==epochs[1],label+': separate authenticated-fixture SSR renders create distinct wallet lifetimes');
   const panel=page.getByRole('region',{name:'Puntos por marca',exact:true});
   const card=page.locator('article').filter({has:page.getByRole('heading',{name:TITLE,exact:true})});await card.waitFor();
   check(entry.walletReads===0&&entry.posts.length===0,label+': hydration starts no wallet GET or reservation');
   await card.evaluate(node=>{window.__walletNextWriter=node;});
   await card.getByRole('button',{name:'Reservar beneficio',exact:true}).click();
   await card.getByRole('heading',{name:'Revisá tu reserva',exact:true}).waitFor();
   await card.getByRole('button',{name:'Confirmar reserva por 40 puntos',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('[data-reward-state]')?.textContent.includes('Estamos preparando tu reserva'));
   await waitFor('one intercepted original reservation',()=>entry.posts.length===1&&Boolean(postGate));
   let status='Estamos preparando tu reserva. Esperá la confirmación.';
   if(phase!=='pending'){
    assert(postGate);postGate.release();status=phase==='checking'?'Recibimos la solicitud. Estamos comprobando tu voucher.':'No pudimos confirmar el resultado. Comprobá tu reserva antes de hacer otra solicitud.';
   }
   await page.getByText(status,{exact:true}).waitFor();
   if(phase==='checking')await waitFor('the original reconciliation reader is held',()=>entry.rewardsReads===1&&Boolean(rewardGate));
   const facts=()=>card.evaluate(node=>({state:node.getAttribute('data-reward-state'),programmeBalance:node.querySelector('[data-benefit-points="program"] strong')?.textContent?.replace(/\s+/g,' ').trim(),publishedCost:[...node.querySelectorAll('span')].find(span=>span.textContent==='Costo publicado')?.parentElement?.querySelector('strong')?.textContent?.replace(/\s+/g,' ').trim()}));
   const quoteBefore=await facts(),readsBefore={fixture:fixture.requests.length,rewards:entry.rewardsReads,rsc:entry.rscReads};
   check(/^40\s*pts$/.test(quoteBefore.publishedCost||'')&&/^100\s*pts$/.test(quoteBefore.programmeBalance||''),label+': initial published cost and programme balance are actually rendered');
   const retry=panel.getByRole('button',{name:'Reintentar puntos',exact:true});await retry.focus();await retry.press('Enter');
   await panel.getByText('Saldo aislado Next QA',{exact:true}).waitFor();
   check(await card.evaluate(node=>node===window.__walletNextWriter),label+': points update keeps the exact mounted writer DOM node');
   check(JSON.stringify(await facts())===JSON.stringify(quoteBefore),label+': points update retains the published cost, programme balance and writer state');
   check(await page.getByText(status,{exact:true}).count()===1,label+': pending/checking/uncertain feedback survives the points update');
   check(entry.posts.length===1&&entry.walletReads===1&&entry.rewardsReads===readsBefore.rewards&&entry.rscReads===readsBefore.rsc,label+': one explicit wallet GET without another mutation, reward read or RSC refresh');
   // Other links may legitimately prefetch unrelated pages. Keep that bounded
   // observation separate; only this route's non-prefetch RSC count is asserted.
   entry.fixtureReadPathsAfterWallet=fixture.requests.slice(readsBefore.fixture).map(row=>row.path);
   check(await panel.getByText('No informado',{exact:true}).count()===1,label+': unknown brand balance stays unknown');
   check(await panel.getByRole('button',{name:'Actualizar puntos',exact:true}).evaluate(node=>node===document.activeElement),label+': keyboard focus survives the read');
   check(await card.getByRole('button',{name:'Reservar beneficio',exact:true}).isDisabled(),label+': original attempted reward cannot be rePOSTed');
   if(phase==='uncertain')check(await card.getByRole('button',{name:'Comprobar mi reserva',exact:true}).isEnabled(),label+': explicit reconciliation remains available');
   await assess(page,'#consumer-portal-content',`reward-wallet-next-${phase}-${width}-${theme}`,width,theme);entry.passed=true;
  }finally{
   closing=true;for(const release of gates)release();await Promise.allSettled([...tasks]);
   try{
    const deliveryErrors=await page.evaluate(async()=>{await Promise.all(window.__walletNextDeliveries||[]);return window.__walletNextDeliveryErrors||0;});
    entry.nativeDeliveriesDrained=true;check(deliveryErrors===0,label+': native error/GPS observation bindings delivered before context close');
   }finally{await context.close();}
  }
 }
 check(report.rewardWalletNext.unhandledRejections.length===0,'No unhandled promise rejections in the actual Next wallet cases');
 const after=await source();assert.deepEqual(after,before);report.rewardWalletNext.sourceAfter=after;
 check(report.rewardWalletNext.cases.length===12&&report.rewardWalletNext.cases.every(row=>row.passed),'Twelve wallet cases use real Next SSR/RSC and preserve the reservation context');
}
