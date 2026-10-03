// Actual production Next pages. Every identity, OTP and HTTP acknowledgement is a local fixture.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const web=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(web,'../..');
const output=resolve(process.env.QA_OUTPUT||'artifacts/client-access');await mkdir(output,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(k)));
Object.assign(env,{NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'});
const next=spawn(process.execPath,[join(repo,'node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:web,env,windowsHide:true});let log='';next.stdout.on('data',d=>log+=d);next.stderr.on('data',d=>log+=d);
const origin=`http://127.0.0.1:${port}`;
for(let i=0;i<120;i++){try{if((await fetch(origin+'/release.json')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));if(i===119){next.kill();throw Error('local_next_server_unavailable');}}
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
const report={realNextProductionPages:true,syntheticContactsAndAcknowledgements:true,realAuthenticationCertified:false,checks:[],views:[],errors:[],externalWrites:0};
const check=(value,name)=>{report.checks.push({name,passed:Boolean(value)});assert.ok(value,name);};
async function open(width=390,theme='light'){
 const context=await browser.newContext({viewport:{width,height:844},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'});
 await context.addCookies([{name:'theme',value:theme,url:origin},{name:'nexid_theme_version',value:'white-first-v2',url:origin}]);
 await context.addInitScript(()=>{window.__geoCalls=0;Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){window.__geoCalls++;throw Error('Unexpected location request');}}});});
 const page=await context.newPage(),state={calls:[],start:{ok:true,delivery:{channel:'email',status:'accepted'}},verify:{ok:false},verifyHttp:400,session:{ok:true,authenticated:false},sessionHttp:200,holdStart:false,holdVerify:false,releaseVerify:null};
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('**/*',async route=>{const request=route.request(),u=new URL(request.url());if(u.origin!==origin){if(request.method()!=='GET')report.externalWrites++;return route.abort();}
  if(u.pathname.startsWith('/api/consumer/')){
   state.calls.push({path:u.pathname,method:request.method()});
   if(u.pathname.endsWith('/logout'))return route.fulfill({json:{ok:true}});
   if(u.pathname.endsWith('/start')){if(state.holdStart)return;return route.fulfill({status:state.start.ok?200:503,json:state.start});}
   if(u.pathname.endsWith('/verify')){if(state.holdVerify)await new Promise(release=>{state.releaseVerify=release;});return route.fulfill(state.verify==='malformed'?{status:200,contentType:'text/html',body:'<!doctype html>upstream'}:{status:state.verifyHttp,json:state.verify});}
   if(u.pathname.endsWith('/session'))return route.fulfill({status:state.sessionHttp,json:state.session});
   return route.fulfill({status:404,json:{ok:false}});
  }
  if(request.method()!=='GET')return route.abort();return route.continue();
 });
 await page.goto(origin+'/login?consumer=1&next=%2Fdocs',{waitUntil:'networkidle'});return{context,page,state};
}
async function email(page){await page.getByRole('button',{name:'Email',exact:true}).click();await page.getByRole('textbox',{name:'Correo electrónico',exact:true}).fill('persona@example.test');}
async function assess(page,selector,name,width,theme){await page.addScriptTag({content:axe});const violations=await page.evaluate(async selector=>(await axe.run(selector,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})),selector);check(violations.filter(v=>['serious','critical'].includes(v.impact)).length===0,`${name} accessibility ${width} ${theme}`);check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} no overflow ${width} ${theme}`);await page.screenshot({path:join(output,`${name}-${width}-${theme}.png`),fullPage:true});report.views.push({name,width,theme,violations});}
try{
 for(const width of [320,390,768,1440])for(const theme of ['light','dark']){
  const s=await open(width,theme),p=s.page;await email(p);
  check(await p.locator('html').getAttribute('data-theme')===theme,`Requested login theme ${width} ${theme}`);
  const controls=await p.locator('.consumer-login-panel button,.consumer-login-panel input,.consumer-login-panel select').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().height>0).map(n=>({height:n.getBoundingClientRect().height,font:getComputedStyle(n).fontSize,tag:n.tagName})));
  check(controls.every(c=>c.height>=44),`Login controls at least 44px ${width} ${theme}`);check(controls.filter(c=>c.tag==='INPUT').every(c=>parseFloat(c.font)>=16),`Login inputs prevent mobile zoom ${width} ${theme}`);
  await assess(p,'.consumer-login-panel','login-contact',width,theme);await p.getByRole('button',{name:'Recibir código',exact:true}).click();await p.getByRole('textbox',{name:'Código de acceso',exact:true}).waitFor();await p.waitForFunction(()=>document.activeElement?.id==='consumer-access-code');
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
 for(const error of ['twilio_delivery_failed','twilio_authentication_failed']) {
  const recovery=await open(390,'dark'),p=recovery.page;
  check(await p.getByRole('button',{name:'Email',exact:true}).getAttribute('aria-pressed')==='true','Email is the initial channel');
  await email(p);await p.getByRole('button',{name:'WhatsApp',exact:true}).click();
  await p.getByRole('textbox',{name:'Número de teléfono sin código de país',exact:true}).fill('1155551234');
  recovery.state.start={ok:false,error};await p.getByRole('button',{name:'Recibir código',exact:true}).click();
  await p.getByRole('button',{name:'Continuar con email',exact:true}).waitFor();
  check(await p.getByRole('textbox',{name:'Código de acceso',exact:true}).count()===0,`${error} never claims a sent challenge`);
  const callsBefore=recovery.state.calls.length;
  await p.getByRole('button',{name:'Continuar con email',exact:true}).click();
  const retainedEmail=p.getByRole('textbox',{name:'Correo electrónico',exact:true});
  await p.waitForFunction(()=>document.activeElement?.type==='email');
  check(await retainedEmail.inputValue()==='persona@example.test',`${error} preserves email draft and focus`);
  check(recovery.state.calls.length===callsBefore,`${error} switching channels never sends automatically`);
  check(new URL(p.url()).searchParams.get('next')==='/docs',`${error} preserves return context`);
  recovery.state.start={ok:true,delivery:{channel:'email',status:'accepted'}};
  await p.getByRole('button',{name:'Recibir código',exact:true}).click();await p.getByRole('textbox',{name:'Código de acceso',exact:true}).waitFor();
  check(recovery.state.calls.filter(c=>c.path.endsWith('/start')).length===2,`${error} fallback is explicitly requested once`);
  await p.getByRole('button',{name:'Cambiar contacto',exact:true}).click();await p.getByRole('button',{name:'WhatsApp',exact:true}).click();
  check(await p.getByRole('textbox',{name:'Número de teléfono sin código de país',exact:true}).inputValue()==='1155551234',`${error} retains phone draft too`);
  await recovery.context.close();
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
 check(report.externalWrites===0,'No writes left local intercepted fixtures');check(report.errors.length===0,'No client exceptions');report.status='passed';
}catch(error){report.status='failed';report.error=error.stack;const p=browser.contexts().at(-1)?.pages().at(-1);if(p){report.visible=(await p.locator('body').innerText()).slice(0,10000);await p.screenshot({path:join(output,'failure.png'),fullPage:true}).catch(()=>{});}throw error;}
finally{await browser.close();next.kill();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));await writeFile(join(output,'next.log'),log);console.log(JSON.stringify({status:report.status,checks:report.checks.length,views:report.views.length,error:report.error,errors:report.errors}));}
