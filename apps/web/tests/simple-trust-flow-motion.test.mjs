import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const [motion, visuals, css] = await Promise.all([
  readFile(new URL("../src/components/simple-trust-flow-motion.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/simple-trust-step-visual.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
]);

test("each trust step is observed and runs only while visible and allowed", () => {
  assert.match(motion, /IntersectionObserver/);
  assert.match(motion, /Array\.from\(list\.children\)/);
  assert.match(motion, /setVisibleItems\(\(current\) =>/);
  assert.match(motion, /entries\.forEach/);
  assert.match(motion, /entry\.intersectionRatio >= 0\.55/);
  assert.match(motion, /items\.forEach\(\(item\) => intersectionObserver\.observe\(item\)\)/);
  assert.match(motion, /Children\.map\(children/);
  assert.match(motion, /cloneElement/);
  assert.match(motion, /"data-motion-active": motionAllowed && visibleItems\.has\(index\) \? "true" : "false"/);
  assert.match(motion, /data-motion-ready=\{mounted && !reducedMotion \? "true" : "false"\}/);
  assert.match(motion, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(motion, /visibilitychange/);
  assert.match(motion, /addEventListener\("change", handleReducedMotionChange\)/);
  assert.match(motion, /removeEventListener\("change", handleReducedMotionChange\)/);
  assert.match(motion, /intersectionObserver\.disconnect\(\)/);
  assert.doesNotMatch(motion, /setInterval|requestAnimationFrame|framer-motion|lottie/i);
});

test("the one-shot journey motion stays passive and exposes no stale playback control", () => {
  assert.match(motion, /export type SimpleTrustFlowMotionProps/);
  assert.doesNotMatch(motion, /<button|aria-pressed|userPaused|pauseLabel|resumeLabel|motionOffLabel/);
  assert.match(motion, /const motionAllowed = mounted && pageVisible && !reducedMotion/);
  assert.match(motion, /export function SimpleTrustFlowIntroMotion/);
  assert.match(motion, /data-motion-active=\{motionAllowed && introVisible \? "true" : "false"\}/);
  assert.match(motion, /intersectionRatio >= 0\.2/);
  assert.match(motion, /splitIntoPhrases/);
  assert.doesNotMatch(motion, /dangerouslySetInnerHTML|aria-live|split\(""\)/);
});

test("three photographic scenes keep localized deterministic overlays and no interactive control", async () => {
  for (const kind of ["discover", "signal", "aftercare"]) {
    assert.match(visuals, new RegExp(`kind === "${kind}"|SimpleTrustVisualKind = [^\\n]*"${kind}"`));
  }
  assert.match(visuals, /import Image from "next\/image"/);
  for (const asset of ["nfc-wine-scan.png", "nfc-parcel-result.png", "nfc-pouch-actions.png"]) {
    assert.match(visuals, new RegExp(asset.replace(".", "\\.")));
    const details = await stat(new URL(`../public/landing/connected-journey/${asset}`, import.meta.url));
    assert.ok(details.size > 100_000, `${asset} must contain a real photographic scene`);
    assert.ok(details.size < 2_000_000, `${asset} must remain below the source-asset budget`);
  }
  assert.match(visuals, /aria-hidden="true"/);
  assert.match(visuals, /alt=""/);
  assert.match(visuals, /quality=\{75\}/);
  assert.match(visuals, /sizes="\(max-width:/);
  assert.match(visuals, /focusable="false"/);
  assert.match(visuals, /<svg/g);
  assert.match(visuals, /DEMO ILUSTRATIVA/);
  assert.match(visuals, /Reserva Andina/);
  assert.match(visuals, /RA-2407/);
  assert.match(visuals, /RESULTADO DIGITAL/);
  assert.match(visuals, /LECTURA RECIBIDA/);
  assert.match(visuals, /ETIQUETA LEÍDA/);
  assert.match(visuals, /Activar garantía/);
  assert.match(visuals, /Ver beneficios/);
  assert.match(visuals, /Hablar con la marca/);
  assert.match(visuals, /trust-photo__image/);
  assert.match(visuals, /trust-photo__info-card--discover/);
  assert.match(visuals, /trust-photo__info-card--result/);
  assert.match(visuals, /trust-photo__actions/);
  assert.match(visuals, /trust-visual__device trust-visual__animated/);
  assert.match(visuals, /trust-visual__tag-group trust-visual__animated/);
  assert.match(visuals, /trust-visual__nfc-ring trust-visual__animated/);
  assert.match(visuals, /trust-visual__check trust-visual__animated/);
  assert.match(visuals, /pathLength="1"/);
  assert.doesNotMatch(visuals, /<video|\.gif|https?:\/\/|onClick|tabIndex/i);
});

test("trust visuals reserve layout, pause offscreen and become static with reduced motion", () => {
  assert.match(css, /\.simple-trust-flow-visual \{[\s\S]{0,1200}min-height:\s*8\.5rem/);
  assert.match(css, /\.simple-trust-flow-visual \{[\s\S]{0,1200}aspect-ratio:\s*2\.19 \/ 1/);
  assert.match(css, /contain:\s*paint/);
  assert.match(css, /\.trust-photo \{[\s\S]{0,700}container-type:\s*inline-size/);
  assert.match(css, /\.trust-photo__image \{[\s\S]{0,700}object-fit:\s*cover/);
  assert.match(css, /html:is\(\.theme-light, \[data-theme="light"\]\) \.trust-photo__image/);
  assert.match(css, /\.simple-trust-flow-steps\[data-motion-ready="true"\] > li \{[\s\S]{0,240}1 both paused/);
  assert.match(css, /li\[data-motion-active="true"\][\s\S]{0,220}animation-play-state:\s*running/);
  assert.match(css, /\.simple-trust-flow-steps\[data-motion-ready="true"\] \.trust-visual__route/);
  assert.match(css, /animation-play-state:\s*running/);
  assert.match(css, /1 both paused/);
  assert.doesNotMatch(css, /(?:trust-flow-step|trust-visual)[^;\n]*infinite/);
  assert.match(css, /@keyframes trust-flow-title-enter/);
  assert.match(css, /@keyframes trust-flow-visual-sheen/);
  assert.match(css, /@keyframes trust-visual-device/);
  assert.match(css, /@keyframes trust-visual-check/);
  assert.doesNotMatch(css, /@keyframes (?:trust-flow|trust-visual)[\s\S]{0,1200}(?:filter|box-shadow):/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.simple-trust-flow-visual \*/);
  assert.match(css, /\.simple-trust-flow-visual \.trust-visual__animated[\s\S]{0,220}opacity:\s*1 !important/);
  assert.match(css, /\.simple-trust-flow-intro :is\([\s\S]{0,420}opacity:\s*1 !important/);
  assert.match(css, /\.simple-trust-flow-ambient,[\s\S]{0,120}display:\s*none !important/);
  assert.match(css, /\.simple-trust-flow-steps li:hover \.simple-trust-flow-visual \{\s*transform:\s*none !important/);
});
