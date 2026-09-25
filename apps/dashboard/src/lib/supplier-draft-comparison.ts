import { SUPPLIER_CONSTRUCTIONS } from './supplier-order-draft';
import { SUPPLIER_DRAFT_FIELD_ORDER, validateSupplierDraft, type SupplierDraftFields, type SupplierDraftField } from './supplier-request-draft-guidance';
import type { SupplierRequestContent } from './supplier-request-client';
export type DraftComparisonRecord = SupplierRequestContent & {id:string;tenant_id:string;tenant_slug:string;revision:number;status:string};
export type DraftChoice = 'local'|'server';
export type DraftChoices = Partial<Record<SupplierDraftField,DraftChoice>>;
export type DraftChange = 'unchanged'|'local_only'|'server_only'|'same_change'|'conflict';
export const DRAFT_CHANGE_LABELS:Record<DraftChange,string>={unchanged:'Sin cambios',local_only:'Cambio sólo en tu edición',server_only:'Cambio sólo en el servidor',same_change:'Ambas ediciones coinciden',conflict:'Cambió en ambas ediciones: elegí qué conservar'};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const invalid=():never=>{throw new Error('supplier_draft_comparison_invalid');};
export function draftRecordFields(record:DraftComparisonRecord):SupplierDraftFields {
  if(!record||typeof record!=='object'||Array.isArray(record)||!UUID.test(record.id)||!UUID.test(record.tenant_id)||! /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(record.tenant_slug)
    ||!Number.isSafeInteger(record.revision)||record.revision<1||record.revision>=2147483647||!['draft','submitted','provisioned','cancelled'].includes(record.status)
    ||![record.title,record.construction_id,record.notes].every(v=>typeof v==='string')||![null,'trial_integration','production'].includes(record.pack_purpose)
    ||!(record.quantity===null||Number.isSafeInteger(record.quantity)&&record.quantity>=1&&record.quantity<=100000000))return invalid();
  const fields={title:record.title,construction_id:record.construction_id,quantity:record.quantity===null?'':String(record.quantity),pack_purpose:record.pack_purpose||'',notes:record.notes};
  if(!validateSupplierDraft(fields).content)return invalid();return fields;
}
function canonical(field:SupplierDraftField,value:string):string {
  const v=value.trim();
  if(field==='quantity'&&/^\d+$/.test(v)&&Number.isSafeInteger(Number(v))&&Number(v)>=1&&Number(v)<=100000000)return String(Number(v));
  return field==='title'||field==='notes'||field==='quantity'?v:value;
}
/** Three-way comparison is local presentation, never an automatic database merge. */
export function prepareDraftComparison(base:DraftComparisonRecord,server:DraftComparisonRecord,local:SupplierDraftFields){
  const before=draftRecordFields(base),remote=draftRecordFields(server);
  if(base.status!=='draft'||base.id!==server.id||base.tenant_id!==server.tenant_id||base.tenant_slug!==server.tenant_slug||server.revision<base.revision)return invalid();
  if(!local||typeof local!=='object'||Array.isArray(local)||Object.keys(local).length!==SUPPLIER_DRAFT_FIELD_ORDER.length||SUPPLIER_DRAFT_FIELD_ORDER.some(k=>!Object.hasOwn(local,k)||typeof local[k]!=='string'))return invalid();
  if(server.revision===base.revision&&(server.status!==base.status||SUPPLIER_DRAFT_FIELD_ORDER.some(k=>before[k]!==remote[k])))return invalid();
  const rows=SUPPLIER_DRAFT_FIELD_ORDER.map(field=>{
    const b=canonical(field,before[field]),l=canonical(field,local[field]),s=canonical(field,remote[field]);
    const localChanged=l!==b,serverChanged=s!==b;
    const kind:DraftChange=!localChanged&&!serverChanged?'unchanged':localChanged&&!serverChanged?'local_only':!localChanged&&serverChanged?'server_only':l===s?'same_change':'conflict';
    const suggestion:DraftChoice|null=kind==='conflict'?null:kind==='server_only'?'server':'local';
    return{field,kind,suggestion,base:before[field],local:local[field],server:remote[field]};
  });
  // Includes all compared inputs, not only revision. Used only in process memory.
  const token=JSON.stringify([base.id,base.tenant_id,base.tenant_slug,base.revision,server.revision,server.status,SUPPLIER_DRAFT_FIELD_ORDER.map(k=>[before[k],local[k],remote[k]])]);
  return{token,rows,editable:server.status==='draft',baseRevision:base.revision,serverRevision:server.revision,serverStatus:server.status,conflicts:rows.filter(r=>r.kind==='conflict').length};
}
export type DraftComparisonPlan=ReturnType<typeof prepareDraftComparison>;
export function resolveDraftComparison(base:DraftComparisonRecord,server:DraftComparisonRecord,local:SupplierDraftFields,choices:DraftChoices){
  const plan=prepareDraftComparison(base,server,local);
  if(!choices||typeof choices!=='object'||Array.isArray(choices)||![Object.prototype,null].includes(Object.getPrototypeOf(choices))||Object.entries(choices).some(([k,v])=>!SUPPLIER_DRAFT_FIELD_ORDER.includes(k as SupplierDraftField)||!['local','server'].includes(String(v))))return invalid();
  if(!plan.editable)return{ok:false as const,reason:'not_draft' as const,pending:[],errors:{}};
  const pending=plan.rows.filter(row=>!(choices[row.field]||row.suggestion)).map(row=>row.field);
  if(pending.length)return{ok:false as const,reason:'unresolved' as const,pending,errors:{}};
  const fields=Object.fromEntries(plan.rows.map(row=>[row.field,row[(choices[row.field]||row.suggestion)!]])) as SupplierDraftFields;
  const validation=validateSupplierDraft(fields);
  if(!validation.content)return{ok:false as const,reason:'invalid' as const,pending:[],errors:validation.errors};
  // Exact raw local strings are retained; usual validation applies only on save.
  return{ok:true as const,fields,token:plan.token,revision:server.revision,pending:[],errors:{}};
}
export function draftComparisonValue(field:SupplierDraftField,value:string):string {
  if(field==='construction_id')return SUPPLIER_CONSTRUCTIONS.find(c=>c.id===value)?.label||'Por definir';
  if(field==='pack_purpose')return value==='production'?'Producción sujeta a aprobación':value==='trial_integration'?'Ensayo de integración · no vendible':'Sin elegir';
  return value|| (field==='notes'?'Sin notas':field==='quantity'?'Cantidad pendiente':'Sin nombre');
}
