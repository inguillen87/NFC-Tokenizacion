import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {dashboardHighImpactPermissionMatches,dashboardPermissionMatches,dashboardPermissionDenied} from '../src/lib/permission-policy.ts';
import {supplierOperatorCan} from '../src/lib/supplier-operator-access.ts';
import {canReadRuntimeConsole} from '../src/lib/runtime-readiness-access.ts';
import {canReadGlobalNotifications} from '../src/lib/admin-notification-access.ts';
import {readHistoricalBaseline,TENANT_SYNC_REVIEWED_SOURCES,TENANT_SYNC_SOURCE_BASE,tenantSyncHistoricalSourceHash} from './helpers/tenant-sync-reviewed-sources.mjs';
import {ENGAGEMENT_GOVERNANCE_BASE,ENGAGEMENT_GOVERNANCE_CHANGED,ENGAGEMENT_GOVERNANCE_ADDED,governancePublishedSourceHash,assertGovernanceInventory,assertGovernanceAddedSource,governanceSourceHash} from './helpers/engagement-governance-reviewed-sources.mjs';
import {TENANT_MARKETPLACE_ADDED,marketplacePublishedSourceHash,marketplacePriorInventory,assertMarketplaceAddedSource} from './helpers/tenant-marketplace-reviewed-sources.mjs';
const source=await readFile(new URL('../src/lib/supplier-request-proxy.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source.replace(/^import .*;\r?$/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleExports={};
new Function('exports','dashboardHighImpactPermissionMatches','dashboardPermissionMatches','dashboardPermissionDenied','supplierOperatorCan','getDashboardSessionCredential','dashboardFetch','productUrls',compiled)(moduleExports,dashboardHighImpactPermissionMatches,dashboardPermissionMatches,dashboardPermissionDenied,supplierOperatorCan,()=>{throw Error('Unexpected credential lookup');},()=>{throw Error('Unexpected network');},{api:'http://not-used.invalid'});
const id='40000000-0000-4000-8000-000000000001',key='50000000-0000-4000-8000-000000000001',userId='20000000-0000-4000-8000-000000000001';
const company=(patch={})=>({id:'synthetic-company-session',userId,role:'operations-manager',tenantId:'10000000-0000-4000-8000-000000000001',tenantSlug:'qa-company',permissions:['supplier_order.create'],deniedPermissions:[],isDemo:false,...patch});
const global=(patch={})=>company({id:'synthetic-global-session',role:'super-admin',tenantId:null,tenantSlug:null,permissions:['supplier_order.create','supplier_request.assign'],...patch});
const operator=(patch={})=>company({id:'synthetic-operator-session',role:'supplier-operator',tenantId:null,tenantSlug:null,permissions:['supplier_request.assigned.read','supplier_request.assigned.review'],...patch});
async function call(session,segments,{method='GET',query='',body={},status=200}={}){
 const calls=[];
 const req=new Request('http://localhost/api/admin/supplier-requests'+(segments.length?'/'+segments.join('/'):'')+query,{method,headers:{origin:'http://localhost','sec-fetch-site':'same-origin','content-type':'application/json','idempotency-key':key,'x-admin-tenant':'NEVER_TRUST_CALLER'},...(method==='GET'?{}:{body:JSON.stringify(body)})});
 const response=await moduleExports.forwardSupplierRequest(req,segments,{credential:async()=>({session,bearerToken:'SYNTHETIC_SERVER_SESSION'}),fetcher:async(url,init)=>{calls.push({url,init});return Response.json({ok:status<400},{status});},apiBase:'http://synthetic-api.invalid'});
 assert.match(response.headers.get('cache-control'),/private.*no-store/);assert.equal(response.headers.get('referrer-policy'),'no-referrer');return{status:response.status,calls};
}
for(const resource of [[],[id],['service-status'],[id,'review'],[id,'quotation'],[id,'supplier-binding'],[id,'delivery-ack']])test('company denied global diagnostics keeps the authorized commercial read '+resource.join('/'),async()=>{
 const session=company();assert.equal(canReadRuntimeConsole(session),false);assert.equal(canReadGlobalNotifications(session),false);
 const result=await call(session,resource);assert.equal(result.status,200);assert.equal(result.calls.length,1);assert.ok(result.calls[0].url.endsWith('?tenant=qa-company'));assert.doesNotMatch(result.calls[0].url,/diagnostics|notifications/);
});
for(const action of ['accept','reject'])test('company commercial quotation decision remains available without global access '+action,async()=>{
 const result=await call(company(),[id,'quotation'],{method:'POST',body:{action,expected_revision:1}});assert.equal(result.status,200);assert.equal(result.calls.length,1);assert.equal(result.calls[0].init.headers['Idempotency-Key'],key);assert.equal(JSON.parse(result.calls[0].init.body).action,action);
});
for(const resource of [[id,'assignment'],[id,'supplier-binding'],[id,'delivery-ack']])test('merge does not grant company global supplier mutation '+resource.at(-1),async()=>{const r=await call(company(),resource,{method:'POST'});assert.equal(r.status,403);assert.equal(r.calls.length,0);});
test('global diagnostic authority does not silently select a company for commercial reads',async()=>{
 const session=global();assert.equal(canReadRuntimeConsole(session),true);assert.equal(canReadGlobalNotifications(session),true);
 const unscoped=await call(session,['service-status']);assert.equal(unscoped.status,400);assert.equal(unscoped.calls.length,0);
 const selected=await call(session,['service-status'],{query:'?tenant=qa-company'});assert.equal(selected.status,200);assert.ok(selected.calls[0].url.endsWith('?tenant=qa-company'));
});
test('audit denial remains independent of explicitly granted commercial operations',async()=>{
 const session=global({deniedPermissions:['audit.read']});assert.equal(canReadRuntimeConsole(session),false);assert.equal((await call(session,[id,'quotation'],{query:'?tenant=qa-company'})).status,200);
 const commercialDenied=global({deniedPermissions:['supplier_order.create']});assert.equal(canReadRuntimeConsole(commercialDenied),true);const r=await call(commercialDenied,['service-status'],{query:'?tenant=qa-company'});assert.equal(r.status,403);assert.equal(r.calls.length,0);
});
test('limited supplier technician retains assigned-only workbench and clarification request, never global/tenant selectors',async()=>{
 const session=operator();assert.equal(canReadRuntimeConsole(session),false);assert.equal(canReadGlobalNotifications(session),false);
 assert.equal((await call(session,['assigned'])).status,200);assert.equal((await call(session,['assigned',id,'review'],{method:'POST',body:{action:'request_information'}})).status,200);
 for(const [segments,query]of [[[], ''],[['service-status'],''],[['assigned'],'?tenant=qa-company']]){const result=await call(session,segments,{query});assert.ok([400,403].includes(result.status));assert.equal(result.calls.length,0);}
 const denied=await call(operator({deniedPermissions:['supplier_request.assigned.read']}),['assigned']);assert.equal(denied.status,403);assert.equal(denied.calls.length,0);
});
for(const patch of [{isDemo:true},{deniedPermissions:['*']}])test('shared forbidden contexts cannot regain commercial access '+JSON.stringify(patch),async()=>{const session=company(patch);assert.equal(canReadRuntimeConsole(session),false);const r=await call(session,[id]);assert.equal(r.status,403);assert.equal(r.calls.length,0);});
test('cross-company selection cannot piggyback on the explanatory runtime page',async()=>{const r=await call(company(),[id],{query:'?tenant=other-company'});assert.equal(r.status,403);assert.equal(r.calls.length,0);});
test('authoritative commercial access loss is still returned, not hidden by the new global access explanation',async()=>{for(const status of [401,403,404]){const r=await call(company(),[id],{status});assert.equal(r.status,status);assert.equal(r.calls.length,1);}});

test('every merged source file retains its immutable origin except the exact reviewed tenant-sync increment',async()=>{
 const baseline=readHistoricalBaseline('release-convergence',await readFile(new URL('./fixtures/release-convergence-baseline.json',import.meta.url),'utf8'));
 assert.equal(baseline.protocol,'nexid.release-convergence-source.v1');assert.equal(baseline.baselineSourceFiles,487);assert.equal(baseline.replaced.length,3);assert.equal(baseline.added.length,2);
 const root=new URL('../src/',import.meta.url),actual=[];
 async function walk(dir,prefix='apps/dashboard/src'){for(const e of await readdir(dir,{withFileTypes:true})){if(e.isDirectory())await walk(new URL(e.name+'/',dir),prefix+'/'+e.name);else if(e.isFile())actual.push(prefix+'/'+e.name);}}
 await walk(root);assertGovernanceInventory(marketplacePriorInventory(actual,baseline.expected,Object.keys(ENGAGEMENT_GOVERNANCE_ADDED)),baseline.expected);
 for(const [path,expected]of Object.entries(baseline.expected)){const text=(await readFile(new URL('../'+path.replace(/^apps\/dashboard\//,''),import.meta.url),'utf8')).replaceAll('\r\n','\n');const actual=createHash('sha256').update(text).digest('hex');assert.equal(tenantSyncHistoricalSourceHash(path,governancePublishedSourceHash(path,marketplacePublishedSourceHash(path,actual)),expected),expected,path);}
 for(const path of Object.keys(ENGAGEMENT_GOVERNANCE_ADDED))assertGovernanceAddedSource(path,governanceSourceHash(await readFile(new URL('../'+path.replace(/^apps\/dashboard\//,''),import.meta.url),'utf8')));
 for(const path of Object.keys(TENANT_MARKETPLACE_ADDED))assertMarketplaceAddedSource(path,governanceSourceHash(await readFile(new URL('../'+path.replace(/^apps\/dashboard\//,''),import.meta.url),'utf8')));
 assert.ok(baseline.expected['apps/dashboard/src/components/supplier-request-workspace.tsx']);
 assert.ok(baseline.expected['apps/dashboard/src/lib/supplier-service-client.ts']);
});
test('tenant-sync review allows exactly two pinned source increments and rejects changed origin or unreviewed content',()=>{
 assert.equal(TENANT_SYNC_SOURCE_BASE,'4d976d385e75d1e9139ebc44f5ba820eaaebb591');
 assert.deepEqual(Object.keys(TENANT_SYNC_REVIEWED_SOURCES).sort(),['apps/dashboard/src/app/(app)/loyalty/rewards/rewards-client.tsx','apps/dashboard/src/app/sign-in/[[...sign-in]]/page.tsx','apps/dashboard/src/lib/dashboard-release.ts']);
 for(const [path,reviewed]of Object.entries(TENANT_SYNC_REVIEWED_SOURCES)){
  assert.equal(tenantSyncHistoricalSourceHash(path,reviewed.after,reviewed.before),reviewed.before);
  assert.throws(()=>tenantSyncHistoricalSourceHash(path,'0'.repeat(64),reviewed.before),/exact reviewed increment/);
  assert.throws(()=>tenantSyncHistoricalSourceHash(path,reviewed.after,'0'.repeat(64)),/reviewed origin/);
 }
 assert.equal(tenantSyncHistoricalSourceHash('apps/dashboard/src/lib/permission-policy.ts','unreviewed-change','baseline'),'unreviewed-change');
 assert.throws(()=>assert.equal(tenantSyncHistoricalSourceHash('apps/dashboard/src/lib/permission-policy.ts','unreviewed-change','baseline'),'baseline'));
 assert.throws(()=>readHistoricalBaseline('runtime-console','{}'),/historical fixture remains immutable/);
});
test('governance overlay pins exact published origin and an independent four-changed/four-added allowlist',async()=>{
 assert.equal(ENGAGEMENT_GOVERNANCE_BASE,'7ba66c97fcbcf1b45d994cd673f14ebb8e01d649');
 assert.deepEqual(Object.keys(ENGAGEMENT_GOVERNANCE_CHANGED).sort(),['apps/dashboard/src/app/(app)/loyalty/overview/page.tsx','apps/dashboard/src/app/(app)/loyalty/page.tsx','apps/dashboard/src/lib/dashboard-release.ts','apps/dashboard/src/lib/permission-policy.ts']);
 assert.deepEqual(Object.keys(ENGAGEMENT_GOVERNANCE_ADDED).sort(),['apps/dashboard/src/app/(app)/loyalty/configuration/page.tsx','apps/dashboard/src/components/loyalty-configuration-workspace.module.css','apps/dashboard/src/components/loyalty-configuration-workspace.tsx','apps/dashboard/src/lib/loyalty-configuration.ts']);
 const baseline=readHistoricalBaseline('release-convergence',await readFile(new URL('./fixtures/release-convergence-baseline.json',import.meta.url),'utf8'));
 for(const [path,pin]of Object.entries(ENGAGEMENT_GOVERNANCE_CHANGED)){
  assert.equal(tenantSyncHistoricalSourceHash(path,pin.before,baseline.expected[path]),baseline.expected[path],path+' independently retained prior origin');
  assert.equal(governancePublishedSourceHash(path,pin.after),pin.before);
  assert.throws(()=>governancePublishedSourceHash(path,'0'.repeat(64)),/exact reviewed governance increment/);
 }
 const inventory=[...Object.keys(baseline.expected),...Object.keys(ENGAGEMENT_GOVERNANCE_ADDED)];assertGovernanceInventory(inventory,baseline.expected);
 assert.throws(()=>assertGovernanceInventory(inventory.slice(1),baseline.expected));assert.throws(()=>assertGovernanceInventory([...inventory,'apps/dashboard/src/unreviewed.ts'],baseline.expected));
 assert.throws(()=>assertGovernanceAddedSource('apps/dashboard/src/unreviewed.ts','0'.repeat(64)),/known governance source addition/);
 for(const path of Object.keys(ENGAGEMENT_GOVERNANCE_ADDED))assert.throws(()=>assertGovernanceAddedSource(path,'0'.repeat(64)),/exact reviewed governance addition/);
 assert.equal(governancePublishedSourceHash('apps/dashboard/src/lib/enterprise-runtime-rbac.ts','unreviewed'),'unreviewed');
});
test('merged CI keeps all prior operational and production-hotfix browser suites',async()=>{
 const w=await readFile(new URL('../../../.github/workflows/ticket-deadline-qa.yml',import.meta.url),'utf8');
 const suites=['support-tickets','customer-activity-summary','member-timeline-continuity','batch-workspace-navigation','dependency-map','supplier-order-draft','supplier-requests','supplier-request-assignments','roll-manifest-intake','supplier-request-cancellation','supplier-request-quotes','supplier-request-binding','supplier-delivery-ack','runtime-console','runtime-access-hotfix','supplier-service-status','supplier-request-read-safety','supplier-request-case-summary'];
 for(const suite of suites)assert.ok(w.includes('node apps/dashboard/tests/'+suite+'.browser.mjs'),suite);
 assert.match(w,/codex\/nexid-release-convergence-20260925/);assert.doesNotMatch(w,/<<<<<<<|=======|>>>>>>>|continue-on-error/);assert.match(w,/cancel-in-progress: false/);
});

test('draft guidance overlays only its reviewed workspace and never replaces the advanced receipt/role guards',async()=>{const s=await readFile(new URL('../src/components/supplier-request-workspace.tsx',import.meta.url),'utf8');for(const name of ['readWithdrawn','withdrawRead','invalidateReads','SupplierServiceStatus','SupplierRequestQuotation','SupplierRequestBinding','SupplierRequestDeliveryAck','SupplierRequestCancellation','SupplierRequestAssignment']){assert.ok(s.includes(name),name);}assert.ok(s.includes('setValidationAttempted(false)'));assert.ok(s.includes('readWithdrawn.current || !reviewing'));assert.ok(s.includes('serviceGuard.current.locked'));const m=JSON.parse(await readFile(new URL('./fixtures/release-convergence-baseline.json',import.meta.url),'utf8'));assert.equal(m.draftGuidance.feature,'ca437bfb477b5dfb0dacd07ddedbe8eddd342daf');assert.equal(m.draftGuidance.added.length,3);assert.notEqual(m.draftGuidance.workspaceBefore,m.draftGuidance.workspaceAfter);});

test('inbox integration preserves advanced operations and reviewed UI sources',async()=>{const s=await readFile(new URL('../src/components/supplier-request-workspace.tsx',import.meta.url),'utf8');for(const name of ['withdrawRead','invalidateReads','serviceGuard.current.locked','SupplierServiceStatus','SupplierRequestQuotation','SupplierRequestBinding','SupplierRequestDeliveryAck','SupplierRequestCancellation','SupplierRequestAssignment','SupplierRequestDraftGuide','SupplierRequestInbox'])assert.ok(s.includes(name),name);assert.match(s,/includeCancelled onOpen/);assert.doesNotMatch(s,/setInboxSearch|filterSupplierRequestInbox/);const m=JSON.parse(await readFile(new URL('./fixtures/release-convergence-baseline.json',import.meta.url),'utf8'));assert.equal(m.inbox.feature,'5919edb8375d894df27523046fc6c83d254d4880');assert.equal(m.inbox.added.length,3);assert.notEqual(m.inbox.workspaceBefore,m.inbox.workspaceAfter);});

test('case summary overlays only presentation and preserves every advanced workflow origin',async()=>{const s=await readFile(new URL('../src/components/supplier-request-workspace.tsx',import.meta.url),'utf8');for(const name of ['SupplierRequestCaseSummary','SupplierDraftComparison','SupplierRequestQuotation','SupplierRequestBinding','SupplierRequestDeliveryAck','SupplierRequestCancellation','SupplierRequestAssignment','SupplierServiceStatus'])assert.ok(s.includes(name),name);const m=JSON.parse(await readFile(new URL('./fixtures/release-convergence-baseline.json',import.meta.url),'utf8'));assert.equal(m.caseSummary.feature,'ddd72ef9114e1233b0d8713a1e5f261f7241136b');assert.equal(m.caseSummary.parent,'beb536614714213c14d2a01f464af90b30bda6ea');assert.equal(m.caseSummary.added.length,3);assert.notEqual(m.caseSummary.workspaceBefore,m.caseSummary.workspaceAfter);});
test('three-way comparison keeps every advanced operation guard and its immutable feature origin',async()=>{const s=await readFile(new URL('../src/components/supplier-request-workspace.tsx',import.meta.url),'utf8');const guard=s.split('function canReconcile(){')[1].split('}')[0];for(const ref of ['reads','locked','unresolved','busy','readWithdrawn','reviewGuard','assignmentGuard','cancellationGuard','quotationGuard','bindingGuard','deliveryGuard','serviceGuard'])assert.ok(guard.includes(ref+'.current'),ref);for(const c of ['SupplierDraftComparison','SupplierRequestQuotation','SupplierRequestBinding','SupplierRequestDeliveryAck','SupplierRequestCancellation','SupplierRequestAssignment','SupplierServiceStatus'])assert.ok(s.includes(c),c);const m=JSON.parse(await readFile(new URL('./fixtures/release-convergence-baseline.json',import.meta.url),'utf8'));assert.equal(m.draftReconciliation.feature,'bf80ccc04fa73108f8d103ebcc597a8fb833d423');assert.equal(m.draftReconciliation.added.length,3);assert.notEqual(m.draftReconciliation.workspaceBefore,m.draftReconciliation.workspaceAfter);});
