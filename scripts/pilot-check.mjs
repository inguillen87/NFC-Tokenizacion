#!/usr/bin/env node
import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";
const npxCmd = isWindows ? "npx.cmd" : "npx";
const nodeCmd = process.execPath;
const full = process.argv.includes("--full");

const checks = [
  { name: "Static QA", cmd: nodeCmd, args: ["scripts/qa-static.mjs"] },
  { name: "Route safety", cmd: npmCmd, args: ["run", "verify:routes"] },
  { name: "API typecheck", cmd: npxCmd, args: ["tsc", "-p", "apps/api/tsconfig.json", "--noEmit", "--incremental", "false"] },
  { name: "Web typecheck", cmd: npxCmd, args: ["tsc", "-p", "apps/web/tsconfig.json", "--noEmit", "--incremental", "false"] },
  { name: "Dashboard typecheck", cmd: npmCmd, args: ["run", "typecheck:dashboard"] },
  { name: "API critical tests", cmd: nodeCmd, args: ["--test", "apps/api/tests/sun-*.test.mjs", "apps/api/tests/ttstatus-decode.test.mjs", "apps/api/tests/ownership-flow-policy.test.mjs", "apps/api/tests/consumer-claim-e2e-smoke.test.mjs", "apps/api/tests/consumer-portal-rules.test.mjs", "apps/api/tests/marketplace-rules.test.mjs", "apps/api/tests/consumer-auth-fallback.test.mjs"] },
  { name: "Web tests", cmd: npmCmd, args: ["test", "--workspace=web"] },
  { name: "Dashboard tests", cmd: nodeCmd, args: ["--test", "apps/dashboard/tests/*.test.mjs"] },
  { name: "Tokenization readiness", cmd: npmCmd, args: ["run", "tokenization:check", "--workspace=api"] },
];

if (full) {
  checks.push(
    { name: "Web production build", cmd: npmCmd, args: ["run", "build:web"] },
    { name: "Dashboard production build", cmd: npmCmd, args: ["run", "build:dashboard"] },
    { name: "API production build", cmd: npmCmd, args: ["run", "build:api"] },
  );
}

function runCheck(check) {
  return new Promise((resolve) => {
    const started = Date.now();
    console.log(`\n=== ${check.name} ===`);
    const commandLine = [check.cmd, ...check.args]
      .map((part, index) => {
        const value = String(part);
        if (index === 0 && /^[\w.-]+$/.test(value)) return value;
        return `"${value.replace(/"/g, '\\"')}"`;
      })
      .join(" ");
    const child = isWindows
      ? spawn(commandLine, { stdio: "inherit", shell: true })
      : spawn(check.cmd, check.args, { stdio: "inherit" });
    child.on("close", (code) => {
      resolve({
        ...check,
        code,
        ms: Date.now() - started,
      });
    });
  });
}

const results = [];
for (const check of checks) {
  const result = await runCheck(check);
  results.push(result);
  if (result.code !== 0) break;
}

console.log("\n=== Pilot readiness summary ===");
for (const result of results) {
  const status = result.code === 0 ? "PASS" : "FAIL";
  console.log(`${status.padEnd(5)} ${result.name} (${(result.ms / 1000).toFixed(1)}s)`);
}

const failed = results.find((result) => result.code !== 0);
if (failed) {
  console.error(`\nPilot gate failed at: ${failed.name}`);
  process.exit(failed.code || 1);
}

console.log(`\nPilot gate passed${full ? " with production builds" : ""}.`);
