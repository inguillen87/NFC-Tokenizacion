export const runtime = 'nodejs';

import { sql } from '../../../lib/db';
import { json } from '../../../lib/http';
import { auditAuthEvent, revokeSession } from '../../../lib/iam';
import { requireApiSession } from '../../../lib/auth-guard';
import { ensureEnterpriseIamSchema } from '../../../lib/commercial-runtime-schema';

export async function GET(req: Request) {
  await ensureEnterpriseIamSchema();
  const rotate = req.headers.get("x-nexid-session-rotation") === "rotate";
  const { error, session } = await requireApiSession(req, undefined, { rotate });
  if (error || !session) return error;
  return json({ ok: true, session, rotatedSessionToken: session.rotatedCookieValue });
}

export async function DELETE(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const bearerToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (bearerToken.startsWith('demo.')) return json({ ok: true, demoMode: true });

  await ensureEnterpriseIamSchema();
  const { error, session, meta, token } = await requireApiSession(req);
  if (error || !session) return json({ ok: true });
  await revokeSession(sql as any, token);
  await auditAuthEvent(sql as any, { email: session.email, eventName: 'logout', ok: true, role: session.role.replaceAll('-', '_'), ip: meta.ip, userAgent: meta.userAgent, meta: { sessionId: session.id } }).catch(() => null);
  return json({ ok: true });
}
