export const runtime='nodejs';export const dynamic='force-dynamic';
import {handleProduction} from '../../../../../../lib/gs1-production-http';
export async function GET(req:Request,{params}:{params:Promise<{bid:string}>}){return handleProduction(req,(await params).bid,'history');}
