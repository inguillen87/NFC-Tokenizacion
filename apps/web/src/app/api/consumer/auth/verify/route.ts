import { proxyToApi } from "../../../_lib/runtime-proxy";
export const runtime = "nodejs";
export async function POST(req: Request) { return proxyToApi(req, "/consumer/auth/verify"); }
