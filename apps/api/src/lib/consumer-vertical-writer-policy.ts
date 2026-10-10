import { sql, sqlSerializable } from "./db";
import { resolveSunTenantProfile } from "./sun-tenant-profile";
import { mapVerdictAndRisk, resolveRightsPolicy } from "./sun-passport-policy";
import { evaluateTapCommercialRights } from "./tap-commercial-rights";
import { isCurrentOwnershipTagEligible } from "./ownership-policy";
import { isCurrentLoyaltyTapEligible } from "./loyalty-tap-policy";
import { isVerifiedAuthenticationEvent } from "@product/core";
import { resolveSunSecureCarrierProfile, resolveTagTamperPresentationEvidence } from "./sun-carrier-trust-state";

export type ConsumerVerticalAction = "save" | "join" | "rewards";
type Row = Record<string, any>;
type Snapshot = { event: Row; batch: Row; tenant: Row; tag: Row; profile: Row | null; product: Row | null; manual: Row | null };
export type ConsumerVerticalContext = { event: Row; action: ConsumerVerticalAction; vertical: string; canJoin: boolean; productName: string; brandName: string; imageUrl: string | null };
const issued = new WeakMap<ConsumerVerticalContext, Snapshot>();

/** Pure policy resolution; only readConsumerVerticalContext issues write contexts. */
export function evaluateConsumerVerticalContext(row: Row, action: ConsumerVerticalAction) {
  const snapshot = row.snapshot as Snapshot | undefined;
  if (!snapshot?.event || !snapshot.batch || !snapshot.tenant || !snapshot.tag) return { ok: false as const, error: "tap_policy_indeterminate" };
  const { event, batch, tenant, tag, profile, product, manual } = snapshot;
  if (!event.tenant_id || !event.batch_id || !event.uid_hex || event.tenant_id !== batch.tenant_id || event.tenant_id !== tenant.id
    || event.batch_id !== batch.id || tag.batch_id !== batch.id || !batch.bid || batch.status !== "active" || tenant.status !== "active"
    || Number(row.identity_count) !== 1 || Number(row.event_count) !== 1
    || (profile && profile.tenant_id !== tenant.id) || (product && product.tag_id !== tag.id)
    || (manual && (manual.batch_id !== batch.id || String(manual.uid_hex || "").trim().toUpperCase() !== String(event.uid_hex).trim().toUpperCase()))) {
    return { ok: false as const, error: "tap_policy_indeterminate" };
  }
  const boundEvent: Row = {
    ...event, bid: batch.bid, tenant_slug: tenant.slug,
    current_tag_id: tag.id, current_tag_tenant_id: batch.tenant_id, current_tag_batch_id: tag.batch_id,
    current_tag_uid_hex: tag.uid_hex, current_tag_status: tag.status, current_tag_lifecycle_state: tag.lifecycle_state,
    current_tag_identity_count: row.identity_count,
    manual_tamper_status: manual?.tamper_status, manual_tamper_reason: manual?.reason,
  };
  if (manual || !evaluateTapCommercialRights(boundEvent).allowed || !isCurrentOwnershipTagEligible(boundEvent)
    || (action === "rewards" && !isCurrentLoyaltyTapEligible(boundEvent))) return { ok: false as const, error: "event_security_blocked" };
  const resolution = resolveSunTenantProfile({ bid: batch.bid, passport: {
    ...product, tenant_id: tenant.id, tenant_slug: tenant.slug, tenant_name: tenant.name,
    batch_status: batch.status, batch_sdm_config: batch.sdm_config,
    sun_profile_vertical: profile?.vertical, sun_profile_club_name: profile?.club_name,
    sun_profile_product_label: profile?.product_label, sun_profile_origin_label: profile?.origin_label,
    sun_profile_origin_address: profile?.origin_address, sun_profile_origin_lat: profile?.origin_lat,
    sun_profile_origin_lng: profile?.origin_lng, sun_profile_tokenization_mode: profile?.tokenization_mode,
    sun_profile_claim_policy: profile?.claim_policy, sun_profile_ownership_policy: profile?.ownership_policy,
    sun_profile_manifest_policy: profile?.manifest_policy,
  } });
  if (!resolution.ok) return { ok: false as const, error: "tenant_setup_required" };
  // Results are the persisted validator verdict, never a client supplied seal/vertical.
  const status = String(event.result || "").toUpperCase();
  const carrier = resolveSunSecureCarrierProfile({ carrierProfileCode: batch.carrier_profile_code, sdmConfig: batch.sdm_config });
  if (!carrier || event.source !== "real" || !isVerifiedAuthenticationEvent(event)
    || ["HIGH", "CRITICAL"].includes(String(event.risk_level || "").toUpperCase())
    || (tag.carrier_profile_code && tag.carrier_profile_code !== carrier)
    || (product?.carrier_profile_code && product.carrier_profile_code !== carrier)) return { ok: false as const, error: "event_security_blocked" };
  const state = status === "OPENED" ? "VALID_OPENED" : status === "OPENED_PREVIOUSLY" ? "VALID_OPENED_PREVIOUSLY" : status;
  const receipt = event.meta?.sun_tt_truth_receipt;
  if (["VALID_CLOSED", "VALID_OPENED", "VALID_OPENED_PREVIOUSLY"].includes(state)) {
    const tt = resolveTagTamperPresentationEvidence({ carrierProfileCode: receipt?.carrier_profile_code, ttRaw: receipt?.tt_raw });
    if (carrier !== "ntag424_dna_tt" || receipt?.schema_version !== "sun-tt-durable-truth-receipt/v1" || receipt?.binding_status !== "BOUND"
      || receipt?.carrier_profile_code !== carrier || receipt?.canonical_product_state !== state || tt.state !== state) {
      return { ok: false as const, error: "event_security_blocked" };
    }
  }
  const verdict = mapVerdictAndRisk({ statusCode: status, productState: status, reason: event.reason });
  const rights = resolveRightsPolicy({ ...resolution.profile, verdict: verdict.verdict, statusCode: status, productState: status, reason: event.reason });
  // Current save/join routes both save the product AND associate the brand.
  // Preserve that contract: neither may smuggle a denied implicit action.
  if (!rights.allowedActions.includes(action) || (action !== "rewards" && (!rights.allowedActions.includes("save") || !rights.allowedActions.includes("join")))) {
    return { ok: false as const, error: "tap_action_not_allowed" };
  }
  return { ok: true as const, context: {
    event: boundEvent, action, vertical: resolution.profile.vertical,
    canJoin: rights.allowedActions.includes("join"), productName: resolution.profile.product.name,
    brandName: resolution.profile.product.winery || tenant.name,
    imageUrl: resolution.profile.product.imageUrl,
  } satisfies ConsumerVerticalContext };
}

export async function readConsumerVerticalContext(eventId: string, action: ConsumerVerticalAction) {
  // to_jsonb(events) returns a JSON numeric id. Reject numbers JavaScript cannot
  // represent exactly rather than consuming a capability for a rounded event.
  if (!/^[1-9][0-9]{0,15}$/.test(eventId) || !Number.isSafeInteger(Number(eventId))) return { ok: false as const, error: "invalid_event_id" };
  let rows: Row[];
  try { rows = await sql`
    SELECT jsonb_build_object('event', to_jsonb(e), 'batch', jsonb_build_object('id', b.id, 'tenant_id', b.tenant_id, 'bid', b.bid, 'status', b.status, 'sdm_config', b.sdm_config, 'carrier_profile_code', b.carrier_profile_code),
      'tenant', jsonb_build_object('id', tenant.id, 'slug', tenant.slug, 'name', tenant.name, 'status', tenant.status),
      'tag', to_jsonb(tag), 'profile', to_jsonb(profile), 'product', to_jsonb(product), 'manual', to_jsonb(manual)) AS snapshot,
      (SELECT count(*) FROM tags identity_tag WHERE identity_tag.batch_id = e.batch_id AND UPPER(TRIM(identity_tag.uid_hex)) = UPPER(TRIM(e.uid_hex))) AS identity_count,
      (SELECT count(*) FROM events identity_event WHERE identity_event.id = e.id) AS event_count
    FROM events e JOIN batches b ON b.id = e.batch_id AND b.tenant_id = e.tenant_id
    JOIN tenants tenant ON tenant.id = e.tenant_id
    JOIN tags tag ON tag.batch_id = e.batch_id AND UPPER(TRIM(tag.uid_hex)) = UPPER(TRIM(e.uid_hex))
    LEFT JOIN tenant_sun_profiles profile ON profile.tenant_id = e.tenant_id
    LEFT JOIN tag_profiles product ON product.tag_id = tag.id
    LEFT JOIN tag_manual_tamper_overrides manual ON manual.batch_id = e.batch_id AND UPPER(TRIM(manual.uid_hex)) = UPPER(TRIM(e.uid_hex))
    WHERE e.id = ${eventId}::bigint LIMIT 2
  `; } catch { return { ok: false as const, error: "tap_policy_unavailable" }; }
  if (rows.length !== 1 || String(rows[0].snapshot?.event?.id ?? "") !== eventId) return { ok: false as const, error: "tap_policy_indeterminate" };
  const decision = evaluateConsumerVerticalContext(rows[0], action);
  if (decision.ok) issued.set(decision.context, rows[0].snapshot as Snapshot);
  return decision;
}

type Fragment = { strings: TemplateStringsArray; values: unknown[] };
function fragment(strings: TemplateStringsArray, ...values: unknown[]): Fragment { return { strings, values }; }
function concat(a: Fragment, b: Fragment): Fragment {
  const strings = [...a.strings]; strings[strings.length - 1] += b.strings[0]; strings.push(...b.strings.slice(1));
  return { strings: Object.assign(strings, { raw: [...strings] }) as unknown as TemplateStringsArray, values: [...a.values, ...b.values] };
}

/** Locks plus equality revalidate the precheck/one-use capability gap. Missing
 * rows are SERIALIZABLE predicates; a first profile INSERT without a shared
 * revision fence may serialize after this writer even if it commits first.
 * This is transaction ordering, not wall-clock publication ordering. Every
 * business CTE depends on eligible_context; a denied context writes nothing.
 */
function lockedContext(context: ConsumerVerticalContext): Fragment {
  const s = issued.get(context);
  if (!s) throw new Error("unissued_consumer_vertical_context");
  const e = s.event;
  const json = (value: unknown) => value == null ? null : JSON.stringify(value);
  return fragment`
    WITH locked_identity AS MATERIALIZED (
      SELECT e.*, tag.id AS writer_tag_id FROM events e
      JOIN batches b ON b.id = e.batch_id AND b.tenant_id = e.tenant_id
      JOIN tenants tenant ON tenant.id = e.tenant_id
      JOIN tags tag ON tag.batch_id = e.batch_id AND UPPER(TRIM(tag.uid_hex)) = UPPER(TRIM(e.uid_hex))
      WHERE e.id = ${String(e.id)}::bigint AND e.tenant_id = ${e.tenant_id}::uuid AND tag.id = ${s.tag.id}::uuid
        AND to_jsonb(e) = ${json(e)}::jsonb AND to_jsonb(tag) = ${json(s.tag)}::jsonb
        AND jsonb_build_object('id', b.id, 'tenant_id', b.tenant_id, 'bid', b.bid, 'status', b.status, 'sdm_config', b.sdm_config, 'carrier_profile_code', b.carrier_profile_code) = ${json(s.batch)}::jsonb
        AND jsonb_build_object('id', tenant.id, 'slug', tenant.slug, 'name', tenant.name, 'status', tenant.status) = ${json(s.tenant)}::jsonb
        AND (SELECT count(*) FROM events ambiguous_event WHERE ambiguous_event.id = e.id) = 1
        AND NOT EXISTS (SELECT 1 FROM tags ambiguous_tag WHERE ambiguous_tag.batch_id = tag.batch_id AND UPPER(TRIM(ambiguous_tag.uid_hex)) = UPPER(TRIM(tag.uid_hex)) AND ambiguous_tag.id <> tag.id)
      FOR SHARE OF e, b, tenant, tag
    ), locked_profile AS MATERIALIZED (
      SELECT to_jsonb(profile) AS snapshot FROM tenant_sun_profiles profile JOIN locked_identity e ON profile.tenant_id = e.tenant_id FOR SHARE OF profile
    ), locked_product AS MATERIALIZED (
      SELECT to_jsonb(product) AS snapshot FROM tag_profiles product JOIN locked_identity e ON product.tag_id = e.writer_tag_id FOR SHARE OF product
    ), locked_manual AS MATERIALIZED (
      SELECT to_jsonb(manual) AS snapshot FROM tag_manual_tamper_overrides manual JOIN locked_identity e ON manual.batch_id = e.batch_id AND UPPER(TRIM(manual.uid_hex)) = UPPER(TRIM(e.uid_hex)) FOR SHARE OF manual
    ), eligible_context AS MATERIALIZED (
      SELECT e.* FROM locked_identity e
      WHERE (SELECT count(*) FROM locked_profile) <= 1 AND (SELECT snapshot FROM locked_profile) IS NOT DISTINCT FROM ${json(s.profile)}::jsonb
        AND (SELECT count(*) FROM locked_product) <= 1 AND (SELECT snapshot FROM locked_product) IS NOT DISTINCT FROM ${json(s.product)}::jsonb
        AND (SELECT count(*) FROM locked_manual) <= 1 AND (SELECT snapshot FROM locked_manual) IS NOT DISTINCT FROM ${json(s.manual)}::jsonb
    )
  `;
}

/** All statements are retried as a unit after a serialization rollback; the
 * original context remains fixed. No new precheck and no capability restoration.
 */
async function executeWrite(statement: Fragment) {
  for (let attempt = 0; ; attempt += 1) {
    try { return await sqlSerializable(statement.strings, ...statement.values); }
    catch (error) {
      if (attempt >= 2 || !error || typeof error !== "object" || !("code" in error) || error.code !== "40001") throw error;
    }
  }
}

export async function associateConsumerVerticalTap(input: { consumerId: string; context: ConsumerVerticalContext }) {
  const { context, consumerId } = input;
  if (context.action !== "save" && context.action !== "join") throw new Error("wrong_consumer_vertical_action");
  const statement = concat(lockedContext(context), fragment`
    , locked_membership AS MATERIALIZED (
      SELECT membership.* FROM tenant_consumer_memberships membership JOIN eligible_context e ON membership.tenant_id = e.tenant_id
      WHERE membership.consumer_id = ${consumerId}::uuid FOR UPDATE OF membership
    ), writable AS MATERIALIZED (
      SELECT e.* FROM eligible_context e WHERE NOT EXISTS (SELECT 1 FROM locked_membership WHERE status IS DISTINCT FROM 'active')
    ), membership_write AS (
      INSERT INTO tenant_consumer_memberships (tenant_id, consumer_id, loyalty_program_id, source, first_tap_event_id, last_tap_event_id, status)
      SELECT e.tenant_id, ${consumerId}::uuid, (SELECT id FROM loyalty_programs WHERE tenant_id = e.tenant_id AND status = 'active' ORDER BY created_at DESC LIMIT 1), 'tap', e.id, e.id, 'active'
      FROM writable e WHERE true
      ON CONFLICT (tenant_id, consumer_id) DO UPDATE SET last_tap_event_id = EXCLUDED.last_tap_event_id, last_activity_at = now(), updated_at = now()
      WHERE tenant_consumer_memberships.status = 'active' RETURNING *
    ), associated AS MATERIALIZED (
      SELECT e.* FROM writable e WHERE EXISTS (SELECT 1 FROM membership_write)
    ), history_write AS (
      INSERT INTO consumer_tap_history (consumer_id, tenant_id, tap_event_id, verdict, risk_level, city, country)
      SELECT ${consumerId}::uuid, tenant_id, id, result, 'low', city, country_code FROM associated WHERE true
      ON CONFLICT (consumer_id, tap_event_id) DO NOTHING RETURNING tap_event_id
    ), existing_product AS MATERIALIZED (
      SELECT product.id FROM consumer_products product JOIN associated e ON product.tenant_id = e.tenant_id
      WHERE product.consumer_id = ${consumerId}::uuid AND (product.product_passport_id = e.uid_hex OR product.tag_id = e.writer_tag_id)
      ORDER BY product.updated_at DESC LIMIT 1 FOR UPDATE OF product
    ), product_update AS (
      UPDATE consumer_products product SET latest_tap_event_id = e.id, tag_id = e.writer_tag_id,
        product_name = ${context.productName}, brand_name = ${context.brandName}, image_url = COALESCE(${context.imageUrl}, product.image_url), updated_at = now()
      FROM existing_product existing, associated e WHERE product.id = existing.id RETURNING product.id
    ), product_insert AS (
      INSERT INTO consumer_products (consumer_id, tenant_id, product_passport_id, tag_id, first_tap_event_id, latest_tap_event_id, ownership_status, collection_type, product_name, brand_name, image_url)
      SELECT ${consumerId}::uuid, tenant_id, uid_hex, writer_tag_id, id, id, 'viewed', 'wine', ${context.productName}, ${context.brandName}, ${context.imageUrl}
      FROM associated WHERE NOT EXISTS (SELECT 1 FROM existing_product) RETURNING id
    )
    SELECT e.id, (SELECT to_jsonb(membership_write) FROM membership_write LIMIT 1) AS membership,
      EXISTS(SELECT 1 FROM history_write) AS history_inserted
    FROM associated e WHERE EXISTS(SELECT 1 FROM product_update UNION ALL SELECT 1 FROM product_insert)
  `);
  const rows = await executeWrite(statement);
  return rows[0] || null;
}

export async function enrollConsumerVerticalTap(input: { consumerId: string; context: ConsumerVerticalContext; programId: string; locale: string; email?: string | null; phone?: string | null; displayName?: string | null; country?: string | null }) {
  const { context } = input;
  if (context.action !== "rewards") throw new Error("wrong_consumer_vertical_action");
  const memberKey = `consumer:${input.consumerId}`;
  const statement = concat(lockedContext(context), fragment`
    , locked_program AS MATERIALIZED (
      SELECT program.* FROM loyalty_programs program JOIN eligible_context e ON program.tenant_id = e.tenant_id
      WHERE program.id = ${input.programId}::uuid FOR SHARE OF program
    ), locked_member AS MATERIALIZED (
      SELECT member.id, member.status FROM loyalty_members member JOIN locked_program program ON member.program_id = program.id AND member.tenant_id = program.tenant_id
      WHERE member.member_key = ${memberKey} FOR UPDATE OF member
    ), locked_membership AS MATERIALIZED (
      SELECT membership.status FROM tenant_consumer_memberships membership JOIN eligible_context e ON membership.tenant_id = e.tenant_id
      CROSS JOIN (SELECT count(*) FROM locked_member) member_lock_barrier
      WHERE membership.consumer_id = ${input.consumerId}::uuid FOR UPDATE OF membership
    ), eligible_program AS MATERIALIZED (
      SELECT program.* FROM locked_program program
      WHERE program.status = 'active' AND program.start_at <= clock_timestamp() AND (program.end_at IS NULL OR program.end_at >= clock_timestamp())
        AND NOT EXISTS(SELECT 1 FROM locked_membership WHERE status IS DISTINCT FROM 'active')
        AND NOT EXISTS(SELECT 1 FROM locked_member WHERE status NOT IN ('anonymous', 'enrolled', 'verified'))
    )
    INSERT INTO loyalty_members (tenant_id, program_id, event_id, member_key, consumer_id, preferred_locale, email, phone, display_name, country, status, first_tap_at, last_tap_at)
    SELECT e.tenant_id, program.id, e.id, ${memberKey}, ${input.consumerId}::uuid, ${input.locale}, ${input.email || null}, ${input.phone || null}, ${input.displayName || null}, ${input.country || null}, 'enrolled', now(), now()
    FROM eligible_context e JOIN eligible_program program ON program.tenant_id = e.tenant_id WHERE true
    ON CONFLICT (program_id, member_key) DO UPDATE SET event_id = EXCLUDED.event_id,
      consumer_id = COALESCE(EXCLUDED.consumer_id, loyalty_members.consumer_id), preferred_locale = EXCLUDED.preferred_locale,
      email = COALESCE(EXCLUDED.email, loyalty_members.email), phone = COALESCE(EXCLUDED.phone, loyalty_members.phone),
      display_name = COALESCE(EXCLUDED.display_name, loyalty_members.display_name), country = COALESCE(EXCLUDED.country, loyalty_members.country),
      status = CASE WHEN loyalty_members.status = 'verified' THEN loyalty_members.status ELSE 'enrolled'::loyalty_member_status END,
      updated_at = now(), last_tap_at = now()
    WHERE loyalty_members.tenant_id = EXCLUDED.tenant_id AND loyalty_members.status IN ('anonymous', 'enrolled', 'verified')
    RETURNING *
  `);
  const rows = await executeWrite(statement);
  return rows[0] || null;
}
