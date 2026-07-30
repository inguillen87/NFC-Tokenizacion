#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const git = spawnSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
});
if (git.status !== 0) {
  console.error(`Secret custody gate could not enumerate tracked files: ${String(git.stderr || "git_error").trim()}`);
  process.exit(2);
}

const tracked = String(git.stdout || "").split("\0").filter(Boolean);
const forbiddenPaths = [
  /(^|\/)(?:secrets|generated-keys)\//i,
  /(^|\/)\.platform-kms\.local\.env$/i,
  /(^|\/)(?:supplier-keys|backend-batch)-[^/]+\.env$/i,
  /(^|\/)nfc-keys-[^/]+(?:\.private\.env|\.backend\.env|\.supplier\.txt|-supplier\.txt|\.env)$/i,
];
const forbiddenContent = [
  { label: "Cloudflare API token", regex: /\bcfk_[A-Za-z0-9_-]{20,}\b/g },
  { label: "NFC master key", regex: /\bKMS_MASTER_KEY_HEX\s*=\s*[0-9A-Fa-f]{64}\b/g },
  { label: "NFC batch key", regex: /\bK_(?:META|FILE)_BATCH\s*=\s*[0-9A-Fa-f]{32,64}\b/g },
  {
    label: "private key material",
    regex: new RegExp(["-----BEGIN ", "(?:RSA |EC |OPENSSH )?PRIVATE KEY", "-----"].join(""), "g"),
  },
];

const violations = [];
for (const relative of tracked) {
  const normalized = relative.replaceAll("\\", "/");
  if (forbiddenPaths.some((pattern) => pattern.test(normalized))) {
    violations.push({ file: normalized, reason: "tracked NFC custody output" });
    continue;
  }

  let content;
  try {
    content = readFileSync(path.join(root, relative), "utf8");
  } catch {
    continue;
  }
  if (content.includes("\0")) continue;
  for (const rule of forbiddenContent) {
    rule.regex.lastIndex = 0;
    if (rule.regex.test(content)) violations.push({ file: normalized, reason: rule.label });
  }
}

if (violations.length) {
  console.error("Secret custody gate failed. Remove and rotate every reported credential before release:");
  for (const violation of violations) console.error(`- ${violation.file}: ${violation.reason}`);
  process.exit(1);
}

console.log(`Secret custody gate passed: ${tracked.length} tracked files checked; no tracked NFC custody outputs or recognized live-secret formats.`);
