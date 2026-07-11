import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Wallet } from "ethers";
import {
  buildWalletControlMessage,
  normalizeWalletAddress,
  normalizeWalletChainId,
  normalizeWalletProvider,
  verifyWalletControlSignature,
  walletNetworkFromChainId,
} from "../src/lib/wallet-control.ts";

function challengeFor(address) {
  return buildWalletControlMessage({
    domain: "nexid.lat",
    uri: "https://nexid.lat",
    address,
    chainId: "80002",
    nonce: "unit-test-nonce",
    requestId: "33333333-3333-4333-8333-333333333333",
    issuedAt: "2026-07-11T03:00:00.000Z",
    expiresAt: "2026-07-11T03:05:00.000Z",
  });
}

test("EIP-191 challenge proves control without sending a transaction", async () => {
  const owner = Wallet.createRandom();
  const attacker = Wallet.createRandom();
  const message = challengeFor(owner.address);
  const ownerSignature = await owner.signMessage(message);
  const attackerSignature = await attacker.signMessage(message);

  assert.equal(verifyWalletControlSignature({ message, signature: ownerSignature, address: owner.address }), true);
  assert.equal(verifyWalletControlSignature({ message, signature: attackerSignature, address: owner.address }), false);
  assert.match(message, /Signing is free and does not send a blockchain transaction/);
  assert.match(message, /Purpose: Link this wallet to a nexID Passport/);
});

test("wallet inputs normalize to stable EVM identities", () => {
  const owner = Wallet.createRandom();

  assert.equal(normalizeWalletAddress(owner.address.toLowerCase()), owner.address);
  assert.equal(normalizeWalletAddress("not-a-wallet"), null);
  assert.equal(normalizeWalletChainId("0x13882"), "80002");
  assert.equal(normalizeWalletChainId("80002"), "80002");
  assert.equal(normalizeWalletChainId("0"), null);
  assert.equal(walletNetworkFromChainId("80002"), "polygon-amoy");
  assert.equal(normalizeWalletProvider("Phantom"), "phantom");
  assert.equal(normalizeWalletProvider("unknown extension"), "wallet_evm");
});

test("wallet routes require an authenticated one-time challenge and signature", async () => {
  const challengeRoute = await readFile(new URL("../src/app/consumer/wallet/challenge/route.ts", import.meta.url), "utf8");
  const connectRoute = await readFile(new URL("../src/app/consumer/wallet/connect/route.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../db/migrations/20260711044500_0045_consumer_wallet_control_challenges.sql", import.meta.url), "utf8");

  assert.match(challengeRoute, /getConsumerFromRequest/);
  assert.match(challengeRoute, /consumer_wallet_challenges/);
  assert.match(challengeRoute, /wallet_challenge_rate_limited/);
  assert.match(connectRoute, /verifyWalletControlSignature/);
  assert.match(connectRoute, /wallet_challenge_already_used/);
  assert.match(connectRoute, /wallet_signature_does_not_match/);
  assert.match(connectRoute, /wallet_already_linked_to_another_account/);
  assert.doesNotMatch(connectRoute, /body\.address\s*\|\|\s*body\.walletAddress/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS consumer_wallet_challenges/);
  assert.match(migration, /signature_hash text/);
  assert.match(migration, /wallet_network = 'presentation'/);
});

test("Clerk Web3 bridge cannot reassign an existing wallet identity", async () => {
  const route = await readFile(new URL("../src/app/consumer/auth/web3/route.ts", import.meta.url), "utf8");

  assert.match(route, /walletVerificationSource !== "clerk_verified_web3"/);
  assert.match(route, /web3_identity_conflict/);
  assert.match(route, /wallet_already_linked_to_another_account/);
  assert.doesNotMatch(route, /DO UPDATE SET consumer_id = EXCLUDED\.consumer_id/);
});
