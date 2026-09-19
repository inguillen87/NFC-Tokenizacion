export const runtime='nodejs';export const dynamic='force-dynamic';
import {handleEpcisIntake} from '../../../../../../lib/epcis-intake-http';
export async function POST(req:Request,{params}:{params:Promise<{bid:string}>}){const {bid}=await params;return handleEpcisIntake(req,bid,'commit');}
