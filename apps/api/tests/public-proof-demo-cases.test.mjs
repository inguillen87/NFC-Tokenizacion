import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("../src/lib/public-proof-demos.ts", import.meta.url)), "utf8");
const { buildPublicProofDemoCases } = await import("../scripts/public-proof-demo-fixtures.mjs");

const PUBLIC_PROOF_DEMO_CASES = buildPublicProofDemoCases();
const hashToCaseId = new Map(PUBLIC_PROOF_DEMO_CASES.flatMap((demoCase) =>
  demoCase.events.map((event) => [event.hash, demoCase.id]),
));

test("public proof demos expose three neutral enterprise cases", () => {
  assert.deepEqual(PUBLIC_PROOF_DEMO_CASES.map((demoCase) => demoCase.id), [
    "secure-delivery",
    "pharma-cold-chain",
    "agro-stewardship",
  ]);

  const serialized = JSON.stringify(PUBLIC_PROOF_DEMO_CASES).toLowerCase();
  assert.doesNotMatch(serialized, /\b(bayer|syngenta)\b/);
  assert.doesNotMatch(serialized, /private key|k_meta|k_file|uid_hex/);
});

test("public proof demo hashes and Merkle roots are deterministic sha256 values", () => {
  for (const demoCase of PUBLIC_PROOF_DEMO_CASES) {
    assert.equal(demoCase.events.length, 3);
    assert.match(demoCase.primary_event_hash, /^sha256:[0-9a-f]{64}$/);
    assert.match(demoCase.merkle_root, /^sha256:[0-9a-f]{64}$/);
    assert.match(demoCase.public_receipt.receipt_hash, /^sha256:[0-9a-f]{64}$/);
    assert.match(demoCase.public_receipt.on_chain_memo, /^nexID-proof-v1\|/);
    assert.match(demoCase.public_receipt.on_chain_memo, new RegExp(demoCase.merkle_root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.ok(Buffer.byteLength(demoCase.public_receipt.on_chain_memo, "utf8") <= 512);
    assert.equal(demoCase.primary_event_hash, demoCase.events[0].hash);

    const seen = new Set();
    for (const event of demoCase.events) {
      assert.match(event.hash, /^sha256:[0-9a-f]{64}$/);
      assert.equal(seen.has(event.hash), false);
      seen.add(event.hash);
      assert.equal(hashToCaseId.get(event.hash), demoCase.id);
    }
  }
});

test("public proof source keeps demo lookup helpers wired for the verify route", () => {
  assert.match(source, /export const PUBLIC_PROOF_DEMO_CASES/);
  assert.match(source, /export function findPublicProofDemoCaseByHash/);
  assert.match(source, /tenantId:\s*"public-demo"/);
  assert.match(source, /public_receipt/);
  assert.match(source, /hashPublicText\(onChainMemo\)/);
});
