import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("legacy public landing route redirects to the canonical home landing", async () => {
  const legacy = await readFile(new URL("../src/app/(public)/landing/page.tsx", import.meta.url), "utf8");
  const proxy = await readFile(new URL("../src/proxy.ts", import.meta.url), "utf8");

  assert.match(legacy, /from "next\/navigation"/);
  assert.match(legacy, /function buildCanonicalLandingHref/);
  assert.match(legacy, /redirect\(buildCanonicalLandingHref\(params\)\)/);
  assert.match(legacy, /query\.append\(key, entry\)/);
  assert.match(proxy, /shouldCanonicalizeLanding = pathname === "\/landing" \|\| pathname === "\/landing\/"/);
  assert.match(proxy, /url\.pathname = "\/"/);
  assert.match(proxy, /NextResponse\.redirect\(url, 308\)/);
  assert.doesNotMatch(legacy, /bg-neutral-950/);
  assert.doesNotMatch(legacy, /Tus productos/);
});

test("landing mobile media guard contains the friendly hero and institutional video", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  const mobileGuard = css.indexOf("Landing mobile media containment closure");
  const demoLabPass = css.indexOf("Demo Lab final enterprise pass");

  assert.ok(mobileGuard > -1, "expected the landing mobile media guard to exist");
  assert.ok(demoLabPass > mobileGuard, "mobile guard should stay in the landing section before demo lab");

  const guard = css.slice(mobileGuard, demoLabPass);

  assert.match(guard, /@media \(max-width:\s*720px\)/);
  assert.match(guard, /body \.landing-root \.landing-hero-section \.hero-demo-shell,[\s\S]*overflow-x:\s*clip !important/);
  assert.match(guard, /body \.landing-root \.institutional-video-panel--landing\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) !important/);
  assert.match(guard, /body \.landing-root \.institutional-video-panel--landing \.institutional-video-frame\s*\{[\s\S]*min-height:\s*clamp\(10\.5rem,\s*50vw,\s*13\.5rem\) !important/);
});
