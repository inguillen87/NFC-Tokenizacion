// Existing CI portal runner, actual Next production component. Claim receipts
// are intercepted on loopback: this is UI evidence, never real NFC acceptance.
import assert from 'node:assert/strict';
import {assertTapEligibilityRequest,tapEligibilityFixture} from './consumer-tap-eligibility.browser.mjs';

const scenarios = [
 {locale:'es-AR',label:'PIN del producto',error:'pin_required',outcome:'pin_required',status:400,title:'La marca requiere un PIN',nextTap:'nuevo TAP'},
 {locale:'en',label:'Product PIN',error:'invalid_pin',outcome:'pin_invalid',status:403,title:'The PIN does not match',nextTap:'tap the tag again'},
 {locale:'pt-BR',label:'PIN do produto',error:'claim_pin_locked',outcome:'pin_locked',status:429,title:'Tentativas de PIN bloqueadas',nextTap:'nova leitura'},
];

export async function runClaimPinScenarios({page,base,width,theme,report,check,assessment,noOverflow}){
 // Mobile narrow/normal and desktop; the full portal suite keeps its five widths.
 if(![320,390,1280].includes(width))return;
 const endpoint='**/api/mobile/passport/900001/consumer/claim';
 const advisory='**/api/consumer/tap-eligibility?*';
 let current=null,release=null;
 const eligibilityHandler=route=>{
  const request=route.request(),eventId=new URL(request.url()).searchParams.get('eventId');
  assertTapEligibilityRequest(request,base,{eventId,tenant:'consumer-qa',bid:'LOT-WINE-QA'});
  assert.ok(current&&['900001','900002'].includes(eventId));current.advisoryReads++;
  return route.fulfill({status:200,contentType:'application/json',headers:{'cache-control':'no-store'},body:JSON.stringify(tapEligibilityFixture(eventId,{claim:{allowed:true,reason:'allowed',freshTapRequired:false,nextStep:current.requiresPin?'enter_pin':'confirm'}}))});
 };
 const handler=async route=>{
  const request=route.request(),url=new URL(request.url());
  assert.equal(url.origin,base);assert.equal(request.method(),'POST');
  assert.equal(url.pathname,'/api/mobile/passport/900001/consumer/claim');
  assert.ok(current,'only an explicit synthetic scenario may submit');
  const body=request.postDataJSON();
  current.requests++;
  assert.equal(body.bid,'LOT-WINE-QA');assert.equal(body.tenantSlug,'consumer-qa');
  if(current.retryMissing&&current.requests===1){assert.deepEqual(Object.keys(body).sort(),['bid','tenantSlug']);current.requiresPin=true;}
  else{assert.deepEqual(Object.keys(body).sort(),['bid','pin','tenantSlug']);assert.equal(body.pin,current.secret);assert.equal(current.requests,current.retryMissing?2:1,'one request per deliberate confirmation');}
  current.started?.();
  await new Promise(resolve=>{release=resolve;});
  const payload=current.retryMissing?(current.requests===1?{ok:false,error:'pin_required',fresh_tap_required:false}:{ok:true,eventId:'900001',ownership:{status:'claimed',record_scope:'nexid_off_chain_digital_title'}}):{ok:false,error:current.error};
  await route.fulfill({status:current.retryMissing?(current.requests===1?403:200):current.status,contentType:'application/json',body:JSON.stringify(payload)});
 };
 await page.route(advisory,eligibilityHandler);
 await page.route(endpoint,handler);
 const query=id=>`/me/products?fromTap=1&eventId=${id}&tenant=consumer-qa&bid=LOT-WINE-QA&action=claim`;
 const context=async id=>{
  await page.evaluate(path=>window.history.pushState(null,'',path),query(id));
  await page.waitForFunction(value=>document.querySelector('[data-testid="tap-association"]')?.textContent?.includes(value),id);
 };
 const ready=()=>page.waitForFunction(()=>document.querySelector('[data-testid="tap-association-eligibility"]')?.getAttribute('data-state')==='ready');
 const frame=()=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
 const startSignal=()=>new Promise(done=>{current.started=done;});
 const waitRequest=async promise=>{let timer;try{await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('explicit synthetic claim request did not start')),5000);})]);}finally{clearTimeout(timer);}};
 const absentSecret=secret=>page.evaluate(value=>!location.href.includes(value)&&![localStorage,sessionStorage].some(storage=>Array.from({length:storage.length},(_,index)=>storage.getItem(storage.key(index))).some(item=>item?.includes(value)))&&!document.documentElement.outerHTML.includes(value),secret);
 try{
  for(const scenario of scenarios){
   current={...scenario,secret:'Synthetic-Claim-Code!2026',requests:0,advisoryReads:0,requiresPin:true};
   const label=`${width}/${theme}/${scenario.locale} claim code`;
   await page.goto(base+query('900001'),{waitUntil:'networkidle'});
   await page.evaluate(locale=>{document.documentElement.lang=locale;},scenario.locale);
   const panel=page.getByTestId('tap-association'),pin=panel.getByTestId('tap-association-claim-pin'),confirm=panel.getByTestId('tap-association-confirm');
   await panel.getByLabel(scenario.label,{exact:true}).waitFor();
   await ready();
   check(await confirm.isDisabled()&&current.requests===0,`${label}: required empty PIN cannot consume the reading`);
   await confirm.evaluate(button=>button.click());await frame();
   check(current.requests===0,`${label}: disabled confirmation sends no claim request`);
   check(await pin.getAttribute('type')==='password'&&await pin.getAttribute('maxlength')==='128'&&await pin.getAttribute('autocomplete')==='off',`${label}: bounded password input without autocomplete`);
   check(await pin.evaluate(node=>node.getBoundingClientRect().height>=44&&parseFloat(getComputedStyle(node).fontSize)>=16),`${label}: readable mobile touch field`);
   // Exercise actual keyboard navigation; programmatic .focus() alone does not
   // establish the modality or wait for the focus style's rendered state.
   await panel.getByTestId('tap-association-option-claim').focus();
   await page.keyboard.press('Tab');
   const focusState=()=>pin.evaluate(node=>{const style=getComputedStyle(node);return{active:document.activeElement===node,documentFocused:document.hasFocus(),focusVisible:node.matches(':focus-visible'),outlineStyle:style.outlineStyle,outlineWidth:style.outlineWidth,transitionProperty:style.transitionProperty,transitionDuration:style.transitionDuration};});
   const focusObservation={width,theme,locale:scenario.locale,before:await focusState()};
   report.claimPinFocus??=[];report.claimPinFocus.push(focusObservation);
   try{
    await page.waitForFunction(()=>{const node=document.querySelector('[data-testid="tap-association-claim-pin"]');if(!node)return false;const style=getComputedStyle(node);return document.activeElement===node&&node.matches(':focus-visible')&&style.outlineStyle==='solid'&&parseFloat(style.outlineWidth)>=2&&style.transitionProperty==='none';},null,{timeout:5000});
   }finally{focusObservation.after=await focusState();}
   check(focusObservation.after.active&&focusObservation.after.focusVisible&&focusObservation.after.outlineStyle==='solid'&&parseFloat(focusObservation.after.outlineWidth)>=2&&focusObservation.after.transitionProperty==='none',`${label}: product PIN has visible keyboard focus`);
   check((await panel.locator('#tap-association-pin-help').innerText()).includes('WhatsApp'),`${label}: product PIN is distinguished from sign-in OTP`);
   await pin.fill(current.secret);await panel.getByTestId('tap-association-option-save').click();
   check(await pin.count()===0,`${label}: switching to save removes the code field`);
   await panel.getByTestId('tap-association-option-claim').click();
   check(await pin.inputValue()===''&&current.requests===0,`${label}: changing action clears the code without submitting`);
   await pin.fill(current.secret);await context('900002');
   await ready();await pin.waitFor();
   check(await pin.inputValue()===''&&current.requests===0,`${label}: changing reading context clears the code without submitting`);
   await context('900001');
   await ready();await pin.waitFor();
   check(await confirm.isDisabled(),`${label}: replacement claim context again requires explicit PIN input`);
   await pin.fill('BAD CODE');await confirm.click();
   await panel.locator('#tap-association-pin-error').waitFor();
   check(current.requests===0&&await pin.inputValue()==='BAD CODE'&&await pin.getAttribute('aria-invalid')==='true',`${label}: invalid local input preserves editing and sends no request`);
   await noOverflow(page,`${label}: input and local feedback fit viewport`);
   await assessment(page,'[data-testid="tap-association"]',`claim-pin-input-${scenario.locale}`,width,theme);
   await pin.fill(current.secret);const requestStarted=startSignal();await confirm.click();await waitRequest(requestStarted);
   await page.waitForFunction(()=>{const input=document.querySelector('[data-testid="tap-association-claim-pin"]');return input&&input.disabled&&input.value==='';});
   check(current.requests===1&&await pin.inputValue()==='',`${label}: explicit confirmation sends the claim code once and clears the field before receipt`);
   release();release=null;
   const result=panel.getByTestId('tap-association-result-claim');await result.waitFor();
   check(await result.getAttribute('data-outcome')===scenario.outcome&&(await result.innerText()).includes(scenario.title),`${label}: specific server reason has specific customer feedback`);
   check((await result.innerText()).includes(scenario.nextTap)&&await confirm.isDisabled()&&await pin.count()===0,`${label}: consumed reading requires a new tap and cannot resend the claim`);
   await ready();await confirm.evaluate(button=>button.click());await frame();
   check(current.requests===1,`${label}: advisory refresh cannot reset a terminal one-use receipt`);
   check(await page.evaluate(secret=>!location.href.includes(secret)&&![localStorage,sessionStorage].some(storage=>Array.from({length:storage.length},(_,index)=>storage.getItem(storage.key(index))).some(value=>value?.includes(secret)))&&!document.documentElement.outerHTML.includes(secret),current.secret),`${label}: submitted code is absent from URL, storage and rendered DOM`);
   await noOverflow(page,`${label}: terminal feedback fits viewport`);
   await assessment(page,'[data-testid="tap-association"]',`claim-pin-result-${scenario.locale}`,width,theme);
   // No body or code is retained in the browser report.
   report.claimPin??=[];report.claimPin.push({width,theme,locale:scenario.locale,syntheticReceipt:true,actualNextComponent:true,reason:scenario.error,outcome:scenario.outcome,requests:current.requests,advisoryReads:current.advisoryReads,pinOnlyInExplicitClaim:true,pinClearedBeforeReceipt:true,noUrlStorageOrDomSecret:true,newTapRequired:true});
  }
  for(const scenario of scenarios){
   current={...scenario,retryMissing:true,secret:'Synthetic-Retry-Claim!2026',requests:0,advisoryReads:0,requiresPin:false};
   const label=`${width}/${theme}/${scenario.locale} pre-consume PIN recovery`;
   await page.goto(base+query('900001'),{waitUntil:'networkidle'});
   await page.evaluate(locale=>{document.documentElement.lang=locale;},scenario.locale);await ready();
   const panel=page.getByTestId('tap-association'),pin=panel.getByTestId('tap-association-claim-pin'),confirm=panel.getByTestId('tap-association-confirm');
   check(await pin.count()===0&&await confirm.isEnabled(),`${label}: current advisory does not invent an optional PIN field`);
   let requestStarted=startSignal();await confirm.click();await waitRequest(requestStarted);
   check(current.requests===1&&await confirm.isDisabled(),`${label}: explicit initial claim is not automatically duplicated`);
   release();release=null;
   const result=panel.getByTestId('tap-association-result-claim');
   await page.waitForFunction(()=>document.querySelector('[data-testid="tap-association-result-claim"]')?.getAttribute('data-outcome')==='pin_input_required');
   await ready();await panel.getByLabel(scenario.label,{exact:true}).waitFor();
   check(current.requests===1&&await confirm.isDisabled()&&await pin.inputValue()==='',`${label}: exact unspent 403 requests PIN editing without automatic rePOST`);
   check(await result.getAttribute('data-outcome')==='pin_input_required',`${label}: recoverable receipt is distinct from consumed or legacy missing-PIN failure`);
   await confirm.evaluate(button=>button.click());await frame();
   check(current.requests===1,`${label}: empty recovery PIN still cannot submit`);
   await noOverflow(page,`${label}: recoverable PIN feedback fits viewport`);
   await assessment(page,'[data-testid="tap-association"]',`claim-pin-recovery-${scenario.locale}`,width,theme);
   await pin.fill(current.secret);requestStarted=startSignal();await confirm.click();await waitRequest(requestStarted);
   check(current.requests===2&&await pin.inputValue()==='',`${label}: only deliberate confirmation submits replacement PIN and clears it`);
   release();release=null;
   await page.waitForFunction(()=>document.querySelector('[data-testid="tap-association-result-claim"]')?.getAttribute('data-outcome')==='claimed');
   await ready();await confirm.evaluate(button=>button.click());await frame();
   check(current.requests===2&&await confirm.isDisabled()&&await pin.count()===0,`${label}: definitive synthetic receipt remains terminal after advisory refresh`);
   check(await absentSecret(current.secret),`${label}: replacement PIN is absent from URL, storage and rendered DOM`);
   await noOverflow(page,`${label}: definitive claim feedback fits viewport`);
   await assessment(page,'[data-testid="tap-association"]',`claim-pin-recovery-result-${scenario.locale}`,width,theme);
   report.claimPinRecovery??=[];report.claimPinRecovery.push({width,theme,locale:scenario.locale,actualNextComponent:true,syntheticReceipt:true,requests:current.requests,advisoryReads:current.advisoryReads,automaticReposts:0,missingPinFreshTapRequired:false,deliberateReplacementPin:true,noUrlStorageOrDomSecret:true,physicalTapOrOwnershipVerified:false});
  }
 }finally{release?.();await page.unroute(endpoint,handler);await page.unroute(advisory,eligibilityHandler);}
}
