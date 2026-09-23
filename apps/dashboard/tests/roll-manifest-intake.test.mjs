import assert from 'node:assert/strict';
import test from 'node:test';
import { rollReceipt, inspectRollManifest, rollValidationCurrent, ROLL_VALIDATION_TTL_MS } from '../src/lib/roll-manifest-policy.ts';
const valid = {ok:true,batch:'QA-ROLL-01',dryRun:true,activated:false,importedRows:2,inserted:2,duplicateUids:[],reactivated:0,ignored:0};
for (const patch of [
  {demo:true},{demoMode:true},{dataSource:'demo'},{importedRows:Number.MAX_SAFE_INTEGER+1},
  {reactivated:1},{ignored:1},{supplier_gate:[]},{supplier_gate:'invalid'},
  {supplier_gate:{expected_quantity:3,manifest_status:'would_import',quantity_override:null}},
  {supplier_gate:{expected_quantity:2,manifest_status:'imported',quantity_override:null}},
]) test('receipt rejects conflicting evidence '+JSON.stringify(patch),()=>assert.equal(rollReceipt({...valid,...patch},valid.batch,true),null));
test('explicit false/absent demo flags and a matching supplier gate remain accepted',()=>assert.ok(rollReceipt({...valid,demo:false,supplier_gate:{expected_quantity:2,manifest_status:'would_import',quantity_override:null}},valid.batch,true)));
test('commit receipt cannot have a string mode',()=>assert.equal(rollReceipt({...valid,dryRun:'false'},valid.batch,false),null));
test('legacy no-gate receipt remains compatible, without pretending to certify supplier QA',()=>assert.ok(rollReceipt({...valid,dryRun:undefined,supplier_gate:null},valid.batch,false)));
test('validation TTL boundary and backwards clock are enforced',()=>{
  assert.equal(rollValidationCurrent('a','a',10,10+ROLL_VALIDATION_TTL_MS),true);
  assert.equal(rollValidationCurrent('a','a',10,11+ROLL_VALIDATION_TTL_MS),false);
  assert.equal(rollValidationCurrent('a','a',10,9),false);
  assert.equal(rollValidationCurrent('a','a',NaN,100),false);
});
for (const content of ['uid\n\u0000abc','uid\n\uFFFDabc']) test('invalid text encoding fails before upload '+JSON.stringify(content),()=>assert.ok(inspectRollManifest(content)));