from pathlib import Path
import json,subprocess
root=Path.cwd();base='150610df4ecb973f713d27cf768d8125fed9c111';runtime=root/'.paired-runtime'
subprocess.run(['git','merge-base','--is-ancestor',base,'HEAD'],check=True)
assert not subprocess.check_output(['git','diff',base,'--','apps','packages','package.json','package-lock.json']).strip()
assert subprocess.check_output(['git','-C',str(runtime),'rev-parse','HEAD']).decode().strip()=='85223567b33ee675d9aa64bb43f325f71af996d3'
changed=[]
def write(name,text):
 p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text,encoding='utf-8',newline='\n');changed.append(name)
def replace(s,a,b):
 assert s.count(a)==1,a[:100]
 return s.replace(a,b)
# Dependency versions were already validated by PR389. Do not transplant its application source or scripts.
for name in subprocess.check_output(['git','ls-files','package.json','apps/*/package.json','packages/*/package.json']).decode().splitlines():
 old=json.loads((root/name).read_text(encoding='utf-8'));approved=json.loads((runtime/name).read_text(encoding='utf-8'));before=json.dumps(old,sort_keys=True)
 for field in ['dependencies','devDependencies','optionalDependencies','overrides']:
  if field in approved:old[field]=approved[field]
  else:old.pop(field,None)
 if name=='apps/web/package.json':old['scripts']['test']='node --import tsx --test tests/*.test.mjs'
 if json.dumps(old,sort_keys=True)!=before:write(name,json.dumps(old,ensure_ascii=False,indent=2)+'\n')
write('package-lock.json',(runtime/'package-lock.json').read_text(encoding='utf-8'))
write('apps/web/src/app/sun/sun-snapshot-read.ts','''/** Read-only bounded handoff: failure never retries a dynamic NFC scan. */
export async function readSunSnapshot(url:string,fetcher:typeof fetch=fetch,timeoutMs=8000):Promise<Record<string,unknown>|null>{
 if(!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>8000)return null;
 const controller=new AbortController();let reader:ReadableStreamDefaultReader<Uint8Array>|undefined,timer:ReturnType<typeof setTimeout>|undefined;
 const deadline=new Promise<null>(resolve=>{timer=setTimeout(()=>{controller.abort();void reader?.cancel().catch(()=>{});resolve(null);},timeoutMs);});
 async function read(){
  const response=await fetcher(url,{method:'GET',cache:'no-store',redirect:'error',signal:controller.signal});
  if(controller.signal.aborted||!response.ok||response.redirected||!response.headers.get('content-type')?.includes('application/json')||Number(response.headers.get('content-length'))>1048576||!response.body){void response.body?.cancel().catch(()=>{});return null;}
  reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  for(;;){const part=await reader.read();if(controller.signal.aborted)return null;if(part.done)break;size+=part.value.byteLength;if(size>1048576)return null;chunks.push(part.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  return body?.ok===true&&body.contract&&typeof body.contract==='object'&&!Array.isArray(body.contract)?body.contract as Record<string,unknown>:null;
 }
 try{return await Promise.race([read(),deadline]);}catch{return null;}
 finally{clearTimeout(timer);controller.abort();void reader?.cancel().catch(()=>{});try{reader?.releaseLock();}catch{}}
}
''')
p='apps/web/src/app/sun/page.tsx';s=(root/p).read_text(encoding='utf-8')
s=replace(s,'import { SunProductHeroStage, type SunVisualKind }','import type { SunVisualKind }')
s="import {readSunSnapshot} from './sun-snapshot-read';\n"+s
start=s.index('    snapshotResult = snapshotId && snapshotTrace && snapshotAccess');end=s.index('    const hasCompleteDynamicSunPayload',start)
s=s[:start]+'''    const hasSnapshotReference = Boolean(snapshotId || snapshotTrace || snapshotAccess);
    snapshotResult = snapshotId && snapshotTrace && snapshotAccess
      ? await readSunSnapshot(`${resolvedApiBase}/sun/snapshot/${encodeURIComponent(snapshotId)}?trace=${encodeURIComponent(snapshotTrace)}&access=${encodeURIComponent(snapshotAccess)}${freshToken ? `&fresh=${encodeURIComponent(freshToken)}` : ""}`) as SunContract | null
      : null;
'''+s[end:]
s=replace(s,'if (!snapshotResult && hasCompleteDynamicSunPayload)','if (!hasSnapshotReference && !snapshotResult && hasCompleteDynamicSunPayload)')
s=replace(s,'const response = snapshotResult ? null : await fetch(','const response = snapshotResult || hasSnapshotReference ? null : await fetch(')
a=s.index('                    <SunProductHeroStage');b=s.index('                    />',a)+len('                    />')
s=s[:a]+'''                    <div data-testid="sun-product-placeholder" className="grid h-full w-full place-items-center text-cyan-300">
                      <Package className="h-12 w-12" aria-hidden="true"/><span className="sr-only">Imagen no informada</span>
                    </div>'''+s[b:]
s=replace(s,'loading="eager"\n                    fetchPriority="high"','loading="eager"\n                    decoding="async"\n                    fetchPriority="high"')
write(p,s)
p='apps/web/src/app/sun/sun-passport-experience.module.css';s=(root/p).read_text(encoding='utf-8')
for old,new in [('from { opacity: 0; transform: translateY(8px); }','from { opacity: 1; transform: translateY(2px); }'),('from { opacity: 0; transform: translateY(5px) scale(0.96); }','from { opacity: 1; transform: translateY(2px) scale(0.99); }'),('from { opacity: 0; transform: scale(0.88); }','from { opacity: 1; transform: scale(0.98); }'),('productArrival 560ms','productArrival 180ms'),('photoArrival 700ms','photoArrival 180ms'),('resultArrival 500ms cubic-bezier(0.2, 0.8, 0.2, 1) 120ms','resultArrival 180ms cubic-bezier(0.2, 0.8, 0.2, 1) 0ms')]:s=replace(s,old,new)
write(p,s)
p='apps/web/src/app/sun/sun-locale-provider.tsx';s=(root/p).read_text(encoding='utf-8')
s=replace(s,'function localizeTree(root: HTMLElement, locale: SunLocale) {',"function localizeTree(root: HTMLElement, locale: SunLocale) {\n  if (root.closest(\"[data-sun-server-evidence='true']\")) return;\n  const nodes = (selector: string) => [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll<HTMLElement>(selector)];")
s=replace(s,'root.querySelectorAll<HTMLElement>("[data-sun-datetime]")','nodes("[data-sun-datetime]")')
s=replace(s,'root.querySelectorAll<HTMLElement>("[aria-label], [placeholder], [title]")','nodes("[aria-label], [placeholder], [title]")')
a=s.index('    const observer = new MutationObserver(() => {');b=s.index('\n  }, [applyLocale, locale]);',a)
s=s[:a]+'''    // Only mutated subtrees need translation; consent/map updates must not traverse the whole passport.
    const observer = new MutationObserver((records) => {
      if (translatingRef.current) return;
      const roots = new Set<HTMLElement>();
      for (const record of records) {
        const changed = record.type === "characterData" ? [record.target] : [...record.addedNodes];
        for (const node of changed) {
          const element = node instanceof HTMLElement ? node : node.parentElement;
          if (!element || !root.contains(element) || element.closest("[data-sun-server-evidence='true']")) continue;
          roots.add(element);
        }
      }
      if (!roots.size) return;
      observer.disconnect();
      try { for (const element of roots) if (![...roots].some(parent => parent !== element && parent.contains(element))) localizeTree(element, locale); }
      finally { observer.observe(root, { childList: true, subtree: true, characterData: true }); }
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();'''+s[b:]
write(p,s)
write('apps/web/src/app/sun/loading.tsx',"import { getWebI18n } from '../../lib/locale';\nimport { SunLoadingView } from './sun-loading-view';\nexport default async function SunLoading(){const {locale}=await getWebI18n();return <SunLoadingView locale={locale}/>;}\n")
write('apps/web/src/app/sun/sun-loading-view.tsx','''import styles from './sun-loading.module.css';
const copy={
 'es-AR':['Abriendo el pasaporte','Estamos recuperando la información de esta lectura.','La autenticidad se mostrará sólo cuando responda la validación.','La ubicación es opcional. Podrás compartirla cuando aparezca el pasaporte.'],
 en:['Opening the passport','Retrieving the information for this reading.','Authenticity will be shown only after validation responds.','Location is optional. You can share it when the passport appears.'],
 'pt-BR':['Abrindo o passaporte','Recuperando as informações desta leitura.','A autenticidade será mostrada somente após a resposta da validação.','A localização é opcional. Você poderá compartilhá-la quando o passaporte aparecer.']
};
export function SunLoadingView({locale='es-AR'}:{locale?:string}){
 const text=copy[locale as keyof typeof copy]||copy['es-AR'];
 return <main className={styles.root} data-testid="sun-loading" aria-busy="true"><div className={styles.card}>
 <span className={styles.brand}>nexID <span>PRODUCT PASSPORT</span></span>
 <div className={styles.preview} aria-hidden="true"><div className={styles.tag}>N</div><div><i/><i/><i/></div></div>
 <h1>{text[0]}</h1><p role="status">{text[1]}</p><div className={styles.progress} aria-hidden="true"><span/></div>
 <p className={styles.note}>{text[2]}</p><p className={styles.location}>{text[3]}</p></div></main>;
}
''')
write('apps/web/src/app/sun/sun-loading.module.css','''.root{min-height:100svh;padding:24px 16px;background:#07111c;color:#eaf6ff;font-family:ui-sans-serif,system-ui,sans-serif;display:grid;align-content:start;justify-items:center;box-sizing:border-box}
.card{box-sizing:border-box;margin-top:4vh;width:min(100%,460px);padding:24px;border:1px solid #234254;border-radius:24px;background:#0d1b29;box-shadow:0 18px 60px #0002;overflow-wrap:anywhere}.brand{display:flex;gap:12px;align-items:center;font-size:24px;font-weight:800;letter-spacing:-.04em}.brand>span{border-left:1px solid #315466;padding-left:12px;font-size:10px;letter-spacing:.12em;color:#8adcd4}
.preview{display:grid;grid-template-columns:72px 1fr;gap:18px;align-items:center;margin:32px 0 24px}.tag{height:88px;border-radius:15px;border:1px solid #315466;background:#122f3d;display:grid;place-items:center;font-size:32px;font-weight:900;color:#88cfc6}.preview i{display:block;height:10px;border-radius:8px;background:#213e50;margin:12px 0}.preview i:nth-child(2){width:85%}.preview i:nth-child(3){width:55%}
.card h1{margin:0 0 8px;font-size:24px;line-height:1.25;letter-spacing:-.035em}.card p{margin:8px 0;font-size:14px;line-height:1.7;color:#c1d4e1}.progress{height:3px;overflow:hidden;border-radius:5px;background:#254150;margin:24px 0}.progress>span{display:block;height:100%;width:32%;background:#6cdbc4;animation:waiting 1.8s ease-in-out infinite}.card .note{font-size:12px;color:#adbfcb}.card .location{margin-top:20px;border-top:1px solid #29414f;padding-top:16px;font-size:12px;color:#a8c8d2}
:global(html[data-theme=light]) .root{background:#eef5f7;color:#122c3b}:global(html[data-theme=light]) .card{background:#fff;border-color:#cedee5}:global(html[data-theme=light]) .card p{color:#355263}:global(html[data-theme=light]) .brand>span{color:#116455}:global(html[data-theme=light]) .tag{background:#e0f3ef;color:#166e5b;border-color:#b6dcd4}:global(html[data-theme=light]) .preview i{background:#dde9ee}:global(html[data-theme=light]) .progress{background:#d8e8ec}:global(html[data-theme=light]) .location{border-color:#dae6eb}
@keyframes waiting{0%{transform:translateX(-100%)}100%{transform:translateX(415%)}}@media(prefers-reduced-motion:reduce){.progress>span{animation:none;width:100%;opacity:.55}}@media(max-width:350px){.card{padding:20px}.card h1{font-size:22px}.brand{font-size:22px}.brand>span{font-size:9px}}
''')
p='apps/web/tests/sun-hero-truth-copy.test.mjs';s=(root/p).read_text(encoding='utf-8')
s=replace(s,'  assert.match(page, /<SunProductHeroStage/);','  assert.doesNotMatch(page, /<SunProductHeroStage/);\n  assert.match(page, /sun-product-placeholder/);')
s=replace(s,'  assert.match(page, /originLat=\\{wineryPoint\\[0\\]\\?\\.lat\\}/);','  assert.match(page, /<SunLocationExperience/);')
s=replace(s,'  assert.match(page, /tapLat=\\{currentTapPoint\\[0\\]\\?\\.lat\\}/);','  assert.match(page, /Imagen no informada/);')
write(p,s)
p='apps/web/tests/demo-heatmap-surfaces.test.mjs';s=(root/p).read_text(encoding='utf-8');s=replace(s,'assert.equal(webPackage.dependencies["maplibre-gl"], "^5.24.0");','assert.equal(webPackage.dependencies["maplibre-gl"], "6.4.1");');write(p,s)
write('apps/web/tests/sun-snapshot-performance.test.mjs','''import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {readSunSnapshot} from '../src/app/sun/sun-snapshot-read.ts';
const url='https://api.example.invalid/sun/snapshot/1?trace=synthetic&access=synthetic';
test('snapshot read is once, no-store and does not follow redirects',async()=>{let calls=0;const contract={status:{code:'INVALID'}};assert.deepEqual(await readSunSnapshot(url,async(path,options)=>{calls++;assert.equal(path,url);assert.equal(options.method,'GET');assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');return Response.json({ok:true,contract});}),contract);assert.equal(calls,1);});
for(const status of [400,401,403,404,429,503])test('snapshot '+status+' cancels a stalled body without retry',async()=>{let calls=0,cancelled=false;const stream=new ReadableStream({cancel(){cancelled=true;}});assert.equal(await readSunSnapshot(url,async()=>{calls++;return new Response(stream,{status});}),null);assert.equal(calls,1);assert.equal(cancelled,true);});
for(const phase of ['headers','body'])test('deadline bounds noncooperative '+phase,async()=>{let cancelled=false;const body=new ReadableStream({cancel(){cancelled=true;}});const started=performance.now();assert.equal(await readSunSnapshot(url,async()=>phase==='headers'?new Promise(()=>{}):new Response(body,{headers:{'content-type':'application/json'}}),20),null);assert.ok(performance.now()-started<1000);if(phase==='body')assert.equal(cancelled,true);});
for(const body of [{ok:false,contract:{}},{ok:true,contract:[]},{ok:true},{ok:true,contract:'wrong'}])test('invalid envelope is not evidence '+JSON.stringify(body),async()=>assert.equal(await readSunSnapshot(url,async()=>Response.json(body)),null));
test('oversized streamed response is cancelled',async()=>{let cancelled=false;const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(1048577));},cancel(){cancelled=true;}});assert.equal(await readSunSnapshot(url,async()=>new Response(stream,{headers:{'content-type':'application/json'}})),null);assert.equal(cancelled,true);});
test('late response cannot restore a timed-out snapshot',async()=>{let release,cancelled=false;const pending=new Promise(r=>release=r);assert.equal(await readSunSnapshot(url,async()=>pending,10),null);release(new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}}));await new Promise(r=>setImmediate(r));assert.equal(cancelled,true);});
test('snapshot failure cannot reconsume the physical scan',async()=>{const page=await readFile(new URL('../src/app/sun/page.tsx',import.meta.url),'utf8');assert.ok(page.includes('!hasSnapshotReference && !snapshotResult && hasCompleteDynamicSunPayload'));assert.ok(page.includes('snapshotResult || hasSnapshotReference ? null : await fetch'));assert.ok(!page.includes('<SunProductHeroStage'));assert.ok(page.includes('sun-product-placeholder'));});
test('summary animation never hides content already received',async()=>{const css=await readFile(new URL('../src/app/sun/sun-passport-experience.module.css',import.meta.url),'utf8');for(const name of ['productArrival','photoArrival','resultArrival']){const rule=css.slice(css.indexOf('@keyframes '+name)).split('}')[0];assert.ok(!rule.includes('opacity: 0'));}});
''')
write('docs/2026-09-30-sun-first-paint.md','''# SUN mobile: first content and location readiness

The public web keeps its own production lineage. A Next loading boundary shows a neutral branded placeholder while the signed snapshot resolves; it does not claim authenticity or invent product data. The snapshot read is bounded through headers/body and never retries the dynamic scan when a signed handoff fails.

The summary no longer starts invisible during 560/700ms animations. Its small missing-photo fallback no longer loads 3D/globe components; an honest neutral product icon appears instead. Real product images retain eager/high-priority loading and now decode asynchronously. The existing map remains available with its existing viewport-triggered loading.

Localizing small UI updates now visits changed subtrees, not the complete passport on every geolocation/map mutation. Server evidence is excluded and the observer is disconnected for its own mutations. The original locale preference contract remains.

Location permission remains optional, explicit and bound to the same tap. No automatic request, stale fix, weaker measurement, changed coordinate rounding or added telemetry is introduced. Location is not a prerequisite to viewing the passport.

Dependencies were aligned to the set already validated in PR389, without transplanting API/dashboard code. The web branch predates those security fixes. The two tests referencing the previous hero or MapLibre version now assert the intended lightweight fallback and approved version while retaining the truth/map checks.

The changes were initially prepared and tested locally. On remote-device disconnection they were reconstructed in a dedicated GitHub feature-branch job, whose one-off preparation files are removed from its final tree. CI validates the final source before integration. No physical-phone latency or production performance percentage is claimed by these synthetic tests. No production DB, NFC secrets, customer records or feature flags are changed.
''')
subprocess.run(['git','diff','--check'],check=True)
(root/'sun-prepared-paths.txt').write_text('\n'.join(changed)+'\n',encoding='utf-8')
print('Prepared source-bound public SUN changes; no production requests made.')
