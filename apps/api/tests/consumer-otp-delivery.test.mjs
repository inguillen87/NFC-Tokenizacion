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
const RAW_ERROR = `untrusted provider error ${EMAIL} ${PHONE} ${CODE} ${SMTP_ENV.SMTP_PASSWORD} ${TWILIO_ENV.TWILIO_AUTH_TOKEN}`;
const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const compiled = Object.fromEntries(Object.entries({
  status: source("../src/lib/consumer-otp-twilio-status.ts"),
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
  let provider, auth, statusHelper;
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
    if (name === "./consumer-otp-twilio-status") return statusHelper;
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
  statusHelper = load("status");
  provider = load("provider");
  auth = load("auth");
  const route = load("route");
  return {
    provider, auth, logs, requests, mail, transports, queries, rates, timeouts, closed, pendingTimers,
    send: (contact = EMAIL) => provider.resolveConsumerOtpProvider().sendOtp({ contact, code: CODE, ttlMinutes: 10, magicToken: MAGIC }),
    fireTimers: () => { for (const callback of [...pendingTimers.values()]) callback(); },
    post: (contact = EMAIL) => route.POST(new Request("https://otp-fixture.invalid/consumer/auth/start", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contact }),
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
    RAW_ERROR, ...extra]) {
    assert.equal(serialized.includes(forbidden), false, "audit output contains a sensitive fixture value");
  }
}
function assertPublicPayload(body) {
  const text = JSON.stringify(body);
  for (const value of [CODE, MAGIC, SID, UUID, SMTP_RECEIPT, SMTP_ENV.SMTP_PASSWORD, RESEND_ENV.RESEND_API_KEY, TWILIO_ENV.TWILIO_AUTH_TOKEN]) {
    assert.equal(text.includes(value), false, "public response contains a private delivery fixture value");
  }
  assert.equal(Object.hasOwn(body, "code"), false);
  assert.doesNotMatch(text, /"(?:sid|messageId|receiptHash|magicToken|code_hash)"/);
}

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
