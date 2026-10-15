// Existing CI portal runner, actual Next production component. Claim receipts
// are intercepted on loopback: this is UI evidence, never real NFC acceptance.
import assert from 'node:assert/strict';

const scenarios = [
 {locale:'es-AR',label:'PIN del producto, si la marca lo pide',heading:'Solicitá la titularidad digital',error:'pin_required',outcome:'pin_required',status:400,title:'La marca requiere un PIN',nextTap:'nuevo TAP'},
 {locale:'en',label:'Product PIN, if required by the brand',heading:'Request digital title',error:'invalid_pin',outcome:'pin_invalid',status:403,title:'The PIN does not match',nextTap:'tap the tag again'},
 {locale:'pt-BR',label:'PIN do produto, se a marca exigir',heading:'Solicite a titularidade digital',error:'claim_pin_locked',outcome:'pin_locked',status:429,title:'Tentativas de PIN bloqueadas',nextTap:'nova leitura'},
];

async function selectVisibleChoice(panel, action, check, label) {
 const radio=panel.getByTestId('tap-association-option-'+action);
 if(!await radio.isVisible()){
  const alternatives=panel.locator(`details:has(input[data-testid="tap-association-option-${action}"])`);
  check(await alternatives.count()===1,`${label}: hidden choice belongs to its native alternatives`);
  await alternatives.locator('summary').click();
 }
 await radio.click();
 check(await radio.isChecked(),`${label}: explicit visible choice selected without forcing`);
}

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
   check(await panel.getByRole('heading',{name:scenario.heading,exact:true}).count()===1,`${label}: heading matches the incoming ownership request`);
   check(await panel.locator('label[data-primary="true"] input').getAttribute('value')==='claim'&&!await panel.locator('details').first().evaluate(node=>node.open),`${label}: incoming claim is primary while alternatives are collapsed`);
   await page.waitForFunction(()=>{const button=document.querySelector('[data-testid="tap-association-confirm"]');return button&&!button.disabled;});
   check(await pin.getAttribute('type')==='password'&&await pin.getAttribute('maxlength')==='128'&&await pin.getAttribute('autocomplete')==='off',`${label}: bounded password input without autocomplete`);
   check(await pin.evaluate(node=>node.getBoundingClientRect().height>=44&&parseFloat(getComputedStyle(node).fontSize)>=16),`${label}: readable mobile touch field`);
   // Exercise actual keyboard navigation; programmatic .focus() alone does not
   // establish the modality or wait for the focus style's rendered state.
   await panel.getByTestId('tap-association-option-claim').focus();
   await page.keyboard.press('Tab');
   check(await panel.locator('details').first().locator('summary').evaluate(node=>node===document.activeElement),`${label}: keyboard reaches the collapsed alternatives summary`);
   await page.keyboard.press('Tab');
   const focusState=()=>pin.evaluate(node=>{const style=getComputedStyle(node);return{active:document.activeElement===node,documentFocused:document.hasFocus(),focusVisible:node.matches(':focus-visible'),outlineStyle:style.outlineStyle,outlineWidth:style.outlineWidth,transitionProperty:style.transitionProperty,transitionDuration:style.transitionDuration};});
   const focusObservation={width,theme,locale:scenario.locale,before:await focusState()};
   report.claimPinFocus??=[];report.claimPinFocus.push(focusObservation);
   try{
    await page.waitForFunction(()=>{const node=document.querySelector('[data-testid="tap-association-claim-pin"]');if(!node)return false;const style=getComputedStyle(node);return document.activeElement===node&&node.matches(':focus-visible')&&style.outlineStyle==='solid'&&parseFloat(style.outlineWidth)>=2&&style.transitionProperty==='none';},null,{timeout:5000});
   }finally{focusObservation.after=await focusState();}
   check(focusObservation.after.active&&focusObservation.after.focusVisible&&focusObservation.after.outlineStyle==='solid'&&parseFloat(focusObservation.after.outlineWidth)>=2&&focusObservation.after.transitionProperty==='none',`${label}: product PIN has visible keyboard focus`);
   check((await panel.locator('#tap-association-pin-help').innerText()).includes('WhatsApp'),`${label}: product PIN is distinguished from sign-in OTP`);
   await pin.fill(current.secret);await selectVisibleChoice(panel,'save',check,label);
   check(await pin.count()===0,`${label}: switching to save removes the code field`);
   check(await panel.locator('label[data-primary="true"] input').getAttribute('value')==='claim',`${label}: changing selection does not move the entry action`);
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
 await runOwnershipConflictScenarios({page,base,width,theme,report,check,assessment,noOverflow});
}


// Known title conflict in the same actual Next component; synthetic receipts
// do not prove a real ownership record, transfer or customer operation.
async function runOwnershipConflictScenarios({page,base,width,theme,report,check,assessment,noOverflow}){
 const cases=[{"locale":"es-AR","heading":"Solicitá la titularidad digital","title":"El producto ya tiene titularidad registrada","body":"No se registró una nueva titularidad para tu cuenta. Podés seguir consultando tus productos y el historial. Si necesitás revisar el registro, consultá con la marca. Otro TAP no cambia la titularidad registrada.","products":"Revisar mis productos","history":"Ver historial de lecturas"},{"locale":"en","heading":"Request digital title","title":"This product already has a registered digital title","body":"No new digital title was registered for your account. You can still review your products and reading history. Contact the brand if the record needs review. Another tap does not change the registered title.","products":"Review my products","history":"View reading history"},{"locale":"pt-BR","heading":"Solicite a titularidade digital","title":"O produto já tem titularidade registrada","body":"Nenhuma nova titularidade foi registrada para sua conta. Você pode continuar consultando seus produtos e o histórico de leituras. Fale com a marca se precisar revisar o registro. Outro toque não muda a titularidade registrada.","products":"Revisar meus produtos","history":"Ver histórico de leituras"}];
 const endpoint='**/api/mobile/passport/900001/consumer/claim';let current=null;
 const handler=async route=>{
  const request=route.request(),url=new URL(request.url());
  assert.equal(url.origin,base);assert.equal(url.pathname,'/api/mobile/passport/900001/consumer/claim');assert.equal(request.method(),'POST');
  assert.ok(current);assert.deepEqual(request.postDataJSON(),{tenantSlug:'consumer-qa',bid:'LOT-WINE-QA',pin:current.secret});
  current.requests++;assert.equal(current.requests,1,'a title conflict receives only the explicit claim request');
  await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({ok:false,error:'ownership_already_claimed',ownership:null,operation_committed:false})});
 };
 await page.route(endpoint,handler);
 try{
  for(const scenario of cases){
   current={...scenario,secret:'Synthetic-Claim-Conflict!2026',requests:0};const label=`${width}/${theme}/${scenario.locale} existing title`;
   await page.goto(base+'/me/products?fromTap=1&eventId=900001&tenant=consumer-qa&bid=LOT-WINE-QA&action=claim',{waitUntil:'networkidle'});
   await page.evaluate(locale=>{document.documentElement.lang=locale;},scenario.locale);
   const panel=page.getByTestId('tap-association'),pin=panel.getByTestId('tap-association-claim-pin'),confirm=panel.getByTestId('tap-association-confirm');
   await panel.getByRole('heading',{name:scenario.heading,exact:true}).waitFor();
   await page.waitForFunction(()=>{const button=document.querySelector('[data-testid="tap-association-confirm"]');return button&&!button.disabled;});
   check(current.requests===0,`${label}: consultation and the existing-title context never submit automatically`);
   await pin.fill(current.secret);await confirm.click();
   const result=panel.getByTestId('tap-association-result-claim');await result.waitFor();
   check(await result.getAttribute('data-outcome')==='ownership_conflict'&&current.requests===1,`${label}: the exact409 reason has a claim-only terminal outcome`);
   check(await result.getByRole('heading',{name:scenario.title,exact:true}).count()===1&&await result.locator('p').innerText()===scenario.body,`${label}: known registered title is explained without exposing an owner identity or suggesting another tap fixes it`);
   check(await confirm.isDisabled()&&await pin.count()===0,`${label}: existing title cannot resend the claim and the submitted code is removed`);
   check(await result.locator('..').getAttribute('aria-live')==='polite',`${label}: existing feedback remains accessible`);
   await confirm.evaluate(button=>{button.click();button.click();});
   await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
   check(current.requests===1,`${label}: repeated clicks cannot resend the denied claim`);
   const products=panel.getByRole('link',{name:scenario.products,exact:true}),history=panel.getByRole('link',{name:scenario.history,exact:true});
   check(await products.isVisible()&&await history.isVisible()&&await products.getAttribute('href')==='/me/products?focus=900001'&&await history.getAttribute('href')==='/me/taps',`${label}: existing read-only product and history destinations remain available`);
   check(await page.evaluate(secret=>!location.href.includes(secret)&&![localStorage,sessionStorage].some(storage=>Array.from({length:storage.length},(_,index)=>storage.getItem(storage.key(index))).some(value=>value?.includes(secret)))&&!document.documentElement.outerHTML.includes(secret),current.secret),`${label}: code stays absent from URL, storage and rendered DOM`);
   await noOverflow(page,`${label}: existing-title feedback fits viewport`);
   await assessment(page,'[data-testid="tap-association"]',`ownership-conflict-${scenario.locale}`,width,theme);
   const followHistory=width===320&&theme==='light'&&scenario.locale==='es-AR';
   if(followHistory){
   await history.click();await page.waitForURL(url=>url.origin===base&&url.pathname==='/me/taps');await page.getByRole('heading',{name:'Historial de lecturas',exact:true}).waitFor();
   check(current.requests===1,`${label}: actual Next history navigation keeps consultation available without resubmitting the claim`);
   }
   report.ownershipConflict??=[];report.ownershipConflict.push({width,theme,locale:scenario.locale,outcome:'ownership_conflict',requests:current.requests,actualNextComponent:true,syntheticReceipt:true,historyRouteReached:followHistory,newTapPresentedAsOwnershipResolution:false,realOwnershipAccepted:false});
  }
 }finally{await page.unroute(endpoint,handler);}
}

// Additional explicit loopback receipts in the same actual Next portal harness.
// They prove UI handling only; no program enrollment or customer write occurs.
export async function runBenefitConfirmationScenarios({page,base,width,theme,report,check,assessment,noOverflow}){
 if(![320,390,1280].includes(width))return;
 const cases=[
  {locale:'es-AR',heading:'Solicitá la inscripción en beneficios',savedHeading:'Guardá tu producto en tu cuenta',confirmed:'Inscripción confirmada',benefits:'Ver mis beneficios'},
  {locale:'en',heading:'Request benefits enrollment',savedHeading:'Save your product to your account',confirmed:'Enrollment confirmed',benefits:'View my benefits'},
  {locale:'pt-BR',heading:'Solicite a inscrição em benefícios',savedHeading:'Guarde seu produto na sua conta',confirmed:'Inscrição confirmada',benefits:'Ver meus benefícios'},
 ];
 const endpoint='**/api/mobile/passport/900001/loyalty/enroll';let current=null;
 const handler=async route=>{
  const request=route.request(),url=new URL(request.url());
  assert.equal(url.origin,base);assert.equal(url.pathname,'/api/mobile/passport/900001/loyalty/enroll');assert.equal(request.method(),'POST');
  assert.ok(current);assert.deepEqual(request.postDataJSON(),{tenantSlug:'consumer-qa',bid:'LOT-WINE-QA',locale:current.locale});
  current.requests++;assert.equal(current.requests,1,'only one explicit request per synthetic enrollment scenario');
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,enrollment_status:'enrolled',member:{id:'member-benefits-qa',status:current.status,pointsBalance:0}})});
 };
 await page.route(endpoint,handler);
 try{
  for(const scenario of cases)for(const status of ['verified','inactive']){
   current={...scenario,status,requests:0};const label=`${width}/${theme}/${scenario.locale}/${status} benefits`;
   await page.goto(base+'/me/products?fromTap=1&eventId=900001&tenant=consumer-qa&bid=LOT-WINE-QA&action=rewards',{waitUntil:'networkidle'});
   await page.evaluate(locale=>{document.documentElement.lang=locale;},scenario.locale);
   const panel=page.getByTestId('tap-association'),confirm=panel.getByTestId('tap-association-confirm'),radio=panel.getByTestId('tap-association-option-rewards');
   await panel.getByRole('heading',{name:scenario.heading,exact:true}).waitFor();
   await page.waitForFunction(()=>{const button=document.querySelector('[data-testid="tap-association-confirm"]');return button&&!button.disabled;});
   check(await radio.isChecked()&&await panel.locator('label[data-primary="true"] input').getAttribute('value')==='rewards',`${label}: entry rewards intention is selected and primary`);
   check(!await panel.locator('details').first().evaluate(node=>node.open)&&current.requests===0,`${label}: collapsed alternatives and navigation never auto-enroll`);
   await selectVisibleChoice(panel,'save',check,label);await panel.getByRole('heading',{name:scenario.savedHeading,exact:true}).waitFor();
   check(await panel.locator('label[data-primary="true"] input').getAttribute('value')==='rewards'&&current.requests===0,`${label}: local selection changes heading without moving primary or posting`);
   await radio.click();await panel.getByRole('heading',{name:scenario.heading,exact:true}).waitFor();await confirm.click();
   const result=panel.getByTestId('tap-association-result-rewards');await result.waitFor();
   const verified=status==='verified';
   check(await result.getAttribute('data-outcome')===(verified?'enrolled':'unconfirmed')&&current.requests===1,`${label}: member status receives the exact confirmed or incomplete outcome`);
   if(verified){
    check(await result.getByRole('heading',{name:scenario.confirmed,exact:true}).count()===1&&await confirm.isDisabled(),`${label}: verified confirmation completes this action and disables resubmission`);
    const benefits=panel.getByTestId('tap-association-benefits');check(await benefits.getAttribute('href')==='/me/rewards'&&await benefits.innerText()===scenario.benefits,`${label}: confirmed result leads to the actual benefits route`);
    check(!/0|member-benefits-qa/.test(await result.innerText()),`${label}: zero balance and internal member reference are not presented as awards`);
    await page.evaluate(locale=>{document.documentElement.lang=locale==='en'?'pt-BR':'en';},scenario.locale);
    await page.waitForFunction(expected=>document.querySelector('[data-testid="tap-association"]')?.lang===expected,scenario.locale==='en'?'pt-BR':'en');
    await selectVisibleChoice(panel,'save',check,label);await radio.click();await page.keyboard.press('Enter');
    check(await confirm.isDisabled()&&current.requests===1&&await result.getAttribute('data-outcome')==='enrolled',`${label}: locale and choice changes preserve the receipt without a second POST`);
    await page.evaluate(locale=>{document.documentElement.lang=locale;},scenario.locale);await panel.getByRole('heading',{name:scenario.heading,exact:true}).waitFor();
   }else check(await panel.getByTestId('tap-association-benefits').count()===0&&!await confirm.isDisabled(),`${label}: inactive member cannot receive a confirmed benefits CTA`);
   check(await panel.getByRole('link',{name:/./}).filter({hasText:scenario.benefits}).count()===(verified?1:0),`${label}: benefits navigation is tied to the confirmed outcome only`);
   await noOverflow(page,`${label}: action and feedback fit viewport`);
   await assessment(page,'[data-testid="tap-association"]',`benefits-${status}-${scenario.locale}`,width,theme);
   if(verified){await panel.getByTestId('tap-association-benefits').click();await page.waitForURL(url=>url.origin===base&&url.pathname==='/me/rewards');await page.getByRole('heading',{name:'Tus beneficios',exact:true}).waitFor();check(current.requests===1,`${label}: benefits destination opens without another enrollment request`);}
   report.benefitConfirmation??=[];report.benefitConfirmation.push({width,theme,locale:scenario.locale,memberStatus:status,requests:current.requests,outcome:verified?'enrolled':'unconfirmed',actualNextComponent:true,syntheticReceipt:true,benefitsRouteReached:verified,realEnrollmentAccepted:false});
  }
 }finally{await page.unroute(endpoint,handler);}
}
