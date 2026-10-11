import { sql } from "./db";
import { readConsumerFromRequestReadonly } from "./consumer-auth";
import { evaluateConsumerVerticalContext, evaluateConsumerOwnershipClaimAttempt, normalizeConsumerTapReadCounter, readConsumerVerticalSnapshot, type ConsumerVerticalAction } from "./consumer-vertical-writer-policy";
import { matchesOwnershipBatch, matchesOwnershipTenant } from "./ownership-policy";
import { readSunFreshHandoffAction, verifySunFreshHandoffToken } from "./sun-fresh-handoff";

export const CONSUMER_TAP_ELIGIBILITY_SCHEMA = "nexid.consumer-tap-eligibility/v1";
export const CONSUMER_TAP_CAPABILITY_HEADER = "x-nexid-consumer-tap-capability";
type Reason = "allowed" | "tap_action_not_allowed" | "event_security_blocked" | "tenant_setup_required" | "tap_policy_indeterminate" | "membership_inactive" | "program_unavailable" | "member_inactive" | "fresh_tap_required" | "claim_policy_configuration_required" | "ownership_manual_approval_required" | "pos_activation_pending" | "retailer_attestation_required" | "purchase_receipt_required" | "pin_policy_misconfigured" | "ownership_already_claimed";
type Decision = { allowed: boolean; reason: Reason; freshTapRequired: boolean; nextStep?: "confirm" | "enter_pin" | "blocked" };
type Failure = { status: 400 | 401 | 403 | 503; body: { ok: false; error: "invalid_context" | "unauthorized" | "fresh_tap_required" | "eligibility_unavailable"; freshTapRequired: boolean } };
const actionBuckets = { save: "consumer_save_product", join: "consumer_join_tenant", rewards: "loyalty_enroll", claim: "consumer_claim_ownership" } as const;
function fail(status: Failure["status"], error: Failure["body"]["error"]): Failure { return { status, body: { ok: false, error, freshTapRequired: error === "fresh_tap_required" } }; }
function deny(reason: Reason): Decision { return { allowed: false, reason, freshTapRequired: reason === "fresh_tap_required" }; }
function freshFailure(reason: string) {
  return reason.includes("secret_") || reason === "fresh_token_read_unavailable"
    ? fail(503, "eligibility_unavailable") : fail(403, "fresh_tap_required");
}
function contextOf(req: Request) {
  const query = new URL(req.url).searchParams;
  if (query.toString().length > 1024 || [...query.keys()].some(key => !["eventId", "tenant", "bid"].includes(key) || query.getAll(key).length !== 1)) return null;
  const eventId = query.get("eventId") || "";
  if (!/^[1-9][0-9]{0,15}$/.test(eventId) || !Number.isSafeInteger(Number(eventId))) return null;
  const tenant = query.get("tenant"), bid = query.get("bid");
  if ([tenant, bid].some(value => value !== null && (!value.trim() || value.length > 128 || /[\u0000-\u001f\u007f]/.test(value)))) return null;
  return { eventId, tenant: tenant?.trim(), bid: bid?.trim() };
}

/** No initializer, rate reservation, membership repair or touch is reachable.
 * This is a private advisory projection. The POST writer remains authoritative. */
export async function readConsumerTapEligibility(req: Request) {
  const requested = contextOf(req);
  if (!requested) return fail(400, "invalid_context");
  const token = req.headers.get(CONSUMER_TAP_CAPABILITY_HEADER) || "";
  if (token.length > 3400) return fail(403, "fresh_tap_required");
  const initial = verifySunFreshHandoffToken(token, { eventId: requested.eventId, bid: requested.bid });
  if (!initial.ok) return freshFailure(initial.reason);
  try {
    const consumer = await readConsumerFromRequestReadonly(req);
    if (!consumer) return fail(401, "unauthorized");
    const snapshot = await readConsumerVerticalSnapshot(requested.eventId);
    if (!snapshot.ok) return fail(503, "eligibility_unavailable");
    const { event, batch, tenant } = snapshot.row.snapshot;
    const readCounter = normalizeConsumerTapReadCounter(event.sdm_read_ctr);
    // verifySunFreshHandoffToken intentionally skips OPTIONAL expected fields;
    // this private eligibility contract requires the persisted counter binding.
    if (readCounter === null) return fail(403, "fresh_tap_required");
    const expected = { eventId: requested.eventId, bid: batch.bid, uidHex: event.uid_hex, readCounter };
    const bound = verifySunFreshHandoffToken(token, expected);
    if (!bound.ok) return freshFailure(bound.reason);
    if (!matchesOwnershipTenant({ eventTenantId: event.tenant_id, eventTenantSlug: tenant.slug, requestedTenant: requested.tenant })
      || !matchesOwnershipBatch({ eventBid: batch.bid, requestedBid: requested.bid })) return fail(403, "fresh_tap_required");
    const actions = Object.fromEntries((Object.keys(actionBuckets) as ConsumerVerticalAction[]).map(action => {
      const policy = evaluateConsumerVerticalContext(snapshot.row, action);
      return [action, policy.ok ? { allowed: true, reason: "allowed", freshTapRequired: false } : deny(policy.error as Reason)];
    })) as Record<ConsumerVerticalAction, Decision>;
    // Publication of a loyalty program is status active. This selection matches
    // getActiveProgram without calling its schema/backfill initializer.
    const rows = await sql`
      WITH current_program AS (
        SELECT id, tenant_id FROM loyalty_programs
        WHERE tenant_id = ${event.tenant_id}::uuid AND status = 'active'
          AND start_at <= now() AND (end_at IS NULL OR end_at >= now())
        ORDER BY created_at DESC LIMIT 1
      )
      SELECT NOT EXISTS (
        SELECT 1 FROM tenant_consumer_memberships membership
        WHERE membership.consumer_id = ${consumer.id}::uuid AND membership.tenant_id = ${event.tenant_id}::uuid
          AND membership.status IS DISTINCT FROM 'active'
      ) AS membership_active,
      EXISTS(SELECT 1 FROM current_program) AS program_active,
      NOT EXISTS (
        SELECT 1 FROM loyalty_members member JOIN current_program program ON member.program_id = program.id
        WHERE member.member_key = ${`consumer:${consumer.id}`}
          AND (member.tenant_id IS DISTINCT FROM program.tenant_id OR member.status IS NULL OR member.status NOT IN ('anonymous', 'enrolled', 'verified'))
      ) AS member_active,
      EXISTS (SELECT 1 FROM consumer_product_ownerships ownership WHERE ownership.tenant_id = ${event.tenant_id}::uuid
        AND UPPER(TRIM(ownership.uid_hex)) = UPPER(TRIM(${event.uid_hex})) AND ownership.status = 'claimed') AS ownership_claimed,
      EXISTS (SELECT 1 FROM consumer_product_ownerships recorded WHERE recorded.tenant_id = ${event.tenant_id}::uuid
        AND recorded.consumer_id = ${consumer.id}::uuid AND recorded.event_id = ${requested.eventId}::bigint) AS claim_record_exists,
      EXISTS (SELECT 1 FROM sdk_pos_activations activation WHERE activation.tenant_id = ${event.tenant_id}::uuid
        AND activation.batch_id = ${batch.id}::uuid AND activation.tag_id = ${snapshot.row.snapshot.tag.id}::uuid
        AND UPPER(TRIM(activation.uid_hex)) = UPPER(TRIM(${event.uid_hex})) AND activation.activation_status = 'active'
        AND (activation.expires_at IS NULL OR activation.expires_at > clock_timestamp())) AS pos_validated
    `;
    if (rows.length !== 1 || ["membership_active", "program_active", "member_active", "ownership_claimed", "claim_record_exists", "pos_validated"].some(key => typeof rows[0][key] !== "boolean")) return fail(503, "eligibility_unavailable");
    const claim = evaluateConsumerOwnershipClaimAttempt(snapshot.row, { membershipActive: rows[0].membership_active,
      ownershipClaimed: rows[0].ownership_claimed, claimRecordExists: rows[0].claim_record_exists, posValidated: rows[0].pos_validated });
    actions.claim = claim.ok ? { allowed: true, reason: "allowed", freshTapRequired: false, nextStep: claim.nextStep }
      : { ...deny(claim.error as Reason), nextStep: "blocked" };
    for (const action of Object.keys(actionBuckets) as ConsumerVerticalAction[]) {
      if (!actions[action].allowed) continue;
      if (!rows[0].membership_active) { actions[action] = deny("membership_inactive"); continue; }
      if (action === "rewards" && !rows[0].program_active) { actions[action] = deny("program_unavailable"); continue; }
      if (action === "rewards" && !rows[0].member_active) { actions[action] = deny("member_inactive"); continue; }
      const capability = await readSunFreshHandoffAction(token, expected, actionBuckets[action]);
      if (!capability.ok) {
        if (capability.reason === "fresh_token_already_used") actions[action] = { ...deny("fresh_tap_required"), ...(action === "claim" ? { nextStep: "blocked" as const } : {}) };
        else return freshFailure(capability.reason);
      }
    }
    const current = verifySunFreshHandoffToken(token, expected);
    if (!current.ok) return freshFailure(current.reason);
    return { status: 200 as const, body: { ok: true as const, schema: CONSUMER_TAP_ELIGIBILITY_SCHEMA, eventId: requested.eventId, actions } };
  } catch { return fail(503, "eligibility_unavailable"); }
}
