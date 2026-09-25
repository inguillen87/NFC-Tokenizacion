import {parseSupplierServiceStatus} from './supplier-service-contract';
export class SupplierServiceReadError extends Error {constructor(public readonly status:number,public readonly kind:'unavailable'|'invalid'|'cancelled'='unavailable'){super('supplier_service_'+kind);}}
export async function fetchSupplierServices(scope:{tenant:string;tenantId:string},signal?:AbortSignal,fetcher:typeof fetch=fetch){
 if(!/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(scope.tenant)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(scope.tenantId))throw new SupplierServiceReadError(0,'invalid');
 if(signal?.aborted)throw new SupplierServiceReadError(0,'cancelled');const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,15000);
 try{const response=await fetcher('/api/admin/supplier-requests/service-status?tenant='+encodeURIComponent(scope.tenant),{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json'},signal:controller.signal});
 if(!response.ok){await response.body?.cancel().catch(()=>{});throw new SupplierServiceReadError(response.status);}
 if(response.redirected||response.headers.get('x-nexid-data-mode')!=='production'||!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||'')){await response.body?.cancel().catch(()=>{});throw new SupplierServiceReadError(0,'invalid');}
 const reader=response.body?.getReader();if(!reader)throw new SupplierServiceReadError(0,'invalid');const decoder=new TextDecoder('utf-8',{fatal:true});let text='',size=0;
 try{while(true){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>16384)throw Error();text+=decoder.decode(p.value,{stream:true});}text+=decoder.decode();return parseSupplierServiceStatus(JSON.parse(text),scope);}
 catch{await reader.cancel().catch(()=>{});throw new SupplierServiceReadError(0,'invalid');}finally{reader.releaseLock();}
 }catch(error){if(signal?.aborted)throw new SupplierServiceReadError(0,'cancelled');if(error instanceof SupplierServiceReadError)throw error;throw new SupplierServiceReadError(0);}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
