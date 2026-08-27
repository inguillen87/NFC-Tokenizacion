import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/app/sun/cta-actions.tsx", import.meta.url), "utf8");

test("consumer session is checked only after the buyer starts a protected action", () => {
  const sessionCalls = source.match(/call\("\/api\/consumer\/session", "GET", null\)/g) || [];

  assert.equal(sessionCalls.length, 1);
  assert.match(source, /async function resolveConsumerSessionForClaim\(\)/);
  assert.match(source, /async function continuePrimaryClaimAction\(\)[\s\S]*resolveConsumerSessionForClaim\(\)/);
  assert.match(source, /if \(!isAuthenticated\) \{[\s\S]*void continuePrimaryClaimAction\(\)/);
  assert.doesNotMatch(source, /useEffect\(\(\) => \{[\s\S]{0,400}consumer\/session/);
});

test("the on-demand session check distinguishes anonymous visitors from real failures", () => {
  assert.match(source, /data\._httpStatus === 401 && data\.authenticated === false/);
  assert.match(source, /sessionState === "anonymous"[\s\S]*setClaimAuthOpen\(true\)/);
  assert.match(source, /if \(!data\._httpOk \|\| data\.ok === false\) \{[\s\S]*setActionError\(normalizeReason\(data\)\)/);
  assert.match(source, /catch \(error\) \{[\s\S]*setActionError\(message\)[\s\S]*setStatus\(/);
  assert.match(source, /consumerSessionLoading \? "Confirmando sesión\.\.\."/);
});
