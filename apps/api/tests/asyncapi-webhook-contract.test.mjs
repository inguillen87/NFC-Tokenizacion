import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const raw = await readFile(new URL("../public/asyncapi/nexid-webhooks-v1.json", import.meta.url), "utf8");
const spec = JSON.parse(raw);
const producer = await readFile(new URL("../src/lib/sdk-webhooks.ts", import.meta.url), "utf8");
const sdk = await readFile(new URL("../../../packages/sdk/src/index.ts", import.meta.url), "utf8");

function collectRefs(value, refs = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectRefs(item, refs));
    return refs;
  }
  if (!value || typeof value !== "object") return refs;
  for (const [key, item] of Object.entries(value)) {
    if (key === "$ref" && typeof item === "string" && item.startsWith("#/")) refs.push(item);
    else collectRefs(item, refs);
  }
  return refs;
}

function resolve(ref) {
  return ref.slice(2).split("/").reduce((current, segment) => current?.[segment.replaceAll("~1", "/").replaceAll("~0", "~")], spec);
}

test("AsyncAPI 3 publishes the implemented outbound webhook operation", () => {
  assert.equal(spec.asyncapi, "3.0.0");
  assert.equal(spec.info.version, "1.0.0");
  assert.equal(spec.operations.sendTenantWebhook.action, "send");
  assert.equal(spec.operations.sendTenantWebhook.channel.$ref, "#/channels/tenantWebhook");
  assert.equal(spec.operations.sendTenantWebhook["x-nexid-delivery-semantics"], "at-least-once");
  assert.match(spec.operations.sendTenantWebhook.description, /deliveryId as the idempotency identity/);
  for (const ref of collectRefs(spec)) assert.ok(resolve(ref), `unresolved AsyncAPI ref: ${ref}`);
});

test("AsyncAPI binds the current body schema and every signed identity header", () => {
  const message = spec.components.messages.NexIdWebhookEventV1;
  const headers = spec.components.schemas.WebhookHeadersV2;
  const envelope = spec.components.schemas.WebhookEventV1;
  assert.equal(message["x-nexid-preferred-signature-version"], "v2");
  assert.deepEqual(message["x-nexid-supported-contract-versions"], ["legacy", "1.0"]);
  assert.deepEqual(envelope.required, ["schemaVersion", "id", "type", "createdAt", "data"]);
  assert.equal(envelope.properties.schemaVersion.const, "1.0");
  assert.deepEqual(headers.required, [
    "x-nexid-signature-version",
    "x-nexid-timestamp",
    "x-nexid-key-id",
    "x-nexid-delivery-id",
    "x-nexid-event-id",
    "x-nexid-signature",
  ]);
  assert.match(headers.properties["x-nexid-event"].description, /Unsigned convenience routing header/);
});

test("producer, SDK parser and AsyncAPI expose one event-contract version and type set", () => {
  assert.match(producer, /WEBHOOK_EVENT_SCHEMA_VERSION = "1\.0"/);
  assert.match(producer, /schemaVersion: WEBHOOK_EVENT_SCHEMA_VERSION/);
  assert.match(sdk, /NEXID_WEBHOOK_EVENT_SCHEMA_VERSION = "1\.0"/);
  assert.match(sdk, /webhook_event_id_mismatch/);
  assert.match(sdk, /unsupported_webhook_schema_version/);

  const declared = spec.components.schemas.WebhookEventV1.properties.type.enum;
  const expected = [
    "demo.tap.simulated",
    "epcis.event.captured",
    "ownership.activated",
    "provenance.viewed",
    "sdk.claim.claimed",
    "sdk.claim.created",
    "sdk.external_event",
    "sdk.pos.activated",
    "sdk.verify",
    "tokenization.anchored",
    "tokenization.requested",
    "tokenization.simulated",
    "warranty.review_requested",
  ];
  assert.deepEqual(declared, expected);
});

test("the public contract states evidence, privacy and delivery boundaries", () => {
  assert.match(spec.info.description, /at least once/);
  assert.match(spec.info.description, /do not independently prove physical-product authenticity/);
  assert.match(spec.components.schemas.WebhookEventV1.properties.data.description, /Raw NFC keys/);
  assert.doesNotMatch(raw, /signing_secret|api_key_hex|k_meta|k_file/i);
});
