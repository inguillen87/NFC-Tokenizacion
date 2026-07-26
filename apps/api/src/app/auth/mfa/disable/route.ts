export const runtime = 'nodejs';

import { json } from '../../../../lib/http';
import { requireApiSession } from '../../../../lib/auth-guard';
import { enforceCriticalRateLimit } from '../../../../lib/critical-rate-limit';

export async function POST(req: Request) {
  const { error, session } = await requireApiSession(req);
  if (error || !session) return error;
  const limited = await enforceCriticalRateLimit(req, { rateClass: 'auth', tenantId: session.tenantId || 'platform', subjectId: `mfa-disable:${session.userId}` });
  if (limited) return limited;
  return json({
    ok: false,
    reason: 'mfa_management_requires_step_up',
    detail: 'MFA disablement is unavailable until a dedicated step-up and audited recovery flow is configured.',
  }, 503, { 'cache-control': 'no-store', 'retry-after': '86400' });
}
