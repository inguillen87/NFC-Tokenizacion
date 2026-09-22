import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { inspectRelease, readProvider, validatePlan, verifyDeployment, verifyRun } from '../release-preflight.mjs';
const plan = JSON.parse(await readFile(new URL('../../docs/releases/2026-09-22-support-crm-candidate.json', import.meta.url), 'utf8'));
const component = plan.components[0];
const clone = () => structuredClone(plan);
const run = (item = component) => ({ id: item.runId, repository: { full_name: plan.repository }, head_repository: { full_name: plan.repository }, head_sha: item.sourceSha, head_branch: item.branch, path: item.workflowPath, event: 'push', status: 'completed', conclusion: 'success' });
const deployment = (item = component) => ({ id: item.deploymentId, ownerId: plan.teamId, projectSettings: { rootDirectory: `apps/${item.surface}` }, readyState: 'READY', gitSource: { type: 'github', sha: item.sourceSha }, meta: { githubCommitSha: item.sourceSha } });
const path = `/repos/${plan.repository}/actions/runs/${component.runId}`;
const tokens = { githubToken: 'synthetic-github', vercelToken: 'synthetic-vercel' };
const reader = async url => {
  const index = plan.components.findIndex(item => url.includes(String(item.runId)));
  return Response.json(index >= 0 ? run(plan.components[index]) : deployment());
};

test('the recorded candidate inventory retains exact API and dashboard references without claiming a deployment', () => {
  assert.equal(validatePlan(plan), true);
  assert.equal(plan.components[1].sourceSha, 'd2758dce665ef0c320e08df3808d529b574b94ce');
  assert.equal(plan.components[1].deploymentId, null);
});

test('invalid repository, team, migration and missing or duplicate surfaces are refused before network', async () => {
  const mutations = [p => {p.repository='other/repo'}, p => {p.teamId='other'}, p => {p.requiredMigrations=[]}, p => {p.components=[]}, p => {p.components[1]=p.components[0]}, p => {p.components[0].surface='web'}];
  for (const mutate of mutations) {
    const p=clone(); mutate(p); assert.equal(validatePlan(p), false);
    const report = await inspectRelease(p, { fetcher: () => { throw Error('must not fetch'); } });
    assert.equal(report.checks[0].reason, 'invalid_plan');
  }
});

test('plan fields cannot supply arbitrary paths, branches, reference abbreviations or unsafe run IDs', () => {
  for (const patch of [{ sourceSha:'main' }, { sourceSha:[component.sourceSha] }, { runId:1.5 }, { runId:0 }, { runId:Number.MAX_SAFE_INTEGER+1 }, { branch:'main' }, { workflowPath:'https://evil.invalid' }, { deploymentId:'https://evil.invalid' }]) {
    const p=clone(); Object.assign(p.components[0], patch); assert.equal(validatePlan(p), false);
  }
});

for (const [key, value] of [['head_sha', 'a'.repeat(40)], ['id', 1], ['head_branch', 'main'], ['path', '.github/workflows/unrelated.yml'], ['event', 'pull_request']]) {
  test(`CI binds the ${key} as well as success`, () => assert.equal(verifyRun({...run(), [key]:value}, component).reason, 'ci_identity_mismatch'));
}

test('a successful foreign repository or fork cannot satisfy candidate CI', () => {
  for (const key of ['repository','head_repository']) assert.equal(verifyRun({...run(),[key]:{full_name:'other/repo'}}, component).status, 'blocked');
});

test('only a completed successful run is accepted, without claiming tests not present in that workflow', () => {
  for (const status of ['queued', 'in_progress', null]) assert.equal(verifyRun({...run(),status}, component).status, 'blocked');
  for (const conclusion of ['failure', 'neutral', 'skipped', 'cancelled', null]) assert.equal(verifyRun({...run(),conclusion}, component).status, 'blocked');
  assert.deepEqual(verifyRun(run(), component), {status:'verified',reason:'exact_candidate_ci',runId:component.runId,sourceSha:component.sourceSha});
});

test('deployment identity must match owner, exact ID and application root', () => {
  for (const patch of [{id:'dpl_foreign'}, {ownerId:'team_other'}, {projectSettings:{rootDirectory:'apps/web'}}, {readyState:'BUILDING'}]) assert.equal(verifyDeployment({...deployment(),...patch},component).status,'blocked');
});

test('a manually supplied metadata SHA is not deployed source evidence', () => {
  const value=deployment(); delete value.gitSource;
  assert.equal(verifyDeployment(value,component).reason,'deployment_source_unproven');
  assert.equal(verifyDeployment({...deployment(),gitSource:{type:'github',sha:'main'}},component).reason,'deployment_source_unproven');
});

test('a ready deployment from an older or contradictory source is refused', () => {
  assert.equal(verifyDeployment({...deployment(),gitSource:{type:'github',sha:'b'.repeat(40)}},component).reason,'deployment_source_mismatch');
  assert.equal(verifyDeployment({...deployment(),meta:{gitCommitSha:'b'.repeat(40)}},component).reason,'deployment_source_mismatch');
  assert.equal(verifyDeployment(deployment(),component).status,'verified');
});

test('a missing deployment credential yields a bounded blocker without making a request', async () => {
  let calls=0;
  for (const token of [undefined, '', ' ', 'a\nb']) assert.equal((await readProvider('github',path,token,()=>{calls++;})).reason,'credential_unavailable');
  assert.equal(calls,0);
});

test('requests cannot cross providers, inspect secret endpoints or carry user-controlled query/host data', async () => {
  let calls=0;
  for (const [provider,pathname] of [['bad',path],['github','https://evil.invalid'],['github',path+'?token=x'],['github','/repos/other/repo/actions/runs/1'],['vercel','//evil.invalid'],['vercel','/v9/projects/nexid/env']]) {
    assert.equal((await readProvider(provider,pathname,'synthetic',()=>{calls++;})).reason,'request_not_allowed');
  }
  assert.equal(calls,0);
});

test('only GET is sent with no-store and redirect refusal, and the scoped token is never reused across hosts', async () => {
  const calls=[];
  await inspectRelease(plan,{...tokens,fetcher:async (url,options)=>{calls.push({url,options});return reader(url);}});
  assert.equal(calls.length,3);
  for (const {url,options} of calls) {
    const parsed=new URL(url); assert.equal(options.method,'GET'); assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
    assert.equal(options.headers.Authorization,parsed.hostname==='api.github.com'?'Bearer synthetic-github':'Bearer synthetic-vercel');
    if(parsed.hostname==='api.vercel.com') assert.equal(parsed.searchParams.get('teamId'),plan.teamId);
  }
});

for (const code of [401,403,404,429,500]) {
  test(`HTTP ${code} remains blocked without printing a provider response containing secrets`,async()=>{
    const value=await readProvider('github',path,'synthetic',async()=>Response.json({token:'not-for-output',message:'private-provider-content'},{status:code}));
    assert.equal(value.status,'blocked'); assert.equal(value.httpStatus,code); assert.ok(!JSON.stringify(value).includes('private-provider-content')); assert.ok(!JSON.stringify(value).includes('not-for-output'));
  });
}

test('malformed JSON, text responses, arrays and invalid UTF-8 are unconfirmed',async()=>{
  for(const response of [new Response('oops'),new Response('{',{headers:{'content-type':'application/json'}}),Response.json([]),new Response(new Uint8Array([255]),{headers:{'content-type':'application/json'}})]) {
    assert.equal((await readProvider('github',path,'synthetic',async()=>response)).status,'blocked');
  }
});

test('declared and actual streamed byte limits apply even with misleading Content-Length',async()=>{
  const large=JSON.stringify({message:'a'.repeat(200)});
  for(const length of ['9999','-1','1']) {
    const value=await readProvider('github',path,'synthetic',async()=>new Response(large,{headers:{'content-type':'application/json','content-length':length}}),{maximumBytes:50});
    assert.equal(value.reason,'response_too_large');
  }
});

test('non-cooperative network timeout settles and ignores a late response',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let resolve;const pending=new Promise(yes=>{resolve=yes;});
  const operation=readProvider('github',path,'synthetic',()=>pending,{timeoutMs:20});
  t.mock.timers.tick(20);assert.equal((await operation).reason,'request_timeout');
  resolve(Response.json({secret:'late-secret'}));await nextTurn();
});

test('body stalls are bounded by the same deadline as headers',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let end;
  const stream=new ReadableStream({start(controller){end=controller;}});
  const operation=readProvider('github',path,'synthetic',async()=>new Response(stream,{headers:{'content-type':'application/json'}}),{timeoutMs:20});
  await nextTurn();t.mock.timers.tick(20);assert.equal((await operation).reason,'request_timeout');end.close();await nextTurn();
});

test('raw thrown errors containing credentials are never exposed',async()=>{
  const value=await readProvider('github',path,'synthetic',()=>{throw Error('Authorization Bearer private-value');});
  assert.deepEqual(value,{status:'blocked',reason:'provider_read_failed'});
});

test('successful reads clear deadlines and consume late transport rejection',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  assert.equal((await readProvider('github',path,'synthetic',async()=>Response.json({ok:true}),{timeoutMs:20})).status,'read');
  let reject; const pending=new Promise((_,no)=>{reject=no;});
  const operation=readProvider('github',path,'synthetic',()=>pending,{timeoutMs:20});
  t.mock.timers.tick(20); await operation; reject(Error('synthetic-late'));await nextTurn();
});

test('missing new dashboard deployment cannot be substituted by its old .33 candidate',async()=>{
  const report=await inspectRelease(plan,{...tokens,fetcher:reader});
  assert.equal(report.checks.find(item=>item.check==='dashboard.deployment').reason,'candidate_deployment_not_recorded');
  assert.equal(report.status,'blocked');assert.equal(report.productionChanged,false);assert.equal(report.promotionAuthorized,false);
});

test('even fully verified provider metadata is not a migration, promotion or production acceptance receipt',async()=>{
  const p=clone();p.components[1].deploymentId='dpl_syntheticnew';
  const report=await inspectRelease(p,{...tokens,fetcher:async url=>{
    const item=p.components.find(item=>url.includes(String(item.runId))||url.includes(String(item.deploymentId)));
    return Response.json(url.includes('api.github.com')?run(item):deployment(item));
  }});
  assert.equal(report.status,'requires_release_review');assert.equal(report.promotionAuthorized,false);assert.equal(report.productionChanged,false);
  assert.ok(report.remainingGates.includes('production_migration_0112_and_approval'));
});

test('report only exposes allowlisted identifiers and never serializes provider metadata',async()=>{
  const report=await inspectRelease(plan,{...tokens,fetcher:async url=>{
    const value=await (await reader(url)).json();return Response.json({...value,credentials:'private-value',env:{secret:'secret-value'}});
  }});
  assert.ok(!/private-value|secret-value|synthetic-github|synthetic-vercel|credentials/.test(JSON.stringify(report)));
});

test('release workflow and source cannot silently create builds, migrations or paid infrastructure',async()=>{
  const source=await readFile(new URL('../release-preflight.mjs',import.meta.url),'utf8');
  assert.ok(!/method: '(POST|PATCH|PUT|DELETE)'/.test(source));
  const workflow=await readFile(new URL('../../.github/workflows/release-preflight.yml',import.meta.url),'utf8');
  assert.match(workflow,/github.event.repository.private == false/);
  assert.match(workflow,/actions: read/);assert.match(workflow,/contents: read/);
  assert.ok(!/upload-artifact|actions\/cache|npm install|npm ci|deploy --prod|VERCEL_TOKEN.*echo/.test(workflow));
});
