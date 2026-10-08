import assert from 'node:assert/strict';
import test from 'node:test';
import { disabledScriptFailureDecision, htmlCspMetaStatus } from './browser/disabled-script-policy.mjs';

const base = () => ({
  javaScriptEnabled: false, closing: false, errorText: 'csp', method: 'GET', resourceType: 'script', navigation: false, mainFrame: true,
  origin: 'http://127.0.0.1:7777', requestUrl: 'http://127.0.0.1:7777/_next/static/chunks/root-main.js',
  currentDocumentSha256: 'a'.repeat(64), requestDocumentPolicyId: 'owned-view/doc-1', currentDocumentPolicyId: 'owned-view/doc-1',
  documentPolicy: { id: 'owned-view/doc-1', sequence: 1, originOwned: true, status: 200, html: true, cspPresent: false, cspReportOnlyPresent: false, cspMetaPresent: false, documentSha256: 'a'.repeat(64), htmlSha256: 'e'.repeat(64) },
  binding: { buildManifestSha256: 'b'.repeat(64), rootMainFiles: ['static/chunks/root-main.js'], rootMainPreloads: [{ path: '/_next/static/chunks/root-main.js', sha256: 'c'.repeat(64) }], hashes: { 'apps/web/.next/build-manifest.json': 'b'.repeat(64), 'apps/web/.next/static/chunks/root-main.js': 'c'.repeat(64) } },
});

test('only the observed no-JavaScript browser policy block has complete, independently catalogued evidence', () => {
  assert.deepEqual(disabledScriptFailureDecision(base()), { expected: true, rule: 'intentional_disabled_script_preload', scriptPath: '/_next/static/chunks/root-main.js', scriptSha256: 'c'.repeat(64), buildManifestSha256: 'b'.repeat(64), documentPolicyId: 'owned-view/doc-1' });
});

test('JavaScript mode and network-error crossproduct keeps all aborts and normal failures fatal', () => {
  for (const javaScriptEnabled of [true, false, undefined, null, 'false']) for (const errorText of ['csp', 'net::ERR_ABORTED', 'net::ERR_BLOCKED_BY_CSP', 'net::ERR_FAILED', 'CSP', 'csp private-contact']) {
    const expected = javaScriptEnabled === false && errorText === 'csp';
    assert.equal(disabledScriptFailureDecision({ ...base(), javaScriptEnabled, errorText }).expected, expected, `${String(javaScriptEnabled)} / ${errorText}`);
  }
});

test('foreign, query, fragment, unknown module and wrong request shapes never qualify', () => {
  const variants = [
    { closing: true }, { closing: undefined }, { method: 'HEAD' }, { method: 'POST' }, { resourceType: 'fetch' }, { resourceType: 'other' }, { navigation: true }, { mainFrame: false },
    ...['https://outside.example/_next/static/chunks/root-main.js', 'http://user:private@127.0.0.1:7777/_next/static/chunks/root-main.js', 'http://127.0.0.1:7777/_next/static/chunks/root-main.js?token=private', 'http://127.0.0.1:7777/_next/static/chunks/root-main.js?', 'http://127.0.0.1:7777/_next/static/chunks/root-main.js#private', 'http://127.0.0.1:7777/_next/static/chunks/root-main.js#', 'http://127.0.0.1:7777/_next/static/chunks/unknown.js', 'not-a-url'].map(requestUrl => ({ requestUrl })),
  ];
  for (const variant of variants) assert.equal(disabledScriptFailureDecision({ ...base(), ...variant }).expected, false);
});

test('actual server CSP, missing HTML/current-document evidence and compiled hash mismatch stay fatal', () => {
  for (const change of [{ cspPresent: true }, { cspReportOnlyPresent: true }, { cspMetaPresent: true }, { cspPresent: undefined }, { cspReportOnlyPresent: undefined }, { cspMetaPresent: undefined }, { html: false }, { status: 302 }, { status: 503 }, { originOwned: false }, { documentSha256: null }, { htmlSha256: null }, { sequence: 0 }]) {
    const input = base(); Object.assign(input.documentPolicy, change); assert.equal(disabledScriptFailureDecision(input).expected, false);
  }
  for (const change of [{ requestDocumentPolicyId: 'older-document' }, { currentDocumentPolicyId: 'new-document-same-url' }, { currentDocumentPolicyId: undefined }, { currentDocumentSha256: 'd'.repeat(64) }, { documentPolicy: null }, { binding: null }]) assert.equal(disabledScriptFailureDecision({ ...base(), ...change }).expected, false);
  for (const mutate of [
    input => { input.binding.hashes['apps/web/.next/build-manifest.json'] = 'd'.repeat(64); },
    input => { input.binding.hashes['apps/web/.next/static/chunks/root-main.js'] = 'd'.repeat(64); },
    input => { input.binding.rootMainPreloads = []; },
    input => { input.binding.rootMainFiles.push('static/chunks/root-main.js'); },
    input => { input.binding.rootMainFiles = ['../outside.js']; },
    input => { input.binding.rootMainPreloads[0].sha256 = 'private'; },
  ]) { const input = base(); mutate(input); assert.equal(disabledScriptFailureDecision(input).expected, false); }
});

test('actual HTML CSP meta is detected without executing markup, including mixed case and encoded attribute values', () => {
  for (const html of ["<META HTTP-EQUIV='Content-Security-Policy' content=\"script-src 'none'\">", '<meta http-equiv=content-security-policy>', '<meta http-equiv="Content&#45;Security&#x2d;Policy">']) assert.equal(htmlCspMetaStatus(html), true);
  assert.equal(htmlCspMetaStatus('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">'), false);
  assert.equal(htmlCspMetaStatus('<!-- <meta http-equiv=content-security-policy> --><main>Plain HTML</main>'), false);
  assert.equal(htmlCspMetaStatus('<meta http-equiv="Content-Security-Policy"'), null);
  assert.equal(htmlCspMetaStatus(null), null);
});
