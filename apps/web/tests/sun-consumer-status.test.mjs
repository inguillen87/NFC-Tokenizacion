import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { resolveSunConsumerStatus } from "../src/app/sun/sun-consumer-status.ts";

const base = {
  isDemoPreview: false,
  isQrScan: false,
  isTechnicallyAuthentic: true,
  isVerifiedClosedState: false,
  isVerifiedOpenedState: false,
  isInvalidSealState: false,
  isTamperRisk: false,
  isReplay: false,
  isSunProfileMismatch: false,
  isSnapshotView: false,
};

test("a verified closed tag is green and never becomes a security alert", () => {
  const status = resolveSunConsumerStatus({ ...base, isVerifiedClosedState: true });
  assert.equal(status.tone, "closed");
  assert.equal(status.headline, "El tag informa: sello cerrado");
  assert.equal(status.identityLabel, "Verificada");
  assert.doesNotMatch(`${status.label} ${status.headline} ${status.copy}`, /alerta de seguridad|no pudimos validar/i);
});

test("a verified opened tag is amber and gives a useful consumer action", () => {
  const status = resolveSunConsumerStatus({ ...base, isVerifiedOpenedState: true });
  assert.equal(status.tone, "opened");
  assert.equal(status.headline, "El tag informa: sello abierto");
  assert.match(status.copy, /Si vos no lo abriste|avisá a la marca/);
});

test("red is reserved for replay, profile mismatch, invalid TT or failed identity validation", () => {
  assert.equal(resolveSunConsumerStatus({ ...base, isReplay: true }).tone, "risk");
  assert.equal(resolveSunConsumerStatus({ ...base, isSunProfileMismatch: true }).tone, "risk");
  assert.equal(resolveSunConsumerStatus({ ...base, isTechnicallyAuthentic: false }).tone, "risk");
  assert.equal(resolveSunConsumerStatus(base).tone, "verified");
});

test("an explicit invalid TT state is a clear risk without hiding a verified identity", () => {
  const status = resolveSunConsumerStatus({ ...base, isInvalidSealState: true });
  assert.equal(status.tone, "risk");
  assert.equal(status.identityLabel, "Verificada");
  assert.equal(status.sealLabel, "No válido");
  assert.match(status.copy, /Repetí el tap|avisá a la marca/);
});

test("a tamper risk remains separate from an otherwise verified digital identity", () => {
  const status = resolveSunConsumerStatus({ ...base, isTamperRisk: true });
  assert.equal(status.tone, "risk");
  assert.equal(status.identityLabel, "Verificada");
  assert.equal(status.sealLabel, "Por revisar");
  assert.match(status.copy, /identidad digital pasó los controles/);
});

test("a historical snapshot uses past-tense copy and never claims current seal state", () => {
  const status = resolveSunConsumerStatus({ ...base, isVerifiedClosedState: true, isSnapshotView: true });
  assert.equal(status.headline, "En esa lectura, el tag informó: sello cerrado");
  assert.match(status.copy, /registro histórico|No describe necesariamente el estado actual/);
});

test("conflicting seal sources fail visibly into review instead of choosing a state", () => {
  const status = resolveSunConsumerStatus({ ...base, isVerifiedClosedState: true, isVerifiedOpenedState: true });
  assert.equal(status.tone, "review");
  assert.equal(status.sealLabel, "Inconsistente");
});

test("the page accepts authentic VALID_CLOSED-style states without requiring generic VALID status", async () => {
  const page = await readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const isVerifiedClosedState = isTechnicallyAuthentic[\s\S]*?statusCode === "VALID_CLOSED"[\s\S]*?productState === "VALID_CLOSED"/);
  assert.match(page, /\["VALID_OPENED", "VALID_OPENED_PREVIOUSLY", "VALID_MANUAL_OPENED"\]\.includes\(statusCode\)/);
  assert.match(page, /const isValid = isTechnicallyAuthentic && !isVerifiedOpenedState/);
  assert.doesNotMatch(page, /const isValid =[^;]*\["VALID", "AUTH_OK"\]\.includes\(statusCode\)/);
  assert.match(page, /resolveSunConsumerStatus\(\{/);
});
