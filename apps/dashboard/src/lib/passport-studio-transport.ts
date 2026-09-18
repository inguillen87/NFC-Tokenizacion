import {parseStudioSnapshot, type StudioAction, type StudioCommand, type StudioSnapshot} from './passport-studio-contract';
export type StudioReply={snapshot:StudioSnapshot;receipt:{id:string;operationId:string;action:StudioAction;committed:true;replayed:boolean}};
export class StudioRequestError extends Error{constructor(public readonly code:string,public readonly uncertain:boolean){super(code);this.name='StudioRequestError';}}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export async function boundedJSON(response:Response):Promise<unknown>{
 if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('studio_response_not_json');
 if(Number(response.headers.get('content-length'))>262144||!response.body)throw new Error('studio_response_too_large');
 const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>262144)throw new Error('studio_response_too_large');chunks.push(part.value);}}
 catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
 const joined=new Uint8Array(size);let offset=0;for(const bytes of chunks){joined.set(bytes,offset);offset+=bytes.length;}return JSON.parse(new TextDecoder().decode(joined));
}
export function validateStudioReply(raw:unknown,command:StudioCommand,actorId:string):StudioReply{
 const r=raw as Record<string,unknown>|null,receipt=r?.receipt as StudioReply['receipt']|undefined;
 if(!r||r.ok!==true||!receipt||receipt.committed!==true||receipt.operationId!==command.operationId||receipt.action!==command.action||!UUID.test(receipt.id)||typeof receipt.replayed!=='boolean')throw new StudioRequestError('studio_receipt_invalid',true);
 const snapshot=parseStudioSnapshot(r.snapshot,command.scope);
 if(snapshot.actorId!==actorId||snapshot.draft.id!==command.draftId||snapshot.draft.revision!==command.expectedRevision+1)throw new StudioRequestError('studio_receipt_scope_invalid',true);
 const target={save:'draft',submit:'in_review',request_changes:'changes_requested',approve:'approved',publish:'published',reopen:'draft'}[command.action];
 if(snapshot.draft.state!==target)throw new StudioRequestError('studio_receipt_state_invalid',true);
 if(command.action==='publish'&&(!snapshot.published||snapshot.published.version<1||snapshot.published.contentDigest!==snapshot.draft.contentDigest))throw new StudioRequestError('studio_publication_unconfirmed',true);
 return {snapshot,receipt:{id:receipt.id,operationId:receipt.operationId,action:receipt.action,committed:true,replayed:receipt.replayed}};
}
/** Integration port. No endpoint is assumed or invented; caller supplies an existing, verified same-origin BFF path. */
export function studioHTTPTransport(endpoint:string,actorId:string,fetcher:typeof fetch=fetch){
 if(!endpoint.startsWith('/api/admin/')||endpoint.includes('..')||endpoint.startsWith('//')||/[?#]/.test(endpoint))throw new Error('studio_endpoint_invalid');
 let inFlight=false;
 return async(command:StudioCommand,signal?:AbortSignal):Promise<StudioReply>=>{
  if(inFlight)throw new StudioRequestError('studio_request_busy',false);
  if(!UUID.test(command.operationId))throw new StudioRequestError('studio_operation_id_invalid',false);
  inFlight=true;const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),12000);
  const cancel=()=>abort.abort();signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)abort.abort();
  try{
   if(!['save','submit','request_changes','approve','publish','reopen'].includes(command.action))throw new StudioRequestError('studio_action_invalid',false);
   const response=await fetcher(`${endpoint}/${command.action}`,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json','idempotency-key':command.operationId},body:JSON.stringify(command),signal:abort.signal});
   if(!response.ok){if(response.status===409)throw new StudioRequestError('studio_revision_conflict',false);if([401,403].includes(response.status))throw new StudioRequestError('studio_permission_denied',false);if([400,413,422].includes(response.status))throw new StudioRequestError('studio_validation_rejected',false);throw new StudioRequestError('studio_outcome_unknown',true);}
   return validateStudioReply(await boundedJSON(response),command,actorId);
  }catch(e){if(e instanceof StudioRequestError)throw e;throw new StudioRequestError('studio_outcome_unknown',true);}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);inFlight=false;}
 };
}
