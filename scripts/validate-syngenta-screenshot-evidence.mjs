import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SYNGENTA_SCREENSHOT_EVIDENCE_SCHEMA = "nexid-syngenta-screenshot-evidence/v1";

export const REQUIRED_SYNGENTA_SCREENSHOTS = Object.freeze([
  "01-packaging-lab-create.png",
  "02-carrier-delivery-selector.png",
  "03-seed-bag-placement.png",
  "04-bidon-body-tt-cap-placement.png",
  "05-supplier-order-5000.png",
  "06-five-sub-batches.png",
  "07-key-fingerprints.png",
  "08-secure-supplier-export.png",
  "09-manifest-dry-run.png",
  "10-qa-matrix.png",
  "11-activation-gate.png",
  "12-agro-mobile-passport.png",
  "13-risk-map.png",
  "14-webhook-delivery-log.png",
  "15-polygon-iota-proof-status.png",
  "16-offline-pending.png",
]);

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const SHA_LINE = /^([0-9a-f]{64})  ([A-Za-z0-9][A-Za-z0-9._-]*\.png)$/;
const MAX_SCREENSHOT_BYTES = 20 * 1024 * 1024;
const MIN_WIDTH = 360;
const MIN_HEIGHT = 640;

function fail(reason, details = {}) {
  const error = new Error(reason);
  error.code = reason;
  error.details = details;
  throw error;
}

export function parsePngDimensions(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    fail("screenshot_not_png");
  }
  if (bytes.subarray(12, 16).toString("ascii") !== "IHDR") fail("screenshot_png_ihdr_missing");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (!width || !height) fail("screenshot_png_dimensions_invalid");
  return { width, height };
}

export function parseScreenshotChecksums(raw) {
  const entries = new Map();
  const lines = String(raw || "").split(/\r?\n/).filter((line) => line.trim());
  for (const line of lines) {
    const match = SHA_LINE.exec(line);
    if (!match) fail("screenshot_checksum_line_invalid", { line: line.slice(0, 160) });
    const [, digest, filename] = match;
    if (entries.has(filename)) fail("screenshot_checksum_duplicate", { filename });
    entries.set(filename, digest);
  }
  return entries;
}

function normalizeManifestEntry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("screenshot_manifest_entry_invalid");
  const file = String(value.file || "").trim();
  const capturedAt = String(value.captured_at || "").trim();
  const source = String(value.source || "").trim();
  const notes = String(value.notes || "").trim();
  if (!REQUIRED_SYNGENTA_SCREENSHOTS.includes(file)) fail("screenshot_manifest_filename_invalid", { file });
  if (!capturedAt || Number.isNaN(Date.parse(capturedAt))) fail("screenshot_manifest_timestamp_invalid", { file });
  if (!["authenticated_persisted", "public_demo", "physical_device", "external_provider", "offline_device"].includes(source)) {
    fail("screenshot_manifest_source_invalid", { file });
  }
  if (value.contains_raw_secrets !== false) fail("screenshot_manifest_secret_review_missing", { file });
  if (typeof value.production_mutated !== "boolean") fail("screenshot_manifest_production_boundary_missing", { file });
  if (typeof value.physical_nfc_scanned !== "boolean") fail("screenshot_manifest_physical_boundary_missing", { file });
  if (notes.length < 12 || notes.length > 600) fail("screenshot_manifest_notes_invalid", { file });
  return { file, capturedAt, source };
}

export async function validateSyngentaScreenshotEvidence(directory) {
  const resolvedDirectory = path.resolve(directory);
  let directoryStat;
  try {
    directoryStat = await lstat(resolvedDirectory);
  } catch {
    fail("screenshot_evidence_directory_missing", { directory: resolvedDirectory });
  }
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
    fail("screenshot_evidence_directory_invalid", { directory: resolvedDirectory });
  }

  const allowed = new Set([...REQUIRED_SYNGENTA_SCREENSHOTS, "SHA256SUMS", "evidence-manifest.json"]);
  const names = await readdir(resolvedDirectory);
  const unexpected = names.filter((name) => !allowed.has(name)).sort();
  if (unexpected.length) fail("screenshot_evidence_unexpected_files", { unexpected });

  const missing = [...allowed].filter((name) => !names.includes(name));
  if (missing.length) fail("screenshot_evidence_missing_files", { missing });

  const checksumPath = path.join(resolvedDirectory, "SHA256SUMS");
  const manifestPath = path.join(resolvedDirectory, "evidence-manifest.json");
  for (const controlPath of [checksumPath, manifestPath]) {
    const stat = await lstat(controlPath);
    if (!stat.isFile() || stat.isSymbolicLink()) fail("screenshot_control_file_invalid", { file: path.basename(controlPath) });
  }

  const checksums = parseScreenshotChecksums(await readFile(checksumPath, "utf8"));
  const checksumNames = [...checksums.keys()].sort();
  const requiredNames = [...REQUIRED_SYNGENTA_SCREENSHOTS].sort();
  if (JSON.stringify(checksumNames) !== JSON.stringify(requiredNames)) {
    fail("screenshot_checksum_inventory_mismatch", { checksumNames, requiredNames });
  }

  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    fail("screenshot_manifest_invalid_json");
  }
  if (manifest?.schema_version !== SYNGENTA_SCREENSHOT_EVIDENCE_SCHEMA) fail("screenshot_manifest_schema_invalid");
  if (!Array.isArray(manifest.entries)) fail("screenshot_manifest_entries_missing");
  const manifestEntries = manifest.entries.map(normalizeManifestEntry);
  const manifestNames = manifestEntries.map((entry) => entry.file).sort();
  if (new Set(manifestNames).size !== requiredNames.length || JSON.stringify(manifestNames) !== JSON.stringify(requiredNames)) {
    fail("screenshot_manifest_inventory_mismatch", { manifestNames, requiredNames });
  }

  const verified = [];
  for (const filename of REQUIRED_SYNGENTA_SCREENSHOTS) {
    const screenshotPath = path.join(resolvedDirectory, filename);
    const stat = await lstat(screenshotPath);
    if (!stat.isFile() || stat.isSymbolicLink()) fail("screenshot_file_invalid", { filename });
    if (stat.size < 24 || stat.size > MAX_SCREENSHOT_BYTES) fail("screenshot_file_size_invalid", { filename, bytes: stat.size });
    const bytes = await readFile(screenshotPath);
    const dimensions = parsePngDimensions(bytes);
    if (dimensions.width < MIN_WIDTH || dimensions.height < MIN_HEIGHT) {
      fail("screenshot_dimensions_too_small", { filename, ...dimensions, minimum: { width: MIN_WIDTH, height: MIN_HEIGHT } });
    }
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (checksums.get(filename) !== digest) fail("screenshot_checksum_mismatch", { filename });
    verified.push({ filename, bytes: stat.size, ...dimensions, sha256: digest });
  }

  return {
    ok: true,
    schema_version: SYNGENTA_SCREENSHOT_EVIDENCE_SCHEMA,
    directory: resolvedDirectory,
    screenshots: verified,
    count: verified.length,
  };
}

async function main() {
  const defaultDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "docs",
    "enterprise-hardening",
    "2026-08-02",
    "evidence",
    "screenshots",
  );
  const directory = process.argv[2] ? path.resolve(process.argv[2]) : defaultDirectory;
  try {
    console.log(JSON.stringify(await validateSyngentaScreenshotEvidence(directory), null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      reason: String(error?.code || error?.message || "screenshot_evidence_validation_failed"),
      details: error?.details || {},
    }));
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
