// Loopback-only map QA. Production React/CSS/MapLibre/worker; no provider or customer writes.
// This harness is deliberately separate from frozen release helpers and receipts.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const ROOT=fileURLToPath(new URL('../../../',import.meta.url)),WEB=join(ROOT,'apps/web');
const HERE=resolve(process.env.QA_OUTPUT||join(ROOT,'artifacts/demo-map-20261007/qa'));
const FIXTURE=join(WEB,'tests/browser/valle-secreto-demo-map.fixture.tsx');
const EXPECTED=process.env.EXPECTED_COMMIT||execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8',windowsHide:true}).trim();
assert(EXPECTED&&/^[a-f0-9]{40}$/.test(EXPECTED),'Explicit source SHA required');
assert.equal(process.version,'v24.15.0');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8',windowsHide:true}).trim(),EXPECTED);
const componentFile='src/app/sun/valle-secreto-demo-map.tsx';
const componentSource=await readFile(join(WEB,componentFile),'utf8');
assert(/export\s+function\s+ValleSecretoDemoMap/.test(componentSource),'Agreed component contract must exist before execution');
const cssImports=[...componentSource.matchAll(/(?:from\s*|import\s*)["'](\.\/[^"']+\.module\.css)["']/g)].map(m=>join('src/app/sun',m[1]));
const paths=['tests/browser/valle-secreto-demo-map.fixture.tsx',componentFile,...cssImports,'src/app/sun/valle-secreto-demo-location.ts','src/app/sun/sun-reference-map.ts','src/app/sun/sun-route-distance.ts','src/app/sun/sun-passport-map.tsx','src/app/sun/sun-passport-map.module.css','src/app/sun/sun-locale.ts','src/app/sun/sun-locale-provider.tsx','src/app/sun/valle-secreto-demo.ts','src/lib/sun-map-worker.ts','src/lib/sun-external-map.ts','src/app/globals.css','public/sun/valle-secreto/world-reference.geojson','public/maplibre/6.4.1/maplibre-gl-worker.mjs','public/maplibre/6.4.1/maplibre-gl-shared.mjs'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,hash(await readFile(join(WEB,p)))])));
await mkdir(HERE,{recursive:true});
const OUTPUT=await mkdtemp(join(HERE,'fixture-'));
const sourceStart=await hashes(),helperStart=hash(await readFile(fileURLToPath(import.meta.url)));
const sourceWorkingTreeStatus=execFileSync('git',['status','--porcelain','--untracked-files=all'],{cwd:ROOT,encoding:'utf8',windowsHide:true}).trim();
const report={schema:'nexid.demo-map-fixture/v1',source:EXPECTED,sourceIsCommitted:!sourceWorkingTreeStatus,workingTreeStatusSha256:hash(sourceWorkingTreeStatus),localOnly:true,actualProductionComponentsAndCss:true,actualNextServer:false,cartography:'same-origin Natural Earth overview',physicalTap:false,realLocation:false,geolocationSynthetic:true,automaticGeolocationCalls:0,watchPositionCalls:0,gpsOnlyAfterExplicitClick:true,coordinatesExported:false,coordinateExports:[],sourceHashes:sourceStart,helperSha256:helperStart,checks:[],views:[],cases:[],referenceMapObservations:[],mapGeometry:[],accessibilityReports:[],apiRequests:[],writeRequests:[],externalAttemptedRequests:[],externalDeliveredRequests:0,storageWrites:[],errors:[],failedRequests:[],geolocationCalls:0,providerMutations:0,customerWrites:0};
const check=(pass,name)=>{report.checks.push({name,passed:Boolean(pass)});assert.ok(pass,name);};
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe=await readFile(process.env.AXE_MODULE_PATH,'utf8');
const fixture=await readFile(FIXTURE,'utf8');
const compiled=await build({stdin:{contents:fixture,resolveDir:dirname(FIXTURE),loader:'tsx'},bundle:true,write:false,outfile:'fixture.js',format:'esm',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'read-only-map-observation',setup(b){b.onLoad({filter:/sun-passport-map[.]tsx$/},async args=>{const source=await readFile(args.path,'utf8');assert.equal(source.split('mapRef.current = map;').length,2,'Exact map observation anchor');assert.equal(source.split('mapRef.current?.remove();').length,2,'Exact map cleanup anchor');return{contents:source.replace('mapRef.current = map;','mapRef.current = map; (window as any).__qaMap=map;(window as any).__qaMapInstances=((window as any).__qaMapInstances||0)+1;').replace('mapRef.current?.remove();','(window as any).__qaMapDisposals=((window as any).__qaMapDisposals||0)+1;mapRef.current?.remove();'),loader:'tsx',resolveDir:dirname(args.path)};});}}],logLevel:'error'});
const globalCss=await postcss([tailwind()]).process(await readFile(join(WEB,'src/app/globals.css'),'utf8'),{from:join(WEB,'src/app/globals.css')});
const js=compiled.outputFiles.find(f=>f.path.endsWith('.js')).contents;
const css=(compiled.outputFiles.find(f=>f.path.endsWith('.css'))?.text||'')+'\n'+globalCss.css+'\n'+await readFile(join(ROOT,'node_modules/maplibre-gl/dist/maplibre-gl.css'),'utf8');
const ownedAssets=new Map(['/sun/valle-secreto/world-reference.geojson','/maplibre/6.4.1/maplibre-gl-worker.mjs','/maplibre/6.4.1/maplibre-gl-shared.mjs'].map(p=>[p,join(WEB,'public',p.slice(1))]));
const server=createServer(async(req,res)=>{try{
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 const u=new URL(req.url,'http://fixture.invalid');
 if(u.pathname==='/fixture.js'){res.setHeader('content-type','text/javascript');return res.end(js);}
 if(u.pathname==='/fixture.css'){res.setHeader('content-type','text/css');return res.end(css);}
 if(ownedAssets.has(u.pathname)){res.setHeader('content-type',u.pathname.endsWith('.geojson')?'application/geo+json':'text/javascript');return res.end(await readFile(ownedAssets.get(u.pathname)));}
 if(u.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
 if(u.pathname!=='/'){res.writeHead(404);return res.end();}
 const theme=u.searchParams.get('theme')==='dark'?'dark':'light';
 res.setHeader('content-type','text/html; charset=utf-8');
 res.end(`<!doctype html><html data-theme='${theme}' class='${theme==='light'?'theme-light':'dark'}'><head><title>SUN map local QA</title><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='referrer' content='no-referrer'><link rel='stylesheet' href='/fixture.css'><style>body{margin:0;font:16px/1.5 system-ui;background:${theme==='light'?'#f6f9fa':'#0b1420'};color:${theme==='light'?'#132832':'#edf6fc'}}*,*:before,*:after{box-sizing:border-box}</style></head><body><div id='app'></div><script type='module' src='/fixture.js'></script></body></html>`);
 }catch(error){res.writeHead(500);res.end('QA asset read failed');report.errors.push({stage:'server',message:error.message});}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const ORIGIN=`http://127.0.0.1:${server.address().port}`;report.origin=ORIGIN;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const originPoint=[-70.837119,-34.482672],mendozaPoint=[-68.84,-32.89],gpsPoint=[-68.86,-32.92];
let active;
async function frames(page){await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));}
async function ready(page){await page.locator('[data-sun-passport-map]').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('[data-sun-passport-map]')?.getAttribute('data-basemap-state')==='ready'&&window.__qaMap?.loaded(),null,{timeout:10000});}
async function state(page,expected){await page.waitForFunction(expected=>document.querySelector('[data-testid="valle-secreto-demo-map"]')?.getAttribute('data-demo-location-state')===expected,expected);}
async function pendingRequest(page,label){const before=await page.evaluate(()=>window.__geoCalls.length);await page.getByTestId('demo-location-request').evaluate(el=>{el.click();el.click();});await state(page,'pending');check(await page.evaluate(()=>window.__geoCalls.length)===before+1,label+': immediate double activation creates one native GPS request');return before;}
async function geoSuccess(page,index,coords={latitude:-32.915673,longitude:-68.862399,accuracy:85}){await page.evaluate(({index,coords})=>(window.__qaLastGeoCoords=coords,window.__geoCalls[index].success({coords,timestamp:Date.now()})),{index,coords});}
async function geoError(page,index,code){await page.evaluate(({index,code})=>window.__geoCalls[index].error({code,message:'Synthetic QA geolocation outcome'}),{index,code});}
async function inside(page,points){return page.evaluate(points=>{const map=window.__qaMap,size=map.getCanvas().getBoundingClientRect();return points.every(p=>{const q=map.project(p);return q.x>=18&&q.x<=size.width-18&&q.y>=28&&q.y<=size.height-18;});},points);}
async function reset(page,label){await page.getByTestId('demo-location-reset').click();await state(page,'idle');await ready(page);check(await page.locator('.maplibregl-marker button[aria-label]').count()===2,label+': reset restores exactly two evidence markers');check(await inside(page,[originPoint,mendozaPoint]),label+': reset restores public winery and simulated Mendoza points');}
async function picture(page,label,suffix){await page.locator('[data-sun-passport-map]').screenshot({path:join(OUTPUT,label.replaceAll('/','-')+'-'+suffix+'.png')});}
async function markersUsable(page,label,phase){
 await page.locator('.maplibregl-canvas').scrollIntoViewIfNeeded();await frames(page);
 const geometry=await page.locator('[data-sun-passport-map]').evaluate(shell=>{
  const canvas=shell.querySelector('.maplibregl-canvas').getBoundingClientRect(),legendElement=shell.querySelector('[data-map-legend]');if(!legendElement)throw Error('QA_MAP_LEGEND_MISSING');const legend=legendElement.getBoundingClientRect(),controls=[...shell.querySelectorAll('[role="region"] > button, .maplibregl-ctrl-top-right .maplibregl-ctrl-group, .maplibregl-ctrl-attrib')].map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height);
  const rect=r=>({x:r.x,y:r.y,width:r.width,height:r.height}),overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)),shared=document.querySelector('[data-testid="valle-secreto-demo-map"]').getAttribute('data-demo-location-state')==='shared',coords=window.__qaLastGeoCoords,expected=[[-70.837119,-34.482672],shared?[Math.round(coords.longitude*100)/100,Math.round(coords.latitude*100)/100]:[-68.84,-32.89]];
  const countries=[...shell.querySelectorAll('.maplibregl-marker[aria-hidden="true"]')].filter(el=>el.getBoundingClientRect().width).map(el=>{const r=el.getBoundingClientRect(),point=el.textContent==='CHILE'?[-72.1,-35.7]:[-65.8,-33.5],projected=window.__qaMap.project(point),visibility=getComputedStyle(el).visibility,canonicalInsideInset=projected.x-el.offsetWidth/2>=8&&projected.x+el.offsetWidth/2<=shell.querySelector('.maplibregl-canvas').clientWidth-8&&projected.y-el.offsetHeight/2>=8&&projected.y+el.offsetHeight/2<=shell.querySelector('.maplibregl-canvas').clientHeight-8;return{label:el.textContent,rect:rect(r),coordinate:point,projected,visibility,visible:visibility==='visible',canonicalInsideInset,projectionErrorPx:Math.hypot(r.x+r.width/2-canvas.x-projected.x,r.y+r.height/2-canvas.y-projected.y)};});
  return{canvas:rect(canvas),legend:rect(legend),legendOutsideCanvas:legend.top>=canvas.bottom,legendLabels:[...legendElement.children].map(element=>element.textContent),controls:controls.map(rect),countries,markers:[...shell.querySelectorAll('.maplibregl-marker button[aria-label]')].map((button,index)=>{const r=button.getBoundingClientRect(),anchor=button.closest('.maplibregl-marker').getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),projected=window.__qaMap.project(expected[index]);return{label:button.getAttribute('aria-label'),rect:rect(r),coordinate:expected[index],projected,projectionErrorPx:Math.hypot(anchor.x+anchor.width/2-canvas.x-projected.x,anchor.bottom-canvas.y-projected.y),inside:r.left>=canvas.left&&r.right<=canvas.right&&r.top>=canvas.top&&r.bottom<=canvas.bottom,clickable:Boolean(hit&&(hit===button||button.contains(hit))),legendOverlapArea:overlap(r,legend),controlOverlapArea:controls.reduce((sum,control)=>sum+overlap(r,control),0)};})};
 });
 report.mapGeometry.push({view:label,phase,...geometry});check(geometry.legendOutsideCanvas&&geometry.legendLabels.length===2&&geometry.markers.length===2&&geometry.markers.every(marker=>marker.inside&&marker.clickable&&marker.legendOverlapArea===0&&marker.controlOverlapArea===0),label+': '+phase+' both pins are fully visible, unoccluded and clickable');
 check(geometry.markers.every(marker=>marker.projectionErrorPx<=2)&&geometry.countries.length===2&&geometry.countries.every(country=>country.projectionErrorPx<=2),label+': '+phase+' displayed points and country labels match their geographic projection');
 check(geometry.countries.every(country=>country.visible===country.canonicalInsideInset),label+': '+phase+' clipped decorative labels are hidden without moving their geographic coordinates');
}
async function accessibility(page,label,phase){await page.evaluate(axe);const result=await page.evaluate(async()=>window.axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));report.accessibilityReports.push({view:label,phase,violations:result.violations,incomplete:result.incomplete});await writeFile(join(OUTPUT,'accessibility-progress.json'),JSON.stringify({source:EXPECTED,reports:report.accessibilityReports},null,2));check(result.violations.length===0,label+': '+phase+' axe has no violations');}
try{
 for(const locale of ['es-AR','en','pt-BR'])for(const width of [320,390,692])for(const theme of ['light','dark']){
  const label=`${locale}/${width}/${theme}`;if(process.env.QA_ONLY&&process.env.QA_ONLY!==label)continue;
  const context=await browser.newContext({viewport:{width,height:width===692?884:844},reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await context.newPage();active=page;page.setDefaultTimeout(10000);const assetPending=[];
  page.on('response',response=>{const url=new URL(response.url());if(url.pathname==='/sun/valle-secreto/world-reference.geojson')assetPending.push((async()=>{const bytes=await response.body();report.referenceMapObservations.push({view:label,path:url.pathname,bytes:bytes.length,sha256:hash(bytes),sameOrigin:url.origin===ORIGIN});})().catch(error=>report.errors.push({view:label,stage:'reference-asset',message:error.message})));});
  page.on('pageerror',error=>report.errors.push({view:label,message:error.message}));
  page.on('requestfailed',request=>report.failedRequests.push({view:label,url:request.url(),method:request.method(),error:request.failure()?.errorText}));
  await context.route('**/*',async route=>{const req=route.request(),u=new URL(req.url()),item={view:label,origin:u.origin,path:u.pathname,method:req.method(),type:req.resourceType()};
   if(u.origin!==ORIGIN){report.externalAttemptedRequests.push(item);return route.abort();}
   if(u.pathname.startsWith('/api/')){report.apiRequests.push(item);return route.abort();}
   if(!['GET','HEAD'].includes(req.method())){report.writeRequests.push(item);return route.abort();}
   return route.continue();
  });
  await page.addInitScript(()=>{
   window.__geoCalls=[];window.__geoWatchCalls=0;window.__storageWrites=[];
   for(const method of ['setItem','removeItem','clear']){const original=Storage.prototype[method];Storage.prototype[method]=function(...args){window.__storageWrites.push({kind:'storage',method,key:typeof args[0]==='string'?args[0]:null});return original.apply(this,args);};}
   window.__syntheticGeo={getCurrentPosition(success,error,options){window.__geoCalls.push({success,error,options});},watchPosition(){window.__geoWatchCalls++;throw Error('Demo must not watch location');},clearWatch(){}};Object.defineProperty(navigator,'geolocation',{configurable:true,value:window.__syntheticGeo});
  });
  const response=await page.goto(ORIGIN+`/?locale=${locale}&theme=${theme}`,{waitUntil:'networkidle'});check(response.status()===200,label+': local fixture loads');
  const done=(kind,geolocationCalls)=>report.cases.push({view:label,kind,passed:true,completed:true,geolocationCalls});
  await page.getByTestId('demo-location-request').waitFor();await state(page,'idle');await ready(page);
  check(await page.evaluate(()=>window.__geoCalls.length===0&&window.__geoWatchCalls===0),label+': no GPS request or watcher on load');
  done('default',0);
  check(await page.locator('.maplibregl-marker button[aria-label]').count()===2,label+': winery and Mendoza evidence markers are visible');
  check(await inside(page,[originPoint,mendozaPoint]),label+': both reference points fit in the camera');
  await markersUsable(page,label,'default');
  check(await page.evaluate(()=>!window.__qaMap.getStyle().layers.some(l=>l.type==='raster')),label+': overview contains no raster tile layers');
  const overview=await page.locator('[data-sun-passport-map]').innerText();check(/Mendoza/.test(overview)&&/simula|sample|exemplo/i.test(overview),label+': default visitor point is explicitly simulated');
  check(await page.getByTestId('demo-location-request').evaluate(el=>el.getBoundingClientRect().height>=44),label+': location action has a 44px touch target');
  await accessibility(page,label,'idle');await picture(page,label,'default');
  const map=page.locator('[data-sun-passport-map]');
  const expand=map.locator('button[aria-controls][aria-expanded]');const beforeHeight=await map.locator('.maplibregl-canvas').evaluate(el=>el.clientHeight);
  await page.evaluate(()=>{window.__qaInitialMap=window.__qaMap;window.__qaMap.jumpTo({center:[-50,-10],zoom:7});});await frames(page);
  const center=map.getByRole('button',{name:/^(Centrar puntos|Center points|Centrar pontos)$/});await center.click();await frames(page);check(await inside(page,[originPoint,mendozaPoint]),label+': centering repairs a displaced camera');
  await expand.click();await frames(page);await ready(page);check(await map.locator('.maplibregl-canvas').evaluate(el=>el.clientHeight)>beforeHeight+100,label+': expansion makes the canvas larger');
  check(await page.evaluate(()=>window.__qaMap===window.__qaInitialMap),label+': expansion preserves the renderer');check(await map.locator('.maplibregl-marker button[aria-label]').count()===2,label+': expansion does not duplicate evidence markers');
  await page.keyboard.press('Escape');await frames(page);check(await expand.getAttribute('aria-expanded')==='false',label+': Escape reduces the map');
  check(await expand.evaluate(el=>document.activeElement===el),label+': Escape restores focus to expansion control');
  for(const pinIndex of [0,1]){await center.click();await frames(page);const pin=map.locator('.maplibregl-marker button[aria-label]').nth(pinIndex);await pin.focus();await page.keyboard.press('Enter');await map.locator('.maplibregl-popup').waitFor();const close=map.locator('.maplibregl-popup-close-button');check(await close.evaluate(el=>document.activeElement===el&&el.getBoundingClientRect().width>=44&&el.getBoundingClientRect().height>=44),label+': pin '+pinIndex+' keyboard opens an accessible popup close action');await page.keyboard.press('Escape');check(await map.locator('.maplibregl-popup').count()===0&&await pin.evaluate(el=>document.activeElement===el),label+': pin '+pinIndex+' Escape closes popup and restores focus');}
  await center.click();await frames(page);
  const index=await pendingRequest(page,label);done('double_click',1);const options=await page.evaluate(i=>window.__geoCalls[i].options,index);check(options.enableHighAccuracy===false&&options.timeout===8000&&options.maximumAge===300000,label+': GPS request uses the agreed bounded, approximate options');
  await geoSuccess(page,index);await state(page,'shared');await ready(page);
  check(await inside(page,[originPoint,gpsPoint]),label+': shared approximate coordinates replace the simulated visitor point');
  await markersUsable(page,label,'shared');
  const accuracy=await page.evaluate(()=>window.__qaMap.getSource('sun-tap-accuracy')?.serialize());check(Boolean(accuracy),label+': shared point has an approximate accuracy area');
  const externalLinks=await page.locator('[data-sun-passport-map] a[href]').evaluateAll(links=>links.map(link=>link.href));check(externalLinks.every(href=>!href.includes('-32.92')&&!href.includes('-68.86')),label+': demo visitor GPS is not exported to external map URLs');
  done('success',1);await accessibility(page,label,'shared');await picture(page,label,'shared');await reset(page,label);done('reset',0);
  for(const [code,expected]of [[1,'denied'],[2,'unavailable'],[3,'timeout']]){const request=await pendingRequest(page,label+'/'+expected);await geoError(page,request,code);await state(page,expected);check(await inside(page,[originPoint,mendozaPoint]),label+': '+expected+' preserves example map');done(expected,1);await reset(page,label+'/'+expected);}
  const stale=await pendingRequest(page,label+'/reset-race');await reset(page,label+'/pending-reset');await geoSuccess(page,stale);await frames(page);check(await page.getByTestId('valle-secreto-demo-map').getAttribute('data-demo-location-state')==='idle',label+': old GPS success cannot overwrite reset');
  const staleRemount=await pendingRequest(page,label+'/remount-race');await page.evaluate(()=>{window.__qaBeforeRemount=window.__qaMap;window.__qaRemount();});await state(page,'idle');await ready(page);await geoSuccess(page,staleRemount);await frames(page);check(await page.getByTestId('valle-secreto-demo-map').getAttribute('data-demo-location-state')==='idle',label+': disposed callback cannot change remounted demo');
  check(await page.evaluate(()=>window.__qaMap!==window.__qaBeforeRemount&&window.__qaMapDisposals>0),label+': remount removes the former renderer');
  done('stale_callback',2);
  if(locale==='es-AR'&&width===320){
   const previouslyShared=await pendingRequest(page,label+'/unsupported-prior-shared');await geoSuccess(page,previouslyShared);await state(page,'shared');await ready(page);await page.evaluate(()=>Object.defineProperty(navigator,'geolocation',{configurable:true,value:undefined}));const unavailableBefore=await page.evaluate(()=>window.__geoCalls.length);await page.getByTestId('demo-location-request').click();await state(page,'unavailable');check(await page.evaluate(()=>window.__geoCalls.length)===unavailableBefore,label+': unsupported browser does not create a native request');await ready(page);check(await inside(page,[originPoint,mendozaPoint])&&await map.getAttribute('data-location-source')==='demo',label+': unsupported browser clears a previously shared location and restores Mendoza');await reset(page,label+'/unsupported');await page.evaluate(()=>Object.defineProperty(navigator,'geolocation',{configurable:true,value:window.__syntheticGeo}));
   const hung=await pendingRequest(page,label+'/native-hang');await state(page,'timeout');await geoSuccess(page,hung);await frames(page);check(await page.getByTestId('valle-secreto-demo-map').getAttribute('data-demo-location-state')==='timeout',label+': independent deadline and late callback are safe when native GPS never responds');await reset(page,label+'/deadline');
   const obsolete=await pendingRequest(page,label+'/concurrent-old');await reset(page,label+'/concurrent-reset');const current=await pendingRequest(page,label+'/concurrent-new');await geoError(page,obsolete,1);await state(page,'pending');await geoSuccess(page,current);await state(page,'shared');await ready(page);check(await inside(page,[originPoint,gpsPoint]),label+': old denial cannot overwrite a newer successful request');await reset(page,label+'/concurrent');
   const invalid=await pendingRequest(page,label+'/invalid-position');await geoSuccess(page,invalid,{latitude:90,longitude:20,accuracy:0});await state(page,'unavailable');check(await inside(page,[originPoint,mendozaPoint]),label+': invalid browser coordinates preserve the example');await reset(page,label+'/invalid');
   const distant=await pendingRequest(page,label+'/distant-tokyo');await geoSuccess(page,distant,{latitude:35.68,longitude:139.76,accuracy:80});await state(page,'shared');await ready(page);check(await inside(page,[originPoint,[139.76,35.68]]),label+': distant Tokyo and winery points both fit at mobile width');await markersUsable(page,label,'distant-tokyo');await center.click();await frames(page);check(await inside(page,[originPoint,[139.76,35.68]]),label+': centering preserves the distant pair');await picture(page,label,'distant-tokyo');await reset(page,label+'/distant');
   for(const latitude of [85,-85]){const phase=latitude>0?'polar-north':'polar-south',polar=await pendingRequest(page,label+'/'+phase);await geoSuccess(page,polar,{latitude,longitude:170,accuracy:1000000});await state(page,'shared');await ready(page);check(await inside(page,[originPoint,[170,latitude]]),label+': '+phase+' accepted point fits without invalid bounds');await markersUsable(page,label,phase);await center.click();await frames(page);check(await inside(page,[originPoint,[170,latitude]]),label+': '+phase+' centering remains usable');await picture(page,label,phase);await reset(page,label+'/'+phase);}
  }
  const staleUnmount=await pendingRequest(page,label+'/unmount-race');await page.evaluate(()=>window.__qaUnmount());await geoSuccess(page,staleUnmount);await frames(page);check(await page.locator('.maplibregl-canvas,.maplibregl-marker,.maplibregl-popup').count()===0,label+': unmount clears canvas, markers and popups despite a late GPS callback');
  done('cleanup',1);
  const storage=await page.evaluate(()=>window.__storageWrites);report.storageWrites.push(...storage.map(item=>({view:label,...item})));check(storage.length===0,label+': map interaction performs no storage writes');
  const gpsCalls=await page.evaluate(()=>window.__geoCalls.length);report.geolocationCalls+=gpsCalls;check(await page.evaluate(()=>window.__geoWatchCalls===0),label+': no persistent geolocation watcher');
  await Promise.all(assetPending);const assets=report.referenceMapObservations.filter(item=>item.view===label);check(assets.length>0&&assets.every(item=>item.sameOrigin&&item.bytes===193317&&item.sha256==='4a05dddaa4c9347b9f9b6bec379f39ee0bbd118535b7bf886583649edcda7418'),label+': real same-origin geography matches its pinned bytes');
  report.views.push({locale,width,theme,gpsCalls,defaultGeolocationCalls:0});await writeFile(join(OUTPUT,'progress.json'),JSON.stringify({source:EXPECTED,views:report.views,checks:report.checks.length},null,2));await context.close();active=null;
 }
 check(report.views.length===(process.env.QA_ONLY?1:18),'Complete requested responsive/theme/locale matrix');
 check(report.apiRequests.length===0&&report.writeRequests.length===0&&report.storageWrites.length===0,'No API, network writes or persisted location');
 check(report.externalAttemptedRequests.length===0&&report.externalDeliveredRequests===0,'No external cartography or other external request attempted');
 check(report.errors.length===0&&report.failedRequests.length===0,'No browser exceptions or failed requests');
 report.status='passed';
}catch(error){report.status='failed';report.failure=String(error.message||error);if(active)await active.screenshot({path:join(OUTPUT,'failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1;
}finally{
 await browser.close();await new Promise(done=>server.close(done));report.endSourceHashes=await hashes();report.sourceAndHelperStable=JSON.stringify(report.sourceHashes)===JSON.stringify(report.endSourceHashes)&&helperStart===hash(await readFile(fileURLToPath(import.meta.url)));if(!report.sourceAndHelperStable){report.status='failed';report.failure='Source or helper changed during QA';process.exitCode=1;}report.completedAt=new Date().toISOString();await writeFile(join(OUTPUT,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({accepted:report.status==='passed'&&report.sourceAndHelperStable,source:EXPECTED,report:{path:join(OUTPUT,'report.json'),sha256:hash(await readFile(join(OUTPUT,'report.json')))},views:report.views.length,checks:report.checks.length,sourceAndHelperStable:report.sourceAndHelperStable,releaseAcceptance:false}));
}
