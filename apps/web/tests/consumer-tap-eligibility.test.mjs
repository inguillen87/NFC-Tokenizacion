import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import * as custody from '../src/app/api/_lib/consumer-tap-handoff.ts';

// Actual server bridge; transport is synthetic and can never contact a provider.
const source = readFileSync(new URL('../src/app/api/_lib/consumer-tap-eligibility.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const loaded = { exports: {} };
new Function('require', 'module', 'exports', compiled)(name => {
  if (name === 'server-only') return {};
  if (name === '@product/config') return { productUrls: { api: 'https://api.nexid.example' } };
  if (name === './consumer-tap-handoff') return custody;
  if (name === './server-api-transport') return { fetchRuntimeApi: () => assert.fail('No default network is allowed') };
  throw new Error('Unexpected test dependency');
}, loaded, loaded.exports);
const { proxyConsumerTapEligibility } = loaded.exports;
const ORIGIN = 'https://nexid.example', PATH = '/api/consumer/tap-eligibility', EVENT = '715', NOW = 1_800_000_000_000;
const SESSION = 'a'.repeat(48), CAP_COOKIE = `${custody.CONSUMER_TAP_CAPABILITY_COOKIE_PREFIX}${EVENT}`;
const schema = 'nexid.consumer-tap-eligibility/v1';
function token(overrides = {}) {
  // Forged envelope: only API may authenticate signatures, bindings and replay status.
  return `${Buffer.from(JSON.stringify({ purpose: 'sun_fresh_handoff', eventId: EVENT, iat: NOW / 1000 - 10, exp: NOW / 1000 + 120, ...overrides })).toString('base64url')}.${'a'.repeat(43)}`;
}
function request(query = `eventId=${EVENT}`, headers = {}, options = {}) {
  return new Request(`${options.origin ?? ORIGIN}${options.path ?? PATH}?${query}`, { ...options, headers: {
    'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty', 'x-nexid-consumer-tap-eligibility': '1',
    cookie: `nexid_consumer_session=${SESSION}; ${CAP_COOKIE}=${token()}`, ...headers,
  } });
}
const allowed = () => ({ allowed: true, reason: 'allowed', freshTapRequired: false });
const denied = (reason = 'tap_action_not_allowed') => ({ allowed: false, reason, freshTapRequired: reason === 'fresh_tap_required' });
const dto = () => ({ ok: true, schema, eventId: EVENT, actions: { save: allowed(), join: denied('membership_inactive'), rewards: denied('program_unavailable'), claim: {...allowed(),nextStep:'enter_pin'} } });
const call = (req = request(), fetchImpl = async () => Response.json(dto()), options = {}) => proxyConsumerTapEligibility(req, { nowMs: NOW, fetchImpl, ...options });
const mustNotForward = () => assert.fail('Rejected browser request must not reach API');
function assertPrivate(response) {
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('vary'), 'Cookie');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('set-cookie'), null);
}
async function assertFailure(response, status, error, freshTapRequired = false) {
  assert.equal(response.status, status); assertPrivate(response);
  assert.deepEqual(await response.json(), { ok: false, error, freshTapRequired });
}

test('same-origin AJAX GET without Origin preserves only context, session and server capability', async () => {
  let requests = 0;
  const fresh = token();
  const incoming = request('bid=Lot-QA&tenant=Tenant-QA&eventId=715', {
    cookie: `nexid_consumer_session=${SESSION}; ${CAP_COOKIE}=${fresh}; nexid_tap_716=private; __Host-nexid_tap_717=private; locale=es; admin=private`,
    authorization: 'Bearer caller-private', 'x-nexid-consumer-tap-capability': 'caller-private',
    'x-api-key': 'caller-private', 'x-vercel-protection-bypass': 'caller-private', 'x-vercel-set-bypass-cookie': 'true',
    'x-forwarded-for': '192.0.2.1', 'user-agent': 'synthetic-mobile',
  });
  const response = await call(incoming, async (url, init) => {
    requests++;
    assert.equal(url, 'https://api.nexid.example/consumer/tap-eligibility?eventId=715&tenant=Tenant-QA&bid=Lot-QA');
    assert.ok(!url.includes(fresh)); assert.ok(!url.includes(SESSION));
    assert.equal(init.method, 'GET'); assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'error'); assert.equal(init.body, undefined);
    assert.ok(init.signal instanceof AbortSignal);
    assert.deepEqual(init.headers, { accept: 'application/json', cookie: `nexid_consumer_session=${SESSION}`, 'x-nexid-consumer-tap-capability': fresh });
    return Response.json(dto(), { headers: { 'set-cookie': `${CAP_COOKIE}=renewed; Max-Age=300; HttpOnly; Secure`, 'x-private-key': 'provider-private', location: 'https://foreign.invalid', 'cache-control': 'public, max-age=600' } });
  });
  assert.equal(requests, 1); assert.equal(response.status, 200); assertPrivate(response);
  assert.equal(response.headers.get('location'), null); assert.equal(response.headers.get('x-private-key'), null);
  const text = await response.text(); assert.deepEqual(JSON.parse(text), dto());
  for (const privateValue of [fresh, SESSION, 'caller-private', 'provider-private', 'renewed']) assert.ok(!text.includes(privateValue));
  assert.equal(incoming.headers.get('cookie').includes(fresh), true, 'read does not consume/change custody');
});

test('an explicit exact Origin can omit Fetch Metadata; missing both cannot establish same-origin intent', async () => {
  const req = request(undefined, { origin: ORIGIN }); req.headers.delete('sec-fetch-site');
  assert.equal((await call(req)).status, 200);
  const noOriginOrMetadata = request(); noOriginOrMetadata.headers.delete('sec-fetch-site');
  await assertFailure(await call(noOriginOrMetadata, mustNotForward), 403, 'same_origin_required');
});

test('standard empty destination without Origin reaches identity checks, never upstream without a session', async () => {
  const anonymous = request(undefined, { cookie: '' });
  assert.equal(anonymous.headers.get('origin'), null);
  assert.equal(anonymous.headers.get('sec-fetch-site'), 'same-origin');
  assert.equal(anonymous.headers.get('sec-fetch-dest'), 'empty');
  let forwards = 0;
  await assertFailure(await call(anonymous, () => { forwards++; assert.fail('Anonymous request must not reach API'); }), 401, 'unauthorized');
  assert.equal(forwards, 0);
});

test('absent and legacy empty destination keep the same private transport contract', async () => {
  for (const destination of [null, '']) {
    const req = request(undefined, { 'sec-fetch-dest': destination ?? 'empty' });
    if (destination === null) req.headers.delete('sec-fetch-dest');
    let forwards = 0;
    const response = await call(req, async (_url, init) => {
      forwards++; assert.equal(init.method, 'GET'); assert.equal(init.cache, 'no-store'); return Response.json(dto());
    });
    assert.equal(response.status, 200); assertPrivate(response); assert.equal(forwards, 1);
    assert.deepEqual(await response.json(), dto());
  }
});

test('cross-site, sibling-origin, navigation and missing/ambiguous intentional headers fail before transport', async () => {
  const headers = [
    { origin: 'https://other.nexid.example' }, { origin: 'https://foreign.invalid' }, { origin: 'null' }, { origin: '' },
    { 'sec-fetch-site': 'same-site' }, { 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': 'none' },
    { origin: ORIGIN, 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-mode': 'navigate' }, { 'sec-fetch-mode': 'no-cors' }, { 'sec-fetch-mode': 'websocket' },
    ...['document', 'iframe', 'frame', 'image', 'script', 'style', 'worker', 'unknown', 'Empty', 'empty, document', 'empty, empty'].map(destination => ({ 'sec-fetch-dest': destination })),
    { 'sec-fetch-user': '?1' }, { 'sec-fetch-user': '?0' }, { 'sec-fetch-user': '' },
    { 'sec-fetch-site': 'same-origin, same-origin' }, { 'sec-fetch-mode': 'cors, same-origin' },
    { 'x-nexid-consumer-tap-eligibility': '' }, { 'x-nexid-consumer-tap-eligibility': '1, 1' }, { 'x-nexid-consumer-tap-eligibility': 'true' },
  ];
  for (const input of headers) await assertFailure(await call(request(undefined, input), mustNotForward), 403, 'same_origin_required');
  const absentIntent = request(); absentIntent.headers.delete('x-nexid-consumer-tap-eligibility');
  await assertFailure(await call(absentIntent, mustNotForward), 403, 'same_origin_required');
});

test('only the explicit GET path can forward; POST, HEAD and route aliases do not mutate or relay', async () => {
  for (const options of [{ method: 'POST' }, { method: 'HEAD' }, { path: `${PATH}/` }, { path: '/api/consumer/other' }]) {
    await assertFailure(await call(request(undefined, {}, options), mustNotForward), 405, 'method_not_allowed');
  }
});

test('query allowlist rejects tokens, duplicates, unsafe numeric identifiers and unbounded context', async () => {
  const invalid = [
    '', 'eventId=0', 'eventId=0715', 'eventId=-1', 'eventId=1.5', 'eventId=1e3', 'eventId=9007199254740992',
    'eventId=10000000000000000', 'eventId=715&eventId=715', 'eventId=715&tenant=t&tenant=t', 'eventId=715&bid=b&bid=b',
    'eventId=715&freshToken=secret', 'eventId=715&sun_fresh=secret', 'eventId=715&action=save',
    'eventId=715&tenant=', 'eventId=715&bid=%20', `eventId=715&tenant=${'a'.repeat(129)}`, `eventId=715&bid=${'a'.repeat(129)}`,
    'eventId=715&tenant=t%00x', 'eventId=715&bid=b%7fx', 'eventId=715&tenant=%0aTenant-QA',
    'eventId=715&bid=Lot-QA%0d', `eventId=715&tenant=${'%20'.repeat(128)}t`, `eventId=715&tenant=${'%61'.repeat(400)}`,
  ];
  for (const query of invalid) await assertFailure(await call(request(query), mustNotForward), 400, 'invalid_context');
  const clean = await call(request('eventId=9007199254740991&tenant=%20Tenant-QA%20&bid=%20Lot-QA%20'), async (url) => {
    assert.equal(new URL(url).search, '?eventId=9007199254740991&tenant=Tenant-QA&bid=Lot-QA');
    return Response.json({ ...dto(), eventId: '9007199254740991' });
  });
  // Cookie is bound to715, so even a safe alternate event does not inherit its capability.
  await assertFailure(clean, 403, 'fresh_tap_required', true);
  const normalized = await call(request('eventId=715&tenant=%20Tenant-QA%20&bid=%20Lot-QA%20'), async (url) => {
    assert.equal(new URL(url).search, '?eventId=715&tenant=Tenant-QA&bid=Lot-QA'); return Response.json(dto());
  });
  assert.equal(normalized.status, 200);
});

test('absent, malformed, ambiguous consumer session cannot be replaced by capability or bearer', async () => {
  for (const cookie of [`${CAP_COOKIE}=${token()}`, `nexid_consumer_session=invalid; ${CAP_COOKIE}=${token()}`,
    `nexid_consumer_session=${SESSION}; nexid_consumer_session=${SESSION}; ${CAP_COOKIE}=${token()}`,
    `nexid_consumer_session=${SESSION.toUpperCase()}; ${CAP_COOKIE}=${token()}`, `nexid_consumer_session=%; ${CAP_COOKIE}=${token()}`]) {
    await assertFailure(await call(request(undefined, { cookie, authorization: `Bearer ${SESSION}` }), mustNotForward), 401, 'unauthorized');
  }
  const result = await call(request(), async () => Response.json({ ok: false, error: 'unauthorized', freshTapRequired: false }, { status: 401 }));
  await assertFailure(result, 401, 'unauthorized');
});

test('missing, expired, malformed, other-event or duplicated capabilities fail without renewal', async () => {
  const session = `nexid_consumer_session=${SESSION}`;
  const invalid = ['', 'invalid', token({ exp: NOW / 1000 }), token({ eventId: '716' }), token({ iat: NOW / 1000 - 301, exp: NOW / 1000 + 1 })];
  for (const cap of invalid) await assertFailure(await call(request(undefined, { cookie: `${session}; ${CAP_COOKIE}=${cap}` }), mustNotForward), 403, 'fresh_tap_required', true);
  for (const cookie of [session, `${session}; ${CAP_COOKIE}=${token()}; ${CAP_COOKIE}=${token()}`, `${session}; nexid_tap_715=${token()}`]) {
    await assertFailure(await call(request(undefined, { cookie }), mustNotForward), 403, 'fresh_tap_required', true);
  }
});

test('local custody namespace is shared with handoff and cannot leak to hosted deployments', async () => {
  const previousNode = process.env.NODE_ENV, previousVercel = process.env.VERCEL;
  try {
    process.env.NODE_ENV = 'development'; delete process.env.VERCEL;
    for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000']) {
      const response = await call(request(undefined, { cookie: `nexid_consumer_session=${SESSION}; nexid_tap_715=${token()}` }, { origin }));
      assert.equal(response.status, 200); assertPrivate(response);
    }
    process.env.VERCEL = '1';
    await assertFailure(await call(request(undefined, { cookie: `nexid_consumer_session=${SESSION}; nexid_tap_715=${token()}` }, { origin: 'http://localhost:3000' }), mustNotForward), 403, 'fresh_tap_required', true);
  } finally {
    if (previousNode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNode;
    if (previousVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previousVercel;
  }
});

test('API owns signature/replay decisions and consumed TAP denies actions without implying claim permission', async () => {
  const spent = { ...dto(), actions: { save: denied('fresh_tap_required'), join: denied('fresh_tap_required'), rewards: denied('fresh_tap_required'), claim: {...denied('fresh_tap_required'),nextStep:'blocked'} } };
  const response = await call(request(), async () => Response.json(spent));
  assert.equal(response.status, 200); assertPrivate(response); assert.deepEqual(await response.json(), spent);
  await assertFailure(await call(request(), async () => Response.json({ ok: false, error: 'fresh_tap_required', freshTapRequired: true }, { status: 403 })), 403, 'fresh_tap_required', true);
});

test('success DTO is rebuilt from finite permissions and never echoes unknown credential or private fields', async () => {
  const payload = dto(); payload.consumer = { email: 'synthetic@example.invalid' }; payload.token = 'provider-private'; payload.expiresAt = 'private';
  payload.actions.claim.pin = 'provider-private'; payload.actions.save.token = 'provider-private'; payload.actions.save.maxAge = 300;
  const result = await call(request(), async () => Response.json(payload));
  assertPrivate(result); const text = await result.text(); assert.deepEqual(JSON.parse(text), dto());
  assert.doesNotMatch(text, /provider-private|synthetic@example|"pin"|maxAge|expiresAt|"consumer"/);
});

test('schema, event, booleans, reasons and allowed/fresh relationships must be internally consistent', async () => {
  const cases = [];
  for (const change of [{ ok: false }, { schema: 'other' }, { eventId: 715 }, { eventId: '716' }, { actions: null }]) cases.push({ ...dto(), ...change });
  for (const action of ['save', 'join', 'rewards', 'claim']) {
    for (const value of [null, {}, { ...allowed(), allowed: 'true' }, { ...allowed(), reason: null }, { ...allowed(), reason: 'provider-private' },
      { ...allowed(), freshTapRequired: true }, { ...allowed(), freshTapRequired: 'false' }, { ...allowed(), allowed: false },
      { ...denied(), allowed: true }, { ...denied('fresh_tap_required'), freshTapRequired: false }, { ...denied(), freshTapRequired: true }]) {
      cases.push({ ...dto(), actions: { ...dto().actions, [action]: value } });
    }
  }
  for (const value of cases) await assertFailure(await call(request(), async () => Response.json(value)), 503, 'eligibility_unavailable');
});

test('claim next step is finite and authorizes an attempt only, never an ownership assertion',async()=>{
  for(const nextStep of ['confirm','enter_pin']){
    const value=dto();value.actions.claim.nextStep=nextStep;
    const response=await call(request(),async()=>Response.json(value));assert.equal(response.status,200);assert.deepEqual(await response.json(),value);
  }
  for(const reason of ['claim_policy_configuration_required','ownership_manual_approval_required','pos_activation_pending','retailer_attestation_required','purchase_receipt_required','pin_policy_misconfigured','ownership_already_claimed']){
    const value=dto();value.actions.claim={...denied(reason),nextStep:'blocked'};
    const response=await call(request(),async()=>Response.json(value));assert.equal(response.status,200);assert.deepEqual(await response.json(),value);
  }
  for(const nextStep of [undefined,null,'blocked','owned',['confirm'],{},1]){
    const value=dto();value.actions.claim.nextStep=nextStep;await assertFailure(await call(request(),async()=>Response.json(value)),503,'eligibility_unavailable');
  }
  for(const nextStep of ['confirm','enter_pin']){
    const value=dto();value.actions.claim={...denied('ownership_already_claimed'),nextStep};await assertFailure(await call(request(),async()=>Response.json(value)),503,'eligibility_unavailable');
  }
});

test('finite upstream failures survive only their precise HTTP/error/fresh contract; all headers remain private', async () => {
  for (const [status, error, fresh] of [[400, 'invalid_context', false], [401, 'unauthorized', false], [403, 'fresh_tap_required', true], [503, 'eligibility_unavailable', false]]) {
    const response = await call(request(), async () => Response.json({ ok: false, error, freshTapRequired: fresh, secret: 'provider-private' }, { status, headers: { 'set-cookie': 'nexid_consumer_session=renewed; Max-Age=300', 'x-provider-debug': 'private' } }));
    await assertFailure(response, status, error, fresh);
    for (const value of [{ ok: true, error, freshTapRequired: fresh }, { ok: false, error: 'provider-private', freshTapRequired: fresh }, { ok: false, error, freshTapRequired: !fresh }]) {
      await assertFailure(await call(request(), async () => Response.json(value, { status })), 503, 'eligibility_unavailable');
    }
  }
});

test('redirects, unexpected statuses/types, malformed/oversized UTF8 JSON and exceptions never cross the BFF', async () => {
  const responses = [
    () => Response.redirect('https://foreign.invalid', 307), () => Response.json(dto(), { status: 201 }),
    () => Response.json({ provider: 'private' }, { status: 500 }), () => new Response('provider-private'),
    () => new Response('{', { headers: { 'content-type': 'application/json' } }),
    () => new Response(new Uint8Array([0xff, 0xff]), { headers: { 'content-type': 'application/json' } }),
    () => new Response('x'.repeat(4097), { headers: { 'content-type': 'application/json' } }),
    () => Response.json(dto(), { headers: { 'content-length': '4097' } }),
    () => Response.json(dto(), { headers: { 'content-length': 'invalid' } }),
    () => new Response(`{"padding":"${'é'.repeat(2100)}"}`, { headers: { 'content-type': 'application/json' } }),
  ];
  for (const response of responses) await assertFailure(await call(request(), async () => response()), 503, 'eligibility_unavailable');
  const redirected = Response.json(dto()); Object.defineProperty(redirected, 'redirected', { value: true });
  await assertFailure(await call(request(), async () => redirected), 503, 'eligibility_unavailable');
  await assertFailure(await call(request(), async () => { throw new Error('provider-private'); }), 503, 'eligibility_unavailable');
});

test('bounded deadline and browser abort end one GET; late responses cannot renew custody or trigger retries', async () => {
  let calls = 0, signal;
  const result = await call(request(), async (_url, init) => { calls++; signal = init.signal; return new Promise(() => {}); }, { timeoutMs: 15 });
  await assertFailure(result, 503, 'eligibility_unavailable'); assert.equal(calls, 1); assert.equal(signal.aborted, true);
  const hangingBody = await call(request(), async () => new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'application/json' } }), { timeoutMs: 15 });
  await assertFailure(hangingBody, 503, 'eligibility_unavailable');
  const controller = new AbortController(); controller.abort();
  await assertFailure(await call(request(undefined, {}, { signal: controller.signal }), mustNotForward), 503, 'eligibility_unavailable');
  const liveController = new AbortController(); let resolve;
  const pending = call(request(undefined, {}, { signal: liveController.signal }), async (_url, init) => {
    calls++; signal = init.signal; return new Promise(done => { resolve = done; });
  });
  liveController.abort(); await assertFailure(await pending, 503, 'eligibility_unavailable');
  resolve(Response.json(dto(), { headers: { 'set-cookie': 'nexid_consumer_session=renewed' } }));
  await new Promise(done => setTimeout(done, 0));
  assert.equal(signal.aborted, true); assert.equal(calls, 2);
});

test('base configuration rejects credentials, path/query redirects and non-loopback HTTP before transport', async () => {
  for (const apiBase of ['invalid', 'https://user:password@api.nexid.example', 'https://api.nexid.example/path', 'https://api.nexid.example?token=private', 'https://api.nexid.example/#private', 'http://foreign.invalid', 'ftp://localhost']) {
    await assertFailure(await call(request(), mustNotForward, { apiBase }), 503, 'eligibility_unavailable');
  }
});

test('the exact Next GET route calls the dedicated read-only bridge, not the generic proxy', async () => {
  const route = readFileSync(new URL('../src/app/api/consumer/tap-eligibility/route.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(route, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} }; let calls = 0;
  new Function('require', 'module', 'exports', code)(name => {
    assert.equal(name, '../../_lib/consumer-tap-eligibility');
    return { proxyConsumerTapEligibility: req => { calls++; return call(req); } };
  }, module, module.exports);
  assert.equal(module.exports.runtime, 'nodejs'); assert.equal(module.exports.dynamic, 'force-dynamic');
  assert.equal(module.exports.POST, undefined); assert.equal(module.exports.PATCH, undefined); assert.equal(module.exports.DELETE, undefined);
  const response = await module.exports.GET(request()); assert.equal(response.status, 200); assertPrivate(response); assert.equal(calls, 1);
});
