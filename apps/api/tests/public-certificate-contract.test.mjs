import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("public certificate route exposes certificate without owner PII", async () => {
  const source = await readFile(new URL("../src/app/public/certificates/[eventId]/route.ts", import.meta.url), "utf8");

  assert.match(source, /NX-CERT-/);
  assert.match(source, /publicUrl/);
  assert.match(source, /ownerLabel/);
  assert.match(source, /explorerUrl/);
  assert.match(source, /assets: assetProfile/);
  assert.match(source, /readProductAssetMedia/);
  assert.match(source, /isClaimableOwnershipResult/);
  assert.match(source, /replay_blocked/);
  assert.match(source, /Autenticidad no confirmada/);
  assert.match(source, /recordScope: "nexid_off_chain"/);
  assert.match(source, /onChainOwnerVerified: false/);
  assert.doesNotMatch(source, /owner_verified/);
  assert.doesNotMatch(source, /tokenStatus === "simulated"/);
  assert.doesNotMatch(source, /consumer_email|phone_number|contact_value|otp_code/i);
});

test("admin product asset bank exposes upload and list contracts", async () => {
  const route = await readFile(new URL("../src/app/admin/product-assets/route.ts", import.meta.url), "utf8");

  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(route, /labelImageUrl/);
  assert.match(route, /modelUrl/);
  assert.match(route, /galleryUrls/);
  assert.match(route, /buildProductAssetProfile/);
  assert.match(route, /uidMasked/);
});

test("consumer wallet persistence requires a signed one-time challenge", async () => {
  const challengeRoute = await readFile(new URL("../src/app/consumer/wallet/challenge/route.ts", import.meta.url), "utf8");
  const connectRoute = await readFile(new URL("../src/app/consumer/wallet/connect/route.ts", import.meta.url), "utf8");
  const schema = await readFile(new URL("../src/lib/commercial-runtime-schema.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../db/migrations/20260711044500_0045_consumer_wallet_control_challenges.sql", import.meta.url), "utf8");

  assert.match(challengeRoute, /normalizeWalletAddress/);
  assert.match(challengeRoute, /WALLET_CONTROL_CHALLENGE_TTL_MS/);
  assert.match(connectRoute, /challengeId/);
  assert.match(connectRoute, /signature/);
  assert.match(connectRoute, /verifyWalletControlSignature/);
  assert.match(connectRoute, /wallet_verified_at/);
  assert.doesNotMatch(connectRoute, /body\.address \|\| body\.walletAddress/);
  assert.match(schema, /function cacheSchemaInit/);
  assert.match(schema, /authSchemaReady = null/);
  assert.match(schema, /portalSchemaReady = null/);
  assert.match(schema, /consumer_wallet_challenges/);
  assert.match(migration, /wallet_address text NOT NULL/);
  assert.match(migration, /idx_consumer_wallet_challenges_active/);
});
