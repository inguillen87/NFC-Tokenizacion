// Actual UI and API handlers on disposable PostgreSQL. Synthetic users only; no external delivery.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const base='http://localhost:3165',api='http://127.0.0.1:4295',out=process.env.QA_OUTPUT;
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const report={localOnly:true,actualHandlers:true,realPostgres:true,providerRequests:0,checks:[],screens:[]};
async function open(who,width=1440){
 const context=await browser.newContext({viewport:{width,height:1050},serviceWorkers:'block',reducedMotion:'reduce',acceptDownloads:true});
 await context.addCookies([{name:'nexid_dashboard_session',value:'qa-launch-'+who,url:base,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 await page.goto(base+'/campaigns/review?tenant=campaign-qa',{waitUntil:'load',timeout:90000});await page.getByRole('heading',{name:'Campañas bajo control.',exact:true}).waitFor();
 await page.getByRole('button',{name:/Campaña local de fidelización/}).click();await page.getByRole('heading',{name:'Campaña local de fidelización',exact:true}).waitFor();return {context,page,errors};
}
async function action(p,name){await p.getByRole('button',{name,exact:true}).click();const dialog=p.getByRole('dialog');await dialog.waitFor();await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Confirmar acción',exact:true}).click();await dialog.waitFor({state:'hidden'});}
async function done(p){await p.getByRole('status').filter({hasText:/Guardado con comprobante|intento anterior/}).waitFor({timeout:30000});await p.getByRole('button',{name:'Actualizar estado',exact:true}).waitFor();}
const state=async()=>await(await fetch(api+'/qa-state')).json();
try{
 const editor=await open('editor'),p=editor.page;assert.equal((await state()).plans,0);
 await p.getByRole('textbox',{name:'Máximo de destinatarios',exact:true}).fill('2');await p.getByRole('textbox',{name:'Costo unitario de referencia',exact:true}).fill('1,00');await p.getByRole('textbox',{name:'Presupuesto de referencia',exact:true}).fill('1,50');
 await p.getByRole('button',{name:'Resultado del ensayo',exact:true}).click();await p.getByRole('button',{name:'Preparación y revisión',exact:true}).click();assert.equal(await p.getByRole('textbox',{name:'Presupuesto de referencia',exact:true}).inputValue(),'1,50');
 await fetch(api+'/qa-lose-next',{method:'POST'});await action(p,'Guardar límites');await p.getByRole('button',{name:'Reconciliar el mismo intento',exact:true}).waitFor();assert.equal((await state()).plans,1);assert.equal((await state()).operations,1);
 await p.getByRole('button',{name:'Reconciliar el mismo intento',exact:true}).click();await done(p);assert.equal((await state()).operations,1);report.checks.push('Saved limits survive lost response with one operation');
 await action(p,'Solicitar revisión');await done(p);assert.equal(await p.getByRole('button',{name:'Aprobar simulación',exact:true}).isDisabled(),true);
 const reviewer=await open('reviewer');await action(reviewer.page,'Aprobar simulación');await done(reviewer.page);report.checks.push('Independent account approves the exact draft and limits');
 await p.getByRole('button',{name:'Actualizar estado',exact:true}).click();await p.getByRole('button',{name:'Simular audiencia',exact:true}).waitFor();await action(p,'Simular audiencia');await done(p);await p.getByRole('heading',{name:'Resultado de la simulación',exact:true}).waitFor();
 const content=await p.getByTestId('campaign-launch-workspace').innerText();assert.match(content,/0 mensajes enviados/);assert.match(content,/Sin consentimiento vigente del canal/);assert.ok(!content.includes('@example.invalid'));report.checks.push('Real aggregate and budget result shown without contact values or delivery');
 for(const [width,theme] of [[1440,'light'],[1440,'dark'],[390,'light'],[390,'dark']]){
  await p.setViewportSize({width,height:1050});await p.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.documentElement.classList.toggle('theme-light',theme==='light');document.documentElement.classList.toggle('theme-dark',theme==='dark');},theme);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');await p.addScriptTag({content:axe});
  const violations=await p.evaluate(async()=>{const r=await axe.run('[data-testid="campaign-launch-workspace"]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}));});
  await p.screenshot({path:join(out,`campaign-${width}-${theme}.png`),fullPage:true});report.screens.push({width,theme,violations});assert.deepEqual(violations.filter(v=>['serious','critical'].includes(v.impact)),[]);
 }
 const [file]=await Promise.all([p.waitForEvent('download'),p.getByRole('button',{name:'Descargar informe',exact:true}).click()]);await file.saveAs(join(out,'simulation.html'));const html=await readFile(join(out,'simulation.html'),'utf8');assert.match(html,/SIMULACIÓN SIN ENVÍOS/);assert.match(html,/consumer_tenant_consents/);assert.ok(!html.includes('@example.invalid'));report.checks.push('Export includes the simulation source and denominators, not a recipient list');
 await p.reload({waitUntil:'load'});await p.getByRole('button',{name:/Campaña local de fidelización/}).click();await p.getByRole('button',{name:'Resultado del ensayo',exact:true}).click();await p.getByRole('heading',{name:'Resultado de la simulación',exact:true}).waitFor();report.checks.push('Approved plan and result survive page reload');
 const viewer=await open('viewer',390);assert.equal(await viewer.page.getByRole('button',{name:'Guardar límites',exact:true}).isDisabled(),true);assert.equal(await viewer.page.getByRole('button',{name:'Simular audiencia',exact:true}).isDisabled(),true);
 assert.deepEqual(editor.errors,[]);assert.deepEqual(reviewer.errors,[]);assert.deepEqual(viewer.errors,[]);
 await viewer.context.close();await editor.context.close();await reviewer.context.close();report.status='passed';
}catch(error){report.status='failed';report.error=error.stack;const p=browser.contexts().at(-1)?.pages().at(-1);if(p){report.visible=(await p.locator('body').innerText()).slice(0,9000);await p.screenshot({path:join(out,'failure.png'),fullPage:true}).catch(()=>{});}throw error;}
finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
