import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const componentUrl = new URL("../src/components/institutional-video-panel.tsx", import.meta.url);
const globalsUrl = new URL("../src/app/globals.css", import.meta.url);

test("institutional video defers heavy media until proximity or explicit playback", async () => {
  const source = await readFile(componentUrl, "utf8");

  assert.match(source, /new IntersectionObserver\([\s\S]*rootMargin: "360px 0px"/);
  assert.match(source, /const image = new Image\(\)/);
  assert.match(source, /if \(!isNearViewport \|\| isLightTheme \|\| isPosterReady\) return/);
  assert.match(source, /src=\{mediaRequested \? video\.src : undefined\}/);
  assert.match(source, /preload=\{mediaRequested \? "metadata" : "none"\}/);
  assert.match(source, /poster=\{isPosterReady && !isLightTheme \? poster : undefined\}/);
  assert.match(source, /setMediaRequested\(true\)[\s\S]*target\.src = video\.src[\s\S]*target\.load\(\)/);
  assert.match(source, /institutional-video-deferred-preview/);
  assert.doesNotMatch(source, /<source\s+src=\{video\.src\}/);
  assert.doesNotMatch(source, /poster=\{poster\}/);
});

test("institutional video disables its decorative status pulse for reduced motion", async () => {
  const source = await readFile(componentUrl, "utf8");

  assert.match(source, /animate-pulse motion-reduce:animate-none/);
  assert.match(source, /motion-reduce:animate-none" aria-hidden="true"/);
});

test("institutional video exposes localized captions", async () => {
  const [source, videoConfig] = await Promise.all([
    readFile(componentUrl, "utf8"),
    readFile(new URL("../src/lib/institutional-video.ts", import.meta.url), "utf8"),
  ]);

  assert.match(source, /<track[\s\S]*kind="captions"[\s\S]*src=\{video\.captions\}[\s\S]*default/);
  assert.match(videoConfig, /nexid_institutional_es\.vtt/);
  assert.match(videoConfig, /nexid_institutional_en\.vtt/);
  assert.match(videoConfig, /nexid_institutional_pt\.vtt/);
});

test("institutional preview and playback cover the media frame without letterboxing", async () => {
  const [source, css] = await Promise.all([
    readFile(componentUrl, "utf8"),
    readFile(globalsUrl, "utf8"),
  ]);

  assert.match(source, /institutional-video-media h-full w-full object-cover/);
  assert.match(
    source,
    /<img[\s\S]*?src=\{poster\}[\s\S]*?institutional-video-light-preview--visible/,
  );
  assert.match(source, /<img[\s\S]*?src=\{poster\}[\s\S]*?loading="lazy"/);
  assert.doesNotMatch(source, /fetchPriority="high"/);
  assert.match(source, /showLightPreview \? "institutional-video-light-preview--visible" : "institutional-video-light-preview--hidden"/);
  assert.match(
    css,
    /\.institutional-video-frame video\s*\{[\s\S]*?display:\s*block;[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;[\s\S]*?object-fit:\s*cover;/,
  );
  assert.match(
    css,
    /\.institutional-video-light-preview\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;/,
  );

  const lightPlaybackRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector]) =>
      selector.includes("institutional-video-panel--landing") &&
      selector.includes("institutional-video-frame:not(.institutional-video-frame--light-preview)") &&
      (selector.includes("html.theme-light") || selector.includes('html[data-theme="light"]')),
    );
  assert.ok(lightPlaybackRules.length > 0, "expected a light-mode playback frame rule");

  const framePadding = lightPlaybackRules.flatMap(([, , declarations]) =>
    [...declarations.matchAll(/padding:\s*([^;]+);/g)].map((match) => match[1].trim()),
  );
  assert.ok(framePadding.length > 0, "light playback frame must declare an explicit zero padding contract");
  assert.deepEqual(
    [...new Set(framePadding)],
    ["0 !important"],
    "light playback must not leave a padded gutter around the cover-fitted video",
  );

  const institutionalObjectFitRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector, declarations]) => selector.includes("institutional-video") && /object-fit\s*:/.test(declarations));
  assert.ok(institutionalObjectFitRules.length > 0, "expected institutional video object-fit rules");
  for (const [rule, , declarations] of institutionalObjectFitRules) {
    assert.doesNotMatch(rule, /object-fit\s*:\s*contain/, "institutional media must never regress to contain/letterbox");
    assert.match(declarations, /object-fit\s*:\s*cover/, "institutional media object-fit must stay cover");
  }

  const landingStripRule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .find(([, selector]) => selector.includes("landing-root") && selector.includes("institutional-video-strip"));
  assert.ok(landingStripRule, "landing must own a dedicated rule for the old technical strip");
  assert.match(landingStripRule[2], /display:\s*none\s*!important/, "landing cover must not render a white technical row");

  assert.match(
    css,
    /@media \(max-width: 720px\)[\s\S]*?body \.landing-root \.institutional-video-panel--landing \.institutional-video-frame\s*\{[\s\S]*?min-height:\s*0\s*!important;[\s\S]*?max-height:\s*none\s*!important;[\s\S]*?aspect-ratio:\s*16 \/ 9\s*!important;/,
    "mobile poster and playback must share the same 16:9 frame without a layout jump",
  );

  const finalLightClosure = css.slice(css.lastIndexOf("White-first institutional media closure"));
  assert.doesNotMatch(finalLightClosure, /background:\s*#071722/, "white-mode media closure must not restore a dark frame");
  assert.match(finalLightClosure, /background:\s*#f3fbfd !important/);
  assert.match(finalLightClosure, /institutional-video-light-preview--hidden[\s\S]{0,240}opacity:\s*0 !important/);
  assert.match(
    finalLightClosure,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?institutional-video-panel--landing\.institutional-video-panel--light-preview \.institutional-video-light-preview[\s\S]*?transition:\s*none !important/,
    "white-mode poster fades must stop when reduced motion is requested",
  );
});

test("white-first poster is locale-neutral, optimized and free of baked-in domain copy", async () => {
  const videoConfig = await readFile(new URL("../src/lib/institutional-video.ts", import.meta.url), "utf8");

  assert.equal((videoConfig.match(/poster_nexid_institutional_light_v2\.webp/g) ?? []).length, 3);
  assert.doesNotMatch(videoConfig, /institutionalVideoLightPosters[\s\S]{0,320}\.jpg/);
});
