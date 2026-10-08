import { proxySommelierRequest } from "../../../_lib/sommelier-proxy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) { return proxySommelierRequest(req, "/public/sommelier/demo/session"); }
