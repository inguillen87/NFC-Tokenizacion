import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {readHistoricalBaseline,tenantSyncHistoricalSourceHash} from './helpers/tenant-sync-reviewed-sources.mjs';
import {ENGAGEMENT_GOVERNANCE_ADDED,governancePublishedSourceHash,assertGovernanceInventory} from './helpers/engagement-governance-reviewed-sources.mjs';
import {TENANT_MARKETPLACE_BASE,TENANT_MARKETPLACE_CHANGED,TENANT_MARKETPLACE_ADDED,marketplacePublishedSourceHash,marketplacePriorInventory,assertMarketplaceAddedSource} from './helpers/tenant-marketplace-reviewed-sources.mjs';

test('catalog overlay retains exactly the published origins without accepting arbitrary future bytes',async()=>{
 assert.equal(TENANT_MARKETPLACE_BASE,'2958f8cac3f06ff23dd43782d49f9e15310e0806');
 assert.deepEqual(Object.keys(TENANT_MARKETPLACE_CHANGED).sort(),['apps/dashboard/src/app/(app)/consumer-network/marketplace/page.tsx','apps/dashboard/src/app/api/tenant-marketplace/[id]/route.ts','apps/dashboard/src/app/api/tenant-marketplace/route-helpers.ts','apps/dashboard/src/app/api/tenant-marketplace/route.ts','apps/dashboard/src/lib/dashboard-release.ts']);
 const baseline=readHistoricalBaseline('release-convergence',await readFile(new URL('./fixtures/release-convergence-baseline.json',import.meta.url),'utf8'));
 for(const [path,pin]of Object.entries(TENANT_MARKETPLACE_CHANGED)){
  assert.equal(tenantSyncHistoricalSourceHash(path,governancePublishedSourceHash(path,pin.before),baseline.expected[path]),baseline.expected[path],path+' retained historical origin');
  assert.equal(marketplacePublishedSourceHash(path,pin.after),pin.before);
  assert.throws(()=>marketplacePublishedSourceHash(path,'0'.repeat(64)),/exact pinned marketplace increment/);
 }
 assert.equal(marketplacePublishedSourceHash('apps/dashboard/src/lib/permission-policy.ts','future-byte-change'),'future-byte-change');
 assert.throws(()=>assert.equal(marketplacePublishedSourceHash('apps/dashboard/src/lib/permission-policy.ts','future-byte-change'),baseline.expected['apps/dashboard/src/lib/permission-policy.ts']));
});

test('catalog inventory accepts only its three explicit additions while preserving earlier inventory guards',async()=>{
 assert.deepEqual(Object.keys(TENANT_MARKETPLACE_ADDED).sort(),['apps/dashboard/src/components/tenant-marketplace-workspace.module.css','apps/dashboard/src/components/tenant-marketplace-workspace.tsx','apps/dashboard/src/lib/tenant-marketplace.ts']);
 const baseline=readHistoricalBaseline('release-convergence',await readFile(new URL('./fixtures/release-convergence-baseline.json',import.meta.url),'utf8'));
 const priorAdded=Object.keys(ENGAGEMENT_GOVERNANCE_ADDED),inventory=[...Object.keys(baseline.expected),...priorAdded,...Object.keys(TENANT_MARKETPLACE_ADDED)];
 assertGovernanceInventory(marketplacePriorInventory(inventory,baseline.expected,priorAdded),baseline.expected);
 for(const paths of[inventory.slice(1),[...inventory,'apps/dashboard/src/unreviewed.ts'],[...inventory,inventory[0]],inventory.filter(path=>path!==Object.keys(TENANT_MARKETPLACE_ADDED)[0])])assert.throws(()=>marketplacePriorInventory(paths,baseline.expected,priorAdded));
 assert.throws(()=>assertMarketplaceAddedSource('apps/dashboard/src/unreviewed.ts','0'.repeat(64)),/known marketplace source addition/);
 for(const [path,pin]of Object.entries(TENANT_MARKETPLACE_ADDED)){
  assertMarketplaceAddedSource(path,pin);
  assert.throws(()=>assertMarketplaceAddedSource(path,'0'.repeat(64)),/exact pinned marketplace addition/);
 }
});
