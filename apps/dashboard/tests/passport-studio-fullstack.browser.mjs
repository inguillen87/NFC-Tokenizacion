// Integrated Next.js/React application with real local PostgreSQL and synthetic users only.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const base='http://localhost:3145',api='http://127.0.0.1:4193',out=process.env.QA_OUTPUT;assert.ok(out&&process.env.PLAYWRIGHT_MODULE&&process.env.AXE_MODULE_PATH);
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const report={localPostgres:true,realNextReactRuntime:true,productionMutations:false,workflow:{},screens:[],errors:[]};
const state=async()=>await(await fetch(api+'/qa-state')).json();
async function open(who,width=1440){
 const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});await context.addCookies([{name:'nexid_dashboard_session',value:'local-studio-'+who,url:base,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 await page.goto(base+'/batches/QA-PASSPORT/passport',{waitUntil:'load',timeout:90000});return {context,page};
}
async function dialog(page,action){await page.getByRole('button',{name:action,exact:true}).click();const modal=page.getByRole('dialog');await modal.waitFor();await modal.getByRole('button',{name:'Confirmar',exact:true}).click();}
async function saved(page,text){await page.locator('[data-slot="status"]').filter({hasText:text}).waitFor({timeout:30000});}
try{
 const editor=await open('editor'),page=editor.page;
 await page.locator('[data-testid="studio-enrollment"]:visible').waitFor();assert.equal((await state()).head,undefined);
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Crear borrador del lote',exact:true}).click();
 await page.getByRole('heading',{name:'Passport Studio',exact:true}).waitFor();assert.equal((await state()).head.draft.revision,1);
 report.workflow.enrollmentPersistsWithoutPublication=true;
 const name=page.getByRole('textbox',{name:'Nombre del producto',exact:false});await name.fill('Semilla Horizonte · propuesta QA');
 const before=await state();await page.getByRole('button',{name:'Producto agro',exact:true}).click();await page.getByRole('button',{name:'Identidad',exact:true}).click();assert.equal(await name.inputValue(),'Semilla Horizonte · propuesta QA');assert.equal((await state()).reads,before.reads);
 await fetch(api+'/qa-lose-next',{method:'POST'});await dialog(page,'Guardar borrador');await page.getByRole('button',{name:'Reintentar el mismo intento',exact:true}).waitFor();
 const committed=(await state()).head.draft.revision;assert.equal(committed,2);
 await page.getByRole('button',{name:'Reintentar el mismo intento',exact:true}).click();await saved(page,'no se duplicó');assert.equal((await state()).head.draft.revision,2);
 const calls=(await state()).calls.filter(c=>c.action==='save');assert.equal(calls.length,2);assert.equal(calls[0].operationId,calls[1].operationId);report.workflow.lostResponseReplayIsSameRevision=true;
 await page.reload({waitUntil:'load'});await page.getByRole('heading',{name:'Passport Studio',exact:true}).waitFor();assert.equal(await name.inputValue(),'Semilla Horizonte · propuesta QA');report.workflow.draftSurvivesReload=true;
 for(const [width,theme] of [[1440,'light'],[1440,'dark'],[390,'light'],[390,'dark']]){
  await page.setViewportSize({width,height:1000});await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.documentElement.classList.toggle('theme-light',theme==='light');},theme);
  await page.getByRole('button',{name:'Identidad',exact:true}).click();await page.waitForTimeout(120);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');
  await page.addScriptTag({content:axe});const violations=await page.evaluate(async()=>{const r=await axe.run('.ps-root',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}));});
  await page.screenshot({path:join(out,`studio-${width}-${theme}.png`),fullPage:true});report.screens.push({width,theme,violations});assert.deepEqual(violations.filter(v=>v.impact==='serious'||v.impact==='critical'),[]);
 }
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Cambios',exact:false}).first().click();await page.screenshot({path:join(out,'comparison.png'),fullPage:true});
 await dialog(page,'Enviar a revisión');await saved(page,'operación confirmada');assert.equal((await state()).head.draft.state,'in_review');assert.equal(await page.getByRole('button',{name:'Aprobar contenido',exact:true}).count(),0);report.workflow.selfApprovalNotAvailable=true;
 const reviewer=await open('reviewer');await reviewer.page.getByRole('heading',{name:'Passport Studio',exact:true}).waitFor();await dialog(reviewer.page,'Aprobar contenido');await saved(reviewer.page,'operación confirmada');assert.equal((await state()).head.draft.state,'approved');
 await page.getByRole('button',{name:'Actualizar estado',exact:true}).click();await page.getByRole('button',{name:'Publicar esta versión',exact:true}).waitFor();await dialog(page,'Publicar esta versión');await saved(page,'Publicación confirmada');
 let s=await state();assert.equal(s.head.published_version,1);assert.equal(s.product.product_name,'Semilla Horizonte · propuesta QA');assert.equal(s.product.meta_setting,'LOCAL_TEST_ONLY');assert.deepEqual(s.product.sun.security,{sentinel:true});report.workflow.independentReviewAndAtomicPublication=true;
 await page.locator('summary').filter({hasText:'Preparar una nueva revisión'}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Abrir nueva revisión',exact:true}).click();await page.getByRole('button',{name:'Guardar borrador',exact:true}).waitFor();
 await page.getByRole('button',{name:'Historial',exact:true}).click();const restore=page.getByRole('button',{name:'Usar contenido en el borrador',exact:true}).last();await restore.click();await page.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true}).click();
 assert.equal((await state()).product.product_name,'Semilla Horizonte · propuesta QA');await dialog(page,'Guardar borrador');await saved(page,'Borrador guardado');assert.equal((await state()).head.published_version,1);report.workflow.historyRestoreDoesNotPublish=true;
 await page.screenshot({path:join(out,'history-restored.png'),fullPage:true});
 const viewer=await open('viewer',390);await viewer.page.getByRole('heading',{name:'Passport Studio',exact:true}).waitFor();assert.equal(await viewer.page.getByRole('button',{name:'Guardar borrador',exact:true}).isDisabled(),true);assert.equal(await viewer.page.getByRole('button',{name:'Aprobar contenido',exact:true}).count(),0);report.workflow.readonlyViewer=true;
 assert.deepEqual(report.errors,[]);report.status='passed';await editor.context.close();await reviewer.context.close();await viewer.context.close();
}catch(error){report.status='failed';report.error=error.stack;const p=browser.contexts().at(-1)?.pages().at(-1);if(p){await p.screenshot({path:join(out,'failure.png'),fullPage:true}).catch(()=>{});report.visibleText=(await p.locator('body').innerText()).slice(-5000);}throw error;}
finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
