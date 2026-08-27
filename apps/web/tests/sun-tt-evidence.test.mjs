import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { resolveSunTtEvidence } from "../src/app/sun/sun-tt-evidence.ts";

const sunPage = await readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8");
const ttSource = await readFile(new URL("../src/app/sun/sun-tt-evidence.ts", import.meta.url), "utf8");

test("TT 4343 is decoded byte by byte as closed without claiming physical authenticity", () => {
  const evidence = resolveSunTtEvidence({ raw: "4343", source: "enc_decrypted", offset: 0, length: 2, interpretedStatus: "CLOSED" });

  assert.equal(evidence.state, "closed");
  assert.equal(evidence.requiresReview, false);
  assert.equal(evidence.reportedConsistent, true);
  assert.deepEqual(evidence.bytes.map(({ hex, state }) => ({ hex, state })), [
    { hex: "43", state: "closed" },
    { hex: "43", state: "closed" },
  ]);
  assert.equal(evidence.source, "enc_decrypted");
  assert.equal(evidence.offset, 0);
  assert.equal(evidence.length, 2);
});

test("TT open and previously-opened patterns keep their two independent byte meanings", () => {
  const opened = resolveSunTtEvidence({ raw: "4f4f", interpretedStatus: "OPENED" });
  const openedPreviously = resolveSunTtEvidence({ raw: "4F43", interpretedStatus: "OPENED_PREVIOUSLY" });

  assert.equal(opened.state, "opened");
  assert.deepEqual(opened.bytes.map((byte) => byte.state), ["opened", "opened"]);
  assert.equal(openedPreviously.state, "opened_previously");
  assert.deepEqual(openedPreviously.bytes.map((byte) => byte.state), ["opened", "closed"]);
});

test("TT invalid, contradictory and incomplete values fail closed in the technical interpretation", () => {
  const invalid = resolveSunTtEvidence({ raw: "4949", interpretedStatus: "INVALID" });
  const contradictory = resolveSunTtEvidence({ raw: "434F" });
  const serviceMismatch = resolveSunTtEvidence({ raw: "4343", interpretedStatus: "OPENED" });
  const incomplete = resolveSunTtEvidence({ raw: "43" });

  assert.equal(invalid.state, "invalid");
  assert.equal(invalid.requiresReview, true);
  assert.equal(contradictory.state, "contradictory");
  assert.equal(contradictory.requiresReview, true);
  assert.equal(serviceMismatch.state, "contradictory");
  assert.equal(serviceMismatch.reportedConsistent, false);
  assert.equal(incomplete.state, "unavailable");
  assert.equal(incomplete.available, false);
  assert.equal(incomplete.offset, null);
});

test("SUN technical accordion exposes two TT bytes and the physical-evidence boundary", () => {
  assert.match(sunPage, /Detalle técnico TagTamper byte por byte/);
  assert.match(sunPage, /Byte \{byte\.index\}/);
  assert.match(ttSource, /Memoria permanente/);
  assert.match(sunPage, /Este detalle describe la señal electrónica TT reportada por la etiqueta/);
  assert.match(sunPage, /Por sí solo no prueba el contenido, la custodia ni la integridad física del producto/);
});

test("opening the SUN demo without NFC query or snapshot never calls the physical SUN endpoint", () => {
  assert.match(sunPage, /const isDemoPreview = !isQrScan && query\.toString\(\)\.length === 0 && !snapshotId/);
  const demoBranchStart = sunPage.indexOf("} else if (isDemoPreview) {");
  const apiBranchStart = sunPage.indexOf("} else {", demoBranchStart + 1);
  const demoBranch = sunPage.slice(demoBranchStart, apiBranchStart);

  assert.ok(demoBranchStart > 0 && apiBranchStart > demoBranchStart);
  assert.match(demoBranch, /result = sunFallbackResult\(params, true\)/);
  assert.doesNotMatch(demoBranch, /fetch\(/);
});
