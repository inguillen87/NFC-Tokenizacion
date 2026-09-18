export const runtime='nodejs';export const dynamic='force-dynamic';
import {handleRecall} from '../../../../../../lib/recall-http';
export async function GET(req:Request,{params}:{params:Promise<{bid:string;action:string}>}){const p=await params;return handleRecall(req,p.bid,undefined,p.action);}
export async function POST(req:Request,{params}:{params:Promise<{bid:string;action:string}>}){const p=await params;return handleRecall(req,p.bid,p.action);}
