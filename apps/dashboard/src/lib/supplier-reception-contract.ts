export const RECEPTION_PROTOCOL='nexid.supplier-reception.v1';
export const RECEPTION_ACTION_LABELS={
 'tenants:write':'Crear empresas',
 'supplier_order.create':'Registrar pedidos',
 'manifest.import':'Importar manifiestos',
 'qa.approve':'Ejecutar QA con evidencia',
 'qa.plan.approve':'Aprobar plan del cliente',
 'batch.activate':'Solicitar activación',
 'batch.product.configure':'Editar producto',
 'users:manage':'Administrar equipo',
} as const;
export type ReceptionAction=keyof typeof RECEPTION_ACTION_LABELS;
export type ReceptionCapabilities=Record<ReceptionAction,boolean>;
export type ReceptionSubBatch={id:string;bid:string;batch_id:string;expected_quantity:number|null;manifest_count:number|null;active_count:number|null;manifest_status:string;qa_status:string;qa_acceptance_scope:string|null;manufacturing_state:string;status:string;sequence_index:number;key_export_count?:number;key_exported_at?:string|null;activated_at?:string|null};
export type ReceptionOrder={id:string;tenant_slug:string;order_name:string;order_code:string;status:string;total_quantity:number;pack_purpose:string;declared_pack_purpose:string;effective_pack_purpose:string;carrier_profile_code:string;chip_model:string;sub_batch_size:number;packaging_governance_status:string;packaging_spec_revision:number;sub_batches:ReceptionSubBatch[]};
export type ReceptionData={contract:typeof RECEPTION_PROTOCOL;source:'database';observedAt:string;actor:{role:string;label:string;scope:'global'|'tenant';tenantSlug:string|null;capabilities:ReceptionCapabilities};tenantOptions:{id:string;slug:string;name:string;type:string}[];tenant:{id:string;slug:string;name:string;type:string;status:string}|null;inventory:{total:number;active:number;inactive:number;other:number;seen:number;batches:number;last_seen_at:string|null}|null;batches:{id:string;bid:string;status:string;carrier_profile_code:string;total:number;active:number;inactive:number;last_seen_at:string|null;supplier_order_id:string|null;qa_status:string}[];orders:ReceptionOrder[];roleProfiles:{role:string;label:string;capabilities:ReceptionCapabilities;basis:'configured_role_defaults'}[]};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const record=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{};
function text(v:unknown,max=180){if(typeof v!=='string'||v.length>max)throw new Error('reception_text_invalid');return v;}
function optional(v:unknown,max=180){return v==null?'':text(v,max);}
function id(v:unknown){const s=text(v,36);if(!UUID.test(s))throw new Error('reception_id_invalid');return s;}
function count(v:unknown){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw new Error('reception_count_invalid');return v;}
function instant(v:unknown):string|null{if(v==null)return null;const s=text(v,40);if(!/(Z|[+-]\d{2}:\d{2})$/.test(s)||!Number.isFinite(Date.parse(s)))throw new Error('reception_time_invalid');return new Date(s).toISOString();}
function caps(v:unknown):ReceptionCapabilities{const r=record(v);return Object.fromEntries(Object.keys(RECEPTION_ACTION_LABELS).map(k=>{if(typeof r[k]!=='boolean')throw new Error('reception_capability_invalid');return [k,r[k]];})) as ReceptionCapabilities;}
function list(v:unknown,max:number){if(!Array.isArray(v)||v.length>max)throw new Error('reception_list_invalid');return v.map(record);}
export function parseReception(raw:unknown,expected:{role:string;tenantSlug:string|null;requestedTenant:string;isDemo?:boolean}):ReceptionData{
 const p=record(raw),actor=record(p.actor);
 if(expected.isDemo||p.ok!==true||p.contract!==RECEPTION_PROTOCOL||p.source!=='database'||p.demoMode===true||p.dataSource==='demo'||p.readOnly!==true)throw new Error('reception_source_invalid');
 if(actor.role!==expected.role||!['global','tenant'].includes(actor.scope))throw new Error('reception_actor_mismatch');
 const tenant=p.tenant==null?null:{id:id(p.tenant.id),slug:text(p.tenant.slug,120),name:text(p.tenant.name),type:optional(p.tenant.type),status:optional(p.tenant.status)};
 const bound=expected.tenantSlug||expected.requestedTenant;
 if(bound&&tenant?.slug!==bound)throw new Error('reception_scope_mismatch');
 if(expected.role!=='super-admin'&&(actor.scope!=='tenant'||actor.tenantSlug!==expected.tenantSlug))throw new Error('reception_scope_mismatch');
 if(expected.role==='super-admin'&&(actor.scope!=='global'||actor.tenantSlug))throw new Error('reception_scope_mismatch');
 const choices=list(p.tenantOptions,100).map(t=>({id:id(t.id),slug:text(t.slug,120),name:text(t.name),type:optional(t.type)}));
 if(expected.tenantSlug&&choices.some(t=>t.slug!==expected.tenantSlug))throw new Error('reception_scope_mismatch');
 const inv=record(p.inventory);const inventory=tenant?{total:count(inv.total),active:count(inv.active),inactive:count(inv.inactive),other:count(inv.other),seen:count(inv.seen),batches:count(inv.batches),last_seen_at:instant(inv.last_seen_at)}:null;
 if(inventory&&(inventory.active+inventory.inactive+inventory.other!==inventory.total||inventory.seen>inventory.total))throw new Error('reception_count_invalid');
 const batches=list(p.batches,20).map(b=>({id:id(b.id),bid:text(b.bid,160),status:optional(b.status),carrier_profile_code:optional(b.carrier_profile_code),total:count(b.total),active:count(b.active),inactive:count(b.inactive),last_seen_at:instant(b.last_seen_at),supplier_order_id:b.supplier_order_id==null?null:id(b.supplier_order_id),qa_status:optional(b.qa_status)}));
 if(batches.some(b=>b.active+b.inactive>b.total))throw new Error('reception_count_invalid');
 const orders=list(p.orders,10).map(o=>{
  if(!tenant||o.tenant_slug!==tenant.slug)throw new Error('reception_scope_mismatch');
  const sub_batches=list(o.sub_batches,52).map(s=>({id:id(s.id),bid:text(s.bid,160),batch_id:id(s.batch_id),expected_quantity:s.expected_quantity==null?null:count(s.expected_quantity),manifest_count:s.manifest_count==null?null:count(s.manifest_count),active_count:s.active_count==null?null:count(s.active_count),manifest_status:optional(s.manifest_status),qa_status:optional(s.qa_status),qa_acceptance_scope:s.qa_acceptance_scope==null?null:text(s.qa_acceptance_scope),manufacturing_state:optional(s.manufacturing_state),status:optional(s.status),sequence_index:count(s.sequence_index),key_export_count:s.key_export_count==null?0:count(s.key_export_count),key_exported_at:instant(s.key_exported_at),activated_at:instant(s.activated_at)}));
  return {id:id(o.id),tenant_slug:tenant.slug,order_name:optional(o.order_name),order_code:optional(o.order_code),status:optional(o.status),total_quantity:count(o.total_quantity),pack_purpose:optional(o.pack_purpose),declared_pack_purpose:optional(o.declared_pack_purpose),effective_pack_purpose:optional(o.effective_pack_purpose),carrier_profile_code:optional(o.carrier_profile_code),chip_model:optional(o.chip_model),sub_batch_size:count(o.sub_batch_size),packaging_governance_status:optional(o.packaging_governance_status),packaging_spec_revision:count(o.packaging_spec_revision),sub_batches};
 });
 if(!tenant&&(batches.length||orders.length||p.inventory!==null))throw new Error('reception_scope_mismatch');
 const roleProfiles=list(p.roleProfiles,7).map(r=>{if(r.basis!=='configured_role_defaults')throw new Error('reception_profile_invalid');return {role:text(r.role,40),label:text(r.label,120),capabilities:caps(r.capabilities),basis:'configured_role_defaults' as const};});
 const observedAt=instant(p.observedAt);if(!observedAt)throw new Error('reception_time_invalid');
 return {contract:RECEPTION_PROTOCOL,source:'database',observedAt,actor:{role:actor.role,label:text(actor.label),scope:actor.scope,tenantSlug:actor.tenantSlug||null,capabilities:caps(actor.capabilities)},tenantOptions:choices,tenant,inventory,batches,orders,roleProfiles};
}
export function receptionNextStep(order:ReceptionOrder,roll:ReceptionSubBatch){
 if(!['production','trial_integration'].includes(order.effective_pack_purpose))return 'Clasificar el propósito antes de operar';
 if(roll.manifest_status!=='imported')return 'Validar y recibir el manifiesto';
 if(roll.expected_quantity===null||roll.manifest_count!==roll.expected_quantity)return 'Reconciliar cantidad recibida y esperada';
 if(roll.qa_status!=='passed')return 'Completar QA físico y su evidencia';
 if(order.effective_pack_purpose==='trial_integration')return 'Integración: no habilita liberación comercial';
 return 'Revisar aceptación y condiciones de activación';
}
