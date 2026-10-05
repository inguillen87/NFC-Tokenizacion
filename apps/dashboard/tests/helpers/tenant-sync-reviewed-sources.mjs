import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// Reviewed increment on this exact production baseline. Historical fixtures stay intact.
export const TENANT_SYNC_SOURCE_BASE='4d976d385e75d1e9139ebc44f5ba820eaaebb591';
export const TENANT_SYNC_REVIEWED_SOURCES=Object.freeze({
 'apps/dashboard/src/app/(app)/loyalty/rewards/rewards-client.tsx':Object.freeze({
  before:'a30a8a28b0341cc679dd01c1ddb00f4c16b513a7937732251ad26d405f8a2c18',
  after:'8863655cf2f4466b79f24a89e87cde85b1d9ab4636d8e6ccd2b2f59deae6e5ba',
  reason:'Persisted reward identity and flags; consumed-stock preservation; accessible recoverable form.'
 }),
 'apps/dashboard/src/lib/dashboard-release.ts':Object.freeze({
  before:'8b5ec8e8c4827ab5a1f3aac3ed94e3129ad10dabdfc6e683e3b9725e3676fa2e',
  after:'c54a573641e1803b2d915980007348cd5f4747fad23e1555109d922c3cad89ab',
  reason:'Align visible release/date and localized benefit summary with the committed public marker.'
 })
});
const historicalBaselineHashes=Object.freeze({
 'release-convergence':'3a225ceeb7db72a71bd445fc1d554198efcac78a90d4bccf40bcbcba7b0305df',
 'runtime-console':'363038c6fa286fd5a7e452ad0a2b7ea87511efa9b7a73cf9d276c9a9f58fc60f'
});
export const sourceHash=text=>createHash('sha256').update(text.replaceAll('\r\n','\n')).digest('hex');
export function readHistoricalBaseline(kind,text){
 assert.ok(Object.hasOwn(historicalBaselineHashes,kind),'known historical baseline');
 assert.equal(sourceHash(text),historicalBaselineHashes[kind],kind+' historical fixture remains immutable');
 return JSON.parse(text);
}
export function tenantSyncHistoricalSourceHash(path,actual,expectedBefore){
 const reviewed=TENANT_SYNC_REVIEWED_SOURCES[path];
 if(!reviewed)return actual;
 assert.equal(reviewed.before,expectedBefore,path+' reviewed origin');
 assert.equal(actual,reviewed.after,path+' exact reviewed increment');
 return reviewed.before;
}
