import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeSafeReturnPath } from "../../../packages/config/src/safe-return-path.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("return paths accept local destinations and reject browser-normalized external forms", () => {
  assert.equal(normalizeSafeReturnPath("/me/passport?bid=RA-2407#history", "/me"), "/me/passport?bid=RA-2407#history");
  assert.equal(normalizeSafeReturnPath("/me/passport/../wallet?tab=claims", "/me"), "/me/wallet?tab=claims");

  for (const unsafe of [
    "https://evil.example/steal",
    "//evil.example/steal",
    "\\\\evil.example\\steal",
    "/\\evil.example/steal",
    "%2F%2Fevil.example/steal",
    "%252F%252Fevil.example/steal",
    "/%5C%5Cevil.example/steal",
    "/%2e%2e//evil.example/steal",
    "/safe/%2e%2e//evil.example/steal",
    "https%3A%2F%2Fevil.example%2Fsteal",
    "javascript%3Aalert(1)",
    "/%00evil",
    "/%E0%A4%A",
  ]) {
    assert.equal(normalizeSafeReturnPath(unsafe, "/me"), "/me", unsafe);
  }
});

test("repeated magic-link parameters still select consumer authentication", async () => {
  const page = await read("../src/app/login/page.tsx");

  assert.match(page, /const hasMagicToken = Boolean\(firstParam\(params\.t\) \|\| firstParam\(params\.token\)\)/);
  assert.doesNotMatch(page, /typeof params\.(?:t|token) === "string"/);

  const firstParam = (value) => Array.isArray(value) ? value[0] : value;
  assert.equal(Boolean(firstParam(["valid-magic-token", "duplicate"]) || firstParam(undefined)), true);
  assert.equal(Boolean(firstParam(undefined) || firstParam(["valid-token", "duplicate"])), true);
});

test("consumer login sanitizes on the server and again before client navigation", async () => {
  const [page, panel, helpbot] = await Promise.all([
    read("../src/app/login/page.tsx"),
    read("../src/app/login/consumer-login-panel.tsx"),
    read("../src/components/contextual-helpbot.tsx"),
  ]);

  assert.match(page, /normalizeSafeReturnPath\(requestedNext, "\/me"\)/);
  assert.match(panel, /normalizeSafeReturnPath\(nextPath, "\/me"\)/);
  assert.match(panel, /window\.location\.assign\(safeNextPath\)/);
  assert.doesNotMatch(panel, /window\.location\.href = nextPath/);
  assert.match(helpbot, /pathname\.startsWith\("\/login"\)/);
});

test("web login separates enterprise and consumer access without fake credential controls", async () => {
  const [page, panel, styles] = await Promise.all([
    read("../src/app/login/page.tsx"),
    read("../src/app/login/consumer-login-panel.tsx"),
    read("../src/app/globals.css"),
  ]);

  assert.match(page, /¿Dónde querés entrar\?/);
  assert.match(page, /Centro de control/);
  assert.match(page, /Mi Pasaporte nexID/);
  assert.match(page, /isConsumerAccess \? \(/);
  assert.match(page, /<ConsumerLoginPanel nextPath=\{nextPath\} \/>/);
  assert.match(page, /<ThemeToggle initialTheme=\{initialTheme\}/);
  assert.doesNotMatch(page, /<input/);
  assert.doesNotMatch(page, /passwordPlaceholder/);
  assert.match(panel, /consumer-login-panel/);
  assert.match(styles, /html\.theme-light \.consumer-login-panel \.text-cyan-50\\\/90/);
  assert.match(styles, /color: #334155 !important/);
});
