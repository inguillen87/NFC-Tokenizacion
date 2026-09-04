import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Upstash canary is opt-in, environment-isolated and cleans only exact ephemeral channels", async () => {
  const script = await readFile(new URL("../scripts/realtime-upstash-canary.mjs", import.meta.url), "utf8");
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.equal(
    packageJson.scripts["canary:realtime-upstash"],
    "node --import tsx scripts/realtime-upstash-canary.mjs",
  );
  assert.match(script, /process\.env\[CANARY_OPT_IN\] !== "1"/);
  assert.match(script, /realtime_upstash_canary_credentials_required/);
  assert.match(script, /nexid:rt:canary-\$\{runId\}:\$\{environment\}/);
  assert.match(script, /tenantA = `canary-a-\$\{runId\}`/);
  assert.match(script, /tenantB = `canary-b-\$\{runId\}`/);
  assert.match(script, /resolveUpstashRealtimeChannel\(\{ global: true \}, channelPrefix\)/);
  assert.match(script, /after: replayCursor/);
  assert.match(script, /deletedChannels = await redis\.del\(\.\.\.channels\)/);
  assert.doesNotMatch(script, /\.(?:flushall|flushdb|scan|keys)\s*\(/i);
  assert.doesNotMatch(script, /UPSTASH_REDIS_REST_TOKEN\s*[,}]/);
});
