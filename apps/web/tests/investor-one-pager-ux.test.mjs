import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/app/investor-one-pager/page.tsx", import.meta.url), "utf8");

test("investor brief is a real evidence-backed enterprise page", () => {
  assert.match(source, /readPublicProofSnapshot/);
  assert.match(source, /public\/proof\/demo-cases/);
  assert.match(source, /new Set\(\[configuredApiBase, "https:\/\/api\.nexid\.lat"\]\)/);
  assert.match(source, /iota\?\.rpc_verified === true/);
  assert.match(source, /polygon\?\.rpc_verified === true/);
  assert.match(source, /custodia de nexID/i);
  assert.match(source, /no prueba control de wallet del comprador/i);
  assert.match(source, /no autentica por sí solo el objeto físico/i);
  assert.doesNotMatch(source, /11[.,]867|99[.,]97|companies that use/i);
});

test("investor brief connects the commercial journey without mixed-language CTAs", () => {
  for (const href of ["/demo-lab", "/proof/verify", "/proof/ownership", "/docs", "/sdk", "/investor-snapshot"]) {
    assert.match(source, new RegExp(`href=\\"${href.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}`));
  }
  assert.match(source, /Probar Demo Lab/);
  assert.match(source, /Ver evidencia pública/);
  assert.match(source, /Agendar reunión/);
  assert.doesNotMatch(source, /Back to deck view|Run live SUN demo|Request meeting|One-pager/);
  assert.doesNotMatch(source, /validaciÃ|Â·|fÃ.sico/);
});

test("investor brief owns light mode and compact mobile layout", () => {
  assert.match(source, /ThemeToggle/);
  assert.match(source, /html\[data-theme="light"\] \.investor-brief-page/);
  assert.match(source, /investor-brief-hero__image--light/);
  assert.match(source, /@media \(max-width: 640px\)/);
  assert.match(source, /overflow-x: clip/);
  assert.match(source, /grid-template-columns: 1fr/);
  assert.match(source, /min-height: min\(620px, calc\(100svh - 8rem\)\)/);
  assert.match(source, /investor-brief-live-band/);
  assert.match(source, /body:has\(\.investor-brief-page\) \.helpbot-trigger/);
  assert.match(source, /body:has\(\.investor-brief-page\) \.sales-widget-root/);
});
