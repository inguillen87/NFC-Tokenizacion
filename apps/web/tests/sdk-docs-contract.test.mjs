import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const contract = await readFile(new URL("../src/lib/sdk-public-contract.ts", import.meta.url), "utf8");
const docsConsole = await readFile(new URL("../src/app/docs/docs-integration-console.tsx", import.meta.url), "utf8");
const sdkPage = await readFile(new URL("../src/app/sdk/page.tsx", import.meta.url), "utf8");

test("Docs and SDK publish the same executable verify contract", () => {
  assert.match(contract, /NEXID_SDK_VERIFY_ROUTE = "\/api\/v1\/sdk\/verify"/);
  assert.match(contract, /NEXID_SDK_VERIFY_REQUIRED_FIELDS = \["bid", "picc_data", "enc", "cmac"\]/);
  assert.match(contract, /NEXID_SDK_VERIFY_OPTIONAL_FIELDS = \["gps", "deviceMeta"\]/);

  assert.match(docsConsole, /NEXID_SDK_VERIFY_ROUTE/);
  assert.match(docsConsole, /NEXID_SDK_VERIFY_URL/);
  assert.match(docsConsole, /"x-nexid-api-key": process\.env\.NEXID_API_KEY/);
  assert.match(docsConsole, /"x-nexid-tenant-slug": process\.env\.NEXID_TENANT_SLUG/);
  assert.match(docsConsole, /bid: tag\.bid/);
  assert.match(docsConsole, /picc_data: tag\.picc_data/);
  assert.match(docsConsole, /enc: tag\.enc/);
  assert.match(docsConsole, /cmac: tag\.cmac/);
  assert.match(docsConsole, /--data-binary @- <<JSON/);
  assert.doesNotMatch(docsConsole, /"carrier": "ntag424_dna"/);
  assert.doesNotMatch(docsConsole, /"batchId"/);
  assert.doesNotMatch(docsConsole, /Authorization: Bearer/);

  assert.match(sdkPage, /import \{ NEXID_SDK_VERIFY_URL \} from "\.\.\/\.\.\/lib\/sdk-public-contract"/);
  assert.match(sdkPage, /fetch\("\$\{NEXID_SDK_VERIFY_URL\}"/);
  assert.match(sdkPage, /"Idempotency-Key": crypto\.randomUUID\(\)/);
  assert.match(sdkPage, /verify, claim, events y POS aceptan Idempotency-Key/);
  assert.match(sdkPage, /reutilizar la clave con otro payload devuelve HTTP 409/);
  assert.match(sdkPage, /consulta status o solicita reconcile con la misma clave/);
  assert.match(sdkPage, /La firma v2 incluye versión e identificador de clave/);
  assert.match(sdkPage, /webhooks llegan de forma asíncrona con estado de entrega/);
  assert.doesNotMatch(sdkPage, /webhooks en tiempo real/);
  assert.match(sdkPage, /https:\/\/api\.nexid\.lat\/openapi\/nexid-sdk-v1\.json/);
  assert.match(sdkPage, /OpenAPI v1/);
});
