import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = fs.existsSync(path.join(process.cwd(), 'apps'))
  ? process.cwd()
  : path.resolve(process.cwd(), '../..');

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

test('runtime SQL paths do not hard-cast to custom enum types that may be missing', () => {
  const runtimeFiles = [
    'apps/api/src/lib/tap-event-service.ts',
    'apps/api/src/app/admin/analytics/route.ts',
    'apps/api/src/app/admin/events/route.ts',
    'apps/api/src/app/admin/tags/route.ts',
    'apps/api/src/app/admin/tags/[uid]/passport/route.ts',
  ];

  const forbiddenCasts = ['::scan_source', '::event_type', '::risk_level', '::geo_precision'];

  for (const rel of runtimeFiles) {
    const content = read(rel);
    for (const castToken of forbiddenCasts) {
      assert.equal(content.includes(castToken), false, `unexpected enum cast ${castToken} in ${rel}`);
    }
  }
});
