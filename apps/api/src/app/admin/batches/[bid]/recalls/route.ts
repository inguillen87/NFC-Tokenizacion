export const runtime='nodejs';export const dynamic='force-dynamic';
import {handleRecall} from '../../../../../lib/recall-http';
export async function GET(req:Request,{params}:{params:Promise<{bid:string}>}){return handleRecall(req,(await params).bid);}
