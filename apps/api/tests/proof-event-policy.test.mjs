import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertProofProviderEventPolicy,
  canonicalizeProofEventType,
  canonicalizeProofProvider,
  canonicalizeProofResourceType,
  normalizePublicLedgerResourceId,
} from "../src/lib/proof-event-policy.ts";
import { canonicalizeIotaEventHashes } from "../src/lib/iota-evidence-writer.ts";

function policyCode(action, expectedCode) {
  assert.throws(action, (error) => {
    assert.equal(error?.name, "ProofEventPolicyError");
    assert.equal(error?.code, expectedCode);
    return true;
  });
}

test("legacy proof vocabulary canonicalizes into the explicit v1 taxonomy", () => {
  assert.equal(canonicalizeProofEventType("manifest_imported"), "MANIFEST_IMPORTED");
  assert.equal(canonicalizeProofEventType("tap-valid"), "SUN_VALIDATED");
  assert.equal(canonicalizeProofEventType("QA release"), "QA_PASSED");
  assert.equal(canonicalizeProofEventType("tokenizationMinted"), "NFT_MINTED");
  assert.equal(canonicalizeProofResourceType("lot"), "batch");
  assert.equal(canonicalizeProofResourceType("digitalProductPassport"), "dpp_report");
  assert.equal(canonicalizeProofProvider("IOTA"), "iota");

  policyCode(() => canonicalizeProofEventType("arbitrary_customer_event"), "proof_event_type_unsupported");
  policyCode(() => canonicalizeProofResourceType("user_profile"), "proof_resource_type_unsupported");
  policyCode(() => canonicalizeProofProvider("default"), "proof_provider_unsupported");
});

test("Polygon is ownership-only and IOTA has an explicit event allowlist", () => {
  assert.deepEqual(assertProofProviderEventPolicy({
    provider: "polygon",
    eventType: "ownership_claimed",
    resourceType: "ownership_record",
  }), {
    provider: "polygon",
    eventType: "OWNERSHIP_CLAIMED",
    resourceType: "ownership_record",
  });
  policyCode(() => assertProofProviderEventPolicy({
    provider: "polygon",
    eventType: "manifest_validated",
    resourceType: "manifest",
  }), "polygon_ownership_event_required");

  assert.equal(assertProofProviderEventPolicy({
    provider: "iota",
    eventType: "manifest_validated",
    resourceType: "manifest",
  }).eventType, "MANIFEST_VALIDATED");
  policyCode(() => assertProofProviderEventPolicy({
    provider: "iota",
    eventType: "ownership_claimed",
    resourceType: "ownership_record",
  }), "iota_proof_event_not_allowed");
});

test("SUN, replay, tamper and field scan evidence can reach IOTA only as aggregates", () => {
  for (const eventType of ["sun_validated", "replay_detected", "tamper_opened", "field_scan"]) {
    policyCode(() => assertProofProviderEventPolicy({
      provider: "iota",
      eventType,
      resourceType: "tag",
      aggregateCount: 1,
    }), "iota_aggregated_event_required");

    assert.equal(assertProofProviderEventPolicy({
      provider: "iota",
      eventType,
      resourceType: "tag",
      aggregateCount: 2,
    }).provider, "iota");
  }

  policyCode(() => assertProofProviderEventPolicy({
    provider: "iota",
    eventType: "sun_validated",
    resourceType: "tag",
    aggregateCount: 1,
    payload: { aggregation: { event_count: 50 } },
  }), "iota_aggregated_event_required");
  policyCode(() => assertProofProviderEventPolicy({
    provider: "iota",
    eventType: "sun_validated",
    resourceType: "tag",
    payload: { aggregated: true },
  }), "iota_aggregated_event_required");

  const duplicateHash = `sha256:${"ab".repeat(32)}`;
  assert.equal(canonicalizeIotaEventHashes([duplicateHash, duplicateHash], "lexicographic").length, 1);
});

test("public ledger resource identifiers require an intentional sha256 commitment", () => {
  const uppercaseHash = `sha256:${"AB".repeat(32)}`;
  assert.equal(normalizePublicLedgerResourceId(uppercaseHash), uppercaseHash.toLowerCase());

  const forbidden = [
    ["owner@example.com", "public_resource_id_email_forbidden"],
    ["+54 9 11 5555 1234", "public_resource_id_phone_forbidden"],
    ["https://nexid.lat/products/42", "public_resource_id_url_forbidden"],
    ["550e8400-e29b-41d4-a716-446655440000", "public_resource_id_uuid_forbidden"],
    ["SYN-AR-2026-001-A", "public_resource_id_hash_required"],
    ["ab".repeat(32), "public_resource_id_hash_required"],
  ];
  for (const [value, code] of forbidden) {
    policyCode(() => normalizePublicLedgerResourceId(value), code);
  }
});

test("admin proof writes enforce policy before persistence or publication", async () => {
  const eventsRoute = await readFile(new URL("../src/app/admin/proof/events/route.ts", import.meta.url), "utf8");
  const anchorsRoute = await readFile(new URL("../src/app/admin/proof/anchors/route.ts", import.meta.url), "utf8");
  const sunService = await readFile(new URL("../src/lib/sun-service.ts", import.meta.url), "utf8");

  assert.ok(eventsRoute.indexOf("policy = assertProofProviderEventPolicy") < eventsRoute.indexOf("INSERT INTO evidence_events"));
  assert.match(anchorsRoute, /SELECT id::text, payload_hash, event_type, resource_type, resource_id/);
  assert.ok(anchorsRoute.indexOf("publicResourceId = normalizePublicLedgerResourceId") < anchorsRoute.indexOf("INSERT INTO evidence_anchors"));
  const anchorInsert = anchorsRoute.indexOf("INSERT INTO evidence_anchors");
  assert.ok(anchorsRoute.indexOf("canonicalizeIotaEventHashes(directHashes", anchorsRoute.indexOf("export async function POST")) < anchorInsert);
  assert.ok(anchorsRoute.indexOf("assertProofProviderEventPolicy({", anchorsRoute.indexOf("export async function POST")) < anchorInsert);
  assert.match(anchorsRoute, /polygon_ownership_route_required/);
  assert.match(anchorsRoute, /local_proof_route_required/);
  assert.doesNotMatch(sunService, /proof-event-policy/);
});
