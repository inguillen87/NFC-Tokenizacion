export const runtime = 'nodejs';

import { sql } from '../../../../../lib/db';
import { json } from '../../../../../lib/http';
import { createResetToken, sha256 } from '../../../../../lib/iam';
import { requireApiSession } from '../../../../../lib/auth-guard';
import { isUuidString } from '../../../../../lib/iam';
import { isProductionSecretExposureAllowed } from '../../../../../lib/admin-user-management-policy';
import { createManagedAdminPasswordReset } from '../../../../../lib/admin-user-management';

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { error, session } = await requireApiSession(req, 'users:manage');
  if (error || !session) return error;
  const { userId } = await params;
  if (!isUuidString(userId)) return json({ ok: false, reason: 'invalid_user_id' }, 400);
  const token = createResetToken();
  const managedUserId = await createManagedAdminPasswordReset(sql as any, {
    targetUserId: userId,
    actorIsSuperAdmin: session.role === 'super-admin',
    actorTenantId: session.tenantId,
    tokenHash: sha256(token),
    ttlMinutes: 30,
  });
  if (!managedUserId) return json({ ok: false, reason: 'managed_user_out_of_scope' }, 403);

  const exposeResetToken = isProductionSecretExposureAllowed(process.env.NODE_ENV, process.env.DEV_EXPOSE_RESET_TOKEN, process.env.VERCEL_ENV);
  return json({ ok: true, resetToken: exposeResetToken ? token : undefined });
}
