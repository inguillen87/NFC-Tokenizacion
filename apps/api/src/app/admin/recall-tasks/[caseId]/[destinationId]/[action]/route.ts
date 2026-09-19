export const runtime='nodejs';export const dynamic='force-dynamic';
import {handleAssignedRecall} from '../../../../../../lib/recall-task-http';
export async function POST(req:Request,{params}:{params:Promise<{caseId:string;destinationId:string;action:string}>}){const p=await params;return handleAssignedRecall(req,p.caseId,p.destinationId,p.action);}
