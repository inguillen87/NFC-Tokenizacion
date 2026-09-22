import { sql } from './db';
import { verifySunFreshHandoffToken } from './sun-fresh-handoff';
import { createPublicCertificateShareToken } from './public-certificate-share';
import { normalizeCoordinatePair, redactSensitiveQueryValues, sanitizePublicLocationProjection } from './approximate-location';
import { buildSunSensorEvidence, declaredStaticSensorFromLocaleData } from './sun-sensor-evidence';
import { resolvePublicLotLabel } from './public-lot-label';
import { readCurrentPassportEditorial } from './current-passport-editorial';

export type SunDiagnosticTool = 'sun_scan' | 'inspect' | 'compare_tamper' | 'compare_tamper_samples';

let ensured = false;

async function ensureTable() {
  if (ensured) return;
  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS sun_diagnostics (
      id bigserial PRIMARY KEY,
      trace_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      tool_type text NOT NULL,
      bid text,
      uid_hex text,
      uid_masked text,
      read_counter integer,
      auth_status text,
      replay_status text,
      product_state text,
      tamper_status text,
      tamper_signal text,
      tamper_opened boolean,
      tamper_risk boolean,
      tagtamper_config_detected boolean,
      enc_plain_status_byte text,
      closed_url text,
      opened_url text,
      request_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      notes jsonb NOT NULL DEFAULT '[]'::jsonb
    )
  `;
  ensured = true;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function uniqueStrings(value: unknown, extra: string[] = []) {
  const items = Array.isArray(value) ? value : [];
  return Array.from(new Set([...items.filter((item): item is string => typeof item === "string" && item.trim().length > 0), ...extra]));
}

function cloneRecord(value: unknown): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(value || {})) as Record<string, unknown>;
  } catch {
    return { ...asRecord(value) };
  }
}

type CurrentSnapshotIdentity = {
  bid?: string | null;
  uid_hex?: string | null;
  uid_masked?: string | null;
  tenant_id?: string | null;
  tenant_slug?: string | null;
  tenant_name?: string | null;
  tenant_vertical?: string | null;
  product_label?: string | null;
  club_name?: string | null;
  public_lot_label?: string | null;
  product_name?: string | null;
  sku?: string | null;
  winery?: string | null;
  region?: string | null;
  grape_varietal?: string | null;
  vintage?: string | null;
  harvest_year?: number | null;
  barrel_months?: number | null;
  temperature_storage?: string | null;
  alcohol?: string | null;
  bottle?: string | null;
  serving?: string | null;
  oak_type?: string | null;
  image_url?: string | null;
  locale_data?: Record<string, unknown> | null;
  origin_label?: string | null;
  origin_address?: string | null;
  origin_lat?: number | null;
  origin_lng?: number | null;
  tag_profile_vertical?: string | null;
  tag_profile_conflict?: boolean | null;
  product_identity_source?: string | null;
};

function textOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const normalized = textOrNull(value);
    if (normalized) return normalized;
  }
  return null;
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function maskUid(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.length <= 6) return `${raw.slice(0, 1)}***${raw.slice(-1)}`;
  return `${raw.slice(0, 4)}****${raw.slice(-2)}`;
}

function mediaFromLocaleData(localeData: unknown, imageUrl?: string | null) {
  const data = asRecord(localeData);
  const media = asRecord(data.media);
  const image = textOrNull(media.imageUrl)
    || textOrNull(media.image_url)
    || textOrNull(media.hero)
    || textOrNull(media.packshot)
    || textOrNull(imageUrl);
  if (!image && Object.keys(media).length === 0) return null;
  return {
    ...media,
    imageUrl: image,
    hero: textOrNull(media.hero) || image,
    packshot: textOrNull(media.packshot) || image,
  };
}

async function resolveCurrentSnapshotIdentity(meta: { bid?: string | null; uidHex?: string | null; uidMasked?: string | null }): Promise<CurrentSnapshotIdentity | null> {
  const bid = textOrNull(meta.bid);
  const uidHex = textOrNull(meta.uidHex)?.toUpperCase();
  if (!bid || !uidHex) return null;

  try {
    const rows = await sql/*sql*/`
      WITH base AS (
        SELECT
          b.bid,
          t.uid_hex,
          tn.id::text AS tenant_id,
          tn.slug AS tenant_slug,
          tn.name AS tenant_name,
          tsp.vertical AS tenant_vertical,
          tsp.product_label,
          tsp.club_name,
          b.sdm_config AS batch_config,
          tp.product_name AS tp_product_name,
          tp.sku AS tp_sku,
          tp.winery AS tp_winery,
          tp.region AS tp_region,
          tp.grape_varietal AS tp_grape_varietal,
          tp.vintage AS tp_vintage,
          tp.harvest_year AS tp_harvest_year,
          tp.barrel_months AS tp_barrel_months,
          tp.temperature_storage AS tp_temperature_storage,
          tp.image_url AS tp_image_url,
          tp.locale_data AS tp_locale_data,
          COALESCE(
            NULLIF(tp.locale_data #>> '{es-AR,vertical}', ''),
            NULLIF(tp.locale_data #>> '{en,vertical}', ''),
            NULLIF(tp.locale_data #>> '{pt-BR,vertical}', ''),
            NULLIF(tp.locale_data->>'vertical', '')
          ) AS tag_profile_vertical,
          tsp.origin_label AS profile_origin_label,
          tsp.origin_address AS profile_origin_address,
          tsp.origin_lat AS profile_origin_lat,
          tsp.origin_lng AS profile_origin_lng
        FROM tags t
        JOIN batches b ON b.id = t.batch_id
        JOIN tenants tn ON tn.id = b.tenant_id
        LEFT JOIN tenant_sun_profiles tsp ON tsp.tenant_id = b.tenant_id
        LEFT JOIN tag_profiles tp ON tp.tag_id = t.id
        WHERE b.bid = ${bid}
          AND UPPER(t.uid_hex) = UPPER(${uidHex})
        LIMIT 1
      ),
      normalized AS (
        SELECT
          *,
          (
            tag_profile_vertical IS NULL
            OR tenant_vertical IS NULL
            OR lower(tag_profile_vertical) = lower(tenant_vertical)
          ) AS tag_profile_allowed
        FROM base
      )
      SELECT
        bid,
        uid_hex,
        tenant_id,
        tenant_slug,
        tenant_name,
        tenant_vertical,
        product_label,
        club_name,
        COALESCE(
          NULLIF(btrim(batch_config->>'public_lot_label'), ''),
          NULLIF(btrim(batch_config->>'lot'), ''),
          NULLIF(btrim(batch_config->>'batch_lot'), ''),
          NULLIF(btrim(batch_config->>'lot_number'), '')
        ) AS public_lot_label,
        COALESCE(CASE WHEN tag_profile_allowed THEN NULLIF(tp_product_name, '') END, NULLIF(batch_config->>'product_name', ''), NULLIF(batch_config #>> '{sun,product,name}', '')) AS product_name,
        COALESCE(CASE WHEN tag_profile_allowed THEN NULLIF(tp_sku, '') END, NULLIF(batch_config->>'sku', ''), NULLIF(batch_config #>> '{sun,product,sku}', '')) AS sku,
        COALESCE(CASE WHEN tag_profile_allowed THEN NULLIF(tp_winery, '') END, NULLIF(batch_config->>'winery', ''), NULLIF(batch_config #>> '{sun,product,producer}', ''), tenant_name) AS winery,
        COALESCE(CASE WHEN tag_profile_allowed THEN NULLIF(tp_region, '') END, NULLIF(batch_config->>'region', ''), NULLIF(batch_config #>> '{sun,origin,region}', ''), NULLIF(profile_origin_label, '')) AS region,
        COALESCE(CASE WHEN tag_profile_allowed THEN NULLIF(tp_grape_varietal, '') END, NULLIF(batch_config->>'grape_varietal', ''), NULLIF(batch_config #>> '{sun,product,varietal}', '')) AS grape_varietal,
        COALESCE(CASE WHEN tag_profile_allowed THEN NULLIF(tp_vintage, '') END, NULLIF(batch_config->>'vintage', ''), NULLIF(batch_config #>> '{sun,product,vintage}', '')) AS vintage,
        COALESCE(CASE WHEN tag_profile_allowed THEN tp_harvest_year END, (NULLIF(batch_config->>'harvest_year', ''))::integer, (NULLIF(batch_config #>> '{sun,product,harvestYear}', ''))::integer) AS harvest_year,
        COALESCE(CASE WHEN tag_profile_allowed THEN tp_barrel_months END, (NULLIF(batch_config->>'barrel_months', ''))::integer, (NULLIF(batch_config #>> '{sun,product,barrelMonths}', ''))::integer) AS barrel_months,
        COALESCE(CASE WHEN tag_profile_allowed THEN NULLIF(tp_temperature_storage, '') END, NULLIF(batch_config->>'temperature_storage', ''), NULLIF(batch_config #>> '{sun,product,storage}', '')) AS temperature_storage,
        COALESCE(NULLIF(batch_config #>> '{sun,product,alcohol}', ''), NULLIF(batch_config->>'alcohol', '')) AS alcohol,
        COALESCE(NULLIF(batch_config #>> '{sun,product,bottle}', ''), NULLIF(batch_config->>'bottle', '')) AS bottle,
        COALESCE(NULLIF(batch_config #>> '{sun,product,serving}', ''), NULLIF(batch_config->>'serving', '')) AS serving,
        COALESCE(NULLIF(batch_config #>> '{sun,product,oakType}', ''), NULLIF(batch_config->>'oak_type', '')) AS oak_type,
        COALESCE(CASE WHEN tag_profile_allowed THEN NULLIF(tp_image_url, '') END, NULLIF(batch_config->>'image_url', ''), NULLIF(batch_config #>> '{sun,product,imageUrl}', '')) AS image_url,
        CASE WHEN tag_profile_allowed THEN tp_locale_data ELSE NULL END AS locale_data,
        COALESCE(NULLIF(profile_origin_label, ''), NULLIF(batch_config #>> '{sun,origin,label}', ''), NULLIF(batch_config #>> '{sun,origin,region}', '')) AS origin_label,
        COALESCE(NULLIF(profile_origin_address, ''), NULLIF(batch_config #>> '{sun,origin,address}', '')) AS origin_address,
        COALESCE(profile_origin_lat, (NULLIF(batch_config #>> '{sun,origin,lat}', ''))::double precision) AS origin_lat,
        COALESCE(profile_origin_lng, (NULLIF(batch_config #>> '{sun,origin,lng}', ''))::double precision) AS origin_lng,
        tag_profile_vertical,
        (NOT tag_profile_allowed AND tag_profile_vertical IS NOT NULL) AS tag_profile_conflict,
        CASE
          WHEN tag_profile_allowed AND (NULLIF(tp_product_name, '') IS NOT NULL OR NULLIF(tp_sku, '') IS NOT NULL) THEN 'tag_profile'
          WHEN NULLIF(batch_config->>'product_name', '') IS NOT NULL OR NULLIF(batch_config #>> '{sun,product,name}', '') IS NOT NULL THEN 'batch'
          ELSE 'tenant'
        END AS product_identity_source
      FROM normalized
    `;
    const row = rows[0] as CurrentSnapshotIdentity | undefined;
    if (!row) return null;
    return {
      ...row,
      uid_masked: meta.uidMasked || maskUid(row.uid_hex),
    };
  } catch (error) {
    console.warn("[snapshot_identity_lookup_failed]", JSON.stringify({
      bid,
      uidMasked: meta.uidMasked || maskUid(uidHex),
      reason: error instanceof Error ? error.message : "identity_lookup_failed",
    }));
    return null;
  }
}

function normalizeSnapshotContractFromCurrentIdentity(input: unknown, currentIdentity: CurrentSnapshotIdentity | null) {
  const contract = cloneRecord(input);
  if (!currentIdentity) return contract;

  const tenant = asRecord(contract.tenant);
  const provenance = asRecord(contract.provenance);
  const iot = asRecord(contract.iot);
  const identity = asRecord(contract.identity);
  const product = asRecord(contract.product);
  const publicLotLabel = resolvePublicLotLabel({ public_lot_label: currentIdentity.public_lot_label });
  const productName = textOrNull(currentIdentity.product_name);
  const winery = textOrNull(currentIdentity.winery || currentIdentity.tenant_name);
  const region = textOrNull(currentIdentity.region || currentIdentity.origin_label);
  const productMedia = mediaFromLocaleData(currentIdentity.locale_data, currentIdentity.image_url);
  const declaredStaticSensor = declaredStaticSensorFromLocaleData(currentIdentity.locale_data);
  const declaredStaticEvidence = buildSunSensorEvidence({
    timeline: [],
    declaredStatic: declaredStaticSensor,
    barrelMonths: currentIdentity.barrel_months ?? null,
    allowSimulation: false,
  });
  const existingSensorEvidenceKind = String(iot.sensorEvidenceKind || "none");
  const applyDeclaredStatic = declaredStaticEvidence.kind === "declared_static"
    && existingSensorEvidenceKind !== "reported";

  contract.identity = {
    ...identity,
    bid: currentIdentity.bid || identity.bid || contract.batchId || null,
    tenantSlug: currentIdentity.tenant_slug || identity.tenantSlug || null,
    tenantId: currentIdentity.tenant_id || identity.tenantId || null,
    uidMasked: identity.uidMasked || currentIdentity.uid_masked || contract.uidMasked || null,
    displayLot: publicLotLabel || textOrNull(identity.displayLot) || null,
  };
  contract.tenant = {
    ...tenant,
    id: currentIdentity.tenant_id || tenant.id || null,
    slug: currentIdentity.tenant_slug || tenant.slug || null,
    name: currentIdentity.tenant_name || tenant.name || null,
    vertical: currentIdentity.tenant_vertical || tenant.vertical || null,
    productLabel: currentIdentity.product_label || tenant.productLabel || null,
    clubName: currentIdentity.club_name || tenant.clubName || null,
  };
  contract.product = {
    ...product,
    name: productName || currentIdentity.sku || "Producto asociado",
    lotLabel: publicLotLabel || textOrNull(product.lotLabel) || null,
    sku: currentIdentity.sku || null,
    winery: winery || null,
    region: region || null,
    varietal: currentIdentity.grape_varietal || null,
    vintage: currentIdentity.vintage || null,
    harvestYear: currentIdentity.harvest_year ?? null,
    barrelMonths: currentIdentity.barrel_months ?? null,
    storage: currentIdentity.temperature_storage || null,
    alcohol: currentIdentity.alcohol || null,
    bottle: currentIdentity.bottle || null,
    serving: currentIdentity.serving || null,
    oakType: currentIdentity.oak_type || null,
    imageUrl: currentIdentity.image_url || null,
    image_url: currentIdentity.image_url || null,
    media: productMedia,
    category: currentIdentity.product_label || null,
    vertical: currentIdentity.tenant_vertical || null,
  };
  contract.provenance = {
    ...provenance,
    origin: region || provenance.origin || null,
  };
  contract.iot = {
    ...iot,
    wineryLocation: currentIdentity.origin_address || iot.wineryLocation || winery || null,
    wineryCoordinates: asRecord(iot.wineryCoordinates).lat != null
      ? iot.wineryCoordinates
      : currentIdentity.origin_lat != null && currentIdentity.origin_lng != null
        ? { lat: currentIdentity.origin_lat, lng: currentIdentity.origin_lng }
        : iot.wineryCoordinates || null,
    originLabel: currentIdentity.origin_label || region || iot.originLabel || null,
    originType: currentIdentity.tenant_vertical || iot.originType || null,
    sensorEvidenceKind: applyDeclaredStatic ? "declared_static" : iot.sensorEvidenceKind || "none",
    sensorSnapshot: applyDeclaredStatic ? declaredStaticEvidence.snapshot : iot.sensorSnapshot || null,
    sensorHistory: applyDeclaredStatic ? declaredStaticEvidence.history : iot.sensorHistory || null,
    declaredStatic: declaredStaticEvidence.declaredStatic || iot.declaredStatic || null,
    // Only the allow-listed public projection is exposed. The arbitrary raw
    // sensor_json object remains private in the imported manifest.
    manifestTelemetry: declaredStaticEvidence.declaredStatic || null,
  };
  contract.productName = productName || currentIdentity.sku || null;
  contract.tenantSlug = currentIdentity.tenant_slug || contract.tenantSlug || null;
  contract.batchId = currentIdentity.bid || contract.batchId || null;
  contract.troubleshooting = uniqueStrings(contract.troubleshooting, [
    "Snapshot sincronizado contra la identidad actual del tenant/batch/UID en base de datos.",
    ...(currentIdentity.tag_profile_conflict
      ? [`Override unitario bloqueado: vertical ${currentIdentity.tag_profile_vertical || "desconocida"} no coincide con tenant ${currentIdentity.tenant_vertical || "sin vertical"}.`]
      : []),
  ]);
  contract.dataQuality = {
    ...asRecord(contract.dataQuality),
    productIdentitySource: currentIdentity.product_identity_source || "unknown",
    tagProfileConflict: Boolean(currentIdentity.tag_profile_conflict),
  };

  return contract;
}

function sanitizeSnapshotPublicCoordinates(input: unknown) {
  const contract = cloneRecord(input);
  const provenance = asRecord(contract.provenance);
  const timeline = Array.isArray(provenance.timelineSummary)
    ? provenance.timelineSummary.map((value) => {
        const event = asRecord(value);
        const location = sanitizePublicLocationProjection({
          lat: event.lat,
          lng: event.lng,
          locationSource: event.locationSource ?? event.location_source,
          geoPrecision: event.geoPrecision ?? event.geo_precision,
          locationAccuracyM: event.locationAccuracyM ?? event.location_accuracy_m,
          metadata: event.locationEvidence ?? event.meta,
        });
        return {
          ...event,
          lat: location.lat,
          lng: location.lng,
        };
      })
    : provenance.timelineSummary;
  contract.provenance = {
    ...provenance,
    timelineSummary: timeline,
  };

  const tapContext = asRecord(contract.tapContext);
  const tapLocation = sanitizePublicLocationProjection({
    lat: tapContext.lat,
    lng: tapContext.lng,
    locationSource: tapContext.locationSource ?? tapContext.location_source,
    geoPrecision: tapContext.geoPrecision ?? tapContext.geo_precision,
    locationAccuracyM: tapContext.accuracyM ?? tapContext.location_accuracy_m,
    metadata: tapContext.locationEvidence ?? tapContext.meta,
  });
  contract.tapContext = {
    ...tapContext,
    lat: tapLocation.lat,
    lng: tapLocation.lng,
  };
  return contract;
}

export type CurrentSnapshotTapLocation = {
  eventId: string;
  at: string | null;
  result: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  source: string | null;
  precision: string | null;
  accuracyM: number | null;
  consent: boolean | null;
  metadata?: unknown;
};

const HISTORICAL_TAP_CONTEXT_KEYS = new Set([
  "accuracym",
  "browserlocationobservation",
  "city",
  "coordinates",
  "country",
  "countrycode",
  "ctr",
  "device",
  "deviceid",
  "eventid",
  "geo",
  "geolat",
  "geolng",
  "geoprecision",
  "geo_precision",
  "lat",
  "latitude",
  "lng",
  "location",
  "location_accuracy_m",
  "location_source",
  "locationaccuracym",
  "locationevidence",
  "locationsource",
  "longitude",
  "meta",
  "readcounter",
  "uid",
  "uidhex",
  "uidmasked",
  "utctime",
]);

function withoutHistoricalTapContext(value: unknown) {
  return Object.fromEntries(
    Object.entries(asRecord(value)).filter(([key]) => !HISTORICAL_TAP_CONTEXT_KEYS.has(key.toLowerCase())),
  );
}

async function resolveCurrentSnapshotTapLocation(input: {
  eventId: string;
  bid?: string | null;
  uidHex?: string | null;
}): Promise<CurrentSnapshotTapLocation | null> {
  const eventId = String(input.eventId || "").trim();
  const bid = textOrNull(input.bid);
  const uidHex = textOrNull(input.uidHex)?.toUpperCase();
  if (!/^\d+$/.test(eventId) || !bid || !uidHex) return null;

  try {
    const rows = await sql/*sql*/`
      SELECT
        event.id::text AS event_id,
        event.created_at::text AS at,
        event.result,
        event.city,
        event.country_code AS country,
        event.lat,
        event.lng,
        event.meta,
        to_jsonb(event)->>'location_source' AS location_source,
        to_jsonb(event)->>'geo_precision' AS geo_precision,
        to_jsonb(event)->>'location_accuracy_m' AS location_accuracy_m,
        to_jsonb(event)->'post_tap_location_observation' AS post_tap_location_observation
      FROM events event
      WHERE event.id = ${eventId}::bigint
        AND UPPER(COALESCE(event.bid, '')) = UPPER(${bid})
        AND UPPER(COALESCE(event.uid_hex, '')) = ${uidHex}
      LIMIT 1
    `;
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;

    const meta = asRecord(row.meta);
    const sunContext = asRecord(meta.sun_context);
    const tapRequestLocation = asRecord(sunContext.tap_request_location);
    const sunGeo = asRecord(sunContext.geo);
    const geoEvidence = asRecord(meta.geo_evidence);
    const observation = asRecord(row.post_tap_location_observation);
    const observationSource = firstText(observation.source);
    const observationPrecision = firstText(observation.precision);
    const hasConsentedBrowserObservation = [
      "browser_geolocation_approximate_consent",
      "browser_gps_approximate_consent",
    ].includes(String(observationSource || "").toLowerCase())
      && observation.consent === true
      && observationPrecision?.toLowerCase() === "approximate";

    if (hasConsentedBrowserObservation) {
      const coordinate = normalizeCoordinatePair(observation.lat, observation.lng);
      const accuracy = numberOrNull(observation.accuracyM ?? observation.accuracy_m ?? observation.accuracy);
      const evidence = {
        source: observationSource,
        consent: true,
        precision: observationPrecision,
        accuracyM: accuracy,
      };
      return {
        eventId: String(row.event_id || eventId),
        at: textOrNull(row.at),
        result: textOrNull(row.result),
        city: firstText(observation.city),
        country: firstText(observation.countryCode, observation.country_code, observation.country),
        lat: coordinate?.lat ?? null,
        lng: coordinate?.lng ?? null,
        source: observationSource,
        precision: observationPrecision,
        accuracyM: accuracy !== null && accuracy > 0 ? accuracy : null,
        consent: true,
        metadata: { sun_context: { geo: evidence } },
      };
    }

    const coordinate = normalizeCoordinatePair(row.lat, row.lng);
    const source = firstText(
      row.location_source,
      tapRequestLocation.source,
      sunGeo.source,
      geoEvidence.source,
    );
    const precision = firstText(
      row.geo_precision,
      tapRequestLocation.precision,
      sunGeo.precision,
      geoEvidence.precision,
    );
    const accuracy = numberOrNull(
      row.location_accuracy_m
        ?? tapRequestLocation.accuracyM
        ?? tapRequestLocation.accuracy_m
        ?? sunGeo.accuracyM
        ?? sunGeo.accuracy_m
        ?? sunGeo.accuracy
        ?? geoEvidence.accuracyM
        ?? geoEvidence.accuracy_m,
    );
    return {
      eventId: String(row.event_id || eventId),
      at: textOrNull(row.at),
      result: textOrNull(row.result),
      city: textOrNull(row.city),
      country: textOrNull(row.country),
      lat: coordinate?.lat ?? null,
      lng: coordinate?.lng ?? null,
      source,
      precision,
      accuracyM: accuracy !== null && accuracy > 0 ? accuracy : null,
      consent: null,
      metadata: meta,
    };
  } catch (error) {
    console.warn("[snapshot_tap_location_lookup_failed]", JSON.stringify({
      eventId,
      bid,
      uidMasked: maskUid(uidHex),
      reason: error instanceof Error ? error.message : "tap_location_lookup_failed",
    }));
    return null;
  }
}

export function normalizeSnapshotContractFromCurrentTap(input: unknown, tap: CurrentSnapshotTapLocation | null) {
  const contract = cloneRecord(input);
  const cleanTapContext = withoutHistoricalTapContext(contract.tapContext);
  const provenance = asRecord(contract.provenance);

  if (!tap) {
    contract.tapContext = {
      ...cleanTapContext,
      city: null,
      country: null,
      lat: null,
      lng: null,
      locationSource: "none",
      geoPrecision: null,
      accuracyM: null,
      utcTime: null,
      browserLocationObservation: null,
    };
    contract.provenance = {
      ...provenance,
      lastVerifiedLocation: {
        at: null,
        city: null,
        country: null,
        result: null,
      },
      timelineSummary: [],
    };
    return contract;
  }

  const source = textOrNull(tap.source);
  const precision = textOrNull(tap.precision);
  const accuracy = numberOrNull(tap.accuracyM);
  const locationMetadata = tap.metadata ?? {
    sun_context: {
      geo: {
        source,
        consent: tap.consent === true,
        precision,
        accuracyM: accuracy,
      },
    },
  };
  const publicLocation = sanitizePublicLocationProjection({
    lat: tap.lat,
    lng: tap.lng,
    locationSource: source,
    geoPrecision: precision,
    locationAccuracyM: accuracy,
    metadata: locationMetadata,
  });
  const isBrowserSource = [
    "browser_geolocation_approximate_consent",
    "browser_gps_approximate_consent",
  ].includes(String(source || "").toLowerCase());
  const hasPublicCoordinate = publicLocation.lat !== null && publicLocation.lng !== null;
  const city = isBrowserSource && !hasPublicCoordinate ? null : textOrNull(tap.city);
  const country = isBrowserSource && !hasPublicCoordinate ? null : textOrNull(tap.country);
  const publicAccuracy = hasPublicCoordinate && accuracy !== null && accuracy > 0 ? accuracy : null;
  const browserLocationObservation = isBrowserSource
    ? {
        source,
        consent: tap.consent === true,
        precision,
        normalization: "rounded_2_decimals_public_min_150m",
        city,
        countryCode: country,
        lat: publicLocation.lat,
        lng: publicLocation.lng,
        accuracyM: publicAccuracy,
        eventOccurredAt: tap.at,
      }
    : null;
  const currentTimelineEvent = {
    eventId: tap.eventId,
    at: tap.at,
    result: tap.result,
    city,
    country,
    lat: publicLocation.lat,
    lng: publicLocation.lng,
    locationSource: source || "none",
    geoPrecision: precision,
    accuracyM: publicAccuracy,
  };

  contract.tapContext = {
    ...cleanTapContext,
    city,
    country,
    lat: publicLocation.lat,
    lng: publicLocation.lng,
    locationSource: source || "none",
    geoPrecision: precision,
    accuracyM: publicAccuracy,
    utcTime: tap.at,
    browserLocationObservation,
  };
  contract.provenance = {
    ...provenance,
    lastVerifiedLocation: {
      at: tap.at,
      city,
      country,
      result: tap.result,
    },
    // A snapshot may describe the event bound to its diagnostic, but it must
    // never replay another consumer tap's identity, device, or coordinates.
    timelineSummary: [currentTimelineEvent],
  };
  return contract;
}

function markHistoricalSnapshotContract(input: unknown, snapshot: { id: number; traceId: string; createdAt: string | null }) {
  const contract = cloneRecord(input);
  const tapSecurity = asRecord(contract.tapSecurity);
  const status = asRecord(contract.status);
  const isSunProfileMismatch =
    String(status.code || "").toUpperCase() === "SUN_PROFILE_MISMATCH" ||
    String(tapSecurity.conditionState || "") === "sun_profile_mismatch" ||
    String(tapSecurity.actionability || "") === "blocked_sun_profile_mismatch";
  contract.tapSecurity = {
    ...tapSecurity,
    snapshot: true,
    freshTap: false,
    actionability: isSunProfileMismatch ? "blocked_sun_profile_mismatch" : "view_only",
    policy: "snapshot_view_only",
    tokenizationEligible: false,
    requiresFreshTapForCommercialActions: true,
    reason: isSunProfileMismatch
      ? String(tapSecurity.reason || status.reason || "sun_profile_mismatch")
      : "historical_snapshot_requires_fresh_tap",
  };
  contract.snapshot = {
    mode: "historical",
    diagnosticId: snapshot.id,
    traceId: snapshot.traceId,
    createdAt: snapshot.createdAt,
    requiresFreshTap: true,
    commercialActions: "blocked_until_new_physical_tap",
  };
  contract.allowedActions = uniqueStrings(contract.allowedActions, isSunProfileMismatch ? ["provenance", "report"] : []).filter((action) => action === "provenance" || action === "report");
  contract.blockedActions = uniqueStrings(contract.blockedActions, ["claim", "save", "join", "warranty", "rewards", "tokenization"]);

  const summary = String(status.summary || "Mensaje NFC disponible en modo consulta; sin veredicto sobre el producto fisico.");
  contract.status = {
    ...status,
    snapshot: true,
    actionability: "view_only",
    reason: status.reason || "historical_snapshot",
    summary: `${summary} Vista historica: ownership, club, rewards y tokenizacion requieren un nuevo tap fisico.`,
  };

  const tokenization = asRecord(contract.tokenization);
  contract.tokenization = {
    ...tokenization,
    status: String(tokenization.status || "").startsWith("minted") ? tokenization.status : "blocked_snapshot",
  };

  const troubleshooting = uniqueStrings(contract.troubleshooting, [
    "Vista historica: no usar este snapshot para ownership, rewards, garantia o tokenizacion. Escanea fisicamente la etiqueta para generar un tap fresco.",
  ]);
  contract.troubleshooting = troubleshooting;
  return contract;
}

function markFreshHandoffContract(input: unknown, snapshot: { id: number; traceId: string; createdAt: string | null; expiresAt: string | null }) {
  const contract = cloneRecord(input);
  const tapSecurity = asRecord(contract.tapSecurity);
  contract.tapSecurity = {
    ...tapSecurity,
    snapshot: true,
    freshTap: true,
    actionability: "fresh_handoff",
    requiresFreshTapForCommercialActions: false,
    reason: tapSecurity.reason || "fresh_nfc_handoff",
  };
  contract.snapshot = {
    mode: "fresh_handoff",
    diagnosticId: snapshot.id,
    traceId: snapshot.traceId,
    createdAt: snapshot.createdAt,
    expiresAt: snapshot.expiresAt,
    requiresFreshTap: false,
    commercialActions: "allowed_while_handoff_is_fresh",
  };

  const status = asRecord(contract.status);
  contract.status = {
    ...status,
    snapshot: true,
    actionability: "fresh_handoff",
    reason: status.reason || "fresh_nfc_handoff",
  };
  return contract;
}

function isSunProfileMismatchReason(value: unknown) {
  const reason = String(value || "").toLowerCase();
  return (
    reason.includes("uid length invalid") ||
    reason.includes("cmac mismatch") ||
    reason.includes("picc_data bad length") ||
    reason.includes("invalid_sun_payload") ||
    reason.includes("sun_crypto_failed") ||
    reason.includes("crypto_decode_failed")
  );
}

function normalizeSunProfileMismatchContract(input: unknown) {
  const contract = cloneRecord(input);
  const status = asRecord(contract.status);
  const tapSecurity = asRecord(contract.tapSecurity);
  const reason = status.reason || tapSecurity.reason || contract.reason;

  if (!isSunProfileMismatchReason(reason)) return contract;

  contract.status = {
    ...status,
    code: "SUN_PROFILE_MISMATCH",
    tone: "warn",
    label: "Perfil SUN del lote no coincide",
    reason,
    summary: "El batch existe, pero la lectura SUN no descifra a un UID autorizado con las claves o layout cargados.",
  };
  contract.tapSecurity = {
    ...tapSecurity,
    conditionState: "sun_profile_mismatch",
    actionability: "blocked_sun_profile_mismatch",
    tokenizationEligible: false,
    requiresFreshTapForCommercialActions: true,
    reason,
  };
  contract.troubleshooting = uniqueStrings(contract.troubleshooting, [
    "El BID resuelve tenant y batch, pero el payload SUN no descifra a un UID autorizado.",
    "Revisar K_META/K_FILE, perfil SDM/PICC, longitud UID y orden de campos contra el proveedor.",
    "No habilitar ownership, garantia ni NFT hasta que el UID coincida con el manifest o se registre el payload SUN autorizado.",
  ]);
  contract.allowedActions = uniqueStrings(contract.allowedActions).filter((action) => action === "provenance" || action === "report");
  contract.blockedActions = uniqueStrings(contract.blockedActions, ["claim", "save", "join", "warranty", "rewards", "tokenization"]);

  return contract;
}

function withContractSummaryFields(input: unknown) {
  const contract = cloneRecord(input);
  const status = asRecord(contract.status);
  const tapSecurity = asRecord(contract.tapSecurity);

  const statusCode = String(status.code || contract.statusCode || "").trim();
  const statusLabel = String(status.label || contract.statusLabel || "").trim();
  const reason = String(tapSecurity.reason || status.reason || contract.reason || "").trim();
  const actionability = String(tapSecurity.actionability || status.actionability || contract.actionability || "").trim();

  contract.statusCode = statusCode || null;
  contract.statusLabel = statusLabel || null;
  contract.reason = reason || null;
  contract.actionability = actionability || null;
  contract.tokenizationEligible =
    typeof tapSecurity.tokenizationEligible === "boolean"
      ? tapSecurity.tokenizationEligible
      : Boolean(contract.tokenizationEligible);

  return contract;
}

export async function insertSunDiagnostic(input: {
  trace_id?: string | null;
  tool_type: SunDiagnosticTool;
  bid?: string | null;
  uid_hex?: string | null;
  uid_masked?: string | null;
  read_counter?: number | null;
  auth_status?: string | null;
  replay_status?: string | null;
  product_state?: string | null;
  tamper_status?: string | null;
  tamper_signal?: string | null;
  tamper_opened?: boolean | null;
  tamper_risk?: boolean | null;
  tagtamper_config_detected?: boolean | null;
  enc_plain_status_byte?: string | null;
  closed_url?: string | null;
  opened_url?: string | null;
  request_json?: unknown;
  result_json?: unknown;
  notes?: unknown;
}) {
  try {
    await ensureTable();
    const persistedRequestJson = input.request_json && typeof input.request_json === "object" && !Array.isArray(input.request_json)
      ? redactSensitiveQueryValues(input.request_json as Record<string, unknown>)
      : input.request_json;
    const rows = await sql/*sql*/`
      INSERT INTO sun_diagnostics (
        trace_id, tool_type, bid, uid_hex, uid_masked, read_counter, auth_status, replay_status,
        product_state, tamper_status, tamper_signal, tamper_opened, tamper_risk,
        tagtamper_config_detected, enc_plain_status_byte, closed_url, opened_url,
        request_json, result_json, notes
      ) VALUES (
        ${input.trace_id || null}, ${input.tool_type}, ${input.bid || null}, ${input.uid_hex || null}, ${input.uid_masked || null}, ${input.read_counter ?? null}, ${input.auth_status || null}, ${input.replay_status || null},
        ${input.product_state || null}, ${input.tamper_status || null}, ${input.tamper_signal || null}, ${typeof input.tamper_opened === 'boolean' ? input.tamper_opened : null}, ${typeof input.tamper_risk === 'boolean' ? input.tamper_risk : null},
        ${typeof input.tagtamper_config_detected === 'boolean' ? input.tagtamper_config_detected : null}, ${input.enc_plain_status_byte || null}, ${input.closed_url || null}, ${input.opened_url || null},
        ${JSON.stringify(persistedRequestJson || {})}::jsonb, ${JSON.stringify(input.result_json || {})}::jsonb, ${JSON.stringify(input.notes || [])}::jsonb
      )
      RETURNING id
    `;
    return Number(rows?.[0]?.id || 0) || null;
  } catch {
    return null;
  }
}

export async function listSunDiagnostics(limit = 100) {
  await ensureTable();
  return sql/*sql*/`
    SELECT *
    FROM sun_diagnostics
    ORDER BY created_at DESC
    LIMIT ${Math.max(1, Math.min(limit, 500))}
  `;
}

export async function getSunDiagnosticSnapshot(id: string | number, traceId: string, freshToken?: string | null) {
  const numericId = Number(id);
  const trace = String(traceId || "").trim();
  if (!Number.isFinite(numericId) || numericId <= 0 || !trace) return null;

  await ensureTable();
  const rows = await sql/*sql*/`
    SELECT id, trace_id, created_at::text AS created_at, bid, uid_hex, uid_masked, result_json
    FROM sun_diagnostics
    WHERE id = ${numericId}
      AND trace_id = ${trace}
      AND tool_type = 'sun_scan'
    LIMIT 1
  `;
  const row = rows[0] as { id?: number; trace_id?: string | null; created_at?: string | null; bid?: string | null; uid_hex?: string | null; uid_masked?: string | null; result_json?: unknown } | undefined;
  if (!row || !row.result_json || typeof row.result_json !== "object") return null;
  const result = row.result_json as { contract?: unknown };
  if (!result.contract || typeof result.contract !== "object") return null;
  const diagnosticId = Number(row.id || numericId);
  const traceIdValue = row.trace_id || trace;
  const createdAt = row.created_at || null;
  const snapshotIdentity = asRecord(asRecord(result.contract).identity);
  const currentTapEventId = String(asRecord(result.contract).eventId || snapshotIdentity.eventId || "").trim();
  const [currentIdentity, currentTap, currentEditorial] = await Promise.all([
    resolveCurrentSnapshotIdentity({ bid: row.bid, uidHex: row.uid_hex, uidMasked: row.uid_masked }),
    currentTapEventId
      ? resolveCurrentSnapshotTapLocation({ eventId: currentTapEventId, bid: row.bid, uidHex: row.uid_hex })
      : Promise.resolve(null),
    readCurrentPassportEditorial(currentTapEventId),
  ]);
  const identityNormalizedContract = normalizeSnapshotContractFromCurrentIdentity(result.contract, currentIdentity);
  const sanitizedStoredContract = sanitizeSnapshotPublicCoordinates(identityNormalizedContract);
  const contract = normalizeSunProfileMismatchContract(
    normalizeSnapshotContractFromCurrentTap(sanitizedStoredContract, currentTap),
  );
  const identity = asRecord(contract.identity);
  const tokenizationEventId = String(contract.eventId || identity.eventId || "").trim();
  const bid = String(identity.bid || contract.bid || "").trim();
  const fresh = verifySunFreshHandoffToken(freshToken, {
    bid: bid || undefined,
    eventId: tokenizationEventId || undefined,
    diagnosticId,
    traceId: traceIdValue,
  });
  const freshExpiresAt = fresh.ok ? new Date(fresh.payload.exp * 1000).toISOString() : null;
  const snapshotContract = fresh.ok
    ? markFreshHandoffContract(contract, { id: diagnosticId, traceId: traceIdValue, createdAt, expiresAt: freshExpiresAt })
    : markHistoricalSnapshotContract(contract, { id: diagnosticId, traceId: traceIdValue, createdAt });
  const publicContract = withContractSummaryFields(snapshotContract);
  // Publication metadata is current, separate from the stored reading evidence.
  publicContract.currentEditorial = currentEditorial;
  if (tokenizationEventId) {
    try {
      publicContract.certificate = {
        shareToken: createPublicCertificateShareToken(tokenizationEventId),
      };
    } catch {
      // Production certificates fail closed if a signing secret is unavailable.
    }
  }

  return {
    ok: true,
    diagnostic_id: diagnosticId,
    trace_id: traceIdValue,
    created_at: createdAt,
    snapshot_access: fresh.ok ? "fresh_handoff" : "historical",
    contract: publicContract,
  };
}
