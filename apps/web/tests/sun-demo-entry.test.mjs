import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isSunDemoGalleryEntry, resolveSunDemoProfile } from "../src/app/sun/sun-demo-entry.ts";
import { resolveSunEntry } from "../src/app/sun/sun-availability.ts";
import { selectedValleSecretoDemo, valleSecretoDemoResult } from "../src/app/sun/valle-secreto-demo.ts";
import { resolveDemoProductProfile } from "../src/lib/demo-product-profiles.ts";
import { SUN_DEMO_GALLERY_HREF, VALLE_SECRETO_DEMO_HREF, sunIndustryDemoHref, sunDemoScenarioHref } from "../src/lib/sun-demo-links.ts";

const empty = { isQrScan: false, demoRequested: false, snapshotId: "", snapshotTrace: "", snapshotAccess: "", freshToken: "", dynamic: ["", "", "", "", ""] };

test("only a genuinely empty SUN entry shows the gallery, with optional presentation language", () => {
  assert.equal(isSunDemoGalleryEntry(resolveSunEntry(empty), {}), true);
  for (const params of [{ lang: "en" }, { locale: "pt-BR" }, { lang: "es-AR", locale: "en" }]) assert.equal(isSunDemoGalleryEntry("empty", params), true);
  for (const entry of ["qr", "demo", "snapshot", "dynamic", "incomplete"]) assert.equal(isSunDemoGalleryEntry(entry, {}), false);
  assert.equal(isSunDemoGalleryEntry("empty", { lang: ["en", "es-AR"] }), false);
});

test("signed, historical, QR, event and malformed markers cannot be replaced by a gallery", () => {
  const markers = ["v", "bid", "picc_data", "enc", "cmac", "snapshot", "trace", "access", "snapshot_access", "fresh", "fresh_token", "eid", "eventId", "qr", "channel", "demo", "profile", "tenant", "api"];
  for (const key of markers) for (const value of ["", "synthetic-invalid", ["", "synthetic-invalid"]]) assert.equal(isSunDemoGalleryEntry("empty", { [key]: value }), false, `${key}/${JSON.stringify(value)}`);
  for (const override of [{ isQrScan: true }, { hasSnapshotMarker: true }, { hasDynamicMarker: true }, { snapshotId: "qa", snapshotTrace: "trace", snapshotAccess: "access" }, { dynamic: ["", "bid", "picc", "enc", "cmac"] }]) {
    const entry = resolveSunEntry({ ...empty, demoRequested: true, ...override });
    assert.notEqual(entry, "demo");
    assert.equal(isSunDemoGalleryEntry(entry, {}), false);
    assert.equal(selectedValleSecretoDemo(entry === "demo", resolveSunDemoProfile(entry === "demo", {})), null);
  }
});

test("plain demo selects Valle without granting an identity or business action", () => {
  assert.equal(resolveSunDemoProfile(true, { demo: "1" }), "valle-secreto");
  const result = valleSecretoDemoResult(true, resolveSunDemoProfile(true, { demo: "1" }), "closed");
  assert.equal(result.product.name, "Profundo 2019");
  assert.equal(result.status.reason, "demo_preview");
  assert.equal(result.identity.uid, null);
  assert.equal(result.tapContext, undefined);
  assert.deepEqual(result.allowedActions, []);
  assert.equal(resolveSunDemoProfile(false, {}), "");
  assert.equal(valleSecretoDemoResult(false, resolveSunDemoProfile(false, {}), "closed"), null);
});

test("explicit profiles and legacy Demo Lab defaults keep their original behavior", () => {
  for (const profile of ["wine", "perfume", "agro", "agrochem", "fragrance", "", "unknown"]) {
    assert.equal(resolveSunDemoProfile(true, { demo: "1", profile }), profile);
    assert.equal(selectedValleSecretoDemo(true, resolveSunDemoProfile(true, { profile })), null);
  }
  assert.equal(resolveSunDemoProfile(true, { demo: "1", profile: ["valle-secreto"] }), "");
  assert.equal(resolveSunDemoProfile(true, { demo: "1", source: "demo-lab" }), "");
  assert.equal(resolveSunDemoProfile(true, { demo: "1", source: ["demo-lab"] }), "");
  for (const key of ["eid", "eventId", "bid", "fresh", "snapshot", "qr", "product", "productName", "vertical", "visual"]) assert.equal(resolveSunDemoProfile(true, { demo: "1", [key]: "synthetic-invalid" }), "");
  assert.equal(resolveDemoProductProfile(resolveSunDemoProfile(true, { source: "demo-lab" })).key, "wine");
});

test("curated destinations are stable explicit demos without client or NFC context", () => {
  assert.equal(SUN_DEMO_GALLERY_HREF, "/sun");
  const wine = new URL(VALLE_SECRETO_DEMO_HREF, "https://nexid.lat");
  assert.deepEqual([...wine.searchParams], [["demo", "1"], ["profile", "valle-secreto"], ["scenario", "closed"]]);
  for (const profile of ["agrochem", "fragrance", "perfume"]) {
    const url = new URL(sunIndustryDemoHref(profile), wine.origin);
    assert.equal(url.pathname, "/sun");
    assert.deepEqual([...url.searchParams], [["demo", "1"], ["source", "demo-lab"], ["profile", profile]]);
    assert.equal(resolveDemoProductProfile(url.searchParams.get("profile")).key, profile);
  }
});

test("gallery returns before source reads and excludes map, location and customer providers", async () => {
  const page = await readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8");
  const galleryAt = page.indexOf("if (isSunDemoGalleryEntry(entry, params))");
  const sourceAt = page.indexOf("const qrRead = await readSunPublicContract");
  const galleryBranch = page.slice(galleryAt, page.indexOf("const valleDemo =", galleryAt));
  assert.ok(galleryAt > page.indexOf("const entry = resolveSunEntry("));
  assert.ok(galleryAt < sourceAt);
  assert.match(galleryBranch, /return <SunLocaleProvider initialLocale=\{locale\}><SunDemoGallery \/><\/SunLocaleProvider>/);
  assert.doesNotMatch(galleryBranch, /SunLocationProvider|ProductNoticeProvider|OfflinePublicProductCache|WineExperienceEvents|readSun|fetch/);
  assert.match(page, /imageUrl: photography\?\.imageUrl \|\| \(isDemoLabHandoff \? handoffProfile\.images\[0\] : null\)/);
});

test("scenario links contain only an allowlisted demo profile, state and no physical credentials", () => {
  for (const profile of ["valle-secreto", "agrochem", "fragrance", "perfume"]) for (const scenario of ["closed", "opened", "invalid"]) {
    const url = new URL(sunDemoScenarioHref(profile, scenario), "https://nexid.lat");
    assert.equal(url.pathname, "/sun");
    assert.equal(url.searchParams.get("demo"), "1");
    assert.equal(url.searchParams.get("profile"), profile);
    assert.equal(url.searchParams.get("scenario"), scenario);
    assert.deepEqual([...url.searchParams.keys()], profile === "valle-secreto" ? ["demo", "profile", "scenario"] : ["demo", "source", "profile", "scenario"]);
    assert.equal(url.searchParams.get("source"), profile === "valle-secreto" ? null : "demo-lab");
  }
  assert.equal(sunDemoScenarioHref("arbitrary", "invalid"), "/sun");
});

test("gallery is localized, static and transparent about all sample brands and images", async () => {
  const [gallery, css] = await Promise.all([readFile(new URL("../src/app/sun/sun-demo-gallery.tsx", import.meta.url), "utf8"), readFile(new URL("../src/app/sun/sun-demo-gallery.module.css", import.meta.url), "utf8")]);
  for (const title of ["Elegí una experiencia", "Choose an experience", "Escolha uma experiência"]) assert.ok(gallery.includes(title));
  assert.match(gallery, /data-demo-profile="valle-secreto"/);
  assert.match(gallery, /Marca de muestra · foto de referencia/);
  assert.match(gallery, /Todas son demos\. No verifican etiquetas reales/);
  assert.doesNotMatch(gallery, /fetch\(|geolocation|localStorage|sessionStorage|Math\.random|setInterval|useEffect/);
  assert.match(css, /theme-dark/);
  assert.match(css, /min-height: 2\.75rem/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: no-preference/);
});
