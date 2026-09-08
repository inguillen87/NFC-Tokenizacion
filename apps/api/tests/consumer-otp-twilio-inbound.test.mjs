import assert from "node:assert/strict";
import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import test from "node:test";
import ts from "typescript";
import twilio from "twilio";

const INBOUND_URL = "https://api.nexid.lat/twilio/consumer-otp/inbound";
const PREVIEW_URL = "https://otp-preview.example.test/twilio/consumer-otp/inbound";
const ACCOUNT_SID = `AC${"a".repeat(32)}`;
const MESSAGE_SID = `SM${"b".repeat(32)}`;
const SENDER = "whatsapp:+12025550125";
const FROM = "whatsapp:+12025550123";
const BODY = "Mi codigo OTP es 659214";
const AUTH_TOKEN = "fixture-inbound-signing-token";
const TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response/>';
const modules = {
  bounded: "../src/lib/bounded-request-body.ts",
  guard: "../src/lib/twilio-inbound-security.ts",
  status: "../src/lib/consumer-otp-twilio-status.ts",
  config: "../src/lib/consumer-otp-twilio-config.ts",
  route: "../src/app/twilio/consumer-otp/inbound/route.ts",
};
const compiled = Object.fromEntries(Object.entries(modules).map(([name, path]) => [name,
  ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    fileName: `${name}.ts`,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText,
]));

// The actual config, bounded reader, signature guard and route run on synthetic
// fixtures. Only local SDK signature validation is exposed; DB/auth/transport
// dependencies and fetch are blocked. The host environment is never passed in.
function harness(options = {}) {
  const environment = {
    NODE_ENV: "production", VERCEL_ENV: "production", TWILIO_AUTH_TOKEN: AUTH_TOKEN,
    TWILIO_ACCOUNT_SID: ACCOUNT_SID, TWILIO_CONSUMER_OTP_WHATSAPP_FROM: SENDER,
    TWILIO_WHATSAPP_FROM: "whatsapp:+12025550999", ...options.environment,
  };
  const logs = [], events = [], criticalCalls = [], verificationOptions = [], requests = [];
  const loaded = {};
  const bindings = {
    process: { env: environment },
    fetch: (...args) => { requests.push(args); throw new Error("network_blocked_by_inbound_test"); },
    console: Object.fromEntries(["log", "info", "warn", "error", "debug"].map((level) => [level, (...args) => logs.push({ level, args })])),
  };
  const fakeRequire = (name) => {
    if (name === "node:crypto") return { createHash, timingSafeEqual };
    if (name === "node:net") return { isIP };
    if (name === "twilio") return { validateRequest: twilio.validateRequest };
    if (name.endsWith("/bounded-request-body")) return {
      ...loaded.bounded,
      readRequestTextBounded: (...args) => { events.push("body"); return loaded.bounded.readRequestTextBounded(...args); },
    };
    if (name.endsWith("/consumer-otp-twilio-status")) return loaded.status;
    if (name.endsWith("/consumer-otp-twilio-config")) return loaded.config;
    if (name.endsWith("/twilio-inbound-security")) return {
      ...loaded.guard,
      readAndVerifyTwilioInbound: async (req, input) => {
        events.push("verification");
        verificationOptions.push(input);
        const result = await loaded.guard.readAndVerifyTwilioInbound(req, input);
        events.push(result.ok ? "verified" : "rejected");
        if (result.ok) {
          const get = result.form.get.bind(result.form);
          result.form.get = (key) => {
            assert.ok(!["Body", "From"].includes(key), "Inbound route must not interpret message text or author after signing");
            return get(key);
          };
        }
        return result;
      },
    };
    if (name.endsWith("/critical-rate-limit")) return {
      enforceWebhookAuthenticationRateLimit: async () => { events.push("source-limit"); return options.sourceResponse || null; },
      enforceCriticalRateLimit: async (_req, identity) => {
        events.push("authenticated-limit"); criticalCalls.push(identity); return options.criticalResponse || null;
      },
    };
    throw new Error(`Unexpected inbound dependency blocked: ${name}`);
  };
  for (const name of Object.keys(modules)) {
    const module = { exports: {} };
    new Function("require", "module", "exports", ...Object.keys(bindings), compiled[name])(
      fakeRequire, module, module.exports, ...Object.values(bindings),
    );
    loaded[name] = module.exports;
  }
  return {
    ...loaded, environment, logs, events, criticalCalls, verificationOptions, requests,
    post: (input = {}) => loaded.route.POST(signedRequest(input)),
  };
}

function signedRequest(options = {}) {
  const params = { AccountSid: ACCOUNT_SID, To: SENDER, MessageSid: MESSAGE_SID, From: FROM, Body: BODY, ...options.params };
  for (const [key, value] of Object.entries(params)) if (value === undefined) delete params[key];
  const signature = twilio.getExpectedTwilioSignature(options.token || AUTH_TOKEN, options.signedUrl || INBOUND_URL, options.signedParams || params);
  const headers = { "content-type": "application/x-www-form-urlencoded; charset=utf-8", "x-twilio-signature": signature, ...options.headers };
  for (const [key, value] of Object.entries(headers)) if (value === undefined) delete headers[key];
  return new Request(options.requestUrl || INBOUND_URL, {
    method: "POST", headers, body: options.rawBody ?? new URLSearchParams(params).toString(),
  });
}

async function accepted(h, options = {}) {
  const response = await h.post(options);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/xml; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(await response.text(), TWIML);
  assert.equal(h.logs.length + h.requests.length, 0);
  return response;
}

async function rejected(h, options, status) {
  const response = await h.post(options);
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(await response.text(), "");
  assert.equal(h.logs.length + h.requests.length, 0);
  return response;
}

test("dedicated OTP sender is strict E.164 WhatsApp configuration and never inherits the campaign sender", () => {
  const h = harness();
  for (const configured of [undefined, "", " \t ", '""']) {
    assert.equal(h.config.getConsumerOtpWhatsappFrom({ TWILIO_CONSUMER_OTP_WHATSAPP_FROM: configured, TWILIO_WHATSAPP_FROM: SENDER }), null);
  }
  for (const configured of [SENDER, ` '${SENDER}' `, `" ${SENDER} "`]) {
    assert.equal(h.config.getConsumerOtpWhatsappFrom({ TWILIO_CONSUMER_OTP_WHATSAPP_FROM: configured }), SENDER);
  }
  for (const configured of ["+12025550125", "WHATSAPP:+12025550125", "whatsapp:+012345678", "whatsapp:+1234567", "whatsapp:+1234567890123456", `""${SENDER}""`, `${SENDER}"`, "whatsapp:+1 202 555 0125"]) {
    assert.throws(() => h.config.getConsumerOtpWhatsappFrom({ TWILIO_CONSUMER_OTP_WHATSAPP_FROM: configured }), { message: "twilio_consumer_otp_whatsapp_from_invalid" });
  }
});

test("inbound URL only defaults in actual production and validates the dedicated canonical path", () => {
  const h = harness();
  assert.equal(h.config.getConsumerOtpTwilioInboundUrl({ VERCEL_ENV: "production" }), INBOUND_URL);
  for (const environment of [{}, { NODE_ENV: "production" }, { VERCEL_ENV: "preview" }, { VERCEL: "1" }]) {
    assert.equal(h.config.getConsumerOtpTwilioInboundUrl(environment), null);
  }
  assert.equal(h.config.getConsumerOtpTwilioInboundUrl({ TWILIO_CONSUMER_OTP_INBOUND_WEBHOOK_URL: ` '${PREVIEW_URL}' ` }), PREVIEW_URL);
  for (const url of [
    "not-a-url", "http://api.nexid.lat/twilio/consumer-otp/inbound", "https://localhost/twilio/consumer-otp/inbound",
    "https://service.local/twilio/consumer-otp/inbound", "https://service.localhost/twilio/consumer-otp/inbound",
    "https://127.0.0.1/twilio/consumer-otp/inbound", "https://[::1]/twilio/consumer-otp/inbound",
    "https://user:pass@api.nexid.lat/twilio/consumer-otp/inbound", "https://api.nexid.lat:8443/twilio/consumer-otp/inbound",
    `${INBOUND_URL}?phone=private`, `${INBOUND_URL}#fragment`, `${INBOUND_URL}/`,
    "https://api.nexid.lat/twilio/whatsapp/inbound", "https://api.nexid.lat/twilio/consumer-otp/status",
  ]) {
    assert.throws(() => h.config.getConsumerOtpTwilioInboundUrl({ TWILIO_CONSUMER_OTP_INBOUND_WEBHOOK_URL: url }), { message: "twilio_consumer_otp_inbound_url_invalid" });
  }
});

test("verified inbound returns only empty TwiML and applies fixed webhook limits after strict bounded verification", async () => {
  const h = harness();
  await accepted(h);
  assert.deepEqual(h.events, ["source-limit", "verification", "body", "verified", "authenticated-limit"]);
  assert.deepEqual(h.criticalCalls, [{ rateClass: "webhook", tenantId: "platform", subjectId: "twilio-consumer-otp-inbound", globalPrincipal: true }]);
  assert.deepEqual(h.verificationOptions, [{ maxBodyBytes: 8 * 1024, webhookUrl: INBOUND_URL, requireSignature: true, rejectDuplicateParameters: true }]);
});

test("source limits run before body consumption and authenticated limits prevent successful processing", async () => {
  for (const status of [429, 503]) {
    const sourceResponse = new Response(null, { status, headers: { "cache-control": "no-store" } });
    const source = harness({ sourceResponse });
    assert.equal(await rejected(source, {}, status), sourceResponse);
    assert.deepEqual(source.events, ["source-limit"]);
    const criticalResponse = new Response(null, { status, headers: { "cache-control": "no-store" } });
    const critical = harness({ criticalResponse });
    assert.equal(await rejected(critical, {}, status), criticalResponse);
    assert.deepEqual(critical.events, ["source-limit", "verification", "body", "verified", "authenticated-limit"]);
  }
});

test("invalid or missing configuration fails closed before reading the request body", async () => {
  for (const environment of [
    { TWILIO_ACCOUNT_SID: undefined }, { TWILIO_ACCOUNT_SID: "ACinvalid" },
    { TWILIO_CONSUMER_OTP_WHATSAPP_FROM: undefined }, { TWILIO_CONSUMER_OTP_WHATSAPP_FROM: "invalid" },
    { TWILIO_CONSUMER_OTP_INBOUND_WEBHOOK_URL: "http://localhost/" },
    { VERCEL_ENV: undefined }, { VERCEL_ENV: "preview" },
  ]) {
    const h = harness({ environment });
    await rejected(h, {}, 503);
    assert.deepEqual(h.events, ["source-limit"]);
  }
});

test("dedicated inbound canonical URL ignores request host and both campaign and status URL configuration", async () => {
  const environment = {
    VERCEL_ENV: "preview", TWILIO_CONSUMER_OTP_INBOUND_WEBHOOK_URL: PREVIEW_URL,
    TWILIO_INBOUND_WEBHOOK_URL: "https://api.nexid.lat/twilio/whatsapp/inbound",
    TWILIO_CONSUMER_OTP_STATUS_CALLBACK_URL: "https://api.nexid.lat/twilio/consumer-otp/status",
  };
  await accepted(harness({ environment }), {
    signedUrl: PREVIEW_URL, requestUrl: "https://internal-origin.example.test/twilio/consumer-otp/inbound",
    headers: { "x-forwarded-host": "attacker.example.test", "x-forwarded-proto": "http" },
  });
  for (const signedUrl of [INBOUND_URL, environment.TWILIO_INBOUND_WEBHOOK_URL, environment.TWILIO_CONSUMER_OTP_STATUS_CALLBACK_URL]) {
    await rejected(harness({ environment }), { signedUrl }, 403);
  }
});

test("missing signature or token and altered signatures are rejected in every runtime without internal bypass", async () => {
  for (const environment of [{}, { NODE_ENV: "test", VERCEL_ENV: "preview" }, { NODE_ENV: "development", VERCEL_ENV: undefined }]) {
    const config = {
      ...environment, TWILIO_CONSUMER_OTP_INBOUND_WEBHOOK_URL: INBOUND_URL,
      TWILIO_VALIDATE_WEBHOOKS: "false", TWILIO_INTERNAL_WEBHOOK_KEY: "fixture-internal-key",
    };
    for (const options of [
      { headers: { "x-twilio-signature": undefined, "x-nexid-internal-key": "fixture-internal-key" } },
      { token: "wrong-fixture-token" },
    ]) {
      const h = harness({ environment: config });
      await rejected(h, options, 403);
      assert.equal(h.criticalCalls.length, 0);
    }
    await rejected(harness({ environment: { ...config, TWILIO_AUTH_TOKEN: undefined } }), {}, 403);
  }
});

test("the signed account and exact dedicated receiver are required, independently of campaign sender", async () => {
  for (const params of [
    { AccountSid: undefined }, { AccountSid: `AC${"c".repeat(32)}` }, { AccountSid: ` ${ACCOUNT_SID}` },
    { To: undefined }, { To: "whatsapp:+12025550999" }, { To: "+12025550125" }, { To: `${SENDER} ` },
  ]) {
    const h = harness();
    await rejected(h, { params }, 403);
    assert.equal(h.criticalCalls.length, 0);
  }
  await accepted(harness({ environment: { TWILIO_ACCOUNT_SID: ` '${ACCOUNT_SID}' `, TWILIO_CONSUMER_OTP_WHATSAPP_FROM: `"${SENDER}"` } }));
});

test("message receipt IDs must be complete SM or MM identifiers", async () => {
  for (const MessageSid of [undefined, "", "SMbad", `AC${"a".repeat(32)}`, `SM${"z".repeat(32)}`, `SM${"a".repeat(33)}`]) {
    await rejected(harness(), { params: { MessageSid } }, 400);
  }
  for (const prefix of ["SM", "MM"]) await accepted(harness(), { params: { MessageSid: `${prefix}${"A".repeat(32)}` } });
});

test("all parameters are signed but message text, sender and future extras are never interpreted or emitted", async () => {
  const params = Object.fromEntries([
    ["AccountSid", ACCOUNT_SID], ["To", SENDER], ["MessageSid", MESSAGE_SID], ["From", FROM], ["Body", BODY],
    ["__proto__", "reserved-fixture"], ["FutureField", "future-fixture"],
  ]);
  await accepted(harness(), { params });
  for (const key of ["From", "Body", "__proto__", "FutureField"]) {
    await rejected(harness(), {
      signedParams: params, rawBody: new URLSearchParams({ ...params, [key]: "tampered-value" }).toString(),
    }, 403);
  }
  await accepted(harness(), { params: { From: undefined, Body: undefined } });
});

test("duplicate parameters cannot make signature verification disagree with account, recipient or message parsing", async () => {
  for (const [key, value] of [["AccountSid", "ACother"], ["To", FROM], ["MessageSid", "SMother"], ["Body", "no quiero"], ["From", SENDER]]) {
    const params = { AccountSid: ACCOUNT_SID, To: SENDER, MessageSid: MESSAGE_SID, From: FROM, Body: BODY };
    const rawBody = `${new URLSearchParams({ [key]: value })}&${new URLSearchParams(params)}`;
    await rejected(harness(), { params, rawBody }, 400);
  }
});

test("inbound rejects unsupported content types, oversized actual bytes and invalid UTF-8", async () => {
  for (const contentType of [undefined, "application/json", "text/plain", "multipart/form-data", "application/x-www-form-urlencoded-invalid"]) {
    const h = harness();
    await rejected(h, { headers: { "content-type": contentType } }, 415);
    assert.deepEqual(h.events, ["source-limit"]);
  }
  for (const headers of [{}, { "content-length": "1" }]) {
    await rejected(harness(), { rawBody: "x".repeat(8 * 1024 + 1), headers }, 413);
  }
  await rejected(harness(), { rawBody: new Uint8Array([0xc3, 0x28]) }, 400);
});

test("replays and differently ordered replies remain inert with no autoresponse, CRM/auth mutations or private outputs", async () => {
  const h = harness();
  for (const Body of [BODY, BODY, "quiero", "no quiero", "recipient@example.test", "659214"]) {
    await accepted(h, { params: { Body, SmsStatus: "received" } });
  }
  assert.equal(h.criticalCalls.length, 6);
  assert.equal(h.logs.length + h.requests.length, 0);
});
