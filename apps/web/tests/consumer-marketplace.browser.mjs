// Called by the existing CI portal runner against actual Next production pages.
// Intercepted request receipts are synthetic; no customer or provider writes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {marketplaceFixtureItems} from './consumer-marketplace-fixture.mjs';

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
 return {qaSource:process.env.QA_SOURCE||null,buildId:(await readFile(join(web,'.next/BUILD_ID'),'utf8')).trim(),
  hashes:Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile(join(repo,path))).digest('hex')])))};
}

export async function runMarketplaceScenarios({page,base,width,theme,report,check,assessment,noOverflow}){
 const label=`${width}/${theme} catalogue`,requests=[];
 const record={width,theme,requests,geometry:[],scenarios:[],syntheticRequestOnly:true,realPurchaseCertified:false};
 report.marketplace??=[];report.marketplace.push(record);
 let mode='success';const held=[];
 const endpoint='**/api/marketplace/products/*/request-to-buy';
 const handler=async route=>{
  const request=route.request(),url=new URL(request.url()),id=decodeURIComponent(url.pathname.split('/').at(-2));
  assert.equal(request.method(),'POST');assert.ok(marketplaceFixtureItems.some(item=>item.id===id),'only synthetic catalogue IDs may be intercepted');
  const body=request.postDataJSON();assert.ok(requests.length<40,'bounded catalogue request diagnostics');
  const entry={path:url.pathname,method:request.method(),id,mode,body,status:null};requests.push(entry);
  if(mode==='headers-hang'){held.push(route);return;}
  if(mode==='connection'){entry.networkAborted=true;return route.abort('failed');}
  const status=mode==='unauthorized'?401:mode==='context-denied'?403:mode==='rate-limit'?429:mode==='partial'&&id==='market-olive-qa'?503:200;
  entry.status=status;
  if(mode==='invalid-json')return route.fulfill({status,contentType:'application/json',body:'not JSON'});
  return route.fulfill({status,contentType:'application/json',body:JSON.stringify({ok:status===200,error:status===403?'passport_context_required':status===429?'internal_rate_limit_qa':status!==200?'internal_provider_error_qa':undefined,deduplicated:false,request_mode:'request_only'})});
 };
 await page.route(endpoint,handler);
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
 try{
  await reload();
  check(await catalog.locator('[data-marketplace-product]').count()===4,`${label} renders only the four published fixture products`);
  check(await page.locator('.marketplace-product-visual').count()===0,`${label} no global decorative media classes`);
  const initial=await stageGeometry();record.geometry.push({phase:'initial',stages:initial});
  check(initial.every(g=>g.contained&&g.imageContained&&g.position==='relative'&&['none','normal'].includes(g.pseudoBefore)&&['none','normal'].includes(g.pseudoAfter)),`${label} media and real images stay within their own product cards`);
  for(const item of marketplaceFixtureItems){
   const src=item.imageUrl||item.image_url||item.photoUrl||item.photo_url||null;
   check(initial.find(g=>g.id===item.id)?.imageSrc===src,`${label} preserves published photo URL ${item.id}`);
  }
  check(await card('market-no-photo-qa').getByText('Foto no publicada',{exact:true}).count()===1,`${label} no invented photo for missing catalogue image`);
  check(await wine().getByText('ARS 18.000,5',{exact:true}).count()===1,`${label} published price retains cents`);
  check(await card('market-experience-qa').getByRole('button',{name:'Solicitar contacto',exact:true}).isDisabled(),`${label} unavailable product cannot be requested`);
  check(await card('market-no-photo-qa').getByRole('button',{name:'Solicitar contacto',exact:true}).isDisabled(),`${label} disabled request capability stays disabled`);
  const text=await catalog.innerText();check(!/Passport item|ownership|MetaMask|MercadoPago|Stripe|assets|Sumaste|Gran Reserva Malbec/.test(text),`${label} no simulated promotional, payment or points-award claims`);
  const choice=page.getByTestId('tap-association-option-claim').locator('..');await choice.scrollIntoViewIfNeeded();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const hit=await choice.evaluate(el=>{const r=el.getBoundingClientRect(),point={x:r.left+r.width/2,y:r.top+r.height/2},hit=document.elementFromPoint(point.x,point.y);return {bounds:{top:r.top,bottom:r.bottom,left:r.left,right:r.right},point,hitText:hit?.textContent?.trim().slice(0,80),ownLabel:hit===el||el.contains(hit)};});
  record.tapChoiceHit=hit;check(hit.ownLabel,`${label} tap ownership choice remains unobstructed by catalogue media`);
  record.geometry.push({phase:'tap-form',stages:await stageGeometry()});
  await assessment(page,'[data-testid="tap-association"]','marketplace-tap-form',width,theme);
  await targets('initial');await noOverflow(page,`${label} fits viewport`);
  const search=catalog.getByRole('searchbox',{name:'Buscar productos'});await search.fill('no existe QA');
  check(await catalog.locator('[data-marketplace-product]').count()===0,`${label} search shows honest empty result`);
  await search.fill('');await catalog.getByRole('button',{name:'Vinos',exact:true}).click();
  check(await catalog.locator('[data-marketplace-product]').count()===1,`${label} category filter selects real published wine`);
  await catalog.getByRole('button',{name:'Todo',exact:true}).click();

  const start=requests.length;
  await wine().getByRole('button',{name:'Agregar a la lista',exact:true}).click();
  await wine().getByRole('button',{name:'Soy mayor de edad',exact:true}).waitFor();
  check(requests.length===start&&await list.getByRole('button',{name:'Enviar solicitudes',exact:true}).isDisabled(),`${label} unconfirmed restricted item adds no list item and sends zero POST`);
  await wine().getByRole('button',{name:'Cancelar',exact:true}).click();
  check(requests.length===start,`${label} cancelling age confirmation sends zero POST`);
  await wine().getByRole('button',{name:'Agregar a la lista',exact:true}).click();await wine().getByRole('button',{name:'Soy mayor de edad',exact:true}).click();
  check(requests.length===start,`${label} explicit age confirmation adds draft without sending a request`);
  await wine().getByRole('button',{name:'Agregar a la lista',exact:true}).click();
  check(await wine().getByRole('button',{name:'Soy mayor de edad',exact:true}).count()===0,`${label} confirmed age is reused for this product only`);
  await olive().getByRole('button',{name:'Agregar a la lista',exact:true}).click();
  check((await list.innerText()).includes('ARS 36.001')&&(await list.innerText()).includes('USD 15'),`${label} published prices retain currency separation`);
  await targets('populated list');await noOverflow(page,`${label} populated list fits viewport`);
  await assessment(page,'#consumer-portal-content','marketplace',width,theme);
  await list.getByRole('button',{name:'Enviar solicitudes',exact:true}).click();
  await list.getByText(/2 solicitudes registradas/).waitFor();
  const sent=requests.slice(start);record.scenarios.push({name:'explicit-age-and-list',requests:sent});
  check(sent.length===2&&sent.every(r=>r.status===200),`${label} exactly one synthetic request per selected product`);
  check(sent.find(r=>r.id==='market-wine-qa')?.body.ageGateAccepted===true&&sent.find(r=>r.id==='market-olive-qa')?.body.ageGateAccepted===false,`${label} each request carries the product-specific explicit age decision`);
  check(sent.every(r=>!JSON.stringify(r.body).match(/MercadoPago|Stripe|MetaMask|Método elegido/)),`${label} request messages do not invent payment integration`);
  check(await list.getByRole('button',{name:'Enviar solicitudes',exact:true}).isDisabled(),`${label} successful list is cleared`);

  if(width===390&&theme==='light'){
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
    for(const pending of held.splice(0))await pending.abort().catch(()=>{});
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
 finally{for(const pending of held)await pending.abort().catch(()=>{});await page.unroute(endpoint,handler);}
}
