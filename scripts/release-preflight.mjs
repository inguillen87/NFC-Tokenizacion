import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPOSITORY = 'inguillen87/NFC-Tokenizacion';
const TEAM = 'team_BV1xuY6BnEzGanfok8GAyjZv';
const SHA = /^[a-f0-9]{40}$/;
const DEPLOYMENT = /^dpl_[A-Za-z0-9]+$/;
const ROOTS = { api: 'apps/api', dashboard: 'apps/dashboard' };
const MIGRATION = '20260922100000_0112_support_ticket_workflow.sql';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const result = (status, reason, extra = {}) => ({ status, reason, ...extra });

export function validatePlan(plan) {
  if (!object(plan) || plan.schema !== 'nexid.release-preflight.v1' || plan.repository !== REPOSITORY || plan.teamId !== TEAM
    || !Array.isArray(plan.components) || plan.components.length !== 2
    || new Set(plan.components.map(item => item?.surface)).size !== 2
    || !Array.isArray(plan.requiredMigrations) || plan.requiredMigrations.length !== 1 || plan.requiredMigrations[0] !== MIGRATION) return false;
  return plan.components.every(item => object(item) && Object.hasOwn(ROOTS, item.surface) && typeof item.sourceSha === 'string' && SHA.test(item.sourceSha)
    && typeof item.branch === 'string' && /^codex\/[a-z0-9/-]+$/.test(item.branch)
    && Number.isSafeInteger(item.runId) && item.runId > 0
    && typeof item.workflowPath === 'string' && /^\.github\/workflows\/[a-z0-9-]+\.yml$/.test(item.workflowPath)
    && (item.deploymentId === null || typeof item.deploymentId === 'string' && DEPLOYMENT.test(item.deploymentId)));
}

/** Fixed provider origins and GET only. Neither error bodies nor token values are reported. */
export async function readProvider(provider, pathname, token, fetcher = fetch, { timeoutMs = 15_000, maximumBytes = 1_048_576 } = {}) {
  const origin = provider === 'github' ? 'https://api.github.com' : provider === 'vercel' ? 'https://api.vercel.com' : null;
  const allowed = provider === 'github'
    ? new RegExp(`^/repos/${REPOSITORY}/actions/runs/[1-9][0-9]*$`).test(pathname)
    : /^\/v13\/deployments\/dpl_[A-Za-z0-9]+$/.test(pathname);
  if (!origin || !allowed) return result('blocked', 'request_not_allowed');
  if (typeof token !== 'string' || !token.trim() || /[\r\n]/.test(token)) return result('blocked', 'credential_unavailable');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || !Number.isSafeInteger(maximumBytes) || maximumBytes < 1) return result('blocked', 'invalid_limits');
  const url = new URL(pathname, origin);
  if (provider === 'vercel') url.searchParams.set('teamId', TEAM);
  const controller = new AbortController();
  let timer;
  const expired = new Promise(resolve => { timer = setTimeout(() => {
    controller.abort(); resolve(result('blocked', 'request_timeout'));
  }, timeoutMs); });
  const request = async () => {
    let reader;
    try {
      const response = await fetcher(url.href, {
        method: 'GET', redirect: 'error', cache: 'no-store', signal: controller.signal,
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}`,
          ...(provider === 'github' ? { 'X-GitHub-Api-Version': '2022-11-28' } : {}) },
      });
      if (controller.signal.aborted) { void response.body?.cancel().catch(() => {}); return result('blocked', 'request_timeout'); }
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        return result('blocked', response.status === 401 || response.status === 403 ? 'access_denied' : 'provider_http_error', { httpStatus: response.status });
      }
      if (!/^application\/json(?:;|$)/i.test(response.headers.get('content-type') || '') || !response.body) { void response.body?.cancel().catch(() => {}); return result('blocked', 'invalid_payload'); }
      const declared = response.headers.get('content-length');
      if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maximumBytes)) { void response.body.cancel().catch(() => {}); return result('blocked', 'response_too_large'); }
      reader = response.body.getReader();
      const chunks = []; let size = 0;
      for (;;) {
        const part = await reader.read();
        if (controller.signal.aborted) return result('blocked', 'request_timeout');
        if (part.done) break;
        size += part.value.byteLength;
        if (size > maximumBytes) { void reader.cancel().catch(() => {}); return result('blocked', 'response_too_large'); }
        chunks.push(part.value);
      }
      const joined = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
      const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined));
      return object(body) ? { status: 'read', body } : result('blocked', 'invalid_payload');
    } catch { return result('blocked', controller.signal.aborted ? 'request_timeout' : 'provider_read_failed'); }
    finally { reader?.releaseLock(); }
  };
  // The deadline also bounds body parsing and transports that do not honor abort.
  try { return await Promise.race([request(), expired]); }
  finally { clearTimeout(timer); controller.abort(); }
}

export function verifyRun(payload, component) {
  if (!object(payload) || payload.id !== component.runId || payload.repository?.full_name !== REPOSITORY
    || payload.head_repository?.full_name !== REPOSITORY || payload.head_sha !== component.sourceSha
    || payload.head_branch !== component.branch || payload.path !== component.workflowPath || payload.event !== 'push') return result('blocked', 'ci_identity_mismatch');
  if (payload.status !== 'completed' || payload.conclusion !== 'success') return result('blocked', 'ci_not_successful');
  return result('verified', 'exact_candidate_ci', { runId: component.runId, sourceSha: component.sourceSha });
}

export function verifyDeployment(payload, component) {
  if (!object(payload) || payload.id !== component.deploymentId || payload.ownerId !== TEAM
    || payload.projectSettings?.rootDirectory !== ROOTS[component.surface]) return result('blocked', 'deployment_identity_mismatch');
  if (payload.readyState !== 'READY') return result('blocked', 'deployment_not_ready');
  // A CLI-supplied metadata label alone cannot prove the deployed source bytes.
  if (payload.gitSource?.type !== 'github' || !SHA.test(payload.gitSource?.sha)) return result('blocked', 'deployment_source_unproven');
  if (payload.gitSource.sha !== component.sourceSha) return result('blocked', 'deployment_source_mismatch');
  const labels = [payload.meta?.githubCommitSha, payload.meta?.gitCommitSha];
  if (labels.some(value => value !== undefined && value !== component.sourceSha)) return result('blocked', 'deployment_source_mismatch');
  return result('verified', 'provider_git_source_matches', { deploymentId: component.deploymentId, sourceSha: component.sourceSha });
}

export async function inspectRelease(plan, { githubToken, vercelToken, fetcher = fetch } = {}) {
  const report = { schema: 'nexid.release-preflight-report.v1', mode: 'read_only', status: 'blocked', productionChanged: false, promotionAuthorized: false, checks: [], remainingGates: [
    'production_migration_0112_and_approval', 'canonical_baselines_rechecked',
    'paired_authenticated_acceptance', 'manual_visual_review', 'promotion_receipt_and_production_smoke',
  ] };
  if (!validatePlan(plan)) { report.checks.push({ check: 'plan', ...result('blocked', 'invalid_plan') }); return report; }
  for (const component of plan.components) {
    const run = await readProvider('github', `/repos/${REPOSITORY}/actions/runs/${component.runId}`, githubToken, fetcher);
    report.checks.push({ check: `${component.surface}.ci`, ...(run.status === 'read' ? verifyRun(run.body, component) : run) });
    if (component.deploymentId === null) {
      report.checks.push({ check: `${component.surface}.deployment`, ...result('blocked', 'candidate_deployment_not_recorded') });
      continue;
    }
    const deployment = await readProvider('vercel', `/v13/deployments/${component.deploymentId}`, vercelToken, fetcher);
    report.checks.push({ check: `${component.surface}.deployment`, ...(deployment.status === 'read' ? verifyDeployment(deployment.body, component) : deployment) });
  }
  if (report.checks.every(check => check.status === 'verified')) report.status = 'requires_release_review';
  return report;
}

// This tool deliberately contains no deploy, promote, migration or rollback operation.
const invoked = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invoked) {
  try {
    const manifest = new URL('../docs/releases/2026-09-22-support-crm-candidate.json', import.meta.url);
    const bytes = await readFile(fileURLToPath(manifest));
    if (bytes.byteLength > 32_768) throw new Error('manifest_too_large');
    const plan = JSON.parse(bytes.toString('utf8'));
    const report = await inspectRelease(plan, { githubToken: process.env.GITHUB_TOKEN, vercelToken: process.env.VERCEL_TOKEN });
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.status === 'blocked' ? 2 : 0;
  } catch {
    console.log(JSON.stringify({ schema: 'nexid.release-preflight-report.v1', mode: 'read_only', status: 'blocked', reason: 'preflight_input_failed', productionChanged: false, promotionAuthorized: false }));
    process.exitCode = 2;
  }
}
