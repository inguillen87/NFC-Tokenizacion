// Local DOM acceptance with volatile replies, not a production integration or persistence test.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {renderStudioHarness} from './passport-studio-render-harness.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const html=await renderStudioHarness();
const out=resolve(process.env.QA_OUTPUT||'artifacts/passport-studio-local');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const report={localSynthetic:true,inMemoryReplies:true,realBackend:false,cases:[],scenarios:[]};
async function setup(width=1440,theme='light',role='editor'){
 const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
 const page=await context.newPage(),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{network.push(r.request().url());return r.abort();});
 await page.evaluate(setup=>{window.qaSetup=setup;},{theme,role});
 await page.setContent(html,{waitUntil:'load'});
 await page.getByRole('heading',{name:'Passport Studio',exact:true}).waitFor();
 return {context,page,errors,network};
}
async function confirm(page,label){
 await page.getByRole('button',{name:label,exact:true}).click();await page.getByRole('dialog').waitFor();
 const before=await page.evaluate(()=>window.qa.calls.length);
 await page.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true}).click();
 await page.waitForFunction(n=>window.qa.calls.length>n,before);await page.waitForFunction(()=>!window.studioTest.getState().busy);
}
try{
 for(const [width,theme] of [[1440,'light'],[1440,'dark'],[390,'light'],[390,'dark']]){
  const {context,page,errors,network}=await setup(width,theme);
  await page.screenshot({path:join(out,`editor-${width}-${theme}.png`),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.ok(await page.getByRole('button',{name:'Guardar borrador',exact:true}).isDisabled());
  await page.getByRole('textbox',{name:'Nombre del producto',exact:false}).fill('Semilla nueva QA');
  assert.equal(await page.locator('.ps-phone-body h2').textContent(),'Semilla nueva QA');
  await page.getByRole('button',{name:'Publicado · v2',exact:true}).click();assert.equal(await page.locator('.ps-phone-body h2').textContent(),'Semilla Andina · anterior');
  await page.getByRole('button',{name:'Borrador',exact:true}).click();
  await page.getByRole('button',{name:'Documentos',exact:true}).click();await page.getByRole('textbox',{name:'Ficha técnica',exact:true}).waitFor();
  await page.getByRole('button',{name:'Identidad',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'Nombre del producto',exact:false}).inputValue(),'Semilla nueva QA');
  assert.equal(await page.evaluate(()=>window.qa.calls.length),0);
  await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.qa.calls.length),0);
  await confirm(page,'Guardar borrador');assert.match(await page.locator('[data-slot="status"]').textContent(),/Borrador guardado/);
  await confirm(page,'Enviar a revisión');assert.equal(await page.locator('[data-slot="stage"]').textContent(),'En revisión');
  assert.ok(await page.getByRole('textbox',{name:'Nombre del producto',exact:false}).isDisabled());assert.equal(await page.evaluate(()=>window.qa.calls.length),2);
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);report.cases.push({width,theme,retainedInput:true,publishedUnchangedWhileTyping:true,confirmRequired:true,noOverflow:true,network,errors});await context.close();
 }
 for(const mode of ['conflict','lost','foreign','denied']){
  const {context,page}=await setup();await page.getByRole('textbox',{name:'Nombre del producto',exact:false}).fill('Cambios conservados QA');
  await page.evaluate(mode=>window.qa.mode=mode,mode);await confirm(page,'Guardar borrador');
  assert.equal(await page.getByRole('textbox',{name:'Nombre del producto',exact:false}).inputValue(),'Cambios conservados QA');assert.equal(await page.evaluate(()=>window.qa.calls.length),1);
  if(mode==='lost'){await page.getByRole('button',{name:'Reintentar el mismo intento',exact:true}).click();await page.waitForFunction(()=>!window.studioTest.getState().busy);const calls=await page.evaluate(()=>window.qa.calls);assert.equal(calls.length,2);assert.equal(calls[0].operationId,calls[1].operationId);assert.match(await page.locator('[data-slot="status"]').textContent(),/no se duplicó/);}
  if(mode==='conflict')await page.getByText('Existe una revisión más reciente.',{exact:true}).waitFor();
  if(mode==='foreign')await page.getByText('No se confirmó la operación.',{exact:true}).waitFor();
  if(mode==='denied')assert.match(await page.locator('[data-slot="status"]').textContent(),/no tiene permiso/);
  report.scenarios.push({mode,inputRetained:true,noAutomaticRetry:true});await context.close();
 }
 for(const [role,action,state] of [['reviewer','Aprobar contenido','Aprobado'],['publisher','Publicar esta versión','Publicado']]){
  const {context,page}=await setup(1440,'light',role);await confirm(page,action);assert.equal(await page.locator('[data-slot="stage"]').textContent(),state);report.scenarios.push({role,action,matchingReplyRequired:true});await context.close();
 }
 const {context,page,errors}=await setup();await page.getByRole('button',{name:'Historial',exact:true}).click();await page.getByRole('button',{name:'Usar contenido en el borrador'}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true}).click();await page.getByRole('heading',{name:'Comparar cambios',exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.qa.calls.length),0);
 await page.getByRole('button',{name:'Identidad',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'Nombre del producto',exact:false}).inputValue(),'Semilla Andina · anterior');
 const text='<img src=x onerror="window.injected=true">';await page.getByRole('textbox',{name:'Nombre del producto',exact:false}).fill(text);assert.equal(await page.evaluate(()=>window.injected),undefined);assert.equal(await page.locator('.ps-phone-body h2').textContent(),text);assert.deepEqual(errors,[]);report.scenarios.push({restoreRequiresNewSave:true,untrustedTextEscaped:true});await context.close();
 const mobile=await setup(390);await mobile.page.getByRole('button',{name:'Vista previa',exact:true}).click();assert.ok(await mobile.page.locator('.ps-phone').isVisible());assert.ok(!(await mobile.page.getByRole('textbox',{name:'Nombre del producto',exact:false}).isVisible()));await mobile.page.screenshot({path:join(out,'mobile-preview.png'),fullPage:true});await mobile.page.getByRole('button',{name:'Volver al editor'}).click();assert.ok(await mobile.page.getByRole('textbox',{name:'Nombre del producto',exact:false}).isVisible());report.scenarios.push({mobilePreviewToggle:true});await mobile.context.close();report.status='passed';
}catch(error){report.status='failed';report.error=error.stack;throw error;}
finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
