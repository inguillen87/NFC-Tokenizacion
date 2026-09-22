import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
// Deliberately exclude deployment credentials and any inherited database URL.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|TMPDIR|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|CI)$/i.test(key)));
Object.assign(env, { NODE_ENV: 'test', VERCEL_ENV: 'test', NEXT_TELEMETRY_DISABLED: '1' });
const files = [
  'current-passport-editorial', 'passport-editorial-policy', 'passport-library', 'admin-physical-taps', 'physical-tap-provenance', 'consumer-network-metrics', 'analytics-location-sql',
  'approximate-location-privacy', 'post-tap-location-realtime',
  'sun-context-location-binding', 'sun-context-snapshot-reconciliation',
  'sun-public-location-privacy', 'sun-snapshot-location-truth',
  'sun-request-location-realtime', 'sun-tap-location',
  'realtime-tap-projection', 'realtime-broker-payload-privacy',
  'realtime-stream-snapshot-bindings', 'realtime-stream-source',
  'realtime-stream-scope', 'mutable-tap-realtime-projection',
  'sdk-sensor-sun-source', 'sun-atomic-persistence', 'consumer-history',
].map(name => `apps/api/tests/${name}.test.mjs`);
const result = spawnSync(process.execPath, [
  '--require', resolve(root, 'scripts/qa/s7-loopback-only.cjs'),
  '--import', 'tsx', '--test', ...files,
], { cwd: root, env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
