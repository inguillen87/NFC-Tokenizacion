export const runtime='nodejs';
export const dynamic='force-dynamic';
import {editorialQueueRequest} from '../../../../lib/editorial-queue-http';
export const GET=(req:Request)=>editorialQueueRequest(req);
