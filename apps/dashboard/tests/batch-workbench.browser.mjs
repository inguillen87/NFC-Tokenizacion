import assert from 'node:assert/strict';import {mkdir,readFile,writeFile} from 'node:fs/promises';import {pathToFileURL} from 'node:url';import {join} from 'node:path';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');const base='http://localhost:3146',api='http://127.0.0.1:4197',out=process.env.QA_OUTPUT;await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH}),report={localOnly:true,syntheticData:true,visual:[],errors:[]};
const state=async()=>await(await fetch(api+'/qa-state')).json();
async function open(token='workbench-qa-admin',width=1440){const c=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',reducedMotion:'reduce'});await c.addCookies([{name:'nexid_dashboard_session',value:token,url:base,httpOnly:true,sameSite:'Lax'}]);const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());await p.goto(base+'/batches',{waitUntil:'load',timeout:90000});return {c,p};}
try{
 await fetch(api+'/qa-reset',{method:'POST'});
 for(const [width,theme] of [[1440,'dark'],[1440,'light'],[390,'dark'],[390,'light']]){
  const {c,p}=await open('workbench-qa-admin',width);await p.getByRole('heading',{name:'Lotes de trabajo',exact:true}).waitFor();assert.equal(new URL(p.url()).pathname,'/batches');
  await p.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.documentElement.classList.toggle('theme-light',theme==='light');document.documentElement.classList.toggle('theme-dark',theme==='dark');},theme);
  await p.getByRole('link',{name:'Configurar producto',exact:true}).waitFor();assert.match(await p.locator('[data-testid="batch-workbench"]:visible').innerText(),/20\s*registradas/);
  const before=(await state()).lists;await p.getByRole('searchbox').fill('No coincide');await p.locator('[data-testid="batches-empty"]:visible').waitFor();await p.getByRole('button',{name:'Limpiar filtros'}).click();assert.equal((await state()).lists,before);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow');await p.addScriptTag({content:axe});const violations=await p.evaluate(async()=>{const r=await axe.run('[data-testid="batch-workbench"]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact}));});assert.deepEqual(violations.filter(v=>v.impact==='serious'||v.impact==='critical'),[]);await p.screenshot({path:join(out,`list-${width}-${theme}.png`),fullPage:true});report.visual.push({width,theme,violations});
  if(width===1440&&theme==='dark'){
   await p.getByRole('link',{name:'Configurar producto',exact:true}).click();await p.locator('[data-testid="roll-product-identity"]:visible').waitFor();assert.equal(new URL(p.url()).hash,'#dossier-product');
   const form=p.locator('[data-testid="roll-product-identity"]:visible');await form.getByRole('textbox',{name:'Nombre del producto',exact:true}).fill('Edición local comprobada');await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Guardar ficha del rollo',exact:true}).click();await form.getByRole('status').filter({hasText:'Ficha guardada'}).waitFor();assert.deepEqual((await state()).patches,[{product_name:'Edición local comprobada'}]);
   await p.reload({waitUntil:'load'});await p.getByRole('tab',{name:'Producto',exact:true}).click();assert.equal(await p.locator('[data-testid="roll-product-identity"]:visible').getByRole('textbox',{name:'Nombre del producto',exact:true}).inputValue(),'Edición local comprobada');report.editReloadPassed=true;
  }
  await c.close();
 }
 const create=await open();await create.p.getByRole('link',{name:'Pedido a fábrica',exact:true}).click();
 await create.p.getByRole('heading',{name:'Pedido de tags listo para fábrica',exact:true}).waitFor();
 const company=create.p.getByRole('textbox',{name:'Empresa (identificador)',exact:true});assert.equal(await company.inputValue(),'qa-company');assert.equal(await company.isDisabled(),true);
 assert.equal((await state()).patches.length,1);report.factoryFormDirectWithoutCreation=true;await create.c.close();
 const denied=await open('workbench-qa-denied');await denied.p.locator('[data-testid="batches-access-denied"]:visible').waitFor();assert.equal(new URL(denied.p.url()).pathname,'/batches');report.explicitDenyNoRedirect=true;await denied.c.close();
 for(const mode of ['unavailable','foreign','empty']){await fetch(api+'/qa-mode?mode='+mode,{method:'POST'});const {c,p}=await open();await p.locator('[data-testid="'+(mode==='empty'?'batches-empty':'batches-source-unavailable')+'"]:visible').waitFor();assert.equal(await p.getByRole('link',{name:'Configurar producto',exact:true}).count(),0);await c.close();}report.failuresNotZero=true;assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.error=error.stack;const p=browser.contexts().at(-1)?.pages().at(-1);if(p){report.text=(await p.locator('body').innerText()).slice(-7000);await p.screenshot({path:join(out,'failure.png'),fullPage:true}).catch(()=>{});}throw error;}
finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
