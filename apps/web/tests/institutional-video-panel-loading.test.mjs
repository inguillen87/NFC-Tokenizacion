import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const componentUrl = new URL("../src/components/institutional-video-panel.tsx", import.meta.url);

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
