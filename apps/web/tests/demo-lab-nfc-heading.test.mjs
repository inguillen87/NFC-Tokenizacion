import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("nfc-424 deep link resolves an NFC contextual heading instead of the QR fallback", async () => {
  const page = await readFile(new URL("../src/app/(public)/demo-lab/page.tsx", import.meta.url), "utf8");
  const panelStart = page.indexOf("const PANEL_CONTENT");
  const panelEnd = page.indexOf("const HUB_SCENARIOS");

  assert.ok(panelStart >= 0, "PANEL_CONTENT must exist");
  assert.ok(panelEnd > panelStart, "PANEL_CONTENT must end before HUB_SCENARIOS");

  const panelContent = page.slice(panelStart, panelEnd);
  const nfcEntry = panelContent.match(/"nfc-424":\s*\{([\s\S]*?)\n\s*\},/);

  assert.ok(nfcEntry, "PANEL_CONTENT must define the nfc-424 deep-link panel");
  assert.match(nfcEntry[1], /title:\s*"NFC 424 DNA — Toque criptográfico"/);
  assert.match(nfcEntry[1], /subtitle:\s*"SUN dinámico \+ UID \+ control anti-replay"/);
  assert.doesNotMatch(nfcEntry[1], /QR\s*\/\s*GS1/);
  assert.match(page, /const panelKey = initialScenario \?\? initialVertical \?\? "qr-gs1";[\s\S]*const panel = PANEL_CONTENT\[panelKey\]/);
});
