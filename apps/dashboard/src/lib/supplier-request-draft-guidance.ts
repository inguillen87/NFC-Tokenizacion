import { SUPPLIER_CONSTRUCTIONS } from './supplier-order-draft';
import type { SupplierRequestContent } from './supplier-request-client';

export type SupplierDraftFields = { title:string; construction_id:string; quantity:string; pack_purpose:string; notes:string };
export type SupplierDraftField = keyof SupplierDraftFields;
export const SUPPLIER_DRAFT_LABELS: Record<SupplierDraftField,string> = {
  title:'Producto o proyecto', construction_id:'Construcción solicitada', quantity:'Cantidad solicitada', pack_purpose:'Destino del pedido', notes:'Necesidades y notas',
};
export const SUPPLIER_DRAFT_FIELD_ORDER: readonly SupplierDraftField[] = ['title','construction_id','quantity','pack_purpose','notes'];
/** Local input help only. Server authorization, completeness and receipts remain authoritative. */
export function validateSupplierDraft(fields: SupplierDraftFields) {
  const errors: Partial<Record<SupplierDraftField,string>> = {};
  const title=fields.title.trim(), notes=fields.notes.trim(), quantityText=fields.quantity.trim();
  if(!title)errors.title='Dale un nombre al producto o proyecto para poder guardar el borrador.';
  else if(title.length>200)errors.title='El nombre admite hasta 200 caracteres.';
  if(notes.length>4000)errors.notes='Las notas admiten hasta 4.000 caracteres.';
  const quantity=quantityText?Number(quantityText):null;
  if(quantity!==null&&(!/^\d+$/.test(quantityText)||!Number.isSafeInteger(quantity)||quantity<1||quantity>100_000_000))errors.quantity='Usá un entero entre 1 y 100.000.000, sin puntos ni comas. Puede quedar vacío en el borrador.';
  if(fields.construction_id&&!SUPPLIER_CONSTRUCTIONS.some(c=>c.id===fields.construction_id))errors.construction_id='Elegí una construcción de la lista o dejala por definir.';
  if(fields.pack_purpose&&!['trial_integration','production'].includes(fields.pack_purpose))errors.pack_purpose='Elegí ensayo de integración o producción, o dejá el destino sin elegir.';
  const content:SupplierRequestContent|null=Object.keys(errors).length?null:{title,notes,quantity,construction_id:fields.construction_id,pack_purpose:fields.pack_purpose==='production'||fields.pack_purpose==='trial_integration'?fields.pack_purpose:null};
  const missing=SUPPLIER_DRAFT_FIELD_ORDER.filter(field=>field!=='notes'&&(Boolean(errors[field])||!fields[field].trim()));
  return {errors,content,missing,readyForReview:missing.length===0&&content!==null};
}
export function supplierDraftNextStep(input:{fields:SupplierDraftFields;saved:boolean;dirty:boolean;waiting:boolean;uncertain:boolean;conflict:boolean}) {
  if(input.uncertain)return 'El resultado del guardado sigue sin confirmar. Usá «Comprobar el mismo guardado»; no generes otra solicitud.';
  if(input.waiting)return 'Esperá a que termine la operación actual. Los controles vuelven a estar disponibles al finalizar.';
  if(input.conflict)return 'La versión guardada cambió en otra sesión. Compará la versión actual antes de guardar o enviar; tu texto sigue aquí.';
  const check=validateSupplierDraft(input.fields);
  if(!check.content)return 'Revisá los campos indicados antes de guardar. Los datos escritos permanecen en este formulario.';
  if(!input.saved)return 'Guardá el borrador primero. Guardar no envía la solicitud a NexID.';
  if(input.dirty)return 'Hay cambios locales: guardalos antes de revisar el envío. Todavía no se envió esta edición.';
  if(check.missing.length)return 'El borrador está guardado. Completá los datos pendientes y guardá los cambios para poder revisar el envío.';
  return 'El borrador guardado tiene los datos requeridos. Revisá el resumen; sólo la confirmación final envía la solicitud a NexID.';
}
