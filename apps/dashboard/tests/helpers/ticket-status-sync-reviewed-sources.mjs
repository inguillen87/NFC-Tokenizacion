import assert from 'node:assert/strict';
import {PHYSICAL_TAP_REVIEWED_SOURCES} from './physical-tap-reviewed-sources.mjs';
import {crmOrderRequestPriorInventory} from './crm-order-request-reviewed-sources.mjs';

export const TICKET_STATUS_SYNC_SOURCE_BASE='e3f14a0bcd4aace7cf66b7944d59427a16497bc4';
export const TICKET_STATUS_SYNC_REVIEWED_SOURCES=Object.freeze({
 'apps/dashboard/src/app/(app)/leads-tickets/leads-tickets-client.tsx':Object.freeze({origin:'4ceade4bd70619c54195436c736daa9f953be6f31d3630ba048d1cb28e92d4f8',after:'95c8b470a0524f94974820ddda512ab172a651ab10a8792fef7c47955f4a0638',historical:'8ba56352e0d8990c6bd67542ff85611c9c9123bc9f51868ea3d1133668f3f286'}),
 'apps/dashboard/src/components/ticket-reference-lookup.tsx':Object.freeze({origin:'de22ac1080fead204effb00ebab81e8d57f1ae13f1f806867ff8ca995f607f7a',after:'c543a7348f1d323ca20f9f73c01a72fd933990acd06d3335cbac200316d583d9',historical:'de22ac1080fead204effb00ebab81e8d57f1ae13f1f806867ff8ca995f607f7a'}),
 'apps/dashboard/src/components/ticket-workflow.tsx':Object.freeze({origin:'5d31fb031acede5ea111ef7f5a834252febec603f78bef440ff8b44139d22782',after:'cda3995fb866566fdae58d424f9b2800b18113ac9932becadbf8f5cf2555cc77',historical:'5d31fb031acede5ea111ef7f5a834252febec603f78bef440ff8b44139d22782'}),
 'apps/dashboard/src/lib/ticket-workflow-copy.ts':Object.freeze({origin:'e5a35bfd85d99aee8abb5fff984a9bba93d9cc41e1f05fb3cc304b3f50cb991c',after:'d339f277533f2aec6d47dd1a04194ca4a4ee2b8078098942dbaf89f92a951c76',historical:'e5a35bfd85d99aee8abb5fff984a9bba93d9cc41e1f05fb3cc304b3f50cb991c'}),
});
export const TICKET_STATUS_SYNC_ADDED=Object.freeze({
 'apps/dashboard/src/lib/ticket-status-reconciliation.ts':'a132b1e846f996c6edaf444fe9a25e3850cf41cfc46771805244073e14440d2a',
});

export function ticketStatusSyncPublishedSourceHash(path,actual,expectedHistoricalOrigin){
 if(!Object.hasOwn(TICKET_STATUS_SYNC_REVIEWED_SOURCES,path))return actual;
 const reviewed=TICKET_STATUS_SYNC_REVIEWED_SOURCES[path];
 assert.equal(expectedHistoricalOrigin,reviewed.historical,path+' independently pinned historical origin');
 if(Object.hasOwn(PHYSICAL_TAP_REVIEWED_SOURCES,path)){
  assert.equal(reviewed.origin,PHYSICAL_TAP_REVIEWED_SOURCES[path].after,path+' independently pinned physical TAP prior');
 }else{
  assert.equal(reviewed.origin,expectedHistoricalOrigin,path+' independently pinned published prior');
 }
 assert.equal(actual,reviewed.after,path+' exact reviewed ticket-status successor');
 return reviewed.origin;
}

export function ticketStatusSyncPriorInventory(actual,historicalExpected){
 for(const [path,pins]of Object.entries(TICKET_STATUS_SYNC_REVIEWED_SOURCES)){
  assert.ok(Object.hasOwn(historicalExpected,path),'known changed ticket-status origin '+path);
  assert.equal(historicalExpected[path],pins.historical,path+' unchanged historical origin');
 }
 for(const path of Object.keys(TICKET_STATUS_SYNC_ADDED)){
  assert.ok(!Object.hasOwn(historicalExpected,path),'explicitly new ticket-status source '+path);
  assert.equal(actual.filter(value=>value===path).length,1,path+' exactly one new ticket-status source');
 }
 const prior=actual.filter(path=>!Object.hasOwn(TICKET_STATUS_SYNC_ADDED,path));
 // Retain the complete old gate, including unknown, missing and duplicate paths.
 crmOrderRequestPriorInventory(prior,historicalExpected);
 return prior;
}

export function assertTicketStatusSyncAddedSource(path,actual){
 assert.ok(Object.hasOwn(TICKET_STATUS_SYNC_ADDED,path),'known ticket-status source addition');
 assert.equal(actual,TICKET_STATUS_SYNC_ADDED[path],path+' exact reviewed ticket-status addition');
}
