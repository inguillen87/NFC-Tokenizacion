export type BatchWorkRow={id:string;bid:string;tenant:string;name:string;sku:string;brand:string;carrier:string;status:string;quantity:number;active:number;inactive:number;revoked:number;editorial:boolean;expected:number|null};
export type BatchWorkSource={state:'ready';rows:BatchWorkRow[]}|{state:'unavailable'|'invalid'|'forbidden';rows:null};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function text(v:unknown,max=200):string{if(v==null)return '';if(typeof v!=='string'||v.length>max)throw new Error('batch_text');return v;}
function count(v:unknown):number{if(!Number.isSafeInteger(v)||Number(v)<0)throw new Error('batch_count');return Number(v);}
export function parseBatchWorkRows(value:unknown,tenant:string):BatchWorkRow[]{
 if(!Array.isArray(value)||value.length>300)throw new Error('batch_list');
 const seen=new Set<string>();return value.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row)||!ID.test(row.id))throw new Error('batch_row');
  const bid=text(row.bid,160),slug=text(row.tenant_slug,128);
  if(!bid||!slug||tenant&&slug!==tenant||seen.has(slug+':'+bid))throw new Error('batch_scope');seen.add(slug+':'+bid);
  const quantity=count(row.quantity),active=count(row.active_tags),inactive=count(row.inactive_tags),revoked=count(row.revoked_tags);
  if(active+inactive+revoked>quantity)throw new Error('batch_count');
  return {id:row.id,bid,tenant:slug,name:text(row.product_name),sku:text(row.sku),brand:text(row.winery),carrier:text(row.carrier_label||row.carrier_profile_code),status:text(row.status,40),quantity,active,inactive,revoked,editorial:row.editorial_managed===true,expected:row.requested_quantity==null?null:count(row.requested_quantity)};
 });
}
export function filterBatchWorkRows(rows:BatchWorkRow[],input:{query:string;tenant:string;state:string}){
 const query=input.query.trim().toLocaleLowerCase('es-AR');return rows.filter(row=>(!input.tenant||row.tenant===input.tenant)&&(!query||[row.bid,row.name,row.sku,row.brand,row.tenant].some(v=>v.toLocaleLowerCase('es-AR').includes(query)))&&(input.state==='all'||(input.state==='needs-product'?!row.name:input.state==='awaiting-units'?row.quantity===0:row.status===input.state)));
}
export function batchWorkHref(row:BatchWorkRow,task:'detail'|'product'|'units'){
 const base=`/batches/${encodeURIComponent(row.bid)}`;const query=new URLSearchParams({tenant:row.tenant}).toString();
 return task==='product'&&row.editorial?`${base}/passport?${query}`:`${base}?${query}${task==='product'?'#dossier-product':task==='units'?'#dossier-units':''}`;
}
