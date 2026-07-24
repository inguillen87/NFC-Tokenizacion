import fs from "node:fs";

const path = "infra/waf/cloudflare-enterprise-rules.json";
const freePath = "infra/waf/cloudflare-free-profile.json";
const policy = JSON.parse(fs.readFileSync(path, "utf8"));
const freePolicy = JSON.parse(fs.readFileSync(freePath, "utf8"));
if (policy.provider !== "cloudflare" || policy.scope !== "api-staging-and-production") throw new Error("waf_policy_scope_invalid");
if (!Number.isSafeInteger(policy.bodyLimitBytes) || policy.bodyLimitBytes < 16 * 1024 || policy.bodyLimitBytes > 1024 * 1024) throw new Error("waf_body_limit_invalid");
if (!Array.isArray(policy.rules) || policy.rules.length < 3) throw new Error("waf_rules_incomplete");
const names = new Set();
let bodyRuleFound = false;
for (const rule of policy.rules) {
  if (!rule.name || names.has(rule.name)) throw new Error("waf_rule_name_invalid");
  names.add(rule.name);
  if (!rule.expression || !rule.action) throw new Error(`waf_rule_incomplete:${rule.name}`);
  if (rule.name === "block-oversized-json") {
    bodyRuleFound = true;
    if (!rule.expression.includes(`gt ${policy.bodyLimitBytes}`)) throw new Error("waf_body_rule_drift");
    if (rule.status !== 413) throw new Error("waf_body_status_invalid");
  }
  if (rule.kind === "rate_limit") {
    if (!Number.isSafeInteger(rule.threshold) || !Number.isSafeInteger(rule.periodSeconds) || rule.threshold <= 0 || rule.periodSeconds <= 0) throw new Error(`waf_rate_window_invalid:${rule.name}`);
    const dimensions = rule.characteristics || [];
    if (dimensions.some((value) => /x-request-id|x-tenant-id/i.test(value))) throw new Error(`waf_user_header_dimension_forbidden:${rule.name}`);
    if (!dimensions.includes("ip.src")) throw new Error(`waf_ip_dimension_required:${rule.name}`);
    if (/challenge/i.test(rule.action)) throw new Error(`waf_machine_challenge_forbidden:${rule.name}`);
  }
}
if (!bodyRuleFound) throw new Error("waf_body_rule_missing");
const auth = policy.rules.find((rule) => rule.name === "protect-auth");
if (!auth || auth.threshold !== 20 || auth.periodSeconds !== 60) throw new Error("waf_auth_threshold_drift");

if (freePolicy.provider !== "cloudflare" || freePolicy.scope !== "nexid-lat-production-edge" || freePolicy.plan !== "free") throw new Error("waf_free_scope_invalid");
if (freePolicy.deployment?.enforced !== true || !freePolicy.deployment?.verifiedAt) throw new Error("waf_free_not_verified");
if (!Array.isArray(freePolicy.customRules) || freePolicy.customRules.length < 1 || freePolicy.customRules.length > 5) throw new Error("waf_free_custom_rule_count_invalid");
if (!Array.isArray(freePolicy.rateLimitingRules) || freePolicy.rateLimitingRules.length !== 1) throw new Error("waf_free_rate_rule_count_invalid");
for (const rule of freePolicy.customRules) {
  if (rule.enabled !== true || rule.action !== "block") throw new Error(`waf_free_custom_rule_inactive:${rule.name}`);
  if (/\bmatches\b/i.test(rule.expression)) throw new Error(`waf_free_regex_forbidden:${rule.name}`);
}
const freeRate = freePolicy.rateLimitingRules[0];
if (freeRate.enabled !== true || freeRate.action !== "block") throw new Error("waf_free_rate_rule_inactive");
if (freeRate.threshold !== 10 || freeRate.periodSeconds !== 10 || freeRate.mitigationTimeoutSeconds !== 10) throw new Error("waf_free_rate_window_drift");
if (freeRate.characteristics?.length !== 1 || freeRate.characteristics[0] !== "ip.src") throw new Error("waf_free_rate_characteristics_invalid");
if (Object.values(freePolicy.verification?.probeStatusCodes || {}).some((status) => status !== 403)) throw new Error("waf_free_probe_smoke_failed");
if (!Array.isArray(freePolicy.verification?.authBurstStatusCodes) || !freePolicy.verification.authBurstStatusCodes.includes(429)) throw new Error("waf_free_rate_smoke_failed");

console.log(JSON.stringify({
  ok: true,
  gate: "waf_policy",
  enterpriseRules: policy.rules.length,
  freeCustomRules: freePolicy.customRules.length,
  freeRateRules: freePolicy.rateLimitingRules.length,
  bodyLimitBytes: policy.bodyLimitBytes,
  productionVerifiedAt: freePolicy.deployment.verifiedAt,
}));
