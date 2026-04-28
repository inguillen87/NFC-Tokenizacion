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

test('runtime SQL paths do not hard-cast to scan_source type', () => {
  const files = [
    'apps/api/src/lib/tap-event-service.ts',
    'apps/api/src/app/admin/analytics/route.ts',
    'apps/api/src/app/admin/events/route.ts',
    'apps/api/src/app/admin/tags/route.ts',
    'apps/api/src/app/admin/tags/[uid]/passport/route.ts',
  ];

  for (const rel of files) {
    const content = read(rel);
    assert.equal(content.includes('::scan_source'), false, `unexpected scan_source cast in ${rel}`);
  }
});
