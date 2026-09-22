import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
export const MAPLIBRE_ASSET_VERSION = '6.4.1';
export const MAPLIBRE_ASSET_FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs', 'LICENSE.txt'];
const repository = fileURLToPath(new URL('../', import.meta.url));
/** Build-time copy only: no network, tokens, generated source changes or data files. */
export async function prepareMapLibreAssets(application) {
  if (!['dashboard', 'web'].includes(application)) throw Error('Unsupported map application');
  const packageFile = fileURLToPath(import.meta.resolve('maplibre-gl/package.json'));
  const packageRoot = dirname(packageFile);
  const manifest = JSON.parse(await readFile(packageFile, 'utf8'));
  if (manifest.version !== MAPLIBRE_ASSET_VERSION) throw Error('Map worker version needs an explicit compatibility review');
  const destination = join(repository, 'apps', application, 'public', 'vendor', 'maplibre-gl', MAPLIBRE_ASSET_VERSION);
  await mkdir(destination, { recursive: true });
  const files = [];
  for (const name of MAPLIBRE_ASSET_FILES) {
    const data = await readFile(join(packageRoot, name === 'LICENSE.txt' ? '' : 'dist', name));
    if (!data.length || data.length > 8_388_608) throw Error('Invalid map distribution asset');
    const target = join(destination, name);
    const previous = await readFile(target).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
    if (!previous?.equals(data)) await writeFile(target, data);
    files.push({ name, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
  }
  return { application, version: MAPLIBRE_ASSET_VERSION, files };
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  console.log(JSON.stringify(await prepareMapLibreAssets(process.argv[2])));
}
