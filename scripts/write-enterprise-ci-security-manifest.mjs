#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputPath = path.resolve(process.argv[2] || "artifacts/enterprise-ci-security/manifest.json");

function requireEnv(name, pattern) {
  const value = String(process.env[name] || "");
  if (!pattern.test(value)) throw new Error(`${name} is absent or malformed`);
  return value;
}

const commitSha = requireEnv("GITHUB_SHA", /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i);
const repository = requireEnv("GITHUB_REPOSITORY", /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
const runId = requireEnv("GITHUB_RUN_ID", /^\d+$/);
const runAttempt = requireEnv("GITHUB_RUN_ATTEMPT", /^\d+$/);
const ref = requireEnv("GITHUB_REF", /^.{1,512}$/);
const workflowRef = requireEnv("GITHUB_WORKFLOW_REF", /^.{1,1024}$/);

const manifest = {
  schemaVersion: "nexid-enterprise-ci-security-manifest/v1",
  status: "passed",
  repository,
  commitSha: commitSha.toLowerCase(),
  ref,
  workflowRef,
  runId,
  runAttempt,
  generatedAt: new Date().toISOString(),
  gates: [
    "production-and-full-dependency-audit",
    "tracked-and-untracked-secret-policy",
    "migration-safety",
    "api-build-and-security-contracts",
    "sdk-typecheck-tests-build-and-package-smoke",
    "web-dashboard-executor-builds-and-tests"
  ],
  scope: {
    providerSecrets: "not_requested",
    deployment: "not_performed",
    physicalNfcEvidence: "not_attested",
    kmsOrHsmStatus: "not_attested"
  }
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(`Enterprise CI security manifest written for ${manifest.commitSha}.`);
