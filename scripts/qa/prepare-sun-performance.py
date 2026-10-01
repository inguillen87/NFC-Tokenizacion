from pathlib import Path
import subprocess
root=Path.cwd()
base='cda3676becd4e54162bf2e44444a55a63ab1ba90'
subprocess.run(['git','merge-base','--is-ancestor',base,'HEAD'],check=True)
assert not subprocess.check_output(['git','diff',base,'--','apps/api/src','apps/api/tests','package.json','package-lock.json']).strip()
changed=[]
def write(name,text):
 p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text,encoding='utf-8',newline='\n');changed.append(name)
def replace(text,old,new):
 assert text.count(old)==1,old[:120]
 return text.replace(old,new)
write('apps/api/src/lib/sun-presentation-read.ts','''/** Independent presentation reads only, after the canonical validation. */
export async function readSunPresentation<P,T,S>(tasks:{passport:()=>Promise<P|null>;fallback:()=>Promise<P|null>;timeline:()=>Promise<T>;sensors:(passport:P|null)=>Promise<S>;actions:()=>Promise<boolean>}) {
 const passport=Promise.resolve().then(tasks.passport).then(value=>value??tasks.fallback());
 const timeline=Promise.resolve().then(tasks.timeline),actions=Promise.resolve().then(tasks.actions);
 const sensors=passport.then(tasks.sensors);
 const [p,t,s,a]=await Promise.all([passport,timeline,sensors,actions]);
 return {passport:p,timeline:t,sdkSensorTimeline:s,hasTokenizeRequest:a};
}
/** Fixed aggregate names; never put identifiers, URLs or locations into timing headers. */
export async function timedSunResponse(name:'sun_total'|'sun_snapshot',run:()=>Promise<Response>):Promise<Response>{
 const started=performance.now(),response=await run(),headers=new Headers(response.headers);
 headers.set('server-timing',`${name};dur=${Math.max(0,performance.now()-started).toFixed(1)}`);
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
''')
write('apps/api/src/lib/sun-post-response.ts','''export type SunAfterResponse=(task:()=>Promise<void>)=>void;
/** The server supplies a supported lifecycle hook. Persistence is never deferred. */
export async function runSunProjection(task:()=>Promise<void>,schedule?:SunAfterResponse):Promise<void>{
 if(schedule){try{schedule(task);return;}catch{/* Keep original behavior outside a supported request context. */}}
 await task();
}
''')
p='apps/api/src/app/sun/route.ts';s=(root/p).read_text(encoding='utf-8')
s="import {after} from 'next/server';\nimport {readSunPresentation,timedSunResponse} from '../../lib/sun-presentation-read';\n"+s
start=s.index('  const tagPassport = await withTimeout(getPassportSnapshot');end=s.index('  const contract = buildPublicContract',start)
s=s[:start]+'''  const {passport,timeline,sdkSensorTimeline,hasTokenizeRequest}=await readSunPresentation({
    passport:()=>withTimeout(getPassportSnapshot(bid,uid||undefined),2500,"sun_passport_snapshot").catch(()=>null),
    fallback:()=>withTimeout(getBatchSunContext(bid),2500,"sun_batch_context").catch(()=>null),
    timeline:()=>withTimeout(getTimelineSummary(bid,uid||undefined),2500,"sun_timeline_summary").catch(()=>[] as TimelineEvent[]),
    sensors:(passport)=>withTimeout(getSdkSensorTimelineSummary({tenantId:passport?.tenant_id,bid,uid}),2500,"sun_sdk_sensor_timeline").catch(()=>[] as TimelineEvent[]),
    actions:()=>uid?withTimeout(listDemoCta(bid, uid),2500,"sun_cta_status").then(actions=>actions.some((item) => String(item.action || "") === "tokenize_request")).catch(()=>false):Promise.resolve(false),
  });
'''+s[end:]
s=replace(s,'export async function GET(req: Request): Promise<Response> {','export async function GET(req: Request): Promise<Response> {\n return timedSunResponse("sun_total",()=>handleSunRequest(req));\n}\nasync function handleSunRequest(req: Request): Promise<Response> {')
s=replace(s,'  const sunScanInput = {\n    bid,','  const sunScanInput = {\n    afterResponse: after,\n    bid,')
s=replace(s,'      country: geoCountry,\n    }).catch(() => false);','      country: geoCountry,\n    }, undefined, after).catch(() => false);')
write(p,s)
p='apps/api/src/app/sun/snapshot/[diagnosticId]/route.ts';s=(root/p).read_text(encoding='utf-8')
s="import {timedSunResponse} from '../../../../lib/sun-presentation-read';\n"+s
s=replace(s,'export async function GET(req: Request, { params }: { params: Promise<{ diagnosticId: string }> }) {','export async function GET(req: Request, context: { params: Promise<{ diagnosticId: string }> }) {\n return timedSunResponse("sun_snapshot",()=>readSnapshot(req,context));\n}\nasync function readSnapshot(req: Request, { params }: { params: Promise<{ diagnosticId: string }> }) {')
write(p,s)
p='apps/api/src/lib/sun-diagnostics.ts';s=(root/p).read_text(encoding='utf-8')
s=replace(s,'const [currentIdentity, currentTap, currentEditorial] = await Promise.all([','const [currentIdentity, currentTap, currentEditorial, supportReport] = await Promise.all([')
s=replace(s,'    readCurrentPassportEditorial(currentTapEventId),','    readCurrentPassportEditorial(currentTapEventId),\n    createSupportReportCapability(currentTapEventId),')
s=replace(s,'publicContract.supportReport = await createSupportReportCapability(currentTapEventId);','publicContract.supportReport = supportReport;')
write(p,s)
p='apps/api/src/lib/sun-service.ts';s=(root/p).read_text(encoding='utf-8')
s="import {runSunProjection,type SunAfterResponse} from './sun-post-response';\n"+s
s=replace(s,'  sideEffectMode?: SunScanSideEffectMode;','  sideEffectMode?: SunScanSideEffectMode;\n  /** Optional request-lifecycle callback, supplied exclusively by server code. */\n  afterResponse?: SunAfterResponse;')
a=s.index('    try {\n      const projection = await publishTenantTapRealtimeProjection(');b=s.index('    void evaluateSecurityAlerts(',a)
s=s[:a]+'    await runSunProjection(async()=>{\n'+s[a:b]+'    },input.afterResponse);\n'+s[b:]
write(p,s)
p='apps/api/src/lib/sun-request-location-realtime.ts';s=(root/p).read_text(encoding='utf-8')
s="import {runSunProjection,type SunAfterResponse} from './sun-post-response';\n"+s
s=replace(s,'  services: LocationRealtimeDependencies = dependencies,','  services: LocationRealtimeDependencies = dependencies,\n  afterResponse?: SunAfterResponse,')
s=replace(s,'  try {\n    const publication','  await runSunProjection(async()=>{\n  try {\n    const publication')
s=replace(s,'  return true;','  },afterResponse);\n  return true;');write(p,s)
write('apps/api/tests/sun-presentation-performance.test.mjs','''import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {readSunPresentation,timedSunResponse} from '../src/lib/sun-presentation-read.ts';import {runSunProjection} from '../src/lib/sun-post-response.ts';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
test('independent reads start together; sensor lookup waits for server-derived scope',async()=>{const p=deferred(),t=deferred(),a=deferred(),calls=[];const result=readSunPresentation({passport:()=>{calls.push('passport');return p.promise;},fallback:async()=>{throw Error('unexpected');},timeline:()=>{calls.push('timeline');return t.promise;},sensors:async value=>{assert.equal(value.tenant_id,'resolved');calls.push('sensors');return ['sensor'];},actions:()=>{calls.push('actions');return a.promise;}});await new Promise(r=>setImmediate(r));assert.deepEqual(calls,['passport','timeline','actions']);p.resolve({tenant_id:'resolved'});t.resolve(['event']);a.resolve(true);assert.deepEqual(await result,{passport:{tenant_id:'resolved'},timeline:['event'],sdkSensorTimeline:['sensor'],hasTokenizeRequest:true});});
test('fallback preserves its scope and is called only for an absent primary',async()=>{let n=0;const result=await readSunPresentation({passport:async()=>null,fallback:async()=>{n++;return{tenant_id:'fallback'};},timeline:async()=>[],sensors:async p=>{assert.equal(p.tenant_id,'fallback');return[];},actions:async()=>false});assert.equal(n,1);assert.equal(result.passport.tenant_id,'fallback');});
test('required read failure is not converted into invented evidence',async()=>assert.rejects(readSunPresentation({passport:async()=>{throw Error('failure');},fallback:async()=>null,timeline:async()=>[],sensors:async()=>[],actions:async()=>false}),/failure/));
test('scheduled projection does not delay the response and runs once when drained',async()=>{const tasks=[];let calls=0;await runSunProjection(async()=>{calls++;},task=>tasks.push(task));assert.equal(calls,0);assert.equal(tasks.length,1);await tasks[0]();assert.equal(calls,1);});
test('caller without a lifecycle retains awaited publication',async()=>{const p=deferred();let finished=false;const result=runSunProjection(()=>p.promise).then(()=>finished=true);await Promise.resolve();assert.equal(finished,false);p.resolve();await result;assert.equal(finished,true);});
test('unavailable platform context falls back instead of dropping a projection',async()=>{let calls=0;await runSunProjection(async()=>{calls++;},()=>{throw Error('no context');});assert.equal(calls,1);});
for(const status of [200,303,404,503])test('timing preserves response semantics '+status,async()=>{const r=await timedSunResponse('sun_total',async()=>new Response('body',{status,headers:{'cache-control':'no-store',location:'https://example.invalid/passport','x-robots-tag':'noindex, nofollow'}}));assert.equal(r.status,status);assert.equal(await r.text(),'body');assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('location'),'https://example.invalid/passport');assert.match(r.headers.get('server-timing'),/^sun_total;dur=[0-9]+[.][0-9]$/);});
test('durable atomic receipt precedes projection and request input never controls scheduling',async()=>{const service=await readFile(new URL('../src/lib/sun-service.ts',import.meta.url),'utf8'),route=await readFile(new URL('../src/app/sun/route.ts',import.meta.url),'utf8');assert.ok(service.indexOf('await persistSunScanAtomically(')<service.indexOf('await runSunProjection('));assert.match(route,/afterResponse: after/);assert.ok(route.indexOf('await withTimeout(processSunScan(')<route.indexOf('await readSunPresentation(')||route.includes('=await readSunPresentation('));});
''')
write('docs/2026-09-30-sun-critical-path.md','''# SUN: critical-path latency reduction

The canonical NFC validation, rate limits, anti-replay transaction, location persistence and diagnostic snapshot stay awaited. Only the best-effort realtime publication uses Next after(response); non-route callers retain the original awaited behavior. This is not fire-and-forget work outside the platform lifecycle.

Independent post-validation timeline/action reads now overlap the passport read. Sensor scope still waits for the server-resolved passport/tenant. The original 2.5-second presentation deadlines and fallbacks remain. Snapshot support metadata loads concurrently with the other current projections. No cache of a valid verdict, skipped validation, new retry, migration or authorization is introduced.

Server-Timing exposes only fixed sun_total/sun_snapshot duration names, with no URL, token, identifier or coordinate. This provides a basis for measuring the deployed route, not a claim about a physical phone measurement.

Eleven focused tests cover dependency ordering, fallback, projection lifecycle and response semantics. Existing SUN and enterprise regressions remain mandatory. Local results before remote disconnection: 11 focused tests approved; 190/191 SUN tests approved with the remaining static formatting assertion corrected in this candidate. Final CI results must be verified before integration.

This patch was first prepared in an isolated Windows worktree. After the remote device stopped responding, the exact narrow changes were reconstructed through an isolated GitHub preparation job. The job deletes its one-off preparation files from the resulting source tree. No production deployment or feature flag change is performed by that job.
''')
subprocess.run(['git','diff','--check'],check=True)
(root/'sun-prepared-paths.txt').write_text('\n'.join(changed)+'\n',encoding='utf-8')
print('Prepared only the allowlisted SUN files; no production endpoints or database were contacted.')
