import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  rateLimitBucketKey,
  rateLimitKeyPepper,
  reserveSunRateLimit,
  shouldFailClosedSunRateLimit,
} from '../src/lib/sun-rate-limit-store.ts';

// Vercel builds execute the test suite with NODE_ENV=production. Keep the
// production fail-closed contract intact and inject an explicit unit-test-only
// pepper for calls that intentionally exercise the database policy.
const previousRateLimitPepper = process.env.RATE_LIMIT_KEY_PEPPER;
process.env.RATE_LIMIT_KEY_PEPPER = 'nexid-sun-rate-limit-store-unit-test-pepper-v1';
after(() => {
  if (previousRateLimitPepper === undefined) delete process.env.RATE_LIMIT_KEY_PEPPER;
  else process.env.RATE_LIMIT_KEY_PEPPER = previousRateLimitPepper;
});

test('distributed store uses atomic DB buckets suitable for concurrent serverless invocations', async () => {
  const source = await readFile(new URL('../src/lib/sun-rate-limit-store.ts', import.meta.url), 'utf8');
  assert.match(source, /INSERT INTO sun_rate_limit_buckets/);
  assert.match(source, /ON CONFLICT \(scope, scope_key_hash\) DO UPDATE/);
  assert.match(source, /sun_rate_limit_buckets\.hit_count \+ 1/);
  assert.match(source, /FOR UPDATE SKIP LOCKED/);
  assert.doesNotMatch(source, /INSERT INTO sun_rate_limit_events/);
});

test('reservation is one atomic statement, purges bounded stale rows and never stores raw key material', async () => {
  const calls = [];
  const fakeSql = async (strings, ...values) => {
    calls.push({ query: strings.join('?'), values });
    return [{ hits: '3', limited: false, retry_after_seconds: 42 }];
  };
  const rawKey = '203.0.113.77';
  const result = await reserveSunRateLimit(fakeSql, 'ip', rawKey, 60, 120);

  assert.deepEqual(result, { hits: 3, limited: false, retryAfterSeconds: 42 });
  assert.equal(calls.length, 1);
  assert.match(calls[0].query, /LIMIT 50\s+FOR UPDATE SKIP LOCKED/);
  assert.match(calls[0].query, /DELETE FROM sun_rate_limit_buckets/);
  assert.match(calls[0].query, /RETURNING hit_count, window_started_at/);
  assert.ok(!calls[0].values.includes(rawKey));
  assert.ok(calls[0].values.some((value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)));
});

test('bucket identifiers use a dedicated HMAC pepper and production has no implicit fallback', () => {
  const rawKey = 'victim@example.test';
  const firstEnv = { NODE_ENV: 'production', RATE_LIMIT_KEY_PEPPER: 'a'.repeat(32) };
  const secondEnv = { NODE_ENV: 'production', RATE_LIMIT_KEY_PEPPER: 'b'.repeat(32) };
  const first = rateLimitBucketKey('consumer_auth_start_contact', rawKey, firstEnv);
  const second = rateLimitBucketKey('consumer_auth_start_contact', rawKey, secondEnv);

  assert.match(first.scopeKeyHash, /^[0-9a-f]{64}$/);
  assert.notEqual(first.scopeKeyHash, second.scopeKeyHash);
  assert.ok(!first.scopeKeyHash.includes(rawKey));
  assert.throws(() => rateLimitKeyPepper({ NODE_ENV: 'production' }), /rate_limit_key_pepper_required/);
  assert.throws(
    () => rateLimitKeyPepper({ NODE_ENV: 'production', RATE_LIMIT_KEY_PEPPER: 'too-short' }),
    /rate_limit_key_pepper_invalid/,
  );
  assert.equal(rateLimitKeyPepper({ NODE_ENV: 'test' }), 'nexid-rate-limit-local-development-only-v1');
});

test('invalid limiter policy fails safe and production cannot opt out of fail-closed behavior', async () => {
  await assert.rejects(
    reserveSunRateLimit(async () => [], 'ip', '203.0.113.77', 0, 120),
    /sun_rate_limit_invalid_window_seconds/,
  );
  assert.equal(shouldFailClosedSunRateLimit({ NODE_ENV: 'production', SUN_RATE_LIMIT_FAIL_CLOSED: 'false' }), true);
  assert.equal(shouldFailClosedSunRateLimit({ NODE_ENV: 'test' }), false);
  assert.equal(shouldFailClosedSunRateLimit({ NODE_ENV: 'test', SUN_RATE_LIMIT_FAIL_CLOSED: 'invalid' }), true);
});

test('the configured budget remains available and the next hit is limited with Retry-After', async () => {
  const atBudget = await reserveSunRateLimit(
    async () => [{ hits: '120', limited: false, retry_after_seconds: 7 }],
    'ip',
    '203.0.113.77',
    60,
    120,
  );
  const overBudget = await reserveSunRateLimit(
    async () => [{ hits: '121', limited: true, retry_after_seconds: 6 }],
    'ip',
    '203.0.113.77',
    60,
    120,
  );

  assert.equal(atBudget.limited, false);
  assert.equal(overBudget.limited, true);
  assert.equal(overBudget.retryAfterSeconds, 6);
});
