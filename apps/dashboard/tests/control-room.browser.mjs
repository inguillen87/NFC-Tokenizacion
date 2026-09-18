// Local browser acceptance: real UI, synthetic loopback session, no production credentials.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const base='http://localhost:3128';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const out=process.env.QA_OUTPUT;assert.ok(out);await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
const results=[];
try {
  for(const theme of ['light','dark']){
    const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
    await context.addCookies([{name:'nexid_dashboard_session',value:'local-qa-only',url:base,httpOnly:true,sameSite:'Lax'}]);
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const allowed=new Set(['localhost','127.0.0.1','tiles.openfreemap.org','services.arcgisonline.com','tiles.mapterhorn.com']);
    await page.route('**/*',r=>allowed.has(new URL(r.request().url()).hostname)?r.continue():r.abort());
    await page.goto(base+'/',{waitUntil:'load',timeout:60000});
    await page.getByRole('button',{name:'Modo sala',exact:true}).waitFor();
    await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.documentElement.classList.toggle('theme-light',theme==='light');},theme);
    const header=await page.locator('[data-testid="crm-responsive-header"]:visible').boundingBox();
    assert.ok(header.height<180,'Compact workspace header');
    await page.screenshot({path:join(out,`workspace-${theme}.png`),fullPage:false});
    await page.getByRole('button',{name:'Modo sala',exact:true}).click();
    await page.locator('[data-display-mode="room"]:visible').waitFor();
    await page.waitForTimeout(5000);
    const map=await page.locator('.nexid-crm-map-canvas-region:visible').boundingBox();
    assert.ok(map.y<350,`Map too low: ${map.y}`);
    assert.ok(map.height>=360,'Map needs useful height');
    assert.ok(map.y+map.height<=970,'Map must not be hidden by the footer');
    assert.equal(await page.getByRole('region',{name:'Últimos eventos visibles'}).count(),1);
    await page.screenshot({path:join(out,`control-room-${theme}.png`),fullPage:false});
    await page.getByRole('button',{name:'Salir de modo sala',exact:true}).click();
    await page.locator('[data-display-mode="workspace"]:visible').waitFor();
    assert.equal(await page.evaluate(()=>document.fullscreenElement===null),true);
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(500);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No mobile overflow');
    await page.screenshot({path:join(out,`workspace-mobile-${theme}.png`),fullPage:false});
    assert.deepEqual(errors,[]);
    results.push({theme,workspaceHeaderHeight:header.height,roomMapTop:map.y,roomMapHeight:map.height,exit:true,mobileNoOverflow:true,errors});
    await context.close();
  }
  console.log(JSON.stringify({localSynthetic:true,results},null,2));
} finally {await writeFile(join(out,'report.json'),JSON.stringify({localSynthetic:true,results},null,2));await browser.close();}
