import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
const load=async p=>(await readFile(new URL(p,import.meta.url),'utf8')).replaceAll('\r\n','\n');
test('0121 forward definitions equal clean-install 0112 definitions without data or type rewrites',async()=>{
 const before=await load('../db/migrations/20260922100000_0112_support_ticket_workflow.sql');
 const forward=await load('../db/migrations/20260924163000_0121_support_ticket_status_type_compatibility.sql');
 for(const name of ['nexid_support_ticket_current_v1','nexid_read_support_ticket_workflow_v1','nexid_transition_support_ticket_v1']){
  const a=before.match(new RegExp('CREATE FUNCTION public\\.'+name+'\\([\\s\\S]*?\\n\\$\\$;'))?.[0];
  const b=forward.match(new RegExp('CREATE OR REPLACE FUNCTION public\\.'+name+'\\([\\s\\S]*?\\n\\$\\$;'))?.[0];
  assert.ok(a&&b);assert.equal(b,a.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));
 }
 assert.match(forward,/jsonb_populate_record\(NULL::public\.tickets/);
 assert.doesNotMatch(forward,/ALTER TABLE|ALTER TYPE|DROP TABLE|TRUNCATE/);
 assert.match(before,/t\.status::text,t\.updated_at/);
});
test('full supplier acceptance calls production handlers and does not replace a technical SQL function',async()=>{
 const source=await load('../scripts/lib/supplier-chain-acceptance.mjs');
 for(const path of ['export-pack','lifecycle','quotation','supplier-binding','delivery-ack','tickets'])assert.ok(source.includes(path));
 assert.match(source,/supplierChainRoutes/);assert.match(source,/httpHarness\.fetch/);assert.match(source,/decryptSupplierEncryptedZipForTest/);
 assert.match(source,/plaintext\.fill\(0\)/);assert.match(source,/external_supplier_contact:false/);
 assert.doesNotMatch(source,/CREATE (?:OR REPLACE )?FUNCTION|CREATE TABLE|writeFile|console\.log/);
 const main=await load('../scripts/enterprise-ephemeral-e2e.mjs');
 assert.match(main,/\.\.\.\(await supplierChainRoutes\(\)\)/);assert.match(main,/await runSupplierChainAcceptance/);
 assert.match(main,/supplier_chain_acceptance: supplierChainEvidence/);assert.match(main,/bootstrap_prerequisites: bootstrapPrerequisites/);
});
