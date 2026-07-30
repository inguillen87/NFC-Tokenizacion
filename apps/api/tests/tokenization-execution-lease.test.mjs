import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  prepareTokenizationExecution,
} from "../src/lib/tokenization-execution-lease.ts";
import {
  tokenizationExecutionGovernanceError,
  tokenizationFailurePolicy,
} from "../src/lib/tokenization-execution-policy.ts";
import { normalizeTokenizationStatus } from "../src/lib/tokenization-status.ts";

const tenantId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const leaseId = "33333333-3333-4333-8333-333333333333";

function acquiredRow(overrides = {}) {
  return {
    request_id: requestId,
    tenant_id: tenantId,
    disposition: "acquired",
    execution_class: "testnet_trial",
    network: "polygon-amoy",
    status: "processing",
    lease_id: leaseId,
    lease_expires_at: "2099-07-29T20:00:00.000Z",
    batch_id: "44444444-4444-4444-8444-444444444444",
    tag_id: "55555555-5555-4555-8555-555555555555",
    bid: "SYNGENTA-TRIAL-2026",
    uid_hex: "04AABBCCDDEEFF",
    source_event_id: "42",
    source_event_created_at: "2026-07-29T19:00:00.000Z",
    commercial_disposition: "NON_SELLABLE",
    external_call_allowed: true,
    ...overrides,
  };
}

test("prepare uses only tenant/request/lease/processor and trusts the strict DB readback", async () => {
  const calls = [];
  const query = async (strings, ...values) => {
    calls.push({ text: strings.join("?"), values });
    return [acquiredRow()];
  };
  const prepared = await prepareTokenizationExecution({
    tenantId,
    requestId,
    leaseId,
    processor: "internal_worker",
  }, query);

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /public\.nexid_prepare_tokenization_execution_v1/);
  assert.deepEqual(calls[0].values, [tenantId, requestId, leaseId, "internal_worker", 120]);
  assert.equal(prepared.disposition, "acquired");
  assert.equal(prepared.executionClass, "testnet_trial");
  assert.equal(prepared.commercialDisposition, "NON_SELLABLE");
  assert.equal(prepared.externalCallAllowed, true);
});

test("only acquired can authorize an external call and network/class mismatches fail closed", async () => {
  await assert.rejects(
    prepareTokenizationExecution({ tenantId, requestId, leaseId, processor: "admin_tokenize_endpoint" }, async () => [
      acquiredRow({ disposition: "busy", external_call_allowed: true }),
    ]),
    /tokenization_execution_prepare_readback_invalid/,
  );
  await assert.rejects(
    prepareTokenizationExecution({ tenantId, requestId, leaseId, processor: "admin_tokenize_endpoint" }, async () => [
      acquiredRow({ network: "polygon", execution_class: "testnet_trial" }),
    ]),
    /tokenization_execution_prepare_readback_invalid/,
  );
  await assert.rejects(
    prepareTokenizationExecution({ tenantId, requestId, leaseId, processor: "admin_tokenize_endpoint" }, async () => [
      acquiredRow({ commercial_disposition: "SELLABLE" }),
    ]),
    /tokenization_execution_prepare_readback_invalid/,
  );
  await assert.rejects(
    prepareTokenizationExecution({ tenantId, requestId, leaseId, processor: "admin_tokenize_endpoint" }, async () => [
      acquiredRow({
        execution_class: "live_chain",
        network: "polygon",
        commercial_disposition: "PRODUCTION_RELEASED",
      }),
    ]),
    /tokenization_execution_prepare_readback_invalid/,
  );
  await assert.rejects(
    prepareTokenizationExecution({ tenantId, requestId, leaseId, processor: "admin_tokenize_endpoint" }, async () => [
      acquiredRow({
        disposition: "simulation_only",
        execution_class: "simulation",
        network: "simulation",
        status: "simulated",
        commercial_disposition: "SELLABLE",
        external_call_allowed: false,
      }),
    ]),
    /tokenization_execution_prepare_readback_invalid/,
  );
});

test("anchored historical proofs remain readable after revocation without authorizing a resend", async () => {
  const revoked = await prepareTokenizationExecution(
    { tenantId, requestId, leaseId, processor: "internal_worker" },
    async () => [acquiredRow({
      disposition: "already_final",
      status: "anchored",
      lease_id: null,
      lease_expires_at: null,
      commercial_disposition: "REVOKED_HISTORICAL_PROOF",
      external_call_allowed: false,
    })],
  );
  assert.equal(revoked.disposition, "already_final");
  assert.equal(revoked.status, "anchored");
  assert.equal(revoked.commercialDisposition, "REVOKED_HISTORICAL_PROOF");
  assert.equal(revoked.externalCallAllowed, false);

  const currentlyNonSellable = await prepareTokenizationExecution(
    { tenantId, requestId, leaseId, processor: "internal_worker" },
    async () => [acquiredRow({
      disposition: "already_final",
      execution_class: "live_chain",
      network: "polygon",
      status: "anchored",
      lease_id: null,
      lease_expires_at: null,
      commercial_disposition: "HISTORICAL_PROOF_NOT_CURRENTLY_SELLABLE",
      external_call_allowed: false,
    })],
  );
  assert.equal(currentlyNonSellable.commercialDisposition, "HISTORICAL_PROOF_NOT_CURRENTLY_SELLABLE");
  assert.equal(currentlyNonSellable.externalCallAllowed, false);

  await assert.rejects(
    prepareTokenizationExecution(
      { tenantId, requestId, leaseId, processor: "internal_worker" },
      async () => [acquiredRow({
        disposition: "busy",
        commercial_disposition: "REVOKED_HISTORICAL_PROOF",
        external_call_allowed: false,
      })],
    ),
    /tokenization_execution_prepare_readback_invalid/,
  );
});

test("concurrent and mainnet readbacks preserve DB authority without granting a second send", async () => {
  const busy = await prepareTokenizationExecution(
    { tenantId, requestId, leaseId, processor: "internal_worker" },
    async () => [acquiredRow({
      disposition: "busy",
      lease_id: "66666666-6666-4666-8666-666666666666",
      external_call_allowed: false,
    })],
  );
  assert.equal(busy.disposition, "busy");
  assert.equal(busy.externalCallAllowed, false);

  const live = await prepareTokenizationExecution(
    { tenantId, requestId, leaseId, processor: "internal_worker" },
    async () => [acquiredRow({
      execution_class: "live_chain",
      network: "polygon",
      commercial_disposition: "COMMERCIAL_RELEASE",
    })],
  );
  assert.equal(live.executionClass, "live_chain");
  assert.equal(live.network, "polygon");
  assert.equal(live.externalCallAllowed, true);
});

test("post-send uncertainty is never retryable and raw provider errors are not exposed", () => {
  assert.deepEqual(
    tokenizationFailurePolicy(new Error("secret https://executor.invalid leaked"), "external_started"),
    {
      status: "reconciling",
      reason: "tokenization_execution_reconciliation_required",
      retryable: false,
    },
  );
  assert.deepEqual(
    tokenizationFailurePolicy(new Error("postgres internal details"), "pre_external"),
    {
      status: "blocked",
      reason: "tokenization_execution_unavailable",
      retryable: false,
    },
  );
  assert.deepEqual(
    tokenizationExecutionGovernanceError(Object.assign(new Error("function missing"), { code: "42883" })),
    {
      status: 503,
      reason: "tokenization_execution_governance_migration_required",
      requiredMigration: "20260729160000_0072_tokenization_marketplace_execution_governance.sql",
    },
  );
});

test("reconciliation remains a first-class non-retry status on every API normalizer", () => {
  assert.equal(normalizeTokenizationStatus("reconciling"), "reconciling");
  assert.equal(normalizeTokenizationStatus("reconcile_required"), "reconciling");
  assert.notEqual(normalizeTokenizationStatus("reconciling"), "pending");
  assert.notEqual(normalizeTokenizationStatus("reconciling"), "pending_retry");
  assert.equal(normalizeTokenizationStatus("provider_invented_state"), "blocked");
});

test("engine acquires the DB lease after simulation and before every external Polygon path", async () => {
  const source = await readFile(new URL("../src/lib/tokenization-engine.ts", import.meta.url), "utf8");
  const anchor = source.slice(
    source.indexOf("export async function anchorTokenizationRequest"),
    source.indexOf("export async function transferBlockchainToken"),
  );
  const simulation = anchor.indexOf('if (tokenizationMode === "simulated")');
  const prepare = anchor.indexOf("prepareTokenizationExecution({", simulation + 1);
  const externalStarted = anchor.indexOf("externalExecutionStarted = true");
  const executor = anchor.indexOf("runExternalExecutor(externalInput)");
  const direct = anchor.indexOf("runDirectPolygonMint(externalInput)");
  const local = anchor.indexOf("runLocalPolygonScript(externalInput)");
  const broadcastPersistence = anchor.indexOf("const broadcastRows = await sql");
  const verify = anchor.indexOf("verifyPolygonMintEvidence({");

  assert.ok(simulation >= 0 && prepare > simulation);
  assert.ok(externalStarted > prepare);
  assert.ok(executor > externalStarted);
  assert.ok(direct > prepare);
  assert.ok(local > prepare);
  assert.ok(broadcastPersistence > executor);
  assert.ok(verify > broadcastPersistence);
  assert.match(anchor, /prepared\.disposition !== "acquired" \|\| !prepared\.externalCallAllowed/);
  assert.match(anchor, /prepared\.network !== network/);
  assert.match(anchor, /prepared\.uidHex\.toUpperCase\(\)/);
  assert.match(source, /network === "polygon"\) throw new Error\("executor_required_for_live_chain"\)/);
  assert.equal(
    (anchor.match(/\n\s+commercial_disposition: prepared\.commercialDisposition,/g) || []).length,
    4,
  );
});

test("settlement is lease-owner CAS and uncertainty cannot return to the send queue", async () => {
  const engine = await readFile(new URL("../src/lib/tokenization-engine.ts", import.meta.url), "utf8");
  const anchor = engine.slice(
    engine.indexOf("export async function anchorTokenizationRequest"),
    engine.indexOf("export async function transferBlockchainToken"),
  );
  const postSend = anchor.slice(anchor.indexOf("externalExecutionStarted = true"));
  const worker = await readFile(new URL("../src/app/internal/tokenization/worker/route.ts", import.meta.url), "utf8");

  assert.match(anchor, /SET status = 'anchored'[\s\S]*AND status IN \('processing', 'reconciling'\)[\s\S]*AND lease_id = \$\{acquiredLeaseId\}::uuid[\s\S]*RETURNING id/);
  assert.match(anchor, /const broadcastRows = await sql[\s\S]*SET asset_ref = \$\{assetRef\}[\s\S]*issuer_wallet = \$\{expectedRecipient\}[\s\S]*tx_hash = \$\{txHash\}[\s\S]*token_id = \$\{externalTokenId\}[\s\S]*automatic_resend_forbidden: true[\s\S]*AND lease_id = \$\{acquiredLeaseId\}::uuid/);
  assert.match(anchor, /SET status = 'reconciling'[\s\S]*next_attempt_at = NULL[\s\S]*automatic_resend_forbidden: true[\s\S]*AND lease_id = \$\{acquiredLeaseId\}::uuid/);
  assert.doesNotMatch(postSend, /retryMs|nextAttemptAt|status = 'pending'/);
  assert.match(worker, /status = 'pending'/);
  assert.match(worker, /status = 'processing' AND lease_expires_at <= now\(\)/);
  assert.match(worker, /Number\.isSafeInteger\(requestedLimit\)/);
  assert.match(worker, /Buffer\.byteLength\(expected, "utf8"\) < 32/);
  assert.match(worker, /allFailed \? 503 : 200/);
  assert.match(worker, /network IN \('polygon-amoy', 'polygon'\)/);
  assert.doesNotMatch(worker, /status IN \('pending', 'failed'\)|interval '10 minutes'/);
  assert.doesNotMatch(worker, /UPDATE tokenization_requests[\s\S]*SET status = 'processing'/);
});

test("admin execution endpoint bounds input and preserves explicit busy/reconciliation semantics", async () => {
  const route = await readFile(new URL("../src/app/admin/tokenization/requests/route.ts", import.meta.url), "utf8");
  const post = route.slice(route.indexOf("export async function POST"));

  assert.match(post, /readBoundedJsonBody<unknown>\(req, MAX_TOKENIZATION_EXECUTION_BODY_BYTES\)/);
  assert.match(post, /resolveTokenizationRequestTenantId\(\{ requestId, forcedTenantSlug \}\)/);
  assert.match(post, /status === "reconciling"\) return json\(result, 202\)/);
  assert.match(post, /\["processing", "blocked"\]/);
  assert.doesNotMatch(post, /detail:/);
});
