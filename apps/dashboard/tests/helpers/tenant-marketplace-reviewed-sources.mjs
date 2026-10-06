import assert from 'node:assert/strict';

// Candidate bytes for the bounded catalog increment on published 2958.
// Independent source review and freeze are still required before release.
// Historical fixtures and prior overlays retain their original bytes.
export const TENANT_MARKETPLACE_BASE='2958f8cac3f06ff23dd43782d49f9e15310e0806';
export const TENANT_MARKETPLACE_CHANGED=Object.freeze({
 'apps/dashboard/src/app/(app)/consumer-network/marketplace/page.tsx':Object.freeze({before:'3fc346fc7e84153d8f918b996cd61fedfdcc35828330814778d3eb4e7de1ca28',after:'a95ee7d568f3b85a568d694487029ca9dcc75eed5eb3255ce63574e36f1b5d19'}),
 'apps/dashboard/src/app/api/tenant-marketplace/[id]/route.ts':Object.freeze({before:'ad2f4003a46981bbaa3c05b89e92c5bc0347828c0bb21cf062527dd1922638f7',after:'ba03a64ff4b7a1f8ed25c62b3bb8e1aed74eb450de45c171f7cb5c9504b8cac4'}),
 'apps/dashboard/src/app/api/tenant-marketplace/route-helpers.ts':Object.freeze({before:'038c89705b7443ba4166b3391691ded5cdbfbc17e5ff6f6bacbbd58bb8fe27de',after:'33db63f6dd6b696d75e2b35e469da2fbcfe9370067e91b4037e147e0d71a42a5'}),
 'apps/dashboard/src/app/api/tenant-marketplace/route.ts':Object.freeze({before:'880da53e8808e4b8f703571f537367849c18921cc6d21b73e0ace5ffc93174ee',after:'ffbc8e9b3c2bec4e7ff7991bffdba992e11feb21b44345ab969d5714f80019cb'}),
 'apps/dashboard/src/lib/dashboard-release.ts':Object.freeze({before:'498c70675949ac93156a9c73ae9abc7512566c20206a991479ad0be302c714c2',after:'ec8466490ddf077ffa51bf5d6031fa7bed2e58f124f49c5cb65715d2b7384be6'})
});
export const TENANT_MARKETPLACE_ADDED=Object.freeze({
 'apps/dashboard/src/components/tenant-marketplace-workspace.module.css':'4b732c4bc1473f4f562f578ceaf33cfaecdc266a4b9722031724668736298e71',
 'apps/dashboard/src/components/tenant-marketplace-workspace.tsx':'267e33fecb730b2449d73887ea1090a77b1db102e39010620908e1963109bcdb',
 'apps/dashboard/src/lib/tenant-marketplace.ts':'0d5bc7ae47e0aee8a5faaf7d74fd2e2d0cfd62c783a2b50cc664eeef6c0e5ea6'
});
export function marketplacePublishedSourceHash(path,actual) {
 const pinned=TENANT_MARKETPLACE_CHANGED[path];
 if(!pinned)return actual;
 assert.equal(actual,pinned.after,path+' exact pinned marketplace increment');
 return pinned.before;
}
export function marketplacePriorInventory(actual,historicalExpected,priorAdded) {
 for(const path of Object.keys(TENANT_MARKETPLACE_CHANGED))assert.ok(Object.hasOwn(historicalExpected,path),'known marketplace origin '+path);
 for(const path of Object.keys(TENANT_MARKETPLACE_ADDED)){
  assert.ok(!Object.hasOwn(historicalExpected,path),'explicitly new marketplace path '+path);
  assert.ok(!priorAdded.includes(path),'marketplace path cannot replace a prior addition '+path);
 }
 assert.deepEqual([...actual].sort(),[...Object.keys(historicalExpected),...priorAdded,...Object.keys(TENANT_MARKETPLACE_ADDED)].sort(),'all historical sources, prior additions and exactly three catalog additions');
 return actual.filter(path=>!Object.hasOwn(TENANT_MARKETPLACE_ADDED,path));
}
export function assertMarketplaceAddedSource(path,actual) {
 assert.ok(Object.hasOwn(TENANT_MARKETPLACE_ADDED,path),'known marketplace source addition');
 assert.equal(actual,TENANT_MARKETPLACE_ADDED[path],path+' exact pinned marketplace addition');
}
