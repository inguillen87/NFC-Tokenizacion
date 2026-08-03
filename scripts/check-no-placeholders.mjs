#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_PLACEHOLDER_SCAN_TARGETS = ["apps", "packages"];

const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".htm",
  ".html",
  ".js",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
]);

const GENERATED_DIRECTORY_NAMES = new Set([
  ".next",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);

const NON_RUNTIME_DIRECTORY_NAMES = new Set([
  "__fixtures__",
  "__tests__",
  "fixtures",
  "test",
  "tests",
]);

const forbiddenRules = [
  {
    id: "public-loopback-url",
    label: "runtime loopback URL literal",
    regex: /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:[/?#][^\s"'`]*)?/gi,
  },
  {
    id: "coming-soon",
    label: "coming soon placeholder",
    regex: /\bcoming\s+soon\b/gi,
  },
  {
    id: "dead-anchor",
    label: "dead anchor href=#",
    regex: /\bhref\s*=\s*(?:["']#["']|\{\s*["']#["']\s*\})/gi,
  },
];

// These are narrow source-shape exceptions. A new loopback URL elsewhere in the
// same file is still reported; the whole file is never allowlisted.
export const LOOPBACK_CONTEXT_ALLOWLIST = [
  {
    id: "executor-request-url-parser-base",
    relativePath: "apps/executor/src/server.mjs",
    reason: "WHATWG URL needs an absolute base to parse the inbound Node request path; the base is never returned as a public link.",
    regex: /new URL\(req\.url \|\| "\/", "http:\/\/localhost"\)/g,
  },
  {
    id: "dashboard-clerk-local-development-origins",
    relativePath: "apps/dashboard/src/lib/clerk-env.ts",
    reason: "Clerk loopback origins are present only in the explicit non-production branch.",
    regex: /const localOrigins = isProductionDeployment\(\)\s*\?\s*\[\]\s*:\s*\["http:\/\/localhost:3000", "http:\/\/localhost:3010", "http:\/\/127\.0\.0\.1:3000", "http:\/\/127\.0\.0\.1:3010"\]/g,
  },
  {
    id: "api-realtime-local-development-origins",
    relativePath: "apps/api/src/app/realtime/session/route.ts",
    reason: "Realtime loopback origins are added only while productionRuntime() is false.",
    regex: /if \(!productionRuntime\(\)\) \{\s*origins\.add\("http:\/\/localhost:3000"\);\s*origins\.add\("http:\/\/127\.0\.0\.1:3000"\);\s*\}/g,
  },
  {
    id: "api-consumer-mutation-local-development-origins",
    relativePath: "apps/api/src/lib/consumer-mutation-origin.ts",
    reason: "Consumer CSRF loopback origins are included only when productionRuntime(options) is false and exactOrigin still requires a loopback hostname.",
    regex: /const LOCAL_DEVELOPMENT_ORIGINS = \[\s*"http:\/\/localhost:3000",\s*"http:\/\/127\.0\.0\.1:3000",\s*"http:\/\/localhost:3003",\s*"http:\/\/127\.0\.0\.1:3003",\s*\] as const;/g,
  },
  {
    id: "api-admin-invite-explicit-development-link",
    relativePath: "apps/api/src/app/admin/users/invite/route.ts",
    reason: "The loopback activation URL is reachable only through the existing allowDevLink non-production secret-exposure gate.",
    regex: /const activationLink = allowDevLink\s*\?\s*`\$\{process\.env\.NEXT_PUBLIC_APP_URL \|\| process\.env\.NEXT_PUBLIC_DASHBOARD_URL \|\| 'http:\/\/localhost:3002'\}\/reset-password\?token=\$\{encodeURIComponent\(token\)\}`\s*:\s*undefined;/g,
  },
];

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function isExampleEnvironmentFile(relativePath) {
  const name = path.posix.basename(relativePath);
  return /^\.env(?:\.[^.]+)*\.(?:example|sample)$/i.test(name);
}

function isNonRuntimeTool(relativePath) {
  return /^(?:apps|packages)\/[^/]+\/scripts\//i.test(relativePath);
}

export function shouldScanPlaceholderFile(relativePath) {
  const normalized = toPosix(relativePath);
  const parts = normalized.split("/");
  if (parts.some((part) => GENERATED_DIRECTORY_NAMES.has(part))) return false;
  if (parts.some((part) => NON_RUNTIME_DIRECTORY_NAMES.has(part))) return false;
  if (isExampleEnvironmentFile(normalized)) return false;
  if (isNonRuntimeTool(normalized)) return false;
  return SOURCE_EXTENSIONS.has(path.posix.extname(normalized).toLowerCase());
}

function cloneGlobalRegex(regex) {
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  return new RegExp(regex.source, flags);
}

function allowedLoopbackRanges(relativePath, content) {
  const ranges = [];
  for (const allowance of LOOPBACK_CONTEXT_ALLOWLIST) {
    if (allowance.relativePath !== relativePath) continue;
    const regex = cloneGlobalRegex(allowance.regex);
    for (const match of content.matchAll(regex)) {
      ranges.push({
        start: match.index,
        end: match.index + match[0].length,
        allowanceId: allowance.id,
      });
    }
  }
  return ranges;
}

function sourcePosition(content, index) {
  const before = content.slice(0, index);
  const line = before.split("\n").length;
  const lastNewline = before.lastIndexOf("\n");
  return { line, column: index - lastNewline };
}

function lineExcerpt(content, index) {
  const start = content.lastIndexOf("\n", index - 1) + 1;
  const endIndex = content.indexOf("\n", index);
  const end = endIndex === -1 ? content.length : endIndex;
  return content.slice(start, end).trim();
}

export function scanPlaceholderSource({ relativePath, content }) {
  const normalizedPath = toPosix(relativePath);
  if (!shouldScanPlaceholderFile(normalizedPath)) return [];

  const loopbackAllowances = allowedLoopbackRanges(normalizedPath, content);
  const violations = [];

  for (const rule of forbiddenRules) {
    const regex = cloneGlobalRegex(rule.regex);
    for (const match of content.matchAll(regex)) {
      if (
        rule.id === "public-loopback-url"
        && loopbackAllowances.some((range) => match.index >= range.start && match.index < range.end)
      ) {
        continue;
      }
      const position = sourcePosition(content, match.index);
      violations.push({
        rule: rule.id,
        label: rule.label,
        relativePath: normalizedPath,
        line: position.line,
        column: position.column,
        match: match[0],
        excerpt: lineExcerpt(content, match.index),
      });
    }
  }

  return violations;
}

function collectCandidateFiles(directory, repoRoot, files) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = toPosix(path.relative(repoRoot, absolutePath));
    if (entry.isDirectory()) {
      if (GENERATED_DIRECTORY_NAMES.has(entry.name)) continue;
      collectCandidateFiles(absolutePath, repoRoot, files);
      continue;
    }
    if (entry.isFile() && shouldScanPlaceholderFile(relativePath)) {
      files.push({ absolutePath, relativePath });
    }
  }
}

export function scanPlaceholderRepository({
  repoRoot = process.cwd(),
  targets = DEFAULT_PLACEHOLDER_SCAN_TARGETS,
} = {}) {
  const resolvedRoot = path.resolve(repoRoot);
  const files = [];
  for (const target of targets) {
    const absoluteTarget = path.resolve(resolvedRoot, target);
    if (!fs.existsSync(absoluteTarget)) continue;
    collectCandidateFiles(absoluteTarget, resolvedRoot, files);
  }

  return files
    .flatMap(({ absolutePath, relativePath }) => scanPlaceholderSource({
      relativePath,
      content: fs.readFileSync(absolutePath, "utf8"),
    }))
    .sort((left, right) => (
      left.relativePath.localeCompare(right.relativePath)
      || left.line - right.line
      || left.column - right.column
      || left.rule.localeCompare(right.rule)
    ));
}

export function runPlaceholderGate(options = {}) {
  const violations = scanPlaceholderRepository(options);
  if (violations.length > 0) {
    console.error("Public-link/placeholder quality check failed:\n");
    for (const violation of violations) {
      console.error(
        `- ${violation.relativePath}:${violation.line}:${violation.column} [${violation.rule}] ${violation.excerpt}`,
      );
    }
    return 1;
  }

  console.log("Public-link/placeholder quality check passed: no public loopback links, coming-soon copy, or dead anchors found.");
  return 0;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = runPlaceholderGate();
}
