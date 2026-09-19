import {TraceabilityError,traceWindow} from './batch-traceability-projection';
import {isValidGtin14} from './gs1-digital-link-registry';
export const TRACE_PAGE_PROTOCOL='nexid.trace-page.v1';
export const TRACE_PAGE_SIZE=50;
const TYPES=['','relationships','ObjectEvent','AggregationEvent','AssociationEvent','TransformationEvent','TransactionEvent'];
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type TraceQuery={source:'all'|'epcis'|'custody';type:string;gtin:string;lot:string;serial:string;exact:boolean};
export type TracePosition={kind:'epcis'|'custody';id:string;at:string};
export type TraceCursor={v:1;tenant:string;bid:string;batchId:string;from:string;to:string;query:TraceQuery;logistics:boolean;cutoff:string;last:TracePosition|null;page:number};
const raw=(v:unknown)=>v==null?'':typeof v==='string'?v:(()=>{throw new TraceabilityError('trace_filter_invalid');})();
export function traceQuery(input:{source?:unknown;type?:unknown;gtin?:unknown;lot?:unknown;serial?:unknown;exact?:unknown}):TraceQuery{
 let source=raw(input.source)||'all';const type=raw(input.type),gtin=raw(input.gtin).trim(),lot=raw(input.lot),serial=raw(input.serial),x=raw(input.exact);
 if(!['all','epcis','custody'].includes(source)||!TYPES.includes(type)||!['','0','1'].includes(x))throw new TraceabilityError('trace_filter_invalid');
 if(gtin&&!isValidGtin14(gtin))throw new TraceabilityError('trace_gtin_invalid');
 for(const value of [lot,serial])if(value&&(!/^[!-~]{1,20}$/.test(value)||/[\\/?#%]/.test(value)))throw new TraceabilityError('trace_qualifier_invalid');
 if((lot||serial||x==='1')&&!gtin)throw new TraceabilityError('trace_gtin_required');
 if(type||gtin){if(source==='custody')throw new TraceabilityError('trace_identity_requires_epcis');source='epcis';}
 return {source:source as TraceQuery['source'],type,gtin,lot,serial,exact:x==='1'};
}
function microTime(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value))return false;
 const n=new Date(value);return Number.isFinite(n.getTime())&&n.toISOString().slice(0,19)===value.slice(0,19);
}
export function readTraceCursor(value:unknown,expected:{tenant:string;bid:string;window:ReturnType<typeof traceWindow>;query:TraceQuery;canLogistics:boolean},now=Date.now()):TraceCursor|null{
 if(value==null||value==='')return null;
 if(typeof value!=='string'||value.length>2048||!/^[A-Za-z0-9_-]+$/.test(value))throw new TraceabilityError('trace_cursor_invalid');
 try{
  const bytes=Buffer.from(value,'base64url');if(bytes.toString('base64url')!==value)throw Error();const c=JSON.parse(bytes.toString('utf8')) as TraceCursor;
  if(!c||c.v!==1||!UUID.test(c.batchId)||c.bid!==expected.bid||(expected.tenant&&c.tenant!==expected.tenant)||!/^[a-z0-9][a-z0-9._-]{0,119}$/.test(c.tenant)||c.from!==expected.window.from||c.to!==expected.window.to||JSON.stringify(c.query)!==JSON.stringify(expected.query)||c.logistics!==expected.canLogistics)throw Error();
  if(!microTime(c.cutoff)||!Number.isSafeInteger(c.page)||c.page<1||c.page>10000)throw Error();
  if(c.page===1?c.last!==null:!c.last||!['epcis','custody'].includes(c.last.kind)||!UUID.test(c.last.id)||!microTime(c.last.at))throw Error();
  if(c.last&&(Date.parse(c.last.at)<Date.parse(expected.window.start)||Date.parse(c.last.at)>=Date.parse(expected.window.endExclusive))||Date.parse(c.cutoff)>now+60000)throw Error();
  if(c.last?.kind==='custody'&&(!expected.canLogistics||expected.query.source==='epcis'))throw Error();
  if(c.last?.kind==='epcis'&&expected.query.source==='custody')throw Error();
  if(now-Date.parse(c.cutoff)>4*3600000)throw new TraceabilityError('trace_cursor_expired',409);
  return c;
 }catch(e){if(e instanceof TraceabilityError)throw e;throw new TraceabilityError('trace_cursor_mismatch',409);}
}
export function traceCursor(value:TraceCursor){return Buffer.from(JSON.stringify(value)).toString('base64url');}
