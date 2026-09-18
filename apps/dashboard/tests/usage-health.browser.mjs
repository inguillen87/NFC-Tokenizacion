// Local browser acceptance only. All service data and account claims are synthetic.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const base='http://localhost:3141';const api='http://127.0.0.1:4197';
const out=process.env.QA_OUTPUT;assert.ok(out&&process.env.PLAYWRIGHT_MODULE&&process.env.AXE_MODULE_PATH);
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);const axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
await mkdir(out,{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
const report={localSynthetic:true,cases:[],failures:[]};
const state=async()=>await(await fetch(api+'/qa-state')).json();
try{
  for(const [width,theme] of [[1440,'light'],[1440,'dark'],[390,'light'],[390,'dark']]){
    await fetch(api+'/qa-scenario?value=normal');
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce',serviceWorkers:'block',acceptDownloads:true});
    await context.addCookies([{name:'nexid_dashboard_session',value:'local-qa-only',url:base,httpOnly:true,sameSite:'Lax'}]);
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
    const before=await state();await page.goto(base+'/service-levels',{waitUntil:'load',timeout:60000});
    const center=page.locator('[data-testid="usage-health-center"]:visible');await center.waitFor();
    await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.documentElement.classList.toggle('theme-light',theme==='light');},theme);
    assert.equal(await center.getAttribute('data-source-state'),'ready');
    assert.equal((await center.getByTestId('health-sun-count').textContent()).trim(),'31');
    assert.equal((await state()).sdkReads,before.sdkReads,'No SDK request without user action');
    assert.equal(await center.locator('details[id^="health-"]').count(),6);
    const readCount=(await state()).serviceReads;
    await center.getByRole('button',{name:'Requieren revisión',exact:true}).click();assert.equal(await center.locator('details[id^="health-"]').count(),2);
    await center.getByRole('button',{name:'Todos',exact:true}).click();
    await center.getByTestId('health-service-sun').locator('summary').first().click();
    await page.waitForTimeout(300);assert.equal((await state()).serviceReads,readCount,'Filters and details do not query the service');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
    await page.addScriptTag({content:axe});const violations=await center.evaluate(async element=>{const r=await window.axe.run(element,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}));});
    assert.deepEqual(violations.filter(v=>['serious','critical'].includes(v.impact)),[]);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:join(out,`usage-${width}-${theme}.png`),fullPage:true});
    const downloadReady=page.waitForEvent('download');await center.getByRole('button',{name:'Descargar evidencia',exact:true}).click();const download=await downloadReady;
    const exported=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(exported.format,'nexid.operational-support.v1');assert.equal(exported.limits.costMeasured,false);
    await center.getByRole('link',{name:'Consultar uso SDK'}).click();
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-testid="health-sdk-count"]')].some(e=>e.getClientRects().length&&e.textContent==='7'));
    assert.equal((await state()).sdkReads,before.sdkReads+1);
    assert.doesNotMatch(await page.content(),/LOCAL_QA_DO_NOT_FORWARD|key_prefix/);
    assert.deepEqual(errors,[]);report.cases.push({width,theme,readCount,source:'ready',sdkOptIn:true,export:true,filterWithoutFetch:true,violations,errors});
    await context.close();
  }
  for(const [mode,expected] of [['invalid','invalid'],['unavailable','unavailable'],['forbidden','forbidden'],['empty','ready']]){
    await fetch(api+'/qa-scenario?value='+mode);
    const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
    await context.addCookies([{name:'nexid_dashboard_session',value:'local-qa-only',url:base,httpOnly:true,sameSite:'Lax'}]);
    const page=await context.newPage();await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
    await page.goto(base+'/service-levels',{waitUntil:'load',timeout:60000});const center=page.locator('[data-testid="usage-health-center"]:visible');await center.waitFor();
    assert.equal(await center.getAttribute('data-source-state'),expected);assert.equal(await center.getByTestId('health-sun-count').textContent(),mode==='empty'?'0':'—');
    if(mode==='empty')assert.equal(await center.getByText('Dentro del objetivo',{exact:true}).count(),0);
    await page.screenshot({path:join(out,`source-${mode}.png`),fullPage:false});report.failures.push({scenario:mode,state:expected,zeroOnlyForConfirmedEmpty:true});await context.close();
  }
  report.status='passed';
}catch(error){report.status='failed';report.error=error.stack;throw error;}finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
