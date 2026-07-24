import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  secretMatches,
  sha256Bytes32,
} from "../src/server.mjs";

test("executor secrets are compared exactly and safely", () => {
  assert.equal(secretMatches("same-long-secret", "same-long-secret"), true);
  assert.equal(secretMatches("same-long-secret", "different-secret"), false);
  assert.equal(secretMatches("short", "much-longer"), false);
  assert.equal(secretMatches("", ""), false);
});

test("IOTA executor accepts only canonical 32-byte evidence digests", () => {
  assert.equal(sha256Bytes32(`sha256:${"ab".repeat(32)}`, "memo_hash"), `0x${"ab".repeat(32)}`);
  assert.equal(sha256Bytes32(`0x${"CD".repeat(32)}`, "memo_hash"), `0x${"cd".repeat(32)}`);
  assert.throws(() => sha256Bytes32("not-a-digest", "memo_hash"), /memo_hash_invalid/);
});

test("IOTA endpoint returns after broadcast and exposes no legacy anchorRoot writer", async () => {
  const source = await readFile(new URL("../src/server.mjs", import.meta.url), "utf8");
  assert.match(source, /\/anchor-evidence/);
  assert.match(source, /IOTA_PROOF_EXECUTOR_SECRET/);
  assert.match(source, /authorizedPublishers/);
  assert.match(source, /computeProofId/);
  assert.match(source, /anchorEvidence/);
  assert.match(source, /state:\s*"submitted"/);
  assert.doesNotMatch(source, /anchorRoot/);
});

