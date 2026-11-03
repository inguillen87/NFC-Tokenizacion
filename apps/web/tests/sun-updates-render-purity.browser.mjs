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
  <h1>Autorización de novedades · ensayo local</h1><p>Datos sintéticos. Sin cuentas ni mensajes reales.</p>
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
   await assess(t.page,width,theme,'updates-render-purity');
   await nativeSubmitTwice(t.page);
   await panel.getByText('Suscripción solicitada',{exact:true}).waitFor();
   check(t.calls.length===1&&legacyOnly(t.calls[0],'synthetic-a','715','a@example.test'),label+': same-turn native submit sends one legacy A request');
   report.sunUpdatesRenderPurity.cases.push({width,theme,case:'abandoned-speculative-B',suspendedBObserved:true,committedARetained:true,committedAEditableWhileBPending:true,syntheticRequests:t.calls.length});
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
}
