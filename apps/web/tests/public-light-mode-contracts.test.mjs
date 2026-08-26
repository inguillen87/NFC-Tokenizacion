import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [landing, home, sdk, demoLab, css] = await Promise.all([
  readFile(new URL("../src/components/landing-sections.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sdk/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(public)/demo-lab/demo-lab-client.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
]);

test("landing light mode owns high-risk CTA and footer colors", () => {
  assert.doesNotMatch(landing, /landing-consumer-portal-cta/);
  assert.match(landing, /landing-offline-demo-cta/);
  assert.match(home, /site-footer-columns/);
  assert.match(home, /site-footer-demo-link/);
  assert.doesNotMatch(home, /site-footer-data-card|site-footer-whatsapp-link/);
  assert.match(css, /\.landing-offline-demo-cta[\s\S]*color: #0f172a !important/);
  assert.match(css, /html\.theme-light \.site-footer-columns h2[\s\S]*color: #10233f/);
  assert.match(css, /html\.theme-light \.site-footer-columns \.site-footer-demo-link[\s\S]*color: #087f8c/);
});

test("SDK light mode uses readable semantic tones", () => {
  assert.match(sdk, /sdk-commercial-benefit--cyan/);
  assert.match(sdk, /sdk-commercial-benefit--violet/);
  assert.match(css, /\.sdk-commercial-benefit--cyan[\s\S]*color: #0e7490 !important/);
  assert.match(css, /\.sdk-commercial-benefit--violet[\s\S]*color: #6d28d9 !important/);
  for (const tone of ["emerald", "amber", "sky", "violet", "rose", "cyan", "lime", "indigo", "slate"]) {
    assert.match(css, new RegExp(`sdk-industry-card--${tone}`));
  }
});

test("SDK mobile keeps proof early and converts the catalog to a snap rail", () => {
  assert.match(css, /\.sdk-premium-copy\s*\{\s*display: contents !important/);
  assert.match(css, /\.sdk-premium-hero \.sdk-proof-hero-system\s*\{ order: 5/);
  assert.match(css, /\.sdk-premium-copy \.sdk-trust-rail\s*\{ order: 6/);
  assert.match(css, /\.sdk-industry-showcase[\s\S]*grid-auto-flow: column !important/);
  assert.match(css, /scroll-snap-type: inline mandatory/);
  assert.match(css, /grid-auto-columns: minmax\(17\.25rem, 82vw\) !important/);
});

test("Demo Lab light mode owns CRM tones and accessible control sizes", () => {
  assert.match(demoLab, /demo-lab-crm-kpi--emerald/);
  assert.match(demoLab, /demo-lab-crm-kpi--rose/);
  assert.match(demoLab, /demo-lab-crm-refresh/);
  assert.match(demoLab, /demo-lab-crm-security-note/);
  assert.match(demoLab, /demo-lab-crm-auto-refresh/);
  assert.match(css, /\.demo-lab-fullscreen-root--light \.demo-lab-wizard-result-card \.demo-lab-wizard-result-pills span/);
  assert.match(css, /\.demo-lab-fullscreen-root--light \.demo-lab-crm-kpi--emerald[\s\S]*#047857/);
  assert.match(css, /\.demo-lab-fullscreen-root--light \.demo-lab-crm-kpi--rose[\s\S]*#be123c/);
  assert.match(css, /\.demo-lab-crm-refresh[\s\S]*min-height: 2\.75rem !important/);
  assert.match(css, /\.demo-lab-modal-tabs button[\s\S]*min-height: 2\.75rem !important/);
});
