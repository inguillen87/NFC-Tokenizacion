import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LOYALTY_OVERVIEW_RECOVERY_REVIEWED_SOURCES} from './loyalty-overview-recovery-reviewed-sources.mjs';
import {readHistoricalBaseline} from './tenant-sync-reviewed-sources.mjs';

// The Page origin is the reviewed, uncommitted D5 snapshot, not a published SHA.
// The second origin is independently pinned by the immutable historical baseline.
export const LOYALTY_OVERVIEW_READINESS_PUBLISHED_BASE='3eb3e8dccc09101bd429c29bb1d19efbf9481ae3';
export const LOYALTY_OVERVIEW_READINESS_D5_SNAPSHOT='9367c73574de473c48b54e1f27b3c7563b7a1a98460d61b2261ad2cce23f5001';
export const LOYALTY_OVERVIEW_READINESS_REVIEWED_SOURCES=Object.freeze({
 'apps/dashboard/src/app/(app)/loyalty/overview/page.tsx':Object.freeze({
  before:'a789520e867de340796d37b0898ca5d93cac87661e141eb5afcfc64ce0263628',
  after:'e41b68835d3de5ce817502315a0b8df93a18bdbe16b091d8d0ff84aaffe0ead5',
 }),
 'apps/dashboard/src/lib/consumer-network-overview-truth.ts':Object.freeze({
  before:'252baaa66ca1b6a8726ef1b36e46061e078ace8178791c1bdc631aaaa497ef90',
  after:'e424c61acbbfc5dfd1c45d68d5b497b1bf64dad5895176d3e3696c59a286afa5',
 }),
});
// Copy-only successor of Dashboard556; historical readiness pins stay unchanged.
export const LOYALTY_OVERVIEW_METRIC_COPY_SOURCE=Object.freeze({
 path:'apps/dashboard/src/app/(app)/loyalty/overview/page.tsx',
 base:'34cbe641978f7525a8c832de60a23c80d6e42315',
 before:'e41b68835d3de5ce817502315a0b8df93a18bdbe16b091d8d0ff84aaffe0ead5',
 after:'280f1a9f5b964734a2027a734056eb32e6b2b3dfa3954f490410aa049a9002db',
});
const baseline=readHistoricalBaseline('release-convergence',readFileSync(new URL('../fixtures/release-convergence-baseline.json',import.meta.url),'utf8'));
function independentOrigin(path){
 if(path==='apps/dashboard/src/app/(app)/loyalty/overview/page.tsx')return LOYALTY_OVERVIEW_RECOVERY_REVIEWED_SOURCES[path]?.after;
 assert(Object.hasOwn(baseline.expected,path),path+' has an independent historical origin');
 return baseline.expected[path];
}
export function loyaltyOverviewReadinessPriorHash(path,actual){
 if(!Object.hasOwn(LOYALTY_OVERVIEW_READINESS_REVIEWED_SOURCES,path))return actual;
 const pin=LOYALTY_OVERVIEW_READINESS_REVIEWED_SOURCES[path];
 assert.equal(pin.before,independentOrigin(path),path+' independently pinned preceding overview source');
 if(path===LOYALTY_OVERVIEW_METRIC_COPY_SOURCE.path&&actual===LOYALTY_OVERVIEW_METRIC_COPY_SOURCE.after){
  assert.equal(LOYALTY_OVERVIEW_METRIC_COPY_SOURCE.before,pin.after,path+' exact preceding Page before metric-copy successor');
  actual=LOYALTY_OVERVIEW_METRIC_COPY_SOURCE.before;
 }
 assert.equal(actual,pin.after,path+' exact reviewed overview readiness increment');
 return pin.before;
}
