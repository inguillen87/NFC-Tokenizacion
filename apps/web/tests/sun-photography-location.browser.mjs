// Actual Next build, local fixtures and public reference assets only.
// Location is never requested; all network writes and external reads are blocked.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const web=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(web,'../..');
const output=resolve(process.env.QA_OUTPUT||'artifacts/sun-photography-location');await mkdir(output,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe=process.env.AXE_MODULE_PATH?await readFile(process.env.AXE_MODULE_PATH,'utf8'):null;
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(k)));Object.assign(env,{NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'});
const next=spawn(process.execPath,['--import',pathToFileURL(join(web,'tests/sun-mobile-local-fetch.mjs')).href,join(repo,'node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:web,env,windowsHide:true});let log='';next.stdout.on('data',d=>log+=d);next.stderr.on('data',d=>log+=d);
const origin='http://127.0.0.1:'+port;
const cases=[
 ...['es-AR','en','pt-BR'].flatMap(locale=>['light','dark'].flatMap(theme=>[320,390,430].map(width=>({locale,theme,width,kind:'reference',url:'/sun?demo=1&visual=rutini'})))),
 ...['es-AR','en','pt-BR'].flatMap(locale=>['light','dark'].flatMap(theme=>[320,390].map(width=>({locale,theme,width,kind:'location',url:'/sun?snapshot=qa-location-closed&trace=synthetic&access=invalid&fresh=synthetic-only'})))),
 ...['light','dark'].map(theme=>({locale:'es-AR',theme,width:390,kind:'default',url:'/sun?demo=1'})),
 ...['wine','perfume','agro'].map(profile=>({locale:'es-AR',theme:'light',width:390,kind:'handoff',url:'/sun?demo=1&source=demo-lab&visual=rutini&profile='+profile})),
 ...['&snapshot=','&bid=','&channel=qr','&visual=unknown'].map((suffix,index)=>({locale:'es-AR',theme:'light',width:390,kind:'excluded',url:index===3?'/sun?demo=1'+suffix:'/sun?demo=1&visual=rutini'+suffix})),
];
const report={realProductionBuild:true,syntheticLocationEligibility:true,physicalTapMeasured:false,published:false,expectedViews:cases.length,checks:[],views:[],errors:[],blockedWrites:0,browserClosed:false,serverClosed:false};
const check=(passed,name,details)=>report.checks.push({name,passed:Boolean(passed),...(details?{details}:{})});let browser;
try {
 let ready=false;for(let i=0;i<120;i++){try{if((await fetch(origin+'/release.json')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert(ready);
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});report.browserVersion=browser.version();report.buildId=(await readFile(join(web,'.next/BUILD_ID'),'utf8')).trim();
 for(const entry of cases){
  const context=await browser.newContext({viewport:{width:entry.width,height:844},locale:entry.locale,reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addCookies([{name:'theme',value:entry.theme,url:origin},{name:'nexid_theme_version',value:'white-first-v2',url:origin},{name:'locale',value:entry.locale,url:origin}]);
  await context.addInitScript(()=>{window.qaGeoCalls=0;Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(){window.qaGeoCalls++;},watchPosition(){window.qaGeoCalls++;}}});});
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(route.request().method()!=='GET'){report.blockedWrites++;return route.abort();}if(u.origin!==origin)return route.abort();if(u.pathname.startsWith('/api/'))return route.fulfill({status:404,contentType:'application/json',body:'{"ok":false}'});return route.continue();});
  const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
  await page.goto(origin+entry.url+'&lang='+entry.locale,{waitUntil:'networkidle'});await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  const name=entry.kind+'-'+entry.width+'-'+entry.theme+'-'+entry.locale+'-'+report.views.length;
  const observed=await page.evaluate(()=>{
   const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
   const button=document.querySelector('[data-testid="sun-location-quick-action"] [data-testid="sun-location-consent-cta"]');
   return {scrollWidth:document.documentElement.scrollWidth,geoCalls:window.qaGeoCalls,locationButton:rect(button),locationDisabled:button?.disabled,locationHit:button?document.elementFromPoint(button.getBoundingClientRect().x+button.clientWidth/2,button.getBoundingClientRect().y+button.clientHeight/2)?.closest('button')===button:false};
  });
  check(observed.scrollWidth<=entry.width,'No horizontal overflow '+name,observed);check(observed.geoCalls===0,'No automatic phone location '+name);
  const credit=page.getByTestId('sun-demo-photo-source');
  if(entry.kind==='reference'){
   assert.equal(await page.locator('#sun-summary-product-title').innerText(),'Apartado Gran Malbec');
   const image=page.locator('[data-testid="sun-summary-product"] img');await image.evaluate(i=>i.decode());
   check(await image.getAttribute('src')==='/sun/references/rutini-apartado.webp','Official photograph reference '+name);
   check(await credit.count()===1&&await credit.getAttribute('href')==='https://rutiniwines.com/apartado/','Source remains attributed '+name);
   check(await page.getByTestId('sun-location-quick-action').count()===0,'Reference cannot request phone location '+name);
   check(!/Perfil sensorial simulado|Puntaje demo|Premio simulado/.test(await page.locator('body').textContent()),'No invented producer ratings '+name);
   await page.screenshot({path:join(output,name+'.png'),fullPage:false});
   if(entry.width===390&&entry.locale==='es-AR'){await page.locator('#product-info').scrollIntoViewIfNeeded();await page.screenshot({path:join(output,name+'-product.png'),fullPage:false});}
  }else{
   check(await credit.count()===0,'Reference isolated from other entries '+name);
   if(entry.kind==='default')check(await page.locator('[data-testid="sun-summary-product"] img').getAttribute('src')==='/images/premium_wine_mendoza_nfc.png','Previous Balmec demo media preserved '+name);
  }
  if(entry.kind==='location'){
   const b=observed.locationButton;
   check(b&&b.width>=44&&b.height>=44&&b.x>=0&&b.right<=entry.width&&b.y>=0&&b.bottom<=844&&observed.locationHit&&!observed.locationDisabled,'Phone location request visible and reachable at opening '+name,observed);
   const quick=page.getByTestId('sun-location-quick-action');check(await quick.locator('details').getAttribute('open')===null,'Privacy starts collapsed '+name);
   if(entry.width===390){await page.screenshot({path:join(output,name+'.png'),fullPage:false});}
   const decline=quick.getByRole('button',{name:entry.locale==='en'?'Not now':entry.locale==='pt-BR'?'Agora não':'Ahora no',exact:true});await decline.focus();await page.keyboard.press('Enter');
   check(await quick.getByTestId('sun-location-consent-cta').count()===0&&await page.evaluate(()=>window.qaGeoCalls)===0,'Declining preserves passport without GPS '+name);
  }
  if(axe&&entry.width===390&&['reference','location'].includes(entry.kind)){
   await page.addScriptTag({content:axe});const violations=await page.evaluate(async()=>(await axe.run('[data-testid="sun-passport-header"],#sun-summary',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));check(!violations.length,'Accessible opening '+name,violations);
  }
  report.views.push({...entry,name,observed});await context.close();
 }
}finally{
 if(browser){await browser.close();report.browserClosed=true;}next.kill();await new Promise(r=>next.once('exit',r));report.serverClosed=true;report.passed=report.views.length===cases.length&&report.checks.every(c=>c.passed)&&!report.errors.length&&report.blockedWrites===0;await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));await writeFile(join(output,'server.log'),log);
}
console.log(JSON.stringify({passed:report.passed,views:report.views.length,checks:report.checks.length,failedChecks:report.checks.filter(c=>!c.passed),errors:report.errors,blockedWrites:report.blockedWrites}));assert.equal(report.passed,true);
