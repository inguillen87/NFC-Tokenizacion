import assert from 'node:assert/strict';
import {REWARD_PROGRAM_CONTEXT_REVIEWED_SOURCES} from './reward-program-context-reviewed-sources.mjs';
import {ENGAGEMENT_GOVERNANCE_CHANGED} from './engagement-governance-reviewed-sources.mjs';

// Only the exact reviewed R7 successor is projected to the independently pinned
// D531 origin. Historical fixtures and every previous overlay remain unchanged.
export const REWARD_DIALOG_SOURCE_BASE='a38a432e96cea93df53f1fca6bd58335b42a290a';
const rewardsPagePath='apps/dashboard/src/app/(app)/loyalty/rewards/page.tsx';
const rewardsClientPath='apps/dashboard/src/app/(app)/loyalty/rewards/rewards-client.tsx';
const voucherFeedbackPath='apps/dashboard/src/app/(app)/loyalty/campaigns/loyalty-campaigns-client.tsx';
const voucherFeedbackBefore='edd60aecfa61e88535da081576fa42804d46d1958a732f07bcee7cb66eb2f13f';
const voucherFeedbackAfter='6c49b6430415aeba6da237095da9461b80c985b4c62f9ade191261df514d74e5';
const rewardStockDisplayAfter='9039f7d58c85752f1e431c0714965078ece8b4a604ebb01d743499c4381b2099';
const rewardDialogAppearanceAfter='f09a91e2e26e57e7b7b8d9f1f8caf66676a7d35f78aa2104c57322d514d30404';
const rewardDialogActionsAfter='e141130ad5801a345a8b2b1410648a908a9ad727be38c4b7e5c442e5ff8a9719';
const rewardCatalogSources=Object.freeze({
 [rewardsPagePath]:Object.freeze({
  before:'211ddba0d83e18aa6e60dc86ffd57b718e0533f67c760e88cfd6f577c92ca158',
  after:'61ff3c475ce622ce90eac8f697a3332ee225af67c6981c2c6df1e488b3cd2b00',
 }),
 [rewardsClientPath]:Object.freeze({
  before:rewardStockDisplayAfter,
  after:'9c1af29f8e415cee6c4c6084a650af70682e0ee413215d9eb89cdd784715ffcc',
 }),
});
const rewardCompanyIdentitySources=Object.freeze({
 [rewardsPagePath]:Object.freeze({
  before:rewardCatalogSources[rewardsPagePath].after,
  after:'930d1c5a52d1eb927337bc2809e786899409a23b529010a24bc422c8580d5669',
 }),
 [rewardsClientPath]:Object.freeze({
  before:rewardDialogActionsAfter,
  after:'1c5c6f220bc25b6200a3701af3aacdcf0c66ed63fdb199b051f1b05e335c91c5',
 }),
});
export const REWARD_DIALOG_REVIEWED_SOURCES=Object.freeze({
 'apps/dashboard/src/app/(app)/loyalty/rewards/rewards-client.tsx':Object.freeze({
  before:'68e5c9f6d4ab1a4f707ee3a3cb650ec6632063b0721e8a644c53102231dff221',
  after:'d804252a53d123b9b191ccf9cef73eccf3ea2ba47005a4e67599fa3187b65ce4',
 }),
 'apps/dashboard/src/lib/permission-policy.ts':Object.freeze({
  before:'45472db8d700e049945cc3322cb701599a3dac5b2e3762c60521e32394df8962',
  after:'57eab8597c1be95e611f41590e9008aeb957b6e83423384501ebecbe574951d3',
 }),
});
function independentOrigin(path){
 return path==='apps/dashboard/src/app/(app)/loyalty/rewards/rewards-client.tsx'
  ? REWARD_PROGRAM_CONTEXT_REVIEWED_SOURCES[path]?.after
  : ENGAGEMENT_GOVERNANCE_CHANGED[path]?.after;
}
export function rewardDialogHistoricalPriorHash(path,actual){
 if(!Object.hasOwn(REWARD_DIALOG_REVIEWED_SOURCES,path))return actual;
 const pin=REWARD_DIALOG_REVIEWED_SOURCES[path];
 assert.equal(pin.before,independentOrigin(path),path+' independently pinned D531 origin');
 assert.equal(actual,pin.after,path+' exact reviewed reward-dialog increment');
 return pin.before;
}

export function rewardStockDisplayHistoricalPriorHash(path,actual){
 if(path!==rewardsClientPath)return rewardDialogHistoricalPriorHash(path,actual);
 assert.equal(actual,rewardStockDisplayAfter,path+' exact reviewed reward-stock display');
 return rewardDialogHistoricalPriorHash(path,REWARD_DIALOG_REVIEWED_SOURCES[path].after);
}

export function rewardCatalogHistoricalPriorHash(path,actual){
 if(!Object.hasOwn(rewardCatalogSources,path))return rewardStockDisplayHistoricalPriorHash(path,actual);
 const pin=rewardCatalogSources[path];
 assert.equal(actual,pin.after,path+' exact reviewed reward catalog');
 return rewardStockDisplayHistoricalPriorHash(path,pin.before);
}

export function rewardDialogAppearanceHistoricalPriorHash(path,actual){
 if(path!==rewardsClientPath)return rewardCatalogHistoricalPriorHash(path,actual);
 assert.equal(actual,rewardDialogAppearanceAfter,path+' exact reviewed reward dialog appearance');
 return rewardCatalogHistoricalPriorHash(path,rewardCatalogSources[path].after);
}

export function rewardDialogActionsHistoricalPriorHash(path,actual){
 if(path!==rewardsClientPath)return rewardDialogAppearanceHistoricalPriorHash(path,actual);
 assert.equal(actual,rewardDialogActionsAfter,path+' exact reviewed reward dialog actions');
 return rewardDialogAppearanceHistoricalPriorHash(path,rewardDialogAppearanceAfter);
}

export function rewardDialogPriorHash(path,actual){
 if(path===voucherFeedbackPath){
  assert.equal(actual,voucherFeedbackAfter,path+' exact reviewed voucher feedback');
  return voucherFeedbackBefore;
 }
 if(!Object.hasOwn(rewardCompanyIdentitySources,path))return rewardDialogActionsHistoricalPriorHash(path,actual);
 const pin=rewardCompanyIdentitySources[path];
 assert.equal(actual,pin.after,path+' exact reviewed reward company identity');
 return rewardDialogActionsHistoricalPriorHash(path,pin.before);
}
