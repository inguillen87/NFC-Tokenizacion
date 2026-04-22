export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '@/lib/auth';
import { json } from '@/lib/http';
import { listSunDiagnostics } from '@/lib/sun-diagnostics';

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get('limit') || 100);
  const rows = await listSunDiagnostics(limit);
  return json(rows);
}
