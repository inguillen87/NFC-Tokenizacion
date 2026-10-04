// Actual production Next pages. Every identity, OTP and HTTP acknowledgement is a local fixture.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
const web=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(web,'../..');
// QA_OUTPUT is a parent folder. Every run reserves a new exclusive child so a
// repeat cannot replace prior screenshots, reports or server evidence.
const outputRoot=resolve(process.env.QA_OUTPUT||'artifacts/client-access');await mkdir(outputRoot,{recursive:true});
const output=await mkdtemp(join(outputRoot,'run-'));
const fixture=join(web,'tests/consumer-portal-local-fetch.mjs');
const helperPaths=[fileURLToPath(import.meta.url),fixture];
async function helperHashes(){return Object.fromEntries(await Promise.all(helperPaths.map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])));}
const helperHashesStart=await helperHashes();
async function sourceFiles(path){
 const entries=await readdir(join(repo,path),{withFileTypes:true});
 return(await Promise.all(entries.map(entry=>entry.isDirectory()?sourceFiles(`${path}/${entry.name}`):entry.isFile()?[`${path}/${entry.name}`]:[]))).flat();
}
async function sourceBinding(){
 const paths=(await Promise.all(['apps/web/src','packages/config/src','packages/ui/src','packages/api-client/src','packages/core/src'].map(sourceFiles))).flat();
 paths.push('package.json','package-lock.json','apps/web/package.json','apps/web/public/release.json');paths.sort();
 const sourceHashes=Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile(join(repo,path))).digest('hex')])));
 const buildPaths=['BUILD_ID','build-manifest.json','routes-manifest.json','server/app-paths-manifest.json','server/app/login/page.js','server/app/me/products/page.js'];
 const buildHashes=Object.fromEntries(await Promise.all(buildPaths.map(async path=>[path,createHash('sha256').update(await readFile(join(web,'.next',path))).digest('hex')])));
 return{qaSource:process.env.QA_SOURCE||null,buildId:(await readFile(join(web,'.next/BUILD_ID'),'utf8')).trim(),release:JSON.parse(await readFile(join(web,'public/release.json'),'utf8')),sourceHashes,buildHashes,sourceFingerprint:createHash('sha256').update(JSON.stringify(sourceHashes)).digest('hex')};
}
const sourceBindingStart=await sourceBinding();
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(k)));
Object.assign(env,{NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',CONSUMER_PORTAL_QA:'1'});
// The existing guarded preload serves synthetic private account reads and
// rejects external server fetches and mutations. Production Next pages render
// normally; no provider credentials or production data enter this process.
const next=spawn(process.execPath,['--import',pathToFileURL(fixture).href,join(repo,'node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:web,env,windowsHide:true});let log='';next.stdout.on('data',d=>log+=d);next.stderr.on('data',d=>log+=d);
const origin=`http://127.0.0.1:${port}`;
for(let i=0;i<120;i++){try{if((await fetch(origin+'/release.json')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));if(i===119){next.kill();throw Error('local_next_server_unavailable');}}
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
const report={realNextProductionPages:true,actualPrivateNextPages:true,syntheticPrivateAccountReads:true,syntheticContactsAndAcknowledgements:true,realAuthenticationCertified:false,sourceBindingStart,helperHashesStart,output,checks:[],views:[],scenarios:[],errors:[],externalWrites:0,blockedBusinessWrites:[],geolocationCalls:0};
const check=(value,name)=>{report.checks.push({name,passed:Boolean(value)});assert.ok(value,name);};
const checkPayload=(actual,expected,name)=>check(isDeepStrictEqual(actual,expected),name);
const productNext='/me/products?fromTap=1&eventId=900001&bid=LOT-WINE-QA&tenant=consumer-qa&action=save';
const starts=state=>state.calls.filter(call=>call.path.endsWith('/start'));
const afterRender=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function open(width=390,theme='light',nextPath='/docs'){
 const context=await browser.newContext({viewport:{width,height:844},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'});
 await context.addCookies([{name:'theme',value:theme,url:origin},{name:'nexid_theme_version',value:'white-first-v2',url:origin}]);
 await context.exposeBinding('__qaLocationCall',()=>{report.geolocationCalls++;});
 await context.addInitScript(()=>{window.__geoCalls=0;Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){window.__geoCalls++;void window.__qaLocationCall();throw Error('Unexpected location request');},watchPosition(){window.__geoCalls++;void window.__qaLocationCall();throw Error('Unexpected location watch');}}});});
 const page=await context.newPage(),state={calls:[],start:{ok:true,delivery:{channel:'email',status:'accepted'}},startHttp:503,verify:{ok:false},verifyHttp:400,session:{ok:true,authenticated:false},sessionHttp:200,holdStart:false,holdVerify:false,releaseVerify:null};
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('**/*',async route=>{const request=route.request(),u=new URL(request.url());if(u.origin!==origin){if(request.method()!=='GET')report.externalWrites++;return route.abort();}
  if(u.pathname.startsWith('/api/consumer/')){
   state.calls.push({path:u.pathname,method:request.method(),...(request.postData()?{payload:request.postDataJSON()}:{})});
   if(u.pathname.endsWith('/logout'))return route.fulfill({json:{ok:true}});
   if(u.pathname.endsWith('/start')){if(state.holdStart)return;return route.fulfill({status:state.start.ok?200:state.startHttp,json:state.start});}
   if(u.pathname.endsWith('/verify')){if(state.holdVerify)await new Promise(release=>{state.releaseVerify=release;});return route.fulfill(state.verify==='malformed'?{status:200,contentType:'text/html',body:'<!doctype html>upstream'}:{status:state.verifyHttp,json:state.verify});}
   if(u.pathname.endsWith('/session'))return route.fulfill({status:state.sessionHttp,json:state.session,
    ...(state.sessionHttp===200&&state.session.ok===true&&state.session.authenticated===true?{headers:{'set-cookie':'consumer_qa=local; Path=/; HttpOnly; SameSite=Lax'}}:{})});
   if(!['GET','HEAD'].includes(request.method()))report.blockedBusinessWrites.push({path:u.pathname,method:request.method()});
   return route.fulfill({status:404,json:{ok:false}});
  }
  if(!['GET','HEAD'].includes(request.method())){report.blockedBusinessWrites.push({path:u.pathname,method:request.method()});return route.abort();}return route.continue();
 });
 const params=new URLSearchParams({consumer:'1',next:nextPath});
 await page.goto(origin+'/login?'+params,{waitUntil:'networkidle'});return{context,page,state};
}
async function email(page){await page.getByRole('button',{name:'Email',exact:true}).click();await page.getByRole('textbox',{name:'Correo electrónico',exact:true}).fill('persona@example.test');}
async function assess(page,selector,name,width,theme){await page.addScriptTag({content:axe});const violations=await page.evaluate(async selector=>(await axe.run(selector,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})),selector);check(violations.filter(v=>['serious','critical'].includes(v.impact)).length===0,`${name} accessibility ${width} ${theme}`);check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} no overflow ${width} ${theme}`);await page.screenshot({path:join(output,`${name}-${width}-${theme}.png`),fullPage:true});report.views.push({name,width,theme,violations});}
const unavailableMeta=['meta_configuration_missing','meta_configuration_invalid','meta_authentication_failed','consumer_whatsapp_provider_invalid','meta_payload_invalid'];
const uncertainMeta=['meta_delivery_timeout','meta_delivery_failed','meta_receipt_invalid'];
async function whatsappRecovery(error,width=390,theme='dark',capture=false){
 const recovery=await open(width,theme,productNext),p=recovery.page,state=recovery.state;
 const label=`${error}/${width}/${theme}`;
 check(await p.getByRole('button',{name:'Email',exact:true}).getAttribute('aria-pressed')==='true',`${label} email is the initial channel`);
 await email(p);await p.getByRole('button',{name:'WhatsApp',exact:true}).click();
 const phone=p.getByRole('textbox',{name:'Número de teléfono sin código de país',exact:true});await phone.fill('1155551234');
 state.start={ok:false,error};state.startHttp=error==='meta_delivery_timeout'?504:uncertainMeta.includes(error)?502:error==='meta_payload_invalid'?422:503;
 await p.getByRole('button',{name:'Recibir código',exact:true}).click();
 const alternative=p.getByRole('button',{name:'Continuar con email',exact:true});await alternative.waitFor();
 const message=await p.getByRole('status').innerText();
 if(unavailableMeta.includes(error))check(message.includes('WhatsApp no está disponible ahora.')&&message.includes('email'),`${label} unavailable provider explains email alternative`);
 if(uncertainMeta.includes(error))check(message.includes('confirmar el envío')&&/más (tarde|reciente)/.test(message),`${label} uncertain delivery warns that a code may still arrive`);
 if(error==='unexpected_provider_reply')check(message.includes('No pudimos iniciar el acceso.')&&message.includes('Tu contacto se conserva'),`${label} unknown response gives actionable generic recovery`);
 check(!message.includes(error)&&!message.includes('Meta')&&!message.includes('Graph'),`${label} recovery copy does not expose implementation details`);
 check(await p.getByRole('textbox',{name:'Código de acceso',exact:true}).count()===0,`${label} never claims a sent challenge`);
 check(await phone.inputValue()==='1155551234',`${label} failure preserves phone draft`);
 check(await p.locator('form').getAttribute('aria-busy')==='false',`${label} failure restores form controls`);
 check(starts(state).length===1,`${label} failure causes one explicit send`);
 checkPayload(starts(state)[0].payload,{phone:'+5491155551234'},`${label} phone request carries only the normalized phone`);
 if(capture)await assess(p,'.consumer-login-panel',unavailableMeta.includes(error)?'meta-unavailable':'meta-send-uncertain',width,theme);
 const callsBefore=state.calls.length;await alternative.click();await p.waitForFunction(()=>document.activeElement?.type==='email');await afterRender(p);
 check(await p.getByRole('textbox',{name:'Correo electrónico',exact:true}).inputValue()==='persona@example.test',`${label} switching channels preserves email draft and focus`);
 check(state.calls.length===callsBefore,`${label} switching channels never sends or verifies automatically`);
 check(new URL(p.url()).searchParams.get('next')===productNext,`${label} switching channels preserves product context`);
 state.start={ok:true,delivery:{channel:'email',status:'accepted'}};
 await p.getByRole('button',{name:'Recibir código',exact:true}).click();await p.getByRole('textbox',{name:'Código de acceso',exact:true}).waitFor();
 check(starts(state).length===2,`${label} fallback email send is explicitly requested once`);
 checkPayload(starts(state)[1].payload,{email:'persona@example.test',next:productNext},`${label} fallback email carries the sanitized product continuation`);
 await p.getByRole('button',{name:'Cambiar contacto',exact:true}).click();await p.getByRole('button',{name:'WhatsApp',exact:true}).click();
 check(await phone.inputValue()==='1155551234',`${label} phone draft survives the completed email fallback`);
 check(starts(state).length===2,`${label} returning to phone never starts another request`);
 report.scenarios.push({name:'whatsapp-error-recovery',error,width,theme,requests:state.calls});await recovery.context.close();
}
async function magicProductContinuation(width,theme){
 const s=await open(width,theme,productNext),p=s.page,state=s.state,label=`magic-product/${width}/${theme}`;
 await email(p);await p.getByRole('button',{name:'Recibir código',exact:true}).click();await p.getByRole('textbox',{name:'Código de acceso',exact:true}).waitFor();
 checkPayload(starts(state)[0].payload,{email:'persona@example.test',next:productNext},`${label} email start includes product context`);
 check(await p.getByRole('button',{name:'Validar y continuar',exact:true}).count()===1,`${label} verification action explains the product return`);
 const continuation=starts(state)[0].payload.next;
 state.verify={ok:true};state.verifyHttp=200;state.session={ok:true,authenticated:true};
 // Simulate the URL received in an API-generated email. The token, identity,
 // session cookie and account projections are local fixtures, not credentials.
 const link='/login?'+new URLSearchParams({consumer:'1',t:'synthetic-continuation-only',next:continuation});
 await p.evaluate(link=>history.pushState(null,'',link),link);
 await p.waitForURL(url=>url.pathname==='/me/products'&&url.searchParams.get('eventId')==='900001');
 const library=p.getByTestId('consumer-product-library');await library.waitFor();
 check((await library.innerText()).includes('Vino reserva QA'),`${label} actual private Next product page renders the synthetic collection`);
 const verifyCalls=state.calls.filter(call=>call.path.endsWith('/verify')),sessionCalls=state.calls.filter(call=>call.path.endsWith('/session'));
 check(verifyCalls.length===1&&sessionCalls.length===1,`${label} magic link verifies once and confirms the session before navigation`);
 checkPayload(verifyCalls[0].payload,{token:'synthetic-continuation-only'},`${label} magic verification carries only its token`);
 check(new URL(p.url()).pathname+new URL(p.url()).search===productNext,`${label} successful session restores the exact product selection`);
 check(state.calls.filter(call=>!['GET','HEAD'].includes(call.method)).every(call=>['/api/consumer/auth/logout','/api/consumer/auth/start','/api/consumer/auth/verify'].includes(call.path)),`${label} product continuation performs no automatic save, claim or association`);
 check(await p.evaluate(()=>window.__geoCalls)===0,`${label} product continuation requests no location`);
 await assess(p,'[data-testid="consumer-product-library"]','email-product-return',width,theme);
 report.scenarios.push({name:'magic-email-product-continuation',width,theme,requests:state.calls});await s.context.close();
}
try{
 for(const width of [320,390,768,1440])for(const theme of ['light','dark']){
  const s=await open(width,theme),p=s.page;await email(p);
  check(await p.locator('html').getAttribute('data-theme')===theme,`Requested login theme ${width} ${theme}`);
  const controls=await p.locator('.consumer-login-panel button,.consumer-login-panel input,.consumer-login-panel select').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().height>0).map(n=>({height:n.getBoundingClientRect().height,font:getComputedStyle(n).fontSize,tag:n.tagName})));
  check(controls.every(c=>c.height>=44),`Login controls at least 44px ${width} ${theme}`);check(controls.filter(c=>c.tag==='INPUT').every(c=>parseFloat(c.font)>=16),`Login inputs prevent mobile zoom ${width} ${theme}`);
  await assess(p,'.consumer-login-panel','login-contact',width,theme);await p.getByRole('button',{name:'Recibir código',exact:true}).click();await p.getByRole('textbox',{name:'Código de acceso',exact:true}).waitFor();await p.waitForFunction(()=>document.activeElement?.id==='consumer-access-code');
  checkPayload(starts(s.state)[0].payload,{email:'persona@example.test'},`Generic navigation is omitted from email delivery ${width} ${theme}`);
  check((await p.locator('[aria-current="step"]').innerText()).replace(/\s/g,'')==='2Tucódigo',`OTP step and focus ${width} ${theme}`);
  await assess(p,'.consumer-login-panel','login-code',width,theme);await p.goto(origin+'/register',{waitUntil:'networkidle'});
  check(await p.locator('input').count()===0,`Register removes nonfunctional inputs ${width} ${theme}`);check(await p.getByRole('link',{name:/Tengo un producto/}).getAttribute('href')==='/login?consumer=1&next=%2Fme',`Consumer register reaches real access ${width} ${theme}`);check(await p.getByRole('link',{name:/Represento a una empresa/}).getAttribute('href')==='/?contact=demo#contact-modal',`Business register reaches actual contact ${width} ${theme}`);
  await assess(p,'main','register',width,theme);check(await p.evaluate(()=>window.__geoCalls)===0,`No automatic location ${width} ${theme}`);await s.context.close();
 }
 const s=await open(),p=s.page;await email(p);await p.getByRole('button',{name:'Recibir código',exact:true}).click();const code=p.getByRole('textbox',{name:'Código de acceso',exact:true});await code.fill('135791');await p.keyboard.press('Enter');await p.getByRole('status').filter({hasText:'No pudimos validar ese código.'}).waitFor();check(await code.inputValue()==='135791','Rejected code keeps draft');check(await code.getAttribute('aria-invalid')==='true','Code error belongs to field');check((await code.getAttribute('aria-describedby')).includes('consumer-access-feedback'),'Code error is announced with field');check(await code.evaluate(n=>n===document.activeElement),'Code error restores focus');
 s.state.verifyHttp=503;await p.getByRole('button',{name:'Entrar a mi Pasaporte',exact:true}).click();await p.getByRole('status').filter({hasText:'El servicio de acceso no está disponible ahora.'}).waitFor();check(await code.inputValue()==='135791','Service unavailable preserves entered code');
 s.state.verify='malformed';s.state.verifyHttp=200;await p.getByRole('button',{name:'Entrar a mi Pasaporte',exact:true}).click();await p.getByRole('status').filter({hasText:'No pudimos validar ese código.'}).waitFor();check(new URL(p.url()).pathname==='/login','Malformed acknowledgement cannot sign in');
 s.state.verify={ok:true};await p.getByRole('button',{name:'Entrar a mi Pasaporte',exact:true}).click();await p.getByRole('status').filter({hasText:'No pudimos confirmar tu sesión'}).waitFor();check(new URL(p.url()).pathname==='/login','Verified identity cannot enter without authenticated session');
 s.state.session={ok:true,authenticated:true};s.state.sessionHttp=503;await p.getByRole('button',{name:'Entrar a mi Pasaporte',exact:true}).click();await p.getByRole('status').filter({hasText:'No pudimos confirmar tu sesión'}).waitFor();check(new URL(p.url()).pathname==='/login','HTTP denial cannot be bypassed by a success body');
 s.state.sessionHttp=200;await p.getByRole('button',{name:'Entrar a mi Pasaporte',exact:true}).click();await p.waitForURL(url=>url.pathname==='/docs');check(true,'Successful local acknowledgement and session return to sanitized destination');await s.context.close();
 const failed=await open();await email(failed.page);failed.state.start={ok:false,error:'resend_delivery_failed'};await failed.page.getByRole('button',{name:'Recibir código',exact:true}).click();await failed.page.getByRole('status').filter({hasText:'No se pudo confirmar el envío.'}).waitFor();check(await failed.page.getByRole('textbox',{name:'Correo electrónico',exact:true}).inputValue()==='persona@example.test','Failed send retains contact');check(await failed.page.getByRole('textbox',{name:'Código de acceso',exact:true}).count()===0,'Failed send does not claim accepted challenge');await failed.context.close();
 // Each viewport and theme sees both recovery families and a complete email
 // continuation. The remaining codes retain focused coverage below.
 let variant=0;const coveredMeta=new Set();
 for(const width of [320,390,768,1440])for(const theme of ['light','dark']){
  const unavailable=unavailableMeta[variant%unavailableMeta.length],uncertain=uncertainMeta[variant%uncertainMeta.length];
  await whatsappRecovery(unavailable,width,theme,true);await whatsappRecovery(uncertain,width,theme,true);
  coveredMeta.add(unavailable);coveredMeta.add(uncertain);await magicProductContinuation(width,theme);variant++;
 }
 for(const error of [...unavailableMeta,...uncertainMeta].filter(error=>!coveredMeta.has(error)))await whatsappRecovery(error);
 for(const error of ['twilio_delivery_failed','twilio_authentication_failed','unexpected_provider_reply'])await whatsappRecovery(error);
 const continuationCases=[
  {name:'sensitive capability and device fields are removed',next:'/me/products?fromTap=1&eventId=900001&token=SYNTHETIC&tapAccess=SYNTHETIC&ctr=17&latitude=-34&unknown=1#private',expected:'/me/products?fromTap=1&eventId=900001'},
  {name:'safe keys receive stable canonical order',next:'/me/products?action=save&tenant=consumer-qa&bid=LOT.WINE-QA:1&focus=900001&eventId=9223372036854775807&fromTap=1',expected:'/me/products?fromTap=1&eventId=9223372036854775807&focus=900001&bid=LOT.WINE-QA%3A1&tenant=consumer-qa&action=save'},
  {name:'private saved reading remains selectable',next:'/me/taps/900001?fromTap=1&action=claim',expected:'/me/taps/900001?fromTap=1&action=claim'},
  {name:'passport route remains selectable',next:'/me/passport?bid=LOT-WINE-QA&tenant=consumer-qa&action=passport',expected:'/me/passport?bid=LOT-WINE-QA&tenant=consumer-qa&action=passport'},
  {name:'duplicate whitelisted key abandons continuation',next:'/me/products?focus=900001&focus=900002',expected:'/me'},
  {name:'invalid singleton abandons continuation',next:'/me/products?fromTap=0&eventId=900001',expected:'/me'},
  {name:'empty selection abandons continuation',next:'/me/products?focus=',expected:'/me'},
  {name:'noncanonical reading identifier is rejected',next:'/me/taps/0900001',expected:'/me'},
  {name:'out of range PostgreSQL identifier is rejected',next:'/me/products?eventId=9223372036854775808',expected:'/me'},
  {name:'unknown action is rejected',next:'/me/products?action=delete',expected:'/me'},
  {name:'unknown private route is rejected',next:'/me/invented',expected:'/me'},
  {name:'generic local navigation remains email-neutral',next:'/docs',expected:'/me'},
  {name:'external navigation is rejected',next:'https://outside.invalid/me/products',expected:'/me'},
  {name:'plain portal does not add redundant next',next:'/me',expected:'/me'},
 ];
 for(const item of continuationCases){
  const s=await open(390,'light',item.next),p=s.page;await email(p);
  check(s.state.calls.length===0,`${item.name}: opening the continuation never sends automatically`);
  await p.getByRole('button',{name:'Recibir código',exact:true}).click();await p.getByRole('textbox',{name:'Código de acceso',exact:true}).waitFor();
  checkPayload(starts(s.state)[0].payload,item.expected==='/me'?{email:'persona@example.test'}:{email:'persona@example.test',next:item.expected},`${item.name}: actual email request has the expected sanitized payload`);
  check(starts(s.state).length===1,`${item.name}: email is sent only once`);
  report.scenarios.push({name:'email-start-continuation-contract',case:item.name,input:item.next,requests:s.state.calls});await s.context.close();
 }
 const slow=await open();await email(slow.page);slow.state.holdStart=true;await slow.page.locator('form').evaluate(form=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});await slow.page.waitForFunction(()=>document.querySelector('form')?.getAttribute('aria-busy')==='true');check(await slow.page.getByRole('textbox',{name:'Correo electrónico',exact:true}).isDisabled(),'Pending request holds stable contact');await slow.page.getByRole('status').filter({hasText:'No pudimos confirmar la solicitud.'}).waitFor({timeout:16000});check(slow.state.calls.filter(c=>c.path.endsWith('/start')).length===1,'Double submit and timeout never retry automatically');check(await slow.page.getByRole('textbox',{name:'Correo electrónico',exact:true}).inputValue()==='persona@example.test','Timeout preserves contact');check(await slow.page.locator('form').getAttribute('aria-busy')==='false','Timeout exits busy state');check((await slow.page.getByRole('status').innerText()).includes('mensaje llegue igualmente'),'Interrupted send does not claim delivery failed');await slow.context.close();
 for(const kind of ['legacy-code','magic-token']){
  const cancelled=await open(),p=cancelled.page,state=cancelled.state;state.holdVerify=true;state.verifyHttp=404;
  const query=kind==='legacy-code'?'autoverify=1':'t=synthetic-only';
  const requested=p.waitForRequest(request=>new URL(request.url()).pathname==='/api/consumer/auth/verify');
  await p.evaluate(query=>history.pushState(null,'',`/login?consumer=1&next=%2Fdocs&${query}&contact=persona%40example.test&code=135791`),query);await requested;
  await p.waitForFunction(()=>document.querySelector('.consumer-login-panel form')?.getAttribute('aria-busy')==='true');
  check(await p.getByRole('textbox',{name:'Código de acceso',exact:true}).isDisabled(),`${kind} automatic verification is initially busy`);
  await p.evaluate(()=>history.pushState(null,'','/login?consumer=1&next=%2Fdocs'));
  await p.waitForFunction(()=>document.querySelector('.consumer-login-panel form')?.getAttribute('aria-busy')==='false');
  const retainedCode=p.getByRole('textbox',{name:'Código de acceso',exact:true});
  check(await p.getByRole('textbox',{name:'Correo electrónico',exact:true}).inputValue()==='persona@example.test',`${kind} removing automatic URL preserves contact`);
  check(await retainedCode.inputValue()==='135791',`${kind} removing automatic URL preserves code`);
  check(await p.locator('.consumer-login-panel input:disabled,.consumer-login-panel button:disabled,.consumer-login-panel select:disabled').count()===0,`${kind} removing automatic URL restores all form controls`);
  check(await retainedCode.evaluate(node=>node===document.activeElement),`${kind} cancelled verification restores code focus`);
  const interruption=await p.getByRole('status').innerText();check(interruption.includes('La verificación se interrumpió.'),`${kind} cancelled verification explains interruption`);
  check(typeof state.releaseVerify==='function',`${kind} verification response is held locally`);
  const lateResponse=p.waitForResponse(response=>new URL(response.url()).pathname==='/api/consumer/auth/verify'&&response.status()===404);state.releaseVerify();await(await lateResponse).finished();await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  check(await p.locator('form').getAttribute('aria-busy')==='false',`${kind} late denial cannot restore busy state`);
  check(await p.getByRole('status').innerText()===interruption,`${kind} late denial cannot replace current feedback`);
  check(await retainedCode.inputValue()==='135791'&&await p.getByRole('textbox',{name:'Correo electrónico',exact:true}).inputValue()==='persona@example.test',`${kind} late denial cannot discard retained draft`);
  check(new URL(p.url()).pathname==='/login'&&!new URL(p.url()).searchParams.has('autoverify')&&!new URL(p.url()).searchParams.has('t'),`${kind} late response cannot redirect or restore automatic URL`);
  check(state.calls.length===1&&state.calls[0].path.endsWith('/verify')&&state.calls[0].method==='POST',`${kind} abandoned verification has one request and no automatic retry or session check`);await cancelled.context.close();
 }
 check(report.externalWrites===0,'No writes left local intercepted fixtures');check(report.blockedBusinessWrites.length===0,'No business mutations were attempted');check(report.geolocationCalls===0,'No location calls across access or product continuation');check(report.errors.length===0,'No client exceptions');report.status='passed';
}catch(error){report.status='failed';report.error=error.stack;const p=browser.contexts().at(-1)?.pages().at(-1);if(p){report.visible=(await p.locator('body').innerText()).slice(0,10000);await p.screenshot({path:join(output,'failure.png'),fullPage:true}).catch(()=>{});}throw error;}
finally{
 report.helperHashesEnd=await helperHashes();report.helpersUnchanged=isDeepStrictEqual(report.helperHashesStart,report.helperHashesEnd);
 report.checks.push({name:'Browser and private-fetch helpers stayed unchanged during the run',passed:report.helpersUnchanged});
 if(!report.helpersUnchanged){report.status='failed';report.error=`${report.error||''}\nTest or fixture helper changed during execution.`;process.exitCode=1;}
 report.sourceBindingEnd=await sourceBinding();report.sourceAndBuildUnchanged=isDeepStrictEqual(report.sourceBindingStart,report.sourceBindingEnd);
 report.checks.push({name:'Source trees, dependencies, release and production build stayed unchanged during the run',passed:report.sourceAndBuildUnchanged});
 if(!report.sourceAndBuildUnchanged){report.status='failed';report.error=`${report.error||''}\nSource or production build changed during execution.`;process.exitCode=1;}
 await browser.close();next.kill();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2),{flag:'wx'});await writeFile(join(output,'next.log'),log,{flag:'wx'});
 await writeFile(join(output,'manifest.json'),JSON.stringify({qaSource:sourceBindingStart.qaSource,buildId:sourceBindingStart.buildId,release:sourceBindingStart.release,sourceFingerprint:sourceBindingStart.sourceFingerprint,sourceAndBuildUnchanged:report.sourceAndBuildUnchanged,helpersUnchanged:report.helpersUnchanged,sourceBindingStart,sourceBindingEnd:report.sourceBindingEnd,helperHashesStart,helperHashesEnd:report.helperHashesEnd},null,2),{flag:'wx'});
 console.log(JSON.stringify({status:report.status,checks:report.checks.length,views:report.views.length,scenarios:report.scenarios.length,error:report.error,errors:report.errors,blockedBusinessWrites:report.blockedBusinessWrites.length,output}));
}
