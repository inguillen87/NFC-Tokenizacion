import assert from 'node:assert/strict';
import {CRM_ORDER_REQUEST_REVIEWED_SOURCES} from './crm-order-request-reviewed-sources.mjs';

// Exact three-path successor on published 3e25. Historical fixtures and overlays stay intact.
export const PHYSICAL_TAP_SOURCE_BASE='3e25d60ac2de10faeeab11e2ae6fec56926bc9ea';
export const PHYSICAL_TAP_REVIEWED_SOURCES=Object.freeze({
 'apps/dashboard/src/app/(app)/leads-tickets/leads-tickets-client.tsx':Object.freeze({origin:'ccc9792a81cdf0b02a6e4b3ff97bf974d9b912be49f6b48b56e012813d2be594',after:'4ceade4bd70619c54195436c736daa9f953be6f31d3630ba048d1cb28e92d4f8'}),
 'apps/dashboard/src/components/customer-member-timeline.tsx':Object.freeze({origin:'78dc6c2762bf15ae9dc77a7a8ba933bf56436db1c355a7ccb7ef304786d6db29',after:'e50798370e09f0fd8d788d3ded2fc9220a02f62dbc9694e849ef8239ccdf5569'}),
 'apps/dashboard/src/components/physical-taps-command-center.tsx':Object.freeze({origin:'189ecc9db526a2e96540ff9d5f42f2aba14044cbda7fb22be197fc3bbb194d58',after:'4bda9a17d5d5fd61b86240d93cc28dcd17ec51c0d64090e84947428428249133'}),
});

export function physicalTapPublishedSourceHash(path,actual,expectedHistoricalOrigin){
 if(!Object.hasOwn(PHYSICAL_TAP_REVIEWED_SOURCES,path))return actual;
 const reviewed=PHYSICAL_TAP_REVIEWED_SOURCES[path];
 if(Object.hasOwn(CRM_ORDER_REQUEST_REVIEWED_SOURCES,path)){
  const prior=CRM_ORDER_REQUEST_REVIEWED_SOURCES[path];
  assert.equal(expectedHistoricalOrigin,prior.origin,path+' independently pinned historical CRM origin');
  assert.equal(reviewed.origin,prior.after,path+' independently pinned published CRM successor');
 }else{
  assert.equal(reviewed.origin,expectedHistoricalOrigin,path+' independently pinned historical origin');
 }
 assert.equal(actual,reviewed.after,path+' exact reviewed physical TAP successor');
 return reviewed.origin;
}
