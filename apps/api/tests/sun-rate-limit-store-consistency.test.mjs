import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('distributed store uses DB table suitable for multi-process consistency', async () => {
  const source = await readFile(new URL('../src/lib/sun-rate-limit-store.ts', import.meta.url), 'utf8');
  assert.match(source, /INSERT INTO sun_rate_limit_events/);
  assert.match(source, /count\(\*\)::int AS hits/);
});
