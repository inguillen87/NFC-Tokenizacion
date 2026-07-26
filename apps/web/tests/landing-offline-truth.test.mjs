import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/components/landing-sections.tsx", import.meta.url), "utf8");

test("offline field UI keeps Spanish and Portuguese verdicts provisional", () => {
  assert.match(source, /phoneStatus: "PASE LOCAL PROVISIONAL"/);
  assert.match(source, /phoneStatus: "PASSE LOCAL PROVISÓRIO"/);
  assert.match(source, /phoneStatus: "OFFLINE_LOCAL_PASS"/);
  assert.doesNotMatch(source, /phoneStatus: "VERIFICADO SIN (?:RED|SEÑAL)"/);
  assert.doesNotMatch(source, /phoneStatus: "VERIFICADO SEM SINAL"/);
  assert.doesNotMatch(source, /Ã|Â|�/);
});
