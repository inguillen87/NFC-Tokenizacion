import { sql } from './db';
import { evaluateTapCommercialRights } from './tap-commercial-rights';
import { resolveSunSecureCarrierProfile, resolveTagTamperPresentationEvidence } from './sun-carrier-trust-state';
import { isVerifiedAuthenticationEvent } from '@product/core';

const CLOSED_RESULTS = new Set(['VALID', 'TAP_VALID', 'VALID_AUTHENTIC', 'VALID_CLOSED']);
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const normalized = (value: unknown) => String(value ?? '').trim().toUpperCase();

export function validPostTapEventId(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9]\d{0,15}$/.test(value) && Number.isSafeInteger(Number(value));
}

/** A catalog inquiry never proves custody. Contextual inquiries still respect
 * the current electronic/manual state; a saved historical tap is only scope. */
export function isContextualMarketplaceTapEligible(event: Record<string, unknown>, carrier: unknown) {
  if (!evaluateTapCommercialRights(event).allowed || !isVerifiedAuthenticationEvent(event) || !CLOSED_RESULTS.has(normalized(event.result))) return false;
  if (String(event.source).toLowerCase() !== 'real' || !['ntag424_dna','ntag424_dna_tt'].includes(String(carrier).toLowerCase())) return false;
  if (['HIGH', 'CRITICAL'].includes(normalized(event.risk_level))) return false;
  const meta = record(event.meta), receipt = record(meta.sun_tt_truth_receipt);
  const states = [meta.product_state, record(meta.sun_atomic).product_state, receipt.canonical_product_state];
  if (states.some(state => state != null && !CLOSED_RESULTS.has(normalized(state)))) return false;
  if (normalized(receipt.binding_status) === 'REJECTED' || /OPENED|TAMPER|REPLAY|INVALID|MISMATCH|REVOKED|BROKEN/i.test(String(event.reason ?? ''))) return false;
  const evidence = resolveTagTamperPresentationEvidence({ carrierProfileCode: receipt.carrier_profile_code ?? carrier, ttRaw: receipt.tt_raw });
  if (String(carrier).toLowerCase() === 'ntag424_dna_tt' && (receipt.schema_version !== 'sun-tt-durable-truth-receipt/v1'
    || receipt.binding_status !== 'BOUND' || receipt.carrier_profile_code !== 'ntag424_dna_tt' || receipt.canonical_product_state !== 'VALID_CLOSED' || evidence.state !== 'VALID_CLOSED')) return false;
  return evidence.state !== 'VALID_OPENED' && evidence.state !== 'VALID_OPENED_PREVIOUSLY';
}

type InquiryInput = {
  eventId: string; consumerId: string; tenantId: string; productId: string;
  quantity: number; message: string | null; ageGateAccepted: boolean;
};

export async function createContextualMarketplaceInquiry(input: InquiryInput) {
  if (!validPostTapEventId(input.eventId)) return { ok: false as const, status: 400, error: 'invalid_post_tap_event_id' as const };
  const sources = await sql`
    SELECT e.*, e.created_at::text AS event_created_at, b.bid, b.carrier_profile_code, b.sdm_config,
      tag.id AS tag_id, tag.tag_revision, tag.status AS tag_status, tag.lifecycle_state, tag.identity_count,
      manual.tamper_status AS manual_tamper_status, manual.reason AS manual_tamper_reason,
      latest.id AS latest_id, latest.created_at::text AS latest_created_at, latest.result AS latest_result,
      latest.reason AS latest_reason, latest.verdict AS latest_verdict, latest.risk_level AS latest_risk_level,
      latest.source AS latest_source, latest.meta AS latest_meta,latest.event_type AS latest_event_type,latest.cmac_ok AS latest_cmac_ok,latest.allowlisted AS latest_allowlisted
    FROM events e
    JOIN batches b ON b.id=e.batch_id AND b.tenant_id=e.tenant_id
    LEFT JOIN LATERAL (
      SELECT tag.*,tag.xmin::text AS tag_revision, count(*) OVER () AS identity_count FROM tags tag
      WHERE tag.batch_id=e.batch_id AND UPPER(tag.uid_hex)=UPPER(e.uid_hex)
    ) tag ON true
    LEFT JOIN tag_manual_tamper_overrides manual ON manual.batch_id=e.batch_id AND UPPER(manual.uid_hex)=UPPER(e.uid_hex)
    LEFT JOIN LATERAL (
      SELECT unit.* FROM events unit WHERE unit.tenant_id=e.tenant_id AND unit.batch_id=e.batch_id AND UPPER(unit.uid_hex)=UPPER(e.uid_hex)
      ORDER BY unit.created_at DESC,unit.id DESC LIMIT 1
    ) latest ON true
    WHERE e.id=${input.eventId}::bigint LIMIT 2`;
  const source = sources[0];
  if (sources.length !== 1 || !source || String(source.tenant_id) !== input.tenantId || !source.tag_id || Number(source.identity_count) !== 1
    || normalized(source.tag_status) !== 'ACTIVE' || normalized(source.lifecycle_state ?? source.tag_status) !== 'ACTIVE') {
    return { ok: false as const, status: 403, error: 'marketplace_tap_context_required' as const };
  }
  const carrier = resolveSunSecureCarrierProfile({ carrierProfileCode: source.carrier_profile_code, sdmConfig: source.sdm_config });
  const latest = { result: source.latest_result, reason: source.latest_reason, verdict: source.latest_verdict, risk_level: source.latest_risk_level,
    source: source.latest_source, meta: source.latest_meta,event_type:source.latest_event_type,cmac_ok:source.latest_cmac_ok,allowlisted:source.latest_allowlisted,
    manual_tamper_status: source.manual_tamper_status, manual_tamper_reason: source.manual_tamper_reason };
  if (!isContextualMarketplaceTapEligible(source, carrier) || !isContextualMarketplaceTapEligible(latest, carrier)) {
    return { ok: false as const, status: 403, error: 'marketplace_tap_context_required' as const };
  }
  // The tag revision also fences the first manual override, whose writer
  // touches this same row before inserting evidence. No fresh NFC token is used.
  const rows = await sql`
    WITH locked_batch AS MATERIALIZED (
      SELECT b.* FROM batches b WHERE b.id=${source.batch_id}::uuid AND b.tenant_id=${input.tenantId}::uuid FOR SHARE OF b
    ), locked_tag AS MATERIALIZED (
      SELECT tag.*,tag.xmin::text AS revision FROM tags tag
      JOIN locked_batch ON locked_batch.id=tag.batch_id
      WHERE tag.id=${source.tag_id}::uuid AND tag.batch_id=${source.batch_id}::uuid AND UPPER(tag.uid_hex)=UPPER(${source.uid_hex})
      FOR SHARE OF tag
    ), locked_profile AS MATERIALIZED (
      SELECT p.* FROM tenant_sun_profiles p JOIN locked_tag ON true WHERE p.tenant_id=${input.tenantId}::uuid FOR SHARE OF p
    ), locked_brand AS MATERIALIZED (
      SELECT b.* FROM marketplace_brand_profiles b JOIN locked_profile ON true WHERE b.tenant_id=${input.tenantId}::uuid FOR SHARE OF b
    ), locked_product AS MATERIALIZED (
      SELECT p.* FROM marketplace_products p JOIN locked_brand ON true WHERE p.id=${input.productId}::uuid AND p.tenant_id=${input.tenantId}::uuid FOR SHARE OF p
    ), locked_consumer AS MATERIALIZED (
      SELECT c.* FROM consumers c JOIN locked_product ON true WHERE c.id=${input.consumerId}::uuid FOR SHARE OF c
    ), locked_membership AS MATERIALIZED (
      SELECT m.* FROM tenant_consumer_memberships m JOIN locked_consumer ON true
      WHERE m.tenant_id=${input.tenantId}::uuid AND m.consumer_id=${input.consumerId}::uuid FOR SHARE OF m
    ), locked_event AS MATERIALIZED (
      SELECT e.* FROM events e CROSS JOIN (SELECT count(*) FROM locked_membership) barrier WHERE e.id=${input.eventId}::bigint FOR SHARE OF e
    ), locked_history AS MATERIALIZED (
      SELECT h.* FROM consumer_tap_history h JOIN locked_event e ON e.id=h.tap_event_id AND e.tenant_id=h.tenant_id
      WHERE h.consumer_id=${input.consumerId}::uuid AND h.tenant_id=${input.tenantId}::uuid FOR SHARE OF h
    ), locked_ownership AS MATERIALIZED (
      SELECT o.* FROM consumer_product_ownerships o JOIN locked_event e ON e.id=o.event_id AND e.tenant_id=o.tenant_id AND e.batch_id=o.batch_id AND UPPER(e.uid_hex)=UPPER(o.uid_hex)
      WHERE o.consumer_id=${input.consumerId}::uuid AND o.tenant_id=${input.tenantId}::uuid AND o.tag_id=${source.tag_id}::uuid FOR SHARE OF o
    ), locked_manual AS MATERIALIZED (
      SELECT m.* FROM tag_manual_tamper_overrides m CROSS JOIN (SELECT count(*) FROM locked_event) barrier
      WHERE m.batch_id=${source.batch_id}::uuid AND UPPER(m.uid_hex)=UPPER(${source.uid_hex}) FOR SHARE OF m
    ), current_unit AS MATERIALIZED (
      SELECT e.* FROM events e CROSS JOIN (SELECT count(*) FROM locked_manual) barrier
      WHERE e.tenant_id=${input.tenantId}::uuid AND e.batch_id=${source.batch_id}::uuid AND UPPER(e.uid_hex)=UPPER(${source.uid_hex})
      ORDER BY e.created_at DESC,e.id DESC LIMIT 1 FOR SHARE OF e
    ), eligible AS MATERIALIZED (
      SELECT p.*,c.email,c.phone,c.preferred_locale,b.display_name AS brand_name FROM locked_product p JOIN locked_brand b ON true
      JOIN locked_consumer c ON true JOIN locked_membership m ON m.status='active' JOIN locked_profile sp ON true
      JOIN locked_tag tag ON tag.revision=${source.tag_revision} AND tag.status='active' AND COALESCE(tag.lifecycle_state,tag.status::text)='active'
      JOIN locked_batch batch ON batch.carrier_profile_code IS NOT DISTINCT FROM ${source.carrier_profile_code} AND batch.sdm_config IS NOT DISTINCT FROM ${JSON.stringify(source.sdm_config ?? {})}::jsonb
      JOIN locked_event e ON e.tenant_id=${input.tenantId}::uuid AND e.batch_id=${source.batch_id}::uuid AND UPPER(e.uid_hex)=UPPER(${source.uid_hex})
      JOIN current_unit unit ON unit.id=${source.latest_id}::bigint AND unit.created_at=${source.latest_created_at}::timestamptz
      WHERE (SELECT count(*) FROM locked_event)=1 AND c.status IN ('anonymous','registered','verified')
        AND e.created_at=${source.event_created_at}::timestamptz AND e.result IS NOT DISTINCT FROM ${source.result}
        AND e.reason IS NOT DISTINCT FROM ${source.reason} AND e.meta IS NOT DISTINCT FROM ${JSON.stringify(source.meta ?? {})}::jsonb
        AND e.verdict IS NOT DISTINCT FROM ${source.verdict} AND e.risk_level IS NOT DISTINCT FROM ${source.risk_level} AND e.source IS NOT DISTINCT FROM ${source.source}
        AND e.event_type IS NOT DISTINCT FROM ${source.event_type} AND e.cmac_ok=true AND e.allowlisted=true
        AND unit.result IS NOT DISTINCT FROM ${source.latest_result} AND unit.reason IS NOT DISTINCT FROM ${source.latest_reason}
        AND unit.meta IS NOT DISTINCT FROM ${JSON.stringify(source.latest_meta ?? {})}::jsonb AND unit.verdict IS NOT DISTINCT FROM ${source.latest_verdict}
        AND unit.risk_level IS NOT DISTINCT FROM ${source.latest_risk_level} AND unit.source IS NOT DISTINCT FROM ${source.latest_source}
        AND unit.event_type IS NOT DISTINCT FROM ${source.latest_event_type} AND unit.cmac_ok=true AND unit.allowlisted=true
        AND (EXISTS(SELECT 1 FROM locked_history WHERE LOWER(COALESCE(risk_level,'medium')) IN ('low','medium') AND UPPER(COALESCE(verdict,''))=ANY(${[...CLOSED_RESULTS]}::text[]))
          OR EXISTS(SELECT 1 FROM locked_ownership WHERE status='claimed'))
        AND NOT EXISTS(SELECT 1 FROM locked_manual WHERE UPPER(BTRIM(COALESCE(tamper_status,''))) IN ('MANUAL_OPENED','OPENED')
          OR regexp_replace(UPPER(COALESCE(reason,'')), '[[:space:]-]+', '_','g') SIMILAR TO '%(MANUAL_TAMPER_OPENED|MANUAL_OPENED|OPERATOR_DECLARED_OPEN)%')
        AND sp.metadata #>> '{postTap,version}'='nexid.tenant-actions.v1' AND sp.metadata #>> '{postTap,status}'='published'
        AND COALESCE(sp.metadata #> '{postTap,allowedActions}','[]'::jsonb) ? 'marketplace'
        AND p.status='active' AND p.request_to_buy_enabled=true AND b.status='active' AND b.visible_in_network=true
        AND (p.age_gate_required=false OR ${input.ageGateAccepted}=true)
    ), created_request AS (
      INSERT INTO marketplace_order_requests(consumer_id,tenant_id,marketplace_product_id,quantity,consumer_message,contact_json,
        source_tap_event_id,source_tap_event_created_at,source_tag_id,source_uid_hex,source_batch_id,source_bid,source_context_json)
      SELECT ${input.consumerId}::uuid,${input.tenantId}::uuid,id,${input.quantity},${input.message},
        jsonb_build_object('email',email,'phone',phone,'access_mode','contextual_saved_tap'),${input.eventId}::bigint,${source.event_created_at}::timestamptz,
        ${source.tag_id}::uuid,${source.uid_hex},${source.batch_id}::uuid,${source.bid},
        jsonb_build_object('source','post_tap_marketplace','attribution_mode','attribution_only','event_id',${input.eventId}::text,'access_mode','contextual_saved_tap')
      FROM eligible ON CONFLICT DO NOTHING RETURNING *
    ), created_crm_request AS (
      INSERT INTO order_requests(tenant_id,locale,contact,company,tag_type,volume,notes,status,source)
      SELECT ${input.tenantId}::uuid,COALESCE(e.preferred_locale,'es-AR'),COALESCE(e.email,e.phone,${`consumer:${input.consumerId}`}),e.brand_name,e.title,
        ${input.quantity},${`Marketplace catalog inquiry | event=${input.eventId}${input.message ? ` | ${input.message}` : ''}`},'new','marketplace'
      FROM created_request r JOIN eligible e ON e.id=r.marketplace_product_id RETURNING id
    ) SELECT (SELECT row_to_json(r) FROM created_request r LIMIT 1) AS created_record,
      (SELECT id FROM created_crm_request LIMIT 1) AS crm_request_id,(SELECT count(*) FROM eligible)::integer AS eligible_count,
      ((SELECT count(*) FROM locked_profile WHERE metadata #>> '{postTap,version}'='nexid.tenant-actions.v1' AND metadata #>> '{postTap,status}'='published' AND COALESCE(metadata #> '{postTap,allowedActions}','[]'::jsonb) ? 'marketplace')=1
        AND (SELECT count(*) FROM locked_brand WHERE status='active' AND visible_in_network=true)=1
        AND (SELECT count(*) FROM locked_product WHERE status='active' AND request_to_buy_enabled=true AND (age_gate_required=false OR ${input.ageGateAccepted}=true))=1) AS configuration_allowed`;
  if (Number(rows[0]?.eligible_count) !== 1) return rows[0]?.configuration_allowed === true
    ? { ok: false as const, status: 403, error: 'marketplace_tap_context_required' as const }
    : { ok: false as const, status: 409, error: 'marketplace_configuration_changed' as const };
  const created = rows[0]?.created_record;
  // A conflicting insert may have committed after this statement's snapshot.
  // Recover its consumer-bound receipt with a fresh read, without another write.
  const request = created || (await sql`
    SELECT * FROM marketplace_order_requests WHERE consumer_id=${input.consumerId}::uuid AND tenant_id=${input.tenantId}::uuid
      AND marketplace_product_id=${input.productId}::uuid AND status IN ('requested','new','pending','open') ORDER BY created_at DESC LIMIT 1`)[0];
  if (!request) return { ok: false as const, status: 409, error: 'request_creation_conflict' as const };
  return { ok: true as const, request: { ...request, was_created: Boolean(created), crm_request_id: rows[0]?.crm_request_id } };
}
