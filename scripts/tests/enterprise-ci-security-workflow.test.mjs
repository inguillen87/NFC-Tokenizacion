import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..", "..");
const workflow = await readFile(path.join(root, ".github", "workflows", "enterprise-ci-security-gate.yml"), "utf8");
const policyPath = path.join(root, "scripts", "enterprise-npm-audit-allowlist.v1.json");
const policy = JSON.parse(await readFile(policyPath, "utf8"));

function auditReport(vulnerabilities = {}) {
  return { auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: {} } };
}

async function runAuditFixtures({ production = auditReport(), full, policyOverride = policy, now = "2026-08-02T12:00:00.000Z" }) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nexid-enterprise-audit-"));
  const productionPath = path.join(directory, "production.json");
  const fullPath = path.join(directory, "full.json");
  const fixturePolicyPath = path.join(directory, "policy.json");
  await Promise.all([
    writeFile(productionPath, JSON.stringify(production)),
    writeFile(fullPath, JSON.stringify(full)),
    writeFile(fixturePolicyPath, JSON.stringify(policyOverride)),
  ]);
  try {
    return spawnSync(process.execPath, [
      "scripts/enterprise-dependency-audit.mjs",
      "--policy", fixturePolicyPath,
      "--production-report", productionPath,
      "--full-report", fullPath,
      "--now", now,
    ], { cwd: root, encoding: "utf8", windowsHide: true });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test("enterprise gate runs for review and main integration without path bypasses", () => {
  assert.match(workflow, /^\s{2}pull_request:\s*$/m);
  assert.match(workflow, /^\s{2}merge_group:\s*$/m);
  assert.match(workflow, /^\s{2}workflow_dispatch:\s*$/m);
  assert.match(workflow, /push:\s*\n\s+branches:\s*\n\s+- main/);
  assert.doesNotMatch(workflow, /paths-ignore|continue-on-error/);
  assert.match(workflow, /enterprise-security-gate:\s*\n\s+name: Enterprise security gate/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.match(workflow, /result!=='success'/);
  assert.equal((workflow.match(/needs: policy-and-supply-chain/g) || []).length, 2);
});

test("workflow is least-privileged, secretless, non-deploying and action-pinned", () => {
  assert.match(workflow, /^permissions:\s*\n\s{2}contents: read\s*$/m);
  const permissionsBlock = workflow.match(/^permissions:\s*\n((?:\s{2}[^\n]+\n)+)/m)?.[1] || "";
  assert.doesNotMatch(permissionsBlock, /(?:^|\s)(?:write|id-token:)(?:\s|$)/);
  assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./);
  assert.doesNotMatch(workflow, /^\s*environment:/m);
  assert.doesNotMatch(workflow, /\b(?:vercel|wrangler|deploy|db:migrate|db-apply|apply:staging|prisma migrate)\b/i);
  const uses = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+).*$/gm)].map((match) => match[1]);
  assert.ok(uses.length >= 7);
  for (const action of uses) assert.match(action, /^[^@\s]+@[0-9a-f]{40}$/);
  assert.equal((workflow.match(/persist-credentials: false/g) || []).length, 4);
});

test("workflow enforces dependencies, untracked-secret policy, migrations, builds, typechecks and tests", () => {
  for (const command of [
    "node scripts/enterprise-dependency-audit.mjs",
    "npm run check:secrets",
    "npm run test:security-gates",
    "npm run check:migrations:safety",
    "npm run test:migration-gates",
    "npm run build:api",
    "npm run check --workspace=@product/nexid-server-sdk",
    "npm run typecheck:dashboard",
    "npm test --workspace=dashboard",
    "npm run build:dashboard",
    "npm test --workspace=web",
    "npm run build:web",
    "npm run build --workspace=executor",
  ]) assert.ok(workflow.includes(command), `missing mandatory command: ${command}`);
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.doesNotMatch(workflow, /\|\|\s*true|audit-level=(?:low|moderate)|--force/);
});

test("dependency allowlist is versioned and empty after the patched Hardhat upgrade", () => {
  assert.equal(policy.schemaVersion, "nexid-enterprise-npm-audit-allowlist/v1");
  assert.equal(policy.policyVersion, 1);
  assert.deepEqual(policy.entries, []);
});

test("dependency audit accepts clean production and development reports", async () => {
  const result = await runAuditFixtures({
    full: auditReport(),
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /enterprise_dependency_audit_v1/);
});

test("dependency audit rejects former, new, production, expired and stale exceptions", async () => {
  const former = await runAuditFixtures({
    full: auditReport({
      "adm-zip": {
        severity: "high",
        via: [{ name: "adm-zip", severity: "high", url: "https://github.com/advisories/GHSA-xcpc-8h2w-3j85" }],
      },
      hardhat: { severity: "high", via: ["adm-zip"] },
    }),
  });
  assert.equal(former.status, 1);
  assert.match(former.stderr, /unapproved_dependency_vulnerability/);

  const unknown = await runAuditFixtures({
    full: auditReport({
      dangerous: {
        severity: "critical",
        via: [{ name: "dangerous", severity: "critical", url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc" }],
      },
    }),
  });
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /unapproved_dependency_vulnerability/);

  const production = await runAuditFixtures({
    production: auditReport({
      dangerous: {
        severity: "high",
        via: [{ name: "dangerous", severity: "high", url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc" }],
      },
    }),
    full: auditReport(),
  });
  assert.equal(production.status, 1);
  assert.match(production.stderr, /production_dependency_vulnerability/);

  const reviewedException = {
    ...policy,
    entries: [{
      advisoryId: "GHSA-xcpc-8h2w-3j85",
      package: "adm-zip",
      severity: "high",
      affectedPackages: ["adm-zip", "hardhat"],
      dependencyScope: "development-only",
      expiresOn: "2026-08-31",
      owner: "platform-security",
      rationale: "Test-only governed exception fixture long enough to exercise expiry and stale-entry fail-closed behavior without weakening the repository policy.",
    }],
  };
  const expired = await runAuditFixtures({
    full: auditReport(),
    policyOverride: reviewedException,
    now: "2026-09-01T00:00:00.000Z",
  });
  assert.equal(expired.status, 1);
  assert.match(expired.stderr, /allowlist_expired/);

  const stale = await runAuditFixtures({ full: auditReport(), policyOverride: reviewedException });
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /stale_allowlist_entry/);
});

test("commit-bound manifest is schema-valid and contains no ambient secret values", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nexid-enterprise-manifest-"));
  const manifestPath = path.join(directory, "manifest.json");
  const secretSentinel = "must-never-enter-manifest";
  try {
    const result = spawnSync(process.execPath, ["scripts/write-enterprise-ci-security-manifest.mjs", manifestPath], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      env: {
        ...process.env,
        GITHUB_SHA: "a".repeat(40),
        GITHUB_REPOSITORY: "nexid/platform",
        GITHUB_RUN_ID: "12345",
        GITHUB_RUN_ATTEMPT: "2",
        GITHUB_REF: "refs/pull/7/merge",
        GITHUB_WORKFLOW_REF: "nexid/platform/.github/workflows/enterprise-ci-security-gate.yml@refs/pull/7/merge",
        DATABASE_URL: secretSentinel,
      },
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const raw = await readFile(manifestPath, "utf8");
    const manifest = JSON.parse(raw);
    assert.equal(manifest.schemaVersion, "nexid-enterprise-ci-security-manifest/v1");
    assert.equal(manifest.commitSha, "a".repeat(40));
    assert.equal(manifest.status, "passed");
    assert.equal(manifest.scope.providerSecrets, "not_requested");
    assert.equal(manifest.scope.deployment, "not_performed");
    assert.equal(manifest.scope.physicalNfcEvidence, "not_attested");
    assert.equal(manifest.scope.kmsOrHsmStatus, "not_attested");
    assert.equal(raw.includes(secretSentinel), false);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
