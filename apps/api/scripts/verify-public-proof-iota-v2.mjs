import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Contract, JsonRpcProvider, getAddress } from "ethers";
import { buildPublicProofDemoCases } from "./public-proof-demo-fixtures.mjs";

const envPath = resolve(process.cwd(), ".env.local");
const IOTA_ABI = [
  "function authorizedPublishers(address) view returns (bool)",
  "function computeProofId(bytes32 merkleRoot, bytes32 tenantIdHash, string resourceType, string resourceId, uint64 eventCount, bytes32 memoHash) view returns (bytes32)",
  "function isAnchored(bytes32 proofId) view returns (bool)",
  "function evidenceRecord(bytes32 proofId) view returns (bytes32 merkleRoot, bytes32 tenantIdHash, bytes32 memoHash, address publisher, uint64 eventCount, uint64 anchoredAt)",
  "function anchorEvidence(bytes32 merkleRoot, bytes32 tenantIdHash, string resourceType, string resourceId, uint64 eventCount, bytes32 memoHash) returns (bytes32 proofId)",
];

function readEnvFile() {
  const values = new Map();
  if (!existsSync(envPath)) return values;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values.set(match[1], match[2].trim().replace(/^['"]|['"]$/g, ""));
  }
  return values;
}

function stripShaPrefix(value) {
  return String(value || "").replace(/^sha256:/i, "").trim().toLowerCase();
}

function envKeySuffix(value) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

async function main() {
  const env = readEnvFile();
  const rpcUrl = env.get("IOTA_EVM_RPC_URL") || "https://json-rpc.evm.testnet.iota.cafe";
  const contractAddress = getAddress(env.get("IOTA_EVM_ANCHOR_CONTRACT_V2") || "");
  const publisherAddress = getAddress(env.get("IOTA_EVM_DEPLOYER_ADDRESS") || "");
  const provider = new JsonRpcProvider(rpcUrl, 1076, { batchMaxCount: 1 });
  const network = await provider.getNetwork();
  assert.equal(network.chainId, 1076n, "unexpected IOTA EVM chain id");

  const contract = new Contract(contractAddress, IOTA_ABI, provider);
  assert.equal(await contract.authorizedPublishers(publisherAddress), true, "publisher is not authorized");
  const tenantIdHash = createHash("sha256").update("public-demo", "utf8").digest("hex");
  const checks = [];

  for (const demoCase of buildPublicProofDemoCases()) {
    const txHash = env.get(`PUBLIC_PROOF_DEMO_IOTA_V2_TX_HASH_${envKeySuffix(demoCase.id)}`);
    assert.match(String(txHash || ""), /^0x[0-9a-f]{64}$/i, `missing V2 tx for ${demoCase.id}`);
    const argumentsList = [
      `0x${stripShaPrefix(demoCase.merkle_root)}`,
      `0x${tenantIdHash}`,
      demoCase.resource_type,
      demoCase.resource_id,
      demoCase.events.length,
      `0x${stripShaPrefix(demoCase.public_receipt.receipt_hash)}`,
    ];
    const proofId = await contract.computeProofId(...argumentsList);
    const [anchored, record, transaction, receipt] = await Promise.all([
      contract.isAnchored(proofId),
      contract.evidenceRecord(proofId),
      provider.getTransaction(txHash),
      provider.getTransactionReceipt(txHash),
    ]);

    assert.equal(anchored, true, `${demoCase.id} proof is not anchored`);
    assert.ok(transaction, `${demoCase.id} transaction not found`);
    assert.ok(receipt, `${demoCase.id} receipt not found`);
    assert.equal(receipt.status, 1, `${demoCase.id} transaction reverted`);
    assert.equal(getAddress(transaction.to || ""), contractAddress, `${demoCase.id} target mismatch`);
    assert.equal(getAddress(transaction.from), publisherAddress, `${demoCase.id} publisher mismatch`);
    const decoded = contract.interface.decodeFunctionData("anchorEvidence", transaction.data);
    assert.equal(decoded[0], argumentsList[0], `${demoCase.id} Merkle root mismatch`);
    assert.equal(decoded[1], argumentsList[1], `${demoCase.id} tenant hash mismatch`);
    assert.equal(decoded[2], argumentsList[2], `${demoCase.id} resource type mismatch`);
    assert.equal(decoded[3], argumentsList[3], `${demoCase.id} resource id mismatch`);
    assert.equal(decoded[4], BigInt(argumentsList[4]), `${demoCase.id} event count mismatch`);
    assert.equal(decoded[5], argumentsList[5], `${demoCase.id} memo hash mismatch`);
    assert.equal(record.merkleRoot, argumentsList[0]);
    assert.equal(record.tenantIdHash, argumentsList[1]);
    assert.equal(record.memoHash, argumentsList[5]);
    assert.equal(getAddress(record.publisher), publisherAddress);
    assert.equal(record.eventCount, BigInt(argumentsList[4]));
    assert.ok(record.anchoredAt > 0n);

    checks.push({
      case_id: demoCase.id,
      proof_id: proofId,
      tx_hash: txHash,
      block_number: receipt.blockNumber,
      confirmations: await receipt.confirmations(),
      record_matches: true,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    network: "iota-evm-testnet",
    chain_id: Number(network.chainId),
    contract: contractAddress,
    publisher_authorized: true,
    proofs: checks,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    reason: error instanceof Error ? error.message : "verify_public_proof_iota_v2_failed",
  }));
  process.exit(1);
});
