import {createHash} from 'node:crypto';
import {sql,type SqlExecutor} from './db';
import {getConsumerFromRequest,isConsumerSessionAccountActive} from './consumer-auth';
import {canonicalConsumerTapEventId} from './consumer-tap-detail';
export const CONSUMER_HISTORY_PROTOCOL='nexid.consumer-history.v1';
export type HistoryQuery={tenant:string;from:string;to:string;event:string};
export class HistoryError extends Error{constructor(public code:string,public status=400){super(code);}}
const fail=(condition:unknown,code='history_query_invalid',status=400)=>{if(!condition)throw new HistoryError(code,status);};
const instant=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,19)===s.slice(0,19);
function day(s:string){fail(/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);return s;}
export function historyQuery(p:URLSearchParams):HistoryQuery{
 for(const k of p.keys())fail(['tenant','from','to','event','cursor'].includes(k)&&p.getAll(k).length===1);
 const q={tenant:p.get('tenant')||'',from:p.get('from')||'',to:p.get('to')||'',event:p.get('event')||''};
 fail(!q.tenant||/^[a-z0-9][a-z0-9._-]{0,119}$/.test(q.tenant));fail(!q.event||canonicalConsumerTapEventId(q.event));
 fail(Boolean(q.from)===Boolean(q.to));if(q.from){day(q.from);day(q.to);const n=Date.parse(q.to)-Date.parse(q.from);fail(n>=0&&n<366*86400000,'history_period_invalid');}
 return q;
}
export const historyAccountKey=(id:string)=>createHash('sha256').update('consumer-history:'+id).digest('hex');
type Cursor={v:1;account:string;query:HistoryQuery;cutoff:string;page:number;last:{id:string;at:string}|null};
export function historyCursor(raw:string|null,account:string,query:HistoryQuery,now=Date.now()):Cursor|null{
 if(!raw)return null;fail(raw.length<=2048&&/^[A-Za-z0-9_-]+$/.test(raw),'history_cursor_invalid',409);
 try{
  const b=Buffer.from(raw,'base64url');fail(b.toString('base64url')===raw);const c=JSON.parse(b.toString('utf8')) as Cursor;
  fail(c.v===1&&c.account===account&&JSON.stringify(c.query)===JSON.stringify(query)&&instant(c.cutoff)&&Number.isSafeInteger(c.page)&&c.page>0&&c.page<=10000);
  fail(Date.parse(c.cutoff)<=now+60000&&now-Date.parse(c.cutoff)<4*3600000);
  fail(c.page===1?c.last===null:Boolean(c.last&&canonicalConsumerTapEventId(c.last.id)&&instant(c.last.at)&&c.last.at<=c.cutoff));return c;
 }catch{throw new HistoryError('history_cursor_changed_or_expired',409);}
}
const encode=(c:Cursor)=>Buffer.from(JSON.stringify(c)).toString('base64url');
function text(v:unknown,max=200){return typeof v==='string'?v.trim().slice(0,max)||null:null;}
export async function readConsumerHistory(id:string,q:HistoryQuery,rawCursor:string|null,executor:SqlExecutor=sql){
 fail(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id),'history_account_invalid',401);
 const account=historyAccountKey(id),c=historyCursor(rawCursor,account,q),start=q.from?q.from+'T00:00:00Z':null,end=q.to?new Date(Date.parse(q.to)+86400000).toISOString():null;
 const r=(await executor`WITH actor AS MATERIALIZED (
 SELECT id FROM consumers WHERE id=${id}::uuid AND status IN ('anonymous','registered','verified')
 ), cutoff AS MATERIALIZED (SELECT coalesce(${c?.cutoff||null}::timestamptz,statement_timestamp()) at),
 candidates AS MATERIALIZED (
 SELECT h.id,h.tap_event_id,h.tenant_id,h.verdict,h.risk_level,h.city,h.country,h.created_at,t.slug tenant_slug,t.name tenant_name
 FROM consumer_tap_history h JOIN actor a ON a.id=h.consumer_id JOIN tenants t ON t.id=h.tenant_id CROSS JOIN cutoff z
 WHERE h.created_at<=z.at AND (${q.tenant}='' OR t.slug=${q.tenant}) AND (${q.event}='' OR h.tap_event_id=${q.event||null}::bigint)
 AND (${start}::timestamptz IS NULL OR h.created_at>=${start}::timestamptz) AND (${end}::timestamptz IS NULL OR h.created_at<${end}::timestamptz)
 AND (${c?.last?.at||null}::timestamptz IS NULL OR (h.created_at,h.id)<(${c?.last?.at||null}::timestamptz,${c?.last?.id||null}::bigint))
 ORDER BY h.created_at DESC,h.id DESC LIMIT 26
 ), selected AS MATERIALIZED (SELECT * FROM candidates ORDER BY created_at DESC,id DESC LIMIT 25),
 projected AS (
 SELECT h.id::text row_id,h.tap_event_id::text,h.verdict,h.risk_level,h.city,h.country,h.tenant_slug,h.tenant_name,
 to_char(h.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') saved_at,
 (SELECT jsonb_agg(p) FROM (SELECT cp.product_name,cp.brand_name FROM consumer_products cp JOIN actor a ON a.id=cp.consumer_id WHERE cp.tenant_id=h.tenant_id AND (cp.first_tap_event_id=h.tap_event_id OR cp.latest_tap_event_id=h.tap_event_id) ORDER BY cp.id LIMIT 2) p) product
 FROM selected h
 ), brands AS (
 SELECT t.slug,t.name FROM tenants t WHERE EXISTS(SELECT 1 FROM consumer_tap_history h JOIN actor a ON a.id=h.consumer_id WHERE h.tenant_id=t.id) ORDER BY t.slug LIMIT 51
 )
 SELECT EXISTS(SELECT 1 FROM actor) authorized,(SELECT coalesce(jsonb_agg(p ORDER BY p.saved_at DESC,p.row_id::bigint DESC),'[]'::jsonb) FROM projected p) items,
 (SELECT count(*)>25 FROM candidates) more,(SELECT coalesce(jsonb_agg(b ORDER BY b.slug),'[]'::jsonb) FROM brands b) brands,
 (SELECT to_char(at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') FROM cutoff) cutoff,
 statement_timestamp() observed_at`)[0];
 if(r?.authorized===false)throw new HistoryError('history_unauthorized',401);
 if(!r||r.authorized!==true||!Array.isArray(r.items)||!Array.isArray(r.brands)||!instant(r.cutoff)||typeof r.more!=='boolean'||(!(r.observed_at instanceof Date)&&typeof r.observed_at!=='string'))throw new HistoryError('history_stored_data_invalid',503);
 const items=r.items.map((x:any)=>{
  fail(canonicalConsumerTapEventId(x.row_id)&&canonicalConsumerTapEventId(x.tap_event_id)&&instant(x.saved_at),'history_stored_data_invalid',503);
  const product=Array.isArray(x.product)&&x.product.length===1?x.product[0]:null,name=text(product?.product_name),hidden=name&&/^Producto\s+[a-f\d]{8,64}$/i.test(name);
  return {row_id:x.row_id,tap_event_id:x.tap_event_id,created_at:x.saved_at,verdict:text(x.verdict,80),risk_level:text(x.risk_level,80),city:text(x.city,160),country:text(x.country,160),tenant_slug:text(x.tenant_slug,120),tenant_name:text(x.tenant_name),product_name:hidden?null:name,brand_name:text(product?.brand_name)};
 });
 const current:Cursor={v:1,account,query:q,cutoff:r.cutoff,page:c?.page||1,last:c?.last||null};
 const last=items.at(-1),next=r.more&&last?encode({...current,page:current.page+1,last:{at:last.created_at,id:last.row_id}}):null;
 return {ok:true,protocol:CONSUMER_HISTORY_PROTOCOL,source:'database',accountKey:account,observedAt:new Date(r.observed_at).toISOString(),query:q,items,brands:r.brands.slice(0,50).map((b:any)=>({slug:text(b.slug,120),name:text(b.name)||text(b.slug,120)})),moreBrands:r.brands.length>50,navigation:{page:current.page,pageSize:25,returned:items.length,hasNext:Boolean(next),cursor:encode(current),nextCursor:next,cutoff:r.cutoff},timeBasis:'saved_to_account',readOnly:true};
}
export async function consumerHistoryRequest(req:Request,resolver:(req:Request)=>Promise<any>=getConsumerFromRequest){
 const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
 try{
  if(req.method!=='GET')return Response.json({ok:false,error:'method_not_allowed'},{status:405,headers});
  const consumer=await resolver(req);if(!consumer||!isConsumerSessionAccountActive(consumer.status))return Response.json({ok:false,error:'unauthorized'},{status:401,headers});
  const p=new URL(req.url).searchParams,q=historyQuery(p),result=await readConsumerHistory(String(consumer.id),q,p.get('cursor'));
  if(Buffer.byteLength(JSON.stringify(result),'utf8')>131072)throw new HistoryError('history_response_limit',503);
  return Response.json(result,{headers});
 }catch(e){const x=e instanceof HistoryError?e:new HistoryError('history_source_unavailable',503);return Response.json({ok:false,error:x.code},{status:x.status,headers});}
}
