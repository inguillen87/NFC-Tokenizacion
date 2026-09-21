export const runtime='nodejs';
export const dynamic='force-dynamic';
import {consumerHistoryRequest} from '../../../../lib/consumer-history';
export async function GET(req:Request){return consumerHistoryRequest(req);}
