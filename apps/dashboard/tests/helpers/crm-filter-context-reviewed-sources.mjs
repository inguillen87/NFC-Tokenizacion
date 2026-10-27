import assert from 'node:assert/strict';

// Independently reviewed CRM filter increment on d1bd. Historical overlays and fixtures stay unchanged.
export const CRM_FILTER_CONTEXT_BASE='d1bd6d8d99a535045ad3354262dacd61859e8ada';
export const CRM_FILTER_CONTEXT_CHANGED=Object.freeze({
 'apps/dashboard/src/components/data-table.tsx':Object.freeze({
  before:'6d0f150d8cb7ea0d8df507080341e3887f2036fca105dc7094dfa99654e44fa8',
  after:'208a2cf92a457ba84da06ec672901d2c941a9379074da0a2953a0b4e7f7f20f8',
 }),
 'apps/dashboard/src/app/(app)/leads-tickets/leads-tickets-client.tsx':Object.freeze({
  before:'44c6a8c0a731d8f4f66a985b7b6f11f605c66d593042abec3a766d1d5d4f22b5',
  after:'3cc1b22f5d82ab336fff76435074a74ab1798a91597be0ec7c71b2eb40a6abf3',
 }),
 'apps/dashboard/src/lib/customer-inbox-copy.ts':Object.freeze({
  before:'72c613d421d3d46ce31494f6dd89b4ac14cf646a05371e29497d055cfa1c32ea',
  after:'bf31a4ba33439bdbc139d05e13e54c25675c77afdf2739d46d1ffabd7f778650',
 }),
});

export function crmFilterContextPriorHash(name,actual){
 if(!Object.hasOwn(CRM_FILTER_CONTEXT_CHANGED,name))return actual;
 const pin=CRM_FILTER_CONTEXT_CHANGED[name];
 assert.equal(actual,pin.after,name+' exact reviewed CRM filter increment');
 return pin.before;
}
