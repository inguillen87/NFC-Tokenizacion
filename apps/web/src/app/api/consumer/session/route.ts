import { proxyToApi } from "../../_lib/runtime-proxy";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return proxyToApi(req, "/consumer/session");
}
