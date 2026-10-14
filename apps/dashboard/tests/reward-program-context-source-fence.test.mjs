import assert from 'node:assert/strict';
import test from 'node:test';
import {REWARD_PROGRAM_CONTEXT_SOURCE_BASE,REWARD_PROGRAM_CONTEXT_REVIEWED_SOURCES,rewardProgramContextPublishedSourceHash} from './helpers/reward-program-context-reviewed-sources.mjs';
import {TENANT_SYNC_REVIEWED_SOURCES,tenantSyncHistoricalSourceHash,sourceHash} from './helpers/tenant-sync-reviewed-sources.mjs';

const paths=[
 'apps/dashboard/src/app/(app)/loyalty/overview/page.tsx',
 'apps/dashboard/src/app/(app)/loyalty/rewards/rewards-client.tsx',
 'apps/dashboard/src/app/(app)/loyalty/configuration/page.tsx',
 'apps/dashboard/src/components/loyalty-configuration-workspace.tsx',
 'apps/dashboard/src/components/loyalty-configuration-workspace.module.css',
 'apps/dashboard/src/lib/loyalty-configuration.ts',
 'apps/dashboard/src/components/reward-reservation-notice.tsx',
 'apps/dashboard/src/lib/reward-reservation-notices.ts'
];

test('program-context overlay is limited to eight reviewed paths on the published 24dc source',()=>{
 assert.equal(REWARD_PROGRAM_CONTEXT_SOURCE_BASE,'24dc09f33c491b8552615b1c1db9da0695103728');
 assert.deepEqual(Object.keys(REWARD_PROGRAM_CONTEXT_REVIEWED_SOURCES).sort(),paths.sort());
});

test('each successor returns its independently pinned prior origin for the original overlays',()=>{
 for(const [path,pins]of Object.entries(REWARD_PROGRAM_CONTEXT_REVIEWED_SOURCES))assert.equal(rewardProgramContextPublishedSourceHash(path,pins.after),pins.origin);
});

test('altered sources and an unchanged old source cannot masquerade as the reviewed successor',()=>{
 for(const [path,pins]of Object.entries(REWARD_PROGRAM_CONTEXT_REVIEWED_SOURCES)){
  assert.throws(()=>rewardProgramContextPublishedSourceHash(path,sourceHash('unreviewed mutation')),/exact reviewed/);
  assert.throws(()=>rewardProgramContextPublishedSourceHash(path,pins.origin),/exact reviewed/);
 }
});

test('unreviewed paths pass through unchanged and still fail their existing immutable-origin fence',()=>{
 const path='apps/dashboard/src/app/sign-in/[[...sign-in]]/page.tsx';
 const changed=sourceHash('unreviewed sign-in mutation');
 assert.equal(rewardProgramContextPublishedSourceHash(path,changed),changed);
 assert.throws(()=>tenantSyncHistoricalSourceHash(path,rewardProgramContextPublishedSourceHash(path,changed),TENANT_SYNC_REVIEWED_SOURCES[path].before),/exact reviewed increment/);
 assert.equal(rewardProgramContextPublishedSourceHash('apps/dashboard/src/unreviewed-addition.ts',changed),changed);
 for(const path of ['__proto__','constructor','toString'])assert.equal(rewardProgramContextPublishedSourceHash(path,changed),changed);
});
