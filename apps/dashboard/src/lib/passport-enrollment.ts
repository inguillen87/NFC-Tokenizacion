import {parseStudioEntry,type StudioEnrollment} from './passport-studio-entry';
import {studioRequestPath} from './passport-studio-transport';
import type {StudioSnapshot} from './passport-studio-contract';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MAX_BYTES=262144;
export type EnrollmentAttempt=Readonly<{path:string;bid:string;actorId:string;body:Readonly<{action:'start';operationId:string;scope:Readonly<{tenantId:string;batchId:string}>;template:'general'|'agro';locale:'es-AR'|'en'|'pt-BR';expectedPublicDigest:string}>}>;
export class EnrollmentError extends Error {
 constructor(public readonly code:'unconfirmed'|'timeout'|'cancelled'|'permission'|'conflict'|'rejected',public readonly uncertain:boolean,public readonly status=0){super(code);this.name='EnrollmentError';}
}
export function prepareEnrollment(enrollment:StudioEnrollment,endpoint:string,tenantSlug:string,template:StudioEnrollment['template'],locale:StudioEnrollment['locale'],operationId:string):EnrollmentAttempt {
 const parsed=parseStudioEntry({ok:true,enrollment},{bid:enrollment.scope.bid,tenantId:enrollment.scope.tenantId}).enrollment!;
 if(!parsed.capabilities.edit||!UUID.test(operationId)||endpoint!==`/api/admin/batches/${encodeURIComponent(parsed.scope.bid)}/passport-editorial`||!['general','agro'].includes(template)||!['es-AR','en','pt-BR'].includes(locale)||(parsed.template==='agro'&&template!=='agro'))throw new EnrollmentError('rejected',false);
 return Object.freeze({path:studioRequestPath(endpoint,'start',tenantSlug),bid:parsed.scope.bid,actorId:parsed.actorId,body:Object.freeze({action:'start',operationId,scope:Object.freeze({tenantId:parsed.scope.tenantId,batchId:parsed.scope.batchId}),template,locale,expectedPublicDigest:parsed.currentPublicDigest})});
}
export function confirmEnrollment(raw:unknown,attempt:EnrollmentAttempt):StudioSnapshot {
 const r=raw as any,receipt=r?.receipt;
 if(!r||r.demo===true||r.demoMode===true||r.dataSource==='demo'||!receipt||receipt.action!=='start'||receipt.committed!==true||receipt.operationId!==attempt.body.operationId||typeof receipt.id!=='string'||!UUID.test(receipt.id)||typeof receipt.replayed!=='boolean')throw new EnrollmentError('unconfirmed',true);
 const snapshot=parseStudioEntry(raw,{bid:attempt.bid,tenantId:attempt.body.scope.tenantId}).snapshot;
 if(!snapshot||snapshot.scope.batchId!==attempt.body.scope.batchId||snapshot.actorId!==attempt.actorId||snapshot.draft.revision!==1||snapshot.draft.state!=='draft'||snapshot.draft.document.template!==attempt.body.template||snapshot.draft.document.locale!==attempt.body.locale||snapshot.draft.createdBy!==attempt.actorId||snapshot.draft.lastEditorId!==attempt.actorId)throw new EnrollmentError('unconfirmed',true);
 return snapshot;
}
/** One explicit POST, bounded through headers and body. A timeout never cancels the server transaction. */
export async function startPassportEnrollment(attempt:EnrollmentAttempt,{signal,fetcher=fetch,timeoutMs=15000}:{signal?:AbortSignal;fetcher?:typeof fetch;timeoutMs?:number}={}):Promise<StudioSnapshot> {
 try {
  const u=new URL(attempt.path,'https://nexid.invalid'),body=attempt.body;
  const base=`/api/admin/batches/${encodeURIComponent(attempt.bid)}/passport-editorial`;
  if(u.origin!=='https://nexid.invalid'||u.hash||[...u.searchParams.keys()].some(k=>k!=='tenant')||u.searchParams.getAll('tenant').length>1||studioRequestPath(base,'start',u.searchParams.get('tenant')||'')!==attempt.path)throw Error();
  if(body.action!=='start'||!UUID.test(body.operationId)||!UUID.test(body.scope.tenantId)||!UUID.test(body.scope.batchId)||!/^[a-f0-9]{64}$/.test(body.expectedPublicDigest)||!['general','agro'].includes(body.template)||!['es-AR','en','pt-BR'].includes(body.locale))throw Error();
  if(Object.keys(body).sort().join(',')!=='action,expectedPublicDigest,locale,operationId,scope,template'||Object.keys(body.scope).sort().join(',')!=='batchId,tenantId')throw Error();
 }catch{throw new EnrollmentError('rejected',false);}
 if(signal?.aborted)throw new EnrollmentError('cancelled',false);
 if(!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>15000)throw new EnrollmentError('rejected',false);
 const controller=new AbortController();let reader:ReadableStreamDefaultReader<Uint8Array>|undefined,stop!:(e:EnrollmentError)=>void;
 const deadline=new Promise<never>((_,reject)=>{stop=reject;});
 const abort=(code:'timeout'|'cancelled')=>{controller.abort();void reader?.cancel().catch(()=>{});stop(new EnrollmentError(code,true));};
 const cancel=()=>abort('cancelled'),timer=setTimeout(()=>abort('timeout'),timeoutMs);signal?.addEventListener('abort',cancel,{once:true});
 async function request(){
  const response=await fetcher(attempt.path,{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'content-type':'application/json','accept':'application/json','idempotency-key':attempt.body.operationId},body:JSON.stringify(attempt.body),signal:controller.signal});
  if(controller.signal.aborted){void response.body?.cancel().catch(()=>{});throw new EnrollmentError('unconfirmed',true,response.status);}
  try {
   if(!response.headers.get('content-type')?.toLowerCase().includes('application/json')||!response.body||Number(response.headers.get('content-length'))>MAX_BYTES)throw Error();
   reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
   for(;;){const part=await reader.read();if(controller.signal.aborted)throw Error();if(part.done)break;size+=part.value.byteLength;if(size>MAX_BYTES)throw Error();chunks.push(part.value);}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   const raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(!response.ok){
    const certain=[400,401,403,404,409,413,422,429].includes(response.status)&&raw?.ok===false&&typeof raw.reason==='string';
    const code=[401,403,404].includes(response.status)?'permission':response.status===409?'conflict':certain?'rejected':'unconfirmed';
    throw new EnrollmentError(code,!certain,response.status);
   }
   if(response.headers.get('x-nexid-data-mode')!=='production')throw Error();
   return confirmEnrollment(raw,attempt);
  }catch(error){if(!reader)void response.body?.cancel().catch(()=>{});if(error instanceof EnrollmentError)throw error;throw new EnrollmentError('unconfirmed',true,response.status);}
 }
 try{return await Promise.race([request(),deadline]);}
 catch(error){if(error instanceof EnrollmentError)throw error;throw new EnrollmentError('unconfirmed',true);}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);void reader?.cancel().catch(()=>{});try{reader?.releaseLock();}catch{}}
}
export function enrollmentFailure(error:EnrollmentError,alreadyUncertain:boolean){
 const uncertain=alreadyUncertain||error.uncertain;
 return {uncertain,accessLost:[401,403,404].includes(error.status),message:uncertain?'El inicio sigue sin confirmar. Conservamos la misma operación; reconciliar no crea otro intento ni revierte lo que pudo haberse guardado.':error.code==='permission'?'Tu acceso no permite iniciar este pasaporte. Volvé a consultar con la sesión autorizada.':error.code==='conflict'?'El contenido o la gestión editorial cambió. Volvé a consultar el pasaporte antes de iniciar otro borrador.':'No se confirmó el inicio. Revisá las opciones y el acceso antes de confirmarlo nuevamente.'};
}
