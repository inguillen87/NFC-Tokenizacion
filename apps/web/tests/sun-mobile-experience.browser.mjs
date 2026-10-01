import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const web=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(web,'../..');
const output=resolve(process.env.QA_OUTPUT||'artifacts/sun-mobile-experience');await mkdir(output,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe=process.env.AXE_MODULE_PATH?await readFile(process.env.AXE_MODULE_PATH,'utf8'):null;
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(k)));
Object.assign(env,{NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'});
const next=spawn(process.execPath,['--import',pathToFileURL(join(web,'tests/sun-mobile-local-fetch.mjs')).href,join(repo,'node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:web,env,windowsHide:true});
let log='';next.stdout.on('data',d=>log+=d);next.stderr.on('data',d=>log+=d);
const origin=`http://127.0.0.1:${port}`;
for(let i=0;i<120;i++){try{if((await fetch(origin+'/release.json')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));if(i===119){next.kill();throw Error('production_test_server_failed');}}
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
const report={realProductionBuild:true,syntheticContract:true,physicalTapMeasured:false,checks:[],views:[],errors:[],blockedWrites:0};
const check=(passed,name)=>report.checks.push({name,passed:Boolean(passed)});
try {
 for(const theme of ['light','dark']) for(const width of [320,390,768,1440]) for(const state of ['closed','opened','replay','missing','photo-failure','rejected','missing-date','history-only']) {
  const context=await browser.newContext({viewport:{width,height:844},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addCookies([{name:'theme',value:theme,url:origin},{name:'nexid_theme_version',value:'white-first-v2',url:origin}]);
  await context.addInitScript(()=>{window.__geoCalls=0;Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){window.__geoCalls++;}}});});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.route('**/*',r=>{
    const u=new URL(r.request().url());
    if(r.request().method()!=='GET'){report.blockedWrites++;return r.abort();}
    if(u.origin!==origin)return r.abort();
    if(u.pathname==='/qa-product.svg')return state==='photo-failure'?r.abort():r.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="92" height="128"><rect width="92" height="128" fill="#147d83"/></svg>'});
    if(u.pathname.startsWith('/api/'))return r.fulfill({status:404,contentType:'application/json',body:'{"ok":false}'});
    return r.continue();
  });
  await page.goto(origin+`/sun?snapshot=${state==='rejected'?'0':'qa-'+state}&trace=synthetic&access=invalid`,{waitUntil:'networkidle'});
  const summary=page.getByTestId('sun-summary-product');await summary.waitFor();
  check(await page.locator('html').getAttribute('data-theme')===theme,`Requested theme ${state} ${width} ${theme}`);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`No overflow ${state} ${width} ${theme}`);
  check(await page.evaluate(()=>window.__geoCalls)===0,`No automatic location ${state} ${width} ${theme}`);
  check(await summary.getByRole('heading',{level:1}).count()===1,`Product hierarchy ${state} ${width} ${theme}`);
  const readingTime=page.locator('.sun-result-journey li').nth(2).locator('strong');
  await page.getByTestId('sun-summary-location').locator('details > summary').click();
  const summaryTime=page.getByTestId('sun-summary-location').locator('p').filter({hasText:'Hora del tap:'}).locator('span').last();
  if(['rejected','missing-date','history-only'].includes(state)) {
    check(await readingTime.innerText()==='Hora no registrada',`Unknown read time ${state} ${width} ${theme}`);
    check(await readingTime.getAttribute('data-sun-datetime')===null,`No inherited read timestamp ${state} ${width} ${theme}`);
    check(await summaryTime.innerText()==='Hora no registrada',`Unknown summary tap time ${state} ${width} ${theme}`);
    check(await summaryTime.getAttribute('data-sun-datetime')===null,`No inherited summary timestamp ${state} ${width} ${theme}`);
  } else {
    check(await readingTime.getAttribute('data-sun-datetime')==='2026-09-30T14:25:00.000Z',`Reported read timestamp preserved ${state} ${width} ${theme}`);
    check(await summaryTime.getAttribute('data-sun-datetime')==='2026-09-30T14:25:00.000Z',`Reported summary timestamp preserved ${state} ${width} ${theme}`);
    check((await readingTime.innerText()).includes('14:25'),`Reported read time rendered ${state} ${width} ${theme}`);
  }
  check(!/Registrada ahora|La validación NFC quedó registrada/.test(await page.locator('body').innerText()),`No invented registration ${state} ${width} ${theme}`);
  if(state==='missing'||state==='rejected')check(await summary.locator('img').count()===0,`No stock photo ${state} ${width} ${theme}`);
  else if(state==='photo-failure')check(await summary.getByTestId('sun-image-unavailable').isVisible(),`Image failure remains readable ${width} ${theme}`);
  else {check(await summary.locator('img').getAttribute('fetchpriority')==='high',`First image priority ${width} ${theme}`);check(await page.locator('#product-info img').getAttribute('loading')==='lazy',`Secondary photo lazy ${width} ${theme}`);}
  if(state==='replay'){
    const cta=page.locator('a[href="#fresh-tap-required"]').first();check(await cta.count()===1,`New tap action ${state} ${width} ${theme}`);
    await cta.click();check(await page.locator('#fresh-tap-required').isVisible(),`New tap instructions reachable ${state} ${width} ${theme}`);
    check((await page.locator('#fresh-tap-required').innerText()).includes('No recargues este enlace'),`No replay instruction ${state} ${width} ${theme}`);
  }
  if(state==='rejected'){
    check(await page.getByTestId('sun-summary-status').getAttribute('data-availability')==='inaccessible',`Inaccessible is separate from NFC risk ${width} ${theme}`);
    check(await page.getByTestId('sun-summary-status').getAttribute('data-status-tone')==='info',`Inaccessible is visually neutral ${width} ${theme}`);
    const action=page.getByTestId('sun-summary-actions').getByRole('link',{name:'Qué puedo hacer',exact:true});
    await action.click();check(await page.getByTestId('sun-availability-help').isVisible(),`Inaccessible help reachable ${width} ${theme}`);
    check(await page.locator('#fresh-tap-required').count()===0,`Inaccessible does not prescribe an unnecessary physical tap ${width} ${theme}`);
  }
  if(axe&&width===390){await page.addScriptTag({content:axe});const violations=await page.evaluate(async()=>(await axe.run('#sun-summary',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));check(!violations.length,`Summary accessibility ${state} ${theme}`);report.views.push({width,theme,state,violations});}
  if(width===390&&(state==='closed'||state==='photo-failure'||state==='rejected'))await page.screenshot({path:join(output,`${state}-${theme}.png`),fullPage:false});
  await context.close();
 }
 for(const [locale,unknownTime,neutralLocation] of [
  ['en','Time not recorded','No coordinates were reported for this read. Cities from history or the network are not attributed to this tap.'],
  ['pt-BR','Horário não registrado','Não há coordenadas informadas para esta leitura. As cidades do histórico ou da rede não são atribuídas a este toque.'],
 ]) for(const state of ['rejected','missing-date','history-only','closed']) {
  const context=await browser.newContext({viewport:{width:390,height:844},locale,reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(r.request().method()!=='GET'){report.blockedWrites++;return r.abort();}if(u.origin!==origin)return r.abort();if(u.pathname==='/qa-product.svg')return r.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="92" height="128"><rect width="92" height="128" fill="#147d83"/></svg>'});if(u.pathname.startsWith('/api/'))return r.fulfill({status:404,contentType:'application/json',body:'{"ok":false}'});return r.continue();});
  await page.goto(origin+`/sun?snapshot=${state==='rejected'?'0':'qa-'+state}&trace=synthetic&access=invalid&lang=${locale}`,{waitUntil:'networkidle'});
  const readingTime=page.locator('.sun-result-journey li').nth(2).locator('strong');
  await page.getByTestId('sun-summary-location').locator('details > summary').click();
  check((await page.locator('body').innerText()).includes(neutralLocation),`Neutral no-coordinate copy localized ${state} ${locale}`);
  if(state==='closed') {
    check(await readingTime.getAttribute('data-sun-datetime')==='2026-09-30T14:25:00.000Z',`Reported read timestamp survives locale ${locale}`);
    check((await readingTime.innerText()).includes('14:25'),`Reported read time rendered in ${locale}`);
  } else {
    check(await readingTime.innerText()===unknownTime,`Unknown read time localized ${state} ${locale}`);
    check(await readingTime.getAttribute('data-sun-datetime')===null,`No fabricated datetime ${state} ${locale}`);
    check(await page.getByTestId('sun-summary-location').getByText(unknownTime,{exact:true}).count()===1,`Unknown summary tap time localized ${state} ${locale}`);
  }
  check(!/Registrada ahora|Recorded now|Registrada agora|La validación NFC quedó registrada/.test(await page.locator('body').innerText()),`No invented registration ${state} ${locale}`);
  await context.close();
 }
 // Availability is tested against the built server and real UI in all three
 // languages. The fixture counts server fetches and the browser blocks writes.
 const unavailableCases=[
  ['empty','', 'empty',0],
  ['demo','demo=1','ready',0],
  ['partial-trace','trace=synthetic&demo=1','incomplete',0],
  ['partial-access','access=invalid&demo=1','incomplete',0],
  ['partial-fresh','fresh=synthetic&demo=1','incomplete',0],
  ['partial-blank','snapshot=&demo=1','incomplete',0],
  ['partial-dynamic','bid=synthetic&demo=1','incomplete',0],
  ['denied','snapshot=qa-denied&trace=synthetic&access=invalid','inaccessible',1],
  ['not-found','snapshot=0&trace=synthetic&access=invalid','inaccessible',1],
  ['unavailable','snapshot=qa-unavailable&trace=synthetic&access=invalid','unavailable',1],
  ['malformed','snapshot=qa-malformed&trace=synthetic&access=invalid','unavailable',1],
  ['transport','snapshot=qa-transport&trace=synthetic&access=invalid','unavailable',1],
  ['failed-snapshot-dynamic','snapshot=qa-denied&trace=synthetic&access=invalid&bid=synthetic&picc_data=synthetic&enc=synthetic&cmac=synthetic','inaccessible',1],
 ];
 const headlines={
  'es-AR':{empty:'Todavía no hay una lectura para consultar',incomplete:'Faltan datos para abrir esta consulta',inaccessible:'No podemos abrir esta consulta',unavailable:'La consulta no está disponible ahora'},
  en:{empty:'There is no reading to view yet',incomplete:'This link is missing information',inaccessible:'We cannot open this view',unavailable:'This view is currently unavailable'},
  'pt-BR':{empty:'Ainda não há uma leitura para consultar',incomplete:'Faltam dados para abrir esta consulta',inaccessible:'Não podemos abrir esta consulta',unavailable:'A consulta não está disponível agora'},
 };
 for(const locale of ['es-AR','en','pt-BR'])for(const [name,query,availability,expectedReads] of unavailableCases){
  const context=await browser.newContext({viewport:{width:390,height:844},locale,reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addInitScript(()=>{window.__geoCalls=0;Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){window.__geoCalls++;}}});});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  let writes=0;
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(r.request().method()!=='GET'){writes++;report.blockedWrites++;return r.abort();}if(u.origin!==origin)return r.abort();if(u.pathname.startsWith('/api/'))return r.fulfill({status:404,contentType:'application/json',body:'{"ok":false}'});return r.continue();});
  const readsBefore=(log.match(/SUN_QA_READ /g)||[]).length;
  await page.goto(origin+'/sun?'+query+(query?'&':'')+'lang='+locale,{waitUntil:'networkidle'});
  const status=page.getByTestId('sun-summary-status');await status.waitFor();
  check(await status.getAttribute('data-availability')===availability,`Availability ${name} ${locale}`);
  check((log.match(/SUN_QA_READ /g)||[]).length-readsBefore===expectedReads,`Single source read or no consumption ${name} ${locale}`);
  check(writes===0,`No write ${name} ${locale}`);
  check(await page.evaluate(()=>window.__geoCalls)===0,`No location request ${name} ${locale}`);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`No availability overflow ${name} ${locale}`);
  if(name==='demo'){
    check((await page.locator('body').innerText()).includes(locale==='en'?'DEMO PREVIEW · NO PHYSICAL TAP':locale==='pt-BR'?'DEMONSTRAÇÃO · SEM TOQUE FÍSICO':'MUESTRA DEMO · SIN TAP FÍSICO'),`Demo truth label ${locale}`);
  }else{
    check(await status.locator('h2').innerText()===headlines[locale][availability],`Clear availability headline ${name} ${locale}`);
    check(await status.getAttribute('data-status-tone')==='info',`Availability is neutral ${name} ${locale}`);
    check(await page.getByTestId('sun-summary-product').locator('img').count()===0,`No invented product image ${name} ${locale}`);
    check(await page.getByTestId('passport-evidence-resources').count()===0,`No invented record or certificate ${name} ${locale}`);
    check(await page.locator('#protected-actions').count()===0,`No protected action context ${name} ${locale}`);
    check(await page.locator('[data-sun-datetime]').count()===0,`No invented date ${name} ${locale}`);
    check(!/NTAG 424|REPLAY|Replay bloqueado|Riesgo alto/.test(await page.locator('body').innerText()),`No inferred chip or replay ${name} ${locale}`);
    const action=page.getByTestId('sun-summary-actions').locator('a').first();
    check(await action.getAttribute('href')==='#sun-availability-help',`Useful primary action ${name} ${locale}`);await action.click();
    check(await page.getByTestId('sun-availability-help').isVisible(),`Availability help reachable ${name} ${locale}`);
    check(await page.locator('#fresh-tap-required').count()===0,`No risk recovery prescribed without a result ${name} ${locale}`);
    if(['inaccessible','unavailable'].includes(availability))check(!/Desbloqueá el teléfono|Unlock your phone|Desbloqueie o telefone/.test(await page.getByTestId('sun-availability-help').innerText()),`No unnecessary new tap for source failure ${name} ${locale}`);
  }
  if(axe&&locale==='es-AR'){await page.addScriptTag({content:axe});const violations=await page.evaluate(async()=>(await axe.run('#sun-summary',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));check(!violations.length,`Availability accessibility ${name}`);report.views.push({width:390,state:name,locale,violations});}
  await context.close();
 }
 for(const [state,tone,headline] of [
  ['seal-unknown','verified','Identidad NFC validada'],
  ['unsupported','verified','Identidad NFC validada'],
  ['historical-closed','closed','En esa lectura, el tag informó: sello cerrado'],
  ['invalid','risk','Revisá el producto antes de usarlo'],
 ]){
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'es-AR',serviceWorkers:'block'}),page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(r.request().method()!=='GET'){report.blockedWrites++;return r.abort();}if(u.origin!==origin)return r.abort();if(u.pathname==='/qa-product.svg')return r.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="92" height="128"/>'});if(u.pathname.startsWith('/api/'))return r.fulfill({status:404,contentType:'application/json',body:'{"ok":false}'});return r.continue();});
  await page.goto(origin+`/sun?snapshot=qa-${state}&trace=synthetic&access=invalid`,{waitUntil:'networkidle'});
  const status=page.getByTestId('sun-summary-status');
  check(await status.getAttribute('data-availability')==='ready',`Delivered result remains distinct ${state}`);
  check(await status.getAttribute('data-status-tone')===tone,`NFC result tone preserved ${state}`);
  check(await status.locator('h2').innerText()===headline,`NFC result meaning preserved ${state}`);
  if(state!=='invalid')check(await page.getByTestId('sun-summary-facts').getByText('Verificada',{exact:true}).count()===1,`Verified identity retained ${state}`);
  if(state==='seal-unknown'||state==='unsupported')check(await page.getByTestId('sun-summary-facts').getByText('No informado',{exact:true}).count()===1,`Unknown seal is not closed ${state}`);
  await context.close();
 }
 // A complete synthetic dynamic payload is observed by the browser route,
 // fulfilled locally, and never sent to the physical validation service.
 {
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
  const calls=[];let writes=0;
  await page.route('**/*',r=>{
    const u=new URL(r.request().url());
    if(r.request().method()!=='GET'){writes++;report.blockedWrites++;return r.abort();}
    if(u.hostname==='api.nexid.lat'){calls.push({method:r.request().method(),url:r.request().url()});return r.fulfill({status:200,contentType:'application/json',body:'{"ok":false,"syntheticBrowserFirst":true}'});}
    return u.origin===origin?r.continue():r.abort();
  });
  const readsBefore=(log.match(/SUN_QA_READ /g)||[]).length;
  await page.goto(origin+'/sun?v=1&bid=synthetic-only&picc_data=synthetic&enc=synthetic&cmac=synthetic&lang=es-AR',{waitUntil:'networkidle'});
  check(calls.length===1,'Complete dynamic payload reaches browser exactly once');
  const requested=calls[0]?new URL(calls[0].url):null;
  check(requested?.pathname==='/sun'&&calls[0]?.method==='GET','Dynamic validation remains browser-first GET');
  check(requested?.searchParams.get('bid')==='synthetic-only'&&['picc_data','enc','cmac'].every(key=>requested.searchParams.get(key)==='synthetic'),'Dynamic payload preserved in browser redirect');
  check((log.match(/SUN_QA_READ /g)||[]).length===readsBefore,'No server-side dynamic scan consumption');
  check(writes===0,'Browser-first verification creates no test write');
  await context.close();
 }
 check(!report.errors.length,'No browser errors');
} finally {await browser.close();next.kill();await writeFile(join(output,'server.log'),log);await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({checks:report.checks.length,failed:report.checks.filter(x=>!x.passed),views:report.views.length,errors:report.errors},null,2));
assert.ok(report.checks.every(x=>x.passed));
