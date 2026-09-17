#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { APPS, RELEASE_SCHEMA, projectDeployment, sealManifest, validateManifest, compareManifests } from './lib/release-manifest.mjs';
import { sourceInventory, localPreflight } from './lib/release-git.mjs';

export async function collectRelease({ repo, scope, readProvider = vercelRead, now = () => new Date().toISOString() }) {
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(scope || '')) throw new Error('explicit_vercel_scope_required');
  const applications = [];
  for (const [app,def] of Object.entries(APPS)) {
    const project = await readProvider(`/v9/projects/${def.project}`,scope);
    const id = project.targets?.production?.id;
    if (!/^dpl_[a-zA-Z0-9]+$/.test(id || '')) throw new Error(`production_deployment_missing:${app}`);
    const deployment = await readProvider(`/v13/deployments/${id}`,scope);
    const projected = projectDeployment(app,project,deployment);
    const {contracts,migrations,...source} = sourceInventory(repo,app,projected.source.commitSha);
    projected.source = {...projected.source,...source};
    if (app === 'api') { projected.contracts = contracts || {}; projected.migrations = migrations || []; }
    applications.push(projected);
  }
  // Detect changes during collection. This is an observed snapshot, not an atomic provider lock.
  for (const a of applications) {
    const fresh = await readProvider(`/v9/projects/${a.projectName}`,scope);
    if (fresh.id !== a.projectId || fresh.targets?.production?.id !== a.deployment.id) throw new Error('production_changed_during_collection');
  }
  const observedAt = now();
  const m = sealManifest({
    schemaVersion:RELEASE_SCHEMA,releaseId:`observed-${observedAt.replace(/[:.]/g,'-').toLowerCase()}`,
    observedAt,repository:'inguillen87/NFC-Tokenizacion',environment:'production',status:'observed_not_certified',
    safety:{mode:'read_only',databaseQueries:0,deploymentActions:0,paidResourcesCreated:0}, applications,
    verification:{compatibility:'not_run',database:'not_queried',rollback:'not_rehearsed',physicalTap:'not_performed'},
    rollback:{status:'reference_only_not_rehearsed',deployments:applications.map(a=>({app:a.app,deploymentId:a.deployment.id}))},
  });
  validateManifest(m);
  return m;
}

/** Only the two GET endpoint families used above are reachable. No env/secrets API. */
export function vercelRead(endpoint,scope) {
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(scope || '') || !/^\/v(?:9\/projects\/nexid-(?:api|web|dashboard)|13\/deployments\/dpl_[a-zA-Z0-9]+)$/.test(endpoint)) throw new Error('provider_read_not_allowlisted');
  const args=['api',endpoint,'--scope',scope,'--raw'];
  const windows=process.platform === 'win32';
  const result=spawnSync(windows?'cmd.exe':'vercel',windows?['/d','/s','/c',`vercel.cmd ${args.join(' ')}`]:args,{
    encoding:'utf8',timeout:45000,maxBuffer:12*1024*1024,windowsHide:true,
  });
  if(result.error || result.status !== 0) throw new Error(`vercel_read_failed:${endpoint}`);
  try { return JSON.parse(result.stdout); } catch { throw new Error('vercel_returned_non_json'); }
}
function parseArgs(args) {
  const [command,...rest]=args;
  const allowed={collect:['repo','scope','out'],check:['manifest','strict','verify-source','repo'],diff:['before','after'],preflight:['repo','app','expected-sha','out']}[command];
  if(!allowed) throw new Error('usage: collect | check | diff | preflight (use --help)');
  const options={};
  for(let i=0;i<rest.length;i++) {
    const name=rest[i].slice(2);
    if(!rest[i].startsWith('--') || !allowed.includes(name) || Object.hasOwn(options,name)) throw new Error('unknown_or_duplicate_argument');
    if(['strict','verify-source'].includes(name)) options[name]=true;
    else {if(!rest[i+1] || rest[i+1].startsWith('--')) throw new Error(`missing_argument:${name}`);options[name]=rest[++i];}
  }
  return {command,options};
}
async function load(filename) {
  if(!filename) throw new Error('manifest_path_required');
  const data=await readFile(filename,'utf8');
  if(Buffer.byteLength(data)>2*1024*1024) throw new Error('manifest_too_large');
  return JSON.parse(data);
}
async function save(filename,data) {
  if(!filename) throw new Error('explicit_output_path_required');
  await mkdir(path.dirname(path.resolve(filename)),{recursive:true});
  await writeFile(filename,`${JSON.stringify(data,null,2)}\n`,{encoding:'utf8',flag:'wx'});
}
export async function main(args=process.argv.slice(2)) {
  if(args.includes('--help')) {
    console.log(`NexID S0 — inventory and source gates; no deployment, DB or billing actions.
collect --scope TEAM --repo PATH --out NEW_FILE.json
check --manifest FILE.json [--strict] [--verify-source --repo PATH]
diff --before OLD.json --after NEW.json
preflight --app api|web|dashboard --expected-sha FULL_SHA [--repo PATH] [--out NEW_FILE.json]
Exit 0: requested check passed; 1: invalid input/operational error; 2: gate blocked.
A valid inventory is NOT a certified release. --strict deliberately rejects unverified historical builds.`);
    return 0;
  }
  const {command,options:o}=parseArgs(args);const repo=path.resolve(o.repo || '.');
  if(command==='collect') {
    if(!o.out) throw new Error('explicit_output_path_required');
    const m=await collectRelease({repo,scope:o.scope});await save(o.out,m);
    console.log(JSON.stringify({written:path.resolve(o.out),digest:m.integrity.digest,...validateManifest(m)},null,2));return 0;
  }
  if(command==='preflight') {
    const result=localPreflight(repo,o.app,o['expected-sha']);
    if(o.out) await save(o.out,result);console.log(JSON.stringify(result,null,2));return result.blockers.length?2:0;
  }
  if(command==='diff') {console.log(JSON.stringify(compareManifests(await load(o.before),await load(o.after)),null,2));return 0;}
  const m=await load(o.manifest);const assessment=validateManifest(m);
  if(o['verify-source']) {
    for(const a of m.applications) {
      const current=sourceInventory(repo,a.app,a.source.commitSha);
      if(!current.availableLocally) throw new Error(`source_unavailable:${a.app}`);
      for(const k of ['treeOid','componentTree','sharedPackagesTree','lockfileSha256']) if(current[k]!==a.source[k]) throw new Error(`source_fingerprint_mismatch:${a.app}:${k}`);
      if(a.app==='api' && JSON.stringify(current.contracts)!==JSON.stringify(a.contracts)) throw new Error('source_contract_mismatch');
      if(a.app==='api' && JSON.stringify(current.migrations)!==JSON.stringify(a.migrations)) throw new Error('source_migrations_mismatch');
    }
  }
  console.log(JSON.stringify({inventory:'valid',sourceFingerprints:o['verify-source']?'verified':'not_checked',...assessment},null,2));
  return o.strict && assessment.blockers.length ? 2 : 0;
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then(code=>{process.exitCode=code;}).catch(error=>{
    // CLI errors are sanitized; never dump provider payloads or untrusted file contents.
    const message=String(error.message || 'unknown_error');
    console.error(message.startsWith('usage:')?message:/^[a-zA-Z0-9_: /().|=-]+$/.test(message)&&message.length<250?message:'release_command_failed');
    process.exitCode=1;
  });
}
