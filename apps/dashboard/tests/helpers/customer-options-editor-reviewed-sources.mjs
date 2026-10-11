import assert from 'node:assert/strict';
import {ENGAGEMENT_GOVERNANCE_ADDED} from './engagement-governance-reviewed-sources.mjs';

// Exact test-only increment from the previously published governance addition.
// Historical helpers and fixtures keep their original bytes and authority.
export const CUSTOMER_OPTIONS_EDITOR_SOURCE_BASE='f94f8020421bf07b4269512ac7d595db7652232f';
export const CUSTOMER_OPTIONS_EDITOR_SOURCE_HEAD='766940167feccda90742ce9a953d3ba6fed4c3cc';
export const CUSTOMER_OPTIONS_EDITOR_CHANGED=Object.freeze({
 'apps/dashboard/src/components/loyalty-configuration-workspace.tsx':Object.freeze({before:'433842a6ee2dba427f40e211faaa9a633ffde253e2ee01638c77ec685414e8b4',after:'df14f17732a26533892d85f8016b77e6498d8c4873eecc08d6c6188bf10ff082'})
});
export function customerOptionsPriorGovernanceHash(path,actual) {
 const reviewed=Object.hasOwn(CUSTOMER_OPTIONS_EDITOR_CHANGED,path)?CUSTOMER_OPTIONS_EDITOR_CHANGED[path]:null;
 if(!reviewed)return actual;
 assert.equal(reviewed.before,ENGAGEMENT_GOVERNANCE_ADDED[path],path+' exact historical customer-options origin');
 assert.equal(actual,reviewed.after,path+' exact reviewed customer-options editor increment');
 return reviewed.before;
}
