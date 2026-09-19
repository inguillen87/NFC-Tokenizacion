export const runtime='nodejs';export const dynamic='force-dynamic';
import {productUrls} from '@product/config';import {noticeScope} from '../../../../lib/product-notices';
import {parseProductNoticesV2,boundedNoticeJson} from '../../../../lib/product-notices-v2';
const headers={'cache-control':'no-store','x-content-type-options':'nosniff'};
export async function GET(req:Request){try{const q=new URL(req.url).searchParams,{tenant,bid}=noticeScope(q.get('tenant'),q.get('bid'));const url=new URL('/public/product-notices/v2',productUrls.api);url.search=new URLSearchParams({tenant,bid}).toString();const r=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(6500)});if(!r.ok)throw Error();return Response.json(parseProductNoticesV2(await boundedNoticeJson(r),tenant,bid),{headers});}catch{return Response.json({ok:false,reason:'product_notices_v2_unavailable'},{status:503,headers});}}
