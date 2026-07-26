import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const packageDirectory = fileURLToPath(new URL("..", import.meta.url));
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, "npm_execpath is required to inspect the installable package");

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

const resolvedTempDirectory = await realpath(tmpdir());
const safePrefix = join(resolvedTempDirectory, "nexid-sdk-pack-");
const smokeDirectory = await mkdtemp(safePrefix);
try {
  const report = JSON.parse(run(
    process.execPath,
    [npmCli, "pack", "--json", "--ignore-scripts", "--pack-destination", smokeDirectory],
    packageDirectory,
  ));
  assert.equal(Array.isArray(report), true);
  assert.equal(report.length, 1);
  const files = new Set(report[0].files.map((entry) => entry.path));
  for (const required of [
    "package.json",
    "README.md",
    "dist/index.js",
    "dist/index.js.map",
    "dist/index.d.ts",
    "dist/index.d.ts.map",
  ]) {
    assert.equal(files.has(required), true, `packed artifact is missing ${required}`);
  }
  assert.equal(files.has("src/index.ts"), false, "source TypeScript must not be the runtime entrypoint");
  assert.equal(report[0].entryCount, files.size);

  const consumerDirectory = join(smokeDirectory, "consumer");
  await mkdir(consumerDirectory);
  await writeFile(join(consumerDirectory, "package.json"), JSON.stringify({ private: true, type: "module" }), "utf8");
  const tarball = join(smokeDirectory, report[0].filename);
  run(
    process.execPath,
    [npmCli, "install", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", tarball],
    consumerDirectory,
  );
  await writeFile(join(consumerDirectory, "consumer.mjs"), [
    'import { NEXID_WEBHOOK_SIGNATURE_VERSION_V2, NexIdClient } from "@product/nexid-server-sdk";',
    'if (NEXID_WEBHOOK_SIGNATURE_VERSION_V2 !== "v2" || typeof NexIdClient !== "function") process.exit(1);',
  ].join("\n"), "utf8");
  run(process.execPath, ["consumer.mjs"], consumerDirectory);

  process.stdout.write(`package install smoke ok: ${report[0].filename} (${files.size} files)\n`);
} finally {
  const resolvedSmokeDirectory = resolve(smokeDirectory);
  assert.equal(
    resolvedSmokeDirectory.startsWith(safePrefix),
    true,
    "refusing to remove a package smoke directory outside the OS temp directory",
  );
  await rm(resolvedSmokeDirectory, { recursive: true, force: true });
}
