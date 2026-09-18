import { createHash, randomUUID } from "node:crypto";
export const LOGISTICS_ATOMIC_MIGRATION="20260918050000_0103_logistics_atomic_operations.sql";
export class LogisticsOperationError extends Error {
  constructor(public readonly reason:string, public readonly status=400){super(reason);this.name="LogisticsOperationError";}
}
export function logisticsText(value:unknown,max=200){
  if(value==null||value==="")return "";
  if(typeof value!=="string"||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw new LogisticsOperationError("logistics_input_invalid");
  return value.trim();
}
export function logisticsUuid(value:unknown,required=true){const s=logisticsText(value,36);if(!s&&!required)return "";if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s))throw new LogisticsOperationError("logistics_id_invalid");return s.toLowerCase();}
export function logisticsRequestIdentity(value:unknown){
  const provided=value!==undefined&&value!==null&&value!=="";
  const key=provided?logisticsText(value,120):randomUUID();
  if(!/^[A-Za-z0-9._:-]{8,120}$/.test(key))throw new LogisticsOperationError("logistics_operation_key_invalid");
  return {keyHash:createHash("sha256").update(key).digest("hex"),provided};
}
export function logisticsItems(value:unknown){
  if(!Array.isArray(value)||value.length<1||value.length>200)throw new LogisticsOperationError("logistics_items_invalid");
  return value.map(item=>{if(!item||typeof item!=="object"||Array.isArray(item))throw new LogisticsOperationError("logistics_items_invalid");const productName=logisticsText(item.productName??item.product_name,180);const quantity=item.quantity;if(!productName||typeof quantity!=="number"||!Number.isSafeInteger(quantity)||quantity<1||quantity>1000000)throw new LogisticsOperationError("logistics_items_invalid");return {productName,quantity};});
}
export function logisticsFailure(error:unknown){
  if(error instanceof LogisticsOperationError)return {reason:error.reason,status:error.status};
  if(error instanceof SyntaxError)return {reason:"logistics_json_invalid",status:400};
  if(error instanceof Error && error.name==="RequestBodyTooLargeError")return {reason:"request_body_too_large",status:413};
  const code=error&&typeof error==="object"&&"code" in error?String(error.code):"";
  const message=error instanceof Error?error.message:"";
  if(code==="42883"||code==="42P01")return {reason:"logistics_migration_required",status:503};
  if(code==="23505")return {reason:"logistics_reference_conflict",status:409};
  const reasons=new Set(["logistics_input_invalid","logistics_tenant_not_found","logistics_items_invalid","logistics_carrier_not_found","logistics_uid_invalid","logistics_seal_not_found","logistics_seal_voided","logistics_assignment_ambiguous","logistics_shipment_required","logistics_seal_already_assigned","logistics_seal_unassigned","logistics_shipment_not_found","logistics_shipment_terminal","logistics_idempotency_conflict"]);
  if(reasons.has(message))return {reason:message,status:/not_found$/.test(message)?404:message.includes("invalid")||message.includes("required")?400:409};
  return {reason:"logistics_operation_unavailable",status:503};
}

export function logisticsOperationKey(req:Request,body:Record<string,unknown>){
  const header=req.headers.get("idempotency-key"),field=body.operation_key??body.operationKey;
  if(header && field && header!==field)throw new LogisticsOperationError("logistics_operation_key_conflict");
  return header|| (typeof field==="string"?field:field==null?undefined:(()=>{throw new LogisticsOperationError("logistics_operation_key_invalid");})());
}
