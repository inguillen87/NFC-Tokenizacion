import { sql } from "./db";
import { receptionActions,type ReceptionPrincipal } from "./supplier-reception-policy";
export const RECEPTION_PROTOCOL='nexid.supplier-reception.v1';
export async function readSupplierReception(p:ReceptionPrincipal,tenantSlug:string,label:string){
 const tenantOptions=await sql`SELECT id,slug,name,type FROM public.tenants WHERE (${p.scope==='super_admin'} OR id=${p.tenantId||null}::uuid) ORDER BY name,id LIMIT 100`;
 let tenant:any=null,inventory:any=null,batches:any[]=[],orders:any[]=[];
 if(tenantSlug){
  const found=await sql`SELECT id,slug,name,type,status FROM public.tenants WHERE slug=${tenantSlug} AND (${p.scope==='super_admin'} OR id=${p.tenantId||null}::uuid) LIMIT 1`;
  if(!found[0])throw new Error('reception_tenant_not_found');tenant=found[0];
  const summary=await sql`SELECT
   (SELECT count(*)::int FROM public.batches WHERE tenant_id=${tenant.id}::uuid) AS batches,
   count(*)::int AS total,
   count(*) FILTER(WHERE t.status::text='active')::int AS active,
   count(*) FILTER(WHERE t.status::text='inactive')::int AS inactive,
   count(*) FILTER(WHERE t.status::text NOT IN ('active','inactive'))::int AS other,
   count(*) FILTER(WHERE t.last_seen_at IS NOT NULL)::int AS seen,
   max(t.last_seen_at) AS last_seen_at
   FROM public.tags t JOIN public.batches b ON b.id=t.batch_id WHERE b.tenant_id=${tenant.id}::uuid`;
  inventory=summary[0];
  batches=await sql`SELECT b.id,b.bid,b.status,b.carrier_profile_code,b.qa_status,b.qa_acceptance_scope,b.supplier_order_id,b.editorial_managed,
   (SELECT count(*)::int FROM public.tags t WHERE t.batch_id=b.id) AS total,
   (SELECT count(*)::int FROM public.tags t WHERE t.batch_id=b.id AND t.status::text='active') AS active,
   (SELECT count(*)::int FROM public.tags t WHERE t.batch_id=b.id AND t.status::text='inactive') AS inactive,
   (SELECT max(t.last_seen_at) FROM public.tags t WHERE t.batch_id=b.id) AS last_seen_at
   FROM public.batches b WHERE b.tenant_id=${tenant.id}::uuid ORDER BY b.created_at DESC,b.id LIMIT 20`;
  orders=await sql`SELECT so.id,${tenant.slug}::text AS tenant_slug,so.customer_slug,so.order_name,so.order_code,so.carrier_profile_code,so.chip_model,so.total_quantity,so.sub_batch_size,so.status,
   so.packaging_governance_status,so.packaging_spec_revision,so.pack_purpose,so.pack_purpose AS declared_pack_purpose,
   coalesce((SELECT to_purpose FROM public.supplier_pack_purpose_decisions d WHERE d.supplier_order_id=so.id AND d.tenant_id=so.tenant_id ORDER BY d.created_at DESC LIMIT 1),so.pack_purpose) AS effective_pack_purpose,
   coalesce((SELECT jsonb_agg(item ORDER BY item.sequence_index) FROM (SELECT s.id,s.bid,s.batch_id,s.sequence_index,s.expected_quantity,s.manifest_count,s.manifest_status,s.qa_status,s.qa_acceptance_scope,s.manufacturing_state,s.status,s.active_count,s.activated_at,s.key_export_count,s.key_exported_at FROM public.supplier_sub_batches s WHERE s.supplier_order_id=so.id AND s.tenant_id=so.tenant_id ORDER BY s.sequence_index LIMIT 52) item),'[]'::jsonb) AS sub_batches
   FROM public.supplier_orders so WHERE so.tenant_id=${tenant.id}::uuid ORDER BY so.created_at DESC,so.id LIMIT 10`;
 }
 const profiles=await sql`SELECT code,display_name,tenant_bound,default_permissions FROM public.enterprise_role_profiles WHERE active=true AND human_session_allowed=true AND code IN ('super_admin','tenant_owner','tenant_admin','operations_manager','packaging_operator','marketing_manager','viewer') ORDER BY code`;
 const roleProfiles=profiles.map((r:any)=>{
  const role=String(r.code).replaceAll('_','-');
  const profile:ReceptionPrincipal={role,scope:role==='super-admin'?'super_admin':'tenant_admin',tenantId:r.tenant_bound?'profile-only':null,tenantSlug:r.tenant_bound?'profile-only':null,permissions:Array.isArray(r.default_permissions)?r.default_permissions:[],deniedPermissions:[]};
  return {role,label:String(r.display_name),capabilities:receptionActions(profile),basis:'configured_role_defaults'};
 });
 return {ok:true,contract:RECEPTION_PROTOCOL,source:'database',observedAt:new Date().toISOString(),actor:{role:p.role,label:label.slice(0,180),scope:p.scope==='super_admin'?'global':'tenant',tenantSlug:p.tenantSlug||null,capabilities:receptionActions(p)},tenantOptions,tenant,inventory,batches,orders,roleProfiles,limits:{tenants:100,batches:20,orders:10,subBatchesPerOrder:52},readOnly:true};
}
