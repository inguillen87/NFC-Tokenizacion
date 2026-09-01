import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("unified release preserves the approved clean home composition", async () => {
  const [home, layout, sections] = await Promise.all([
    readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/home-sections.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /nexID \| Productos conectados, garantía y postventa/);
  assert.match(home, /className="site-header landing-mega-header/);
  assert.match(home, /<HeroSection content=\{content\} locale=\{locale\} initialTheme=\{initialTheme\} \/>/);
  assert.match(home, /<SimpleTrustFlowSection locale=\{locale\} \/>/);
  assert.match(home, /<CommercialValueSection locale=\{locale\} \/>/);
  assert.match(home, /<CommercialContactModal initialLocale=\{locale\} \/>/);
  assert.match(sections, /Tu equipo decide qué muestra y qué habilita cada producto\./);

  assert.doesNotMatch(home, /mobile-optimized-header/);
  assert.doesNotMatch(home, /landing-brand-synergy-band/);
  assert.doesNotMatch(home, /landing-mobile-action-dock/);
  assert.doesNotMatch(
    home,
    /EnterpriseTrustLayers|OfflineCapabilities|BrandSynergy|DemoRequest|SalesChat|QuickHub/,
  );
});

test("clean footer exposes the verified Inmovar and Inguillen ecosystem links", async () => {
  const [home, styles] = await Promise.all([
    readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);

  for (const href of [
    "https://www.inmov.ar/",
    "https://www.instagram.com/inmov.ar/",
    "https://www.linkedin.com/company/inmovar/",
    "https://www.facebook.com/inmovar.oficial/",
    "https://inguillen.ar/",
    "https://www.instagram.com/inguillen/",
    "https://www.linkedin.com/in/marcelo-guill%C3%A9n-54876527/",
  ]) {
    assert.match(home, new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(home, /Ecosistema y equipo/);
  assert.match(home, /Inguillen · Marcelo Guillén/);
  assert.doesNotMatch(home, /facebook\.com\/(?:inguillen|marcelo-guillen)/i);
  assert.match(styles, /\.site-footer-ecosystem-grid a \{[\s\S]{0,180}min-height:\s*2\.75rem/);
});

test("unified release keeps depth in the clean mega navigation", async () => {
  const nav = await readFile(
    new URL("../src/components/marketing-mega-nav.tsx", import.meta.url),
    "utf8",
  );

  for (const label of ["Soluciones", "Industrias", "Plataforma", "Recursos"]) {
    assert.match(nav, new RegExp(`label: "${label}"`));
  }
  assert.match(nav, /className=\{styles\.mobileDialog\}/);
  assert.match(nav, /aria-expanded=\{mobileOpen\}/);
});

test("clean home keeps its CTA group semantic and readable light footer copy", async () => {
  const [sections, styles] = await Promise.all([
    readFile(new URL("../src/components/home-sections.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(sections, /className="hero-post-video-actions[^\"]*" role="group" aria-label=/);
  assert.match(
    styles,
    /html\.theme-light \.site-footer-meta,[\s\S]*?html\[data-theme="light"\] \.site-footer-meta \{[\s\S]*?color: #5b6d82;/,
  );
  assert.doesNotMatch(
    styles,
    /html\.theme-light \.site-footer-meta,[\s\S]*?html\[data-theme="light"\] \.site-footer-meta \{[\s\S]*?color: #718096;/,
  );
});
