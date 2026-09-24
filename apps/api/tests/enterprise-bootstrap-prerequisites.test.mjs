import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { prepareEnterpriseBootstrapPrerequisite } from '../scripts/lib/enterprise-bootstrap-prerequisites.mjs';
const id='20260918050000_0103_logistics_atomic_operations.sql';
test('reviewed bootstrap baseline is exactly runtime DDL, not a synthetic replacement',async()=>{
 const source=(await readFile(new URL('../src/lib/secure-delivery-schema.ts',import.meta.url),'utf8')).replaceAll('\r\n','\n');
 const statements=[...source.matchAll(/sql\/\*sql\*\/`([\s\S]*?)`/g)].map(m=>m[1].trim().replace(/;$/,''));assert.equal(statements.length,12);
 const snapshot=(await readFile(new URL('../db/bootstrap/secure-delivery-v1.sql',import.meta.url),'utf8')).replaceAll('\r\n','\n').replace(/^--.*\n/gm,'').trim();
 assert.equal(snapshot,statements.map(s=>s+';').join('\n\n'));
 assert.doesNotMatch(snapshot,/INSERT INTO|TRUNCATE|DROP TABLE/i);
});
test('prerequisite refuses missing explicit local-bootstrap authority before SQL',async()=>{
 let calls=0;await assert.rejects(()=>prepareEnterpriseBootstrapPrerequisite({query(){calls++;}},id),/requires_empty_local_bootstrap/);assert.equal(calls,0);
 assert.equal(await prepareEnterpriseBootstrapPrerequisite(null,'other.sql'),null);
});
test('existing prerequisite relations fail closed without writing or clearing them',async()=>{
 let calls=0;await assert.rejects(()=>prepareEnterpriseBootstrapPrerequisite({async query(){calls++;return{rows:[{n:1}]};}},id,{emptyLocalBootstrap:true}),/already_present/);assert.equal(calls,1);
});
test('snapshot hash and migration transaction remain behind the existing empty-target guard',async()=>{
 const statements=[];const info=await prepareEnterpriseBootstrapPrerequisite({async query(q){statements.push(q);return{rows:[{n:0}]};}},id,{emptyLocalBootstrap:true});assert.equal(statements.length,2);assert.match(info.sha256,/^[a-f0-9]{64}$/);
 const runner=await readFile(new URL('../scripts/db-apply.mjs',import.meta.url),'utf8');assert.match(runner,/if \(cleanBootstrapConfig\) \{[\s\S]*?prepareEnterpriseBootstrapPrerequisite/);assert.ok(runner.indexOf('await assertEmptyEnterpriseE2eDatabase')<runner.indexOf('await prepareEnterpriseBootstrapPrerequisite'));
 assert.ok(runner.indexOf('await client.query("BEGIN")')<runner.indexOf('await prepareEnterpriseBootstrapPrerequisite'));
});
