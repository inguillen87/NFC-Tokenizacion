import test from "node:test";
import assert from "node:assert/strict";
import { Interface, hexlify, toUtf8Bytes } from "ethers";

const contractAddress = "0x1111111111111111111111111111111111111111";
const walletAddress = "0x2222222222222222222222222222222222222222";
const previousRpc = process.env.IOTA_EVM_RPC_URL;
const previousContract = process.env.IOTA_EVM_ANCHOR_CONTRACT;
const previousPublisher = process.env.IOTA_EVM_DEPLOYER_ADDRESS;
process.env.IOTA_EVM_RPC_URL = "https://rpc.test.invalid";
process.env.IOTA_EVM_ANCHOR_CONTRACT = contractAddress;
process.env.IOTA_EVM_DEPLOYER_ADDRESS = walletAddress;

const {
  decodeIotaAnchorInput,
  decodeIotaMemoInput,
  verifyIotaAnchorPublication,
  verifyIotaMemoPublication,
} = await import("../src/lib/iota-evm-proof.ts");

const anchorInterface = new Interface([
  "function anchorRoot(bytes32 merkleRoot, string tenantIdHash, string resourceType, string resourceId, uint256 eventCount)",
]);
const evidenceAnchorInterface = new Interface([
  "function anchorEvidence(bytes32 merkleRoot, bytes32 tenantIdHash, string resourceType, string resourceId, uint64 eventCount, bytes32 memoHash) returns (bytes32 proofId)",
]);

test.after(() => {
  if (previousRpc === undefined) delete process.env.IOTA_EVM_RPC_URL;
  else process.env.IOTA_EVM_RPC_URL = previousRpc;
  if (previousContract === undefined) delete process.env.IOTA_EVM_ANCHOR_CONTRACT;
  else process.env.IOTA_EVM_ANCHOR_CONTRACT = previousContract;
  if (previousPublisher === undefined) delete process.env.IOTA_EVM_DEPLOYER_ADDRESS;
  else process.env.IOTA_EVM_DEPLOYER_ADDRESS = previousPublisher;
});

function mockRpc(txHash, input, to = contractAddress) {
  return async (_url, options) => {
    const batch = JSON.parse(String(options.body));
    assert.equal(Array.isArray(batch), true);
    return new Response(JSON.stringify([
      { jsonrpc: "2.0", id: 1, result: "0x434" },
      { jsonrpc: "2.0", id: 2, result: { hash: txHash, from: walletAddress, to, input, blockNumber: "0x64" } },
      { jsonrpc: "2.0", id: 3, result: { transactionHash: txHash, from: walletAddress, to, status: "0x1", blockNumber: "0x64" } },
      { jsonrpc: "2.0", id: 4, result: "0x68" },
    ]), { status: 200, headers: { "content-type": "application/json" } });
  };
}

test("IOTA anchor calldata is decoded and compared with the expected business proof", async () => {
  const txHash = `0x${"11".repeat(32)}`;
  const root = `sha256:${"ab".repeat(32)}`;
  const input = anchorInterface.encodeFunctionData("anchorRoot", [
    `0x${"ab".repeat(32)}`,
    "tenant-hash",
    "pharma_batch",
    "PHR-LOT-2026-0142",
    3,
  ]);
  const decoded = decodeIotaAnchorInput(input);
  assert.deepEqual(decoded, {
    contract_version: "legacy_v1",
    merkle_root: root,
    tenant_id_hash: "tenant-hash",
    resource_type: "pharma_batch",
    resource_id: "PHR-LOT-2026-0142",
    event_count: 3,
    memo_hash: null,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockRpc(txHash, input);
  try {
    const proof = await verifyIotaAnchorPublication({
      txHash,
      merkleRoot: root,
      tenantIdHash: "tenant-hash",
      resourceType: "pharma_batch",
      resourceId: "PHR-LOT-2026-0142",
      eventCount: 3,
    });
    assert.equal(proof.verified, true);
    assert.equal(proof.expected_call_matches, true);
    assert.equal(proof.contract_matches, true);
    assert.equal(proof.publisher_matches, true);
    assert.equal(proof.transaction_hash_matches, true);
    assert.equal(proof.receipt_hash_matches, true);
    assert.equal(proof.chain_id, 1076);
    assert.equal(proof.confirmations, 5);

    const wrongTenant = await verifyIotaAnchorPublication({
      txHash,
      merkleRoot: root,
      tenantIdHash: "another-tenant-hash",
      resourceType: "pharma_batch",
      resourceId: "PHR-LOT-2026-0142",
      eventCount: 3,
    });
    assert.equal(wrongTenant.verified, false);
    assert.equal(wrongTenant.reason, "iota_anchor_call_mismatch");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("IOTA Evidence Anchor V2 calldata includes the memo hash and exposes a deterministic proof id", async () => {
  const txHash = `0x${"33".repeat(32)}`;
  const root = `sha256:${"ab".repeat(32)}`;
  const tenantHash = "cd".repeat(32);
  const memoHash = `sha256:${"ef".repeat(32)}`;
  const input = evidenceAnchorInterface.encodeFunctionData("anchorEvidence", [
    `0x${"ab".repeat(32)}`,
    `0x${tenantHash}`,
    "agro_input_batch",
    "AGR-STW-2026-0031",
    3,
    `0x${"ef".repeat(32)}`,
  ]);
  const decoded = decodeIotaAnchorInput(input);
  assert.deepEqual(decoded, {
    contract_version: "evidence_anchor_v2",
    merkle_root: root,
    tenant_id_hash: tenantHash,
    resource_type: "agro_input_batch",
    resource_id: "AGR-STW-2026-0031",
    event_count: 3,
    memo_hash: memoHash,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockRpc(txHash, input);
  try {
    const proof = await verifyIotaAnchorPublication({
      txHash,
      merkleRoot: root,
      tenantIdHash: tenantHash,
      resourceType: "agro_input_batch",
      resourceId: "AGR-STW-2026-0031",
      eventCount: 3,
      memoHash,
    });
    assert.equal(proof.verified, true);
    assert.equal(proof.contract_version, "evidence_anchor_v2");
    assert.equal(proof.memo_hash_matches, true);
    assert.match(proof.proof_id, /^0x[0-9a-f]{64}$/);

    const wrongMemo = await verifyIotaAnchorPublication({
      txHash,
      merkleRoot: root,
      tenantIdHash: tenantHash,
      resourceType: "agro_input_batch",
      resourceId: "AGR-STW-2026-0031",
      eventCount: 3,
      memoHash: `sha256:${"00".repeat(32)}`,
    });
    assert.equal(wrongMemo.verified, false);
    assert.equal(wrongMemo.reason, "iota_anchor_call_mismatch");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("IOTA memo receipts require an exact Raw input match", async () => {
  const txHash = `0x${"22".repeat(32)}`;
  const memo = "nexID-proof-v1|case=agro-stewardship|events=3|privacy=hash-only";
  const input = hexlify(toUtf8Bytes(memo));
  assert.equal(decodeIotaMemoInput(input), memo);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockRpc(txHash, input, walletAddress);
  try {
    const exact = await verifyIotaMemoPublication(txHash, memo);
    assert.equal(exact.verified, true);
    assert.equal(exact.memo_matches, true);
    assert.equal(exact.self_transfer, true);
    assert.equal(exact.publisher_matches, true);

    const mismatch = await verifyIotaMemoPublication(txHash, `${memo}|tampered=true`);
    assert.equal(mismatch.verified, false);
    assert.equal(mismatch.reason, "iota_memo_mismatch");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
