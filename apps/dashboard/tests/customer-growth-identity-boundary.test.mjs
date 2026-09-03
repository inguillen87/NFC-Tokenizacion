import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/components/customer-growth-command-center.tsx", import.meta.url), "utf8");

test("customer growth treats UID, location and events as activity rather than people", () => {
  assert.match(source, /event\.productIdentityRecognized === true/);
  assert.match(source, /Un UID identifica producto; nunca una persona/);
  assert.match(source, /no es una audiencia ni una lista de contactos/);
  assert.match(source, /no es un conteo de personas/);
  assert.match(source, /Indicadores independientes/);
  assert.doesNotMatch(source, /const funnel =/);
  assert.doesNotMatch(source, /Audiencia visible|UIDs con eventos reportados|Usuarios a quienes|\} perfiles|segment\.audience/);
});

test("customer growth reserves actionable audience for active membership and exact consent", () => {
  assert.match(source, /actor conocido, membresía activa y consentimiento vigente para el canal/);
  assert.match(source, /audiencia real debe resolverse en servidor por actor pseudónimo, tenant, scope, consentimiento vigente/);
  assert.match(source, /la audiencia se resuelve aparte/);
  assert.match(source, /El archivo no contiene contactos, audiencia ni destinatarios/);
});
