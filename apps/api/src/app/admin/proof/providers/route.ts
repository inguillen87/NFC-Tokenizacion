export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { json } from "../../../../lib/http";

export async function GET(req: Request) {
  const auth = checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;

  return json({
    ok: true,
    providers: [
      { id: "iota", name: "IOTA", type: "EVM", status: "active" },
      { id: "polygon", name: "Polygon", type: "EVM", status: "active" }
    ]
  });
}
