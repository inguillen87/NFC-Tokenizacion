import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/app/public/leads/route.ts", import.meta.url), "utf8");
const parsed = ts.createSourceFile("public-leads.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const declarations = ["clean", "postJson", "notifyLead"].map(name => {
  const matches = parsed.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.equal(matches.length, 1, `Expected one real ${name} declaration`);
  return matches[0].getText(parsed);
});
const compiled = ts.transpileModule(declarations.join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function payload() {
  return {
    lead: {
      name: "Synthetic lead",
      company: "Synthetic tenant",
      email: "reader@example.test",
      phone: "+15550001111",
      contact: "Synthetic contact",
      vertical: "wine",
      role_interest: "brand_updates",
    },
    sourceBody: { source: "sun_brand_opt_in", tenant_slug: "synthetic-tenant", meta: { fixture: true } },
  };
}

function fixture(env, respond = () => new Response(null, { status: 202 })) {
  const calls = [];
  // Execute the real source functions with a private synthetic env/fetch.
  // No process.env mutation, route POST/SQL, actual network or provider send.
  const notify = new Function("process", "fetch", `${compiled}\nreturn notifyLead;`)(
    { env: { ...env } },
    async (url, init) => {
      const call = { url: String(url), method: init.method, headers: init.headers, body: JSON.parse(init.body) };
      calls.push(call);
      return respond(call);
    },
  );
  return { calls, notify };
}

test("an internal WhatsApp URL without a sales recipient does not use the consumer phone", async () => {
  const run = fixture({ WHATSAPP_API_URL: "https://messages.invalid/internal" });
  const result = await run.notify(payload());
  assert.deepEqual(run.calls, []);
  assert.deepEqual(result, { webhook: null, whatsapp: null });
});

test("a blank sales recipient is unconfigured and never falls back to consumer contact", async () => {
  const run = fixture({ WHATSAPP_API_URL: "https://messages.invalid/internal", SALES_WHATSAPP_TO: " \t " });
  assert.equal((await run.notify(payload())).whatsapp, null);
  assert.deepEqual(run.calls, []);
});

test("an internal WhatsApp notice uses the explicit trimmed commercial recipient", async () => {
  const run = fixture({ WHATSAPP_API_URL: "https://messages.invalid/internal", SALES_WHATSAPP_TO: " +15550002222 " });
  const input = payload();
  const result = await run.notify(input);
  assert.equal(run.calls.length, 1);
  assert.equal(run.calls[0].url, "https://messages.invalid/internal");
  assert.equal(run.calls[0].method, "POST");
  assert.equal(run.calls[0].body.to, "+15550002222");
  assert.notEqual(run.calls[0].body.to, input.lead.phone);
  assert.equal(run.calls[0].body.type, "lead.created");
  assert.match(run.calls[0].body.text, /^Nuevo lead nexID\n/);
  assert.deepEqual(run.calls[0].body.lead, input.lead);
  assert.deepEqual(result, { webhook: null, whatsapp: { ok: true, status: 202 } });
});

test("a configured commercial recipient works without any consumer phone", async () => {
  const run = fixture({ WHATSAPP_API_URL: "https://messages.invalid/internal", SALES_WHATSAPP_TO: "+15550002222" });
  const input = payload();
  input.lead.phone = "";
  assert.equal((await run.notify(input)).whatsapp?.ok, true);
  assert.equal(run.calls.length, 1);
  assert.equal(run.calls[0].body.to, "+15550002222");
});

test("a sales recipient without a WhatsApp URL does not create another transport", async () => {
  const run = fixture({ SALES_WHATSAPP_TO: "+15550002222" });
  assert.deepEqual(await run.notify(payload()), { webhook: null, whatsapp: null });
  assert.deepEqual(run.calls, []);
});

test("missing sales recipient leaves the existing webhook payload and result unchanged", async () => {
  const run = fixture({ WHATSAPP_API_URL: "https://messages.invalid/internal", LEADS_WEBHOOK_URL: "https://crm.invalid/leads" });
  const input = payload();
  const result = await run.notify(input);
  assert.equal(run.calls.length, 1);
  assert.equal(run.calls[0].url, "https://crm.invalid/leads");
  assert.deepEqual(run.calls[0].body, { type: "lead.created", lead: input.lead, sourceBody: input.sourceBody });
  assert.deepEqual(result, { webhook: { ok: true, status: 202 }, whatsapp: null });
});

test("configured webhook and internal WhatsApp remain separate notifications", async () => {
  const run = fixture({ LEADS_WEBHOOK_URL: "https://crm.invalid/leads", WHATSAPP_API_URL: "https://messages.invalid/internal", SALES_WHATSAPP_TO: "+15550002222" });
  const input = payload();
  await run.notify(input);
  assert.equal(run.calls.length, 2);
  const webhook = run.calls.find(call => call.url === "https://crm.invalid/leads");
  const whatsapp = run.calls.find(call => call.url === "https://messages.invalid/internal");
  assert.deepEqual(webhook?.body, { type: "lead.created", lead: input.lead, sourceBody: input.sourceBody });
  assert.equal(whatsapp?.body.to, "+15550002222");
});

test("a failed configured internal WhatsApp response keeps the existing failure result", async () => {
  const run = fixture({ WHATSAPP_API_URL: "https://messages.invalid/internal", SALES_WHATSAPP_TO: "+15550002222" }, () => new Response(null, { status: 503 }));
  assert.deepEqual((await run.notify(payload())).whatsapp, { ok: false, status: 503 });
  assert.equal(run.calls.length, 1);
});

test("a configured internal transport exception keeps the existing no-status result", async () => {
  const run = fixture({ WHATSAPP_API_URL: "https://messages.invalid/internal", SALES_WHATSAPP_TO: "+15550002222" }, () => { throw new Error("synthetic transport failure"); });
  assert.deepEqual((await run.notify(payload())).whatsapp, { ok: false, status: 0 });
  assert.equal(run.calls.length, 1);
});

test("the existing WhatsApp URL alias also requires an explicit commercial recipient", async () => {
  const missing = fixture({ WHATSAPP_WEBHOOK_URL: "https://messages.invalid/legacy-internal" });
  assert.equal((await missing.notify(payload())).whatsapp, null);
  assert.deepEqual(missing.calls, []);
  const configured = fixture({ WHATSAPP_WEBHOOK_URL: "https://messages.invalid/legacy-internal", SALES_WHATSAPP_TO: "+15550002222" });
  assert.equal((await configured.notify(payload())).whatsapp?.ok, true);
  assert.equal(configured.calls.length, 1);
  assert.equal(configured.calls[0].url, "https://messages.invalid/legacy-internal");
  assert.equal(configured.calls[0].body.to, "+15550002222");
});

test("internal lead recipient checks are explicitly registered in the required API security group", () => {
  const apiPackage = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const security = apiPackage.scripts["test:auth-security"];
  assert.equal(typeof security, "string");
  const targets = security.trim().split(/\s+/);
  assert.equal(targets.filter(value => value === "tests/public-lead-notification-authority.test.mjs").length, 1);
  assert.ok(targets.includes("--test"));
  // The existing build-environment suite checks the dispatcher/required groups.
  assert.ok(apiPackage.scripts["build:regressions"].split(/\s*&&\s*/).includes("npm run test:auth-security"));
});
