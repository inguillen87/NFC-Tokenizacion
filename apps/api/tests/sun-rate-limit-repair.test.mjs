import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('sun rate limit store repairs missing table instead of in-memory fallback', async () => {
  const src = await readFile(new URL('../src/lib/sun-rate-limit-store.ts', import.meta.url), 'utf8');
  assert.match(src, /ensureSunRateLimitTable/);
  assert.match(src, /CREATE TABLE IF NOT EXISTS sun_rate_limit_events/);
  assert.match(src, /sun_rate_limit_repair/);
  assert.doesNotMatch(src, /memoryFallback/);
});
