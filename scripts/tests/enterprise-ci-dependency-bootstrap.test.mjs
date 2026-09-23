import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(new URL('../../.github/workflows/enterprise-ci-security-gate.yml', import.meta.url), 'utf8');
const install = 'npm ci --ignore-scripts --no-audit --no-fund';
function bootstrapValid(source) {
  const job = source.split('  policy-and-supply-chain:\n')[1]?.split('\n  api-and-sdk:\n')[0] || '';
  const audit = job.indexOf('node scripts/enterprise-dependency-audit.mjs');
  const dependencies = job.indexOf(install);
  const migrationTests = job.indexOf('npm run test:migration-gates');
  return audit >= 0 && dependencies > audit && migrationTests > dependencies;
}

test('policy job installs audited lockfile dependencies before pg-dependent migration tests', () => {
  assert.equal(bootstrapValid(workflow), true);
  assert.match(workflow, /node --test scripts\/tests\/enterprise-ci-security-workflow\.test\.mjs scripts\/tests\/enterprise-ci-dependency-bootstrap\.test\.mjs/);
});
test('regression: missing policy-job install fails even though downstream jobs install', () => {
  assert.equal(bootstrapValid(workflow.replace(install, 'echo dependencies not installed')), false);
});
test('regression: installing after migration tests is too late', () => {
  const late = workflow.replace(install, 'echo deferred').replace('npm run test:migration-gates', `npm run test:migration-gates\n          ${install}`);
  assert.equal(bootstrapValid(late), false);
});
test('regression: installation cannot enable lifecycle scripts', () => {
  assert.equal(bootstrapValid(workflow.replace(install, 'npm ci --no-audit --no-fund')), false);
});
test('regression: installation must remain lockfile-exact', () => {
  assert.equal(bootstrapValid(workflow.replace(install, 'npm install --ignore-scripts --no-audit --no-fund')), false);
});
