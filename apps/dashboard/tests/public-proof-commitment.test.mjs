import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canonicalPublicProofResourceIdentity,
  createPublicProofResourceCommitment,
} from "../src/lib/public-proof-commitment.ts";
import {
  canonicalPublicProofResourceIdentity as canonicalCanaryIdentity,
  createPublicProofResourceCommitment as createCanaryCommitment,
} from "../../../scripts/iota-staging-live-canary.mjs";

const identity = {
  tenantScope: " Syngenta-AR ",
  resourceType: "BATCH",
  resourceId: " SYN-AR-2026-001-A ",
};
const expectedCanonical = "[\"nexid.public-ledger.resource.v1\",\"syngenta-ar\",\"batch\",\"SYN-AR-2026-001-A\"]";
const expectedCommitment = "sha256:96f03fe5b8c597f7ffd23b7b6256190db9df846177a625adc7f0f90d253dcb49";

test("dashboard and canary derive the same domain-separated public resource commitment", async () => {
  assert.equal(canonicalPublicProofResourceIdentity(identity), expectedCanonical);
  assert.equal(canonicalCanaryIdentity(identity), expectedCanonical);
  assert.equal(await createPublicProofResourceCommitment(identity), expectedCommitment);
  assert.equal(createCanaryCommitment(identity), expectedCommitment);
  assert.doesNotMatch(expectedCommitment, /SYN|Syngenta|batch/i);
});

test("commitments are deterministic but bound to tenant, type and exact internal ID", async () => {
  assert.equal(
    await createPublicProofResourceCommitment(identity),
    await createPublicProofResourceCommitment({ ...identity, tenantScope: "syngenta-ar" }),
  );
  assert.notEqual(
    await createPublicProofResourceCommitment(identity),
    await createPublicProofResourceCommitment({ ...identity, tenantScope: "other-tenant" }),
  );
  assert.notEqual(
    await createPublicProofResourceCommitment(identity),
    await createPublicProofResourceCommitment({ ...identity, resourceType: "product" }),
  );
  assert.notEqual(
    await createPublicProofResourceCommitment(identity),
    await createPublicProofResourceCommitment({ ...identity, resourceId: "syn-ar-2026-001-a" }),
  );
  assert.throws(
    () => canonicalPublicProofResourceIdentity({ ...identity, resourceId: " " }),
    /resource_id_required/,
  );
});

test("proof composer keeps the internal ID off the public_resource_id field", async () => {
  const composer = await readFile(
    new URL("../src/app/(app)/proof/anchor/proof-anchor-composer.tsx", import.meta.url),
    "utf8",
  );
  assert.match(composer, /createPublicProofResourceCommitment\(\{/);
  assert.match(composer, /resource_id: internalResourceId/);
  assert.match(composer, /public_resource_id: publicResourceCommitment/);
  assert.doesNotMatch(composer, /public_resource_id:\s*(?:resourceId|internalResourceId)/);
  assert.doesNotMatch(composer, /setPublicResourceId\(event\.target\.value\)/);
  assert.doesNotMatch(composer, /nx-lot-/);
});
