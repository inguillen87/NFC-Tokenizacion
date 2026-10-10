import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  classifySommelierResponse,
  safeSommelierGuidance,
  sommelierProvenanceLabel,
} from "../src/lib/sommelier-guidance.ts";

const apiSource = await readFile(new URL("../src/app/api/cognitive-ai/route.ts", import.meta.url), "utf8");
const consumerSource = await readFile(new URL("../src/app/me/sommelier/sommelier-client.tsx", import.meta.url), "utf8");
const qrSource = await readFile(new URL("../src/app/sun/qr-engagement-suite.tsx", import.meta.url), "utf8");

test("sommelier live provenance requires a confirmed non-fallback provider response", () => {
  assert.equal(classifySommelierResponse({ fallback: false, provider: "huggingface-router", model: "model-a" }).mode, "live");
  assert.equal(classifySommelierResponse({ fallback: true, provider: "huggingface-router", model: "model-a" }).mode, "server-fallback");
  assert.equal(classifySommelierResponse({ fallback: false, provider: "huggingface-router" }).mode, "server-fallback");
  assert.match(sommelierProvenanceLabel({ mode: "server-fallback" }), /Fallback del servidor/);
  assert.match(sommelierProvenanceLabel({ mode: "local-fallback" }), /Fallback local/);
});

test("sommelier fallback refuses to invent product-specific technical or award facts", () => {
  const awards = safeSommelierGuidance("¿Qué premios y puntos tiene?", { productName: "Reserva X" });
  const tasting = safeSommelierGuidance("¿Qué notas de cata y crianza tiene?", { productName: "Reserva X" });
  const temperature = safeSommelierGuidance("¿A qué temperatura lo sirvo?", { productName: "Reserva X" });

  assert.match(awards, /No tengo premios ni puntajes verificados/);
  assert.match(tasting, /No puedo inferir notas de cata/);
  assert.match(temperature, /Sin ficha técnica validada/);
  assert.doesNotMatch([awards, tasting, temperature].join(" "), /95 puntos|James Suckling|Decanter|roble francés|16 °C|18 °C/i);
});

test("consumer and post-tap sommelier surfaces disclose provenance and remove fabricated claims", () => {
  for (const source of [consumerSource, qrSource]) {
    assert.match(source, /classifySommelierResponse\(data\)/);
    assert.match(source, /sommelierProvenanceLabel\(msg\.provenance(?:, locale)?\)/);
    assert.doesNotMatch(source, /95 puntos|James Suckling|medalla de oro Decanter|5 a 8 años|16 ?°?C y 18 ?°?C/i);
  }
  assert.match(consumerSource, /safeSommelierGuidance\(textToSend/);
  assert.doesNotMatch(qrSource, /safeSommelierGuidance|qr_sommelier/);
  assert.match(qrSource, /postTapEventId: eventId/);
  assert.match(qrSource, /setChatError\(TENANT_ACTION_COPY\[locale\]\.unavailable\)/);
  assert.match(apiSource, /unverified_product_claim_blocked/);
  assert.doesNotMatch(apiSource, /Menciona que este Gran Reserva|prestigiosa bodega de Mendoza|95 puntos James Suckling/);
});

test("SUN response provenance follows the selected language without claiming verification", () => {
  assert.equal(sommelierProvenanceLabel({ mode: "local-fallback" }, "en"), "Local guide · general advice, not a technical sheet");
  assert.equal(sommelierProvenanceLabel({ mode: "server-fallback" }, "pt-BR"), "Guia do servidor · orientação geral, não é ficha técnica");
  assert.match(sommelierProvenanceLabel({ mode: "context" }, "en"), /product not verified/);
  assert.match(sommelierProvenanceLabel({ mode: "live", provider: "huggingface", model: "fixed-model" }, "pt-BR"), /Provedor confirmado.*não é ficha técnica/);
  assert.match(qrSource, /sommelierProvenanceLabel\(msg\.provenance, locale\)/);
});

test("sommelier product context never becomes SUN, seal or bottle verification", () => {
  assert.match(consumerSource, /Producto de tu cuenta/);
  assert.match(consumerSource, /Orientación general/);
  assert.match(consumerSource, /Una respuesta no verifica el contenido, el sello ni la autenticidad física del producto/i);
  assert.match(consumerSource, /requestManagedSommelierAnswer/);
  assert.doesNotMatch(consumerSource, /requestSommelierAnswer|productContext:/);
  assert.doesNotMatch(consumerSource, /Botella Verificada|Sello Original Cerrado/);
  assert.doesNotMatch(consumerSource, /Ã|Â|�/);
});

test("generic cognitive fallbacks never invent wine facts or a verified phygital product", () => {
  assert.match(apiSource, /origen, crianza, terroir, notas y premios requieren una ficha verificada/);
  assert.match(apiSource, /no implica autenticidad física ni ownership/);
  assert.doesNotMatch(apiSource, /botella verificada|con foco en origen, crianza, expresion del terroir/i);
});
