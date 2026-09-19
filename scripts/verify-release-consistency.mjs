#!/usr/bin/env node
import { open, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PROTOCOL, ReleaseCheckError, validateManifest, evaluateRelease, createReadOnlyReader } from './lib/release-consistency.mjs';

// No deploy/promote API, no credential discovery, no changes to existing reports.
let output;
let report;
try {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const name = args[i];
    if (!['--manifest', '--out', '--validate-only'].includes(name) || name in options) throw new ReleaseCheckError('cli_arguments_invalid', true);
    if (name === '--validate-only') options[name] = true;
    else {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new ReleaseCheckError('cli_arguments_invalid', true);
      options[name] = args[++i];
    }
  }
  if (!options['--manifest']) throw new ReleaseCheckError('manifest_path_required', true);
  output = options['--out'];
  const file = await open(options['--manifest'], 'r');
  let manifest;
  try {
    if (!(await file.stat()).isFile()) throw new ReleaseCheckError('manifest_not_regular_file', true);
    const bytes = Buffer.alloc(65_537);
    let used = 0;
    while (used < bytes.length) {
      const { bytesRead } = await file.read(bytes, used, bytes.length - used, null);
      if (bytesRead === 0) break;
      used += bytesRead;
    }
    if (used > 65_536) throw new ReleaseCheckError('manifest_too_large', true);
    try { manifest = validateManifest(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, used)))); }
    catch (e) { if (e instanceof ReleaseCheckError) throw e; throw new ReleaseCheckError('manifest_json_invalid', true); }
  } finally { await file.close(); }
  const manifestSha256 = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  if (options['--validate-only']) {
    report = { protocol: PROTOCOL, status: 'manifest_valid', evidenceSource: 'configuration_only', releaseId: manifest.releaseId, manifestSha256, consistent: null, productionAcceptance: false, deploymentPerformed: false };
  } else {
    report = await evaluateRelease(manifest, { readJson: createReadOnlyReader(process.env.VERCEL_TOKEN) });
    report.evidenceSource = 'vercel_rest_live_and_api_liveness';
    report.manifestSha256 = manifestSha256;
    if (!report.consistent) process.exitCode = report.status === 'blocked' ? 2 : 1;
  }
} catch (e) {
  // Error messages from filesystem/network/provider may contain sensitive data.
  report = { protocol: PROTOCOL, status: 'blocked', consistent: false, productionAcceptance: false, deploymentPerformed: false, error: e instanceof ReleaseCheckError ? e.code : 'verification_unavailable' };
  process.exitCode = 2;
}
const text = JSON.stringify(report, null, 2) + '\n';
if (output) {
  try { await writeFile(output, text, { flag: 'wx', mode: 0o600 }); }
  catch { console.error('report_write_failed'); process.exitCode = 2; }
}
console.log(text);
