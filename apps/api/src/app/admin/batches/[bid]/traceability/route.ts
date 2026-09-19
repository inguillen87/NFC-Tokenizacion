export const runtime='nodejs';
export const dynamic='force-dynamic';
import {handleBatchTraceability} from '../../../../../lib/batch-traceability-http';
export async function GET(req:Request,{params}:{params:Promise<{bid:string}>}){return handleBatchTraceability(req,(await params).bid);}
