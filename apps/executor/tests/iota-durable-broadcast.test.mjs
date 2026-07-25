import assert from "node:assert/strict";
import test from "node:test";
import { runDurableIotaBroadcast } from "../src/iota-durable-broadcast.mjs";

const proofId = `0x${"ab".repeat(32)}`;
const txHash = `0x${"cd".repeat(32)}`;
const leaseToken = "11111111-1111-4111-8111-111111111111";
const signed = {
  rawTransaction: "0x1234",
  txHash,
  signerAddress: `0x${"12".repeat(20)}`,
  chainId: 1076,
  nonce: 9,
};

function input(reservation = { recover: false, state: "reserved" }, createSigned = async () => signed) {
  return {
    reservation,
    proofId,
    leaseToken,
    createSigned,
    buildResponse: ({ transaction, recoveredAfterBroadcastError }) => ({
      ok: true,
      state: "submitted",
      tx_hash: transaction.hash,
      nonce: transaction.nonce,
      recovered_after_broadcast_error: recoveredAfterBroadcastError,
    }),
  };
}

function dependencies(events, overrides = {}) {
  return {
    async persistSigned(_proofId, _leaseToken, envelope) {
      events.push(["persist_signed", envelope.rawTransaction]);
    },
    async persistBroadcast(_proofId, _leaseToken, hash) {
      events.push(["persist_broadcast", hash]);
    },
    async persistSubmitted(_proofId, _leaseToken, response) {
      events.push(["persist_submitted", response.tx_hash]);
    },
    async broadcast(rawTransaction) {
      events.push(["broadcast", rawTransaction]);
      return { hash: txHash, nonce: 9 };
    },
    async lookup(hash) {
      events.push(["lookup", hash]);
      return null;
    },
    ...overrides,
  };
}

test("the exact raw transaction is durable before the first broadcast", async () => {
  const events = [];
  const result = await runDurableIotaBroadcast(input(undefined, async () => {
    events.push(["sign"]);
    return signed;
  }), dependencies(events));
  assert.equal(result.tx_hash, txHash);
  assert.deepEqual(events.map(([event]) => event), [
    "sign",
    "persist_signed",
    "broadcast",
    "persist_broadcast",
    "persist_submitted",
  ]);
});

test("lease recovery rebroadcasts persisted bytes and never invokes the signer", async () => {
  const events = [];
  let signCalls = 0;
  const reservation = { recover: true, state: "signed", ...signed };
  await runDurableIotaBroadcast(input(reservation, async () => {
    signCalls += 1;
    throw new Error("signer_must_not_run");
  }), dependencies(events));
  assert.equal(signCalls, 0);
  assert.deepEqual(events.map(([event]) => event), ["broadcast", "persist_broadcast", "persist_submitted"]);
  assert.equal(events[0][1], signed.rawTransaction);
});

test("an accepted-but-errored broadcast is reconciled by hash and submitted", async () => {
  const events = [];
  const deps = dependencies(events, {
    async broadcast(rawTransaction) {
      events.push(["broadcast", rawTransaction]);
      throw new Error("rpc_response_lost");
    },
    async lookup(hash) {
      events.push(["lookup", hash]);
      return { hash };
    },
  });
  const result = await runDurableIotaBroadcast(input(), deps);
  assert.equal(result.recovered_after_broadcast_error, true);
  assert.deepEqual(events.map(([event]) => event), [
    "persist_signed",
    "broadcast",
    "lookup",
    "persist_broadcast",
    "persist_submitted",
  ]);
});

test("an unobserved broadcast failure leaves the row signed for exact retry", async () => {
  const events = [];
  const deps = dependencies(events, {
    async broadcast(rawTransaction) {
      events.push(["broadcast", rawTransaction]);
      throw new Error("rpc_unavailable");
    },
  });
  await assert.rejects(() => runDurableIotaBroadcast(input(), deps), /rpc_unavailable/);
  assert.deepEqual(events.map(([event]) => event), ["persist_signed", "broadcast", "lookup"]);
});

test("broadcast hash and nonce mismatches fail closed and cannot be hidden by lookup", async () => {
  for (const [transaction, error] of [
    [{ hash: `0x${"ef".repeat(32)}`, nonce: 9 }, /iota_broadcast_tx_hash_mismatch/],
    [{ hash: txHash, nonce: 10 }, /iota_broadcast_nonce_mismatch/],
  ]) {
    const events = [];
    const deps = dependencies(events, {
      async broadcast(rawTransaction) {
        events.push(["broadcast", rawTransaction]);
        return transaction;
      },
    });
    await assert.rejects(() => runDurableIotaBroadcast(input(), deps), error);
    assert.deepEqual(events.map(([event]) => event), ["persist_signed", "broadcast"]);
  }
});

test("submitted recovery reconstructs a missing response without moving state backward", async () => {
  const events = [];
  const reservation = { recover: true, state: "submitted", ...signed };
  await runDurableIotaBroadcast(input(reservation), dependencies(events));
  assert.deepEqual(events.map(([event]) => event), ["broadcast", "persist_submitted"]);
});
