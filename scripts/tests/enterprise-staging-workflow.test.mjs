import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(
  new URL("../../.github/workflows/enterprise-staging-gates.yml", import.meta.url),
  "utf8",
);
const authorityQaWorkflow = await readFile(
  new URL("../../.github/workflows/enterprise-authority-scope-neon-qa.yml", import.meta.url),
  "utf8",
);
const apiPackage = JSON.parse(await readFile(
  new URL("../../apps/api/package.json", import.meta.url),
  "utf8",
));

test("enterprise staging workflow defaults to the authoritative 0057-0096 preflight", () => {
  assert.match(workflow, /default: current_0057_0096_preflight/);
  assert.match(workflow, /Current enterprise schema and custody preflight \(0057-0096\)/);
  assert.match(workflow, /npm run check:migrations:safety/);
  assert.match(workflow, /npm run test:migration-gates/);
  assert.match(workflow, /npm run db:enterprise-release:preflight --workspace=api/);
  assert.match(workflow, /DATABASE_URL: \$\{\{ secrets\.STAGING_RUNTIME_DATABASE_URL \}\}/);
  assert.match(workflow, /NEXID_RUNTIME_DB_ROLE: \$\{\{ vars\.STAGING_RUNTIME_DB_ROLE \}\}/);
  assert.match(workflow, /SDK_IDEMPOTENCY_MASTER_KEY_HEX: \$\{\{ secrets\.SDK_IDEMPOTENCY_MASTER_KEY_HEX \}\}/);
  assert.doesNotMatch(workflow, /db-enterprise-release-dry-run/);
});

test("historical 0050-0056 tooling is selectable only through explicit legacy options", () => {
  for (const option of [
    "legacy_0050_0056_preflight",
    "legacy_0050_0056_after_0050_dry_run",
    "legacy_0050_0056_postcheck",
  ]) {
    assert.match(workflow, new RegExp(`- ${option}`));
    assert.match(workflow, new RegExp(`inputs\\.migration_phase == '${option}'`));
  }

  assert.doesNotMatch(workflow, /^\s+- preflight\s*$/m);
  assert.doesNotMatch(workflow, /^\s+- after_0050_dry_run\s*$/m);
  assert.doesNotMatch(workflow, /^\s+- postcheck\s*$/m);
  assert.match(workflow, /not current enterprise release/);
});

test("workflow remains non-deploying and least-privileged", () => {
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.match(workflow, /actions\/checkout@11bd71901bbe5b1630ceea73d27597364c9af683/);
  assert.match(workflow, /actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020/);
  assert.doesNotMatch(workflow, /actions\/(?:checkout|setup-node)@v\d/);
  assert.doesNotMatch(workflow, /\b(?:db:migrate|db-apply|apply:staging:v2|prisma migrate deploy)\b/);
});

test("migration-owner URL is scoped only to the four legacy database steps", () => {
  const ownerUrlOccurrences = workflow.match(
    /STAGING_DATABASE_URL: \$\{\{ secrets\.STAGING_DATABASE_URL \}\}/g,
  ) || [];
  assert.equal(ownerUrlOccurrences.length, 4);
  const jobsPrefix = workflow.slice(0, workflow.indexOf("    steps:"));
  assert.doesNotMatch(jobsPrefix, /STAGING_DATABASE_URL/);

  const namedStepBlocks = new Map(workflow
    .split(/\n      - name: /)
    .slice(1)
    .map((block) => {
      const [name, ...body] = block.split("\n");
      return [name, body.join("\n")];
    }));

  for (const stepName of [
    "Legacy migration baseline preflight (before 0050-0056)",
    "Legacy transactional dry-run (after committed 0050)",
    "Legacy PostgreSQL postcheck (0050-0056)",
    "Legacy PostgreSQL and IOTA read-only gates (0050-0056)",
  ]) {
    assert.match(namedStepBlocks.get(stepName) || "", /env:[\s\S]*STAGING_DATABASE_URL:/);
  }
  for (const [stepName, block] of namedStepBlocks) {
    if (!stepName.startsWith("Legacy ")) {
      assert.doesNotMatch(block, /STAGING_DATABASE_URL/, stepName);
    }
  }
});

test("authority races have a separate manual disposable-Neon workflow", () => {
  assert.match(authorityQaWorkflow, /workflow_dispatch:/);
  assert.doesNotMatch(authorityQaWorkflow, /^\s{2}(?:push|pull_request|schedule|workflow_call):/m);
  assert.match(authorityQaWorkflow, /Type RUN_DISPOSABLE_NEON_AUTHORITY_SCOPE_QA/);
  assert.match(authorityQaWorkflow, /test "\$RUN_CONFIRMATION" = "RUN_DISPOSABLE_NEON_AUTHORITY_SCOPE_QA"/);
  assert.match(authorityQaWorkflow, /environment: disposable-neon-qa/);
  assert.match(authorityQaWorkflow, /group: enterprise-authority-scope-neon-qa/);
  assert.match(authorityQaWorkflow, /cancel-in-progress: false/);
  assert.match(authorityQaWorkflow, /actions\/checkout@11bd71901bbe5b1630ceea73d27597364c9af683/);
  assert.match(authorityQaWorkflow, /actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020/);
  assert.doesNotMatch(authorityQaWorkflow, /actions\/(?:checkout|setup-node)@v\d/);
  assert.match(authorityQaWorkflow, /persist-credentials: false/);
  assert.match(authorityQaWorkflow, /secrets\.NEXID_AUTHORITY_SCOPE_QA_DATABASE_URL/);
  assert.deepEqual(
    [...authorityQaWorkflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((match) => match[1]),
    ["NEXID_AUTHORITY_SCOPE_QA_DATABASE_URL"],
  );
  assert.match(authorityQaWorkflow, /RUN_NEXID_SUN_ATOMIC_QA:\$\{\{ vars\.NEXID_AUTHORITY_SCOPE_QA_EXPECTED_ENDPOINT_ID \}\}:\$\{\{ vars\.NEXID_AUTHORITY_SCOPE_QA_DATABASE_NAME \}\}/);
  assert.match(authorityQaWorkflow, /npm run db:authority-scope:qa --workspace=api/);
  assert.equal(
    apiPackage.scripts["db:authority-scope:qa"],
    "node scripts/validate-authority-scope-postgres-qa.mjs",
  );
  assert.doesNotMatch(authorityQaWorkflow, /STAGING_|PRODUCTION_/);
  assert.doesNotMatch(authorityQaWorkflow, /db:migrate|db-apply|prisma migrate|deploy|KMS|HSM/i);
  assert.doesNotMatch(authorityQaWorkflow, /STAGING_DATABASE_URL|PRODUCTION_DATABASE_URL|DATABASE_URL:\s*\$\{\{ secrets\.(?:DATABASE_URL|POSTGRES_URL)/);
});
