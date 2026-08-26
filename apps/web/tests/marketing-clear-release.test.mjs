import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

function luminance(hex) {
  const channels = hex
    .replace("#", "")
    .match(/.{2}/g)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const high = Math.max(luminance(foreground), luminance(background));
  const low = Math.min(luminance(foreground), luminance(background));
  return (high + 0.05) / (low + 0.05);
}

test("marketing action and supporting-text tokens meet AA in light and dark modes", async () => {
  const css = await read("../src/components/marketing-clear/marketing-clear.module.css");

  assert.ok(contrast("ffffff", "075f5e") >= 4.5);
  assert.ok(contrast("ffffff", "0f6966") >= 4.5);
  assert.ok(contrast("596d70", "f7f9fc") >= 4.5);
  assert.ok(contrast("0d2023", "d8f0ed") >= 4.5);
  assert.match(css, /--clear-action-bg: #075f5e/);
  assert.match(css, /--clear-action-bg: #0f6966/);
  assert.match(css, /\.finalCard h2,[\s\S]*color: var\(--clear-on-strong\)/);
  assert.match(css, /\.finalCard \.secondaryButton \{[\s\S]*transition: transform 160ms ease, border-color 160ms ease/);
  assert.match(css, /\.primaryButton[\s\S]*background: var\(--clear-action-bg\)/);
});

test("mobile drawer is viewport-fixed and available before desktop utilities disappear", async () => {
  const [navigation, css] = await Promise.all([
    read("../src/components/marketing-clear/clear-navigation.tsx"),
    read("../src/components/marketing-clear/marketing-clear.module.css"),
  ]);
  const headerRule = css.match(/\.siteHeader\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.doesNotMatch(headerRule, /backdrop-filter/);
  assert.match(css, /\.siteHeader::before[\s\S]*backdrop-filter: blur\(18px\)/);
  assert.match(css, /\.mobileOverlay\s*\{[\s\S]*position: fixed[\s\S]*inset: 0/);
  assert.match(css, /@media \(max-width: 1320px\)[\s\S]*\.desktopUtility[\s\S]*display: none[\s\S]*\.mobileMenuButton[\s\S]*display: inline-flex/);
  assert.match(navigation, /groupButtonRefs\.current\[groupId\]\?\.focus\(\)/);
});

test("marketing demo links use Demo Lab canonical vertical keys", async () => {
  const content = await read("../src/components/marketing-clear/marketing-clear.content.ts");

  assert.match(content, /vertical=perfume/);
  assert.match(content, /vertical=seeds/);
  assert.match(content, /vertical=bracelet/);
  assert.doesNotMatch(content, /vertical=(?:cosmetics|agro|events)/);
});

test("global structured data describes software and preserves the physical-evidence boundary", async () => {
  const schema = await read("../src/components/structured-data.tsx");

  assert.match(schema, /"@type": "SoftwareApplication"/);
  assert.match(schema, /Digital evidence does not by itself prove a physical object/);
  assert.doesNotMatch(schema, /Product Authentication|"@type": "Product"/);
});

test("new marketing routes own localized metadata and their canonical paths", async () => {
  const [helper, solutions, industries, solutionDetail, industryDetail] = await Promise.all([
    read("../src/components/marketing-clear/marketing-metadata.ts"),
    read("../src/app/solutions/page.tsx"),
    read("../src/app/industries/page.tsx"),
    read("../src/app/solutions/[slug]/page.tsx"),
    read("../src/app/industries/[slug]/page.tsx"),
  ]);

  assert.match(helper, /alternates: \{ canonical \}/);
  assert.match(helper, /type: "website"/);
  assert.match(helper, /siteName: siteConfig\.productName/);
  assert.match(helper, /alternateLocale:/);
  assert.match(helper, /const socialImage = `\/social-image\?\$\{new URLSearchParams/);
  assert.match(helper, /locale,[\s\S]*surface: "home",[\s\S]*campaign: "default"/);
  assert.match(helper, /images: \[\{ url: socialImage/);
  assert.match(helper, /card: "summary_large_image"/);
  assert.ok((helper.match(/images: \[\{ url: socialImage/g) ?? []).length === 2);
  assert.match(helper, /getMarketingCopy\(locale\)/);
  assert.match(solutions, /getMarketingOverviewMetadata\(locale, "solutions"\)/);
  assert.match(industries, /getMarketingOverviewMetadata\(locale, "industries"\)/);
  assert.match(solutionDetail, /getMarketingDetailMetadata\(locale, entry, "solutions"\)/);
  assert.match(industryDetail, /getMarketingDetailMetadata\(locale, entry, "industries"\)/);
});

test("first visit locale and theme resolve consistently across the shell", async () => {
  const [layout, context, demoLab] = await Promise.all([
    read("../src/app/layout.tsx"),
    read("../src/components/marketing-clear/marketing-page-context.ts"),
    read("../src/app/(public)/demo-lab/page.tsx"),
  ]);

  assert.ok((layout.match(/getWebI18n\(\)/g) ?? []).length >= 2);
  assert.match(layout, /themeCookie === "dark" \? "dark" : "light"/);
  assert.match(layout, /className=\{theme === "light" \? "theme-light" : undefined\}/);
  assert.match(layout, /data-theme=\{theme\}/);
  assert.match(context, /get\("theme"\)\?\.value === "dark" \? "dark" : "light"/);
  assert.match(demoLab, /cookieTheme === "dark"[\s\S]*\? "dark"[\s\S]*: "light"/);
});

test("home and SDK receive the server-resolved theme without an inverse flash", async () => {
  const [homeRoute, home, sdk] = await Promise.all([
    read("../src/app/page.tsx"),
    read("../src/components/marketing-clear/clear-home.tsx"),
    read("../src/app/sdk/page.tsx"),
  ]);

  assert.match(homeRoute, /<ClearHome locale=\{locale\} initialTheme=\{initialTheme\} \/>/);
  assert.match(home, /initialTheme=\{initialTheme\}/);
  assert.doesNotMatch(home, /initialTheme="light"/);
  assert.match(sdk, /get\("theme"\)\?\.value === "dark" \? "dark" : "light"/);
});

test("detail-page commercial handoff preserves solution or industry context", async () => {
  const detail = await read("../src/components/marketing-clear/clear-detail-page.tsx");

  assert.match(detail, /contactVerticalBySlug/);
  assert.match(detail, /intent: "company_rollout"/);
  assert.match(detail, /vertical: contactVerticalBySlug\[entry\.slug\]/);
  assert.match(detail, /message: contactMessage/);
  assert.match(detail, /href=\{contactHref\}/);
});

test("institutional video keeps truthful scope and wired localized captions", async () => {
  const [panel, video, esCaptions, enCaptions, ptCaptions] = await Promise.all([
    read("../src/components/institutional-video-panel.tsx"),
    read("../src/lib/institutional-video.ts"),
    read("../public/video/nexid_institutional_es.vtt"),
    read("../public/video/nexid_institutional_en.vtt"),
    read("../public/video/nexid_institutional_pt.vtt"),
  ]);

  assert.match(panel, /validación en tiempo real.*mensaje NFC.*servicio está disponible/s);
  assert.match(panel, /prevenir fraude es un objetivo, no una garantía ni prueba del objeto físico/);
  assert.match(panel, /kind="captions"[\s\S]*src=\{video\.captions\}[\s\S]*srcLang=\{video\.captionsLanguage\}[\s\S]*default/);
  assert.match(video, /institutionalVideoCaptions[\s\S]*nexid_institutional_es\.vtt[\s\S]*nexid_institutional_en\.vtt[\s\S]*nexid_institutional_pt\.vtt/);

  for (const captions of [esCaptions, enCaptions, ptCaptions]) {
    assert.match(captions, /^WEBVTT\s/m);
    assert.match(captions, /\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/);
  }
});

test("detail routes enumerate canonical slugs and fail closed for unknown entries", async () => {
  const [content, slugs, proxy, solutionRoute, industryRoute] = await Promise.all([
    read("../src/components/marketing-clear/marketing-clear.content.ts"),
    read("../src/lib/marketing-route-slugs.ts"),
    read("../src/proxy.ts"),
    read("../src/app/solutions/[slug]/page.tsx"),
    read("../src/app/industries/[slug]/page.tsx"),
  ]);

  for (const slug of ["product-identity", "traceability", "digital-passport", "customer-experience", "offline-operations"]) {
    assert.match(slugs, new RegExp(`"${slug}"`));
  }
  for (const slug of ["wine-spirits", "luxury-beauty", "pharma-health", "agro-food", "logistics", "events"]) {
    assert.match(slugs, new RegExp(`"${slug}"`));
  }

  assert.match(content, /export \{ INDUSTRY_SLUGS, SOLUTION_SLUGS \}/);
  assert.match(proxy, /marketingCatalogNotFound/);
  assert.match(proxy, /NextResponse\.rewrite\(url, \{ status: 404 \}\)/);
  assert.match(solutionRoute, /SOLUTION_SLUGS\.map\(\(slug\) => \(\{ slug \}\)\)/);
  assert.match(industryRoute, /INDUSTRY_SLUGS\.map\(\(slug\) => \(\{ slug \}\)\)/);
  assert.match(solutionRoute, /export const dynamicParams = false/);
  assert.match(industryRoute, /export const dynamicParams = false/);
  assert.match(solutionRoute, /if \(!entry\) notFound\(\)/);
  assert.match(industryRoute, /if \(!entry\) notFound\(\)/);
});

test("localized controls and social images remain readable without repeated rendering", async () => {
  const [switcher, themeToggle, navigation, socialRoute] = await Promise.all([
    read("../../../packages/ui/src/locale-switcher.tsx"),
    read("../../../packages/ui/src/theme-toggle.tsx"),
    read("../src/components/marketing-clear/clear-navigation.tsx"),
    read("../src/app/social-image/route.ts"),
  ]);

  assert.match(switcher, /"es-AR": "Seleccionar idioma"/);
  assert.match(switcher, /"pt-BR": "Selecionar idioma"/);
  assert.match(switcher, /en: "Select language"/);
  assert.match(switcher, /aria-label=\{ariaLabels\[value\]/);
  assert.match(themeToggle, /toDark: "Cambiar a modo oscuro"/);
  assert.match(themeToggle, /toLight: "Mudar para o modo claro"/);
  assert.match(themeToggle, /aria-label=\{actionLabel\}/);
  assert.ok((navigation.match(/<ThemeToggle initialTheme=\{initialTheme\} locale=\{locale\} \/>/g) ?? []).length === 2);
  assert.match(socialRoute, /supportedLocales/);
  assert.match(socialRoute, /supportedSurfaces/);
  assert.match(socialRoute, /s-maxage=86400/);
  assert.match(socialRoute, /stale-while-revalidate=604800/);
});
