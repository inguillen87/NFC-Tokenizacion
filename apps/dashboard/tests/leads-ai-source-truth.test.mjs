import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile(new URL("../src/app/(app)/leads-tickets/leads-tickets-client.tsx", import.meta.url), "utf8");

test("CRM assistant rows never invent an answer or responded state", () => {
  assert.match(client, /recordedAnswer \|\| "Sin respuesta registrada por la fuente\."/);
  assert.match(client, /l\.status \|\| \(recordedAnswer \? "RESPUESTA REGISTRADA" : "SIN RESPUESTA REGISTRADA"\)/);
  assert.doesNotMatch(client, /Respuesta automática procesada por nexID AI/);
  assert.doesNotMatch(client, /status: "RESPONDIDO",\s*source: leadsSource/);
});
