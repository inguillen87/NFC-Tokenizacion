export const runtime = 'nodejs';

import { json } from '../../../../lib/http';
import { requireApiSession } from '../../../../lib/auth-guard';
import { enforceCriticalRateLimit } from '../../../../lib/critical-rate-limit';

export async function POST(req: Request) {
  const { error, session } = await requireApiSession(req);
  if (error || !session) return error;
  const limited = await enforceCriticalRateLimit(req, { rateClass: 'auth', tenantId: session.tenantId || 'platform', subjectId: `mfa-setup:${session.userId}` });
  if (limited) return limited;
  return json({
    ok: false,
    reason: 'mfa_enrollment_temporarily_unavailable',
    detail: 'Legacy plaintext TOTP enrollment is disabled until encrypted, server-bound enrollment and step-up recovery are available.',
  }, 503, { 'cache-control': 'no-store', 'retry-after': '86400' });
}
