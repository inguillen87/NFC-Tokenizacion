export const runtime='nodejs';
export const dynamic='force-dynamic';
import {productUrls} from '@product/config';
import {boundedHistoryJson} from '../../../../me/taps/history-model';
const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
export async function GET(req:Request){
 const q=new URL(req.url).searchParams;
 if([...q.keys()].some(k=>!['tenant','from','to','event','cursor'].includes(k)||q.getAll(k).length!==1))return Response.json({ok:false,error:'history_query_invalid'},{status:400,headers});
 if(q.toString().length>2800)return Response.json({ok:false,error:'history_query_invalid'},{status:400,headers});
 try{
  const r=await fetch(productUrls.api+'/consumer/taps/history?'+q,{cache:'no-store',signal:AbortSignal.timeout(12000),headers:{cookie:req.headers.get('cookie')||'','user-agent':req.headers.get('user-agent')||'nexid-consumer-history'}});
  if(!r.ok)return Response.json({ok:false,error:r.status===401?'unauthorized':r.status===409?'history_cursor_changed_or_expired':'history_unavailable'},{status:[400,401,403,409].includes(r.status)?r.status:503,headers});
  return Response.json(await boundedHistoryJson(r),{headers});
 }catch{return Response.json({ok:false,error:'history_unavailable'},{status:503,headers});}
}
