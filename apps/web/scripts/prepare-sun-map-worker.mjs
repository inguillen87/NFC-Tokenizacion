import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
export async function prepareSunMapWorker() {
  const web=fileURLToPath(new URL('../',import.meta.url));
  const dist=dirname(fileURLToPath(import.meta.resolve('maplibre-gl')));
  const pkg=JSON.parse(await readFile(join(dist,'../package.json'),'utf8'));
  const manifest=JSON.parse(await readFile(join(web,'package.json'),'utf8'));
  if(pkg.version!=='6.4.1'||manifest.dependencies['maplibre-gl']!==pkg.version)throw Error('map_worker_version_mismatch');
  const config=await readFile(join(web,'src/lib/sun-map-worker.ts'),'utf8');
  if(!config.includes(`/maplibre/${pkg.version}/maplibre-gl-worker.mjs`))throw Error('map_worker_path_mismatch');
  const folder=join(web,'public/maplibre',pkg.version);
  await mkdir(folder,{recursive:true});
  const files=[];
  for(const name of ['maplibre-gl-worker.mjs','maplibre-gl-shared.mjs','LICENSE.txt']) {
    const from=name==='LICENSE.txt'?join(dist,'..',name):join(dist,name);
    const bytes=await readFile(from);
    await writeFile(join(folder,name),bytes);
    files.push({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  return {version:pkg.version,folder,files};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const result=await prepareSunMapWorker();console.log(JSON.stringify({mapWorker:result.version,files:result.files},null,2));
}
