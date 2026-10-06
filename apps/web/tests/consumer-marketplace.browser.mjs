// Called by the existing CI portal runner against actual Next production pages.
// Intercepted request receipts are synthetic; no customer or provider writes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {marketplaceFixtureItems,marketplaceBrokenPhotoFixture} from './consumer-marketplace-fixture.mjs';

export async function marketplaceBinding(repo,web){
 const paths=[
  'apps/web/src/app/me/marketplace/marketplace-grid-client.tsx','apps/web/src/app/me/marketplace/page.tsx',
  'apps/web/src/app/me/marketplace/marketplace.module.css','apps/web/src/app/me/marketplace/marketplace-request.ts',
  'apps/web/src/app/me/_components/portal-shell.module.css','apps/web/src/app/me/_components/tap-association-banner.tsx',
  'apps/web/src/app/me/_components/tap-association-model.ts','apps/web/src/app/login/consumer-login-continuation.ts',
  'apps/web/tests/consumer-portal-experience.browser.mjs','apps/web/tests/consumer-portal-local-fetch.mjs',
  'apps/web/tests/consumer-marketplace.browser.mjs','apps/web/tests/consumer-marketplace-fixture.mjs',
  'apps/web/public/release.json','apps/web/.next/BUILD_ID','apps/web/.next/server/app/me/marketplace/page.js',
 ];
 const css=await readdir(join(web,'.next/static/chunks'));
 paths.push(...css.filter(path=>path.endsWith('.css')).sort().map(path=>'apps/web/.next/static/chunks/'+path));
 const gitEnv=Object.fromEntries(Object.entries(process.env).filter(([key,value])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(key)&&typeof value==='string'));
 const git=args=>execFileSync('git',args,{cwd:repo,env:gitEnv,encoding:'utf8',windowsHide:true,timeout:10000}).trim();
 const observedSource=git(['rev-parse','HEAD']),observedTree=git(['rev-parse','HEAD^{tree}']),sourceWorktreeClean=git(['status','--porcelain'])==='',qaSource=process.env.QA_SOURCE||null;
 if(qaSource){assert.match(qaSource,/^[a-f0-9]{40}$/);assert.equal(qaSource,observedSource,'Explicit QA_SOURCE must be the actual committed candidate');assert.ok(sourceWorktreeClean,'Exact-source browser claim requires clean committed source');}
 return {qaSource,observedSource,observedTree,sourceWorktreeClean,sourceClaimBound:Boolean(qaSource),buildId:(await readFile(join(web,'.next/BUILD_ID'),'utf8')).trim(),
  hashes:Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile(join(repo,path))).digest('hex')])))};
}

export async function runMarketplaceScenarios({page,base,width,theme,report,check,assessment,noOverflow}){
 const label=`${width}/${theme} catalogue`,requests=[];
 const record={width,theme,requests,geometry:[],scenarios:[],syntheticRequestOnly:true,realPurchaseCertified:false,photoFailures:[]};
 report.marketplace??=[];report.marketplace.push(record);
 let mode='success';const held=[];
 const endpoint='**/api/marketplace/products/*/request-to-buy';
 const handler=async route=>{
  const request=route.request(),url=new URL(request.url()),id=decodeURIComponent(url.pathname.split('/').at(-2));
  assert.equal(request.method(),'POST');assert.ok(marketplaceFixtureItems.some(item=>item.id===id),'only synthetic catalogue IDs may be intercepted');
  const body=request.postDataJSON();assert.ok(requests.length<40,'bounded catalogue request diagnostics');
  const entry={path:url.pathname,method:request.method(),id,mode,body,status:null};requests.push(entry);
  if(mode==='headers-hang'){held.push(route);return;}
  if(mode==='held-success'){held.push({route,entry});return;}
  if(mode==='connection'){entry.networkAborted=true;return route.abort('failed');}
  const status=mode==='configuration-changed'?409:mode==='unauthorized'?401:mode==='context-denied'?403:mode==='rate-limit'?429:mode==='partial'&&id==='market-olive-qa'?503:200;
  entry.status=status;
  if(mode==='invalid-json')return route.fulfill({status,contentType:'application/json',body:'not JSON'});
  return route.fulfill({status,contentType:'application/json',body:JSON.stringify({ok:status===200,error:status===409?'marketplace_configuration_changed':status===403?'passport_context_required':status===429?'internal_rate_limit_qa':status!==200?'internal_provider_error_qa':undefined,deduplicated:false,request_mode:'request_only'})});
 };
 await page.route(endpoint,handler);
 assert.ok(marketplaceBrokenPhotoFixture,'One exact synthetic broken-photo projection is required');
 const brokenImageUrl=new URL(marketplaceBrokenPhotoFixture.image_url,base),brokenImagePattern=url=>url.href===brokenImageUrl.href;
 const brokenImageHandler=async route=>{
  const request=route.request();assert.equal(request.method(),'GET');assert.equal(request.url(),brokenImageUrl.href);assert.ok(['localhost','127.0.0.1'].includes(brokenImageUrl.hostname));
  const body='synthetic-invalid-png-bytes';record.photoFailures.push({path:brokenImageUrl.pathname,query:brokenImageUrl.search,method:'GET',status:200,bodySha256:createHash('sha256').update(body).digest('hex'),decodeFailureInjected:true,providerFetch:false});
  return route.fulfill({status:200,contentType:'image/png',headers:{'cache-control':'no-store'},body});
 };
 await page.route(brokenImagePattern,brokenImageHandler);
 await page.addInitScript(()=>{
  const original=window.fetch.bind(window);
  window.fetch=async(...args)=>{
   const response=await original(...args);
   const input=args[0],path=typeof input==='string'?input:input instanceof Request?input.url:String(input);
   if(window.__marketplaceBodyHang&&/\/request-to-buy$/.test(path))return {ok:response.ok,status:response.status,json:()=>new Promise(()=>{})};
   return response;
  };
 });
 const route=base+'/me/marketplace?fromTap=1&eventId=900001&bid=LOT-WINE-QA&tenant=consumer-qa&action=marketplace';
 const catalog=page.locator('[data-marketplace-catalog]');
 const card=id=>catalog.locator(`[data-marketplace-product="${id}"]`);
 const list=page.getByRole('complementary',{name:'Lista de solicitudes'});
 const listHeading=list.getByRole('heading',{name:'Tu lista de solicitudes',exact:true});
 const selection=catalog.locator('[data-marketplace-selection]'),jump=selection.getByRole('button',{name:'Ver mi lista',exact:true});
 const wine=()=>card('market-wine-qa'),olive=()=>card('market-olive-qa');
 const reload=async()=>{await page.goto(route,{waitUntil:'networkidle'});await catalog.waitFor();};
 const stageGeometry=()=>page.evaluate(()=>{
  const box=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
  return [...document.querySelectorAll('[data-marketplace-media]')].map(el=>{
   const product=el.closest('[data-marketplace-product]'),image=el.querySelector('img'),bounds=box(el),productBounds=box(product),imageBounds=image?box(image):null;
   const contains=(a,b)=>b.left>=a.left-1&&b.right<=a.right+1&&b.top>=a.top-1&&b.bottom<=a.bottom+1;
   return {id:product.dataset.marketplaceProduct,bounds,productBounds,imageBounds,contained:contains(productBounds,bounds),imageContained:!imageBounds||contains(bounds,imageBounds),position:getComputedStyle(el).position,pseudoBefore:getComputedStyle(el,'::before').content,pseudoAfter:getComputedStyle(el,'::after').content,imageSrc:image?.getAttribute('src')||null,offsetParent:el.offsetParent?.getAttribute('data-marketplace-product')};
  });
 });
 const targets=async name=>check(await catalog.locator('button,input').evaluateAll(elements=>elements.filter(el=>el.getClientRects().length).every(el=>{const r=el.getBoundingClientRect();return r.height>=44&&r.width>=44;})),`${label} ${name}: all controls have 44px targets`);
 const settleLayout=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const focusPlacement=locator=>locator.evaluate(el=>{
  const box=element=>{const r=element.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};};
  const bounds=box(el),header=document.querySelector('.consumer-portal-root > header'),nav=document.querySelector('nav[aria-label="Navegación del portal"]');
  const headerBounds=box(header),navBounds=box(nav),navPosition=getComputedStyle(nav).position,usable={top:Math.max(0,headerBounds.bottom)+8,bottom:(navPosition==='fixed'?Math.min(innerHeight,navBounds.top):innerHeight)-8};
  const x=(bounds.left+bounds.right)/2,y=(bounds.top+bounds.bottom)/2,hit=document.elementFromPoint(x,y),style=getComputedStyle(el);
  return{bounds,headerBounds,navBounds,navPosition,usable,active:document.activeElement===el,focusVisible:el.matches(':focus-visible'),outlineStyle:style.outlineStyle,outlineWidth:parseFloat(style.outlineWidth),ownHit:hit===el||el.contains(hit),fullyUsable:bounds.top>=usable.top&&bounds.bottom<=usable.bottom&&bounds.left>=0&&bounds.right<=innerWidth};
 });
 const assertListJump=async(trigger,phase)=>{
  const before=requests.length;await trigger.focus();await page.keyboard.press('Enter');await settleLayout();
  const placement=await focusPlacement(listHeading);record.geometry.push({phase,...placement});
  check(placement.active&&placement.fullyUsable&&placement.ownHit,`${label} ${phase}: actual list heading receives keyboard focus and remains unobstructed between header/nav`);
  check(placement.focusVisible&&placement.outlineStyle!=='none'&&placement.outlineWidth>=2,`${label} ${phase}: actual focused heading has a visible outline`);
  check(requests.length===before,`${label} ${phase}: list navigation never sends a request`);
  return placement;
 };
 try{
  await reload();
  check(await catalog.locator('[data-marketplace-product]').count()===marketplaceFixtureItems.length,`${label} renders only the ${marketplaceFixtureItems.length} explicit fixture products`);
  check(await page.locator('.marketplace-product-visual').count()===0,`${label} no global decorative media classes`);
  const initial=await stageGeometry();record.geometry.push({phase:'initial',stages:initial});
  check(initial.every(g=>g.contained&&g.imageContained&&g.position==='relative'&&['none','normal'].includes(g.pseudoBefore)&&['none','normal'].includes(g.pseudoAfter)),`${label} media and real images stay within their own product cards`);
  for(const item of marketplaceFixtureItems){
   if(item.id===marketplaceBrokenPhotoFixture.id)continue;
   const src=item.imageUrl||item.image_url||item.photoUrl||item.photo_url||null;
   check(initial.find(g=>g.id===item.id)?.imageSrc===src,`${label} preserves published photo URL ${item.id}`);
  }
  check(await card('market-no-photo-qa').getByText('Foto no publicada',{exact:true}).count()===1,`${label} no invented photo for missing catalogue image`);
  check(await wine().getByText('ARS 18.000,5',{exact:true}).count()===1,`${label} published price retains cents`);
  check(await card('market-experience-qa').getByRole('button',{name:'Solicitar contacto',exact:true}).isDisabled(),`${label} unavailable product cannot be requested`);
  check(await card('market-no-photo-qa').getByRole('button',{name:'Solicitar contacto',exact:true}).isDisabled(),`${label} disabled request capability stays disabled`);
  check(await card('market-no-photo-qa').getByText('La marca no habilitó solicitudes de contacto para este producto.',{exact:true}).isVisible(),`${label} disabled contact capability explains the actual reason`);
  check(await card('market-experience-qa').getByText('La marca debe confirmar disponibilidad antes de habilitar consultas.',{exact:true}).isVisible(),`${label} unavailable published product explains its disabled action`);
  check(await wine().getByText('Publicado · disponibilidad a confirmar',{exact:true}).count()===1,`${label} active publication does not assert stock`);
  check(await card('market-cafe-zero-qa').getByText('USD 0',{exact:true}).count()===1,`${label} explicit decimal zero is a published price, not unknown`);
  for(const id of ['market-price-null-qa','market-no-currency-qa']){check(await card(id).getByText('Precio a consultar',{exact:true}).count()===1,`${label} ${id} requires a complete published amount/currency pair`);check(!/ARS|USD|20(?:[,.]00)?/.test(await card(id).innerText()),`${label} ${id} never invents a currency or price`);}
  check(await jump.isDisabled(),`${label} empty list jump is disabled`);
  record.scenarios.push({name:'disabled-reasons',capabilityReasonVisible:true,availabilityReasonVisible:true,publishedStateDoesNotAssertStock:true},{name:'published-price-boundaries',zeroPreserved:true,nullUnknown:true,currencyMissingUnknown:true});
  const text=await catalog.innerText();check(!/Passport item|ownership|MetaMask|MercadoPago|Stripe|assets|Sumaste|Gran Reserva Malbec/.test(text),`${label} no simulated promotional, payment or points-award claims`);
  const alternatives=page.getByTestId('tap-association').locator('details').filter({has:page.getByTestId('tap-association-option-claim')});
  if(!await alternatives.evaluate(element=>element.open))await alternatives.locator('summary').click();
  check(await alternatives.evaluate(element=>element.open),`${label} additional tap options are explicitly open`);
  const radio=page.getByTestId('tap-association-option-claim'),choice=radio.locator('..');
  const readChoice=()=>choice.evaluate(el=>{
   const rect=element=>{const r=element.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};};
   const bounds=rect(el),header=document.querySelector('.consumer-portal-root > header'),nav=document.querySelector('nav[aria-label="Navegación del portal"]');
   const headerBounds=rect(header),navBounds=rect(nav),navPosition=getComputedStyle(nav).position;
   const usable={top:Math.max(0,headerBounds.bottom)+8,bottom:(navPosition==='fixed'?Math.min(innerHeight,navBounds.top):innerHeight)-8};
   const point={x:(bounds.left+bounds.right)/2,y:(bounds.top+bounds.bottom)/2},hit=document.elementFromPoint(point.x,point.y);
   return {bounds,headerBounds,navBounds,navPosition,usable,scrollY,point,hitTag:hit?.tagName,hitText:hit?.textContent?.trim().slice(0,80),ownLabel:hit===el||el.contains(hit),fullyUsable:bounds.top>=usable.top&&bounds.bottom<=usable.bottom&&bounds.left>=0&&bounds.right<=innerWidth};
  });
  await choice.scrollIntoViewIfNeeded();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  record.tapChoicePlacementBefore=await readChoice();
  await choice.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  let hit=await readChoice();
  if(!hit.fullyUsable){
   const delta=hit.point.y-(hit.usable.top+hit.usable.bottom)/2;
   await page.evaluate(delta=>window.scrollBy({top:delta,behavior:'instant'}),delta);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   hit=await readChoice();record.measuredUsableScrollDelta=delta;
  }
  record.tapChoiceHit=hit;record.tapChoicePlacementReason='Native scroll within the usable area between unchanged sticky header and fixed navigation; catalogue styles and viewport are untouched.';
  check(hit.fullyUsable,`${label} full tap ownership choice fits between header and navigation with 8px margin`);
  check(hit.ownLabel,`${label} tap ownership choice remains unobstructed by catalogue media`);
  const previousSelection=await page.locator('[name="tap-association-action"]:checked').evaluateAll(elements=>elements[0]?.getAttribute('data-testid')||null),beforeRadioRequests=requests.length;
  await radio.click();check(await radio.isChecked(),`${label} actual unobstructed radio can be selected without forcing`);
  check(requests.length===beforeRadioRequests,`${label} selecting the local tap option does not submit a catalogue request`);
  if(previousSelection&&previousSelection!=='tap-association-option-claim')await page.getByTestId(previousSelection).click();
  record.geometry.push({phase:'tap-form',stages:await stageGeometry()});
  await assessment(page,'[data-testid="tap-association"]','marketplace-tap-form',width,theme);
  await targets('initial');await noOverflow(page,`${label} fits viewport`);
  const search=catalog.getByRole('searchbox',{name:'Buscar productos'});await search.fill('no existe QA');
  check(await catalog.locator('[data-marketplace-product]').count()===0,`${label} search shows honest empty result`);
  await catalog.getByRole('button',{name:'Vinos',exact:true}).click();const clear=catalog.getByRole('button',{name:'Limpiar filtros',exact:true});
  check(await clear.isVisible(),`${label} empty combined search/category has an evident recovery`);await clear.focus();await page.keyboard.press('Enter');await settleLayout();
  const clearPlacement=await focusPlacement(search);record.geometry.push({phase:'clear-filters-search-focus',...clearPlacement});
  check(await search.inputValue()===''&&await catalog.getByRole('button',{name:'Todo',exact:true}).getAttribute('aria-pressed')==='true'&&await catalog.locator('[data-marketplace-product]').count()===marketplaceFixtureItems.length,`${label} one reset clears both search and category and restores actual items`);
  check(clearPlacement.active&&clearPlacement.fullyUsable&&clearPlacement.ownHit,`${label} keyboard reset focuses the real unobstructed search field without QA repositioning`);
  check(await clear.count()===0,`${label} reset action disappears after restoring defaults`);
  record.scenarios.push({name:'clear-search-and-filter',searchCleared:true,categoryCleared:true,searchFocusUnobstructed:true});
  await search.fill('Cafe QA');check(await catalog.locator('[data-marketplace-product]').count()===1&&await card('market-cafe-zero-qa').count()===1,`${label} accent-free search finds the actual Café projection`);
  await catalog.getByRole('button',{name:'Limpiar filtros',exact:true}).click();await catalog.getByRole('button',{name:'Experiencias',exact:true}).click();
  check(await catalog.locator('[data-marketplace-product]').count()===1&&await card('market-experience-qa').count()===1,`${label} a book brand containing Catamarca/Club is not reclassified as an experience`);
  await catalog.getByRole('button',{name:'Club',exact:true}).click();check(await catalog.locator('[data-marketplace-product]').count()===0,`${label} a book brand does not fabricate a membership category`);
  await catalog.getByRole('button',{name:'Todo',exact:true}).click();await catalog.getByRole('button',{name:'Vinos',exact:true}).click();
  check(await catalog.locator('[data-marketplace-product]').count()===1,`${label} category filter selects real published wine`);
  await catalog.getByRole('button',{name:'Todo',exact:true}).click();
  record.scenarios.push({name:'source-category-and-accent-search',unknownVerticalRetained:true,brandDoesNotDetermineCategory:true,accentSearchMatched:true});
  record.loadedPhotos=[];
  for(const item of marketplaceFixtureItems){
   if(item.id===marketplaceBrokenPhotoFixture.id)continue;
   if(!(item.imageUrl||item.image_url||item.photoUrl||item.photo_url))continue;
   const img=card(item.id).locator('img');await img.scrollIntoViewIfNeeded();
   await page.waitForFunction(id=>{const image=document.querySelector(`[data-marketplace-product="${id}"] img`);return image?.complete&&image.naturalWidth>0;},item.id,{timeout:10000});
   record.loadedPhotos.push(await img.evaluate(el=>({src:el.getAttribute('src'),complete:el.complete,naturalWidth:el.naturalWidth,naturalHeight:el.naturalHeight,loading:el.loading})));
  }
  check(record.loadedPhotos.length===3&&record.loadedPhotos.every(p=>p.complete&&p.naturalWidth>0&&p.naturalHeight>0&&p.loading==='lazy'),`${label} native scrolling loads every real published photo before capture`);
  record.scenarios.push({name:'published-photo-preservation',photos:record.loadedPhotos.map(photo=>({src:photo.src,decoded:true}))});
  const failedPhoto=card(marketplaceBrokenPhotoFixture.id);await failedPhoto.scrollIntoViewIfNeeded();await failedPhoto.getByText('No pudimos cargar la foto',{exact:true}).waitFor();
  check(await failedPhoto.getByText('No pudimos cargar la foto',{exact:true}).getAttribute('role')==='status'&&await failedPhoto.locator('img').count()===0,`${label} actual image decoding failure has a readable status and removes the broken image`);
  check(await failedPhoto.getByText('Café QA',{exact:true}).count()===1&&await failedPhoto.getByText('USD 0',{exact:true}).count()===1&&await failedPhoto.getByRole('button',{name:'Solicitar contacto',exact:true}).isDisabled(),`${label} failed photo preserves published identity/price and actual capability`);
  check(record.photoFailures.length>=1&&record.photoFailures.every(row=>row.method==='GET'&&row.status===200&&row.decodeFailureInjected&&!row.providerFetch),`${label} broken-image proof is an exact synthetic loopback decode failure, not a replacement photo`);
  record.scenarios.push({name:'failed-photo-fallback',identityPreserved:true,pricePreserved:true,brokenImageRemoved:true,sourcePath:brokenImageUrl.pathname,syntheticDecodeFailure:true});
  if(width<=390){
   await selection.evaluate(el=>{const header=document.querySelector('.consumer-portal-root > header'),top=header.getBoundingClientRect().bottom+8;window.scrollBy({top:el.getBoundingClientRect().top-top,behavior:'instant'});});await settleLayout();
   record.geometry.push({phase:'catalog-viewport-camera',manualNativeScroll:true,noCssOverride:true});
   await assessment(page,'[data-marketplace-selection]','marketplace-catalog-viewport',width,theme);
  }

  const start=requests.length;
  await wine().getByRole('button',{name:'Agregar a la lista',exact:true}).click();
  await wine().getByRole('button',{name:'Soy mayor de edad',exact:true}).waitFor();
  check(requests.length===start&&await list.getByRole('button',{name:'Enviar solicitudes',exact:true}).isDisabled(),`${label} unconfirmed restricted item adds no list item and sends zero POST`);
  await wine().getByRole('button',{name:'Cancelar',exact:true}).click();
  check(requests.length===start,`${label} cancelling age confirmation sends zero POST`);
  await wine().getByRole('button',{name:'Agregar a la lista',exact:true}).click();await wine().getByRole('button',{name:'Soy mayor de edad',exact:true}).click();
  check(requests.length===start,`${label} explicit age confirmation adds draft without sending a request`);
  check(await wine().getByRole('button',{name:'Ver mi lista · 1 unidad',exact:true}).isVisible(),`${label} selected product exposes a real list shortcut instead of a repeated add`);
  await assertListJump(wine().getByRole('button',{name:'Ver mi lista · 1 unidad',exact:true}),'selected-card-list-jump');
  await list.getByRole('button',{name:'Agregar una unidad de Vino reserva QA',exact:true}).click();
  check(await wine().getByRole('button',{name:'Soy mayor de edad',exact:true}).count()===0,`${label} confirmed age is reused for this product only`);
  await olive().getByRole('button',{name:'Agregar a la lista',exact:true}).click();
  check(await selection.getByRole('status').innerText()==='3 unidades en tu lista'&&!(await jump.isDisabled()),`${label} top selection count reflects actual units and enables the list shortcut`);
  await assertListJump(jump,'top-list-jump');
  if(width<=390){record.scenarios.push({name:'mobile-list-jump',headingFocused:true,headingUnobstructed:true,keyboard:true,units:3,noOverlay:true});await assessment(page,'#marketplace-request-list','marketplace-list-focused-viewport',width,theme);}
  check((await list.innerText()).includes('ARS 36.001')&&(await list.innerText()).includes('USD 15'),`${label} published prices retain currency separation`);
  await targets('populated list');await noOverflow(page,`${label} populated list fits viewport`);
  await assessment(page,'#consumer-portal-content','marketplace',width,theme);
  await list.getByRole('button',{name:'Enviar solicitudes',exact:true}).click();
  await list.getByText(/2 solicitudes registradas/).waitFor();
  const sent=requests.slice(start);record.scenarios.push({name:'explicit-age-and-list',requests:sent});
  check(sent.length===2&&sent.every(r=>r.status===200),`${label} exactly one synthetic request per selected product`);
  check(sent.every(r=>r.body.postTapEventId==='900001'&&!('fresh_token' in r.body)),`${label} contextual inquiries retain the durable event without an NFC assertion`);
  check(sent.find(r=>r.id==='market-wine-qa')?.body.ageGateAccepted===true&&sent.find(r=>r.id==='market-olive-qa')?.body.ageGateAccepted===false,`${label} each request carries the product-specific explicit age decision`);
  check(sent.every(r=>!JSON.stringify(r.body).match(/MercadoPago|Stripe|MetaMask|Método elegido/)),`${label} request messages do not invent payment integration`);
  check(await list.getByRole('button',{name:'Enviar solicitudes',exact:true}).isDisabled(),`${label} successful list is cleared`);
  check(await jump.isDisabled(),`${label} successful list resets the selection shortcut`);

  await reload();mode='held-success';await wine().getByRole('button',{name:'Solicitar contacto',exact:true}).click();await wine().getByRole('button',{name:'Soy mayor de edad',exact:true}).waitFor();
  await olive().getByRole('button',{name:'Agregar a la lista',exact:true}).click();const busyStart=requests.length;
  await list.getByRole('button',{name:'Enviar solicitudes',exact:true}).click();await list.getByRole('button',{name:'Enviando...',exact:true}).waitFor();
  check(await catalog.locator('article button[aria-busy]').evaluateAll((buttons,expectedCount)=>buttons.length===expectedCount&&buttons.every(button=>button.disabled),marketplaceFixtureItems.length),`${label} pending list freezes every contact mutation control`);
  check(await catalog.getByRole('button',{name:'Agregar a la lista',exact:true}).evaluateAll(buttons=>buttons.length>0&&buttons.every(button=>button.disabled)),`${label} pending list freezes all additional selection mutations`);
  check(await list.locator('button').evaluateAll(buttons=>buttons.length>=4&&buttons.every(button=>button.disabled)),`${label} pending list freezes quantity, remove and send controls`);
  const age=wine().getByRole('button',{name:'Soy mayor de edad',exact:true});check(await age.isDisabled(),`${label} pending list disables an age-confirmation action opened beforehand`);
  await age.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await settleLayout();
  const agePlacement=await focusPlacement(age);record.geometry.push({phase:'busy-age-native-click',...agePlacement});check(agePlacement.fullyUsable&&agePlacement.ownHit,`${label} pending age control is actually unobstructed before the native click`);
  const ageBounds=await age.boundingBox();check(Boolean(ageBounds),`${label} pending age control retains a real visible target`);await page.mouse.click(ageBounds.x+ageBounds.width/2,ageBounds.y+ageBounds.height/2);await settleLayout();
  check(requests.length===busyStart+1&&requests.at(-1).id==='market-olive-qa',`${label} native click on pending age confirmation sends zero extra POST`);
  const pending=held.pop();check(Boolean(pending?.route&&pending.entry),`${label} one exact synthetic pending response is held`);pending.entry.status=200;
  await pending.route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,deduplicated:false,request_mode:'request_only'})});await list.getByText(/1 solicitud registrada/).waitFor();
  check(requests.length===busyStart+1&&await wine().getByRole('button',{name:'Soy mayor de edad',exact:true}).isEnabled(),`${label} releasing the held result restores the pending age action without auto-submit`);
  record.scenarios.push({name:'busy-controls',requests:requests.slice(busyStart),draftEditsLocked:true,pendingAgeActionLocked:true,nativeAgeClickExtraPosts:0,releasedWithoutResubmit:true});mode='success';await reload();

  if(width===390&&theme==='light'){
   const limitStart=requests.length;await olive().getByRole('button',{name:'Agregar a la lista',exact:true}).click();
   const plus=list.getByRole('button',{name:'Agregar una unidad de Oliva QA',exact:true}),quantity=list.locator('span[aria-label="Cantidad"]');
   for(let count=1;count<24;count++)await plus.click();
   check(await quantity.innerText()==='24'&&await plus.isDisabled()&&await selection.getByRole('status').innerText()==='24 unidades en tu lista',`${label} list has an explicit 24-unit ceiling with an accurate selection count`);
   await plus.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await settleLayout();const limitPlacement=await focusPlacement(plus);record.geometry.push({phase:'quantity-limit-native-click',...limitPlacement});check(limitPlacement.fullyUsable&&limitPlacement.ownHit,`${label} quantity-limit control is unobstructed for a native boundary click`);
   const plusBounds=await plus.boundingBox();check(Boolean(plusBounds),`${label} quantity-limit control retains a real visible target`);await page.mouse.click(plusBounds.x+plusBounds.width/2,plusBounds.y+plusBounds.height/2);await settleLayout();
   check(await quantity.innerText()==='24'&&requests.length===limitStart,`${label} native click at the quantity ceiling neither changes the list nor sends a POST`);
   await list.getByRole('button',{name:'Quitar una unidad de Oliva QA',exact:true}).click();check(await quantity.innerText()==='23'&&await plus.isEnabled(),`${label} reducing quantity re-enables the explicit increment control`);
   await list.getByRole('button',{name:'Quitar Oliva QA de la lista',exact:true}).click();check(await jump.isDisabled()&&requests.length===limitStart,`${label} removing the line restores the empty list without a POST`);
   record.scenarios.push({name:'quantity-limit',maximum:24,nativeCeilingClickChangedQuantity:false,extraPosts:0,decrementRestoresIncrement:true});
   for(const directMode of ['success','invalid-json']){
    await reload();mode=directMode;const directStart=requests.length;
    await wine().getByRole('button',{name:'Agregar a la lista',exact:true}).click();await wine().getByRole('button',{name:'Soy mayor de edad',exact:true}).click();
    await list.getByRole('button',{name:'Agregar una unidad de Vino reserva QA',exact:true}).click();await olive().getByRole('button',{name:'Agregar a la lista',exact:true}).click();
    check(requests.length===directStart&&await selection.getByRole('status').innerText()==='3 unidades en tu lista',`${label} ${directMode} direct contact starts with an explicit three-unit draft and zero POST`);
    await wine().getByRole('button',{name:'Solicitar contacto',exact:true}).click();
    const directFeedback=directMode==='success'?'Solicitud registrada. La marca debe confirmar disponibilidad y condiciones.':'No pudimos confirmar si se registró. Revisá tus solicitudes antes de volver a enviar.';
    await wine().getByText(directFeedback,{exact:true}).waitFor();await settleLayout();
    const direct=requests.slice(directStart);check(direct.length===1&&direct[0].id==='market-wine-qa'&&direct[0].body.quantity===2&&direct[0].body.ageGateAccepted===true&&direct[0].body.postTapEventId==='900001'&&!('fresh_token' in direct[0].body),`${label} ${directMode} direct contact sends only the selected product's actual quantity and explicit contextual age decision`);
    check(await list.getByText('Oliva QA',{exact:true}).count()===1&&await list.getByRole('button',{name:'Enviar solicitudes',exact:true}).isEnabled(),`${label} ${directMode} direct contact preserves the other unsent product without auto-submit`);
    if(directMode==='success'){
     check(await list.getByText('Vino reserva QA',{exact:true}).count()===0&&await selection.getByRole('status').innerText()==='1 unidad en tu lista'&&await wine().getByRole('button',{name:'Solicitud enviada',exact:true}).isDisabled(),`${label} confirmed direct contact removes only its own draft line and disables repeated contact`);
    }else{
     check(await list.getByText('Vino reserva QA',{exact:true}).count()===1&&await selection.getByRole('status').innerText()==='3 unidades en tu lista'&&await wine().getByRole('button',{name:'Solicitar contacto',exact:true}).isEnabled()&&await list.locator('span[aria-label="Cantidad"]').first().innerText()==='2',`${label} uncertain direct contact preserves both draft lines and the original quantity`);
    }
    record.scenarios.push({name:directMode==='success'?'direct-contact-selected-quantity':'direct-contact-uncertain-draft',requests:direct,quantity:2,ageAccepted:true,otherLinePreserved:true,noAutoSubmit:true,confirmedLineRemoved:directMode==='success',draftPreserved:directMode!=='success'});
   }
   mode='success';
   await page.goto(route.replace('tenant=consumer-qa','tenant=qa-empty'),{waitUntil:'networkidle'});await catalog.waitFor();
   check(await catalog.locator('[data-marketplace-product]').count()===marketplaceFixtureItems.length,`${label} a URL brand override cannot replace the event's canonical published catalogue`);
   await page.goto(base+'/me/marketplace?fromTap=1&eventId=900003&action=marketplace&tenant=consumer-qa',{waitUntil:'networkidle'});
   check(await catalog.count()===0&&await page.getByText('Las consultas desde esta lectura no están disponibles. La marca pudo cambiar sus opciones o la lectura requiere revisión.',{exact:true}).count()===1,`${label} missing canonical brand never falls back to owned or URL-selected products`);
   check(await page.getByRole('link',{name:'Consultar el catálogo general',exact:true}).getAttribute('href')==='/me/marketplace',`${label} independent browsing requires an explicit safe link`);
   await reload();mode='configuration-changed';await olive().getByRole('button',{name:'Agregar a la lista',exact:true}).click();const withdrawnStart=requests.length;
   await list.getByRole('button',{name:'Enviar solicitudes',exact:true}).click();await catalog.getByText('Las consultas desde esta lectura ya no están disponibles. Tu lista se conserva en esta pantalla.',{exact:true}).waitFor();
   check(requests.length===withdrawnStart+1&&requests.at(-1).body.postTapEventId==='900001',`${label} withdrawn context makes one bound inquiry with no global fallback`);
   check(await list.getByText('Oliva QA',{exact:true}).count()===1&&await list.getByRole('button',{name:'Enviar solicitudes',exact:true}).isDisabled(),`${label} withdrawal preserves draft and prevents resubmission`);
   record.scenarios.push({name:'contextual-withdrawal',requests:requests.slice(withdrawnStart),draftPreserved:true});mode='success';
   for(const failureMode of ['context-denied','rate-limit','invalid-json','connection','headers-hang','body-hang']){
    await reload();mode=failureMode;await page.evaluate(value=>{window.__marketplaceBodyHang=value;},failureMode==='body-hang');
    await olive().getByRole('button',{name:'Agregar a la lista',exact:true}).click();const before=requests.length;
    await list.getByRole('button',{name:'Enviar solicitudes',exact:true}).click();
    const expected=failureMode==='context-denied'?'Primero asociá una lectura a tu Passport desde el formulario de esta página y luego volvé a intentar.':failureMode==='rate-limit'?'Se enviaron varias solicitudes. Esperá un momento y volvé a intentar.':'No pudimos confirmar si se registró. Revisá tus solicitudes antes de volver a enviar.';
    await olive().getByText(expected,{exact:true}).waitFor({timeout:16000});
    await list.getByRole('button',{name:'Enviar solicitudes',exact:true}).waitFor({state:'visible'});
    check(!(await list.getByRole('button',{name:'Enviar solicitudes',exact:true}).isDisabled()),`${label} ${failureMode} releases busy state`);
    check(requests.length===before+1,`${label} ${failureMode} performs one POST with no retry`);
    check(await list.getByText('Oliva QA',{exact:true}).count()===1,`${label} ${failureMode} preserves pending draft`);
    check(!/internal_|passport_context_required|Error:|ownership/.test(await catalog.innerText()),`${label} ${failureMode} keeps technical error codes out of customer copy`);
    record.scenarios.push({name:failureMode,requests:requests.slice(before),draftPreserved:true});
    for(const pending of held.splice(0))await (pending.route||pending).abort().catch(()=>{});
    mode='success';
   }
   await reload();mode='partial';await wine().getByRole('button',{name:'Agregar a la lista',exact:true}).click();await wine().getByRole('button',{name:'Soy mayor de edad',exact:true}).click();await olive().getByRole('button',{name:'Agregar a la lista',exact:true}).click();
   const partialStart=requests.length;await list.getByRole('button',{name:'Enviar solicitudes',exact:true}).click();await list.getByText(/Los productos pendientes siguen en tu lista/).waitFor();
   check(await list.getByText('Oliva QA',{exact:true}).count()===1&&await list.getByText('Vino reserva QA',{exact:true}).count()===0,`${label} partial success preserves only failed draft lines`);
   record.scenarios.push({name:'partial-success',requests:requests.slice(partialStart),draftPreserved:true});

   await page.goto(route+'&signature=synthetic-do-not-carry&cap=synthetic-do-not-carry',{waitUntil:'networkidle'});await catalog.waitFor();mode='unauthorized';const unauthorizedStart=requests.length;
   await olive().getByRole('button',{name:'Solicitar contacto',exact:true}).click();await page.waitForURL(url=>url.pathname==='/login');
   const next=new URL(page.url()).searchParams.get('next'),target=new URL(next,base);
   check(target.pathname==='/me/marketplace'&&target.searchParams.get('eventId')==='900001'&&target.searchParams.get('tenant')==='consumer-qa'&&target.searchParams.get('action')==='marketplace'&&!target.searchParams.has('signature')&&!target.searchParams.has('cap'),`${label} authentication preserves safe catalogue context without capabilities`);
   check(requests.length===unauthorizedStart+1,`${label} authentication redirect does not retry the request`);
   mode='success';await reload();check(requests.length===unauthorizedStart+1,`${label} returning to catalogue does not automatically submit`);
   record.scenarios.push({name:'authentication-return',requests:requests.slice(unauthorizedStart),next});
   await page.goto(base+'/me/marketplace?tenant=qa-empty',{waitUntil:'networkidle'});
   check(await catalog.count()===0&&await page.getByText(/Todavía no hay productos publicados para este contexto/).count()===1,`${label} empty published catalogue does not invent promotional products`);
  }
 }catch(error){record.failed=true;record.error=String(error.message).slice(0,500);record.visible=(await page.locator('body').innerText()).slice(0,6000);throw error;}
 finally{for(const pending of held)await (pending.route||pending).abort().catch(()=>{});await page.unroute(endpoint,handler);await page.unroute(brokenImagePattern,brokenImageHandler);}
}
