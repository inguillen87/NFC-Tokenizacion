import { spawn } from 'node:child_process';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const out = resolve(process.env.QA_OUTPUT || join(root, 'artifacts/consumer-actions-browser'));
await mkdir(out, { recursive: true });
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_WEB_URL: 'http://localhost:3188', NEXT_PUBLIC_APP_URL: 'http://localhost:3188', NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4288', API_BASE_URL: 'http://127.0.0.1:4288', QA_OUTPUT: out };
delete env.VERCEL; delete env.VERCEL_ENV;
const children = [], logs = [];
async function start(args, cwd, label) {
  const file = await open(join(out, label + '.log'), 'w'); logs.push(file);
  const p = spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: ['ignore', file.fd, file.fd] }); children.push(p);
  p.on('error', e => { console.error(label, e.message); }); return p;
}
async function ready(url, child) {
  const until = Date.now() + 120000;
  while (Date.now() < until) { if (child.exitCode !== null) throw Error('QA service stopped'); try { const response = await fetch(url, { signal: AbortSignal.timeout(1000) }); if (response.ok) return; } catch {} await new Promise(r => setTimeout(r, 300)); }
  throw Error('QA service readiness timeout');
}
let code = 1;
try {
  const api = await start(['apps/web/tests/browser/consumer-actions-api.fixture.mjs', '--local-qa'], root, 'synthetic-api');
  await ready('http://127.0.0.1:4288/qa-state', api);
  const web = await start([join(root, 'node_modules/next/dist/bin/next'), 'dev', '-p', '3188', '--hostname', '127.0.0.1'], join(root, 'apps/web'), 'next');
  await ready('http://localhost:3188/release.json', web);
  const test = spawn(process.execPath, ['apps/web/tests/consumer-actions.browser.mjs'], { cwd: root, env, windowsHide: true, stdio: 'inherit' });
  code = await new Promise((r, reject) => { test.on('exit', c => r(c ?? 1)); test.on('error', reject); });
} catch (error) { console.error(error); }
finally {
  for (const child of children.reverse()) { child.kill(); await Promise.race([new Promise(r => child.once('exit', r)), new Promise(r => setTimeout(r, 3000))]); }
  for (const file of logs) await file.close();
  await writeFile(join(out, 'runner.json'), JSON.stringify({ localOnly: true, syntheticApi: true, exitCode: code }, null, 2));
}
process.exit(code);
