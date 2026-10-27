import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build,stop} from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import {customerInboxCopy} from '../src/lib/customer-inbox-copy.ts';
import {dataTableCopy} from '../src/lib/data-table-copy.ts';

assert(process.env.PLAYWRIGHT_MODULE&&process.env.CHROME_PATH&&process.env.AXE_MODULE_PATH&&process.env.QA_OUTPUT,'Use installed explicit tools; this test never installs dependencies');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
const app=fileURLToPath(new URL('../',import.meta.url)),root=resolve(app,'../..'),output=resolve(process.env.QA_OUTPUT);
const sourcePaths=['src/components/data-table.tsx','src/app/(app)/leads-tickets/leads-tickets-client.tsx','src/lib/customer-inbox-copy.ts','src/lib/data-table-copy.ts','tests/customer-activity-summary.browser.mjs'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashes=async()=>Object.fromEntries(await Promise.all(sourcePaths.map(async file=>[file,hash(await readFile(join(app,file)))])));
const before=await hashes(),original=await readFile(join(app,'tests/customer-activity-summary.browser.mjs'),'utf8');
let fixture=original.match(/const fixture = `([\s\S]*?)`;/)?.[1];assert(fixture,'Reuse the existing tenant-confirmed synthetic CRM fixture');
fixture='import {DataTable} from "./src/components/data-table";\n'+fixture;
fixture=fixture.replace("source:'email',notes:'assistant mentioned in user text'","source:'email',company:'Empresa QA Tres <& \"final\">',notes:'assistant mentioned in user text'");
fixture=fixture.replace("detail:'Sin operación productiva'","detail:'Sin operación productiva <& \"detalle\">'");
fixture=fixture.replace("product_title:'Reserva de ensayo'","product_title:'Reserva de ensayo <& \"caja\">'");
fixture=fixture.replace("consumer_message:'Consulta por caja de regalo'","consumer_message:'=1+1 <& \"QA\">'");
fixture=fixture.replace('filteredOpportunities={[]}',`filteredOpportunities={scenario==='empty'?[]:[{tenant:'qa-only',session:'qa-one',interest:'Interes QA Uno',source:'assistant',lead:leads[0]},{tenant:'qa-only',session:'qa-two',interest:'Interes QA Dos <& "regalo">',source:'email',lead:leads[2]},{tenant:'foreign-company',session:'foreign',interest:'Foreign QA must not appear',source:'email',lead:{...leads[0],id:'foreign-lead',tenant_slug:'foreign-company'}}]}`);
fixture=fixture.replace('</main>;','<section data-testid="default-table"><DataTable title="Default QA" columns={[{key:"name",label:"Name"},{key:"status",label:"Status"}]} rows={[{name:"One QA",status:"open"},{name:"Two QA",status:"closed"}]} filterKey="status" loadingLabel="Loading QA" emptyLabel="Empty source QA" refreshDisabled={true}/></section></main>;');
const navigation="const router={refresh(){window.__qaRefreshes=(window.__qaRefreshes||0)+1},push(){throw Error('Unexpected navigation')},replace(){throw Error('Unexpected navigation')}};export const useRouter=()=>router;export const usePathname=()=>'/leads-tickets';export const useSearchParams=()=>new URLSearchParams(location.search);";
const report={schema:'nexid.crm-general-filter-recovery.v1',localOnly:true,syntheticData:true,actualComponents:['LeadsTicketsClient','DataTable'],fixtureBasedOn:'customer-activity-summary.browser.mjs',navigationStubbed:true,realNextServer:false,realTenantData:false,authentication:false,database:false,providerMutations:0,downloadBlobsIntercepted:true,sourceBefore:before,sourceAfter:null,checks:[],views:[],errors:[],blockedRequests:[],fetchCalls:0,gpsCalls:0,closure:{browser:false,server:false,esbuild:false},passed:false};
const check=(condition,name)=>{report.checks.push({name,passed:Boolean(condition)});assert(condition,name);};
const count=(copy,visible,total)=>copy.countLabel.replaceAll('{visible}',String(visible)).replaceAll('{total}',String(total));
function csvRows(value){const rows=[];let row=[],field='',quoted=false;for(let i=0;i<value.length;i++){const c=value[i];if(c==='"'){if(quoted&&value[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if(c==='\n'&&!quoted){row.push(field);rows.push(row);row=[];field='';}else field+=c;}if(field||row.length){row.push(field);rows.push(row);}assert(!quoted,'CSV quotes must close');return rows;}
// Explicit fixture projection: exported statuses retain source codes, regardless
// of a localized statusMap badge. Identity cells include CSV/HTML punctuation.
const exportIdentity={
 opportunities:{visible:'Interes QA Dos <& "regalo">',cells:{2:'qa-two',3:'Interes QA Dos <& "regalo">',5:'converted'}},
 prospects:{visible:'Empresa QA Tres <& "final">',cells:{2:'Empresa QA Tres <& "final">',4:'converted'}},
 tickets:{visible:'81000000-0000-8000-8000-000000000002',cells:{0:'81000000-0000-8000-8000-000000000002',4:'Sin operación productiva <& "detalle">',8:'PENDING'}},
 orders:{visible:'order-2',cells:{0:'order-2',2:'Reserva de ensayo <& "caja">',6:'requested',7:"'=1+1 <& \"QA\">"}},
};
let browser,server;
await mkdir(output,{recursive:true});
try{
 const bundle=await build({stdin:{contents:fixture,loader:'tsx',resolveDir:app},bundle:true,write:false,outfile:'fixture.js',format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},logLevel:'silent',plugins:[{name:'navigation-only',setup(builder){builder.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'qa'}));builder.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:navigation,loader:'js'}));}}]});
 const css=(await postcss([tailwindcss({content:[join(app,'src/**/*.{ts,tsx}').replaceAll('\\','/'),join(root,'packages/ui/src/**/*.{ts,tsx}').replaceAll('\\','/'),{raw:fixture,extension:'tsx'}],darkMode:['selector','[data-theme="dark"]'],theme:{extend:{colors:{brand:{dark:'#020617',card:'#0f172a',border:'#1e293b',cyan:'#06b6d4',blue:'#3b82f6'}}}},plugins:[]})]).process(await readFile(join(app,'src/app/globals.css'),'utf8'),{from:undefined})).css+(bundle.outputFiles.find(file=>file.path.endsWith('.css'))?.text||'');
 const js=bundle.outputFiles.find(file=>file.path.endsWith('.js')).contents;
 server=createServer((req,res)=>{if(req.method!=='GET'){res.writeHead(405);res.end();return;}const url=new URL(req.url,'http://fixture.invalid');if(url.pathname==='/fixture.js'){res.setHeader('content-type','text/javascript');res.end(js);return;}if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}if(url.pathname!=='/'){res.writeHead(404);res.end();return;}const theme=url.searchParams.get('theme')==='dark'?'dark':'light';res.setHeader('content-type','text/html;charset=utf-8');res.end('<!doctype html><html lang="'+(url.searchParams.get('locale')||'es-AR')+'" data-theme="'+theme+'" class="theme-'+theme+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CRM filter recovery · synthetic</title><style>'+css+'</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 for(const locale of ['es-AR','pt-BR','en'])for(const theme of ['light','dark'])for(const width of [390,1280]){
  const ui=customerInboxCopy[locale],copy=dataTableCopy[locale],context=await browser.newContext({viewport:{width,height:1000},locale,reducedMotion:'reduce',serviceWorkers:'block',acceptDownloads:false});
  try{
   await context.addInitScript(()=>{window.__filterQa={fetches:0,gps:0,downloads:[]};window.fetch=()=>{window.__filterQa.fetches++;return Promise.reject(Error('Unexpected synthetic transport'));};Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){window.__filterQa.gps++;throw Error('Unexpected GPS');},watchPosition(){window.__filterQa.gps++;throw Error('Unexpected GPS');}}});const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{const item={type:blob.type,text:null};window.__filterQa.downloads.push(item);blob.text().then(text=>item.text=text);return create(blob);};const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download)return;return click.call(this);};});
   const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>report.errors.push({locale,theme,width,message:error.message}));
   await page.route('**/*',route=>{const r=route.request(),url=new URL(r.url());if(url.origin!==origin||url.pathname.startsWith('/api/')||r.method()!=='GET'){report.blockedRequests.push({method:r.method(),path:url.pathname,external:url.origin!==origin});return route.abort();}return route.continue();});
   await page.goto(origin+'/?locale='+locale+'&theme='+theme,{waitUntil:'networkidle'});await page.getByTestId('customer-activity-summary').waitFor();const originalUrl=page.url(),general=page.getByRole('searchbox',{name:ui.search,exact:true});
   for(const [tab,total,partial,empty]of [['opportunities',2,'Interes QA Dos',ui.opportunityNoRecords],['prospects',3,'Empresa QA Tres',ui.prospectNoRecords],['tickets',2,'Consulta sintética',ui.ticketNoRecords],['orders',2,'Reserva de ensayo',ui.orderNoRecords]]){
    await page.getByRole('tab',{name:new RegExp('^'+ui[tab].replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).click();
    const table=page.locator('[role="tabpanel"] .data-table-card');await table.waitFor();const local=table.locator('input');
    await general.fill('zz-no-match-qa');await table.getByTestId('data-table-filtered-empty').waitFor();
    check(await table.locator('[role="status"]').textContent()===count(copy,0,total),tab+': contextual loaded denominator '+locale+'/'+theme+'/'+width);
    check(await table.getByTestId('data-table-source-empty').count()===0&&await table.getByTestId('data-table-filtered-empty').innerText().then(text=>text.includes(copy.filteredEmptyLabel)),tab+': localized no-match differs from empty source');
    const clear=table.getByTestId('data-table-filtered-empty').getByRole('button',{name:copy.clearFiltersLabel,exact:true});await clear.focus();await page.keyboard.press('Enter');
    check(await general.inputValue()===''&&await local.inputValue()===''&&await table.locator('select').inputValue()==='all'&&await local.evaluate(el=>el===document.activeElement),tab+': keyboard clears parent/local filters and keeps useful table focus');
    check(await table.locator('tbody tr').count()===total,tab+': all admitted rows recover');
    await general.fill(partial);await page.waitForFunction(()=>document.querySelector('[role="tabpanel"] tbody')?.children.length===1);
    check(await table.locator('[role="status"]').textContent()===count(copy,1,total),tab+': partial match keeps original admitted denominator');
    check((await table.locator('tbody tr').innerText()).includes(exportIdentity[tab].visible),tab+': expected unique projected identity is visible');
    await table.getByRole('button',{name:'CSV',exact:true}).click();await page.waitForFunction(()=>window.__filterQa.downloads.at(-1)?.text!==null);const csv=await page.evaluate(()=>window.__filterQa.downloads.at(-1).text);
    const parsedCsv=csvRows(csv);check(parsedCsv.length===2,tab+': CSV exports exactly one visible row');
    check(Object.entries(exportIdentity[tab].cells).every(([index,value])=>parsedCsv[1][Number(index)]===value),tab+': CSV preserves the visible fixture identity and raw status/formula contract');
    await table.getByRole('button',{name:'Excel',exact:true}).click();await page.waitForFunction(()=>window.__filterQa.downloads.at(-1)?.text!==null);const excel=await page.evaluate(()=>window.__filterQa.downloads.at(-1).text);
    check((excel.match(/<tr>/g)||[]).length===2,tab+': Excel exports exactly one visible row');
    const parsedExcel=await page.evaluate(html=>{const doc=new DOMParser().parseFromString(html,'text/html');return{rows:Array.from(doc.querySelectorAll('tbody tr')).map(row=>Array.from(row.querySelectorAll('td')).map(cell=>cell.textContent)),unsafeElements:doc.querySelectorAll('script,img,iframe').length};},excel);
    check(parsedExcel.rows.length===1&&parsedExcel.unsafeElements===0&&Object.entries(exportIdentity[tab].cells).every(([index,value])=>parsedExcel.rows[0][Number(index)]===value),tab+': Excel decodes escaped punctuation and preserves the visible identity/raw status/formula contract');
    await general.fill('zz-no-match-qa');await table.getByRole('button',{name:'CSV',exact:true}).click();await page.waitForFunction(()=>window.__filterQa.downloads.at(-1)?.text!==null);
    check(csvRows(await page.evaluate(()=>window.__filterQa.downloads.at(-1).text)).length===1,tab+': zero-match CSV contains only the header');
    await table.getByRole('button',{name:'Excel',exact:true}).click();await page.waitForFunction(()=>window.__filterQa.downloads.at(-1)?.text!==null);const emptyExcel=await page.evaluate(()=>window.__filterQa.downloads.at(-1).text);
    check(await page.evaluate(html=>new DOMParser().parseFromString(html,'text/html').querySelectorAll('tbody tr').length===0,emptyExcel),tab+': zero-match Excel contains no hidden source rows');
    await table.getByRole('button',{name:copy.clearFiltersLabel,exact:true}).first().click();
    await page.evaluate(()=>window.__qaSetActivityScenario('empty'));await table.getByTestId('data-table-source-empty').waitFor();await general.fill('zz-no-match-qa');
    check(await table.locator('[role="status"]').textContent()===count(copy,0,0)&&(await table.getByTestId('data-table-source-empty').innerText()).includes(empty)&&await table.getByTestId('data-table-filtered-empty').count()===0,tab+': genuine empty source stays truthful with active query');
    await table.getByRole('button',{name:copy.clearFiltersLabel,exact:true}).click();check(await general.inputValue()==='',tab+': active general search can still be cleared with empty source');
    await page.evaluate(()=>window.__qaSetActivityScenario('normal'));
   }
   await page.getByRole('tab',{name:new RegExp('^'+ui.prospects)}).click();const table=page.locator('[role="tabpanel"] .data-table-card'),local=table.locator('input');
   await table.locator('select').selectOption('converted');await local.fill('not-a-local-match');await general.fill('   ');await table.getByTestId('data-table-filtered-empty').waitFor();
   check(await table.locator('[role="status"]').textContent()===count(copy,0,3)&&await table.locator('select').inputValue()==='converted','Whitespace general filter and stale local status remain recoverable');
   await table.getByTestId('data-table-filtered-empty').getByRole('button',{name:copy.clearFiltersLabel,exact:true}).click();
   check(await general.inputValue()===''&&await local.inputValue()===''&&await table.locator('select').inputValue()==='all'&&await table.locator('tbody tr').count()===3,'Combined general/query/status clear restores admitted sample');
   for(const scenario of ['denied','foreign','malformed']){await page.evaluate(value=>window.__qaSetActivityScenario(value),scenario);await page.waitForFunction(()=>!document.querySelector('[role="tabpanel"] .data-table-card'));check(await page.locator('[role="tabpanel"] .data-table-card').count()===0,scenario+': unavailable or wrong-tenant source never gets a table denominator');}
   await page.evaluate(()=>window.__qaSetActivityScenario('normal'));await table.waitFor();await general.fill('zz-no-match-qa');await page.addScriptTag({content:axe});
   const violations=await table.evaluate(async element=>(await axe.run(element,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(row=>({id:row.id,impact:row.impact})));check(violations.length===0,'Filtered-empty table has no axe violations');
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');check(page.url()===originalUrl,'Recovery never changes scope/session URL');
   const defaultTable=page.getByTestId('default-table');await defaultTable.locator('input').fill('no-default-match');await defaultTable.getByTestId('data-table-filtered-empty').waitFor();await defaultTable.getByTestId('data-table-filtered-empty').getByRole('button').click();check(await defaultTable.locator('tbody tr').count()===2&&await defaultTable.locator('input').evaluate(el=>el===document.activeElement)&&await general.inputValue()==='zz-no-match-qa','Default table without external context preserves independent local recovery');check(await defaultTable.getByRole('button',{name:'Actualizar',exact:true}).isDisabled(),'Refresh lock remains independent from filter clearing');
   report.fetchCalls+=await page.evaluate(()=>window.__filterQa.fetches);report.gpsCalls+=await page.evaluate(()=>window.__filterQa.gps);await table.screenshot({path:join(output,'filter-empty-'+locale+'-'+theme+'-'+width+'.png')});report.views.push({locale,theme,width,violations});
  }finally{await context.close();}
 }
 report.sourceAfter=await hashes();check(JSON.stringify(before)===JSON.stringify(report.sourceAfter),'Runtime and existing fixture source bytes unchanged during QA');check(report.errors.length===0&&report.blockedRequests.length===0&&report.fetchCalls===0&&report.gpsCalls===0,'Zero application errors, outgoing writes/transports or GPS calls');report.passed=report.views.length===12&&report.checks.every(row=>row.passed);
}catch(error){report.error=String(error.stack||error);process.exitCode=1;}
finally{if(browser){await browser.close();report.closure.browser=true;}if(server){server.closeAllConnections();await new Promise(done=>server.close(done));report.closure.server=true;}stop();report.closure.esbuild=true;const file=join(output,'report.json');await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({file,sha256:hash(await readFile(file)),passed:report.passed,checks:report.checks.length,views:report.views.length,error:report.error}));if(!report.passed)process.exitCode=1;}
