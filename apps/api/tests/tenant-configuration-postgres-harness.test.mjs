import assert from 'node:assert/strict';
import test from 'node:test';
import {runConfigurationPostgresQa} from './helpers/tenant-configuration-postgres-harness.mjs';
test('requires explicit QA factory without environment discovery',async()=>{await assert.rejects(runConfigurationPostgresQa(),/explicit QA connection factory/)});
for(const database of ['postgres','production','neondb','nexid_e2e"; DROP SCHEMA public CASCADE; --'])test('rejects non QA database '+database,async()=>{
  const calls=[];let ended=false;const client={query:async(text)=>{calls.push(text);return{rows:[{database,backend_pid:1}]}},end:async()=>{ended=true}};
  await assert.rejects(runConfigurationPostgresQa(async()=>client),/Refusing a database/);assert.equal(calls.length,1);assert.equal(ended,true);
});
test('concurrent clients must be independent before DDL',async()=>{
  const calls=[];let ended=false;const client={query:async(text)=>{calls.push(text);return{rows:[{database:'nexid_e2e_safe',backend_pid:1}]}},end:async()=>{ended=true}};
  await assert.rejects(runConfigurationPostgresQa(async()=>client),/independent clients/);assert.equal(calls.length,1);assert.equal(ended,true);
});
