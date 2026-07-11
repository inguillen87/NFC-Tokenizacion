import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("wallet UX separates detected, presentation and control-verified states", async () => {
  const card = await readFile(new URL("../src/app/me/wallet/metamask-sandbox-card.tsx", import.meta.url), "utf8");

  assert.match(card, /window\.phantom\?\.ethereum/);
  assert.match(card, /method: "personal_sign"/);
  assert.match(card, /\/api\/consumer\/wallet\/challenge/);
  assert.match(card, /body: JSON\.stringify\(\{ challengeId, signature \}\)/);
  assert.match(card, /Control verificado/);
  assert.match(card, /Firma pendiente/);
  assert.match(card, /Solo presentación/);
  assert.match(card, /no se guarda, no prueba control/);
  assert.doesNotMatch(card, /persistWallet/);
});

test("consumer wallet proxies preserve the signed API boundary", async () => {
  const challengeProxy = await readFile(new URL("../src/app/api/consumer/wallet/challenge/route.ts", import.meta.url), "utf8");
  const connectProxy = await readFile(new URL("../src/app/api/consumer/wallet/connect/route.ts", import.meta.url), "utf8");

  assert.match(challengeProxy, /proxyToApi\(req, "\/consumer\/wallet\/challenge"\)/);
  assert.match(connectProxy, /proxyToApi\(req, "\/consumer\/wallet\/connect"\)/);
});

test("Clerk bridge accepts only wallets Clerk marked verified", async () => {
  const bridge = await readFile(new URL("../src/app/api/consumer/auth/web3/route.ts", import.meta.url), "utf8");

  assert.match(bridge, /item\.verification\?\.status === "verified"/);
  assert.match(bridge, /walletVerificationSource: wallet\.address \? "clerk_verified_web3" : null/);
});
