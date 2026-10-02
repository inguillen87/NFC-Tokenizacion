import {prepareSunMapWorker} from '../scripts/prepare-sun-map-worker.mjs';
import {createTestRaster} from './sun-test-raster.mjs';
import assert from 'node:assert/strict';import {createServer} from 'node:http';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {fileURLToPath,pathToFileURL} from 'node:url';import {resolve,join,dirname} from 'node:path';import {build} from 'esbuild';
const web=fileURLToPath(new URL('../',import.meta.url)),root=resolve(web,'../..'),output=resolve(process.env.QA_OUTPUT||'artifacts/sun-map-controls');await mkdir(output,{recursive:true});
const preparedWorker=await prepareSunMapWorker();
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const source=await readFile(join(web,'src/app/sun/sun-passport-map.tsx'),'utf8');
const fixture=`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{SunPassportMap}from'./src/app/sun/sun-passport-map';const first={origin:{id:'qa-origin',lat:-32.89,lng:-68.84,label:'Origen de ensayo',evidence:'Declarado por la empresa de prueba',source:'declared_origin'},tap:{id:'qa-tap',lat:-32.91,lng:-68.83,label:'Zona de ensayo',evidence:'Ensayo sin teléfono real',source:'browser_geolocation_approximate_consent',accuracyM:1000},showRoute:false,distanceLabel:'2 km'};function App(){const[p,set]=useState(first);window.__change=set;window.__initial=first;return <main><h1>Mapa SUN · ensayo local</h1><p>Geografía de prueba, sin datos de clientes ni solicitudes de ubicación.</p><SunPassportMap {...p}/></main>};const fixtureRoot=createRoot(document.getElementById('app'));window.__unmount=()=>fixtureRoot.unmount();fixtureRoot.render(<App/>);`;
const result=await build({stdin:{contents:fixture,resolveDir:web,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'map-fixture',setup(b){b.onLoad({filter:/sun-passport-map[.]tsx$/},args=>({contents:source.replace('mapRef.current = map;','mapRef.current = map; (window as any).__qaMap=map;(window as any).__mapEvents=[]; for(const eventName of ["load","style.load","idle","sourcedata","error"])map.on(eventName as any,(e:any)=>{(window as any).__mapEvents.push({type:eventName,source:e.sourceId,part:e.sourceDataType,state:e.tile?.state,error:e.error?.message});});'),loader:'tsx',resolveDir:dirname(args.path)}));b.onLoad({filter:/sun-passport-map[.]module[.]css$/},()=>({contents:'export default new Proxy({}, {get:(_,key)=>String(key)});',loader:'js'}));}}],logLevel:'silent'});
const css=(await readFile(join(web,'src/app/sun/sun-passport-map.module.css'),'utf8')).replace(/:global\(([^)]+)\)/g,'$1');const engineCss=await readFile(join(root,'node_modules/maplibre-gl/dist/maplibre-gl.css'),'utf8');
const server=createServer(async(req,res)=>{const u=new URL(req.url,'http://test.invalid');if(req.method!=='GET'){res.writeHead(405);return res.end();}if(u.pathname==='/fixture.js'){res.setHeader('content-type','text/javascript');return res.end(result.outputFiles[0].contents);}if(u.pathname.startsWith('/maplibre/6.4.1/')){const name=u.pathname.split('/').at(-1);if(!['maplibre-gl-worker.mjs','maplibre-gl-shared.mjs'].includes(name)){res.writeHead(404);return res.end();}res.setHeader('content-type','text/javascript');return res.end(await readFile(join(preparedWorker.folder,name)));}if(u.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}res.setHeader('content-type','text/html; charset=utf-8');res.end(`<!doctype html><html lang='es-AR' data-theme='${u.searchParams.get('theme')==='dark'?'dark':'light'}'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='referrer' content='no-referrer'><title>SUN map fixture</title><style>${engineCss}\n${css}\nbody{margin:0;padding:16px;font:14px/1.5 system-ui;background:#0b1420;color:#eaf6ff}main{max-width:1000px;margin:auto}h1{font-size:22px}*,*::before,*::after{box-sizing:border-box}button,a{font:inherit}</style></head><body><div id='app'></div><script src='/fixture.js'></script></body></html>`);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--enable-unsafe-swiftshader']});
const report={actualMapLibre:true,syntheticLocations:true,syntheticTileImages:true,checks:[],views:[],errors:[],network:[]};const check=(v,name)=>report.checks.push({name,passed:Boolean(v)});
// Tiny PNG tests delivery/lifecycle only; it is not represented as real map imagery.
const png=createTestRaster();
async function scenario(mode='success',width=390,theme='dark'){
 const context=await browser.newContext({viewport:{width,height:1100},reducedMotion:'reduce',hasTouch:width<768,isMobile:width<768,deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(15000);const state={mode,requests:0,held:[]};
 page.on('pageerror',e=>report.errors.push(e.message));await page.addInitScript(()=>{window.__geoRequests=0;Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){window.__geoRequests++;}}});});
 await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.origin===origin&&req.method()==='GET'){if(u.pathname.startsWith('/maplibre/')&&state.mode==='worker-failure')return route.fulfill({status:503,contentType:'text/plain',body:'synthetic worker outage'});return route.continue();}if(req.method()==='GET'&&u.hostname==='server.arcgisonline.com'&&u.pathname.includes('/tile/')){state.requests++;if(req.headers()['referer'])report.network.push('unexpected-referrer');if(state.mode==='hang'){state.held.push(route);return;}if(state.mode==='live')return route.continue();return route.fulfill({status:state.mode==='failure'?503:200,contentType:state.mode==='failure'?'text/plain':'image/png',headers:{'access-control-allow-origin':'*','cache-control':'no-store'},body:state.mode==='failure'?'synthetic outage':png});}report.network.push(req.method()+' '+u.origin+u.pathname);return route.abort();});
 await page.goto(origin+'/?theme='+theme);await page.locator('[data-sun-passport-map]').waitFor();await page.waitForFunction(()=>window.__qaMap);return{page,context,state,width,theme};
}
const stateOf=t=>t.page.locator('[data-sun-passport-map]').getAttribute('data-basemap-state');
async function ready(t){await t.page.waitForFunction(()=>document.querySelector('[data-sun-passport-map]')?.getAttribute('data-basemap-state')==='ready'&&window.__qaMap.loaded()&&window.__qaMap.areTilesLoaded(),null,{timeout:7500});}
async function picture(t,name){const file=`${name}-${t.width}-${t.theme}.png`;await t.page.screenshot({path:join(output,file),fullPage:true});report.views.push({file,name,width:t.width,theme:t.theme});}
async function frames(page){await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));}
async function bothInside(t){return t.page.evaluate(()=>{const map=window.__qaMap,size=map.getCanvas().getBoundingClientRect();return [window.__initial.origin,window.__initial.tap].every(p=>{const q=map.project([p.lng,p.lat]);return q.x>=20&&q.x<=size.width-20&&q.y>=40&&q.y<=size.height-20;});});}
const hasFocus=locator=>locator.evaluate(element=>document.activeElement===element);
async function popupInteractions(t){
 const suffix=` ${t.width} ${t.theme}`,page=t.page;
 const originMarker=page.getByRole('button',{name:'Origen declarado: Origen de ensayo',exact:true});
 const tapMarker=page.getByRole('button',{name:'Zona compartida por el teléfono: Zona de ensayo',exact:true});
 const originLocation=page.getByRole('button',{name:'Enfocar origen en el mapa: Origen de ensayo',exact:true});
 const tapLocation=page.getByRole('button',{name:'Enfocar tap en el mapa: Zona de ensayo',exact:true});
 const close=page.locator('.maplibregl-popup-close-button'),popup=page.locator('.maplibregl-popup');
 const center=page.getByRole('button',{name:'Centrar puntos',exact:true});
 const expanded=()=>page.locator('[data-sun-passport-map]').getAttribute('data-map-expanded');

 await originMarker.focus();const beforeOpen=await page.evaluate(()=>scrollY);await page.keyboard.press('Enter');
 check(await popup.count()===1&&await hasFocus(close),'Keyboard marker opens one detail and focuses Cerrar'+suffix);
 check(await page.evaluate(()=>scrollY)===beforeOpen,'Opening keyboard detail preserves page scroll'+suffix);
 await page.keyboard.press('Enter');
 check(await popup.count()===0&&await hasFocus(originMarker),'Cerrar returns focus to the marker that opened it'+suffix);
 await page.keyboard.press('Tab');
 check(await hasFocus(tapMarker),'Tab continues naturally from the restored marker'+suffix);

 await tapLocation.focus();await page.keyboard.press('Space');
 check(await hasFocus(close),'Keyboard location action enters its detail'+suffix);
 await page.keyboard.press('Escape');
 check(await popup.count()===0&&await hasFocus(tapLocation),'Escape returns focus to the location action'+suffix);
 check(await expanded()==='true','Popup Escape preserves the expanded map'+suffix);
 await page.keyboard.press('Shift+Tab');
 check(await hasFocus(originLocation),'Reverse Tab continues naturally from the location action'+suffix);

 await originLocation.click();
 check(await popup.count()===1&&await hasFocus(originLocation),'Pointer location action retains natural focus'+suffix);
 await close.click();
 check(await popup.count()===0&&await hasFocus(originLocation),'Pointer Cerrar returns to its location action'+suffix);

 await originMarker.focus();await page.keyboard.press('Enter');await tapLocation.click();
 check(await popup.count()===1&&(await popup.innerText()).includes('Zona de ensayo')&&await hasFocus(tapLocation),'Switching points closes the old detail without stealing focus'+suffix);
 await center.click();await ready(t);await frames(page);
 check(await popup.count()===0&&await hasFocus(center),'Centrar points closes detail and retains its own focus'+suffix);
 check(await bothInside(t),'Popup interactions preserve the original camera fitting'+suffix);

 await originLocation.focus();await page.keyboard.press('Enter');
 const menu=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Abrir en Google Maps'})});
 await menu.locator('summary').focus();await page.keyboard.press('Enter');await page.keyboard.press('Escape');
 check(await menu.getAttribute('open')===null&&await popup.count()===1&&await hasFocus(menu.locator('summary'))&&await expanded()==='true','Escape closes the provider menu before the popup or map'+suffix);
 await page.keyboard.press('Escape');
 check(await popup.count()===0&&await hasFocus(originLocation)&&await expanded()==='true','The next Escape closes only the popup and restores its own trigger'+suffix);

 for(const unavailable of ['disabled','inert']){
  await originMarker.focus();await page.keyboard.press('Enter');
  const markerButton=page.locator('.maplibregl-marker button[aria-label="Origen declarado: Origen de ensayo"]');
  await markerButton.evaluate((element,reason)=>{if(reason==='disabled')element.disabled=true;else element.parentElement.inert=true;},unavailable);
  await center.focus();await page.keyboard.press('Escape');
  check(await popup.count()===0&&await hasFocus(center),'Dismissal does not restore an '+unavailable+' trigger'+suffix);
  await markerButton.evaluate((element,reason)=>{if(reason==='disabled')element.disabled=false;else element.parentElement.inert=false;},unavailable);
 }
}
try{
 for(const theme of ['light','dark'])for(const width of [320,390,768,1440]){
  const t=await scenario('success',width,theme);await ready(t);const initial=await t.page.evaluate(()=>{window.__originalMap=window.__qaMap;return{height:window.__qaMap.getCanvas().clientHeight};});
  await t.page.evaluate(()=>window.__qaMap.jumpTo({center:[-60,-20],zoom:9}));await frames(t.page);check(!await bothInside(t),'Camera deliberately displaced '+width+' '+theme);
  const center=t.page.getByRole('button',{name:'Centrar puntos',exact:true});await center.click();await ready(t);await frames(t.page);check(await bothInside(t),'Centrar puntos restores both markers '+width+' '+theme);
  check(!await t.page.getByRole('button',{name:'Ver ambos puntos',exact:true}).count(),'Ambiguous name is removed '+width+' '+theme);
  const expand=t.page.getByRole('button',{name:'Ampliar mapa',exact:true});await expand.click();await frames(t.page);await ready(t);check(await t.page.evaluate(h=>window.__qaMap.getCanvas().clientHeight>h+150,initial.height),'Expanded canvas is materially larger '+width+' '+theme);
  check(await t.page.evaluate(()=>window.__qaMap===window.__originalMap),'Expansion reuses renderer '+width+' '+theme);check(await bothInside(t),'Expansion fits both points '+width+' '+theme);check(await t.page.locator('.maplibregl-marker').count()===2,'No duplicated markers '+width+' '+theme);
  const fitbox=await center.boundingBox();check(fitbox.height>=44,'Touch target remains at least 44px '+width+' '+theme);check(await t.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow '+width+' '+theme);
  await popupInteractions(t);
  await picture(t,'expanded');await t.page.getByRole('button',{name:'Reducir mapa',exact:true}).focus();await t.page.keyboard.press('Escape');await frames(t.page);await ready(t);check(await t.page.getByRole('button',{name:'Ampliar mapa',exact:true}).getAttribute('aria-expanded')==='false','Escape reduces without navigation '+width+' '+theme);
  const menu=t.page.locator('details').filter({has:t.page.locator('summary').filter({hasText:'Abrir en Google Maps'})});await menu.locator('summary').click();const pair=menu.getByRole('link',{name:'Ver ambos en Google Maps ↗',exact:true});
  const href=await pair.getAttribute('href'),url=new URL(href);check(url.origin==='https://www.google.com'&&url.pathname==='/maps/dir/'&&url.searchParams.get('api')==='1','External provider action is explicit '+width+' '+theme);
  check(url.searchParams.get('origin')==='-32.89,-68.84'&&url.searchParams.get('destination')==='-32.91,-68.83','Both public points are sent, never identifiers '+width+' '+theme);check(await pair.getAttribute('rel')==='noopener noreferrer'&&await pair.getAttribute('referrerpolicy')==='no-referrer','External link does not disclose SUN URL '+width+' '+theme);
  check((await menu.innerText()).includes('No representa el recorrido del producto'),'Suggested route is not asserted as provenance '+width+' '+theme);
  if(width===390&&theme==='light'){
    const external=[];
    await t.context.route('https://www.google.com/maps/**',async route=>{external.push({url:route.request().url(),referrer:route.request().headers().referer});await route.fulfill({status:200,contentType:'text/html',body:'<html><title>External navigation test</title></html>'});});
    const [popup]=await Promise.all([t.context.waitForEvent('page'),pair.click()]);await popup.waitForLoadState();
    check(popup.url()===href&&external.length===1,'Explicit Google action opens the expected application URL');
    check(!external[0].referrer,'The external navigation does not send the passport URL');await popup.close();
    await menu.locator('summary').focus();await t.page.keyboard.press('Escape');check(await menu.getAttribute('open')===null,'Escape closes the provider menu');await menu.locator('summary').click();
  }

  check((await t.page.locator('.maplibregl-ctrl-attrib').textContent()).includes('Esri')&&(await t.page.locator('.maplibregl-ctrl-attrib').textContent()).includes('OpenStreetMap'),'Required provider credit remains '+width+' '+theme);
  check(await t.page.evaluate(()=>window.__geoRequests)===0,'Map controls never request fresh GPS '+width+' '+theme);await picture(t,'external-choice');await t.context.close();
 }
 {
  const t=await scenario();await ready(t);await t.page.evaluate(()=>{window.__prior=window.__qaMap;window.__change({...window.__initial,tap:{...window.__initial.tap,source:'edge_ip_approx'}});});await t.page.waitForFunction(()=>window.__qaMap!==window.__prior);await ready(t);
  await t.page.getByText('Abrir en Google Maps',{exact:true}).click();check(!await t.page.getByRole('link',{name:'Ver ambos en Google Maps ↗',exact:true}).count(),'IP zone is not used as a route endpoint');const href=await t.page.getByRole('link',{name:'Ver zona estimada de red ↗'}).getAttribute('href');const u=new URL(href);check(u.searchParams.get('map_action')==='map'&&!u.searchParams.has('destination')&&!u.searchParams.has('query'),'IP region opens broadly without a pinpoint');await t.context.close();
 }
 {
  const t=await scenario(),page=t.page;await ready(t);
  const originMarker=page.getByRole('button',{name:'Origen declarado: Origen de ensayo',exact:true});
  const center=page.getByRole('button',{name:'Centrar puntos',exact:true});
  await originMarker.focus();await page.keyboard.press('Enter');await originMarker.evaluate(element=>element.remove());await center.focus();await page.keyboard.press('Escape');
  check(await page.locator('.maplibregl-popup').count()===0&&await hasFocus(center),'Dismissal of a removed trigger keeps the current focus');
  const tapLocation=page.getByRole('button',{name:'Enfocar tap en el mapa: Zona de ensayo',exact:true});await tapLocation.focus();await page.keyboard.press('Enter');
  // Unlike the ready-only Centrar control, the toolbar action survives loading.
  const stableControl=page.getByRole('button',{name:'Ampliar mapa',exact:true});await stableControl.focus();
  await page.evaluate(()=>{window.__prior=window.__qaMap;window.__change({...window.__initial,tap:{...window.__initial.tap,id:'qa-replacement',label:'Zona actualizada'}});});
  await page.waitForFunction(()=>window.__qaMap!==window.__prior);await ready(t);
  check(await page.locator('.maplibregl-popup').count()===0&&await hasFocus(stableControl),'Evidence reconstruction dismisses the old popup without stealing focus');
  const newTap=page.getByRole('button',{name:'Enfocar tap en el mapa: Zona actualizada',exact:true});await newTap.focus();await page.keyboard.press('Enter');await page.keyboard.press('Escape');
  check(await page.locator('.maplibregl-popup').count()===0&&await hasFocus(newTap),'Replacement popup restores its own trigger rather than a stale session');
  await newTap.focus();await page.keyboard.press('Enter');
  await page.evaluate(()=>{const outside=document.createElement('button');outside.id='outside-map';outside.textContent='Acción fuera del mapa';document.body.append(outside);outside.focus();window.__unmount();});
  check(await page.locator('.maplibregl-popup').count()===0&&await hasFocus(page.locator('#outside-map')),'Unmount removes the popup without restoring focus into removed controls');
  check(await page.evaluate(()=>window.__geoRequests)===0,'Popup lifecycle never requests location permission');await t.context.close();
 }
 check(!report.errors.length,'No browser exceptions');check(!report.network.length,'No provider contact before a deliberate external link click');
}finally{await browser.close();await new Promise(r=>server.close(r));await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({checks:report.checks.length,failed:report.checks.filter(c=>!c.passed),views:report.views.length,errors:report.errors},null,2));assert.ok(report.checks.every(c=>c.passed));
