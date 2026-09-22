import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { formatSunDateTime, translateSunUiText } from "../src/app/sun/sun-locale.ts";
import { resolveSunConsumerStatus } from "../src/app/sun/sun-consumer-status.ts";
import { resolveSunTtEvidence } from "../src/app/sun/sun-tt-evidence.ts";

const urls = {
  locale: new URL("../src/lib/locale.ts", import.meta.url),
  provider: new URL("../src/app/sun/sun-locale-provider.tsx", import.meta.url),
  preferenceRoute: new URL("../src/app/api/sun/locale/route.ts", import.meta.url),
  dictionary: new URL("../src/app/sun/sun-locale.ts", import.meta.url),
  page: new URL("../src/app/sun/page.tsx", import.meta.url),
  qr: new URL("../src/app/sun/qr-engagement-suite.tsx", import.meta.url),
  optIn: new URL("../src/app/sun/sun-updates-opt-in.tsx", import.meta.url),
};

const baseStatus = {
  isDemoPreview: false,
  isQrScan: false,
  isTechnicallyAuthentic: true,
  isVerifiedClosedState: true,
  isVerifiedOpenedState: false,
  isInvalidSealState: false,
  isTamperRisk: false,
  isReplay: false,
  isSunProfileMismatch: false,
  isSnapshotView: false,
};

test("SUN locale resolution is query lang, then cookie, then request headers", async () => {
  const source = await readFile(urls.locale, "utf8");
  const queryIndex = source.indexOf("if (query)");
  const cookieIndex = source.indexOf("else if (saved)");
  const headerIndex = source.indexOf("const h = await headers()", cookieIndex);

  assert.match(source, /export async function getWebI18n\(queryLocale\?: string \| null\)/);
  assert.ok(queryIndex > 0 && cookieIndex > queryIndex && headerIndex > cookieIndex);
  assert.match(source, /cookieStore\.get\("locale"\)/);
});

test("SUN timestamps stay deterministic between the server and the phone", () => {
  const observedAt = "2026-05-01T18:30:00.000Z";

  assert.match(formatSunDateTime(observedAt, "es-AR", null), /UTC$/);
  assert.doesNotMatch(formatSunDateTime(observedAt, "es-AR", "America\/Argentina\/Buenos_Aires"), /UTC$/);
  assert.match(formatSunDateTime(observedAt, "en", "not-a-time-zone"), /UTC$/);
  for (const locale of ["es-AR", "en", "pt-BR"]) {
    const label = formatSunDateTime("2026-09-21T22:42:23.856Z", locale, null);
    assert.match(label, /22:42/);
    assert.doesNotMatch(label, /[\u00a0\u202f]/);
  }
});

test("SUN timestamp spacing is stable across ICU versions", (t) => {
  for (const separator of [" ", "\u00a0", "\u202f"]) {
    const mocked = t.mock.method(Intl, "DateTimeFormat", function () {
      return { format: () => `21${separator}sept${separator}2026, 22:42` };
    });
    assert.equal(formatSunDateTime("2026-09-21T22:42:23.856Z", "es-AR", null), "21 sept 2026, 22:42 UTC");
    mocked.mock.restore();
  }
});

test("SUN selector persists server-side, changes in place and cannot revalidate or reload the tap", async () => {
  const [provider, preferenceRoute, page] = await Promise.all([
    readFile(urls.provider, "utf8"),
    readFile(urls.preferenceRoute, "utf8"),
    readFile(urls.page, "utf8"),
  ]);

  assert.match(provider, /fetch\("\/api\/sun\/locale",/);
  assert.match(provider, /credentials: "same-origin"/);
  assert.match(provider, /localeRequestRef\.current\?\.controller\.abort\(\)/);
  assert.match(provider, /document\.documentElement\.lang = toDocumentLanguage\(nextLocale\)/);
  assert.doesNotMatch(provider, /url\.searchParams\.set\("lang", nextLocale\)/);
  assert.doesNotMatch(provider, /window\.history\.replaceState\(/);
  assert.doesNotMatch(provider, /document\.cookie\s*=/);
  assert.doesNotMatch(provider, /useRouter|router\.(push|replace|refresh)|window\.location\.(assign|replace)|location\.reload/);
  assert.match(preferenceRoute, /origin_not_allowed/);
  assert.match(preferenceRoute, /isJsonRequest\(request\)/);
  assert.match(preferenceRoute, /readBoundedText\(request, MAX_PAYLOAD_BYTES\)/);
  assert.match(preferenceRoute, /consumePublicApiRateLimit\("sun-locale"/);
  assert.match(preferenceRoute, /isSunLocale\(locale\)/);
  assert.match(preferenceRoute, /response\.cookies\.set\(/);
  assert.match(preferenceRoute, /sameSite: "lax"/);
  assert.match(preferenceRoute, /httpOnly: true/);
  assert.match(preferenceRoute, /Cache-Control", "private, no-store/);
  assert.match(page, /getWebI18n\(requestedLanguage \|\| \(isDemoLabHandoff \? requestedDemoLocale : null\)\)/);
  assert.match(page, /query\.set\("lang", locale\)/);
  assert.match(page, /<SunLocaleProvider initialLocale=\{locale\}>/);
});

test("SUN API engagement uses the active presentation locale instead of hardcoded Spanish", async () => {
  const [qr, optIn] = await Promise.all([
    readFile(urls.qr, "utf8"),
    readFile(urls.optIn, "utf8"),
  ]);

  for (const source of [qr, optIn]) {
    assert.match(source, /useSunLocale\(\)/);
    assert.doesNotMatch(source, /locale:\s*"es-AR"/);
  }
  assert.match(qr, /JSON\.stringify\(\{ locale, tenantSlug, productName/);
  assert.match(optIn, /locale,/);
});

test("stable SUN presentation copy is localized while server evidence is explicitly fenced", async () => {
  const [provider, page, dictionary] = await Promise.all([
    readFile(urls.provider, "utf8"),
    readFile(urls.page, "utf8"),
    readFile(urls.dictionary, "utf8"),
  ]);

  assert.equal(translateSunUiText("Lectura NFC verificada", "pt-BR"), "Leitura NFC verificada");
  assert.equal(translateSunUiText("Lectura NFC verificada", "en"), "Verified NFC read");
  assert.equal(
    translateSunUiText("1,003 km straight-line distance between two demo points; it does not represent a physical route.", "pt-BR"),
    "1.003 km em linha reta entre dois pontos de demonstração; não representa um trajeto físico.",
  );
  assert.equal(
    translateSunUiText("1.003 km em linha reta entre dois pontos de demonstração; não representa um trajeto físico.", "es-AR"),
    "1.003 km de separación lineal entre dos puntos de muestra; no representa un recorrido físico.",
  );
  assert.equal(translateSunUiText("Bodega Los Andes", "en"), "Bodega Los Andes");
  assert.equal(translateSunUiText("Cartografía:", "en"), "Map data:");
  assert.match(translateSunUiText("El proveedor cartográfico recibe la IP de red y el área de las teselas solicitadas. La URL y el identificador del pasaporte no se envían mediante la política no-referrer.", "en"), /map provider receives the network IP/);
  assert.equal(translateSunUiText("±180 m como mínimo", "en"), "±180 m minimum");
  assert.equal(
    translateSunUiText("Geolocalización aproximada del navegador con permiso, medida después del tap · precisión informada ±180 m como mínimo. Zona pública redondeada; valores reportados por el cliente.", "pt-BR"),
    "Geolocalização aproximada do navegador com permissão, medida após o toque · precisão informada ±180 m no mínimo. Zona pública arredondada; valores informados pelo cliente.",
  );
  assert.match(dictionary, /Product names, producer declarations and API evidence are[\s\S]*?intentionally absent/);
  assert.match(provider, /closest\("\[data-sun-server-evidence='true'\]"\)/);
  assert.match(page, /data-sun-server-evidence="true"/);
});

test("stable consumer and TT code interpretations localize without altering raw byte evidence", () => {
  const consumer = resolveSunConsumerStatus(baseStatus, (value) => translateSunUiText(value, "pt-BR"));
  const tt = resolveSunTtEvidence(
    { raw: "4343", source: "enc_decrypted" },
    (value) => translateSunUiText(value, "en"),
  );

  assert.equal(consumer.headline, "A tag informa: lacre fechado");
  assert.equal(tt.label, "TT reports closed");
  assert.equal(tt.bytes[0].title, "Permanent memory");
  assert.equal(tt.rawHex, "4343");
  assert.equal(tt.source, "enc_decrypted");
});

test("SUN map distance and demo source labels survive a complete locale round trip", async () => {
  let distance = "1.003 km lineales";
  let source = "JSON simulado del Demo Lab";
  for (const [locale, expectedDistance, expectedSource] of [
    ["en", "1,003 km straight-line distance", "Simulated Demo Lab JSON"],
    ["pt-BR", "1.003 km em linha reta", "JSON simulado do Demo Lab"],
    ["es-AR", "1.003 km lineales", "JSON simulado del Demo Lab"],
  ]) {
    distance = translateSunUiText(distance, locale);
    source = translateSunUiText(source, locale);
    assert.equal(distance, expectedDistance);
    assert.equal(source, expectedSource);
  }
  // Keep the phrase in one text node so the in-place translator sees its number and unit.
  assert.ok((await readFile(urls.page, "utf8")).includes("{`${distanceDisplay} lineales`}"));
});

test("SUN-owned map guidance localizes without changing provider attribution", () => {
  for (const [source, english, portuguese] of [
    ["Usá Ctrl + desplazamiento para acercar el mapa", "Use Ctrl + scroll to zoom the map", "Use Ctrl + rolagem para ampliar o mapa"],
    ["Demo · conexión ilustrativa", "Demo · illustrative connection", "Demo · conexão ilustrativa"],
  ]) {
    assert.equal(translateSunUiText(source, "en"), english);
    assert.equal(translateSunUiText(english, "pt-BR"), portuguese);
    assert.equal(translateSunUiText(portuguese, "es-AR"), source);
  }
  const attribution = "Esri World Street Map / OpenStreetMap contributors";
  assert.equal(translateSunUiText(attribution, "en"), attribution);
  assert.equal(translateSunUiText(attribution, "pt-BR"), attribution);
});
