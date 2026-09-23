import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
// No provider, production DB or inherited application credentials reach tests.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|TMPDIR|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|CI)$/i.test(key)));
Object.assign(env, { NODE_ENV: 'test', VERCEL_ENV: 'test', NEXT_TELEMETRY_DISABLED: '1' });
const files = ['dependency-release-security', 'tag-manifest', 'consumer-otp-delivery']
  .map(name => `apps/api/tests/${name}.test.mjs`);
const result = spawnSync(process.execPath, [
  '--require', resolve(root, 'scripts/qa/s7-loopback-only.cjs'),
  '--import', 'tsx', '--test', ...files,
], { cwd: root, env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
