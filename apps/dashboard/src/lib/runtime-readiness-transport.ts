import { parseRuntimeSnapshot } from './runtime-readiness-contract';
export const RUNTIME_RESPONSE_MAX_BYTES = 128 * 1024;
export class RuntimeConsoleError extends Error {
  constructor(public readonly code:'session'|'forbidden'|'unavailable'|'invalid'|'cancelled', public readonly status=0) { super('runtime_console_'+code); }
}
export async function readRuntimeSnapshot(response:Response, requireProvenance=false, now?:number) {
  if(!response.ok){await response.body?.cancel().catch(()=>{});throw new RuntimeConsoleError(response.status===401?'session':response.status===403?'forbidden':'unavailable',response.status);}
  if(response.redirected||!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||'')||(requireProvenance&&response.headers.get('x-nexid-data-mode')!=='production')){
    await response.body?.cancel().catch(()=>{});throw new RuntimeConsoleError('invalid');
  }
  const declared=response.headers.get('content-length');if(declared&&(!/^\d+$/.test(declared)||Number(declared)>RUNTIME_RESPONSE_MAX_BYTES)){await response.body?.cancel().catch(()=>{});throw new RuntimeConsoleError('invalid');}
  const reader=response.body?.getReader();if(!reader)throw new RuntimeConsoleError('invalid');
  let bytes=0,text='';const decoder=new TextDecoder('utf-8',{fatal:true});
  try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>RUNTIME_RESPONSE_MAX_BYTES)throw new Error('bound');text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();return parseRuntimeSnapshot(JSON.parse(text),now??Date.now());}
  catch{await reader.cancel().catch(()=>{});throw new RuntimeConsoleError('invalid');}finally{reader.releaseLock();}
}
export async function fetchRuntimeSnapshot(signal?:AbortSignal, fetcher:typeof fetch=fetch) {
  const controller=new AbortController(),abort=()=>controller.abort();
  if(signal?.aborted)throw new RuntimeConsoleError('cancelled');signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,15_000);
  try{const response=await fetcher('/api/admin/diagnostics/runtime-readiness',{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json'},signal:controller.signal});
    return await readRuntimeSnapshot(response,true);}
  catch(error){if(signal?.aborted)throw new RuntimeConsoleError('cancelled');if(error instanceof RuntimeConsoleError)throw error;throw new RuntimeConsoleError('unavailable');}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
