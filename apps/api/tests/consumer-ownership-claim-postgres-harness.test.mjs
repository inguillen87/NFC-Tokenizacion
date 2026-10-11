import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Socket } from "node:net";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  CONSUMER_OWNERSHIP_CLAIM_SOURCE_PATHS,
  readConsumerOwnershipClaimSourcePins,
  runConsumerOwnershipClaimPostgresQa,
} from "./helpers/consumer-ownership-claim-postgres-harness.mjs";
import { runOwnershipCurrentStatePostgresQa } from "./helpers/ownership-current-state-postgres-harness-v2.mjs";

// Refusal tests only. The fabricated clients below never execute SQL or prove
// PostgreSQL atomicity/attestation; they observe that a rejected target sees no DDL.
async function isolatedSource(run) {
  const apiRoot=await mkdtemp(path.join(tmpdir(),"nexid-claim-pg-source-"));
  const prior=new Map(["NODE_ENV","VERCEL_ENV","SUN_HANDOFF_SECRET","RATE_LIMIT_KEY_PEPPER"].map(key=>[key,{present:Object.hasOwn(process.env,key),value:process.env[key]}]));
  try {
    process.env.NODE_ENV="test";process.env.VERCEL_ENV="test";
    for(const file of CONSUMER_OWNERSHIP_CLAIM_SOURCE_PATHS){const target=path.join(apiRoot,file);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,`synthetic pinned fixture ${file}\n`);}
    await run({apiRoot,sourcePins:await readConsumerOwnershipClaimSourcePins(apiRoot)});
  } finally {
    for(const [key,before]of prior){if(before.present)process.env[key]=before.value;else delete process.env[key];}
    assert.equal(path.dirname(apiRoot),path.resolve(tmpdir()));assert.ok(path.basename(apiRoot).startsWith("nexid-claim-pg-source-"));
    await rm(apiRoot,{recursive:true,force:true});
  }
}
function identity(overrides={}) { return {database:"nexid_e2e_claim",role:"nexid_e2e",pid:1,address:"127.0.0.1",server_version_number:180004,neon_endpoint_id:null,transaction_read_only:"off",...overrides}; }
function clientFor(row,{peer="127.0.0.1",host="127.0.0.1",port=5432}={}) {
  const statements=[];let closes=0;
  const socket=new Socket();
  // A real Socket class with synthetic metadata, never connected. It is solely
  // a refusal fixture, matching the existing attestation safety tests.
  for(const [key,value]of Object.entries({remoteAddress:peer,remotePort:port,readyState:"open",readable:true,writable:true}))Object.defineProperty(socket,key,{value,configurable:true});
  const client={_connected:true,connectionParameters:{host,port,user:row.role,database:row.database},connection:{stream:socket},query:async sql=>{statements.push(sql);return {rows:[row]};},end:async()=>{closes++;socket.destroy();}};
  return {client,statements,get closes(){return closes;}};
}
function noDdl(statements) {assert.doesNotMatch(statements.join("\n"),/\b(CREATE|INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER)\b/);}

test("new core and legacy-equivalence require explicit factories before any source or environment read",async()=>{
  for(const runner of [runConsumerOwnershipClaimPostgresQa,runOwnershipCurrentStatePostgresQa])await assert.rejects(runner(),/Explicit disposable connection factory/);
});

test("both PostgreSQL modules import without credentials, network or app-runtime side effects",()=>{
  const urls=[new URL("./helpers/consumer-ownership-claim-postgres-harness.mjs",import.meta.url).href,new URL("./helpers/ownership-current-state-postgres-harness-v2.mjs",import.meta.url).href];
  const code=`import net from 'node:net';let reads=0,connections=0;const original=process.env;process.env=new Proxy(original,{get(target,key){if(/^(SUN_HANDOFF|RATE_LIMIT|DATABASE_URL|NODE_ENV$|VERCEL_ENV$)/.test(String(key))){reads++;throw new Error('credential-or-runtime-env-read-at-import');}return target[key];}});net.Socket.prototype.connect=function(){connections++;throw new Error('network-at-import');};await import(${JSON.stringify(urls[0])});await import(${JSON.stringify(urls[1])});if(reads||connections)throw new Error('unsafe-import');console.log('import-safe');`;
  const child=spawnSync(process.execPath,["--input-type=module","--eval",code],{env:{},encoding:"utf8",timeout:10000,maxBuffer:128*1024});
  assert.equal(child.status,0);assert.equal(child.stdout.trim(),"import-safe");assert.equal(child.stderr,"");
});

test("source mutation rejects before the factory is called",()=>isolatedSource(async input=>{
  let connections=0;await writeFile(path.join(input.apiRoot,CONSUMER_OWNERSHIP_CLAIM_SOURCE_PATHS[0]),"changed synthetic source");
  await assert.rejects(runConsumerOwnershipClaimPostgresQa({...input,connect:async()=>{connections++;throw new Error("must not connect");}}),/Candidate source changed before PostgreSQL/);
  assert.equal(connections,0);
}));

for(const [name,mutate]of[
  ["missing source pin",pins=>pins.slice(1)],
  ["duplicate and omitted source path",pins=>[pins[0],...pins.slice(0,-1)]],
  ["malformed source hash",pins=>pins.map((row,index)=>index?row:{...row,sha256:"not-a-hash"})],
  ["foreign source path",pins=>pins.map((row,index)=>index?row:{...row,file:"apps/api/foreign.ts"})],
])test(`${name} rejects before connection`,()=>isolatedSource(async input=>{
  let connections=0;await assert.rejects(runConsumerOwnershipClaimPostgresQa({...input,sourcePins:mutate(input.sourcePins),connect:async()=>{connections++;throw new Error("must not connect");}}));assert.equal(connections,0);
}));

test("unknown catalogue cannot connect",()=>isolatedSource(async input=>{
  let connections=0;await assert.rejects(runConsumerOwnershipClaimPostgresQa({...input,catalogue:"unreviewed",connect:async()=>{connections++;}}),/Unknown PostgreSQL claim catalogue/);assert.equal(connections,0);
}));

for(const [name,row,options]of[
  ["production database",identity({database:"production"}),{}],
  ["non-QA role",identity({role:"application"}),{}],
  ["remote PostgreSQL server",identity({address:"192.0.2.1"}),{}],
  ["remote Neon identity",identity({neon_endpoint_id:"synthetic-remote"}),{}],
  ["unsupported PostgreSQL version",identity({server_version_number:180006}),{}],
  ["missing PostgreSQL version",identity({server_version_number:undefined}),{}],
  ["read-only target",identity({transaction_read_only:"on"}),{}],
  ["declared localhost instead of literal endpoint",identity(),{host:"localhost"}],
  ["declared loopback but remote actual peer",identity(),{peer:"192.0.2.1"}],
])for(const [catalogue,runner]of[["core",runConsumerOwnershipClaimPostgresQa],["equivalence",runOwnershipCurrentStatePostgresQa]])test(`${catalogue} refuses ${name} before DDL`,()=>isolatedSource(async input=>{
  const fake=clientFor(row,options);await assert.rejects(runner({...input,connect:async()=>fake.client}));assert.equal(fake.closes,1);noDdl(fake.statements);
}));

test("fabricated Docker attestation cannot reach DDL",()=>isolatedSource(async input=>{
  const fake=clientFor(identity({address:"172.18.0.2"}));await assert.rejects(runConsumerOwnershipClaimPostgresQa({...input,dockerAttestation:{},connect:async()=>fake.client}),/Unissued/);assert.equal(fake.closes,1);noDdl(fake.statements);
}));

for(const runner of [runConsumerOwnershipClaimPostgresQa,runOwnershipCurrentStatePostgresQa])test(`${runner.name} rejects reused clients and closes once`,()=>isolatedSource(async input=>{
  const fake=clientFor(identity());await assert.rejects(runner({...input,connect:async()=>fake.client}),/Distinct QA clients/);assert.equal(fake.closes,1);noDdl(fake.statements);
}));

for(const [name,rows]of[
  ["same backend PID",[identity({pid:1}),identity({pid:1})]],
  ["different QA database",[identity({pid:1}),identity({pid:2,database:"nexid_e2e_other"})]],
  ["different supported version",[identity({pid:1,server_version_number:160004}),identity({pid:2,server_version_number:180004})]],
])test(`independent clients with ${name} are rejected before DDL`,()=>isolatedSource(async input=>{
  const fakes=rows.map(row=>clientFor(row));let index=0;await assert.rejects(runConsumerOwnershipClaimPostgresQa({...input,connect:async()=>fakes[index++].client}));
  for(const fake of fakes){assert.equal(fake.closes,1);noDdl(fake.statements);}
}));

test("connection rejection restores synthetic environment including original absence",()=>isolatedSource(async input=>{
  process.env.SUN_HANDOFF_SECRET="synthetic-original-present";delete process.env.RATE_LIMIT_KEY_PEPPER;
  await assert.rejects(runConsumerOwnershipClaimPostgresQa({...input,connect:async()=>{throw new Error("synthetic factory rejection");}}),/synthetic factory rejection/);
  assert.equal(process.env.SUN_HANDOFF_SECRET,"synthetic-original-present");assert.equal(Object.hasOwn(process.env,"RATE_LIMIT_KEY_PEPPER"),false);
}));

test("non-test runtime is rejected before factory",()=>isolatedSource(async input=>{
  process.env.NODE_ENV="production";let calls=0;await assert.rejects(runConsumerOwnershipClaimPostgresQa({...input,connect:async()=>{calls++;}}));assert.equal(calls,0);
}));

test("new safe tests and both actual PG catalogues are registered without removing original guards",async()=>{
  const apiRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
  const scripts=JSON.parse(await readFile(path.join(apiRoot,"package.json"),"utf8")).scripts;
  const target="tests/consumer-ownership-claim-postgres-harness.test.mjs";
  assert.equal(scripts["test:consumer-claim-postgres-safety"],`node --import tsx --test ${target}`);
  assert.equal(scripts["build:regressions"].split("npm run test:consumer-claim-postgres-safety").length-1,1);
  assert.equal(scripts["test:e2e:ephemeral:safety"].split(target).length-1,1);
  assert.ok(scripts["test:current-tag-guards"].includes("tests/ownership-current-state-postgres-harness.test.mjs"));
  const entry=(await readFile(path.join(apiRoot,"scripts/enterprise-ephemeral-e2e.mjs"),"utf8")).replaceAll("\r\n","\n");
  assert.match(entry,/ownership-current-state-postgres-harness-v2\.mjs/);
  assert.match(entry,/ownershipCurrentState\.checks\.length, 51/);assert.match(entry,/ownershipCurrentState\.lockObservations\.length, 4/);
  assert.match(entry,/ownershipClaimCore\.checks\.length, 40/);assert.match(entry,/ownershipClaimCore\.lockObservations\.length, 8/);
  assert.ok(entry.indexOf("await assertDatabaseStartsEmpty()")<entry.indexOf("await runOwnershipCurrentStatePostgresQa("));
  assert.match(entry,/consumerOwnershipClaimCore: ownershipClaimQaSummary\(ownershipClaimCore\)/);
  for(const call of ["runOwnershipCurrentStatePostgresQa", "runConsumerOwnershipClaimPostgresQa"]){
    const match=entry.match(new RegExp(`await ${call}\\(\\{([^}]+)\\}\\)`));
    assert.ok(match);assert.match(match[1],/connect: connectCurrentTagQa/);assert.match(match[1],/dockerAttestation/);
    assert.match(match[1],/apiRoot/);assert.match(match[1],/sourcePins: ownershipClaimSourcePins/);
    assert.equal(entry.split(`await ${call}(`).length-1,1);
    assert.ok(entry.indexOf("const dockerAttestation =")<entry.indexOf(`await ${call}(`));
    assert.ok(entry.indexOf(`await ${call}(`)<entry.indexOf("const bootstrapPrerequisites = applyMigrations()"));
  }
  // Source/refusal guards only: these do not certify execution of the PG cases.
  const harness=await readFile(path.join(apiRoot,"tests/helpers/consumer-ownership-claim-postgres-harness.mjs"),"utf8");
  assert.match(harness,/record_exact_\$\{status\}_GET_context_denied_before_issuer/);
  assert.match(harness,/record_other_\$\{dimension\}_\$\{status\}_GET_context_unchanged_allow/);
  assert.match(harness,/record_claimed_reason_priority_GET_context_before_issuer/);
  assert.match(harness,/\["revoked","disputed","blocked_replay"\]/);
  assert.match(harness,/\["tenant","consumer","event"\]/);
  assert.match(harness,/current\.run\(first,\(\)=>getEligibility\(req\)\)/);
  assert.match(harness,/observations\.length,2/);assert.match(harness,/executorMutations,mutations/);
  assert.match(harness,/await allCoreState\(\),before/);
  assert.ok(harness.indexOf('const getEligibility =')>harness.indexOf('const [admin, first, second] = clients;'));
  assert.match(harness,/assert\.equal\(report\.checks\.length,40\)/);
  assert.match(harness,/assert\.equal\(report\.checks\.length,51\)/);
  const projection=entry.match(/function ownershipClaimQaSummary\(report\) \{([\s\S]*?)\n\}\n\nasync function run\(\)/);
  assert.ok(projection);
  // Execute only the extracted pure projection, never the PG entrypoint.
  const project=new Function("assert","report",projection[1]);
  const report={schema:"nexid.consumer-ownership-claim-postgres/v1",semanticsVersion:"ownership-claim-four-effect-core/v1",catalogue:"core",ok:true,
    sourcePinsVerified:true,serializationConflicts:2,checks:[{passed:true},{passed:false}],lockObservations:[{}],
    cleanup:{schemaDropped:true,connectionsClosed:true,syntheticEnvironmentRestored:true}};
  for(const key of ["rows","sql","parameters","connectionEvidence","sourcePins","snapshot","limits"])Object.defineProperty(report,key,{get(){throw new Error("private report field read");}});
  const published=project(assert,report);
  assert.deepEqual(Object.keys(published),["schema","semanticsVersion","catalogue","passed","casesTotal","failedCount","lockObservations","serializationConflicts","sourcePinsVerified","cleanup"]);
  assert.equal(published.casesTotal,2);assert.equal(published.failedCount,1);assert.equal(published.lockObservations,1);
  assert.deepEqual(published.cleanup,{schemaDropped:true,connectionsClosed:true,syntheticEnvironmentRestored:true});
  const workflow=await readFile(path.resolve(apiRoot,"../../.github/workflows/enterprise-ephemeral-e2e.yml"),"utf8");
  assert.match(workflow,/npm run test:e2e:ephemeral:safety/);assert.match(workflow,/npm run test:e2e:ephemeral/);
});
