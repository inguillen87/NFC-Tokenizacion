import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/components/hero-three-stage.tsx", import.meta.url), "utf8");

test("Three.js playback is gated by motion preference, document visibility and intersection", () => {
  assert.match(source, /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(source, /let documentVisible = !document\.hidden/);
  assert.match(source, /new IntersectionObserver\(\(\[entry\]\) => \{[\s\S]*entry\?\.isIntersecting[\s\S]*entry\.intersectionRatio > 0/);
  assert.match(source, /const shouldAnimate = \(\) => !reducedMotion && documentVisible && inViewport/);
  assert.match(source, /document\.addEventListener\("visibilitychange", handleVisibilityChange\)/);
  assert.match(source, /reducedMotionQuery\.addEventListener\("change", handleReducedMotionChange\)/);
  assert.match(source, /intersectionObserver\?\.observe\(mount\)/);
});

test("paused playback keeps a stable rendered frame without a continuous RAF", () => {
  assert.match(source, /renderStableFrame = \(\) => renderScene\(animationElapsed, false\)/);
  assert.match(source, /if \(!shouldAnimate\(\)\) \{[\s\S]*cancelAnimationLoop\(\);[\s\S]*renderStableFrame\?\.\(\);[\s\S]*return;/);
  assert.match(source, /renderStableFrame\(\);\s*startAnimationLoop\(\);/);
  assert.match(source, /if \(disposed \|\| frameId !== null \|\| !shouldAnimate\(\)\) return;/);

  const rafCalls = [...source.matchAll(/window\.requestAnimationFrame\(animateFrame\)/g)];
  assert.equal(rafCalls.length, 2, "RAF should only be scheduled by the guarded frame and start functions");
  assert.doesNotMatch(source, /requestAnimationFrame\(renderScene\)/);
});

test("resume avoids hidden-tab time jumps and preserves static interactions", () => {
  assert.match(source, /lastFrameTime = null;\s*frameId = window\.requestAnimationFrame\(animateFrame\)/);
  assert.match(source, /Math\.min\(Math\.max\(\(time - lastFrameTime\) \/ 1000, 0\), 0\.05\)/);
  assert.match(source, /if \(reducedMotion\) renderStableFrame\?\.\(\);\s*else startAnimationLoop\(\);/);

  const renderRequests = [...source.matchAll(/requestRenderRef\.current\?\.\(\)/g)];
  assert.ok(renderRequests.length >= 4, "state, drag, click and wheel changes should request a visible frame");
});

test("playback observers and animation resources are cleaned up", () => {
  assert.match(source, /disposed = true;\s*cancelAnimationLoop\(\);/);
  assert.match(source, /requestRenderRef\.current = null/);
  assert.match(source, /document\.removeEventListener\("visibilitychange", handleVisibilityChange\)/);
  assert.match(source, /reducedMotionQuery\.removeEventListener\("change", handleReducedMotionChange\)/);
  assert.match(source, /intersectionObserver\?\.disconnect\(\)/);
  assert.match(source, /resizeObserver\.disconnect\(\)/);
  assert.match(source, /renderer\.dispose\(\)/);
});
