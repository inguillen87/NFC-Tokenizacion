import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { createSupportReportCapability, loadSupportReportScope, signSupportReportCapability, verifySupportReportCapability } from '../src/lib/support-report-capability.ts';
import { createSunFreshHandoffToken, createSunSnapshotAccessToken, verifySunFreshHandoffToken } from '../src/lib/sun-fresh-handoff.ts';
import { parseSupportReportInput, supportReportIdentity, writeSupportReport } from '../src/lib/support-report-service.ts';

const secret = 'SYNTHETIC-S9-ONLY-SECRET-NEVER-PRODUCTION-123456';
process.env.SUN_HANDOFF_SECRET = secret;
delete process.env.SUN_HANDOFF_SECRET_PREVIOUS;
const scope = { eventId:'715',tenantId:'10000000-0000-4000-8000-000000000001',batchId:'20000000-0000-4000-8000-000000000001',tenantSlug:'qa',bid:'QA-ONLY',uid:'04AABBCCDDEEFF',counter:107 };
const input = () => parseSupportReportInput({ request_id:'30000000-0000-4000-8000-000000000001',category:'tap_review',description:'Test report only',contact:'qa@example.invalid',locale:'es-AR' });
const actor = { source:'sun_public_report',consumerId:null };

test('support capability is fifteen-minute, purpose-separated and binds exact event scope without exposing UID', () => {
  const now=Date.now(), cap=signSupportReportCapability(scope,now), payload=JSON.parse(Buffer.from(cap.token.split('.')[0],'base64url'));
  assert.equal(payload.exp-payload.iat,900); assert.equal(cap.eventId,'715');
  assert.equal(new Date(cap.expiresAt).getTime(),payload.exp*1000);
  assert.ok(!JSON.stringify(payload).includes(scope.uid));
  assert.deepEqual(verifySupportReportCapability(cap.token,scope,now),{ok:true});
  assert.equal(verifySupportReportCapability(cap.token,scope,payload.exp*1000).reason,'expired');
  for(const patch of [{eventId:'716'},{tenantId:'10000000-0000-4000-8000-000000000002'},{batchId:'20000000-0000-4000-8000-000000000002'},{bid:'OTHER'},{uid:null},{counter:108}]) assert.equal(verifySupportReportCapability(cap.token,{...scope,...patch},now).ok,false);
  assert.equal(verifySunFreshHandoffToken(cap.token,{eventId:scope.eventId}).ok,false);
  const exp=Math.floor(now/1000)+300;
  const fresh=createSunFreshHandoffToken({eventId:scope.eventId,bid:scope.bid,uidHex:scope.uid,readCounter:scope.counter,diagnosticId:510,traceId:'qa',exp});
  const snapshot=createSunSnapshotAccessToken({diagnosticId:510,traceId:'qa',exp});
  for(const token of [fresh,snapshot,'share.qa',null,'x'.repeat(4000),cap.token+'x']) assert.equal(verifySupportReportCapability(token,scope).ok,false);
});

test('support verifier rejects signed malformed or overlong lifetime and permits explicit key rotation only', () => {
  const now=Date.now(), original=signSupportReportCapability(scope,now), payload=JSON.parse(Buffer.from(original.token.split('.')[0],'base64url'));
  const signed=value=>{const body=Buffer.from(JSON.stringify(value)).toString('base64url');return body+'.'+createHmac('sha256',secret).update('sun-support-token-v1\0'+body).digest('base64url');};
  for(const patch of [{purpose:'sun_fresh_handoff'},{exp:payload.iat+901},{iat:payload.iat+120,exp:payload.iat+300},{iat:'1'},{binding:'invalid'}]) assert.equal(verifySupportReportCapability(signed({...payload,...patch}),scope,now).ok,false);
  process.env.SUN_HANDOFF_SECRET='SYNTHETIC-ROTATED-S9-SECRET-ONLY-1234567890';
  assert.equal(verifySupportReportCapability(original.token,scope).ok,false);
  process.env.SUN_HANDOFF_SECRET_PREVIOUS=secret;
  assert.equal(verifySupportReportCapability(original.token,scope).ok,true);
  process.env.SUN_HANDOFF_SECRET=secret;delete process.env.SUN_HANDOFF_SECRET_PREVIOUS;
});

test('scope loader uses canonical event ID and exact persisted tenant/batch, never a BID or UID fallback', async () => {
  let calls=0;
  const execute=async(strings,...values)=>{calls++;assert.deepEqual(values,['715']);assert.match(strings.join('?'),/b\.id=e\.batch_id AND b\.tenant_id=e\.tenant_id/);return [{event_id:'715',tenant_id:scope.tenantId,batch_id:scope.batchId,tenant_slug:'qa',bid:scope.bid,uid_hex:scope.uid,sdm_read_ctr:scope.counter}];};
  for(const value of [715,'0','01','9223372036854775808',null]) assert.equal(await loadSupportReportScope(value,execute),null);
  assert.equal(calls,0);assert.deepEqual(await loadSupportReportScope('715',execute),scope);
  assert.equal(await loadSupportReportScope('715',async()=>[]),null);
  assert.equal(await loadSupportReportScope('715',async()=>[{},{}]),null);
  assert.equal(await createSupportReportCapability('715',async()=>{throw Error('SQL private details');}),null);
  assert.equal(await createSupportReportCapability(null,execute),null);
});

test('normalization and request fingerprint preserve intent across token renewal without merging other actors or payloads', () => {
  const first=input(), identity=supportReportIdentity(scope,actor,first);
  assert.match(identity.id,/^[a-f0-9]{8}-[a-f0-9]{4}-8[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.deepEqual(supportReportIdentity(scope,actor,{...first,support_token:'new-ignored-capability'}),identity);
  const changed=supportReportIdentity(scope,actor,{...first,description:'Changed'});
  assert.equal(changed.id,identity.id);assert.notEqual(changed.fingerprint,identity.fingerprint);
  for(const [nextScope,nextActor,nextInput] of [[{...scope,eventId:'716'},actor,first],[scope,{source:'consumer_portal_report',consumerId:'40000000-0000-4000-8000-000000000001'},first],[scope,actor,{...first,requestId:'30000000-0000-4000-8000-000000000002'}]]) assert.notEqual(supportReportIdentity(nextScope,nextActor,nextInput).id,identity.id);
  assert.throws(()=>supportReportIdentity(scope,{source:'consumer_portal_report',consumerId:null},first),/actor_invalid/);
  for(const patch of [{request_id:'not-uuid'},{description:''},{description:'x'.repeat(1501)},{contact:'x'.repeat(321)},{category:'claim'},{locale:'xx'}]) assert.throws(()=>parseSupportReportInput({request_id:first.requestId,category:first.category,description:first.description,...patch}));
});

test('writer requires a durable row, validates replay fingerprint and never returns sensitive fields', async () => {
  let row,statements=[];
  const execute=async(strings,...values)=>{const text=strings.join('?');statements.push(text);if(text.includes('INSERT INTO')){
    assert.match(text,/FOR SHARE OF e,b,t/);assert.match(text,/e\.uid_hex IS NOT DISTINCT FROM/);assert.match(text,/ON CONFLICT\(id\) DO NOTHING/);
    const detail=values.find(value=>typeof value==='string'&&value.startsWith('{"protocol":"nexid.support-report.v1"'));
    row={id:supportReportIdentity(scope,actor,input()).id,tenant_id:scope.tenantId,bid:scope.bid,tap_event_id:scope.eventId,status:'open',created_at:'2026-01-01T00:00:00Z',detail,source:actor.source};return [row];}return[row];};
  const result=await writeSupportReport(scope,actor,input(),execute);
  assert.equal(result.outcome,'ticket_created');assert.equal(result.ticket.tenant_assigned,true);
  assert.doesNotMatch(JSON.stringify(result),/qa@example|fingerprint|Test report only|04AABB/);
  let reads=0;
  const replay=await writeSupportReport(scope,actor,input(),async()=>++reads===1?[]:[{...row,status:'closed'}]);
  assert.equal(replay.outcome,'ticket_existing');assert.equal(replay.ticket.status,'closed');assert.equal(reads,2);
  reads=0;await assert.rejects(writeSupportReport(scope,actor,{...input(),description:'other'},async()=>++reads===1?[]:[row]),/report_request_conflict/);
  await assert.rejects(writeSupportReport(scope,actor,input(),async()=>[]),/ticket_persistence_unavailable/);
  assert.equal(statements.length,1);
});
