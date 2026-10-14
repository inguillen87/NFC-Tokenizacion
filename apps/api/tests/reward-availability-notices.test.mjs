import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const NOW = Date.parse("2026-10-14T12:00:00.000Z");
const CONSUMER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const paths = {
  consumer: "../src/lib/consumer-rewards-read-model.ts",
  admin: "../src/lib/admin-reward-read-model.ts",
  route: "../src/app/admin/loyalty/rewards/route.ts",
};
const sources = Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, readFileSync(new URL(path, import.meta.url), "utf8")]));
const compiled = Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText]));
function load(code, require) { const module = { exports: {} }; new Function("require", "module", "exports", code)(require, module, module.exports); return module.exports; }
const admin = load(compiled.admin, () => { throw new Error("read model must have no runtime dependency"); });
const queries = [];
const consumer = load(compiled.consumer, name => {
  assert.equal(name, "./db");
  return { sql: async (strings, ...values) => { queries.push({ query: strings.join("?"), values }); return []; } };
});
const item = (overrides = {}) => consumer.toConsumerRewardItem({
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "Visita a la bodega", description: "Visita guiada",
  tenant_slug: "bodega", tenant_name: "Bodega", program_name: "Club",
  reward_status: "active", program_status: "active", membership_status: "active",
  starts_at: "2026-10-01T00:00:00.000Z", ends_at: null,
  program_starts_at: "2026-10-01T00:00:00.000Z", program_ends_at: null,
  points_cost: 50, stock_remaining: 5, program_member_count: 1,
  program_points_balance: 80, program_member_active: true, program_identity_matches: true,
  consumer_account_status: "registered", membership_identity_matches: true,
  program_age_gate_required: false, reward_age_gate_required: false,
  reward_eligibility_unrestricted: true, reward_fulfillment_unrestricted: true, reward_member_limit_unrestricted: true,
  portal_claim_eligible: false,
  claim_id: null, claim_status: null, claimed_at: null, redemption_code: null,
  ...overrides,
}, NOW);

test("explanations never grant capability and an explicit persisted grant reports no blockers", () => {
  const review = item();
  assert.deepEqual(review.claim_unavailable_reasons, ["brand_conditions_review"]);
  assert.equal(review.can_claim, false); assert.equal(review.claim_unavailable_reason, "review_required");
  assert.equal(Object.hasOwn(review, "claimIntent"), false);
  const granted = item({ portal_claim_eligible: true });
  assert.equal(granted.can_claim, true); assert.equal(granted.claimIntent, "portal-first-reservation.v1");
  assert.deepEqual(granted.claim_unavailable_reasons, []); assert.equal(granted.claim_unavailable_reason, null);
  for (const value of [undefined, null, "true", 1, [], {}]) assert.equal(item({ portal_claim_eligible: value }).can_claim, false);
});

for (const [overrides, reasons] of [
  [{ program_age_gate_required: true }, ["age_verification_required"]],
  [{ reward_age_gate_required: true }, ["age_verification_required"]],
  [{ program_points_balance: 49 }, ["insufficient_program_points"]],
  [{ membership_identity_matches: false, membership_status: null }, ["brand_connection_required"]],
  [{ membership_status: "paused" }, ["brand_connection_required"]],
  [{ program_member_count: 0, program_member_active: null, program_points_balance: null }, ["program_participation_required"]],
  [{ program_member_active: false }, ["program_participation_required"]],
  [{ reward_eligibility_unrestricted: false }, ["brand_conditions_review"]],
  [{ reward_fulfillment_unrestricted: false }, ["brand_conditions_review"]],
  [{ reward_member_limit_unrestricted: false }, ["brand_conditions_review"]],
  [{ ends_at: new Date(NOW).toISOString() }, ["availability_review"]],
  [{ starts_at: new Date(NOW + 1).toISOString() }, ["availability_review"]],
  [{ stock_remaining: 0 }, ["availability_review"]],
  [{ consumer_account_status: "blocked" }, ["account_review"]],
  [{ program_member_count: 2 }, ["account_review"]],
]) {
  test(`persisted ${Object.keys(overrides).join("/")} has a precise finite reason`, () => {
    const result = item(overrides);
    assert.deepEqual(result.claim_unavailable_reasons, reasons);
    assert.equal(result.can_claim, false); assert.equal(result.claim_unavailable_reason, "review_required");
    assert.equal(Object.hasOwn(result, "claimIntent"), false);
  });
}

test("multiple independent persisted blockers coexist without duplicate reasons or PII", () => {
  const result = item({ program_age_gate_required: true, reward_age_gate_required: true,
    reward_fulfillment_unrestricted: false, program_points_balance: 10, membership_status: "paused",
    stock_remaining: 0, consumer_account_status: "blocked", eligibility_json: { email: "PRIVATE" }, email: "PRIVATE" });
  assert.deepEqual(new Set(result.claim_unavailable_reasons), new Set([
    "age_verification_required", "insufficient_program_points", "brand_connection_required",
    "brand_conditions_review", "availability_review", "account_review",
  ]));
  assert.equal(result.claim_unavailable_reasons.length, 6);
  assert.equal(JSON.stringify(result).includes("PRIVATE"), false);
});

test("unknown or malformed projections produce prudent reviews without speculative next actions", () => {
  for (const override of [
    { consumer_account_status: ["registered"] }, { membership_identity_matches: "true" },
    { membership_status: {} }, { program_member_count: true }, { program_member_active: "true" },
    { program_points_balance: "80x" }, { points_cost: NaN }, { program_identity_matches: "true" },
  ]) {
    const result = item(override); assert.ok(result.claim_unavailable_reasons.includes("account_review"));
    assert.equal(result.can_claim, false);
  }
  for (const override of [
    { program_age_gate_required: "false" }, { reward_age_gate_required: null },
    { reward_eligibility_unrestricted: undefined }, { reward_fulfillment_unrestricted: 1 },
    { reward_member_limit_unrestricted: null },
  ]) assert.ok(item(override).claim_unavailable_reasons.includes("brand_conditions_review"));
  for (const override of [{ starts_at: "invalid" }, { ends_at: undefined }, { stock_remaining: "five" }]) {
    assert.ok(item(override).claim_unavailable_reasons.includes("availability_review"));
  }
});

test("own vouchers keep voucher state precedence and omit catalog-only explanations", () => {
  for (const status of ["claimed", "redeemed", "expired", "cancelled"]) {
    const result = item({ claim_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", claim_status: status,
      claimed_at: "2026-10-14T10:00:00.000Z", redemption_code: "OWN-CODE",
      program_age_gate_required: true, membership_status: "blocked", consumer_account_status: "blocked" });
    assert.equal(result.state, status); assert.equal(Object.hasOwn(result, "claim_unavailable_reasons"), false);
    assert.equal(result.can_claim, false); assert.equal(result.redemption_code, status === "claimed" ? "OWN-CODE" : null);
  }
});

test("consumer explanations reuse one private SELECT without raw policy/account payloads or mutation", async () => {
  await consumer.getPrivateConsumerRewards(CONSUMER);
  assert.equal(queries.length, 1);
  const { query, values } = queries[0]; const sql = query.replace(/\s+/g, " ").trim();
  assert.deepEqual(values, [CONSUMER, CONSUMER, CONSUMER, CONSUMER, CONSUMER, 100]);
  assert.match(sql, /account\.status::text AS consumer_account_status/);
  assert.match(sql, /\(membership\.tenant_id IS NOT NULL\) AS membership_identity_matches/);
  assert.match(sql, /\(reward\.eligibility_json = '\{\}'::jsonb\) AS reward_eligibility_unrestricted/);
  assert.match(sql, /\(reward\.fulfillment_json = '\{\}'::jsonb\) AS reward_fulfillment_unrestricted/);
  assert.match(sql, /\(reward\.redemption_limit_per_member IS NULL\) AS reward_member_limit_unrestricted/);
  assert.match(sql, /program\.id = reward\.program_id AND program\.tenant_id = reward\.tenant_id/);
  assert.match(sql, /WHERE claim\.id IS NOT NULL OR \(membership\.status IN \('active', 'paused'\) AND reward\.status = 'active'\)/);
  assert.match(sql, /ORDER BY \(claim\.id IS NOT NULL\) DESC, COALESCE\(claim\.created_at, reward\.created_at\) DESC, reward\.id DESC, claim\.id DESC LIMIT \?$/);
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|CREATE|DELETE|ALTER|DROP)\b|account\.email|consumer\.phone|SELECT \w+\.\*/i);
  assert.doesNotMatch(sql, /reward\.(?:eligibility_json|fulfillment_json)\s*(?:,|AS)/i);
});

const adminRow = (overrides = {}) => ({ id: "reward", program_id: "program", tenant_slug: "bodega",
  code: "VISIT", title: "Visita", points: 50, status: "active", description: "Visita guiada", type: "TOUR",
  image_url: null, stock_total: 5, stock_remaining: 2, requires_age_gate: true, network_visible: false,
  reservation_program_name: "Club Bodega", reservation_program_age_gate: false, reservation_program_matches: true,
  reservation_starts_at: "2026-10-01T00:00:00.000Z", reservation_ends_at: null,
  reservation_eligibility_review: false, reservation_fulfillment_review: true, reservation_member_limit: null,
  ...overrides,
});

test("admin requirements preserve every legacy catalog field and expose only the versioned projection", () => {
  const row = adminRow({ eligibility_json: { phone: "PRIVATE" }, consumer_id: "PRIVATE" });
  const result = admin.toAdminRewardReadItem(row);
  for (const key of ["id", "program_id", "tenant_slug", "code", "title", "points", "status", "description", "type", "image_url", "stock_total", "stock_remaining", "requires_age_gate", "network_visible"]) assert.deepEqual(result[key], row[key]);
  assert.deepEqual(result.reservation_requirements, {
    version: "portal-reservation-requirements.v1", program: { name: "Club Bodega", age_gate_required: false, association_confirmed: true },
    starts_at: "2026-10-01T00:00:00.000Z", ends_at: null, requires_age_gate: true,
    eligibility_policy_review: false, fulfillment_policy_review: true, redemption_limit_per_member: null, redemption_limit_known: true,
  });
  assert.equal(JSON.stringify(result).includes("PRIVATE"), false);
  assert.equal(Object.hasOwn(result, "reservation_program_name"), false);
  assert.equal(Object.hasOwn(result, "eligibility_json"), false);
});

test("admin missing program cannot surface a mismatched program's name or gate", () => {
  for (const association of [false, null, undefined, "true", 1, []]) {
    const { program } = admin.toAdminRewardReadItem(adminRow({ reservation_program_matches: association, reservation_program_name: "OTHER-PRIVATE", reservation_program_age_gate: true })).reservation_requirements;
    assert.equal(program.name, null); assert.equal(program.age_gate_required, null);
    assert.equal(program.association_confirmed, association === false ? false : null);
  }
});

test("admin unlimited, zero, valid limit and unknown limit remain distinct", () => {
  for (const value of [null, 0, "0", 1, "12", 2_147_483_647]) {
    const result = admin.toAdminRewardReadItem(adminRow({ reservation_member_limit: value })).reservation_requirements;
    assert.equal(result.redemption_limit_known, true); assert.equal(result.redemption_limit_per_member, value === null ? null : Number(value));
  }
  for (const value of [undefined, -1, 0.5, NaN, Infinity, 2_147_483_648, "", " ", "1e2", "1x", true, [], {}]) {
    const result = admin.toAdminRewardReadItem(adminRow({ reservation_member_limit: value })).reservation_requirements;
    assert.equal(result.redemption_limit_known, false); assert.equal(result.redemption_limit_per_member, null);
  }
});

test("admin malformed booleans and dates do not become configured false or an invented date", () => {
  for (const value of [undefined, null, "false", 0, [], {}]) {
    const result = admin.toAdminRewardReadItem(adminRow({ requires_age_gate: value, reservation_program_age_gate: value,
      reservation_eligibility_review: value, reservation_fulfillment_review: value })).reservation_requirements;
    assert.equal(result.requires_age_gate, null); assert.equal(result.program.age_gate_required, null);
    assert.equal(result.eligibility_policy_review, null); assert.equal(result.fulfillment_policy_review, null);
  }
  for (const value of [undefined, null, "", "not a date", "2026-02-30T12:00:00Z", "2026-10-14", "2026-10-14T24:00:00Z", true, 0, []]) {
    const result = admin.toAdminRewardReadItem(adminRow({ reservation_starts_at: value, reservation_ends_at: value })).reservation_requirements;
    assert.equal(result.starts_at, null); assert.equal(result.ends_at, null);
  }
  assert.equal(admin.toAdminRewardReadItem(adminRow({ reservation_starts_at: "2026-10-14T09:00:00-03:00" })).reservation_requirements.starts_at, "2026-10-14T12:00:00.000Z");
  assert.equal(admin.toAdminRewardReadItem(adminRow({ reservation_starts_at: new Date(NOW) })).reservation_requirements.starts_at, new Date(NOW).toISOString());
});

test("both admin GET scopes read requirements with an exact tenant-program join and no writer change", async () => {
  for (const global of [false, true]) {
    const reads = []; const route = load(compiled.route, name => {
      if (name.endsWith("/auth")) return { checkAdmin: async () => null, checkAdminPermission: () => null,
        getAdminTenantScope: () => ({ scope: global ? "super_admin" : "tenant", forcedTenantSlug: global ? "" : "bodega" }) };
      if (name.endsWith("/db")) return { sql: async (strings, ...values) => { reads.push({ query: strings.join("?").replace(/\s+/g, " ").trim(), values }); return [adminRow()]; } };
      if (name.endsWith("/http")) return { json: (body, status = 200) => Response.json(body, { status }) };
      if (name.endsWith("/admin-tenant-filter")) return { effectiveTenantFilter: ({ forcedTenantSlug, requestedTenantSlug }) => forcedTenantSlug || requestedTenantSlug || "" };
      if (name.endsWith("/admin-reward-read-model")) return admin;
      if (name.endsWith("/admin-reward-policy")) return {};
      if (name.endsWith("/admin-reward-service")) return {};
      throw new Error(`unexpected dependency ${name}`);
    });
    const response = await route.GET(new Request(`https://example.test/admin/loyalty/rewards${global ? "?scope=global" : "?tenant=other"}`));
    assert.equal(response.status, 200); assert.equal(reads.length, 1);
    assert.deepEqual(reads[0].values, global ? [] : ["bodega"]);
    assert.match(reads[0].query, /LEFT JOIN loyalty_programs program ON program\.id = r\.program_id AND program\.tenant_id = r\.tenant_id/);
    assert.match(reads[0].query, /jsonb_typeof\(r\.eligibility_json\) = 'object'/);
    assert.doesNotMatch(reads[0].query, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b|r\.(?:eligibility_json|fulfillment_json)\s*(?:,|AS)/i);
    const body = await response.json(); assert.equal(body.rewards[0].reservation_requirements.version, "portal-reservation-requirements.v1");
  }
});
