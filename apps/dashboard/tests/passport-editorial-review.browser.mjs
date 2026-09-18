// Isolated read-only view test; does not connect to a server, a database or Vercel.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile,mkdtemp} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {editorialReviewFixture,EXPECTED_SCOPE} from './passport-editorial-review-fixtures.mjs';
const require=createRequire(import.meta.url);
const moduleRef=value=>isAbsolute(value)?pathToFileURL(value).href:value;
const {default:ts}=await import(moduleRef(process.env.TYPESCRIPT_MODULE||'typescript'));
assert.ok(process.env.PLAYWRIGHT_MODULE,'Provide the already installed Playwright module path');
const {chromium}=await import(moduleRef(process.env.PLAYWRIGHT_MODULE));
const reactDir=process.env.REVIEW_QA_REACT_DIR||dirname(require.resolve('react/package.json'));
const domDir=process.env.REVIEW_QA_REACT_DOM_DIR||dirname(require.resolve('react-dom/package.json'));
const reactVersion=JSON.parse(await readFile(join(reactDir,'package.json'),'utf8')).version;
const domVersion=JSON.parse(await readFile(join(domDir,'package.json'),'utf8')).version;
assert.equal(reactVersion.split('.').slice(0,2).join('.'),domVersion.split('.').slice(0,2).join('.'),'Renderer major/minor versions must match');
const react=await readFile(join(reactDir,'umd/react.production.min.js'),'utf8');
const reactDom=await readFile(join(domDir,'umd/react-dom.production.min.js'),'utf8');
const out=process.env.QA_OUTPUT||await mkdtemp(join(tmpdir(),'nexid-editorial-review-'));await mkdir(out,{recursive:true});
const report={localSynthetic:true,reactVersion,reactDomVersion:domVersion,typeScriptVersion:ts.version,fullApplicationBuild:false,applicationRuntimeCertified:false,cases:[]};
let bundle='const modules={};\n';
for(const [name,path] of Object.entries({model:'../src/lib/passport-editorial-review.ts',view:'../src/components/passport-editorial-review.tsx'})){
 const source=await readFile(new URL(path,import.meta.url),'utf8');
 const result=ts.transpileModule(source,{fileName:path,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019,esModuleInterop:true}});
 assert.equal(result.diagnostics?.length||0,0,'Source must transpile without diagnostics');
 bundle+=`modules[${JSON.stringify(name)}]=function(exports,require){${result.outputText}};\n`;
}
bundle+=`const cache={};function load(id){if(id==='react')return window.React;if(id.endsWith('.css'))return {__esModule:true,default:new Proxy({}, {get:(_,key)=>String(key)})};if(id.includes('lib/passport-editorial-review'))id='model';if(cache[id])return cache[id];const m={};cache[id]=m;modules[id](m,load);return m;}
const model=load('model'),View=load('view').PassportEditorialReview;
window.qaSource=${JSON.stringify(editorialReviewFixture())};window.qaScope=${JSON.stringify(EXPECTED_SCOPE)};window.qaFields=model.REVIEW_FIELDS.length;
window.renderReview=(input=qaSource,authority=qaScope)=>{try{const view=model.buildEditorialReview(input,authority);ReactDOM.render(React.createElement(View,{model:view}),document.getElementById('app'));return {ok:true};}catch(e){ReactDOM.render(React.createElement('p',{role:'alert'},'Comparación no disponible: '+e.code),document.getElementById('app'));return {ok:false,code:e.code};}};window.renderReview();`;
// CSS Modules names are kept unchanged in this compatibility harness; selectors remain scoped.
const css=(await readFile(new URL('../src/components/passport-editorial-review.module.css',import.meta.url),'utf8')).replace(/:global\(([^)]+)\)/g,'$1');
const html='<!doctype html><html lang="es-AR" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QA local · revisión editorial</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;background:#f4f8fb}html[data-theme=dark] body{background:#071523}#app{max-width:1400px;padding:28px 32px 40px;margin:auto}button,input,select{font:inherit}@media(max-width:800px){#app{padding:20px 16px}}</style></head><body><div id="app"></div></body></html>';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:process.env.QA_NO_SANDBOX==='1'?['--no-sandbox']:[]});
try{
 for(const [width,theme] of [[1440,'light'],[1440,'dark'],[390,'light'],[390,'dark']]){
  const context=await browser.newContext({viewport:{width,height:width>800?1000:844},reducedMotion:'reduce',acceptDownloads:true,serviceWorkers:'block'});
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{requests.push({method:route.request().method(),url:route.request().url()});return route.abort();});
  await page.setContent(html);await page.addStyleTag({content:css});
  for(const content of [react,reactDom,bundle])await page.addScriptTag({content});
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await page.getByRole('heading',{name:'Revisar antes de publicar.',exact:true}).waitFor();
  assert.equal(await page.locator('article[data-field]').count(),8);
  assert.equal(await page.locator('img').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.getByRole('searchbox',{name:'Buscar en los cambios'}).fill('ficha-v1.pdf');
  assert.equal(await page.locator('article[data-field]').count(),1);
  assert.match(await page.locator('article[data-field]').innerText(),/ficha-v2.pdf/);
  await page.getByRole('searchbox',{name:'Buscar en los cambios'}).fill('unmatched');
  await page.getByRole('heading',{name:'Sin coincidencias en este filtro.'}).waitFor();
  await page.getByRole('button',{name:'Restablecer filtros'}).click();
  await page.getByLabel('Sección',{exact:true}).selectOption('documents');assert.equal(await page.locator('article[data-field]').count(),3);
  await page.getByLabel('Sección',{exact:true}).selectOption('all');
  await page.getByRole('checkbox',{name:'Solo cambios'}).uncheck();assert.equal(await page.locator('article[data-field]').count(),await page.evaluate(()=>qaFields));
  await page.getByRole('checkbox',{name:'Solo cambios'}).check();
  await page.getByRole('searchbox',{name:'Buscar en los cambios'}).focus();await page.keyboard.press('Tab');
  assert.ok(await page.getByLabel('Sección',{exact:true}).evaluate(el=>el===document.activeElement));
  if(width<=800){await page.getByRole('button',{name:'Vista móvil',exact:true}).click();assert.ok(await page.getByRole('complementary',{name:'Vista móvil del borrador'}).isVisible());assert.equal(await page.getByRole('searchbox',{name:'Buscar en los cambios'}).isVisible(),false);await page.screenshot({path:join(out,`preview-${theme}.png`),fullPage:true});await page.getByRole('button',{name:'Comparación',exact:true}).click();}
  await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0);});
  await page.screenshot({path:join(out,`comparison-${width}-${theme}.png`),fullPage:true});
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar comparación JSON',exact:true}).click();const download=await pending;
  const exported=join(out,`report-${width}-${theme}.json`);await download.saveAs(exported);const data=JSON.parse(await readFile(exported,'utf8'));
  assert.equal(data.applied,false);assert.equal(data.proofOfApproval,false);assert.equal(data.fields.length,8);assert.equal('tenantId' in data,false);assert.equal('batchId' in data,false);
  await page.getByRole('searchbox',{name:'Buscar en los cambios'}).fill('old-filter');
  const reset=await page.evaluate(()=>{const input=JSON.parse(JSON.stringify(qaSource));input.revision++;input.tenantId='30000000-0000-4000-8000-000000000003';return renderReview(input,{...qaScope,tenantId:input.tenantId,canExport:false});});
  assert.equal(reset.ok,true);assert.equal(await page.getByRole('searchbox',{name:'Buscar en los cambios'}).inputValue(),'');assert.equal(await page.getByRole('button',{name:'Descargar comparación JSON',exact:true}).count(),0);
  await page.evaluate(()=>{const input=JSON.parse(JSON.stringify(qaSource));input.revision+=2;input.candidate.identity.product_name='<img src="https://example.invalid/pixel" onerror="window.injected=true">';return renderReview(input,qaScope);});
  assert.equal(await page.locator('img').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);
  const rejected=await page.evaluate(()=>renderReview(qaSource,{...qaScope,tenantId:'40000000-0000-4000-8000-000000000004'}));assert.equal(rejected.code,'review_scope_forbidden');await page.getByRole('alert').waitFor();
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  report.cases.push({width,theme,searchAndFilters:true,referenceAndDraft:true,keyboard:true,scopedReset:true,literalText:true,comparisonExport:true,noExternalRequests:true,noWrites:true,noOverflow:true});
  await context.close();
 }
 report.status='passed';
}catch(error){report.status='failed';report.error=error.stack;throw error;}
finally{await writeFile(join(out,'browser-report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report,null,2));}
