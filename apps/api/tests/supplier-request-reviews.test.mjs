import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { checkAdminWithPermission } from '../src/lib/auth.ts';
import { makeSupplierRequestReviewHandlers } from '../src/lib/supplier-request-review-http.ts';
import { parseSupplierRequestReviewCommand, parseSupplierRequestReviewQuery, supplierRequestReviewFromRow } from '../src/lib/supplier-request-review-contract.ts';
import { supplierRequestFromRow } from '../src/lib/supplier-request-contract.ts';
import { validateSupplierRequestConversion, supplierRequestConversionError } from '../src/lib/supplier-request-store.ts';

const tenant = '10000000-0000-4000-8000-000000000001', otherTenant = '10000000-0000-4000-8000-000000000002';
const actor = '20000000-0000-4000-8000-000000000001', sessionId = '30000000-0000-4000-8000-000000000001';
const id = '40000000-0000-4000-8000-000000000001', key = '50000000-0000-4000-8000-000000000001';
const at = revision => new Date(Date.UTC(2026,8,23,12,0,revision)).toISOString();
const input = { action: 'request_information', message: '¿Dónde se instalará la etiqueta?', expected_revision: 0, expected_request_revision: 2 };
const session = (patch = {}) => ({ id: sessionId, userId: actor, email: 'qa@example.invalid', label: 'Synthetic actor', role: 'super-admin', tenantId: null, tenantSlug: null,
  permissions: ['supplier_order.create'], deniedPermissions: [], mfaVerified: false, expiresAt: new Date(Date.now()+60000).toISOString(), rotatedCookieValue: null, setupCompleted: true, ...patch });
const company = { role: 'operations-manager', tenantId: tenant, tenantSlug: 'qa-a' };
function record(revision = 0, before = null) {
  const upper = Math.min(revision, before === null ? revision : before - 1), first = Math.max(1, upper - 99);
  const history = Array.from({ length: upper - first + 1 }, (_, index) => { const eventRevision = first + index; return {
    id: `60000000-0000-4000-8000-${String(eventRevision).padStart(12,'0')}`, revision: eventRevision, request_revision: 2, action: eventRevision%2 ? 'request_information' : 'respond',
    message: eventRevision%2 ? input.message : 'Se instalará en la tapa.', actor_id: actor, created_at: at(eventRevision),
  }; });
  return { tenant_id: tenant, tenant_slug: 'qa-a', request_id: id, request_revision: 2,
    review: { state: revision === 0 ? 'pending' : revision%2 ? 'needs_information' : 'answered', revision, updated_at: revision ? at(revision) : null },
    history, count: history.length, truncated: first > 1, next_before_revision: first > 1 ? first : null };
}
function deps(options = {}) {
  const calls = [];
  const result = options.result === undefined ? record() : options.result;
  return { calls, handlers: makeSupplierRequestReviewHandlers({
    authorize: (req, permission) => checkAdminWithPermission(req, permission, options.resolver || (async () => session(options.session))),
    query: async (strings, ...values) => {
      const statement = strings.join('?'); calls.push({ statement, values });
      if (/FROM public\.tenants/.test(statement)) return options.tenantRows || [{ id: tenant, slug: 'qa-a' }];
      if (options.throwSql) throw Error('PRIVATE_CONNECTION_CREDENTIAL');
      return [{ result }];
    },
  }) };
}
async function call(adapter, write = false, body = input, query = '?tenant=qa-a', headers = {}) {
  const req = new Request(`http://localhost/admin/supplier-requests/${id}/review${query}`, { method: write ? 'POST' : 'GET',
    headers: { authorization: 'Bearer synthetic-local-session', ...(write ? { 'content-type': 'application/json', 'idempotency-key': key } : {}), ...headers },
    ...(write ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
  const result = await adapter.handlers[write ? 'post' : 'get'](req, id);
  assert.match(result.headers.get('cache-control'), /private.*no-store/); assert.equal(result.headers.get('referrer-policy'), 'no-referrer');
  return { status: result.status, body: await result.json() };
}
const success = (revision=1, patch={}) => ({ ok: true, ...record(revision), idempotent_replay: false,
  receipt: { idempotency_key: key, action: 'request_information', revision: 1 }, ...patch });

test('review contract preserves public clarification text, closes fields and bounds both revisions', () => {
  assert.deepEqual(parseSupplierRequestReviewCommand(input), input);
  assert.equal(parseSupplierRequestReviewCommand({ ...input, message: '  Texto\nPúblico  ' }).message, '  Texto\nPúblico  ');
  for (const change of [{ extra: true }, { action: 'approve' }, { message: '' }, { message: ' ' }, { message: 'x'.repeat(2001) }, { message: 'TOKEN=synthetic-private' }, { message: 'bad\u0001text' }, { expected_revision: -1 }, { expected_revision: '0' }, { expected_revision: 2147483647 }, { expected_request_revision: 0 }, { expected_request_revision: '2' }]) assert.throws(() => parseSupplierRequestReviewCommand({ ...input, ...change }));
  for (const query of ['tenant=qa-a&tenant=qa-b', 'tenant=qa-a&before_revision=0', 'tenant=qa-a&before_revision=2147483647', 'tenant=qa-a&limit=100', 'tenant=qa-a&before_revision=2&before_revision=3']) assert.throws(() => parseSupplierRequestReviewQuery(new URLSearchParams(query), true));
  assert.throws(() => parseSupplierRequestReviewQuery(new URLSearchParams('tenant=qa-a&before_revision=2'), false));
});
test('review endpoints authenticate live human permission and reject missing, foreign or ambiguous tenant scope', async () => {
  for (const patch of [{ role: 'viewer' }, { role: 'api-integration' }, { deniedPermissions: ['supplier_order.create'] }, { deniedPermissions: ['supplier_orders:write'] }, { ...company, permissions: [] }]) {
    const adapter=deps({ session:patch }); assert.ok([401,403].includes((await call(adapter)).status)); assert.equal(adapter.calls.length,0);
  }
  for (const resolver of [async()=>null, async()=>{ throw Error('PRIVATE_RESOLVER'); }]) { const adapter=deps({resolver}); assert.ok([401,503].includes((await call(adapter)).status)); assert.equal(adapter.calls.length,0); }
  for (const query of ['', '?tenant=qa-b', '?tenant=qa-a&tenant=qa-b']) { const adapter=deps({session:company}); assert.ok([400,403].includes((await call(adapter,false,input,query)).status)); assert.equal(adapter.calls.length,0); }
  const wrongTenant=deps({ session:company,tenantRows:[{ id:otherTenant,slug:'qa-a' }] }); assert.equal((await call(wrongTenant)).status,403);
  const foreignRow=deps({ result:{...record(),tenant_id:otherTenant} }); assert.equal((await call(foreignRow)).status,503);
});
test('only NexID asks and only the exact tenant answers, without key generation or MFA requirements', async () => {
  const deniedAsk=deps({session:company}); assert.equal((await call(deniedAsk,true)).status,403); assert.equal(deniedAsk.calls.length,1);
  const deniedReply=deps(); assert.equal((await call(deniedReply,true,{...input,action:'respond',expected_revision:1})).status,403); assert.equal(deniedReply.calls.length,1);
  const ask=deps({result:success()}); const asked=await call(ask,true); assert.equal(asked.status,200); assert.equal(asked.body.review.state,'needs_information');
  const stored=JSON.parse(ask.calls[1].values[0]); assert.deepEqual(stored,{...input,tenant_id:tenant,actor_id:actor,auth_session_id:sessionId,request_id:id,idempotency_key:key});
  const replyInput={...input,action:'respond',message:'Se instalará en la tapa.',expected_revision:1};
  const reply=deps({session:company,result:success(2,{receipt:{idempotency_key:key,action:'respond',revision:2}})});
  assert.equal((await call(reply,true,replyInput)).body.review.state,'answered');
  assert.doesNotMatch(ask.calls.map(x=>x.statement).join(' '),/batch_keys|create_supplier_order|INSERT INTO.*batches/);
});
test('review GET excludes drafts, validates history scope and strips private receipt storage', async () => {
  assert.equal((await call(deps({result:null}))).status,404);
  const raw=record(1); raw.history[0].auth_session_id=sessionId; raw.history[0].fingerprint='PRIVATE'; raw.history[0].audit_id=key;
  const result=await call(deps({result:raw})); assert.equal(result.status,200); assert.doesNotMatch(JSON.stringify(result),/auth_session_id|fingerprint|audit_id|PRIVATE/);
  assert.equal(result.body.protocol,'nexid.supplier-request-review.v1'); assert.equal(result.body.scope.tenant_id,tenant);
  assert.deepEqual(result.body.review,raw.review);
});
test('history pagination validates exact boundaries and keeps current state with an older chronological window', async () => {
  const latest=record(103), earlier=record(103,4); assert.equal(supplierRequestReviewFromRow(latest).history[0].action,'respond');
  assert.equal(supplierRequestReviewFromRow(earlier,4).review.revision,103);
  const adapter=deps({result:earlier}); assert.equal((await call(adapter,false,input,'?tenant=qa-a&before_revision=4')).status,200); assert.equal(adapter.calls[1].values[2],4);
  for (const malformed of [{...earlier,history:[],count:0,truncated:false,next_before_revision:null}, {...earlier,history:earlier.history.slice(1),count:2}, {...latest,review:{...latest.review,updated_at:at(1)}}, {...latest,next_before_revision:3}, {...latest,history:latest.history.slice(0,-1),count:99}]) assert.throws(()=>supplierRequestReviewFromRow(malformed, malformed===earlier ? 4 : null));
  assert.throws(()=>supplierRequestReviewFromRow({...earlier,history:[],count:0,truncated:false,next_before_revision:null},4));
  assert.throws(()=>supplierRequestReviewFromRow({...earlier,history:earlier.history.slice(0,2),count:2},4));
});
test('idempotent replay confirms the original receipt while returning subsequent review and provisioning revisions', async () => {
  const raw=success(2,{idempotent_replay:true,request_revision:3}); const result=await call(deps({result:raw}),true);
  assert.equal(result.status,200); assert.equal(result.body.receipt.revision,1); assert.equal(result.body.review.revision,2); assert.equal(result.body.request_revision,3);
  for (const reason of ['supplier_request_not_submitted','supplier_request_revision_conflict','supplier_request_review_revision_conflict','supplier_request_review_idempotency_conflict','supplier_request_review_transition_invalid']) {
    const response=await call(deps({result:{ok:false,reason}}),true); assert.equal(response.status,409); assert.equal(response.body.reason,reason);
  }
});
test('malformed post-commit review readback remains uncertain, and input validation never writes', async () => {
  for (const result of [success(1,{receipt:{idempotency_key:id,action:'request_information',revision:1}}),success(1,{receipt:{idempotency_key:key,action:'respond',revision:1}}),success(2),success(1,{history:[]}),success(1,{tenant_slug:'foreign'}),success(1,{idempotent_replay:'true'}),{ok:false,reason:'PRIVATE_SQL'}]) {
    const adapter=deps({result}), response=await call(adapter,true); assert.equal(response.status,503); assert.equal(adapter.calls.length,2); assert.doesNotMatch(JSON.stringify(response),/PRIVATE/);
  }
  for (const [body,headers] of [['{bad',{}],[{...input,message:'x'.repeat(17000)},{}],[input,{'content-type':'text/plain'}],[input,{'idempotency-key':'invalid'}]]) {
    const adapter=deps(); assert.ok([400,413,415].includes((await call(adapter,true,body,undefined,headers)).status)); assert.equal(adapter.calls.length,1);
  }
  assert.equal((await call(deps({throwSql:true}),true)).status,503);
});
test('v1 request summary remains additive and conversion refuses unresolved commercial clarification', async () => {
  const request={id,tenant_id:tenant,tenant_slug:'qa-a',title:'Solicitud',construction_id:'pet_wet',quantity:125,pack_purpose:'trial_integration',notes:'',status:'submitted',revision:2,created_by:actor,updated_by:actor,submitted_by:actor,created_at:at(0),updated_at:at(0),submitted_at:at(0),order_id:null};
  assert.throws(()=>supplierRequestFromRow(request),/supplier_request_record_invalid/);
  assert.deepEqual(supplierRequestFromRow({...request,review_summary:record().review}).review_summary,{state:'pending',revision:0,updated_at:null});
  const technical={quantity:125,purpose:'trial_integration',carrier:'ntag424_dna',chip:'NTAG424_DNA',material:'transparent_pet_wet_inlay'};
  await assert.rejects(validateSupplierRequestConversion({id,revision:2},{...session(),scope:'super_admin'},{id:tenant,slug:'qa-a'},technical,async()=>[{...request,review_summary:record(1).review}]),error=>error.status===409&&error.message==='supplier_request_information_required');
  assert.equal((await validateSupplierRequestConversion({id,revision:2},{...session(),scope:'super_admin'},{id:tenant,slug:'qa-a'},technical,async()=>[{...request,review_summary:record(2).review}])).id,id);
  assert.equal(supplierRequestConversionError(Error('supplier_request_information_required')).status,409);
});
test('review route exposes only GET and POST with the bounded review handlers', async () => {
  const source=await readFile(new URL('../src/app/admin/supplier-requests/[requestId]/review/route.ts',import.meta.url),'utf8');
  assert.match(source,/export async function GET/); assert.match(source,/export async function POST/); assert.doesNotMatch(source,/export async function (PUT|PATCH|DELETE)/);
});
