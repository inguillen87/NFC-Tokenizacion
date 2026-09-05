import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { verifyToken } from "@clerk/backend";

const { resolveVerifiedClerkAdminIdentity } = await import("../src/lib/clerk-admin-auth.ts");

// Ephemeral offline fixtures: no live Clerk credentials, sessions, or network requests.
const signingKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const unrelatedKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const localJwtKey = signingKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
const localOrigin = "https://dashboard.clerk-fixture.invalid";
const localVerificationOptions = {
  secretKey: "sk_test_offline_fixture_only",
  jwtKey: localJwtKey,
  authorizedParties: [localOrigin],
};

function localSessionToken(claims = {}, privateKey = signingKeys.privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", kid: "ephemeral-fixture-key" };
  const payload = {
    sub: "user_offline_fixture",
    sid: "sess_offline_fixture",
    iss: "https://clerk-fixture.invalid",
    azp: localOrigin,
    iat: now - 5,
    nbf: now - 5,
    exp: now + 120,
    ...claims,
  };
  const input = [header, payload]
    .map((part) => Buffer.from(JSON.stringify(part)).toString("base64url"))
    .join(".");
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url")}`;
}

const original = {
  secret: process.env.CLERK_SECRET_KEY,
  jwtKey: process.env.CLERK_JWT_KEY,
  parties: process.env.CLERK_AUTHORIZED_PARTIES,
  dashboardOrigin: process.env.DASHBOARD_ORIGIN,
  publicDashboardUrl: process.env.NEXT_PUBLIC_DASHBOARD_URL,
  webOrigin: process.env.WEB_ORIGIN,
  publicWebUrl: process.env.NEXT_PUBLIC_WEB_URL,
  nodeEnv: process.env.NODE_ENV,
};

test.beforeEach(() => {
  process.env.CLERK_SECRET_KEY = "sk_test_clerk-admin-auth-secret";
  delete process.env.CLERK_JWT_KEY;
  process.env.CLERK_AUTHORIZED_PARTIES = "https://app.nexid.lat";
  delete process.env.DASHBOARD_ORIGIN;
  delete process.env.NEXT_PUBLIC_DASHBOARD_URL;
  delete process.env.WEB_ORIGIN;
  delete process.env.NEXT_PUBLIC_WEB_URL;
  process.env.NODE_ENV = "test";
});

test.after(() => {
  for (const [key, value] of Object.entries({
    CLERK_SECRET_KEY: original.secret,
    CLERK_JWT_KEY: original.jwtKey,
    CLERK_AUTHORIZED_PARTIES: original.parties,
    DASHBOARD_ORIGIN: original.dashboardOrigin,
    NEXT_PUBLIC_DASHBOARD_URL: original.publicDashboardUrl,
    WEB_ORIGIN: original.webOrigin,
    NEXT_PUBLIC_WEB_URL: original.publicWebUrl,
    NODE_ENV: original.nodeEnv,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("real public Clerk SDK returns the verified payload expected by the identity resolver", async () => {
  const token = localSessionToken();
  const sdkResult = await verifyToken(token, localVerificationOptions);
  assert.equal(sdkResult.sub, "user_offline_fixture");
  assert.equal(sdkResult.data, undefined, "the public SDK export already unwraps its internal result envelope");

  process.env.CLERK_SECRET_KEY = localVerificationOptions.secretKey;
  process.env.CLERK_JWT_KEY = localJwtKey;
  process.env.CLERK_AUTHORIZED_PARTIES = localOrigin;
  process.env.NODE_ENV = "production";
  let userLoads = 0;
  const result = await resolveVerifiedClerkAdminIdentity(
    new Request("https://api.clerk-fixture.invalid/auth/clerk-sync", {
      headers: { authorization: `Bearer ${token}` },
    }),
    {
      verify: verifyToken,
      loadUser: async (userId, secretKey) => {
        userLoads += 1;
        assert.equal(userId, "user_offline_fixture");
        assert.equal(secretKey, localVerificationOptions.secretKey);
        return {
          id: userId,
          primaryEmailAddressId: "email_fixture",
          emailAddresses: [{
            id: "email_fixture",
            emailAddress: "fixture@example.invalid",
            verification: { status: "verified" },
          }],
        };
      },
    },
  );
  assert.equal(userLoads, 1);
  assert.deepEqual(result, {
    ok: true,
    identity: {
      externalUserId: "user_offline_fixture",
      email: "fixture@example.invalid",
      fullName: "fixture",
      verifiedWeb3Wallets: [],
    },
  });

  const source = await readFile(new URL("../src/lib/clerk-admin-auth.ts", import.meta.url), "utf8");
  assert.match(source, /const defaultDependencies:[\s\S]*?verify: \(token, options\) => verifyToken\(token, options\)/);
});

test("real public Clerk SDK rejects invalid sessions before loading any user", async (t) => {
  const now = Math.floor(Date.now() / 1000);
  const cases = [
    ["incorrect signature", () => localSessionToken({}, unrelatedKeys.privateKey)],
    ["expired session", () => localSessionToken({ exp: now - 120 })],
    ["unauthorized origin", () => localSessionToken({ azp: "https://other.clerk-fixture.invalid" })],
    ["missing subject", () => localSessionToken({ sub: undefined })],
    ["malformed token", () => "invalid.offline.fixture"],
  ];
  for (const [name, createToken] of cases) {
    await t.test(name, async () => {
      const token = createToken();
      await assert.rejects(() => verifyToken(token, localVerificationOptions));

      process.env.CLERK_SECRET_KEY = localVerificationOptions.secretKey;
      process.env.CLERK_JWT_KEY = localJwtKey;
      process.env.CLERK_AUTHORIZED_PARTIES = localOrigin;
      let userLoads = 0;
      const result = await resolveVerifiedClerkAdminIdentity(
        new Request("https://api.clerk-fixture.invalid/auth/clerk-sync", {
          headers: { authorization: `Bearer ${token}` },
        }),
        {
          verify: verifyToken,
          loadUser: async () => { userLoads += 1; throw new Error("must not load a user"); },
        },
      );
      assert.deepEqual(result, { ok: false, status: 401, reason: "unauthorized" });
      assert.equal(userLoads, 0);
    });
  }
});

test("web-only authorized origins reject the dashboard until its origin is explicitly configured", async (t) => {
  t.mock.method(console, "warn", () => {});
  process.env.CLERK_JWT_KEY = localJwtKey;
  delete process.env.CLERK_AUTHORIZED_PARTIES;
  delete process.env.DASHBOARD_ORIGIN;
  delete process.env.NEXT_PUBLIC_DASHBOARD_URL;
  delete process.env.WEB_ORIGIN;
  process.env.NEXT_PUBLIC_WEB_URL = "https://nexid.lat";
  process.env.NODE_ENV = "production";
  const token = localSessionToken({ azp: "https://app.nexid.lat" });
  const req = new Request("https://api.clerk-fixture.invalid/auth/clerk-sync", {
    headers: { authorization: `Bearer ${token}` },
  });
  let userLoads = 0;
  const dependencies = {
    verify: verifyToken,
    loadUser: async (userId) => {
      userLoads += 1;
      return {
        id: userId,
        primaryEmailAddressId: "email_fixture",
        emailAddresses: [{
          id: "email_fixture",
          emailAddress: "fixture@example.invalid",
          verification: { status: "verified" },
        }],
      };
    },
  };
  const rejected = await resolveVerifiedClerkAdminIdentity(req, dependencies);
  assert.deepEqual(rejected, { ok: false, status: 401, reason: "unauthorized" });
  assert.equal(userLoads, 0);
  assert.deepEqual(console.warn.mock.calls[0].arguments, [
    "[clerk_verification_failed]",
    JSON.stringify({ stage: "verify_token", reason: "token-invalid-authorized-parties" }),
  ]);

  process.env.CLERK_AUTHORIZED_PARTIES = "https://app.nexid.lat";
  const accepted = await resolveVerifiedClerkAdminIdentity(req, dependencies);
  assert.equal(process.env.NEXT_PUBLIC_WEB_URL, "https://nexid.lat");
  assert.equal(accepted.ok, true);
  assert.equal(accepted.identity.externalUserId, "user_offline_fixture");
  assert.equal(userLoads, 1);
  assert.equal(console.warn.mock.calls.length, 1);
});

test("Clerk failure diagnostics record only a fixed stage and allowlisted reason", async (t) => {
  const logs = [];
  t.mock.method(console, "warn", (...args) => { logs.push(args); });
  const sensitiveFixture = "DO_NOT_LOG_offline_token_email_or_secret";
  const req = new Request("https://api.clerk-fixture.invalid/auth/clerk-sync", {
    headers: { authorization: `Bearer ${sensitiveFixture}` },
  });
  for (const stage of ["verify_token", "load_user"]) {
    const error = Object.assign(new Error(sensitiveFixture), {
      reason: sensitiveFixture,
      token: sensitiveFixture,
      email: sensitiveFixture,
      secretKey: sensitiveFixture,
    });
    const result = await resolveVerifiedClerkAdminIdentity(req, {
      verify: async () => {
        if (stage === "verify_token") throw error;
        return { sub: "user_offline_fixture" };
      },
      loadUser: async () => { throw error; },
    });
    assert.deepEqual(result, { ok: false, status: 401, reason: "unauthorized" });
    assert.deepEqual(logs.at(-1), ["[clerk_verification_failed]", JSON.stringify({ stage, reason: "unknown" })]);
  }

  const result = await resolveVerifiedClerkAdminIdentity(req, {
    verify: async () => { throw Object.assign(new Error(sensitiveFixture), { reason: "jwk-kid-mismatch" }); },
    loadUser: async () => { throw new Error("must not load"); },
  });
  assert.deepEqual(result, { ok: false, status: 401, reason: "unauthorized" });
  assert.deepEqual(logs.at(-1), [
    "[clerk_verification_failed]",
    JSON.stringify({ stage: "verify_token", reason: "jwk-kid-mismatch" }),
  ]);
  assert.equal(logs.length, 3);
  assert.doesNotMatch(JSON.stringify(logs), /DO_NOT_LOG|stack|message|secretKey|email|user_offline_fixture/);
});

test("Clerk bootstrap derives identity from a verified token and fetched verified user", async () => {
  const calls = [];
  const result = await resolveVerifiedClerkAdminIdentity(
    new Request("https://api.nexid.lat/auth/clerk-sync", {
      method: "POST",
      headers: { authorization: "Bearer clerk-session-jwt" },
    }),
    {
      verify: async (token, options) => {
        calls.push({ token, options });
        return { sub: "user_clerk_123" };
      },
      loadUser: async (userId, secretKey) => {
        assert.equal(userId, "user_clerk_123");
        assert.equal(secretKey, "sk_test_clerk-admin-auth-secret");
        return {
          id: userId,
          primaryEmailAddressId: "email_primary",
          emailAddresses: [
            { id: "email_other", emailAddress: "other@example.com", verification: { status: "verified" } },
            { id: "email_primary", emailAddress: "Founder@Nexid.Lat", verification: { status: "verified" } },
          ],
          fullName: "NexID Founder",
          web3Wallets: [{
            web3Wallet: "0x0000000000000000000000000000000000000001",
            verification: { status: "verified", strategy: "metamask" },
          }],
        };
      },
    },
  );

  assert.deepEqual(result, {
    ok: true,
    identity: {
      externalUserId: "user_clerk_123",
      email: "founder@nexid.lat",
      fullName: "NexID Founder",
      verifiedWeb3Wallets: [{ address: "0x0000000000000000000000000000000000000001", provider: "metamask" }],
    },
  });
  assert.equal(calls[0].token, "clerk-session-jwt");
  assert.deepEqual(calls[0].options.authorizedParties, ["https://app.nexid.lat"]);
});

test("invalid token, mismatched user and unverified email all fail closed", async () => {
  const req = new Request("https://api.nexid.lat/auth/clerk-sync", {
    headers: { authorization: "Bearer invalid" },
  });
  const invalid = await resolveVerifiedClerkAdminIdentity(req, {
    verify: async () => { throw new Error("invalid"); },
    loadUser: async () => { throw new Error("must not load"); },
  });
  assert.deepEqual(invalid, { ok: false, status: 401, reason: "unauthorized" });

  const mismatch = await resolveVerifiedClerkAdminIdentity(req, {
    verify: async () => ({ sub: "user_expected" }),
    loadUser: async () => ({ id: "user_other", emailAddresses: [] }),
  });
  assert.deepEqual(mismatch, { ok: false, status: 401, reason: "unauthorized" });

  const unverified = await resolveVerifiedClerkAdminIdentity(req, {
    verify: async () => ({ sub: "user_expected" }),
    loadUser: async () => ({
      id: "user_expected",
      primaryEmailAddressId: "email_1",
      emailAddresses: [{ id: "email_1", emailAddress: "admin@example.com", verification: { status: "unverified" } }],
    }),
  });
  assert.deepEqual(unverified, { ok: false, status: 403, reason: "clerk_email_unverified" });

  const unverifiedPrimary = await resolveVerifiedClerkAdminIdentity(req, {
    verify: async () => ({ sub: "user_expected" }),
    loadUser: async () => ({
      id: "user_expected",
      primaryEmailAddressId: "email_primary",
      emailAddresses: [
        { id: "email_primary", emailAddress: "unverified@example.com", verification: { status: "unverified" } },
        { id: "email_secondary", emailAddress: "founder@nexid.lat", verification: { status: "verified" } },
      ],
    }),
  });
  assert.deepEqual(unverifiedPrimary, { ok: false, status: 403, reason: "clerk_email_unverified" });
});

test("production Clerk bootstrap requires an authorized-party origin", { concurrency: false }, async () => {
  delete process.env.CLERK_AUTHORIZED_PARTIES;
  delete process.env.DASHBOARD_ORIGIN;
  delete process.env.NEXT_PUBLIC_DASHBOARD_URL;
  delete process.env.WEB_ORIGIN;
  delete process.env.NEXT_PUBLIC_WEB_URL;
  process.env.NODE_ENV = "production";
  const result = await resolveVerifiedClerkAdminIdentity(
    new Request("https://api.nexid.lat/auth/clerk-sync", { headers: { authorization: "Bearer token" } }),
    { verify: async () => ({ sub: "unused" }), loadUser: async () => ({ id: "unused" }) },
  );
  assert.deepEqual(result, { ok: false, status: 503, reason: "clerk_authorized_parties_not_configured" });
});

test("Clerk sync rejects caller identity substitution and no longer accepts ADMIN_API_KEY", async () => {
  const route = await readFile(new URL("../src/app/auth/clerk-sync/route.ts", import.meta.url), "utf8");
  assert.match(route, /resolveVerifiedClerkAdminIdentity\(req\)/);
  assert.match(route, /claimedExternalUserId !== clerkAuth\.identity\.externalUserId/);
  assert.match(route, /claimedEmail !== clerkAuth\.identity\.email/);
  assert.match(route, /membership\.role = 'super_admin'::membership_role/);
  assert.match(route, /membership\.tenant_id IS NULL/);
  assert.match(route, /INSERT INTO resource_permissions \(user_id, tenant_id, resource, action\)[\s\S]*VALUES \(\$\{userId\}::uuid, NULL/);
  assert.match(route, /ON CONFLICT DO NOTHING/);
  assert.doesNotMatch(route, /UPDATE memberships/);
  assert.doesNotMatch(route, /ADMIN_API_KEY/);
});
