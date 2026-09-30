import assert from 'node:assert/strict';
import {createServer} from 'node:http';import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {build} from 'esbuild';
assert.ok(process.env.PLAYWRIGHT_MODULE&&process.env.AXE_MODULE_PATH);
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
const dashboard=fileURLToPath(new URL('../',import.meta.url)),output=resolve(process.env.QA_OUTPUT||'artifacts/passport-editing-browser');await mkdir(output,{recursive:true});
const fixture=`import{mountPassportStudio}from'./src/components/passport-studio/passport-studio-view';import{StudioRequestError}from'./src/lib/passport-studio-transport';import{studioFixture}from'./tests/passport-studio-fixtures.mjs';
let current=studioFixture(window.__setup?.role||'editor');if(window.__setup?.patch)Object.assign(current,window.__setup.patch);const receipts=new Map();window.qa={mode:'ready',calls:[],snapshot:()=>structuredClone(current)};
async function send(command){window.qa.calls.push(structuredClone(command));const mode=window.qa.mode;if(mode==='denied')throw new StudioRequestError('studio_permission_denied',false);if(mode==='conflict')throw new StudioRequestError('studio_revision_conflict',false);if(mode==='unavailable')throw new StudioRequestError('studio_outcome_unknown',true);if(mode==='pending')await new Promise(r=>window.qa.release=r);
const receipt=receipts.get(command.operationId);if(receipt)return{...structuredClone(receipt),receipt:{...receipt.receipt,replayed:true}};
const next=structuredClone(current);next.draft.revision++;next.draft.contentDigest=String(next.draft.revision).padStart(64,'a');if(command.document)next.draft.document=structuredClone(command.document);next.draft.state={save:'draft',submit:'in_review',request_changes:'changes_requested',approve:'approved',publish:'published',reopen:'draft'}[command.action];if(command.action==='publish')next.published={version:current.published.version+1,contentDigest:next.draft.contentDigest,document:structuredClone(next.draft.document)};
const reply={snapshot:next,receipt:{id:crypto.randomUUID(),operationId:command.operationId,action:command.action,committed:true,replayed:false}};current=next;receipts.set(command.operationId,structuredClone(reply));if(mode==='lost')throw new StudioRequestError('studio_outcome_unknown',true);return reply;}
window.studio=mountPassportStudio(document.getElementById('app'),{initial:current,send});`;
const bundle=await build({stdin:{contents:fixture,loader:'ts',resolveDir:dashboard},bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',logLevel:'silent'});
const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).contents,css=await readFile(join(dashboard,'src/components/passport-studio/passport-studio.css'),'utf8');
const server=createServer((req,res)=>{const u=new URL(req.url,'http://qa.invalid');if(req.method!=='GET'){res.writeHead(405);return res.end();}if(u.pathname==='/fixture.js'){res.setHeader('content-type','text/javascript');return res.end(js);}if(u.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}if(u.pathname!=='/'){res.writeHead(404);return res.end();}const dark=u.searchParams.get('theme')==='dark';res.setHeader('content-type','text/html;charset=utf-8');res.end(`<!doctype html><html lang="es-AR" data-theme="${dark?'dark':'light'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Passport Studio · QA local</title><style>${css}body{margin:0;padding:16px;font-family:system-ui;background:${dark?'#05101b':'#edf3f7'}}#app,.qa-note{max-width:1400px;margin:auto}.qa-note{margin-bottom:16px;font-size:12px;color:${dark?'#c0d6e6':'#314b5a'}}</style></head><body><aside class="qa-note">QA local: contenido sintético y respuestas en memoria. No modifica pasaportes de clientes.</aside><div id="app"></div><script src="/fixture.js"></script></body></html>`);});
await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const report={actualPresenter:true,syntheticSessions:true,inMemoryReplies:true,productionData:false,checks:[],views:[],clientErrors:[],unexpectedRequests:[]};
const check=(v,name)=>report.checks.push({name,passed:Boolean(v)});
const tick=p=>p.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
async function scenario(width=390,theme='light',setup={}){const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce',serviceWorkers:'block',locale:'es-AR'}),page=await context.newPage();page.setDefaultTimeout(7000);await page.addInitScript(v=>window.__setup=v,setup);page.on('pageerror',e=>report.clientErrors.push(e.message));await page.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.origin===origin&&r.method()==='GET'&&['/','/fixture.js','/favicon.ico'].includes(u.pathname))return route.continue();report.unexpectedRequests.push(r.method()+' '+u.pathname);return route.abort();});await page.goto(origin+'/?theme='+theme);await page.getByRole('heading',{name:'Passport Studio',exact:true}).waitFor();return{context,page,width,theme};}
async function confirm(page,label){await page.getByRole('button',{name:label,exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true}).click();await page.waitForFunction(()=>!window.studio.getState().busy);await tick(page);}
async function inspect(t,name){await t.page.addScriptTag({content:axe});const violations=await t.page.evaluate(async()=>(await axe.run('.ps-root',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})));check(!violations.length,name+' axe '+t.width+' '+t.theme);check(await t.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' viewport '+t.width+' '+t.theme);const file=`${name}-${t.width}-${t.theme}.png`;await t.page.screenshot({path:join(output,file),fullPage:true});report.views.push({name,width:t.width,theme:t.theme,file,violations});}
try{
 const fields=await scenario();const name=fields.page.getByRole('textbox',{name:'Nombre del producto',exact:false});await name.fill('');
 check(await name.getAttribute('aria-invalid')==='true','Missing name is exposed on the actual field, not only a disabled submit');
 check(await fields.page.locator('[data-field-feedback="identity.product_name"]').count()===1,'Visible field correction exists next to the name');
 await name.fill('Semilla nueva');check((await fields.page.locator('#ps-identity-product_name-help').textContent())?.includes('13 / 160'),'Character guidance updates during typing');
 check(await fields.page.locator('[data-slot="editing-guidance"]').count()===1,'Next step and saved/local distinction are available while editing');await fields.context.close();
 const lost=await scenario();await lost.page.getByRole('textbox',{name:'Nombre del producto',exact:false}).fill('Edición conservada');await lost.page.evaluate(()=>window.qa.mode='lost');await confirm(lost.page,'Guardar borrador');
 check(await lost.page.evaluate(()=>window.studio.getState().uncertain),'Lost response does not claim successful saving');
 await lost.page.evaluate(()=>window.qa.mode='denied');await lost.page.getByRole('button',{name:'Reintentar el mismo intento',exact:true}).click();await lost.page.waitForFunction(()=>!window.studio.getState().busy);
 check(await lost.page.evaluate(()=>window.studio.getState().uncertain),'Denial after uncertainty preserves the unresolved operation');
 check(await lost.page.getByRole('button',{name:'Guardar borrador',exact:true}).isDisabled(),'A later denial cannot enable a new competing save');
 await lost.context.close();
 for(const theme of ['light','dark'])for(const width of [320,390,768,1440]){
  const t=await scenario(width,theme),name=t.page.getByRole('textbox',{name:'Nombre del producto',exact:false});const initial=await t.page.evaluate(()=>window.qa.snapshot());
  check((await t.page.locator('[data-slot="local-changes"]').textContent()).includes('Sin cambios locales'),'Initial draft is not confused with published differences '+width+' '+theme);
  await name.fill('');await t.page.getByRole('textbox',{name:'Imagen del producto',exact:false}).fill('http://example.invalid/product.png');
  check(await name.getAttribute('aria-invalid')==='true','Required field is invalid '+width+' '+theme);await t.page.locator('[data-field-checks] summary').click();
  check(await t.page.locator('.ps-issue-jump').count()===2,'Checklist counts actual invalid fields '+width+' '+theme);await inspect(t,'field-corrections');
  await t.page.locator('.ps-issue-jump[data-error-field="identity.product_name"]').click();check(await name.evaluate(n=>document.activeElement===n),'Correction focuses the actual input '+width+' '+theme);
  await name.fill('Semilla corregida');await t.page.getByRole('textbox',{name:'Imagen del producto',exact:false}).fill('');
  check(await name.getAttribute('aria-invalid')==='false','Correcting removes field error '+width+' '+theme);
  check((await t.page.locator('[data-slot="local-changes"]').textContent()).startsWith('1 campo diferente'),'Local counter measures one real content field '+width+' '+theme);
  check(await t.page.evaluate(()=>window.qa.calls.length)===0,'Edits and correction navigation do not write '+width+' '+theme);
  await t.page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await t.page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();check(await t.page.evaluate(()=>window.qa.calls.length)===0,'Cancelling confirmation does not save '+width+' '+theme);
  await confirm(t.page,'Guardar borrador');check(await t.page.evaluate(()=>window.studio.getState().snapshot.draft.revision)===initial.draft.revision+1,'Receipt advances the saved revision '+width+' '+theme);
  check((await t.page.locator('[data-slot="local-changes"]').textContent()).includes('Sin cambios locales'),'Receipt resets local-difference count '+width+' '+theme);
  check(await t.page.evaluate(()=>window.qa.snapshot().published.document.identity.product_name)===initial.published.document.identity.product_name,'Draft save never publishes '+width+' '+theme);await inspect(t,'saved-draft');await t.context.close();
 }
 {
  const t=await scenario(390,'dark');await t.page.getByRole('button',{name:'Documentos',exact:true}).click();await t.page.getByRole('textbox',{name:'Ficha técnica',exact:true}).fill('not-a-url');await t.page.getByRole('button',{name:'Identidad',exact:true}).click();
  await t.page.locator('[data-field-checks] summary').click();await t.page.locator('.ps-issue-jump[data-error-field="agro_product_profile.technicalSheetUrl"]').click();
  check(await t.page.getByRole('textbox',{name:'Ficha técnica',exact:true}).evaluate(n=>document.activeElement===n),'Cross-section correction opens Documents and focuses the target');
  await t.page.getByRole('textbox',{name:'Ficha técnica',exact:true}).fill('');check(await t.page.getByRole('textbox',{name:'Ficha técnica',exact:true}).getAttribute('aria-invalid')==='false','Missing optional sheet is a notice, not an invalid URL');
  check((await t.page.locator('[data-field-checks] summary').textContent()).includes('1 aviso'),'An optional missing sheet has explicit notice count');check(await t.page.evaluate(()=>window.qa.calls.length)===0,'Warning navigation makes no network request');await inspect(t,'document-notice');await t.context.close();
 }
 {
  const t=await scenario(390,'dark');await t.page.getByRole('textbox',{name:'Nombre del producto',exact:false}).fill('Respuesta perdida');await t.page.evaluate(()=>window.qa.mode='lost');await confirm(t.page,'Guardar borrador');
  const first=await t.page.evaluate(()=>window.qa.calls[0]);for(const mode of ['denied','unavailable','conflict']){await t.page.evaluate(mode=>window.qa.mode=mode,mode);await t.page.getByRole('button',{name:'Reintentar el mismo intento'}).click();await t.page.waitForFunction(()=>!window.studio.getState().busy);check(await t.page.evaluate(()=>window.studio.getState().uncertain),'Uncertainty persists after '+mode);check(await t.page.getByRole('textbox',{name:'Nombre del producto',exact:false}).isDisabled(),'Uncertain '+mode+' never enables another edit');}
  await inspect(t,'unresolved-receipt');await t.page.evaluate(()=>window.qa.mode='ready');await t.page.getByRole('button',{name:'Reintentar el mismo intento'}).click();await t.page.waitForFunction(()=>!window.studio.getState().busy);
  check(await t.page.evaluate(()=>!window.studio.getState().uncertain),'Only a matching receipt resolves uncertainty');check(await t.page.evaluate(()=>new Set(window.qa.calls.map(c=>c.operationId)).size)===1,'Repeated checks keep one operation identity');check(await t.page.evaluate(first=>window.qa.calls.every(c=>JSON.stringify(c)===JSON.stringify(first)),first),'Retry preserves the exact original payload');await t.context.close();
 }

 for(const role of ['reviewer','publisher','viewer']){
  const t=await scenario(390,'light',{role});
  check(await t.page.getByRole('textbox',{name:'Nombre del producto',exact:false}).isDisabled(),'Existing edit restriction retained for '+role);
  check(await t.page.getByRole('button',{name:'Guardar borrador',exact:true}).isDisabled(),'Existing save restriction retained for '+role);
  check(await t.page.evaluate(()=>window.qa.calls.length)===0,'Opening '+role+' starts no operation');
  await inspect(t,role+'-guidance');await t.context.close();
 }
 {
  const t=await scenario(390,'dark',{role:'reviewer',patch:{actorId:'qa_editor'}});
  check(!await t.page.getByRole('button',{name:'Aprobar contenido',exact:true}).count(),'Author remains unable to approve this revision');
  check((await t.page.locator('[data-slot="editing-guidance"]').textContent()).includes('Revisión independiente pendiente'),'Self-review restriction is explained');await t.context.close();
 }
 {
  const t=await scenario(320,'dark',{patch:{scope:{tenantId:'10000000-0000-4000-8000-000000000001',batchId:'20000000-0000-4000-8000-000000000001',bid:'B'.repeat(160),tenantLabel:'E'.repeat(180)}}});
  await inspect(t,'long-scope');await t.context.close();
 }
 check(!report.clientErrors.length,'No browser exceptions');check(!report.unexpectedRequests.length,'No unexpected or external calls');
}finally{await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(done=>server.close(done));}
console.log(JSON.stringify({checks:report.checks.length,failed:report.checks.filter(c=>!c.passed),views:report.views.length,output},null,2));assert.ok(report.checks.every(c=>c.passed));
