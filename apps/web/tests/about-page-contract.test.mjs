import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("about page states the institutional relationship and founder facts in three locales", async () => {
  const page = await read("../src/app/about/page.tsx");

  assert.match(page, /Record<AppLocale, AboutCopy>/);
  assert.match(page, /"es-AR":/);
  assert.match(page, /"pt-BR":/);
  assert.match(page, /en:/);
  assert.match(page, /plataforma de identidad digital de producto y postventa del ecosistema Inmovar Latam/);
  assert.match(page, /Fundador y CEO de nexID · Ingeniero Informático/);
  assert.match(page, /fundador de Inmovar Latam/);
  assert.match(page, /Desde 2013 crea y lidera productos en fintech, SaaS, GovTech, automatización y trazabilidad/);
  assert.match(page, /src="\/team\/marcelo-guillen\.png"/);
  assert.match(page, /loading="lazy"/);
  assert.match(page, /sizes="\(max-width: 360px\) calc\(100vw - 3rem\), 312px"/);
  assert.doesNotMatch(page, /\bpriority\b/);
  assert.match(page, /buildPublicPageMetadata\("about", locale\)/);

  for (const privateField of ["Chuquisaca", "2613168608", "guillen.marce@gmail.com"]) {
    assert.doesNotMatch(page, new RegExp(privateField, "i"));
  }
});

test("about page exposes only the requested founder social profiles accessibly", async () => {
  const page = await read("../src/app/about/page.tsx");

  assert.match(page, /https:\/\/www\.instagram\.com\/inguillen\//);
  assert.match(page, /https:\/\/www\.linkedin\.com\/in\/marcelo-guill%C3%A9n-54876527\//);
  for (const language of ["es", "pt", "en"]) {
    assert.match(page, new RegExp(`https://www\\.inguillen\\.ar/\\?lang=${language}`));
  }
  assert.match(page, /https:\/\/www\.inmov\.ar\//);
  assert.match(page, /Descargar certificado MiPyME de Marcelo Guillén \(PDF\)/);
  assert.match(page, /Baixar certificado MiPyME de Marcelo Guillén \(PDF\)/);
  assert.match(page, /Download Marcelo Guillén's MiPyME certificate \(PDF\)/);
  assert.match(page, /href=\{instagramHref\}[\s\S]{0,140}target="_blank"[\s\S]{0,100}rel="noopener noreferrer"/);
  assert.match(page, /href=\{linkedinHref\}[\s\S]{0,140}target="_blank"[\s\S]{0,100}rel="noopener noreferrer"/);
  assert.match(page, /aria-label=\{copy\.instagram\}/);
  assert.match(page, /aria-label=\{copy\.linkedin\}/);
  assert.match(page, /function InstagramBrandIcon\(\)/);
  assert.match(page, /function LinkedinBrandIcon\(\)/);
  assert.ok((page.match(/fill="currentColor"/g) || []).length >= 4);
  assert.match(page, /<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">/);
  assert.match(page, /<InstagramBrandIcon \/>/);
  assert.match(page, /<LinkedinBrandIcon \/>/);
  assert.doesNotMatch(page, /\bInstagram,|\bLinkedin,/);
  assert.match(page, /<BriefcaseBusiness aria-hidden="true" \/>/);
  assert.doesNotMatch(page, /facebook|twitter|tiktok|youtube/i);
});

test("about page keeps claims bounded and the home only adds navigation access", async () => {
  const [about, home, navigation, sitemap, css, globalCss] = await Promise.all([
    read("../src/app/about/page.tsx"),
    read("../src/app/page.tsx"),
    read("../src/components/marketing-mega-nav.tsx"),
    read("../src/app/sitemap.ts"),
    read("../src/app/about/about.module.css"),
    read("../src/app/globals.css"),
  ]);

  assert.match(about, /Una lectura, por sí sola, no confirma la autenticidad del producto físico/);
  assert.doesNotMatch(about, /clientes líderes|millones de|certificad[oa] por|garantiza la autenticidad/i);
  assert.match(navigation, /label: "Quiénes somos"[\s\S]{0,140}href: "\/about"/);
  assert.match(navigation, /label: "Quem somos"[\s\S]{0,140}href: "\/about"/);
  assert.match(navigation, /label: "About us"[\s\S]{0,140}href: "\/about"/);
  assert.match(home, /href="\/about"[\s\S]{0,120}footerCopy\.about/);
  assert.doesNotMatch(home, /<AboutPage|<AboutInmovarSection/);
  assert.match(about, /className="landing-root about-page"/);
  assert.match(about, /<BrandLockup/);
  assert.match(about, /<MarketingMegaNav/);
  assert.match(about, /resolveThemePreference\(/);
  assert.match(about, /THEME_PREFERENCE_VERSION_COOKIE/);
  assert.match(about, /<main id="about-content" data-nav-inert/);
  assert.doesNotMatch(about, /<BackLink|copy\.back/);
  assert.match(sitemap, /path: "\/about"/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 840px\)/);
  assert.match(css, /width: min\(100%, 19\.5rem\)/);
  assert.match(css, /font-size: clamp\(2rem, 10vw, 2\.75rem\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(globalCss, /body:has\(\.about-page\) \.helpbot-trigger/);
});
