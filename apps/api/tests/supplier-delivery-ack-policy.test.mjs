import assert from 'node:assert/strict';import test from 'node:test';
import{parseDeliveryAckCommand,parseDeliveryAckState,parseDeliveryAckEvent}from'../src/lib/supplier-delivery-ack-policy.ts';
import{ids,hash,command,event,snapshot,scope}from'./fixtures/supplier-delivery-ack.mjs';
test('received claims require exact reported envelope hash; issue can document a mismatch, withdrawal cannot claim a hash match',()=>{
 assert.equal(parseDeliveryAckCommand(command()).reported_hash,hash);assert.equal(parseDeliveryAckCommand(command({action:'issue',reported_hash:null})).reported_hash,null);assert.equal(parseDeliveryAckCommand(command({action:'issue',reported_hash:'sha256:'+'b'.repeat(64)})).action,'issue');
 for(const patch of [{reported_hash:null},{reported_hash:'sha256:'+'b'.repeat(64)},{action:'withdraw'},{artifact_hash:'bad'},{action:'approve'},{expected_revision:'0'},{expected_revision:-1},{expected_revision:2147483646},{expected_request_revision:0},{reason:''},{evidence_ref:'x'.repeat(241)},{reason:'x'.repeat(1001)},{evidence_ref:'bad\nref'},{supplier_authenticated:true},{actor_id:ids.actor}])assert.throws(()=>parseDeliveryAckCommand(command(patch)));
});
for(const field of ['supplier_authenticated','download_verified','decryption_verified','physical_received'])test('manual record cannot assert '+field,()=>{assert.throws(()=>parseDeliveryAckEvent(event({[field]:true})));assert.throws(()=>parseDeliveryAckEvent(event({[field]:undefined})));});
test('state projects only safe evidence identifiers and explicitly manual claims',()=>{const parsed=parseDeliveryAckState(snapshot({encrypted_payload:'PRIVATE'}),scope);assert.equal(parsed.current.source,'nexid_manual_record');assert.equal(parsed.artifacts_count,1);assert.equal(parsed.encrypted_payload,undefined);});
for(const patch of [{request_id:ids.other},{order_id:ids.other},{request_revision:6},{revision:2},{current:null},{history:[]},{count:2},{artifacts_count:2},{artifacts_truncated:null},{truncated:true},{next_before_revision:1},{source:null}])test('inconsistent snapshot rejected '+JSON.stringify(patch),()=>assert.throws(()=>parseDeliveryAckState(snapshot(patch),scope)));
test('no eligible exports is not fabricated acknowledgement or authority',()=>{const v=parseDeliveryAckState(snapshot({revision:0,current:null,history:[],count:0,source:null,artifacts:[],artifacts_count:0}),scope);assert.equal(v.current,null);assert.deepEqual(v.artifacts,[]);});
test('artifact ids must be unique, bounded and exported no later than the dispatch receipt',()=>{
 for(const artifacts of [[...snapshot().artifacts,...snapshot().artifacts],[{id:ids.artifact,hash,created_at:'2026-09-24T12:02:00.000Z'}],Array.from({length:53},()=>snapshot().artifacts[0])])assert.throws(()=>parseDeliveryAckState(snapshot({artifacts,artifacts_count:artifacts.length}),scope));
});
test('historical event remains a declaration when its export is no longer eligible',()=>{const v=parseDeliveryAckState(snapshot({source:null,artifacts:[],artifacts_count:0}),scope);assert.equal(v.current.artifact_id,ids.artifact);assert.equal(v.current.download_verified,false);});
test('exact exclusive history cursor keeps newest state independent from older pages',()=>{
 const one=event(),two=event({id:ids.other,revision:2,action:'issue',reported_hash:null});assert.equal(parseDeliveryAckState(snapshot({revision:2,current:two,history:[one],next_before_revision:null,count:1}),scope,2).current.revision,2);
 assert.throws(()=>parseDeliveryAckState(snapshot({revision:2,current:two,history:[two]}),scope,2));
});
