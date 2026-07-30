import assert from "node:assert/strict";
import test from "node:test";

const { polygonWalletViewForViewer } = await import("../src/lib/polygon-wallet-view.ts");

const diagnostics = {
  ok: true,
  ready: true,
  chainReady: true,
  verificationLevel: "live_verified",
  mode: "polygon",
  network: "polygon-amoy",
  autoTokenize: true,
  rpc: { configured: true, url: "https://rpc.example/secret-path" },
  executor: { configured: true, url: "https://executor.internal", signerAddress: "0x111" },
  contract: { address: "0x222", deployed: true },
  minter: { address: "0x111", configured: true, balancePol: 4.2 },
  recipient: { address: "0x333", balancePol: 1.5 },
  checks: [{ key: "minter_gas", detail: "4.2 POL" }],
};

test("super admins retain platform wallet diagnostics", () => {
  const view = polygonWalletViewForViewer(diagnostics, { scope: "super_admin", tenantSlug: null });
  assert.equal(view, diagnostics);
});

test("tenant viewers receive capability without global custody details", () => {
  const view = polygonWalletViewForViewer(diagnostics, { scope: "tenant_admin", tenantSlug: "tenant-a" });
  assert.equal(view.scope, "tenant");
  assert.deepEqual(view.tenant, { slug: "tenant-a" });
  assert.equal(view.ready, true);
  assert.equal(view.chainReady, true);
  for (const forbidden of ["rpc", "executor", "contract", "minter", "recipient", "metadataPrefix", "chainId", "useLocalMinter"]) {
    assert.equal(Object.hasOwn(view, forbidden), false, `${forbidden} must stay in the operator control plane`);
  }
  assert.doesNotMatch(JSON.stringify(view), /0x111|0x222|0x333|4\.2 POL|secret-path|executor\.internal/);
});

test("a tenant capability never upgrades an unverified runtime", () => {
  const view = polygonWalletViewForViewer(
    { ...diagnostics, ready: true, chainReady: false },
    { scope: "reseller", tenantSlug: "tenant-b" },
  );
  assert.equal(view.ready, false);
  assert.equal(view.chainReady, false);
  assert.equal(view.verificationLevel, "tenant_capability_unavailable");
});
