// Real navigation/brand/theme components and CSS; synthetic Home/About content.
// Native browser anchors exercise cross-document navigation. No Next routing/API,
// full marketing-page acceptance, customer writes, NFC or GPS evidence is claimed.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

const root=resolve(fileURLToPath(new URL('../../../',import.meta.url))),web=join(root,'apps/web');
const output=resolve(process.env.QA_OUTPUT||join(root,'artifacts/browser/marketing-navigation-details'));
await mkdir(output,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright-core');
const fixture=`import React from 'react';import{createRoot}from'react-dom/client';import{MarketingMegaNav}from'./src/components/marketing-mega-nav';import headerStyles from'./src/components/public-site-header.module.css';
createRoot(document.getElementById('navigation')).render(<header className={'site-header landing-mega-header '+headerStyles.header}><div className="header-main-row"><span>Navigation test</span><MarketingMegaNav locale="es-AR" locales={['es-AR','en','pt-BR']} initialTheme={document.documentElement.dataset.theme} loginHref="/login" meetingHref="https://example.invalid/meeting"/></div></header>);`;
const nextShim=`import React from'react';export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push(url){location.assign(url)},refresh(){location.reload()}});export default React.forwardRef(function Link({href,prefetch,...props},ref){return <a {...props} href={href} ref={ref}/>});`;
const uiShim=['theme-toggle','locale-switcher','brand/brand-lockup','brand/brand-mark'].map(name=>`export * from ${JSON.stringify(join(root,'packages/ui/src',name+'.tsx').replaceAll('\\','/'))};`).join('\n');
const bundle=await build({stdin:{contents:fixture,resolveDir:web,loader:'tsx'},bundle:true,write:false,outdir:join(output,'bundle'),platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},loader:{'.module.css':'local-css'},plugins:[{name:'native-fixture-routing',setup(builder){
 builder.onResolve({filter:/^next\/(link|navigation)$/},()=>({path:'next-native',namespace:'fixture'}));
 builder.onResolve({filter:/^@product\/ui$/},()=>({path:'real-ui',namespace:'fixture'}));
 builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='real-ui'?uiShim:nextShim,loader:'tsx',resolveDir:web}));
}}],logLevel:'silent'});
const js=bundle.outputFiles.find(file=>file.path.endsWith('.js')).contents,css=bundle.outputFiles.find(file=>file.path.endsWith('.css')).contents;
await writeFile(join(output,'fixture.css'),css);
const globals=(await postcss([tailwindcss({content:[join(web,'src/components/marketing-mega-nav.tsx'),join(root,'packages/ui/src/theme-toggle.tsx'),join(root,'packages/ui/src/locale-switcher.tsx')],darkMode:['selector','[data-theme="dark"]']})]).process(await readFile(join(web,'src/app/globals.css'),'utf8'),{from:undefined})).css;
const server=createServer((req,res)=>{
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 const path=new URL(req.url,'http://fixture.invalid').pathname;
 if(path==='/fixture.js'){res.setHeader('content-type','text/javascript');return res.end(js);}
 if(path==='/fixture.css'){res.setHeader('content-type','text/css');return res.end(css);}
 if(path==='/base.css'){res.setHeader('content-type','text/css');return res.end(globals);}
 if(path==='/favicon.ico'){res.writeHead(204);return res.end();}
 if(!['/','/about'].includes(path)){res.writeHead(404);return res.end();}
 const theme=/(?:^|;\s*)theme=dark(?:;|$)/.test(req.headers.cookie||'')?'dark':'light';
 res.setHeader('content-type','text/html;charset=utf-8');res.end(`<!doctype html><html lang="es-AR" data-theme="${theme}" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Navigation component fixture</title><link rel="stylesheet" href="/base.css"><link rel="stylesheet" href="/fixture.css"><style>html{scroll-behavior:auto!important}body{margin:0;font:16px system-ui}header{position:sticky!important;top:0;z-index:50}.header-main-row{display:flex;align-items:center;gap:12px;padding-inline:12px}main{padding:24px}#prelude{height:1200px}#pasaporte-digital{scroll-margin-top:110px;padding:24px}#tail{height:800px}h1,h2{margin:0 0 20px;font-size:28px}.fixture-action{min-height:44px}html[data-theme="dark"] main{background:#10282f;color:#edf5f4}</style></head><body><div id="navigation"></div><main id="main-content" data-nav-inert><h1>${path==='/'?'Home':'About'} — synthetic content</h1><div id="prelude"></div>${path==='/'?'<section id="pasaporte-digital"><h2>Pasaporte digital de prueba</h2><button class="fixture-action" id="destination-action">Siguiente acción local</button></section>':''}<div id="tail"></div></main><aside id="foreign-inert" data-nav-inert inert aria-hidden="false">Pre-existing inert fixture</aside><script src="/fixture.js"></script></body></html>`);
});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(Number(process.env.QA_PORT||3302),'127.0.0.1',ok)});
const origin=`http://127.0.0.1:${server.address().port}`;
const report={realComponents:true,realCss:true,syntheticHomeAboutContent:true,nativeBrowserRoutingAdapter:true,actualNextPageAcceptance:false,physicalTapMeasured:false,gpsMeasured:false,businessWritesAllowed:false,origin,checks:[],views:[],errors:[],blockedRequests:[],browserClosed:false,serverClosed:false};
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
try{
 for(const width of [320,390,768,1440])for(const theme of ['light','dark']){
  const name=`${width} ${theme}`,context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addCookies([{name:'theme',value:theme,url:origin},{name:'nexid_theme_version',value:'white-first-v2',url:origin}]);
  const page=await context.newPage();page.on('pageerror',error=>report.errors.push({name,error:error.message.slice(0,180)}));
  await page.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(req.method()!=='GET'||url.origin!==origin||/^\/(?:api|sun)(?:\/|$)/.test(url.pathname)){report.blockedRequests.push({name,method:req.method(),path:url.pathname});return route.abort()}return route.continue()});
  try{
   await page.goto(origin+'/',{waitUntil:'networkidle'});let trigger=await openMenu(page);
   check(await page.getByRole('button',{name:'Cerrar navegación',exact:true}).evaluate(node=>node===document.activeElement),'Open focuses close '+name);
   check(await page.locator('#main-content').evaluate(node=>node.inert),'Open makes content inert '+name);
   const dialog=page.getByRole('dialog'),brand=dialog.locator('[data-brand-home-link]');
   for(const [label,locator]of [['brand',brand],['close',dialog.getByRole('button',{name:'Cerrar navegación',exact:true})],['passport',dialog.getByRole('link',{name:'Pasaporte digital',exact:true})],['about',dialog.getByRole('link',{name:'Quiénes somos',exact:true})],['item',dialog.locator('[data-menu-link]').first()],['summary',dialog.locator('summary').first()],['login',dialog.getByRole('link',{name:'Ingresar',exact:true})],['demo',dialog.getByRole('link',{name:'Agendar demo',exact:true})]]){
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
   check(await page.evaluate(()=>scrollY>500&&document.querySelector('#pasaporte-digital h2').getBoundingClientRect().top>=70),'Home native anchor scrolls to visible destination '+name);
   check(await page.locator('#pasaporte-digital h2').getAttribute('tabindex')==='-1','Home keyboard focus moves to destination heading '+name);
   await page.keyboard.press('Tab');check(await page.locator('#destination-action').evaluate(node=>node===document.activeElement),'Tab continues in destination content '+name);
   check(await page.locator('#pasaporte-digital h2').getAttribute('tabindex')===null,'Temporary heading tabindex removed on blur '+name);await retained(page,'anchor '+name);
   await page.screenshot({path:join(output,`home-anchor-${name.replace(' ','-')}.png`)});
   await page.goto(origin+'/about',{waitUntil:'networkidle'});await openMenu(page);await page.getByRole('dialog').getByRole('link',{name:'Pasaporte digital',exact:true}).press('Enter');
   await page.waitForURL(origin+'/#pasaporte-digital');await page.waitForFunction(()=>document.activeElement?.matches('#pasaporte-digital h2'));await frames(page);
   check(await page.evaluate(()=>location.pathname==='/'&&location.hash==='#pasaporte-digital'&&scrollY>500),'Cross-route native fragment keeps URL and destination '+name);
   check(await page.locator('#pasaporte-digital h2').evaluate(node=>node===document.activeElement),'About→Home destination receives focus '+name);
   await page.goBack({waitUntil:'networkidle'});check(new URL(page.url()).pathname==='/about','Native Back retains About route '+name);
   report.views.push({width,theme,paths:['/','/about'],closedDetailsTabStops:visibleCount});
  }catch(error){report.errors.push({name,error:error.message.slice(0,180)})}finally{await context.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2))}
 }
 check(report.errors.length===0,'No runtime or test exceptions',report.errors);check(report.blockedRequests.length===0,'No external/sensitive/write request',report.blockedRequests);
}finally{await browser.close();report.browserClosed=true;await new Promise(ok=>server.close(ok));report.serverClosed=true;await writeFile(join(output,'report.json'),JSON.stringify(report,null,2))}
console.log(JSON.stringify({views:report.views.length,checks:report.checks.length,failed:report.checks.filter(check=>!check.passed),errors:report.errors,browserClosed:report.browserClosed,serverClosed:report.serverClosed,output},null,2));
assert.equal(report.views.length,8);assert.ok(report.checks.every(check=>check.passed));assert.equal(report.errors.length,0);
