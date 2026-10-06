// Real navigation/brand/theme components and CSS; synthetic Home/About/Me content.
// Native browser anchors exercise cross-document navigation. No Next routing/API,
// full marketing-page acceptance, customer writes, NFC or GPS evidence is claimed.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';

const root=resolve(fileURLToPath(new URL('../../../',import.meta.url))),web=join(root,'apps/web');
const sourcePaths=['apps/web/src/components/marketing-mega-nav.tsx','apps/web/src/components/marketing-mega-nav.module.css','apps/web/src/components/public-site-header.module.css','apps/web/src/components/brand-home-link.tsx','apps/web/src/components/brand-home-link.module.css','apps/web/src/components/brand-home-link-static.tsx','apps/web/src/components/passport-fragment-restoration.ts','apps/web/src/app/globals.css','apps/web/tests/marketing-mega-navigation.browser.mjs','apps/web/tests/marketing-mega-navigation.test.mjs','packages/ui/src/brand/brand-lockup.tsx','packages/ui/src/brand/brand-mark.tsx','packages/ui/src/brand/brand-wordmark.tsx','packages/ui/src/theme-toggle.tsx','packages/ui/src/locale-switcher.tsx'];
const sourceHashes=async()=>Object.fromEntries(await Promise.all(sourcePaths.map(async path=>[path,createHash('sha256').update(await readFile(join(root,path))).digest('hex')])));
const sourceHashesStart=await sourceHashes();
const output=resolve(process.env.QA_OUTPUT||join(root,'artifacts/browser/marketing-navigation-details'));
await mkdir(output,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright-core');
const fixture=`import React from 'react';import{createRoot}from'react-dom/client';import{MarketingMegaNav}from'./src/components/marketing-mega-nav';import{BrandHomeLink}from'./src/components/brand-home-link';import headerStyles from'./src/components/public-site-header.module.css';
const locale=document.documentElement.lang,theme=document.documentElement.dataset.theme;
createRoot(document.getElementById('navigation')).render(<header className={'site-header landing-mega-header public-site-header sticky top-0 z-50 border-b '+headerStyles.header}><div className="container-shell header-main-row flex items-center justify-between gap-4"><BrandHomeLink locale={locale} size={64} variant="pulse" theme={theme} brandClassName="site-brand-identity" className="landing-brand-link"/><MarketingMegaNav locale={locale} locales={['es-AR','en','pt-BR']} initialTheme={theme} loginHref="https://business.example.invalid/login" meetingHref="https://example.invalid/meeting"/></div></header>);`;
const nextShim=`import React from'react';export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push(url){location.assign(url)},refresh(){location.reload()}});export default React.forwardRef(function Link({href,prefetch,...props},ref){return <a {...props} href={href} ref={ref}/>});`;
const uiShim=['theme-toggle','locale-switcher','brand/brand-lockup','brand/brand-mark'].map(name=>`export * from ${JSON.stringify(join(root,'packages/ui/src',name+'.tsx').replaceAll('\\','/'))};`).join('\n');
const bundle=await build({stdin:{contents:fixture,resolveDir:web,loader:'tsx'},bundle:true,write:false,outdir:join(output,'bundle'),platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},loader:{'.module.css':'local-css'},plugins:[{name:'native-fixture-routing',setup(builder){
 builder.onResolve({filter:/^next\/(link|navigation)$/},()=>({path:'next-native',namespace:'fixture'}));
 builder.onResolve({filter:/^@product\/ui$/},()=>({path:'real-ui',namespace:'fixture'}));
 builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='real-ui'?uiShim:nextShim,loader:'tsx',resolveDir:web}));
}}],logLevel:'silent'});
const js=bundle.outputFiles.find(file=>file.path.endsWith('.js')).contents,css=bundle.outputFiles.find(file=>file.path.endsWith('.css')).contents;
await writeFile(join(output,'fixture.css'),css);
const globals=(await postcss([tailwindcss({base:web})]).process(await readFile(join(web,'src/app/globals.css'),'utf8'),{from:join(web,'src/app/globals.css')})).css;
// Hold real HTTP bytes until the test observes the mounted React navigation.
// Releasing a response changes no DOM, focus, React state or browser lifecycle.
const pendingNativeLoads=new Map();
function releaseNativeLoad(kind){const release=pendingNativeLoads.get(kind);pendingNativeLoads.delete(kind);release?.();}
const server=createServer((req,res)=>{
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 const path=new URL(req.url,'http://fixture.invalid').pathname;
 if(path==='/fixture.js'){res.setHeader('content-type','text/javascript');return res.end(js);}
 if(path==='/fixture.css'){res.setHeader('content-type','text/css');return res.end(css);}
 if(path==='/base.css'){res.setHeader('content-type','text/css');return res.end(globals);}
 if(path==='/native-load-delay.svg'){
  const kind=new URL(req.url,'http://fixture.invalid').searchParams.get('case');
  res.setHeader('content-type','image/svg+xml');
  pendingNativeLoads.set(kind,()=>res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="#147d83"/></svg>'));
  return;
 }
 if(path==='/favicon.ico'){res.writeHead(204);return res.end();}
 if(!['/','/about','/me'].includes(path)){res.writeHead(404);return res.end();}
 const theme=/(?:^|;\s*)theme=dark(?:;|$)/.test(req.headers.cookie||'')?'dark':'light';
 const requestedLocale=/\bnav_locale=(es-AR|en|pt-BR)(?:;|$)/.exec(req.headers.cookie||'')?.[1];
 const locale=requestedLocale||'es-AR';
 const nativeKind=path==='/'?/\bnav_load_case=([^;]+)/.exec(req.headers.cookie||'')?.[1]:null;
 if(['late-heading','late-asset','early-input'].includes(nativeKind)){
  const head=`<!doctype html><html lang="${locale}" data-theme="${theme}" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Native fragment loading fixture</title><link rel="stylesheet" href="/base.css"><link rel="stylesheet" href="/fixture.css"><style>html{scroll-behavior:auto!important}body{margin:0}#navigation{display:contents}main{padding:24px}#prelude{height:1200px}#pasaporte-digital{padding:24px}#tail{height:800px}h1,h2{margin:0 0 20px;font-size:28px}.fixture-action{min-height:44px}html[data-theme="dark"] main{background:#10282f;color:#edf5f4}</style></head><body><div id="navigation"></div><script async src="/fixture.js"></script><main id="main-content" data-nav-inert><h1>Home — synthetic delayed content</h1><button class="fixture-action" id="native-early-control">Conservar mi foco</button><div id="prelude"></div>`;
  const destination='<section id="pasaporte-digital" class="scroll-mt-24"><h2>Pasaporte digital de prueba</h2><button class="fixture-action" id="destination-action">Siguiente acción local</button></section><div id="tail"></div></main><aside id="foreign-inert" data-nav-inert inert aria-hidden="false">Pre-existing inert fixture</aside>';
  res.setHeader('content-type','text/html;charset=utf-8');
  if(nativeKind==='late-heading'){
   res.write(head);
   pendingNativeLoads.set(nativeKind,()=>res.end(destination+'</body></html>'));
  }else{
   res.end(head+destination+`<img alt="" width="1" height="1" src="/native-load-delay.svg?case=${nativeKind}"></body></html>`);
  }
  return;
 }
 // The React mount adapter is layout-transparent, matching the production
 // header's body-level containing block without overriding its sticky CSS.
 res.setHeader('content-type','text/html;charset=utf-8');res.end(`<!doctype html><html lang="${locale}" data-theme="${theme}" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Navigation component fixture</title><link rel="stylesheet" href="/base.css"><link rel="stylesheet" href="/fixture.css"><style>html{scroll-behavior:auto!important}body{margin:0}#navigation{display:contents}main{padding:24px}#prelude{height:1200px}#pasaporte-digital{padding:24px}#tail{height:800px}h1,h2{margin:0 0 20px;font-size:28px}.fixture-action{min-height:44px}html[data-theme="dark"] main{background:#10282f;color:#edf5f4}</style></head><body><div id="navigation"></div><main id="main-content" data-nav-inert><h1>${path==='/'?'Home':path==='/me'?'Me — synthetic routing destination':'About'} — synthetic content</h1><div id="prelude"></div>${path==='/'?'<section id="pasaporte-digital" class="scroll-mt-24"><h2>Pasaporte digital de prueba</h2><button class="fixture-action" id="destination-action">Siguiente acción local</button></section>':''}<div id="tail"></div></main><aside id="foreign-inert" data-nav-inert inert aria-hidden="false">Pre-existing inert fixture</aside><script src="/fixture.js"></script></body></html>`);
});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(Number(process.env.QA_PORT||3302),'127.0.0.1',ok)});
const origin=`http://127.0.0.1:${server.address().port}`;
const report={realComponents:true,realCss:true,realHeaderBrand:true,syntheticHomeAboutContent:true,syntheticConsumerDestination:true,nativeBrowserRoutingAdapter:true,actualNextPageAcceptance:false,customerAuthenticationAcceptance:false,physicalTapMeasured:false,gpsMeasured:false,businessWritesAllowed:false,sourceHashesStart,origin,checks:[],views:[],consumerEntryCases:[],earlyFocusedMenuCases:[],nativeLoadCases:[],errors:[],blockedRequests:[],browserClosed:false,serverClosed:false};
const check=(passed,name,details)=>report.checks.push({name,passed:Boolean(passed),...(details===undefined?{}:{details})});
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const visibleSelector='a[href],button:not([disabled]),select,summary,[tabindex]:not([tabindex="-1"])';
let browser;
try{browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined})}
catch(error){await new Promise(ok=>server.close(ok));report.serverClosed=true;report.errors.push({error:error.message.slice(0,180)});await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));throw error}

async function focusRing(locator){
 await locator.focus();
 const transitions=await locator.evaluate(async node=>{
  getComputedStyle(node).outlineColor;
  const active=node.getAnimations().filter(animation=>animation instanceof CSSTransition);
  const properties=active.map(animation=>animation.transitionProperty);
  await Promise.race([Promise.allSettled(active.map(animation=>animation.finished)),new Promise(resolve=>setTimeout(resolve,500))]);
  return properties;
 });
 const measured=await locator.evaluate(node=>{
  const rgb=value=>{const n=value.match(/[\d.]+/g)?.map(Number);return n?.length>=3?[...n.slice(0,3).map(v=>value.startsWith('color(srgb')?v*255:v),n[3]??1]:null};
  const style=getComputedStyle(node),ink=rgb(style.outlineColor);let background=[255,255,255,1];
  const parents=[];for(let el=node.parentElement;el;el=el.parentElement)parents.unshift(el);
  for(const el of parents){const color=rgb(getComputedStyle(el).backgroundColor);if(color)background=color.slice(0,3).map((v,i)=>v*color[3]+background[i]*(1-color[3])).concat(1)}
  const luminance=values=>values.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const a=ink?luminance(ink):0,b=luminance(background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  return{outline:style.outlineStyle,width:parseFloat(style.outlineWidth),color:style.outlineColor,alpha:ink?.[3],background:background.slice(0,3),ratio,focusVisible:node.matches(':focus-visible'),navAccent:style.getPropertyValue('--nav-accent')};
 });
 return{...measured,settledTransitions:transitions};
}
async function openMenu(page){const trigger=page.getByRole('button',{name:'Abrir navegación',exact:true});await trigger.focus();await page.keyboard.press('Enter');await page.getByRole('dialog').waitFor();await frames(page);return trigger;}
async function retained(page,name){
 check(await page.locator('#main-content').evaluate(node=>!node.inert&&node.getAttribute('aria-hidden')===null),'Main released '+name);
 check(await page.locator('#foreign-inert').evaluate(node=>node.inert&&node.getAttribute('aria-hidden')==='false'),'Existing inert and aria preserved '+name);
}
async function passportGeometry(page){
 return page.locator('#pasaporte-digital h2').evaluate(node=>{const h=node.getBoundingClientRect(),headerNode=document.querySelector('body > #navigation > header'),header=headerNode.getBoundingClientRect(),hit=document.elementFromPoint(h.left+h.width/2,h.top+Math.min(h.height/2,16));return{headingTop:h.top,headerTop:header.top,headerBottom:header.bottom,headerPosition:getComputedStyle(headerNode).position,headerIsStickyAtViewportTop:getComputedStyle(headerNode).position==='sticky'&&Math.abs(header.top)<=1&&header.bottom>=44,unobstructed:hit===node||node.contains(hit),scrollMargin:getComputedStyle(node.closest('section')).scrollMarginTop};});
}
async function earlyMenuInteraction(page,name){
 // Focus a real menu link as soon as React mounts it, before the scheduled
 // initial autofocus. MutationObserver observes the DOM; it changes no React
 // state, visibility, rAF scheduling or implementation behavior.
 await page.evaluate(()=>{
  window.__earlyMenuFocus={focusedOnMount:false};
  const observer=new MutationObserver(()=>{
   const link=document.querySelector('[role="dialog"] a[href="/#pasaporte-digital"]');
   if(!link)return;
   link.focus();window.__earlyMenuFocus.focusedOnMount=document.activeElement===link;
   observer.disconnect();
  });
  observer.observe(document.body,{childList:true,subtree:true});
 });
 const trigger=page.getByRole('button',{name:'Abrir navegación',exact:true});
 await trigger.focus();await page.keyboard.press('Enter');await page.getByRole('dialog').waitFor();await frames(page);
 const initial=await page.evaluate(()=>({focusedOnMount:window.__earlyMenuFocus.focusedOnMount,
  retainedThroughAutofocus:document.activeElement?.matches('[role="dialog"] a[href="/#pasaporte-digital"]')}));
 await page.keyboard.press('Enter');
 const destination=await page.waitForFunction(()=>location.hash==='#pasaporte-digital'&&document.activeElement?.matches('#pasaporte-digital h2'),null,{timeout:3000}).then(()=>true,()=>false);
 const details={name,...initial,nativeDestinationFocused:destination};report.earlyFocusedMenuCases.push(details);
 check(initial.focusedOnMount&&initial.retainedThroughAutofocus&&destination,'Early menu interaction keeps link focus and native destination '+name,details);
}
async function failureSnapshot(page){
 return page.evaluate(()=>({url:location.origin+location.pathname+location.hash,readyState:document.readyState,
  activeElement:document.activeElement?.outerHTML.slice(0,500),
  destination:document.querySelector('#pasaporte-digital h2')?.outerHTML.slice(0,500)||null,
  mainInert:document.querySelector('#main-content')?.inert,
  mainAria:document.querySelector('#main-content')?.getAttribute('aria-hidden'),
  nativeLoadProbe:window.__nativeLoadProbe||null})).catch(()=>({snapshotUnavailable:true}));
}
async function nativeLoadCase(width,theme,kind){
 const name=`native ${kind} ${width} ${theme}`,context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
 const details={width,theme,kind,realHttpLoadHeld:true,completed:false};report.nativeLoadCases.push(details);
 await context.addCookies([{name:'theme',value:theme,url:origin},{name:'nexid_theme_version',value:'white-first-v2',url:origin}]);
 await context.addInitScript(()=>{
  const probe=window.__nativeLoadProbe={events:[],navigationMounted:null};
  const event=type=>probe.events.push({type,readyState:document.readyState,at:performance.now(),active:document.activeElement?.id||document.activeElement?.tagName||null});
  document.addEventListener('readystatechange',()=>event('readystatechange'));
  document.addEventListener('focusin',()=>event('focusin'));
  window.addEventListener('load',()=>event('load'),{once:true});
  const observer=new MutationObserver(()=>{
   if(!document.querySelector('button[aria-label="Abrir navegación"]'))return;
   probe.navigationMounted={readyState:document.readyState,at:performance.now(),destinationPresent:Boolean(document.querySelector('#pasaporte-digital h2'))};
   observer.disconnect();
  });
  observer.observe(document,{childList:true,subtree:true});
 });
 const page=await context.newPage();page.on('pageerror',error=>report.errors.push({name,error:error.message.slice(0,180)}));
 await page.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(req.method()!=='GET'||url.origin!==origin||/^\/(?:api|sun)(?:\/|$)/.test(url.pathname)){report.blockedRequests.push({name,method:req.method(),path:url.pathname});return route.abort()}return route.continue()});
 try{
  await page.goto(origin+'/about',{waitUntil:'networkidle'});await openMenu(page);
  await context.addCookies([{name:'nav_load_case',value:kind,url:origin}]);
  const committed=page.waitForURL(origin+'/#pasaporte-digital',{waitUntil:'commit'});
  await page.getByRole('dialog').getByRole('link',{name:'Pasaporte digital',exact:true}).press('Enter',{noWaitAfter:true});
  await committed;
  await page.getByRole('button',{name:'Abrir navegación',exact:true}).waitFor({state:'attached'});await frames(page);
  details.beforeRelease=await page.evaluate(()=>({readyState:document.readyState,destinationPresent:Boolean(document.querySelector('#pasaporte-digital h2')),probe:window.__nativeLoadProbe}));
  check(pendingNativeLoads.has(kind)&&details.beforeRelease.readyState!=='complete'
   &&details.beforeRelease.probe.navigationMounted?.readyState!=='complete'
   &&details.beforeRelease.destinationPresent===(kind!=='late-heading'),
   'React mounts during real unfinished native load '+name,details.beforeRelease);
  if(kind==='early-input'){
   await page.locator('#native-early-control').click();
   details.userFocusBeforeRelease=await page.locator('#native-early-control').evaluate(node=>node===document.activeElement);
  }
  releaseNativeLoad(kind);
  await page.waitForLoadState('load');await frames(page);
  if(kind==='early-input'){
   check(details.userFocusBeforeRelease&&await page.locator('#native-early-control').evaluate(node=>node===document.activeElement)
    &&new URL(page.url()).hash==='#pasaporte-digital','New user interaction retains focus after native load '+name);
  }else{
   await page.waitForFunction(()=>document.activeElement?.matches('#pasaporte-digital h2'));
   const nativeDestination=await page.evaluate(()=>location.pathname==='/'&&location.hash==='#pasaporte-digital'&&scrollY>500
    &&document.querySelector('#pasaporte-digital h2').getAttribute('tabindex')==='-1'&&!document.querySelector('#main-content').inert);
   await page.keyboard.press('Tab');
   check(nativeDestination&&await page.locator('#destination-action').evaluate(node=>node===document.activeElement)
    &&await page.locator('#pasaporte-digital h2').getAttribute('tabindex')===null,
    'Completed native load focuses destination and continues local Tab '+name);
   const geometry=await passportGeometry(page);check(geometry.headerIsStickyAtViewportTop&&geometry.headingTop>=geometry.headerBottom&&geometry.unobstructed,'Native destination stays unobstructed below real header with production fragment margin '+name,geometry);
  }
  details.afterRelease=await failureSnapshot(page);
  await page.goBack({waitUntil:'networkidle'});await frames(page);
  check(new URL(page.url()).pathname==='/about'&&new URL(page.url()).hash===''
   &&await page.locator('#pasaporte-digital').count()===0,'Native Back retains About without late destination focus '+name);
  details.completed=true;
 }catch(error){details.failure=await failureSnapshot(page);report.errors.push({name,error:error.message.slice(0,180),snapshot:details.failure});}
 finally{releaseNativeLoad(kind);await context.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));}
}

async function consumerEntryCase(width,theme,locale){
 const copy={
  'es-AR':{account:'Mi cuenta',business:'Ingresar empresas',menu:'Abrir navegación',demo:'Agendar demo'},
  en:{account:'My account',business:'Business sign in',menu:'Open navigation',demo:'Book a demo'},
  'pt-BR':{account:'Minha conta',business:'Acesso para empresas',menu:'Abrir navegação',demo:'Agendar demo'},
 }[locale];
 const name=`consumer-entry-${width}-${theme}-${locale}`,context=await browser.newContext({viewport:{width,height:900},locale,reducedMotion:'reduce',serviceWorkers:'block'});
 const details={name,width,theme,locale,completed:false};report.consumerEntryCases.push(details);
 await context.addCookies([{name:'theme',value:theme,url:origin},{name:'nexid_theme_version',value:'white-first-v2',url:origin},{name:'nav_locale',value:locale,url:origin}]);
 const page=await context.newPage();page.on('pageerror',error=>report.errors.push({name,error:error.message.slice(0,180)}));
 await page.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(req.method()!=='GET'||url.origin!==origin||/^\/(?:api|sun)(?:\/|$)/.test(url.pathname)){report.blockedRequests.push({name,method:req.method(),path:url.pathname});return route.abort()}return route.continue()});
 const bounds=locator=>locator.evaluate(node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom,fontSize:parseFloat(getComputedStyle(node).fontSize),unobstructed:Boolean(hit&&(hit===node||node.contains(hit))),withinViewport:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight};});
 try{
  await page.goto(origin+'/',{waitUntil:'networkidle'});
  const account=page.locator('[data-consumer-entry="header"]');await account.waitFor();
  check(await account.innerText()===copy.account&&await account.getAttribute('href')==='/me','Closed header exposes localized direct consumer account '+name);
  details.headerAccount=await bounds(account);details.header=await page.locator('header').evaluate(node=>({height:node.getBoundingClientRect().height,scrollWidth:node.scrollWidth,viewport:innerWidth}));
  check(details.headerAccount.width>=44&&details.headerAccount.height>=44&&details.headerAccount.fontSize>=12&&details.headerAccount.withinViewport&&details.headerAccount.unobstructed,'Closed account is legible unobstructed44px target '+name,details.headerAccount);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.body.scrollWidth<=innerWidth),'Production header brand and account have zero horizontal overflow '+name,details.header);
  const ring=await focusRing(account);check(ring.outline==='solid'&&ring.width>=3&&ring.ratio>=3,'Consumer account retains visible keyboard focus '+name,ring);
  check(await page.locator('header > div > [data-brand-home-link] [data-identity-variant="pulse"]').count()===1,'Original header logo artwork remains mounted '+name);
  await page.screenshot({path:join(output,name+'-closed-viewport.png')});
  await account.press('Enter');await page.waitForURL(origin+'/me');
  check(new URL(page.url()).pathname==='/me'&&new URL(page.url()).search===''&&await page.getByRole('dialog').count()===0,'Keyboard account follows direct /me without business login or query rewrite '+name);
  await page.goto(origin+'/',{waitUntil:'networkidle'});await page.locator('[data-consumer-entry="header"]').click();await page.waitForURL(origin+'/me');
  check(new URL(page.url()).pathname==='/me','Pointer account reaches same /me destination '+name);
  await page.goto(origin+'/',{waitUntil:'networkidle'});
  if(width<1600){
   const trigger=page.getByRole('button',{name:copy.menu,exact:true});details.menuTrigger=await bounds(trigger);
   check(details.menuTrigger.width>=44&&details.menuTrigger.height>=44&&details.menuTrigger.withinViewport&&details.menuTrigger.unobstructed,'Closed menu trigger remains a separate unobstructed44px target '+name,details.menuTrigger);
   await trigger.press('Enter');const dialog=page.getByRole('dialog');await dialog.waitFor();await frames(page);
   const menuAccount=dialog.locator('[data-consumer-entry="menu"]');details.menuAccount=await bounds(menuAccount);
   check(await menuAccount.innerText()===copy.account&&await menuAccount.getAttribute('href')==='/me'&&details.menuAccount.height>=44&&details.menuAccount.withinViewport&&details.menuAccount.unobstructed,'Open menu exposes immediate direct consumer account '+name,details.menuAccount);
   const business=dialog.getByRole('link',{name:copy.business,exact:true});check(await business.getAttribute('href')==='https://business.example.invalid/login','Business login stays separate from consumer account '+name);
   check(await dialog.getByRole('link',{name:copy.demo,exact:true}).getAttribute('href')==='/?contact=demo#contact-modal','Commercial demo remains available in mobile menu '+name);
   details.scrolledTargets=[];
   for(const [label,target] of [['featured',dialog.locator('details[open] > div > a[href="/demo-lab"]')],['business',business],['demo',dialog.getByRole('link',{name:copy.demo,exact:true})]]){
    await target.scrollIntoViewIfNeeded();await frames(page);const geometry=await bounds(target);details.scrolledTargets.push({label,...geometry});
    check(geometry.width>=44&&geometry.height>=44&&geometry.withinViewport&&geometry.unobstructed,'Scrolled menu target stays reachable without footer overlap '+label+' '+name,geometry);
   }
   await menuAccount.scrollIntoViewIfNeeded();await frames(page);
   await page.screenshot({path:join(output,name+'-menu-viewport.png')});
   await menuAccount.press('Enter');await page.waitForURL(origin+'/me');
   check(await page.getByRole('dialog').count()===0&&await page.locator('#main-content').evaluate(node=>!node.inert),'Menu account closes dialog and releases inert content on navigation '+name);
  }else{
   check(await page.getByRole('link',{name:copy.business,exact:true}).isVisible()&&await page.getByRole('link',{name:copy.business,exact:true}).getAttribute('href')==='https://business.example.invalid/login','Desktop business login remains separately visible '+name);
   check(await page.getByRole('link',{name:copy.demo,exact:true}).isVisible(),'Desktop commercial demo stays visible '+name);
  }
  details.completed=true;
 }catch(error){report.errors.push({name,error:error.message.slice(0,180),snapshot:await failureSnapshot(page)});await page.screenshot({path:join(output,name+'-failure.png')}).catch(captureError=>report.errors.push({name,error:'failure-screenshot: '+captureError.message.slice(0,160)}));}
 finally{await context.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));}
}
try{
 for(const width of [320,390,768,1920])for(const theme of ['light','dark'])for(const locale of ['es-AR','en','pt-BR'])await consumerEntryCase(width,theme,locale);
 for(const width of [320,390,768,1440])for(const theme of ['light','dark']){
  const name=`${width} ${theme}`,context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addCookies([{name:'theme',value:theme,url:origin},{name:'nexid_theme_version',value:'white-first-v2',url:origin}]);
  const page=await context.newPage();page.on('pageerror',error=>report.errors.push({name,error:error.message.slice(0,180)}));
  await page.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(req.method()!=='GET'||url.origin!==origin||/^\/(?:api|sun)(?:\/|$)/.test(url.pathname)){report.blockedRequests.push({name,method:req.method(),path:url.pathname});return route.abort()}return route.continue()});
  try{
   await page.goto(origin+'/',{waitUntil:'networkidle'});await earlyMenuInteraction(page,name);
   await page.goto(origin+'/',{waitUntil:'networkidle'});let trigger=await openMenu(page);
   check(await page.getByRole('button',{name:'Cerrar navegación',exact:true}).evaluate(node=>node===document.activeElement),'Open focuses close '+name);
   check(await page.locator('#main-content').evaluate(node=>node.inert),'Open makes content inert '+name);
   const dialog=page.getByRole('dialog'),brand=dialog.locator('[data-brand-home-link]');
   for(const [label,locator]of [['brand',brand],['close',dialog.getByRole('button',{name:'Cerrar navegación',exact:true})],['account',dialog.locator('[data-consumer-entry="menu"]')],['passport',dialog.getByRole('link',{name:'Pasaporte digital',exact:true})],['about',dialog.getByRole('link',{name:'Quiénes somos',exact:true})],['item',dialog.locator('[data-menu-link]').first()],['summary',dialog.locator('summary').first()],['login',dialog.getByRole('link',{name:'Ingresar empresas',exact:true})],['demo',dialog.getByRole('link',{name:'Agendar demo',exact:true})]]){
    const ring=await focusRing(locator);check(ring.alpha===1&&ring.outline==='solid'&&ring.width>=3&&ring.ratio>=3,'Solid visible focus '+label+' '+name,ring);
   }
   const summary=dialog.locator('summary').first();await summary.focus();await page.keyboard.press('Enter');await frames(page);
   check(await dialog.locator('details[open]').count()===0,'All details closed '+name);
   const visibleCount=await dialog.evaluate((node,selector)=>[...node.querySelectorAll(selector)].filter(el=>{
    if(!el.getClientRects().length||el.closest('[inert]')||getComputedStyle(el).visibility==='hidden')return false;
    const closed=el.closest('details:not([open])');return !closed||closed.querySelector(':scope > summary')?.contains(el);
   }).length,visibleSelector);
   await brand.focus();const visited=[];
   for(let i=0;i<visibleCount;i++){visited.push(await page.evaluate(()=>document.activeElement?.outerHTML.slice(0,200)));await page.keyboard.press('Tab');check(await dialog.evaluate(node=>node.contains(document.activeElement)),'Tab remains inside closed-details dialog '+name+' '+i);}
   check(await brand.evaluate(node=>node===document.activeElement)&&new Set(visited).size===visibleCount,'Forward Tab visits visible controls once '+name,{visibleCount,visited});
   await page.keyboard.press('Shift+Tab');check(await dialog.getByRole('link',{name:'Agendar demo',exact:true}).evaluate(node=>node===document.activeElement),'Reverse Tab reaches visible final control '+name);
   await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});await frames(page);
   check(await trigger.evaluate(node=>node===document.activeElement),'Escape returns trigger focus '+name);await retained(page,'Escape '+name);
   trigger=await openMenu(page);await page.getByRole('button',{name:'Cerrar navegación',exact:true}).press('Enter');await frames(page);
   check(await trigger.evaluate(node=>node===document.activeElement),'Close button returns trigger focus '+name);await retained(page,'X '+name);
   if(width>520){trigger=await openMenu(page);await page.mouse.click(8,350);await frames(page);check(await trigger.evaluate(node=>node===document.activeElement)&&await page.getByRole('dialog').count()===0,'Exposed scrim returns trigger focus '+name);await retained(page,'scrim '+name);}
   await openMenu(page);await page.getByRole('dialog').getByRole('link',{name:'Pasaporte digital',exact:true}).press('Enter');
   await page.waitForFunction(()=>location.hash==='#pasaporte-digital'&&document.activeElement?.matches('#pasaporte-digital h2'));await frames(page);
   const homeGeometry=await passportGeometry(page);check(await page.evaluate(()=>scrollY>500)&&homeGeometry.headerIsStickyAtViewportTop&&homeGeometry.headingTop>=homeGeometry.headerBottom&&homeGeometry.unobstructed,'Home native anchor scrolls to unobstructed destination below real header '+name,homeGeometry);
   check(await page.locator('#pasaporte-digital h2').getAttribute('tabindex')==='-1','Home keyboard focus moves to destination heading '+name);
   await page.keyboard.press('Tab');check(await page.locator('#destination-action').evaluate(node=>node===document.activeElement),'Tab continues in destination content '+name);
   check(await page.locator('#pasaporte-digital h2').getAttribute('tabindex')===null,'Temporary heading tabindex removed on blur '+name);await retained(page,'anchor '+name);
   await page.screenshot({path:join(output,`home-anchor-${name.replace(' ','-')}.png`)});
   await page.goto(origin+'/about',{waitUntil:'networkidle'});await openMenu(page);await page.getByRole('dialog').getByRole('link',{name:'Pasaporte digital',exact:true}).press('Enter');
   await page.waitForURL(origin+'/#pasaporte-digital');await page.waitForFunction(()=>document.activeElement?.matches('#pasaporte-digital h2'));await frames(page);
   check(await page.evaluate(()=>location.pathname==='/'&&location.hash==='#pasaporte-digital'&&scrollY>500),'Cross-route native fragment keeps URL and destination '+name);
   check(await page.locator('#pasaporte-digital h2').evaluate(node=>node===document.activeElement),'About→Home destination receives focus '+name);
   const crossGeometry=await passportGeometry(page);check(crossGeometry.headerIsStickyAtViewportTop&&crossGeometry.headingTop>=crossGeometry.headerBottom&&crossGeometry.unobstructed,'Cross-route passport destination stays unobstructed below real header '+name,crossGeometry);
   await page.goBack({waitUntil:'networkidle'});check(new URL(page.url()).pathname==='/about','Native Back retains About route '+name);
   report.views.push({width,theme,paths:['/','/about'],closedDetailsTabStops:visibleCount});
  }catch(error){report.errors.push({name,error:error.message.slice(0,180),snapshot:await failureSnapshot(page)})}finally{await context.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2))}
 }
 for(const width of [390,1440])for(const theme of ['light','dark'])for(const kind of ['late-heading','late-asset','early-input'])await nativeLoadCase(width,theme,kind);
 check(report.errors.length===0,'No runtime or test exceptions',report.errors);check(report.blockedRequests.length===0,'No external/sensitive/write request',report.blockedRequests);
}finally{await browser.close();report.browserClosed=true;await new Promise(ok=>server.close(ok));report.serverClosed=true;report.sourceHashesEnd=await sourceHashes();check(JSON.stringify(report.sourceHashesEnd)===JSON.stringify(report.sourceHashesStart),'Real navigation and fixture source inputs remain unchanged during QA');await writeFile(join(output,'report.json'),JSON.stringify(report,null,2))}
console.log(JSON.stringify({views:report.views.length,checks:report.checks.length,failed:report.checks.filter(check=>!check.passed),errors:report.errors,browserClosed:report.browserClosed,serverClosed:report.serverClosed,output},null,2));
assert.equal(report.views.length,8);assert.equal(report.nativeLoadCases.length,12);assert.ok(report.nativeLoadCases.every(item=>item.completed));assert.ok(report.checks.every(check=>check.passed));assert.equal(report.errors.length,0);
assert.equal(report.consumerEntryCases.length,24);assert.ok(report.consumerEntryCases.every(item=>item.completed));
