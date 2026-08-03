import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  CLAIM_POLICY_ADMIN_BODY_MAX_BYTES,
  normalizeClaimPolicyAdminBody,
  readClaimPolicyAdminBody,
} = await import("../src/app/admin/sdk/claim-policy/policy.ts");
const { RequestBodyTooLargeError } = await import("../src/lib/bounded-request-body.ts");
const { classifyFleetRateLimit } = await import("../src/lib/fleet-rate-limit-policy.ts");

const routeUrl = new URL("../src/app/admin/sdk/claim-policy/route.ts", import.meta.url);

test("claim-policy body is bounded before JSON parsing", async () => {
  const request = new Request("https://api.nexid.test/admin/sdk/claim-policy", {
    method: "POST",
    headers: { "content-length": String(CLAIM_POLICY_ADMIN_BODY_MAX_BYTES + 1) },
    body: "{}",
  });
  await assert.rejects(() => readClaimPolicyAdminBody(request), RequestBodyTooLargeError);
  assert.equal(request.bodyUsed, false);

  const primitive = new Request("https://api.nexid.test/admin/sdk/claim-policy", {
    method: "POST",
    body: "[]",
  });
  await assert.rejects(() => readClaimPolicyAdminBody(primitive), /invalid_json_body/);
});

test("claim-policy parser preserves aliases but rejects ambiguity and unbounded fields", () => {
  assert.deepEqual(normalizeClaimPolicyAdminBody({
    bid: " SYNGENTA-2026-01 ",
    tenant: "Syngenta",
    tenantSlug: "syngenta",
    uid_hex: "04aabbccddee11",
    active_for_claim: true,
    claim_pin_required: false,
  }), {
    ok: true,
    mutation: {
      bid: "SYNGENTA-2026-01",
      tenant: "syngenta",
      uidHex: "04AABBCCDDEE11",
      pin: "",
      activeForClaim: true,
      claimPinRequired: false,
      claimRequiresPos: undefined,
      autoClaimEnabled: undefined,
    },
  });

  assert.equal(normalizeClaimPolicyAdminBody({ bid: "B-1", activeForClaim: "true" }).reason, "claim_policy_boolean_invalid");
  assert.equal(normalizeClaimPolicyAdminBody({ bid: "B-1", activeForClaim: true, active_for_claim: false }).reason, "claim_policy_alias_conflict");
  assert.equal(normalizeClaimPolicyAdminBody({ bid: "B-1", tenant: "a", tenantSlug: "b", activeForClaim: true }).reason, "claim_policy_alias_conflict");
  assert.equal(normalizeClaimPolicyAdminBody({ bid: "B-1", activeForClaim: true, actorId: "forged" }).reason, "claim_policy_fields_invalid");
  assert.equal(normalizeClaimPolicyAdminBody({ bid: "B-1" }).reason, "claim_policy_mutation_required");
  assert.equal(normalizeClaimPolicyAdminBody({ bid: "x".repeat(257), activeForClaim: true }).reason, "bid_invalid");
});

test("tag-scoped policy cannot claim batch-only changes that it does not persist", () => {
  const result = normalizeClaimPolicyAdminBody({
    bid: "B-1",
    uidHex: "04AABBCCDDEE11",
    activeForClaim: true,
    claimRequiresPos: true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "claim_policy_tag_scope_fields_invalid");

  const pin = normalizeClaimPolicyAdminBody({
    bid: "B-1",
    pin: "Enterprise#Claim-2026",
  });
  assert.equal(pin.ok, true);
  assert.equal(pin.mutation.claimPinRequired, true);
});

test("claim-policy is classified as a distributed critical write", () => {
  assert.equal(classifyFleetRateLimit("/admin/sdk/claim-policy", "POST"), "public_write");
});

test("claim-policy mutation orders controls before work and commits policy plus audit atomically", async () => {
  const route = await readFile(routeUrl, "utf8");
  const auth = route.indexOf('checkAdminWithPermission(req, "ownership.claim_policy.manage")');
  const limited = route.indexOf("enforceCriticalRateLimit(req");
  const mfa = route.indexOf("ownership_claim_policy_mfa_required");
  const body = route.indexOf("readClaimPolicyAdminBody(req)");
  const schema = route.indexOf("await ensureSdkSchema()");
  assert.ok(auth >= 0 && auth < limited, "authentication and capability must precede rate limiting");
  assert.ok(limited < mfa, "distributed admission control must precede MFA-gated business work");
  assert.ok(mfa < body, "MFA must precede body reads");
  assert.ok(body < schema, "bounded parsing and validation must precede business DB work");
  assert.match(route, /rateClass:\s*"public_write"/);
  assert.match(route, /tenantWide:\s*true/);
  assert.doesNotMatch(route, /req\.json\(\)/);

  assert.equal(route.match(/WITH authorized_session AS MATERIALIZED/g)?.length, 2);
  assert.equal(route.match(/FOR UPDATE OF (?:tag|batch)/g)?.length, 2);
  assert.equal(route.match(/INSERT INTO audit_logs/g)?.length, 2);
  assert.equal(route.match(/'ownership_claim_policy_updated'/g)?.length, 2);
  assert.match(route, /auth_session\.mfa_verified IS TRUE/);
  assert.match(route, /auth_session\.revoked_at IS NULL/);
  assert.match(route, /current_membership\.tenant_id IS NOT DISTINCT FROM auth_session\.tenant_id/);
  assert.match(route, /pin_configured', updated\.(?:previous_)?hash_pin IS NOT NULL/);
  assert.doesNotMatch(route, /logAuditEvent/);
  assert.match(route, /"x-nexid-audit-receipt": auditReceipt/);
});

test("claim-policy rejects ambiguous platform targeting and incoherent PIN policy", async () => {
  const route = await readFile(routeUrl, "utf8");
  assert.match(route, /if \(tenantScope && tenant && tenant !== tenantScope\)/);
  assert.match(route, /if \(!tenantSlug\) return failure\("tenant_required", 400\)/);
  const resolver = route.slice(route.indexOf("async function resolveBatch"), route.indexOf("export async function POST"));
  assert.equal(resolver.match(/WHERE b\.bid/g)?.length, 1);
  assert.match(resolver, /WHERE b\.bid = \$\{bid\}\s+AND tn\.slug = \$\{tenantSlug\}/);
  assert.match(route, /claim_pin_required_without_pin/);
  assert.match(route, /if \(uidHex\) return failure\("tag_not_found_for_batch", 404/);
  assert.match(route, /claim_policy_target_changed/);
  assert.match(route, /"cache-control": "private, no-store, max-age=0"/);
});
