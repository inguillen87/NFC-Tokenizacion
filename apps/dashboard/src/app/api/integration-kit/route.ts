export const runtime='nodejs';
export const dynamic='force-dynamic';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {getDashboardSession} from '../../../lib/session';
import {canDownloadIntegrationKit} from '../../../lib/integration-kit-policy';
import manifest from '../../../lib/integration-kit-manifest.json';
const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
export async function GET(){
 try {
  const session=await getDashboardSession();
  if(!session)return Response.json({ok:false,reason:'authentication_required'},{status:401,headers});
  if(!canDownloadIntegrationKit(session))return Response.json({ok:false,reason:'integration_download_forbidden'},{status:403,headers});
  let bytes:Buffer;
  try { bytes=await readFile(join(process.cwd(),'resources','integration-kit',manifest.filename)); }
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;bytes=await readFile(join(process.cwd(),'apps','dashboard','resources','integration-kit',manifest.filename));}
  if(bytes.length!==manifest.bytes||createHash('sha256').update(bytes).digest('hex')!==manifest.sha256)throw new Error('artifact_integrity');
  return new Response(new Uint8Array(bytes),{headers:{...headers,'content-type':'application/gzip','content-length':String(bytes.length),'content-disposition':`attachment; filename="${manifest.filename}"`,'x-content-sha256':manifest.sha256}});
 }catch(error){console.warn('[integration_kit_unavailable]',error instanceof Error?error.name:'unknown');return Response.json({ok:false,reason:'integration_kit_unavailable'},{status:503,headers});}
}
