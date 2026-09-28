import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {withSupplierWriteSwitches} from './supplier-rollout-acceptance.mjs';

export async function verifySupplierCancellation({call,check,tenantSlug,adminHeaders,otherTenantAdminHeaders}) {
 const query='?tenant='+tenantSlug;
 const created=await call('separate cancellation draft persisted','/admin/supplier-requests'+query,{method:'POST',headers:adminHeaders,status:201,body:{title:'Isolated cancellation acceptance',construction_id:'pet_wet',quantity:2,pack_purpose:'trial_integration',notes:'Disposable software test only.'}});
 const path='/admin/supplier-requests/'+created.request.id;
 const submitted=await call('cancellation request explicitly submitted',path+'/submit'+query,{method:'POST',headers:adminHeaders,body:{expected_revision:created.request.revision}});
 const command={expected_revision:submitted.request.revision,expected_review_revision:submitted.request.review_summary.revision,reason:'Cancelled in the isolated acceptance only.'};
 await call('cancellation denies another company',path+'/cancellation'+query,{method:'POST',headers:otherTenantAdminHeaders,body:command,status:403});
 await call('cancellation rejects a stale request revision',path+'/cancellation'+query,{method:'POST',headers:adminHeaders,body:{...command,expected_revision:command.expected_revision-1},status:409});
 const key=randomUUID();
 const saved=await call('company cancellation persisted',path+'/cancellation'+query,{method:'POST',headers:adminHeaders,body:command,key});
 const replay=await call('cancellation retries the same receipt',path+'/cancellation'+query,{method:'POST',headers:adminHeaders,body:command,key});
 check(saved.request.status==='cancelled'&&saved.request.order_id===null,'cancellation does not create or cancel a technical order');
 check(replay.idempotent_replay&&replay.receipt.idempotency_key===key&&replay.receipt.revision===saved.receipt.revision,'cancellation retry has one stable receipt');
 await call('cancelled request cannot be cancelled again with a new command',path+'/cancellation'+query,{method:'POST',headers:adminHeaders,body:{...command,expected_revision:saved.request.revision},status:409});
 await withSupplierWriteSwitches('false',async()=>{
  const historical=await call('cancelled request remains readable after switch closure',path+query,{headers:adminHeaders});
  assert.deepEqual(historical.request,saved.request);check(true,'closing switches does not erase or rewrite the cancellation');
  const denied=await call('closing the switch also blocks a receipt retry',path+'/cancellation'+query,{method:'POST',headers:adminHeaders,body:command,key,status:503});
  check(denied.reason==='supplier_request_cancellation_disabled','a disabled retry never claims the operation was reversed');
 });
 return {cancelledRequests:1,technicalOrdersCreated:0,externalActions:false};
}
