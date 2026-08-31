import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  carrierSupportsTagTamper,
  resolveAuthenticatedCarrierState,
  resolveSunSecureCarrierProfile,
  resolveTagTamperPresentationEvidence,
} from "../src/lib/sun-carrier-trust-state.ts";

const service = await readFile(new URL("../src/lib/sun-service.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");
const webPassport = await readFile(new URL("../../web/src/app/sun/page.tsx", import.meta.url), "utf8");
const migration = await readFile(
  new URL("../db/migrations/20260802240000_0089_sun_carrier_trust_state.sql", import.meta.url),
  "utf8",
);

test("424 DNA without TT is authentic but never gains an opening state", () => {
  assert.equal(carrierSupportsTagTamper("ntag424_dna"), false);
  assert.equal(resolveAuthenticatedCarrierState({
    carrierProfileCode: "ntag424_dna",
    cryptographicVerification: true,
    ttProductState: "VALID_CLOSED",
  }), "VALID_AUTHENTIC");
});

test("TagTamper accepts only the explicit profile and complete decoded TT states", () => {
  assert.equal(carrierSupportsTagTamper("ntag424_dna_tt"), true);
  for (const expected of ["VALID_CLOSED", "VALID_OPENED", "VALID_OPENED_PREVIOUSLY"]) {
    assert.equal(resolveAuthenticatedCarrierState({
      carrierProfileCode: "ntag424_dna_tt",
      cryptographicVerification: true,
      ttProductState: expected,
    }), expected);
  }
  assert.equal(resolveAuthenticatedCarrierState({
    carrierProfileCode: "ntag424_dna_tt",
    cryptographicVerification: true,
  }), "VALID_UNKNOWN_TAMPER");
});

test("consumer TT presentation requires the exact carrier and complete two-byte evidence", () => {
  assert.deepEqual(resolveTagTamperPresentationEvidence({
    carrierProfileCode: "ntag424_dna_tt",
    ttRaw: "4343",
  }), { raw: "4343", state: "VALID_CLOSED" });
  assert.deepEqual(resolveTagTamperPresentationEvidence({
    carrierProfileCode: "ntag424_dna_tt",
    ttRaw: "4f4f",
  }), { raw: "4F4F", state: "VALID_OPENED" });
  assert.deepEqual(resolveTagTamperPresentationEvidence({
    carrierProfileCode: "ntag424_dna_tt",
    ttRaw: "4F43",
  }), { raw: "4F43", state: "VALID_OPENED_PREVIOUSLY" });
  assert.deepEqual(resolveTagTamperPresentationEvidence({
    carrierProfileCode: "ntag424_dna",
    ttRaw: "4F4F",
  }), { raw: null, state: null });
  assert.deepEqual(resolveTagTamperPresentationEvidence({
    carrierProfileCode: "ntag424_dna_tt",
    ttRaw: "4F",
  }), { raw: null, state: null });
  assert.deepEqual(resolveTagTamperPresentationEvidence({
    carrierProfileCode: "ntag424_dna_tt",
    ttRaw: "4949",
  }), { raw: "4949", state: null });
  assert.deepEqual(resolveTagTamperPresentationEvidence({
    carrierProfileCode: "ntag424_dna_tt",
    ttRaw: "434F",
  }), { raw: "434F", state: null });
});

test("public SUN presentation fails closed for invalid or contradictory full TT bytes", () => {
  const presentationStart = route.indexOf("function resolveTrustState");
  const presentationEnd = route.indexOf("function summarizeUserAgent", presentationStart);
  const presentationDecision = route.slice(presentationStart, presentationEnd);

  assert.match(presentationDecision, /if \(ttEvidence\.raw && !ttEvidence\.state\)/);
  assert.match(presentationDecision, /code: "TAMPER_RISK"/);
  assert.match(presentationDecision, /los dos bytes TT no forman un estado válido y coherente/);
  assert.match(route, /function buildPublicSunTechnicalEvidence/);
  assert.match(route, /technical: publicTechnicalEvidence/);
  assert.match(route, /cryptographicVerification: resultMeta\.cryptographic_verification === true/);
  assert.match(route, /permanentHex: permanentHex\?\.toUpperCase\(\) \|\| null/);
  assert.match(route, /currentHex: currentHex\?\.toUpperCase\(\) \|\| null/);
  assert.match(webPassport, /ttEvidence\.bytes\.length === 2/);
  assert.match(webPassport, /Byte \{byte\.index\}/);
  assert.match(webPassport, /0x\{byte\.hex\}/);
  assert.match(webPassport, /Por sí solo no prueba el contenido, la custodia ni la integridad física del producto/);
});

test("legacy carrier inference never treats the substring 424 alone as TagTamper", () => {
  assert.equal(resolveSunSecureCarrierProfile({ sdmConfig: { chip_model: "NTAG424_DNA" } }), "ntag424_dna");
  assert.equal(resolveSunSecureCarrierProfile({ sdmConfig: { chip_model: "NTAG424_DNA_TT" } }), "ntag424_dna_tt");
  assert.equal(resolveSunSecureCarrierProfile({ carrierProfileCode: "uhf_rfid" }), null);
  assert.equal(resolveAuthenticatedCarrierState({
    carrierProfileCode: null,
    cryptographicVerification: true,
  }), "SUN_PROFILE_MISMATCH");
});

test("persistent decision order is payload, crypto, manifest, activity, replay, carrier state", () => {
  const blockStart = migration.indexOf("v_auth_status := CASE");
  const blockEnd = migration.indexOf("END;", blockStart);
  const block = migration.slice(blockStart, blockEnd);
  const payload = block.indexOf("WHEN NOT v_payload_verified");
  const crypto = block.indexOf("WHEN NOT v_crypto_verified");
  const manifest = block.indexOf("WHEN NOT v_allowlisted");
  const active = block.indexOf("WHEN v_tag_status IS DISTINCT FROM 'active'");
  const replay = block.indexOf("WHEN v_replay_suspect");
  const carrier = block.indexOf("WHEN v_pre_registry_result IS NOT NULL");
  assert.ok(payload >= 0 && crypto > payload && manifest > crypto && active > manifest && replay > active && carrier > replay);
  const responseStart = migration.indexOf("v_response_result := CASE");
  const responseEnd = migration.indexOf("END;", responseStart);
  const responseBlock = migration.slice(responseStart, responseEnd);
  assert.match(responseBlock, /WHEN v_supplier_payload_only[\s\S]*OR NOT v_payload_verified[\s\S]*OR NOT v_crypto_verified[\s\S]*OR NOT v_allowlisted[\s\S]*v_tag_status IS DISTINCT FROM 'active'[\s\S]*THEN v_auth_status/);
  assert.ok(responseBlock.indexOf("WHEN v_supplier_payload_only") < responseBlock.indexOf("p_input->>'force_result'"));
  assert.match(migration, /'VALID_AUTHENTIC'.*'VALID_CLOSED'/s);
  assert.match(migration, /WHEN 'VALID_AUTHENTIC' THEN 'valid'/);
  assert.match(migration, /v_carrier_profile_code = 'ntag424_dna' THEN 'VALID_AUTHENTIC'/);
  assert.match(migration, /v_carrier_profile_code = 'ntag424_dna_tt'[\s\S]*v_requested_product_state IN/);
  assert.doesNotMatch(migration, /v_pre_registry_result\s*:=\s*NULLIF\(UPPER\(BTRIM\(p_input->>'pre_registry_result'/);
});

test("public SUN boundary reports canonical malformed and carrier-specific states", () => {
  assert.match(route, /result: 'MALFORMED_URL'/);
  assert.match(route, /code: 'VALID_AUTHENTIC'/);
  assert.match(route, /Este producto no usa sello electrónico de apertura/);
  assert.match(service, /result: 'UNKNOWN_BATCH'/);
  assert.match(service, /product_state: 'INVALID'[\s\S]*reason: 'batch revoked'/);
});

test("public query tamper flags are not a trust source", () => {
  const resolverStart = service.indexOf("function resolveTamperSignal");
  const resolverEnd = service.indexOf("export async function processSunScan", resolverStart);
  const resolver = service.slice(resolverStart, resolverEnd);
  assert.match(resolver, /never establish a seal state/);
  assert.doesNotMatch(resolver, /query\.tamper|query\.opened|tt_status/);
  const productStart = service.indexOf("const productState: ProductState");
  const productEnd = service.indexOf("const resolvedTamperOpened", productStart);
  const productDecision = service.slice(productStart, productEnd);
  assert.doesNotMatch(productDecision, /encPlainStatusByte|tamperSignal/);
  const presentationStart = route.indexOf("function resolveTrustState");
  const presentationEnd = route.indexOf("function summarizeUserAgent", presentationStart);
  const presentationDecision = route.slice(presentationStart, presentationEnd);
  assert.match(presentationDecision, /resolveTagTamperPresentationEvidence/);
  assert.doesNotMatch(presentationDecision, /resultMeta\?\.tamper_opened|resultMeta\?\.tamperOpened/);
  assert.match(service, /carrier_profile_code: sunCarrierProfileCode/);
});
