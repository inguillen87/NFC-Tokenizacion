import { normalizePhysicalTapsPayload, type PhysicalTapsPayload } from "./physical-taps-contract";
export type DossierRange="24h"|"7d"|"30d";
export type DossierReading={state:"ready";payload:PhysicalTapsPayload;checkedAt:string}|{state:"forbidden"|"unavailable"|"invalid"|"timeout"|"cancelled";payload:null;checkedAt:string};
export function dossierRange(value:unknown):DossierRange { return value==="7d"||value==="30d"?value:"24h"; }
export function parseDossierReadings(value:unknown,tenant:string,bid:string,range:DossierRange):PhysicalTapsPayload|null {
  const parsed=normalizePhysicalTapsPayload(value);
  if(!parsed || parsed.scope.tenant!==tenant || parsed.scope.bid!==bid || parsed.scope.range!==range || parsed.scope.limit!==20 || parsed.rows.length>20)return null;
  return parsed;
}
const MAX_BYTES=262144;
export async function boundedDossierJson(response:Response):Promise<unknown> {
  if(Number(response.headers.get("content-length"))>MAX_BYTES||!response.body)throw new Error("body_limit");
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try {while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>MAX_BYTES)throw new Error("body_limit");chunks.push(next.value);}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let cursor=0;for(const chunk of chunks){bytes.set(chunk,cursor);cursor+=chunk.byteLength;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function requestDossierReadings(input:{fetcher:typeof fetch;tenant:string;bid:string;range:DossierRange;signal:AbortSignal}):Promise<DossierReading> {
  const now=()=>new Date().toISOString();
  const query=new URLSearchParams({tenant:input.tenant,bid:input.bid,range:input.range,limit:"20"});
  try {
    const response=await input.fetcher(`/api/admin/sun/physical-taps?${query.toString()}`,{method:"GET",cache:"no-store",credentials:"same-origin",signal:input.signal});
    if(response.status===401||response.status===403)return {state:"forbidden",payload:null,checkedAt:now()};
    if(!response.ok)return {state:"unavailable",payload:null,checkedAt:now()};
    if(response.headers.get("x-nexid-data-mode")==="demo")return {state:"invalid",payload:null,checkedAt:now()};
    const payload=parseDossierReadings(await boundedDossierJson(response),input.tenant,input.bid,input.range);
    return payload?{state:"ready",payload,checkedAt:now()}:{state:"invalid",payload:null,checkedAt:now()};
  }catch(error){return {state:input.signal.aborted?(input.signal.reason?.name==="TimeoutError"?"timeout":"cancelled"):error instanceof TypeError?"unavailable":"invalid",payload:null,checkedAt:now()};}
}
