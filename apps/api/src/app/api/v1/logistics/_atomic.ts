import { json } from "../../../../lib/http";
import { readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { ensureSecureDeliverySchema } from "../../../../lib/secure-delivery-schema";
import { processSealScan, type SecureDeliveryScanContext } from "../../../../lib/secure-delivery";
import { logisticsFailure, logisticsOperationKey, logisticsText, LogisticsOperationError } from "../../../../lib/logistics-operation-policy";
import { authenticateLogisticsRequest, logLogisticsUsage, readUid, readShipmentId, rejectBodyTenantMismatch } from "./_shared";
export async function executeLogisticsScan(req:Request,context:SecureDeliveryScanContext,endpoint:string){
  const startedAt=Date.now();
  const auth=await authenticateLogisticsRequest(req,endpoint,startedAt);if(!auth.ok)return auth.response;
  try {
    await ensureSecureDeliverySchema();
    const body=await readBoundedJsonBody<Record<string,unknown>>(req,65536);
    if(!body||typeof body!=="object"||Array.isArray(body))throw new LogisticsOperationError("logistics_input_invalid");
    const mismatch=rejectBodyTenantMismatch(body,auth.context);if(mismatch)return mismatch;
    const result=await processSealScan({tenantId:auth.context.tenantId,uidHex:readUid(body),shipmentId:readShipmentId(body)||undefined,ttRaw:logisticsText(body.ttRaw??body.tt_raw,16)||null,location:logisticsText(body.location,300),scannedBy:logisticsText(body.scannedBy??body.scanned_by??body.operator,180),recipientName:logisticsText(body.recipientName??body.recipient_name,180),verificationMethod:logisticsText(body.verificationMethod??body.verification_method,80),context,operationKey:logisticsOperationKey(req,body),actorScope:`sdk:${auth.context.apiKeyId}`});
    await logLogisticsUsage({req,context:auth.context,endpoint,statusCode:200,startedAt,meta:{receiptId:result.receiptId,replayed:result.replayed}});
    return json({ok:true,tenant:{slug:auth.context.tenantSlug},trace_id:auth.context.traceId,data:result},200,{"cache-control":"no-store"});
  }catch(error){const failure=logisticsFailure(error);await logLogisticsUsage({req,context:auth.context,endpoint,statusCode:failure.status,startedAt,reason:failure.reason});return json({ok:false,reason:failure.reason,trace_id:auth.context.traceId},failure.status,{"cache-control":"no-store"});}
}
