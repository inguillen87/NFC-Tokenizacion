import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// A separately reviewed increment on published 7ba. Neither historical fixture nor prior overlay is reset.
export const ENGAGEMENT_GOVERNANCE_BASE='7ba66c97fcbcf1b45d994cd673f14ebb8e01d649';
export const ENGAGEMENT_GOVERNANCE_CHANGED=Object.freeze({
 'apps/dashboard/src/app/(app)/loyalty/page.tsx':Object.freeze({before:'7dc257ab048db3182038c7b024ce1bfcc7a1ecd3a37670ee27588df7ef53f69c',after:'c9be7ca5b31580d4bfce54434c7863660bc1a6096b7a76fad5a9a95a2212241a'}),
 'apps/dashboard/src/app/(app)/loyalty/overview/page.tsx':Object.freeze({before:'7076e85f156748c3330ef5fff9c5ea07d4d15962fd0cb9999a22cd7c9f8e64f3',after:'c257fcd8b19e9c5c9a93067bbdbde828d4e8a1c2a2dc8d5995fd8c24416f078b'}),
 'apps/dashboard/src/lib/permission-policy.ts':Object.freeze({before:'2cf1302450e12d7791c602e95def24ff37438a2fe616a228f7ca0947ce7fe2b4',after:'45472db8d700e049945cc3322cb701599a3dac5b2e3762c60521e32394df8962'}),
 'apps/dashboard/src/lib/dashboard-release.ts':Object.freeze({before:'c54a573641e1803b2d915980007348cd5f4747fad23e1555109d922c3cad89ab',after:'498c70675949ac93156a9c73ae9abc7512566c20206a991479ad0be302c714c2'})
});
export const ENGAGEMENT_GOVERNANCE_ADDED=Object.freeze({
 'apps/dashboard/src/app/(app)/loyalty/configuration/page.tsx':'3db60ccf23c784ecf43c435620a5bd1e151f25810ac0923b85a5fabaeb557e58',
 'apps/dashboard/src/components/loyalty-configuration-workspace.tsx':'433842a6ee2dba427f40e211faaa9a633ffde253e2ee01638c77ec685414e8b4',
 'apps/dashboard/src/components/loyalty-configuration-workspace.module.css':'13a6dd8794876c4b83d36916a902139504d92c580b22ef9815319a5eebba2244',
 'apps/dashboard/src/lib/loyalty-configuration.ts':'bb5a3708c442e8c9e353a2c1389a066115f3c3c8468e8eed38bdb089e5cf3d19'
});
export const governanceSourceHash=text=>createHash('sha256').update(text.replaceAll('\r\n','\n')).digest('hex');
export function governancePublishedSourceHash(path,actual) {
 const reviewed=ENGAGEMENT_GOVERNANCE_CHANGED[path];
 if(!reviewed)return actual;
 assert.equal(actual,reviewed.after,path+' exact reviewed governance increment');
 return reviewed.before;
}
export function assertGovernanceInventory(actual,historicalExpected) {
 assert.equal(Object.keys(historicalExpected).length,507,'all 507 historical paths remain independently pinned');
 for(const path of Object.keys(ENGAGEMENT_GOVERNANCE_CHANGED))assert.ok(Object.hasOwn(historicalExpected,path),'known changed origin '+path);
 for(const path of Object.keys(ENGAGEMENT_GOVERNANCE_ADDED))assert.ok(!Object.hasOwn(historicalExpected,path),'explicitly new path '+path);
 assert.deepEqual([...actual].sort(),[...Object.keys(historicalExpected),...Object.keys(ENGAGEMENT_GOVERNANCE_ADDED)].sort(),'all historical and exactly four approved new sources');
}
export function assertGovernanceAddedSource(path,actual) {
 assert.ok(Object.hasOwn(ENGAGEMENT_GOVERNANCE_ADDED,path),'known governance source addition');
 assert.equal(actual,ENGAGEMENT_GOVERNANCE_ADDED[path],path+' exact reviewed governance addition');
}
