// Actual Next pages/router and production components, explicit synthetic local
// account/notice projections via consumer-portal-local-fetch.mjs. Read-only.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {marketplaceBinding,runMarketplaceScenarios} from './consumer-marketplace.browser.mjs';
import {runClaimPinScenarios,runBenefitConfirmationScenarios} from './consumer-claim-pin.browser.mjs';

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
async function reservationFeedback(page,context,width,theme){
 const rewardId='1a000000-0000-4000-8000-000000000001',claimId='1a000000-0000-4000-8000-000000000002';
 const postPath='/api/consumer/rewards/'+rewardId+'/claim',readPath='/api/consumer/rewards';
 const postUrl=base+postPath,readUrl=base+readPath;
 let posts=0,reads=0,releasePost,releaseRead;
 const holdPost=new Promise(resolve=>{releasePost=resolve;}),holdRead=new Promise(resolve=>{releaseRead=resolve;});
 const post=async route=>{
  const request=route.request();assert.equal(request.url(),postUrl);assert.equal(request.method(),'POST');assert.equal(++posts,1);
  assert.deepEqual(request.postDataJSON(),{claimIntent:'portal-first-reservation.v1',expectedPointsCost:40,locale:'es-AR'});
  await holdPost;
  await route.fulfill({status:503,json:{ok:false}});
 };
 const read=async route=>{
  const request=route.request();assert.equal(request.url(),readUrl);assert.equal(request.method(),'GET');assert.equal(++reads,1);
  await holdRead;
  await route.fulfill({status:200,json:{ok:true,scope:'own_brands',limit:100,items:[{
   id:rewardId,title:'Visita de ensayo',tenant_slug:'consumer-qa',tenant_name:'Bodega de ensayo',program_name:'Club de ensayo',
   program_points_balance:60,points_cost:40,points_spent:40,state:'claimed',catalog_state:'reported',
   claim_id:claimId,claim_status:'claimed',claim_expires_at:'2099-01-01T00:00:00.000Z',redemption_code:null,can_claim:false,
  }]}});
 };
 await context.addCookies([{name:'consumer_reservation_qa',value:'focus',url:base,httpOnly:true,sameSite:'Lax'}]);
 await page.route(postUrl,post);await page.route(readUrl,read);
 try{
  await page.goto(base+'/me/rewards',{waitUntil:'networkidle'});
  const reserve=page.getByRole('button',{name:'Reservar beneficio',exact:true});await reserve.focus();await page.keyboard.press('Enter');
  const confirm=page.getByRole('button',{name:'Confirmar reserva por 40 puntos',exact:true});
  await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Confirmar reserva por 40 puntos');
  check(await confirm.isVisible()&&posts===0,`${width}/${theme} reward confirmation is keyboard reachable and has no automatic write`);
  await page.keyboard.press('Enter');
  const notice=page.getByRole('group',{name:'Estado de la reserva',exact:true});
  const status=notice.getByRole('status');
  await status.getByText('Estamos preparando tu reserva. Esperá la confirmación.',{exact:true}).waitFor();
  check(await notice.evaluate(node=>node===document.activeElement),`${width}/${theme} pending reservation retains a visible keyboard destination`);
  check(await status.evaluate(node=>!node.closest('[aria-busy="true"]')&&node.getAnimations({subtree:true}).length===0),`${width}/${theme} pending status is live with reduced motion`);
  releasePost();
  const recover=notice.getByRole('button',{name:'Comprobar mi reserva',exact:true});await recover.waitFor();
  await page.keyboard.press('Tab');
  check(await recover.evaluate(node=>node===document.activeElement),`${width}/${theme} the recovery action is next after the status`);
  await page.keyboard.press('Enter');
  await status.getByText('Estamos consultando tu reserva. Esta consulta no descuenta puntos.',{exact:true}).waitFor();
  check(await notice.evaluate(node=>node===document.activeElement),`${width}/${theme} lookup retains focus while its button is removed`);
  const search=page.getByRole('searchbox',{name:'Buscar beneficio',exact:true});await search.focus();
  releaseRead();await notice.getByRole('link',{name:'Ver mi voucher',exact:true}).waitFor();
  check(await search.evaluate(node=>node===document.activeElement),`${width}/${theme} confirmation never steals a newer focus`);
  check(posts===1&&reads===1,`${width}/${theme} one synthetic POST and one explicit synthetic GET`);
  await noOverflow(page,`${width}/${theme} reservation status fits the viewport`);
 }finally{
  releasePost();releaseRead();
  await page.unroute(postUrl,post);await page.unroute(readUrl,read);
  await context.clearCookies({name:'consumer_reservation_qa'});
 }
}
async function assessment(page,selector,name,width,theme){
 await page.addScriptTag({content:axe});
 const violations=await page.evaluate(async selector=>(await axe.run(selector,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target),failures:v.nodes.map(n=>n.failureSummary)})),selector);
 // Retain the failing rule and target even when the assertion stops the run.
 report.views.push({width,theme,name,selector,violations});
 check(violations.length===0,`${width}/${theme} ${name}: zero axe violations`);
 await page.screenshot({path:join(output,`${name}-${width}-${theme}.png`),fullPage:name==='products'||name==='experience'||name==='marketplace'});
}
async function noOverflow(page,label){check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label);}

async function waitForPortalNavigationLayout(page,width,height,theme,phase){
 let poll,settled;
 try{
  poll=await page.evaluateHandle(({width,height})=>{
   const sample=()=>{
    const nav=document.querySelector('nav.consumer-bottom-nav'),root=nav?.closest('.consumer-portal-root'),main=document.querySelector('#consumer-portal-content'),header=nav?.closest('header');
    if(!nav||!root||!main||!header)return null;
    const dock=nav.getBoundingClientRect(),head=header.getBoundingClientRect(),style=getComputedStyle(nav);
    return{innerWidth,innerHeight,clientWidth:document.documentElement.clientWidth,documentScrollWidth:document.documentElement.scrollWidth,
     dock:{left:dock.left,right:dock.right,top:dock.top,bottom:dock.bottom,width:dock.width,height:dock.height},
     position:style.position,maxBlockSize:style.maxBlockSize,scrollHeight:nav.scrollHeight,clientHeight:nav.clientHeight,
     reservedHeight:parseFloat(root.style.getPropertyValue('--portal-navigation-block-size')),mainBottomPadding:parseFloat(getComputedStyle(main).paddingBottom),
     header:{top:head.top,bottom:head.bottom,height:head.height,position:getComputedStyle(header).position}};
   };
   let previous=null,stableIntervals=0;
   return()=>{
    const geometry=sample();
    const currentViewport=geometry&&geometry.innerWidth===width&&geometry.innerHeight===height;
    const currentReservation=geometry&&Number.isFinite(geometry.reservedHeight)&&Math.abs(geometry.reservedHeight-Math.ceil(geometry.dock.height))<=1;
    const maxBlockSize=parseFloat(geometry?.maxBlockSize);
    const responsiveCap=geometry&&(geometry.position!=='fixed'||Number.isFinite(maxBlockSize)&&Math.abs(maxBlockSize-height*.4)<=1);
    if(!currentViewport||!currentReservation||!responsiveCap){previous=null;stableIntervals=0;return false;}
    const current=JSON.stringify(geometry);
    stableIntervals=current===previous?stableIntervals+1:0;previous=current;
    // A synchronous predicate is required: Playwright1.55.1 tests truthiness
    // before assimilating a returned Promise. Three equal samples span two RAF polls.
    return stableIntervals>=2?geometry:false;
   };
  },{width,height});
  settled=await page.waitForFunction(poll=>poll(),poll,{polling:'raf',timeout:10000});
  const geometry=await settled.jsonValue();
  assert.ok(geometry&&typeof geometry==='object'&&!Array.isArray(geometry)&&geometry.innerWidth===width&&geometry.innerHeight===height,'Portal layout wait must return a current geometry object');
  report.portalNavigationSettlement??=[];report.portalNavigationSettlement.push({requested:{width,height},theme,phase,settled:true,geometry});
 }catch(error){
  const diagnostic=await page.evaluate(()=>{const nav=document.querySelector('nav.consumer-bottom-nav'),root=nav?.closest('.consumer-portal-root'),main=document.querySelector('#consumer-portal-content'),r=nav?.getBoundingClientRect();return{innerWidth,innerHeight,maxBlockSize:nav?getComputedStyle(nav).maxBlockSize:null,dock:r?{width:r.width,height:r.height,top:r.top,bottom:r.bottom}:null,reservedHeight:root?.style.getPropertyValue('--portal-navigation-block-size')||null,mainBottomPadding:main?getComputedStyle(main).paddingBottom:null};}).catch(()=>null);
  report.portalNavigationSettlement??=[];report.portalNavigationSettlement.push({requested:{width,height},theme,phase,settled:false,diagnostic});
  throw error;
 }finally{
  if(settled)await settled.dispose().catch(()=>{});
  if(poll)await poll.dispose().catch(()=>{});
 }
}

async function portalNavigationGeometry(page,width,height,theme,phase,{largeText=false}={}){
 const nav=page.getByRole('navigation',{name:'Navegación del portal',exact:true});
 await page.evaluate(()=>document.fonts.ready.then(()=>undefined));
 await waitForPortalNavigationLayout(page,width,height,theme,phase);
 const measured=await nav.evaluate(nav=>{
  const rect=node=>{const r=node.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
  const contains=(r,b)=>r.left>=b.left-1&&r.right<=b.right+1&&r.top>=b.top-1&&r.bottom<=b.bottom+1;
  const style=getComputedStyle(nav),dock=rect(nav),root=nav.closest('.consumer-portal-root'),main=document.querySelector('#consumer-portal-content');
  const controls=[...nav.querySelector(':scope > div').children].filter(node=>node.matches('a,button'));
  const header=nav.closest('header'),brand=header?.querySelector('[data-brand-home-link]'),graphics=brand?[...brand.querySelectorAll('svg')]:[];
  const headerInventory={position:getComputedStyle(header).position,bounds:rect(header),desktopLayoutExpected:matchMedia('(min-width: 64rem)').matches,brand:brand?{bounds:rect(brand),accessibleLabel:brand.getAttribute('aria-label'),svg:graphics.map(node=>({classes:node.getAttribute('class'),bounds:rect(node)})),staticIdentity:Boolean(brand.querySelector('[data-identity-variant="static"]')),legacyWordmark:brand.querySelectorAll('.brand-wordmark-svg').length}:null};
  return{viewport:{innerWidth,innerHeight,clientWidth:document.documentElement.clientWidth,documentScrollWidth:document.documentElement.scrollWidth},header:headerInventory,dock,position:style.position,overflowY:style.overflowY,scrollWidth:nav.scrollWidth,clientWidth:nav.clientWidth,scrollHeight:nav.scrollHeight,clientHeight:nav.clientHeight,background:style.backgroundColor,mainBottomPadding:parseFloat(getComputedStyle(main).paddingBottom),reservedHeight:parseFloat(root.style.getPropertyValue('--portal-navigation-block-size')),labels:controls.map(node=>{const span=node.querySelector(':scope > span:not([class*="srOnly"])'),range=document.createRange();range.selectNodeContents(span);const boxes=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0).map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom}));range.detach();const item=rect(node),textStyle=getComputedStyle(span);return{text:span.textContent.trim(),href:node.getAttribute('href'),type:node.tagName,item,textBoxes:boxes,textInsideItem:boxes.length>0&&boxes.every(r=>contains(r,item)),fontSize:parseFloat(textStyle.fontSize),visible:textStyle.display!=='none'&&textStyle.visibility!=='hidden'&&Number(textStyle.opacity)>0};})};
 });
 const record={requested:{width,height},theme,phase,largeText,...measured,focusTargets:[]};report.portalNavigationGeometry??=[];report.portalNavigationGeometry.push(record);
 check(measured.viewport.innerWidth===width&&measured.viewport.innerHeight===height,`${phase}/${theme}: actual CSS viewport recorded`);
 check(measured.viewport.documentScrollWidth<=measured.viewport.innerWidth+1,`${phase}/${theme}: entire document including header fits the current text/viewport stress`);
 check(measured.header.brand&&measured.header.brand.accessibleLabel&&measured.header.brand.bounds.left>=-1&&measured.header.brand.bounds.right<=measured.viewport.clientWidth+1,`${phase}/${theme}: actual mounted brand remains within the viewport`);
 check(measured.header.position===(measured.header.desktopLayoutExpected?'sticky':'static'),`${phase}/${theme}: mobile header flows and desktop header stays sticky at the navigation breakpoint`);
 check(measured.position===(measured.header.desktopLayoutExpected?'static':'fixed'),`${phase}/${theme}: navigation placement matches the same mobile/desktop structure`);
 check(JSON.stringify(measured.labels.map(item=>item.text))===JSON.stringify(['Inicio','Productos','Historial','Beneficios','Más'])&&JSON.stringify(measured.labels.map(item=>item.href))===JSON.stringify(['/me','/me/products','/me/taps','/me/rewards',null]),`${phase}/${theme}: all five original actions and complete labels remain`);
 check(measured.labels.every(item=>item.visible&&item.textInsideItem&&item.item.width>=44&&item.item.height>=44),`${phase}/${theme}: every readable label fits its own 44px target without truncation`);
 if(largeText)check(measured.labels.every(item=>item.fontSize>=31.9),`${phase}/${theme}: stress text remains32px without shrinking`);
 check(measured.dock.left>=-1&&measured.dock.right<=Math.min(width,measured.viewport.clientWidth)+1&&measured.scrollWidth<=measured.clientWidth+1,`${phase}/${theme}: dock and its content do not overflow horizontally`);
 check(/^rgb\(/.test(measured.background)||/^rgba\([^,]+,[^,]+,[^,]+,\s*1\)/.test(measured.background),`${phase}/${theme}: dock has a solid theme background`);
 const mobile=measured.position==='fixed';
 if(mobile){check(measured.dock.height<=height*.4+1&&measured.dock.bottom<=height+1,`${phase}/${theme}: dock stays within40percent of viewport, leaving content space`);check(Math.abs(measured.reservedHeight-Math.ceil(measured.dock.height))<=1&&measured.mainBottomPadding>=measured.dock.height,`${phase}/${theme}: main reserves the actual dock height`);if(measured.scrollHeight>measured.clientHeight+1)check(['auto','scroll'].includes(measured.overflowY),`${phase}/${theme}: excess rows use an accessible vertical scrollport`);}
 const controls=nav.locator(':scope > div > a, :scope > div > button');
 await controls.first().focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');
 for(let index=0;index<5;index++){
  const control=controls.nth(index);await control.evaluate(node=>node.scrollIntoView({block:'nearest',inline:'nearest'}));
  const focused=await control.evaluate(node=>{const nav=node.closest('nav'),style=getComputedStyle(nav),r=node.getBoundingClientRect(),d=nav.getBoundingClientRect(),usable={left:d.left+nav.clientLeft,right:d.left+nav.clientLeft+nav.clientWidth,top:d.top+nav.clientTop+parseFloat(style.paddingTop),bottom:d.top+nav.clientTop+nav.clientHeight-parseFloat(style.paddingBottom)};return{focused:document.activeElement===node,top:r.top,bottom:r.bottom,left:r.left,right:r.right,usable,navScrollTop:nav.scrollTop,outlineStyle:getComputedStyle(node).outlineStyle,outlineWidth:parseFloat(getComputedStyle(node).outlineWidth)};});record.focusTargets.push(focused);
  check(focused.focused&&focused.left>=focused.usable.left-1&&focused.right<=focused.usable.right+1&&focused.top>=focused.usable.top-1&&focused.bottom<=focused.usable.bottom+1,`${phase}/${theme}: action${index+1} can be focused and scrolled fully into its dock`);
  check(focused.outlineStyle!=='none'&&focused.outlineWidth>=2,`${phase}/${theme}: keyboard focus on action${index+1} has a visible outline`);
  if(index<4)await page.keyboard.press('Tab');
 }
 const target=page.locator('#consumer-portal-content').locator('button:not([disabled]):visible, a[href]:visible, input:not([disabled]):visible, select:not([disabled]):visible, textarea:not([disabled]):visible').first();
 await target.focus();await target.evaluate(node=>node.scrollIntoView({block:'nearest',inline:'nearest'}));
 const contentFocus=await target.evaluate(node=>{const r=node.getBoundingClientRect(),header=document.querySelector('.consumer-portal-root > header').getBoundingClientRect(),nav=document.querySelector('nav.consumer-bottom-nav'),dock=nav.getBoundingClientRect(),fixed=getComputedStyle(nav).position==='fixed',band={top:Math.max(0,header.bottom),bottom:fixed?Math.min(innerHeight,dock.top):innerHeight};return{focused:document.activeElement===node,target:{top:r.top,bottom:r.bottom,height:r.height},band,visibleHeight:Math.max(0,Math.min(r.bottom,band.bottom)-Math.max(r.top,band.top)),fullTargetCanFit:band.bottom-band.top>=r.height};});record.contentFocus=contentFocus;
 check(contentFocus.band.bottom-contentFocus.band.top>=44&&contentFocus.focused&&contentFocus.visibleHeight>=Math.min(44,contentFocus.target.height)-1,`${phase}/${theme}: focused product control has at least a44px usable visible band behind portal chrome`);
 if(contentFocus.fullTargetCanFit)check(contentFocus.target.top>=contentFocus.band.top-1&&contentFocus.target.bottom<=contentFocus.band.bottom+1,`${phase}/${theme}: content focus fits the available band when its height permits`);
 return record;
}
async function portalNavigationStress(page,theme){
 const saved=await page.evaluate(()=>{const root=document.querySelector('.consumer-portal-root'),read=(style,key)=>({value:style.getPropertyValue(key),priority:style.getPropertyPriority(key)});return{font:read(document.documentElement.style,'font-size'),safe:Object.fromEntries(['--portal-safe-area-left','--portal-safe-area-right','--portal-safe-area-bottom'].map(key=>[key,read(root.style,key)])),items:[...document.querySelectorAll('nav.consumer-bottom-nav > div > a,nav.consumer-bottom-nav > div > button')].map(node=>read(node.style,'font-size'))};});
 const cases=[{width:277,height:900,large:false,insets:false},{width:277,height:900,large:true,insets:false},{width:277,height:641,large:true,insets:false},{width:277,height:640,large:true,insets:false},{width:277,height:568,large:true,insets:false},{width:277,height:360,large:true,insets:false},{width:277,height:360,large:true,insets:true},{width:1023,height:641,large:true,insets:false},{width:1024,height:641,large:true,insets:false}];
 let activeSample=null;
 try{for(const sample of cases){activeSample=sample;await page.setViewportSize({width:sample.width,height:sample.height});await page.evaluate(({sample,saved})=>{const root=document.querySelector('.consumer-portal-root'),restore=(style,key,entry)=>entry.value?style.setProperty(key,entry.value,entry.priority):style.removeProperty(key);if(sample.large)document.documentElement.style.setProperty('font-size','32px');else restore(document.documentElement.style,'font-size',saved.font);for(const[key,entry]of Object.entries(saved.safe)){if(sample.insets)root.style.setProperty(key,'20px');else restore(root.style,key,entry);}[...root.querySelectorAll('nav.consumer-bottom-nav > div > a,nav.consumer-bottom-nav > div > button')].forEach((node,index)=>{if(sample.large)node.style.setProperty('font-size','32px');else restore(node.style,'font-size',saved.items[index]);});},{sample,saved});await portalNavigationGeometry(page,sample.width,sample.height,theme,`reflow-${sample.width}x${sample.height}-${sample.large?'text32':'default'}-${sample.insets?'safe20':'safe0'}`,{largeText:sample.large});}}
 catch(error){
  // Preserve the actual failing viewport before finally restores fonts/insets/size.
  const phase=activeSample?`reflow-${activeSample.width}x${activeSample.height}-${activeSample.large?'text32':'default'}-${activeSample.insets?'safe20':'safe0'}`:'reflow-uninitialized';
  const diagnostic=await page.evaluate(()=>{
   const rect=node=>{if(!node)return null;const r=node.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
   const header=document.querySelector('.consumer-portal-root > header'),nav=document.querySelector('nav.consumer-bottom-nav'),main=document.querySelector('#consumer-portal-content'),root=nav?.closest('.consumer-portal-root'),target=document.activeElement,scroll=document.scrollingElement;
   const geometry=node=>node?{tag:node.tagName,rect:rect(node),position:getComputedStyle(node).position,overflowY:getComputedStyle(node).overflowY,clientHeight:node.clientHeight,scrollHeight:node.scrollHeight,scrollTop:node.scrollTop,scrollMarginBlockStart:getComputedStyle(node).scrollMarginBlockStart,scrollMarginBlockEnd:getComputedStyle(node).scrollMarginBlockEnd,scrollPaddingBlockStart:getComputedStyle(node).scrollPaddingBlockStart,scrollPaddingBlockEnd:getComputedStyle(node).scrollPaddingBlockEnd}:null;
   const ancestors=[];for(let node=target?.parentElement;node;node=node.parentElement)ancestors.push(geometry(node));
   return{viewport:{innerWidth,innerHeight,clientWidth:document.documentElement.clientWidth,documentScrollWidth:document.documentElement.scrollWidth,scrollX,scrollY,visualViewport:window.visualViewport?{width:visualViewport.width,height:visualViewport.height,offsetTop:visualViewport.offsetTop,scale:visualViewport.scale}:null},rootFontSize:getComputedStyle(document.documentElement).fontSize,header:geometry(header),dock:geometry(nav),main:geometry(main),mainBottomPadding:main?getComputedStyle(main).paddingBottom:null,headerReservation:root?.style.getPropertyValue('--portal-header-block-size')||null,dockReservation:root?.style.getPropertyValue('--portal-navigation-block-size')||null,target:geometry(target),focusWithinContent:Boolean(main&&target&&main.contains(target)),scrollingElement:geometry(scroll),ancestors};
  }).catch(captureError=>({captureError:String(captureError)}));
  const entry={requested:activeSample?{...activeSample}:null,theme,phase,beforeStressRestore:true,error:String(error.stack||error),diagnostic,screenshot:`${phase}-${theme}-before-restore.png`,snapshot:`${phase}-${theme}-before-restore.json`};
  report.portalNavigationFailuresBeforeRestore??=[];report.portalNavigationFailuresBeforeRestore.push(entry);
  await page.screenshot({path:join(output,entry.screenshot),fullPage:false}).catch(captureError=>{entry.screenshotError=String(captureError);});
  await writeFile(join(output,entry.snapshot),JSON.stringify(entry,null,2),{flag:'wx'}).catch(captureError=>{entry.snapshotError=String(captureError);});
  throw error;
 }
 finally{await page.evaluate(saved=>{const root=document.querySelector('.consumer-portal-root'),restore=(style,key,entry)=>entry.value?style.setProperty(key,entry.value,entry.priority):style.removeProperty(key);restore(document.documentElement.style,'font-size',saved.font);for(const[key,entry]of Object.entries(saved.safe))restore(root.style,key,entry);[...root.querySelectorAll('nav.consumer-bottom-nav > div > a,nav.consumer-bottom-nav > div > button')].forEach((node,index)=>restore(node.style,'font-size',saved.items[index]));},saved);await page.setViewportSize({width:320,height:900});await page.evaluate(()=>window.scrollTo(0,0));}
}

async function accountContactScenarios(page,width,theme){
 for(const [path,selector] of [['/me','[aria-labelledby="home-account-title"]'],['/me/passport','#consumer-portal-content'],['/me/privacy','[aria-labelledby="privacy-account-title"]']]){
  await page.goto(base+path,{waitUntil:'networkidle'});const surface=page.locator(selector);await surface.waitFor();
  const text=await surface.innerText();
  check(text.toLocaleLowerCase('es-AR').includes('teléfono de tu cuenta')&&text.toLocaleLowerCase('es-AR').includes('terminado en 5678')&&!text.toLocaleLowerCase('es-AR').includes('correo no informado'),`${width}/${theme} ${path}: phone-only account has a meaningful masked contact`);
  check(!(await page.content()).includes('5491112345678'),`${width}/${theme} ${path}: full synthetic phone is absent from rendered HTML and RSC`);
  await noOverflow(page,`${width}/${theme} ${path}: account contact fits viewport`);
  await assessment(page,selector,'account-contact-'+path.split('/').at(-1),width,theme);
 }
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
  await accountContactScenarios(page,width,theme);
  await productPhotoRecovery(page,context,width,theme);
  await page.goto(base+'/me/products',{waitUntil:'networkidle',timeout:90000});
  const library=page.getByTestId('consumer-product-library');await library.waitFor();
  await portalNavigationGeometry(page,width,900,theme,'matrix');
  if(width===320)await portalNavigationStress(page,theme);
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
  check(await ficha.getByRole('link',{name:'Compartir experiencia',exact:true}).count()===1&&await ficha.getByRole('link',{name:'Catálogo de la marca',exact:true}).count()===1,`${width}/${theme} secondary destinations retained in ficha`);
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
  await runBenefitConfirmationScenarios({page,base,width,theme,report,check,assessment,noOverflow});
  if(width===390)await reservationFeedback(page,context,width,theme);
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
