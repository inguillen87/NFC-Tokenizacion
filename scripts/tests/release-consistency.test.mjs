import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROTOCOL, ReleaseCheckError, validateManifest, checkDeployment, checkAlias, checkLiveness, evaluateRelease, createReadOnlyReader } from '../lib/release-consistency.mjs';

const NOW = Date.parse('2026-09-19T07:00:00.000Z');
const clone = v => structuredClone(v);
const token = 'test-token-never-print-this';
function manifest() {
  return { protocol: PROTOCOL, releaseId: 'unit-test-not-production', teamId: 'team_TESTONLY123456', components: ['api', 'web', 'dashboard'].map((name, i) => ({
    name, domain: ['api.nexid.lat', 'nexid.lat', 'app.nexid.lat'][i], projectId: `prj_TESTONLY000${i}`, deploymentId: `dpl_TESTONLY000${i}`, gitSha: String(i + 1).repeat(40)
  })) };
}
function deployment(c) { return { id: c.deploymentId, projectId: c.projectId, readyState: 'READY', target: null, gitSource: { sha: c.gitSha }, meta: { githubCommitSha: c.gitSha, gitCommitSha: c.gitSha, gitDirty: '0' } }; }
function alias(c) { return { alias: c.domain, uid: `alias_${c.name}`, updatedAt: NOW - 1000, deploymentId: c.deploymentId, deployment: { id: c.deploymentId }, projectId: c.projectId }; }
const health = () => ({ ok: true, service: 'api', check: 'process_liveness', now: new Date(NOW).toISOString(), uptimeSec: 0 });
function fixtureReader(m, hook = () => {}) {
  const calls = [];
  const reader = async url => {
    calls.push(url);
    const u = new URL(url);
    let data;
    if (u.hostname === 'api.nexid.lat') data = health();
    else if (u.pathname.startsWith('/v13/deployments/')) data = deployment(m.components.find(c => u.pathname.endsWith(c.deploymentId)));
    else data = alias(m.components.find(c => u.pathname === `/v4/aliases/${c.domain}`));
    return hook(data, calls.length, u) ?? data;
  };
  return { reader, calls };
}
const rejectsCode = (fn, code) => assert.rejects(fn, e => e instanceof ReleaseCheckError && e.code === code);

test('manifest normalizes component order without retaining input references', () => {
  const input = manifest(); input.components.reverse();
  const checked = validateManifest(input);
  assert.deepEqual(checked.components.map(c => c.name), ['api', 'web', 'dashboard']);
  input.components[0].gitSha = 'bad';
  assert.equal(checked.components[2].gitSha, '3'.repeat(40));
  assert.ok(Object.isFrozen(checked.components[0]));
});
for (const [name, change, code] of [
  ['protocol', m => m.protocol = 'v0', 'manifest_protocol_invalid'],
  ['unknown root', m => m.token = token, 'manifest_fields_invalid'],
  ['missing root', m => delete m.teamId, 'manifest_fields_invalid'],
  ['team URL', m => m.teamId = 'https://evil.test', 'manifest_team_id_invalid'],
  ['release injection', m => m.releaseId = '../secret', 'manifest_release_id_invalid'],
  ['missing component', m => m.components.pop(), 'manifest_three_components_required'],
  ['extra component', m => m.components.push(clone(m.components[0])), 'manifest_three_components_required'],
  ['unknown field', m => m.components[0].headers = { Authorization: token }, 'manifest_component_fields_invalid'],
  ['project unknown', m => m.components[0].projectId = null, 'manifest_project_id_required'],
  ['duplicate project', m => m.components[1].projectId = m.components[0].projectId, 'manifest_duplicate_projectId'],
  ['duplicate deployment', m => m.components[1].deploymentId = m.components[0].deploymentId, 'manifest_duplicate_deploymentId'],
  ['duplicate component', m => m.components[1] = clone(m.components[0]), 'manifest_duplicate_name'],
  ['short SHA', m => m.components[0].gitSha = 'abcdef1', 'manifest_full_git_sha_required'],
  ['uppercase SHA', m => m.components[0].gitSha = 'A'.repeat(40), 'manifest_full_git_sha_required'],
  ['deployment path', m => m.components[0].deploymentId = '../secrets', 'manifest_deployment_id_invalid'],
  ['domain URL', m => m.components[0].domain = 'https://api.nexid.lat', 'manifest_component_scope_invalid'],
  ['domain suffix attack', m => m.components[0].domain = 'api.nexid.lat.evil.test', 'manifest_component_scope_invalid'],
  ['wrong component', m => m.components[0].name = '__proto__', 'manifest_component_scope_invalid'],
]) test(`manifest refuses ${name}`, () => {
  const input = manifest(); change(input);
  assert.throws(() => validateManifest(input), e => e.code === code);
});
for (const input of [null, [], 'text', 1, false]) test(`manifest refuses primitive ${JSON.stringify(input)}`, () => assert.throws(() => validateManifest(input), { code: 'manifest_fields_invalid' }));

test('deployment accepts matching full SHA/clean source; target alone is not alias truth', () => {
  const c = manifest().components[0];
  assert.deepEqual(checkDeployment(c, deployment(c)), []);
});
for (const [name, change, code] of [
  ['wrong ID', d => d.id = 'dpl_other', 'deployment_id_mismatch'],
  ['wrong project', d => d.projectId = 'prj_other', 'deployment_project_mismatch'],
  ['not ready', d => d.readyState = 'BUILDING', 'deployment_not_ready'],
  ['missing SHA', d => { delete d.gitSource; delete d.meta.githubCommitSha; delete d.meta.gitCommitSha; }, 'deployment_git_sha_missing'],
  ['conflicting source', d => d.gitSource.sha = 'a'.repeat(40), 'deployment_git_sha_mismatch'],
  ['conflicting metadata', d => d.meta.gitCommitSha = 'b'.repeat(40), 'deployment_git_sha_mismatch'],
  ['dirty source', d => d.meta.gitDirty = '1', 'deployment_clean_source_unconfirmed'],
  ['unknown cleanliness', d => delete d.meta.gitDirty, 'deployment_clean_source_unconfirmed'],
  ['boolean false is not clean proof', d => d.meta.gitDirty = false, 'deployment_clean_source_unconfirmed'],
  ['public reduced response', d => { delete d.meta; delete d.gitSource; delete d.projectId; }, 'deployment_project_mismatch'],
]) test(`deployment rejects ${name}`, () => {
  const c = manifest().components[0], d = deployment(c); change(d);
  assert.ok(checkDeployment(c, d).includes(code));
});
test('deployment accepts numeric zero and one authoritative SHA field', () => {
  const c = manifest().components[0], d = deployment(c); delete d.gitSource; delete d.meta.gitCommitSha; d.meta.gitDirty = 0;
  assert.deepEqual(checkDeployment(c, d), []);
});
test('deployment invalid response fails closed', () => assert.deepEqual(checkDeployment(manifest().components[0], null), ['deployment_response_invalid']));
for (const [name, change, code] of [
  ['wrong domain', a => a.alias = 'evil.test', 'alias_domain_mismatch'],
  ['wrong project', a => a.projectId = 'prj_other', 'alias_project_mismatch'],
  ['wrong deployment', a => a.deploymentId = 'dpl_other', 'alias_deployment_mismatch'],
  ['nested mismatch', a => a.deployment.id = 'dpl_other', 'alias_nested_deployment_mismatch'],
  ['redirect', a => a.redirect = 'evil.test', 'alias_redirect_unsupported'],
  ['deleted', a => a.deletedAt = NOW, 'alias_deleted'],
  ['microfrontend routing', a => a.microfrontends = {}, 'alias_microfrontends_unsupported'],
  ['no revision', a => delete a.updatedAt, 'alias_revision_unconfirmed'],
  ['string revision', a => a.updatedAt = String(NOW), 'alias_revision_unconfirmed'],
  ['no identity', a => delete a.uid, 'alias_identity_unconfirmed'],
]) test(`alias rejects ${name}`, () => {
  const c = manifest().components[0], a = alias(c); change(a);
  assert.throws(() => checkAlias(c, a), { code });
});
test('alias projection never returns provider secrets or contact info', () => {
  const c = manifest().components[0], a = alias(c); a.protectionBypass = token; a.creator = { email: 'private@test.invalid' };
  assert.deepEqual(Object.keys(checkAlias(c, a)).sort(), ['deploymentId', 'projectId', 'uid', 'updatedAt']);
});
for (const [name, change] of [
  ['false ok', h => h.ok = false], ['string ok', h => h.ok = 'true'], ['wrong service', h => h.service = 'web'],
  ['not liveness', h => h.check = 'readiness'], ['stale', h => h.now = new Date(NOW - 61000).toISOString()],
  ['future', h => h.now = new Date(NOW + 61000).toISOString()], ['invalid date', h => h.now = 'no'],
  ['negative uptime', h => h.uptimeSec = -1], ['fraction uptime', h => h.uptimeSec = .5]
]) test(`health fails closed for ${name}`, () => { const h = health(); change(h); assert.ok(checkLiveness(h, NOW).length > 0); });

test('full fixture performs ten GET reads and reports only narrow consistency', async () => {
  const m = manifest(), { reader, calls } = fixtureReader(m);
  const report = await evaluateRelease(m, { readJson: reader, now: () => NOW });
  assert.equal(report.consistent, true);
  assert.equal(report.evidenceSource, 'injected_reader');
  assert.equal(report.checks.length, 11); assert.equal(calls.length, 10);
  assert.ok(calls.slice(0, 3).every(u => u.includes('/v4/aliases/')));
  assert.ok(calls.slice(3, 6).every(u => u.includes('/v13/deployments/') && u.includes('withGitRepoInfo=true')));
  assert.equal(calls[6], 'https://api.nexid.lat/health');
  assert.ok(calls.slice(7).every(u => u.includes('/v4/aliases/')));
  for (const key of ['productionAcceptance', 'deploymentPerformed', 'databaseReadiness', 'physicalTapVerified', 'atomicObservation', 'buildAttested']) assert.equal(report.claims[key], false);
});
test('alias change away from expected deployment is never green', async () => {
  const m = manifest(), { reader } = fixtureReader(m, (data, call) => { if (call === 8) data.deploymentId = 'dpl_CHANGED000'; });
  const r = await evaluateRelease(m, { readJson: reader, now: () => NOW });
  assert.equal(r.consistent, false); assert.ok(r.checks.some(c => c.issues.includes('alias_deployment_mismatch')));
});
test('alias change away and back detected through revision even with same deployment', async () => {
  const m = manifest(), { reader } = fixtureReader(m, (data, call) => { if (call === 8) data.updatedAt++; });
  const r = await evaluateRelease(m, { readJson: reader, now: () => NOW });
  assert.equal(r.status, 'inconsistent'); assert.ok(r.checks.some(c => c.issues.includes('alias_changed_during_check')));
});
test('single component error cannot be hidden by healthy siblings', async () => {
  const m = manifest(), { reader } = fixtureReader(m, (data, call) => { if (call === 5) data.readyState = 'ERROR'; });
  const r = await evaluateRelease(m, { readJson: reader, now: () => NOW });
  assert.equal(r.consistent, false); assert.equal(r.status, 'inconsistent');
});
for (const code of ['authorization_required', 'scope_forbidden']) test(`${code} stops requests without retry and records unattempted checks`, async () => {
  let calls = 0;
  const r = await evaluateRelease(manifest(), { now: () => NOW, readJson: async () => { calls++; throw new ReleaseCheckError(code, true); } });
  assert.equal(calls, 1); assert.equal(r.status, 'blocked'); assert.equal(r.consistent, false);
  assert.equal(r.checks.filter(c => c.status === 'not_run').length, 9);
});
test('report redacts unexpected network/provider exceptions', async () => {
  const r = await evaluateRelease(manifest(), { now: () => NOW, readJson: async () => { throw new Error(token); } });
  assert.equal(r.consistent, false); assert.ok(!JSON.stringify(r).includes(token));
});
test('observation outside bounded window is not accepted', async () => {
  const m = manifest(); let t = NOW;
  const { reader } = fixtureReader(m, (_, call) => { if (call === 10) t += 120001; });
  const r = await evaluateRelease(m, { readJson: reader, now: () => t });
  assert.equal(r.consistent, false); assert.ok(r.checks.at(-1).issues.includes('observation_window_invalid'));
});
test('invalid manifest cannot reach the reader', async () => {
  let called = false;
  await rejectsCode(() => evaluateRelease({}, { readJson: async () => { called = true; } }), 'manifest_fields_invalid');
  assert.equal(called, false);
});

const apiURL = 'https://api.vercel.com/v13/deployments/dpl_TESTONLY0000?teamId=team_TESTONLY123456&withGitRepoInfo=true';
const json = (body, options = {}) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...options });
test('transport sets GET/manual redirect and never sends token to public health', async () => {
  const calls = [];
  const read = createReadOnlyReader(token, { fetchImpl: async (url, options) => { calls.push({ url, options }); return json({ ok: true }); } });
  await read(apiURL); await read('https://api.nexid.lat/health');
  assert.equal(calls[0].options.method, 'GET'); assert.equal(calls[0].options.redirect, 'manual');
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${token}`);
  assert.equal(calls[1].options.headers.Authorization, undefined);
});
for (const url of [
  'http://api.vercel.com/v13/deployments/dpl_TESTONLY0000?teamId=team_TESTONLY123456',
  'https://api.vercel.com.evil.test/v13/deployments/dpl_TESTONLY0000?teamId=team_TESTONLY123456',
  'https://api.vercel.com/v1/user', 'https://api.vercel.com/v13/deployments',
  apiURL + '&token=leak', apiURL + '&teamId=team_OTHER00000', apiURL + '#fragment',
  apiURL.replace('api.vercel.com', 'user:pass@api.vercel.com'),
  'https://api.nexid.lat/sun?uid=real-tag', 'https://api.nexid.lat/health?token=leak',
  'https://127.0.0.1/health', 'file:///etc/passwd', 'not a URL'
]) test(`transport refuses unauthorized destination ${url}`, async () => {
  let calls = 0;
  const read = createReadOnlyReader(token, { fetchImpl: async () => { calls++; return json({}); } });
  await rejectsCode(() => read(url), 'request_destination_refused'); assert.equal(calls, 0);
});
for (const [status, code] of [[301, 'redirect_refused'], [302, 'redirect_refused'], [401, 'authorization_required'], [403, 'scope_forbidden'], [429, 'provider_rate_limited'], [500, 'http_read_failed'], [404, 'http_read_failed']]) test(`transport rejects HTTP ${status} without echoing body`, async () => {
  const read = createReadOnlyReader(token, { fetchImpl: async () => json({ secret: token }, { status, headers: { 'content-type': 'application/json', Location: 'https://evil.test' } }) });
  await rejectsCode(() => read(apiURL), code);
});
test('transport rejects a pre-followed redirect', async () => {
  const r = json({}); Object.defineProperty(r, 'redirected', { value: true });
  await rejectsCode(() => createReadOnlyReader(token, { fetchImpl: async () => r })(apiURL), 'redirect_refused');
});
test('transport enforces content length before reading', async () => {
  const read = createReadOnlyReader(token, { maxBytes: 10, fetchImpl: async () => json({}, { headers: { 'content-type': 'application/json', 'content-length': '9999' } }) });
  await rejectsCode(() => read(apiURL), 'response_too_large');
});
test('transport enforces streaming size with no content length', async () => {
  await rejectsCode(() => createReadOnlyReader(token, { maxBytes: 10, fetchImpl: async () => json({ text: 'a'.repeat(100) }) })(apiURL), 'response_too_large');
});
test('transport rejects HTML response', async () => {
  await rejectsCode(() => createReadOnlyReader(token, { fetchImpl: async () => new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } }) })(apiURL), 'response_not_json');
});
test('transport rejects malformed JSON', async () => {
  await rejectsCode(() => createReadOnlyReader(token, { fetchImpl: async () => new Response('{', { headers: { 'content-type': 'application/json' } }) })(apiURL), 'response_json_invalid');
});
test('transport rejects invalid UTF-8', async () => {
  await rejectsCode(() => createReadOnlyReader(token, { fetchImpl: async () => new Response(new Uint8Array([255]), { headers: { 'content-type': 'application/json' } }) })(apiURL), 'response_json_invalid');
});
test('timeout bounds a fetch that never settles', async () => {
  await rejectsCode(() => createReadOnlyReader(token, { timeoutMs: 5, fetchImpl: () => new Promise(() => {}) })(apiURL), 'read_timeout');
});
test('timeout includes response body consumption', async () => {
  const body = new ReadableStream({ start() {} });
  await rejectsCode(() => createReadOnlyReader(token, { timeoutMs: 5, fetchImpl: async () => new Response(body, { headers: { 'content-type': 'application/json' } }) })(apiURL), 'read_timeout');
});
test('transport redacts raw network exception', async () => {
  await rejectsCode(() => createReadOnlyReader(token, { fetchImpl: async () => { throw new Error(token); } })(apiURL), 'read_unavailable');
});
for (const v of [undefined, '', 'bad\nheader', 'contains space']) test(`token validation rejects ${JSON.stringify(v)}`, () => assert.throws(() => createReadOnlyReader(v), { code: 'authorization_required' }));
for (const options of [{ timeoutMs: 9000 }, { maxBytes: 0 }, { maxBytes: 999999999 }, { fetchImpl: null }]) test(`transport bounds config ${JSON.stringify(options)}`, () => assert.throws(() => createReadOnlyReader(token, options), { code: 'reader_configuration_invalid' }));

const cli = fileURLToPath(new URL('../verify-release-consistency.mjs', import.meta.url));
function withFiles(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'nexid-release-test-'));
  try { fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
function invoke(args) { const env = { ...process.env }; delete env.VERCEL_TOKEN; return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env, timeout: 5000 }); }
test('CLI config validation is offline, useful, and not a production verification', () => withFiles(dir => {
  const file = join(dir, 'manifest.json'), out = join(dir, 'report.json'); writeFileSync(file, JSON.stringify(manifest()));
  const result = invoke(['--manifest', file, '--validate-only', '--out', out]);
  assert.equal(result.status, 0); const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'manifest_valid'); assert.equal(report.consistent, null); assert.equal(report.productionAcceptance, false);
  assert.equal(report.manifestSha256.length, 64); assert.ok(existsSync(out));
}));
test('CLI without credential returns blocked, never green', () => withFiles(dir => {
  const file = join(dir, 'manifest.json'); writeFileSync(file, JSON.stringify(manifest()));
  const r = invoke(['--manifest', file]); assert.equal(r.status, 2); assert.equal(JSON.parse(r.stdout).error, 'authorization_required');
}));
test('CLI refuses oversized manifests', () => withFiles(dir => {
  const file = join(dir, 'manifest.json'); writeFileSync(file, ' '.repeat(70000));
  const r = invoke(['--manifest', file, '--validate-only']); assert.equal(r.status, 2); assert.equal(JSON.parse(r.stdout).error, 'manifest_too_large');
}));
test('CLI does not overwrite an existing report', () => withFiles(dir => {
  const file = join(dir, 'manifest.json'), out = join(dir, 'existing.json'); writeFileSync(file, JSON.stringify(manifest())); writeFileSync(out, 'preserve');
  const r = invoke(['--manifest', file, '--validate-only', '--out', out]); assert.equal(r.status, 2); assert.equal(readFileSync(out, 'utf8'), 'preserve');
}));
test('CLI refuses unknown and duplicated options without echoing them', () => {
  for (const args of [['--token', token], ['--validate-only', '--validate-only'], ['--manifest']]) {
    const r = invoke(args); assert.equal(r.status, 2); assert.ok(!r.stdout.includes(token));
  }
});
test('CLI masks filesystem errors and sensitive paths', () => {
  const r = invoke(['--manifest', `/nonexistent/${token}.json`]); assert.equal(r.status, 2); assert.ok(!r.stdout.includes(token));
});

for (const value of [NaN, Infinity, -1, 8_640_000_000_000_001]) test(`invalid clock refuses network (${value})`, async () => {
  let called = false;
  await rejectsCode(() => evaluateRelease(manifest(), { now: () => value, readJson: async () => { called = true; } }), 'observation_clock_invalid');
  assert.equal(called, false);
});

// Regression from authorized Vercel alias responses observed on 2026-09-19.
// Values below are synthetic; no provider credentials or private response bodies are fixtures.
for(const size of [1,100,101,127,128])test(`bounded opaque alias identity accepts ${size} characters`,()=>{
 const c=manifest().components[0],a=alias(c);a.uid='a'.repeat(size);assert.equal(checkAlias(c,a).uid.length,size);
});
for(const [name,uid] of [['over boundary','a'.repeat(129)],['empty',''],['space','abc def'],['newline','abc\ndef'],['path','abc/def'],['unicode','á'.repeat(128)]])test(`alias identity still rejects ${name}`,()=>{
 const c=manifest().components[0],a=alias(c);a.uid=uid;assert.throws(()=>checkAlias(c,a),{code:'alias_identity_unconfirmed'});
});
test('128-character provider-shaped alias identities pass both observations without truncation',async()=>{
 const m=manifest(),{reader}=fixtureReader(m,(data)=>{if(data.uid)data.uid=data.uid.padStart(128,'a');});
 const r=await evaluateRelease(m,{readJson:reader,now:()=>NOW});assert.equal(r.status,'consistent');assert.equal(r.consistent,true);
});
test('a difference at character 128 still detects an alias replacement',async()=>{
 const m=manifest(),{reader}=fixtureReader(m,(data,call)=>{if(data.uid)data.uid='a'.repeat(127)+(call===8?'b':'a');});
 const r=await evaluateRelease(m,{readJson:reader,now:()=>NOW});assert.equal(r.status,'inconsistent');assert.ok(r.checks.some(c=>c.issues.includes('alias_changed_during_check')));
});
