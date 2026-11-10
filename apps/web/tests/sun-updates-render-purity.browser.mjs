// Imported by the existing sun-tenant-actions CI component runner. No new
// server, build, provider or customer fixture is created by these scenarios.
export const SUN_UPDATES_RENDER_PURITY_FIXTURE = `
import {Suspense,startTransition} from 'react';
import {SunUpdatesOptIn} from './src/app/sun/sun-updates-opt-in';
const updatesPublication=tenantSlug=>({version:'nexid.tenant-actions.v1',status:'published',allowedActions:['lead'],program:null,trivia:null,catalogAvailable:false,tenantSlug});
const updatesA={brandName:'Marca A de ensayo',productName:'Producto A de ensayo',tenantSlug:'synthetic-a',eventId:'715',bid:'LOT-QA-A',configuration:updatesPublication('synthetic-a'),canEngage:true};
const updatesB={brandName:'Marca B de ensayo',productName:'Producto B de ensayo',tenantSlug:'synthetic-b',eventId:'716',bid:'LOT-QA-B',configuration:updatesPublication('synthetic-b'),canEngage:true};
const updatesNever=new Promise(()=>{});window.__updatesBRenderSuspensions=0;
function UpdatesSuspender({enabled}){if(enabled){window.__updatesBRenderSuspensions+=1;throw updatesNever;}return null;}
function UpdatesRenderPurityFixture(){
 const[view,setView]=useState('A'),[suspend,setSuspend]=useState(false),[cancelCount,setCancelCount]=useState(0);
 function pendingB(){startTransition(()=>{setView('B');setSuspend(true);});}
 function cancelB(){setView('A');setSuspend(false);setCancelCount(value=>value+1);}
 function commitB(){setView('B');setSuspend(false);}
 return <SunLocaleProvider initialLocale='es-AR'><main className={shell.portal} style={{padding:16,boxSizing:'border-box'}}>
  <h1 id='sun-summary'>Autorización de novedades · ensayo local</h1><p>Datos sintéticos. Sin cuentas ni mensajes reales.</p>
  <div><button type='button' onClick={pendingB}>Preparar vista B sin confirmar</button><button type='button' onClick={cancelB}>Cancelar vista pendiente</button><button type='button' onClick={commitB}>Mostrar producto B</button></div>
  <output data-testid='updates-cancel-count' aria-label='Cancelaciones de ensayo'>{cancelCount}</output>
  <Suspense fallback={<p role='status'>Vista pendiente de ensayo</p>}><section className='sun-tap-experience'>
   <SunUpdatesOptIn {...(view==='A'?updatesA:updatesB)}/><UpdatesSuspender enabled={suspend}/>
  </section></Suspense>
 </main></SunLocaleProvider>;
}
`;

async function prepareEmail(page, brand, value) {
 const panel=page.locator('#sun-updates-opt-in');
 await panel.getByRole('heading',{name:'Novedades de '+brand,exact:true}).waitFor();
 await panel.getByRole('button',{name:'Elegir canal de contacto',exact:true}).click();
 await panel.getByRole('button',{name:'Email',exact:true}).click();
 await panel.getByRole('textbox',{name:'Correo electrónico',exact:true}).fill(value);
 await panel.getByRole('checkbox').check();
 return panel;
}
async function measureUpdatesReadingLayout(panel) {
 return panel.evaluate(section=>{
  const heading=section.querySelector('h3');
  const toggle=section.querySelector('button[aria-controls="sun-updates-form"]');
  const notice=section.querySelector('#sun-updates-request-status p');
  const [whatsapp,email]=section.querySelectorAll('fieldset button[aria-pressed]');
  const wordLines=(node,word)=>{
   const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
   for(let text=walker.nextNode();text;text=walker.nextNode()){
    const start=text.data.indexOf(word);
    if(start<0)continue;
    const range=document.createRange();
    range.setStart(text,start);
    range.setEnd(text,start+word.length);
    const rects=[...range.getClientRects()].filter(rect=>rect.width>0),box=node.getBoundingClientRect();
    return {lines:rects.length,fits:rects.every(rect=>rect.left>=box.left-1&&rect.right<=box.right+1)};
   }
   return {lines:0,fits:false};
  };
  const first=whatsapp.getBoundingClientRect(),second=email.getBoundingClientRect(),formToggle=toggle.getBoundingClientRect();
  return {
   words:{heading:wordLines(heading,'Novedades'),toggle:wordLines(toggle,'formulario'),
    whatsapp:wordLines(whatsapp,'WhatsApp'),email:wordLines(email,'Email'),
    ...(notice?{noticeConfirmation:wordLines(notice,'confirmación'),noticeEnd:wordLines(notice,'pedís.')}: {})},
   channels:first.bottom<=second.top+1?'stacked':first.right<=second.left+1&&Math.abs(first.top-second.top)<=1?'row':'overlap',
   minimumTargetSize:Math.min(first.width,first.height,second.width,second.height,formToggle.width,formToggle.height),
  };
 });
}

async function nativeSubmitTwice(page){
 await page.evaluate(()=>{const form=document.querySelector('#sun-updates-form');if(!(form instanceof HTMLFormElement))throw Error('Owned updates form unavailable');form.requestSubmit();form.requestSubmit();});
}
function legacyOnly(call, tenant, event, contact){
 return call.path==='/api/leads'&&call.method==='POST'&&call.body.contact===contact&&call.body.tenantSlug===tenant&&call.body.eventId===event
  &&!Object.hasOwn(call.body,'email')&&!Object.hasOwn(call.body,'phone')&&call.body.gps?.consent===false
  &&call.body.engagement?.optIn==='brand_updates'&&call.body.engagement?.consentTextVersion==='sun_updates_v1';
}

export async function runSunUpdatesRenderPurityScenarios({scenario,assess,report,check}){
 report.sunUpdatesRenderPurity={actualReactDOMConcurrentRoot:true,realSuspenseAndTransition:true,componentFixtureOnly:true,actualNextServer:false,syntheticLeadRequestsOnly:true,cases:[]};
 for(const theme of ['light','dark']){
  const width=320,label=width+'/'+theme+'/updates-abandoned-render',t=await scenario('updates-render-purity',width,theme);
  try{
   const panel=await prepareEmail(t.page,'Marca A de ensayo','a@example.test');
   check(t.calls.length===0,label+': choosing contact and consent send nothing');
   await t.page.getByRole('button',{name:'Preparar vista B sin confirmar',exact:true}).click();
   await t.page.waitForFunction(()=>window.__updatesBRenderSuspensions>0);
   check(await panel.getByRole('heading',{name:'Novedades de Marca A de ensayo',exact:true}).isVisible()&&await panel.getByRole('heading',{name:'Novedades de Marca B de ensayo',exact:true}).count()===0,label+': real suspended transition retains committed A');
   await panel.getByRole('textbox',{name:/^Nombre/}).fill('Nombre durante espera');
   check(await panel.getByRole('textbox',{name:/^Nombre/}).inputValue()==='Nombre durante espera'&&!await panel.getByRole('checkbox').isChecked(),label+': committed A remains editable while B is suspended');
   await panel.getByRole('checkbox').check();
   await t.page.getByRole('button',{name:'Cancelar vista pendiente',exact:true}).click();
   await t.page.waitForFunction(()=>document.querySelector('[data-testid="updates-cancel-count"]')?.textContent==='1');
   check(await panel.getByRole('checkbox').isChecked()&&await panel.getByRole('textbox',{name:'Correo electrónico',exact:true}).inputValue()==='a@example.test',label+': abandoning B preserves A draft and authorization');
   await panel.getByRole('textbox',{name:/^Nombre/}).fill('Nombre A de ensayo');
   check(await panel.getByRole('textbox',{name:/^Nombre/}).inputValue()==='Nombre A de ensayo'&&!await panel.getByRole('checkbox').isChecked(),label+': committed A handlers still edit and explicitly revoke consent');
   await panel.getByRole('checkbox').check();
   const reading=await measureUpdatesReadingLayout(panel);
   check(reading.channels==='row'&&reading.minimumTargetSize>=44&&Object.values(reading.words).every(word=>word.lines===1&&word.fits),label+': regular 320px keeps readable channel buttons in a row');
   await assess(t.page,width,theme,'updates-render-purity');
   await nativeSubmitTwice(t.page);
   await panel.getByText('Suscripción solicitada',{exact:true}).waitFor();
   check(t.calls.length===1&&legacyOnly(t.calls[0],'synthetic-a','715','a@example.test'),label+': same-turn native submit sends one legacy A request');
   const confirmationContrast=await panel.locator('.sun-updates-success').evaluate(notice=>{
    const style=getComputedStyle(notice),canvas=document.createElement('canvas');
    canvas.width=canvas.height=1;
    const ctx=canvas.getContext('2d');
    const rgba=color=>{
     ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);
     return [...ctx.getImageData(0,0,1,1).data];
    };
    const luminance=([r,g,b])=>[r,g,b].map(value=>value/255)
     .reduce((sum,value,index)=>sum+[0.2126,0.7152,0.0722][index]*(value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4),0);
    const background=rgba(style.backgroundColor),base=luminance(background);
    const text=[...notice.querySelectorAll('strong,p')].map(node=>{
     const computed=getComputedStyle(node),ink=rgba(computed.color),foreground=luminance(ink);
     return {opaque:computed.opacity==='1'&&ink[3]===255,ratio:(Math.max(base,foreground)+0.05)/(Math.min(base,foreground)+0.05)};
    });
    return {opaque:background[3]===255&&style.backgroundImage==='none'&&style.opacity==='1',text};
   });
   check(confirmationContrast.opaque&&confirmationContrast.text.length===2&&confirmationContrast.text.every(({opaque,ratio})=>opaque&&ratio>=4.5),label+': confirmation heading and copy meet 4.5:1 contrast on an opaque surface');
   report.sunUpdatesRenderPurity.cases.push({width,theme,case:'abandoned-speculative-B',suspendedBObserved:true,committedARetained:true,committedAEditableWhileBPending:true,reading,confirmationContrast,syntheticRequests:t.calls.length});
  }finally{await t.close();}

  const u=await scenario('updates-render-purity',width,theme),pendingLabel=width+'/'+theme+'/updates-pending-context';
  let release=null,handler,notifyFirst; const firstIntercepted=new Promise(resolve=>{notifyFirst=resolve;});
  try{
   const panel=await prepareEmail(u.page,'Marca A de ensayo','a@example.test');
   handler=async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==new URL(u.page.url()).origin||url.pathname!=='/api/leads'||request.method()!=='POST')return route.fallback();
    const entry={path:url.pathname,method:request.method(),body:request.postDataJSON()};u.calls.push(entry);
    if(u.calls.length===1)return new Promise(resolve=>{release=async()=>{release=null;try{await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,persisted:true})});}finally{resolve();}};notifyFirst();});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,persisted:true})});
   };
   await u.page.route('**/api/leads',handler);
   await nativeSubmitTwice(u.page);
   await u.page.waitForFunction(()=>document.querySelector('#sun-updates-form')?.getAttribute('aria-busy')==='true');
   let timer;try{await Promise.race([firstIntercepted,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Owned lead interception did not start')),10000);})]);}finally{clearTimeout(timer);}
   check(u.calls.length===1&&typeof release==='function',pendingLabel+': one owned synthetic A request is pending');
   await u.page.getByRole('button',{name:'Mostrar producto B',exact:true}).click();
   await panel.getByRole('heading',{name:'Novedades de Marca B de ensayo',exact:true}).waitFor();
   check(await panel.getByRole('button',{name:'Elegir canal de contacto',exact:true}).isDisabled()&&(await panel.innerText()).includes('solicitud anterior'),pendingLabel+': owner keeps B closed while A is unresolved');
   await release();
   await panel.getByRole('button',{name:'Elegir canal de contacto',exact:true}).waitFor({state:'visible'});
   await u.page.waitForFunction(()=>!document.querySelector('#sun-updates-opt-in button[aria-controls="sun-updates-form"]')?.disabled);
   check(await panel.getByText('Suscripción solicitada',{exact:true}).count()===0&&u.calls.length===1,pendingLabel+': old A acknowledgement cannot confirm or auto-submit B');
   await panel.getByRole('button',{name:'Elegir canal de contacto',exact:true}).click();
   await panel.getByRole('button',{name:'Email',exact:true}).click();
   check(await panel.getByRole('textbox',{name:'Correo electrónico',exact:true}).inputValue()===''&&!await panel.getByRole('checkbox').isChecked(),pendingLabel+': committed B starts without A contact or consent');
   await panel.getByRole('textbox',{name:'Correo electrónico',exact:true}).fill('b@example.test');
   await panel.getByRole('checkbox').check();
   await nativeSubmitTwice(u.page);
   await panel.getByText('Suscripción solicitada',{exact:true}).waitFor();
   check(u.calls.length===2&&legacyOnly(u.calls[0],'synthetic-a','715','a@example.test')&&legacyOnly(u.calls[1],'synthetic-b','716','b@example.test'),pendingLabel+': only explicit B submission creates the second owned request');
   report.sunUpdatesRenderPurity.cases.push({width,theme,case:'pending-A-committed-B',oldAcknowledgementIgnored:true,noAutomaticRenewal:true,syntheticRequests:u.calls.length});
  }finally{try{if(release)await release();if(handler)await u.page.unroute('**/api/leads',handler);}finally{await u.close();}}
 }
 await runSunUpdatesPendingNoticeScenarios({scenario,assess,report,check});
 await runSunUpdatesRetryScenarios({scenario,assess,report,check});
}

async function runSunUpdatesRetryScenarios({scenario,assess,report,check}){
 report.sunUpdatesRetry=[];
 for(const {width,height,textSize} of [{width:277,height:568,textSize:32},{width:390,height:844,textSize:16}]){
  for(const theme of ['light','dark']){
   const trial=await scenario('updates-render-purity',width,theme),label=`${width}/${theme}/updates-retry`;
   const {page,calls}=trial;
   try{
    await page.setViewportSize({width,height});
    await page.evaluate(size=>{document.documentElement.style.fontSize=size+'px';},textSize);
    await page.route('**/api/leads',async route=>{
     const request=route.request(),url=new URL(request.url());
     if(url.origin!==new URL(page.url()).origin||url.pathname!=='/api/leads'||request.method()!=='POST')return route.fallback();
     calls.push({path:url.pathname,method:request.method(),body:request.postDataJSON()});
     const first=calls.length===1;
     return route.fulfill({status:first?503:200,contentType:'application/json',body:JSON.stringify(first?{ok:false}:{ok:true,persisted:true})});
    });
    const panel=await prepareEmail(page,'Marca A de ensayo','a@example.test');
    const name=panel.getByRole('textbox',{name:/^Nombre/}),consent=panel.getByRole('checkbox');
    await name.fill('Nombre de ensayo');
    await consent.check();
    await panel.getByRole('button',{name:'Confirmar suscripción',exact:true}).click();
    const alert=panel.getByRole('alert'),retry=panel.getByRole('button',{name:'Reintentar solicitud',exact:true});
    await alert.waitFor();
    const presentation=await retry.evaluate(button=>{
     const message=document.getElementById(button.getAttribute('aria-describedby')||'');
     return message&&{
      precedes:Boolean(message.compareDocumentPosition(button)&Node.DOCUMENT_POSITION_FOLLOWING),
      readable:parseFloat(getComputedStyle(message).fontSize)>=12,
      referenced:message.id==='sun-updates-send-error'&&message.getAttribute('role')==='alert',
     };
    });
    check(presentation?.precedes&&presentation.readable&&presentation.referenced,label+': a readable alert precedes and describes the retry action');
    check(calls.length===1&&await name.inputValue()==='Nombre de ensayo'&&await consent.isChecked()&&await panel.getByRole('textbox',{name:'Correo electrónico',exact:true}).inputValue()==='a@example.test',label+': first failure keeps the draft and consent without retrying');
    await consent.focus();
    await page.keyboard.press('Tab');
    const target=await retry.boundingBox();
    check(await retry.evaluate(button=>button===document.activeElement)&&target&&target.height>=44&&target.y>=-1&&target.y+target.height<=height+1,label+': keyboard reaches the whole retry target');
    await assess(page,width,theme,`updates-retry-text${textSize}`);
    await page.keyboard.press('Enter');
    await panel.getByText('Suscripción solicitada',{exact:true}).waitFor();
    check(calls.length===2&&calls.every(call=>legacyOnly(call,'synthetic-a','715','a@example.test')&&call.body.name==='Nombre de ensayo'),label+': one explicit retry sends the same authorized draft');
    check(await alert.count()===0,label+': confirmed success clears the failure alert');
    report.sunUpdatesRetry.push({width,height,textSize,theme,posts:calls.length,alertBeforeRetry:true,draftRetained:true});
   }finally{await trial.close();}
  }
 }
}

// Browser-only deterministic feedback scenarios. The response-body fixture uses
// a real browser ReadableStream after one synthetic loopback POST; it does not
// measure transport streaming, latency, delivery, persistence or physical NFC.
async function runSunUpdatesPendingNoticeScenarios({scenario,assess,report,check}){
 report.sunUpdatesPendingNotice={actualReactDOM:true,syntheticClock:false,controlled8000msCallback:true,exactThresholdOnlyInUnitTests:true,syntheticBodyStream:true,transportLatencyMeasured:false,realBusinessWrites:0,cases:[],layout:[]};
 for(const view of [{width:277,height:568,textSize:32},{width:390,height:844,textSize:16}])for(const theme of ['light','dark'])for(const phase of ['headers','body']){
  const {width,height,textSize}=view,label=`${width}x${height}/text${textSize}/${theme}/updates-pending-${phase}`,t=await scenario('updates-render-purity',width,theme);
  let releaseHeaders=null,handler=null,originalError=null,notifyIntercepted;const cleanupErrors=[],intercepted=new Promise(resolve=>{notifyIntercepted=resolve;});
  try{
   await t.page.setViewportSize({width,height});
   await t.page.evaluate(size=>{document.documentElement.style.fontSize=size+'px';},textSize);
   await t.page.evaluate(phase=>{
    const nativeFetch=window.fetch.bind(window),schedule=window.setTimeout.bind(window),cancel=window.clearTimeout.bind(window);
    const probe=window.__updatesPendingProbe={posts:0,headersReceived:0,jsonStarted:0,signalAborts:0,bodyCancels:0,bodyWaiting:false,releasedBodies:0,timers:[]};
    // Synthetic control of the notice callback only; Date, RAF and other timers stay native.
    let nextOwnedTimer=-1;
    window.setTimeout=(callback,delay,...args)=>{
     if(delay!==8000||typeof callback!=='function')return schedule(callback,delay,...args);
     const timer={id:nextOwnedTimer--,active:true,fired:false,requestedDelayMs:delay,fire(){if(!timer.active)throw Error('Owned notice timer is not active');timer.active=false;timer.fired=true;callback(...args);}};
     probe.timers.push(timer);return timer.id;
    };
    window.clearTimeout=id=>{const timer=probe.timers.find(timer=>timer.id===id);if(timer){timer.active=false;return;}return cancel(id);};
    window.__updatesFirePendingNotice=()=>{const timers=probe.timers.filter(timer=>timer.active);if(timers.length!==1)throw Error('Expected one owned pending-notice callback');timers[0].fire();};
    window.fetch=async(input,init)=>{
     const url=new URL(input instanceof Request?input.url:String(input),location.href),method=init?.method??(input instanceof Request?input.method:'GET');
     if(url.origin!==location.origin||url.pathname!=='/api/leads'||method.toUpperCase()!=='POST')return nativeFetch(input,init);
     probe.posts++;const signal=init?.signal??(input instanceof Request?input.signal:null);
     if(signal){if(signal.aborted)probe.signalAborts++;signal.addEventListener('abort',()=>probe.signalAborts++,{once:true});}
     const received=await nativeFetch(input,init);probe.headersReceived++;
     if(phase!=='body'||probe.posts!==1)return received;
     const payload=await received.text();
     const stream=new ReadableStream({start(controller){probe.bodyWaiting=true;window.__updatesReleasePendingBody=()=>{if(!probe.bodyWaiting)throw Error('Owned body already released');probe.bodyWaiting=false;probe.releasedBodies++;controller.enqueue(new TextEncoder().encode(payload));controller.close();window.__updatesReleasePendingBody=null;};},cancel(){probe.bodyWaiting=false;probe.bodyCancels++;}});
     const response=new Response(stream,{status:received.status,statusText:received.statusText,headers:received.headers}),json=response.json.bind(response);
     response.json=()=>{probe.jsonStarted++;return json();};return response;
    };
   },phase);
   handler=async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==new URL(t.page.url()).origin||url.pathname!=='/api/leads'||request.method()!=='POST')return route.fallback();
    t.calls.push({path:url.pathname,method:request.method(),body:request.postDataJSON()});notifyIntercepted();
    const reply=()=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,persisted:true})});
    if(phase==='headers'&&t.calls.length===1)return new Promise(resolve=>{releaseHeaders=async()=>{releaseHeaders=null;try{await reply();}finally{resolve();}};});
    return reply();
   };
   await t.page.route('**/api/leads',handler);
   const panel=await prepareEmail(t.page,'Marca A de ensayo','a@example.test');
   check(t.calls.length===0,label+': draft and explicit consent send nothing');
   await nativeSubmitTwice(t.page);
   let interceptionDeadline;try{await Promise.race([intercepted,new Promise((_,reject)=>{interceptionDeadline=setTimeout(()=>reject(Error('Owned pending-notice POST interception did not start')),10000);})]);}finally{clearTimeout(interceptionDeadline);}
   await t.page.waitForFunction(()=>document.querySelector('#sun-updates-form')?.getAttribute('aria-busy')==='true'&&window.__updatesPendingProbe.posts===1&&window.__updatesPendingProbe.timers.some(timer=>timer.active));
   if(phase==='headers')check(t.calls.length===1&&typeof releaseHeaders==='function'&&await t.page.evaluate(()=>window.__updatesPendingProbe.headersReceived===0),label+': the one POST is held before response headers');
   else{await t.page.waitForFunction(()=>window.__updatesPendingProbe.headersReceived===1&&window.__updatesPendingProbe.jsonStarted===1&&window.__updatesPendingProbe.bodyWaiting);check(t.calls.length===1,label+': one response has headers while browser JSON body remains pending');}
   // The form disables its controls during submission. Test focus on a control
   // the visitor can still use, independently of the browser's native blur.
   const privacyDisclosure=panel.locator('details > summary');
   await privacyDisclosure.focus();
   check(await privacyDisclosure.evaluate(el=>el===document.activeElement),label+': privacy remains focusable while the form is busy');
   const status=panel.locator('#sun-updates-request-status');
   check(await status.getAttribute('role')==='status'&&await status.getAttribute('aria-live')==='polite'&&await status.getAttribute('aria-atomic')==='true'&&await status.evaluate(el=>!el.closest('form')&&!el.closest('[aria-busy="true"]')),label+': stable polite atomic status is outside the busy form');
   check(!(await status.innerText()).includes('Seguimos esperando la confirmación')&&await t.page.evaluate(()=>window.__updatesPendingProbe.timers.length===1&&window.__updatesPendingProbe.timers[0].requestedDelayMs===8000&&!window.__updatesPendingProbe.timers[0].fired),label+': the one8000ms notice callback is captured and has not been triggered; exact threshold belongs to unit coverage');
   await t.page.evaluate(()=>window.__updatesFirePendingNotice());
   await status.getByText('Seguimos esperando la confirmación de tu solicitud. Podría haberse guardado. Sólo la reenviamos si lo pedís.',{exact:true}).waitFor();
   check(await privacyDisclosure.evaluate(el=>el===document.activeElement),label+': the timer never moves focus');
   check(await panel.locator('#sun-updates-form').getAttribute('aria-busy')==='true'&&await panel.getByRole('button',{name:'Enviando solicitud...',exact:true}).isDisabled()&&await panel.getByRole('textbox',{name:'Correo electrónico',exact:true}).inputValue()==='a@example.test'&&await panel.getByRole('checkbox').isChecked(),label+': pending notice retains the same draft and explicit consent without unlocking');
   const link=status.getByRole('link',{name:'Volver a la ficha',exact:true});
   check(await link.getAttribute('href')==='#sun-summary'&&await t.page.locator('#sun-summary').count()===1,label+': the normal local link has one real summary destination');
   let keyboardReached=false;
   for(let step=0;step<24&&!keyboardReached;step++){await t.page.keyboard.press('Tab');keyboardReached=await link.evaluate(el=>el===document.activeElement);}
   check(keyboardReached,label+': the recovery link is reachable by keyboard while the form is busy');
   const target=await link.boundingBox();
   check(target&&target.height>=44&&target.width>0&&target.x>=-1&&target.x+target.width<=width+1&&target.y>=-1&&target.y+target.height<=height+1,label+': focused recovery link is fully visible and at least44px high');
   const layout=await status.evaluate(el=>{
    const widths=node=>node?{content:node.clientWidth,scroll:node.scrollWidth}:null;
    return {
     viewport:{content:innerWidth,scroll:document.documentElement.scrollWidth},
     notice:widths(el),
     form:widths(document.getElementById('sun-updates-form')),
     contact:widths(document.querySelector('#sun-updates-form fieldset')),
    };
   });
   const reading=await measureUpdatesReadingLayout(panel);
   report.sunUpdatesPendingNotice.layout.push({width,height,textSize,theme,phase,...layout,reading});
   check(reading.words.noticeEnd&&Object.values(reading.words).every(word=>word.lines===1&&word.fits),label+': heading, controls and final notice punctuation stay whole');
   check(reading.channels===(textSize===32?'stacked':'row')&&reading.minimumTargetSize>=44,label+': channels reflow and retain 44px touch targets');
   check(layout.notice.scroll<=layout.notice.content+1,label+': pending notice stays within its width');
   check(layout.viewport.scroll<=layout.viewport.content+1,label+': pending form stays within the viewport');
   await assess(t.page,width,theme,`updates-pending-${phase}-text${textSize}`);
   await t.page.keyboard.press('Enter');
   await t.page.waitForFunction(()=>location.hash==='#sun-summary');
   const summary=await t.page.locator('#sun-summary').boundingBox();
   check(summary&&summary.y>=-1&&summary.y<height,label+': native anchor reaches the summary in the current viewport');
   check(await panel.getByRole('textbox',{name:'Correo electrónico',exact:true}).inputValue()==='a@example.test'&&await panel.getByRole('checkbox').isChecked()&&await panel.locator('#sun-updates-form').getAttribute('aria-busy')==='true'&&t.calls.length===1,label+': anchor navigation preserves the pending form and never submits again');
   await t.page.getByRole('button',{name:'Mostrar producto B',exact:true}).click();
   await panel.getByRole('heading',{name:'Novedades de Marca B de ensayo',exact:true}).waitFor();
   await status.getByText('Seguimos esperando la confirmación de una solicitud anterior. Podría haberse guardado. Este producto todavía necesita una nueva autorización.',{exact:true}).waitFor();
   check(await panel.getByRole('button',{name:'Elegir canal de contacto',exact:true}).isDisabled()&&!((await panel.innerText()).includes('a@example.test'))&&await panel.locator('#sun-updates-form').count()===0&&t.calls.length===1,label+': B is blocked by the older flight and inherits neither contact nor authorization');
   if(releaseHeaders)await releaseHeaders();else await t.page.evaluate(()=>{if(typeof window.__updatesReleasePendingBody!=='function')throw Error('Owned pending body unavailable');window.__updatesReleasePendingBody();});
   await t.page.waitForFunction(()=>{const button=document.querySelector('#sun-updates-opt-in button[aria-controls="sun-updates-form"]');return button instanceof HTMLButtonElement&&!button.disabled;});
   check(await panel.getByText('Suscripción solicitada',{exact:true}).count()===0&&!(await status.innerText()).includes('Seguimos esperando la confirmación')&&t.calls.length===1,label+': late A acknowledgement cannot confirm or auto-submit B');
   await panel.getByRole('button',{name:'Elegir canal de contacto',exact:true}).click();await panel.getByRole('button',{name:'Email',exact:true}).click();
   check(await panel.getByRole('textbox',{name:'Correo electrónico',exact:true}).inputValue()===''&&!await panel.getByRole('checkbox').isChecked()&&await panel.getByRole('button',{name:'Confirmar suscripción',exact:true}).isDisabled(),label+': B requires fresh contact and explicit consent');
   const probe=await t.page.evaluate(()=>{const p=window.__updatesPendingProbe;return{posts:p.posts,headersReceived:p.headersReceived,jsonStarted:p.jsonStarted,signalAborts:p.signalAborts,bodyCancels:p.bodyCancels,bodyWaiting:p.bodyWaiting,releasedBodies:p.releasedBodies,scheduledNoticeTimers:p.timers.length,activeNoticeTimers:p.timers.filter(timer=>timer.active).length,firedNoticeTimers:p.timers.filter(timer=>timer.fired).length};});
   check(probe.posts===1&&t.calls.length===1&&legacyOnly(t.calls[0],'synthetic-a','715','a@example.test')&&probe.signalAborts===0&&probe.bodyCancels===0&&probe.activeNoticeTimers===0&&!probe.bodyWaiting&&probe.scheduledNoticeTimers===1&&probe.firedNoticeTimers===1,label+': exactly one legacy POST, no abort, body cancel, retry or renewed notice timer');
   report.sunUpdatesPendingNotice.cases.push({width,height,textSize,theme,phase,owned8000msCallbackTriggered:true,elapsedTimeMeasured:false,exactThresholdCheckedHere:false,bodyFixture:phase==='body'?'browser-ReadableStream-after-loopback-POST':'route-held-before-headers',nativeAnchorReached:true,keyboardTargetMinimumHeight44:true,oldACKIgnored:true,...probe});
  }catch(error){originalError=error;throw error;}
  finally{
   try{if(releaseHeaders)await releaseHeaders();}catch(error){cleanupErrors.push(error);}
   try{await t.page.evaluate(()=>{if(typeof window.__updatesReleasePendingBody==='function')window.__updatesReleasePendingBody();});}catch(error){cleanupErrors.push(error);}
   try{if(handler)await t.page.unroute('**/api/leads',handler);}catch(error){cleanupErrors.push(error);}
   try{await t.close();}catch(error){cleanupErrors.push(error);}
   if(cleanupErrors.length){(report.sunUpdatesPendingNotice.cleanupErrors??=[]).push(...cleanupErrors.map(error=>String(error?.message??error)));if(!originalError)throw cleanupErrors[0];}
  }
 }
}
