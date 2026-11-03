import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compile = (source, filename, resolve) => {
  const loaded = { exports: {} };
  const code = ts.transpileModule(source, { fileName: filename, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  new Function("require", "module", "exports", code)(resolve, loaded, loaded.exports);
  return loaded.exports;
};
const contact = compile(readFileSync(new URL("../src/components/consumer-contact-input.tsx", import.meta.url), "utf8"), "consumer-contact-input.tsx", require);
const { SecurityPanel } = compile(readFileSync(new URL("../src/app/me/security/security-panel.tsx", import.meta.url), "utf8"), "security-panel.tsx", name => {
  if (name === "./security-panel.module.css") return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
  if (name === "next/link") return { __esModule: true, default: ({ prefetch, ...props }) => React.createElement("a", props) };
  if (name === "../../../components/consumer-contact-input") return contact;
  if (["react", "react/jsx-runtime", "lucide-react"].includes(name)) return require(name);
  throw Error("Unexpected security dependency: " + name);
});
const render = consumer => renderToStaticMarkup(React.createElement(SecurityPanel, { initialConsumer: consumer }));
function region(html, id) {
  const matches = [...html.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)]
    .filter(match => match[1].includes(`aria-labelledby="${id}"`) || match[1].includes(`aria-label="${id}"`));
  assert.equal(matches.length, 1, "exactly one named account/contact region");
  return matches[0][2];
}
const links = html => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(match => ({
  href: match[1].match(/\bhref="([^"]+)"/)?.[1], attributes: match[1], body: match[2],
}));
function corporate(html) {
  const support = region(html, "security-nexid-contact-title"), all = links(support);
  assert.deepEqual(all.map(link => link.href), [
    "mailto:info@nexid.lat", "https://api.whatsapp.com/send?phone=5492613168608", "https://api.whatsapp.com/send?phone=56988689095",
  ]);
  assert.match(support, /Contactar a NexID/);
  assert.match(support, /info@nexid.lat/);
  assert.ok(all.slice(1).every(link => /target="_blank"/.test(link.attributes) && /rel="noopener noreferrer"/.test(link.attributes)));
  assert.doesNotMatch(support, /5553631961|363-1961|24\s*(?:h|hs)|SLA/);
  return support;
}
function truthful(html) {
  assert.doesNotMatch(html, /recuperación|dos factores|MFA activo|Doble factor activo|Bono 2FA/i);
}

test("security separates the consumer's linked access details from public NexID contacts", () => {
  const html = render({ id: "synthetic-account", email: "reader@example.test", phone: "+15550001111" });
  const access = region(html, "security-access-title"), support = corporate(html);
  assert.match(access, /Tus medios de acceso/); assert.match(access, /Tu email/); assert.match(access, /Tu WhatsApp/);
  assert.match(access, /reader@example.test/); assert.match(access, /\+15550001111/);
  assert.doesNotMatch(support, /reader@example.test|15550001111/);
  assert.doesNotMatch(access, /info@nexid.lat|WhatsApp Argentina|WhatsApp Chile/);
  assert.equal(html.includes('id="security-add-access-title"'), false);
  truthful(html);
});

test("email-only account keeps its email visible and offers only the missing WhatsApp access channel", () => {
  const html = render({ id: "synthetic-account", email: "reader@example.test", phone: null });
  const access = region(html, "security-access-title"), association = region(html, "security-add-access-title");
  assert.match(access, /reader@example.test/); assert.match(access, /Sin agregar/);
  assert.match(association, /Tu nuevo WhatsApp/); assert.match(association, /type="tel"/);
  assert.doesNotMatch(association, /type="email"/);
  corporate(html); truthful(html);
});

test("phone-only account keeps its WhatsApp visible and offers only the missing email access channel", () => {
  const html = render({ id: "synthetic-account", email: null, phone: "+15550001111" });
  const access = region(html, "security-access-title"), association = region(html, "security-add-access-title");
  assert.match(access, /\+15550001111/); assert.match(access, /Sin agregar/);
  assert.match(association, /Tu nuevo email/); assert.match(association, /type="email"/);
  assert.doesNotMatch(association, /type="tel"/);
  corporate(html); truthful(html);
});

test("missing personal lookup shows a retry and corporate contact without inventing access details", () => {
  const html = render(null);
  assert.match(region(html, "Tus medios de acceso"), /No pudimos consultar tus medios de acceso/);
  assert.match(html, /Reintentar consulta/);
  assert.equal(html.includes('id="security-association-code"'), false);
  assert.equal(html.includes('id="security-add-access-title"'), false);
  corporate(html); truthful(html);
});

test("a personal number matching a public NexID line does not change the corporate contact source", () => {
  const html = render({ id: "synthetic-account", email: "another@example.test", phone: "+5492613168608" });
  assert.match(region(html, "security-access-title"), /\+5492613168608/);
  assert.doesNotMatch(corporate(html), /another@example.test/);
  truthful(html);
});
