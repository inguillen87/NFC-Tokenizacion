export const runtime='nodejs';export const dynamic='force-dynamic';
import {handleAssignedRecall} from '../../../../../lib/recall-task-http';
export async function GET(req:Request,{params}:{params:Promise<{caseId:string;destinationId:string}>}){const p=await params;return handleAssignedRecall(req,p.caseId,p.destinationId);}
