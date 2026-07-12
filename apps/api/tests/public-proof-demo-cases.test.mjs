import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("../src/lib/public-proof-demos.ts", import.meta.url)), "utf8");
const decoderSource = readFileSync(fileURLToPath(new URL("../src/lib/public-proof-decoder.ts", import.meta.url)), "utf8");
const verifyRouteSource = readFileSync(fileURLToPath(new URL("../src/app/public/proof/verify/route.ts", import.meta.url)), "utf8");
const anchorRouteSource = readFileSync(fileURLToPath(new URL("../src/app/public/proof/[anchorId]/route.ts", import.meta.url)), "utf8");
const demoCasesRouteSource = readFileSync(fileURLToPath(new URL("../src/app/public/proof/demo-cases/route.ts", import.meta.url)), "utf8");
const schemaSource = readFileSync(fileURLToPath(new URL("../src/lib/supplier-ops-schema.ts", import.meta.url)), "utf8");
const { buildPublicProofDemoCases } = await import("../scripts/public-proof-demo-fixtures.mjs");
const { decodePublicProofInput } = await import("../src/lib/public-proof-decoder.ts");

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

test("proof decoder distinguishes an exact demo receipt match from parsed-only text", () => {
  const demoCase = PUBLIC_PROOF_DEMO_CASES[0];
  const envKey = "PUBLIC_PROOF_RECEIPT_IOTA_TX_HASH_SECURE_DELIVERY";
  const previousTx = process.env[envKey];

  try {
    delete process.env[envKey];
    const matchedOnly = decodePublicProofInput(demoCase.public_receipt.on_chain_memo);
    assert.equal(matchedOnly.receipt_matched, true);
    assert.equal(matchedOnly.receipt_verified, false);
    assert.equal(matchedOnly.verification_status, "matched_demo_receipt");
    assert.ok(matchedOnly.warnings?.includes("receipt_publication_unavailable"));

    process.env[envKey] = `0x${"ab".repeat(32)}`;
    const exact = decodePublicProofInput(demoCase.public_receipt.on_chain_memo);
    assert.equal(exact.ok, true);
    assert.equal(exact.receipt_matched, true);
    assert.equal(exact.receipt_verified, false);
    assert.equal(exact.publication_configured, true);
    assert.equal(exact.verification_status, "matched_demo_receipt");
    assert.equal(exact.matching_demo_case?.id, demoCase.id);
    assert.match(exact.publication_explorer_url || "", /\/tx\/0x/);
    assert.equal(exact.warnings?.includes("receipt_network_check_required"), true);
    assert.equal(exact.warnings?.includes("receipt_not_verified"), true);

    const forgedMemo = demoCase.public_receipt.on_chain_memo.replace("events=3", "events=999");
    const forged = decodePublicProofInput(forgedMemo);
    assert.equal(forged.ok, true);
    assert.equal(forged.receipt_matched, false);
    assert.equal(forged.receipt_verified, false);
    assert.equal(forged.verification_status, "parsed_only");
    assert.equal(forged.matching_demo_case, null);
    assert.ok(forged.warnings?.includes("demo_receipt_mismatch"));
    assert.ok(forged.warnings?.includes("receipt_not_verified"));
    assert.match(forged.executive_summary || "", /no confirma/i);
  } finally {
    if (previousTx === undefined) delete process.env[envKey];
    else process.env[envKey] = previousTx;
  }
});

test("proof verifier queries indexed event hashes and exposes honest trust states", () => {
  assert.match(verifyRouteSource, /event_hashes_json\s+@>/);
  assert.doesNotMatch(verifyRouteSource, /LIMIT\s+250/);
  assert.match(verifyRouteSource, /externally_confirmed:\s*externallyConfirmed/);
  assert.match(verifyRouteSource, /valid:\s*externallyConfirmed/);
  assert.match(verifyRouteSource, /evidence_level:\s*evidenceLevel/);
  assert.match(verifyRouteSource, /testnet_fixture/);
  assert.match(verifyRouteSource, /testnet_rpc/);
  assert.match(verifyRouteSource, /network_verified:\s*demoNetworkVerified/);
  assert.match(schemaSource, /idx_evidence_anchors_event_hashes_gin/);
});

test("public anchor route rejects malformed ids before querying the database", () => {
  assert.match(anchorRouteSource, /anchor_id_invalid/);
  assert.match(anchorRouteSource, /anchor_registry_unavailable/);
  assert.match(anchorRouteSource, /anchor_id_invalid[\s\S]*await ensureSupplierOpsSchema/);
  assert.match(anchorRouteSource, /findPublicProofDemoCaseByAnchorId/);
  assert.match(anchorRouteSource, /evidence_level: networkVerified \? "testnet_rpc" : "testnet_fixture"/);
});

test("decoder implementation requires an exact receipt match", () => {
  assert.match(decoderSource, /public_receipt\.on_chain_memo === decodedMemo/);
  assert.match(decoderSource, /publication_configured: publicationConfigured/);
  assert.match(decoderSource, /verification_status: demoCase \? "matched_demo_receipt" : "parsed_only"/);
  assert.match(decoderSource, /receipt_network_check_required/);
});

test("public demo catalog derives Polygon claims from the verified certificate", () => {
  assert.match(demoCasesRouteSource, /readPublicPolygonOwnershipCertificate/);
  assert.match(demoCasesRouteSource, /rpc_verified:\s*polygonRpcVerified/);
  assert.match(demoCasesRouteSource, /verification_state:/);
  assert.match(demoCasesRouteSource, /wallet_control_verified:/);
  assert.match(demoCasesRouteSource, /owner_custody:/);
  assert.match(demoCasesRouteSource, /metadata_verified:/);
  assert.match(demoCasesRouteSource, /mint_events_match:/);
  assert.match(demoCasesRouteSource, /source_verified:/);
});
