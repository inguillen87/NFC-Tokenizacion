import {parseSupplierRequestRecord,SupplierRequestError,SUPPLIER_REQUEST_UUID,type SupplierRequest} from "./supplier-request-client";
import {SUPPLIER_QUOTE_PROTOCOL,parseQuoteState,parseQuoteCommand,type QuoteCommand,type QuoteState} from "./supplier-quote-policy";
export type QuoteOperation=Readonly<{key:string;body:Readonly<QuoteCommand>}>;
export type QuoteSnapshot=QuoteState & {request:SupplierRequest;writes_enabled:boolean;receipt?:{idempotency_key:string;action:QuoteCommand['action'];revision:number;request_revision:number;quote_version:number};idempotent_replay?:boolean};
type Scope={id:string;tenant:string;tenantId:string};
const bad=():never=>{throw new SupplierRequestError('supplier_quote_contract_invalid');};
export function parseSupplierQuote(payload:any,scope:Scope,command?:QuoteOperation,before:number|null=null):QuoteSnapshot{
 if(!payload||payload.ok!==true||payload.protocol!==SUPPLIER_QUOTE_PROTOCOL||typeof payload.writes_enabled!=='boolean'||payload.demo===true||payload.demoMode===true||payload.dataSource==='demo'
 ||payload.scope?.mode!=='tenant'||payload.scope.tenant_id!==scope.tenantId||payload.scope.tenant_slug!==scope.tenant)return bad();
 const request=parseSupplierRequestRecord(payload.request,scope.tenant);
 if(request.id!==scope.id||request.tenant_id!==scope.tenantId||request.status==='draft'||request.quotation_revision===undefined||!request.review_summary)return bad();
 const data=parseQuoteState(payload,request.revision,request.quotation_revision,before);if(request.quotation_state!==(data.current?.state||null))return bad();const base={...data,request,writes_enabled:payload.writes_enabled};if(!command)return base;
 const receipt=payload.receipt;
 if(typeof payload.idempotent_replay!=='boolean'||!receipt||receipt.idempotency_key!==command.key||receipt.action!==command.body.action||receipt.revision!==command.body.expected_revision+1
 ||receipt.request_revision!==command.body.expected_request_revision+1||receipt.revision>data.revision||receipt.request_revision>request.revision||!Number.isSafeInteger(receipt.quote_version)||receipt.quote_version<1
 ||receipt.quote_version>(data.current?.quote_version||0))return bad();
 if(!payload.idempotent_replay){
  if(receipt.revision!==data.revision||receipt.request_revision!==request.revision||receipt.quote_version!==data.current?.quote_version||data.current?.action!==command.body.action||data.current.reason!==command.body.reason)return bad();
  if(command.body.offer){for(const [key,value]of Object.entries(command.body.offer))if((data.current as any)[key]!==value)return bad();}
 }
 return {...base,idempotent_replay:payload.idempotent_replay,receipt:{idempotency_key:receipt.idempotency_key,action:receipt.action,revision:receipt.revision,request_revision:receipt.request_revision,quote_version:receipt.quote_version}};
}
export async function supplierQuoteCall(input:Scope&{command?:QuoteOperation;before?:number|null;signal?:AbortSignal},fetcher:typeof fetch=fetch):Promise<QuoteSnapshot>{
 if(!SUPPLIER_REQUEST_UUID.test(input.id)||!SUPPLIER_REQUEST_UUID.test(input.tenantId)||!/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(input.tenant)
  ||(input.command&&!SUPPLIER_REQUEST_UUID.test(input.command.key))||(input.before!==undefined&&input.before!==null&&(!Number.isSafeInteger(input.before)||input.before<1||input.before>2147483646))||(input.command&&input.before))return bad();
 if(input.command)parseQuoteCommand(input.command.body);
 const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,20000);
 if(input.signal?.aborted)abort();else input.signal?.addEventListener('abort',abort,{once:true});
 const command=input.command;
 try{
  const query=new URLSearchParams({tenant:input.tenant});if(input.before)query.set('before_revision',String(input.before));
  const response=await fetcher(`/api/admin/supplier-requests/${input.id}/quotation?${query}`,{method:command?'POST':'GET',cache:'no-store',credentials:'same-origin',signal:controller.signal,
   headers:{Accept:'application/json',...(command?{'Content-Type':'application/json','Idempotency-Key':command.key}:{})},...(command?{body:JSON.stringify(command.body)}:{})});
  let payload:any;try{
   const reader=response.body?.getReader();if(!reader)throw Error();const decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,text='';
   try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>1048576){await reader.cancel();throw Error();}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();payload=JSON.parse(text);}finally{reader.releaseLock();}
  }catch{throw new SupplierRequestError('supplier_quote_contract_invalid',response.status,Boolean(command));}
  if(!response.ok){const certain=response.status<500&&response.status!==408&&payload?.ok===false&&typeof payload.reason==='string';throw new SupplierRequestError(certain?payload.reason:'supplier_quotes_unavailable',response.status,Boolean(command&&!certain));}
  if(response.headers.get('x-nexid-data-mode')!=='production'||!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''))throw new SupplierRequestError('supplier_quote_contract_invalid',response.status,Boolean(command));
  try{return parseSupplierQuote(payload,input,command,input.before||null);}catch{throw new SupplierRequestError('supplier_quote_contract_invalid',response.status,Boolean(command));}
 }catch(error){if(error instanceof SupplierRequestError)throw error;throw new SupplierRequestError('supplier_quotes_unavailable',0,Boolean(command));}
 finally{clearTimeout(timer);input.signal?.removeEventListener('abort',abort);}
}
