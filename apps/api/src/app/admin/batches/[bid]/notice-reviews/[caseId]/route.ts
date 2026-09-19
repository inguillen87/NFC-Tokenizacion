export const runtime='nodejs';export const dynamic='force-dynamic';
import {handleNoticeReview} from '../../../../../../lib/recall-notice-http';
export async function GET(req:Request,{params}:{params:Promise<{bid:string;caseId:string}>}){const {bid,caseId}=await params;return handleNoticeReview(req,bid,caseId);}
