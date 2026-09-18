// Acceptance of real UI against loopback-only synthetic data. Never point at production.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const base='http://localhost:3142',api='http://127.0.0.1:4196';
const out=process.env.QA_OUTPUT;assert.ok(out&&process.env.PLAYWRIGHT_MODULE&&process.env.AXE_MODULE_PATH);
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const report={localSynthetic:true,cases:[],functional:null,viewer:null,failures:[]};
const state=async()=>await(await fetch(api+'/qa-state')).json();
async function setup(width,viewer=false){
  const context=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addCookies([{name:'nexid_dashboard_session',value:viewer?'local-dossier-viewer':'local-dossier-admin',url:base,httpOnly:true,sameSite:'Lax'}]);
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await page.goto(base+'/batches/QA-ROLL-01',{waitUntil:'load',timeout:60000});
  await page.getByRole('tab',{name:'Resumen',exact:true}).waitFor();
  return {context,page,errors};
}
try {
  await fetch(api+'/qa-reset',{method:'POST'});
  for(const [width,theme] of [[1440,'light'],[1440,'dark'],[390,'light'],[390,'dark']]){
    const {context,page,errors}=await setup(width);
    await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.documentElement.classList.toggle('theme-light',theme==='light');},theme);
    assert.equal(await page.getByRole('tab').count(),5);
    assert.equal(await page.getByRole('tabpanel').count(),1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');
    const before=await state();
    await page.getByRole('tab',{name:'Resumen',exact:true}).focus();await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab',{name:'Producto',exact:true}).getAttribute('aria-selected'),'false');
    await page.keyboard.press('Enter');assert.equal(await page.getByRole('tab',{name:'Producto',exact:true}).getAttribute('aria-selected'),'true');
    const input=page.locator('[data-testid="roll-product-identity"]:visible').getByRole('textbox',{name:'Nombre del producto',exact:true});
    await input.fill('Borrador conservado QA');
    await page.getByRole('tab',{name:'Unidades y recepción',exact:true}).click();
    await page.getByRole('textbox',{name:'Buscar en la muestra de unidades'}).fill('PALLET-QA-01');
    assert.equal(await page.locator('[data-testid="batch-unit-evidence"]:visible tbody tr').count(),1);
    await page.getByRole('tab',{name:'Producto',exact:true}).click();assert.equal(await input.inputValue(),'Borrador conservado QA');
    await page.getByRole('tab',{name:'Resumen',exact:true}).click();
    const after=await state();assert.equal(after.summaries,before.summaries,'Tab switching must not fetch the summary again');assert.equal(after.readings,before.readings,'Tab switching must not fetch readings');
    await page.addScriptTag({content:axe});
    const violations=await page.evaluate(async()=>{const result=await axe.run('[data-testid="batch-dossier"]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return result.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}));});
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:join(out,`dossier-${width}-${theme}.png`),fullPage:true});
    assert.deepEqual(violations.filter(v=>v.impact==='serious'||v.impact==='critical'),[]);
    assert.deepEqual(errors,[]);report.cases.push({width,theme,keyboard:true,retainedUnsavedForm:true,tabFetches:0,violations,errors});await context.close();
  }
  const {context,page,errors}=await setup(1440);
  await page.getByRole('tab',{name:'Producto',exact:true}).click();
  const editor=page.locator('[data-testid="roll-product-identity"]:visible');
  await editor.getByRole('textbox',{name:'Nombre del producto',exact:true}).fill('Producto guardado QA');
  await editor.getByRole('checkbox').check();await editor.getByRole('button',{name:'Guardar ficha del rollo'}).click();
  await editor.getByRole('status').filter({hasText:'Ficha guardada'}).waitFor();
  await page.getByRole('heading',{name:'Producto guardado QA',level:1}).waitFor();
  const beforeRead=await state();
  await page.getByRole('tab',{name:'Lecturas',exact:true}).click();
  assert.equal((await state()).readings,beforeRead.readings);
  const reader=page.locator('[data-testid="batch-dossier-readings"]:visible');
  await reader.getByRole('button',{name:'Consultar lecturas del lote',exact:true}).click();
  await reader.locator('tbody tr').first().waitFor();assert.equal(await reader.locator('tbody tr').count(),3);
  assert.equal((await state()).readings,beforeRead.readings+1);
  await page.screenshot({path:join(out,'dossier-readings.png'),fullPage:true});
  const lastPatch=(await state()).patches.at(-1);assert.deepEqual(Object.keys(lastPatch),['product_name']);
  for(const [mode,copy] of [['foreign','no coincide con el contrato'],['offline','no respondió correctamente'],['empty','confirmó una muestra vacía']]){
    await fetch(api+'/qa-read-mode',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode})});
    const button=reader.getByRole('button',{name:'Consultar lecturas del lote',exact:true});await button.waitFor();await button.click();
    await reader.getByText(copy,{exact:false}).waitFor();
    if(mode!=='empty')assert.equal(await reader.locator('tbody tr').count(),0);
    report.failures.push({mode,handled:true});
  }
  assert.deepEqual(errors,[]);report.functional={realFormOnLocalFixture:true,changedFieldsOnly:true,manualReadRequests:true,actualPhysicalTapTested:false};await context.close();
  const viewer=await setup(390,true);
  await viewer.page.getByRole('tab',{name:'Producto',exact:true}).click();assert.equal(await viewer.page.getByRole('button',{name:'Guardar ficha del rollo'}).count(),0);
  const beforeDenied=await state();await viewer.page.getByRole('tab',{name:'Lecturas',exact:true}).click();
  await viewer.page.getByText('Necesitás events.read_sensitive',{exact:false}).waitFor();
  assert.equal(await viewer.page.getByRole('button',{name:'Consultar lecturas del lote',exact:true}).count(),0);
  assert.equal((await state()).readings,beforeDenied.readings);report.viewer={editHidden:true,readDeniedBeforeRequest:true};await viewer.context.close();
  report.status='passed';
} catch(error){report.status='failed';report.error=error.stack;throw error;}
finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
