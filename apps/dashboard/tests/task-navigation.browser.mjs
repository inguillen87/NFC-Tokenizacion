import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { pathToFileURL } from 'node:url';
const base=process.env.QA_BASE_URL || 'http://127.0.0.1:3127';
const host=new URL(base).hostname;
assert.ok(['127.0.0.1','localhost','app.nexid.lat'].includes(host),'Explicit QA host required');
const local=host==='127.0.0.1'||host==='localhost';
assert.ok(process.env.PLAYWRIGHT_MODULE && process.env.AXE_MODULE_PATH,'Local QA tools required');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
const out=resolve(process.env.QA_OUTPUT || 'artifacts/task-navigation-browser');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
const report={base,checkedAt:new Date().toISOString(),publicCases:[],localNavigation:null,physicalTapTested:false};
const expected='2026.09.18-dashboard.17';
try {
  for(const [width,locale,theme] of [[1440,'es-AR','dark'],[1440,'es-AR','light'],[390,'es-AR','dark'],[390,'es-AR','light'],[390,'en','light'],[390,'pt-BR','light']]){
    const context=await browser.newContext({viewport:{width,height:960},deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});
    await context.addCookies([{name:'locale',value:locale,url:base}]);
    await context.addInitScript((theme)=>{localStorage.setItem('nexid-theme',theme);localStorage.setItem('theme',theme);},theme);
    const page=await context.newPage(); const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{
      const req=route.request();const h=new URL(req.url()).hostname;
      if(!['GET','HEAD'].includes(req.method()))return route.abort();
      if(local && !['127.0.0.1','localhost'].includes(h))return route.abort();
      return route.continue();
    });
    const response=await page.goto(base+'/novedades',{waitUntil:'networkidle',timeout:90000});
    assert.equal(response.status(),200);
    assert.equal(await page.locator('[data-testid="dashboard-release-id"]').textContent(),expected);
    await page.evaluate(theme=>{document.documentElement.classList.toggle('theme-light',theme==='light');document.documentElement.classList.toggle('theme-dark',theme==='dark');document.documentElement.dataset.theme=theme;},theme);
    const dimensions=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,width:document.documentElement.scrollWidth}));
    assert.ok(dimensions.width<=dimensions.viewport+1,'Horizontal overflow: '+JSON.stringify(dimensions));
    assert.equal(await page.locator('main article').count(),4);
    await page.addScriptTag({content:axe});
    const a11y=await page.evaluate(async()=>{const r=await axe.run('main',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}));});
    const filename=`notes-${width}-${locale}-${theme}.png`;
    await page.screenshot({path:join(out,filename),fullPage:true});
    report.publicCases.push({width,locale,theme,status:response.status(),dimensions,a11y,errors,screenshot:filename});
    assert.deepEqual(errors,[],'Uncaught client error');
    assert.deepEqual(a11y.filter(v=>v.impact==='critical'||v.impact==='serious'),[],'Accessibility violation in changed notes surface');
    await context.close();
  }
  if(local){
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
    const page=await context.newPage();
    await page.route('**/*',route=>{
      const req=route.request(),url=new URL(req.url());
      if(!['127.0.0.1','localhost'].includes(url.hostname))return route.abort();
      if(!['GET','HEAD'].includes(req.method())&&!(req.method()==='POST'&&url.pathname==='/api/session/demo'))return route.abort();
      return route.continue();
    });
    await page.goto(base+'/login',{waitUntil:'networkidle',timeout:90000});
    assert.equal(await page.locator('[data-testid="dashboard-release-link"]').count(),1);
    // Local-only fixture uses the existing explicit demo policy; no real account or production mutation.
    await context.addCookies([{name:'nexid_dashboard_session',value:'demo.'+Buffer.from(JSON.stringify({email:'local-qa@example.invalid',role:'tenant-admin',demo:true})).toString('base64url'),url:base,httpOnly:true,sameSite:'Lax'}]);
    await page.goto(base+'/settings',{waitUntil:'networkidle',timeout:90000});
    const trigger=page.locator('button[aria-controls="dashboard-primary-navigation"]');
    await trigger.waitFor({state:'visible',timeout:60000}); await trigger.click();
    await page.waitForTimeout(500); const drawer=page.locator('#dashboard-primary-navigation');
    assert.equal(await drawer.getAttribute('role'),'dialog');
    assert.equal(await page.locator('.dashboard-main').getAttribute('inert'),'');
    assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
    for(let i=0;i<45;i++){
      await page.keyboard.press('Tab');
      assert.ok(await page.evaluate(()=>document.querySelector('#dashboard-primary-navigation').contains(document.activeElement)),'Focus escaped mobile menu');
    }
    await page.screenshot({path:join(out,'navigation-mobile.png'),fullPage:false});
    const box=await drawer.boundingBox(); assert.ok(box.x>=-1 && box.x+box.width<=390, "Drawer must be entirely visible"); const groupNames=await drawer.locator('[data-task-group] summary').allTextContents();
    assert.ok(groupNames.length>=3); await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('.dashboard-main').hasAttribute('inert'));
    assert.ok(await trigger.evaluate(el=>el===document.activeElement),'Focus not restored');
    assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
    await page.setViewportSize({width:1440,height:1000});
    await page.waitForTimeout(200);
    assert.equal(await drawer.getAttribute('role'),null);
    await page.screenshot({path:join(out,'navigation-desktop.png'),fullPage:false});
    await drawer.locator('a[href="/novedades"]').click();
    await page.waitForURL('**/novedades');
    assert.equal(await page.locator('[data-testid="dashboard-release-id"]').textContent(),expected);
    report.localNavigation={groupNames,focusTrapTabs:45,escapeAndFocusReturn:true,backgroundRestored:true,desktop:true,releaseLink:true,source:'local-demo-only-no-production-credentials'};
    await context.close();
  }
  report.status='passed';
} catch(error){report.status='failed';report.error=error.stack;throw error;}
finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report,null,2));}
