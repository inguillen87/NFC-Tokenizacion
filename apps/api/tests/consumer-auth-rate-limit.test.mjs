import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("consumer OTP rate limits are durable and do not rely on process-local Maps", async () => {
  const source = await readFile(new URL("../src/lib/consumer-auth.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /new Map<string, \{ count: number; resetAt: number \}>/);
  assert.match(source, /hitSunRateLimit\(scope, key, 10 \* 60, maxHits\)/);
  assert.match(source, /consumer_auth_start_contact/);
  assert.match(source, /consumer_auth_start_ip/);
  assert.match(source, /consumer_auth_verify_contact/);
  assert.match(source, /consumer_auth_verify_ip/);
  assert.match(source, /consumer_auth_magic_ip/);
});

test("OTP generation uses cryptographic randomness and failed-code counters increment atomically", async () => {
  const source = await readFile(new URL("../src/lib/consumer-auth.ts", import.meta.url), "utf8");
  assert.match(source, /randomInt\(100000, 1_000_000\)/);
  assert.doesNotMatch(source, /Math\.random\(\)/);
  assert.match(source, /SET attempts = attempts \+ 1/);
  assert.match(source, /WHEN attempts \+ 1 >= \$\{maxAttempts\}/);
  assert.match(source, /WHERE id = \$\{challenge\.id\}\s+AND used_at IS NULL\s+RETURNING attempts, locked_until/);
});

test("OTP delivery route maps abuse-store outages to retryable service unavailable", async () => {
  const route = await readFile(new URL("../src/app/consumer/auth/start/route.ts", import.meta.url), "utf8");
  assert.match(route, /error === "unavailable"\) return 503/);
  assert.match(route, /"retry-after": String\(AUTH_RATE_LIMIT_RETRY_AFTER_SECONDS\)/);

  const verifyRoute = await readFile(new URL("../src/app/consumer/auth/verify/route.ts", import.meta.url), "utf8");
  assert.match(verifyRoute, /if \(status === 429\) headers\["retry-after"\]/);
  assert.match(verifyRoute, /if \(status === 503\) headers\["retry-after"\] = "30"/);
});
