import assert from 'node:assert/strict';
import {ENGAGEMENT_GOVERNANCE_CHANGED,ENGAGEMENT_GOVERNANCE_ADDED} from './engagement-governance-reviewed-sources.mjs';
import {TENANT_SYNC_REVIEWED_SOURCES} from './tenant-sync-reviewed-sources.mjs';
import {REWARD_NOTICE_ADDED} from './reward-notice-reviewed-sources.mjs';

// Successor on the exact published 24dc source; all historical fixtures and prior overlays remain unchanged.
export const REWARD_PROGRAM_CONTEXT_SOURCE_BASE='24dc09f33c491b8552615b1c1db9da0695103728';
export const REWARD_PROGRAM_CONTEXT_REVIEWED_SOURCES=Object.freeze({
 'apps/dashboard/src/app/(app)/loyalty/overview/page.tsx':Object.freeze({origin:'c257fcd8b19e9c5c9a93067bbdbde828d4e8a1c2a2dc8d5995fd8c24416f078b',after:'6d57395ccb0c6da0f3da6be971567ded7ea60f8ced2322fdad0b662c952f7b5a'}),
 'apps/dashboard/src/app/(app)/loyalty/rewards/rewards-client.tsx':Object.freeze({origin:'dd011e3af39d7115a1b2f2e8c841234819dbc8d938587eb404bbfab1fe113276',after:'68e5c9f6d4ab1a4f707ee3a3cb650ec6632063b0721e8a644c53102231dff221'}),
 'apps/dashboard/src/app/(app)/loyalty/configuration/page.tsx':Object.freeze({origin:'3db60ccf23c784ecf43c435620a5bd1e151f25810ac0923b85a5fabaeb557e58',after:'989a35d9488150ebf4c6a974dabe48ba3105296389fbf32172f1fb7710d1f8b4'}),
 'apps/dashboard/src/components/loyalty-configuration-workspace.tsx':Object.freeze({origin:'433842a6ee2dba427f40e211faaa9a633ffde253e2ee01638c77ec685414e8b4',after:'ab27eb9176b3adee08f7e89c7367d0b6e6867f1e19504df8291778c03bd78f4f'}),
 'apps/dashboard/src/components/loyalty-configuration-workspace.module.css':Object.freeze({origin:'13a6dd8794876c4b83d36916a902139504d92c580b22ef9815319a5eebba2244',after:'f403fe15bbd8de88b155b4983ed59b3a3225af24481f06b2e2126607b68d509f'}),
 'apps/dashboard/src/lib/loyalty-configuration.ts':Object.freeze({origin:'bb5a3708c442e8c9e353a2c1389a066115f3c3c8468e8eed38bdb089e5cf3d19',after:'127a5e941fe387bbf3ccd80f72ef1101ff74e06cefee5e5cb411fc707467473f'}),
 'apps/dashboard/src/components/reward-reservation-notice.tsx':Object.freeze({origin:'f03e30dde984f5cc936f6c9dd1b7884f5f4f97157c71d3074d2f9d0c13c52c71',after:'ea29f78b33a3d0d675517d31f1f004388dbe956e4a949e5c8557d4a1fe50cbdc'}),
 'apps/dashboard/src/lib/reward-reservation-notices.ts':Object.freeze({origin:'30156418ebb331177b7c8453ff279eb4219086d7852212ef7e600b2fdbe6ccba',after:'472ddf256ab9244a35fa935ddf05b56e9a0f65df3b9a6314d1eecab703ae457d'})
});

function publishedOrigin(path){
 const origins=[ENGAGEMENT_GOVERNANCE_CHANGED[path]?.after,ENGAGEMENT_GOVERNANCE_ADDED[path],TENANT_SYNC_REVIEWED_SOURCES[path]?.after,REWARD_NOTICE_ADDED[path]].filter(value=>value!==undefined);
 assert.equal(origins.length,1,path+' has one independently pinned published origin');
 return origins[0];
}

export function rewardProgramContextPublishedSourceHash(path,actual){
 if(!Object.hasOwn(REWARD_PROGRAM_CONTEXT_REVIEWED_SOURCES,path))return actual;
 const reviewed=REWARD_PROGRAM_CONTEXT_REVIEWED_SOURCES[path];
 assert.equal(reviewed.origin,publishedOrigin(path),path+' exact published 24dc origin');
 assert.equal(actual,reviewed.after,path+' exact reviewed program-context successor');
 return reviewed.origin;
}
