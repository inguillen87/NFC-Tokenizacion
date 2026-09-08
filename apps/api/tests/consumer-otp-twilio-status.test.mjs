import assert from "node:assert/strict";
import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import test from "node:test";
import ts from "typescript";
import twilio from "twilio";

// All credentials, identifiers and contacts are synthetic. The four production
// modules execute with an isolated environment and no database or network access.
const CALLBACK_URL = "https://api.nexid.lat/twilio/consumer-otp/status";
const CUSTOM_CALLBACK_URL = "https://callbacks.example.test/twilio/consumer-otp/status";
const ACCOUNT_SID = `AC${"b".repeat(32)}`;
const MESSAGE_SID = `SM${"a".repeat(32)}`;
const AUTH_TOKEN = "fixture-status-signing-token";
const PHONE = "+12025550123";
const OTP = "659214";
const BODY = `Tu codigo de acceso es ${OTP}`;
const PREFIX = "[consumer_otp_twilio_status]";
const RATE_IDENTITY = {
  rateClass: "webhook", tenantId: "platform",
  subjectId: "twilio-consumer-otp-status", globalPrincipal: true,
};
const paths = {
  bounded: "../src/lib/bounded-request-body.ts",
  guard: "../src/lib/twilio-inbound-security.ts",
  callback: "../src/lib/consumer-otp-twilio-status.ts",
  route: "../src/app/twilio/consumer-otp/status/route.ts",
};
const compiled = Object.fromEntries(Object.entries(paths).map(([name, path]) => [
  name,
  ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    fileName: `${name}.ts`,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText,
]));

function harness(options = {}) {
  const environment = {
    NODE_ENV: "production", VERCEL_ENV: "production", TWILIO_ACCOUNT_SID: ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: AUTH_TOKEN, ...options.environment,
  };
  const logs = [], events = [], criticalCalls = [], verificationOptions = [];
  const loaded = {};
  const blocked = (what) => { throw new Error(`Callback test blocked unexpected ${what}`); };
  const bindings = {
    process: { env: environment }, fetch: () => blocked("network call"),
    console: Object.fromEntries(["log", "warn", "error", "info", "debug"].map((level) => [level, (...args) => {
      events.push("log");
      logs.push({ level, args });
    }])),
  };
  const fakeRequire = (name) => {
    if (name === "node:crypto") return { createHash, timingSafeEqual };
    if (name === "node:net") return { isIP };
    // Expose the SDK's real local signature functions, never its API client.
    if (name === "twilio") return { validateRequest: twilio.validateRequest };
    if (name.endsWith("/bounded-request-body")) return {
      ...loaded.bounded,
      readRequestTextBounded: async (...args) => {
        events.push("body");
        return loaded.bounded.readRequestTextBounded(...args);
      },
    };
    if (name.endsWith("/twilio-inbound-security")) return {
      ...loaded.guard,
      readAndVerifyTwilioInbound: async (req, input) => {
        events.push("verification");
        verificationOptions.push(input);
        const result = await loaded.guard.readAndVerifyTwilioInbound(req, input);
        events.push(result.ok ? "verified" : "rejected");
        return result;
      },
    };
    if (name.endsWith("/consumer-otp-twilio-status")) return loaded.callback;
    if (name.endsWith("/critical-rate-limit")) return {
      enforceWebhookAuthenticationRateLimit: async () => {
        events.push("source-limit");
        return options.sourceResponse || null;
      },
      enforceCriticalRateLimit: async (_req, identity) => {
        events.push("authenticated-limit");
        criticalCalls.push(identity);
        return options.criticalResponse || null;
      },
    };
    if (name.endsWith("/http")) return {
      json: (value, status = 200, headers = {}) => Response.json(value, { status, headers }),
    };
    return blocked(`dependency ${name}`);
  };
  for (const name of Object.keys(paths)) {
    const module = { exports: {} };
    new Function("require", "module", "exports", ...Object.keys(bindings), compiled[name])(
      fakeRequire, module, module.exports, ...Object.values(bindings),
    );
    loaded[name] = module.exports;
  }
  return {
    ...loaded, environment, logs, events, criticalCalls, verificationOptions,
    post: (input = {}) => loaded.route.POST(signedRequest(input)),
  };
}

function signedRequest(options = {}) {
  const params = {
    AccountSid: ACCOUNT_SID, MessageSid: MESSAGE_SID, MessageStatus: "delivered",
    ...options.params,
  };
  for (const [key, value] of Object.entries(params)) if (value === undefined) delete params[key];
  const signature = twilio.getExpectedTwilioSignature(
    options.token || AUTH_TOKEN, options.signedUrl || CALLBACK_URL, options.signedParams || params,
  );
  const headers = {
    "content-type": "application/x-www-form-urlencoded; charset=utf-8",
    "x-twilio-signature": signature, ...options.headers,
  };
  for (const [key, value] of Object.entries(headers)) if (value === undefined) delete headers[key];
  return new Request(options.requestUrl || CALLBACK_URL, {
    method: "POST", headers, body: options.rawBody ?? new URLSearchParams(params).toString(),
  });
}

function auditEntries(h) {
  return h.logs.map(({ level, args }) => {
    assert.equal(level, "log");
    assert.equal(args.length, 2);
    assert.equal(args[0], PREFIX);
    return typeof args[1] === "string" ? JSON.parse(args[1]) : args[1];
  });
}

function assertNoPrivateOutput(h, extra = []) {
  const output = JSON.stringify(h.logs);
  for (const value of [ACCOUNT_SID, MESSAGE_SID, AUTH_TOKEN, PHONE, OTP, BODY, ...extra]) {
    assert.equal(output.includes(value), false, "Callback logged a private fixture value");
  }
}

async function assertRejected(h, options, status) {
  const response = await h.post(options);
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(await response.text(), "");
  assert.equal(h.logs.length, 0);
  return response;
}

test("a signed callback returns empty no-store 200 with only a correlatable receipt hash and status", async () => {
  const h = harness();
  const response = await h.post();
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(auditEntries(h), [{
    receiptHash: createHash("sha256").update(MESSAGE_SID).digest("hex").slice(0, 16),
    status: "delivered",
  }]);
  assertNoPrivateOutput(h);
});

test("callback admission orders source limiting, strict bounded signature verification, authenticated limiting and audit", async () => {
  const h = harness();
  assert.equal((await h.post()).status, 200);
  assert.deepEqual(h.events, ["source-limit", "verification", "body", "verified", "authenticated-limit", "log"]);
  assert.deepEqual(h.criticalCalls, [RATE_IDENTITY]);
  assert.equal(h.verificationOptions.length, 1);
  assert.equal(h.verificationOptions[0].requireSignature, true);
  assert.equal(h.verificationOptions[0].rejectDuplicateParameters, true);
  assert.equal(h.verificationOptions[0].maxBodyBytes, 8 * 1024);
  assert.equal(h.verificationOptions[0].webhookUrl, CALLBACK_URL);
});

test("rate limited or unavailable source admission does not read the body or verify a signature", async () => {
  for (const status of [429, 503]) {
    const sourceResponse = new Response(null, { status, headers: { "retry-after": "30", "cache-control": "no-store" } });
    const h = harness({ sourceResponse });
    const response = await h.post();
    assert.equal(response, sourceResponse);
    assert.deepEqual(h.events, ["source-limit"]);
    assert.equal(h.logs.length, 0);
  }
});

test("authenticated rate limits run after verification and prevent audit emission", async () => {
  for (const status of [429, 503]) {
    const criticalResponse = new Response(null, { status });
    const h = harness({ criticalResponse });
    assert.equal(await h.post(), criticalResponse);
    assert.deepEqual(h.events, ["source-limit", "verification", "body", "verified", "authenticated-limit"]);
    assert.equal(h.logs.length, 0);
  }
});

test("missing signature, wrong token and tampered signed fields are forbidden without post-auth work", async () => {
  for (const options of [
    { headers: { "x-twilio-signature": undefined } },
    { token: "wrong-fixture-signing-token" },
    { rawBody: new URLSearchParams({ AccountSid: ACCOUNT_SID, MessageSid: MESSAGE_SID, MessageStatus: "failed" }).toString() },
  ]) {
    const h = harness();
    await assertRejected(h, options, 403);
    assert.equal(h.criticalCalls.length, 0);
  }
  const missingToken = harness({ environment: { TWILIO_AUTH_TOKEN: undefined } });
  await assertRejected(missingToken, {}, 403);
  assert.equal(missingToken.criticalCalls.length, 0);
});

test("signature requirements cannot be bypassed in development or Preview with validation flags or internal credentials", async () => {
  for (const runtime of [
    { NODE_ENV: "development", VERCEL_ENV: undefined },
    { NODE_ENV: "test", VERCEL_ENV: "preview" },
    { NODE_ENV: "production", VERCEL_ENV: "preview" },
  ]) {
    const h = harness({ environment: {
      ...runtime, TWILIO_VALIDATE_WEBHOOKS: "false",
      TWILIO_CONSUMER_OTP_STATUS_CALLBACK_URL: CALLBACK_URL,
      TWILIO_INTERNAL_WEBHOOK_KEY: "fixture-internal-bypass", ADMIN_API_KEY: "fixture-admin-bypass",
    } });
    await assertRejected(h, { headers: {
      "x-twilio-signature": undefined, "x-nexid-internal-key": "fixture-internal-bypass",
    } }, 403);
    assert.equal(h.criticalCalls.length, 0);
  }
});

test("canonical callback URL is independent of inbound configuration and the internal request host", async () => {
  const h = harness({ environment: {
    TWILIO_CONSUMER_OTP_STATUS_CALLBACK_URL: CUSTOM_CALLBACK_URL,
    TWILIO_INBOUND_WEBHOOK_URL: "https://api.nexid.lat/twilio/whatsapp/inbound",
  } });
  assert.equal(h.callback.getConsumerOtpTwilioStatusCallbackUrl({}), null);
  assert.equal(h.callback.getConsumerOtpTwilioStatusCallbackUrl({ VERCEL_ENV: "production" }), CALLBACK_URL);
  assert.equal(h.callback.getConsumerOtpTwilioStatusCallbackUrl(h.environment), CUSTOM_CALLBACK_URL);
  assert.equal((await h.post({
    signedUrl: CUSTOM_CALLBACK_URL, requestUrl: "https://internal-origin.example.test/twilio/consumer-otp/status",
    headers: { "x-forwarded-host": "attacker.example.test", "x-forwarded-proto": "http" },
  })).status, 200);
  assert.equal(h.verificationOptions[0].webhookUrl, CUSTOM_CALLBACK_URL);
  const wrongUrl = harness({ environment: h.environment });
  await assertRejected(wrongUrl, { signedUrl: "https://api.nexid.lat/twilio/whatsapp/inbound" }, 403);
});

test("invalid callback URL or account configuration fails closed", async () => {
  for (const url of [
    "http://api.nexid.lat/twilio/consumer-otp/status", "not-a-url", "javascript:alert(1)",
    "https://localhost/twilio/consumer-otp/status", "https://service.local/twilio/consumer-otp/status",
    "https://service.localhost/twilio/consumer-otp/status", "https://127.0.0.1/twilio/consumer-otp/status",
    "https://[::1]/twilio/consumer-otp/status", "https://user:password@api.nexid.lat/twilio/consumer-otp/status",
    `${CALLBACK_URL}?recipient=${PHONE}`, `${CALLBACK_URL}#fragment`,
    "https://api.nexid.lat:8443/twilio/consumer-otp/status", "https://api.nexid.lat/wrong-path",
  ]) {
    await assertRejected(harness({ environment: { TWILIO_CONSUMER_OTP_STATUS_CALLBACK_URL: url } }), {}, 503);
  }
  for (const account of [undefined, "", "ACbad", `SM${"b".repeat(32)}`]) {
    await assertRejected(harness({ environment: { TWILIO_ACCOUNT_SID: account } }), {}, 503);
  }
});

test("Preview and local runtimes require an explicit callback URL and cannot inherit the production fallback", async () => {
  for (const environment of [
    { NODE_ENV: "development", VERCEL_ENV: undefined },
    { NODE_ENV: "production", VERCEL_ENV: undefined },
    { NODE_ENV: "production", VERCEL_ENV: "preview" },
  ]) {
    const h = harness({ environment });
    assert.equal(h.callback.getConsumerOtpTwilioStatusCallbackUrl(h.environment), null);
    await assertRejected(h, {}, 503);
  }
});

test("a correctly signed foreign account is rejected while normalized configured account is accepted", async () => {
  for (const AccountSid of [undefined, "", `AC${"c".repeat(32)}`, ` ${ACCOUNT_SID}`]) {
    await assertRejected(harness(), { params: { AccountSid } }, 403);
  }
  const normalized = harness({ environment: { TWILIO_ACCOUNT_SID: ` '${ACCOUNT_SID}' ` } });
  assert.equal((await normalized.post()).status, 200);
});

test("callback rejects duplicate parameters even when the SDK can validate the last value", async () => {
  for (const [key, value, signedValue] of [
    ["MessageStatus", "failed", "delivered"], ["MessageSid", `SM${"d".repeat(32)}`, MESSAGE_SID],
    ["AccountSid", `AC${"d".repeat(32)}`, ACCOUNT_SID], ["ErrorCode", "30001", "30002"], ["Body", BODY, "ignored-extra"],
  ]) {
    const params = { AccountSid: ACCOUNT_SID, MessageSid: MESSAGE_SID, MessageStatus: "delivered", [key]: signedValue };
    const rawBody = `${new URLSearchParams({ [key]: value })}&${new URLSearchParams(params)}`;
    const h = harness();
    await assertRejected(h, { params, rawBody }, 400);
    assert.equal(h.criticalCalls.length, 0);
  }
});

test("all callback form parameters are signed, while extras never appear in audit output", async () => {
  const params = Object.fromEntries([
    ["Body", BODY], ["To", PHONE], ["From", "whatsapp:+12025550124"],
    ["ErrorMessage", `private ${BODY}`], ["VendorFutureField", "future-value"],
    ["__proto__", "signed-reserved-fixture"], ["constructor", "signed-constructor-fixture"],
  ]);
  const h = harness();
  assert.equal((await h.post({ params })).status, 200);
  assertNoPrivateOutput(h, ["whatsapp:+12025550124", "future-value", "signed-reserved-fixture", "signed-constructor-fixture"]);
  assert.deepEqual(Object.keys(auditEntries(h)[0]).sort(), ["receiptHash", "status"]);
  const signedParams = { AccountSid: ACCOUNT_SID, MessageSid: MESSAGE_SID, MessageStatus: "delivered", ...params };
  for (const field of ["VendorFutureField", "__proto__", "constructor"]) {
    await assertRejected(harness(), {
      signedParams, rawBody: new URLSearchParams({ ...signedParams, [field]: "modified-value" }).toString(),
    }, 403);
  }
});

test("callback requires form content type before parsing or signature work", async () => {
  for (const contentType of [undefined, "application/json", "text/plain", "multipart/form-data", "application/x-www-form-urlencoded-invalid"]) {
    const h = harness();
    await assertRejected(h, { headers: { "content-type": contentType } }, 415);
    assert.equal(h.events.includes("body"), false);
    assert.equal(h.events.includes("verification"), false);
  }
});

test("callback bounds the actual request bytes at 8 KiB without trusting declared content length", async () => {
  for (const headers of [{}, { "content-length": "1" }]) {
    const h = harness();
    await assertRejected(h, { rawBody: `Body=${"x".repeat(8 * 1024)}`, headers }, 413);
    assert.equal(h.criticalCalls.length, 0);
  }
});

test("invalid UTF-8 and malformed declared content lengths fail before any audit or authenticated work", async () => {
  for (const options of [
    { rawBody: new Uint8Array([0xc3, 0x28]) },
    { headers: { "content-length": "not-a-number" } },
    { headers: { "content-length": "-1" } },
  ]) {
    const h = harness();
    await assertRejected(h, options, 400);
    assert.equal(h.criticalCalls.length, 0);
  }
});

test("MessageSid and status require bounded known forms", async () => {
  for (const MessageSid of [undefined, "", `AC${"a".repeat(32)}`, `SM${"z".repeat(32)}`, `SM${"a".repeat(31)}`, `SM${"a".repeat(33)}`]) {
    await assertRejected(harness(), { params: { MessageSid } }, 400);
  }
  for (const MessageStatus of [undefined, "", "unknown", "delivered\nprivate", BODY]) {
    await assertRejected(harness(), { params: { MessageStatus } }, 400);
  }
});

test("the supported status allowlist and SM or MM message receipts are accepted", async () => {
  const statuses = ["accepted", "queued", "sending", "sent", "delivered", "read", "failed", "undelivered", "canceled", "scheduled"];
  for (const MessageStatus of statuses) {
    for (const prefix of ["SM", "MM"]) {
      const h = harness();
      const MessageSid = `${prefix}${"e".repeat(32)}`;
      assert.equal((await h.post({ params: { MessageStatus, MessageSid } })).status, 200);
      assert.deepEqual(auditEntries(h), [{
        receiptHash: createHash("sha256").update(MessageSid).digest("hex").slice(0, 16), status: MessageStatus,
      }]);
      assertNoPrivateOutput(h, [MessageSid]);
    }
  }
});

test("ErrorCode is an optional positive integer up to six digits and never a free-form message", async () => {
  for (const ErrorCode of [undefined, ""]) {
    const h = harness();
    assert.equal((await h.post({ params: { ErrorCode } })).status, 200);
    assert.equal(Object.hasOwn(auditEntries(h)[0], "errorCode"), false);
  }
  for (const ErrorCode of ["1", "30001", "999999"]) {
    const h = harness();
    assert.equal((await h.post({ params: { MessageStatus: "failed", ErrorCode } })).status, 200);
    assert.equal(auditEntries(h)[0].errorCode, Number(ErrorCode));
  }
  for (const ErrorCode of ["0", "-1", "1.5", "1e3", "+1", "1000000", "NaN", BODY]) {
    await assertRejected(harness(), { params: { ErrorCode } }, 400);
  }
});

test("repeated or out-of-order valid callbacks only append sanitized observational audits", async () => {
  // Unexpected SQL, consumer-auth, sender or transport dependencies are denied
  // by the harness; callbacks cannot authenticate anyone or trigger a send.
  const h = harness();
  for (const MessageStatus of ["delivered", "delivered", "sent"]) {
    const response = await h.post({ params: { MessageStatus } });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "");
  }
  assert.deepEqual(auditEntries(h).map((entry) => entry.status), ["delivered", "delivered", "sent"]);
  assert.equal(new Set(auditEntries(h).map((entry) => entry.receiptHash)).size, 1);
  assertNoPrivateOutput(h);
});
