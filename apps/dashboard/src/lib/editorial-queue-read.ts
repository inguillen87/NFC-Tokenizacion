import {parseEditorialQueue,normalizeQueueFilters,queueParams,type EditorialQueue,type QueueFilters} from './editorial-queue';
export class EditorialQueueReadError extends Error {
 constructor(public readonly code:'invalid'|'forbidden'|'position_changed'|'unavailable'|'timeout'|'cancelled'){super(code);this.name='EditorialQueueReadError';}
}
export const QUEUE_READ_COPY={invalid:'La fuente no confirmó una bandeja válida. Revisá los filtros y volvé a consultar.',forbidden:'El acceso a esta bandeja cambió. Se retiraron los resultados anteriores.',position_changed:'Cambió la posición o los permisos. Iniciá una nueva consulta.',unavailable:'La fuente no pudo confirmar esta página. Reintentá sin modificar los pasaportes.',timeout:'La consulta superó el tiempo de espera. Podés reintentar sin cambiar los pasaportes.',cancelled:'Consulta cancelada. No se modificó ningún pasaporte.'} as const;
/** One read-only deadline covers headers and the bounded UTF-8 body. No retries. */
export async function readEditorialQueue(input:{tenant:string;filters:QueueFilters;cursor?:string|null;page?:number;signal?:AbortSignal;timeoutMs?:number},fetcher:typeof fetch=fetch):Promise<EditorialQueue>{
 let filters:QueueFilters;try{filters=normalizeQueueFilters(input.filters);}catch{throw new EditorialQueueReadError('invalid');}
 const {tenant,signal}=input,cursor=input.cursor??null,page=input.page??1;
 if(typeof tenant!=='string'||tenant&&!/^[a-z0-9][a-z0-9._-]{0,119}$/.test(tenant)||cursor!==null&&(typeof cursor!=='string'||!/^[-_A-Za-z0-9]{1,1024}$/.test(cursor))||!Number.isSafeInteger(page)||page<1||(page===1)!==(cursor===null))throw new EditorialQueueReadError('invalid');
 if(signal?.aborted)throw new EditorialQueueReadError('cancelled');
 const ms=input.timeoutMs??12000;if(!Number.isFinite(ms)||ms<1||ms>12000)throw new EditorialQueueReadError('invalid');
 const controller=new AbortController();let reader:ReadableStreamDefaultReader<Uint8Array>|undefined,finished=false,rejectBoundary:(e:Error)=>void=()=>{};
 const boundary=new Promise<never>((_,reject)=>{rejectBoundary=reject;});
 const stop=(code:'timeout'|'cancelled')=>{if(finished)return;rejectBoundary(new EditorialQueueReadError(code));controller.abort();void reader?.cancel().catch(()=>{});};
 const cancel=()=>stop('cancelled'),timer=setTimeout(()=>stop('timeout'),ms);signal?.addEventListener('abort',cancel,{once:true});
 const operation=async()=>{
  const response=await fetcher('/api/admin/passport-editorial/queue?'+queueParams(tenant,filters,cursor),{method:'GET',cache:'no-store',credentials:'same-origin',redirect:'error',headers:{Accept:'application/json'},signal:controller.signal});
  if(controller.signal.aborted){void response.body?.cancel().catch(()=>{});throw new EditorialQueueReadError('cancelled');}
  if(!response.ok){void response.body?.cancel().catch(()=>{});throw new EditorialQueueReadError([401,403,404].includes(response.status)?'forbidden':response.status===409?'position_changed':response.status===400?'invalid':'unavailable');}
  if(response.redirected||response.headers.get('x-nexid-data-mode')!=='production'||!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||'')||Number(response.headers.get('content-length'))>262144||!response.body){void response.body?.cancel().catch(()=>{});throw new EditorialQueueReadError('invalid');}
  reader=response.body.getReader();const parts:Uint8Array[]=[];let length=0;
  for(;;){const chunk=await reader.read();if(chunk.done)break;length+=chunk.value.byteLength;if(length>262144)throw new EditorialQueueReadError('invalid');parts.push(chunk.value);}
  const bytes=new Uint8Array(length);let at=0;for(const part of parts){bytes.set(part,at);at+=part.byteLength;}
  try{return parseEditorialQueue(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),tenant,filters,page);}catch{throw new EditorialQueueReadError('invalid');}
 };
 try{return await Promise.race([operation(),boundary]);}catch(e){if(e instanceof EditorialQueueReadError)throw e;throw new EditorialQueueReadError('unavailable');}
 finally{finished=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);controller.abort();void reader?.cancel().catch(()=>{});try{reader?.releaseLock();}catch{}}
}
