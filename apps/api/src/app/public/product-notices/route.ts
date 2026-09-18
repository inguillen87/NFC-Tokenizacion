export const runtime='nodejs';export const dynamic='force-dynamic';
import {publicRecallNotices} from '../../../lib/recall-service';
import {recallFailure} from '../../../lib/recall-policy';
import {json} from '../../../lib/http';
export async function GET(req:Request){try{const q=new URL(req.url).searchParams;return json(await publicRecallNotices(q.get('tenant')||'',q.get('bid')||''),200,{'cache-control':'no-store','x-content-type-options':'nosniff'});}catch(e){const f=recallFailure(e);return json({ok:false,reason:f.reason},f.status,{'cache-control':'no-store'});}}
