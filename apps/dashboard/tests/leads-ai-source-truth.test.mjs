import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildAssistantLedger } from "../src/lib/assistant-records.ts";

const client = await readFile(new URL("../src/app/(app)/leads-tickets/leads-tickets-client.tsx", import.meta.url), "utf8");

test("CRM assistant rows never invent an answer or responded state", () => {
  const state = { availability: "ready", source: "production" };
  const rows = [{ id: "qa", tenant_slug: "qa-only", source: "assistant", notes: "assistant_mode=lead_capture", status: null }];
  const result = buildAssistantLedger(rows, state, { tenantScope: "qa-only", demoMode: false });
  assert.equal(result.rows[0].status, null);
  assert.equal(result.rows[0].notes, "assistant_mode=lead_capture");
  assert.equal(Object.hasOwn(result.rows[0], "answer"), false);
  assert.equal(Object.hasOwn(result.rows[0], "delivered"), false);
  assert.match(client, /buildAssistantLedger\(initialLeads, inboxes.leads, context\)/);
  assert.doesNotMatch(client, /recordedAnswer|RESPUESTA REGISTRADA|DEFAULT_AI_QUERIES|aiLiveCount/);
});
