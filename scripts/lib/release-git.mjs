import { spawnSync } from 'node:child_process';
import { APPS, CONTRACT_PATHS, SHA_RE, MIGRATION_RE, sha256 } from './release-manifest.mjs';

export function git(repo, args, { optional = false, binary = false } = {}) {
  const result = spawnSync('git', ['-C',repo,...args], {
    encoding: binary ? undefined : 'utf8', timeout:30000, maxBuffer:24*1024*1024,
    env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}, windowsHide:true,
  });
  if (result.error || result.status !== 0) {
    if (optional) return null;
    // Do not echo remote URLs, credentials, source contents or stderr.
    throw new Error(`git_read_failed:${args[0]}`);
  }
  return result.stdout;
}
function atCommit(repo, sha, path) {
  return git(repo,['show',`${sha}:${path}`],{optional:true,binary:true});
}
export function sourceInventory(repo, app, sha) {
  if (!APPS[app]) throw new Error('unknown_application');
  if (!sha || !SHA_RE.test(sha) || git(repo,['cat-file','-e',`${sha}^{commit}`],{optional:true}) === null) return { availableLocally:false };
  const tree = path => git(repo,['rev-parse',`${sha}:${path}`],{optional:true})?.trim() || null;
  const lock = atCommit(repo,sha,'package-lock.json');
  const source = {
    availableLocally:true, treeOid:git(repo,['rev-parse',`${sha}^{tree}`]).trim(),
    componentTree:tree(APPS[app].root), sharedPackagesTree:tree('packages'),
    lockfileSha256:lock ? sha256(lock) : null,
  };
  if (app !== 'api') return source;
  const contracts = {};
  for (const [name,path] of Object.entries(CONTRACT_PATHS)) {
    const bytes = atCommit(repo,sha,path);
    if (!bytes) { contracts[name] = null; continue; }
    const document = JSON.parse(bytes.toString('utf8'));
    contracts[name] = { path, sha256:sha256(bytes), version:String(document.info?.version || 'unknown') };
  }
  const db = atCommit(repo,sha,'apps/api/src/lib/db.ts')?.toString('utf8') || '';
  const required = new Set([...db.matchAll(/["'](\d{14}_\d{4}[a-z]?_[a-z0-9_]+\.sql)["']/g)].map(m=>m[1]));
  const release = atCommit(repo,sha,'apps/api/public/release.json');
  if (release) {
    const document = JSON.parse(release.toString('utf8'));
    if (document.requiredMigration) {
      if (!MIGRATION_RE.test(document.requiredMigration)) throw new Error('invalid_required_migration');
      required.add(document.requiredMigration);
    }
  }
  const migrations = [...required].sort().map(id => {
    const bytes = atCommit(repo,sha,`apps/api/db/migrations/${id}`);
    if (!bytes) throw new Error(`required_migration_file_missing:${id}`);
    return { id, sha256:sha256(bytes) };
  });
  return {...source,contracts,migrations};
}

/** Read-only, no reset/stash/checkout, and untracked files count as dirty. */
export function localPreflight(repo, app, expectedSha) {
  if (!APPS[app] || !SHA_RE.test(expectedSha || '')) throw new Error('app_and_full_expected_sha_required');
  const head = git(repo,['rev-parse','HEAD']).trim();
  const status = git(repo,['status','--porcelain=v1','--untracked-files=all']);
  const blockers = [];
  if (head !== expectedSha) blockers.push('head_does_not_match_expected_sha');
  if (status.trim()) blockers.push('worktree_has_uncommitted_or_untracked_files');
  for (const path of ['vercel.json',`${APPS[app].root}/vercel.json`]) {
    const bytes = atCommit(repo,head,path);
    try {
      if (!bytes || JSON.parse(bytes.toString('utf8')).git?.deploymentEnabled !== false) blockers.push('automatic_git_deployments_not_disabled');
    } catch { blockers.push('vercel_configuration_invalid'); }
  }
  const source = sourceInventory(repo,app,head);
  if (!source.lockfileSha256) blockers.push('lockfile_missing');
  return {
    schemaVersion:'nexid.release-source-preflight/v1', app, commitSha:head,
    checkedAt:new Date().toISOString(), status:blockers.length?'blocked':'source_preflight_passed',
    blockers:[...new Set(blockers)], source,
    limitations:['does_not_run_build_or_tests','does_not_verify_ignored_build_inputs_or_environment','does_not_authorize_deployment'],
  };
}
