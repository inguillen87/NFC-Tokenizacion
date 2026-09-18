import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {canDownloadIntegrationKit,integrationShellArgument} from '../src/lib/integration-kit-policy.ts';
const manifest=JSON.parse(await readFile(new URL('../src/lib/integration-kit-manifest.json',import.meta.url),'utf8'));
const root=new URL('../resources/integration-kit/',import.meta.url);
const session={role:'tenant-admin',permissions:['api_keys.read'],deniedPermissions:[],isDemo:false};
test('private SDK kit needs the established role capability, never a demo session',()=>{
 assert.equal(canDownloadIntegrationKit(session),true);
 assert.equal(canDownloadIntegrationKit(null),false);
 assert.equal(canDownloadIntegrationKit({...session,isDemo:true}),false);
 assert.equal(canDownloadIntegrationKit({...session,permissions:[]}),false);
 assert.equal(canDownloadIntegrationKit({...session,deniedPermissions:['api_keys.read']}),false);
});
test('copyable shell parameters never interpolate untrusted shell syntax',()=>{
 assert.equal(integrationShellArgument('company-qa','fallback'),'company-qa');
 for(const value of ['name;rm -r','$(bad)','hello world','a&b','../x'])assert.equal(integrationShellArgument(value,'fallback'),'fallback');
});
function filesInTar(buffer){
 const raw=gunzipSync(buffer),result=new Map();let offset=0;
 while(offset+512<=raw.length){const h=raw.subarray(offset,offset+512);if(h.every(b=>b===0))break;const name=h.subarray(0,100).toString().replace(/\0.*$/s,'');const size=parseInt(h.subarray(124,136).toString().replace(/\0/g,'').trim(),8);assert.ok(Number.isSafeInteger(size)&&size>=0&&size<2000000);assert.equal(h[156],48);assert.ok(!name.includes('..')&&!name.startsWith('/'));result.set(name,raw.subarray(offset+512,offset+512+size));offset+=512+Math.ceil(size/512)*512;}
 return result;
}
test('downloaded archive matches pinned bytes and contains an installable local SDK rather than the repo',async()=>{
 const bytes=await readFile(new URL(manifest.filename,root));assert.equal(bytes.length,manifest.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
 const entries=filesInTar(bytes);assert.equal(entries.size,manifest.files);
 const base='nexid-integration-starter/';for(const name of ['src/connector.mjs','src/webhook.mjs','src/ledger.mjs','manifest.json','package-lock.json','vendor/product-nexid-server-sdk-0.2.0.tgz'])assert.ok(entries.has(base+name));
 assert.ok([...entries.keys()].every(name=>!name.includes('node_modules/')&&!name.includes('.env')&&!name.includes('.sqlite')&&!name.includes('apps/api/src')));
 const packed=JSON.parse(entries.get(base+'package.json'));assert.equal(packed.private,true);assert.equal(packed.dependencies['@product/nexid-server-sdk'],'file:vendor/product-nexid-server-sdk-0.2.0.tgz');
 const sdk=filesInTar(entries.get(base+'vendor/product-nexid-server-sdk-0.2.0.tgz'));assert.equal(sdk.size,6);assert.ok(sdk.has('package/dist/index.js'));assert.ok(!sdk.has('package/src/index.ts'));
 const fileManifest=JSON.parse(entries.get(base+'manifest.json'));for(const f of fileManifest.files)assert.equal(createHash('sha256').update(entries.get(base+f.path)).digest('hex'),f.sha256);
});
test('asset route is authenticated and server-side, with private cache and integrity checks',async()=>{
 const route=await readFile(new URL('../src/app/api/integration-kit/route.ts',import.meta.url),'utf8');assert.match(route,/getDashboardSession/);assert.match(route,/canDownloadIntegrationKit/);assert.match(route,/private, no-store/);assert.match(route,/createHash/);assert.doesNotMatch(route,/POST|apiKey:|NEXT_PUBLIC_/);
 const config=await readFile(new URL('../next.config.mjs',import.meta.url),'utf8');assert.match(config,/outputFileTracingIncludes/);assert.match(config,/integration-kit/);
});
test('UI verifies digest and downloads without requesting or storing credentials',async()=>{
 const ui=await readFile(new URL('../src/components/integration-kit-console.tsx',import.meta.url),'utf8');assert.match(ui,/crypto.subtle.digest/);assert.match(ui,/AbortSignal.timeout/);assert.match(ui,/URL.revokeObjectURL/);assert.doesNotMatch(ui,/localStorage|setInterval|type="password"|POST/);
});

import {SDK_INTEGRATION_PROFILES} from '../src/lib/sdk-developer-experience.ts';
test('ERP CSV preset grants only catalog reads and external events, not NFC or custody writes',()=>{const p=SDK_INTEGRATION_PROFILES.find(p=>p.id==='erp-csv');assert.deepEqual(p.scopes,['sdk:products','sdk:events']);assert.deepEqual(p.webhookEvents,['sdk.external_event']);});
test('opening a profile never calls credential creation or overwrites the session',async()=>{const page=await readFile(new URL('../src/app/(app)/api-keys/page.tsx',import.meta.url),'utf8');assert.match(page,/requireDashboardTenantScope\(session,query.tenant\)/);assert.match(page,/initialProfileId/);assert.doesNotMatch(page,/method:.*POST|session.permissions\s*=/);});

import {buildProductQuickstart} from '../src/lib/sdk-developer-experience.ts';
test('ERP profile quickstart reads products rather than demanding an unsupported verification scope',()=>{const q=buildProductQuickstart({tenantSlug:'test-company',bid:'LOT-QA'});assert.match(q.curl,/curl.exe/);assert.match(q.curl,/sdk\/products\/LOT-QA/);assert.match(q.node,/getProduct/);assert.doesNotMatch(q.node,/verifyTap|picc_data|cmac|reportEvent/);});

import {readIntegrationKitBytes} from '../src/lib/integration-kit-download.ts';
test('download reader rejects truncated and oversized streams before saving a file',async()=>{assert.equal((await readIntegrationKitBytes(new Response('abc'),3)).length,3);await assert.rejects(()=>readIntegrationKitBytes(new Response('abcd'),3));await assert.rejects(()=>readIntegrationKitBytes(new Response('ab'),3));});
