import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolveSunDemoPhotography } from '../src/app/sun/sun-demo-photography.ts';
import { resolveSunEntry } from '../src/app/sun/sun-availability.ts';

const context = { isDemoPreview: true, isDemoLabHandoff: false, visual: 'rutini', vertical: 'vino' };

test('Official photographic reference is an explicit wine demo selection', () => {
  const photo = resolveSunDemoPhotography(context);
  assert.equal(photo.name, 'Apartado Gran Malbec');
  assert.equal(photo.brand, 'Rutini Wines');
  assert.equal(photo.imageUrl, '/sun/references/rutini-apartado.webp');
  assert.equal(photo.sourceUrl, 'https://rutiniwines.com/apartado/');
  assert.equal(photo.lot, 'MUESTRA-VISUAL');
  for (const overrides of [{ isDemoPreview: false }, { isDemoLabHandoff: true }, { visual: '' }, { visual: 'https://example.org/photo.jpg' }, { visual: 'RUTINI' }, { vertical: 'perfume' }, { vertical: 'agro' }]) {
    assert.equal(resolveSunDemoPhotography({ ...context, ...overrides }), null);
  }
});

test('NFC, QR and snapshot markers take precedence over a requested demo photograph', () => {
  const input = { isQrScan: false, demoRequested: true, snapshotId: '', snapshotTrace: '', snapshotAccess: '', freshToken: '', hasSnapshotMarker: false, hasDynamicMarker: false, dynamic: ['', '', '', '', ''] };
  assert.equal(resolveSunEntry(input), 'demo');
  for (const overrides of [{ isQrScan: true }, { hasSnapshotMarker: true }, { hasDynamicMarker: true }, { snapshotId: '123' }, { freshToken: 'test' }, { dynamic: ['1', 'batch', 'test', 'test', 'test'] }]) {
    assert.notEqual(resolveSunEntry({ ...input, ...overrides }), 'demo');
  }
});

test('Reference has no fabricated sensory or vintage data and never changes real product media selection', async () => {
  const page = await readFile(new URL('../src/app/sun/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /usesDemoTastingProfile = isDemoPreview && !demoPhotography && !hasDeclaredTastingProfile/);
  assert.match(page, /isWineProduct && !demoPhotography &&/);
  assert.match(page, /vintage: !photography && demoProduct\.vertical/);
  assert.match(page, /barrelMonths: !photography && demoProduct\.vertical/);
  assert.match(page, /storage: photography \? null/);
  assert.match(page, /const productHeroImageUrl = isDemoPreview[\s\S]*?: productImageUrl \|\| productGalleryUrls\[0\] \|\| null/);
});
