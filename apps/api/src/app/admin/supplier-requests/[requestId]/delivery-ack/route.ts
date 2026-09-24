import{makeSupplierDeliveryAckHandlers}from"../../../../../lib/supplier-request-delivery-ack-http";
const handlers=makeSupplierDeliveryAckHandlers();
type Context={params:Promise<{requestId:string}>};
export async function GET(req:Request,context:Context){return handlers.get(req,(await context.params).requestId);}
export async function POST(req:Request,context:Context){return handlers.post(req,(await context.params).requestId);}
