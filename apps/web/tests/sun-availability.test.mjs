import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSunEntry} from '../src/app/sun/sun-availability.ts';
import {readSunSnapshotResult, readSunPublicContract} from '../src/app/sun/sun-snapshot-read.ts';
import {resolveSunConsumerStatus} from '../src/app/sun/sun-consumer-status.ts';
import {translateSunUiText} from '../src/app/sun/sun-locale.ts';

const entry={isQrScan:false,demoRequested:false,snapshotId:'',snapshotTrace:'',snapshotAccess:'',freshToken:'',dynamic:['','','','','']};
const flags={isDemoPreview:false,isQrScan:false,isTechnicallyAuthentic:false,isVerifiedClosedState:false,isVerifiedOpenedState:false,isInvalidSealState:false,isTamperRisk:false,isReplay:false,isSunProfileMismatch:false,isSnapshotView:false};
const url='https://api.example.invalid/sun/snapshot/qa?trace=synthetic&access=invalid';

test('empty entry and explicit demo are separate; QR stays public',()=>{
  assert.equal(resolveSunEntry(entry),'empty');
  assert.equal(resolveSunEntry({...entry,demoRequested:true}),'demo');
  assert.equal(resolveSunEntry({...entry,isQrScan:true}),'qr');
});

for(const key of ['snapshotId','snapshotTrace','snapshotAccess','freshToken'])test('partial '+key+' cannot become a demo or dynamic scan',()=>{
  for(const demoRequested of [true,false])assert.equal(resolveSunEntry({...entry,[key]:'synthetic',demoRequested,dynamic:['','bid','picc','enc','cmac']}),'incomplete');
});

test('empty markers also remain incomplete rather than creating evidence',()=>{
  assert.equal(resolveSunEntry({...entry,demoRequested:true,hasSnapshotMarker:true}),'incomplete');
  assert.equal(resolveSunEntry({...entry,demoRequested:true,hasDynamicMarker:true}),'incomplete');
  assert.equal(resolveSunEntry({...entry,dynamic:['v1','','','','']}),'incomplete');
  assert.equal(resolveSunEntry({...entry,dynamic:['','bid','','','']}),'incomplete');
});

test('only all four dynamic fields enter browser-first validation; snapshots win over them',()=>{
  const dynamic=['','bid','picc','enc','cmac'];
  assert.equal(resolveSunEntry({...entry,dynamic}),'dynamic');
  assert.equal(resolveSunEntry({...entry,dynamic,snapshotId:'qa',snapshotTrace:'synthetic',snapshotAccess:'invalid'}),'snapshot');
});

for(const code of [400,401,403,404])test('HTTP '+code+' is a neutral inaccessible view, never a reason guess',async()=>{
  let requests=0,cancelled=false;
  const body=new ReadableStream({cancel(){cancelled=true;}});
  const outcome=await readSunSnapshotResult(url,async()=>{requests++;return new Response(body,{status:code});});
  assert.deepEqual(outcome,{availability:'inaccessible',contract:null});
  assert.equal(requests,1);assert.equal(cancelled,true);
  const status=resolveSunConsumerStatus({...flags,availability:outcome.availability});
  assert.equal(status.tone,'info');assert.equal(status.headline,'No podemos abrir esta consulta');
  assert.doesNotMatch(status.label+' '+status.headline+' '+status.copy,/vencid|expir|no existe|replay|falsific|lectura sospechosa/i);
});

for(const code of [429,500,502,503])test('HTTP '+code+' does not become a rejected NFC result',async()=>{
  const outcome=await readSunSnapshotResult(url,async()=>Response.json({ok:false},{status:code}));
  assert.deepEqual(outcome,{availability:'unavailable',contract:null});
  const status=resolveSunConsumerStatus({...flags,availability:outcome.availability});
  assert.equal(status.tone,'info');assert.equal(status.sealLabel,'No informado');assert.equal(status.identityLabel,'No confirmada');
  assert.match(status.copy,/no indica una lectura NFC rechazada/i);
});

for(const phase of ['headers','body'])test('entire read deadline bounds noncooperative '+phase+' without retry',async()=>{
  let calls=0,signal,cancelled=false;
  const stream=new ReadableStream({cancel(){cancelled=true;}});
  const started=performance.now();
  const outcome=await readSunSnapshotResult(url,async(_,options)=>{calls++;signal=options.signal;return phase==='headers'?new Promise(()=>{}):new Response(stream,{headers:{'content-type':'application/json'}});},20);
  assert.deepEqual(outcome,{availability:'unavailable',contract:null});assert.equal(calls,1);assert.equal(signal.aborted,true);assert.ok(performance.now()-started<1000);
  if(phase==='body')assert.equal(cancelled,true);
});

test('a malformed or empty contract is unavailable, never implicit identity failure',async()=>{
  for(const body of [{ok:true,contract:{}},{ok:true,contract:{status:{}}},{ok:true,contract:{status:{code:''}}}])assert.equal((await readSunSnapshotResult(url,async()=>Response.json(body))).availability,'unavailable');
  assert.equal((await readSunSnapshotResult(url,async()=>new Response('{broken',{headers:{'content-type':'application/json'}}))).availability,'unavailable');
});

test('a delivered failed-identity contract stays a real result and retains its risk',async()=>{
  const contract={ok:false,status:{code:'INVALID',tone:'risk'}};
  const outcome=await readSunSnapshotResult(url,async()=>Response.json({ok:true,contract}));
  assert.deepEqual(outcome,{availability:'ready',contract});
  assert.equal(resolveSunConsumerStatus({...flags,availability:outcome.availability}).tone,'risk');
});

test('QR public read is bounded too and forwards headers without consuming a dynamic scan',async()=>{
  let calls=0;
  const headers=new Headers({'accept':'application/json'});
  const outcome=await readSunPublicContract(url,headers,async(_,options)=>{calls++;assert.equal(options.headers,headers);assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');return Response.json({ok:true,status:{code:'QR_PUBLIC'}});});
  assert.equal(outcome.availability,'ready');assert.equal(calls,1);
  assert.equal((await readSunPublicContract(url,headers,async()=>new Promise(()=>{}),10)).availability,'unavailable');
});

test('all absence states translate completely and never manufacture NFC identity or seal',()=>{
  for(const availability of ['empty','incomplete','inaccessible','unavailable'])for(const locale of ['en','pt-BR']){
    const es=resolveSunConsumerStatus({...flags,availability});
    const localized=resolveSunConsumerStatus({...flags,availability},value=>translateSunUiText(value,locale));
    for(const field of ['label','headline','copy','identityLabel','sealLabel'])assert.notEqual(localized[field],es[field],availability+' '+locale+' '+field);
    assert.equal(localized.tone,'info');
  }
});
