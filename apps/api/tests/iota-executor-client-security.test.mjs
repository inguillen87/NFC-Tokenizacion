import assert from "node:assert/strict";
import test from "node:test";

const {
  computeIotaEvidenceProofId,
  prepareIotaEvidence,
  publishIotaEvidence,
  resolveIotaEvidenceRuntimeConfig,
} = await import("../src/lib/iota-evidence-writer.ts");

const CONTRACT = "0x1111111111111111111111111111111111111111";
const OTHER_CONTRACT = "0x3333333333333333333333333333333333333333";
const PUBLISHER = "0x2222222222222222222222222222222222222222";
const TX_HASH = `0x${"ab".repeat(32)}`;

function fixture() {
  const prepared = prepareIotaEvidence({
    tenantId: "tenant-security-test",
    resourceType: "batch",
    publicResourceId: "nx-security-test",
    eventHashes: [`sha256:${"11".repeat(32)}`],
    canonicalizationVersion: "security-test-v1",
  });
  const proofId = computeIotaEvidenceProofId({
    chainId: 1076,
    contractAddress: CONTRACT,
    merkleRoot: prepared.merkleRoot,
    tenantIdHash: prepared.tenantIdHash,
    resourceType: prepared.resourceType,
    resourceId: prepared.publicResourceId,
    eventCount: prepared.eventCount,
    memoHash: prepared.memoHash,
  });
  return {
    prepared,
    target: {
      chainId: 1076,
      contractAddress: CONTRACT,
      contractVersion: "evidence_anchor_v2",
      proofId,
      alreadyAnchored: false,
      publisherAddress: null,
      anchoredAt: null,
    },
  };
}

function source(overrides = {}) {
  return {
    NODE_ENV: "production",
    IOTA_PROVIDER_MODE: "iota_evm_contract_v2",
    IOTA_EVM_RPC_URL: "https://rpc.example.test",
    IOTA_EVM_ANCHOR_CONTRACT_V2: CONTRACT,
    IOTA_EVM_EXPECTED_CHAIN_ID: "1076",
    IOTA_PROOF_EXECUTOR_URL: "https://executor.example.test/anchor-evidence",
    IOTA_PROOF_EXECUTOR_SECRET: "unit-test-secret",
    ...overrides,
  };
}

function jsonResponse(value, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  const body = typeof value === "string" ? value : JSON.stringify(value);
  return new Response(body, { ...init, headers });
}

function submittedResponse(target, overrides = {}) {
  return {
    ok: true,
    state: "submitted",
    already_anchored: false,
    proof_id: target.proofId,
    chain_id: target.chainId,
    contract_address: target.contractAddress,
    publisher_address: PUBLISHER,
    tx_hash: TX_HASH,
    nonce: 7,
    block_number: null,
    block_hash: null,
    confirmations: 0,
    anchored_at: null,
    ...overrides,
  };
}

async function rejectsCode(promise, expected) {
  await assert.rejects(promise, (error) => {
    assert.equal(error?.name, "IotaExecutorClientError");
    assert.equal(error?.message, expected);
    return true;
  });
}

test("production IOTA executor requires HTTPS, a URL, and a secret", async () => {
  assert.throws(
    () => resolveIotaEvidenceRuntimeConfig(source({ IOTA_PROOF_EXECUTOR_URL: "http://127.0.0.1:8787/anchor" })),
    (error) => error?.name === "IotaExecutorClientError"
      && error?.message === "iota_executor_https_required_in_production",
  );

  const { prepared, target } = fixture();
  let fetchCalls = 0;
  const shouldNotFetch = async () => {
    fetchCalls += 1;
    throw new Error("unexpected_fetch");
  };
  await rejectsCode(publishIotaEvidence(
    prepared,
    target,
    resolveIotaEvidenceRuntimeConfig(source({ IOTA_PROOF_EXECUTOR_URL: "" })),
    "request-no-url",
    { fetchImpl: shouldNotFetch },
  ), "iota_executor_required_in_production");
  await rejectsCode(publishIotaEvidence(
    prepared,
    target,
    resolveIotaEvidenceRuntimeConfig(source({ IOTA_PROOF_EXECUTOR_SECRET: "" })),
    "request-no-secret",
    { fetchImpl: shouldNotFetch },
  ), "iota_executor_secret_required_in_production");
  assert.equal(fetchCalls, 0);
});

test("development permits a localhost HTTP executor and sends a bounded no-redirect request", async () => {
  const { prepared, target } = fixture();
  const config = resolveIotaEvidenceRuntimeConfig(source({
    NODE_ENV: "development",
    IOTA_PROOF_EXECUTOR_URL: "http://127.0.0.1:8787/anchor",
  }));
  let observed;
  let submitted;
  const result = await publishIotaEvidence(prepared, target, config, "request-dev", {
    fetchImpl: async (url, init) => {
      observed = { url: String(url), init };
      return jsonResponse(submittedResponse(target));
    },
    onSubmitted(value) {
      submitted = value;
    },
  });

  assert.equal(observed.url, "http://127.0.0.1:8787/anchor");
  assert.equal(observed.init.redirect, "error");
  assert.equal(observed.init.headers["x-iota-proof-secret"], "unit-test-secret");
  assert.equal(observed.init.headers["idempotency-key"], target.proofId);
  assert.ok(observed.init.signal instanceof AbortSignal);
  assert.equal(result.txHash, TX_HASH);
  assert.deepEqual(submitted, { txHash: TX_HASH, publisherAddress: PUBLISHER, nonce: 7 });
});

test("IOTA executor request and response stream share a bounded timeout", async () => {
  const { prepared, target } = fixture();
  const config = resolveIotaEvidenceRuntimeConfig(source({ IOTA_PROOF_EXECUTOR_TIMEOUT_MS: "100" }));
  await rejectsCode(publishIotaEvidence(prepared, target, config, "request-timeout", {
    fetchImpl: async () => await new Promise(() => {}),
  }), "iota_executor_request_timeout");
  await rejectsCode(publishIotaEvidence(prepared, target, config, "response-timeout", {
    fetchImpl: async () => new Response(new ReadableStream({ start() {} }), {
      headers: { "content-type": "application/json" },
    }),
  }), "iota_executor_request_timeout");
});

test("IOTA executor response is bounded to 64 KiB and must be valid JSON", async () => {
  const { prepared, target } = fixture();
  const config = resolveIotaEvidenceRuntimeConfig(source());
  const publish = (response) => publishIotaEvidence(prepared, target, config, "request-body", {
    fetchImpl: async () => response,
  });

  await rejectsCode(publish(jsonResponse("x".repeat((64 * 1024) + 1))), "iota_executor_response_too_large");
  await rejectsCode(
    publish(new Response("{}", { headers: { "content-type": "text/plain" } })),
    "iota_executor_content_type_invalid",
  );
  await rejectsCode(publish(jsonResponse("{not-json")), "iota_executor_json_invalid");
});

test("IOTA executor accepts only protocol-consistent chain evidence", async (t) => {
  const { prepared, target } = fixture();
  const config = resolveIotaEvidenceRuntimeConfig(source());
  const cases = [
    ["unsuccessful response", { ok: false }, "iota_executor_response_unsuccessful"],
    ["unknown state", { state: "processing" }, "iota_executor_state_invalid"],
    ["invalid tx", { tx_hash: "0x1234" }, "iota_executor_tx_hash_invalid"],
    ["mismatched proof", { proof_id: `0x${"cd".repeat(32)}` }, "iota_executor_proof_id_mismatch"],
    ["invalid chain type", { chain_id: "1076" }, "iota_executor_chain_id_invalid"],
    ["mismatched contract", { contract_address: OTHER_CONTRACT }, "iota_executor_contract_mismatch"],
    ["invalid publisher", { publisher_address: "not-an-address" }, "iota_executor_publisher_invalid"],
    ["missing anchored flag", { already_anchored: undefined }, "iota_executor_already_anchored_invalid"],
    ["inconsistent submitted state", { already_anchored: true }, "iota_executor_state_inconsistent"],
  ];
  for (const [name, overrides, code] of cases) {
    await t.test(name, async () => {
      await rejectsCode(publishIotaEvidence(prepared, target, config, `request-${name}`, {
        fetchImpl: async () => jsonResponse(submittedResponse(target, overrides)),
      }), code);
    });
  }

  const confirmed = await publishIotaEvidence(prepared, target, config, "request-confirmed", {
    fetchImpl: async () => jsonResponse(submittedResponse(target, {
      state: "confirmed",
      already_anchored: true,
      tx_hash: null,
      nonce: null,
      anchored_at: 1_752_000_000,
    })),
  });
  assert.equal(confirmed.alreadyAnchored, true);
  assert.equal(confirmed.txHash, null);
  assert.equal(confirmed.anchoredAt, 1_752_000_000);
});

test("IOTA executor failures never expose URL, secret, or response body", async () => {
  const { prepared, target } = fixture();
  const config = resolveIotaEvidenceRuntimeConfig(source());
  const sensitive = "https://executor.example.test/?secret=private body=tenant-data";
  await rejectsCode(publishIotaEvidence(prepared, target, config, "request-network-error", {
    fetchImpl: async () => { throw new Error(sensitive); },
  }), "iota_executor_request_failed");
  await rejectsCode(publishIotaEvidence(prepared, target, config, "request-http-error", {
    fetchImpl: async () => jsonResponse({ secret: sensitive }, { status: 502 }),
  }), "iota_executor_http_502");
});

test("an already anchored production proof remains readable without executor credentials", async () => {
  const { prepared, target } = fixture();
  const existingTarget = {
    ...target,
    alreadyAnchored: true,
    publisherAddress: PUBLISHER,
    anchoredAt: 1_752_000_000,
  };
  const config = resolveIotaEvidenceRuntimeConfig(source({
    IOTA_PROOF_EXECUTOR_URL: "",
    IOTA_PROOF_EXECUTOR_SECRET: "",
  }));
  const result = await publishIotaEvidence(prepared, existingTarget, config, "request-existing", {
    fetchImpl: async () => { throw new Error("unexpected_fetch"); },
  });
  assert.equal(result.alreadyAnchored, true);
  assert.equal(result.publisherAddress, PUBLISHER);
  assert.equal(result.txHash, null);
});
