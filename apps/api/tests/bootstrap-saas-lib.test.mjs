import test from 'node:test';
import assert from 'node:assert/strict';
import { collectMissingBootstrapEnv, parseBootstrapArgs, shouldCreateDemoTenant } from '../scripts/bootstrap-saas-lib.mjs';

test('parseBootstrapArgs parses flags', () => {
  const parsed = parseBootstrapArgs(['--with-demo', '--dry-run']);
  assert.equal(parsed.withDemo, true);
  assert.equal(parsed.dryRun, true);
});

test('shouldCreateDemoTenant uses env or explicit flag', () => {
  assert.equal(shouldCreateDemoTenant({ demoModeEnv: 'true', withDemoFlag: false }), true);
  assert.equal(shouldCreateDemoTenant({ demoModeEnv: 'false', withDemoFlag: true }), true);
  assert.equal(shouldCreateDemoTenant({ demoModeEnv: 'false', withDemoFlag: false }), false);
});

test('collectMissingBootstrapEnv only returns missing key names', () => {
  const missing = collectMissingBootstrapEnv({ DATABASE_URL: 'x', SUPER_ADMIN_EMAIL: '', SUPER_ADMIN_PASSWORD: '' });
  assert.deepEqual(missing, ['SUPER_ADMIN_EMAIL', 'SUPER_ADMIN_PASSWORD']);
});
