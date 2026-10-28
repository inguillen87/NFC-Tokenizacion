// Private callback contract exercised through the real provider API.
// Synthetic transport and quota reservations keep the suite offline.
import assert from 'node:assert/strict';
import test, { beforeEach, afterEach } from 'node:test';
import { requestLiveSommelier } from '../src/lib/sommelier-provider.ts';
import { valleSecretoSommelierFacts } from '../src/lib/sommelier-demo-facts.ts';
const PRIVATE = 'SYNTHETIC-PRIVATE-DIAGNOSTIC-MARKER';
const envelope = (code, type = 'insufficient_quota') => ({ error: { code, type, message: PRIVATE, param: PRIVATE, extra: PRIVATE } });
const jsonError = (payload, status = 429, headers = {}) => Response.json(payload, { status, headers });
const flush = async (turns = 20) => { for (let i = 0; i < turns; i++) await Promise.resolve(); };
let oldFetch;
beforeEach(() => {
  oldFetch = globalThis.fetch;
  globalThis.fetch = () => { throw Error('No global network is authorized in this synthetic suite'); };
});
afterEach(() => { globalThis.fetch = oldFetch; });

const input = { mode: 'demo', locale: 'es-AR', question: PRIVATE, history: [] };
const context = valleSecretoSommelierFacts('es-AR');
const openAiOnly = {
  NEXID_SOMMELIER_ENABLED: 'true', NEXID_SOMMELIER_OPENAI_FALLBACK_ENABLED: 'true',
  OPENAI_API_KEY: 'synthetic-private-diagnostic-openai-key',
};
test('private OpenAI429 details do not change fallback, wait, calls or reservations', async () => {
  let calls = 0, reservations = 0; const events = [];
  const response = await requestLiveSommelier(input, context, openAiOnly, {
    reserve: async () => { reservations++; return { ok: true }; },
    fetch: async () => { calls++; return jsonError(envelope('credit_balance_exhausted'), 429, { 'retry-after': '600' }); },
    diagnostic: event => events.push(event),
  });
  assert.equal(calls, 1); assert.equal(reservations, 1); assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    provider: 'openai', stage: 'http', category: 'http_rejected', httpStatus: 429,
    providerReason: 'provider_credit_balance_declared', reasonEvidence: 'allowlisted_error_code', diagnosticRead: 'parsed',
  });
  assert.equal(response.reason, 'sommelier_provider_unavailable');
  assert.equal(response.source, 'fallback'); assert.equal(response.retryAfter, undefined);
  for (const key of ['provider', 'model', 'usage', 'providerReason', 'reasonEvidence', 'diagnosticRead']) assert.equal(Object.hasOwn(response, key), false);
  assert.doesNotMatch(JSON.stringify(response), /SYNTHETIC|credit_balance|600/);
});
test('HF remains unread and every configured attempt keeps its own reservation and order', async () => {
  const sequence = [], events = []; let hfReads = 0, hfCancels = 0;
  const config = { ...openAiOnly, HF_TOKEN: 'synthetic-private-diagnostic-unique-hf-402' };
  const hfResponse = {
    status: 402, ok: false,
    body: { getReader() { hfReads++; throw Error('HF body must not be read'); }, cancel() { hfCancels++; return Promise.resolve(); } },
  };
  const response = await requestLiveSommelier(input, context, config, {
    reserve: async () => { sequence.push('reserve'); return { ok: true }; },
    fetch: async url => {
      if (url.includes('huggingface')) { sequence.push('hf'); return hfResponse; }
      sequence.push('openai'); return jsonError(envelope('slow_down', 'rate_limit_error'));
    },
    diagnostic: event => events.push(event),
  });
  assert.deepEqual(sequence, ['reserve', 'hf', 'reserve', 'openai']);
  assert.equal(hfReads, 0); assert.equal(hfCancels, 1); assert.equal(events.length, 2);
  assert.deepEqual(events[0], { provider: 'huggingface', stage: 'http', category: 'http_rejected', httpStatus: 402 });
  assert.equal(events[1].providerReason, 'provider_rate_ramp_declared');
  assert.equal(response.reason, 'sommelier_provider_unavailable');
});
test('throwing private logger cannot alter provider policy or leak the transport envelope', async () => {
  let calls = 0, reservations = 0, logs = 0;
  const response = await requestLiveSommelier(input, context, openAiOnly, {
    reserve: async () => { reservations++; return { ok: true }; },
    fetch: async () => { calls++; return jsonError(envelope('organization_usage_limit_exceeded')); },
    diagnostic: () => { logs++; throw Error(PRIVATE); },
  });
  assert.equal(calls, 1); assert.equal(reservations, 1); assert.equal(logs, 1);
  assert.equal(response.reason, 'sommelier_provider_unavailable');
  assert.doesNotMatch(JSON.stringify(response), /SYNTHETIC|organization_usage/);
});
test('default private logger serializes only closed fields for an eligible error', async () => {
  const lines = [], oldWarn = console.warn;
  console.warn = (...args) => lines.push(args);
  try {
    const response = await requestLiveSommelier(input, context, openAiOnly, {
      reserve: async () => ({ ok: true }),
      fetch: async () => jsonError(envelope('server_is_overloaded', 'service_unavailable_error'), 503),
    });
    assert.equal(response.source, 'fallback'); assert.equal(lines.length, 1);
    assert.deepEqual(lines[0], ['[sommelier_provider_rejected]', JSON.stringify({
      provider: 'openai', stage: 'http', category: 'http_rejected', httpStatus: 503,
      providerReason: 'provider_model_capacity_declared', reasonEvidence: 'allowlisted_error_code', diagnosticRead: 'parsed',
    })]);
    assert.doesNotMatch(JSON.stringify(lines), /SYNTHETIC|synthetic-private|message|param|headers|tenant|question/);
  } finally { console.warn = oldWarn; }
});
test('diagnostic read cannot extend the existing caller deadline or add another attempt', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0, reservations = 0, cancelled = 0; const events = [];
  const stream = new ReadableStream({
    pull() { return new Promise(() => {}); },
    cancel() { cancelled++; },
  }, { highWaterMark: 0 });
  const pending = requestLiveSommelier(input, context, openAiOnly, {
    deadlineMs: 10,
    reserve: async () => { reservations++; return { ok: true }; },
    fetch: async () => { calls++; return new Response(stream, { status: 429, headers: { 'content-type': 'application/json' } }); },
    diagnostic: event => events.push(event),
  });
  await flush(); assert.equal(calls, 1);
  t.mock.timers.tick(10);
  const response = await pending;
  await flush();
  assert.equal(response.reason, 'sommelier_provider_timeout');
  assert.equal(calls, 1); assert.equal(reservations, 1); assert.equal(cancelled, 1);
  assert.ok(events.length <= 1);
  t.mock.timers.tick(1000); await flush();
  assert.equal(calls, 1); assert.equal(reservations, 1); assert.equal(cancelled, 1);
});
