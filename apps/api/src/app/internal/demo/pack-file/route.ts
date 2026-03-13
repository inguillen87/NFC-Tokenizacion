export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import fs from 'node:fs';
import { checkAdmin } from '../../../../lib/auth';
import { getDemoPack } from '../../../../lib/demo-packs';

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const url = new URL(req.url);
  const pack = String(url.searchParams.get('pack') || 'wine-secure');
  const type = url.searchParams.get('type') === 'seed' ? 'seed' : 'manifest';
  const meta = getDemoPack(pack);
  if (!meta) return new Response(JSON.stringify({ ok: false, reason: 'unknown pack' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  const filePath = type === 'seed' ? meta.seedPath : meta.manifestPath;
  const body = fs.readFileSync(filePath, 'utf8');
  const ext = type === 'seed' ? 'json' : 'csv';
  const contentType = type === 'seed' ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8';

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${pack}.${ext}"`,
      'Cache-Control': 'no-store',
    },
  });
}
