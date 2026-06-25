import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";

const service = readFileSync("apps/api/src/lib/trivia-service.ts", "utf8");
const migration = readFileSync("apps/api/db/migrations/20260625113000_0036_loyalty_trivia_engine.sql", "utf8");

test("trivia schema persists quiz definitions and attempts", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS loyalty_quizzes/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS loyalty_quiz_attempts/);
  assert.match(migration, /idempotency_key text UNIQUE/);
  assert.match(migration, /idx_loyalty_quiz_attempts_tenant_created/);
});

test("public trivia payload does not expose the answer key", () => {
  const publicFn = service.slice(service.indexOf("export function publicTriviaQuestion"));
  assert.match(publicFn, /prompt: question\.prompt/);
  assert.match(publicFn, /options: question\.options/);
  assert.doesNotMatch(publicFn.split("};")[0], /correctIndex/);
});

test("completed trivia awards points through the loyalty ledger only once", () => {
  assert.match(service, /source:\s*"QUIZ_COMPLETED"/);
  assert.match(service, /const idempotencyKey = `quiz:\$\{quiz\.id\}:event:\$\{event\.id\}:member:\$\{member\.id\}`/);
  assert.match(service, /WHERE idempotency_key = \$\{idempotencyKey\}/);
});
