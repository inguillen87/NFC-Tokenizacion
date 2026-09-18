export const runtime='nodejs';export const dynamic='force-dynamic';
import QRCode from 'qrcode';
import {channelAccess} from '../../../../../../lib/batch-channel-http';
import {batchQrDestination,channelFailure} from '../../../../../../lib/batch-channel-service';
import {json} from '../../../../../../lib/http';
export async function GET(req:Request,{params}:{params:Promise<{bid:string}>}){try{const a=await channelAccess(req);if(a.response)return a.response;const {bid}=await params;const result=await batchQrDestination(a.tenant!,bid,new URL(req.url).searchParams.get('identity')||'');const svg=await QRCode.toString(result.url,{type:'svg',errorCorrectionLevel:'M',margin:4,width:512});return json({ok:true,...result,svg},200,{'cache-control':'private, no-store','x-content-type-options':'nosniff'});}catch(e){const f=channelFailure(e);return json({ok:false,reason:f.reason},f.status);}}
