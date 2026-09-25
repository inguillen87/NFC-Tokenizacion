import type { SupplierRequest } from "./supplier-request-client";
import { INBOX_STATES, inboxActivity, inboxActivityLabel, inboxNextStep, inboxState } from "./supplier-request-inbox";
export type SupplierCaseOwner = "company"|"nexid"|"technical"|"closed"|"confirm";
export type SupplierCaseSnapshot = { state:ReturnType<typeof inboxState>; stateLabel:string; owner:SupplierCaseOwner; ownerLabel:string; nextStep:string; activity:string|null; activityLabel:string; milestones:{id:"created"|"submitted"|"review"|"cancelled";label:string;at:string}[]; orderHref:string|null; quotationLabel:string|null };
const quoteLabels:Record<string,string>={offered:"Cotización enviada",accepted:"Cotización aceptada",rejected:"Cotización rechazada",withdrawn:"Cotización retirada"};
export const supplierCaseTimestamp=(value:string)=>value.slice(0,10)+" · "+value.slice(11,16)+" UTC";
export function supplierCaseOwner(request:SupplierRequest):SupplierCaseOwner {
  const state=inboxState(request);
  if(state==="draft"||state==="needs_information")return "company";
  if(state==="pending"||state==="answered")return "nexid";
  if(state==="provisioned")return "technical";
  if(state==="cancelled")return "closed";
  return "confirm";
}
export const supplierCaseOwnerLabel=(owner:SupplierCaseOwner)=>owner==="company"?"Empresa":owner==="nexid"?"NexID":owner==="technical"?"Operación técnica":owner==="closed"?"Cerrado":"Confirmar estado";
export function supplierCaseSnapshot(request:SupplierRequest,isNexid:boolean):SupplierCaseSnapshot {
  const state=inboxState(request),owner=supplierCaseOwner(request),extended=request as SupplierRequest & {cancelled_at?:string;quotation_revision?:number;quotation_state?:string|null};
  const milestones:SupplierCaseSnapshot["milestones"]=[{id:"created",label:"Creada",at:request.created_at}];
  if(request.submitted_at)milestones.push({id:"submitted",label:"Enviada a NexID",at:request.submitted_at});
  if(request.review_summary?.updated_at)milestones.push({id:"review",label:"Última aclaración",at:request.review_summary.updated_at});
  if(extended.cancelled_at)milestones.push({id:"cancelled",label:"Cancelada",at:extended.cancelled_at});
  const quotationLabel=extended.quotation_revision&&extended.quotation_state?`${quoteLabels[extended.quotation_state]||"Cotización"} · revisión ${extended.quotation_revision}`:null;
  return {state,stateLabel:INBOX_STATES[state],owner,ownerLabel:supplierCaseOwnerLabel(owner),nextStep:inboxNextStep(request,isNexid),activity:inboxActivity(request),activityLabel:inboxActivityLabel(request),milestones,orderHref:request.order_id?`/supplier-orders/${request.order_id}?tenant=${encodeURIComponent(request.tenant_slug)}`:null,quotationLabel};
}
