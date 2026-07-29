import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { resolveVerifiedClerkAdminIdentity } = await import("../src/lib/clerk-admin-auth.ts");

const original = {
  secret: process.env.CLERK_SECRET_KEY,
  parties: process.env.CLERK_AUTHORIZED_PARTIES,
  webOrigin: process.env.WEB_ORIGIN,
  publicWebUrl: process.env.NEXT_PUBLIC_WEB_URL,
  nodeEnv: process.env.NODE_ENV,
};

test.beforeEach(() => {
  process.env.CLERK_SECRET_KEY = "sk_test_clerk-admin-auth-secret";
  process.env.CLERK_AUTHORIZED_PARTIES = "https://app.nexid.lat";
  process.env.NODE_ENV = "test";
});

test.after(() => {
  for (const [key, value] of Object.entries({
    CLERK_SECRET_KEY: original.secret,
    CLERK_AUTHORIZED_PARTIES: original.parties,
    WEB_ORIGIN: original.webOrigin,
    NEXT_PUBLIC_WEB_URL: original.publicWebUrl,
    NODE_ENV: original.nodeEnv,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
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
  assert.match(route, /ON CONFLICT DO NOTHING/);
  assert.doesNotMatch(route, /UPDATE memberships/);
  assert.doesNotMatch(route, /ADMIN_API_KEY/);
});
