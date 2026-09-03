export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminWithPermission, getAdminTenantScope } from "../../../lib/auth";
import { normalizeBrowser, normalizeDeviceType, normalizeOs, normalizeTimezone, parseAnalyticsFilters } from "../../../lib/analytics";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { resolveEventLocalTime } from "@product/core";
import { effectiveTenantFilter } from "../../../lib/admin-tenant-filter";
import { classifyPhysicalTapSealState, isAuthenticatedNfcMessage } from "../../../lib/admin-physical-taps";

export async function GET(req: Request) {
  const auth = await checkAdminWithPermission(req, "events.read_sensitive");
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const { tenant: rawTenant, source, range, rangeSql, country } = parseAnalyticsFilters(searchParams);
  const tenant = effectiveTenantFilter({ forcedTenantSlug, requestedTenantSlug: rawTenant });
  const requestedEventSource = String(searchParams.get("source") || "").trim().toLowerCase();
  const eventSource = requestedEventSource === "production"
    ? "production"
    : source === "real" || source === "demo" || source === "imported" ? source : "";
  const bid = searchParams.get("bid") || "";
  const uid = (searchParams.get("uid") || "").toUpperCase();
  const result = (searchParams.get("result") || "").toUpperCase();
  const limit = Number(searchParams.get("limit") || 100);

  const safeLimit = Math.min(Math.max(limit, 1), 500);
  let rows: unknown[] = [];
  let attemptRows: unknown[] = [];
  try {
    rows = tenant
      ? await sql/*sql*/`
        SELECT
          e.id, e.tenant_id, e.batch_id, e.tag_id, e.result, e.reason, e.verdict, e.risk_level, e.event_type::text AS event_type, e.cmac_ok, e.allowlisted,
          (
            SELECT COUNT(DISTINCT actor_history.consumer_id)::int FROM consumer_tap_history actor_history
            WHERE actor_history.tenant_id = e.tenant_id AND actor_history.tap_event_id = e.id
              AND actor_history.consumer_id IS NOT NULL
          ) AS known_actor_count,
          EXISTS (
            SELECT 1 FROM consumer_tap_history actor_history
            WHERE actor_history.tenant_id = e.tenant_id AND actor_history.tap_event_id = e.id
              AND actor_history.consumer_id IS NOT NULL
          ) AS known_actor,
          COALESCE(ARRAY(
            SELECT DISTINCT CASE
              WHEN LOWER(consent.scope) IN ('whatsapp','whatsapp_marketing') THEN 'whatsapp'
              WHEN LOWER(consent.scope) = 'phone_marketing' THEN 'phone'
              WHEN LOWER(consent.scope) IN ('email','email_marketing') THEN 'email'
            END
            FROM consumer_tap_history cth
            JOIN consumer_tenant_consents consent ON consent.tenant_id = cth.tenant_id AND consent.consumer_id = cth.consumer_id
            WHERE cth.tenant_id = e.tenant_id AND cth.tap_event_id = e.id AND cth.consumer_id IS NOT NULL
              AND consent.granted = true AND consent.revoked_at IS NULL
              AND LOWER(consent.scope) IN ('whatsapp','whatsapp_marketing','phone_marketing','email','email_marketing')
          ), ARRAY[]::text[]) AS commercial_consent_channels,
          EXISTS (
            SELECT 1 FROM consumer_tap_history cth
            JOIN consumer_tenant_consents consent ON consent.tenant_id = cth.tenant_id AND consent.consumer_id = cth.consumer_id
            WHERE cth.tenant_id = e.tenant_id AND cth.tap_event_id = e.id AND cth.consumer_id IS NOT NULL
              AND consent.granted = true AND consent.revoked_at IS NULL
              AND LOWER(consent.scope) IN ('whatsapp','whatsapp_marketing','phone_marketing','email','email_marketing')
          ) AS commercial_consent_granted,
          e.uid_hex, e.created_at, e.city, e.country_code, e.lat, e.lng,
          e.read_counter, e.source, e.device_label, e.user_agent, e.meta, e.location_source, e.location_accuracy_m,
          COALESCE(
            NULLIF(e.product_name, ''),
            NULLIF(b.sdm_config->>'product_name', ''),
            NULLIF(b.sdm_config #>> '{sun,product,name}', ''),
            NULLIF(b.sdm_config->>'sku', ''),
            NULLIF(b.sdm_config #>> '{sun,product,sku}', '')
          ) AS product_name,
          b.bid, tn.slug AS tenant_slug
        FROM events e
        JOIN batches b ON b.id = e.batch_id AND b.tenant_id = e.tenant_id
        JOIN tenants tn ON tn.id = e.tenant_id
        WHERE tn.slug = ${tenant}
          AND (${bid} = '' OR b.bid = ${bid})
          AND (${uid} = '' OR e.uid_hex = ${uid})
          AND (${result} = '' OR UPPER(e.result) = ${result})
          AND (
            ${eventSource} = ''
            OR (${eventSource} = 'production' AND e.source::text IN ('real', 'imported'))
            OR e.source::text = ${eventSource}
          )
          AND (${country} = '' OR COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, '')) = ${country})
          AND e.created_at >= now() - ${rangeSql}::interval
        ORDER BY e.created_at DESC
        LIMIT ${safeLimit}
      `
      : await sql/*sql*/`
        SELECT
          e.id, e.tenant_id, e.batch_id, e.tag_id, e.result, e.reason, e.verdict, e.risk_level, e.event_type::text AS event_type, e.cmac_ok, e.allowlisted,
          (
            SELECT COUNT(DISTINCT actor_history.consumer_id)::int FROM consumer_tap_history actor_history
            WHERE actor_history.tenant_id = e.tenant_id AND actor_history.tap_event_id = e.id
              AND actor_history.consumer_id IS NOT NULL
          ) AS known_actor_count,
          EXISTS (
            SELECT 1 FROM consumer_tap_history actor_history
            WHERE actor_history.tenant_id = e.tenant_id AND actor_history.tap_event_id = e.id
              AND actor_history.consumer_id IS NOT NULL
          ) AS known_actor,
          COALESCE(ARRAY(
            SELECT DISTINCT CASE
              WHEN LOWER(consent.scope) IN ('whatsapp','whatsapp_marketing') THEN 'whatsapp'
              WHEN LOWER(consent.scope) = 'phone_marketing' THEN 'phone'
              WHEN LOWER(consent.scope) IN ('email','email_marketing') THEN 'email'
            END
            FROM consumer_tap_history cth
            JOIN consumer_tenant_consents consent ON consent.tenant_id = cth.tenant_id AND consent.consumer_id = cth.consumer_id
            WHERE cth.tenant_id = e.tenant_id AND cth.tap_event_id = e.id AND cth.consumer_id IS NOT NULL
              AND consent.granted = true AND consent.revoked_at IS NULL
              AND LOWER(consent.scope) IN ('whatsapp','whatsapp_marketing','phone_marketing','email','email_marketing')
          ), ARRAY[]::text[]) AS commercial_consent_channels,
          EXISTS (
            SELECT 1 FROM consumer_tap_history cth
            JOIN consumer_tenant_consents consent ON consent.tenant_id = cth.tenant_id AND consent.consumer_id = cth.consumer_id
            WHERE cth.tenant_id = e.tenant_id AND cth.tap_event_id = e.id AND cth.consumer_id IS NOT NULL
              AND consent.granted = true AND consent.revoked_at IS NULL
              AND LOWER(consent.scope) IN ('whatsapp','whatsapp_marketing','phone_marketing','email','email_marketing')
          ) AS commercial_consent_granted,
          e.uid_hex, e.created_at, e.city, e.country_code, e.lat, e.lng,
          e.read_counter, e.source, e.device_label, e.user_agent, e.meta, e.location_source, e.location_accuracy_m,
          COALESCE(
            NULLIF(e.product_name, ''),
            NULLIF(b.sdm_config->>'product_name', ''),
            NULLIF(b.sdm_config #>> '{sun,product,name}', ''),
            NULLIF(b.sdm_config->>'sku', ''),
            NULLIF(b.sdm_config #>> '{sun,product,sku}', '')
          ) AS product_name,
          b.bid, tn.slug AS tenant_slug
        FROM events e
        JOIN batches b ON b.id = e.batch_id AND b.tenant_id = e.tenant_id
        JOIN tenants tn ON tn.id = e.tenant_id
        WHERE (${tenant} = '' OR tn.slug = ${tenant})
          AND (${bid} = '' OR b.bid = ${bid})
          AND (${uid} = '' OR e.uid_hex = ${uid})
          AND (${result} = '' OR UPPER(e.result) = ${result})
          AND (
            ${eventSource} = ''
            OR (${eventSource} = 'production' AND e.source::text IN ('real', 'imported'))
            OR e.source::text = ${eventSource}
          )
          AND (${country} = '' OR COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, '')) = ${country})
          AND e.created_at >= now() - ${rangeSql}::interval
        ORDER BY e.created_at DESC
        LIMIT ${safeLimit}
      `;
  } catch {
    rows = tenant
      ? await sql/*sql*/`
        SELECT e.id, e.tenant_id, e.batch_id, e.tag_id, e.result, e.reason, e.verdict, e.risk_level, e.event_type::text AS event_type, e.cmac_ok, e.allowlisted,
          (
            SELECT COUNT(DISTINCT actor_history.consumer_id)::int FROM consumer_tap_history actor_history
            WHERE actor_history.tenant_id = e.tenant_id AND actor_history.tap_event_id = e.id
              AND actor_history.consumer_id IS NOT NULL
          ) AS known_actor_count,
          EXISTS (
            SELECT 1 FROM consumer_tap_history actor_history
            WHERE actor_history.tenant_id = e.tenant_id AND actor_history.tap_event_id = e.id
              AND actor_history.consumer_id IS NOT NULL
          ) AS known_actor,
          COALESCE(ARRAY(
            SELECT DISTINCT CASE
              WHEN LOWER(consent.scope) IN ('whatsapp','whatsapp_marketing') THEN 'whatsapp'
              WHEN LOWER(consent.scope) = 'phone_marketing' THEN 'phone'
              WHEN LOWER(consent.scope) IN ('email','email_marketing') THEN 'email'
            END
            FROM consumer_tap_history cth
            JOIN consumer_tenant_consents consent ON consent.tenant_id = cth.tenant_id AND consent.consumer_id = cth.consumer_id
            WHERE cth.tenant_id = e.tenant_id AND cth.tap_event_id = e.id AND cth.consumer_id IS NOT NULL
              AND consent.granted = true AND consent.revoked_at IS NULL
              AND LOWER(consent.scope) IN ('whatsapp','whatsapp_marketing','phone_marketing','email','email_marketing')
          ), ARRAY[]::text[]) AS commercial_consent_channels,
          EXISTS (
            SELECT 1 FROM consumer_tap_history cth
            JOIN consumer_tenant_consents consent ON consent.tenant_id = cth.tenant_id AND consent.consumer_id = cth.consumer_id
            WHERE cth.tenant_id = e.tenant_id AND cth.tap_event_id = e.id AND cth.consumer_id IS NOT NULL
              AND consent.granted = true AND consent.revoked_at IS NULL
              AND LOWER(consent.scope) IN ('whatsapp','whatsapp_marketing','phone_marketing','email','email_marketing')
          ) AS commercial_consent_granted,
          e.uid_hex, e.created_at, e.city, e.country_code, e.lat, e.lng, e.read_counter, e.source, e.device_label, e.user_agent, e.meta, e.location_source, e.location_accuracy_m,
          COALESCE(NULLIF(e.product_name, ''), NULLIF(b.sdm_config->>'product_name', ''), NULLIF(b.sdm_config #>> '{sun,product,name}', ''), NULLIF(b.sdm_config->>'sku', ''), NULLIF(b.sdm_config #>> '{sun,product,sku}', '')) AS product_name,
          b.bid, tn.slug AS tenant_slug
        FROM events e
        JOIN batches b ON b.id = e.batch_id AND b.tenant_id = e.tenant_id
        JOIN tenants tn ON tn.id = e.tenant_id
        WHERE tn.slug = ${tenant}
          AND (${bid} = '' OR b.bid = ${bid})
          AND (${uid} = '' OR e.uid_hex = ${uid})
          AND (${result} = '' OR UPPER(e.result) = ${result})
          AND (
            ${eventSource} = ''
            OR (${eventSource} = 'production' AND e.source::text IN ('real', 'imported'))
            OR e.source::text = ${eventSource}
          )
          AND (${country} = '' OR COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, '')) = ${country})
          AND e.created_at >= now() - ${rangeSql}::interval
        ORDER BY e.created_at DESC
        LIMIT ${safeLimit}
      `
      : await sql/*sql*/`
        SELECT e.id, e.tenant_id, e.batch_id, e.tag_id, e.result, e.reason, e.verdict, e.risk_level, e.event_type::text AS event_type, e.cmac_ok, e.allowlisted,
          (
            SELECT COUNT(DISTINCT actor_history.consumer_id)::int FROM consumer_tap_history actor_history
            WHERE actor_history.tenant_id = e.tenant_id AND actor_history.tap_event_id = e.id
              AND actor_history.consumer_id IS NOT NULL
          ) AS known_actor_count,
          EXISTS (
            SELECT 1 FROM consumer_tap_history actor_history
            WHERE actor_history.tenant_id = e.tenant_id AND actor_history.tap_event_id = e.id
              AND actor_history.consumer_id IS NOT NULL
          ) AS known_actor,
          COALESCE(ARRAY(
            SELECT DISTINCT CASE
              WHEN LOWER(consent.scope) IN ('whatsapp','whatsapp_marketing') THEN 'whatsapp'
              WHEN LOWER(consent.scope) = 'phone_marketing' THEN 'phone'
              WHEN LOWER(consent.scope) IN ('email','email_marketing') THEN 'email'
            END
            FROM consumer_tap_history cth
            JOIN consumer_tenant_consents consent ON consent.tenant_id = cth.tenant_id AND consent.consumer_id = cth.consumer_id
            WHERE cth.tenant_id = e.tenant_id AND cth.tap_event_id = e.id AND cth.consumer_id IS NOT NULL
              AND consent.granted = true AND consent.revoked_at IS NULL
              AND LOWER(consent.scope) IN ('whatsapp','whatsapp_marketing','phone_marketing','email','email_marketing')
          ), ARRAY[]::text[]) AS commercial_consent_channels,
          EXISTS (
            SELECT 1 FROM consumer_tap_history cth
            JOIN consumer_tenant_consents consent ON consent.tenant_id = cth.tenant_id AND consent.consumer_id = cth.consumer_id
            WHERE cth.tenant_id = e.tenant_id AND cth.tap_event_id = e.id AND cth.consumer_id IS NOT NULL
              AND consent.granted = true AND consent.revoked_at IS NULL
              AND LOWER(consent.scope) IN ('whatsapp','whatsapp_marketing','phone_marketing','email','email_marketing')
          ) AS commercial_consent_granted,
          e.uid_hex, e.created_at, e.city, e.country_code, e.lat, e.lng, e.read_counter, e.source, e.device_label, e.user_agent, e.meta, e.location_source, e.location_accuracy_m,
          COALESCE(NULLIF(e.product_name, ''), NULLIF(b.sdm_config->>'product_name', ''), NULLIF(b.sdm_config #>> '{sun,product,name}', ''), NULLIF(b.sdm_config->>'sku', ''), NULLIF(b.sdm_config #>> '{sun,product,sku}', '')) AS product_name,
          b.bid, tn.slug AS tenant_slug
        FROM events e
        JOIN batches b ON b.id = e.batch_id AND b.tenant_id = e.tenant_id
        JOIN tenants tn ON tn.id = e.tenant_id
        WHERE (${tenant} = '' OR tn.slug = ${tenant})
          AND (${bid} = '' OR b.bid = ${bid})
          AND (${uid} = '' OR e.uid_hex = ${uid})
          AND (${result} = '' OR UPPER(e.result) = ${result})
          AND (
            ${eventSource} = ''
            OR (${eventSource} = 'production' AND e.source::text IN ('real', 'imported'))
            OR e.source::text = ${eventSource}
          )
          AND (${country} = '' OR COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, '')) = ${country})
          AND e.created_at >= now() - ${rangeSql}::interval
        ORDER BY e.created_at DESC
        LIMIT ${safeLimit}
      `;
  }

  // Unbound scan attempts have no authoritative tenant identity. Keep them in
  // the global operations quarantine only; a BID prefix is never tenant proof.
  if (eventSource === "" && !tenant) {
    try {
      attemptRows = await sql/*sql*/`
        SELECT
          a.id, a.result, a.reason, NULL::text AS verdict, NULL::text AS risk_level, NULL::text AS event_type, NULL::text AS uid_hex, a.created_at, a.geo_city AS city, a.geo_country AS country_code, a.geo_lat AS lat, a.geo_lng AS lng,
          NULL::integer AS read_counter, a.source, NULL::text AS device_label, a.user_agent, a.meta, NULL::text AS location_source, NULL::double precision AS location_accuracy_m,
          NULL::text AS product_name,
          a.bid,
          'unassigned'::text AS tenant_slug
        FROM sun_scan_attempts a
        WHERE (${bid} = '' OR a.bid = ${bid})
          AND (${country} = '' OR COALESCE(NULLIF(a.geo_country, ''), '--') = ${country})
          AND a.created_at >= now() - ${rangeSql}::interval
        ORDER BY a.created_at DESC
        LIMIT ${safeLimit}
      `;
    } catch {
      attemptRows = [];
    }
  }

  const combinedRows = [...(rows as Array<Record<string, unknown>>), ...(attemptRows as Array<Record<string, unknown>>)]
    .sort((a, b) => new Date(String(b.created_at || "")).getTime() - new Date(String(a.created_at || "")).getTime())
    .slice(0, safeLimit);

  const normalized = combinedRows.map((row) => {
    const time = resolveEventLocalTime(row);
    const sunClient = (row.meta && typeof row.meta === "object"
      ? (row.meta as { sun_context?: { client?: Record<string, unknown> } }).sun_context?.client
      : null) || {};
    const platform = sunClient.platform ?? null;
    const browser = sunClient.browser ?? null;
    const timezone = sunClient.timezone ?? null;
    const mobile = sunClient.mobile ?? null;
    const rowSource = String(row.source || "real");
    const eventType = String(row.event_type || "");
    const isPhysicalTap = rowSource === "real" && ["TAP_VALID", "TAP_INVALID", "REPLAY_SUSPECT"].includes(eventType);
    const messageValid = isAuthenticatedNfcMessage({
      eventType: row.event_type,
      result: row.result,
      verdict: row.verdict,
      reason: row.reason,
      cmacOk: row.cmac_ok,
      allowlisted: row.allowlisted,
    });
    return {
      id: Number(row.id),
      tenantId: row.tenant_id ? String(row.tenant_id) : null,
      tenantSlug: String(row.tenant_slug || ""),
      batchId: row.batch_id ? String(row.batch_id) : null,
      tagId: row.tag_id ? String(row.tag_id) : null,
      bid: String(row.bid || ""),
      uidHex: String(row.uid_hex || ""),
      result: String(row.result || ""),
      verdict: String(row.verdict || ""),
      riskLevel: String(row.risk_level || ""),
      reason: String(row.reason || ""),
      productName: row.product_name ? String(row.product_name) : null,
      source: rowSource,
      eventType: eventType || null,
      cmacOk: row.cmac_ok === true ? true : row.cmac_ok === false ? false : null,
      allowlisted: row.allowlisted === true ? true : row.allowlisted === false ? false : null,
      knownActorCount: Math.max(0, Number(row.known_actor_count || 0)),
      knownActor: row.known_actor === true,
      commercialConsentChannels: Array.isArray(row.commercial_consent_channels)
        ? row.commercial_consent_channels.map((value) => String(value)).filter(Boolean)
        : [],
      commercialConsentGranted: row.known_actor === true && row.commercial_consent_granted === true,
      isPhysicalTap,
      dataMode: isPhysicalTap ? "physical_real" : rowSource === "real" ? "production_real" : rowSource === "demo" ? "demo" : "other",
      messageValid,
      sealState: classifyPhysicalTapSealState(row.result),
      readCounter: Number(row.read_counter || 0),
      createdAt: time.occurredAtUtc,
      createdAtUtc: time.occurredAtUtc,
      createdAtLocal: time.occurredAtLocal,
      timezone: time.timezone,
      timezoneLabel: time.timezoneLabel,
      timezoneOffset: time.timezoneOffset,
      location: {
        city: String(row.city || "Unknown"),
        country: String(row.country_code || "--"),
        lat: typeof row.lat === "number" ? Number(row.lat) : null,
        lng: typeof row.lng === "number" ? Number(row.lng) : null,
        source: row.location_source ? String(row.location_source) : null,
        accuracyM: typeof row.location_accuracy_m === "number" ? Number(row.location_accuracy_m) : null,
      },
      device: {
        label: String(row.device_label || "Unknown"),
        os: normalizeOs({ platform, userAgent: row.user_agent, deviceLabel: row.device_label }),
        browser: normalizeBrowser({ browser, userAgent: row.user_agent, platform, mobile }),
        deviceType: normalizeDeviceType({ mobile, userAgent: row.user_agent, platform, deviceLabel: row.device_label }),
        timezone: normalizeTimezone(timezone),
        mobile: Boolean(mobile === true || String(mobile).toLowerCase() === "true"),
      },
      meta: row.meta && typeof row.meta === "object" ? row.meta : {},
    };
  });

  return json({
    scope: { tenant: tenant || "global", source: eventSource || "all", range, country: country || "all", limit: safeLimit },
    rows: normalized,
  });
}
