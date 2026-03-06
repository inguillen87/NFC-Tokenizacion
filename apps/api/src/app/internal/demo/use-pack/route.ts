export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';

const execFileAsync = promisify(execFile);

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const pack = String(body.pack || 'wine-secure');

  const { stdout, stderr } = await execFileAsync('node', ['scripts/demo-demobodega.mjs', `--pack=${pack}`], {
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: 1024 * 1024,
  });

  return json({ ok: true, pack, stdout, stderr });
}
