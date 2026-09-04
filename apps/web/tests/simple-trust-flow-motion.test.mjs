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
  assert.match(motion, /entry\.intersectionRatio >= 0\.18/);
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

test("three phases keep the default Reserva Andina story with deterministic photographic frames", async () => {
  for (const kind of ["discover", "signal", "aftercare"]) {
    assert.match(visuals, new RegExp(`kind === "${kind}"|SimpleTrustVisualKind = [^\\n]*"${kind}"`));
  }
  assert.match(visuals, /import Image from "next\/image"/);
  assert.match(visuals, /const PHOTO_BY_KIND: Record<SimpleTrustVisualKind, string>/);
  assert.match(visuals, /const PHOTO_BY_INDUSTRY: Record<SimpleTrustIndustry, Record<SimpleTrustVisualKind, string>>/);
  assert.match(visuals, /src=\{photoByKind\[kind\]\}/);
  assert.doesNotMatch(visuals, /nfc-parcel-result|nfc-pouch-actions/);
  for (const asset of ["wine-journey-01.webp", "wine-journey-02.webp", "wine-journey-03.webp"]) {
    assert.match(visuals, new RegExp(asset.replace(".", "\\.")));
    const details = await stat(new URL(`../public/landing/connected-journey/${asset}`, import.meta.url));
    assert.ok(details.size > 20_000, `${asset} must contain a photographic scene`);
    assert.ok(details.size < 100_000, `${asset} must remain lightweight`);
  }
  assert.match(visuals, /aria-hidden="true"/);
  assert.match(visuals, /alt=""/);
  assert.match(visuals, /quality=\{75\}/);
  assert.match(visuals, /sizes="\(max-width:/);
  assert.match(visuals, /focusable="false"/);
  assert.match(visuals, /<svg/g);
  assert.match(visuals, /EJEMPLO ILUSTRATIVO/);
  assert.match(visuals, /Reserva Andina/);
  assert.match(visuals, /RA-2407/);
  assert.match(visuals, /EN EL CELULAR/);
  assert.match(visuals, /PASAPORTE ABIERTO/);
  assert.match(visuals, /REGISTRO VINCULADO/);
  assert.match(visuals, /Ver origen y lote/);
  assert.match(visuals, /Cómo disfrutarlo/);
  assert.match(visuals, /Contactar a la bodega/);
  assert.doesNotMatch(visuals, /Paquete identificado|Pacote identificado|Identified parcel|parcel:|pouch:/i);
  assert.match(visuals, /bottles: \{[\s\S]{0,220}productId: "reserva-andina",[\s\S]{0,120}photoBase: "reserva-andina-wine"/);
  assert.match(visuals, /tag: \{ x: 31\.2, y: 22\.7 \}/);
  assert.match(visuals, /style=\{sceneStyle\(visualMeta\)\}/);
  assert.match(visuals, /signalRoute\(meta, "to-tag"\)/);
  assert.match(visuals, /signalRoute\(meta, "to-phone"/);
  assert.match(visuals, /data-trust-product=\{visualMeta\.productId\}/);
  assert.match(visuals, /data-trust-photo-base=\{visualMeta\.photoBase\}/);
  assert.match(visuals, /data-trust-anchor=\{`\$\{productId\}-nfc-label`\}/);
  assert.match(visuals, /data-trust-motion="phone-approach"/);
  assert.match(visuals, /data-trust-exchange="read-and-response"/);
  assert.match(visuals, /data-trust-state="response-ready"/);
  assert.match(visuals, /data-trust-state="actions-ready"/);
  for (const action of ["origin-and-batch", "serving-guidance", "winery-contact"]) {
    assert.match(visuals, new RegExp(`"${action}"`));
  }
  assert.match(visuals, /trust-photo__image/);
  assert.match(visuals, /trust-photo__info-card--discover/);
  assert.match(visuals, /trust-photo__info-card--result/);
  assert.match(visuals, /trust-photo__actions/);
  assert.match(visuals, /trust-photo__phone-ui--result/);
  assert.match(visuals, /trust-photo__phone-ui--actions/);
  assert.equal((visuals.match(/trust-photo__callout--(?:discover|signal|aftercare)/g) ?? []).length, 3);
  assert.match(visuals, /trust-photo__action-grid/);
  assert.doesNotMatch(visuals, /trust-photo__product-note|connectedProduct|experienceActive/);
  assert.match(visuals, /trust-photo__phone-product/);
  assert.match(visuals, /trust-photo__actions-product/);
  assert.match(visuals, /data-trust-scene-summary=\{kind\}/);
  assert.match(visuals, /simple-trust-step-visual-shell/);
  assert.match(visuals, /<TrustCallout kind=\{kind\} copy=\{copy\} product=\{product\} meta=\{visualMeta\} \/>/);
  assert.ok(
    visuals.indexOf("<TrustCallout") < visuals.indexOf("<div className={`simple-trust-flow-visual"),
    "readable information must precede the unobstructed photographic scene",
  );
  assert.match(visuals, /product\.actions\.map/);
  assert.match(visuals, /<span>\{action\}<\/span>/);
  assert.doesNotMatch(visuals, /actionHints/);
  assert.match(visuals, /trust-visual__device[^"\n]*trust-visual__animated/);
  assert.match(visuals, /trust-visual__tag-group trust-visual__animated/);
  assert.match(visuals, /trust-visual__nfc-ring trust-visual__animated/);
  assert.match(visuals, /trust-visual__check trust-visual__animated/);
  assert.match(visuals, /trust-visual__phone-approach trust-visual__animated/);
  assert.match(visuals, /trust-visual__read-request trust-visual__animated/);
  assert.match(visuals, /trust-visual__response-return trust-visual__animated/);
  assert.match(visuals, /trust-visual__action-packet trust-visual__animated/);
  assert.match(visuals, /pathLength="1"/);
  assert.doesNotMatch(visuals, /<video|\.gif|https?:\/\/|onClick|tabIndex/i);
});

test("trust visuals reserve layout, pause offscreen and become static with reduced motion", () => {
  assert.match(css, /\.simple-trust-flow-visual \{[\s\S]{0,1200}min-height:\s*0/);
  assert.match(css, /\.simple-trust-flow-visual \{[\s\S]{0,1200}aspect-ratio:\s*2\.19 \/ 1/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.simple-trust-flow-visual \{[\s\S]{0,180}min-height:\s*0/);
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
  assert.match(css, /@keyframes trust-photo-phone-approach/);
  assert.match(css, /@keyframes trust-photo-packet-out/);
  assert.match(css, /@keyframes trust-photo-packet-return/);
  assert.match(css, /@keyframes trust-visual-travel-reverse/);
  assert.match(css, /\.trust-photo__phone-ui--actions \{[\s\S]{0,320}background:\s*var\(--trust-photo-panel\)/);
  assert.match(css, /\.trust-photo__callout::after \{[\s\S]{0,520}background:\s*var\(--trust-photo-panel\)/);
  assert.match(css, /\.trust-photo__info-card--discover \{[\s\S]{0,180}top:\s*4\.5%[\s\S]{0,180}bottom:\s*auto/);
  assert.match(css, /\.trust-photo__action-grid \{[\s\S]{0,180}grid-template-columns:\s*repeat\(3/);
  assert.match(css, /\.trust-photo-frame \{[\s\S]{0,700}padding-top:\s*0/);
  assert.match(css, /\.trust-photo-frame > \.trust-photo__callout \{[\s\S]{0,420}position:\s*relative[\s\S]{0,420}margin:\s*0 0\.18rem 0\.62rem/);
  assert.match(css, /\.trust-photo-frame > \.trust-photo__callout \{[\s\S]{0,520}min-height:\s*8\.75rem/);
  assert.match(css, /\.trust-photo-frame \.trust-photo__callout--aftercare > \.trust-photo__action-grid \{[\s\S]{0,180}grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.trust-photo-frame \.trust-photo__callout--aftercare \.trust-photo__action \{[\s\S]{0,360}flex-direction:\s*column[\s\S]{0,220}font-size:\s*clamp\(0\.64rem/);
  assert.match(css, /@media \(max-width: 360px\)[\s\S]{0,800}grid-auto-columns:\s*calc\(100% - 0\.25rem\)/);
  assert.match(css, /@media \(max-width: 360px\)[\s\S]*?\.trust-photo-frame > \.trust-photo__callout \{[\s\S]{0,120}min-height:\s*4\.7rem/);
  assert.match(css, /@media \(max-width: 360px\)[\s\S]*?\.trust-photo-frame > \.trust-photo__callout--signal \{[\s\S]{0,260}grid-template-areas:[\s\S]{0,180}"product"/);
  assert.match(css, /@media \(max-width: 360px\)[\s\S]*?\.trust-photo-frame \.trust-photo__callout--aftercare > \.trust-photo__action-grid \{[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 360px\)[\s\S]*?\.trust-photo-frame > \.trust-photo__callout--aftercare \{[\s\S]{0,260}grid-template-areas:[\s\S]{0,180}"kicker"[\s\S]{0,180}"actions"/);
  assert.match(css, /@media \(max-width: 360px\)[\s\S]*?\.trust-photo-frame \.trust-photo__callout--aftercare \.trust-photo__action \{[\s\S]{0,420}flex-direction:\s*row[\s\S]{0,260}text-align:\s*left/);
  assert.match(css, /\.trust-visual__phone-approach[\s\S]{0,260}1 both paused/);
  assert.match(css, /\.trust-visual__response-packet[\s\S]{0,260}trust-photo-packet-return/);
  assert.doesNotMatch(css, /simple-trust-flow-continuity|trust-continuity-travel/);
  assert.match(css, /@keyframes trust-flow-visual-sheen/);
  assert.match(css, /@keyframes trust-visual-device/);
  assert.match(css, /@keyframes trust-visual-check/);
  assert.doesNotMatch(css, /@keyframes (?:trust-flow|trust-visual)[\s\S]{0,1200}(?:filter|box-shadow):/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.simple-trust-flow-visual \*/);
  assert.match(css, /\.simple-trust-flow-visual \.trust-visual__animated[\s\S]{0,220}opacity:\s*1 !important/);
  assert.match(css, /\.simple-trust-flow-intro :is\([\s\S]{0,420}opacity:\s*1 !important/);
  assert.match(css, /\.simple-trust-flow-ambient,[\s\S]{0,320}display:\s*none !important/);
  assert.match(css, /\.simple-trust-flow-steps li:hover,[\s\S]{0,180}transform:\s*none !important/);
});
