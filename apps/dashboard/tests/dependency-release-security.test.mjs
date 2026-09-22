import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
const root = new URL('../../../', import.meta.url);
const json = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const minimums = { next: '16.3.3', 'maplibre-gl': '6.4.1', nodemailer: '9.1.1', sharp: '0.35.4', postcss: '8.5.23', 'csv-parse': '7.0.2', nanoid: '3.3.18', 'adm-zip': '0.6.1', qs: '6.16.0' };
function atLeast(actual, minimum) {
  if (!/^\d+\.\d+\.\d+$/.test(actual || '')) return false;
  const a = actual.split('.').map(Number), b = minimum.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
  return true;
}
for (const [name, minimum] of Object.entries(minimums)) {
  test(`release lock excludes every vulnerable ${name} copy below ${minimum}`, async () => {
    const lock = await json('package-lock.json');
    const copies = Object.entries(lock.packages).filter(([path]) => path.endsWith(`/node_modules/${name}`) || path === `node_modules/${name}`);
    assert.ok(copies.length > 0, `${name} must still be represented, not silently removed`);
    for (const [path, value] of copies) assert.ok(atLeast(value.version, minimum), `${path}: ${value.version}`);
  });
}
for (const workspace of ['apps/api', 'apps/dashboard', 'apps/web']) {
  test(`${workspace} pins the patched Next version and its lock agrees`, async () => {
    const manifest = await json(`${workspace}/package.json`), lock = await json('package-lock.json');
    const requested = manifest.dependencies.next;
    assert.ok(atLeast(requested, minimums.next));
    assert.equal(lock.packages[workspace].dependencies.next, requested);
    const installed = lock.packages[`${workspace}/node_modules/next`] || lock.packages['node_modules/next'];
    assert.equal(installed.version, requested, 'a lock that retains an older hoisted Next is invalid');
  });
}
test('MapLibre consumers use one patched major without removing the existing map implementation', async () => {
  const versions = [];
  for (const workspace of ['apps/dashboard', 'apps/web', 'packages/ui']) {
    const manifest = await json(`${workspace}/package.json`);
    assert.ok(atLeast(manifest.dependencies['maplibre-gl'], minimums['maplibre-gl']));
    versions.push(manifest.dependencies['maplibre-gl']);
  }
  assert.equal(new Set(versions).size, 1);
});
test('patched image and CSS dependencies keep explicit root override references', async () => {
  const manifest = await json('package.json');
  assert.equal(manifest.overrides.next.postcss, '$postcss');
  assert.equal(manifest.overrides.next.sharp, '$sharp');
  assert.ok(atLeast(manifest.devDependencies.postcss, minimums.postcss));
  assert.ok(atLeast(manifest.optionalDependencies.sharp, minimums.sharp));
});
