// Actual local Next production UI acceptance. Journey data is the application's
// labelled illustrative fixture; no API response is fabricated and no write is sent.
// QA_ORIGIN=http://127.0.0.1:3300 QA_OUTPUT=artifacts/public-visual-local node scripts/browser/public-visual.browser.mjs
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

if (!process.env.QA_ORIGIN) throw Error('QA_ORIGIN_required_use_public_visual_next_wrapper_to_start_server');
const origin = new URL(process.env.QA_ORIGIN).origin;
if (!['localhost','127.0.0.1'].includes(new URL(origin).hostname)) throw Error('acceptance_requires_local_production_server');
const output = resolve(process.env.QA_OUTPUT || 'artifacts/public-visual-local');
await mkdir(output, { recursive:true });
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || 'C:/Users/guill/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const axe = await readFile(process.env.AXE_MODULE_PATH || process.env.AXE_PATH || 'artifacts/browser-tools/node_modules/axe-core/axe.min.js','utf8');
const report = { localOnly:true, actualNextStyles:true, serverModeExpected:'next start after production build', applicationIllustrativeJourney:true, fabricatedApiResponses:false, physicalTapMeasured:false, gpsMeasured:false, businessWritesAllowed:false, origin, checks:[], views:[], interactions:[], errors:[], blockedWrites:[], blockedSensitiveReads:[] };
const check = (condition,name,details) => report.checks.push({ name, passed:Boolean(condition), ...(details === undefined ? {} : { details }) });
const stable = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const browser = await chromium.launch({ executablePath:process.env.CHROME_PATH || (process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined), headless:true });

async function contrast(page, selector) {
  return page.locator(selector).first().evaluate(el => {
    const rgb = s => { const n = s.match(/[\d.]+/g)?.map(Number); return n?.length >= 3 ? [...n.slice(0,3),n[3]??1] : null; };
    const blend = (front,back) => front.slice(0,3).map((v,i)=>v*front[3]+back[i]*(1-front[3])).concat(1);
    let background = [255,255,255,1], indeterminate = false;
    const lineage = []; for(let node=el;node instanceof HTMLElement;node=node.parentElement) lineage.unshift(node);
    for(const node of lineage){ const cs=getComputedStyle(node); if(cs.backgroundImage!=='none') indeterminate=true; const c=rgb(cs.backgroundColor); if(c?.[3]===1){ background=c; indeterminate=cs.backgroundImage!=='none'; } else if(c) background=blend(c,background); }
    const cs=getComputedStyle(el), ink=rgb(cs.color), text=el.textContent?.trim().slice(0,80);
    if(!ink || ink[3]<1 || cs.webkitTextFillColor==='rgba(0, 0, 0, 0)') indeterminate=true;
    const luminance = c => c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
    const a=ink?luminance(ink):0,b=luminance(background), ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05), large=parseFloat(cs.fontSize)>=24 || (parseFloat(cs.fontSize)>=18.66 && parseInt(cs.fontWeight)>=700);
    return { selector:null,text,foreground:cs.color,background:background.slice(0,3),ratio,minimum:large?3:4.5,indeterminate };
  });
}
async function audit(page, contextSelector, name) {
  await page.addScriptTag({content:axe});
  const result=await page.evaluate(async selector=>{const r=await window.axe.run(selector?document.querySelector(selector):document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return{violations:r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary})).slice(0,8)})),incomplete:r.incomplete.map(v=>({id:v.id,nodes:v.nodes.length}))};},contextSelector);
  check(result.violations.length===0,'Axe AA '+name,result); return result;
}
async function menu(page, name) {
  const trigger=page.getByRole('button',{name:'Abrir navegación',exact:true});
  if(await trigger.isVisible()) {
    await trigger.focus(); await page.keyboard.press('Enter');
    const dialog=page.getByRole('dialog',{name:'Abrir navegación',exact:true}); await dialog.waitFor(); await stable(page);
    check(await trigger.getAttribute('aria-expanded')==='true','Menu exposes expanded state '+name);
    check(await page.getByRole('button',{name:'Cerrar navegación',exact:true}).evaluate(e=>e===document.activeElement),'Menu focuses close control '+name);
    const snapshot=await dialog.evaluate(el=>{const nodes=[...el.querySelectorAll('button:not([disabled]),a[href],select,summary,[tabindex]:not([tabindex="-1"])')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'); return{count:nodes.length,first:nodes[0]?.outerHTML.slice(0,150),last:nodes.at(-1)?.outerHTML.slice(0,150)};});
    check(snapshot.count>8,'Menu has reachable useful navigation '+name,snapshot);
    await dialog.evaluate(el=>[...el.querySelectorAll('button:not([disabled]),a[href],select,summary,[tabindex]:not([tabindex="-1"])')].filter(e=>e.getClientRects().length).at(-1)?.focus());
    await page.keyboard.press('Tab'); check(await dialog.evaluate(el=>el.contains(document.activeElement)),'Forward Tab remains inside menu '+name);
    await dialog.evaluate(el=>[...el.querySelectorAll('button:not([disabled]),a[href],select,summary,[tabindex]:not([tabindex="-1"])')].filter(e=>e.getClientRects().length)[0]?.focus());
    await page.keyboard.press('Shift+Tab'); check(await dialog.evaluate(el=>el.contains(document.activeElement)),'Reverse Tab remains inside menu '+name);
    const inert=await page.locator('[data-nav-inert]').evaluateAll(nodes=>nodes.filter(e=>e.getClientRects().length).every(e=>e.inert&&e.getAttribute('aria-hidden')==='true'));
    check(inert,'Page is inert while menu is open '+name); await audit(page,null,'open menu '+name);
    await page.keyboard.press('Escape'); await dialog.waitFor({state:'detached'}); await stable(page);
    check(await trigger.evaluate(e=>e===document.activeElement),'Escape restores menu trigger focus '+name);
    check(await page.locator('[data-nav-inert]').evaluateAll(nodes=>nodes.every(e=>!e.inert)),'Menu releases page focus and interaction '+name);
  } else {
    for(const group of ['solutions','industries','platform','resources']) {
      const button=page.locator(`[data-mega-nav-group="${group}"] > button`); await button.focus(); await page.keyboard.press('ArrowDown'); await stable(page);
      const panel=page.locator('#mega-menu-'+group);
      check(await panel.isVisible()&&await button.getAttribute('aria-expanded')==='true','ArrowDown opens desktop '+group+' '+name);
      check(await panel.evaluate(e=>e.contains(document.activeElement)),'Desktop menu focuses its first link '+group+' '+name);
      await audit(page,null,'open desktop '+group+' '+name);
      await page.keyboard.press('Escape'); await stable(page);
      check(await button.evaluate(e=>e===document.activeElement)&&await button.getAttribute('aria-expanded')==='false','Desktop Escape restores trigger '+group+' '+name);
    }
  }
}
async function journey(page,name) {
  const root=page.locator('[data-demo-featured-journey]');
  check(await root.getAttribute('data-step')==='0','Journey starts without side effects '+name);
  const progress=root.getByRole('progressbar'); check(await progress.getAttribute('aria-valuenow')==='1','Journey announces initial progress '+name);
  check(await root.getByRole('button',{name:/2\. /}).isDisabled(),'Future step remains gated '+name);
  const compactSelector=root.getByRole('combobox');
  if(await compactSelector.isVisible()) {
    await compactSelector.focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await stable(page);
    check(await compactSelector.inputValue()==='perfume','Compact native product selection works by keyboard '+name);
    check(await compactSelector.evaluate(e=>e===document.activeElement),'Compact product selection preserves keyboard focus '+name);
  } else {
    await root.getByRole('button',{name:/Packaging premium/}).click();
    check(await root.getByRole('button',{name:/Packaging premium/}).getAttribute('aria-pressed')==='true','Product selection announces pressed state '+name);
  }
  await root.getByRole('button',{name:'Simular acercamiento',exact:true}).focus(); await page.keyboard.press('Enter'); await stable(page);
  check(await root.getAttribute('data-step')==='1'&&await progress.getAttribute('aria-valuenow')==='2','Keyboard advances illustrative journey '+name);
  check(await page.locator('#demo-lab-featured-step-title').evaluate(e=>e===document.activeElement),'Journey moves focus to new step heading '+name);
  check((await root.innerText()).includes('No certifica por sí sola'),'Journey preserves physical evidence boundary '+name);
  await root.getByRole('button',{name:'Ver qué recibió el celular',exact:true}).click(); await stable(page);
  check(await root.getAttribute('data-step')==='2','Journey offers configured actions '+name);
  await root.getByRole('button',{name:/Hablar con la marca/}).click(); await stable(page);
  check(await root.getAttribute('data-step')==='3'&&await progress.getAttribute('aria-valuenow')==='4','Illustrative action reaches next step '+name);
  check(await root.locator('[data-demo-business-signal]').isVisible(),'Illustrative business signal is progressively disclosed '+name);
  const signal=await root.locator('[data-demo-business-signal]').innerText();
  check(/No identificado/.test(signal)&&/No asumido/.test(signal)&&/No informada/.test(signal)&&/no persistida/.test(signal),'Signal preserves identity consent location and persistence boundaries '+name);
  const handoff=await root.locator('[data-sun-preview-handoff]').getAttribute('href');
  const handoffUrl=new URL(handoff||'/',origin);
  check(handoffUrl.pathname==='/sun'&&handoffUrl.searchParams.get('demo')==='1'&&handoffUrl.searchParams.get('profile')==='perfume'&&handoffUrl.searchParams.get('action')==='support','Final link retains selected illustrative profile and action '+name,{href:handoff}); // Inspect only: do not visit SUN routes.
  await audit(page,'[data-demo-featured-journey]','completed journey '+name);
  await root.getByRole('button',{name:'Reiniciar recorrido',exact:true}).click(); await stable(page);
  check(await root.getAttribute('data-step')==='0'&&await root.getByRole('button',{name:/2\. /}).isDisabled(),'Restart clears only illustrative progress '+name);
  report.interactions.push({name,profile:'perfume',steps:[0,1,2,3,0],handoffInspectedOnly:true});
}
try {
  for(const width of [320,390,768,1440]) for(const theme of ['light','dark']) for(const path of ['/','/demo-lab','/demo-lab?profile=wine']) {
    const context=await browser.newContext({viewport:{width,height:width<768?844:900},locale:'es-AR',serviceWorkers:'block',reducedMotion:'reduce',isMobile:width<768,hasTouch:width<768});
    await context.addCookies([{name:'theme',value:theme,url:origin},{name:'nexid_theme_version',value:'white-first-v2',url:origin}]);
    const page=await context.newPage(),name=`${path} ${width} ${theme}`;
    page.on('pageerror',e=>report.errors.push({name,error:e.message.replace(/https?:\/\/\S+/g,'[url]').slice(0,180)}));
    await page.route('**/*',route=>{const req=route.request(),u=new URL(req.url()); if(req.method()!=='GET'){report.blockedWrites.push({name,method:req.method(),path:u.pathname});return route.abort();}if(/^\/sun(?:\/|$)/.test(u.pathname)||u.searchParams.has('snapshot')||u.searchParams.has('access')){report.blockedSensitiveReads.push({name,path:u.pathname});return route.abort();} if(u.origin!==origin)return route.abort();return route.continue();});
    await page.addInitScript(()=>{window.__geoRequests=0;Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){window.__geoRequests++;},watchPosition(){window.__geoRequests++;},clearWatch(){}}});});
    try {
      const response=await page.goto(origin+path,{waitUntil:'networkidle',timeout:45000}); await page.waitForTimeout(300); await stable(page);
      check(response?.status()===200,'Route renders '+name);
      check(await page.locator('html').getAttribute('data-theme')===theme,'Theme is retained '+name);
      check(await page.locator('h1').count()===1&&await page.locator('h1').isVisible(),'One visible page heading '+name);
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow '+name);
      check(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),'Reduced motion preference is active '+name);
      const activeAnimations=await page.evaluate(()=>document.getAnimations().filter(a=>{const e=a.effect?.target,cs=e instanceof Element?getComputedStyle(e):null;return a.playState==='running'&&a.effect?.getTiming().iterations===Infinity&&cs?.display!=='none'&&cs?.visibility!=='hidden'&&e.getClientRects().length;}).map(a=>({animationName:a.animationName,duration:a.effect.getTiming().duration})).slice(0,12));
      check(!activeAnimations.length,'Reduced motion has no visible looping animation '+name,activeAnimations);
      const heading=await contrast(page,'h1'); check(!heading.indeterminate&&heading.ratio>=heading.minimum,'Page heading has measurable AA contrast '+name,heading);
      const lede=await contrast(page,'h1 + p'); check(!lede.indeterminate&&lede.ratio>=lede.minimum,'Page introduction has measurable AA contrast '+name,lede);
      const main=page.locator('main').first();
      const file=(path==='/'?'landing':path.includes('?')?'demo-profile':'demo-lab')+`-${width}-${theme}.png`;
      await page.screenshot({path:join(output,file),fullPage:true});
      const axeResult=await audit(page,null,'page '+name);
      const targets=await page.locator('header button, header [data-brand-home-link], .demo-lab-hub-nav button, .demo-lab-hub-nav [data-brand-home-link], main [role="group"][aria-label="Acciones principales"] a').evaluateAll(nodes=>nodes.filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').map(e=>({label:e.getAttribute('aria-label')||e.textContent.trim().slice(0,50),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
      check(targets.every(e=>e.width>=44&&e.height>=44),'Primary header and hero targets are at least 44px '+name,targets);
      if(path==='/') {
        await menu(page,name);
        const actions=main.getByRole('group',{name:'Acciones principales'});
        const primary=actions.locator('a').first(); check(await primary.getAttribute('href')==='/demo-lab?profile=wine','Hero opens illustrative product directly '+name);
        await primary.focus(); await page.keyboard.press('Tab');
        const focus=await page.evaluate(()=>{const cs=getComputedStyle(document.activeElement);return{tag:document.activeElement.tagName,outlineStyle:cs.outlineStyle,outlineWidth:parseFloat(cs.outlineWidth),boxShadow:cs.boxShadow};});
        check(focus.outlineStyle!=='none'&&focus.outlineWidth>=2||focus.boxShadow!=='none','Hero keyboard focus indicator is visible '+name,focus);
        await actions.locator('a[href*="contact=demo"]').click(); const dialog=page.getByRole('dialog');await dialog.waitFor();await stable(page);
        check(await dialog.evaluate(e=>e.contains(document.activeElement)),'Contact opens with focus inside '+name);
        await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});check(true,'Contact is dismissible by keyboard '+name);
      } else {
        await journey(page,name);
        if(path==='/demo-lab') {
          const disclosure=page.locator('details.demo-lab-hub-advanced');
          const summary=disclosure.locator(':scope > summary');
          check(await disclosure.getAttribute('open')===null,'Advanced scenarios begin progressively collapsed '+name);
          await summary.focus();await page.keyboard.press('Enter');await stable(page);
          check(await disclosure.getAttribute('open')!==null,'Keyboard opens optional advanced scenarios '+name);
          check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Expanded scenarios have no horizontal overflow '+name);
          for(const mode of ['demo','simulated','configured']) {
            const selector=`details.demo-lab-hub-advanced .demo-lab-scenario-mode[data-demo-mode="${mode}"]`;
            if(await page.locator(selector).count()) {
              const badge=await contrast(page,selector);
              check(!badge.indeterminate&&badge.ratio>=badge.minimum,'Scenario '+mode+' pill has measurable AA contrast '+name,badge);
            }
          }
          await audit(page,null,'expanded advanced scenarios '+name);
          const fileExpanded=`demo-advanced-${width}-${theme}.png`;await page.screenshot({path:join(output,fileExpanded),fullPage:true});
          await summary.focus();await page.keyboard.press('Enter');await stable(page);
          check(await disclosure.getAttribute('open')===null,'Keyboard can close advanced scenarios '+name);
        }
      }
      check(await page.evaluate(()=>window.__geoRequests===0),'No geolocation request '+name);
      report.views.push({path,width,theme,file,heading,lede,axe:axeResult});
    } finally {await context.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));}
  }
  // The full desktop groups appear above 1599px. Exercise that keyboard path
  // separately without changing the 40-view main/locale screenshot matrix.
  for(const theme of ['light','dark']) {
    const context=await browser.newContext({viewport:{width:1920,height:1080},locale:'es-AR',serviceWorkers:'block',reducedMotion:'reduce'});
    await context.addCookies([{name:'theme',value:theme,url:origin},{name:'nexid_theme_version',value:'white-first-v2',url:origin}]);
    const page=await context.newPage(),name=`wide desktop 1920 ${theme}`;
    page.on('pageerror',e=>report.errors.push({name,error:e.message.slice(0,180)}));
    await page.route('**/*',route=>{const req=route.request(),u=new URL(req.url());if(req.method()!=='GET'){report.blockedWrites.push({name,method:req.method(),path:u.pathname});return route.abort();}if(/^\/sun(?:\/|$)/.test(u.pathname)){report.blockedSensitiveReads.push({name,path:u.pathname});return route.abort();}if(u.origin!==origin)return route.abort();return route.continue();});
    try{
      await page.goto(origin+'/',{waitUntil:'networkidle',timeout:45000});await stable(page);
      check(!(await page.getByRole('button',{name:'Abrir navegación',exact:true}).isVisible()),'Wide desktop exposes full groups '+name);
      await menu(page,name);
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Wide desktop navigation has no overflow '+name);
    }finally{await context.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));}
  }
  for(const locale of ['en','pt-BR']) for(const width of [390,1440]) for(const theme of ['light','dark']) for(const path of ['/','/demo-lab']) {
    const context=await browser.newContext({viewport:{width,height:width===390?844:900},locale,reducedMotion:'reduce',serviceWorkers:'block'});
    await context.addCookies([{name:'locale',value:locale,url:origin},{name:'theme',value:theme,url:origin},{name:'nexid_theme_version',value:'white-first-v2',url:origin}]);
    const page=await context.newPage(),name=`locale ${locale} ${path} ${width} ${theme}`;
    page.on('pageerror',e=>report.errors.push({name,error:e.message.slice(0,180)}));
    await page.route('**/*',route=>{const req=route.request(),u=new URL(req.url());if(req.method()!=='GET'){report.blockedWrites.push({name,method:req.method(),path:u.pathname});return route.abort();}if(/^\/sun(?:\/|$)/.test(u.pathname)){report.blockedSensitiveReads.push({name,path:u.pathname});return route.abort();}if(u.origin!==origin)return route.abort();return route.continue();});
    await page.addInitScript(()=>{window.__geoRequests=0;Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){window.__geoRequests++;},watchPosition(){window.__geoRequests++;},clearWatch(){}}});});
    try{
      const r=await page.goto(origin+path,{waitUntil:'networkidle',timeout:45000});await stable(page);
      check(r?.status()===200,'Localized route renders '+name);
      check(await page.locator('html').getAttribute('lang')===locale,'Locale is explicit '+name);
      check(await page.locator('html').getAttribute('data-theme')===theme,'Localized theme retained '+name);
      check(await page.locator('h1').isVisible(),'Localized heading visible '+name);
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Localized page has no horizontal overflow '+name);
      const heading=await contrast(page,'h1'),lede=await contrast(page,'h1 + p');
      check(!heading.indeterminate&&heading.ratio>=heading.minimum,'Localized heading contrast '+name,heading);
      check(!lede.indeterminate&&lede.ratio>=lede.minimum,'Localized introduction contrast '+name,lede);
      const axeResult=await audit(page,null,name);
      check(await page.evaluate(()=>window.__geoRequests===0),'Localized route requests no geolocation '+name);
      const file=`locale-${locale}-${path==='/'?'landing':'demo-lab'}-${width}-${theme}.png`;await page.screenshot({path:join(output,file),fullPage:true});
      report.views.push({path,width,theme,locale,file,heading,lede,axe:axeResult});
    }finally{await context.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));}
  }
  check(report.errors.length===0,'No browser exceptions',report.errors);
  check(report.blockedWrites.filter(r=>r.path!=='/cdn-cgi/rum').length===0,'No attempted business writes',report.blockedWrites);
} finally {await browser.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({checks:report.checks.length,failed:report.checks.filter(c=>!c.passed),views:report.views.length,interactions:report.interactions.length,errors:report.errors,blockedWrites:report.blockedWrites.length,blockedSensitiveReads:report.blockedSensitiveReads.length},null,2));
assert.ok(report.checks.every(c=>c.passed),'public visual acceptance failed; see report');
