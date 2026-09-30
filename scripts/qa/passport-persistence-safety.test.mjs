import test from 'node:test';
import assert from 'node:assert/strict';
import { API_SOURCE, QA_CONFIRMATION, passportPersistenceConfig } from './passport-persistence-safety.mjs';
const valid = {
  NODE_ENV: 'test', VERCEL_ENV: 'test', NEXID_E2E_CONFIRMATION: QA_CONFIRMATION,
  NEXID_EDITORIAL_API_SHA: API_SOURCE, NEXID_EDITORIAL_API_ROOT: '/qa/api',
  NEXID_E2E_EXPECTED_POSTGRES_VERSION: '16.4',
  NEXID_E2E_DATABASE_URL: 'postgresql://nexid_e2e:synthetic-only@127.0.0.1:5432/nexid_e2e_editorial',
};
for (const version of ['16.4', '18.4']) test('exact engine accepted: '+version, () => {
  const config = passportPersistenceConfig({...valid,NEXID_E2E_EXPECTED_POSTGRES_VERSION:version});
  assert.ok(Object.isFrozen(config)); assert.equal(config.databaseName,'nexid_e2e_editorial');
});
for (const [key,value] of [
  ['NODE_ENV','production'], ['VERCEL_ENV','preview'], ['NEXID_E2E_CONFIRMATION','yes'],
  ['NEXID_EDITORIAL_API_SHA','f'.repeat(40)], ['NEXID_EDITORIAL_API_ROOT',''],
  ['NEXID_E2E_EXPECTED_POSTGRES_VERSION','16'], ['NEXID_E2E_EXPECTED_POSTGRES_VERSION','16.5'],
  ['DATABASE_URL',valid.NEXID_E2E_DATABASE_URL], ['POSTGRES_URL',valid.NEXID_E2E_DATABASE_URL],
  ['POSTGRES_URL_NON_POOLING',valid.NEXID_E2E_DATABASE_URL], ['NEON_DATABASE_URL',valid.NEXID_E2E_DATABASE_URL],
]) test('unsafe context refused: '+key+' '+value.slice(0,20), () => {
  assert.throws(()=>passportPersistenceConfig({...valid,[key]:value}));
});
for (const url of [
  '', 'not a URL', valid.NEXID_E2E_DATABASE_URL+'?host=remote.example',
  valid.NEXID_E2E_DATABASE_URL+'#other', valid.NEXID_E2E_DATABASE_URL.replace('127.0.0.1','db.neon.tech'),
  valid.NEXID_E2E_DATABASE_URL.replace('127.0.0.1','localhost'),
  valid.NEXID_E2E_DATABASE_URL.replace('127.0.0.1','127.0.0.2'),
  valid.NEXID_E2E_DATABASE_URL.replace('/nexid_e2e_editorial','/neondb'),
  valid.NEXID_E2E_DATABASE_URL.replace('nexid_e2e:','neondb_owner:'),
  valid.NEXID_E2E_DATABASE_URL.replace(':synthetic-only@','@'),
]) test('unsafe URL refused: '+JSON.stringify(url), () => {
  assert.throws(()=>passportPersistenceConfig({...valid,NEXID_E2E_DATABASE_URL:url}));
});
test('input environment remains unchanged',()=>{
  const env={...valid};passportPersistenceConfig(env);assert.deepEqual(env,valid);
});
