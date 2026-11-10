import assert from 'node:assert/strict';
import {REWARD_PROGRAM_CONTEXT_REVIEWED_SOURCES} from './reward-program-context-reviewed-sources.mjs';

// Exact overview successor on the published 3eb source. No prior helper or
// historical fixture changes: this one admitted source returns its pinned origin.
export const LOYALTY_OVERVIEW_RECOVERY_SOURCE_BASE='3eb3e8dccc09101bd429c29bb1d19efbf9481ae3';
export const LOYALTY_OVERVIEW_RECOVERY_REVIEWED_SOURCES=Object.freeze({
 'apps/dashboard/src/app/(app)/loyalty/overview/page.tsx':Object.freeze({
  before:'6d57395ccb0c6da0f3da6be971567ded7ea60f8ced2322fdad0b662c952f7b5a',
  after:'a789520e867de340796d37b0898ca5d93cac87661e141eb5afcfc64ce0263628',
 }),
});

export function loyaltyOverviewRecoveryPriorHash(path,actual){
 if(!Object.hasOwn(LOYALTY_OVERVIEW_RECOVERY_REVIEWED_SOURCES,path))return actual;
 const pin=LOYALTY_OVERVIEW_RECOVERY_REVIEWED_SOURCES[path];
 assert.equal(pin.before,REWARD_PROGRAM_CONTEXT_REVIEWED_SOURCES[path]?.after,path+' independently pinned published overview origin');
 assert.equal(actual,pin.after,path+' exact reviewed overview recovery increment');
 return pin.before;
}
