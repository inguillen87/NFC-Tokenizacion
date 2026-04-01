export const runtime = 'nodejs';

import { sql } from '../../../lib/db';
import { json } from '../../../lib/http';
import { auditAuthEvent, revokeSession } from '../../../lib/iam';
import { requireApiSession } from '../../../lib/auth-guard';

export async function GET(req: Request) {
  const { error, session } = await requireApiSession(req);
  if (error || !session) return error;
  return json({ ok: true, session, rotatedSessionToken: session.rotatedCookieValue });
}

export async function DELETE(req: Request) {
  const { error, session, meta, token } = await requireApiSession(req);
  if (error || !session) return json({ ok: true });
  await revokeSession(sql as any, token);
  await auditAuthEvent(sql as any, { email: session.email, eventName: 'logout', ok: true, role: session.role.replaceAll('-', '_'), ip: meta.ip, userAgent: meta.userAgent, meta: { sessionId: session.id } }).catch(() => null);
  return json({ ok: true });
}
