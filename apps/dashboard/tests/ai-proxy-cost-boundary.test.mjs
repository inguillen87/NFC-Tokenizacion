import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const realtime = await readFile(new URL("../src/app/api/realtime/session/route.ts", import.meta.url), "utf8");
const assistant = await readFile(new URL("../src/app/api/assistant/chat/route.ts", import.meta.url), "utf8");

test("dashboard AI proxies require a real session, same origin, size and rate limits", () => {
  for (const source of [realtime, assistant]) {
    assert.match(source, /getDashboardSession/);
    assert.match(source, /sameOrigin\(req\)/);
    assert.match(source, /session\.isDemo/);
    assert.match(source, /consumeRateLimit\(session\.id\)/);
    assert.match(source, /payload_too_large/);
  }
  assert.match(realtime, /MAX_SDP_BYTES/);
  assert.match(assistant, /MAX_BODY_BYTES/);
});

test("realtime locale is allowlisted and assistant proxy rejects malformed JSON", () => {
  assert.match(realtime, /\["es-AR", "pt-BR", "en"\]\.includes/);
  assert.match(assistant, /JSON\.parse\(body\)/);
  assert.match(assistant, /invalid_json/);
});
