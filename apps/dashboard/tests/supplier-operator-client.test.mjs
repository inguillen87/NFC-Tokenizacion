import assert from 'node:assert/strict';
import test from 'node:test';
import { supplierOperatorCan, supplierOperatorPermissions, supplierOperatorPageAllowed } from '../src/lib/supplier-operator-access.ts';
import { verifiedSessionPermissions } from '../src/lib/verified-session-permissions.ts';
import { DASHBOARD_HIGH_IMPACT_CAPABILITY_ROLES } from '../src/lib/enterprise-runtime-rbac.ts';
import { dashboardHighImpactPermissionMatches } from '../src/lib/permission-policy.ts';
import { DASHBOARD_DESTINATIONS, dashboardCanOpenDestination } from '../src/lib/dashboard-destination-policy.ts';
import { parseSupplierAssignedRequests, supplierAssignedRequestCall } from '../src/lib/supplier-assigned-request-client.ts';
import { parseSupplierOperators, parseSupplierAssignment, supplierAssignmentCall } from '../src/lib/supplier-request-assignment-client.ts';
import { supplierRequestReviewCall } from '../src/lib/supplier-request-review-client.ts';

const id='40000000-0000-4000-8000-000000000001',tenantId='10000000-0000-4000-8000-000000000001',operator='20000000-0000-4000-8000-000000000001',other='20000000-0000-4000-8000-000000000002',key='50000000-0000-4000-8000-000000000001';
const date='2026-09-23T12:00:00.000Z';
const permissions=['supplier_request.assigned.read','supplier_request.assigned.review'];
const access={role:'supplier-operator',userId:operator,tenantId:null,tenantSlug:null,permissions,deniedPermissions:[],isDemo:false};
const binding={id,tenant:'qa-only',tenantId};
const request=()=>({id,tenant_id:tenantId,tenant_slug:'qa-only',status:'submitted',revision:3,title:'Frasco ámbar',notes:'Sin datos personales',construction_id:'tt_bridge',quantity:125,pack_purpose:'trial_integration',created_at:date,updated_at:date,submitted_at:date,order_id:null,review_summary:{state:'pending',revision:0,updated_at:null},assignment:{operator_id:operator,revision:1,updated_at:date}});
const assigned=(patch={})=>({ok:true,protocol:'nexid.supplier-request.v1',scope:{mode:'assigned',operator_id:operator},request:request(),...patch});
const event=(revision,operatorId=operator)=>({id:`60000000-0000-4000-8000-${String(revision).padStart(12,'0')}`,revision,request_revision:3,action:operatorId?'assign':'unassign',operator_id:operatorId,actor_id:other,created_at:date});
const assignment=(revision=0,patch={})=>({ok:true,protocol:'nexid.supplier-request-assignment.v1',scope:{mode:'tenant',tenant_id:tenantId,tenant_slug:'qa-only'},request_id:id,request_revision:3,assignment:{operator_id:revision?operator:null,revision,updated_at:revision?date:null},history:Array.from({length:Math.min(100,revision)},(_,i)=>event(Math.max(1,revision-99)+i)),count:Math.min(100,revision),truncated:revision>100,next_before_revision:revision>100?revision-99:null,...patch});
const command=()=>({tenant:'qa-only',id,key,body:{operator_id:operator,expected_revision:0,expected_request_revision:3}});
const receipt={idempotency_key:key,action:'assign',revision:1};
const response=(body,status=200,mode='production')=>Response.json(body,{status,headers:{'x-nexid-data-mode':mode}});

test('the internal operator is a separate global-null principal with only two exact permissions',()=>{
  assert.deepEqual(supplierOperatorPermissions(['*','supplier_request.*','users:manage',...permissions]),permissions);
  assert.deepEqual(verifiedSessionPermissions({...access,permissions:['*','supplier_order.create',...permissions]}),permissions);
  for(const cap of permissions) assert.equal(supplierOperatorCan(access,cap),true);
  for(const patch of [{userId:undefined},{userId:'session-id'},{tenantId},{tenantSlug:'qa-only'},{isDemo:true},{role:'super-admin'},{permissions:['*']},{permissions:['supplier_request.*']},{deniedPermissions:['*']},{deniedPermissions:['supplier_requests:assigned_read']}]) assert.equal(supplierOperatorCan({...access,...patch},permissions[0]),false,JSON.stringify(patch));
  for(const cap of Object.keys(DASHBOARD_HIGH_IMPACT_CAPABILITY_ROLES)) assert.equal(dashboardHighImpactPermissionMatches('supplier-operator',['*',cap],cap),false,cap);
});

test('operator page and navigation policy never fall back to overview or inherited admin grants',()=>{
  for(const path of ['/supplier-orders/requests','/supplier-orders/requests?request='+id]) assert.equal(supplierOperatorPageAllowed(path),true);
  for(const path of ['/','/users','/supplier-orders','/supplier-orders/create','/supplier-orders/requests/extra','https://evil.test/supplier-orders/requests','//evil.test/supplier-orders/requests']) assert.equal(supplierOperatorPageAllowed(path),false,path);
  for(const destination of Object.keys(DASHBOARD_DESTINATIONS)) assert.equal(dashboardCanOpenDestination(destination,{...access,permissions:['*',...permissions]}),destination==='supplierRequests',destination);
  assert.equal(dashboardCanOpenDestination('supplierRequests',{...access,permissions:['*']}),false);
  assert.equal(dashboardCanOpenDestination('supplierRequests',{...access,deniedPermissions:['supplier_request.assigned.read']}),false);
});

test('assigned records require current actor, assignment and submitted data truth',()=>{
  assert.equal(parseSupplierAssignedRequests(assigned(),operator,id).request.assignment.operator_id,operator);
  assert.deepEqual(parseSupplierAssignedRequests(assigned({items:[],count:0,truncated:false}),operator),{items:[],truncated:false});
  for(const change of [v=>v.scope.operator_id=other,v=>v.scope.mode='global',v=>v.demo=true,v=>v.request.id=key,v=>v.request.assignment.operator_id=other,v=>delete v.request.assignment,v=>v.request.assignment.revision=0,v=>v.request.assignment.updated_at='bad',v=>delete v.request.review_summary,v=>v.request.status='draft']) {const body=assigned();change(body);assert.throws(()=>parseSupplierAssignedRequests(body,operator,id));}
  for(const patch of [{items:[request(),request()],count:2,truncated:false},{items:[],count:1,truncated:false},{items:[request()],count:1,truncated:null}])assert.throws(()=>parseSupplierAssignedRequests(assigned(patch),operator));
});

test('assigned reads use only the private namespace, and denial is never an empty confirmed inbox',async()=>{
  await supplierAssignedRequestCall({operatorId:operator,id},async(url,init)=>{assert.equal(url,`/api/admin/supplier-requests/assigned/${id}`);assert.equal(init.method,'GET');assert.equal(init.cache,'no-store');assert.equal(init.credentials,'same-origin');return response(assigned());});
  for(const status of [401,403,404,503])await assert.rejects(supplierAssignedRequestCall({operatorId:operator,id},async()=>response({ok:false,reason:'supplier_request_not_found'},status)),error=>error.status===status&&!error.uncertain);
  for(const mode of ['demo','fallback',''])await assert.rejects(supplierAssignedRequestCall({operatorId:operator,id},async()=>response(assigned(),200,mode)));
  let sent=0;for(const input of [{operatorId:'session-id'},{operatorId:operator,id:'bad'}])await assert.rejects(supplierAssignedRequestCall(input,async()=>{sent++;return response(assigned());}));assert.equal(sent,0);
});

test('operator catalog strips personal fields and tolerates existing long display names',()=>{
  const body={ok:true,protocol:'nexid.supplier-request-assignment.v1',scope:{mode:'global',tenant_id:null,tenant_slug:null},operators:[{id:operator,display_name:'N'.repeat(300),email:'PRIVATE'}],count:1,truncated:false};
  assert.equal(parseSupplierOperators(body).operators[0].display_name.length,300);assert.doesNotMatch(JSON.stringify(parseSupplierOperators(body)),/PRIVATE/);
  assert.throws(()=>parseSupplierOperators({...body,scope:{mode:'assigned',operator_id:operator}}));
  assert.throws(()=>parseSupplierOperators({...body,operators:[body.operators[0],body.operators[0]],count:2}));
});

test('assignment history is scoped, complete and paginated without inventing missing revisions',()=>{
  assert.equal(parseSupplierAssignment(assignment(),binding).assignment.operator_id,null);
  assert.equal(parseSupplierAssignment(assignment(105),binding).next_before_revision,6);
  const prior=assignment(5,{assignment:assignment(105).assignment});assert.equal(parseSupplierAssignment(prior,{...binding,beforeRevision:6}).history.length,5);
  for(const mutate of [d=>d.scope.tenant_id=other,d=>d.scope.tenant_slug='other',d=>d.request_id=key,d=>d.history.pop(),d=>d.history[1].revision=9,d=>d.history[1].id=d.history[0].id,d=>d.truncated=true,d=>d.assignment.operator_id=other]){const body=assignment(2);mutate(body);assert.throws(()=>parseSupplierAssignment(body,binding));}
  assert.throws(()=>parseSupplierAssignment(assignment(0,{assignment:{operator_id:operator,revision:0,updated_at:null}}),binding));
});

test('assignment retries preserve key/body and accept original receipt after later reassignments',async()=>{
  const cmd=command(),calls=[];let count=0;
  const fetcher=async(url,init)=>{calls.push([url,init.headers['Idempotency-Key'],init.body]);if(!count++)throw Error('network');return response(assignment(2,{receipt,idempotent_replay:true}));};
  await assert.rejects(supplierAssignmentCall({...binding,command:cmd},fetcher),error=>error.uncertain);
  const result=await supplierAssignmentCall({...binding,command:cmd},fetcher);assert.equal(result.receipt.revision,1);assert.equal(result.assignment.revision,2);assert.deepEqual(calls[0],calls[1]);assert.equal(calls[0][0],`/api/admin/supplier-requests/${id}/assignment?tenant=qa-only`);
  for(const patch of [{receipt:{...receipt,idempotency_key:other}},{receipt:{...receipt,revision:2}},{receipt:{...receipt,action:'unassign'}},{history:[event(1,other),event(2)]},{request_revision:2}])await assert.rejects(supplierAssignmentCall({...binding,command:cmd},async()=>response(assignment(2,{receipt,idempotent_replay:true,...patch}))),error=>error.uncertain);
  for(const status of [408,503])await assert.rejects(supplierAssignmentCall({...binding,command:cmd},async()=>response({ok:false,reason:'unavailable'},status)),error=>error.uncertain);
  for(const status of [401,403,409])await assert.rejects(supplierAssignmentCall({...binding,command:cmd},async()=>response({ok:false,reason:'denied'},status)),error=>!error.uncertain&&error.status===status);
});

test('assigned clarification writes bind actor and action while keeping the same review contract',async()=>{
  const cmd={id,tenant:'qa-only',operatorId:operator,key,body:{action:'request_information',message:'¿Superficie de aplicación?',expected_revision:0,expected_request_revision:3}};
  const body={ok:true,protocol:'nexid.supplier-request-review.v1',scope:{mode:'assigned',operator_id:operator},request_id:id,request_revision:3,review:{state:'needs_information',revision:1,updated_at:date},history:[{id:key,revision:1,request_revision:3,action:cmd.body.action,message:cmd.body.message,actor_id:operator,created_at:date}],count:1,truncated:false,next_before_revision:null,receipt:{idempotency_key:key,action:cmd.body.action,revision:1},idempotent_replay:false};
  await supplierRequestReviewCall({...binding,operatorId:operator,command:cmd},async(url,init)=>{assert.equal(url,`/api/admin/supplier-requests/assigned/${id}/review`);assert.equal(init.headers['Idempotency-Key'],key);return response(body);});
  await assert.rejects(supplierRequestReviewCall({...binding,operatorId:operator,command:cmd},async()=>response({...body,scope:{mode:'assigned',operator_id:other}})),error=>error.uncertain);
  let sent=0;for(const bad of [{...cmd,operatorId:other},{...cmd,body:{...cmd.body,action:'respond'}}])await assert.rejects(supplierRequestReviewCall({...binding,operatorId:operator,command:bad},async()=>{sent++;return response(body);}));assert.equal(sent,0);
});
