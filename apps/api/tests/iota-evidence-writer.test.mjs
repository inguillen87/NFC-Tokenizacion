import assert from "node:assert/strict";
import test from "node:test";
import { AbiCoder, keccak256, toUtf8Bytes } from "ethers";

const {
  canonicalizeIotaEventHashes,
  computeIotaEvidenceProofId,
  prepareIotaEvidence,
  publishIotaEvidence,
  resolveIotaEvidenceRuntimeConfig,
} = await import("../src/lib/iota-evidence-writer.ts");

const contractAddress = "0x1111111111111111111111111111111111111111";
const publisherAddress = "0x2222222222222222222222222222222222222222";
const hashes = [`sha256:${"11".repeat(32)}`, `sha256:${"22".repeat(32)}`];

test("IOTA V2 memo and root are deterministic, privacy-preserving commitments", () => {
  const prepared = prepareIotaEvidence({
    tenantId: "11111111-1111-4111-8111-111111111111",
    resourceType: "batch",
    publicResourceId: "nx-lot-8d2f04c1",
    eventHashes: hashes,
    canonicalizationVersion: "nexid-event-order-created-at-id-v1",
    preserveEventOrder: true,
  });
  const replay = prepareIotaEvidence({
    tenantId: "11111111-1111-4111-8111-111111111111",
    resourceType: "batch",
    publicResourceId: "nx-lot-8d2f04c1",
    eventHashes: hashes,
    canonicalizationVersion: "nexid-event-order-created-at-id-v1",
    preserveEventOrder: true,
  });
  assert.deepEqual(replay, prepared);
  assert.match(prepared.merkleRoot, /^sha256:[0-9a-f]{64}$/);
  assert.match(prepared.memoHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(prepared.eventCount, 2);
  assert.equal(JSON.stringify(prepared.memo).includes("11111111-1111-4111-8111-111111111111"), false);
  assert.equal(prepared.memo.public_resource_id, "nx-lot-8d2f04c1");
});

test("direct hash sets canonicalize lexicographically while event chronology remains explicit", () => {
  assert.deepEqual(
    canonicalizeIotaEventHashes([...hashes].reverse(), "lexicographic"),
    canonicalizeIotaEventHashes(hashes, "lexicographic"),
  );
  const ordered = prepareIotaEvidence({
    tenantId: "tenant-a",
    resourceType: "batch",
    publicResourceId: "public-a",
    eventHashes: hashes,
    canonicalizationVersion: "ordered-v1",
  });
  const reversed = prepareIotaEvidence({
    tenantId: "tenant-a",
    resourceType: "batch",
    publicResourceId: "public-a",
    eventHashes: [...hashes].reverse(),
    canonicalizationVersion: "ordered-v1",
  });
  assert.notEqual(ordered.merkleRoot, reversed.merkleRoot);
});

test("V2 public references enforce Solidity UTF-8 byte limits and control-character policy", () => {
  const base = {
    tenantId: "tenant-a",
    resourceType: "batch",
    publicResourceId: "public-a",
    eventHashes: hashes,
    canonicalizationVersion: "ordered-v1",
  };
  assert.throws(() => prepareIotaEvidence({ ...base, resourceType: "é".repeat(33) }), /resource_type_too_long/);
  assert.throws(() => prepareIotaEvidence({ ...base, publicResourceId: "x\nsecret" }), /control_character/);
  assert.throws(() => prepareIotaEvidence({ ...base, publicResourceId: "" }), /public_resource_id_required/);
});

test("off-chain proofId matches the contract ABI formula", () => {
  const prepared = prepareIotaEvidence({
    tenantId: "tenant-a",
    resourceType: "batch",
    publicResourceId: "public-a",
    eventHashes: hashes,
    canonicalizationVersion: "ordered-v1",
  });
  const proofId = computeIotaEvidenceProofId({
    chainId: 1076,
    contractAddress,
    merkleRoot: prepared.merkleRoot,
    tenantIdHash: prepared.tenantIdHash,
    resourceType: prepared.resourceType,
    resourceId: prepared.publicResourceId,
    eventCount: prepared.eventCount,
    memoHash: prepared.memoHash,
  });
  const expected = keccak256(AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256", "address", "bytes32", "bytes32", "bytes32", "bytes32", "uint64", "bytes32"],
    [
      keccak256(toUtf8Bytes("nexid.evidence.anchor.v2")),
      1076,
      contractAddress,
      `0x${prepared.merkleRoot.slice(7)}`,
      `0x${prepared.tenantIdHash}`,
      keccak256(toUtf8Bytes(prepared.resourceType)),
      keccak256(toUtf8Bytes(prepared.publicResourceId)),
      prepared.eventCount,
      `0x${prepared.memoHash.slice(7)}`,
    ],
  ));
  assert.equal(proofId, expected);
});

test("production runtime never enables an exportable local IOTA signer", () => {
  const config = resolveIotaEvidenceRuntimeConfig({
    NODE_ENV: "production",
    IOTA_PROVIDER_MODE: "iota_evm_contract",
    IOTA_EVM_RPC_URL: "https://rpc.example.test",
    IOTA_EVM_ANCHOR_CONTRACT_V2: contractAddress,
    IOTA_EVM_PRIVATE_KEY: `0x${"33".repeat(32)}`,
    IOTA_ALLOW_LOCAL_SIGNER: "true",
  });
  assert.equal(config.mode, "iota_evm_contract_v2");
  assert.equal(config.allowLocalSigner, false);
});

test("executor response persists broadcast identity before reconciliation", async () => {
  const prepared = prepareIotaEvidence({
    tenantId: "tenant-a",
    resourceType: "batch",
    publicResourceId: "public-a",
    eventHashes: hashes,
    canonicalizationVersion: "ordered-v1",
  });
  const proofId = computeIotaEvidenceProofId({
    chainId: 1076,
    contractAddress,
    merkleRoot: prepared.merkleRoot,
    tenantIdHash: prepared.tenantIdHash,
    resourceType: prepared.resourceType,
    resourceId: prepared.publicResourceId,
    eventCount: prepared.eventCount,
    memoHash: prepared.memoHash,
  });
  const config = resolveIotaEvidenceRuntimeConfig({
    NODE_ENV: "production",
    IOTA_PROVIDER_MODE: "iota_evm_contract_v2",
    IOTA_EVM_RPC_URL: "https://rpc.example.test",
    IOTA_EVM_ANCHOR_CONTRACT_V2: contractAddress,
    IOTA_PROOF_EXECUTOR_URL: "https://executor.example.test/anchor-evidence",
    IOTA_PROOF_EXECUTOR_SECRET: "unit-test-secret",
  });
  const target = {
    chainId: 1076,
    contractAddress,
    contractVersion: "evidence_anchor_v2",
    proofId,
    alreadyAnchored: false,
    publisherAddress: null,
    anchoredAt: null,
  };
  const txHash = `0x${"44".repeat(32)}`;
  const originalFetch = globalThis.fetch;
  let submitted = null;
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers["idempotency-key"], proofId);
    return new Response(JSON.stringify({
      ok: true,
      state: "submitted",
      already_anchored: false,
      proof_id: proofId,
      chain_id: 1076,
      contract_address: contractAddress,
      publisher_address: publisherAddress,
      tx_hash: txHash,
      nonce: 7,
      confirmations: 0,
    }), { status: 202, headers: { "content-type": "application/json" } });
  };
  try {
    const result = await publishIotaEvidence(prepared, target, config, "anchor-id", {
      onSubmitted(value) {
        submitted = value;
      },
    });
    assert.equal(result.txHash, txHash);
    assert.deepEqual(submitted, { txHash, publisherAddress, nonce: 7 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
