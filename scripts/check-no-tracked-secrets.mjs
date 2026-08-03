#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const git = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
});
if (git.status !== 0) {
  console.error(`Secret custody gate could not enumerate worktree files: ${String(git.stderr || "git_error").trim()}`);
  process.exit(2);
}

const worktreeFiles = String(git.stdout || "").split("\0").filter(Boolean);
const supplementalRoots = ["artifacts", "apps/api/artifacts", ".codex-run-logs"];
const supplementalFiles = [];
const MAX_TEXT_BYTES = 2 * 1024 * 1024;

function collectFiles(relativeDirectory) {
  const absoluteDirectory = path.join(root, relativeDirectory);
  if (!existsSync(absoluteDirectory)) return;
  const pending = [absoluteDirectory];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolute);
      } else if (entry.isFile()) {
        supplementalFiles.push(path.relative(root, absolute));
      }
    }
  }
}
for (const relativeDirectory of supplementalRoots) collectFiles(relativeDirectory);
const candidates = [...new Set([...worktreeFiles, ...supplementalFiles])];
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
  { label: "Polygon or IOTA private key", regex: /\b(?:POLYGON|IOTA|EVM|DEPLOYER|WALLET)_PRIVATE_KEY\s*=\s*(?:0x)?[0-9A-Fa-f]{64}\b/g },
  { label: "OpenAI API key", regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/g },
  { label: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  {
    label: "offline public-certificate private JWK",
    regex: /\bOFFLINE_PUBLIC_CERTIFICATE_PRIVATE_JWK\s*=\s*\{[^\r\n]{1,8192}"d"\s*:/g,
  },
  {
    label: "private key material",
    regex: new RegExp(["-----BEGIN ", "(?:RSA |EC |OPENSSH )?PRIVATE KEY", "-----"].join(""), "g"),
  },
];

const violations = [];
for (const relative of candidates) {
  const normalized = relative.replaceAll("\\", "/");
  if (forbiddenPaths.some((pattern) => pattern.test(normalized))) {
    violations.push({ file: normalized, reason: "tracked NFC custody output" });
    continue;
  }

  let content;
  try {
    if (statSync(path.join(root, relative)).size > MAX_TEXT_BYTES) continue;
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

console.log(`Secret custody gate passed: ${candidates.length} tracked/untracked worktree, log and artifact files checked; no prohibited custody outputs or recognized live-secret formats.`);
