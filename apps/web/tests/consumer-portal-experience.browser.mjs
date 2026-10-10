// Actual Next pages/router and production components, explicit synthetic local
// account/notice projections via consumer-portal-local-fetch.mjs. Read-only.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {marketplaceBinding,runMarketplaceScenarios} from './consumer-marketplace.browser.mjs';
import {runClaimPinScenarios} from './consumer-claim-pin.browser.mjs';

const web=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(web,'../..');
let base=process.env.QA_BASE_URL||'',next=null,serverFailed=false;
if(base)assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'QA must stay on loopback');
const outputParent=resolve(process.env.QA_OUTPUT||'artifacts/consumer-portal-experience');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright-core');
const axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
await mkdir(outputParent,{recursive:true});
const output=await mkdtemp(join(outputParent,'run-'));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const report={localOnly:true,realProductionBuild:!process.env.QA_BASE_URL,actualNextRouter:true,syntheticConsumerAndNotices:true,physicalTapMeasured:false,checks:[],views:[],errors:[],blockedWrites:[],geolocationCalls:0};
report.marketplaceBindingBefore=await marketplaceBinding(repo,web);
const check=(value,name)=>{report.checks.push({name,passed:Boolean(value)});assert.ok(value,name);};
async function assessment(page,selector,name,width,theme){
 await page.addScriptTag({content:axe});
 const violations=await page.evaluate(async selector=>(await axe.run(selector,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target),failures:v.nodes.map(n=>n.failureSummary)})),selector);
 // Retain the failing rule and target even when the assertion stops the run.
 report.views.push({width,theme,name,selector,violations});
 check(violations.length===0,`${width}/${theme} ${name}: zero axe violations`);
 await page.screenshot({path:join(output,`${name}-${width}-${theme}.png`),fullPage:name==='products'||name==='experience'||name==='marketplace'});
}
async function noOverflow(page,label){check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label);}
async function whatsappOnlyHomeRegression(page,context,width,theme){
 const phone='+12025550124';
 const observed={width,theme,syntheticContact:true,actualNextPage:true};
 report.whatsappOnlyHome??=[];report.whatsappOnlyHome.push(observed);
 await context.addCookies([{name:'consumer_contact_qa',value:'whatsapp-only',url:base,httpOnly:true,sameSite:'Lax'}]);
 try{
  await page.goto(base+'/me',{waitUntil:'networkidle'});
  const home=page.getByTestId('consumer-home');await home.waitFor();
  const account=home.locator('section[aria-labelledby="home-account-title"]');await account.waitFor();
  observed.contactLabels=await account.locator('dt').allTextContents();
  observed.contactValues=await account.locator('dd').allTextContents();
  observed.welcome=await home.locator('#home-welcome-title').innerText();
  const accountText=await account.innerText();
  check(observed.contactLabels.length===1&&observed.contactLabels[0].trim()==='WhatsApp'&&observed.contactValues.length===1&&observed.contactValues[0]===phone,`${width}/${theme} actual Next phone-only account reports WhatsApp as its single contact`);
  check(await home.getByText(phone,{exact:true}).count()===1&&observed.welcome==='Tu cuenta',`${width}/${theme} phone is shown once and is not repeated as a greeting`);
  check(await account.getByText('Correo electrónico',{exact:true}).count()===0&&!/sin email|correo.*no informado|contacto no informado/i.test(accountText),`${width}/${theme} phone-only account does not imply a missing email`);
  check(await account.getByText('Cuenta registrada',{exact:true}).count()===1&&!/\b(?:registered|verified|active|anonymous)\b/.test(accountText),`${width}/${theme} reported account status has a customer label without raw backend state`);
  await noOverflow(page,`${width}/${theme} actual Next WhatsApp-only home fits viewport`);
  await account.scrollIntoViewIfNeeded();
  await assessment(page,'section[aria-labelledby="home-account-title"]','whatsapp-only-account',width,theme);
 }finally{
  await context.clearCookies({name:'consumer_contact_qa'});
 }
}
async function feedbackPublicationRegression(page,open,ficha,width,theme){
 const url=base+'/api/public/passport/900001/configuration';
 const observed={width,theme,eventId:'900001',tenant:'consumer-qa',configurationReads:0,credentialedReads:0};
 report.feedbackPublication??=[];report.feedbackPublication.push(observed);
 await page.keyboard.press('Escape');await ficha.waitFor({state:'hidden'});
 let release;
 const held=new Promise(resolve=>{release=resolve;});
 const handler=async route=>{
  const request=route.request();observed.configurationReads++;
  if(request.headers().cookie||request.headers().authorization)observed.credentialedReads++;
  assert.equal(request.method(),'GET');assert.equal(new URL(request.url()).search,'');
  const configuration=await held;
  return route.fulfill({status:200,contentType:'application/json',headers:{'cache-control':'no-store'},body:JSON.stringify({ok:true,configuration})});
 };
 await page.route(url,handler);
 try{
  await open.click();await ficha.waitFor();
  await ficha.getByRole('status').filter({hasText:'Consultando las opciones actuales de la marca'}).waitFor();
  check(await ficha.getByRole('link',{name:'Compartir experiencia',exact:true}).count()===0,`${width}/${theme} pending brand publication offers no feedback action`);
  check(await ficha.getByRole('link',{name:'Catálogo de la marca',exact:true}).count()===1,`${width}/${theme} loading feedback retains the separate catalogue destination`);
  release({version:'nexid.tenant-actions.v1',status:'published',allowedActions:['marketplace'],program:null,trivia:null,catalogAvailable:true,tenantSlug:'consumer-qa'});
  await ficha.getByRole('status').filter({hasText:'La marca no está recibiendo opiniones'}).waitFor();
  check(await ficha.getByRole('link',{name:'Compartir experiencia',exact:true}).count()===0,`${width}/${theme} current unpublished feedback has no actionable destination`);
  check(observed.configurationReads===1&&observed.credentialedReads===0,`${width}/${theme} feedback publication reads the selected event once without account credentials`);
 }finally{
  release(null);await page.unroute(url,handler);
 }
 await page.keyboard.press('Escape');await ficha.waitFor({state:'hidden'});
 // The normal BFF/local backend fixture publishes feedback for this exact
 // saved reading and tenant. Wait for that asynchronous contract, not a tick.
 await open.click();await ficha.waitFor();
 const feedback=ficha.getByRole('link',{name:'Compartir experiencia',exact:true});await feedback.waitFor();
 const href=new URL(await feedback.getAttribute('href'),base);
 check(href.pathname==='/me/experiences'&&href.searchParams.get('eventId')==='900001'&&href.searchParams.get('tenant')==='consumer-qa',`${width}/${theme} republished feedback keeps the authenticated reading and brand context`);
}
async function productPhotoRecovery(page,context,width,theme){
 const observed={width,theme,failedRequests:0,updatedRequests:0,sameProductCard:false};
 report.productPhotoRecovery??=[];report.productPhotoRecovery.push(observed);
 await page.route('**/qa-photo/*',route=>{
  const request=route.request(),url=new URL(request.url());
  assert(url.origin===base&&request.method()==='GET'&&!url.search);
  if(url.pathname==='/qa-photo/failed.svg'){observed.failedRequests++;return route.fulfill({status:404,contentType:'text/plain',body:'Synthetic missing photo'});}
  assert.equal(url.pathname,'/qa-photo/updated.svg');observed.updatedRequests++;
  return route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="104" height="112"><rect width="104" height="112" fill="#17745d"/><title>Local synthetic replacement image</title></svg>'});
 });
 await context.addCookies([{name:'consumer_photo_qa',value:'failed',url:base,httpOnly:true,sameSite:'Lax'}]);
 await page.goto(base+'/me',{waitUntil:'networkidle'});
 const home=page.getByTestId('consumer-home'),card=home.locator('li').filter({has:page.getByRole('heading',{name:'Vino reserva QA',exact:true})});
 await card.waitFor();
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('[data-testid="consumer-home"] li')).find(node=>node.querySelector('h3')?.textContent==='Vino reserva QA')?.querySelector('img'));
 // Next Image reassigns img.src during hydration to replay a pre-hydration
 // error to onError. A missing SSR image can therefore make two bounded GETs.
 const failedRequestsAtFallback=observed.failedRequests;
 check(failedRequestsAtFallback>=1&&failedRequestsAtFallback<=2&&await card.locator('img').count()===0,`${width}/${theme} failed product photo has a stable fallback`);
 await card.evaluate(node=>{window.__photoRecoveryCard=node;});
 await context.addCookies([{name:'consumer_photo_qa',value:'updated',url:base,httpOnly:true,sameSite:'Lax'}]);
 await home.getByRole('button',{name:'Reintentar carga',exact:true}).click();
 const image=card.getByRole('img',{name:'Vino reserva QA',exact:true});await image.waitFor();
 await page.waitForFunction(()=>{const node=document.querySelector('img[src$="/qa-photo/updated.svg"]');return node?.complete&&node.naturalWidth===104&&node.naturalHeight===112;});
 observed.sameProductCard=await card.evaluate(node=>node===window.__photoRecoveryCard);
 check(observed.sameProductCard,`${width}/${theme} actual Next refresh keeps the same mounted product card`);
 check(new URL(await image.getAttribute('src'),base).href===base+'/qa-photo/updated.svg'&&await image.evaluate(node=>node.complete&&node.naturalWidth===104&&node.naturalHeight===112),`${width}/${theme} newly reported product photo replaces the failed source`);
 check(observed.failedRequests===failedRequestsAtFallback&&observed.updatedRequests===1,`${width}/${theme} recovery loads the new source once without retrying the failed URL`);
 await noOverflow(page,`${width}/${theme} recovered photo fits viewport`);
 await assessment(page,'[data-testid="consumer-home"]','photo-recovered',width,theme);
 await context.clearCookies({name:'consumer_photo_qa'});
}
async function nativeCloseRegression(page,more,menu,width,theme){
 const result={width,theme};report.nativeCloseRegression??=[];report.nativeCloseRegression.push(result);
 result.focus=await page.evaluate(async()=>{
  const dialog=document.querySelector('dialog[open]'),close=dialog.querySelector('button[aria-label="Cerrar más opciones"]'),search=document.querySelector('input[type="search"]');
  const closed=new Promise(resolve=>dialog.addEventListener('close',event=>requestAnimationFrame(()=>resolve({trusted:event.isTrusted,activeIsSearch:document.activeElement===search,dialogOpen:dialog.open})),{once:true}));
  close.click();search.focus();const immediatelyFocusedSearch=document.activeElement===search;
  return {immediatelyFocusedSearch,afterNativeClose:await closed};
 });
 check(result.focus.immediatelyFocusedSearch&&result.focus.afterNativeClose.trusted&&result.focus.afterNativeClose.activeIsSearch&&!result.focus.afterNativeClose.dialogOpen,`${width}/${theme} native queued close preserves the customer's subsequent search focus`);
 await more.click();await menu.waitFor();
 result.reopen=await page.evaluate(async()=>{
  const dialog=document.querySelector('dialog[open]'),close=dialog.querySelector('button[aria-label="Cerrar más opciones"]'),trigger=document.querySelector('button[aria-controls="'+dialog.id+'"]');
  const closed=new Promise(resolve=>dialog.addEventListener('close',event=>requestAnimationFrame(()=>resolve({trusted:event.isTrusted,dialogOpen:dialog.open,expanded:trigger.getAttribute('aria-expanded')})),{once:true}));
  close.click();trigger.click();const immediatelyReopened=dialog.open;
  return {immediatelyReopened,afterNativeClose:await closed};
 });
 check(result.reopen.immediatelyReopened&&result.reopen.afterNativeClose.trusted&&result.reopen.afterNativeClose.dialogOpen&&result.reopen.afterNativeClose.expanded==='true',`${width}/${theme} stale native close preserves reopened More dialog and expanded state`);
}
async function introContrast(surface){return surface.evaluate(root=>{
 const channels=color=>color.match(/[\d.]+/g)?.map(Number)||[],luminance=rgb=>rgb.slice(0,3).map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((value,channel,index)=>value+channel*[.2126,.7152,.0722][index],0);
 const style=getComputedStyle(root),background=channels(style.backgroundColor),heading=root.querySelector('h2'),paragraph=heading?.nextElementSibling,headingStyle=getComputedStyle(heading);
 const ratio=element=>{const foreground=channels(getComputedStyle(element).color);if((background[3]??1)<1||(foreground[3]??1)<1)return null;const a=luminance(foreground),b=luminance(background);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
 const size=parseFloat(headingStyle.fontSize),weight=parseFloat(headingStyle.fontWeight),headingMinimum=size>=24||(size>=18.667&&weight>=700)?3:4.5;
 return {backgroundColor:style.backgroundColor,backgroundImage:style.backgroundImage,headingColor:headingStyle.color,paragraphColor:getComputedStyle(paragraph).color,headingRatio:ratio(heading),headingMinimum,paragraphRatio:ratio(paragraph)};
});}
try{
 if(!base){
  const reserve=createServer();await new Promise(resolve=>reserve.listen(0,'127.0.0.1',resolve));const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(key)));
  Object.assign(env,{NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',CONSUMER_PORTAL_QA:'1'});
  next=spawn(process.execPath,['--import',pathToFileURL(join(web,'tests/consumer-portal-local-fetch.mjs')).href,join(repo,'node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:web,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  // Drain process streams without recording environment/provider output.
  next.stdout.on('data',()=>{});next.stderr.on('data',()=>{});next.on('error',()=>{serverFailed=true;});
  base=`http://127.0.0.1:${port}`;let ready=false;
  for(let attempt=0;attempt<120;attempt++){
   if(serverFailed||next.exitCode!==null)break;
   try{if((await fetch(base+'/release.json',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}
   await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.ok(ready,'isolated production test server must become ready');
 }
 for(const theme of ['light','dark'])for(const width of [320,390,768,1280,1440]){
  const context=await browser.newContext({viewport:{width,height:900},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addCookies([{name:'consumer_qa',value:'local',url:base,httpOnly:true,sameSite:'Lax'},{name:'theme',value:theme,url:base},{name:'nexid_theme_version',value:'white-first-v2',url:base}]);
  await context.exposeBinding('__qaLocationCall',()=>{report.geolocationCalls++;});
  await context.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){void window.__qaLocationCall();throw Error('Unexpected automatic location request');},watchPosition(){void window.__qaLocationCall();throw Error('Unexpected automatic location watch');}}});});
  const page=await context.newPage();page.on('pageerror',error=>report.errors.push({width,theme,message:error.message}));
  await page.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(!['GET','HEAD'].includes(request.method())){report.blockedWrites.push({path:url.pathname,method:request.method()});return route.abort();}return ['localhost','127.0.0.1'].includes(url.hostname)||['data:','blob:'].includes(url.protocol)?route.continue():route.abort();});
  await productPhotoRecovery(page,context,width,theme);
  await whatsappOnlyHomeRegression(page,context,width,theme);
  await page.goto(base+'/me/products',{waitUntil:'networkidle',timeout:90000});
  const library=page.getByTestId('consumer-product-library');await library.waitFor();
  check(await library.getByRole('button',{name:/Abrir ficha y avisos de /}).count()===12,`${width}/${theme} first page has 12 product actions`);
  check(await library.locator('article').evaluateAll(cards=>cards.every(card=>card.querySelectorAll('button').length===1&&card.querySelectorAll('a,details').length===0)),`${width}/${theme} each card has one action`);
  check(await library.locator('article button').evaluateAll(buttons=>buttons.every(button=>button.getBoundingClientRect().height>=44&&parseFloat(getComputedStyle(button).fontSize)>=14)),`${width}/${theme} product actions are legible touch targets`);
  check(await page.getByTestId('product-notices').count()===0,`${width}/${theme} list performs no notice read`);
  await noOverflow(page,`${width}/${theme} products fit viewport`);await assessment(page,'[data-testid="consumer-product-library"]','products',width,theme);

  const more=page.getByRole('button',{name:'Más',exact:true});await more.focus();await page.keyboard.press('Enter');
  const menu=page.getByRole('dialog',{name:'Más opciones'});await menu.waitFor();
  for(const label of ['Productos y marcas','Herramientas','Mi cuenta'])check(await menu.getByRole('heading',{name:label,exact:true}).count()===1,`${width}/${theme} More group ${label}`);
  check(await menu.getByRole('link').count()===9,`${width}/${theme} all nine More destinations retained`);
  await assessment(page,'dialog[open]','more',width,theme);
  await nativeCloseRegression(page,more,menu,width,theme);
  await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});check(await more.evaluate(element=>element===document.activeElement),`${width}/${theme} More returns keyboard focus`);
  await more.click();await menu.waitFor();
  const menuBounds=await menu.boundingBox();check(menuBounds.x>1||menuBounds.y>1,`${width}/${theme} backdrop test point is outside the dialog`);
  await page.mouse.click(1,1);await menu.waitFor({state:'hidden'});check(await more.evaluate(element=>element===document.activeElement),`${width}/${theme} backdrop dismissal still restores keyboard focus`);

  const search=library.getByRole('searchbox',{name:'Buscar producto, marca o lote'});await search.fill('reserva');
  const open=library.getByRole('button',{name:'Abrir ficha y avisos de Vino reserva QA',exact:true});await open.focus();await page.keyboard.press('Enter');
  const ficha=page.getByRole('dialog',{name:'Vino reserva QA'});await ficha.waitFor();await ficha.getByRole('heading',{name:'Aviso de ensayo local',exact:true}).waitFor();
  check(new URL(page.url()).searchParams.get('focus')==='900001',`${width}/${theme} selected account reference enters URL`);
  check((await ficha.innerText()).includes('NO ES UN TAP NUEVO'),`${width}/${theme} saved reading remains historical`);
  await ficha.getByRole('link',{name:'Compartir experiencia',exact:true}).waitFor();
  check(await ficha.getByRole('link',{name:'Compartir experiencia',exact:true}).count()===1&&await ficha.getByRole('link',{name:'Catálogo de la marca',exact:true}).count()===1,`${width}/${theme} published secondary destinations retained in ficha`);
  await feedbackPublicationRegression(page,open,ficha,width,theme);
  await ficha.getByText('¿Necesitás ayuda con este producto?',{exact:true}).click();
  check((await ficha.innerText()).includes('cuando esa opción esté habilitada'),`${width}/${theme} contextual help keeps reporting conditional`);
  check(await ficha.locator('a,button,summary').evaluateAll(elements=>elements.filter(element=>element.getClientRects().length&&getComputedStyle(element).visibility!=='hidden').every(element=>element.getBoundingClientRect().height>=44)),`${width}/${theme} ficha actions have 44px targets`);
  await noOverflow(page,`${width}/${theme} ficha fits viewport`);await assessment(page,'dialog[open]','ficha',width,theme);
  await page.goBack({waitUntil:'domcontentloaded'});await ficha.waitFor({state:'hidden'});
  check(await search.inputValue()==='reserva',`${width}/${theme} Back retains product filters`);
  await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Abrir ficha y avisos de Vino reserva QA');check(true,`${width}/${theme} Back returns product keyboard focus`);
  await open.click();await ficha.waitFor();await page.keyboard.press('Escape');await ficha.waitFor({state:'hidden'});check(new URL(page.url()).searchParams.get('focus')===null,`${width}/${theme} Escape closes selected URL`);

  await page.goto(base+'/me/products?focus=900002',{waitUntil:'networkidle'});await page.getByRole('dialog',{name:'Aceite de oliva QA'}).waitFor();
  await page.evaluate(()=>window.history.pushState(null,'','?focus=900001'));await page.getByRole('dialog',{name:'Vino reserva QA'}).waitFor();
  check(true,`${width}/${theme} same-page history changes selected product`);
  await page.keyboard.press('Escape');await page.locator('dialog[open]').waitFor({state:'hidden'});
  for(const query of ['focus=999999','focus=900001&focus=900002','focus=01']){await page.goto(base+'/me/products?'+query,{waitUntil:'networkidle'});await library.waitFor();check(await page.locator('dialog[open]').count()===0,`${width}/${theme} rejects unowned or ambiguous focus ${query}`);}

  await page.goto(base+'/me/taps/900003',{waitUntil:'networkidle'});const unknown=page.getByTestId('reading-current-notices');await unknown.waitFor();
  check((await unknown.innerText()).includes('No se presume que el producto esté libre de restricciones'),`${width}/${theme} missing scope visibly unknown`);
  check(await unknown.getByRole('button').count()===0&&await page.getByTestId('product-notices').count()===0,`${width}/${theme} missing scope makes no notice request`);
  await unknown.getByText('¿Necesitás ayuda con este producto?',{exact:true}).click();await noOverflow(page,`${width}/${theme} reading help fits viewport`);await assessment(page,'[data-testid="reading-current-notices"]','unknown-notices',width,theme);
  await page.goto(base+'/me/taps/900001',{waitUntil:'networkidle'});check(await page.getByTestId('product-notices').count()===0,`${width}/${theme} valid reading defers notice query`);
  const editorial=page.getByTestId('current-editorial-resources');await editorial.waitFor();
  check(await editorial.getAttribute('data-editorial-state')==='published',`${width}/${theme} current publication is reported separately`);
  check(await page.getByRole('heading',{name:'Vino reserva QA',exact:true}).count()===1,`${width}/${theme} historical identity remains visible`);
  check(!await editorial.locator('details').evaluate(element=>element.open),`${width}/${theme} current publication starts collapsed`);
  await page.getByTestId('current-editorial-summary').click();
  check((await editorial.innerText()).includes('Ficha actual de ensayo'),`${width}/${theme} current editorial identity uses its published document`);
  check(await editorial.locator('[data-current-resource-kind="technical"]').getAttribute('href')==='https://docs.example.test/current-qa.pdf',`${width}/${theme} current document keeps the public source URL`);
  await noOverflow(page,`${width}/${theme} current publication fits viewport`);await assessment(page,'[data-testid="current-editorial-resources"]','current-editorial',width,theme);
  await page.getByRole('button',{name:'Consultar avisos actuales del producto'}).click();await page.getByRole('heading',{name:'Aviso de ensayo local',exact:true}).waitFor();
  check(true,`${width}/${theme} explicit notice read succeeds`);
  await page.goto(base+'/me/taps/900002',{waitUntil:'networkidle'});await editorial.waitFor();
  check(await editorial.getAttribute('data-editorial-state')==='withdrawn'&&await editorial.locator('a').count()===0,`${width}/${theme} withdrawn publication shows no historical document fallback`);
  check((await editorial.innerText()).includes('Este aviso no confirma un retiro de producto'),`${width}/${theme} withdrawn editorial does not imply a product recall`);
  await noOverflow(page,`${width}/${theme} withdrawn publication fits viewport`);await assessment(page,'[data-testid="current-editorial-resources"]','withdrawn-editorial',width,theme);
  await page.goto(base+'/me/experiences?eventId=900001&product=Producto+de+ensayo&tenant=consumer-qa',{waitUntil:'networkidle'});
  const experience=page.getByTestId('verified-experience-form');await experience.waitFor();
  check(await experience.isVisible(),`${width}/${theme} actual experience form visible`);
  report.experienceControls??=[];report.experienceControls.push({width,theme,buttons:await experience.locator('button').evaluateAll(elements=>elements.map(element=>({text:element.textContent.trim(),visible:element.getClientRects().length>0,height:element.getBoundingClientRect().height,fontSize:getComputedStyle(element).fontSize,minHeight:getComputedStyle(element).minHeight}))),fields:await experience.locator('input:not([type="radio"]):not([type="file"]),textarea,select').evaluateAll(elements=>elements.map(element=>({name:element.getAttribute('aria-label')||element.getAttribute('placeholder'),fontSize:getComputedStyle(element).fontSize}))) });
  check(await experience.locator('input:not([type="radio"]):not([type="file"]),textarea,select').evaluateAll(elements=>elements.length>0&&elements.filter(element=>element.getClientRects().length).every(element=>parseFloat(getComputedStyle(element).fontSize)>=16)),`${width}/${theme} actual experience fields use 16px text`);
  check(await experience.locator('button').evaluateAll(elements=>elements.length>0&&elements.filter(element=>element.getClientRects().length).every(element=>element.getBoundingClientRect().height>=44)),`${width}/${theme} actual experience actions have 44px targets`);
  const formContrast=await introContrast(experience);report.experienceControls.at(-1).introContrast=formContrast;
  check(formContrast.backgroundImage==='none'&&formContrast.headingRatio>=formContrast.headingMinimum&&formContrast.paragraphRatio>=4.5,`${width}/${theme} actual experience heading and introduction have readable contrast against solid form background`);
  const explainer=page.getByTestId('experience-explainer');await explainer.waitFor();const explainerContrast=await introContrast(explainer);report.experienceControls.at(-1).explainerContrast=explainerContrast;
  check(explainerContrast.backgroundImage==='none'&&explainerContrast.headingRatio>=explainerContrast.headingMinimum&&explainerContrast.paragraphRatio>=4.5,`${width}/${theme} experience explanation heading and paragraph have readable contrast against solid card background`);
  await noOverflow(page,`${width}/${theme} actual experience page fits viewport`);await assessment(page,'#consumer-portal-content','experience',width,theme);
  await runMarketplaceScenarios({page,base,width,theme,report,check,assessment,noOverflow});
  await runClaimPinScenarios({page,base,width,theme,report,check,assessment,noOverflow});
  await context.close();
 }
 const anonymous=await browser.newContext();const page=await anonymous.newPage();page.on('pageerror',error=>report.errors.push({name:'anonymous',message:error.message}));
 await page.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(!['GET','HEAD'].includes(request.method())){report.blockedWrites.push({path:url.pathname,method:request.method()});return route.abort();}return ['localhost','127.0.0.1'].includes(url.hostname)?route.continue():route.abort();});
 await page.goto(base+'/me/products',{waitUntil:'domcontentloaded'});await page.waitForURL(url=>url.pathname==='/login');check(true,'anonymous access still requires consumer authentication');await anonymous.close();
 const logout=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'});
 await logout.addCookies([{name:'consumer_qa',value:'local',url:base,httpOnly:true,sameSite:'Lax'}]);
 const logoutPage=await logout.newPage();let logoutCalls=0;logoutPage.on('pageerror',error=>report.errors.push({name:'logout',message:error.message}));
 await logoutPage.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(url.pathname==='/api/consumer/auth/logout'&&request.method()==='POST'){logoutCalls++;return route.fulfill({status:logoutCalls===1?503:200,contentType:'application/json',body:JSON.stringify({ok:logoutCalls!==1})});}if(!['GET','HEAD'].includes(request.method()))report.blockedWrites.push({path:url.pathname,method:request.method()});return ['localhost','127.0.0.1'].includes(url.hostname)&&['GET','HEAD'].includes(request.method())?route.continue():route.abort();});
 await logoutPage.goto(base+'/me/products',{waitUntil:'networkidle'});await logoutPage.getByRole('button',{name:'Salir',exact:true}).click();
 await logoutPage.getByText('No pudimos confirmar la salida. Volvé a intentar cuando tengas conexión.',{exact:true}).waitFor();
 check(new URL(logoutPage.url()).pathname==='/me/products','failed synthetic logout keeps the current account page');
 check(await logoutPage.getByTestId('consumer-product-library').count()===1,'failed logout keeps loaded account products visible');
 await logoutPage.getByRole('button',{name:'Salir',exact:true}).click();await logoutPage.waitForURL(url=>url.pathname==='/login');
 check(logoutCalls===2,'logout retries once and navigates only after explicit synthetic success');
 report.syntheticLogoutRequests=logoutCalls;await logout.close();
 check(report.errors.length===0,'zero application runtime errors');check(report.geolocationCalls===0,'zero GPS calls');check(report.blockedWrites.length===0,'zero business or telemetry write attempts');report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack);const page=browser.contexts().at(-1)?.pages().at(-1);if(page){report.visible=(await page.locator('body').innerText()).slice(0,10000);await page.screenshot({path:join(output,'failure.png'),fullPage:true}).catch(()=>{});}throw error;}
finally{report.marketplaceBindingAfter=await marketplaceBinding(repo,web);report.marketplaceSourceBuildStable=JSON.stringify(report.marketplaceBindingBefore)===JSON.stringify(report.marketplaceBindingAfter);if(!report.marketplaceSourceBuildStable)report.status='failed';await writeFile(join(output,'report.json'),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({status:report.status,realProductionBuild:report.realProductionBuild,checks:report.checks.length,views:report.views.length,errors:report.errors,blockedWrites:report.blockedWrites,geolocationCalls:report.geolocationCalls,marketplaceSourceBuildStable:report.marketplaceSourceBuildStable,output},null,2));await browser.close();if(next&&next.exitCode===null&&next.signalCode===null){next.kill();await Promise.race([new Promise(resolve=>next.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,1500))]);}assert.ok(report.marketplaceSourceBuildStable,'catalogue source and actual build must stay unchanged during browser run');}
