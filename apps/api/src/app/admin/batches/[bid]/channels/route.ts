export const runtime='nodejs';export const dynamic='force-dynamic';
import {channelAccess} from '../../../../../lib/batch-channel-http';
import {readBatchChannels,registerBatchGs1,channelFailure} from '../../../../../lib/batch-channel-service';
import {readBoundedJsonBody} from '../../../../../lib/bounded-request-body';
import {json} from '../../../../../lib/http';
export async function GET(req:Request,{params}:{params:Promise<{bid:string}>}){try{const a=await channelAccess(req);if(a.response)return a.response;const {bid}=await params;return json({ok:true,...await readBatchChannels(a.tenant!,bid),canRegister:a.canWrite},200,{'cache-control':'private, no-store'});}catch(e){const f=channelFailure(e);return json({ok:false,reason:f.reason},f.status);}}
export async function POST(req:Request,{params}:{params:Promise<{bid:string}>}){try{const a=await channelAccess(req,true);if(a.response)return a.response;const {bid}=await params;const result=await registerBatchGs1(a.tenant!,bid,a.principal!.userId,await readBoundedJsonBody(req,8192));return json({...result,channels:{ok:true,...await readBatchChannels(a.tenant!,bid),canRegister:a.canWrite}},200,{'cache-control':'private, no-store'});}catch(e){const f=channelFailure(e);return json({ok:false,reason:f.reason},f.status);}}
