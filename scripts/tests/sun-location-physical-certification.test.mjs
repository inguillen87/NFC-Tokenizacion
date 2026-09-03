import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  SUN_LOCATION_PHYSICAL_MATRIX_SCHEMA,
  validateSunLocationPhysicalMatrix,
} from "../lib/sun-location-physical-certification.mjs";

const digest = (value) => `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;

function physicalRun(platform, sealState, index) {
  return {
    runId: `${platform}-${sealState}-physical-${index}`,
    platform,
    sealState,
    reportedResult: sealState === "closed" ? "VALID_CLOSED" : "VALID_OPENED",
    evidenceMode: "physical_nfc_observation",
    eventRef: digest(String(index)),
    receiptRef: digest(String(index + 4)),
    screenshotRef: digest(String(index + 8)),
    tapReceivedAt: `2026-09-03T12:0${index}:00.000Z`,
    freshCapabilityObserved: true,
    permissionRequestedBy: "explicit_location_button",
    permissionPromptBeforeAction: false,
    locationOutcome: "saved",
    locationSource: "browser_geolocation_approximate_consent",
    accuracyM: 180 + index,
    measuredAt: `2026-09-03T12:0${index}:03.000Z`,
    basemapVisible: true,
    mapUpdatedWithoutReload: true,
    demoLineVisible: false,
    originPresentedAsDeclared: true,
    networkPresentedSeparately: true,
    noExactPositionClaim: true,
    noPhysicalRouteClaim: true,
  };
}

function completeMatrix() {
  return {
    schemaVersion: SUN_LOCATION_PHYSICAL_MATRIX_SCHEMA,
    target: {
      environment: "preview",
      webUrl: "https://preview.example.test/sun",
      deploymentSha: "a".repeat(40),
      deploymentId: "dpl_location_preview_01",
      testedAt: "2026-09-03T13:00:00.000Z",
    },
    claims: {
      exactGpsCertified: false,
      physicalRouteCertified: false,
      physicalAuthenticityCertified: false,
    },
    runs: [
      physicalRun("ios_safari", "closed", 1),
      physicalRun("ios_safari", "opened", 2),
      physicalRun("android_chrome", "closed", 3),
      physicalRun("android_chrome", "opened", 4),
    ],
    retryRuns: [
      {
        platform: "ios_safari",
        initialOutcome: "timeout",
        retryOffered: true,
        falseSavedStateShown: false,
        finalOutcome: "saved",
        evidenceRef: digest("d"),
      },
      {
        platform: "android_chrome",
        initialOutcome: "stale",
        retryOffered: true,
        falseSavedStateShown: false,
        finalOutcome: "saved",
        evidenceRef: digest("e"),
      },
    ],
    networkRun: {
      locationSource: "edge_ip_approx",
      basemapVisible: true,
      labelledApproximate: true,
      labelledNotPhoneLocation: true,
      demoLineVisible: false,
      evidenceRef: digest("f"),
    },
    demoRun: {
      evidenceMode: "simulated_demo",
      locationSource: "demo",
      basemapVisible: true,
      demoLineVisible: true,
      physicalRouteDisclaimerVisible: true,
      evidenceRef: digest("b"),
    },
  };
}

test("complete physical matrix covers both mobile browsers and both reported seal states without overclaiming", () => {
  const result = validateSunLocationPhysicalMatrix(completeMatrix());
  assert.equal(result.ok, true);
  assert.equal(result.status, "complete_for_human_review");
  assert.equal(result.automatedPhysicalCertification, false);
  assert.deepEqual(result.coverage, {
    requiredPhysicalRuns: 4,
    observedPhysicalRuns: 4,
    requiredRetryRuns: 2,
    observedRetryRuns: 2,
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.claims, {
    exactGpsCertified: false,
    physicalRouteCertified: false,
    physicalAuthenticityCertified: false,
  });
});

test("matrix fails closed on automatic permission, hidden route, stale timing or a false saved state", () => {
  const matrix = completeMatrix();
  matrix.runs[0].permissionPromptBeforeAction = true;
  matrix.runs[1].demoLineVisible = true;
  matrix.runs[2].measuredAt = "2026-09-03T12:20:00.000Z";
  matrix.retryRuns[0].falseSavedStateShown = true;

  const result = validateSunLocationPhysicalMatrix(matrix);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("automatic_permission_prompt_detected:ios_safari_closed"));
  assert.ok(result.errors.includes("real_tap_demo_line_visible:ios_safari_opened"));
  assert.ok(result.errors.includes("measurement_not_fresh_after_tap:android_chrome_closed"));
  assert.ok(result.errors.includes("false_saved_state_shown:ios_safari_retry"));
});

test("matrix rejects raw coordinates, UID and fresh capability values", () => {
  const matrix = completeMatrix();
  matrix.runs[0].lat = -34.6;
  matrix.runs[0].uid = "04AABBCCDDEEFF";
  matrix.runs[0].freshToken = "must-not-be-recorded";

  const result = validateSunLocationPhysicalMatrix(matrix);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("raw_sensitive_field_forbidden:runs.0.lat"));
  assert.ok(result.errors.includes("raw_sensitive_field_forbidden:runs.0.uid"));
  assert.ok(result.errors.includes("raw_sensitive_field_forbidden:runs.0.freshToken"));
});

test("matrix rejects a target URL that could retain a fresh capability", () => {
  const matrix = completeMatrix();
  matrix.target.webUrl = "https://preview.example.test/sun?fresh_token=secret#result";

  const result = validateSunLocationPhysicalMatrix(matrix);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("clean_target_url_required"));
});
