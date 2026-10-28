import assert from 'node:assert/strict';

// Reviewed confirmation-focus successor of c372. Historical overlays/fixtures remain unchanged.
export const CATALOG_CONFIRMATION_BASE='c372b3bed96a405834dac075060790b8b0a31329';
export const CATALOG_CONFIRMATION_CHANGED=Object.freeze({
 'apps/dashboard/src/components/tenant-marketplace-workspace.tsx':Object.freeze({
  before:'e9f13ecae3aefe8f1ac93d56e749140bd94c9ff7e4bc7126c80fbda72f310152',
  after:'6f4c7b541eb663acfd6ba0d2c0a948eace1220e64d4952677ff612baa64b055d',
 }),
 'apps/dashboard/src/components/tenant-marketplace-workspace.module.css':Object.freeze({
  before:'dec82d79091efd682236a6a34decb44490d144957856341dbfbe93b130c19d2c',
  after:'48db2926a9ff61f394b3d2817f9d0f265aa12691420061e240df7b458789fd04',
 }),
});

export function catalogConfirmationPriorHash(name,actual){
 if(!Object.hasOwn(CATALOG_CONFIRMATION_CHANGED,name))return actual;
 const pin=CATALOG_CONFIRMATION_CHANGED[name];
 assert.equal(actual,pin.after,name+' exact reviewed catalog confirmation increment');
 return pin.before;
}
