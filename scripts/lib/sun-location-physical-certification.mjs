export const SUN_LOCATION_PHYSICAL_MATRIX_SCHEMA = "nexid-sun-location-physical-matrix/v1";

const REQUIRED_PLATFORMS = ["ios_safari", "android_chrome"];
const REQUIRED_SEAL_STATES = ["closed", "opened"];
const OPENED_RESULTS = new Set(["VALID_OPENED", "VALID_OPENED_PREVIOUSLY"]);
const CONSENTED_LOCATION_SOURCES = new Set([
  "browser_geolocation_approximate_consent",
  "browser_gps_approximate_consent",
]);
const RETRYABLE_OUTCOMES = new Set(["denied", "timeout", "stale", "unavailable"]);
const SHA256_REF = /^sha256:[0-9a-f]{64}$/;
const FULL_GIT_SHA = /^[0-9a-f]{40}$/;
const MAX_MEASUREMENT_DELAY_MS = 5 * 60 * 1_000;
const CLOCK_SKEW_MS = 60 * 1_000;
const FORBIDDEN_RAW_FIELDS = new Set([
  "lat",
  "latitude",
  "lng",
  "longitude",
  "uid",
  "uidhex",
  "uid_hex",
  "freshtoken",
  "fresh_token",
  "picc_data",
  "enc",
  "cmac",
]);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function timestamp(value) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function push(errors, code, context = "") {
  errors.push(context ? `${code}:${context}` : code);
}

function requireBoolean(errors, value, expected, code, context) {
  if (value !== expected) push(errors, code, context);
}

function requireDigest(errors, value, field, context) {
  if (!SHA256_REF.test(text(value))) push(errors, `invalid_${field}`, context);
}

function scanRawSensitiveFields(value, errors, path = []) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanRawSensitiveFields(entry, errors, [...path, String(index)]));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    const normalized = key.replace(/[^a-z0-9_]/gi, "").toLowerCase();
    const nextPath = [...path, key];
    if (FORBIDDEN_RAW_FIELDS.has(normalized)) push(errors, "raw_sensitive_field_forbidden", nextPath.join("."));
    scanRawSensitiveFields(nested, errors, nextPath);
  }
}

function validatePhysicalRun(runValue, expectedPlatform, expectedSealState, errors) {
  const run = record(runValue);
  const context = `${expectedPlatform}_${expectedSealState}`;
  if (text(run.runId).length < 6 || text(run.runId).length > 120) push(errors, "invalid_run_id", context);
  if (run.platform !== expectedPlatform) push(errors, "platform_mismatch", context);
  if (run.sealState !== expectedSealState) push(errors, "seal_state_mismatch", context);
  if (run.evidenceMode !== "physical_nfc_observation") push(errors, "physical_observation_required", context);
  const reportedResult = text(run.reportedResult).toUpperCase();
  if (expectedSealState === "closed" && reportedResult !== "VALID_CLOSED") push(errors, "closed_result_required", context);
  if (expectedSealState === "opened" && !OPENED_RESULTS.has(reportedResult)) push(errors, "opened_result_required", context);
  requireDigest(errors, run.eventRef, "event_ref", context);
  requireDigest(errors, run.receiptRef, "receipt_ref", context);
  requireDigest(errors, run.screenshotRef, "screenshot_ref", context);
  requireBoolean(errors, run.freshCapabilityObserved, true, "fresh_capability_not_observed", context);
  if (run.permissionRequestedBy !== "explicit_location_button") push(errors, "explicit_location_action_required", context);
  requireBoolean(errors, run.permissionPromptBeforeAction, false, "automatic_permission_prompt_detected", context);
  if (run.locationOutcome !== "saved") push(errors, "saved_location_receipt_required", context);
  if (!CONSENTED_LOCATION_SOURCES.has(run.locationSource)) push(errors, "consented_browser_source_required", context);
  const accuracyM = Number(run.accuracyM);
  if (!Number.isFinite(accuracyM) || accuracyM < 150 || accuracyM > 50_000) push(errors, "invalid_accuracy_m", context);

  const tapReceivedAt = timestamp(run.tapReceivedAt);
  const measuredAt = timestamp(run.measuredAt);
  if (tapReceivedAt === null) push(errors, "invalid_tap_received_at", context);
  if (measuredAt === null) push(errors, "invalid_measured_at", context);
  if (
    tapReceivedAt !== null
    && measuredAt !== null
    && (measuredAt < tapReceivedAt - CLOCK_SKEW_MS || measuredAt - tapReceivedAt > MAX_MEASUREMENT_DELAY_MS)
  ) {
    push(errors, "measurement_not_fresh_after_tap", context);
  }

  requireBoolean(errors, run.basemapVisible, true, "basemap_not_visible", context);
  requireBoolean(errors, run.mapUpdatedWithoutReload, true, "map_did_not_update_in_place", context);
  requireBoolean(errors, run.demoLineVisible, false, "real_tap_demo_line_visible", context);
  requireBoolean(errors, run.originPresentedAsDeclared, true, "declared_origin_not_distinct", context);
  requireBoolean(errors, run.networkPresentedSeparately, true, "network_source_not_distinct", context);
  requireBoolean(errors, run.noExactPositionClaim, true, "exact_position_overclaim", context);
  requireBoolean(errors, run.noPhysicalRouteClaim, true, "physical_route_overclaim", context);
}

function validateRetryRun(runValue, expectedPlatform, errors) {
  const run = record(runValue);
  const context = `${expectedPlatform}_retry`;
  if (run.platform !== expectedPlatform) push(errors, "retry_platform_mismatch", context);
  if (!RETRYABLE_OUTCOMES.has(run.initialOutcome)) push(errors, "invalid_retry_initial_outcome", context);
  requireBoolean(errors, run.retryOffered, true, "retry_not_offered", context);
  requireBoolean(errors, run.falseSavedStateShown, false, "false_saved_state_shown", context);
  if (run.finalOutcome !== "saved") push(errors, "retry_did_not_recover", context);
  requireDigest(errors, run.evidenceRef, "retry_evidence_ref", context);
}

export function validateSunLocationPhysicalMatrix(input) {
  const matrix = record(input);
  const errors = [];
  scanRawSensitiveFields(matrix, errors);

  if (matrix.schemaVersion !== SUN_LOCATION_PHYSICAL_MATRIX_SCHEMA) push(errors, "unsupported_schema_version");
  const target = record(matrix.target);
  if (!new Set(["preview", "staging", "production"]).has(target.environment)) push(errors, "invalid_target_environment");
  try {
    const targetUrl = new URL(text(target.webUrl));
    if (targetUrl.protocol !== "https:") push(errors, "https_target_required");
    if (targetUrl.search || targetUrl.hash) push(errors, "clean_target_url_required");
  } catch {
    push(errors, "invalid_target_url");
  }
  if (!FULL_GIT_SHA.test(text(target.deploymentSha))) push(errors, "full_deployment_sha_required");
  if (!text(target.deploymentId)) push(errors, "deployment_id_required");
  if (timestamp(target.testedAt) === null) push(errors, "invalid_target_tested_at");

  const claims = record(matrix.claims);
  requireBoolean(errors, claims.exactGpsCertified, false, "exact_gps_claim_forbidden", "claims");
  requireBoolean(errors, claims.physicalRouteCertified, false, "physical_route_claim_forbidden", "claims");
  requireBoolean(errors, claims.physicalAuthenticityCertified, false, "physical_authenticity_claim_forbidden", "claims");

  const runs = Array.isArray(matrix.runs) ? matrix.runs : [];
  const covered = [];
  for (const platform of REQUIRED_PLATFORMS) {
    for (const sealState of REQUIRED_SEAL_STATES) {
      const matches = runs.filter((runValue) => {
        const run = record(runValue);
        return run.platform === platform && run.sealState === sealState;
      });
      if (matches.length !== 1) {
        push(errors, "exactly_one_required_physical_run", `${platform}_${sealState}`);
        continue;
      }
      covered.push(`${platform}_${sealState}`);
      validatePhysicalRun(matches[0], platform, sealState, errors);
    }
  }
  if (runs.length !== REQUIRED_PLATFORMS.length * REQUIRED_SEAL_STATES.length) push(errors, "unexpected_physical_run_count");
  const runIds = runs.map((runValue) => text(record(runValue).runId)).filter(Boolean);
  if (new Set(runIds).size !== runIds.length) push(errors, "duplicate_run_id");
  const eventRefs = runs.map((runValue) => text(record(runValue).eventRef)).filter(Boolean);
  if (new Set(eventRefs).size !== eventRefs.length) push(errors, "duplicate_event_ref");

  const retryRuns = Array.isArray(matrix.retryRuns) ? matrix.retryRuns : [];
  for (const platform of REQUIRED_PLATFORMS) {
    const matches = retryRuns.filter((runValue) => record(runValue).platform === platform);
    if (matches.length !== 1) push(errors, "exactly_one_required_retry_run", platform);
    else validateRetryRun(matches[0], platform, errors);
  }
  if (retryRuns.length !== REQUIRED_PLATFORMS.length) push(errors, "unexpected_retry_run_count");

  const networkRun = record(matrix.networkRun);
  if (!new Set(["edge_ip_approx", "ip_geo"]).has(networkRun.locationSource)) push(errors, "network_source_required");
  requireBoolean(errors, networkRun.basemapVisible, true, "network_basemap_not_visible", "network");
  requireBoolean(errors, networkRun.labelledApproximate, true, "network_not_labelled_approximate", "network");
  requireBoolean(errors, networkRun.labelledNotPhoneLocation, true, "network_not_separated_from_phone", "network");
  requireBoolean(errors, networkRun.demoLineVisible, false, "network_demo_line_visible", "network");
  requireDigest(errors, networkRun.evidenceRef, "network_evidence_ref", "network");

  const demoRun = record(matrix.demoRun);
  if (demoRun.evidenceMode !== "simulated_demo") push(errors, "demo_mode_required");
  if (demoRun.locationSource !== "demo") push(errors, "demo_source_required");
  requireBoolean(errors, demoRun.basemapVisible, true, "demo_basemap_not_visible", "demo");
  requireBoolean(errors, demoRun.demoLineVisible, true, "demo_line_not_visible", "demo");
  requireBoolean(errors, demoRun.physicalRouteDisclaimerVisible, true, "demo_route_disclaimer_missing", "demo");
  requireDigest(errors, demoRun.evidenceRef, "demo_evidence_ref", "demo");

  return {
    ok: errors.length === 0,
    status: errors.length === 0 ? "complete_for_human_review" : "incomplete",
    schemaVersion: SUN_LOCATION_PHYSICAL_MATRIX_SCHEMA,
    automatedPhysicalCertification: false,
    coverage: {
      requiredPhysicalRuns: 4,
      observedPhysicalRuns: covered.length,
      requiredRetryRuns: 2,
      observedRetryRuns: retryRuns.length,
    },
    claims: {
      exactGpsCertified: false,
      physicalRouteCertified: false,
      physicalAuthenticityCertified: false,
    },
    errors: [...new Set(errors)].sort(),
  };
}
