// Real browser components, synthetic local API. No customer writes or production credentials.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const base='http://localhost:3143',api='http://127.0.0.1:4195',out=process.env.QA_OUTPUT;
assert.ok(out&&process.env.PLAYWRIGHT_MODULE&&process.env.AXE_MODULE_PATH);
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});const report={localSynthetic:true,cases:[],viewer:null};
const state=async()=>await(await fetch(api+'/qa-state')).json();
async function setup(width,viewer=false){
  const context=await browser.newContext({viewport:{width,height:960},serviceWorkers:'block',reducedMotion:'reduce'});
  await context.addCookies([{name:'nexid_dashboard_session',value:viewer?'local-logistics-viewer':'local-logistics-admin',url:base,httpOnly:true,sameSite:'Lax'}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await page.goto(base+'/logistics',{waitUntil:'load',timeout:60000});await page.getByRole('heading',{name:'Envíos bajo control.',level:1}).waitFor();return {context,page,errors};
}
try{
  for(const [width,theme] of [[1440,'light'],[1440,'dark'],[390,'light'],[390,'dark']]){
    await fetch(api+'/qa-reset',{method:'POST'});const {context,page,errors}=await setup(width);
    await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.documentElement.classList.toggle('theme-light',theme==='light');},theme);
    const before=await state();await page.getByRole('button',{name:'Registrar operación',exact:true}).click();
    const ops=page.locator('[data-testid="logistics-operations"]:visible');
    await ops.getByRole('textbox',{name:'Producto o activo',exact:true}).fill('Producto QA · envío sintético');
    await ops.getByRole('spinbutton',{name:'Cantidad',exact:true}).fill('2');
    assert.equal(await ops.getByRole('button',{name:'Confirmar creación',exact:true}).isDisabled(),true);
    await ops.getByRole('checkbox').check();await fetch(api+'/qa-fail-next',{method:'POST'});
    await ops.getByRole('button',{name:'Confirmar creación',exact:true}).click();
    await ops.getByRole('button',{name:'Reintentar el mismo intento identificado',exact:true}).waitFor();
    assert.equal((await state()).requests.length,1,'No automatic retry after uncertain response');
    assert.equal(await ops.getByRole('textbox',{name:'Producto o activo',exact:true}).isDisabled(),true);
    await ops.getByRole('button',{name:'Reintentar el mismo intento identificado',exact:true}).click();
    await ops.getByRole('heading',{name:'Operación ya registrada · no se duplicó'}).waitFor();
    const after=await state();assert.equal(after.rows,1);assert.equal(after.receipts,1);assert.equal(after.requests[0].operation_key,after.requests[1].operation_key);
    await page.screenshot({path:join(out,`receipt-${width}-${theme}.png`),fullPage:true});
    await ops.getByRole('button',{name:'Preparar siguiente operación'}).click();
    assert.equal(await ops.getByRole('combobox',{name:'Estado reportado del precinto'}).inputValue(),'');
    await ops.getByRole('textbox',{name:'UID del precinto'}).fill('04000000000001');
    await ops.getByRole('checkbox').check();await ops.getByRole('button',{name:'Confirmar declaración',exact:true}).click();
    await ops.getByRole('heading',{name:'Operación guardada con comprobante'}).waitFor();
    assert.equal((await state()).requests.at(-1).tt_raw,'','Unknown TT is not replaced with closed');
    await page.getByRole('button',{name:'Envíos registrados',exact:true}).click();
    await page.getByRole('link',{name:'Abrir expediente',exact:false}).first().waitFor();
    const countBefore=(await state()).reads;await page.getByRole('textbox',{name:'Buscar en los envíos'}).fill('no-coincidence');assert.equal(await page.locator('tbody tr:visible').count(),0);await page.getByRole('textbox',{name:'Buscar en los envíos'}).fill('');assert.equal((await state()).reads,countBefore);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');
    await page.addScriptTag({content:axe});const violations=await page.evaluate(async()=>{const r=await axe.run('[data-testid="logistics-workspace"]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}));});
    await page.screenshot({path:join(out,`logistics-${width}-${theme}.png`),fullPage:true});assert.deepEqual(violations.filter(v=>v.impact==='serious'||v.impact==='critical'),[]);assert.deepEqual(errors,[]);
    report.cases.push({width,theme,sameKeyRetry:true,singleShipment:true,unknownTamperPreserved:true,localFiltersNoRead:true,violations,errors});await context.close();
  }
  const viewer=await setup(390,true);await viewer.page.getByRole('button',{name:'Registrar operación',exact:true}).click();assert.equal(await viewer.page.getByRole('button',{name:'Confirmar creación',exact:true}).count(),0);report.viewer={writesNotAvailable:true};await viewer.context.close();report.status='passed';
}catch(error){report.status='failed';report.error=error.stack;const p=browser.contexts().at(-1)?.pages().at(-1);if(p)await p.screenshot({path:join(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
