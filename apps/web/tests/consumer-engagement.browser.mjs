// Real Next production pages and client components on loopback. Synthetic API
// reads only; no provider/database/physical-NFC/booking/customer acceptance.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const web=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(web,'../..');
const output=resolve(process.env.QA_OUTPUT||join(repo,`artifacts/consumer-engagement-20261003-${Date.now()}`));
const auditPath=join(output,'synthetic-api-audit.jsonl');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright-core');
const axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
await mkdir(dirname(output),{recursive:true});
// Evidence is immutable across runs: a supplied existing directory is rejected.
await mkdir(output);
await writeFile(auditPath,'',{flag:'wx'});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
let next=null,base='',serverFailed=false;
const report={localOnly:true,realProductionBuild:true,actualNextRouter:true,syntheticApiReads:true,physicalTapMeasured:false,realBusinessMutations:false,humanAcceptance:false,checks:[],views:[],pageErrors:[],blockedBrowserWrites:[],blockedExternalRequests:[],syntheticAiRequests:[],geolocationCalls:0};
const check=(value,name)=>{report.checks.push({name,passed:Boolean(value)});assert.ok(value,name);};
const contentSelector='#consumer-portal-content';
const scenarios=['populated','empty','unavailable','partial-review-failure','partial-offer-failure'];

async function auditRows(){return (await readFile(auditPath,'utf8')).split('\n').filter(Boolean).map(line=>JSON.parse(line));}
async function isolate(width,theme,scenario,authenticated=true){
 const context=await browser.newContext({viewport:{width,height:900},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'});
 const cookies=[{name:'consumer_engagement_scenario',value:scenario,url:base,httpOnly:true,sameSite:'Lax'},{name:'theme',value:theme,url:base},{name:'nexid_theme_version',value:'white-first-v2',url:base}];
 if(authenticated)cookies.push({name:'consumer_qa',value:'local',url:base,httpOnly:true,sameSite:'Lax'});
 await context.addCookies(cookies);
 await context.exposeBinding('__qaLocationCall',()=>{report.geolocationCalls++;});
 await context.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){void window.__qaLocationCall();throw Error('Unexpected location request');},watchPosition(){void window.__qaLocationCall();throw Error('Unexpected location watch');}}});});
 const page=await context.newPage();
 page.on('pageerror',error=>report.pageErrors.push({width,theme,scenario,message:error.message}));
 let intentionalSubmission=false;
 await page.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());
  if(scenario==='sommelier-failure'&&url.pathname==='/api/sommelier/chat'&&request.method()==='POST'){
   report.syntheticAiRequests.push({width,theme,intentionalSubmission,payload:request.postDataJSON()});
   return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'synthetic_local_unavailable'})});
  }
  if(!['GET','HEAD'].includes(request.method())){report.blockedBrowserWrites.push({width,theme,scenario,path:url.pathname,method:request.method(),intentionalSubmission});return route.abort('failed');}
  if(!['localhost','127.0.0.1'].includes(url.hostname)&&!['data:','blob:'].includes(url.protocol)){report.blockedExternalRequests.push({width,theme,scenario,path:url.pathname});return route.abort('blockedbyclient');}
  return route.continue();
 });
 return {context,page,submitIsolated:async action=>{intentionalSubmission=true;try{await action();}finally{intentionalSubmission=false;}}};
}
async function assess(page,name,width,theme,scope='[data-testid="consumer-experiences"]'){
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}/${theme}/${name}: no horizontal overflow`);
 check(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),`${width}/${theme}/${name}: reduced motion enabled`);
 await page.addScriptTag({content:axe});
 const violations=await page.evaluate(async selector=>(await axe.run(selector,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})),contentSelector);
 report.views.push({width,theme,name,violations});
 await page.screenshot({path:join(output,`${name}-${width}-${theme}.png`),fullPage:true});
 check(violations.length===0,`${width}/${theme}/${name}: zero axe violations`);
 const shortTargets=await page.locator(`${scope} a,${scope} button,${scope} summary`).evaluateAll(elements=>elements.filter(element=>element.getClientRects().length&&getComputedStyle(element).visibility!=='hidden').filter(element=>element.getBoundingClientRect().height<43.9).map(element=>({text:element.textContent.trim(),height:element.getBoundingClientRect().height})));
 check(shortTargets.length===0,`${width}/${theme}/${name}: visible actions have 44px touch targets`);
}
async function focused(locator){
 await locator.focus();
 return locator.evaluate(async element=>{
  for(let frame=0;frame<30;frame++){
   const style=getComputedStyle(element),parent=getComputedStyle(element.closest('label')||element);
   if(element===document.activeElement&&(parseFloat(style.outlineWidth)>=2||parseFloat(parent.outlineWidth)>=2))return true;
   await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  return false;
 });
}
function section(page,id){return page.locator(`section[aria-labelledby="${id}"]`);}

try{
 const reserve=createServer();await new Promise(resolve=>reserve.listen(0,'127.0.0.1',resolve));const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(key)));
 Object.assign(env,{NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',CONSUMER_ENGAGEMENT_QA:'1',QA_API_AUDIT:auditPath,CONSUMER_ENGAGEMENT_API_ORIGIN:process.env.CONSUMER_ENGAGEMENT_API_ORIGIN||'https://api.nexid.lat'});
 next=spawn(process.execPath,['--import',pathToFileURL(join(web,'tests/consumer-engagement-local-fetch.mjs')).href,join(repo,'node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:web,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 next.stdout.on('data',()=>{});next.stderr.on('data',()=>{});next.on('error',()=>{serverFailed=true;});
 base=`http://127.0.0.1:${port}`;let ready=false;
 for(let attempt=0;attempt<120;attempt++){
  if(serverFailed||next.exitCode!==null)break;
  try{if((await fetch(base+'/release.json',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 check(ready,'isolated Next production build starts on loopback');
 for(const theme of ['light','dark'])for(const width of [320,390,768,1440]){
  for(const scenario of scenarios){
   const {context,page}=await isolate(width,theme,scenario);
   await page.goto(base+'/me/experiences',{waitUntil:'networkidle',timeout:90000});
   await page.getByTestId('consumer-experiences').waitFor();
   const reviews=section(page,'experience-reviews-title'),offers=section(page,'experience-offers-title');
   const hasReviews=['populated','partial-offer-failure'].includes(scenario),hasOffers=['populated','partial-review-failure'].includes(scenario);
   const reviewsUnavailable=['unavailable','partial-review-failure'].includes(scenario),offersUnavailable=['unavailable','partial-offer-failure'].includes(scenario);
   check(await reviews.getByRole('article').count()===(hasReviews?2:0),`${width}/${theme}/${scenario}: only available review rows shown`);
   check(await offers.getByRole('article').count()===(hasOffers?2:0),`${width}/${theme}/${scenario}: only available proposal rows shown`);
   check(await reviews.getByRole('heading',{name:'No pudimos cargar tus comentarios',exact:true}).count()===(reviewsUnavailable?1:0),`${width}/${theme}/${scenario}: failed reviews retain unavailable status`);
   check(await offers.getByRole('heading',{name:'No pudimos consultar las propuestas',exact:true}).count()===(offersUnavailable?1:0),`${width}/${theme}/${scenario}: failed proposals retain unavailable status`);
   check(await page.getByText('Todavía no hay comentarios en tu cuenta',{exact:true}).count()===(scenario==='empty'?1:0),`${width}/${theme}/${scenario}: review empty state requires valid empty source`);
   check(await page.getByText('No hay propuestas para mostrar en esta cuenta',{exact:true}).count()===(scenario==='empty'?1:0),`${width}/${theme}/${scenario}: proposal empty state requires valid empty source`);
   check(await page.getByTestId('verified-experience-form').count()===0,`${width}/${theme}/${scenario}: generic entry guides saved-product selection`);
   if(hasReviews){
    check((await reviews.innerText()).includes('Gracias por tu comentario de ensayo. <script>window.__fixtureScriptExecuted = true</script>'),`${width}/${theme}/${scenario}: brand reply renders as plain text`);
    check(await page.evaluate(()=>window.__fixtureScriptExecuted!==true),`${width}/${theme}/${scenario}: source reply cannot execute HTML`);
    check(await reviews.getByLabel('4 de 5 estrellas',{exact:true}).count()===1&&await reviews.getByText('Puntaje no informado',{exact:true}).count()===1,`${width}/${theme}/${scenario}: ratings use reported values`);
    check((await reviews.innerText()).includes('Aprobada por la marca')&&(await reviews.innerText()).includes('En revisión')&&(await reviews.innerText()).includes('Pública')&&(await reviews.innerText()).includes('Privada'),`${width}/${theme}/${scenario}: reported moderation and visibility remain distinct`);
    const record=reviews.getByText('Ver registros asociados',{exact:true});check(await focused(record),`${width}/${theme}/${scenario}: records summary has visible keyboard focus`);
    await page.keyboard.press('Enter');await reviews.getByText('Lectura digital asociada',{exact:true}).waitFor();
    check((await reviews.innerText()).includes('Foto aportada')&&!(await reviews.innerText()).includes('Puntaje de confianza reportado'),`${width}/${theme}/${scenario}: no uncomputed trust score inferred`);
   }
   if(hasOffers){
    check(await offers.getByRole('link',{name:'Consultar beneficios',exact:true}).count()===1,`${width}/${theme}/${scenario}: malformed tenant has no benefits destination`);
    check(await offers.getByRole('link',{name:'Consultar beneficios',exact:true}).getAttribute('href')==='/me/rewards?tenant=consumer-qa',`${width}/${theme}/${scenario}: proposal opens tenant benefits safely`);
   }
   const content=await page.locator(contentSelector).innerText();
   check(!/Reserva confirmada|Reservas y visitas|Historial de visitas|999\s*puntos|Trust\s*99/.test(content),`${width}/${theme}/${scenario}: no bookings, points or trust manufactured`);
   const pick=page.getByRole('link',{name:'Elegir un producto',exact:true});check(await focused(pick),`${width}/${theme}/${scenario}: product selection has visible keyboard focus`);
   if(reviewsUnavailable||offersUnavailable){const retry=page.getByRole('button',{name:'Reintentar carga',exact:true}).first();check(await focused(retry),`${width}/${theme}/${scenario}: retry has visible keyboard focus`);await page.keyboard.press('Enter');await retry.waitFor({state:'visible'});}
   await assess(page,scenario,width,theme);await context.close();
  }
  const isolated=await isolate(width,theme,'selected'),{context,page}=isolated;
  await page.goto(base+'/me/experiences?eventId=900001&product=Vino+de+ensayo+QA&tenant=consumer-qa',{waitUntil:'networkidle'});
  const form=page.getByTestId('verified-experience-form');await form.waitFor();
  check((await form.innerText()).includes('#900001; se comprueba al enviar'),`${width}/${theme}/selected: query reference remains subject to server verification`);
  const comment=form.getByRole('textbox',{name:'Comentario',exact:true}),title=form.getByRole('textbox',{name:'Titulo corto',exact:true}),submit=form.getByRole('button',{name:'Enviar experiencia',exact:true});
  check(await submit.isDisabled(),`${width}/${theme}/selected: empty comment cannot submit`);
  const five=form.getByRole('radio',{name:'5 estrellas',exact:true});check(await focused(five),`${width}/${theme}/selected: stars have visible keyboard focus`);
  await page.keyboard.press('ArrowLeft');check(await form.getByRole('radio',{name:'4 estrellas',exact:true}).isChecked(),`${width}/${theme}/selected: star selection works by keyboard`);
  check(await focused(comment),`${width}/${theme}/selected: comment has visible keyboard focus`);
  await title.fill('Ensayo local de conservación');await comment.fill('Comentario sintético: debe conservarse después de un fallo de red.');
  check(await submit.isEnabled(),`${width}/${theme}/selected: valid draft enables explicit submit`);
  check(await form.locator('input:not([type="radio"]):not([type="file"]),textarea').evaluateAll(elements=>elements.filter(element=>element.getClientRects().length).every(element=>parseFloat(getComputedStyle(element).fontSize)>=16)),`${width}/${theme}/selected: fields have 16px legible text`);
  await assess(page,'selected-form',width,theme);
  await isolated.submitIsolated(async()=>{await submit.focus();await page.keyboard.press('Enter');await form.getByRole('alert').waitFor();});
  check(await comment.inputValue()==='Comentario sintético: debe conservarse después de un fallo de red.'&&await title.inputValue()==='Ensayo local de conservación',`${width}/${theme}/selected: aborted submission preserves the draft`);
  check((await form.getByRole('alert').innerText()).includes('No pudimos confirmar que se haya guardado')&&await form.getByRole('status').count()===0,`${width}/${theme}/selected: aborted write has no success receipt`);
  await assess(page,'selected-form-error',width,theme);
  for(const query of ['eventId=900001&eventId=900002','eventId=01','eventId=0','eventId=9223372036854775808']){
   await page.goto(base+'/me/experiences?'+query,{waitUntil:'networkidle'});await page.getByTestId('consumer-experiences').waitFor();
   check(await page.getByTestId('verified-experience-form').count()===0&&await page.getByRole('link',{name:'Elegir un producto',exact:true}).count()===1,`${width}/${theme}: ambiguous or noncanonical event rejected: ${query}`);
  }
  await context.close();
  const sommelier=await isolate(width,theme,width===390&&theme==='light'?'sommelier-failure':'sommelier');
  await sommelier.page.goto(base+'/me/sommelier',{waitUntil:'networkidle'});
  const conversation=sommelier.page.getByTestId('sommelier-conversation');await conversation.waitFor();
  check((await conversation.innerText()).includes('No seleccionaste un producto')&&(await conversation.innerText()).includes('Sin producto seleccionado')&&(await conversation.innerText()).includes('Sin marca seleccionada'),`${width}/${theme}/sommelier: generic assistant has no fabricated product or brand`);
  const question=conversation.getByRole('textbox',{name:'Tu pregunta sobre vinos',exact:true}),send=conversation.getByRole('button',{name:'Enviar consulta',exact:true});
  check(await send.isDisabled(),`${width}/${theme}/sommelier: empty question cannot send`);
  check(await focused(question),`${width}/${theme}/sommelier: question has visible keyboard focus`);
  check(await question.evaluate(element=>parseFloat(getComputedStyle(element).fontSize)>=16),`${width}/${theme}/sommelier: actual global styles retain 16px question text`);
  const starter=conversation.getByRole('button',{name:'Elegir un maridaje',exact:true});check(await focused(starter),`${width}/${theme}/sommelier: starter has visible keyboard focus`);
  const aiBefore=report.syntheticAiRequests.length;
  await sommelier.page.keyboard.press('Enter');
  check(await question.inputValue()==='¿Qué debería tener en cuenta para elegir un maridaje?'&&await question.evaluate(element=>element===document.activeElement),`${width}/${theme}/sommelier: starter prepares an editable question and moves focus`);
  check(report.syntheticAiRequests.length===aiBefore,`${width}/${theme}/sommelier: selecting a starter never automatically sends`);
  await assess(sommelier.page,'sommelier',width,theme,'[data-testid="sommelier-conversation"]');
  if(width===390&&theme==='light'){
   await sommelier.submitIsolated(async()=>{await send.focus();await sommelier.page.keyboard.press('Enter');await conversation.getByText('Guía local',{exact:true}).waitFor();});
   check(await question.inputValue()==='¿Qué debería tener en cuenta para elegir un maridaje?',`${width}/${theme}/sommelier: failed synthetic query retains editable question`);
   check((await conversation.getByRole('status').innerText()).includes('La guía local no confirma una respuesta de IA')&&await conversation.getByText('Respuesta de IA no confirmada',{exact:true}).count()===1,`${width}/${theme}/sommelier: service failure is disclosed separately from local guidance`);
   check(await conversation.getByText('Respuesta con IA',{exact:true}).count()===0,`${width}/${theme}/sommelier: failed request never claims a live AI response`);
   await conversation.getByText('Origen y alcance de esta respuesta',{exact:true}).click();
   await assess(sommelier.page,'sommelier-failure',width,theme,'[data-testid="sommelier-conversation"]');
  }
  await sommelier.page.goto(base+'/me/sommelier?product=Vino+de+ensayo+QA&brand=Bodega+sint%C3%A9tica',{waitUntil:'networkidle'});await conversation.waitFor();
  check(!(await conversation.innerText()).includes('Vino de ensayo QA')&&!(await conversation.innerText()).includes('Bodega sintética')&&(await conversation.innerText()).includes('Sin producto seleccionado'),`${width}/${theme}/sommelier: URL product and brand cannot become trusted context`);
  await sommelier.context.close();
 }
 const {context,page}=await isolate(390,'light','denied',false);
 await page.goto(base+'/me/experiences?eventId=900001&product=Vino+de+ensayo+QA&tenant=consumer-qa',{waitUntil:'networkidle'});
 await page.waitForURL(url=>url.pathname==='/login');
 check(new URL(page.url()).searchParams.get('next')==='/me/experiences?eventId=900001&product=Vino+de+ensayo+QA&tenant=consumer-qa','denied session retains the safe TAP continuation for login');
 await context.close();
 const apiRows=await auditRows();report.apiAudit={requests:apiRows.length,blocked:apiRows.filter(row=>row.blocked),deniedRequests:apiRows.filter(row=>row.scenario==='denied')};
 check(!apiRows.some(row=>row.scenario==='denied'&&row.path.startsWith('/consumer/')&&row.path!=='/consumer/session'),'denied session makes no private API calls');
 check(report.apiAudit.blocked.length===0,'server attempts no provider requests or writes');
 check(report.syntheticAiRequests.length===1&&report.syntheticAiRequests[0].intentionalSubmission&&report.syntheticAiRequests[0].payload.mode==='consumer'&&!Object.hasOwn(report.syntheticAiRequests[0].payload,'eventId')&&!Object.hasOwn(report.syntheticAiRequests[0].payload,'productContext'),'exactly one explicit synthetic consumer AI request is fulfilled with 503 before Next/provider transport');
 check(report.blockedBrowserWrites.length===8&&report.blockedBrowserWrites.every(row=>row.intentionalSubmission&&row.path==='/api/consumer/experiences'&&row.method==='POST'),'only eight explicit synthetic submit attempts occur, all aborted before transport');
 check(report.geolocationCalls===0,'no automatic GPS calls');
 check(report.pageErrors.length===0,'zero application runtime errors');
 report.status='passed';
}catch(error){
 report.status='failed';report.error=String(error.stack);
 const page=browser.contexts().at(-1)?.pages().at(-1);if(page){report.visible=(await page.locator('body').innerText()).slice(0,10000);await page.screenshot({path:join(output,'failure.png'),fullPage:true}).catch(()=>{});}
 throw error;
}finally{
 await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({status:report.status,realProductionBuild:report.realProductionBuild,syntheticApiReads:report.syntheticApiReads,physicalTapMeasured:report.physicalTapMeasured,checks:report.checks.length,views:report.views.length,pageErrors:report.pageErrors,blockedBrowserWrites:report.blockedBrowserWrites.length,blockedExternalRequests:report.blockedExternalRequests.length,geolocationCalls:report.geolocationCalls,output},null,2));
 await browser.close();if(next&&next.exitCode===null){next.kill();await Promise.race([new Promise(resolve=>next.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,1500))]);}
}
