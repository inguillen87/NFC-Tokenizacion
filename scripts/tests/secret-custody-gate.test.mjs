import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("tracked-secret gate passes the current index", () => {
  const result = spawnSync(process.execPath, ["scripts/check-no-tracked-secrets.mjs"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Secret custody gate passed/);
});

test("all NFC key tools default to the ignored custody directory", async () => {
  const files = ["nfc_key_tool.ps1", "nfc_keys.ps1", "nfc_keys_final.ps1"];
  for (const file of files) {
    const source = await readFile(path.join(root, file), "utf8");
    assert.match(source, /\.nexid-custody/);
  }
});

test("legacy custody output paths are explicitly ignored", () => {
  const samples = [
    "secrets/kms-master.env",
    "generated-keys/example.private.env",
    "generated-keys/example.backend.env",
    "generated-keys/example.supplier.txt",
    ".platform-kms.local.env",
    "supplier-keys-client-batch.env",
    "backend-batch-client-batch.env",
  ];
  const result = spawnSync("git", ["check-ignore", "--no-index", ...samples], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  for (const sample of samples) assert.ok(result.stdout.includes(sample), `${sample} must be ignored`);
});
