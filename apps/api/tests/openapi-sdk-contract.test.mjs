import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const raw = await readFile(new URL("../public/openapi/nexid-sdk-v1.json", import.meta.url), "utf8");
const spec = JSON.parse(raw);

function collectInternalRefs(value, refs = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectInternalRefs(item, refs));
    return refs;
  }
  if (!value || typeof value !== "object") return refs;
  for (const [key, item] of Object.entries(value)) {
    if (key === "$ref" && typeof item === "string" && item.startsWith("#/")) refs.push(item);
    else collectInternalRefs(item, refs);
  }
  return refs;
}

function resolveInternalRef(ref) {
  return ref.slice(2).split("/").reduce((current, part) => current?.[part.replaceAll("~1", "/").replaceAll("~0", "~")], spec);
}

test("OpenAPI publishes the exact SDK v1 route surface and server-only auth", () => {
  assert.equal(spec.openapi, "3.1.0");
  assert.equal(spec.servers[0].url, "https://api.nexid.lat");
  assert.deepEqual(Object.keys(spec.paths).sort(), [
    "/api/v1/logistics/handoff",
    "/api/v1/logistics/recipient-verify",
    "/api/v1/logistics/seal-apply",
    "/api/v1/sdk/claim",
    "/api/v1/sdk/epcis/capture",
    "/api/v1/sdk/epcis/events",
    "/api/v1/sdk/epcis/export",
    "/api/v1/sdk/events",
    "/api/v1/sdk/idempotency/status",
    "/api/v1/sdk/pos/activate",
    "/api/v1/sdk/products/{bid}",
    "/api/v1/sdk/verify",
  ]);
  assert.equal(spec.components.securitySchemes.NexIdApiKey.name, "x-nexid-api-key");
  assert.equal(spec.components.securitySchemes.NexIdTenant.name, "x-nexid-tenant-slug");
  assert.match(spec.components.securitySchemes.NexIdApiKey.description, /Never expose it in browser code/);
});

test("OpenAPI states NFC, ownership, idempotency and uncertain-write boundaries", () => {
  assert.match(spec.paths["/api/v1/sdk/verify"].post.description, /message-level evidence/);
  assert.match(spec.paths["/api/v1/sdk/claim"].post.description, /tap alone never transfers ownership/);
  assert.match(spec.components.parameters.IdempotencyKey.description, /tenant plus route plus key/);
  assert.match(spec.components.parameters.IdempotencyKey.description, /replays the original status\/body/);
  assert.match(spec.components.responses.CommittedWriteUncertain.description, /never retry with a new key/);
  assert.equal(spec.paths["/api/v1/sdk/idempotency/status"].get.operationId, "getIdempotencyStatus");
  assert.equal(spec.paths["/api/v1/sdk/idempotency/status"].post.operationId, "reconcileIdempotency");
  assert.match(spec.paths["/api/v1/sdk/idempotency/status"].post.description, /never reruns the original business mutation/);
  assert.match(spec.paths["/api/v1/sdk/idempotency/status"].post.description, /deduplicated webhook outbox rows/);
  assert.equal(spec.components.parameters.RequiredIdempotencyKey.in, "header");
  assert.equal(spec.components.parameters.RequiredIdempotencyKey.required, true);
  assert.equal(spec.components.schemas.PosActivationResponse.properties.posToken.writeOnly, true);
});

test("OpenAPI required request fields match the SDK source contract", () => {
  assert.deepEqual(spec.components.schemas.VerifyTapRequest.required, ["bid", "picc_data", "enc", "cmac"]);
  assert.deepEqual(spec.components.schemas.ClaimOwnershipRequest.required, ["contact", "bid"]);
  assert.deepEqual(spec.components.schemas.ExternalEventRequest.required, ["eventType"]);
  assert.deepEqual(spec.components.schemas.PosActivationRequest.required, ["bid"]);
});

test("OpenAPI publishes the bounded EPCIS profile, scopes and failure contract", () => {
  const capture = spec.paths["/api/v1/sdk/epcis/capture"].post;
  const events = spec.paths["/api/v1/sdk/epcis/events"].get;
  const exportPage = spec.paths["/api/v1/sdk/epcis/export"].get;
  assert.equal(capture["x-nexid-required-scope"], "sdk:epcis:write");
  assert.equal(events["x-nexid-required-scope"], "sdk:epcis:read");
  assert.equal(exportPage["x-nexid-required-scope"], "sdk:epcis:read");
  assert.equal(capture["x-nexid-profile"], "bounded-foundation-not-certified");
  assert.equal(spec.components.parameters.RequiredEpcisIdempotencyKey.required, true);
  assert.ok(capture.requestBody.content["application/vnd.gs1.epcis+json"]);
  for (const status of ["413", "422", "429", "503"]) assert.ok(capture.responses[status]);
  assert.match(capture.description, /not NFC cryptographic authentication/i);
  assert.match(capture.description, /not claimed as GS1 certified/i);
});

test("OpenAPI internal references resolve and operation IDs are unique", () => {
  const refs = collectInternalRefs(spec);
  assert.ok(refs.length > 20);
  for (const ref of refs) assert.ok(resolveInternalRef(ref), `unresolved OpenAPI ref: ${ref}`);

  const operationIds = Object.values(spec.paths).flatMap((pathItem) =>
    Object.values(pathItem).map((operation) => operation.operationId).filter(Boolean),
  );
  assert.equal(new Set(operationIds).size, operationIds.length);
});
