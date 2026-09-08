import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("wallet UX separates detected, presentation and control-verified states", async () => {
  const card = await readFile(new URL("../src/app/me/wallet/metamask-sandbox-card.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../src/app/me/wallet/page.tsx", import.meta.url), "utf8");
  const globals = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(card, /window\.phantom\?\.ethereum/);
  assert.match(card, /method: "personal_sign"/);
  assert.match(card, /\/api\/consumer\/wallet\/challenge/);
  assert.match(card, /body: JSON\.stringify\(\{ challengeId, signature \}\)/);
  assert.match(card, /Control verificado/);
  assert.match(card, /Firma pendiente/);
  assert.match(card, /Solo presentación/);
  assert.match(card, /no se guarda, no prueba control/);
  assert.doesNotMatch(card, /persistWallet/);
  assert.match(page, /<section aria-labelledby="wallet-brand-points-title"[\s\S]*?<MetamaskSandboxCard initialWallet=\{wallet\?\.blockchainWallet\} autoConnect=\{shouldAutoConnectMetaMask\} \/>[\s\S]*?<div className="grid gap-6 lg:grid-cols-\[minmax\(0,1fr\)_340px\]">/);
  assert.match(card, /consumer-wallet-control/);
  assert.match(page, /consumer-passport-collection/);
  assert.match(globals, /html\[data-theme="light"\] \.consumer-wallet-control/);
  assert.match(globals, /html\[data-theme="light"\] \.consumer-passport-collection/);
  assert.match(globals, /consumer-wallet-control \.text-white/);
  assert.match(globals, /consumer-wallet-control \.bg-slate-950\\\/55/);
});

test("consumer wallet proxies preserve the signed API boundary", async () => {
  const challengeProxy = await readFile(new URL("../src/app/api/consumer/wallet/challenge/route.ts", import.meta.url), "utf8");
  const connectProxy = await readFile(new URL("../src/app/api/consumer/wallet/connect/route.ts", import.meta.url), "utf8");

  assert.match(challengeProxy, /proxyToApi\(req, "\/consumer\/wallet\/challenge"\)/);
  assert.match(connectProxy, /proxyToApi\(req, "\/consumer\/wallet\/connect"\)/);
});

test("Clerk bridge forwards only its server-verified session token", async () => {
  const bridge = await readFile(new URL("../src/app/api/consumer/auth/web3/route.ts", import.meta.url), "utf8");

  assert.match(bridge, /const clerkAuth = await auth\(\)/);
  assert.match(bridge, /clerkAuth\?\.getToken\(\)/);
  assert.match(bridge, /authorization: `Bearer \$\{clerkSessionToken\}`/);
  assert.doesNotMatch(bridge, /ADMIN_API_KEY|externalUserId|walletAddress|walletVerificationSource|cookie:/);
});
