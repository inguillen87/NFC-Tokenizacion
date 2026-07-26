import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  clearSuccessfulLoginAttempt,
  getLoginRateLimitPolicy,
  reserveLoginAttempt,
  shouldFailClosedLoginAbuseGuard,
} from '../src/lib/login-abuse-guard.ts';

const TEST_PEPPER = 'test-only-login-rate-limit-pepper-0123456789';

function testPolicy(overrides = {}) {
  return getLoginRateLimitPolicy({
    NODE_ENV: 'test',
    LOGIN_RATE_LIMIT_PEPPER: TEST_PEPPER,
    ...overrides,
  });
}

test('production policy is bounded, requires a secret, and cannot fail open', () => {
  assert.throws(
    () => getLoginRateLimitPolicy({ NODE_ENV: 'production' }),
    /login_rate_limit_pepper_required/,
  );
  assert.equal(getLoginRateLimitPolicy({
    NODE_ENV: 'production',
    LOGIN_RATE_LIMIT_PEPPER: TEST_PEPPER,
  }).pepper, TEST_PEPPER);
  assert.throws(
    () => testPolicy({ LOGIN_RATE_LIMIT_SOURCE_MAX_ATTEMPTS: '4' }),
    /login_rate_limit_invalid_login_rate_limit_source_max_attempts/,
  );
  assert.equal(shouldFailClosedLoginAbuseGuard({
    NODE_ENV: 'production',
    LOGIN_RATE_LIMIT_FAIL_CLOSED: 'false',
  }), true);
});

test('reservation uses two HMAC-only buckets in one atomic PostgreSQL upsert', async () => {
  const calls = [];
  const fakeSql = async (strings, ...values) => {
    calls.push({ query: strings.join('?'), values });
    return [
      { bucket_kind: 'source', is_limited: false, retry_after_seconds: 0 },
      { bucket_kind: 'source_subject', is_limited: false, retry_after_seconds: 0 },
    ];
  };
  const subject = 'victim@example.test';
  const clientIp = '203.0.113.9';
  const reservation = await reserveLoginAttempt(fakeSql, { subject, clientIp }, testPolicy());

  assert.equal(calls.length, 1);
  const [{ query, values }] = calls;
  assert.match(query, /INSERT INTO admin_login_attempt_buckets/);
  assert.match(query, /ON CONFLICT \(bucket_kind, bucket_key\) DO UPDATE/);
  assert.match(query, /FOR UPDATE SKIP LOCKED/);
  assert.match(query, /admin_login_attempt_buckets\.blocked_until > now\(\)/);
  assert.match(query, /VALUES \('source',/);
  assert.match(query, /FROM source_reserved[\s\S]*WHERE source_reserved\.blocked_until IS NULL OR source_reserved\.blocked_until <= now\(\)/);
  assert.ok(values.every((value) => value !== subject && value !== clientIp));
  const hmacValues = values.filter((value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value));
  assert.equal(new Set(hmacValues).size, 2);
  assert.equal(reservation.limited, false);
  assert.equal(reservation.clientIp, clientIp);
});

test('reservation returns the longest database cooldown as Retry-After', async () => {
  const fakeSql = async () => [
    { bucket_kind: 'source', is_limited: false, retry_after_seconds: 0 },
    { bucket_kind: 'source_subject', is_limited: true, retry_after_seconds: 41 },
  ];
  const result = await reserveLoginAttempt(
    fakeSql,
    { subject: 'victim@example.test', clientIp: '203.0.113.9' },
    testPolicy(),
  );
  assert.equal(result.limited, true);
  assert.equal(result.retryAfterSeconds, 41);

  const sourceBlocked = await reserveLoginAttempt(
    async () => [{ bucket_kind: 'source', is_limited: true, retry_after_seconds: 17 }],
    { subject: 'another@example.test', clientIp: '203.0.113.9' },
    testPolicy(),
  );
  assert.equal(sourceBlocked.limited, true);
  assert.equal(sourceBlocked.retryAfterSeconds, 17);
});

test('successful login clears only its pair and subtracts one shared-source reservation', async () => {
  const calls = [];
  const fakeSql = async (strings, ...values) => {
    calls.push({ query: strings.join('?'), values });
    return [];
  };
  const reservation = {
    limited: false,
    retryAfterSeconds: 0,
    clientIp: '203.0.113.9',
    sourceKey: 'a'.repeat(64),
    subjectSourceKey: 'b'.repeat(64),
  };
  await clearSuccessfulLoginAttempt(fakeSql, reservation);

  assert.equal(calls.length, 1);
  assert.match(calls[0].query, /DELETE FROM admin_login_attempt_buckets/);
  assert.match(calls[0].query, /bucket_kind = 'source_subject'/);
  assert.match(calls[0].query, /attempt_count = GREATEST\(0, attempt_count - 1\)/);
  assert.equal([...calls[0].query.matchAll(/DELETE FROM admin_login_attempt_buckets/g)].length, 1);
});

test('login route guards before lookup and keeps account-state failures non-enumerating', async () => {
  const route = await readFile(new URL('../src/app/auth/login/route.ts', import.meta.url), 'utf8');
  const reserveAt = route.indexOf('reservation = await reserveLoginAttempt');
  const userLookupAt = route.indexOf('user = await getAuthUserByEmail');

  assert.ok(reserveAt >= 0 && userLookupAt > reserveAt);
  assert.match(route, /INVALID_PASSWORD_SENTINEL/);
  assert.match(route, /verifyPassword\(password, usablePasswordHash\(user\?\.password_hash\)\)/);
  assert.match(route, /!user \|\| !passwordMatches \|\| userStatus !== 'active'/);
  assert.doesNotMatch(route, /reason:\s*userStatus === 'disabled'/);
  assert.match(route, /reason: 'invalid credentials' \}, 401, authHeaders/);
  assert.match(route, /'retry-after': String\(reservation\.retryAfterSeconds\)/);
  assert.match(route, /const meta = \{ \.\.\.requestMeta, ip: null as string \| null \}/);
  assert.match(route, /const clientIp = requestMeta\.ip/);
  assert.doesNotMatch(route, /resolveTrustedLoginClientIp\(req, policy\)/);
  assert.match(route, /meta\.ip = clientIp/);
});

test('migration constrains bucket kinds and never adds an identity-only lock', async () => {
  const migration = await readFile(
    new URL('../db/migrations/20260723200500_0053_admin_login_abuse_guard.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /PRIMARY KEY \(bucket_kind, bucket_key\)/);
  assert.match(migration, /bucket_kind IN \('source', 'source_subject'\)/);
  assert.match(migration, /bucket_key ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.doesNotMatch(migration, /'subject'\s*[,)]/);
});
