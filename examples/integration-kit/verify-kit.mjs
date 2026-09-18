import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
try {
 const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
 if(manifest.kitVersion!=='1.0.0'||!Array.isArray(manifest.files)||manifest.files.length>60)throw new Error();
 for(const item of manifest.files){
  if(typeof item.path!=='string'||item.path.includes('..')||item.path.startsWith('/')||item.path.includes('\\'))throw new Error();
  const bytes=await readFile(join(root,item.path));
  if(bytes.length!==item.bytes||createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw new Error();
 }
 console.log(JSON.stringify({ok:true,kitVersion:manifest.kitVersion,files:manifest.files.length,networkRequests:0}));
}catch{console.error(JSON.stringify({ok:false,reason:'integration_kit_integrity_failed'}));process.exitCode=1;}
