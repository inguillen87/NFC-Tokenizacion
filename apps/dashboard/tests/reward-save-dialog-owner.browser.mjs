// Real React/component/styles; synthetic props, router observer and owned loopback
// transports.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build,stop} from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

for(const key of ['PLAYWRIGHT_MODULE','CHROME_PATH','AXE_MODULE_PATH','QA_OUTPUT'])assert(process.env[key],key+' must name existing installed tools/new output');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
const app=fileURLToPath(new URL('../',import.meta.url)),root=resolve(app,'../..'),output=resolve(process.env.QA_OUTPUT);
assert(output!==root&&!output.startsWith(root+'/')&&!output.startsWith(root+'\\'),'output must be outside worktree');
const hash=b=>createHash('sha256').update(b).digest('hex');
const sourcePaths=['src/app/(app)/loyalty/rewards/rewards-client.tsx','src/lib/reward-reservation-notices.ts','src/components/reward-reservation-notice.tsx','src/components/reward-reservation-notice.module.css','src/app/globals.css','src/lib/permission-policy.ts','tests/reward-save-dialog-owner.browser.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(sourcePaths.map(async p=>[p,hash(await readFile(join(app,p)))])));
const before=await hashes(),observedHead=execFileSync('git',['--no-optional-locks','-C',root,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
if(process.env.QA_SOURCE){assert.equal(process.env.QA_SOURCE,observedHead);assert.equal(execFileSync('git',['--no-optional-locks','-C',root,'status','--porcelain'],{encoding:'utf8',windowsHide:true}).trim(),'');}
const REWARD='10000000-0000-4000-8000-000000000001',PROGRAM='20000000-0000-4000-8000-000000000001';
const DRAFT='20000000-0000-4000-8000-000000000002',PROGRAM_B='20000000-0000-4000-8000-000000000003',DRAFT_B='20000000-0000-4000-8000-000000000004';
function programConfiguration(tenant){
 return {ok:true,version:'admin-loyalty-program-options.v1',tenant,limit:100,truncated:false,programs:[
  {id:tenant==='qa-b'?PROGRAM_B:PROGRAM,name:'Programa activo QA',status:'active'},
  {id:tenant==='qa-b'?DRAFT_B:DRAFT,name:'Borrador reciente QA',status:'draft'},
 ]};
}
const row={id:REWARD,program_id:PROGRAM,tenant_slug:'qa-a',code:'EXISTING',title:'Beneficio guardado QA',points:40,status:'active',description:'Texto sintético',type:'TOUR',image_url:null,stock_total:12,stock_remaining:10,requires_age_gate:false,network_visible:false,reservation_requirements:{version:'portal-reservation-requirements.v1',program:{association_confirmed:true}}};
const globalTenants=['qa-a','empresa-global-'+ 's'.repeat(140)];
const globalRows=globalTenants.map((tenant,index)=>({...row,id:index?'10000000-0000-4000-8000-000000000002':REWARD,tenant_slug:tenant,title:'Beneficio compartido QA'}));
const entry=`import React,{useState}from'react';import{flushSync}from'react-dom';import{createRoot}from'react-dom/client';import RewardsClient from'./src/app/(app)/loyalty/rewards/rewards-client';
window.__rewardRefreshes=0;window.__rewardRequests=[];const realFetch=window.fetch.bind(window);window.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input.url,location.href),record={path:url.pathname,query:url.search,method:init?.method||'GET',cache:init?.cache,credentials:init?.credentials,hasBody:init?.body!==undefined,hasSignal:Boolean(init?.signal),headers:false,bodySettled:false};if(url.origin===location.origin&&url.pathname.startsWith('/api/'))window.__rewardRequests.push(record);return realFetch(input,init).then(response=>{record.headers=true;const json=response.json.bind(response);response.json=()=>json().finally(()=>{record.bodySettled=true});return response;});};
const initial=${JSON.stringify(row)},rowsA=new URLSearchParams(location.search).has('historical')?[{...initial,status:'archived',type:'SERVICE'},{...initial,id:'10000000-0000-4000-8000-000000000002',code:'S'.repeat(200),title:'Beneficio histórico QA',points:null,status:'legacy',type:null}]:[initial],rowsB=[{...initial,tenant_slug:'qa-b',title:'Beneficio de otra empresa QA'}];const reactRoot=createRoot(document.getElementById('root'));
function Fixture(){
 const [props,setProps]=useState({initialRewards:rowsA,tenantScope:'qa-a',catalogScope:'tenant',isDemo:false,canWrite:true,dataSource:'production',availability:'ready',sourceReason:'',explicitProgramSelection:true});
 window.__rewardChangeSource=kind=>flushSync(()=>setProps(old=>kind==='tenant'?{...old,tenantScope:'qa-b',initialRewards:rowsB}:kind==='permission'?{...old,canWrite:false}:{...old,dataSource:'unavailable',availability:'upstream_error',initialRewards:[]}));
 window.__rewardShowGlobal=(catalogScope,dataSource='production')=>flushSync(()=>setProps(old=>({...old,initialRewards:${JSON.stringify(globalRows)},tenantScope:'',catalogScope,isDemo:dataSource==='demo',canWrite:false,dataSource})));
 return <main className='dashboard-app mx-auto max-w-6xl p-4'><h1 className='text-2xl font-bold'>Beneficios · ensayo local</h1><p>Componentes reales, empresa y solicitudes sintéticas.</p><RewardsClient {...props}/></main>;
}
window.__rewardReopenSameTurn=()=>{const previous=document.querySelector('dialog'),close=previous.querySelector('[aria-label="Cerrar edición del beneficio"]'),create=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Nuevo Beneficio');flushSync(()=>{close.click();create.click()});window.__previousRewardDialog=previous;return previous===document.querySelector('dialog')};window.__rewardUnmount=()=>flushSync(()=>reactRoot.unmount());reactRoot.render(<Fixture/>);`;
const report={schema:'nexid.reward-save-dialog-owner.native.v1',passed:false,releaseAcceptanceEligible:false,actualReact:true,actualComponent:true,nativeComponentCss:true,syntheticShell:true,syntheticProps:true,syntheticTransport:true,routerObserverStub:true,actualNext:false,realAuthentication:false,realDatabase:false,realProvider:false,physicalTap:false,backendReadOnlyCertified:false,notes:['No initializer or business write is added by the client GET; existing live IAM initialization/last_seen side effects are outside this synthetic fixture.','Cancellation may stop delivery of an old response; direct unit callbacks separately cover post-unmount/pre-effect ownership.'],observedHead,qaSource:process.env.QA_SOURCE||null,sourceBefore:before,sourceAfter:null,cases:[],checks:[],errors:[],blockedRequests:[],serverRequests:[],closure:{contexts:false,browser:false,server:false,esbuild:false}};
await mkdir(output,{recursive:true});let browser,origin,js,css;const contexts=new Set(),bodyPlans=[];
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://fixture.invalid');report.serverRequests.push({method:req.method,path:url.pathname,query:url.search});
 if(req.method==='POST'&&['/api/admin/loyalty/rewards/create','/api/admin/loyalty/rewards'].includes(url.pathname)&&!url.search){
  const plan=bodyPlans.shift();if(!plan){res.writeHead(405);return res.end();}let body='';for await(const chunk of req)body+=chunk;plan.body=JSON.parse(body);plan.headers=true;
  res.writeHead(200,{'content-type':'application/json','cache-control':'private,no-store'});res.flushHeaders();res.write('{"ok":true,"reward":');res.on('close',()=>{plan.socketClosed=true});
  plan.release=()=>{if(plan.released)return;plan.released=true;if(!res.destroyed&&!res.writableEnded)res.end(JSON.stringify(row)+'}');};return;
 }
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 if(url.pathname==='/fixture.js'){res.setHeader('content-type','text/javascript');return res.end(js);}
 if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
 if(url.pathname.startsWith('/images/')){res.writeHead(200,{'content-type':'image/svg+xml'});return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#173549"/></svg>');}
 if(url.pathname!=='/'){res.writeHead(404);return res.end();}const theme=url.searchParams.get('theme')==='dark'?'dark':'light';res.setHeader('content-type','text/html;charset=utf-8');
 res.end('<!doctype html><html lang="es-AR" class="theme-'+theme+'" data-theme="'+theme+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guardar beneficio · QA</title><style>'+css+'</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
});
const check=(item,value,description)=>{report.checks.push({scenario:item.name,description,passed:Boolean(value)});assert.ok(value,description);};
const settle=page=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
async function checkFeedbackContrast(item,feedback){
 const colors=await feedback.evaluate(node=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
  const context=canvas.getContext('2d',{willReadFrequently:true});
  const rgba=color=>{context.clearRect(0,0,1,1);context.fillStyle=color;context.fillRect(0,0,1,1);return Array.from(context.getImageData(0,0,1,1).data);};
  const surface=getComputedStyle(node),foreground=getComputedStyle(node.querySelector('span'));
  let opaque=true;
  for(let ancestor=node;ancestor;ancestor=ancestor.parentElement)opaque&&=getComputedStyle(ancestor).opacity==='1';
  return {foreground:rgba(foreground.color),background:rgba(surface.backgroundColor),opaque:opaque&&surface.backgroundImage==='none'};
 });
 const luminance=rgba=>rgba.slice(0,3).map(value=>value/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4)
  .reduce((total,value,index)=>total+value*[0.2126,0.7152,0.0722][index],0);
 const [text,background]=[luminance(colors.foreground),luminance(colors.background)];
 const ratio=(Math.max(text,background)+0.05)/(Math.min(text,background)+0.05);
 item.feedbackContrast={...colors,ratio};
 check(item,colors.opaque&&colors.foreground[3]===255&&colors.background[3]===255&&ratio>=4.5,'rendered feedback text has at least 4.5:1 contrast on an opaque surface');
}
async function checkDialogActions(item,dialog,key){
 const layout=await dialog.evaluate(node=>{
  const form=node.querySelector('form'),footer=node.querySelector('footer');
  const save=footer.querySelector('button[type="submit"]'),cancel=footer.querySelector('button[type="button"]');
  const visible=button=>{
   const {left,right,top,bottom,width,height}=button.getBoundingClientRect();
   const center=document.elementFromPoint((left+right)/2,(top+bottom)/2);
   return width>=44&&height>=44&&left>=0&&right<=innerWidth&&top>=0&&bottom<=innerHeight&&button.contains(center);
  };
  const initialScroll=form.scrollTop;
  form.scrollTop=0;
  const top={visible:visible(save)&&visible(cancel),y:footer.getBoundingClientRect().top};
  form.scrollTop=form.scrollHeight;
  const bottom={visible:visible(save)&&visible(cancel),y:footer.getBoundingClientRect().top};
  const scrolled=form.scrollTop>0;
  form.scrollTop=initialScroll;
  return {top,bottom,scrolled,sameForm:save.form===form,noHorizontalOverflow:form.scrollWidth<=form.clientWidth+1};
 });
 item[key]=layout;
 check(item,layout.sameForm&&layout.scrolled&&layout.top.visible&&layout.bottom.visible&&Math.abs(layout.top.y-layout.bottom.y)<1&&layout.noHorizontalOverflow,'form actions stay visible and associated with the form at both scroll ends');
}
async function waitFor(label,predicate){const end=Date.now()+12000;while(!predicate()){assert(Date.now()<end,label);await new Promise(done=>setTimeout(done,15));}}
async function open(width,theme,name){
 const context=await browser.newContext({viewport:{width,height:950},locale:'es-AR',colorScheme:theme,reducedMotion:'reduce',serviceWorkers:'block'});contexts.add(context);const page=await context.newPage();page.setDefaultTimeout(10000);
 const item={width,theme,name,posts:[],reads:[],programReads:[],passed:false,errors:[]},tasks=new Set();report.cases.push(item);let closing=false;
 page.on('pageerror',error=>report.errors.push({name,width,theme,message:error.message}));
 const handler=async route=>{const request=route.request(),url=new URL(request.url());if(closing)return route.abort();
  if(url.origin!==origin){report.blockedRequests.push({name,method:request.method(),origin:url.origin,path:url.pathname});return route.abort();}
  if(request.method()==='POST'&&['/api/admin/loyalty/rewards/create','/api/admin/loyalty/rewards'].includes(url.pathname)&&!url.search){
   const call={path:url.pathname,body:request.postDataJSON(),ownerCancellationExpected:['close-late-409','close-late-200','native-close-late','unmounted-late-success','source-replace-late','stalled-body-held','catalogue-read-does-not-resolve-closed-save'].includes(name),status:200,response:{ok:true,reward:row},raw:null,release:()=>{},intercepted:name!=='stalled-body-held'};item.posts.push(call);
   if(name==='stalled-body-held'){bodyPlans.push(call);return route.continue();}
   let release;const gate=new Promise(done=>{release=done});call.release=release;await gate;if(closing)return route.abort();
   try{return await route.fulfill({status:call.status,contentType:typeof call.raw==='string'?'text/html':'application/json',body:call.raw??JSON.stringify(call.response)});}catch(error){if(call.ownerCancellationExpected&&request.failure()?.errorText){call.deliveryCancelledByOwner=true;return;}throw error;}
  }
  if(request.method()==='GET'&&url.pathname==='/api/admin/loyalty/rewards'){
   assert.equal(url.searchParams.size,1);const tenant=url.searchParams.get('tenant');assert(['qa-a','qa-b'].includes(tenant));
   let release;const gate=new Promise(done=>{release=done});const call={path:url.pathname,query:url.search,status:200,response:{ok:true,tenant,scope:'tenant',rewards:[{...row,tenant_slug:tenant,title:'Estado consultado QA'}]},release};item.reads.push(call);await gate;if(closing)return route.abort();
   return route.fulfill({status:call.status,contentType:'application/json',headers:{'x-nexid-data-mode':'production'},body:JSON.stringify(call.response)});
  }
  if(request.method()==='GET'&&url.pathname==='/api/admin/loyalty/programs'){
   assert.equal(url.searchParams.size,1);const tenant=url.searchParams.get('tenant');assert(['qa-a','qa-b'].includes(tenant));
   item.programReads.push({path:url.pathname,query:url.search});
   return route.fulfill({status:200,contentType:'application/json',headers:{'x-nexid-data-mode':'production'},body:JSON.stringify(programConfiguration(tenant))});
  }
  if(request.method()==='GET'&&['/','/fixture.js','/favicon.ico','/images/wine_tasting.png'].includes(url.pathname))return route.continue();
  report.blockedRequests.push({name,method:request.method(),path:url.pathname});return route.abort();
 };
 await page.route('**/*',route=>{const task=handler(route);tasks.add(task);task.finally(()=>tasks.delete(task)).catch(error=>{if(!closing)report.errors.push({name,width,theme,message:String(error)})});return task;});
 await page.goto(origin+'/?theme='+theme+(name==='historical-catalog'?'&historical=1':''),{waitUntil:'networkidle'});
 const dialog=page.getByRole('dialog'),newButton=page.getByRole('button',{name:'Nuevo Beneficio',exact:true});
 async function fillNew(code='NEW',title='Título conservado QA'){
  await newButton.click();await dialog.waitFor();
  const program=dialog.getByLabel('Programa del beneficio',{exact:true});
  await program.locator('option').filter({hasText:'Programa activo QA'}).waitFor({state:'attached'});
  if(name==='current-409-retains-fields'){
   check(item,await program.inputValue()===''&&await dialog.getByRole('button',{name:'Guardar Beneficio',exact:true}).isDisabled(),'new reward cannot infer the first or latest program');
   check(item,(await program.locator('option').allTextContents()).includes('Borrador reciente QA · Borrador'),'the recent draft is explicitly identified');
  }
  await program.selectOption({label:'Programa activo QA · Activo'});
  await dialog.getByLabel('Código de Control',{exact:true}).fill(code);await dialog.getByLabel('Título del Beneficio',{exact:true}).fill(title);await dialog.getByLabel('Costo en Puntos',{exact:true}).fill('40');await dialog.getByLabel('Stock total',{exact:true}).fill('12');
 }
 async function submit(){await dialog.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await waitFor('at least one deliberate POST',()=>item.posts.length>0);}
 async function releasePost(status=409,body={ok:false,error:'reward_create_conflict'}){const call=item.posts[0];call.status=status;call.response=body;call.release();await settle(page);}
 async function finish(){closing=true;for(const call of [...item.posts,...item.reads])call.release();await Promise.allSettled([...tasks]);await context.close();contexts.delete(context);}
 return {context,page,item,dialog,newButton,fillNew,submit,releasePost,finish};
}
async function runCase(width,theme,name){const f=await open(width,theme,name),{page,item,dialog}=f;
 try{
  if(name==='historical-catalog'){
   await page.getByRole('heading',{name:'Beneficio histórico QA',exact:true}).waitFor();
   check(item,await page.getByText('Estado sin confirmar',{exact:true}).count()===1,'historical status is shown as unconfirmed');
   check(item,await page.getByText('Puntos sin confirmar',{exact:true}).count()===1,'historical missing points are not replaced by zero');
   check(item,await page.getByText('Solo lectura · configuración por revisar',{exact:true}).count()===1,'unrepresentable historical row remains readable');
   check(item,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'long historical code fits the viewport');
   const edit=page.getByRole('button',{name:'Editar',exact:true});check(item,await edit.count()===1,'only the supported row can be edited');
   await edit.click();await dialog.waitFor();
   check(item,await dialog.locator('#reward-edit-status').inputValue()==='archived','editor keeps archived status');
   check(item,await dialog.locator('select').evaluateAll(selects=>selects.some(select=>select.value==='SERVICE')),'editor keeps the saved service type');
   await dialog.getByRole('button',{name:'Cerrar edición del beneficio',exact:true}).click();
   await dialog.waitFor({state:'detached'});
   const companyLabels=page.getByText('Identificador de empresa',{exact:true});
   check(item,await companyLabels.count()===0,'a tenant-scoped catalog does not repeat company identifiers');
   await page.evaluate(()=>window.__rewardShowGlobal('global'));
   check(item,await page.getByRole('heading',{name:'Beneficio compartido QA',exact:true}).count()===2&&await companyLabels.count()===2,'global catalog labels both rewards with the same code and title');
   for(const company of globalTenants){
    const identifier=page.getByText(company,{exact:true});
    check(item,await identifier.count()===1&&await identifier.evaluate(node=>node.tagName==='DD'),'each global row shows its own company identifier');
   }
   check(item,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'a long company identifier wraps inside the viewport');
   check(item,await edit.count()===0&&await f.newButton.count()===0,'global catalog stays read-only');
   await page.evaluate(()=>window.__rewardShowGlobal());
   check(item,await companyLabels.count()===0,'missing scope cannot display company identifiers');
   await page.evaluate(()=>window.__rewardShowGlobal('global','demo'));
   check(item,await companyLabels.count()===0,'demo cannot display production company identifiers');
   check(item,item.posts.length===0&&item.reads.length===0,'opening the supported editor and changing catalog scope adds no API calls');
  }else if(name==='exact-edit-route'){
   await page.getByRole('button',{name:'Editar',exact:true}).click();await dialog.waitFor();await dialog.getByLabel('Título del Beneficio',{exact:true}).fill('Edición explícita QA');await f.submit();
   check(item,item.posts.length===1&&item.posts[0].path==='/api/admin/loyalty/rewards','exact edit uses legacy endpoint once');
   check(item,item.posts[0].body.reward_id===REWARD&&item.posts[0].body.program_id===PROGRAM&&!Object.hasOwn(item.posts[0].body,'creationIntent'),'exact edit retains persisted identities and no creation intent');
   await f.releasePost(409,{ok:false,error:'reward_update_conflict'});await dialog.getByRole('alert').waitFor();
  }else{
   await f.fillNew();
   if(name==='current-409-retains-fields'){
    const options=dialog.getByRole('group',{name:'Opciones de imagen'});
    const tasting=options.getByRole('button',{name:'Degustación en bodega',exact:true});
    const crate=options.getByRole('button',{name:'Caja de seis botellas',exact:true});
    const noImage=options.getByRole('button',{name:'Sin imagen',exact:true});
    const custom=dialog.getByLabel('URL personalizada de imagen (opcional)',{exact:true});
    check(item,await tasting.getAttribute('aria-pressed')==='true'&&await custom.inputValue()===''&&!(await options.innerText()).includes('/images/'),'default image has a descriptive selected button and hides its asset path');
    await noImage.click();
    check(item,await noImage.getAttribute('aria-pressed')==='true'&&await tasting.getAttribute('aria-pressed')==='false'&&await custom.inputValue()==='','removing the preset explicitly selects no image');
    await custom.fill('https://example.invalid/beneficio.png');
    check(item,await custom.inputValue()==='https://example.invalid/beneficio.png'&&await options.getByRole('button',{pressed:true}).count()===0,'a custom URL remains editable and clears the image option selection');
    await crate.click();
    check(item,await crate.getAttribute('aria-pressed')==='true'&&await noImage.getAttribute('aria-pressed')==='false'&&await custom.inputValue()==='','selecting another image updates its accessible state');
   }else if(name==='success-no-timer'){
    await dialog.getByRole('button',{name:'Sin imagen',exact:true}).click();
   }
   if(name==='current-409-retains-fields'){
    await dialog.getByRole('button',{name:'Guardar Beneficio',exact:true}).click();
    await waitFor('a native footer click submits the form',()=>item.posts.length>0);
    check(item,item.posts.length===1&&item.posts[0].body.program_id===PROGRAM,'one footer click saves the explicitly selected program');
    check(item,item.programReads.length===1&&item.programReads[0].query==='?tenant=qa-a','creation reads programs only for its company');
   }else await f.submit();
   if(name==='double-submit'){
    await dialog.locator('form').evaluate(form=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});await settle(page);
    check(item,item.posts.length===1,'repeated current-owner submit events cannot issue another POST');await f.releasePost();
   }else if(name==='close-late-409'||name==='close-late-200'||name==='native-close-late'){
    if(name==='native-close-late')await dialog.evaluate(node=>node.close());else await dialog.getByRole('button',{name:'Cerrar edición del beneficio',exact:true}).click();await dialog.waitFor({state:'detached'});await f.newButton.evaluate(node=>node.click());
    await f.releasePost(name==='close-late-200'?200:409,name==='close-late-200'?{ok:true,reward:row}:{ok:false,error:'reward_create_conflict'});await page.waitForTimeout(1700);
    check(item,await dialog.count()===0,'closing a pending write does not allow a replacement write before explicit catalogue review');
    check(item,await page.getByRole('button',{name:'Consultar catálogo',exact:true}).count()>0&&item.posts.length===1,'uncertain close retains a real recovery action and never rePOSTs');
    check(item,await page.evaluate(()=>window.__rewardRefreshes)===0,'late result cannot refresh the page after its owner closes');
   }else if(name==='success-no-timer'){
    check(item,item.posts[0].body.image_url==='','removing a suggested image submits the existing empty image value');
    await f.releasePost(200,{ok:true,reward:row});const success=dialog.getByRole('status').filter({hasText:/Nuevo beneficio creado/});await success.waitFor();
    await checkFeedbackContrast(item,success);
    await dialog.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    await dialog.getByRole('button',{name:'Cerrar edición del beneficio',exact:true}).click();await dialog.waitFor({state:'detached'});
    await f.fillNew('SECOND','Otra operación QA');await page.waitForTimeout(1700);
    check(item,await dialog.count()===1&&await dialog.getByLabel('Título del Beneficio',{exact:true}).inputValue()==='Otra operación QA','acknowledged previous save cannot close the replacement dialog on a timer');
    check(item,await page.evaluate(()=>window.__rewardRefreshes)===0,'acknowledged save performs no automatic router refresh');
    check(item,item.posts.length===1,'a confirmed dialog cannot resubmit its completed operation');
   }else if(name==='same-turn-close-reopen'){
    await f.releasePost(200,{ok:true,reward:row});await dialog.getByRole('status').filter({hasText:/Nuevo beneficio creado/}).waitFor();
    const reused=await page.evaluate(()=>window.__rewardReopenSameTurn());await dialog.waitFor();await dialog.getByLabel('Título del Beneficio',{exact:true}).fill('Formulario B protegido QA');
    await page.evaluate(()=>window.__previousRewardDialog.dispatchEvent(new Event('close')));await settle(page);
    check(item,!reused&&await dialog.count()===1&&await dialog.getByLabel('Título del Beneficio',{exact:true}).inputValue()==='Formulario B protegido QA','a new opening has its own native dialog and a late close from A cannot close B');
    check(item,item.posts.length===1,'a late native close does not submit the replacement');
   }else if(name==='catalogue-read-does-not-resolve-closed-save'){
    await dialog.getByRole('button',{name:'Cerrar edición del beneficio',exact:true}).click();await dialog.waitFor({state:'detached'});
    await page.getByRole('button',{name:'Consultar catálogo',exact:true}).click();await waitFor('explicit GET while earlier POST outcome is still unobserved',()=>item.reads.length===1);item.reads[0].release();
    await page.getByText('Esta consulta no confirma el guardado anterior',{exact:false}).waitFor();await f.newButton.evaluate(node=>node.click());await settle(page);
    check(item,await dialog.count()===0&&item.posts.length===1,'GET before the old POST finishes never unlocks another writer');
    await f.releasePost(200,{ok:true,reward:row});await settle(page);await f.newButton.evaluate(node=>node.click());
    check(item,await dialog.count()===0&&item.posts.length===1&&item.reads.length===1,'a retired POST reply cannot clear the latched review guard');
   }else if(name==='unmounted-late-success'){
    await page.evaluate(()=>window.__rewardUnmount());await f.releasePost(200,{ok:true,reward:row});await page.waitForTimeout(1700);
    check(item,await page.evaluate(()=>window.__rewardRefreshes)===0&&item.posts.length===1,'unmounted response cannot schedule an old success timer or another request');
   }else if(name==='source-replace-late'){
    await page.evaluate(()=>window.__rewardChangeSource('tenant'));await settle(page);if(await dialog.count())await dialog.getByRole('button',{name:'Cerrar edición del beneficio',exact:true}).click();
    await f.fillNew('OTHER','Formulario de empresa B QA');await f.releasePost();await settle(page);
    check(item,await dialog.getByLabel('Título del Beneficio',{exact:true}).inputValue()==='Formulario de empresa B QA'&&await dialog.getByRole('alert').count()===0,'old tenant response cannot paint an error into the replacement source');
    check(item,item.posts.length===1&&item.posts[0].body.tenant_slug==='qa-a','source change does not forward the old action into another tenant');
   }else if(name==='current-409-retains-fields'){
    await f.releasePost();const alert=dialog.getByRole('alert');await alert.waitFor();
    await checkFeedbackContrast(item,alert);
    check(item,item.posts[0].body.image_url==='/images/wine_crate.png'&&await dialog.getByRole('button',{name:'Caja de seis botellas',pressed:true}).count()===1,'preset uses its existing asset value and survives a refused save');
    check(item,await dialog.getByLabel('Código de Control',{exact:true}).inputValue()==='NEW'&&await dialog.getByLabel('Título del Beneficio',{exact:true}).inputValue()==='Título conservado QA','current refusal preserves the typed fields');
    check(item,(await alert.innerText()).includes('otro código')&&await alert.evaluate(node=>node===document.activeElement),'current duplicate refusal offers deliberate recovery and focuses neutral feedback');
    await checkDialogActions(item,dialog,'footerLayout');
    const save=dialog.getByRole('button',{name:'Guardar Beneficio',exact:true}),close=dialog.getByRole('button',{name:'Cerrar edición del beneficio',exact:true});
    await save.focus();await page.keyboard.press('Tab');
    check(item,await close.evaluate(node=>node===document.activeElement),'Tab wraps from the footer to the first dialog control');
    await page.keyboard.press('Shift+Tab');
    check(item,await save.evaluate(node=>node===document.activeElement),'Shift+Tab wraps back to the footer');
    await alert.focus();
   }else if(name==='old-api-404'){
    const call=item.posts[0];call.status=404;call.raw='<html>old deployment QA</html>';call.release();await dialog.getByRole('alert').waitFor();
    check(item,item.posts.length===1&&call.path==='/api/admin/loyalty/rewards/create','unsupported strict endpoint never falls back to the old upsert path');
    check(item,(await dialog.innerText()).includes('creación segura no está disponible')&&!(await dialog.innerText()).includes('old deployment QA'),'HTML404 is explained without claiming a create or leaking its body');
   }else if(name==='stalled-body-held'){
    await waitFor('native response headers start before incomplete JSON body',()=>item.posts[0].headers===true);await page.waitForFunction(()=>window.__rewardRequests.some(r=>r.method==='POST'&&r.headers));
    await dialog.getByText('No pudimos confirmar el resultado.',{exact:false}).waitFor();
    const before=await dialog.getByLabel('Título del Beneficio',{exact:true}).inputValue();
    await dialog.getByRole('button',{name:'Consultar catálogo',exact:true}).click();await waitFor('one explicit private catalogue GET',()=>item.reads.length===1);
    item.reads[0].status=503;item.reads[0].response={ok:false,error:'unavailable'};item.reads[0].release();await dialog.getByText('No pudimos consultar el catálogo.',{exact:false}).waitFor();
    check(item,await dialog.getByLabel('Título del Beneficio',{exact:true}).inputValue()===before,'failed review GET preserves the current draft and uncertainty barrier');
    await dialog.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));check(item,item.posts.length===1,'failed read never enables silent resubmission');
    await dialog.getByRole('button',{name:'Consultar catálogo',exact:true}).click();await waitFor('second deliberate read',()=>item.reads.length===2);item.reads[1].release();
    await page.getByText('Estado consultado QA',{exact:true}).waitFor();await dialog.getByText('Esta consulta no confirma el guardado anterior',{exact:false}).waitFor();
    check(item,await dialog.count()===1&&await dialog.getByLabel('Título del Beneficio',{exact:true}).inputValue()===before,'a successful catalogue read retains the uncertain form and typed fields');
    await dialog.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await f.newButton.evaluate(node=>node.click());await settle(page);
    check(item,item.posts.length===1&&item.reads.length===2,'a valid read cannot enable another write while the earlier result is uncertain');
    const observed=await page.evaluate(()=>window.__rewardRequests.filter(r=>r.method==='GET'&&r.path==='/api/admin/loyalty/rewards'));
    check(item,observed.length===2&&observed.every(r=>r.cache==='no-store'&&r.credentials==='same-origin'&&!r.hasBody&&r.hasSignal),'review requests use the existing bounded private GET without a body');
   }
  }
  check(item,report.blockedRequests.length===0,'case attempted no external or unexpected path');
  if(name==='current-409-retains-fields'||name==='old-api-404'){
   await page.addScriptTag({content:axe});const violations=await page.evaluate(async()=>(await axe.run('dialog',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})));item.violations=violations;
   check(item,violations.length===0,'the current feedback/dialog has no axe violations in this fixture');check(item,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page has no horizontal overflow');
   const screenshot=name+'-'+width+'-'+theme+'.png';await page.screenshot({path:join(output,screenshot),fullPage:false});item.screenshot=screenshot;
   if(name==='current-409-retains-fields'&&width===390){
    await page.setViewportSize({width:320,height:568});
    await page.addStyleTag({content:'html { font-size: 125% !important; }'});
    await settle(page);
    await checkDialogActions(item,dialog,'compactFooterLayout');
   }
  }
  item.passed=true;
 }catch(error){item.failure=String(error.stack||error);}finally{await f.finish();}
}
try{
 const bundle=await build({stdin:{contents:entry,loader:'tsx',resolveDir:app},bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},logLevel:'silent',plugins:[{name:'router-observer',setup(builder){builder.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'router-observer'}));builder.onLoad({filter:/.*/,namespace:'router-observer'},()=>({contents:'export const useRouter=()=>({refresh(){window.__rewardRefreshes++}})',loader:'js'}));}}]});js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).contents;
 css=(await postcss([tailwindcss({content:[join(app,'src/**/*.{ts,tsx}').replaceAll('\\','/'),join(root,'packages/ui/src/**/*.{ts,tsx}').replaceAll('\\','/'),{raw:entry,extension:'tsx'}],darkMode:['selector','[data-theme="dark"]'],theme:{extend:{colors:{brand:{dark:'#020617',card:'#0f172a',border:'#1e293b',cyan:'#06b6d4',blue:'#3b82f6'}}}},plugins:[]})]).process(await readFile(join(app,'src/app/globals.css'),'utf8'),{from:undefined})).css+(bundle.outputFiles.find(f=>f.path.endsWith('.css'))?.text||'');
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done)});origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 const scenarios=['double-submit','close-late-409','close-late-200','native-close-late','success-no-timer','same-turn-close-reopen','catalogue-read-does-not-resolve-closed-save','unmounted-late-success','source-replace-late','current-409-retains-fields','old-api-404','stalled-body-held','exact-edit-route','historical-catalog'];
 const chosen=process.env.QA_REWARD_DIALOG_CASE?scenarios.filter(n=>n===process.env.QA_REWARD_DIALOG_CASE):scenarios;assert(chosen.length>0,'known explicit case filter');
 for(const width of [390,1280])for(const theme of ['light','dark'])for(const name of chosen)await runCase(width,theme,name);
 report.sourceAfter=await hashes();assert.deepEqual(report.sourceAfter,before);report.allPlannedCases=chosen.length===scenarios.length;report.passed=report.cases.length===chosen.length*4&&report.cases.every(c=>c.passed)&&report.errors.length===0&&report.blockedRequests.length===0;if(!report.passed)process.exitCode=1;
}catch(error){report.failure=String(error.stack||error);process.exitCode=1;}finally{
 for(const context of contexts)await context.close();contexts.clear();report.closure.contexts=true;if(browser){await browser.close();report.closure.browser=true;}server.closeAllConnections();if(server.listening)await new Promise(done=>server.close(done));report.closure.server=!server.listening;stop();report.closure.esbuild=true;report.completedAt=new Date().toISOString();
 await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({report:join(output,'report.json'),passed:report.passed,checks:report.checks.length,cases:report.cases.length,releaseAcceptanceEligible:false,closure:report.closure}));
}
