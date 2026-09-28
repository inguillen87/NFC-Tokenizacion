import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFile} from 'node:fs/promises';
import {regressionEnvironment,regressionCommand,runBuildRegressions} from '../scripts/run-build-regressions.mjs';

test('production build fixtures receive a test-only environment without mutating the parent',()=>{
 const input=Object.freeze({PATH:'/usr/bin',SystemRoot:'C:/Windows',NODE_ENV:'production',VERCEL_ENV:'production',DATABASE_URL:'PRIVATE_DATABASE',POSTGRES_URL:'PRIVATE_POSTGRES',CLERK_SECRET_KEY:'PRIVATE_CLERK',NEXID_REQUIRED_SCHEMA_MIGRATION:'PRIVATE_REQUIREMENT',SUPPLIER_REQUEST_QUOTES_ENABLED:'true',NODE_OPTIONS:'PRIVATE_PRELOAD',HTTP_PROXY:'PRIVATE_PROXY',npm_config_userconfig:'PRIVATE_CONFIG'});
 const actual=regressionEnvironment(input);assert.equal(actual.NODE_ENV,'test');assert.equal(actual.VERCEL_ENV,'test');assert.equal(actual.PATH,input.PATH);assert.equal(actual.SystemRoot,input.SystemRoot);assert.equal(input.NODE_ENV,'production');assert.doesNotMatch(JSON.stringify(actual),/PRIVATE|SUPPLIER_REQUEST/);
});
for(const platform of ['win32','linux','darwin'])test('fixed regression command on '+platform,()=>{const c=regressionCommand(platform);assert.ok(c.args.includes('build:regressions')||c.args.includes('npm run build:regressions'));assert.doesNotMatch(JSON.stringify(c),/next build|--ignore|skip/);});
for(const outcome of [0,1,17,null])test('child exit is preserved or fails closed '+outcome,async()=>{
 const original={PATH:'/usr/bin',NODE_ENV:'production',DATABASE_URL:'PRIVATE'};let observed;
 const code=await runBuildRegressions({environment:original,platform:'linux',cwd:'/synthetic',spawnProcess:(file,args,options)=>{observed={file,args,options};const child=new EventEmitter();queueMicrotask(()=>child.emit('close',outcome));return child;}});
 assert.equal(code,outcome===null?1:outcome);assert.equal(observed.options.env.DATABASE_URL,undefined);assert.equal(observed.options.env.NODE_ENV,'test');assert.equal(original.NODE_ENV,'production');assert.equal(observed.options.stdio,'inherit');
});
test('a spawn error fails the build rather than skipping tests',async()=>{assert.equal(await runBuildRegressions({spawnProcess:()=>{const c=new EventEmitter();queueMicrotask(()=>c.emit('error',Error('synthetic')));return c;}}),1);});
test('regressions precede Next and every prior build test is preserved',async()=>{
 const p=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(p.scripts.build,'node scripts/run-build-regressions.mjs && next build');
 for(const name of ['test:routes','test:rewards','test:sun','test:supplier-security','test:supplier-requests','test:commercial-scope','test:campaign-drafts','test:polygon-transfer','test:wallet-control','test:proof','test:webhooks','test:gs1-epcis','test:auth-security','test:consumer-otp','test:rate-limits','test:logistics','test:passport','test:reception','test:batches-workbench','test:batch-channels','test:pilot-report','test:recalls','test:campaign-launch','test:notice-reviews','test:assigned-tasks','test:gs1-production','test:traceability','test:trace-page','test:epcis-intake','test:epcis-picker','test:editorial-queue','test:passport-library','test:consumer-history'])assert.ok(p.scripts['build:regressions'].includes('npm run '+name),name);
 assert.ok(p.scripts['build:regressions'].startsWith('node scripts/sanitize-route-tree.mjs && npm run test:build-environment && '));
});
