import test from 'node:test';
import assert from 'node:assert/strict';
import { selectCtaActionsChunk } from './browser/deferred-tools-chunk-contract.mjs';

const currentModule = 'exports(["CtaActions", function () { return { className: "sun-public-cta", advanced: "sun-advanced-actions" }; }]);';

test('selects the current module independently of chunk name, order and retired OCR endpoint', () => {
  const chunks = [
    { name: 'legacy.js', source: 'fetch("/api/public-cta/receipt-ocr")' },
    { name: 'current-hash.js', source: currentModule },
    { name: 'other.js', source: 'exports(["OtherActions"]);' },
  ];
  assert.equal(selectCtaActionsChunk(chunks), 'current-hash.js');
  assert.equal(selectCtaActionsChunk(chunks.toReversed()), 'current-hash.js');
});

test('fails closed when the compiled deferred module is absent', () => {
  assert.throws(() => selectCtaActionsChunk([]), /exactly one built CtaActions chunk; found 0/);
});

test('requires both module surfaces and the CtaActions identity', () => {
  for (const marker of ['CtaActions', 'sun-public-cta', 'sun-advanced-actions']) {
    assert.throws(() => selectCtaActionsChunk([{ name: 'partial.js', source: currentModule.replace(marker, 'unrelated') }]), /found 0/);
  }
  assert.throws(() => selectCtaActionsChunk([{ name: 'source.js.map', source: currentModule }]), /found 0/);
});

test('fails closed on multiple matching files instead of choosing the first', () => {
  const chunks = [{ name: 'second.js', source: currentModule }, { name: 'first.js', source: currentModule }];
  assert.throws(() => selectCtaActionsChunk(chunks), /exactly one built CtaActions chunk; found 2: first\.js, second\.js/);
});
