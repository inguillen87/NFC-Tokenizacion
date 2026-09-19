export const runtime='nodejs';export const dynamic='force-dynamic';
import {handleNoticeReview} from '../../../../../../../lib/recall-notice-http';
export async function POST(req:Request,{params}:{params:Promise<{bid:string;caseId:string;action:string}>}){const {bid,caseId,action}=await params;return handleNoticeReview(req,bid,caseId,action);}
