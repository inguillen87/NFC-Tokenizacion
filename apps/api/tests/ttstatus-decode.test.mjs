import test from 'node:test';
import assert from 'node:assert/strict';

const { decodeTTStatus } = await import('../src/lib/ttstatus.ts');

test('decode closed CC', () => {
  const out = decodeTTStatus('4343');
  assert.equal(out.status, 'closed');
  assert.equal(out.raw, 'CC');
});

test('decode opened OO', () => {
  const out = decodeTTStatus('4F4F');
  assert.equal(out.status, 'opened');
  assert.equal(out.tampered, true);
});

test('decode invalid II', () => {
  const out = decodeTTStatus('4949');
  assert.equal(out.status, 'invalid');
  assert.equal(out.tampered, null);
});
