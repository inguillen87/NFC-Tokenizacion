import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sdkPageUrl = new URL("../src/app/sdk/page.tsx", import.meta.url);

test("SDK vertical media renders one responsive asset for the active theme", async () => {
  const source = await readFile(sdkPageUrl, "utf8");

  assert.match(source, /import \{ getImageProps \} from "next\/image"/);
  assert.match(source, /const theme: SdkTheme = cookieStore\.get\("theme"\)\?\.value === "light" \? "light" : "dark"/);
  assert.match(source, /function SdkThemeImage\(/);
  assert.equal((source.match(/<img\b/g) || []).length, 1, "the SDK page should expose one shared image node, not dark/light pairs");
  assert.equal((source.match(/<SdkThemeImage\b/g) || []).length, 2, "hero and grid should both use the shared theme image");

  assert.match(source, /width: 1200,[\s\S]*height: 1200/);
  assert.match(source, /width: 1280,[\s\S]*height: 900/);
  assert.match(source, /sizes,[\s\S]*quality: 80/);
  assert.match(source, /loading: "lazy" as const/);
  assert.match(source, /loading: "eager" as const, fetchPriority: "high" as const/);
  assert.match(source, /sizes="\(max-width: 760px\) 100vw, \(max-width: 1380px\) 50vw, 17vw"/);

  assert.doesNotMatch(source, /<img[^>]*src=\{activeVertical\.image(?:Light)?\}/s);
  assert.doesNotMatch(source, /<img[^>]*src=\{item\.image(?:Light)?\}/s);
});

test("SDK theme changes swap source sets without hydrating duplicate images", async () => {
  const source = await readFile(sdkPageUrl, "utf8");

  assert.match(source, /data-sdk-theme-image/);
  assert.match(source, /data-dark-src=\{dark\.src\}/);
  assert.match(source, /data-dark-srcset=\{dark\.srcSet\}/);
  assert.match(source, /data-light-src=\{light\.src\}/);
  assert.match(source, /data-light-srcset=\{light\.srcSet\}/);
  assert.match(source, /new MutationObserver\(syncThemeImages\)/);
  assert.match(source, /attributeFilter: \["class", "data-theme"\]/);
  assert.match(source, /<Script id="sdk-theme-media-sync" strategy="afterInteractive">/);
  assert.match(source, /<ThemeToggle initialTheme=\{theme\} \/>/);
  assert.match(source, /suppressHydrationWarning/);
});
