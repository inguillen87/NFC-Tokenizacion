import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [landing, home, sdk, demoLab, css, homeCss, layout, header, navigation] = await Promise.all([
  readFile(new URL("../src/components/landing-sections.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sdk/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(public)/demo-lab/demo-lab-client.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../src/app/home-landing.module.css", import.meta.url), "utf8"),
  readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/enterprise-site-header.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/enterprise-navigation.content.ts", import.meta.url), "utf8"),
]);

test("landing is white-first while preserving dark mode and clear commercial actions", () => {
  assert.match(layout, /const theme = themeCookie === "dark" \? "dark" : "light"/);
  assert.match(home, /const initialTheme = cookieStore\.get\("theme"\)\?\.value === "dark" \? "dark" : "light"/);
  assert.match(home, /<EnterpriseSiteHeader[\s\S]*initialTheme=\{initialTheme\}/);
  assert.match(header, /<ThemeToggle initialTheme=\{initialTheme\} locale=\{locale\} \/>/);
  assert.match(css, /\.landing-mobile-action-dock__inner\s*\{[\s\S]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);

  assert.match(homeCss, /\.root \{[\s\S]*?--home-paper: #071512;/);
  assert.match(homeCss, /:global\(html\[data-theme="light"\]\) \.root \{[\s\S]*?--home-paper: #ffffff;/);
  assert.match(homeCss, /background: #ffffff !important/);

  assert.match(landing, /primaryLabel = [^\n]*"Diseñar un piloto"/);
  assert.match(landing, /secondaryLabel = [^\n]*"Ver una demostración"/);
  assert.match(landing, /href="#agendar-demo" className="landing-cta-primary/);
  assert.match(landing, /href="\/demo-lab" className="landing-cta-secondary/);
  assert.match(homeCss, /\.root :global\(\.landing-cta-primary\)[\s\S]*?color: #ffffff !important/);
  assert.match(homeCss, /\.root :global\(\.landing-cta-secondary\)[\s\S]*?background: #ffffff !important/);

  assert.match(navigation, /label: "Verificación pública"[\s\S]*?href: "\/proof\/verify"/);
  assert.match(home, /<Link href="\/proof\/verify">/);
  assert.match(home, /site-footer-data-card/);
  assert.match(homeCss, /\.root :global\(\.site-footer-data-card\)[\s\S]*?background: #ffffff !important/);
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
