import {checkAdminWithPermission,getAdminPrincipal} from './auth';
import {sql,type SqlExecutor} from './db';
import {SupplierRequestError} from './supplier-request-contract';
import {resolveSupplierRequestScope} from './supplier-request-store';
import {SUPPLIER_SERVICE_PROTOCOL,SUPPLIER_SERVICE_IDS,parseSupplierServiceStatus,type SupplierServiceId} from './supplier-service-contract';
const cancellation='20260924010000_0117_supplier_request_cancellation.sql';
const quotes='20260924050000_0118_supplier_request_quotes.sql';
const binding='20260924110000_0119_supplier_request_binding.sql';
const ack='20260924150000_0120_supplier_delivery_ack.sql';
export const SUPPLIER_SERVICE_DEPENDENCIES={
 cancellation:{migrations:[cancellation],functions:['public.nexid_cancel_supplier_request_v1(jsonb)'],flag:'SUPPLIER_REQUEST_CANCELLATION_ENABLED'},
 quotation:{migrations:[cancellation,quotes],functions:['public.nexid_mutate_supplier_quote_v1(jsonb)','public.nexid_supplier_quote_read_v1(uuid,uuid,uuid,uuid,integer)'],flag:'SUPPLIER_REQUEST_QUOTES_ENABLED'},
 supplier_binding:{migrations:[cancellation,quotes,binding],functions:['public.nexid_mutate_supplier_binding_v1(jsonb)','public.nexid_supplier_binding_read_v1(uuid,uuid,uuid,uuid,integer)'],flag:'SUPPLIER_REQUEST_SUPPLIER_BINDINGS_ENABLED'},
 delivery_ack:{migrations:[cancellation,quotes,binding,ack],functions:['public.nexid_mutate_supplier_delivery_ack_v1(jsonb)','public.nexid_supplier_delivery_ack_read_v1(uuid,uuid,uuid,uuid,integer)'],flag:'SUPPLIER_DELIVERY_ACK_ENABLED'},
} as const;
/** Presence/EXECUTE are navigation hints only, never an authorization substitute. */
export async function collectSupplierServices(query:SqlExecutor){
 const migrations=[...new Set(Object.values(SUPPLIER_SERVICE_DEPENDENCIES).flatMap(v=>[...v.migrations]))];
 const functions=[...new Set(Object.values(SUPPLIER_SERVICE_DEPENDENCIES).flatMap(v=>[...v.functions]))];
 const [row]=await query`SELECT clock_timestamp() AS observed_at,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',m.id,'recorded',EXISTS(SELECT 1 FROM public.schema_migrations x WHERE x.id=m.id))),'[]'::jsonb) FROM unnest(${migrations}::text[]) AS m(id)) AS migrations,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object('signature',f.signature,'present',to_regprocedure(f.signature) IS NOT NULL,'executable',COALESCE(has_function_privilege(current_user,to_regprocedure(f.signature),'EXECUTE'),false))),'[]'::jsonb) FROM unnest(${functions}::text[]) AS f(signature)) AS functions`;
 if(!row||!Array.isArray(row.migrations)||!Array.isArray(row.functions)||row.migrations.length!==migrations.length||row.functions.length!==functions.length)throw Error('supplier_service_observation_invalid');
 const ms=new Map<string,boolean>(),fs=new Map<string,boolean>();
 for(const m of row.migrations){if(!m||typeof m.id!=='string'||!migrations.includes(m.id)||ms.has(m.id)||typeof m.recorded!=='boolean')throw Error('supplier_service_observation_invalid');ms.set(m.id,m.recorded);}
 for(const f of row.functions){if(!f||typeof f.signature!=='string'||!functions.includes(f.signature)||fs.has(f.signature)||typeof f.present!=='boolean'||typeof f.executable!=='boolean'||f.executable&&!f.present)throw Error('supplier_service_observation_invalid');fs.set(f.signature,f.present&&f.executable);}
 const observedAt=row.observed_at instanceof Date?row.observed_at.toISOString():row.observed_at;
 return{observedAt,ready:Object.fromEntries(SUPPLIER_SERVICE_IDS.map(id=>{const d=SUPPLIER_SERVICE_DEPENDENCIES[id];return[id,d.migrations.every(m=>ms.get(m)===true)&&d.functions.every(f=>fs.get(f)===true)];})) as Record<SupplierServiceId,boolean>};
}
const defaults={authorize:checkAdminWithPermission,principal:getAdminPrincipal,query:sql,enabled:(id:SupplierServiceId)=>process.env[SUPPLIER_SERVICE_DEPENDENCIES[id].flag]==='true'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store, max-age=0','referrer-policy':'no-referrer','x-content-type-options':'nosniff'}});
export function makeSupplierServiceStatusHandler(overrides:Partial<typeof defaults>={}){
 const deps={...defaults,...overrides};
 return async(req:Request)=>{try{
  if(req.method!=='GET')return json({ok:false,reason:'supplier_service_method_invalid'},405);
  const p=new URL(req.url).searchParams;if([...p.keys()].some(k=>k!=='tenant'||p.getAll(k).length!==1)||req.headers.has('x-http-method-override'))return json({ok:false,reason:'supplier_service_query_invalid'},400);
  const auth=await deps.authorize(req,'supplier_order.create');if(auth){const out=json({ok:false,reason:auth.status===401?'supplier_request_unauthorized':auth.status===403?'supplier_request_scope_forbidden':'supplier_services_unavailable'},auth.status);for(const h of ['retry-after','x-nexid-auth-outcome']){const v=auth.headers.get(h);if(v)out.headers.set(h,v);}return out;}
  const scope=await resolveSupplierRequestScope(p.get('tenant'),deps.principal(req),false,deps.query);if(scope.mode!=='tenant')throw Error();
  const raw=await collectSupplierServices(deps.query);
  const services=SUPPLIER_SERVICE_IDS.map(id=>{const ready=raw.ready[id],on=deps.enabled(id)===true;const readAvailable=ready&&(id!=='cancellation'||on),writesEnabled=ready&&on;return{id,state:!ready?'setup_required':!readAvailable?'temporarily_disabled':writesEnabled?'workflow_available':'read_only',readAvailable,writesEnabled};});
  return json(parseSupplierServiceStatus({ok:true,protocol:SUPPLIER_SERVICE_PROTOCOL,scope,observedAt:raw.observedAt,services,metadataOnly:true,recordAccessVerified:false,operationAuthorized:false},{tenant:scope.tenant_slug,tenantId:scope.tenant_id}));
 }catch(error){return error instanceof SupplierRequestError?json({ok:false,reason:error.message},error.status):json({ok:false,reason:'supplier_services_unavailable'},503);}};
}
