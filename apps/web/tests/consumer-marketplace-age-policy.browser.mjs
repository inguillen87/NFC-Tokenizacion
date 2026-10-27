// Actual component + native CSS with synthetic props. This is not ActualNext,
// authentication, tenant synchronization or a real marketplace submission.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build,stop} from 'esbuild';

assert.ok(process.env.PLAYWRIGHT_MODULE&&process.env.CHROME_PATH&&process.env.AXE_MODULE_PATH&&process.env.QA_OUTPUT,'Use installed explicit browser tools and an external output directory');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
const web=fileURLToPath(new URL('../',import.meta.url)),root=resolve(web,'../..'),output=resolve(process.env.QA_OUTPUT);
const sourcePaths=['src/app/me/marketplace/marketplace-grid-client.tsx','src/app/me/marketplace/marketplace.module.css','src/app/me/marketplace/marketplace-request.ts','src/app/me/_components/portal-shell.module.css','tests/consumer-marketplace-age-policy.browser.mjs'];
const hash=value=>createHash('sha256').update(value).digest('hex');
const sourceHashes=async()=>Object.fromEntries(await Promise.all(sourcePaths.map(async file=>[file,hash(await readFile(join(web,file)))])));
const sourceBefore=await sourceHashes();
const observedHead=execFileSync('git',['--no-optional-locks','-C',root,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true,timeout:10000}).trim();
if(process.env.QA_SOURCE){assert.equal(process.env.QA_SOURCE,observedHead,'Explicit QA_SOURCE must name this committed candidate');assert.equal(execFileSync('git',['--no-optional-locks','-C',root,'status','--porcelain'],{encoding:'utf8',windowsHide:true,timeout:10000}).trim(),'','Exact-source QA requires a clean committed candidate');}
const id='80000000-0000-4000-8000-000000000001';
const entry=`import'tailwindcss/preflight.css';import React,{useState}from'react';import{createRoot}from'react-dom/client';import{MarketplaceGridClient}from'./src/app/me/marketplace/marketplace-grid-client';import portalStyles from'./src/app/me/_components/portal-shell.module.css';
const item={id:${JSON.stringify(id)},title:'Producto de ensayo QA',brand_name:'Marca sintética QA',vertical:'wine',status:'available',request_to_buy_enabled:true,price_amount:'1',price_currency:'USD'};
function Fixture(){const[age,setAge]=useState(true);window.__qaSetAgePolicy=setAge;return <div className={'consumer-portal-root '+portalStyles.portal}><main className={portalStyles.main}><div className={portalStyles.pageHeading}><h1>Confirmación de edad · QA local</h1><p>Datos sintéticos y componente real. No acredita sincronización ni operaciones de clientes.</p></div><MarketplaceGridClient items={[{...item,age_gate_required:age}]} postTapEventId='900001'/></main></div>};createRoot(document.getElementById('root')).render(<Fixture/>);`;
const bundle=await build({stdin:{contents:entry,loader:'tsx',resolveDir:web},bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},logLevel:'silent'});
const script=bundle.outputFiles.find(file=>file.path.endsWith('.js')).contents,css=(bundle.outputFiles.find(file=>file.path.endsWith('.css'))?.text||'')+'\nbody{margin:0;font-family:system-ui,sans-serif}';
const report={localOnly:true,actualComponent:'MarketplaceGridClient',nativeComponentAndPortalCss:true,actualTailwindPreflight:true,preflightCssSha256:hash(await readFile(join(root,'node_modules/tailwindcss/preflight.css'))),syntheticProps:true,syntheticTransport:true,actualNextServer:false,realAuthentication:false,realDatabase:false,realTenantSynchronization:false,physicalTapMeasured:false,qaSource:process.env.QA_SOURCE||null,observedHead,sourceBefore,sourceAfter:null,checks:[],cases:[],serverRequests:[],blockedRequests:[],errors:[],closure:{browser:false,server:false,esbuild:false},passed:false};
const server=createServer((req,res)=>{const url=new URL(req.url,'http://fixture.invalid');report.serverRequests.push({method:req.method,path:url.pathname});if(req.method!=='GET'){res.writeHead(405);return res.end();}if(url.pathname==='/fixture.js'){res.setHeader('content-type','text/javascript');return res.end(script);}if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}if(url.pathname!=='/'){res.writeHead(404);return res.end();}const theme=url.searchParams.get('theme')==='dark'?'dark':'light';res.setHeader('content-type','text/html;charset=utf-8');res.end('<!doctype html><html lang="es-AR" class="theme-'+theme+'" data-theme="'+theme+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirmación de edad · componente QA</title><style>'+css+'</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');});
const contexts=new Set();let browser,origin;
function check(value,description){report.checks.push({description,passed:Boolean(value)});assert.ok(value,description);}
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
await mkdir(output,{recursive:true});
try{
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 for(const width of [390,1280])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:1000},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'});contexts.add(context);const page=await context.newPage();page.setDefaultTimeout(10000);const requests=[];
  try{
   page.on('pageerror',error=>report.errors.push(error.message));
   await page.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(url.origin===origin&&request.method()==='POST'&&url.pathname==='/api/marketplace/products/'+id+'/request-to-buy'){requests.push({method:'POST',body:request.postDataJSON(),intercepted:true,providerFetch:false});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,request_mode:'request_only'})});}if(url.origin===origin&&request.method()==='GET'&&['/','/fixture.js','/favicon.ico'].includes(url.pathname))return route.continue();report.blockedRequests.push({method:request.method(),origin:url.origin,path:url.pathname});return route.abort();});
   await page.goto(origin+'/?theme='+theme,{waitUntil:'networkidle'});
   const card=page.locator('[data-marketplace-product="'+id+'"]'),list=page.getByRole('complementary',{name:'Lista de solicitudes'}),confirm=card.getByRole('button',{name:'Soy mayor de edad',exact:true}),cancel=card.getByRole('button',{name:'Cancelar',exact:true}),question=card.getByRole('heading',{level:4});
   const requestAction=card.getByRole('button',{name:'Solicitar contacto',exact:true});await requestAction.focus();await page.keyboard.press('Enter');await question.waitFor();await settle(page);
   check(await question.evaluate(el=>document.activeElement===el),`${width}/${theme} the initial product panel focuses its neutral question`);
   await page.keyboard.press('Tab');check(await confirm.evaluate(el=>document.activeElement===el),`${width}/${theme} affirmative action requires a distinct Tab`);await page.keyboard.press('Tab');check(await cancel.evaluate(el=>document.activeElement===el),`${width}/${theme} the next Tab selects cancellation`);await page.keyboard.press('Enter');await settle(page);
   check(await requestAction.evaluate(el=>document.activeElement===el)&&requests.length===0,`${width}/${theme} first cancellation seeds an old product initiator without accepting age or submitting`);
   await page.evaluate(()=>window.__qaSetAgePolicy(false));await card.getByText('Requiere confirmación de mayoría de edad.',{exact:true}).waitFor({state:'detached'});await card.getByRole('button',{name:'Agregar a la lista',exact:true}).click();
   check(await list.locator('span[aria-label="Cantidad"]').innerText()==='1'&&requests.length===0,`${width}/${theme} an ungated item enters only the local one-unit draft`);
   await page.evaluate(()=>window.__qaSetAgePolicy(true));await card.getByText('Requiere confirmación de mayoría de edad.',{exact:true}).waitFor();
   const checkout=list.getByRole('button',{name:'Enviar solicitudes',exact:true});await checkout.focus();await page.keyboard.press('Enter');await question.waitFor();await settle(page);
   check(await question.evaluate(el=>document.activeElement===el)&&requests.length===0,`${width}/${theme} a new policy opens a neutral confirmation before any request`);
   await page.keyboard.press('Tab');await page.keyboard.press('Tab');check(await cancel.evaluate(el=>document.activeElement===el),`${width}/${theme} cancellation is keyboard reachable from the policy question`);await page.keyboard.press('Enter');await settle(page);
   const active=await page.evaluate(()=>({tag:document.activeElement?.tagName,text:document.activeElement?.textContent?.trim()}));
   check(await checkout.evaluate(el=>document.activeElement===el),`${width}/${theme} cancel returns to the actual checkout initiator instead of the stale product button`);
   check(await list.locator('span[aria-label="Cantidad"]').innerText()==='1'&&await confirm.count()===0&&requests.length===0,`${width}/${theme} cancellation preserves quantity, requires confirmation again and sends zero POST`);
   const colors=await page.locator('.consumer-portal-root').evaluate(el=>({surface:getComputedStyle(el).getPropertyValue('--portal-surface').trim(),text:getComputedStyle(el).getPropertyValue('--portal-text').trim()}));
   check(colors.surface===(theme==='dark'?'#102737':'#ffffff'),`${width}/${theme} actual Portal CSS applies the selected color theme`);
   await page.addScriptTag({content:axe});const violations=await page.evaluate(async()=>(await axe.run('main',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})));
   check(violations.length===0,`${width}/${theme} zero axe violations after restoring focus`);check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}/${theme} no horizontal page overflow`);
   const screenshot='age-policy-cancel-'+width+'-'+theme+'.png';await page.screenshot({path:join(output,screenshot),fullPage:true});report.cases.push({width,theme,previousProductInitiator:true,policyUpdatedViaReactProps:true,actualFocus:active,expectedFocus:'Enviar solicitudes',quantity:1,requests,colors,violations,screenshot});
  }finally{await context.close();contexts.delete(context);}
 }
 report.sourceAfter=await sourceHashes();assert.deepEqual(report.sourceAfter,sourceBefore);check(report.errors.length===0&&report.blockedRequests.length===0,'No browser errors or unexpected requests');check(report.serverRequests.every(row=>row.method==='GET'),'No POST reaches even the local HTTP fixture');report.passed=true;
}catch(error){report.failure=String(error.stack||error);process.exitCode=1;}
finally{for(const context of contexts)await context.close();contexts.clear();if(browser){await browser.close();report.closure.browser=true;}server.closeAllConnections();if(server.listening)await new Promise(done=>server.close(done));report.closure.server=!server.listening;stop();report.closure.esbuild=true;report.completedAt=new Date().toISOString();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({report:join(output,'report.json'),passed:report.passed,checks:report.checks.length,cases:report.cases.length,failure:report.failure,closure:report.closure}));}
