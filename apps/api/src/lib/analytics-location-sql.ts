import { sql, type SqlExecutor } from "./db";

const LOCATION_MARKER = "/* analytics_event_location */";

/**
 * Read-time geography for the existing `events e` row. Keep this aligned with
 * postTapBrowserLocation: consent must be boolean true, supported approximate
 * source, paired WGS84 coordinates and 150..50000m accuracy. JSONPath strict mode
 * prevents array unwrapping; silent double conversion returns NULL for malformed
 * or overflowing values instead of failing the complete analytics request.
 * No event evidence is written. Missing browser locality never borrows IP labels.
 */
const LOCATION_JOIN = `
  CROSS JOIN LATERAL (
    SELECT e.post_tap_location_observation AS observation
  ) analytics_observation
  CROSS JOIN LATERAL (
    SELECT
      (jsonb_path_query_first(analytics_observation.observation, 'strict $.lat.double()', '{}'::jsonb, true) #>> '{}')::float8 AS lat,
      (jsonb_path_query_first(analytics_observation.observation, 'strict $.lng.double()', '{}'::jsonb, true) #>> '{}')::float8 AS lng,
      (jsonb_path_query_first(analytics_observation.observation, 'strict $.accuracyM.double()', '{}'::jsonb, true) #>> '{}')::float8 AS accuracy_m
  ) analytics_measurement
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      jsonb_typeof(analytics_observation.observation) = 'object'
      AND analytics_observation.observation->'consent' = 'true'::jsonb
      AND LOWER(BTRIM(analytics_observation.observation->>'precision')) = 'approximate'
      AND LOWER(BTRIM(analytics_observation.observation->>'source')) IN ('browser_geolocation_approximate_consent', 'browser_gps_approximate_consent')
      AND analytics_measurement.lat BETWEEN -90 AND 90
      AND analytics_measurement.lng BETWEEN -180 AND 180
      AND analytics_measurement.accuracy_m BETWEEN 150 AND 50000,
      false
    ) AS browser_valid,
    COALESCE(e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180, false) AS direct_valid,
    COALESCE(e.geo_lat BETWEEN -90 AND 90 AND e.geo_lng BETWEEN -180 AND 180, false) AS edge_valid
  ) analytics_location_validity
  CROSS JOIN LATERAL (
    SELECT
      CASE WHEN analytics_location_validity.browser_valid THEN
        CASE WHEN jsonb_typeof(analytics_observation.observation->'city') IN ('string', 'number')
          THEN NULLIF(BTRIM(analytics_observation.observation->>'city'), '') END
        ELSE COALESCE(NULLIF(e.city, ''), NULLIF(e.geo_city, '')) END AS city,
      CASE WHEN analytics_location_validity.browser_valid THEN
        CASE WHEN jsonb_typeof(analytics_observation.observation->'countryCode') IN ('string', 'number')
          THEN NULLIF(BTRIM(analytics_observation.observation->>'countryCode'), '') END
        ELSE COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, '')) END AS country_code,
      CASE WHEN analytics_location_validity.browser_valid THEN floor(analytics_measurement.lat * 1000 + 0.5) / 1000
        WHEN analytics_location_validity.direct_valid THEN e.lat
        WHEN analytics_location_validity.edge_valid THEN e.geo_lat END AS lat,
      CASE WHEN analytics_location_validity.browser_valid THEN floor(analytics_measurement.lng * 1000 + 0.5) / 1000
        WHEN analytics_location_validity.direct_valid THEN e.lng
        WHEN analytics_location_validity.edge_valid THEN e.geo_lng END AS lng,
      CASE WHEN analytics_location_validity.browser_valid THEN LOWER(BTRIM(analytics_observation.observation->>'source'))
        WHEN analytics_location_validity.direct_valid THEN COALESCE(NULLIF(LOWER(BTRIM(e.location_source)), ''), 'unknown_approx')
        WHEN analytics_location_validity.edge_valid THEN 'edge_ip_approx'
        ELSE 'none' END AS location_source,
      CASE WHEN analytics_location_validity.browser_valid THEN analytics_measurement.accuracy_m
        WHEN analytics_location_validity.direct_valid
          AND LOWER(BTRIM(e.location_source)) IN ('browser_gps_reported', 'browser_gps_approximate_consent', 'browser_geolocation_approximate_consent')
          AND e.location_accuracy_m >= 0 AND e.location_accuracy_m < 'Infinity'::float8
        THEN e.location_accuracy_m END AS location_accuracy_m,
      analytics_location_validity.browser_valid AS post_tap_observation_applied
  ) event_location
`;

/** Expand only a developer-owned marker; request values remain SQL parameters. */
export function createAnalyticsLocationSql(executor: SqlExecutor = sql): SqlExecutor {
  return (strings, ...values) => {
    if (!strings.some((part) => part.includes(LOCATION_MARKER))) {
      throw new Error("analytics_location_marker_required");
    }
    const expanded = strings.map((part) => part.replaceAll(LOCATION_MARKER, LOCATION_JOIN));
    Object.defineProperty(expanded, "raw", {
      value: Object.freeze(strings.raw.map((part) => part.replaceAll(LOCATION_MARKER, LOCATION_JOIN))),
    });
    return executor(Object.freeze(expanded) as unknown as TemplateStringsArray, ...values);
  };
}

export const analyticsLocationSql = createAnalyticsLocationSql();
