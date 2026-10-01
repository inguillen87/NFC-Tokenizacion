import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {createServer} from 'node:http';import {mkdir,readFile,writeFile} from 'node:fs/promises';import {dirname,join,resolve} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {gzipSync} from 'node:zlib';
const web=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(web,'../..'),output=resolve(process.env.QA_OUTPUT||'artifacts/public-style-budget');await mkdir(output,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(k)));Object.assign(env,{NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'});
const next=spawn(process.execPath,['--import',pathToFileURL(join(web,'tests/public-style-local-fetch.mjs')).href,join(repo,'node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:web,env,windowsHide:true});let nextLog='';next.stdout.on('data',d=>nextLog+=d);next.stderr.on('data',d=>nextLog+=d);
const origin='http://127.0.0.1:'+port,path='/sun?snapshot=0&trace=synthetic&access=invalid';
for(let i=0;i<120;i++){try{const r=await fetch(origin+'/release.json');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,250));if(i===119){next.kill();await writeFile(join(output,'startup.log'),nextLog);throw Error('local production server not ready');}}
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
const report={realNextProductionBuild:true,readOnlyRejectedSnapshot:true,syntheticData:true,serverExternalApiBlocked:true,physicalTapMeasured:false,checks:[],views:[],routes:[],comparisons:[],errors:[],unexpectedWrites:[]};const check=(v,name)=>report.checks.push({name,passed:Boolean(v)});
async function stylesFor(html){const urls=[...new Set([...html.matchAll(/href="([^\"]+\.css(?:\?[^\"]*)?)"/g)].map(m=>m[1]))];return Promise.all(urls.map(async path=>({path,css:await(await fetch(new URL(path,origin))).text()})));}
const homeHtml=await(await fetch(origin)).text(),homeStyles=await stylesFor(homeHtml),full=homeStyles.toSorted((a,b)=>b.css.length-a.css.length)[0];
async function context(width,theme){const context=await browser.newContext({viewport:{width,height:900},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'});await context.addCookies([{name:'theme',value:theme,url:origin},{name:'nexid_theme_version',value:'white-first-v2',url:origin}]);const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message.slice(0,180)));await page.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(r.method()!=='GET'){report.unexpectedWrites.push({method:r.method(),path:u.pathname});return route.abort();}if(u.origin===origin)return route.continue();return route.abort();});return{page,context,width,theme};}
const stable=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function capture(page){return page.evaluate(()=>{const root=document.querySelector('.sun-tap-experience')||document.querySelector('[data-testid="sun-summary-product"]')?.parentElement;return [...root.querySelectorAll('*')].filter(el=>el instanceof HTMLElement&&el.offsetWidth&&el.offsetHeight).map(el=>{const cs=getComputedStyle(el);return{tag:el.tagName,classes:el.className,styles:Object.fromEntries(['display','position','color','backgroundColor','fontSize','fontWeight','lineHeight','paddingTop','paddingLeft','paddingBottom','paddingRight','marginTop','borderRadius','gridTemplateColumns','visibility'].map(k=>[k,cs[k]])),width:Math.round(el.getBoundingClientRect().width*10)/10};});});}
try{
 check(full.css.length>500000,'Reference full site stylesheet is present on the homepage');
 for(const theme of ['light','dark'])for(const width of [320,390,768,1440]){
  const t=await context(width,theme);await t.page.goto(origin+path,{waitUntil:'networkidle',timeout:45000});await t.page.locator('[data-testid="sun-summary-product"]').waitFor();await stable(t.page);
  const sheets=await stylesFor(await t.page.content()),lean=sheets.toSorted((a,b)=>b.css.length-a.css.length)[0];const smallBytes=sheets.reduce((sum,s)=>sum+gzipSync(s.css).length,0);
  check(lean.css.length<full.css.length*.55,'Cold SUN excludes unrelated style families '+width+' '+theme);
  check(await t.page.locator('html').getAttribute('data-theme')===theme,'Server theme retained '+width+' '+theme);
  const before=await capture(t.page);await t.page.screenshot({path:join(output,`sun-${width}-${theme}.png`),fullPage:true});
  await t.page.route(origin+'/__qa_original.css',r=>r.fulfill({status:200,contentType:'text/css',body:full.css}));
  await t.page.evaluate(({from,to})=>new Promise((resolve,reject)=>{const link=[...document.querySelectorAll('link[rel="stylesheet"]')].find(el=>new URL(el.href).pathname===new URL(from,location.href).pathname);if(!link)return reject(Error('route stylesheet absent'));link.onload=resolve;link.onerror=()=>reject(Error('reference stylesheet not loaded'));link.href=to;}),{from:lean.path,to:origin+'/__qa_original.css'});
  await stable(t.page);const after=await capture(t.page);const identical=JSON.stringify(before)===JSON.stringify(after);check(identical,'Rendered SUN styles equal full stylesheet '+width+' '+theme);
  const diffs=before.flatMap((b,i)=>JSON.stringify(b)!==JSON.stringify(after[i])?[{index:i,before:b,after:after[i]}]:[]).slice(0,8);
  report.comparisons.push({width,theme,identical,visibleElements:before.length,fullGzip:gzipSync(full.css).length,leanGzip:gzipSync(lean.css).length,totalSunCssGzip:smallBytes,differences:diffs});report.views.push({width,theme,file:`sun-${width}-${theme}.png`});
  check(await t.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow '+width+' '+theme);await t.context.close();
 }
 for(const route of ['/','/about','/pricing','/sdk','/login','/demo-lab']){
  const response=await fetch(origin+route),html=await response.text(),styles=await stylesFor(html);check(styles.some(s=>s.css===full.css),'Complete original site styles kept on '+route);report.routes.push({route,status:response.status,cssFiles:styles.length,hasFull:styles.some(s=>s.css===full.css)});
 }
 {
  const t=await context(390,'light');await t.page.goto(origin+path,{waitUntil:'networkidle'});const before=await capture(t.page);const link=t.page.locator('a[href="/me/products"]').first();check(await link.count()===1,'SUN retains its existing consumer navigation');await link.click();await t.page.waitForURL(url=>url.pathname!=='/sun');await t.page.waitForLoadState('networkidle');await t.page.goBack({waitUntil:'networkidle'});await t.page.locator('[data-testid="sun-summary-product"]').waitFor();await stable(t.page);check(JSON.stringify(before)===JSON.stringify(await capture(t.page)),'SUN remains styled after client navigation through full site');await t.context.close();
 }
 check(!report.errors.length,'No browser exceptions');
}finally{
 await browser.close();next.kill();await writeFile(join(output,'local-server.log'),nextLog);await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
}
console.log(JSON.stringify({checks:report.checks.length,failed:report.checks.filter(c=>!c.passed),views:report.views.length,comparisons:report.comparisons.map(({differences,...r})=>r),errors:report.errors},null,2));assert.ok(report.checks.every(c=>c.passed));
