import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  CONSUMER_TAP_CAPABILITY_COOKIE_PREFIX,
  inspectConsumerTapCapability,
  prepareConsumerTapHandoff,
  proxyConsumerTapAction,
  stripConsumerTapCapabilityCookies,
} from '../src/app/api/_lib/consumer-tap-handoff.ts';

const ORIGIN = 'https://nexid.example';
const NOW = 1_800_000_000_000;
const EVENT_ID = '715';
const COOKIE = `${CONSUMER_TAP_CAPABILITY_COOKIE_PREFIX}${EVENT_ID}`;
const ACTIONS = ['consumer/save-product', 'consumer/join-tenant', 'consumer/claim', 'loyalty/enroll'];
const target = (action = ACTIONS[0], eventId = EVENT_ID) => `/mobile/passport/${eventId}/${action}`;
function token(overrides = {}) {
  const payload = { purpose: 'sun_fresh_handoff', eventId: EVENT_ID, iat: NOW / 1000 - 10, exp: NOW / 1000 + 120, ...overrides };
  // Deliberately forged: this bridge must never mistake envelope inspection for authentication.
  return `${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${'a'.repeat(43)}`;
}
function request(path, body, headers = {}) {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
function preparation(body = { eventId: EVENT_ID, freshToken: token() }, headers) {
  return request('/api/consumer/tap-handoff', body, headers);
}
function actionRequest(body = {}, headers = {}, path = target()) {
  return request(`/api${path}`, body, { cookie: `consumer_session=session-test; ${COOKIE}=${token()}`, ...headers });
}
function assertPrivate(response) {
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match(response.headers.get('vary'), /(?:^|,\s*)Cookie(?:,|$)/i);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
}

test('preparation stores an event-named host-only HttpOnly capability cookie with bounded lifetime', async () => {
  const freshToken = token();
  const response = await prepareConsumerTapHandoff(preparation({ eventId: EVENT_ID, freshToken }), NOW);
  assert.equal(response.status, 200);
  assertPrivate(response);
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie.startsWith(`${COOKIE}=${freshToken};`));
  assert.match(cookie, /^__Host-nexid_tap_715=/);
  assert.match(cookie, /; Path=\/(?:;|$)/);
  assert.match(cookie, /; HttpOnly(?:;|$)/);
  assert.match(cookie, /; SameSite=Strict(?:;|$)/);
  assert.match(cookie, /; Max-Age=120(?:;|$)/);
  assert.match(cookie, /; Secure(?:;|$)/);
  assert.doesNotMatch(cookie, /; Domain=/i);
  const raw = await response.text();
  assert.ok(!raw.includes(freshToken));
  assert.deepEqual(JSON.parse(raw), { ok: true, eventId: EVENT_ID, expiresAt: new Date(NOW + 120_000).toISOString() });
});

test('preparation and actions require an exact Origin and reject same-site siblings', async () => {
  const headerCases = [
    { origin: 'https://evil.example' },
    { origin: 'https://sibling.nexid.example', 'sec-fetch-site': 'same-site' },
    { origin: 'null' },
    { origin: '' },
    { 'sec-fetch-site': 'same-site' },
    { 'sec-fetch-site': 'cross-site' },
    { 'sec-fetch-site': 'none' },
  ];
  for (const headers of headerCases) {
    const response = await prepareConsumerTapHandoff(preparation(undefined, headers), NOW);
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('set-cookie'), null);
    assertPrivate(response);
    const denied = await proxyConsumerTapAction(actionRequest({}, headers), target(), () => assert.fail('must not forward'), NOW);
    assert.equal(denied.status, 403);
    assertPrivate(denied);
  }
  const noFetchMetadata = preparation();
  noFetchMetadata.headers.delete('sec-fetch-site');
  assert.equal((await prepareConsumerTapHandoff(noFetchMetadata, NOW)).status, 200);
});

test('JSON byte limit applies to actual streamed content, not only Content-Length', async () => {
  for (const headers of [{}, { 'content-length': '1' }, { 'content-length': '9000' }]) {
    const body = JSON.stringify({ eventId: EVENT_ID, freshToken: token(), padding: 'a'.repeat(8192) });
    const response = await prepareConsumerTapHandoff(preparation(body, headers), NOW);
    assert.equal(response.status, 413);
    assert.equal(response.headers.get('set-cookie'), null);
    assertPrivate(response);
    const denied = await proxyConsumerTapAction(actionRequest(body, headers), target(), () => assert.fail('must not forward'), NOW);
    assert.equal(denied.status, 413);
  }
  // UTF-8 bytes rather than JavaScript character count are bounded.
  assert.equal((await prepareConsumerTapHandoff(preparation({ padding: 'é'.repeat(4200) }), NOW)).status, 413);
});

test('preparation and actions reject malformed JSON, non-object JSON and other content types', async () => {
  for (const raw of ['{', 'null', '[]', 'true']) {
    assert.equal((await prepareConsumerTapHandoff(preparation(raw), NOW)).status, 400);
    assert.equal((await proxyConsumerTapAction(actionRequest(raw), target(), () => assert.fail('must not forward'), NOW)).status, 400);
  }
  assert.equal((await prepareConsumerTapHandoff(preparation(undefined, { 'content-type': 'text/plain' }), NOW)).status, 415);
  assert.equal((await proxyConsumerTapAction(actionRequest({}, { 'content-type': 'application/x-www-form-urlencoded' }), target(), () => assert.fail('must not forward'), NOW)).status, 415);
});

test('envelope inspection rejects expired, mismatched, malformed and overlong capabilities', async () => {
  const invalid = [
    token({ eventId: '716' }), token({ purpose: 'other' }), token({ exp: NOW / 1000 }),
    token({ iat: NOW / 1000 + 61 }), token({ iat: NOW / 1000 - 301, exp: NOW / 1000 + 1 }),
    token({ iat: NOW / 1000 + 10, exp: NOW / 1000 + 10 }),
    token({ iat: -1 }), token({ exp: '1800000120' }), token({ iat: 1.5 }),
    token({ padding: 'a'.repeat(3500) }), 'invalid', `${Buffer.from('[]').toString('base64url')}.${'a'.repeat(43)}`,
    `${token().split('.')[0]}.${'a'.repeat(42)}`,
  ];
  for (const freshToken of invalid) {
    assert.equal(inspectConsumerTapCapability(freshToken, EVENT_ID, NOW), null);
    const response = await prepareConsumerTapHandoff(preparation({ eventId: EVENT_ID, freshToken }), NOW);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('set-cookie'), null);
  }
  for (const eventId of ['0', '0715', '715/claim', '715?x=1', '1'.repeat(20), 715, null]) {
    const response = await prepareConsumerTapHandoff(preparation({ eventId, freshToken: token() }), NOW);
    assert.equal(response.status, 400);
  }
  assert.deepEqual(inspectConsumerTapCapability(token({ exp: NOW / 1000 + 1 }), EVENT_ID, NOW), { issuedAt: NOW / 1000 - 10, expiresAt: NOW / 1000 + 1, maxAge: 1 });
});

test('all four actions receive the capability in the body and retain session and provenance headers', async () => {
  for (const action of ACTIONS) {
    const path = target(action);
    let calls = 0;
    const response = await proxyConsumerTapAction(actionRequest({ consent: true }, {}, path), path, async (req, forwardedPath) => {
      calls++;
      assert.equal(forwardedPath, path);
      assert.equal(req.method, 'POST');
      assert.equal(req.headers.get('origin'), ORIGIN);
      assert.equal(req.headers.get('sec-fetch-site'), 'same-origin');
      assert.equal(req.headers.get('cookie'), 'consumer_session=session-test');
      assert.equal(req.headers.get('content-length'), null);
      assert.equal(req.url, `${ORIGIN}/api${path}`);
      assert.deepEqual(await req.json(), { consent: true, fresh_token: token() });
      return Response.json({ ok: true, saved: true }, { headers: { vary: 'Accept-Language', 'cache-control': 'public, max-age=600' } });
    }, NOW);
    assert.equal(calls, 1);
    assert.equal(response.status, 200);
    assertPrivate(response);
    assert.equal(response.headers.get('vary'), 'Accept-Language, Cookie');
    assert.deepEqual(await response.json(), { ok: true, saved: true });
  }
});

test('forged envelopes are custody only: an API rejection remains a rejection', async () => {
  const forged = token();
  assert.equal((await prepareConsumerTapHandoff(preparation({ eventId: EVENT_ID, freshToken: forged }), NOW)).status, 200);
  const response = await proxyConsumerTapAction(actionRequest(), target(), async (req) => {
    assert.equal((await req.json()).fresh_token, forged);
    // The API owns signature, consumer session, tag binding and replay verification.
    return Response.json({ ok: false, error: 'fresh_token_invalid' }, { status: 403 });
  }, NOW);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { ok: false, error: 'fresh_token_invalid' });
  assertPrivate(response);
});

test('explicit capability aliases always win, including empty or malformed values', async () => {
  for (const field of ['fresh_token', 'freshToken', 'sun_fresh', 'sunFresh']) {
    for (const value of [token({ eventId: '716' }), '', null, false]) {
      const body = { [field]: value, consent: true };
      const response = await proxyConsumerTapAction(actionRequest(body), target(), async (req) => {
        assert.deepEqual(await req.json(), body);
        assert.equal(req.headers.get('cookie'), 'consumer_session=session-test');
        return Response.json({ ok: false }, { status: 403 });
      }, NOW);
      assert.equal(response.status, 403);
    }
  }
});

test('expired, malformed or other-event cookies provide no capability and are never sent upstream', async () => {
  for (const cookie of ['', `${COOKIE}=broken`, `${COOKIE}=${token({ eventId: '716' })}`, `${COOKIE}=${token({ exp: NOW / 1000 })}`]) {
    const response = await proxyConsumerTapAction(actionRequest({}, { cookie: `${cookie}; consumer_session=keep` }), target(), async (req) => {
      assert.deepEqual(await req.json(), {});
      assert.equal(req.headers.get('cookie'), 'consumer_session=keep');
      return Response.json({ ok: false, error: 'fresh_token_required' }, { status: 403 });
    }, NOW);
    assert.equal(response.status, 403);
  }
});

test('duplicate capability cookies fail closed even when one is valid or the body is explicit', async () => {
  for (const body of [{}, { fresh_token: token() }]) {
    const req = actionRequest(body, { cookie: `${COOKIE}=broken; consumer_session=keep; ${COOKIE} =${token()}` });
    const response = await proxyConsumerTapAction(req, target(), () => assert.fail('must not forward'), NOW);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { ok: false, error: 'tap_capability_ambiguous' });
    assertPrivate(response);
  }
});

test('preparation evicts invalid and oldest capabilities to retain at most three events', async () => {
  const existing = [
    ['711', { iat: NOW / 1000 - 80 }], ['712', { iat: NOW / 1000 - 60 }],
    ['713', { iat: NOW / 1000 - 40 }], ['714', { exp: NOW / 1000 }],
  ].map(([eventId, overrides]) => `${CONSUMER_TAP_CAPABILITY_COOKIE_PREFIX}${eventId}=${token({ eventId, ...overrides })}`).join('; ');
  const response = await prepareConsumerTapHandoff(preparation(undefined, { cookie: existing }), NOW);
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 3);
  assert.match(cookies[0], /^__Host-nexid_tap_711=; Path=\/;.*Max-Age=0; Secure$/);
  assert.match(cookies[1], /^__Host-nexid_tap_714=; Path=\/;.*Max-Age=0; Secure$/);
  assert.match(cookies[2], /^__Host-nexid_tap_715=/);
  const duplicate = await prepareConsumerTapHandoff(preparation(undefined, { cookie: `${COOKIE}=${token()}; ${COOKIE}=${token()}` }), NOW);
  assert.equal(duplicate.status, 400);
  assert.equal(duplicate.headers.get('set-cookie'), null);
});

test('only loopback HTTP development can use an unprefixed cookie', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousVercel = process.env.VERCEL;
  try {
    process.env.NODE_ENV = 'development';
    delete process.env.VERCEL;
    for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000']) {
      const req = new Request(`${origin}/api/consumer/tap-handoff`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ eventId: EVENT_ID, freshToken: token() }) });
      const response = await prepareConsumerTapHandoff(req, NOW);
      assert.match(response.headers.get('set-cookie'), /^nexid_tap_715=/);
      assert.doesNotMatch(response.headers.get('set-cookie'), /; Secure/);
    }
    for (const [origin, nodeEnv] of [['http://remote.test', 'development'], ['http://localhost:3000', 'production']]) {
      process.env.NODE_ENV = nodeEnv;
      const req = new Request(`${origin}/api/consumer/tap-handoff`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ eventId: EVENT_ID, freshToken: token() }) });
      const response = await prepareConsumerTapHandoff(req, NOW);
      assert.match(response.headers.get('set-cookie'), /^__Host-nexid_tap_715=/);
      assert.match(response.headers.get('set-cookie'), /; Secure/);
    }
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    if (previousVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previousVercel;
  }
});

test('production ignores unprefixed cookies and strips every capability namespace before forwarding', async () => {
  const cookie = `consumer_session=keep; nexid_tap_715=${token()}; nexid_tap_capability=old; __Host-nexid_tap_716=${token({ eventId: '716' })}; __Host-nexid_tap_invalid=bad; locale=es`;
  assert.equal(stripConsumerTapCapabilityCookies(cookie), 'consumer_session=keep; locale=es');
  const response = await proxyConsumerTapAction(actionRequest({}, { cookie }), target(), async (req) => {
    assert.equal(req.headers.get('cookie'), 'consumer_session=keep; locale=es');
    assert.deepEqual(await req.json(), {});
    return Response.json({ ok: false }, { status: 403 });
  }, NOW);
  assert.equal(response.status, 403);
});

test('all Cookie forwarders explicitly strip capability namespaces', async () => {
  for (const path of ['api/_lib/runtime-proxy.ts', 'me/_components/consumer-api.ts', 'api/public-cta/[action]/route.ts', 'api/consumer/taps/history/route.ts', 'me/taps/page.tsx']) {
    const source = await readFile(new URL(`../src/app/${path}`, import.meta.url), 'utf8');
    assert.match(source, /import\s*\{\s*stripConsumerTapCapabilityCookies\s*\}/);
    assert.match(source, /stripConsumerTapCapabilityCookies\((?:req\.headers|incomingHeaders|h)\.get\(["']cookie["']\)\)/);
  }
});

test('bridge allowlist refuses other endpoints, methods, path aliases and event mismatches', async () => {
  for (const path of [target('loyalty/claim-points'), target('consumer/delete'), '/mobile/passport/715/consumer/claim/', '/mobile/passport/0715/consumer/claim', '/mobile/passport/715%2f/consumer/claim']) {
    const response = await proxyConsumerTapAction(actionRequest({}, {}, path), path, () => assert.fail('must not forward'), NOW);
    assert.equal(response.status, 404);
  }
  assert.equal((await proxyConsumerTapAction(actionRequest(), target('consumer/claim'), () => assert.fail('must not forward'), NOW)).status, 404);
  const get = new Request(`${ORIGIN}/api${target()}`, { headers: { origin: ORIGIN } });
  assert.equal((await proxyConsumerTapAction(get, target(), () => assert.fail('must not forward'), NOW)).status, 404);
  assert.equal((await prepareConsumerTapHandoff(new Request(`${ORIGIN}/api/consumer/tap-handoff`), NOW)).status, 405);
});

test('upstream partial or failed action status, body and session cookies are preserved privately', async () => {
  const result = { ok: false, operation_committed: true, ownership: { status: 'claimed' } };
  const response = await proxyConsumerTapAction(actionRequest(), target(), async () => Response.json(result, {
    status: 503, headers: { 'set-cookie': 'consumer_session=renewed; HttpOnly; Secure', vary: 'cookie, Origin' },
  }), NOW);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), result);
  assert.equal(response.headers.get('set-cookie'), 'consumer_session=renewed; HttpOnly; Secure');
  assert.equal(response.headers.get('vary'), 'cookie, Origin');
  assertPrivate(response);
});

test('specific Next action routes use the bounded bridge and preserve the existing upstream proxy', async () => {
  for (const action of ACTIONS) {
    const file = new URL(`../src/app/api/mobile/passport/[eventId]/${action}/route.ts`, import.meta.url);
    const source = await readFile(file, 'utf8');
    assert.match(source, /import \{ proxyConsumerTapAction \} from/);
    assert.match(source, /proxyConsumerTapAction\(req,\s*`\/mobile\/passport\/\$\{encodeURIComponent\(eventId\)\}/);
    assert.match(source, /, proxyToApi\)/);
  }
  const prepare = await readFile(new URL('../src/app/api/consumer/tap-handoff/route.ts', import.meta.url), 'utf8');
  assert.match(prepare, /prepareConsumerTapHandoff\(req\)/);
});
