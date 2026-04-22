#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const targets = ["apps", "packages"];
const forbiddenPatterns = [
  { label: "localhost reference", pattern: "localhost" },
  { label: "coming soon placeholder", pattern: "coming soon" },
  { label: "dead anchor href=#", pattern: 'href="#"' }
];

const ignoredGlobs = ["!packages/config/src/urls.ts", "!apps/api/scripts/**"];

const rgBaseArgs = [
  "--line-number",
  "--with-filename",
  "--color",
  "never",
  "--glob",
  "!**/node_modules/**",
  "--glob",
  "!**/.next/**",
  "--glob",
  "!**/dist/**",
  "--glob",
  "!**/build/**",
  "--glob",
  "!**/*.md",
  ...ignoredGlobs.flatMap((glob) => ["--glob", glob])
];

let hasViolations = false;

for (const rule of forbiddenPatterns) {
  const args = [...rgBaseArgs, "-i", rule.pattern, ...targets];
  const result = spawnSync("rg", args, { encoding: "utf8" });

  if (result.status === 0) {
    hasViolations = true;
    console.error(`\n[FAIL] ${rule.label} (${rule.pattern})`);
    process.stderr.write(result.stdout || "");
  } else if (result.status > 1) {
    console.error(`\n[ERROR] rg failed for pattern: ${rule.pattern}`);
    process.stderr.write(result.stderr || "");
    process.exit(result.status);
  }
}

if (hasViolations) {
  console.error("\nPlaceholder/link quality check failed.");
  process.exit(1);
}

console.log("No forbidden placeholders or dead anchors were found in apps/* or packages/*.");
