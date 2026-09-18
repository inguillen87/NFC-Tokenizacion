export const LOGISTICS_PROTOCOL="nexid.logistics.v1";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function logisticsStatus(value:string){return ({draft:"Borrador",UNASSIGNED:"Sin asignar",ASSIGNED:"Asignado",SEALED:"Precintado declarado",IN_TRANSIT:"En tránsito declarado",DELIVERED_CLOSED:"Recibido · cerrado reportado",DELIVERED_OPENED:"Recibido · apertura reportada",QUARANTINED:"Requiere revisión",VOIDED:"Anulado"} as Record<string,string>)[value]||"Estado no reconocido";}
export type LogisticsShipment={id:string;code:string;tenant:string;status:string;origin:string;destination:string;items:number;units:number;seals:number;events:number;updatedAt:string|null};
export type LogisticsOverview={ready:boolean;reason:string;observedAt:string|null;protocolReady:boolean;stats:{total:number;in_transit:number;delivered:number;alerts:number}|null;rows:LogisticsShipment[]};
function record(v:unknown):Record<string,unknown>{return v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};}
function text(v:unknown,max=500){return typeof v==="string"?v.replace(/[\u0000-\u001f]/g," ").slice(0,max):"";}
function count(v:unknown){return typeof v==="number"&&Number.isSafeInteger(v)&&v>=0?v:null;}
function timestamp(v:unknown){return typeof v==="string"&&/(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;}
export function logisticsOverview(value:unknown,tenant:string,responseOk=true):LogisticsOverview{
  const fail=(reason:string):LogisticsOverview=>({ready:false,reason,observedAt:null,protocolReady:false,stats:null,rows:[]});
  if(!responseOk)return fail("source_unavailable");const p=record(value),scope=record(p.scope),stats=record(p.stats);
  if(p.ok!==true||p.dataSource!=="production"||p.demoMode===true||!Array.isArray(p.shipments)||p.shipments.length>100)return fail("source_unconfirmed");
  if(tenant&&scope.tenant!==tenant)return fail("scope_mismatch");
  const values=[stats.total,stats.in_transit,stats.delivered,stats.alerts].map(count);
  if(values.some(v=>v===null)||(values[0]??0)<p.shipments.length||values.slice(1).reduce<number>((sum,n)=>sum+(n??0),0)>(values[0]??0))return fail("counts_invalid");
  const rows:LogisticsShipment[]=[];
  for(const item of p.shipments){const row=record(item);if(!UUID.test(String(row.id))||typeof row.tenant_slug!=="string"||(tenant&&row.tenant_slug!==tenant))return fail("scope_mismatch");const nums=[row.item_count,row.item_quantity,row.seal_count,row.custody_event_count].map(count);if(nums.some(v=>v===null))return fail("counts_invalid");rows.push({id:String(row.id),code:text(row.shipment_code,120),tenant:row.tenant_slug,status:text(row.status,60),origin:text(row.origin_address),destination:text(row.destination_address),items:nums[0]!,units:nums[1]!,seals:nums[2]!,events:nums[3]!,updatedAt:timestamp(row.updated_at)});}
  return {ready:true,reason:"",observedAt:timestamp(p.observedAt),protocolReady:p.operationProtocol===LOGISTICS_PROTOCOL,stats:{total:values[0]!,in_transit:values[1]!,delivered:values[2]!,alerts:values[3]!},rows};
}
export type LogisticsReceipt={id:string;replayed:boolean;shipmentId:string;shipmentCode:string;status:string;previousStatus:string;sealStatus:string;itemCount:number|null};
export function logisticsReceipt(raw:unknown,operation:"CREATE"|"APPLY"|"HANDOFF"|"VERIFY",tenant:string,shipmentId=""):LogisticsReceipt|null{
  const p=record(raw),data=record(operation==="CREATE"?p.shipment:p.data),scope=record(p.tenant);
  if(p.ok!==true||data.protocol!==LOGISTICS_PROTOCOL||data.idempotencyProvided!==true||typeof data.replayed!=="boolean"||!UUID.test(String(data.receiptId))||scope.slug!==tenant)return null;
  const id=text(operation==="CREATE"?data.id:data.shipmentId,36);if(!UUID.test(id)||(shipmentId&&id!==shipmentId))return null;
  return {id:String(data.receiptId),replayed:data.replayed,shipmentId:id,shipmentCode:text(data.shipmentCode,120),status:text(operation==="CREATE"?data.status:data.shipmentStatus,60),previousStatus:text(data.previousStatus,60),sealStatus:text(data.newStatus,60),itemCount:count(data.itemCount)};
}
