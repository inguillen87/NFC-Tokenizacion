import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { verificationHarness, CHALLENGE_IDS, EMAIL, PHONE, CODE, MAGIC } from "./consumer-auth-verification-fixture.mjs";

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

const meta = { ip: "198.51.100.42", userAgent: "synthetic-single-use-fixture" };
for (const modes of [["otp", "otp"], ["magic", "magic"], ["otp", "magic"], ["magic", "otp"], ["otp", "phone"]]) {
  test(`concurrent ${modes.join("/")} linked verification has one account/session winner`, async () => {
    const h = verificationHarness({ selectionParticipants: 2 });
    const verify = mode => mode === "magic" ? h.auth.verifyConsumerAuthToken(MAGIC, meta) : h.auth.verifyConsumerAuth(mode === "phone" ? PHONE : EMAIL, CODE, meta);
    const results = await Promise.all(modes.map(verify));
    assert.equal(results.filter(result => result.ok).length, 1);
    assert.deepEqual(results.filter(result => !result.ok), [{ ok: false, error: "invalid_code" }]);
    assert.equal(h.state.sessions, 1); assert.equal(h.state.accountWrites, 1); assert.equal(h.state.identityWrites, 2);
    assert(h.state.rows.every(row => row.used_at !== null));
    const winner = results.find(result => result.ok);
    assert.equal(winner.consumer.email, EMAIL); assert.equal(winner.consumer.phone, PHONE);
  });
}

for (const mode of ["otp", "magic"]) {
  for (const failure of ["expired", "locked", "used", "code_changed"]) test(`${mode} rechecks ${failure} after the initial read before effects`, async () => {
    const h = verificationHarness({ beforeClaim: state => {
      if (failure === "expired") state.rows[1].expires_at = new Date(state.now - 1).toISOString();
      if (failure === "locked") state.rows[1].locked_until = new Date(state.now + 60_000).toISOString();
      if (failure === "used") state.rows[1].used_at = new Date(state.now).toISOString();
      if (failure === "code_changed") state.rows[0].code_hash = "changed_after_read";
    } });
    const result = mode === "magic" ? await h.auth.verifyConsumerAuthToken(MAGIC, meta) : await h.auth.verifyConsumerAuth(EMAIL, CODE, meta);
    if (failure === "code_changed" && mode === "magic") assert.equal(result.ok, true, "magic identity uses its own token, not the OTP code");
    else {
      assert.deepEqual(result, { ok: false, error: failure === "expired" ? "expired" : failure === "locked" ? "locked" : "invalid_code" });
      assert.equal(h.state.accountReads, 0); assert.equal(h.state.accountWrites, 0); assert.equal(h.state.identityWrites, 0); assert.equal(h.state.sessions, 0);
      assert(h.state.rows.filter(row => failure !== "used" || row.id !== CHALLENGE_IDS[1]).every(row => row.used_at === null));
    }
  });
  for (const failAt of ["account", "session"]) test(`${mode} downstream ${failAt} failure burns the challenge without retry session`, async () => {
    const h = verificationHarness({ failAt });
    const verify = () => mode === "magic" ? h.auth.verifyConsumerAuthToken(MAGIC, meta) : h.auth.verifyConsumerAuth(EMAIL, CODE, meta);
    await assert.rejects(verify, new RegExp(`fixture_${failAt}_failure`));
    assert(h.state.rows.every(row => row.used_at !== null)); assert.equal(h.state.sessions, 0);
    assert.deepEqual(await verify(), { ok: false, error: "invalid_code" }); assert.equal(h.state.sessions, 0);
  });
}

for (const first of ["otp", "magic"]) {
  test(`${first} verification consumes UUID challenges before OTP or magic-link reuse`, async () => {
    const h = verificationHarness();
    const verify = mode => mode === "magic" ? h.auth.verifyConsumerAuthToken(MAGIC, meta) : h.auth.verifyConsumerAuth(EMAIL, CODE, meta);
    assert.equal((await verify(first)).ok, true);
    assert.deepEqual(h.state.rows.map(row => row.id), CHALLENGE_IDS);
    assert(h.state.rows.every(row => row.used_at !== null));
    assert.deepEqual(await verify("otp"), { ok: false, error: "invalid_code" });
    assert.deepEqual(await verify("magic"), { ok: false, error: "invalid_code" });
    assert.equal(h.state.sessions, 1);
    assert.equal(h.state.accountWrites, 1);
    assert.equal(h.state.claims, 1);
  });
}

test("legacy OTP without magic token consumes its own row once before session", async () => {
  const h = verificationHarness({ contacts: 1, legacy: true });
  assert.equal((await h.auth.verifyConsumerAuth(EMAIL, CODE, meta)).ok, true);
  assert.deepEqual(await h.auth.verifyConsumerAuth(EMAIL, CODE, meta), { ok: false, error: "invalid_code" });
  assert.equal(h.state.sessions, 1);
});

test("wrong OTP retains atomic attempts/lock response and creates no account/session", async () => {
  const h = verificationHarness();
  for (let i = 0; i < 5; i++) assert.deepEqual(await h.auth.verifyConsumerAuth(EMAIL, "000000", meta), { ok: false, error: i === 4 ? "locked" : "invalid_code" });
  assert.equal(h.state.rows[0].attempts, 5); assert.equal(h.state.claims, 0); assert.equal(h.state.sessions, 0); assert.equal(h.state.accountWrites, 0);
});

test("verification rate refusal happens before challenge consumption and all effects", async () => {
  for (const rateResult of [{ limited: true }, { unavailable: true }]) {
    const h = verificationHarness({ rateResult });
    const error = rateResult.unavailable ? "unavailable" : "rate_limited";
    assert.deepEqual(await h.auth.verifyConsumerAuth(EMAIL, CODE, meta), { ok: false, error });
    assert.deepEqual(await h.auth.verifyConsumerAuthToken(MAGIC, meta), { ok: false, error });
    assert.equal(h.state.queries.length, 0); assert.equal(h.state.sessions, 0);
  }
});
