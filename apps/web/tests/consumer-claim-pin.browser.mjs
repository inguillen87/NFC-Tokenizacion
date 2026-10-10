// Existing CI portal runner, actual Next production component. Claim receipts
// are intercepted on loopback: this is UI evidence, never real NFC acceptance.
import assert from 'node:assert/strict';

const scenarios = [
 {locale:'es-AR',label:'PIN del producto, si la marca lo pide',error:'pin_required',outcome:'pin_required',status:400,title:'La marca requiere un PIN',nextTap:'nuevo TAP'},
 {locale:'en',label:'Product PIN, if required by the brand',error:'invalid_pin',outcome:'pin_invalid',status:403,title:'The PIN does not match',nextTap:'tap the tag again'},
 {locale:'pt-BR',label:'PIN do produto, se a marca exigir',error:'claim_pin_locked',outcome:'pin_locked',status:429,title:'Tentativas de PIN bloqueadas',nextTap:'nova leitura'},
];

export async function runClaimPinScenarios({page,base,width,theme,report,check,assessment,noOverflow}){
 // Mobile narrow/normal and desktop; the full portal suite keeps its five widths.
 if(![320,390,1280].includes(width))return;
 const endpoint='**/api/mobile/passport/900001/consumer/claim';
 let current=null,release=null;
 const handler=async route=>{
  const request=route.request(),url=new URL(request.url());
  assert.equal(url.origin,base);assert.equal(request.method(),'POST');
  assert.equal(url.pathname,'/api/mobile/passport/900001/consumer/claim');
  assert.ok(current,'only an explicit synthetic scenario may submit');
  const body=request.postDataJSON();
  assert.deepEqual(Object.keys(body).sort(),['bid','pin','tenantSlug']);
  assert.equal(body.pin,current.secret);assert.equal(body.bid,'LOT-WINE-QA');assert.equal(body.tenantSlug,'consumer-qa');
  current.requests++;assert.equal(current.requests,1,'one request per explicit claim context');
  await new Promise(resolve=>{release=resolve;});
  await route.fulfill({status:current.status,contentType:'application/json',body:JSON.stringify({ok:false,error:current.error})});
 };
 await page.route(endpoint,handler);
 const query=id=>`/me/products?fromTap=1&eventId=${id}&tenant=consumer-qa&bid=LOT-WINE-QA&action=claim`;
 const context=id=>page.evaluate(path=>window.history.pushState(null,'',path),query(id));
 try{
  for(const scenario of scenarios){
   current={...scenario,secret:'Synthetic-Claim-Code!2026',requests:0};
   const label=`${width}/${theme}/${scenario.locale} claim code`;
   await page.goto(base+query('900001'),{waitUntil:'networkidle'});
   await page.evaluate(locale=>{document.documentElement.lang=locale;},scenario.locale);
   const panel=page.getByTestId('tap-association'),pin=panel.getByTestId('tap-association-claim-pin'),confirm=panel.getByTestId('tap-association-confirm');
   await panel.getByLabel(scenario.label,{exact:true}).waitFor();
   await page.waitForFunction(()=>{const button=document.querySelector('[data-testid="tap-association-confirm"]');return button&&!button.disabled;});
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
   await page.waitForFunction(()=>document.querySelector('[data-testid="tap-association-claim-pin"]')?.value==='');
   check(await pin.inputValue()===''&&current.requests===0,`${label}: changing reading context clears the code without submitting`);
   await context('900001');
   await page.waitForFunction(()=>{const button=document.querySelector('[data-testid="tap-association-confirm"]');return button&&!button.disabled;});
   await pin.fill('BAD CODE');await confirm.click();
   await panel.locator('#tap-association-pin-error').waitFor();
   check(current.requests===0&&await pin.inputValue()==='BAD CODE'&&await pin.getAttribute('aria-invalid')==='true',`${label}: invalid local input preserves editing and sends no request`);
   await noOverflow(page,`${label}: input and local feedback fit viewport`);
   await assessment(page,'[data-testid="tap-association"]',`claim-pin-input-${scenario.locale}`,width,theme);
   await pin.fill(current.secret);await confirm.click();
   await page.waitForFunction(()=>{const input=document.querySelector('[data-testid="tap-association-claim-pin"]');return input&&input.disabled&&input.value==='';});
   check(current.requests===1&&await pin.inputValue()==='',`${label}: explicit confirmation sends the claim code once and clears the field before receipt`);
   release();release=null;
   const result=panel.getByTestId('tap-association-result-claim');await result.waitFor();
   check(await result.getAttribute('data-outcome')===scenario.outcome&&(await result.innerText()).includes(scenario.title),`${label}: specific server reason has specific customer feedback`);
   check((await result.innerText()).includes(scenario.nextTap)&&await confirm.isDisabled()&&await pin.count()===0,`${label}: consumed reading requires a new tap and cannot resend the claim`);
   check(await page.evaluate(secret=>!location.href.includes(secret)&&![localStorage,sessionStorage].some(storage=>Array.from({length:storage.length},(_,index)=>storage.getItem(storage.key(index))).some(value=>value?.includes(secret)))&&!document.documentElement.outerHTML.includes(secret),current.secret),`${label}: submitted code is absent from URL, storage and rendered DOM`);
   await noOverflow(page,`${label}: terminal feedback fits viewport`);
   await assessment(page,'[data-testid="tap-association"]',`claim-pin-result-${scenario.locale}`,width,theme);
   // No body or code is retained in the browser report.
   report.claimPin??=[];report.claimPin.push({width,theme,locale:scenario.locale,syntheticReceipt:true,actualNextComponent:true,reason:scenario.error,outcome:scenario.outcome,requests:current.requests,pinOnlyInExplicitClaim:true,pinClearedBeforeReceipt:true,noUrlStorageOrDomSecret:true,newTapRequired:true});
  }
 }finally{release?.();await page.unroute(endpoint,handler);}
}
