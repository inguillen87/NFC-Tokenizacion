import assert from 'node:assert/strict';
import {ENGAGEMENT_GOVERNANCE_ADDED} from './engagement-governance-reviewed-sources.mjs';
import {TENANT_MARKETPLACE_ADDED} from './tenant-marketplace-reviewed-sources.mjs';

// Additive read-only disclosure reviewed on the published f94 source. Prior fixtures and overlays remain intact.
export const REWARD_NOTICE_SOURCE_BASE='f94f8020421bf07b4269512ac7d595db7652232f';
export const REWARD_NOTICE_ADDED=Object.freeze({
 'apps/dashboard/src/components/reward-reservation-notice.tsx':'f03e30dde984f5cc936f6c9dd1b7884f5f4f97157c71d3074d2f9d0c13c52c71',
 'apps/dashboard/src/components/reward-reservation-notice.module.css':'0ee19f8927c208483e7091eb7b13274417a92a3695526f34baa16df9b8dc0fd3',
 'apps/dashboard/src/lib/reward-reservation-notices.ts':'30156418ebb331177b7c8453ff279eb4219086d7852212ef7e600b2fdbe6ccba'
});
export function rewardNoticePriorInventory(actual,historicalExpected) {
 assert.equal(Object.keys(historicalExpected).length,507,'all 507 historical paths remain independently pinned');
 const priorAdded=[...Object.keys(ENGAGEMENT_GOVERNANCE_ADDED),...Object.keys(TENANT_MARKETPLACE_ADDED)];
 for(const path of Object.keys(REWARD_NOTICE_ADDED)){
  assert.ok(!Object.hasOwn(historicalExpected,path),'explicitly new reward notice path '+path);
  assert.ok(!priorAdded.includes(path),'reward notice cannot replace a prior addition '+path);
 }
 assert.deepEqual([...actual].sort(),[...Object.keys(historicalExpected),...priorAdded,...Object.keys(REWARD_NOTICE_ADDED)].sort(),'all historical sources, prior additions and exactly three reward notice additions');
 return actual.filter(path=>!Object.hasOwn(REWARD_NOTICE_ADDED,path));
}
export function assertRewardNoticeAddedSource(path,actual) {
 assert.ok(Object.hasOwn(REWARD_NOTICE_ADDED,path),'known reward notice source addition');
 assert.equal(actual,REWARD_NOTICE_ADDED[path],path+' exact reviewed reward notice addition');
}
