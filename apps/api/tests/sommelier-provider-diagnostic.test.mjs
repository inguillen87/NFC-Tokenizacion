// Private provider-error projection and bounded reader contracts.
// Every response is synthetic; this suite forbids global network requests.
import assert from 'node:assert/strict';
import test, { beforeEach, afterEach } from 'node:test';
import * as diagnostics from '../src/lib/sommelier-provider-diagnostic.ts';
import {
  requestLiveSommelier, sommelierProviderBody, sommelierReservedCost,
  SOMMELIER_HF_MODEL, SOMMELIER_OPENAI_MODEL,
  SOMMELIER_PROVIDER_DEADLINE_MS, SOMMELIER_OUTPUT_TOKENS,
} from '../src/lib/sommelier-provider.ts';

const {
  SOMMELIER_DIAGNOSTIC_MAX_BYTES: MAX_BYTES,
  SOMMELIER_DIAGNOSTIC_MAX_MS: MAX_MS,
  projectSommelierProviderHttpError: project,
  readSommelierProviderHttpDiagnostic: readDiagnostic,
} = diagnostics;
const PRIVATE = 'SYNTHETIC-PRIVATE-DIAGNOSTIC-MARKER';
const unknown = { providerReason: 'unknown', reasonEvidence: 'none' };
const unknownRead = diagnosticRead => ({ ...unknown, diagnosticRead });
const scope = extra => ({ provider: 'openai', isLastCandidate: true, signal: new AbortController().signal, ...extra });
const quotaCases = [
  ['credit_balance_exhausted', 'provider_credit_balance_declared'],
  ['organization_spend_limit_exceeded', 'provider_org_spend_declared'],
  ['project_spend_limit_exceeded', 'provider_project_spend_declared'],
  ['organization_usage_limit_exceeded', 'provider_org_usage_declared'],
];
const envelope = (code, type = 'insufficient_quota') => ({ error: { code, type, message: PRIVATE, param: PRIVATE, extra: PRIVATE } });
const jsonError = (payload, status = 429, headers = {}) => Response.json(payload, { status, headers });
const flush = async (turns = 20) => { for (let i = 0; i < turns; i++) await Promise.resolve(); };
let oldFetch;
beforeEach(() => {
  oldFetch = globalThis.fetch;
  globalThis.fetch = () => { throw Error('No global network is authorized in this synthetic suite'); };
});
afterEach(() => { globalThis.fetch = oldFetch; });

test('baseline/new exports are explicit and existing model, token and deadline caps stay unchanged', () => {
  assert.deepEqual(Object.keys(diagnostics).filter(name => name !== 'default' && name !== 'module.exports').sort(), [
    'SOMMELIER_DIAGNOSTIC_MAX_BYTES', 'SOMMELIER_DIAGNOSTIC_MAX_MS',
    'projectSommelierProviderHttpError', 'readSommelierProviderHttpDiagnostic',
  ].sort());
  assert.equal(typeof readDiagnostic, 'function');
  assert.equal(typeof project, 'function');
  for (const existing of [requestLiveSommelier, sommelierProviderBody, sommelierReservedCost]) assert.equal(typeof existing, 'function');
  assert.equal(MAX_BYTES, 2048); assert.equal(MAX_MS, 50);
  assert.equal(SOMMELIER_HF_MODEL, 'openai/gpt-oss-20b:deepinfra');
  assert.equal(SOMMELIER_OPENAI_MODEL, 'gpt-6-luna');
  assert.equal(SOMMELIER_PROVIDER_DEADLINE_MS, 9000);
  assert.equal(SOMMELIER_OUTPUT_TOKENS, 1024);
});

for (const [code, providerReason] of quotaCases) test('exact declared quota code: ' + code, () => {
  const projected = project('openai', 429, envelope(code));
  assert.deepEqual(projected, { providerReason, reasonEvidence: 'allowlisted_error_code' });
  assert.equal(Object.isFrozen(projected), true);
  assert.doesNotMatch(JSON.stringify(projected), /SYNTHETIC|message|param|extra/);
});

test('precise quota code does not inspect the broader type or message', () => {
  const error = { code: 'credit_balance_exhausted' };
  for (const property of ['type', 'message', 'param']) Object.defineProperty(error, property, {
    get() { throw Error('must-not-read-' + property); },
  });
  assert.deepEqual(project('openai', 429, { error }), {
    providerReason: 'provider_credit_balance_declared', reasonEvidence: 'allowlisted_error_code',
  });
});
test('only the documented rate-ramp and capacity pairs classify', () => {
  assert.deepEqual(project('openai', 429, envelope('slow_down', 'rate_limit_error')), {
    providerReason: 'provider_rate_ramp_declared', reasonEvidence: 'allowlisted_error_code',
  });
  assert.deepEqual(project('openai', 503, envelope('server_is_overloaded', 'service_unavailable_error')), {
    providerReason: 'provider_model_capacity_declared', reasonEvidence: 'allowlisted_error_code',
  });
  assert.deepEqual(project('openai', 429, { error: { code: 'slow_down' } }), unknown);
  assert.deepEqual(project('openai', 503, { error: { code: 'server_is_overloaded' } }), unknown);
  for (const [status, code, type] of [
    [429, 'slow_down', 'insufficient_quota'], [429, 'slow_down', undefined],
    [503, 'server_is_overloaded', 'rate_limit_error'], [429, 'server_is_overloaded', 'service_unavailable_error'],
    [503, 'credit_balance_exhausted', 'insufficient_quota'], [200, 'credit_balance_exhausted', 'insufficient_quota'],
  ]) assert.deepEqual(project('openai', status, envelope(code, type)), unknown);
});

test('broad quota type, unverified aliases and cross-provider codes stay unknown', () => {
  for (const payload of [
    { error: { type: 'insufficient_quota', message: PRIVATE } },
    envelope('insufficient_quota'), envelope('rate_limit_exceeded', 'rate_limit_error'),
    envelope('invalid_api_key'), envelope('model_not_found'), envelope('CREDIT_BALANCE_EXHAUSTED'),
    envelope(PRIVATE.repeat(20)), { error: { code: 429 } }, { error: { code: { toJSON() { throw Error(PRIVATE); } } } },
    null, [], {}, { error: null }, { error: [] }, { error: PRIVATE },
  ]) assert.deepEqual(project('openai', 429, payload), unknown);
  assert.deepEqual(project('huggingface', 429, envelope('credit_balance_exhausted')), unknown);
  assert.deepEqual(project('openai', 402, envelope('credit_balance_exhausted')), unknown);
  const poisoned = JSON.parse('{"error":{"code":"__proto__","message":"SYNTHETIC-PRIVATE-DIAGNOSTIC-MARKER"},"__proto__":{"polluted":true}}');
  assert.deepEqual(project('openai', 429, poisoned), unknown);
  assert.equal(Object.prototype.polluted, undefined);
});
test('projection discards throwing error/code getters without serializing transport data', () => {
  const codeTrap = { error: { get code() { throw { get message() { throw Error(PRIVATE); }, toJSON() { throw Error(PRIVATE); } }; } } };
  const rootTrap = { get error() { throw Error(PRIVATE); } };
  assert.deepEqual(project('openai', 429, codeTrap), unknown);
  assert.deepEqual(project('openai', 429, rootTrap), unknown);
});

test('ineligible scope/status never inspects headers or body', async () => {
  const untouched = { get status() { throw Error('must-not-read-status'); } };
  assert.deepEqual(await readDiagnostic(untouched, scope({ provider: 'huggingface' })), unknownRead('skipped'));
  assert.deepEqual(await readDiagnostic(untouched, scope({ isLastCandidate: false })), unknownRead('skipped'));
  const unsupported = {
    status: 401,
    get headers() { throw Error('must-not-read-headers'); },
    get body() { throw Error('must-not-read-body'); },
  };
  assert.deepEqual(await readDiagnostic(unsupported, scope()), unknownRead('skipped'));
});
test('already aborted caller is checked before headers/body', async () => {
  const controller = new AbortController(); controller.abort();
  const response = { status: 429, get headers() { throw Error(PRIVATE); }, get body() { throw Error(PRIVATE); } };
  assert.deepEqual(await readDiagnostic(response, scope({ signal: controller.signal })), unknownRead('aborted'));
});
test('non-JSON eligible response does not read its body', async () => {
  const response = { status: 429, headers: new Headers({ 'content-type': 'text/html' }), get body() { throw Error('must-not-read-body'); } };
  assert.deepEqual(await readDiagnostic(response, scope()), unknownRead('non_json'));
});
test('known JSON produces a frozen closed projection and unlocks its body', async () => {
  const response = jsonError(envelope('project_spend_limit_exceeded'), 429);
  const detail = await readDiagnostic(response, scope());
  assert.deepEqual(detail, {
    providerReason: 'provider_project_spend_declared', reasonEvidence: 'allowlisted_error_code', diagnosticRead: 'parsed',
  });
  assert.equal(Object.isFrozen(detail), true);
  assert.equal(response.body.locked, false);
  assert.deepEqual(Object.keys(detail).sort(), ['providerReason', 'reasonEvidence', 'diagnosticRead'].sort());
  assert.doesNotMatch(JSON.stringify(detail), /SYNTHETIC|message|param|extra/);
});
test('UTF8 byte cap admits exactly2KiB and rejects one byte more without echo', async () => {
  const text = JSON.stringify({ error: { code: 'credit_balance_exhausted', message: PRIVATE + '🍷' } });
  const exact = text + ' '.repeat(MAX_BYTES - new TextEncoder().encode(text).byteLength);
  assert.equal(new TextEncoder().encode(exact).byteLength, MAX_BYTES);
  const response = new Response(exact, { status: 429, headers: { 'content-type': 'Application/JSON; charset=utf-8' } });
  assert.equal((await readDiagnostic(response, scope())).providerReason, 'provider_credit_balance_declared');
  const excessive = new Response(exact + ' ', { status: 429, headers: { 'content-type': 'application/json' } });
  assert.deepEqual(await readDiagnostic(excessive, scope()), unknownRead('too_large'));
  assert.equal(excessive.body.locked, false);
});
test('UTF8 sequences split across chunks decode only after the bounded read', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ error: { code: 'credit_balance_exhausted', message: '🍷' + PRIVATE } }));
  let offset = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) { controller.close(); return; }
      const end = Math.min(offset + 3, bytes.length);
      controller.enqueue(bytes.slice(offset, end)); offset = end;
    },
  }, { highWaterMark: 0 });
  const response = new Response(stream, { status: 429, headers: { 'content-type': 'application/json' } });
  assert.equal((await readDiagnostic(response, scope())).providerReason, 'provider_credit_balance_declared');
  assert.equal(stream.locked, false);
});
test('malformed, invalid UTF8 and absent bodies stay unknown', async () => {
  const responses = [
    new Response('{"error":', { status: 429, headers: { 'content-type': 'application/json' } }),
    new Response(new Uint8Array([255, 254]), { status: 429, headers: { 'content-type': 'application/json' } }),
    new Response(null, { status: 429, headers: { 'content-type': 'application/json' } }),
  ];
  for (const response of responses) assert.deepEqual(await readDiagnostic(response, scope()), unknownRead('invalid'));
});
test('unknown code/message bytes are discarded rather than logged or returned', async () => {
  const response = jsonError({ error: { code: PRIVATE.repeat(10), type: PRIVATE, message: PRIVATE, param: PRIVATE } });
  assert.deepEqual(await readDiagnostic(response, scope()), unknownRead('parsed'));
});
test('oversized and zero-length chunks cancel and cannot spin indefinitely', async () => {
  for (const [chunk, expected] of [[new Uint8Array(MAX_BYTES + 1), 'too_large'], [new Uint8Array(0), 'read_failed']]) {
    let pulls = 0, cancels = 0;
    const stream = new ReadableStream({
      pull(controller) { pulls++; controller.enqueue(chunk); },
      cancel() { cancels++; },
    }, { highWaterMark: 0 });
    const response = new Response(stream, { status: 429, headers: { 'content-type': 'application/json' } });
    assert.deepEqual(await readDiagnostic(response, scope()), unknownRead(expected));
    assert.equal(pulls, 1); assert.equal(cancels, 1); assert.equal(stream.locked, false);
  }
});
test('read/cancel/release failures expose no thrown object and still settle', async () => {
  const privateError = { get message() { throw Error('must-not-read'); }, toJSON() { throw Error('must-not-serialize'); } };
  let cancelled = 0, released = 0, bodyReads = 0;
  const response = {
    status: 429, headers: new Headers({ 'content-type': 'application/json' }),
    get body() {
      bodyReads++;
      return { getReader() { return {
        read: async () => { throw privateError; },
        cancel: () => { cancelled++; return Promise.reject(privateError); },
        releaseLock: () => { released++; throw privateError; },
      }; } };
    },
  };
  assert.deepEqual(await readDiagnostic(response, scope()), unknownRead('read_failed'));
  await flush();
  assert.equal(bodyReads, 1); assert.equal(cancelled, 1); assert.equal(released, 1);
});

test('header/body/getReader access failures are closed and do not inspect thrown messages', async () => {
  const privateError = { get message() { throw Error('must-not-read'); }, toJSON() { throw Error('must-not-serialize'); } };
  const responses = [
    { status: 429, get headers() { throw privateError; } },
    { status: 429, headers: new Headers({ 'content-type': 'application/json' }), get body() { throw privateError; } },
    { status: 429, headers: new Headers({ 'content-type': 'application/json' }), body: { getReader() { throw privateError; } } },
  ];
  for (const response of responses) assert.deepEqual(await readDiagnostic(response, scope()), unknownRead('read_failed'));
});
test('listener or scheduler setup failure releases an acquired reader without reading it', async t => {
  let reads = 0, cancels = 0, releases = 0;
  const makeResponse = () => ({
    status: 429, headers: new Headers({ 'content-type': 'application/json' }),
    body: { getReader() { return {
      read: async () => { reads++; return { done: true }; },
      cancel: () => { cancels++; return Promise.resolve(); },
      releaseLock: () => { releases++; },
    }; } },
  });
  const badSignal = { aborted: false, addEventListener() { throw Error(PRIVATE); }, removeEventListener() {} };
  assert.deepEqual(await readDiagnostic(makeResponse(), scope({ signal: badSignal })), unknownRead('read_failed'));
  assert.equal(reads, 0); assert.equal(cancels, 1); assert.equal(releases, 1);
  t.mock.method(globalThis, 'setTimeout', () => { throw Error(PRIVATE); });
  assert.deepEqual(await readDiagnostic(makeResponse(), scope()), unknownRead('read_failed'));
  assert.equal(reads, 0); assert.equal(cancels, 2); assert.equal(releases, 2);
});

test('a pre-owned reader is not stolen or released', async () => {
  const response = jsonError(envelope('credit_balance_exhausted')), owner = response.body.getReader();
  try {
    assert.deepEqual(await readDiagnostic(response, scope()), unknownRead('read_failed'));
    assert.equal(response.body.locked, true);
  } finally { await owner.cancel(); owner.releaseLock(); }
});
test('registered abort listener is removed on a successful read', async () => {
  const controller = new AbortController(), signal = controller.signal;
  const add = signal.addEventListener.bind(signal), remove = signal.removeEventListener.bind(signal);
  let added = 0, removed = 0;
  signal.addEventListener = (...args) => { if (args[0] === 'abort') added++; return add(...args); };
  signal.removeEventListener = (...args) => { if (args[0] === 'abort') removed++; return remove(...args); };
  const response = jsonError(envelope('credit_balance_exhausted'));
  assert.equal((await readDiagnostic(response, scope({ signal }))).diagnosticRead, 'parsed');
  assert.equal(added, 1); assert.equal(removed, 1); assert.equal(response.body.locked, false);
  controller.abort();
  assert.equal(removed, 1);
});
test('50ms timer settles even if cancel never resolves', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let cancelled = 0, settled = false;
  const stream = new ReadableStream({
    pull() { return new Promise(() => {}); },
    cancel() { cancelled++; return new Promise(() => {}); },
  }, { highWaterMark: 0 });
  const response = new Response(stream, { status: 429, headers: { 'content-type': 'application/json' } });
  const pending = readDiagnostic(response, scope()).then(value => { settled = true; return value; });
  t.mock.timers.tick(49); await flush();
  assert.equal(settled, false);
  t.mock.timers.tick(1);
  assert.deepEqual(await pending, unknownRead('timeout'));
  assert.equal(cancelled, 1); assert.equal(stream.locked, false);
  t.mock.timers.tick(1000); await flush();
  assert.equal(cancelled, 1);
});
test('caller abort cancels the pending read without extending its deadline', async () => {
  const controller = new AbortController(); let cancelled = 0;
  const stream = new ReadableStream({
    pull() { return new Promise(() => {}); },
    cancel() { cancelled++; },
  }, { highWaterMark: 0 });
  const pending = readDiagnostic(new Response(stream, { status: 503, headers: { 'content-type': 'application/json' } }), scope({ signal: controller.signal }));
  controller.abort();
  assert.deepEqual(await pending, unknownRead('aborted'));
  assert.equal(cancelled, 1); assert.equal(stream.locked, false);
});
