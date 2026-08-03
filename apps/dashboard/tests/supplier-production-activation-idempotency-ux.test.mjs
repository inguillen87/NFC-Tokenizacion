import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

function source(relativePath) {
  return fs.readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const supplierConsole = source("../src/components/supplier-order-console.tsx");
const adminActions = source("../src/components/admin-action-forms.tsx");
const adminApi = source("../src/lib/api.ts");
const adminProxy = source("../src/app/api/admin/[...path]/route.ts");

test("supplier activation callers retain one operation key across an ambiguous retry", () => {
  assert.match(supplierConsole, /activationOperationKeys = useRef\(new Map<string, string>\(\)\)/);
  assert.match(supplierConsole, /activationOperationKeys\.current\.get\(activationSignature\)/);
  assert.match(supplierConsole, /"Idempotency-Key": activationOperationKey/);
  assert.match(supplierConsole, /activationOperationKeys\.current\.delete\(activationSignature\)/);

  assert.match(adminActions, /activationAttempt = useRef<\{ signature: string; idempotencyKey: string \} \| null>\(null\)/);
  assert.match(adminActions, /attempt\.signature !== signature/);
  assert.match(adminActions, /"Idempotency-Key": attempt\.idempotencyKey/);
  assert.match(adminActions, /activationAttempt\.current = null/);
});

test("dashboard transport accepts and forwards the caller-owned idempotency header", () => {
  assert.match(adminApi, /options: \{ headers\?: HeadersInit \} = \{\}/);
  assert.match(adminApi, /new Headers\(options\.headers\)/);
  assert.match(adminProxy, /\["idempotency-key", "x-nexid-trace-id", "if-match"\]/);
  assert.match(adminProxy, /forwardedHeaders\.set\(header, value\)/);
});

