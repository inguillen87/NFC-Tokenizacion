import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const consoleSource = await readFile(new URL("../src/components/sdk-admin-console.tsx", import.meta.url), "utf8");
const proxy = await readFile(new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url), "utf8");

test("developer console consumes server-generated webhook secrets once", () => {
  assert.doesNotMatch(consoleSource, /signingSecret:\s*webhookSecret/);
  assert.doesNotMatch(consoleSource, /id="webhook-secret"\s+type="password"/);
  assert.match(consoleSource, /asRecord\(created\.data\)\.secret/);
  assert.match(consoleSource, /Secreto webhook · única visualización/);
  assert.match(consoleSource, /setWebhookOneTimeSecret\(""\)/);
  assert.match(consoleSource, /setSecret\(""\);\s*setWebhookOneTimeSecret\(""\);\s*setCopyStatus\(null\);/);
});

test("developer console exposes explicit webhook lifecycle operations", () => {
  assert.match(consoleSource, /\/rotate`/);
  assert.match(consoleSource, /\/reactivate`/);
  assert.match(consoleSource, /expectedSecretVersion: Number\(row\.signing_secret_version\)/);
  assert.match(consoleSource, /overlapSeconds: 3600/);
  assert.match(consoleSource, /method = action === "disable" \? "PATCH" : action === "delete" \? "DELETE" : "POST"/);
  assert.match(consoleSource, /destruye su secreto cifrado/);
  assert.match(consoleSource, /separación de funciones o break-glass auditado/);
});

test("dashboard BFF forwards webhook DELETE without forwarding arbitrary headers", () => {
  assert.match(proxy, /export async function DELETE/);
  assert.match(proxy, /\["idempotency-key", "x-nexid-trace-id", "if-match"\]/);
  assert.doesNotMatch(proxy, /headers:\s*req\.headers/);
});
