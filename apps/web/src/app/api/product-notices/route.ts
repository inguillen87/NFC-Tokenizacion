export const runtime='nodejs';export const dynamic='force-dynamic';
import {productUrls} from '@product/config';
import {noticeScope,parseProductNotices,boundedNoticeJson} from '../../../lib/product-notices';
const headers={'cache-control':'no-store','x-content-type-options':'nosniff'};
export async function GET(req:Request){
 try{const q=new URL(req.url).searchParams,{tenant,bid}=noticeScope(q.get('tenant'),q.get('bid'));const url=new URL('/public/product-notices',productUrls.api);url.search=new URLSearchParams({tenant,bid}).toString();
 const upstream=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(6500)});if(!upstream.ok)throw Error('notice_upstream_unavailable');
 return Response.json(parseProductNotices(await boundedNoticeJson(upstream),tenant,bid),{headers});
 }catch{return Response.json({ok:false,reason:'product_notices_unavailable'},{status:503,headers});}
}
