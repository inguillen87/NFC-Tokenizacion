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

function listRuntimeSourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listRuntimeSourceFiles(absolutePath);
    return /\.(?:ts|tsx|js|mjs)$/.test(entry.name) ? [absolutePath] : [];
  });
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

test('event scan_source comparisons cast the enum column instead of text parameters', () => {
  const runtimeRoot = path.join(repoRoot, 'apps/api/src');
  const runtimeFiles = listRuntimeSourceFiles(runtimeRoot);
  const enumComparedToText = /\b(?:e|event)\.source\s*(?:=|<>|!=)\s*\$\{[^}]+\}::text/g;
  const enumCoalescedWithText = /COALESCE\(\s*(?:e|event)\.source\s*,/gi;

  for (const absolutePath of runtimeFiles) {
    const content = fs.readFileSync(absolutePath, 'utf8');
    const rel = path.relative(repoRoot, absolutePath);
    assert.equal(
      enumComparedToText.test(content),
      false,
      `scan_source must be cast on the column side before comparing with text in ${rel}`,
    );
    enumComparedToText.lastIndex = 0;
    assert.equal(
      enumCoalescedWithText.test(content),
      false,
      `scan_source must be cast to text before COALESCE with text in ${rel}`,
    );
    enumCoalescedWithText.lastIndex = 0;
  }

  const analytics = read('apps/api/src/app/admin/analytics/route.ts');
  const tags = read('apps/api/src/app/admin/tags/route.ts');
  const passport = read('apps/api/src/app/admin/tags/[uid]/passport/route.ts');
  assert.match(analytics, /e\.source::text = \$\{source\}/);
  assert.match(tags, /e\.source::text = \$\{source\}/);
  assert.match(passport, /e\.source::text = \$\{source\}/);
});

test('qr scans keep channel in reason/meta instead of tag_status enum', () => {
  const content = read('apps/api/src/app/sun/route.ts');
  assert.equal(content.includes('tagStatus: "qr_scan"'), false);
  assert.equal(content.includes('reason: "qr_scan"'), true);
  assert.equal(content.includes('channel: "qr"'), true);
});
