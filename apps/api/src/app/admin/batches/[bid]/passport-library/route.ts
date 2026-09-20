export const runtime='nodejs';
export const dynamic='force-dynamic';
import {publishedLibraryRequest} from '../../../../../lib/passport-library';
export async function GET(req:Request,{params}:{params:Promise<{bid:string}>}){return publishedLibraryRequest(req,(await params).bid);}
