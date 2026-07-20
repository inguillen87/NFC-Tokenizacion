import assert from "node:assert/strict";
import { network } from "hardhat";

async function expectRevert(operation, label) {
  let reverted = false;
  try {
    await operation();
  } catch {
    reverted = true;
  }
  assert.equal(reverted, true, label);
}

async function main() {
  const connection = await network.create();
  const { ethers } = connection;
  const [owner, publisher, outsider] = await ethers.getSigners();
  const contract = await ethers.deployContract(
    "NexidEvidenceAnchor",
    [owner.address, publisher.address],
    owner,
  );
  await contract.waitForDeployment();

  const evidence = [
    `0x${"11".repeat(32)}`,
    `0x${"22".repeat(32)}`,
    "pharma_batch",
    "PHR-LOT-2026-0142",
    3,
    `0x${"33".repeat(32)}`,
  ];

  assert.equal(await contract.SCHEMA_VERSION(), 2n);
  assert.equal(await contract.authorizedPublishers(publisher.address), true);
  assert.equal(await contract.authorizedPublishers(outsider.address), false);

  await expectRevert(
    () => contract.connect(outsider).anchorEvidence(...evidence),
    "an unauthorized wallet must not publish evidence",
  );

  const proofId = await contract.computeProofId(...evidence);
  const tx = await contract.connect(publisher).anchorEvidence(...evidence);
  await tx.wait();
  assert.equal(await contract.isAnchored(proofId), true);

  const record = await contract.evidenceRecord(proofId);
  assert.equal(record.merkleRoot, evidence[0]);
  assert.equal(record.tenantIdHash, evidence[1]);
  assert.equal(record.memoHash, evidence[5]);
  assert.equal(record.publisher, publisher.address);
  assert.equal(record.eventCount, 3n);
  assert.ok(record.anchoredAt > 0n);

  await expectRevert(
    () => contract.connect(publisher).anchorEvidence(...evidence),
    "the same business proof must not be anchored twice",
  );

  await (await contract.connect(owner).setPublisher(publisher.address, false)).wait();
  await expectRevert(
    () => contract.connect(publisher).anchorEvidence(
      `0x${"44".repeat(32)}`,
      ...evidence.slice(1),
    ),
    "a revoked publisher must lose write access",
  );

  await (await contract.connect(owner).setPublisher(outsider.address, true)).wait();
  assert.equal(await contract.authorizedPublishers(outsider.address), true);

  console.log(JSON.stringify({
    ok: true,
    contract: "NexidEvidenceAnchor",
    checks: [
      "authorized publisher",
      "unauthorized publisher rejected",
      "on-chain record readable",
      "duplicate proof rejected",
      "publisher revocation enforced",
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
