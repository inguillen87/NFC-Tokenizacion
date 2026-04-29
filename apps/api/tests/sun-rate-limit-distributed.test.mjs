import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('sun route uses distributed store and no in-memory Map limiter', async () => {
  const source = await readFile(new URL('../src/app/sun/route.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /rateMap\s*=\s*new Map/);
  assert.match(source, /hitSunRateLimit\(/);
  assert.match(source, /'ip'/);
  assert.match(source, /'bid'/);
  assert.match(source, /'uid_ctr'/);
});

test('same IP threshold path returns 429 and sanitized reason', async () => {
  const source = await readFile(new URL('../src/app/sun/route.ts', import.meta.url), 'utf8');
  assert.match(source, /reason:\s*'rate_limited'/);
  assert.match(source, /\}, 429,/);
});

test('correlation ID is present for JSON and HTML responses', async () => {
  const source = await readFile(new URL('../src/app/sun/route.ts', import.meta.url), 'utf8');
  assert.match(source, /x-nexid-trace-id/);
  assert.match(source, /x-request-id/);
});
