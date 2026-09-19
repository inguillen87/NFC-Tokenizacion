export const runtime='nodejs';
export const dynamic='force-dynamic';
import {handleTracePage} from '../../../../../../lib/trace-page-http';
export async function GET(req:Request,{params}:{params:Promise<{bid:string}>}){return handleTracePage(req,(await params).bid);}
