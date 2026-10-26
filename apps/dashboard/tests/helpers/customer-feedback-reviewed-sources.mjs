import assert from 'node:assert/strict';
// Independently reviewed UX increment on the published 60d source. Historical fixtures remain unchanged.
export const CUSTOMER_FEEDBACK_BASE='60d6827b890a332fb0269146a9eca09997c9dfd0';
export const CUSTOMER_FEEDBACK_CHANGED=Object.freeze({
  "apps/dashboard/src/app/(app)/events/page.tsx": {
    "before": "b3477570ae24cedb9dbf8b802bb842bb6813a64dc85aede15a2c4d3c5339f1c6",
    "after": "acc33759fb8a4d56cf1e96615fa0bf775264316f58537c1b8342504ef3fec7e6"
  },
  "apps/dashboard/src/app/(app)/experiences/page.tsx": {
    "before": "4e11655297050125b467bc13bcf27cb2f0ad6c20cf7dd9c90e2ba1717773c04d",
    "after": "78308d69e7674e1c8e182ee8c753a542a0f2a13020225f0699d06f48ec911dc2"
  },
  "apps/dashboard/src/app/(app)/leads-tickets/leads-tickets-client.tsx": {
    "before": "95c8b470a0524f94974820ddda512ab172a651ab10a8792fef7c47955f4a0638",
    "after": "44c6a8c0a731d8f4f66a985b7b6f11f605c66d593042abec3a766d1d5d4f22b5"
  },
  "apps/dashboard/src/app/(app)/logistics/shipments/page.tsx": {
    "before": "30b03f3757d7125e0aa9b72cdcdceb70dda90ba9a2c644bee802851c47b97ef9",
    "after": "76140e0c62e763a912bef945d3294c89dca2138adad1837280f3e69d31034ca1"
  },
  "apps/dashboard/src/app/(app)/loyalty/page.tsx": {
    "before": "c9be7ca5b31580d4bfce54434c7863660bc1a6096b7a76fad5a9a95a2212241a",
    "after": "404ed711c6f2920567405392cc65d1a321be479a5c0a44addae7652688bbf1bf"
  },
  "apps/dashboard/src/app/(app)/resellers/page.tsx": {
    "before": "ece898ab35b2221970e84693b4df498db0f5f794a83284c3b1e74452cbe26ae8",
    "after": "57f77db4d4a649a08b099254bb0f8d9ec412f92848bb1eb3d2d911318da88434"
  },
  "apps/dashboard/src/app/(app)/subscriptions/page.tsx": {
    "before": "4c0d04f62c4db69eef963d7cfb3db79ce823c42b3cd6bb97a659db758bc608ff",
    "after": "8c27a92d6cfeda86d16121a6a29e4413a76471276c7b1969dbac72e8ec177886"
  },
  "apps/dashboard/src/app/(app)/supplier-orders/[orderId]/page.tsx": {
    "before": "e404683d8276dc0ed2cb50bf25025e547cc5753eafe281adcb1b99e7eee53cd1",
    "after": "91bc56057fd8f71e477b8da8651e3382f63dae6738f3cd2ac00e025eb9bc5a3b"
  },
  "apps/dashboard/src/app/(app)/supplier-orders/page.tsx": {
    "before": "d79036561103b90f8573a7174f4bc2506c1bc8becd1fa833dd0ed57462be824c",
    "after": "0c77acad8e184fccd1f6f5f0442c6cad5650d492a71ebdd2f50d1da5aacaf686"
  },
  "apps/dashboard/src/app/(app)/tenants/page.tsx": {
    "before": "40022e569e003aff9e171927756b8bb4d9a3d2d24404be861b42450e1066e890",
    "after": "8130f23ee944523cdf4eb05b6c7acd83d34eef649eb5abb8169a027cd48eff62"
  },
  "apps/dashboard/src/components/dashboard-home-client.tsx": {
    "before": "60cba9ee134c49ce8bd28801c7497a1834f792984170af46fe7a8d26e5dcc387",
    "after": "930cee79aba101303ab27048a2aad544ee0c73bfe535dd2394cc4a7688d8cbd4"
  },
  "apps/dashboard/src/components/data-table.tsx": {
    "before": "3977c062764432b362e2ed91af95a9b4d4fafaa21980bf10a901bf82b91f7385",
    "after": "6d0f150d8cb7ea0d8df507080341e3887f2036fca105dc7094dfa99654e44fa8"
  },
  "apps/dashboard/src/components/tenant-marketplace-workspace.module.css": {
    "before": "4b732c4bc1473f4f562f578ceaf33cfaecdc266a4b9722031724668736298e71",
    "after": "dec82d79091efd682236a6a34decb44490d144957856341dbfbe93b130c19d2c"
  },
  "apps/dashboard/src/components/tenant-marketplace-workspace.tsx": {
    "before": "267e33fecb730b2449d73887ea1090a77b1db102e39010620908e1963109bcdb",
    "after": "e9f13ecae3aefe8f1ac93d56e749140bd94c9ff7e4bc7126c80fbda72f310152"
  },
  "apps/dashboard/src/lib/dashboard-content.ts": {
    "before": "a95691a875b962e2768375332cb2b8e229d69883be5f839b2460673009d7084d",
    "after": "a110e57127755828b4b27ec927235344c5d4680903d74fe02a445d4d70dd7438"
  }
});
export const CUSTOMER_FEEDBACK_ADDED=Object.freeze({
  "apps/dashboard/src/lib/data-table-copy.ts": "4114408402eb0a8a1e2572f1497d7ad1594ea5ea992e961fe0a012cca6844613"
});
export function customerFeedbackPriorHash(name,actual){
 if(!Object.hasOwn(CUSTOMER_FEEDBACK_CHANGED,name))return actual;
 const pin=CUSTOMER_FEEDBACK_CHANGED[name];
 assert.equal(actual,pin.after,name+' exact reviewed customer feedback increment');
 return pin.before;
}
export function customerFeedbackPriorInventory(actual){
 assert.equal(new Set(actual).size,actual.length,'no duplicate source paths');
 for(const name of Object.keys(CUSTOMER_FEEDBACK_ADDED))assert.equal(actual.filter(value=>value===name).length,1,name+' exactly one reviewed addition');
 return actual.filter(name=>!Object.hasOwn(CUSTOMER_FEEDBACK_ADDED,name));
}
export function assertCustomerFeedbackAdded(name,actual){
 assert.ok(Object.hasOwn(CUSTOMER_FEEDBACK_ADDED,name),'known customer feedback addition');
 assert.equal(actual,CUSTOMER_FEEDBACK_ADDED[name],name+' exact reviewed customer feedback addition');
}
