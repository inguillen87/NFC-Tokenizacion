import {parseConsumerTap,type ConsumerTapItem} from '../_components/consumer-taps-model';
export type HistoryFilters={tenant:string;from:string;to:string;event:string};
export const EMPTY_HISTORY_FILTERS:HistoryFilters={tenant:'',from:'',to:'',event:''};
export type HistoryRow=ConsumerTapItem&{rowId:string;savedAt:string};
export type HistoryPage={accountKey:string;observedAt:string;query:HistoryFilters;items:HistoryRow[];brands:{slug:string;name:string}[];moreBrands:boolean;navigation:{page:number;pageSize:25;returned:number;hasNext:boolean;cursor:string;nextCursor:string|null;cutoff:string}};
const assert=(v:unknown)=>{if(!v)throw Error('La fuente no confirmó una página válida de tu historial.');};
const id=(x:unknown)=>typeof x==='string'&&/^[1-9][0-9]{0,18}$/.test(x)&&BigInt(x)<=9223372036854775807n;
const micro=(x:unknown):x is string=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(x)&&Number.isFinite(Date.parse(x));
const token=(x:unknown)=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,2048}$/.test(x);
export function historyParams(q:HistoryFilters,cursor:string|null=null){const p=new URLSearchParams();for(const key of ['tenant','from','to','event'] as const)if(q[key])p.set(key,q[key]);if(cursor)p.set('cursor',cursor);return p;}
export function parseHistory(raw:unknown,expected?:{query:HistoryFilters;page:number;account?:string;cutoff?:string}):HistoryPage{
 const r=raw as any,n=r?.navigation,q=r?.query;assert(r?.ok===true&&r.protocol==='nexid.consumer-history.v1'&&r.source==='database'&&r.readOnly===true&&r.timeBasis==='saved_to_account');
 assert(typeof r.accountKey==='string'&&/^[a-f0-9]{64}$/.test(r.accountKey)&&Number.isFinite(Date.parse(r.observedAt)));
 assert(q&&['tenant','from','to','event'].every(k=>typeof q[k]==='string'));assert(!q.tenant||/^[a-z0-9][a-z0-9._-]{0,119}$/.test(q.tenant));assert(!q.event||id(q.event));
 assert(Array.isArray(r.items)&&r.items.length<=25&&n?.pageSize===25&&n.returned===r.items.length&&Number.isSafeInteger(n.page)&&n.page>0&&n.page<=10000&&typeof n.hasNext==='boolean'&&token(n.cursor)&&micro(n.cutoff));
 assert(n.hasNext?n.returned===25&&token(n.nextCursor):n.nextCursor===null);
 if(expected){assert(Object.keys(expected.query).every(k=>q[k]===expected.query[k as keyof HistoryFilters])&&n.page===expected.page);assert(!expected.account||r.accountKey===expected.account);assert(!expected.cutoff||n.cutoff===expected.cutoff);}
 let previous:{at:string;id:string}|null=null;const seen=new Set<string>();
 const items=r.items.map((row:any)=>{
  assert(id(row.row_id)&&id(row.tap_event_id)&&micro(row.created_at)&&row.created_at<=n.cutoff&&!seen.has(row.row_id));seen.add(row.row_id);
  if(previous)assert(row.created_at<previous.at||row.created_at===previous.at&&BigInt(row.row_id)<BigInt(previous.id));previous={at:row.created_at,id:row.row_id};
  for(const k of ['verdict','risk_level','city','country','tenant_name','product_name','brand_name'])assert(row[k]===null||typeof row[k]==='string'&&row[k].length<=200);
  assert(typeof row.tenant_slug==='string'&&/^[a-z0-9][a-z0-9._-]{0,119}$/.test(row.tenant_slug)&&(!q.tenant||row.tenant_slug===q.tenant)&&(!q.event||row.tap_event_id===q.event));
  const parsed=parseConsumerTap(row);assert(parsed?.id);return {...parsed!,rowId:row.row_id,savedAt:row.created_at};
 });
 assert(Array.isArray(r.brands)&&r.brands.length<=50&&typeof r.moreBrands==='boolean');
 const brandKeys=new Set();for(const b of r.brands){assert(b&&typeof b.slug==='string'&&/^[a-z0-9][a-z0-9._-]{0,119}$/.test(b.slug)&&typeof b.name==='string'&&b.name.length<=200&&!brandKeys.has(b.slug));brandKeys.add(b.slug);}
 return {accountKey:r.accountKey,observedAt:r.observedAt,query:{tenant:q.tenant,from:q.from,to:q.to,event:q.event},items,brands:r.brands,moreBrands:r.moreBrands,navigation:{page:n.page,pageSize:25,returned:n.returned,hasNext:n.hasNext,cursor:n.cursor,nextCursor:n.nextCursor,cutoff:n.cutoff}};
}
export async function boundedHistoryJson(response:Response){if(!response.body)throw Error('Historial sin respuesta.');const reader=response.body.getReader(),parts:Uint8Array[]=[],max=131072;let size=0;try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>max)throw Error('La respuesta supera el límite de esta consulta.');parts.push(r.value);}const bytes=new Uint8Array(size);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}return JSON.parse(new TextDecoder().decode(bytes));}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}}
export function historySearch(rows:HistoryRow[],text:string){const q=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim().slice(0,160);return rows.filter(t=>!q||[t.id,t.productName,t.brandName,t.tenantName,t.tenantSlug,t.verdict,t.location].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').includes(q));}
export function informationalReading(row:ConsumerTapItem){return ['QR_VIEW','IDENTIFIED','IDENTIFIED_UNVERIFIED','GS1_RESOLVE'].includes(row.verdict||'');}
