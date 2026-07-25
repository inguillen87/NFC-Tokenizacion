import assert from "node:assert/strict";
import test from "node:test";
import { Transaction, Wallet } from "ethers";
import { validateRecoveredIotaSigned } from "../src/server.mjs";

const wallet = new Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a841cb6b37e8db1e1cb");
const contractAddress = "0x0000000000000000000000000000000000000001";
const chainId = 1076;
const data = "0x1234";

async function fixture() {
  const rawTransaction = await wallet.signTransaction({
    type: 2,
    chainId,
    to: contractAddress,
    data,
    nonce: 9,
    value: 0,
    gasLimit: 50_000,
    maxFeePerGas: 10,
    maxPriorityFeePerGas: 1,
  });
  const parsed = Transaction.from(rawTransaction);
  return {
    input: { chainId, contractAddress },
    reservation: {
      rawTransaction,
      txHash: parsed.hash,
      signerAddress: wallet.address,
      chainId,
      nonce: 9,
    },
  };
}

test("recovered raw bytes are cryptographically bound to signer, chain, nonce, target and calldata", async () => {
  const { input, reservation } = await fixture();
  const recovered = validateRecoveredIotaSigned(reservation, input, wallet.address, data);
  assert.equal(recovered.rawTransaction, reservation.rawTransaction);
  assert.equal(recovered.txHash, reservation.txHash);
  assert.equal(recovered.signerAddress, wallet.address);
  assert.equal(recovered.chainId, chainId);
  assert.equal(recovered.nonce, 9);
});

test("recovery rejects altered calldata, hash, signer metadata, chain metadata, or nonce metadata", async () => {
  const { input, reservation } = await fixture();
  assert.throws(
    () => validateRecoveredIotaSigned(reservation, input, wallet.address, "0xabcd"),
    /kms_signed_transaction_data_mismatch/,
  );
  assert.throws(
    () => validateRecoveredIotaSigned({ ...reservation, txHash: `0x${"ab".repeat(32)}` }, input, wallet.address, data),
    /iota_recovered_transaction_hash_mismatch/,
  );
  assert.throws(
    () => validateRecoveredIotaSigned({ ...reservation, signerAddress: `0x${"22".repeat(20)}` }, input, wallet.address, data),
    /iota_recovered_transaction_metadata_mismatch/,
  );
  assert.throws(
    () => validateRecoveredIotaSigned({ ...reservation, chainId: 1077 }, input, wallet.address, data),
    /iota_recovered_transaction_metadata_mismatch/,
  );
  assert.throws(
    () => validateRecoveredIotaSigned({ ...reservation, nonce: 10 }, input, wallet.address, data),
    /iota_recovered_transaction_metadata_mismatch/,
  );
});
