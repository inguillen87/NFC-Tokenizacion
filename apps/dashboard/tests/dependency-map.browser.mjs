import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
assert.ok(process.env.PLAYWRIGHT_MODULE, 'Use an installed browser driver; no download here');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const dashboard = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(process.env.QA_OUTPUT || 'artifacts/dependency-map-browser');
await mkdir(output, { recursive: true });
const code = `import * as maplibregl from 'maplibre-gl';
import { configureMapLibreWorker } from '@product/ui/maplibre-worker';
configureMapLibreWorker(maplibregl); window.__qaUnsafe=0; window.__qaMapReady=false;
const dark=new URLSearchParams(location.search).get('theme')==='dark';
const map=new maplibregl.Map({container:'map',center:[0,0],zoom:2,attributionControl:{customAttribution:'<details open onload="1" ontoggle="window.__qaUnsafe=1">Synthetic QA attribution</details>'},style:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':dark?'#0f172a':'#e2e8f0'}}]}});
window.__qaMap=map; window.__qaMapErrors=[]; map.on('error',e=>window.__qaMapErrors.push(String(e.error?.message||'map_error'))); map.addControl(new maplibregl.NavigationControl());
map.on('load',()=>{
map.addSource('qa',{type:'geojson',data:{type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[0,0]},properties:{source:'synthetic'}}]}});
map.addLayer({id:'qa-heat',type:'heatmap',source:'qa',paint:{'heatmap-weight':1,'heatmap-intensity':['interpolate',['linear'],['zoom'],0,1,12,2],'heatmap-radius':18}});
map.addLayer({id:'qa-circle',type:'circle',source:'qa',paint:{'circle-radius':7,'circle-color':'#0891b2','circle-stroke-width':2,'circle-stroke-color':'#ffffff'}});
new maplibregl.Popup({closeOnClick:false}).setLngLat([0,0]).setText('Synthetic <literal> reading').addTo(map);
window.__qaMap=map; window.__qaMapReady=true;
});`;
const bundle = await build({ stdin: { contents: code, resolveDir: dashboard, loader: 'js' }, bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent' });
const css = await readFile(new URL('../../../node_modules/maplibre-gl/dist/maplibre-gl.css', import.meta.url), 'utf8');
const workerFiles = new Map(await Promise.all(['maplibre-gl-worker.mjs','maplibre-gl-shared.mjs'].map(async name => ['/vendor/maplibre-gl/6.4.1/'+name, await readFile(join(dashboard, 'public/vendor/maplibre-gl/6.4.1', name))])));
const server = createServer((req, res) => { if(workerFiles.has(req.url)){res.setHeader('content-type','text/javascript');res.end(workerFiles.get(req.url));return;} if (req.url === '/map.js') { res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].contents);return; } res.setHeader('content-type','text/html;charset=utf-8');res.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic map dependency QA</title><style>${css}body{margin:0;font-family:sans-serif}header{padding:12px}#map{height:65vh;width:100%}</style></head><body><header><h1>Synthetic map QA</h1><p>No real product, location or physical TAP is represented.</p></header><div id="map"></div><script src="/map.js"></script></body></html>`); });
await new Promise(done => server.listen(0, '127.0.0.1', done));
const localOrigin = `http://127.0.0.1:${server.address().port}`;
const origin = process.env.NEXT_QA_ORIGIN || localOrigin;
if (process.env.NEXT_QA_ORIGIN) assert.match(origin, /^http:\/\/127\.0\.0\.1:[0-9]+$/);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { syntheticData: true, realMapLibre: true, rendering: 'synthetic-software-webgl', assetsServedByNext: Boolean(process.env.NEXT_QA_ORIGIN), productionTested: false, views: 0, checks: 0, errors: [] };
const check = (condition, message) => { report.checks++; assert.ok(condition, message); };
try {
  for (const width of [375, 1280]) for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    page.on('pageerror', error => report.errors.push(error.message));
    const forbidden = [];
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) { forbidden.push(url.href); return route.abort(); }
      // With NEXT_QA_ORIGIN, only the explicitly synthetic document/script are
      // fulfilled. Worker and shared-module bytes must be served by real Next.
      if (process.env.NEXT_QA_ORIGIN && ['/', '/map.js', '/favicon.ico'].includes(url.pathname)) {
        if (url.pathname === '/favicon.ico') return route.fulfill({ status: 204 });
        const response = await fetch(localOrigin + url.pathname + url.search);
        return route.fulfill({ status: response.status, contentType: response.headers.get('content-type'), body: Buffer.from(await response.arrayBuffer()) });
      }
      return route.continue();
    });
    await page.goto(`${origin}/?theme=${theme}`);
    await page.waitForFunction(() => window.__qaMapReady === true, null, {timeout:10000}).catch(async () => { throw Error(JSON.stringify(await page.evaluate(() => ({ready:window.__qaMapReady,errors:window.__qaMapErrors,loaded:window.__qaMap?.loaded(),style:window.__qaMap?.isStyleLoaded()})))); });
    await page.waitForFunction(() => window.__qaMap.loaded(),null,{timeout:10000}).catch(async()=>{throw Error(JSON.stringify(await page.evaluate(()=>({errors:window.__qaMapErrors,loaded:window.__qaMap.loaded(),style:window.__qaMap.isStyleLoaded(),source:window.__qaMap.isSourceLoaded('qa'),worker:window.__qaMap.getStyle().sources}))))});
    check(await page.evaluate(() => window.__qaUnsafe === 0), 'attribution sanitizer must not execute a skipped attribute');
    check(await page.locator('.maplibregl-ctrl-attrib-inner [onload], .maplibregl-ctrl-attrib-inner [ontoggle]').count() === 0, 'dangerous adjacent attributes removed');
    check(await page.evaluate(() => Boolean(window.__qaMap.getLayer('qa-heat') && window.__qaMap.getLayer('qa-circle'))), 'heat and circle layers load');
    check((await page.locator('.maplibregl-popup-content').innerText()).includes('Synthetic <literal> reading') && await page.locator('.maplibregl-popup-content literal').count() === 0, 'popup preserves safe literal text');
    await page.evaluate(() => { window.__qaMap.jumpTo({ zoom: 4 }); window.__qaMap.resize(); });
    check(await page.evaluate(() => window.__qaMap.getZoom() === 4), 'zoom and resize API remain available');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'map stays inside viewport');
    check(forbidden.length === 0, 'map QA requests no tiles, providers or business data');
    await page.screenshot({ path: join(output, `map-${width}-${theme}.png`) });
    report.views++; await page.close();
  }
  check(report.errors.length === 0, JSON.stringify(report.errors));
  console.log(JSON.stringify({ status: 'passed', ...report }));
} finally {
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close(); await new Promise(done => server.close(done));
}
