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

  try {
    const { stdout, stderr } = await execFileAsync('node', ['scripts/demo-demobodega.mjs'], {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 1024 * 1024,
    });
    return json({ ok: true, stdout, stderr });
  } catch (error) {
    const err = error as Error & { stdout?: string; stderr?: string };
    return json({ ok: false, reason: err.message, stdout: err.stdout, stderr: err.stderr }, 500);
  }
}
