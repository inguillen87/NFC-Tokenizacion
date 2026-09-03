import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { translateSunUiText } from "../src/app/sun/sun-locale.ts";
import { resolveSunConsumerStatus } from "../src/app/sun/sun-consumer-status.ts";
import { resolveSunTtEvidence } from "../src/app/sun/sun-tt-evidence.ts";

const urls = {
  locale: new URL("../src/lib/locale.ts", import.meta.url),
  provider: new URL("../src/app/sun/sun-locale-provider.tsx", import.meta.url),
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

test("SUN selector changes presentation in place and cannot revalidate or reload the tap", async () => {
  const [provider, page] = await Promise.all([
    readFile(urls.provider, "utf8"),
    readFile(urls.page, "utf8"),
  ]);

  assert.match(provider, /document\.cookie = `\$\{SUN_LOCALE_COOKIE\}=/);
  assert.match(provider, /document\.documentElement\.lang = toDocumentLanguage\(nextLocale\)/);
  assert.match(provider, /url\.searchParams\.set\("lang", nextLocale\)/);
  assert.match(provider, /window\.history\.replaceState\(/);
  assert.doesNotMatch(provider, /useRouter|router\.(push|replace|refresh)|window\.location\.(assign|replace)|location\.reload/);
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
