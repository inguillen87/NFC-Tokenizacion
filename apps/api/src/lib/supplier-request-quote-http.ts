import { checkAdminWithPermission, getAdminPrincipal } from "./auth";
import { sql } from "./db";
import { auditFreeformContainsSecret } from "./audit-freeform-secret-policy";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "./bounded-request-body";
import { SupplierRequestError, parseSupplierRequestId, parseSupplierRequestIdempotencyKey, supplierRequestFromRow } from "./supplier-request-contract";
import { resolveSupplierRequestScope } from "./supplier-request-store";
import { SUPPLIER_QUOTE_PROTOCOL as protocol, parseQuoteCommand, parseQuoteState, QuoteContractError, type QuoteCommand } from "./supplier-quote-policy";
const defaults={authorize:checkAdminWithPermission,principal:getAdminPrincipal,query:sql,enabled:()=>process.env.SUPPLIER_REQUEST_QUOTES_ENABLED==="true"};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"cache-control":"private, no-store, max-age=0","referrer-policy":"no-referrer"}});
const codes:Record<string,number>={supplier_quote_scope_forbidden:403,supplier_request_not_found:404,supplier_request_not_submitted:409,supplier_quote_idempotency_conflict:409,supplier_quote_revision_conflict:409,supplier_request_review_revision_conflict:409,supplier_request_information_required:409,supplier_quote_transition_invalid:409,supplier_quote_validity_invalid:409,supplier_quote_expired:409,supplier_quote_review_changed:409};
export function makeSupplierQuoteHandlers(overrides:Partial<typeof defaults>={}){
 const deps={...defaults,...overrides};
 async function handle(req:Request,rawId:string,write:boolean){
  try{
   const auth=await deps.authorize(req,"supplier_order.create");if(auth){const response=json({ok:false,protocol,reason:auth.status===401?"supplier_request_unauthorized":auth.status===403?"supplier_quote_scope_forbidden":"supplier_quotes_unavailable"},auth.status);for(const name of ["retry-after","x-nexid-auth-outcome"]){const value=auth.headers.get(name);if(value)response.headers.set(name,value);}return response;}
   const enabled=deps.enabled();if(write&&!enabled)throw new SupplierRequestError("supplier_quotes_disabled",503);
   const principal=deps.principal(req),params=new URL(req.url).searchParams,id=parseSupplierRequestId(rawId);
   if([...params.keys()].some(key=>!['tenant',...(!write?['before_revision']:[])].includes(key)||params.getAll(key).length!==1))throw new SupplierRequestError("supplier_quote_query_invalid");
   const rawBefore=params.get('before_revision'),before=rawBefore===null?null:/^[1-9][0-9]{0,9}$/.test(rawBefore)&&Number(rawBefore)<=2147483646?Number(rawBefore):NaN;
   if(Number.isNaN(before))throw new SupplierRequestError("supplier_quote_query_invalid");
   const scope=await resolveSupplierRequestScope(params.get('tenant'),principal,false,deps.query),actor=parseSupplierRequestId(principal.userId),session=parseSupplierRequestId(principal.sessionId);
   const [cap]=await deps.query`SELECT to_regprocedure('public.nexid_mutate_supplier_quote_v1(jsonb)') IS NOT NULL AND to_regprocedure('public.nexid_supplier_quote_read_v1(uuid,uuid,uuid,uuid,integer)') IS NOT NULL
     AND COALESCE(has_function_privilege(current_user,to_regprocedure('public.nexid_mutate_supplier_quote_v1(jsonb)'),'EXECUTE'),false)
     AND COALESCE(has_function_privilege(current_user,to_regprocedure('public.nexid_supplier_quote_read_v1(uuid,uuid,uuid,uuid,integer)'),'EXECUTE'),false) AS available`;
   if(cap?.available!==true)throw new SupplierRequestError('supplier_quotes_unavailable',503);
   let command:QuoteCommand|undefined,key:string|undefined,row:Record<string,unknown>|undefined;
   if(write){
    key=parseSupplierRequestIdempotencyKey(req.headers.get('idempotency-key'));
    if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')||''))throw new SupplierRequestError('supplier_quote_body_invalid',415);
    let raw:unknown;try{raw=await readBoundedJsonBody(req,32*1024);}catch(error){throw new SupplierRequestError(error instanceof RequestBodyTooLargeError?'supplier_quote_body_too_large':'supplier_quote_body_invalid',error instanceof RequestBodyTooLargeError?413:400);}
    try{command=parseQuoteCommand(raw);}catch{throw new SupplierRequestError('supplier_quote_input_invalid');}
    if(auditFreeformContainsSecret(command.reason)||(command.offer&&auditFreeformContainsSecret(command.offer.conditions)))throw new SupplierRequestError('supplier_request_secret_content_rejected');
    if(['issue','withdraw'].includes(command.action)!==(principal.scope==='super_admin'))throw new SupplierRequestError('supplier_quote_scope_forbidden',403);
    const input={...command,tenant_id:scope.tenant_id,request_id:id,actor_id:actor,auth_session_id:session,idempotency_key:key};
    [row]=await deps.query`SELECT public.nexid_mutate_supplier_quote_v1(${JSON.stringify(input)}::jsonb) AS result`;
   }else [row]=await deps.query`SELECT public.nexid_supplier_quote_read_v1(${id}::uuid,${scope.tenant_id}::uuid,${actor}::uuid,${session}::uuid,${before}::integer) AS result`;
   const result=row?.result as Record<string,any>|undefined;if(!result&&!write)throw new SupplierRequestError('supplier_request_not_found',404);
   if(!result||typeof result!=='object'||Array.isArray(result))throw Error();
   if(result.ok===false){if(!Object.hasOwn(codes,result.reason))throw Error();throw new SupplierRequestError(result.reason,codes[result.reason]);}
   if(write&&result.ok!==true)throw Error();
   const item=supplierRequestFromRow(result.request),data=parseQuoteState(result,item.revision,result.request.quotation_revision,before);
   if(item.quotation_state!==(data.current?.state||null)||item.id!==id||item.tenant_id!==scope.tenant_id||item.tenant_slug!==scope.tenant_slug||item.status==='draft')throw Error();
   const base={ok:true,protocol,scope,writes_enabled:enabled,request:item,...data};if(!write)return json(base);
   const receipt=result.receipt;
   if(typeof result.idempotent_replay!=='boolean'||!receipt||receipt.idempotency_key!==key||receipt.action!==command!.action
    ||receipt.revision!==command!.expected_revision+1||receipt.request_revision!==command!.expected_request_revision+1
    ||receipt.revision>data.revision||receipt.request_revision>item.revision||!Number.isSafeInteger(receipt.quote_version)||receipt.quote_version<1
    ||(!result.idempotent_replay&&(receipt.revision!==data.revision||receipt.request_revision!==item.revision||receipt.quote_version!==data.current?.quote_version||data.current?.actor_id!==actor)))throw Error();
   if(!result.idempotent_replay){
    if(data.current?.action!==command!.action||data.current?.reason!==command!.reason)throw Error();
    if(command!.offer)for(const [field,value]of Object.entries(command!.offer))if((data.current as any)[field]!==value)throw Error();
   }
   return json({...base,idempotent_replay:result.idempotent_replay,receipt:{idempotency_key:key,action:receipt.action,revision:receipt.revision,request_revision:receipt.request_revision,quote_version:receipt.quote_version}});
  }catch(error){if(error instanceof SupplierRequestError)return json({ok:false,protocol,reason:error.message},error.status);return json({ok:false,protocol,reason:'supplier_quotes_unavailable'},503);}
 }
 return{get:(req:Request,id:string)=>handle(req,id,false),post:(req:Request,id:string)=>handle(req,id,true)};
}
