export const runtime='nodejs';export const dynamic='force-dynamic';
import {handleAssignedRecall} from '../../../lib/recall-task-http';
export async function GET(req:Request){return handleAssignedRecall(req);}
