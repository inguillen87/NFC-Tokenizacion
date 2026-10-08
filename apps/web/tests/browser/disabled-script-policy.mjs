// Only the explicit Chromium JavaScript-disabled preload control belongs here.
// Normal requests, server CSP violations and every ERR_ABORTED remain fatal.
const sha256 = /^[a-f0-9]{64}$/;
// Read an inert document body, never execute it. Ambiguous meta markup cannot
// establish absence. Numeric entities in http-equiv are decoded as HTML does.
export function htmlCspMetaStatus(html) {
  if (typeof html !== 'string') return null;
  const inert = html.replace(/<!--[\s\S]*?-->/g, '');
  const tags = inert.match(/<meta\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi) || [];
  if ((inert.match(/<meta\b/gi) || []).length !== tags.length) return null;
  for (const tag of tags) {
    for (const attribute of tag.matchAll(/\bhttp-equiv\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      const value = (attribute[1] ?? attribute[2] ?? attribute[3]).replace(/&#(?:x([a-f0-9]+)|(\d+));?/gi, (_, hex, decimal) => {
        const code = Number.parseInt(hex || decimal, hex ? 16 : 10);
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd';
      }).replace(/&(?:tab|newline);/gi, ' ').trim();
      if (value.toLowerCase() === 'content-security-policy') return true;
    }
  }
  return false;
}
export function disabledScriptFailureDecision(input) {
  const fatal = reason => ({ expected: false, reason });
  try {
    if (input.javaScriptEnabled !== false || input.closing !== false || input.errorText !== 'csp') return fatal('not_intentional_disabled_script');
    if (input.method !== 'GET' || input.resourceType !== 'script' || input.navigation !== false || input.mainFrame !== true) return fatal('not_own_script_preload');
    const url = new URL(input.requestUrl);
    if (url.origin !== input.origin || url.username || url.password || url.search || url.hash || input.requestUrl.includes('?') || input.requestUrl.includes('#')) return fatal('not_exact_own_asset_url');
    const binding = input.binding;
    if (!binding || !sha256.test(binding.buildManifestSha256) || binding.hashes?.['apps/web/.next/build-manifest.json'] !== binding.buildManifestSha256) return fatal('manifest_not_bound');
    if (!Array.isArray(binding.rootMainFiles) || !binding.rootMainFiles.length || new Set(binding.rootMainFiles).size !== binding.rootMainFiles.length || !binding.rootMainFiles.every(file => typeof file === 'string' && /^static\/chunks\/[A-Za-z0-9_.-]+\.js$/.test(file) && !file.includes('..'))) return fatal('invalid_root_main_catalog');
    const file = binding.rootMainFiles.find(file => '/_next/' + file === url.pathname);
    if (!file) return fatal('not_root_main_preload');
    const catalog = binding.rootMainPreloads;
    if (!Array.isArray(catalog) || catalog.length !== binding.rootMainFiles.length || new Set(catalog.map(row => row?.path)).size !== catalog.length) return fatal('invalid_preload_hash_catalog');
    if (!binding.rootMainFiles.every(file => {
      const row = catalog.find(row => row?.path === '/_next/' + file);
      return row && sha256.test(row.sha256) && binding.hashes?.['apps/web/.next/' + file] === row.sha256;
    })) return fatal('compiled_preload_not_bound');
    const policy = input.documentPolicy;
    if (!policy || typeof policy.id !== 'string' || !policy.id || !Number.isSafeInteger(policy.sequence) || policy.sequence < 1 || policy.originOwned !== true || policy.status !== 200 || policy.html !== true || policy.cspPresent !== false || policy.cspReportOnlyPresent !== false || policy.cspMetaPresent !== false || !sha256.test(policy.documentSha256) || !sha256.test(policy.htmlSha256)) return fatal('document_policy_not_proven');
    if (input.requestDocumentPolicyId !== policy.id || input.currentDocumentPolicyId !== policy.id || input.currentDocumentSha256 !== policy.documentSha256) return fatal('not_current_document');
    const preload = catalog.find(row => row.path === url.pathname);
    return { expected: true, rule: 'intentional_disabled_script_preload', scriptPath: url.pathname, scriptSha256: preload.sha256, buildManifestSha256: binding.buildManifestSha256, documentPolicyId: policy.id };
  } catch {
    return fatal('unreadable_policy_evidence');
  }
}
