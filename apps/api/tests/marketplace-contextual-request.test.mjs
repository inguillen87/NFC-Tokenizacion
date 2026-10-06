import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validPostTapEventId,isContextualMarketplaceTapEligible } from '../src/lib/marketplace-contextual-request.ts';

test('explicit contextual IDs are canonical decimal safe integers with no coercion',()=>{
  for(const value of ['1','9007199254740991'])assert.equal(validPostTapEventId(value),true);
  for(const value of [null,1,'01','0','-1','1.0','1e3','9007199254740992'])assert.equal(validPostTapEventId(value),false);
});
test('contextual inquiry distinguishes closed authentic NFC from opened/risk/manual states',()=>{
  const evidence={source:'real',verdict:'valid',event_type:'TAP_VALID',cmac_ok:true,allowlisted:true};
  for(const result of ['VALID','TAP_VALID','VALID_AUTHENTIC','VALID_CLOSED'])assert.equal(isContextualMarketplaceTapEligible({...evidence,result},'ntag424_dna'),true);
  for(const result of ['OPENED','VALID_OPENED','VALID_OPENED_PREVIOUSLY','REPLAY_SUSPECT','INVALID','VALID_UNKNOWN_TAMPER'])assert.equal(isContextualMarketplaceTapEligible({result,source:'real'},'ntag424_dna'),false);
  assert.equal(isContextualMarketplaceTapEligible({result:'VALID_AUTHENTIC',manual_tamper_status:'MANUAL_OPENED'},'ntag424_dna'),false);
  assert.equal(isContextualMarketplaceTapEligible({result:'VALID_AUTHENTIC',source:'demo'},'ntag424_dna'),false);
  assert.equal(isContextualMarketplaceTapEligible({result:'VALID_CLOSED'},'ntag424_dna_tt'),false);
  assert.equal(isContextualMarketplaceTapEligible({...evidence,result:'VALID_CLOSED',meta:{sun_tt_truth_receipt:{schema_version:'sun-tt-durable-truth-receipt/v1',binding_status:'BOUND',carrier_profile_code:'ntag424_dna_tt',tt_raw:'4343',canonical_product_state:'VALID_CLOSED'}}},'ntag424_dna_tt'),true);
  for(const changed of [{cmac_ok:false},{cmac_ok:null},{allowlisted:false},{event_type:null},{source:null}])assert.equal(isContextualMarketplaceTapEligible({...evidence,result:'VALID_AUTHENTIC',...changed},'ntag424_dna'),false);
});
test('contextual writer locks current publication/scope and first manual declaration revision without purchase effects',async()=>{
  const query=await readFile(new URL('../src/lib/marketplace-contextual-request.ts',import.meta.url),'utf8');
  for(const name of ['locked_tag','locked_profile','locked_brand','locked_product','locked_consumer','locked_membership','locked_event','locked_history','locked_ownership','locked_manual'])assert.match(query,new RegExp(`${name} AS MATERIALIZED`));
  assert.match(query,/tag\.revision=\$\{source\.tag_revision\}/);assert.match(query,/postTap,status/);assert.match(query,/created_crm_request/);
  assert.doesNotMatch(query,/consumeSunFreshHandoff|points_ledger|UPDATE marketplace_products|UPDATE consumer_product_ownerships/);
  const manual=await readFile(new URL('../src/lib/mark-tag-manually-opened.ts',import.meta.url),'utf8');assert.match(manual,/FOR UPDATE OF tag/);assert.match(manual,/SET status=tag\.status/);assert.match(manual,/FROM touched_tag/);
});
