import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import { BATCH_WORKSPACE_VIEWS, batchWorkspaceHref, buildBatchWorkspaceNavigation } from '../src/lib/batch-workspace-navigation.ts';
import { batchWorkspaceCopy } from '../src/lib/batch-workspace-copy.ts';

const BID = 'QA-2026:lot + ñ';
const TENANT = 'qa-only';
const session = (patch = {}) => ({ role: 'tenant-admin', tenantSlug: TENANT, permissions: ['batches:read', 'logistics:read', 'incidents:read'], deniedPermissions: [], isDemo: false, ...patch });
const model = (patch = {}) => buildBatchWorkspaceNavigation(BID, TENANT, 'overview', session(patch));
const source = path => readFile(new URL(path, import.meta.url), 'utf8');

for (const view of BATCH_WORKSPACE_VIEWS) {
  test(`${view}: keeps exact batch identity, canonical tenant and an allowlisted route`, () => {
    const href = batchWorkspaceHref(BID, TENANT, view), url = new URL(href, 'https://dashboard.example.invalid');
    assert.equal(url.origin, 'https://dashboard.example.invalid');
    assert.equal(decodeURIComponent(url.pathname.split('/')[2]), BID);
    assert.equal(url.pathname.split('/').slice(3).join('/'), view === 'overview' ? '' : view);
    assert.deepEqual([...url.searchParams], [['tenant', TENANT]]);
    assert.equal(url.hash, ''); assert.equal(url.username, '');
  });
}
test('invalid batch and tenant input cannot become links or reflected context', () => {
  for (const bid of ['', '.', '..', ' leading', 'trailing ', 'x/y', 'x\\y', '%2e%2e', 'x?tenant=other', 'x#fragment', '\u0000bad', '\ud800', 'x'.repeat(161), {}, null]) {
    assert.equal(batchWorkspaceHref(bid, TENANT), null);
    const result = buildBatchWorkspaceNavigation(bid, TENANT, 'overview', session());
    assert.equal(result.reason, 'invalid_context'); assert.equal(result.bid, ''); assert.deepEqual(result.items, []);
  }
  for (const tenant of ['QA-ONLY', ' qa-only', 'qa-only ', 'qa/other', 'x?token=secret', '', {}, null, 'x'.repeat(129)]) assert.equal(batchWorkspaceHref(BID, tenant), null);
});
test('unrecognized destinations, prototype keys and external paths are not routable', () => {
  for (const view of ['__proto__', 'constructor', 'https://outside.invalid', '../settings', 'recalls?tenant=other', '', null]) assert.equal(batchWorkspaceHref(BID, TENANT, view), null);
});
test('tenant operator cannot use another company despite permissive role', () => {
  for (const role of ['tenant-admin', 'tenant-owner', 'operations-manager']) {
    const result = buildBatchWorkspaceNavigation(BID, 'other-company', 'passport', session({ role }));
    assert.equal(result.reason, 'scope_mismatch'); assert.equal(result.listHref, null); assert.deepEqual(result.items, []);
  }
});
test('super-admin must explicitly select a valid company and gets no silent global fallback', () => {
  const global = session({ role: 'super-admin', tenantSlug: null, permissions: ['*'] });
  assert.equal(buildBatchWorkspaceNavigation(BID, '', 'overview', global).reason, 'tenant_required');
  assert.equal(buildBatchWorkspaceNavigation(BID, 'another-company', 'overview', global).tenant, 'another-company');
  assert.equal(buildBatchWorkspaceNavigation(BID, 'bad/scope', 'overview', global).reason, 'invalid_context');
});
test('explicit batch-read denial removes every link even from a wildcard principal', () => {
  for (const role of ['super-admin', 'tenant-owner', 'tenant-admin']) {
    const result = model({ role, permissions: ['*'], deniedPermissions: ['batches:read'] });
    assert.equal(result.reason, 'access_denied'); assert.equal(result.listHref, null); assert.deepEqual(result.items, []);
  }
});
test('read-only operator sees permitted read destinations, not recall or movement grants', () => {
  const result = model({ role: 'viewer', permissions: ['batches:read'] });
  assert.equal(result.reason, 'ready');
  assert.equal(result.items.filter(item => item.href).length, 5);
  for (const view of ['intake', 'recalls']) assert.equal(result.items.find(item => item.view === view).href, null);
});
test('existing intake and recall explicit denials remain independent', () => {
  const result = model({ deniedPermissions: ['epcis.import', 'recalls.read'] });
  assert.equal(result.items.find(item => item.view === 'intake').blocked, 'permission');
  assert.equal(result.items.find(item => item.view === 'recalls').blocked, 'permission');
  assert.ok(result.items.find(item => item.view === 'passport').href);
});
test('demo scope never offers live customer operations', () => {
  const result = model({ isDemo: true });
  assert.deepEqual(result.items.filter(item => item.href).map(item => item.view), ['overview']);
  assert.ok(result.items.filter(item => !item.href).every(item => item.blocked === 'demo'));
});
test('unknown roles fail closed without granting navigation from permissions alone', () => {
  assert.equal(model({ role: 'invented-role', permissions: ['*'] }).reason, 'access_denied');
});
test('a new scope creates only new links and carries no cursor, token, cookie or prior form data', () => {
  const admin = session({ role: 'super-admin', tenantSlug: null, permissions: ['*'], cookie: 'DO-NOT-RENDER', id: 'private-session' });
  const first = buildBatchWorkspaceNavigation('QA-A', 'tenant-a', 'passport', admin);
  const second = buildBatchWorkspaceNavigation('QA-B', 'tenant-b', 'intake', admin);
  assert.ok(second.items.every(item => !item.href || item.href.includes('/QA-B/') || item.href.includes('/QA-B?')));
  assert.ok(second.items.every(item => !item.href || item.href.endsWith('tenant=tenant-b')));
  assert.doesNotMatch(JSON.stringify(second), /DO-NOT-RENDER|private-session|tenant-a|QA-A|cursor|token/);
  assert.equal(first.tenant, 'tenant-a'); assert.equal(second.items.filter(item => item.current).length, 1);
});
test('locale copy is complete and not re-encoded or populated with readiness claims', () => {
  const keys = Object.keys(batchWorkspaceCopy['es-AR']).sort();
  for (const copy of Object.values(batchWorkspaceCopy)) {
    assert.deepEqual(Object.keys(copy).sort(), keys);
    assert.ok(Object.values(copy).every(value => typeof value === 'string' && value.trim()));
    assert.doesNotMatch(JSON.stringify(copy), /Ã|Â|â€|100%/);
  }
});
function evaluate(sourceText, imports) {
  const output = ts.transpileModule(sourceText, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(name => {
    assert.ok(Object.hasOwn(imports, name), `Unexpected import ${name}`); return imports[name];
  }, module, module.exports); return module.exports;
}
function nodes(value) {
  return React.Children.toArray(value).flatMap(child => React.isValidElement(child) ? [child, ...nodes(child.props.children)] : []);
}
test('actual navigation component has one current page, no mutation buttons, no prefetch and no session props', async () => {
  function Link() {} const Icon = () => null;
  const { BatchWorkspaceNavigation } = evaluate(await source('../src/components/batch-workspace-navigation.tsx'), {
    react: React, 'next/link': Link, 'lucide-react': { ArrowLeft: Icon, ArrowUpRight: Icon, LockKeyhole: Icon },
    '../lib/batch-workspace-copy': { batchWorkspaceCopy }, './batch-workspace-navigation.module.css': new Proxy({}, { get: (_, key) => key }),
  });
  for (const locale of Object.keys(batchWorkspaceCopy)) {
    const tree = BatchWorkspaceNavigation({ model: model(), locale }); const all = nodes(tree);
    assert.equal(tree.type, 'nav'); assert.equal(tree.props['aria-label'], batchWorkspaceCopy[locale].label);
    assert.equal(all.filter(node => node.props['aria-current'] === 'page').length, 1);
    const links = all.filter(node => node.type === Link);
    assert.equal(links.length, 7); assert.ok(links.every(node => node.props.prefetch === false && !node.props.target && node.props.href.endsWith('tenant=qa-only')));
    assert.equal(all.filter(node => node.type === 'button').length, 0);
    assert.ok(all.every(node => !node.props.session && !node.props.cookie));
  }
  const denied = BatchWorkspaceNavigation({ model: model({ deniedPermissions: ['batches:read'] }) });
  assert.equal(nodes(denied).filter(node => node.type === Link).length, 0);
});
for (const view of BATCH_WORKSPACE_VIEWS) {
  test(`${view}: actual route wires the shared server navigation without removing its existing authorization`, async () => {
    const folder = view === 'overview' ? '' : `${view}/`;
    const text = await source(`../src/app/(app)/batches/[bid]/${folder}page.tsx`);
    assert.match(text, /requireDashboard(?:Session|Destination)\(/);
    assert.match(text, /createAdminPageContext\(session,/);
    assert.match(text, new RegExp(`current="${view}" session=\\{session\\}`));
    assert.match(text, /tenant=\{(?:dossier\.tenant|ctx\.tenantSlug|context\.tenantSlug)\}/);
    assert.doesNotMatch(text, /fetch\([^)]*workspace-navigation|await.*buildBatchWorkspaceNavigation/);
  });
}
test('dossier inline editor link and retry preserve the explicitly selected company', async () => {
  const page = await source('../src/app/(app)/batches/[bid]/page.tsx');
  const shell = await source('../src/components/batch-dossier-shell.tsx');
  assert.match(page, /\/passport\?\$\{new URLSearchParams\(\{tenant:dossier.tenant\}\)\}/);
  assert.match(page, /new URLSearchParams\(adminContext.tenantSlug\?\{tenant:adminContext.tenantSlug\}:\{\}\)/);
  assert.match(shell, /\/passport\?\$\{new URLSearchParams\(\{tenant:model.tenant\}\)\}/);
  assert.match(shell, /\{navigation\}/);
});
