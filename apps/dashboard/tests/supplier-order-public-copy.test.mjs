import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("supplier order UI uses generic enterprise examples instead of unverified company names", async () => {
  const source = await readFile(new URL("../src/components/supplier-order-console.tsx", import.meta.url), "utf8");

  assert.match(source, /placeholder="bodega-balmec o agro-enterprise-ar"/);
  assert.doesNotMatch(source, /placeholder="[^"]*syngenta/i);
  assert.doesNotMatch(source, /placeholder="[^"]*bayer/i);
});

test("supplier QA UI submits server-verifiable SUN receipts instead of self-attested checks", async () => {
  const source = await readFile(new URL("../src/components/supplier-order-console.tsx", import.meta.url), "utf8");

  assert.match(source, /snapshot_urls:\s*passed \? qaUrls : \[\]/);
  assert.match(source, /snapshot=123&trace=nexid_/);
  assert.match(source, /no prueba por sí sola el contacto NFC presencial/);
  assert.doesNotMatch(source, /replay_checked:/);
  assert.doesNotMatch(source, /ttstatus_checked:/);
  assert.doesNotMatch(source, /qaReplayChecked|qaTtstatusChecked|qaSampleCount/);
  assert.doesNotMatch(source, />Replay verificado<|>TTStatus validado</);
  assert.doesNotMatch(source, /recibos SUN fisicos/i);
  assert.match(source, /url\.protocol !== "https:"/);
  assert.match(source, /const seen = new Set<string>\(\)/);
  assert.match(source, /qaUrls\.length > 60/);
});
