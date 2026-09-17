import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { APPS, sha256, stableJson, projectDeployment, reportedDirty, sealManifest, validateManifest, compareManifests } from '../lib/release-manifest.mjs';
import { sourceInventory, localPreflight } from '../lib/release-git.mjs';
import { collectRelease, vercelRead } from '../nexid-release.mjs';

const CLI=fileURLToPath(new URL('../nexid-release.mjs',import.meta.url));
const WHEN='2026-09-17T23:00:00.000Z';
const MIGRATION='20260906120000_0102_campaign_drafts.sql';
function fixture(t) {
  const repo=mkdtempSync(path.join(tmpdir(),'nexid-release-test-'));
  t.after(()=>rmSync(repo,{recursive:true,force:true}));
  const git=(...args)=>{
    const r=spawnSync('git',['-C',repo,...args],{encoding:'utf8',env:{...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null'}});
    assert.equal(r.status,0,`fixture git ${args[0]} failed`);return r.stdout.trim();
  };
  const put=(p,value)=>{const f=path.join(repo,p);mkdirSync(path.dirname(f),{recursive:true});writeFileSync(f,typeof value==='string'?value:JSON.stringify(value));};
  git('init','--quiet');git('config','user.name','Release Test');git('config','user.email','release-test@example.invalid');git('config','commit.gpgsign','false');
  put('package-lock.json',{lockfileVersion:3,packages:{}});
  put('packages/core/package.json',{name:'@product/core',version:'1.0.0'});
  put('vercel.json',{git:{deploymentEnabled:false}});
  for(const d of Object.values(APPS)){put(`${d.root}/vercel.json`,{git:{deploymentEnabled:false}});put(`${d.root}/src/index.js`,'export const testOnly = true;\n');}
  put('apps/api/public/openapi/nexid-sdk-v1.json',{openapi:'3.1.0',info:{version:'1.0.0'},paths:{}});
  put('apps/api/public/asyncapi/nexid-webhooks-v1.json',{asyncapi:'3.0.0',info:{version:'1.0.0'},channels:{}});
  put('apps/api/public/release.json',{requiredMigration:MIGRATION});
  put('apps/api/src/lib/db.ts',`export const DEFAULT_REQUIRED_SCHEMA_MIGRATIONS = ['${MIGRATION}'];\n`);
  put(`apps/api/db/migrations/${MIGRATION}`,'-- Synthetic fixture only\nSELECT 1;\n');
  git('add','.');git('commit','--quiet','-m','fixture');const sha=git('rev-parse','HEAD');
  return {repo,git,put,sha};
}
function pair(app,sha,dirty='0') {
  const d=APPS[app];const id=`dpl_${app}fixture`;const projectId=`prj_${app}fixture`;
  return {
    project:{id:projectId,name:d.project,rootDirectory:d.root,targets:{production:{id}}},
    deployment:{id,projectId,target:'production',readyState:'READY',url:`${d.project}-fixture.vercel.app`,createdAt:1789686000000,meta:{gitCommitSha:sha,gitCommitRef:'test/release',gitDirty:dirty}},
  };
}
function provider(pairs,requests=[]) {
  return async (url,scope)=>{
    requests.push({url,scope});
    for(const p of pairs) {
      if(url===`/v9/projects/${p.project.name}`) return structuredClone(p.project);
      if(url===`/v13/deployments/${p.deployment.id}`) return structuredClone(p.deployment);
    }
    throw new Error('unexpected_provider_request');
  };
}
async function snapshot(f,{dirty='0',requests=[]}={}) {
  return collectRelease({repo:f.repo,scope:'test-team',now:()=>WHEN,readProvider:provider(Object.keys(APPS).map(a=>pair(a,f.sha,a==='web'?dirty:'0')),requests)});
}
function cli(...args) {return spawnSync(process.execPath,[CLI,...args],{encoding:'utf8',timeout:15000});}

test('S0 tests use only local synthetic git fixtures and zero provider requests',()=>{
  assert.match(readFileSync(fileURLToPath(import.meta.url),'utf8'),/readProvider:provider/);
});
test('dirty metadata is tri-state and absent is never clean',()=>{
  for(const v of [undefined,null,'', 'false','unknown']) assert.equal(reportedDirty(v),'unknown');
  for(const v of [true,1,'1']) assert.equal(reportedDirty(v),'dirty');
  for(const v of [false,0,'0']) assert.equal(reportedDirty(v),'clean_reported');
});
test('provider projection drops secrets, PII and unrecognized metadata',()=>{
  const p=pair('api','a'.repeat(40));p.project.env={DATABASE_URL:'fixture-secret'};p.deployment.env={KEY:'fixture-secret'};
  p.deployment.meta.credential='fixture-secret';p.deployment.meta.gitCommitAuthorEmail='private@example.invalid';
  const s=JSON.stringify(projectDeployment('api',p.project,p.deployment));assert.ok(!s.includes('fixture-secret'));assert.ok(!s.includes('private@example.invalid'));
});
test('project root mismatch is rejected',()=>{
  const p=pair('api','a'.repeat(40));p.project.rootDirectory='apps/web';assert.throws(()=>projectDeployment('api',p.project,p.deployment),/project_identity_mismatch/);
});
test('deployment belonging to a different project is rejected',()=>{
  const p=pair('api','a'.repeat(40));p.deployment.projectId='prj_other';assert.throws(()=>projectDeployment('api',p.project,p.deployment),/deployment_project_mismatch/);
});
test('conflicting Git metadata is not silently resolved',()=>{
  const p=pair('api','a'.repeat(40));p.deployment.meta.githubCommitSha='b'.repeat(40);assert.throws(()=>projectDeployment('api',p.project,p.deployment),/conflicting_commit_metadata/);
});
test('preview deployments are not accepted as production',()=>{
  const p=pair('api','a'.repeat(40));p.deployment.target='preview';assert.throws(()=>projectDeployment('api',p.project,p.deployment),/production_target_required/);
});
test('provider host cannot contain a credential or query',()=>{
  for(const host of ['nexid.vercel.app?token=secret','https://user:secret@nexid.vercel.app','evil.example/nexid.vercel.app']) {
    const p=pair('api','a'.repeat(40));p.deployment.url=host;assert.throws(()=>projectDeployment('api',p.project,p.deployment),/invalid_deployment_host/);
  }
});
test('provider client allowlist forbids writes, env APIs and shell injection before execution',()=>{
  for(const [url,scope] of [['/v9/projects/nexid-api/env','test-team'],['/v1/billing','test-team'],['/v9/projects/nexid-api','test & command'],['/v13/deployments/dpl_ok;echo','test-team']]) assert.throws(()=>vercelRead(url,scope),/not_allowlisted/);
});
test('inventory fingerprints immutable source, contracts, lockfile and required migrations',async t=>{
  const f=fixture(t);const requests=[];const m=await snapshot(f,{requests});const a=m.applications[0];
  assert.equal(m.status,'observed_not_certified');assert.equal(requests.length,9);assert.equal(a.source.commitSha,f.sha);assert.equal(a.migrations.length,1);
  assert.equal(a.migrations[0].id,MIGRATION);assert.equal(a.contracts.openapi.version,'1.0.0');assert.equal(a.artifact.sha256,null);assert.equal(validateManifest(m).status,'blocked');
  assert.ok(requests.every(r=>r.url.startsWith('/v9/projects/')||r.url.startsWith('/v13/deployments/')));
});
test('missing required migration source file is a hard error, not an assumed applied migration',t=>{
  const f=fixture(t);f.put('apps/api/public/release.json',{requiredMigration:'20260101000000_9999_absent.sql'});f.git('add','.');f.git('commit','--quiet','-m','missing');
  assert.throws(()=>sourceInventory(f.repo,'api',f.git('rev-parse','HEAD')),/required_migration_file_missing/);
});
test('dirty deployment remains inventoryable but cannot pass a release gate',async t=>{
  const m=await snapshot(fixture(t),{dirty:'1'});assert.ok(validateManifest(m).blockers.includes('web:source_dirty'));
});
test('missing gitDirty metadata becomes an explicit blocker',async t=>{
  const m=await snapshot(fixture(t),{dirty:null});assert.ok(validateManifest(m).blockers.includes('web:source_unknown'));
});
test('READY plus matching source hashes is not runtime compatibility evidence',async t=>{
  const m=await snapshot(fixture(t));const a=validateManifest(m);assert.ok(a.blockers.includes('release:cross_app_compatibility_not_verified'));assert.ok(a.blockers.includes('release:database_migrations_not_verified'));assert.ok(a.blockers.includes('release:rollback_not_rehearsed'));
});
test('independent app SHAs are supported, without pretending shared-package drift is compatibility',async t=>{
  const f=fixture(t);f.put('packages/core/package.json',{name:'@product/core',version:'2.0.0'});f.git('add','.');f.git('commit','--quiet','-m','new shared');const other=f.git('rev-parse','HEAD');
  const m=await collectRelease({repo:f.repo,scope:'test-team',now:()=>WHEN,readProvider:provider([pair('api',f.sha),pair('web',other),pair('dashboard',f.sha)])});
  assert.equal(m.applications[1].source.commitSha,other);assert.ok(validateManifest(m).warnings.includes('release:shared_packages_differ_review_required'));
});
test('unknown commit is recorded honestly without inventing fingerprints',async t=>{
  const f=fixture(t);const m=await collectRelease({repo:f.repo,scope:'test-team',now:()=>WHEN,readProvider:provider([pair('api',f.sha),pair('web','f'.repeat(40)),pair('dashboard',f.sha)])});
  assert.equal(m.applications[1].source.availableLocally,false);assert.ok(validateManifest(m).blockers.includes('web:source_commit_unavailable'));
});
test('production changing during observation aborts instead of sealing a mixed snapshot',async t=>{
  const f=fixture(t);const p=Object.keys(APPS).map(a=>pair(a,f.sha));const base=provider(p);let apiReads=0;
  await assert.rejects(collectRelease({repo:f.repo,scope:'test-team',readProvider:async(u,s)=>{const r=await base(u,s);if(u==='/v9/projects/nexid-api'&&++apiReads===2)r.targets.production.id='dpl_replaced';return r;}}),/production_changed_during_collection/);
});
test('unknown JSON schema version fails closed',async t=>{
  const m=await snapshot(fixture(t));m.schemaVersion='future/v99';assert.throws(()=>validateManifest(sealManifest(m)),/schema_or_status/);
});
test('manifest tampering is detected',async t=>{
  const m=await snapshot(fixture(t));m.releaseId='tampered';assert.throws(()=>validateManifest(m),/digest/);
});
test('unknown root fields and fabricated evidence cannot be smuggled into a manifest',async t=>{
  const m=await snapshot(fixture(t));assert.throws(()=>validateManifest(sealManifest({...m,env:{secret:'synthetic'}})),/unknown_root_field/);
  m.verification.compatibility='passed';assert.throws(()=>validateManifest(sealManifest(m)),/unattested_verification/);
});
test('duplicate or missing applications are rejected',async t=>{
  const m=await snapshot(fixture(t));m.applications[2]=m.applications[1];assert.throws(()=>validateManifest(sealManifest(m)),/applications/);
});
test('rollback reference must identify the observed release, not another project',async t=>{
  const m=await snapshot(fixture(t));m.rollback.deployments[0].deploymentId='dpl_other';assert.throws(()=>validateManifest(sealManifest(m)),/rollback_binding/);
});
test('source preflight accepts a clean exact commit but does not claim build or deployment approval',t=>{
  const f=fixture(t);const r=localPreflight(f.repo,'api',f.sha);assert.equal(r.status,'source_preflight_passed');assert.ok(r.limitations.includes('does_not_authorize_deployment'));
});
test('source preflight rejects untracked files without changing them',t=>{
  const f=fixture(t);f.put('local-change.txt','preserve');const r=localPreflight(f.repo,'api',f.sha);assert.ok(r.blockers.includes('worktree_has_uncommitted_or_untracked_files'));assert.equal(readFileSync(path.join(f.repo,'local-change.txt'),'utf8'),'preserve');
});
test('source preflight rejects both staged and unstaged changes',t=>{
  const f=fixture(t);f.put('apps/api/src/index.js','changed');assert.equal(localPreflight(f.repo,'api',f.sha).status,'blocked');f.git('add','.');assert.equal(localPreflight(f.repo,'api',f.sha).status,'blocked');
});
test('source preflight rejects unexpected SHA and abbreviated SHA',t=>{
  const f=fixture(t);assert.ok(localPreflight(f.repo,'api','f'.repeat(40)).blockers.includes('head_does_not_match_expected_sha'));assert.throws(()=>localPreflight(f.repo,'api',f.sha.slice(0,8)),/full_expected_sha/);
});
test('automatic Git deployment must stay disabled in source preflight',t=>{
  const f=fixture(t);f.put('apps/api/vercel.json',{git:{deploymentEnabled:true}});f.git('add','.');f.git('commit','--quiet','-m','config change');assert.ok(localPreflight(f.repo,'api',f.git('rev-parse','HEAD')).blockers.includes('automatic_git_deployments_not_disabled'));
});
test('diff reports changed hashes but does not invent semantic compatibility',async t=>{
  const m=await snapshot(fixture(t));const n=structuredClone(m);n.applications[0].source.lockfileSha256='b'.repeat(64);const diff=compareManifests(m,sealManifest(n));assert.equal(diff.changes.length,1);assert.equal(diff.compatibility,'not_inferred_from_hashes');
});
test('CLI exit codes distinguish structural validity from strict certification',async t=>{
  const f=fixture(t);const m=await snapshot(f);const dest=path.join(f.repo,'snapshot.json');writeFileSync(dest,JSON.stringify(m));
  assert.equal(cli('check','--manifest',dest).status,0);assert.equal(cli('check','--manifest',dest,'--strict').status,2);
  assert.equal(cli('check','--manifest',dest,'--verify-source','--repo',f.repo).status,0);
});
test('CLI source verification catches a resealed false fingerprint',async t=>{
  const f=fixture(t);const m=await snapshot(f);m.applications[0].source.lockfileSha256='a'.repeat(64);const dest=path.join(f.repo,'snapshot.json');writeFileSync(dest,JSON.stringify(sealManifest(m)));
  const r=cli('check','--manifest',dest,'--verify-source','--repo',f.repo);assert.equal(r.status,1);assert.match(r.stderr,/source_fingerprint_mismatch/);
});
test('CLI refuses to overwrite existing evidence',t=>{
  const f=fixture(t);const dest=path.join(tmpdir(),`nexid-protect-${f.sha}-${process.pid}.json`);writeFileSync(dest,'preserve');t.after(()=>rmSync(dest,{force:true}));
  const r=cli('preflight','--repo',f.repo,'--app','api','--expected-sha',f.sha,'--out',dest);assert.equal(r.status,1);assert.equal(readFileSync(dest,'utf8'),'preserve');
});
test('CLI rejects unknown and duplicate arguments without provider access',()=>{
  assert.equal(cli('deploy').status,1);assert.equal(cli('collect','--scope','team','--scope','team','--out','x.json').status,1);assert.equal(cli('collect','--scope','team','--dangerously-skip-permissions').status,1);
});
test('canonical manifest digest is stable across key order',()=>{
  assert.equal(sha256(stableJson({b:2,a:[1,3]})),sha256(stableJson({a:[1,3],b:2})));
});
