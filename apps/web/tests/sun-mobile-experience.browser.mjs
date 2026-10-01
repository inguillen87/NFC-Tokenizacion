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
 for(const theme of ['light','dark']) for(const width of [320,390,768,1440]) for(const state of ['closed','opened','replay','missing','photo-failure','rejected']) {
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
  if(state==='missing'||state==='rejected')check(await summary.locator('img').count()===0,`No stock photo ${state} ${width} ${theme}`);
  else if(state==='photo-failure')check(await summary.getByTestId('sun-image-unavailable').isVisible(),`Image failure remains readable ${width} ${theme}`);
  else {check(await summary.locator('img').getAttribute('fetchpriority')==='high',`First image priority ${width} ${theme}`);check(await page.locator('#product-info img').getAttribute('loading')==='lazy',`Secondary photo lazy ${width} ${theme}`);}
  if(state==='replay'||state==='rejected'){
    const cta=page.locator('a[href="#fresh-tap-required"]').first();check(await cta.count()===1,`New tap action ${state} ${width} ${theme}`);
    await cta.click();check(await page.locator('#fresh-tap-required').isVisible(),`New tap instructions reachable ${state} ${width} ${theme}`);
    check((await page.locator('#fresh-tap-required').innerText()).includes('No recargues este enlace'),`No replay instruction ${state} ${width} ${theme}`);
  }
  if(axe&&width===390){await page.addScriptTag({content:axe});const violations=await page.evaluate(async()=>(await axe.run('#sun-summary',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));check(!violations.length,`Summary accessibility ${state} ${theme}`);report.views.push({width,theme,state,violations});}
  if(width===390&&(state==='closed'||state==='photo-failure'||state==='rejected'))await page.screenshot({path:join(output,`${state}-${theme}.png`),fullPage:false});
  await context.close();
 }
 check(!report.errors.length,'No browser errors');
} finally {await browser.close();next.kill();await writeFile(join(output,'server.log'),log);await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({checks:report.checks.length,failed:report.checks.filter(x=>!x.passed),views:report.views.length,errors:report.errors},null,2));
assert.ok(report.checks.every(x=>x.passed));
