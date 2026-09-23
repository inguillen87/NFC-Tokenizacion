import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { checkAdminWithPermission } from '../src/lib/auth.ts';
import { makeSupplierRequestAssignmentHandlers } from '../src/lib/supplier-request-assignment-http.ts';
import { makeAssignedSupplierRequestHandlers, checkAssignedSupplierRequestPermission } from '../src/lib/supplier-request-assigned-http.ts';
import { parseSupplierRequestAssignmentCommand, supplierRequestAssignmentFromRow } from '../src/lib/supplier-request-assignment-contract.ts';

const tenant = '10000000-0000-4000-8000-000000000001', otherTenant = '10000000-0000-4000-8000-000000000002';
const actor = '20000000-0000-4000-8000-000000000001', otherActor = '20000000-0000-4000-8000-000000000002', sessionId = '30000000-0000-4000-8000-000000000001';
const id = '40000000-0000-4000-8000-000000000001', key = '50000000-0000-4000-8000-000000000001', eventId = '60000000-0000-4000-8000-000000000001';
const time = '2026-09-23T12:00:00.000Z', later = '2026-09-23T12:01:00.000Z';
const command = { operator_id: actor, expected_revision: 0, expected_request_revision: 2 };
const question = { action: 'request_information', message: 'Confirmar ubicación del adhesivo.', expected_revision: 0, expected_request_revision: 2 };
const row = (patch = {}) => ({ id, tenant_id: tenant, tenant_slug: 'qa-a', title: 'Solicitud QA', construction_id: 'pet_wet', quantity: 125, pack_purpose: 'trial_integration', notes: 'Original comercial', status: 'submitted', revision: 2, created_by: actor, updated_by: actor, submitted_by: actor, created_at: time, updated_at: time, submitted_at: time, order_id: null, review_summary: { state: 'pending', revision: 0, updated_at: null }, assignment: { operator_id: actor, revision: 1, updated_at: time }, ...patch });
const assignment = (patch = {}) => ({ tenant_id: tenant, tenant_slug: 'qa-a', request_id: id, request_revision: 2, assignment: { operator_id: actor, revision: 1, updated_at: time }, history: [{ id: eventId, revision: 1, request_revision: 2, action: 'assign', operator_id: actor, actor_id: actor, created_at: time }], count: 1, truncated: false, next_before_revision: null, ...patch });
const review = (patch = {}) => ({ tenant_id: tenant, tenant_slug: 'qa-a', request_id: id, request_revision: 2, review: { state: 'needs_information', revision: 1, updated_at: time }, history: [{ id: eventId, revision: 1, request_revision: 2, action: 'request_information', message: question.message, actor_id: actor, created_at: time }], count: 1, truncated: false, next_before_revision: null, ...patch });
function session(assigned, patch = {}) { return { id: sessionId, userId: actor, email: 'qa@example.invalid', label: 'Synthetic user', role: assigned ? 'supplier-operator' : 'super-admin', tenantId: null, tenantSlug: null, permissions: assigned ? ['supplier_request.assigned.read','supplier_request.assigned.review'] : ['supplier_request.assign'], deniedPermissions: [], mfaVerified: false, expiresAt: new Date(Date.now()+60000).toISOString(), rotatedCookieValue: null, setupCompleted: true, ...patch }; }
function setup(assigned = false, options = {}) {
  const queries = [], capabilities = [], current = options.current === undefined ? row() : options.current;
  const result = options.result === undefined ? { ...assignment(), ok: true, idempotent_replay: false, receipt: { idempotency_key: key, action: 'assign', revision: 1 } } : options.result;
  const value = {
    authorize: (req, permission) => { capabilities.push(permission); return (assigned ? checkAssignedSupplierRequestPermission : checkAdminWithPermission)(req,permission,options.resolver || (async () => session(assigned,options.session))); },
    query: async (strings, ...values) => {
      const sql = strings.join('?'); queries.push({ sql, values });
      if (options.throwQuery) throw Error('PRIVATE_PROVIDER_SQL_TOKEN');
      if (sql.includes('FROM public.tenants')) return [{ id: tenant, slug: 'qa-a' }];
      if (sql.includes('FROM public.users')) return options.candidates || [{ id: actor, display_name: 'Operador sintético', email: 'PRIVATE@example.invalid' }];
      if (sql.includes('nexid_supplier_requests_assigned_v1')) return [{ result: options.list === undefined ? { items: [current], count: 1, truncated: false } : options.list }];
      if (sql.includes('nexid_supplier_request_assigned_current_v1')) return [{ result: current }];
      if (sql.includes('nexid_supplier_request_assigned_review_v1')) return [{ result: options.review === undefined ? review() : options.review }];
      if (sql.includes('nexid_mutate_supplier_request_review_v1')) return [{ result: options.writeReview === undefined ? { ...review(), ok: true, idempotent_replay: false, receipt: { idempotency_key: key, action: 'request_information', revision: 1 } } : options.writeReview }];
      return [{ result }];
    },
  };
  return { assigned, handlers: assigned ? makeAssignedSupplierRequestHandlers(value) : makeSupplierRequestAssignmentHandlers(value), queries, capabilities };
}
async function call(deps, action, options = {}) {
  const write = ['post','reviewPost'].includes(action), query = options.query ?? (deps.assigned || action === 'candidates' ? '' : '?tenant=qa-a');
  const req = new Request(`http://localhost/admin/supplier-requests/${deps.assigned ? 'assigned/' : ''}${id}${query}`, { method: write ? 'POST' : 'GET', headers: { authorization: 'Bearer synthetic-session', 'x-admin-tenant': 'foreign', 'x-admin-user-id': otherActor, ...(write ? { 'content-type': 'application/json', 'idempotency-key': key } : {}), ...options.headers }, ...(write ? { body: typeof options.body === 'string' ? options.body : JSON.stringify(options.body ?? (deps.assigned ? question : command)) } : {}) });
  const response = await deps.handlers[action](req,options.id ?? id);
  assert.match(response.headers.get('cache-control'),/private.*no-store/); assert.equal(response.headers.get('referrer-policy'),'no-referrer');
  return { status: response.status, body: await response.json() };
}

test('assignment command has exact source revisions and explicit nullable operator, never arbitrary actor or scope', () => {
  assert.deepEqual(parseSupplierRequestAssignmentCommand(command),command);
  assert.deepEqual(parseSupplierRequestAssignmentCommand({...command,operator_id:null}),{...command,operator_id:null});
  for (const value of [null,[],{}, {...command,operator_id:undefined},{...command,operator_id:'bad'},{...command,expected_revision:-1},{...command,expected_revision:'1'},{...command,expected_request_revision:0},{...command,expected_request_revision:2147483647},{...command,tenant_id:otherTenant},{...command,actor_id:otherActor},{...command,action:'assign'}]) assert.throws(()=>parseSupplierRequestAssignmentCommand(value));
  assert.equal(supplierRequestAssignmentFromRow(assignment()).assignment.operator_id,actor);
});

test('real human role, denied permission, service account, invalid session and bound tenant fail before assignment queries', async () => {
  for (const action of ['get','post','candidates']) {
    for (const patch of [{role:'supplier-operator',permissions:['*']},{role:'tenant-owner',tenantId:tenant,tenantSlug:'qa-a',permissions:['*']},{role:'viewer',tenantId:tenant,tenantSlug:'qa-a',permissions:['*']},{role:'api-integration',tenantId:tenant,tenantSlug:'qa-a',permissions:['*']},{deniedPermissions:['supplier_request.assign']},{deniedPermissions:['supplier_requests:assign']},{tenantId:tenant,tenantSlug:'qa-a'}]) {
      const deps=setup(false,{session:patch}); assert.equal((await call(deps,action)).status,403); assert.equal(deps.queries.length,0);
    }
    for (const resolver of [async()=>null,async()=>{throw Error('PRIVATE_AUTH_TOKEN');}]) { const deps=setup(false,{resolver});const result=await call(deps,action);assert.ok([401,503].includes(result.status));assert.equal(deps.queries.length,0);assert.doesNotMatch(JSON.stringify(result),/PRIVATE/); }
  }
});

test('assigned namespace rejects superadmin and every role or scope other than a currently authorized supplier operator', async () => {
  for (const action of ['list','get','reviewGet','reviewPost']) {
    for (const patch of [{role:'super-admin',permissions:['*']},{role:'operations-manager',tenantId:tenant,tenantSlug:'qa-a',permissions:['*']},{role:'api-integration',permissions:['*']},{role:'unknown',permissions:['*']},{permissions:[]},{deniedPermissions:['*']},{tenantId:tenant,tenantSlug:'qa-a'}]) {
      const deps=setup(true,{session:patch});assert.equal((await call(deps,action)).status,403);assert.equal(deps.queries.length,0);
    }
    const missing=setup(true,{resolver:async()=>null});assert.equal((await call(missing,action)).status,401);assert.equal(missing.queries.length,0);
  }
});

test('assigned list/detail/history SQL is bound to principal actor and session; no tenant selector reaches the database', async () => {
  for (const action of ['list','get','reviewGet']) {
    const deps=setup(true),result=await call(deps,action);assert.equal(result.status,200);assert.deepEqual(result.body.scope,{mode:'assigned',operator_id:actor});assert.equal(deps.queries.length,1);
    assert.ok(deps.queries[0].values.includes(actor));assert.ok(deps.queries[0].values.includes(sessionId));assert.ok(!deps.queries[0].values.includes(otherActor));
    for (const query of ['?tenant=qa-a','?tenant=qa-a&tenant=qa-b','?operator_id='+otherActor,'?scope=global','?unknown=1']) { const denied=setup(true);assert.equal((await call(denied,action,{query})).status,400);assert.equal(denied.queries.length,0); }
  }
  for (const query of ['?limit=0','?limit=101','?limit=1&limit=2','?status=submitted']) { const deps=setup(true);assert.equal((await call(deps,'list',{query})).status,400);assert.equal(deps.queries.length,0); }
  for (const query of ['?before_revision=0','?before_revision=1&before_revision=2','?before_revision=2147483647']) { const deps=setup(true);assert.equal((await call(deps,'reviewGet',{query})).status,400);assert.equal(deps.queries.length,0); }
  const limited=setup(true);assert.equal((await call(limited,'list',{query:'?limit=1'})).status,200);assert.equal(limited.queries[0].values.at(-1),1);
});

test('assigned question derives its tenant from the authorized row and emits one mutation with both revisions', async () => {
  const deps=setup(true),result=await call(deps,'reviewPost');assert.equal(result.status,200);assert.equal(deps.queries.length,2);
  const input=JSON.parse(deps.queries[1].values[0]);assert.deepEqual(input,{...question,tenant_id:tenant,request_id:id,actor_id:actor,auth_session_id:sessionId,idempotency_key:key});
  assert.deepEqual(deps.capabilities,['supplier_request.assigned.review']);assert.doesNotMatch(deps.queries.map(q=>q.sql).join('\n'),/batch_keys|supplier_orders|manifest/);
  for (const body of [{...question,action:'respond'},{...question,tenant_id:otherTenant},{...question,actor_id:otherActor}]) { const invalid=setup(true);assert.ok([400,403].includes((await call(invalid,'reviewPost',{body})).status));assert.equal(invalid.queries.length,0); }
  const revoked=setup(true,{current:null});assert.equal((await call(revoked,'reviewPost')).status,404);assert.equal(revoked.queries.length,1);
  for(const source of [row({tenant_id:otherTenant,tenant_slug:'qa-b',assignment:{operator_id:otherActor,revision:1,updated_at:time}}),row({id:otherActor})]) { const invalid=setup(true,{current:source});assert.equal((await call(invalid,'reviewPost')).status,503);assert.equal(invalid.queries.length,1); }
});

test('missing and unassigned records have identical not-found responses; malformed assigned data never becomes an empty success', async () => {
  for(const action of ['get','reviewGet']) { const deps=setup(true,{current:null,review:null});const result=await call(deps,action);assert.equal(result.status,404);assert.equal(result.body.reason,'supplier_request_not_found'); }
  for(const current of [row({assignment:{operator_id:otherActor,revision:1,updated_at:time}}),row({assignment:undefined}),row({status:'draft',submitted_at:null,submitted_by:null}),row({id:otherActor}),row({review_summary:undefined})]) assert.equal((await call(setup(true,{current}),'get')).status,503);
  for(const list of [undefined,{}, {items:[row()],count:0,truncated:false},{items:[row(),row()],count:2,truncated:false},{items:[],count:0,truncated:true}]) { if(list===undefined)continue;assert.equal((await call(setup(true,{list}),'list')).status,503); }
  assert.equal((await call(setup(true,{list:null}),'list')).status,403);
});

test('SA candidates are minimum identities, globally bounded and never accessible through supplied tenant filters', async () => {
  const deps=setup(),result=await call(deps,'candidates');assert.equal(result.status,200);assert.deepEqual(result.body.operators,[{id:actor,display_name:'Operador sintético'}]);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|email|permissions/);assert.match(deps.queries[0].sql,/eligible_v1/);
  for(const query of ['?tenant=qa-a','?limit=1','?user_id='+otherActor]) { const invalid=setup();assert.equal((await call(invalid,'candidates',{query})).status,400);assert.equal(invalid.queries.length,0); }
  const duplicated=setup(false,{candidates:[{id:actor,display_name:'A'},{id:actor,display_name:'B'}]});assert.equal((await call(duplicated,'candidates')).status,503);
});

test('assignment receipt is exact and a retry can return a newer current assignment without overwriting it', async () => {
  const deps=setup(),result=await call(deps,'post');assert.equal(result.status,200);assert.equal(deps.queries.length,2);
  assert.deepEqual(JSON.parse(deps.queries.at(-1).values[0]),{...command,tenant_id:tenant,request_id:id,actor_id:actor,auth_session_id:sessionId,idempotency_key:key});
  const advanced=assignment({assignment:{operator_id:otherActor,revision:2,updated_at:later},history:[...assignment().history,{id:otherActor,revision:2,request_revision:2,action:'assign',operator_id:otherActor,actor_id:actor,created_at:later}],count:2});
  const replay=await call(setup(false,{result:{...advanced,ok:true,idempotent_replay:true,receipt:{idempotency_key:key,action:'assign',revision:1}}}),'post');
  assert.equal(replay.status,200);assert.equal(replay.body.receipt.revision,1);assert.equal(replay.body.assignment.operator_id,otherActor);assert.equal(replay.body.assignment.revision,2);
  for(const patch of [{receipt:{idempotency_key:otherActor,action:'assign',revision:1}},{receipt:{idempotency_key:key,action:'assign',revision:2}},{receipt:{idempotency_key:key,action:'unassign',revision:1}},{tenant_id:otherTenant},{request_id:otherActor},{assignment:{operator_id:otherActor,revision:1,updated_at:time}}]) {
    const bad=setup(false,{result:{...assignment(),ok:true,idempotent_replay:false,receipt:{idempotency_key:key,action:'assign',revision:1},...patch}});assert.equal((await call(bad,'post')).status,503);assert.equal(bad.queries.filter(q=>q.sql.includes('nexid_mutate')).length,1);
  }
});

test('post-commit readback uncertainty and SQL failures stay generic503; current DB denial or conflict remains explicit', async () => {
  for(const patch of [{tenant_id:otherTenant},{request_id:otherActor},{receipt:{idempotency_key:key,action:'request_information',revision:2}},{history:[]}]) {
    const deps=setup(true,{writeReview:{...review(),ok:true,idempotent_replay:false,receipt:{idempotency_key:key,action:'request_information',revision:1},...patch}});assert.equal((await call(deps,'reviewPost')).status,503);assert.equal(deps.queries.filter(q=>q.sql.includes('nexid_mutate')).length,1);
  }
  for(const [reason,status] of [['supplier_request_review_scope_forbidden',403],['supplier_request_review_revision_conflict',409],['supplier_request_review_idempotency_conflict',409]]) assert.equal((await call(setup(true,{writeReview:{ok:false,reason}}),'reviewPost')).status,status);
  for(const assigned of [false,true]) { const result=await call(setup(assigned,{throwQuery:true}),assigned?'list':'get');assert.equal(result.status,503);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|TOKEN|SQL/); }
});

test('assignment and assigned routes expose only their dedicated handlers', async () => {
  const cases=[['../src/app/admin/supplier-requests/[requestId]/assignment/route.ts',['handlers.get','handlers.post']],['../src/app/admin/supplier-requests/operators/route.ts',['handlers.candidates']],['../src/app/admin/supplier-requests/assigned/route.ts',['handlers.list']],['../src/app/admin/supplier-requests/assigned/[requestId]/route.ts',['handlers.get']],['../src/app/admin/supplier-requests/assigned/[requestId]/review/route.ts',['handlers.reviewGet','handlers.reviewPost']]];
  for(const [path,expected] of cases){const source=await readFile(new URL(path,import.meta.url),'utf8');for(const value of expected)assert.ok(source.includes(value),path);assert.doesNotMatch(source,/ensureSchema|createSupplierOrder|generateBatch|demo/);}
});
