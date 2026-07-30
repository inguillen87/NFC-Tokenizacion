import assert from "node:assert/strict";
import test from "node:test";
import {
  createPolygonMintQueue,
  reconcileExistingPolygonMint,
  runPolygonMintIdempotently,
} from "../src/polygon-idempotency.mjs";
import { buildPolygonMintIntentDigest } from "../src/polygon-mint-intent.mjs";
import { mintUnlocked } from "../src/server.mjs";

const contractAddress = "0x00000000000000000000000000000000000000A1";
const recipient = "0x00000000000000000000000000000000000000B2";
const expected = {
  contractAddress,
  recipient,
  chipUidHash: `sha256:${"ab".repeat(32)}`,
  tokenUri: "https://api.nexid.lat/public/polygon/assets/nx-test",
  assetRef: "batch-2026:nx-test",
  requestId: "11111111-1111-4111-8111-111111111111",
  tenantId: "22222222-2222-4222-8222-222222222222",
  leaseId: "33333333-3333-4333-8333-333333333333",
  network: "polygon-amoy",
  executionClass: "testnet_trial",
  commercialDisposition: "NON_SELLABLE",
};
expected.intentDigest = buildPolygonMintIntentDigest({
  requestId: expected.requestId,
  tenantId: expected.tenantId,
  leaseId: expected.leaseId,
  network: expected.network,
  executionClass: expected.executionClass,
  commercialDisposition: expected.commercialDisposition,
  issuerWallet: expected.recipient,
  chipUidHash: expected.chipUidHash,
  tokenUri: expected.tokenUri,
  assetRef: expected.assetRef,
});
Object.freeze(expected);

function executorMintBody(overrides = {}) {
  return {
    request_id: expected.requestId,
    tenant_id: expected.tenantId,
    lease_id: expected.leaseId,
    network: expected.network,
    execution_class: expected.executionClass,
    commercial_disposition: expected.commercialDisposition,
    issuer_wallet: expected.recipient,
    chip_uid_hash: expected.chipUidHash,
    token_uri: expected.tokenUri,
    asset_ref: expected.assetRef,
    intent_digest: expected.intentDigest,
    ...overrides,
  };
}

function matchingContract(overrides = {}) {
  const state = {
    tokenId: 27n,
    chipUidHash: expected.chipUidHash,
    owner: recipient,
    tokenUri: expected.tokenUri,
    assetRef: expected.assetRef,
    ...overrides,
  };
  return {
    async tokenByChipHash() { return state.tokenId; },
    async chipUidHashByTokenId() { return state.chipUidHash; },
    async ownerOf() { return state.owner; },
    async tokenURI() { return state.tokenUri; },
    async assetRefByTokenId() { return state.assetRef; },
  };
}

async function withProcessEnv(overrides, operation) {
  const previous = Object.fromEntries(Object.keys(overrides).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  try {
    return await operation();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test("the real Polygon executor boundary returns an exact replay before wrapped-KMS decrypt/sign/mint", async () => {
  const calls = { decrypt: 0, sign: 0, mint: 0 };
  const readContract = matchingContract();
  const mintWithChipHash = async () => { calls.mint += 1; throw new Error("must_not_mint"); };
  mintWithChipHash.populateTransaction = async () => { calls.mint += 1; return { data: "0x" }; };
  mintWithChipHash.estimateGas = async () => { calls.mint += 1; return 1n; };
  readContract.mintWithChipHash = mintWithChipHash;

  await withProcessEnv({
    EXECUTOR_SIGNER_MODE: "kms_wrapped",
    POLYGON_RPC_URL: "https://polygon-rpc.example.test",
    POLYGON_CONTRACT_ADDRESS: contractAddress,
    POLYGON_EXPECTED_CHAIN_ID: "80002",
    POLYGON_KMS_PUBLISHER_ADDRESS: undefined,
  }, async () => {
    const result = await mintUnlocked(executorMintBody(), {
      provider: { async getNetwork() { return { chainId: 80002n }; } },
      readContract,
      async polygonMintIntentAuthorizer() { return { mode: "reconcile" }; },
      async signWithWrappedKms() {
        calls.decrypt += 1;
        calls.sign += 1;
        throw new Error("must_not_sign");
      },
    });
    assert.equal(result.token_id, "27");
    assert.equal(result.already_minted, true);
  });

  assert.deepEqual(calls, { decrypt: 0, sign: 0, mint: 0 });
});

test("the real executor preserves a first Polygon mint and confirms its exact binding", async () => {
  let minted = false;
  let mintCalls = 0;
  const readContract = matchingContract({ tokenId: 0n });
  readContract.tokenByChipHash = async () => minted ? 27n : 0n;
  const signingContract = {
    async mintWithChipHash(to, chipUidHash, tokenUri, assetRef) {
      mintCalls += 1;
      assert.equal(to, expected.recipient.toLowerCase());
      assert.equal(chipUidHash, expected.chipUidHash);
      assert.equal(tokenUri, expected.tokenUri);
      assert.equal(assetRef, expected.assetRef);
      minted = true;
      return {
        hash: `0x${"34".repeat(32)}`,
        async wait() {
          return {
            status: 1,
            blockNumber: 12345,
            logs: [{
              topics: [
                "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
                `0x${"00".repeat(32)}`,
                `0x${"00".repeat(12)}${expected.recipient.slice(2).toLowerCase()}`,
                `0x${27n.toString(16).padStart(64, "0")}`,
              ],
            }],
          };
        },
      };
    },
  };

  await withProcessEnv({
    EXECUTOR_SIGNER_MODE: "private_key",
    POLYGON_RPC_URL: "https://polygon-rpc.example.test",
    POLYGON_CONTRACT_ADDRESS: contractAddress,
    POLYGON_EXPECTED_CHAIN_ID: "80002",
    POLYGON_MINTER_PRIVATE_KEY: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a841cb6b37e8db1e1cb",
  }, async () => {
    const result = await mintUnlocked(executorMintBody(), {
      provider: { async getNetwork() { return { chainId: 80002n }; } },
      readContract,
      signingContract,
      async polygonMintIntentAuthorizer() { return { mode: "dispatch" }; },
    });
    assert.equal(result.token_id, "27");
    assert.equal(result.tx_hash, `0x${"34".repeat(32)}`);
    assert.equal(result.block_number, 12345);
    assert.equal(result.already_minted, false);
    assert.equal(result.reconciled, false);
    assert.equal(result.evidence_source, "confirmed_transaction_and_on_chain_state");
  });
  assert.equal(mintCalls, 1);
});

test("exact Polygon replay returns canonical chain evidence without decrypting, signing, or minting", async () => {
  const calls = { decrypt: 0, sign: 0, mint: 0 };
  const result = await runPolygonMintIdempotently({
    inspect: () => reconcileExistingPolygonMint({ contract: matchingContract(), ...expected }),
    submit: async () => {
      calls.decrypt += 1;
      calls.sign += 1;
      calls.mint += 1;
      throw new Error("must_not_submit");
    },
  });

  assert.deepEqual(calls, { decrypt: 0, sign: 0, mint: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.already_minted, true);
  assert.equal(result.reconciled, true);
  assert.equal(result.tx_hash, null);
  assert.equal(result.token_id, "27");
  assert.equal(result.binding.contract_address, contractAddress);
  assert.equal(result.binding.recipient, recipient.toLowerCase());
  assert.equal(result.binding.chip_uid_hash, expected.chipUidHash);
  assert.equal(result.binding.token_uri, expected.tokenUri);
  assert.equal(result.binding.asset_ref, expected.assetRef);
});

test("an existing token with any mismatched binding fails closed before KMS or mint", async (t) => {
  const mismatches = [
    ["chip hash", { chipUidHash: `sha256:${"cd".repeat(32)}` }],
    ["recipient", { owner: "0x00000000000000000000000000000000000000C3" }],
    ["token URI", { tokenUri: "https://attacker.invalid/token.json" }],
    ["asset ref", { assetRef: "different-batch:different-asset" }],
  ];

  for (const [name, override] of mismatches) {
    await t.test(name, async () => {
      const calls = { decrypt: 0, sign: 0, mint: 0 };
      await assert.rejects(
        () => runPolygonMintIdempotently({
          inspect: () => reconcileExistingPolygonMint({ contract: matchingContract(override), ...expected }),
          submit: async () => {
            calls.decrypt += 1;
            calls.sign += 1;
            calls.mint += 1;
          },
        }),
        /polygon_existing_binding_mismatch/,
      );
      assert.deepEqual(calls, { decrypt: 0, sign: 0, mint: 0 });
    });
  }
});

test("an ambiguous submit is reconciled from chain only when the exact binding appeared", async () => {
  let inspections = 0;
  let submitCalls = 0;
  const result = await runPolygonMintIdempotently({
    inspect: async () => {
      inspections += 1;
      return inspections === 1
        ? null
        : reconcileExistingPolygonMint({ contract: matchingContract(), ...expected });
    },
    submit: async () => {
      submitCalls += 1;
      throw new Error("rpc_receipt_timeout");
    },
  });

  assert.equal(submitCalls, 1);
  assert.equal(inspections, 2);
  assert.equal(result.token_id, "27");
  assert.equal(result.recovered_after_submit_error, true);
});

test("an ambiguous submit preserves the original error when no token exists", async () => {
  let inspections = 0;
  await assert.rejects(
    () => runPolygonMintIdempotently({
      inspect: async () => { inspections += 1; return null; },
      submit: async () => { throw new Error("rpc_receipt_timeout"); },
    }),
    /rpc_receipt_timeout/,
  );
  assert.equal(inspections, 2);
});

test("an ambiguous submit never reconciles a different on-chain binding", async () => {
  let inspections = 0;
  await assert.rejects(
    () => runPolygonMintIdempotently({
      inspect: async () => {
        inspections += 1;
        return inspections === 1
          ? null
          : reconcileExistingPolygonMint({
            contract: matchingContract({ assetRef: "different-batch:different-asset" }),
            ...expected,
          });
      },
      submit: async () => { throw new Error("rpc_receipt_timeout"); },
    }),
    /polygon_existing_binding_mismatch/,
  );
  assert.equal(inspections, 2);
});

test("malformed or unreadable existing chain state fails closed before submit", async (t) => {
  await t.test("malformed token id", async () => {
    let submitCalls = 0;
    await assert.rejects(
      () => runPolygonMintIdempotently({
        inspect: () => reconcileExistingPolygonMint({ contract: matchingContract({ tokenId: "invalid" }), ...expected }),
        submit: async () => { submitCalls += 1; },
      }),
      /polygon_existing_token_id_invalid/,
    );
    assert.equal(submitCalls, 0);
  });

  await t.test("binding getter failure", async () => {
    let submitCalls = 0;
    const contract = matchingContract();
    contract.tokenURI = async () => { throw new Error("rpc_internal_detail"); };
    await assert.rejects(
      () => runPolygonMintIdempotently({
        inspect: () => reconcileExistingPolygonMint({ contract, ...expected }),
        submit: async () => { submitCalls += 1; },
      }),
      /polygon_existing_binding_unverifiable/,
    );
    assert.equal(submitCalls, 0);
  });
});

test("the per-instance queue prevents concurrent requests from reusing a nonce or KMS signer", async () => {
  const enqueue = createPolygonMintQueue();
  let minted = false;
  let decryptCalls = 0;
  let signCalls = 0;
  let mintCalls = 0;
  const operation = () => runPolygonMintIdempotently({
    inspect: async () => minted
      ? reconcileExistingPolygonMint({ contract: matchingContract(), ...expected })
      : null,
    submit: async () => {
      decryptCalls += 1;
      signCalls += 1;
      mintCalls += 1;
      await new Promise((resolve) => setImmediate(resolve));
      minted = true;
      return { ok: true, token_id: "27", tx_hash: `0x${"12".repeat(32)}` };
    },
  });

  const [first, replay] = await Promise.all([enqueue(operation), enqueue(operation)]);
  assert.equal(first.tx_hash, `0x${"12".repeat(32)}`);
  assert.equal(replay.already_minted, true);
  assert.deepEqual({ decryptCalls, signCalls, mintCalls }, { decryptCalls: 1, signCalls: 1, mintCalls: 1 });
});
