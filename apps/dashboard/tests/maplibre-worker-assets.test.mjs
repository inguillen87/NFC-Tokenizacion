import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareMapLibreAssets, MAPLIBRE_ASSET_VERSION, MAPLIBRE_ASSET_FILES } from '../../../scripts/prepare-maplibre-assets.mjs';
import { configureMapLibreWorker, MAPLIBRE_WORKER_URL } from '../../../packages/ui/src/maplibre-worker.ts';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const packageRoot = dirname(fileURLToPath(import.meta.resolve('maplibre-gl/package.json')));
test('map worker URL is same-origin, versioned and configures no provider or map data', () => {
  const calls = []; configureMapLibreWorker({ setWorkerUrl: value => calls.push(value) });
  assert.deepEqual(calls, [MAPLIBRE_WORKER_URL]);
  assert.equal(MAPLIBRE_WORKER_URL, `/vendor/maplibre-gl/${MAPLIBRE_ASSET_VERSION}/maplibre-gl-worker.mjs`);
  assert.ok(!MAPLIBRE_WORKER_URL.includes('://'));
});
for (const application of ['dashboard', 'web']) {
  test(`${application} generates the exact locked worker pair and license without changing their names or bytes`, async () => {
    const result = await prepareMapLibreAssets(application);
    assert.equal(result.version, JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')).version);
    const directory = join(root, 'apps', application, 'public', 'vendor', 'maplibre-gl', result.version);
    assert.deepEqual((await readdir(directory)).sort(), [...MAPLIBRE_ASSET_FILES].sort());
    for (const file of result.files) {
      const source = await readFile(join(packageRoot, file.name === 'LICENSE.txt' ? '' : 'dist', file.name));
      const target = join(directory, file.name);
      assert.deepEqual(await readFile(target), source);
      const before = (await stat(target)).mtimeMs;
      await prepareMapLibreAssets(application);
      assert.equal((await stat(target)).mtimeMs, before, 'identical assets are not rewritten on config re-evaluation');
    }
  });
}
test('asset preparation refuses arbitrary filesystem destinations', async () => {
  for (const value of ['api', '../other', '', null]) await assert.rejects(prepareMapLibreAssets(value), /Unsupported/);
});
test('both actual Next configs generate the assets even when npm install scripts are disabled', async () => {
  for (const application of ['dashboard', 'web']) {
    const source = await readFile(join(root, 'apps', application, 'next.config.mjs'), 'utf8');
    assert.match(source, new RegExp(`await prepareMapLibreAssets\\('${application}'\\)`));
  }
});
test('every production map configures the worker before creating its Map', async () => {
  for (const path of ['apps/dashboard/src/components/realtime-maplibre-map.tsx', 'apps/web/src/app/sun/sun-passport-map.tsx', 'packages/ui/src/real-geographic-map.tsx']) {
    const source = await readFile(join(root, path), 'utf8');
    const configured = source.indexOf('configureMapLibreWorker(maplibre)');
    const created = source.indexOf('new maplibre.Map(');
    assert.ok(configured > 0 && created > configured, path);
  }
});
test('generated split worker imports resolve to the retained module rather than missing hashed filenames', async () => {
  await prepareMapLibreAssets('dashboard');
  const directory = join(root, 'apps/dashboard/public/vendor/maplibre-gl', MAPLIBRE_ASSET_VERSION);
  const source = await readFile(join(directory, 'maplibre-gl-worker.mjs'), 'utf8');
  const imports = [...source.matchAll(/from[\s]*["']\.\/([^"']+)["']/g)].map(match => match[1]);
  assert.ok(imports.includes('maplibre-gl-shared.mjs'));
  for (const imported of imports) assert.ok(MAPLIBRE_ASSET_FILES.includes(imported));
});
