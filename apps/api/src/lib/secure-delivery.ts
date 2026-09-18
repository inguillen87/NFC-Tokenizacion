import { sql } from "./db";
import { classifyTamperState, nextSealStatusForScan, resolveSealStatusForScan, type SecureDeliveryScanContext } from "./secure-delivery-policy";
import { logisticsItems, logisticsRequestIdentity, logisticsText, logisticsUuid, LogisticsOperationError } from "./logistics-operation-policy";
export { classifyTamperState, nextSealStatusForScan, resolveSealStatusForScan };
export type { SealStatus, SecureDeliveryScanContext, TamperState } from "./secure-delivery-policy";
type Identity = { operationKey?:string; actorScope?:string };
type Receipt = {receiptId:string;replayed:boolean;idempotencyProvided:boolean;protocol:"nexid.logistics.v1"};
export type CreatedShipment=Receipt & {id:string;tenantId:string;shipmentCode:string;status:string;trackingNumber:string|null;itemCount:number};
export type SealOperation=Receipt & {sealId:string;previousStatus:string;newStatus:string;shipmentId:string;shipmentStatus:string;tamperState:string;custodyEventId:string;evidenceKind:"operator_declared"};
async function commit<T>(tenantId:string,payload:Record<string,unknown>,identity:Identity):Promise<T&Receipt>{
  const tenant=logisticsUuid(tenantId),actor=logisticsText(identity.actorScope||"legacy-authorized-caller",180);
  const request=logisticsRequestIdentity(identity.operationKey);
  const rows=await sql`SELECT public.nexid_logistics_commit_v1(${tenant}::uuid,${actor},${request.keyHash},${JSON.stringify(payload)}::jsonb) AS result`;
  const result=rows[0]?.result as {ok?:boolean;replayed?:boolean;receiptId?:string;data?:unknown}|undefined;
  if(!result||result.ok!==true||typeof result.replayed!=="boolean"||!result.receiptId||!result.data||typeof result.data!=="object")throw new LogisticsOperationError("logistics_receipt_invalid",503);
  return {...result.data as T,receiptId:result.receiptId,replayed:result.replayed,idempotencyProvided:request.provided,protocol:"nexid.logistics.v1"};
}
export async function createShipment(params:Identity & {tenantId:string;shipmentCode?:string;carrierCode?:string;trackingNumber?:string;originAddress?:string;destinationAddress?:string;items?:Array<{productName?:string;product_name?:string;quantity?:number}>}):Promise<CreatedShipment>{
  const payload={operation:"CREATE",shipmentCode:logisticsText(params.shipmentCode,120),carrierCode:logisticsText(params.carrierCode,100),trackingNumber:logisticsText(params.trackingNumber,180),originAddress:logisticsText(params.originAddress,500),destinationAddress:logisticsText(params.destinationAddress,500),items:logisticsItems(params.items)};
  return commit<CreatedShipment>(params.tenantId,payload,params);
}
export async function processSealScan(params:Identity & {uidHex:string;tenantId:string;ttRaw:string|null;shipmentId?:string;location?:string;scannedBy?:string;context:SecureDeliveryScanContext;recipientName?:string;verificationMethod?:string}):Promise<SealOperation>{
  const uidHex=logisticsText(params.uidHex,14).toUpperCase();if(!/^[A-F0-9]{14}$/.test(uidHex))throw new LogisticsOperationError("logistics_uid_invalid");
  if(!["APPLY","HANDOFF","VERIFY"].includes(params.context))throw new LogisticsOperationError("logistics_context_invalid");
  const shipmentId=logisticsUuid(params.shipmentId,params.context==="APPLY");
  const payload={operation:params.context,uidHex,shipmentId,ttRaw:logisticsText(params.ttRaw,16).toUpperCase(),location:logisticsText(params.location,300),scannedBy:logisticsText(params.scannedBy,180),recipientName:logisticsText(params.recipientName,180),verificationMethod:logisticsText(params.verificationMethod,80)||"OPERATOR_DECLARATION"};
  return commit<SealOperation>(params.tenantId,payload,params);
}
