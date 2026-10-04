import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { isIP } from "node:net";
import { domainToASCII } from "node:url";
import test from "node:test";
import ts from "typescript";

const localRequire = createRequire(import.meta.url);

// Every contact, token, code and receipt below is a fixed local fixture. No
// module receives the host environment, a real mail transport or global fetch.
const EMAIL = "otp-recipient@example.test";
const PHONE = "+12025550123";
const CODE = "654321";
const SID = `SM${"a".repeat(32)}`;
const UUID = "11111111-2222-4333-8444-555555555555";
const SMTP_RECEIPT = "<fixture-mail-receipt@example.test>";
const MAGIC = `nxa_${Buffer.alloc(24, 0xab).toString("base64url")}`;
const SMTP_ENV = { SMTP_USER: "fixture-smtp-user", SMTP_PASSWORD: "fixture-smtp-secret", SMTP_FROM_EMAIL: "sender@example.test" };
const RESEND_ENV = { RESEND_API_KEY: "fixture-resend-secret", CONSUMER_AUTH_FROM_EMAIL: "sender@example.test" };
const TWILIO_ENV = {
  TWILIO_ACCOUNT_SID: `AC${"b".repeat(32)}`, TWILIO_AUTH_TOKEN: "fixture-twilio-secret",
  TWILIO_FROM_NUMBER: "+12025550124", TWILIO_WHATSAPP_FROM: "whatsapp:+12025550125",
};
const META_ENV = {
  CONSUMER_WHATSAPP_PROVIDER: "meta", META_CONSUMER_OTP_GRAPH_VERSION: "v25.0", META_CONSUMER_OTP_PHONE_NUMBER_ID: "123456789012345",
  META_CONSUMER_OTP_ACCESS_TOKEN: "fixtureMetaAccessToken0123456789", META_CONSUMER_OTP_TEMPLATE_NAME: "fixture_login_code", META_CONSUMER_OTP_TEMPLATE_LANGUAGE: "es_AR",
};
const META_RECEIPT = "wamid.FIXTURE_RECEIPT_0123456789==";
const RAW_ERROR = `untrusted provider error ${EMAIL} ${PHONE} ${CODE} ${SMTP_ENV.SMTP_PASSWORD} ${TWILIO_ENV.TWILIO_AUTH_TOKEN}`;
const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const compiled = Object.fromEntries(Object.entries({
  safeReturn: source("../../../packages/config/src/safe-return-path.ts"),
  continuation: source("../src/lib/consumer-auth-continuation.ts"),
  status: source("../src/lib/consumer-otp-twilio-status.ts"),
  twilioConfig: source("../src/lib/consumer-otp-twilio-config.ts"),
  meta: source("../src/lib/consumer-otp-meta-whatsapp.ts"),
  provider: source("../src/lib/consumer-auth-provider.ts"),
  auth: source("../src/lib/consumer-auth.ts"),
  route: source("../src/app/consumer/auth/start/route.ts"),
}).map(([name, text]) => [name, ts.transpileModule(text, {
  fileName: `${name}.ts`,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText]));

function harness(options = {}) {
  const env = { NODE_ENV: "production", ...options.env };
  const logs = [], requests = [], mail = [], transports = [], queries = [], rates = [], timeouts = [], closed = [];
  const pendingTimers = new Map();
  let timerId = 0;
  let provider, auth, statusHelper, twilioConfig, meta, safeReturn, continuation;
  class RequestBodyTooLargeError extends Error {}
  const sql = async (parts, ...values) => {
    const text = parts.join("?").replace(/\s+/g, " ").trim();
    queries.push({ text, values });
    if (text.startsWith("SELECT phone FROM consumers")) return options.secondaryContact ? [{ phone: options.secondaryContact }] : [];
    if (text.startsWith("SELECT email FROM consumers")) return options.secondaryContact ? [{ email: options.secondaryContact }] : [];
    if (text.startsWith("INSERT INTO consumer_auth_challenges")) return [];
    throw new Error(`Unexpected SQL in OTP test: ${text}`);
  };
  const fakeFetch = async (url, init) => {
    requests.push({ url, init });
    if (!options.fetch) throw new Error("unexpected_network_call_blocked_by_test");
    return options.fetch(url, init);
  };
  const captureLog = (...args) => logs.push(args.map(String).join(" "));
  const bindings = {
    process: { env }, fetch: fakeFetch, console: { log: captureLog, warn: captureLog, error: captureLog },
    setTimeout: (callback, ms) => { const id = ++timerId; timeouts.push(ms); pendingTimers.set(id, callback); return id; },
    clearTimeout: (id) => pendingTimers.delete(id),
    AbortSignal: { timeout: (ms) => { timeouts.push(ms); return new AbortController().signal; } },
  };
  const fakeRequire = (name) => {
    if (name === "node:crypto") return {
      createHash, randomBytes: (size) => Buffer.alloc(size, 0xab),
      randomInt: (min, max) => { assert.equal(min, 100000); assert.equal(max, 1_000_000); return Number(CODE); },
    };
    if (name === "node:net") return { isIP };
    if (name === "node:url") return { domainToASCII };
    if (name === "../../../../packages/config/src/safe-return-path") return safeReturn;
    if (name === "./consumer-auth-continuation") return continuation;
    if (name === "./consumer-otp-twilio-status") return statusHelper;
    if (name === "./consumer-otp-twilio-config") return twilioConfig;
    if (name === "./consumer-otp-meta-whatsapp") return meta;
    if (name === "nodemailer" && options.realSmtp) return localRequire("nodemailer");
    if (name === "nodemailer") return { createTransport: (config) => {
      transports.push(config);
      return {
        sendMail: async (payload) => {
          mail.push(payload);
          return options.sendMail ? options.sendMail(payload) : { accepted: [payload.to], rejected: [], messageId: SMTP_RECEIPT };
        },
        close: () => closed.push(true),
      };
    } };
    if (name.endsWith("/consumer-auth-provider") || name === "./consumer-auth-provider") return provider;
    if (name.endsWith("/consumer-auth")) return auth;
    if (name === "./db") return { sql };
    if (name === "./commercial-runtime-schema") return { ensureConsumerAuthSchema: async () => {} };
    if (name === "./sun-rate-limit-store") return {
      hitSunRateLimit: async (...args) => {
        rates.push(args);
        if (options.rateError) throw options.rateError;
        return options.rateResult || { limited: false };
      },
      shouldFailClosedSunRateLimit: () => true,
    };
    if (name.endsWith("/http")) return { json: (body, status = 200, headers = {}) => Response.json(body, { status, headers }) };
    if (name.endsWith("/consumer-contact")) return { parseConsumerContact: (body) => ({ ok: true, contact: body.contact }) };
    if (name.endsWith("/request-meta")) return { getRequestMeta: () => ({ ip: "198.51.100.42" }) };
    if (name.endsWith("/critical-rate-limit")) return { enforceCriticalRateLimit: async () => null };
    if (name.endsWith("/bounded-request-body")) return { RequestBodyTooLargeError, readBoundedJsonBody: (req) => req.json() };
    throw new Error(`Unexpected OTP dependency blocked by test: ${name}`);
  };
  const load = (name) => {
    const loaded = { exports: {} };
    new Function("require", "module", "exports", ...Object.keys(bindings), compiled[name])(
      fakeRequire, loaded, loaded.exports, ...Object.values(bindings),
    );
    return loaded.exports;
  };
  safeReturn = load("safeReturn");
  continuation = load("continuation");
  statusHelper = load("status");
  twilioConfig = load("twilioConfig");
  meta = load("meta");
  provider = load("provider");
  auth = load("auth");
  const route = load("route");
  return {
    provider, auth, continuation, logs, requests, mail, transports, queries, rates, timeouts, closed, pendingTimers,
    send: (contact = EMAIL, next) => provider.resolveConsumerOtpProvider().sendOtp({ contact, code: CODE, ttlMinutes: 10, magicToken: MAGIC, next }),
    fireTimers: () => { for (const callback of [...pendingTimers.values()]) callback(); },
    post: (contact = EMAIL, next) => route.POST(new Request("https://otp-fixture.invalid/consumer/auth/start", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contact, next }),
    })),
  };
}

const response = (payload, status = 201) => Response.json(payload, { status });
const twilioOk = (overrides = {}) => response({ sid: SID, status: "queued", error_code: null, ...overrides });
const delivery = (provider, channel, status = "accepted") => ({ ok: true, delivery: { provider, channel, status } });
async function fails(h, reason, contact = EMAIL) {
  await assert.rejects(async () => h.send(contact), (error) => error.message === reason);
}
function assertSanitizedLogs(h, extra = []) {
  const serialized = h.logs.join("\n");
  for (const forbidden of [EMAIL, PHONE, CODE, MAGIC, SID, UUID, SMTP_RECEIPT,
    SMTP_ENV.SMTP_PASSWORD, RESEND_ENV.RESEND_API_KEY, TWILIO_ENV.TWILIO_ACCOUNT_SID, TWILIO_ENV.TWILIO_AUTH_TOKEN,
    RAW_ERROR, META_ENV.META_CONSUMER_OTP_ACCESS_TOKEN, META_RECEIPT, ...extra]) {
    assert.equal(serialized.includes(forbidden), false, "audit output contains a sensitive fixture value");
  }
}
function assertPublicPayload(body) {
  const text = JSON.stringify(body);
  for (const value of [CODE, MAGIC, SID, UUID, SMTP_RECEIPT, SMTP_ENV.SMTP_PASSWORD, RESEND_ENV.RESEND_API_KEY, TWILIO_ENV.TWILIO_AUTH_TOKEN, META_ENV.META_CONSUMER_OTP_ACCESS_TOKEN, META_RECEIPT]) {
    assert.equal(text.includes(value), false, "public response contains a private delivery fixture value");
  }
  assert.equal(Object.hasOwn(body, "code"), false);
  assert.doesNotMatch(text, /"(?:sid|messageId|receiptHash|magicToken|code_hash)"/);
}

test("consumer email continuation keeps only exact portal routes and canonical selection references", () => {
  const { normalizeConsumerAuthReturnPath: normalize } = harness().continuation;
  for (const route of [
    "/me", "/me/products", "/me/passport", "/me/brands", "/me/wallet", "/me/marketplace",
    "/me/rewards", "/me/experiences", "/me/sommelier", "/me/taps", "/me/privacy",
    "/me/security", "/me/cork-analyzer", "/me/taps/1", "/me/taps/9223372036854775807",
  ]) assert.equal(normalize(route), route);

  assert.equal(
    normalize("/me/products?action=save&tenant=demo_brand&bid=RA-2407.1:AA&focus=9223372036854775807&eventId=42&fromTap=1"),
    "/me/products?fromTap=1&eventId=42&focus=9223372036854775807&bid=RA-2407.1%3AAA&tenant=demo_brand&action=save",
  );
  assert.equal(normalize("/me/products/../wallet?eventId=42"), "/me/wallet?eventId=42");
});

test("email continuation fails closed for external or administrative routes, duplicate keys and malformed selection metadata", () => {
  const { normalizeConsumerAuthReturnPath: normalize } = harness().continuation;
  for (const next of [
    undefined, null, {}, ["/me/products"], "https://evil.example/steal", "//evil.example/steal",
    "/\\evil.example/steal", "%252F%252Fevil.example/steal", "/%5C%5Cevil.example/steal",
    "/safe/%2e%2e//evil.example/steal", "/%00evil", "/%E0%A4%A", "/admin", "/superadmin",
    "/api/consumer/me", "/sun?uid=SIGNED", "/login?next=/me/products", "/docs", "/me/products/",
    "/me/unknown", "/me/products/42", "/me/taps/0", "/me/taps/01", "/me/taps/9223372036854775808",
    "/me/taps/42/", "/me/taps/%34%32", "/me/products?fromTap=true", "/me/products?fromTap=0",
    "/me/products?eventId=01", "/me/products?eventId=-1", "/me/products?eventId=9223372036854775808",
    "/me/products?focus=1e2", "/me/products?eventId=", "/me/products?bid=", "/me/products?tenant=demo.brand",
    "/me/products?action=delete", "/me/products?bid=first&bid=second", "/me/products?eventId=42&eventId=43",
    "/me/products?action=save&action=save", `/me/products?bid=${"a".repeat(201)}`, `/me/products?tenant=${"a".repeat(121)}`,
  ]) assert.equal(normalize(next), "/me", String(next));
});

test("email continuation discards signed NFC values, precise location, credentials, nested destinations and fragments", () => {
  const { normalizeConsumerAuthReturnPath: normalize } = harness().continuation;
  const sensitive = new URLSearchParams({
    eventId: "42", fromTap: "1", bid: "RA-2407", tenant: "demo", action: "save",
    uid: "FIXTURE_UID", mac: "FIXTURE_MAC", ctr: "FIXTURE_COUNTER", picc_data: "FIXTURE_PICC",
    freshToken: "FIXTURE_FRESH_TOKEN", share: "FIXTURE_SHARE", lat: "-32.12345678", lng: "-68.87654321",
    geoConsent: "true", geoPrecision: "precise", contact: EMAIL, token: MAGIC, code: CODE,
    next: "https://evil.example/steal", redirect: "https://evil.example/steal",
  });
  sensitive.append("unknown", "first"); sensitive.append("unknown", "second");
  assert.equal(normalize(`/me/products?${sensitive}#token=FIXTURE_FRAGMENT`), "/me/products?fromTap=1&eventId=42&bid=RA-2407&tenant=demo&action=save");
});

test("auth start propagates sanitized product continuation into both SMTP and Resend magic links without public or audit leakage", async () => {
  const next = "/me/products?action=save&eventId=42&fromTap=1&uid=FIXTURE_UID&mac=FIXTURE_MAC&lat=-32.12345678&freshToken=FIXTURE_FRESH#FIXTURE_FRAGMENT";
  const expected = "/me/products?fromTap=1&eventId=42&action=save";
  for (const configured of ["smtp", "resend"]) {
    const h = harness({ env: { ...SMTP_ENV, ...RESEND_ENV, CONSUMER_AUTH_MODE: "smart", CONSUMER_AUTH_EMAIL_PROVIDER: configured }, fetch: async () => response({ id: UUID }) });
    const result = await h.post(EMAIL, next);
    assert.equal(result.status, 200);
    const body = await result.json();
    assertPublicPayload(body);
    assert.equal(Object.hasOwn(body, "next"), false);
    const message = configured === "smtp" ? h.mail[0] : JSON.parse(h.requests[0].init.body);
    const textLink = new URL(message.text.match(/https:\/\/\S+$/)[0]);
    const htmlLink = new URL(message.html.match(/<a href="([^"]+)"/)[1]);
    for (const link of [textLink, htmlLink]) {
      assert.equal(link.origin, "https://nexid.lat");
      assert.equal(link.pathname, "/login");
      assert.equal(link.searchParams.get("t"), MAGIC);
      assert.equal(link.searchParams.get("next"), expected);
      assert.deepEqual([...link.searchParams.keys()], ["t", "next"]);
    }
    assert.equal(h.queries.filter((q) => q.text.startsWith("INSERT INTO consumer_auth_challenges")).length, 1);
    assert.equal(h.queries.some((q) => q.values.includes(next) || q.values.includes(expected)), false);
    for (const forbidden of ["FIXTURE_UID", "FIXTURE_MAC", "FIXTURE_FRESH", "FIXTURE_FRAGMENT", "-32.12345678"]) {
      assert.equal(JSON.stringify(message).includes(forbidden), false);
      assertSanitizedLogs(h, [forbidden]);
    }
    assertSanitizedLogs(h, [next, expected]);
  }
});

test("provider revalidates direct email continuation and leaves ordinary email and phone links unchanged", async () => {
  for (const next of [undefined, "/me", "https://evil.example/steal", "/admin", "/me/products?eventId=42&eventId=43", { next: "/me/products" }]) {
    const h = harness({ env: { ...SMTP_ENV, CONSUMER_AUTH_MODE: "smtp" } });
    await h.send(EMAIL, next);
    assert.equal(h.mail[0].text.match(/https:\/\/\S+$/)[0], `https://nexid.lat/login?t=${MAGIC}`);
  }
  for (const mode of ["sms", "whatsapp"]) {
    const h = harness({ env: { ...TWILIO_ENV, CONSUMER_AUTH_MODE: mode }, fetch: async () => twilioOk() });
    await h.send(PHONE, "/me/products?eventId=42&action=save");
    assert.equal(h.requests[0].init.body.get("Body").match(/https:\/\/\S+$/)[0], `https://nexid.lat/login?t=${MAGIC}`);
  }
});

test("Meta is opt-in across WhatsApp modes; unset and explicit Twilio preserve the original driver", async () => {
  for (const mode of ["whatsapp", "twilio_whatsapp", "smart", "provider", "production"]) {
    for (const selection of [undefined, "", "twilio", "meta", ' " MeTa " ']) {
      const metaSelected = selection?.toLowerCase().includes("meta");
      const h = harness({ env: { ...TWILIO_ENV, ...META_ENV, CONSUMER_AUTH_MODE: mode, CONSUMER_PHONE_OTP_CHANNEL: "whatsapp", CONSUMER_WHATSAPP_PROVIDER: selection },
        fetch: () => metaSelected ? response({ messaging_product: "whatsapp", messages: [{ id: META_RECEIPT }] }, 200) : twilioOk(),
      });
      assert.deepEqual(await h.send(PHONE), delivery(metaSelected ? "meta" : "twilio", "whatsapp"));
      assert.equal(h.requests.length, 1);
      assert.equal(new URL(h.requests[0].url).hostname, metaSelected ? "graph.facebook.com" : "api.twilio.com");
      assertSanitizedLogs(h);
    }
  }
});

test("Meta and invalid WhatsApp choices never change email, SMS or local demo delivery", async () => {
  for (const selection of ["meta", "invalid"]) {
    for (const mode of ["sms", "twilio", "smart"]) {
      const h = harness({ env: { ...TWILIO_ENV, CONSUMER_AUTH_MODE: mode, CONSUMER_PHONE_OTP_CHANNEL: "sms", CONSUMER_WHATSAPP_PROVIDER: selection }, fetch: () => twilioOk() });
      assert.deepEqual(await h.send(PHONE), delivery("twilio", "sms")); assert.equal(h.requests.length, 1);
    }
    const email = harness({ env: { ...RESEND_ENV, CONSUMER_AUTH_MODE: "smart", CONSUMER_PHONE_OTP_CHANNEL: "whatsapp", CONSUMER_WHATSAPP_PROVIDER: selection }, fetch: () => response({ id: UUID }) });
    assert.deepEqual(await email.send(), delivery("resend", "email")); assert.equal(email.requests.length, 1);
    const demo = harness({ env: { NODE_ENV: "test", CONSUMER_AUTH_MODE: "demo", CONSUMER_WHATSAPP_PROVIDER: selection } });
    assert.deepEqual(await demo.send(PHONE), delivery("demo", "sms", "simulated")); assert.equal(demo.requests.length, 0);
  }
});

test("explicit Meta misconfiguration never falls back to usable Twilio credentials", async () => {
  for (const [extra, code] of [
    [{ META_CONSUMER_OTP_ACCESS_TOKEN: undefined }, "meta_configuration_missing"],
    [{ META_CONSUMER_OTP_PHONE_NUMBER_ID: "123/../me" }, "meta_configuration_invalid"],
    [{ CONSUMER_WHATSAPP_PROVIDER: "invalid" }, "consumer_whatsapp_provider_invalid"],
  ]) {
    const h = harness({ env: { ...TWILIO_ENV, ...META_ENV, CONSUMER_AUTH_MODE: "whatsapp", ...extra } });
    await fails(h, code, PHONE); assert.equal(h.requests.length, 0);
    const res = await h.post(PHONE); assert.equal(res.status, 503); const body = await res.json();
    assert.equal(body.error, code); assertPublicPayload(body); assertSanitizedLogs(h);
  }
});

test("Meta start requires its receipt and exposes only acceptance; failed auth/HTTP/schema map honestly", async () => {
  for (const [factory, status, code] of [
    [() => response({ messaging_product: "whatsapp", messages: [{ id: META_RECEIPT, message_status: "accepted" }] }, 200), 200, null],
    [() => response({ error: { code: 190, message: RAW_ERROR } }, 401), 503, "meta_authentication_failed"],
    [() => response({ error: { code: 190, message: RAW_ERROR } }, 403), 503, "meta_authentication_failed"],
    [() => response({ error: { code: 190, type: "OAuthException", message: RAW_ERROR } }, 400), 503, "meta_authentication_failed"],
    [() => response({ error: { code: 132001, message: RAW_ERROR } }, 400), 502, "meta_delivery_failed"],
    [() => response({ messaging_product: "whatsapp", messages: [] }, 200), 502, "meta_receipt_invalid"],
    [() => { throw new Error(RAW_ERROR); }, 502, "meta_delivery_failed"],
  ]) {
    const h = harness({ env: { ...TWILIO_ENV, ...META_ENV, CONSUMER_AUTH_MODE: "whatsapp" }, fetch: factory });
    const res = await h.post(PHONE); assert.equal(res.status, status); const body = await res.json();
    if (code) assert.equal(body.error, code); else { assert.equal(body.ok, true); assert.deepEqual(body.delivery, { provider: "meta", channel: "whatsapp", status: "accepted" }); }
    assert.equal(h.requests.length, 1); assert.equal(new URL(h.requests[0].url).hostname, "graph.facebook.com");
    assertPublicPayload(body); assertSanitizedLogs(h);
    assert.equal(h.pendingTimers.size, 0);
  }
});

test("secondary Meta failure preserves successful email without claiming WhatsApp delivery or retrying Twilio", async () => {
  const h = harness({ env: { ...TWILIO_ENV, ...RESEND_ENV, ...META_ENV, CONSUMER_AUTH_MODE: "smart", CONSUMER_PHONE_OTP_CHANNEL: "whatsapp" }, secondaryContact: PHONE,
    fetch: (url) => new URL(url).hostname === "api.resend.com" ? response({ id: UUID }) : response({ error: { code: 190, message: RAW_ERROR } }, 401),
  });
  const res = await h.post(); assert.equal(res.status, 200); const body = await res.json();
  assert.deepEqual(body.delivery, { channel: "email", provider: "resend", status: "accepted" });
  assert.deepEqual(body.secondaryDelivery, { channel: "whatsapp", status: "failed" }); assert.equal(body.multiChannelDelivery, false);
  assert.equal(h.requests.length, 2); assert.equal(h.requests.some((entry) => new URL(entry.url).hostname === "api.twilio.com"), false);
  assertPublicPayload(body); assertSanitizedLogs(h);
});

test("Meta start body-read timeout returns no-store 504 with one Graph attempt and no fallback", async () => {
  let signal, pullStarted;
  const reading = new Promise((resolve) => { pullStarted = resolve; });
  const h = harness({ env: { ...TWILIO_ENV, ...META_ENV, CONSUMER_AUTH_MODE: "whatsapp" }, fetch: (_url, init) => {
    signal = init.signal;
    return new Response(new ReadableStream({ pull() { pullStarted(); return new Promise(() => {}); } }, { highWaterMark: 0 }));
  } });
  const pending = h.post(PHONE); await reading;
  assert.equal(h.pendingTimers.size, 1); h.fireTimers();
  const res = await pending; assert.equal(res.status, 504); assert.equal(res.headers.get("cache-control"), "no-store");
  const body = await res.json(); assert.deepEqual(body, { ok: false, error: "meta_delivery_timeout" });
  assert.equal(signal.aborted, true); assert.equal(h.requests.length, 1);
  assert.equal(new URL(h.requests[0].url).hostname, "graph.facebook.com"); assert.equal(h.pendingTimers.size, 0);
  assertSanitizedLogs(h); assertPublicPayload(body);
});

test("unknown, noop and malformed quoted modes fail closed; one matched quote pair remains valid", async () => {
  for (const mode of ["unknown", "noop", '""smart""', "''smart''", "'smart\"", '"smart', 'smart"']) {
    const h = harness({ env: { CONSUMER_AUTH_MODE: mode } });
    assert.equal(h.provider.consumerOtpDeliveryMode(), "invalid", mode);
    await fails(h, "consumer_auth_mode_invalid");
    assert.equal(h.mail.length + h.requests.length, 0);
  }
  for (const mode of ["smart", '"smart"', " 'smart' ", ' " SmArT " ']) {
    const h = harness({ env: { ...SMTP_ENV, CONSUMER_AUTH_MODE: mode } });
    assert.equal(h.provider.consumerOtpDeliveryMode(), "smart", mode);
    assert.deepEqual(await h.send(), delivery("smtp", "email"));
  }
});

test("demo delivery is forbidden for production, Vercel and Preview even when DEMO_MODE is enabled", async () => {
  for (const runtime of [{ NODE_ENV: "production" }, { NODE_ENV: "test", VERCEL: "1" }, { NODE_ENV: "test", VERCEL_ENV: "preview" }]) {
    const h = harness({ env: { ...runtime, CONSUMER_AUTH_MODE: "demo", DEMO_MODE: "true" } });
    await fails(h, "consumer_auth_demo_forbidden");
    const result = await h.auth.startConsumerAuth("demo.consumer@nexid.local");
    assert.deepEqual(result, { ok: false, error: "consumer_auth_demo_forbidden" });
    assert.equal(h.mail.length + h.requests.length, 0);
    assertSanitizedLogs(h, ["demo.consumer@nexid.local"]);
  }
});

test("configured driver names without credentials never acknowledge an OTP delivery", async () => {
  for (const [mode, contact, error] of [
    ["smtp", EMAIL, "smtp_credentials_missing"], ["resend", EMAIL, "resend_api_key_missing"],
    ["smart", EMAIL, "resend_api_key_missing"], ["provider", EMAIL, "resend_api_key_missing"],
    ["production", PHONE, "twilio_credentials_missing"], ["sms", PHONE, "twilio_credentials_missing"],
    ["whatsapp", PHONE, "twilio_credentials_missing"],
  ]) {
    const h = harness({ env: { CONSUMER_AUTH_MODE: mode } });
    await fails(h, error, contact);
    assert.equal(h.requests.length + h.mail.length, 0);
  }
});

test("explicit email provider selects only SMTP or Resend across email modes and normalizes one matched quote pair", async () => {
  for (const mode of ["smtp", "email", "resend", "smart", "production", "provider"]) {
    for (const [configured, expected] of [
      ["smtp", "smtp"], ["resend", "resend"], [" SMTP ", "smtp"], ["RESEND", "resend"],
      [' " SmTp " ', "smtp"], [" ' ReSeNd ' ", "resend"],
    ]) {
      const h = harness({
        env: { ...SMTP_ENV, ...RESEND_ENV, CONSUMER_AUTH_MODE: mode, CONSUMER_AUTH_EMAIL_PROVIDER: configured },
        fetch: async () => response({ id: UUID }),
      });
      assert.deepEqual(await h.send(), delivery(expected, "email"), `${mode}: ${configured}`);
      assert.equal(h.mail.length, expected === "smtp" ? 1 : 0);
      assert.equal(h.requests.length, expected === "resend" ? 1 : 0);
      if (expected === "resend") {
        assert.match(String(h.requests[0].url), /^https:\/\/api\.resend\.com\//);
        assert.equal(h.transports.length, 0);
      }
      assertSanitizedLogs(h);
    }
  }
});

test("an unset or blank email provider preserves the legacy priority including forced SMTP mode", async () => {
  for (const mode of ["smtp", "email", "resend", "smart", "production", "provider"]) {
    for (const configured of [undefined, "", " \t "]) {
      const h = harness({
        env: { ...SMTP_ENV, ...RESEND_ENV, CONSUMER_AUTH_MODE: mode, CONSUMER_AUTH_EMAIL_PROVIDER: configured },
      });
      assert.deepEqual(await h.send(), delivery("smtp", "email"), mode);
      assert.equal(h.mail.length, 1);
      assert.equal(h.requests.length, 0);
      assertSanitizedLogs(h);
    }
    const onlyResend = harness({
      env: { ...RESEND_ENV, CONSUMER_AUTH_MODE: mode, CONSUMER_AUTH_EMAIL_PROVIDER: " " },
      fetch: async () => response({ id: UUID }),
    });
    if (mode === "smtp") {
      await fails(onlyResend, "smtp_credentials_missing");
      assert.equal(onlyResend.requests.length, 0);
    } else {
      assert.deepEqual(await onlyResend.send(), delivery("resend", "email"), mode);
      assert.equal(onlyResend.requests.length, 1);
    }
    assert.equal(onlyResend.mail.length, 0);
    assertSanitizedLogs(onlyResend);
  }
});

test("email provider misconfiguration fails with stable 503 errors and never falls back to another ready provider", async () => {
  for (const mode of ["smtp", "email", "resend", "smart", "production", "provider"]) {
    for (const [configured, credentials, error] of [
      ["smtp", RESEND_ENV, "smtp_credentials_missing"],
      ["resend", SMTP_ENV, "resend_api_key_missing"],
    ]) {
      const h = harness({ env: { ...credentials, CONSUMER_AUTH_MODE: mode, CONSUMER_AUTH_EMAIL_PROVIDER: configured } });
      const result = await h.post();
      assert.equal(result.status, 503);
      assert.deepEqual(await result.json(), { ok: false, error });
      assert.equal(h.requests.length + h.mail.length + h.transports.length, 0);
      assertSanitizedLogs(h);
    }
    for (const configured of ["ses", '""smtp""', "''resend''", "'smtp\"", '"smtp', 'resend"', "SMTP-INVALID", RAW_ERROR]) {
      const h = harness({ env: { ...SMTP_ENV, ...RESEND_ENV, CONSUMER_AUTH_MODE: mode, CONSUMER_AUTH_EMAIL_PROVIDER: configured } });
      const result = await h.post();
      assert.equal(result.status, 503);
      assert.deepEqual(await result.json(), { ok: false, error: "consumer_auth_email_provider_invalid" });
      assert.equal(result.headers.get("cache-control"), "no-store");
      assert.equal(h.requests.length + h.mail.length + h.transports.length, 0);
      assertSanitizedLogs(h);
    }
  }
  const invalidMode = harness({ env: { ...RESEND_ENV, CONSUMER_AUTH_MODE: "not-a-mode", CONSUMER_AUTH_EMAIL_PROVIDER: "resend" } });
  const result = await invalidMode.post();
  assert.equal(result.status, 503);
  assert.deepEqual(await result.json(), { ok: false, error: "consumer_auth_mode_invalid" });
  assert.equal(invalidMode.requests.length + invalidMode.mail.length, 0);
});

test("email provider selection never changes phone or demo delivery and a secondary email failure preserves primary phone success", async () => {
  for (const mode of ["smart", "production", "provider", "sms", "twilio", "whatsapp", "twilio_whatsapp"]) {
    for (const configured of ["smtp", "resend", "invalid-email-provider"]) {
      const h = harness({
        env: { ...TWILIO_ENV, CONSUMER_AUTH_MODE: mode, CONSUMER_AUTH_EMAIL_PROVIDER: configured },
        fetch: async () => twilioOk(),
      });
      const channel = ["whatsapp", "twilio_whatsapp"].includes(mode) ? "whatsapp" : "sms";
      assert.deepEqual(await h.send(PHONE), delivery("twilio", channel));
      assert.equal(h.requests.length, 1);
      assert.match(String(h.requests[0].url), /^https:\/\/api\.twilio\.com\//);
      assert.equal(h.mail.length + h.transports.length, 0);
      assertSanitizedLogs(h);
    }
  }
  for (const mode of ["sms", "twilio", "whatsapp", "twilio_whatsapp"]) {
    const h = harness({ env: { ...SMTP_ENV, ...RESEND_ENV, ...TWILIO_ENV, CONSUMER_AUTH_MODE: mode, CONSUMER_AUTH_EMAIL_PROVIDER: "invalid-email-provider" } });
    const result = await h.post(EMAIL);
    assert.equal(result.status, 422);
    assert.deepEqual(await result.json(), { ok: false, error: "phone_contact_required" });
    assert.equal(h.requests.length + h.mail.length, 0);
  }
  const demo = harness({ env: { NODE_ENV: "test", CONSUMER_AUTH_MODE: "demo", CONSUMER_AUTH_EMAIL_PROVIDER: "invalid-email-provider" } });
  assert.deepEqual(await demo.send(), delivery("demo", "email", "simulated"));
  assert.equal(demo.requests.length + demo.mail.length, 0);

  const primary = harness({
    env: { ...TWILIO_ENV, ...SMTP_ENV, ...RESEND_ENV, CONSUMER_AUTH_MODE: "smart", CONSUMER_AUTH_EMAIL_PROVIDER: "invalid-email-provider" },
    secondaryContact: EMAIL, fetch: async () => twilioOk(),
  });
  const result = await primary.post(PHONE);
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.deepEqual(body.delivery, delivery("twilio", "sms").delivery);
  assert.deepEqual(body.secondaryDelivery, { channel: "email", status: "failed" });
  assert.equal(body.multiChannelDelivery, false);
  assert.equal(body.deliveryChannel, "sms");
  assert.equal(primary.requests.length, 1);
  assert.equal(primary.mail.length + primary.transports.length, 0);
  assertPublicPayload(body);
  assertSanitizedLogs(primary);
  assert.ok(primary.logs.some((line) => line.includes('"reason":"consumer_auth_email_provider_invalid"')));
});

test("SMTP accepts the requested address only when it is accepted and is absent from rejected", async () => {
  for (const info of [
    { accepted: [EMAIL], rejected: [] },
    { accepted: [{ address: ` ${EMAIL.toUpperCase()} ` }], rejected: ["another@example.test"] },
  ]) {
    const h = harness({ env: { ...SMTP_ENV, CONSUMER_AUTH_MODE: "smtp" }, sendMail: async () => ({ ...info, messageId: SMTP_RECEIPT }) });
    assert.deepEqual(await h.send(), delivery("smtp", "email"));
    assert.equal(h.closed.length, 1);
    assert.equal(h.pendingTimers.size, 0);
    assertSanitizedLogs(h);
  }
  for (const info of [
    { accepted: [], rejected: [] }, { accepted: ["another@example.test"], rejected: [] },
    { accepted: [EMAIL], rejected: [EMAIL] }, { accepted: [EMAIL], rejected: [{ address: EMAIL.toUpperCase() }] },
    { accepted: EMAIL, rejected: [] }, {},
  ]) {
    const h = harness({ env: { ...SMTP_ENV, CONSUMER_AUTH_MODE: "smtp" }, sendMail: async () => info });
    await fails(h, "smtp_receipt_invalid");
    assert.equal(h.closed.length, 1);
    assertSanitizedLogs(h);
  }
});

test("SMTP accepts internationalized domains using the real Nodemailer envelope representation", async () => {
  const MailComposer = localRequire("nodemailer/lib/mail-composer");
  const contact = "user@bücher.example";
  const envelope = new MailComposer({ from: "sender@example.test", to: contact, text: "fixture" }).compile().getEnvelope();
  assert.deepEqual(envelope.to, ["user@xn--bcher-kva.example"]);
  const h = harness({ env: { ...SMTP_ENV, CONSUMER_AUTH_MODE: "smtp" }, sendMail: async () => ({ accepted: envelope.to, rejected: [] }) });
  assert.deepEqual(await h.send(contact), delivery("smtp", "email"));
  assertSanitizedLogs(h, [contact, ...envelope.to]);
  const rejected = harness({ env: { ...SMTP_ENV, CONSUMER_AUTH_MODE: "smtp" }, sendMail: async () => ({ accepted: envelope.to, rejected: [contact] }) });
  await fails(rejected, "smtp_receipt_invalid", contact);
});

test("SMTP normalizes transport failures and configures driver-owned timeouts", async () => {
  const failed = harness({ env: { ...SMTP_ENV, CONSUMER_AUTH_MODE: "smtp" }, sendMail: async () => { throw new Error(RAW_ERROR); } });
  await fails(failed, "smtp_delivery_failed");
  assert.equal(failed.closed.length, 1);
  assertSanitizedLogs(failed);
  const h = harness({ env: { ...SMTP_ENV, CONSUMER_AUTH_MODE: "smtp" }, sendMail: async () => { throw Object.assign(new Error(RAW_ERROR), { code: "ETIMEDOUT" }); } });
  await fails(h, "smtp_delivery_timeout");
  for (const name of ["dnsTimeout", "connectionTimeout", "greetingTimeout", "socketTimeout"]) assert.equal(h.transports[0][name], 10_000);
  assert.deepEqual(h.timeouts, []);
  assert.equal(h.pendingTimers.size, 0);
  assert.equal(h.closed.length, 1);
  assertSanitizedLogs(h);
});

test("real Nodemailer closes its SMTP connection before a driver timeout rejects, without network", async (t) => {
  const SMTPConnection = localRequire("nodemailer/lib/smtp-connection");
  let connectionsClosed = 0;
  t.mock.method(SMTPConnection.prototype, "connect", function () {
    this.emit("error", Object.assign(new Error(RAW_ERROR), { code: "ETIMEDOUT" }));
  });
  t.mock.method(SMTPConnection.prototype, "close", function () { connectionsClosed += 1; });
  const h = harness({ env: { ...SMTP_ENV, CONSUMER_AUTH_MODE: "smtp" }, realSmtp: true });
  await fails(h, "smtp_delivery_timeout");
  assert.ok(connectionsClosed > 0);
  assert.deepEqual(h.timeouts, []);
  assertSanitizedLogs(h);
});

test("provider audit preserves safe receipt and failure diagnostics without raw provider details", async () => {
  const smtp = harness({
    env: { ...SMTP_ENV, CONSUMER_AUTH_MODE: "smtp" },
    sendMail: async () => { throw Object.assign(new Error(RAW_ERROR), { code: "EAUTH", responseCode: 535 }); },
  });
  await fails(smtp, "smtp_delivery_failed");
  const smtpAudit = JSON.parse(smtp.logs[0].slice("[consumer_auth_delivery_audit] ".length));
  assert.equal(smtpAudit.providerStatus, "authentication_failed");
  assert.equal(smtpAudit.errorCode, 535);
  assertSanitizedLogs(smtp);

  const twilio = harness({
    env: { ...TWILIO_ENV, CONSUMER_AUTH_MODE: "sms" },
    fetch: async () => twilioOk({ status: "failed", error_code: 21610, error_message: RAW_ERROR }),
  });
  await fails(twilio, "twilio_receipt_invalid", PHONE);
  const twilioAudit = JSON.parse(twilio.logs[0].slice("[consumer_auth_delivery_audit] ".length));
  assert.equal(twilioAudit.providerStatus, "failed");
  assert.equal(twilioAudit.errorCode, 21610);
  assert.equal(twilioAudit.httpStatus, 201);
  assert.equal(twilioAudit.receiptHash, createHash("sha256").update(SID).digest("hex").slice(0, 16));
  assertSanitizedLogs(twilio);
});

test("Twilio accepts only complete SM/MM receipts in outbound accepted states", async () => {
  for (const prefix of ["SM", "MM"]) {
    for (const status of ["accepted", "queued", "sending", "sent", "delivered", "read"]) {
      const h = harness({ env: { ...TWILIO_ENV, CONSUMER_AUTH_MODE: "sms" }, fetch: async () => twilioOk({ sid: `${prefix}${"a".repeat(32)}`, status }) });
      assert.deepEqual(await h.send(PHONE), delivery("twilio", "sms"));
      assert.deepEqual(h.timeouts, [10_000]);
      assert.equal(h.requests[0].init.body.get("To"), PHONE);
      assertSanitizedLogs(h, [`${prefix}${"a".repeat(32)}`]);
    }
  }
  for (const invalid of [
    { sid: "SMshort" }, { sid: `AC${"a".repeat(32)}` }, { sid: `SM${"z".repeat(32)}` }, { sid: null },
    { status: "received" }, { status: "receiving" }, { status: "scheduled" }, { status: "canceled" },
    { status: "failed" }, { status: "undelivered" }, { status: RAW_ERROR }, { error_code: 21610 }, { error_code: 0 }, { error_code: "0" },
  ]) {
    const h = harness({ env: { ...TWILIO_ENV, CONSUMER_AUTH_MODE: "sms" }, fetch: async () => twilioOk(invalid) });
    await fails(h, "twilio_receipt_invalid", PHONE);
    assertSanitizedLogs(h);
  }
});

test("Resend requires a UUID receipt rather than HTTP success alone", async () => {
  const h = harness({ env: { ...RESEND_ENV, CONSUMER_AUTH_MODE: "resend" }, fetch: async () => response({ id: UUID }) });
  assert.deepEqual(await h.send(), delivery("resend", "email"));
  assert.deepEqual(h.timeouts, [10_000]);
  assertSanitizedLogs(h);
  for (const invalid of [{}, { id: "accepted" }, { id: SID }, { id: 123 }, { id: `${UUID}extra` }]) {
    const rejected = harness({ env: { ...RESEND_ENV, CONSUMER_AUTH_MODE: "resend" }, fetch: async () => response(invalid) });
    await fails(rejected, "resend_receipt_invalid");
    assertSanitizedLogs(rejected);
  }
});

test("HTTP, malformed JSON, network and timeout errors remain sanitized for both remote providers", async () => {
  for (const [mode, config, contact, provider] of [["resend", RESEND_ENV, EMAIL, "resend"], ["sms", TWILIO_ENV, PHONE, "twilio"]]) {
    for (const [fetch, reason] of [
      [async () => response({ code: 20429, message: RAW_ERROR }, 429), `${provider}_delivery_failed`],
      [async () => new Response("invalid provider response", { status: 200 }), `${provider}_receipt_invalid`],
      [async () => { throw new Error(RAW_ERROR); }, `${provider}_delivery_failed`],
      [async () => { const error = new Error(RAW_ERROR); error.name = "TimeoutError"; throw error; }, `${provider}_delivery_timeout`],
      [async () => { const error = new Error(RAW_ERROR); error.name = "AbortError"; throw error; }, `${provider}_delivery_timeout`],
    ]) {
      const h = harness({ env: { ...config, CONSUMER_AUTH_MODE: mode }, fetch });
      await fails(h, reason, contact);
      assertSanitizedLogs(h);
    }
  }
});

test("smart routes email and phones to configured drivers, including Whatsapp; local demo is simulated", async () => {
  for (const [env, contact, expected] of [
    [{ ...SMTP_ENV, CONSUMER_AUTH_MODE: "smart" }, EMAIL, delivery("smtp", "email")],
    [{ ...RESEND_ENV, CONSUMER_AUTH_MODE: "smart" }, EMAIL, delivery("resend", "email")],
    [{ ...TWILIO_ENV, CONSUMER_AUTH_MODE: "smart" }, PHONE, delivery("twilio", "sms")],
    [{ ...TWILIO_ENV, CONSUMER_AUTH_MODE: "smart", CONSUMER_PHONE_OTP_CHANNEL: "whatsapp" }, PHONE, delivery("twilio", "whatsapp")],
    [{ ...TWILIO_ENV, CONSUMER_AUTH_MODE: "whatsapp" }, PHONE, delivery("twilio", "whatsapp")],
    [{ NODE_ENV: "test", CONSUMER_AUTH_MODE: "demo" }, EMAIL, delivery("demo", "email", "simulated")],
  ]) {
    const h = harness({ env, fetch: async (url) => url.includes("resend") ? response({ id: UUID }) : twilioOk() });
    assert.deepEqual(await h.send(contact), expected);
    if (expected.delivery.channel === "whatsapp") assert.equal(h.requests[0].init.body.get("To"), `whatsapp:${PHONE}`);
    assertSanitizedLogs(h);
  }
  const invalid = harness({ env: { ...TWILIO_ENV, CONSUMER_AUTH_MODE: "smart", CONSUMER_PHONE_OTP_CHANNEL: "telegram" } });
  await fails(invalid, "consumer_phone_otp_channel_invalid", PHONE);
});

test("WhatsApp authentication template sends only the OTP variable and preserves SMS/free-form fallback", async () => {
  const contentSid = `HX${"c".repeat(32)}`;
  const h = harness({ env: { ...TWILIO_ENV, CONSUMER_AUTH_MODE: "whatsapp", TWILIO_WHATSAPP_AUTH_CONTENT_SID: `"${contentSid}"` }, fetch: async () => twilioOk() });
  assert.deepEqual(await h.send(PHONE), delivery("twilio", "whatsapp"));
  const body = h.requests[0].init.body;
  assert.equal(body.get("ContentSid"), contentSid);
  assert.deepEqual(JSON.parse(body.get("ContentVariables")), { "1": CODE });
  assert.equal(body.has("Body"), false);
  assert.equal(body.has("MediaUrl"), false);
  assert.equal(body.toString().includes(MAGIC), false);
  assertSanitizedLogs(h, [contentSid]);
  for (const [mode, content] of [["whatsapp", ""], ["sms", contentSid]]) {
    const legacy = harness({ env: { ...TWILIO_ENV, CONSUMER_AUTH_MODE: mode, TWILIO_WHATSAPP_AUTH_CONTENT_SID: content }, fetch: async () => twilioOk() });
    await legacy.send(PHONE);
    assert.equal(legacy.requests[0].init.body.has("ContentSid"), false);
    assert.ok(legacy.requests[0].init.body.get("Body").includes(CODE));
    assertSanitizedLogs(legacy);
  }
  for (const invalid of ["HXshort", `SM${"c".repeat(32)}`, `HX${"z".repeat(32)}`]) {
    const rejected = harness({ env: { ...TWILIO_ENV, CONSUMER_AUTH_MODE: "whatsapp", TWILIO_WHATSAPP_AUTH_CONTENT_SID: invalid } });
    await fails(rejected, "twilio_content_sid_invalid", PHONE);
    assert.equal(rejected.requests.length, 0);
  }
});

test("dedicated consumer WhatsApp sender takes precedence over shared sender pools in every WhatsApp mode", async () => {
  const dedicated = "whatsapp:+12025550126";
  for (const mode of ["whatsapp", "twilio_whatsapp", "smart", "production", "provider"]) {
    for (const value of [dedicated, ` '${dedicated}' `, `"${dedicated}"`]) {
      const h = harness({ env: {
        ...TWILIO_ENV, CONSUMER_AUTH_MODE: mode, CONSUMER_PHONE_OTP_CHANNEL: "whatsapp",
        TWILIO_CONSUMER_OTP_WHATSAPP_FROM: value,
        TWILIO_WHATSAPP_FROM: "whatsapp:+14155238886", TWILIO_MESSAGING_SERVICE_SID: `MG${"c".repeat(32)}`,
      }, fetch: async () => twilioOk() });
      assert.deepEqual(await h.send(PHONE), delivery("twilio", "whatsapp"));
      const body = h.requests[0].init.body;
      assert.equal(body.get("From"), dedicated);
      assert.equal(body.has("MessagingServiceSid"), false);
      assert.equal(body.get("To"), `whatsapp:${PHONE}`);
      assertSanitizedLogs(h, [dedicated, value]);
    }
  }
  const onlyDedicated = harness({ env: {
    TWILIO_ACCOUNT_SID: TWILIO_ENV.TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN: TWILIO_ENV.TWILIO_AUTH_TOKEN,
    CONSUMER_AUTH_MODE: "whatsapp", TWILIO_CONSUMER_OTP_WHATSAPP_FROM: dedicated,
    TWILIO_CONSUMER_OTP_INBOUND_WEBHOOK_URL: "invalid-inbound-url-does-not-configure-outbound",
  }, fetch: async () => twilioOk() });
  assert.deepEqual(await onlyDedicated.send(PHONE), delivery("twilio", "whatsapp"));
  assert.equal(onlyDedicated.requests[0].init.body.get("From"), dedicated);
  assert.equal(onlyDedicated.requests[0].init.body.has("MessagingServiceSid"), false);
});

test("blank dedicated WhatsApp sender preserves legacy aliases and shared service priority exactly", async () => {
  for (const value of [undefined, "", " ", '""', "''"]) {
    for (const legacy of [
      {},
      { TWILIO_WHATSAPP_FROM: undefined, TWILIO_FROM_WHATSAPP: "whatsapp:+12025550127" },
      { TWILIO_MESSAGING_SERVICE_SID: `MG${"c".repeat(32)}` },
    ]) {
      const env = { ...TWILIO_ENV, CONSUMER_AUTH_MODE: "whatsapp", ...legacy };
      const baseline = harness({ env, fetch: async () => twilioOk() });
      const configured = harness({ env: { ...env, TWILIO_CONSUMER_OTP_WHATSAPP_FROM: value }, fetch: async () => twilioOk() });
      assert.deepEqual(await configured.send(PHONE), await baseline.send(PHONE));
      assert.equal(configured.requests[0].init.body.toString(), baseline.requests[0].init.body.toString());
    }
  }
});

test("invalid dedicated WhatsApp sender fails closed before HTTP even with a shared service configured", async () => {
  for (const value of [
    "+12025550126", "WhatsApp:+12025550126", "whatsapp:12025550126", "whatsapp:+012025550126",
    "whatsapp:+1 (202) 555-0126", "whatsapp:+1234567", "whatsapp:+1234567890123456",
    '"whatsapp:+12025550126', "whatsapp:+12025550126\nFrom:other",
  ]) {
    const h = harness({ env: {
      ...TWILIO_ENV, CONSUMER_AUTH_MODE: "smart", CONSUMER_PHONE_OTP_CHANNEL: "whatsapp",
      TWILIO_CONSUMER_OTP_WHATSAPP_FROM: value, TWILIO_MESSAGING_SERVICE_SID: `MG${"c".repeat(32)}`,
    } });
    await fails(h, "twilio_consumer_otp_whatsapp_from_invalid", PHONE);
    const result = await h.post(PHONE);
    assert.equal(result.status, 503);
    assert.deepEqual(await result.json(), { ok: false, error: "twilio_consumer_otp_whatsapp_from_invalid" });
    assert.equal(h.requests.length, 0);
    assertSanitizedLogs(h, [value]);
  }
});

test("dedicated WhatsApp configuration never changes SMS, email or campaign sender selection", async () => {
  for (const mode of ["sms", "twilio", "smart", "production", "provider"]) {
    const h = harness({ env: {
      ...TWILIO_ENV, CONSUMER_AUTH_MODE: mode, TWILIO_CONSUMER_OTP_WHATSAPP_FROM: "invalid-dedicated-sender",
      TWILIO_MESSAGING_SERVICE_SID: `MG${"c".repeat(32)}`,
    }, fetch: async () => twilioOk() });
    assert.deepEqual(await h.send(PHONE), delivery("twilio", "sms"));
    assert.equal(h.requests[0].init.body.get("MessagingServiceSid"), `MG${"c".repeat(32)}`);
    assert.equal(h.requests[0].init.body.has("From"), false);
  }
  for (const mode of ["smtp", "email", "resend", "smart", "production", "provider"]) {
    const h = harness({ env: {
      ...SMTP_ENV, CONSUMER_AUTH_MODE: mode, TWILIO_CONSUMER_OTP_WHATSAPP_FROM: "invalid-dedicated-sender",
    } });
    assert.deepEqual(await h.send(EMAIL), delivery("smtp", "email"));
    assert.equal(h.requests.length, 0);
  }
  const campaignSource = source("../src/app/admin/campaigns/test-whatsapp/route.ts");
  assert.match(campaignSource, /env\("TWILIO_WHATSAPP_FROM"\) \|\| env\("TWILIO_FROM_WHATSAPP"\)/);
  assert.doesNotMatch(campaignSource, /TWILIO_CONSUMER_OTP_WHATSAPP_FROM|getConsumerOtpWhatsappFrom|consumer-otp-twilio-config/);
});

test("dedicated Sandbox sender cannot bypass the production guard through a shared Messaging Service", async () => {
  for (const runtime of [{ NODE_ENV: "production" }, { NODE_ENV: "test", VERCEL_ENV: "preview" }, { NODE_ENV: "test", VERCEL: "1" }]) {
    const h = harness({ env: {
      ...TWILIO_ENV, ...runtime, CONSUMER_AUTH_MODE: "whatsapp",
      TWILIO_CONSUMER_OTP_WHATSAPP_FROM: "whatsapp:+14155238886", TWILIO_MESSAGING_SERVICE_SID: `MG${"c".repeat(32)}`,
    } });
    await fails(h, "twilio_whatsapp_sandbox_forbidden", PHONE);
    assert.equal(h.requests.length, 0);
  }
});

test("known WhatsApp Sandbox sender is forbidden in production-like runtimes before any HTTP request", async () => {
  for (const runtime of [{ NODE_ENV: "production" }, { NODE_ENV: "test", VERCEL_ENV: "preview" }, { NODE_ENV: "test", VERCEL: "1" }]) {
    for (const from of ["+14155238886", "whatsapp:+14155238886", " WhatsApp:+1 (415) 523-8886 ", '"whatsapp:+14155238886"']) {
      const h = harness({ env: { ...TWILIO_ENV, ...runtime, CONSUMER_AUTH_MODE: "whatsapp", TWILIO_WHATSAPP_FROM: from } });
      await fails(h, "twilio_whatsapp_sandbox_forbidden", PHONE);
      const result = await h.post(PHONE);
      assert.equal(result.status, 503);
      assert.deepEqual(await result.json(), { ok: false, error: "twilio_whatsapp_sandbox_forbidden" });
      assert.equal(h.requests.length, 0);
      assertSanitizedLogs(h, [from, "14155238886"]);
    }
  }
  for (const extra of [
    { NODE_ENV: "test" },
    { TWILIO_WHATSAPP_FROM: TWILIO_ENV.TWILIO_WHATSAPP_FROM },
    { TWILIO_MESSAGING_SERVICE_SID: `MG${"c".repeat(32)}` },
    { CONSUMER_AUTH_MODE: "sms", TWILIO_FROM_NUMBER: "+14155238886" },
  ]) {
    const h = harness({ env: { ...TWILIO_ENV, CONSUMER_AUTH_MODE: "whatsapp", TWILIO_WHATSAPP_FROM: "whatsapp:+14155238886", ...extra }, fetch: async () => twilioOk() });
    assert.equal((await h.send(PHONE)).delivery.status, "accepted");
    assert.equal(h.requests.length, 1);
  }
});

test("Twilio status URL is production-only by default and never comes from the inbound URL", async () => {
  const canonical = "https://api.nexid.lat/twilio/consumer-otp/status";
  const preview = "https://otp-preview.example.test/twilio/consumer-otp/status";
  for (const [runtime, expected] of [
    [{ VERCEL_ENV: "production" }, canonical],
    [{ NODE_ENV: "production" }, null],
    [{ NODE_ENV: "test" }, null],
    [{ VERCEL_ENV: "preview" }, null],
    [{ VERCEL_ENV: "preview", TWILIO_CONSUMER_OTP_STATUS_CALLBACK_URL: preview }, preview],
  ]) {
    const h = harness({ env: { ...TWILIO_ENV, ...runtime, CONSUMER_AUTH_MODE: "sms", TWILIO_INBOUND_WEBHOOK_URL: "https://wrong.example.test/twilio/whatsapp/inbound" }, fetch: async () => twilioOk() });
    await h.send(PHONE);
    assert.equal(h.requests[0].init.body.get("StatusCallback"), expected);
  }
  const invalid = harness({ env: { ...TWILIO_ENV, CONSUMER_AUTH_MODE: "sms", TWILIO_CONSUMER_OTP_STATUS_CALLBACK_URL: "http://localhost/twilio/consumer-otp/status" } });
  await fails(invalid, "twilio_status_callback_url_invalid", PHONE);
  assert.equal(invalid.requests.length, 0);
});

test("production mock-social contact with DEMO_MODE still calls and requires its real configured driver", async () => {
  const h = harness({ env: { ...SMTP_ENV, CONSUMER_AUTH_MODE: "smart", DEMO_MODE: "true" } });
  const result = await h.auth.startConsumerAuth("demo.consumer@nexid.local");
  assert.equal(result.ok, true);
  assert.deepEqual(result.delivery, delivery("smtp", "email").delivery);
  assert.equal(h.mail.length, 1);
  assert.equal(h.mail[0].to, "demo.consumer@nexid.local");
  assertSanitizedLogs(h, ["demo.consumer@nexid.local"]);
  const unavailable = harness({ env: { CONSUMER_AUTH_MODE: "smart", DEMO_MODE: "true" } });
  assert.deepEqual(await unavailable.auth.startConsumerAuth("demo.consumer@nexid.local"), { ok: false, error: "resend_api_key_missing" });
});

test("start persists hashes and returns only a receipt summary publicly, without code, SID or magic token", async () => {
  const h = harness({ env: { ...TWILIO_ENV, CONSUMER_AUTH_MODE: "sms", CONSUMER_AUTH_DEBUG_CODE_RESPONSE: "true" }, fetch: async () => twilioOk() });
  const result = await h.post(PHONE);
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.deepEqual(body.delivery, delivery("twilio", "sms").delivery);
  assert.equal(body.deliveryChannel, "sms");
  assert.equal(body.multiChannelDelivery, false);
  assert.equal(body.twoFactor, false);
  assert.equal(body.authenticationFactorsRequired, 1);
  assertPublicPayload(body);
  const inserts = h.queries.filter(({ text }) => text.startsWith("INSERT INTO consumer_auth_challenges"));
  assert.equal(inserts.length, 1);
  assert.ok(inserts[0].values.includes(createHash("sha256").update(CODE).digest("hex")));
  assert.ok(inserts[0].values.includes(createHash("sha256").update(MAGIC).digest("hex")));
  assert.ok(!inserts[0].values.includes(CODE) && !inserts[0].values.includes(MAGIC));
  assertSanitizedLogs(h);
});

test("a failed secondary delivery never claims multi-channel success or a second authentication factor", async () => {
  for (const accepted of [false, true]) {
    const h = harness({
      env: { ...SMTP_ENV, ...TWILIO_ENV, CONSUMER_AUTH_MODE: "smart" }, secondaryContact: PHONE,
      fetch: async () => twilioOk({ status: accepted ? "queued" : "failed" }),
    });
    const result = await h.post();
    assert.equal(result.status, 200);
    const body = await result.json();
    assert.deepEqual(body.delivery, delivery("smtp", "email").delivery);
    assert.deepEqual(body.secondaryDelivery, { channel: "sms", status: accepted ? "accepted" : "failed" });
    assert.equal(body.multiChannelDelivery, accepted);
    assert.equal(body.deliveryChannel, accepted ? "email_and_phone_same_challenge" : "email");
    assert.equal(body.twoFactor, false);
    assert.equal(body.authenticationFactorsRequired, 1);
    assertPublicPayload(body);
    assertSanitizedLogs(h);
  }
});

test("start route maps configuration, invalid receipts and timeouts to explicit non-success status", async () => {
  for (const [env, fetch, contact, status, error] of [
    [{ CONSUMER_AUTH_MODE: "noop" }, undefined, EMAIL, 503, "consumer_auth_mode_invalid"],
    [{ CONSUMER_AUTH_MODE: "demo" }, undefined, EMAIL, 503, "consumer_auth_demo_forbidden"],
    [{ CONSUMER_AUTH_MODE: "smtp" }, undefined, EMAIL, 503, "smtp_credentials_missing"],
    [{ ...TWILIO_ENV, CONSUMER_AUTH_MODE: "whatsapp", TWILIO_WHATSAPP_AUTH_CONTENT_SID: "invalid" }, undefined, PHONE, 503, "twilio_content_sid_invalid"],
    [{ ...TWILIO_ENV, CONSUMER_AUTH_MODE: "sms", TWILIO_CONSUMER_OTP_STATUS_CALLBACK_URL: "invalid" }, undefined, PHONE, 503, "twilio_status_callback_url_invalid"],
    [{ ...TWILIO_ENV, CONSUMER_AUTH_MODE: "sms" }, async () => twilioOk({ sid: "bad" }), PHONE, 502, "twilio_receipt_invalid"],
    [{ ...RESEND_ENV, CONSUMER_AUTH_MODE: "resend" }, async () => { const error = new Error(RAW_ERROR); error.name = "TimeoutError"; throw error; }, EMAIL, 504, "resend_delivery_timeout"],
  ]) {
    const h = harness({ env, fetch });
    const result = await h.post(contact);
    assert.equal(result.status, status);
    assert.deepEqual(await result.json(), { ok: false, error });
    assert.equal(result.headers.get("cache-control"), "no-store");
    assertSanitizedLogs(h);
  }
});

test("local demo start remains explicitly simulated with no transport and no public debug code by default", async () => {
  const h = harness({ env: { NODE_ENV: "test", CONSUMER_AUTH_MODE: "demo" } });
  const result = await h.post();
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.deepEqual(body.delivery, delivery("demo", "email", "simulated").delivery);
  assert.equal(body.deliveryChannel, "demo");
  assert.equal(body.multiChannelDelivery, false);
  assert.equal(h.requests.length + h.mail.length, 0);
  assertPublicPayload(body);
  assertSanitizedLogs(h);
});

for (const [label, runtime] of [
  ["Preview", { NODE_ENV: "test", VERCEL_ENV: "preview" }],
  ["Vercel", { NODE_ENV: "test", VERCEL: "1" }],
]) {
  test(`${label} runtime cannot expose a debug OTP even if NODE_ENV is not production`, async () => {
    const h = harness({ env: { ...SMTP_ENV, ...runtime, CONSUMER_AUTH_MODE: "smtp", CONSUMER_AUTH_DEBUG_CODE_RESPONSE: "true" } });
    const result = await h.post();
    assert.equal(result.status, 200);
    assertPublicPayload(await result.json());
  });
}

for (const [label, options] of [
  ["rate-limited", { rateResult: { limited: true } }],
  ["unavailable", { rateResult: { unavailable: true } }],
  ["dependency-error", { rateError: new Error(RAW_ERROR) }],
]) {
  test(`${label} start attempts never log a full contact or raw dependency error`, async () => {
    const h = harness({ ...options, env: { ...SMTP_ENV, CONSUMER_AUTH_MODE: "smtp" } });
    const result = await h.auth.startConsumerAuth(EMAIL, { ip: "198.51.100.42" });
    assert.equal(result.ok, false);
    assert.equal(h.requests.length + h.mail.length, 0);
    assert.equal(h.queries.length, 0);
    assertSanitizedLogs(h);
  });
}
