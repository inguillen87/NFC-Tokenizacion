import { createHash } from 'node:crypto';

export const RELEASE_SCHEMA = 'nexid.release-set/v1';
export const APPS = Object.freeze({
  api: { project: 'nexid-api', root: 'apps/api' },
  web: { project: 'nexid-web', root: 'apps/web' },
  dashboard: { project: 'nexid-dashboard', root: 'apps/dashboard' },
});
export const CONTRACT_PATHS = Object.freeze({
  openapi: 'apps/api/public/openapi/nexid-sdk-v1.json',
  asyncapi: 'apps/api/public/asyncapi/nexid-webhooks-v1.json',
});
export const SHA_RE = /^[a-f0-9]{40}$/;
export const HASH_RE = /^[a-f0-9]{64}$/;
export const MIGRATION_RE = /^\d{14}_\d{4}[a-z]?_[a-z0-9_]+\.sql$/;

export function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
}
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function manifestDigest(manifest) {
  const { integrity, ...payload } = manifest;
  return sha256(stableJson(payload));
}
export function sealManifest(manifest) {
  return { ...manifest, integrity: { algorithm: 'sha256', digest: manifestDigest(manifest) } };
}
function requireString(value, pattern, field) {
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error(`invalid_${field}`);
  return value;
}
function nullableText(value) {
  return typeof value === 'string' && value.length <= 200 && !/[\x00-\x1f]/.test(value) ? value : null;
}
export function reportedDirty(value) {
  if (value === '1' || value === 1 || value === true) return 'dirty';
  if (value === '0' || value === 0 || value === false) return 'clean_reported';
  return 'unknown'; // Missing metadata is NOT proof of a clean build.
}

/** Strict projection: never copy env, arbitrary metadata, author PII or URLs with tokens. */
export function projectDeployment(app, project, deployment) {
  const definition = APPS[app];
  if (!definition) throw new Error('unknown_application');
  if (project.name !== definition.project || project.rootDirectory !== definition.root) throw new Error('project_identity_mismatch');
  requireString(project.id, /^prj_[a-zA-Z0-9]+$/, 'project_id');
  requireString(deployment.id, /^dpl_[a-zA-Z0-9]+$/, 'deployment_id');
  if (deployment.projectId !== project.id || project.targets?.production?.id !== deployment.id) throw new Error('deployment_project_mismatch');
  if (deployment.target !== 'production') throw new Error('production_target_required');
  const meta = deployment.meta || {};
  const a = meta.gitCommitSha;
  const b = meta.githubCommitSha;
  if (a && b && a !== b) throw new Error('conflicting_commit_metadata');
  const commitSha = a || b || null;
  if (commitSha !== null) requireString(commitSha, SHA_RE, 'commit_sha');
  const url = requireString(deployment.url, /^[a-zA-Z0-9-]+\.vercel\.app$/, 'deployment_host');
  const created = deployment.createdAt ?? deployment.created;
  if (!Number.isSafeInteger(created) || created <= 0) throw new Error('invalid_deployment_date');
  return {
    app, projectId: project.id, projectName: project.name, rootDirectory: definition.root,
    deployment: {
      id: deployment.id, url: `https://${url}`, target: 'production',
      state: requireString(deployment.readyState, /^[A-Z_]{2,32}$/, 'deployment_state'),
      createdAt: new Date(created).toISOString(),
    },
    source: {
      commitSha, ref: nullableText(meta.gitCommitRef || meta.githubCommitRef),
      cleanliness: reportedDirty(meta.gitDirty), origin: 'provider_metadata_not_build_attestation',
    },
    artifact: { providerId: deployment.id, sha256: null, evidence: 'provider_id_only' },
  };
}

export function assessRelease(manifest) {
  const blockers = [];
  const warnings = [];
  for (const a of manifest.applications) {
    if (a.deployment.state !== 'READY') blockers.push(`${a.app}:deployment_not_ready`);
    if (a.source.cleanliness !== 'clean_reported') blockers.push(`${a.app}:source_${a.source.cleanliness}`);
    if (!a.source.availableLocally) blockers.push(`${a.app}:source_commit_unavailable`);
    // Even explicit gitDirty=0 is metadata, not evidence of the exact deployed bytes.
    if (a.artifact.evidence !== 'verified_build_artifact') blockers.push(`${a.app}:build_artifact_not_attested`);
    if (a.source.availableLocally && !a.source.lockfileSha256) blockers.push(`${a.app}:lockfile_unavailable`);
  }
  const api = manifest.applications.find(a => a.app === 'api');
  if (!api?.contracts?.openapi || !api?.contracts?.asyncapi) blockers.push('api:contract_artifacts_missing');
  if (!api?.migrations?.length) blockers.push('api:required_migrations_not_extracted');
  if (manifest.verification.compatibility !== 'passed') blockers.push('release:cross_app_compatibility_not_verified');
  if (manifest.verification.database !== 'passed') blockers.push('release:database_migrations_not_verified');
  if (manifest.verification.rollback !== 'passed') blockers.push('release:rollback_not_rehearsed');
  const available = manifest.applications.filter(a => a.source.availableLocally);
  if (new Set(available.map(a => a.source.sharedPackagesTree)).size > 1) warnings.push('release:shared_packages_differ_review_required');
  if (new Set(available.map(a => a.source.lockfileSha256)).size > 1) warnings.push('release:lockfiles_differ_review_required');
  return { status: blockers.length ? 'blocked' : 'eligible_for_review', blockers, warnings };
}

/** Inventory validation is intentionally separate from release certification. */
export function validateManifest(m) {
  const fail = field => { throw new Error(`invalid_manifest:${field}`); };
  if (!m || typeof m !== 'object' || Array.isArray(m)) fail('object');
  const allowed = new Set(['schemaVersion','releaseId','observedAt','repository','environment','status','safety','applications','verification','rollback','integrity']);
  if (Object.keys(m).some(k => !allowed.has(k))) fail('unknown_root_field');
  if (m.schemaVersion !== RELEASE_SCHEMA || m.status !== 'observed_not_certified' || m.environment !== 'production') fail('schema_or_status');
  if (!/^[a-z0-9][a-z0-9._-]{1,120}$/.test(m.releaseId || '')) fail('release_id');
  if (!/^\d{4}-\d{2}-\d{2}T/.test(m.observedAt || '') || !Number.isFinite(Date.parse(m.observedAt))) fail('date');
  if (m.repository !== 'inguillen87/NFC-Tokenizacion') fail('repository');
  if (stableJson(m.safety) !== stableJson({ mode:'read_only', databaseQueries:0, deploymentActions:0, paidResourcesCreated:0 })) fail('safety');
  if (stableJson(m.verification) !== stableJson({ compatibility:'not_run', database:'not_queried', rollback:'not_rehearsed', physicalTap:'not_performed' })) fail('unattested_verification');
  if (!Array.isArray(m.applications) || m.applications.length !== 3 || new Set(m.applications.map(a => a.app)).size !== 3) fail('applications');
  for (const a of m.applications) {
    if (!APPS[a.app] || a.rootDirectory !== APPS[a.app].root || a.projectName !== APPS[a.app].project) fail('app_identity');
    if (!/^prj_[a-zA-Z0-9]+$/.test(a.projectId || '') || !/^dpl_[a-zA-Z0-9]+$/.test(a.deployment?.id || '')) fail('provider_ids');
    if (a.deployment.target !== 'production' || !/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(a.deployment.url || '')) fail('deployment');
    if (!['dirty','clean_reported','unknown'].includes(a.source?.cleanliness)) fail('cleanliness');
    if (a.source.commitSha !== null && !SHA_RE.test(a.source.commitSha || '')) fail('commit');
    if (typeof a.source.availableLocally !== 'boolean') fail('source_availability');
    if (a.source.availableLocally && (!SHA_RE.test(a.source.treeOid || '') || !SHA_RE.test(a.source.componentTree || '') || !SHA_RE.test(a.source.sharedPackagesTree || '') || !HASH_RE.test(a.source.lockfileSha256 || ''))) fail('source_fingerprints');
    if (a.artifact?.providerId !== a.deployment.id || a.artifact.sha256 !== null || a.artifact.evidence !== 'provider_id_only') fail('artifact_claim');
    if (a.app === 'api') {
      if (!a.contracts || !Array.isArray(a.migrations)) fail('api_contracts_or_migrations');
      for (const [key,c] of Object.entries(a.contracts)) {
        if (!Object.hasOwn(CONTRACT_PATHS,key) || (c !== null && (c.path !== CONTRACT_PATHS[key] || !HASH_RE.test(c.sha256 || '')))) fail('contract_hash');
      }
      for (const migration of a.migrations) {
        if (!MIGRATION_RE.test(migration.id || '') || !HASH_RE.test(migration.sha256 || '')) fail('migration_hash');
      }
      if (new Set(a.migrations.map(x => x.id)).size !== a.migrations.length) fail('duplicate_migration');
    }
  }
  if (m.rollback?.status !== 'reference_only_not_rehearsed' || !Array.isArray(m.rollback.deployments) || m.rollback.deployments.length !== 3) fail('rollback');
  const expected = m.applications.map(a => ({app:a.app,deploymentId:a.deployment.id})).sort((a,b)=>a.app.localeCompare(b.app));
  if (stableJson([...m.rollback.deployments].sort((a,b)=>a.app.localeCompare(b.app))) !== stableJson(expected)) fail('rollback_binding');
  if (m.integrity?.algorithm !== 'sha256' || !HASH_RE.test(m.integrity?.digest || '') || m.integrity.digest !== manifestDigest(m)) fail('digest');
  return assessRelease(m);
}

export function compareManifests(before, after) {
  validateManifest(before); validateManifest(after);
  const changes = [];
  const compare = (app, field, a, b) => { if (stableJson(a) !== stableJson(b)) changes.push({app,field,before:a,after:b}); };
  for (const a of before.applications) {
    const b = after.applications.find(x => x.app === a.app);
    for (const key of ['id','state']) compare(a.app,`deployment.${key}`,a.deployment[key],b.deployment[key]);
    for (const key of ['commitSha','cleanliness','componentTree','sharedPackagesTree','lockfileSha256']) compare(a.app,`source.${key}`,a.source[key] ?? null,b.source[key] ?? null);
    if (a.app === 'api') { compare(a.app,'contracts',a.contracts,b.contracts); compare(a.app,'requiredMigrations',a.migrations,b.migrations); }
  }
  return { changes, compatibility: 'not_inferred_from_hashes' };
}
