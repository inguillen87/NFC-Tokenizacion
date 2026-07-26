import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../src/app/api/cognitive-ai/route.ts", import.meta.url), "utf8");

test("dashboard AI spend is session, origin, size and rate bounded", () => {
  assert.match(route, /getDashboardSession/);
  assert.match(route, /sameOrigin\(req\)/);
  assert.match(route, /MAX_BODY_BYTES/);
  assert.match(route, /MAX_TEXT_CHARS/);
  assert.match(route, /consumeRateLimit\(session\.id\)/);
  assert.match(route, /session\.isDemo/);
});

test("dashboard AI never accepts a browser supplied provider token or arbitrary model", () => {
  assert.doesNotMatch(route, /customToken|reqModel|parsed\.body\.model/);
  assert.match(route, /const model = process\.env\.HF_CHAT_MODEL \|\| DEFAULT_CHAT_MODEL/);
  assert.match(route, /ALLOWED_TONES/);
});
