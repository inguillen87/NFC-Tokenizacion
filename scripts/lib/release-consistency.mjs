/** Read-only NexID release consistency checks. Not a deployment/rollback controller. */
export const PROTOCOL = 'nexid.release-consistency.v1';
const DOMAINS = Object.freeze({ api: 'api.nexid.lat', web: 'nexid.lat', dashboard: 'app.nexid.lat' });
const COMPONENTS = Object.keys(DOMAINS);
const SHA = /^[a-f0-9]{40}$/;
const TEAM = /^team_[A-Za-z0-9]{8,80}$/;
const PROJECT = /^prj_[A-Za-z0-9]{8,80}$/;
const DEPLOYMENT = /^dpl_[A-Za-z0-9]{8,80}$/;
const own = (v, k) => Object.prototype.hasOwnProperty.call(v, k);
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);

export class ReleaseCheckError extends Error {
  constructor(code, blocked = false) {
    super(code);
    this.name = 'ReleaseCheckError';
    this.code = code;
    this.blocked = blocked;
  }
}
const fail = code => { throw new ReleaseCheckError(code, true); };
function exact(v, keys, code) {
  if (!record(v) || Object.keys(v).some(k => !keys.includes(k)) || keys.some(k => !own(v, k))) fail(code);
}

export function validateManifest(input) {
  exact(input, ['protocol', 'releaseId', 'teamId', 'components'], 'manifest_fields_invalid');
  if (input.protocol !== PROTOCOL) fail('manifest_protocol_invalid');
  if (typeof input.releaseId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(input.releaseId)) fail('manifest_release_id_invalid');
  if (typeof input.teamId !== 'string' || !TEAM.test(input.teamId)) fail('manifest_team_id_invalid');
  if (!Array.isArray(input.components) || input.components.length !== 3) fail('manifest_three_components_required');
  const seen = { name: new Set(), projectId: new Set(), deploymentId: new Set() };
  const components = input.components.map(c => {
    exact(c, ['name', 'domain', 'projectId', 'deploymentId', 'gitSha'], 'manifest_component_fields_invalid');
    if (!COMPONENTS.includes(c.name) || c.domain !== DOMAINS[c.name]) fail('manifest_component_scope_invalid');
    if (typeof c.projectId !== 'string' || !PROJECT.test(c.projectId)) fail('manifest_project_id_required');
    if (typeof c.deploymentId !== 'string' || !DEPLOYMENT.test(c.deploymentId)) fail('manifest_deployment_id_invalid');
    if (typeof c.gitSha !== 'string' || !SHA.test(c.gitSha)) fail('manifest_full_git_sha_required');
    for (const key of Object.keys(seen)) {
      if (seen[key].has(c[key])) fail(`manifest_duplicate_${key}`);
      seen[key].add(c[key]);
    }
    return Object.freeze({ name: c.name, domain: c.domain, projectId: c.projectId, deploymentId: c.deploymentId, gitSha: c.gitSha });
  });
  components.sort((a, b) => COMPONENTS.indexOf(a.name) - COMPONENTS.indexOf(b.name));
  return Object.freeze({ protocol: PROTOCOL, releaseId: input.releaseId, teamId: input.teamId, components: Object.freeze(components) });
}

export function checkDeployment(component, data) {
  const issues = [];
  if (!record(data)) return ['deployment_response_invalid'];
  if (data.id !== component.deploymentId) issues.push('deployment_id_mismatch');
  if (data.projectId !== component.projectId) issues.push('deployment_project_mismatch');
  if (data.readyState !== 'READY') issues.push('deployment_not_ready');
  // Do not mistake an old target/alias list for the domain's current mapping.
  const meta = record(data.meta) ? data.meta : {};
  const candidates = [data.gitSource?.sha, meta.githubCommitSha, meta.gitCommitSha].filter(v => v !== undefined && v !== null);
  if (candidates.length === 0) issues.push('deployment_git_sha_missing');
  else if (candidates.some(v => typeof v !== 'string' || !SHA.test(v) || v !== component.gitSha)) issues.push('deployment_git_sha_mismatch');
  // This metadata is an uploader declaration, not an independent build attestation.
  if (meta.gitDirty !== '0' && meta.gitDirty !== 0) issues.push('deployment_clean_source_unconfirmed');
  return issues;
}

export function checkAlias(component, data) {
  if (!record(data)) fail('alias_response_invalid');
  if (data.alias !== component.domain) fail('alias_domain_mismatch');
  if (data.projectId !== component.projectId) fail('alias_project_mismatch');
  if (data.deploymentId !== component.deploymentId) fail('alias_deployment_mismatch');
  if (data.deployment != null && (!record(data.deployment) || data.deployment.id !== data.deploymentId)) fail('alias_nested_deployment_mismatch');
  if (data.redirect != null && data.redirect !== '') fail('alias_redirect_unsupported');
  if (data.deletedAt != null) fail('alias_deleted');
  if (data.microfrontends != null) fail('alias_microfrontends_unsupported');
  if (typeof data.uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(data.uid)) fail('alias_identity_unconfirmed');
  // Vercel marks updatedAt optional. Absence deliberately prevents a green result.
  if (!Number.isSafeInteger(data.updatedAt) || data.updatedAt <= 0) fail('alias_revision_unconfirmed');
  return { uid: data.uid, updatedAt: data.updatedAt, deploymentId: data.deploymentId, projectId: data.projectId };
}

export function checkLiveness(data, nowMs) {
  if (!record(data) || data.ok !== true || data.service !== 'api' || data.check !== 'process_liveness') return ['api_liveness_unconfirmed'];
  const at = typeof data.now === 'string' ? Date.parse(data.now) : NaN;
  if (!Number.isFinite(at) || Math.abs(nowMs - at) > 60_000 || !Number.isSafeInteger(data.uptimeSec) || data.uptimeSec < 0) return ['api_liveness_stale_or_invalid'];
  return [];
}

function apiUrl(path, teamId, git = false) {
  const url = new URL(path, 'https://api.vercel.com');
  url.searchParams.set('teamId', teamId);
  if (git) url.searchParams.set('withGitRepoInfo', 'true');
  return url.href;
}
const safeError = error => error instanceof ReleaseCheckError
  ? { code: error.code, blocked: error.blocked }
  : { code: 'read_unavailable', blocked: true };

/**
 * Injected reader permits deterministic tests; this function makes no live-evidence claim.
 * @param {any} input
 * @param {{ readJson?: (url: string) => Promise<any>, now?: () => number }} options
 */
export async function evaluateRelease(input, { readJson, now = Date.now } = {}) {
  const manifest = validateManifest(input);
  if (typeof readJson !== 'function') fail('reader_required');
  const started = now();
  if (!Number.isSafeInteger(started) || started < 0 || started > 8_640_000_000_000_000) fail('observation_clock_invalid');
  const checks = [];
  const before = new Map();
  const add = (component, check, issues) => checks.push({ component, check, status: issues.length ? 'failed' : 'passed', issues });
  let blocked = false;
  let stop = false;
  async function run(component, check, url, inspect) {
    if (stop) {
      checks.push({ component, check, status: 'not_run', issues: ['access_blocked'] });
      return;
    }
    try {
      if (now() - started > 120_000 || now() < started) fail('observation_window_invalid');
      const data = await readJson(url);
      add(component, check, inspect(data));
    } catch (e) {
      const error = safeError(e);
      blocked ||= error.blocked;
      checks.push({ component, check, status: error.blocked ? 'blocked' : 'failed', issues: [error.code] });
      // Never retry or continue making authenticated calls after access denial.
      stop ||= ['authorization_required', 'scope_forbidden'].includes(error.code);
    }
  }
  for (const c of manifest.components) await run(c.name, 'alias_before', apiUrl(`/v4/aliases/${c.domain}`, manifest.teamId), data => {
    before.set(c.name, checkAlias(c, data));
    return [];
  });
  for (const c of manifest.components) await run(c.name, 'deployment', apiUrl(`/v13/deployments/${c.deploymentId}`, manifest.teamId, true), data => checkDeployment(c, data));
  await run('api', 'process_liveness', 'https://api.nexid.lat/health', data => checkLiveness(data, now()));
  for (const c of manifest.components) await run(c.name, 'alias_after', apiUrl(`/v4/aliases/${c.domain}`, manifest.teamId), data => {
    const after = checkAlias(c, data), initial = before.get(c.name);
    return !initial || JSON.stringify(after) !== JSON.stringify(initial) ? ['alias_changed_during_check'] : [];
  });
  const ended = now();
  if (!Number.isSafeInteger(ended) || ended < 0 || ended > 8_640_000_000_000_000) fail('observation_clock_invalid');
  const windowValid = Number.isSafeInteger(started) && Number.isSafeInteger(ended) && ended >= started && ended - started <= 120_000;
  add('release', 'observation_window', windowValid ? [] : ['observation_window_invalid']);
  const consistent = checks.length === 11 && checks.every(c => c.status === 'passed');
  return {
    protocol: PROTOCOL, releaseId: manifest.releaseId, teamId: manifest.teamId,
    evidenceSource: 'injected_reader', status: consistent ? 'consistent' : blocked ? 'blocked' : 'inconsistent',
    consistent, startedAt: new Date(started).toISOString(), completedAt: new Date(ended).toISOString(),
    components: manifest.components, checks,
    claims: { controlPlaneAndApiLivenessOnly: true, deploymentPerformed: false, productionAcceptance: false, databaseReadiness: false, physicalTapVerified: false, atomicObservation: false, buildAttested: false }
  };
}

/** Fixed destinations, GET only, bounded response, no redirects, no provider bodies in errors. */
export function createReadOnlyReader(token, { fetchImpl = globalThis.fetch, timeoutMs = 8_000, maxBytes = 524_288 } = {}) {
  if (typeof token !== 'string' || !/^[\x21-\x7e]{8,4096}$/.test(token)) fail('authorization_required');
  if (typeof fetchImpl !== 'function' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 8_000 || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 524_288) fail('reader_configuration_invalid');
  return async input => {
    let url;
    try { url = new URL(input); } catch { fail('request_destination_refused'); }
    const health = url.href === 'https://api.nexid.lat/health';
    const pathAllowed = /^\/v13\/deployments\/dpl_[A-Za-z0-9]{8,80}$/.test(url.pathname)
      || Object.values(DOMAINS).some(d => url.pathname === `/v4/aliases/${d}`);
    const allowedQuery = ['teamId', 'withGitRepoInfo'];
    const queryAllowed = [...url.searchParams.keys()].every(k => allowedQuery.includes(k) && url.searchParams.getAll(k).length === 1)
      && TEAM.test(url.searchParams.get('teamId') || '')
      && (!url.searchParams.has('withGitRepoInfo') || url.searchParams.get('withGitRepoInfo') === 'true');
    const provider = url.origin === 'https://api.vercel.com' && !url.username && !url.password && !url.hash && pathAllowed && queryAllowed;
    if (!health && !provider) fail('request_destination_refused');
    const controller = new AbortController();
    let timer;
    const work = async () => {
      const response = await fetchImpl(url.href, {
        method: 'GET', redirect: 'manual', cache: 'no-store', signal: controller.signal,
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache, no-store', ...(provider ? { Authorization: `Bearer ${token}` } : {}) }
      });
      const refuse = code => { void response.body?.cancel().catch(() => {}); fail(code); };
      if (response.redirected || (response.status >= 300 && response.status < 400)) refuse('redirect_refused');
      if (response.status === 401) refuse('authorization_required');
      if (response.status === 403) refuse('scope_forbidden');
      if (response.status !== 200) refuse(response.status === 429 ? 'provider_rate_limited' : 'http_read_failed');
      if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) refuse('response_not_json');
      const declared = response.headers.get('content-length');
      if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) refuse('response_too_large');
      if (!response.body) fail('response_body_missing');
      const reader = response.body.getReader();
      const chunks = [];
      let length = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > maxBytes) { void reader.cancel().catch(() => {}); fail('response_too_large'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
      catch { fail('response_json_invalid'); }
    };
    try {
      return await Promise.race([work(), new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new ReleaseCheckError('read_timeout', true)); }, timeoutMs);
      })]);
    } catch (error) {
      if (error instanceof ReleaseCheckError) throw error;
      throw new ReleaseCheckError('read_unavailable', true);
    } finally { clearTimeout(timer); }
  };
}
