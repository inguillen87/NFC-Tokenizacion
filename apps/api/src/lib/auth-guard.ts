import { sql } from "./db";
import { json } from "./http";
import { hasPermission, resolveSession } from "./iam";
import { getRequestMeta } from "./request-meta";

export async function requireApiSession(req: Request, permission?: string) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const session = await resolveSession(sql as any, token);
  if (!session) return { error: json({ ok: false, reason: "unauthorized" }, 401), session: null, meta: getRequestMeta(req), token } as const;
  if (!hasPermission(session, permission)) return { error: json({ ok: false, reason: "forbidden" }, 403), session, meta: getRequestMeta(req), token } as const;
  return { error: null, session, meta: getRequestMeta(req), token } as const;
}
