import {parseBatchTrace,traceTimeline,type BatchTrace,type TraceEvent,type CustodyEvent} from './batch-traceability';
export type TraceQuery={source:'all'|'epcis'|'custody';type:string;gtin:string;lot:string;serial:string;exact:boolean};
export const emptyTraceQuery:TraceQuery={source:'all',type:'',gtin:'',lot:'',serial:'',exact:false};
export type TracePage={ok:true;protocol:'nexid.trace-page.v1';trace:BatchTrace;query:TraceQuery;navigation:{page:number;pageSize:50;currentCursor:string;returned:number;hasNext:boolean;nextCursor:string|null;cutoff:string;positions:{kind:'epcis'|'custody';id:string;at:string}[];consistency:'record_time_boundary_not_repeatable_snapshot';shipmentsBasis:'current_batch_records'}};
const types=['','relationships','ObjectEvent','AggregationEvent','AssociationEvent','TransformationEvent','TransactionEvent'];
export function normalizedTraceQuery(q:TraceQuery):TraceQuery{
 const next={...q,gtin:q.gtin.trim()};if(next.type||next.gtin)next.source='epcis';return next;
}
export function tracePageParams(tenant:string,from:string,to:string,query:TraceQuery,cursor:string|null=null){
 const q=normalizedTraceQuery(query);const p=new URLSearchParams({tenant,from,to,source:q.source});
 for(const k of ['type','gtin','lot','serial'] as const)if(q[k])p.set(k,q[k]);if(q.exact)p.set('exact','1');if(cursor)p.set('cursor',cursor);return p;
}
function micro(value:unknown):value is string{return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value)&&Number.isFinite(Date.parse(value));}
export function parseTracePage(raw:unknown,bid:string,tenant:string,expected?:{from:string;to:string;query:TraceQuery;page?:number;cutoff?:string;batchId?:string}):TracePage{
 const r=raw as TracePage;if(!r||r.ok!==true||r.protocol!=='nexid.trace-page.v1'||!r.query||!r.navigation)throw Error('trace_page_source');
 const trace=parseBatchTrace(r.trace,bid,tenant,expected),q=r.query,n=r.navigation;
 if(!['all','epcis','custody'].includes(q.source)||!types.includes(q.type)||typeof q.gtin!=='string'||!/^([0-9]{14})?$/.test(q.gtin)||typeof q.lot!=='string'||q.lot.length>20||typeof q.serial!=='string'||q.serial.length>20||typeof q.exact!=='boolean')throw Error('trace_page_query');
 if((q.lot||q.serial||q.exact)&&!q.gtin||((q.gtin||q.type)&&q.source!=='epcis')||q.source==='custody'&&trace.logisticsAccess!=='allowed')throw Error('trace_page_query');
 if(expected&&JSON.stringify(normalizedTraceQuery(expected.query))!==JSON.stringify(q))throw Error('trace_page_scope');
 if(n.pageSize!==50||!Number.isSafeInteger(n.page)||n.page<1||n.page>10000||expected?.page&&n.page!==expected.page||!Number.isSafeInteger(n.returned)||n.returned<0||n.returned>50||n.returned!==trace.events.length+trace.custody.length||typeof n.hasNext!=='boolean')throw Error('trace_page_count');
 if(n.hasNext?(typeof n.nextCursor!=='string'||!/^[-_A-Za-z0-9]{1,2048}$/.test(n.nextCursor)||n.returned!==50):n.nextCursor!==null)throw Error('trace_page_next');
 if(!micro(n.cutoff)||expected?.cutoff&&expected.cutoff!==n.cutoff||expected?.batchId&&expected.batchId!==trace.scope.batchId||n.consistency!=='record_time_boundary_not_repeatable_snapshot'||n.shipmentsBasis!=='current_batch_records')throw Error('trace_page_boundary');
 if(typeof n.currentCursor!=='string'||!/^[-_A-Za-z0-9]{1,2048}$/.test(n.currentCursor))throw Error('trace_page_current');
 if(!Array.isArray(n.positions)||n.positions.length!==n.returned)throw Error('trace_page_order');
 const lookup=new Map<string,TraceEvent|CustodyEvent>([...trace.events,...trace.custody].map(e=>[e.kind+':'+e.id,e]));let last:string|null=null;
 const positions=n.positions.map(p=>{
  if(!p||!['epcis','custody'].includes(p.kind)||!micro(p.at)||typeof p.id!=='string')throw Error('trace_page_position');
  const key=p.kind+':'+p.id,row=lookup.get(key);if(!row||new Date(p.at).toISOString()!==(row.kind==='epcis'?row.occurredAt:row.recordedAt))throw Error('trace_page_position');lookup.delete(key);
  const orderKey=p.at+':'+(p.kind==='epcis'?'1':'0')+':'+p.id.toLowerCase();if(last!==null&&last<=orderKey)throw Error('trace_page_order');last=orderKey;
  return {kind:p.kind,id:p.id,at:p.at};
 });
 if(lookup.size||q.source==='epcis'&&trace.custody.length||q.source==='custody'&&trace.events.length)throw Error('trace_page_source_leak');
 if(q.type&&trace.events.some(e=>q.type==='relationships'?!['AggregationEvent','AssociationEvent','TransformationEvent'].includes(e.type):e.type!==q.type))throw Error('trace_page_filter');
 if(q.gtin&&trace.events.some(e=>!e.omittedReferences&&!e.references.some(i=>i.focus&&i.gtin===q.gtin&&(!q.lot&&!q.exact||i.lot===q.lot)&&(!q.serial&&!q.exact||i.serial===q.serial))))throw Error('trace_page_filter');
 return {ok:true,protocol:r.protocol,trace,query:{source:q.source,type:q.type,gtin:q.gtin,lot:q.lot,serial:q.serial,exact:q.exact},navigation:{page:n.page,pageSize:50,currentCursor:n.currentCursor,returned:n.returned,hasNext:n.hasNext,nextCursor:n.nextCursor,cutoff:n.cutoff,positions,consistency:n.consistency,shipmentsBasis:n.shipmentsBasis}};
}
export function tracePageTimeline(page:TracePage,kind:string,query:string){
 const order=new Map(page.navigation.positions.map((p,i)=>[p.kind+':'+p.id,i]));
 return traceTimeline(page.trace,kind,query).sort((a,b)=>(order.get(a.kind+':'+a.id)??0)-(order.get(b.kind+':'+b.id)??0));
}
