import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../src/app/normas/page.tsx", import.meta.url), "utf8");

test("standards page never claims a certification nexID does not hold", () => {
  assert.doesNotMatch(page, /estamos certificados|certificados por|somos certificados|we are certified|certified by|estamos certificados/i);
  assert.match(page, /Todavía no contamos con la certificación emitida/);
  assert.match(page, /We do not hold the certification yet/);
  assert.match(page, /no reemplaza ese proceso/);
});

test("every standard has a status and copy in all three locales", () => {
  for (const key of ["nfc", "gs1", "espr", "wine", "fmd", "anmat", "privacy", "iso27001"]) {
    assert.match(page, new RegExp(`\\{ key: "${key}", status: "(now|design|ready|complements|project|roadmap)"`));
    assert.equal((page.match(new RegExp(`\\n      ${key}: \\{ name:`, "g")) ?? []).length, 3, key);
  }
});

test("official sources open safely in a new tab", () => {
  assert.match(page, /target="_blank" rel="noreferrer noopener"/);
  const urls = page.match(/icon: \w+, source: "([^"]+)"/g) ?? [];
  assert.ok(urls.length >= 5);
  for (const url of urls) assert.match(url, /source: "https:\/\//);
});

test("the wine e-label is kept apart from tracking and marketing", () => {
  assert.match(page, /no puede tener marketing ni rastrear al usuario/);
});
