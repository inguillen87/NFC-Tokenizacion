import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeFiles = {
  about: new URL("../src/app/about/page.tsx", import.meta.url),
  audiences: new URL("../src/app/audiences/page.tsx", import.meta.url),
  glossary: new URL("../src/app/glossary/page.tsx", import.meta.url),
  resellers: new URL("../src/app/resellers/page.tsx", import.meta.url),
  stack: new URL("../src/app/stack/page.tsx", import.meta.url),
};

const helperSource = readFileSync(
  new URL("../src/lib/public-page-metadata.ts", import.meta.url),
  "utf8",
);

test("each public route generates metadata from the server-resolved locale", () => {
  for (const [route, file] of Object.entries(routeFiles)) {
    const source = readFileSync(file, "utf8");

    assert.match(source, /export async function generateMetadata\(\): Promise<Metadata>/);
    assert.match(source, /const \{ locale \} = await getWebI18n\(\)/);
    assert.match(
      source,
      new RegExp(`return buildPublicPageMetadata\\("${route}", locale\\)`),
    );
  }
});

test("metadata helper defines the exact canonical path for every public route", () => {
  for (const route of Object.keys(routeFiles)) {
    assert.match(
      helperSource,
      new RegExp(`${route}: \\{[\\s\\S]*?path: "/${route}"`),
    );
  }

  assert.match(helperSource, /canonical: pageUrl/);
  assert.match(helperSource, /url: pageUrl/);
});

test("metadata copy is localized and social fields do not inherit home metadata", () => {
  for (const locale of ['"es-AR"', '"pt-BR"', "en"]) {
    assert.match(helperSource, new RegExp(`${locale}: \\{`));
  }

  assert.equal((helperSource.match(/title: copy\.title/g) || []).length, 3);
  assert.equal((helperSource.match(/description: copy\.description/g) || []).length, 3);
  assert.match(helperSource, /card: "summary_large_image"/);
  assert.match(helperSource, /locale: openGraphLocale/);
  assert.match(helperSource, /alternateLocale:/);
  assert.doesNotMatch(helperSource, /Autenticidad NFC para productos premium/);
  assert.doesNotMatch(helperSource, /NFC authenticity for premium products/);
});

test("OpenGraph and Twitter use a real public image with explicit dimensions and alt text", () => {
  assert.match(helperSource, /SOCIAL_IMAGE_PATH = "\/images\/visual_storyboard\.jpeg"/);
  assert.match(helperSource, /SOCIAL_IMAGE_WIDTH = 1376/);
  assert.match(helperSource, /SOCIAL_IMAGE_HEIGHT = 768/);
  assert.equal((helperSource.match(/url: imageUrl/g) || []).length, 2);
  assert.equal((helperSource.match(/alt: copy\.imageAlt/g) || []).length, 2);
  assert.doesNotMatch(helperSource, /opengraph-image\?/);
  assert.doesNotMatch(helperSource, /twitter-image\?/);
});
