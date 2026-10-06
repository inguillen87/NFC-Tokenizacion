import test from 'node:test';
import assert from 'node:assert/strict';
import { runMarketplaceContextualPostgresQa } from './helpers/marketplace-contextual-postgres-harness.mjs';
test('contextual marketplace SQL QA requires an explicit isolated factory',async()=>{await assert.rejects(runMarketplaceContextualPostgresQa(),/explicit verified disposable QA/);});
test('contextual marketplace SQL QA denies production or unissued remote Docker target before DDL',async()=>{
  for(const [database,address,dockerAttestation]of [['production','127.0.0.1',undefined],['nexid_e2e','192.0.2.1',undefined],['nexid_e2e','172.18.0.2',{kind:'github-actions-local-docker'}]]){
    let closed=false;const statements=[];await assert.rejects(runMarketplaceContextualPostgresQa({dockerAttestation,connect:async()=>({query:async text=>{statements.push(text);return {rows:[{database,role:'nexid_e2e',pid:1,address,server_version_number:180004}]};},end:async()=>{closed=true;}})}));
    assert.equal(closed,true);assert.equal(statements.length,1);assert.doesNotMatch(statements[0],/CREATE|INSERT|UPDATE|DELETE|DROP/);
  }
});
