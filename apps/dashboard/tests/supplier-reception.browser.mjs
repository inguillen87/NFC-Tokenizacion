// Real Next/BFF and read service against disposable PostgreSQL. Authentication principals are synthetic fixtures.
import assert from 'node:assert/strict';import {mkdir,readFile,writeFile} from 'node:fs/promises';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const base='http://localhost:3145',api='http://127.0.0.1:4193',out=process.env.QA_OUTPUT;assert.ok(out);
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const report={localOnly:true,realReadService:true,realPostgres:true,productionData:false,visual:[],roles:[]};
const state=async()=>await(await fetch(api+'/qa-state')).json();
async function setup(role,width=1440,query=''){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',reducedMotion:'reduce'});
 await context.addCookies([{name:'nexid_dashboard_session',value:'qa-reception-'+role,url:base,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage(),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{if(['POST','PATCH','DELETE'].includes(r.request().method())&&r.request().url().includes('/api/admin/'))writes.push(r.request().url());return ['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort();});
 await page.goto(base+'/batches/supplier'+query,{waitUntil:'load',timeout:90000});await page.getByRole('heading',{name:'Recepción de rollos.',exact:true}).waitFor();return {context,page,errors,writes};
}
try{
 await fetch(api+'/qa-mode?mode=ready',{method:'POST'});
 for(const [width,theme] of [[1440,'light'],[1440,'dark'],[390,'light'],[390,'dark']]){
  const item=await setup('super-admin',width);const p=item.page;
  await p.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.documentElement.classList.toggle('theme-light',theme==='light');document.documentElement.classList.toggle('theme-dark',theme==='dark');},theme);
  await p.getByRole('combobox',{name:'Empresa para esta recepción'}).selectOption('demo-client-qa');await p.getByRole('button',{name:'Consultar empresa',exact:true}).click();
  await p.getByRole('heading',{name:'Pedido de fábrica QA',exact:true}).waitFor();
  const root=p.getByTestId('supplier-reception-workspace');assert.match(await root.innerText(),/10 activas.*10 inactivas.*20 registradas/);
  const before=(await state()).calls.length;
  await p.getByRole('button',{name:'Roles y permisos',exact:true}).click();
  const matrix=p.getByTestId('reception-role-matrix');await p.getByRole('combobox',{name:'Comparar responsabilidades'}).selectOption('packaging-operator');
  assert.equal(await matrix.getByText('Permiso disponible',{exact:true}).count(),1);
  await p.getByRole('combobox',{name:'Comparar responsabilidades'}).selectOption('current');
  assert.equal(await matrix.getByText('Permiso disponible',{exact:true}).count(),7);
  assert.equal((await state()).calls.length,before,'Role comparison does not request server data');
  await p.screenshot({path:join(out,`roles-${width}-${theme}.png`),fullPage:true});
  await p.getByRole('button',{name:'Recepción y seguimiento',exact:true}).click();
  await p.getByRole('button',{name:'Abrir operación del pedido',exact:true}).click();
  await p.getByRole('heading',{name:'Pedido de tags listo para fábrica'}).waitFor();
  const company=p.getByRole('textbox',{name:'Empresa (identificador)',exact:true});assert.equal(await company.inputValue(),'demo-client-qa');assert.equal(await company.isDisabled(),true);
  await p.waitForTimeout(350);assert.equal((await state()).calls.length,before,'Selecting a preloaded order does not load QA, keys or vault');
  const notes=p.getByPlaceholder('Notas: region piloto, proveedor, empaque, requisitos de QC...');await notes.fill('Texto local conservado entre vistas');
  await p.getByRole('button',{name:'Roles y permisos',exact:true}).click();await p.getByRole('combobox',{name:'Comparar responsabilidades'}).selectOption('packaging-operator');
  await p.getByRole('button',{name:'Consola de operación',exact:true}).click();assert.equal(await notes.inputValue(),'Texto local conservado entre vistas');
  assert.equal(await company.isDisabled(),true);
  await p.getByRole('button',{name:'Recepción y seguimiento',exact:true}).click();
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');
  await p.addScriptTag({content:axe});const violations=await p.evaluate(async()=>{const r=await axe.run('[data-testid="supplier-reception-workspace"]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}));});
  await p.screenshot({path:join(out,`reception-${width}-${theme}.png`),fullPage:true});assert.deepEqual(violations.filter(v=>v.impact==='serious'||v.impact==='critical'),[]);assert.deepEqual(item.errors,[]);assert.deepEqual(item.writes,[]);
  report.visual.push({width,theme,activeVsInactive:true,comparisonWithoutImpersonation:true,scopeFixed:true,preservedForm:true,noBackgroundReads:true,noWrites:true,violations});await item.context.close();
 }
 for(const role of ['tenant-admin','operations-manager','packaging-operator','viewer']){
  const item=await setup(role);const p=item.page;await p.getByRole('heading',{name:'Pedido de fábrica QA',exact:true}).waitFor();assert.equal(await p.getByRole('combobox',{name:'Empresa para esta recepción'}).isDisabled(),true);
  assert.equal(await p.getByRole('link',{name:'Administrar empresas',exact:true}).count(),0);
  if(['packaging-operator','viewer'].includes(role))assert.equal(await p.getByRole('button',{name:'Preparar pedido',exact:false}).count(),0);
  await p.getByRole('button',{name:'Abrir operación del pedido',exact:true}).click();
  assert.equal(await p.getByRole('button',{name:'Exportar pack',exact:true}).first().isDisabled(),true);
  if(['packaging-operator','viewer'].includes(role))assert.equal(await p.getByRole('button',{name:'Crear Supplier Order',exact:true}).isDisabled(),true);
  assert.deepEqual(item.writes,[]);assert.deepEqual(item.errors,[]);report.roles.push({role,tenantLocked:true,noPlatformAdministration:true,noFactoryExport:true,noWrites:true});await item.context.close();
 }
 const cross=await fetch(api+'/admin/supplier-reception?tenant=other-tenant-qa',{headers:{authorization:'Bearer qa-reception-packaging-operator'}});assert.equal(cross.status,403);report.crossTenantDenied=true;
 const failure=await setup('super-admin',1440,'?tenant=demo-client-qa');await failure.page.getByRole('heading',{name:'Pedido de fábrica QA',exact:true}).waitFor();await fetch(api+'/qa-mode?mode=unavailable',{method:'POST'});await failure.page.getByRole('button',{name:'Consultar empresa',exact:true}).click();await failure.page.getByText('La fuente no está disponible; la consulta no confirma datos nuevos.',{exact:false}).waitFor();assert.equal(await failure.page.getByRole('heading',{name:'Pedido de fábrica QA',exact:true}).count(),0);report.sourceFailureClearsStaleData=true;await fetch(api+'/qa-mode?mode=ready',{method:'POST'});await failure.context.close();
 report.status='passed';report.calls=await state();
}catch(error){report.status='failed';report.error=error.stack;const p=browser.contexts().at(-1)?.pages().at(-1);if(p){report.visibleError=await p.locator('body').innerText();await p.screenshot({path:join(out,'failure.png'),fullPage:true}).catch(()=>{});}throw error;}
finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
