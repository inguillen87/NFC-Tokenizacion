export const runtime='nodejs';
export const dynamic='force-dynamic';
import {handleBatchTrace} from '../../../../../../../lib/batch-trace-http';
export async function GET(req:Request,{params}:{params:Promise<{bid:string;eventId:string}>}){
 const {bid,eventId}=await params;
 return handleBatchTrace(req,bid,eventId);
}
