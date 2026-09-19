export const runtime='nodejs';export const dynamic='force-dynamic';
import {publicNoticesV2,noticeFailure} from '../../../../lib/recall-notice-service';
export async function GET(req:Request){const headers={'cache-control':'no-store','x-content-type-options':'nosniff'};try{const q=new URL(req.url).searchParams;return Response.json(await publicNoticesV2(q.get('tenant')||'',q.get('bid')||''),{headers});}catch(e){const f=noticeFailure(e);return Response.json({ok:false,reason:f.reason},{status:f.status,headers});}}
