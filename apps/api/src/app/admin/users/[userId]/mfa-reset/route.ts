export const runtime = 'nodejs';

import { sql } from '../../../../../lib/db';
import { json } from '../../../../../lib/http';
import { requireApiSession } from '../../../../../lib/auth-guard';
import { ensureEnterpriseIamSchema } from '../../../../../lib/commercial-runtime-schema';
import { isUuidString } from '../../../../../lib/iam';
import { resetManagedAdminUserMfa } from '../../../../../lib/admin-user-management';

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { error, session } = await requireApiSession(req, 'users:manage');
  if (error || !session) return error;
  await ensureEnterpriseIamSchema();
  const { userId } = await params;
  if (!isUuidString(userId)) return json({ ok: false, reason: 'invalid_user_id' }, 400);

  const managedUserId = await resetManagedAdminUserMfa(sql as any, {
    targetUserId: userId,
    actorIsSuperAdmin: session.role === 'super-admin',
    actorTenantId: session.tenantId,
  });
  if (!managedUserId) return json({ ok: false, reason: 'managed_user_out_of_scope' }, 403);
  return json({ ok: true });
}
