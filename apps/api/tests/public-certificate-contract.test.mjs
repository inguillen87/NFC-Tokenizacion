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

test("consumer wallet persistence has migration and address validation", async () => {
  const route = await readFile(new URL("../src/app/consumer/wallet/connect/route.ts", import.meta.url), "utf8");
  const schema = await readFile(new URL("../src/lib/commercial-runtime-schema.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../db/migrations/20260519120000_0033_consumer_wallet_certificate.sql", import.meta.url), "utf8");

  assert.match(route, /isAddress/);
  assert.match(route, /body\.address \|\| body\.walletAddress \|\| body\.wallet_address/);
  assert.match(route, /wallet_verified_at/);
  assert.match(schema, /function cacheSchemaInit/);
  assert.match(schema, /authSchemaReady = null/);
  assert.match(schema, /portalSchemaReady = null/);
  assert.match(migration, /wallet_address text/);
  assert.match(migration, /idx_consumers_wallet_address/);
});
