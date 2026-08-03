import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  REQUIRED_SYNGENTA_SCREENSHOTS,
  SYNGENTA_SCREENSHOT_EVIDENCE_SCHEMA,
  parsePngDimensions,
  parseScreenshotChecksums,
  validateSyngentaScreenshotEvidence,
} from "../validate-syngenta-screenshot-evidence.mjs";

function pngHeader(width = 390, height = 844) {
  const bytes = Buffer.alloc(36);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  bytes[24] = 8;
  bytes[25] = 6;
  bytes.writeUInt32BE(0, 28);
  bytes.write("IEND", 32, "ascii");
  return bytes;
}

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nexid-screenshot-evidence-"));
  const bytes = pngHeader();
  const digest = createHash("sha256").update(bytes).digest("hex");
  for (const filename of REQUIRED_SYNGENTA_SCREENSHOTS) await writeFile(path.join(directory, filename), bytes);
  await writeFile(path.join(directory, "SHA256SUMS"), `${REQUIRED_SYNGENTA_SCREENSHOTS.map((filename) => `${digest}  ${filename}`).join("\n")}\n`);
  await writeFile(path.join(directory, "evidence-manifest.json"), JSON.stringify({
    schema_version: SYNGENTA_SCREENSHOT_EVIDENCE_SCHEMA,
    entries: REQUIRED_SYNGENTA_SCREENSHOTS.map((file) => ({
      file,
      captured_at: "2026-08-02T12:00:00.000Z",
      source: "public_demo",
      contains_raw_secrets: false,
      production_mutated: false,
      physical_nfc_scanned: false,
      notes: "Fixture unitaria declarada; no es evidencia de aceptación.",
    })),
  }));
  return { directory, bytes };
}

test("PNG parser requires the signature and reads bounded dimensions", () => {
  assert.deepEqual(parsePngDimensions(pngHeader(1440, 900)), { width: 1440, height: 900 });
  assert.throws(() => parsePngDimensions(Buffer.alloc(24)), /screenshot_not_png/);
});

test("checksum parser rejects malformed and duplicate inventory", () => {
  const digest = "a".repeat(64);
  assert.equal(parseScreenshotChecksums(`${digest}  01-packaging-lab-create.png\n`).size, 1);
  assert.throws(() => parseScreenshotChecksums(`${digest} *unsafe.png\n`), /screenshot_checksum_line_invalid/);
  assert.throws(() => parseScreenshotChecksums(`${digest}  one.png\n${digest}  one.png\n`), /screenshot_checksum_duplicate/);
});

test("the exact sixteen-file evidence pack passes with hashes and truthful metadata", async () => {
  const { directory } = await fixture();
  try {
    const result = await validateSyngentaScreenshotEvidence(directory);
    assert.equal(result.ok, true);
    assert.equal(result.count, 16);
    assert.equal(result.screenshots.every((entry) => entry.width === 390 && entry.height === 844), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("missing, extra and tampered evidence fails closed", async () => {
  const missing = await mkdtemp(path.join(os.tmpdir(), "nexid-screenshot-missing-"));
  try {
    await assert.rejects(() => validateSyngentaScreenshotEvidence(missing), /screenshot_evidence_missing_files/);
  } finally {
    await rm(missing, { recursive: true, force: true });
  }

  const extra = await fixture();
  try {
    await writeFile(path.join(extra.directory, "notes.txt"), "unexpected");
    await assert.rejects(() => validateSyngentaScreenshotEvidence(extra.directory), /screenshot_evidence_unexpected_files/);
  } finally {
    await rm(extra.directory, { recursive: true, force: true });
  }

  const tampered = await fixture();
  try {
    await writeFile(path.join(tampered.directory, REQUIRED_SYNGENTA_SCREENSHOTS[0]), pngHeader(400, 900));
    await assert.rejects(() => validateSyngentaScreenshotEvidence(tampered.directory), /screenshot_checksum_mismatch/);
  } finally {
    await rm(tampered.directory, { recursive: true, force: true });
  }

});

test("symlinked screenshot evidence fails closed when the platform permits creating the fixture", async (t) => {
  const linked = await fixture();
  try {
    const target = path.join(linked.directory, REQUIRED_SYNGENTA_SCREENSHOTS[1]);
    const link = path.join(linked.directory, REQUIRED_SYNGENTA_SCREENSHOTS[0]);
    await rm(link);
    try {
      await symlink(target, link, "file");
    } catch (error) {
      if (error?.code === "EPERM") {
        t.skip("Windows symlink creation requires Developer Mode or elevated privileges.");
        return;
      }
      throw error;
    }
    await assert.rejects(() => validateSyngentaScreenshotEvidence(linked.directory), /screenshot_file_invalid/);
  } finally {
    await rm(linked.directory, { recursive: true, force: true });
  }
});
