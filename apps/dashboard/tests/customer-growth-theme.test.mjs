import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { classifyLocationProvenance } from "../src/lib/location-provenance.ts";
import { strictCoordinatePair } from "../src/lib/geo-coordinates.ts";

const source = await readFile(new URL("../src/components/customer-growth-command-center.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../src/components/customer-growth-command-center.module.css", import.meta.url), "utf8");

function palette(block) {
  return Object.fromEntries([...block.matchAll(/--growth-([\w-]+):\s*(#[\da-f]{6});/gi)].map(([, name, value]) => [name, value]));
}

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map((channel) => parseInt(channel, 16) / 255);
  const [red, green, blue] = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("activity and campaigns owns complete light and dark palettes without legacy color utilities", () => {
  assert.match(source, /import styles from "\.\/customer-growth-command-center\.module\.css"/);
  assert.match(source, /<section className=\{styles\.root\} aria-labelledby="growth-title"/);
  assert.doesNotMatch(source, /<Card|<Badge|<StatusChip|bg-\[|bg-(?:slate|cyan|emerald|violet|amber|rose|white)-?|text-(?:white|slate|cyan|emerald|violet|amber|rose)-?/);
  assert.match(css, /:global\(html:is\(\.theme-light, \[data-theme="light"\]\)\) \.root/);
  assert.match(css, /\.header\s*\{[^}]*background: var\(--growth-header\)/);
  assert.doesNotMatch(css, /!important|linear-gradient|radial-gradient/);
});

test("local palette text and focus contrast stay readable on all declared surfaces", () => {
  const darkBlock = css.match(/\.root\s*\{([^}]+)\}/)?.[1];
  const lightBlock = css.match(/:global\(html:is\([\s\S]*?\)\) \.root\s*\{([^}]+)\}/)?.[1];
  assert.ok(darkBlock && lightBlock);
  const dark = palette(darkBlock);
  const light = palette(lightBlock);
  assert.deepEqual(Object.keys(light).sort(), Object.keys(dark).sort());

  for (const [theme, colors] of Object.entries({ dark, light })) {
    for (const surface of ["surface", "header", "card", "soft-surface", "hover"]) {
      for (const text of ["text", "muted", "accent", "success", "warning", "risk"]) {
        const ratio = contrast(colors[text], colors[surface]);
        assert.ok(ratio >= 4.5, `${theme} ${text} on ${surface}: ${ratio.toFixed(2)}:1`);
      }
      assert.ok(contrast(colors.focus, colors[surface]) >= 3, `${theme} focus on ${surface}`);
    }
  }
});

test("navigation labels describe existing destinations without claiming activation or sending", () => {
  assert.match(source, /Taps, actividad y consentimiento/);
  assert.match(source, /No activan campañas ni envían mensajes/);
  assert.match(source, /action: "Abrir campañas",\s*href: "\/loyalty\/campaigns"/);
  assert.match(source, /href: "\/events",\s*action: "Revisar eventos"/);
  assert.doesNotMatch(source, /Activar play|Modo enterprise|Verticalizable|Convertir actividad trazable|\?template=|\?view=channel-risk|voucher_cercania|portal_whatsapp|gps_opt_in/);
  const destinations = [...source.matchAll(/href(?:=|:)\s*"([^"]+)"/g)].map(([, href]) => href);
  assert.ok(destinations.length >= 5);
  assert.ok(destinations.every((href) => ["/loyalty/campaigns", "/events", "/leads-tickets", "/loyalty/rewards"].includes(href)));
});

test("local controls remain touch-safe and preserve the existing read-only data and export flow", () => {
  assert.match(css, /\.action\s*\{[^}]*min-width: 2\.75rem;[^}]*min-height: 2\.75rem/);
  assert.match(css, /\.root :is\(a, button\):focus-visible\s*\{[^}]*outline: 3px solid var\(--growth-focus\)/);
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(source, /role="status"/);
  assert.equal([...source.matchAll(/onClick=/g)].length, 1);
  assert.match(source, /onClick=\{exportSegments\}/);
  assert.match(source, /const insights = useMemo\(/);
  assert.match(source, /event\.authenticationVerified === true/);
  assert.match(source, /event\.knownActor === true && event\.commercialConsentGranted === true/);
  assert.match(source, /El archivo no contiene contactos, audiencia ni destinatarios/);
  assert.doesNotMatch(source, /fetch\(|new EventSource|setInterval|useEffect|\/api\//);
});

test("missing phone location is not presented as missing network coordinates", () => {
  // Local unit-test coordinates: both sources have a usable point, but only
  // the browser source belongs in the existing consented-phone metric.
  const network = { locationSource: "ip_geo", lat: -34.6, lng: -58.4 };
  const browser = { locationSource: "browser_approximate_consent", lat: -34.6, lng: -58.4 };
  assert.ok(strictCoordinatePair(network.lat, network.lng));
  assert.ok(strictCoordinatePair(browser.lat, browser.lng));
  assert.equal(classifyLocationProvenance(network.locationSource), "network_approx");
  assert.equal(classifyLocationProvenance(browser.locationSource), "consented_gps");
  assert.match(source, /const gpsEvents = events\.filter\(\(event\) => classifyLocationProvenance\(event\.locationSource\) === "consented_gps"/);
  assert.match(source, /missingGps: Math\.max\(events\.length - gpsEvents\.length, 0\)/);
  assert.match(source, /title: "Sin ubicación del teléfono",\s*activity: insights\.missingGps/);
  assert.match(source, /pueden conservar una estimación de red\. Compartirla es opcional/);
  assert.match(source, /title: "Sin ubicación del teléfono",[\s\S]*?action: "Revisar eventos",\s*href: "\/events"/);
  assert.doesNotMatch(source, /Ubicación incompleta|Interacciones sin coordenada utilizable/);
});
