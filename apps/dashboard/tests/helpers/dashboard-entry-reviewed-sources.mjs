import assert from "node:assert/strict";

// Public login and release UI increment on Dashboard production 3eb3e8dc.
const reviewedSources = new Map([
  ["apps/dashboard/src/app/login/page.tsx", [
    "3bf32038ca960dc3625b1c4ef5fe4f9f8b78d8ee92c2eeb3c4024e09c80b6a79",
    "a8cdfe7410db5892b1e7d94b590582e9f8d3f0418c2aec081a804eae6cbb3975",
  ]],
  ["apps/dashboard/src/app/novedades/page.tsx", [
    "42e22ba5ac9aa98283576df539308f9603cd58501e130c605dfc1da99f398a5b",
    "2cdf32a179dab666585d3aacb942414da80e4501c5c090b7ccb77f023daac813",
  ]],
  ["apps/dashboard/src/components/login-entry.module.css", [
    "3137965e32dcd66b2442e33a101461313a0a9d06247822c032670bf0b9d89cea",
    "71ffcdfbf305db2421f4f7845d9cec34770862b802a91f6f8bbd70cf92e72351",
  ]],
  ["apps/dashboard/src/components/login-form-panel.tsx", [
    "07605b234bda5267993e7e045d1a80ca53289e169fd23770f46870754a31f68e",
    "2a2d79f86da84928efc97e073ca5794a09b94f4f217ee65dfe20ba9f14dfa319",
  ]],
  ["apps/dashboard/src/components/release-notes-link.tsx", [
    "0249c471e23e74463b257f2e77b85774e411049bd5ff926eface43db13cdbf35",
    "1bab11c2fa972f9306e1486b024c91a1d2ef980bbf6cf17b2b37d57f3667a7a0",
  ]],
  ["apps/dashboard/src/components/tenant-account-menu.tsx", [
    "63639d37bacd90e9f74c0f17f530254b8b33c1310b12ecce320efaf8535ea038",
    "1dbd4ca3e27d81ed5e886cc903695706004b125b9a42e46dbbf364a8d8c49242",
  ]],
]);

export function dashboardEntryPriorHash(path, actual) {
  const pin = reviewedSources.get(path);
  if (!pin) return actual;
  const [before, after] = pin;
  assert.equal(actual, after, path + " exact dashboard entry increment");
  return before;
}
