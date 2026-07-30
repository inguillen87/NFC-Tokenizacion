import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  PHYSICAL_NFC_EVIDENCE_PACK_SCHEMA,
  SANITIZED_MANIFEST_SCHEMA,
  SANITIZED_SUN_RECEIPT_SCHEMA,
  validatePhysicalNfcEvidencePack,
} from "../scripts/lib/physical-nfc-evidence-pack.mjs";

const CLEAN_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const CLEAN_OPENED_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWNgYPj/HwADAgH/xCAAOgAAAABJRU5ErkJggg==",
  "base64",
);

function digest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function ref(label) {
  return digest(Buffer.from(label, "utf8"));
}

function receipt({ tagTamper, observation, counter, capturedAt }) {
  return {
    schema_version: SANITIZED_SUN_RECEIPT_SCHEMA,
    sample_ref: "sample-01",
    batch_ref: "SAMPLES-2026-01",
    uid_fingerprint: ref("sample-01-uid"),
    observation,
    verification_result: observation === "replay"
      ? "replay_suspect"
      : observation === "opened"
        ? "valid_opened"
        : tagTamper ? "valid_closed" : "valid",
    read_counter: counter,
    captured_at: capturedAt,
    server_evidence_digest: ref(`server-${observation}`),
    canonical_event_ref: ref(`event-${observation}`),
    server_evidence_verified: true,
    raw_sun_values_included: false,
    physical_ceremony_verified: false,
  };
}

async function writeEvidencePack(options = {}) {
  const tagTamper = options.tagTamper === true;
  const root = await mkdtemp(path.join(tmpdir(), "nexid-physical-evidence-"));
  await mkdir(path.join(root, "receipts"), { recursive: true });
  await mkdir(path.join(root, "photos"), { recursive: true });
  await mkdir(path.join(root, "manifest"), { recursive: true });

  const sanitizedManifest = {
    schema_version: SANITIZED_MANIFEST_SCHEMA,
    batch_ref: "SAMPLES-2026-01",
    entries: [{ sample_ref: "sample-01", uid_fingerprint: ref("sample-01-uid") }],
    ...options.sanitizedManifestOverrides,
  };
  const artifactInputs = [{
    path: "manifest/manifest-sanitized.json",
    kind: "sanitized_manifest",
    media_type: "application/json",
    bytes: jsonBytes(sanitizedManifest),
  }];
  const observations = [
    { observation: "intact", counter: 7, capturedAt: "2026-01-01T12:00:00.000Z", photo: true },
    { observation: "replay", counter: 7, capturedAt: "2026-01-01T12:01:00.000Z", photo: false },
  ];
  if (tagTamper) observations.push({
    observation: "opened",
    counter: 8,
    capturedAt: "2026-01-01T12:02:00.000Z",
    photo: true,
  });

  const sampleObservations = [];
  for (const observation of observations) {
    const receiptPath = `receipts/sample-01-${observation.observation}.json`;
    artifactInputs.push({
      path: receiptPath,
      kind: "server_sun_receipt",
      media_type: "application/json",
      bytes: jsonBytes(receipt({ tagTamper, ...observation })),
    });
    let photoPath;
    if (observation.photo) {
      photoPath = `photos/sample-01-${observation.observation}.${options.photoExtension || "png"}`;
      const defaultPhotoBytes = Buffer.from(
        observation.observation === "opened" ? CLEAN_OPENED_PNG : CLEAN_PNG,
      );
      artifactInputs.push({
        path: photoPath,
        kind: "physical_photo",
        media_type: options.photoMediaType || "image/png",
        metadata_sanitized: true,
        sample_ref: "sample-01",
        observation: observation.observation,
        captured_at: observation.capturedAt,
        bytes: options.photoBytes || defaultPhotoBytes,
      });
    }
    sampleObservations.push({
      observation: observation.observation,
      receipt_artifact: receiptPath,
      ...(photoPath ? { photo_artifact: photoPath } : {}),
    });
  }

  for (const artifact of artifactInputs) {
    const absolute = path.join(root, ...artifact.path.split("/"));
    await writeFile(absolute, artifact.bytes);
  }
  const artifacts = artifactInputs.map(({ bytes, ...artifact }) => ({
    ...artifact,
    sha256: digest(bytes),
  }));
  const pack = {
    schema_version: PHYSICAL_NFC_EVIDENCE_PACK_SCHEMA,
    evidence_class: "sanitized_physical_review_candidate",
    ceremony: {
      ceremony_id: "nexid-samples-2026-01",
      ceremony_scope: options.ceremonyScope || "loose_tag_sample",
      performed_at: "2026-01-01T12:05:00.000Z",
      operator_ref: ref("operator"),
      site_ref: ref("site"),
    },
    scope: {
      batch_ref: "SAMPLES-2026-01",
      carrier_profile_code: tagTamper ? "ntag424_dna_tt" : "ntag424_dna",
      expected_sample_count: 1,
    },
    physical_context: options.physicalContext || {},
    artifacts,
    samples: [{
      sample_ref: "sample-01",
      uid_fingerprint: ref("sample-01-uid"),
      sacrificial: tagTamper,
      observations: sampleObservations,
    }],
    claims: {
      physical_ceremony_verified: false,
      physical_tag_certification: false,
      tagtamper_physical_certification: false,
      production_lot_accepted: false,
      managed_kms: false,
      hsm_backed: false,
      ...options.claimOverrides,
    },
  };
  await writeFile(path.join(root, "evidence-pack.json"), jsonBytes(pack));
  return { root, pack, artifacts };
}

async function withPack(options, operation) {
  const fixture = await writeEvidencePack(options);
  try {
    return await operation(fixture);
  } finally {
    const resolved = path.resolve(fixture.root);
    assert.ok(resolved.startsWith(path.resolve(tmpdir())), "fixture cleanup must remain in the OS temp directory");
    await rm(resolved, { recursive: true, force: true });
  }
}

async function writePackManifest(root, pack, bytes = jsonBytes(pack)) {
  await writeFile(path.join(root, "evidence-pack.json"), bytes);
}

async function rewriteJsonArtifact(root, pack, artifactPath, value) {
  const bytes = jsonBytes(value);
  await writeFile(path.join(root, ...artifactPath.split("/")), bytes);
  const descriptor = pack.artifacts.find((artifact) => artifact.path === artifactPath);
  assert.ok(descriptor, `missing descriptor for ${artifactPath}`);
  descriptor.sha256 = digest(bytes);
  await writePackManifest(root, pack);
}

test("sanitized NTAG 424 DNA sample pack becomes eligible only for manual review", async () => {
  await withPack({}, async ({ root }) => {
    const result = await validatePhysicalNfcEvidencePack(root);
    assert.equal(result.ok, true);
    assert.equal(result.review_status, "eligible_for_manual_review");
    assert.equal(result.artifact_integrity_verified, true);
    assert.equal(result.packaging_integration_evidence_present, false);
    assert.equal(result.manual_identity_and_custody_review_required, true);
    assert.equal(result.physical_ceremony_verified, false);
    assert.equal(result.physical_tag_certification, false);
    assert.equal(result.hsm_backed, false);
    assert.match(result.evidence_pack_digest, /^sha256:[0-9a-f]{64}$/);
  });
});

test("TagTamper review requires one later sacrificial opened observation", async () => {
  await withPack({ tagTamper: true }, async ({ root }) => {
    const result = await validatePhysicalNfcEvidencePack(root);
    assert.equal(result.ok, true);
    assert.equal(result.tagtamper_physical_certification, false);
  });
  await withPack({}, async ({ root, pack }) => {
    pack.scope.carrier_profile_code = "ntag424_dna_tt";
    await writeFile(path.join(root, "evidence-pack.json"), jsonBytes(pack));
    const result = await validatePhysicalNfcEvidencePack(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((entry) => entry.code === "tagtamper_sacrificial_opened_sample_required"));
  });
});

test("TagTamper ceremony enforces intact, replay, opened receipt and photo chronology", async () => {
  await withPack({ tagTamper: true }, async ({ root, pack }) => {
    const openedPath = "receipts/sample-01-opened.json";
    const openedReceipt = JSON.parse(await readFile(path.join(root, ...openedPath.split("/")), "utf8"));
    openedReceipt.captured_at = "2026-01-01T12:00:30.000Z";
    await rewriteJsonArtifact(root, pack, openedPath, openedReceipt);

    const result = await validatePhysicalNfcEvidencePack(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((entry) => entry.code === "sample_opened_must_follow_replay"));
  });

  await withPack({ tagTamper: true }, async ({ root, pack }) => {
    const openedPhoto = pack.artifacts.find((artifact) => artifact.path === "photos/sample-01-opened.png");
    assert.ok(openedPhoto);
    openedPhoto.captured_at = "2026-01-01T11:59:00.000Z";
    await writePackManifest(root, pack);

    const result = await validatePhysicalNfcEvidencePack(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((entry) => entry.code === "sample_opened_photo_must_follow_intact_photo"));
    assert.ok(result.errors.some((entry) => entry.code === "sample_opened_photo_must_follow_replay"));
  });
});

test("pack rejects any physical, production, KMS or HSM overclaim", async () => {
  await withPack({ claimOverrides: { physical_tag_certification: true, hsm_backed: true } }, async ({ root }) => {
    const result = await validatePhysicalNfcEvidencePack(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((entry) => entry.code === "claim_must_be_false:physical_tag_certification"));
    assert.ok(result.errors.some((entry) => entry.code === "claim_must_be_false:hsm_backed"));
    assert.equal(result.physical_tag_certification, false);
    assert.equal(result.hsm_backed, false);
  });
});

test("closed manifest rejects reserved certification, KMS and HSM claims outside claims", async () => {
  await withPack({}, async ({ root, pack }) => {
    pack.attestations = {
      physical_tag_certification: true,
      managed_kms: true,
      hsm_backed: true,
    };
    await writePackManifest(root, pack);
    const result = await validatePhysicalNfcEvidencePack(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((entry) => entry.code === "reserved_overclaim_outside_contract:physical_tag_certification"));
    assert.ok(result.errors.some((entry) => entry.code === "reserved_overclaim_outside_contract:managed_kms"));
    assert.ok(result.errors.some((entry) => entry.code === "reserved_overclaim_outside_contract:hsm_backed"));
    assert.ok(result.errors.some((entry) => entry.code === "evidence_pack_closed_schema_invalid"));
    assert.equal(result.hsm_backed, false);
  });
});

test("sanitized manifest rejects raw UID, camelCase secret aliases and unknown fields with a matching hash", async () => {
  await withPack({
    sanitizedManifestOverrides: {
      uid_hex: "04AABBCCDDEEFF",
      rawUid: "04AABBCCDDEEFF",
      apiKey: "sk_live_should_not_leave_custody",
      notes: "unexpected schema extension",
    },
  }, async ({ root }) => {
    const result = await validatePhysicalNfcEvidencePack(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((entry) => entry.code === "forbidden_sensitive_field"));
    assert.ok(result.errors.some((entry) => entry.code === "sensitive_material_detected"));
    assert.ok(result.errors.some((entry) => entry.code === "artifact_closed_schema_invalid"));
  });
});

test("duplicate JSON keys fail closed and the pack digest binds exact manifest bytes", async () => {
  await withPack({}, async ({ root, pack }) => {
    const baseline = await validatePhysicalNfcEvidencePack(root);
    assert.equal(baseline.ok, true);

    await writePackManifest(root, pack, Buffer.from(JSON.stringify(pack), "utf8"));
    const compact = await validatePhysicalNfcEvidencePack(root);
    assert.equal(compact.ok, true);
    assert.notEqual(compact.evidence_pack_digest, baseline.evidence_pack_digest);

    const duplicate = jsonBytes(pack).toString("utf8").replace(
      '"evidence_class": "sanitized_physical_review_candidate"',
      '"evidence_class": "postgresql://user:pass@host/db",\n  "evidence_class": "sanitized_physical_review_candidate"',
    );
    await writePackManifest(root, pack, Buffer.from(duplicate, "utf8"));
    const rejected = await validatePhysicalNfcEvidencePack(root);
    assert.equal(rejected.ok, false);
    assert.ok(rejected.errors.some((entry) => entry.code === "evidence_pack_manifest_duplicate_key"));
  });
});

test("duplicate keys in declared JSON artifacts fail closed even when their digest matches", async () => {
  await withPack({}, async ({ root, pack }) => {
    const artifactPath = "manifest/manifest-sanitized.json";
    const current = await readFile(path.join(root, ...artifactPath.split("/")), "utf8");
    const duplicate = current.replace(
      '"batch_ref": "SAMPLES-2026-01"',
      '"batch_ref": "postgresql://user:pass@host/db",\n  "batch_ref": "SAMPLES-2026-01"',
    );
    const bytes = Buffer.from(duplicate, "utf8");
    await writeFile(path.join(root, ...artifactPath.split("/")), bytes);
    pack.artifacts.find((artifact) => artifact.path === artifactPath).sha256 = digest(bytes);
    await writePackManifest(root, pack);

    const result = await validatePhysicalNfcEvidencePack(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((entry) => entry.code === "artifact_json_duplicate_key"));
  });
});

test("raw UID tokens in opaque references or artifact paths fail closed", async () => {
  await withPack({}, async ({ root, pack }) => {
    pack.ceremony.ceremony_id = "04AABBCCDDEEFF";
    await writePackManifest(root, pack);
    const rawReference = await validatePhysicalNfcEvidencePack(root);
    assert.equal(rawReference.ok, false);
    assert.ok(rawReference.errors.some((entry) => entry.code === "sensitive_material_detected"));

    pack.ceremony.ceremony_id = "nexid-samples-2026-01";
    pack.artifacts.find((artifact) => artifact.kind === "physical_photo").path = "photos/04AABBCCDDEEFF-intact.png";
    await writePackManifest(root, pack);
    const rawPath = await validatePhysicalNfcEvidencePack(root);
    assert.equal(rawPath.ok, false);
    assert.ok(rawPath.errors.some((entry) => entry.code === "artifact_path_invalid"));
  });

  await withPack({}, async ({ root, pack }) => {
    for (const formattedUid of [
      "04-AA-BB-CC-DD-EE-FF",
      "04:AA:BB:CC:DD:EE:FF",
      "04 AA BB CC DD EE FF",
    ]) {
      pack.ceremony.ceremony_id = `nexid-${formattedUid}`;
      await writePackManifest(root, pack);
      const formattedReference = await validatePhysicalNfcEvidencePack(root);
      assert.equal(formattedReference.ok, false);
      assert.ok(formattedReference.errors.some((entry) => entry.code === "sensitive_material_detected"));
    }
  });
});

test("sample cohorts require one unique batch-scoped UID fingerprint per sample", async () => {
  await withPack({}, async ({ root, pack }) => {
    const fingerprint = pack.samples[0].uid_fingerprint;
    const manifestPath = "manifest/manifest-sanitized.json";
    const sanitizedManifest = JSON.parse(await readFile(path.join(root, ...manifestPath.split("/")), "utf8"));
    sanitizedManifest.entries.push({ sample_ref: "sample-02", uid_fingerprint: fingerprint });
    await rewriteJsonArtifact(root, pack, manifestPath, sanitizedManifest);

    const secondObservations = [];
    for (const state of ["intact", "replay"]) {
      const sourcePath = `receipts/sample-01-${state}.json`;
      const receiptValue = JSON.parse(await readFile(path.join(root, ...sourcePath.split("/")), "utf8"));
      receiptValue.sample_ref = "sample-02";
      receiptValue.server_evidence_digest = ref(`server-sample-02-${state}`);
      receiptValue.canonical_event_ref = ref(`event-sample-02-${state}`);
      const receiptPath = `receipts/sample-02-${state}.json`;
      const receiptBytes = jsonBytes(receiptValue);
      await writeFile(path.join(root, ...receiptPath.split("/")), receiptBytes);
      pack.artifacts.push({
        path: receiptPath,
        kind: "server_sun_receipt",
        media_type: "application/json",
        sha256: digest(receiptBytes),
      });
      const observation = { observation: state, receipt_artifact: receiptPath };
      if (state === "intact") {
        const photoPath = "photos/sample-02-intact.png";
        const photoBytes = await sharp({
          create: { width: 2, height: 1, channels: 3, background: { r: 80, g: 30, b: 190 } },
        }).png().toBuffer();
        await writeFile(path.join(root, ...photoPath.split("/")), photoBytes);
        pack.artifacts.push({
          path: photoPath,
          kind: "physical_photo",
          media_type: "image/png",
          metadata_sanitized: true,
          sample_ref: "sample-02",
          observation: "intact",
          captured_at: receiptValue.captured_at,
          sha256: digest(photoBytes),
        });
        observation.photo_artifact = photoPath;
      }
      secondObservations.push(observation);
    }
    pack.scope.expected_sample_count = 2;
    pack.samples.push({
      sample_ref: "sample-02",
      uid_fingerprint: fingerprint,
      sacrificial: false,
      observations: secondObservations,
    });
    await writePackManifest(root, pack);

    const result = await validatePhysicalNfcEvidencePack(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((entry) => entry.code === "sanitized_manifest_uid_fingerprint_duplicate"));
    assert.ok(result.errors.some((entry) => entry.code === "sample_uid_fingerprint_duplicate"));
  });
});

test("artifact digest tampering and undeclared files fail closed", async () => {
  await withPack({}, async ({ root }) => {
    await writeFile(path.join(root, "receipts", "sample-01-intact.json"), "{}\n");
    await writeFile(path.join(root, "undeclared.txt"), "must not be ignored\n");
    const result = await validatePhysicalNfcEvidencePack(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((entry) => entry.code === "artifact_digest_mismatch"));
    assert.ok(result.errors.some((entry) => entry.code === "undeclared_artifact_rejected"));
  });
});

test("photo evidence rejects EXIF/XMP-bearing phone files until metadata is stripped", async () => {
  const exifJpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10]),
    Buffer.from("Exif\u0000\u0000GPS", "latin1"),
    Buffer.from([0xff, 0xd9]),
  ]);
  await withPack({ photoBytes: exifJpeg, photoExtension: "jpg", photoMediaType: "image/jpeg" }, async ({ root }) => {
    const result = await validatePhysicalNfcEvidencePack(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((entry) => entry.code === "photo_metadata_or_format_rejected"));
  });
});

test("JPEG sanitizer scans through entropy data and rejects metadata after the first scan", async () => {
  const cleanJpeg = await sharp({
    create: { width: 3, height: 2, channels: 3, background: { r: 14, g: 90, b: 210 } },
  }).jpeg().toBuffer();
  const eoiOffset = cleanJpeg.lastIndexOf(Buffer.from([0xff, 0xd9]));
  assert.ok(eoiOffset > 0);
  for (const [marker, payload] of [
    [0xfe, Buffer.from("hidden", "latin1")],
    [0xe1, Buffer.from("Exif\u0000\u0000camera=opaque", "latin1")],
  ]) {
    const header = Buffer.alloc(4);
    header[0] = 0xff;
    header[1] = marker;
    header.writeUInt16BE(payload.length + 2, 2);
    const jpegWithPostScanMetadata = Buffer.concat([
      cleanJpeg.subarray(0, eoiOffset),
      header,
      payload,
      cleanJpeg.subarray(eoiOffset),
    ]);
    await withPack({
      photoBytes: jpegWithPostScanMetadata,
      photoExtension: "jpg",
      photoMediaType: "image/jpeg",
    }, async ({ root }) => {
      const result = await validatePhysicalNfcEvidencePack(root);
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((entry) => entry.code === "photo_metadata_or_format_rejected"));
    });
  }
});

test("photo validation rejects malformed codecs, corrupt PNG CRC and recognizable embedded secrets", async () => {
  const malformedJpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    Buffer.from("not-a-decodable-photo", "latin1"),
    Buffer.from([0xff, 0xd9]),
  ]);
  await withPack({ photoBytes: malformedJpeg, photoExtension: "jpg", photoMediaType: "image/jpeg" }, async ({ root }) => {
    const result = await validatePhysicalNfcEvidencePack(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((entry) => entry.code === "photo_metadata_or_format_rejected"));
  });

  const corruptPng = Buffer.from(CLEAN_PNG);
  corruptPng[45] ^= 1;
  await withPack({ photoBytes: corruptPng }, async ({ root }) => {
    const result = await validatePhysicalNfcEvidencePack(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((entry) => entry.code === "photo_metadata_or_format_rejected"));
  });

  const cleanJpeg = await sharp({
    create: { width: 2, height: 2, channels: 3, background: { r: 0, g: 120, b: 220 } },
  }).jpeg().toBuffer();
  const jpegWithSecretTrailer = Buffer.concat([
    cleanJpeg,
    Buffer.from(" Authorization: Bearer enterprise-secret UID=04AABBCCDDEEFF", "latin1"),
  ]);
  await withPack({ photoBytes: jpegWithSecretTrailer, photoExtension: "jpg", photoMediaType: "image/jpeg" }, async ({ root }) => {
    const result = await validatePhysicalNfcEvidencePack(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((entry) => entry.code === "photo_metadata_or_format_rejected"));
  });
});

test("bounded decoder preserves sanitized JPEG and WebP evidence", async () => {
  const source = {
    create: { width: 2, height: 2, channels: 3, background: { r: 20, g: 140, b: 60 } },
  };
  for (const fixture of [
    { bytes: await sharp(source).jpeg().toBuffer(), extension: "jpg", mediaType: "image/jpeg" },
    { bytes: await sharp(source).jpeg({ progressive: true }).toBuffer(), extension: "progressive.jpg", mediaType: "image/jpeg" },
    { bytes: await sharp(source).webp().toBuffer(), extension: "webp", mediaType: "image/webp" },
  ]) {
    await withPack({
      photoBytes: fixture.bytes,
      photoExtension: fixture.extension,
      photoMediaType: fixture.mediaType,
    }, async ({ root }) => {
      const result = await validatePhysicalNfcEvidencePack(root);
      assert.equal(result.ok, true, JSON.stringify(result.errors));
    });
  }
});

test("opened electronic evidence is impossible for plain NTAG 424 DNA", async () => {
  await withPack({ tagTamper: true }, async ({ root, pack }) => {
    pack.scope.carrier_profile_code = "ntag424_dna";
    const intactPath = "receipts/sample-01-intact.json";
    const intact = JSON.parse(await readFile(path.join(root, ...intactPath.split("/")), "utf8"));
    intact.verification_result = "valid";
    await rewriteJsonArtifact(root, pack, intactPath, intact);

    const result = await validatePhysicalNfcEvidencePack(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((entry) => entry.code === "opened_observation_requires_tagtamper"));
    assert.ok(result.errors.some((entry) => entry.code === "sun_receipt_result_invalid"));
    assert.equal(result.tagtamper_physical_certification, false);
  });
});

test("receipt and photo timestamps must remain inside a non-future ceremony window", async () => {
  await withPack({}, async ({ root, pack }) => {
    pack.ceremony.performed_at = "2026-01-01T11:00:00.000Z";
    await writePackManifest(root, pack);
    const outsideWindow = await validatePhysicalNfcEvidencePack(root, { now: Date.parse("2026-01-02T00:00:00.000Z") });
    assert.equal(outsideWindow.ok, false);
    assert.ok(outsideWindow.errors.some((entry) => entry.code === "sun_receipt_outside_ceremony_window"));
    assert.ok(outsideWindow.errors.some((entry) => entry.code === "sample_photo_outside_ceremony_window"));

    pack.ceremony.performed_at = "2099-01-01T12:05:00.000Z";
    await writePackManifest(root, pack);
    const future = await validatePhysicalNfcEvidencePack(root, { now: Date.parse("2026-01-02T00:00:00.000Z") });
    assert.equal(future.ok, false);
    assert.ok(future.errors.some((entry) => entry.code === "ceremony_timestamp_in_future"));

    pack.ceremony.performed_at = "2026-02-30T12:05:00.000Z";
    await writePackManifest(root, pack);
    const impossibleCalendarDate = await validatePhysicalNfcEvidencePack(root);
    assert.equal(impossibleCalendarDate.ok, false);
    assert.ok(impossibleCalendarDate.errors.some((entry) => entry.code === "ceremony_timestamp_invalid"));
  });
});

test("static directory links and excessive directory depth fail closed before artifact reads", async () => {
  const external = await mkdtemp(path.join(tmpdir(), "nexid-physical-external-"));
  try {
    await writeFile(path.join(external, "outside.json"), "{}\n");
    await withPack({}, async ({ root }) => {
      const linkedRoot = path.join(external, "pack-root-link");
      await symlink(root, linkedRoot, "junction");
      const linked = await validatePhysicalNfcEvidencePack(linkedRoot);
      assert.equal(linked.ok, false);
      assert.ok(linked.errors.some((entry) => entry.code === "evidence_pack_directory_invalid"));
    });
    await withPack({}, async ({ root }) => {
      await symlink(external, path.join(root, "escape"), "junction");
      const linked = await validatePhysicalNfcEvidencePack(root);
      assert.equal(linked.ok, false);
      assert.ok(linked.errors.some((entry) => entry.code === "symbolic_link_rejected"));
    });
    await withPack({}, async ({ root }) => {
      let nested = root;
      for (let index = 0; index < 10; index += 1) {
        nested = path.join(nested, `depth-${index}`);
        await mkdir(nested);
      }
      const deep = await validatePhysicalNfcEvidencePack(root);
      assert.equal(deep.ok, false);
      assert.ok(deep.errors.some((entry) => entry.code === "evidence_pack_directory_depth_exceeded"));
    });
  } finally {
    const resolved = path.resolve(external);
    assert.ok(resolved.startsWith(path.resolve(tmpdir())), "external fixture cleanup must remain in OS temp");
    await rm(resolved, { recursive: true, force: true });
  }
});

test("package integration requires the real filled-package context but still cannot self-certify", async () => {
  await withPack({ ceremonyScope: "package_integration" }, async ({ root }) => {
    const result = await validatePhysicalNfcEvidencePack(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((entry) => entry.code === "physical_context_filled_package_required"));
    assert.equal(result.physical_ceremony_verified, false);
  });
  await withPack({
    ceremonyScope: "package_integration",
    physicalContext: {
      package_type: "filled_hdpe_bottle",
      substrate: "hdpe_cap",
      placement: "cap_bridge",
      application_method: "manual_pilot",
      filled_package: true,
    },
  }, async ({ root }) => {
    const result = await validatePhysicalNfcEvidencePack(root);
    assert.equal(result.ok, true);
    assert.equal(result.packaging_integration_evidence_present, true);
    assert.equal(result.physical_ceremony_verified, false);
    assert.equal(result.production_lot_accepted, false);
  });
});

test("plain NTAG 424 DNA cannot declare a TagTamper opening bridge", async () => {
  await withPack({
    ceremonyScope: "package_integration",
    physicalContext: {
      package_type: "filled_hdpe_bottle",
      substrate: "hdpe_cap",
      placement: "cap_bridge",
      application_method: "manual_pilot",
      filled_package: true,
      tagtamper_bridges_opening: true,
    },
  }, async ({ root }) => {
    const result = await validatePhysicalNfcEvidencePack(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((entry) => entry.code === "physical_context_tagtamper_not_allowed_for_plain_carrier"));
  });
});

test("CLI remains local-only and does not import database, SUN crypto or cloud custody modules", async () => {
  const source = await readFile(new URL("../scripts/validate-physical-nfc-evidence-pack.mjs", import.meta.url), "utf8");
  const validator = await readFile(new URL("../scripts/lib/physical-nfc-evidence-pack.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(`${source}\n${validator}`, /from\s+["'][^"']*(?:\/db|sun-service|sun-crypto|\/keys)[^"']*["']/);
  assert.doesNotMatch(`${source}\n${validator}`, /\bfetch\s*\(/);
  assert.doesNotMatch(`${source}\n${validator}`, /physical_ceremony_verified:\s*true|physical_tag_certification:\s*true|hsm_backed:\s*true/);
  assert.match(validator, /handle\s*=\s*await open\(file\.absolute, "r"\)/);
  assert.match(validator, /await handle\.stat\(\{ bigint: true \}\)/);
  assert.match(validator, /sameSnapshot\(opened, afterHandle\)/);
  assert.match(validator, /isWithinRoot\(root, afterRealpath\)/);
  assert.match(source, /physical_evidence_pack_validation_failed/);
});

test("CLI validates a complete local pack and preserves non-certification output", async () => {
  await withPack({}, async ({ root }) => {
    const cli = fileURLToPath(new URL("../scripts/validate-physical-nfc-evidence-pack.mjs", import.meta.url));
    const result = spawnSync(process.execPath, [cli, `--pack=${root}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15_000,
    });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.review_status, "eligible_for_manual_review");
    assert.equal(output.physical_tag_certification, false);
    assert.equal(output.manual_identity_and_custody_review_required, true);
  });
});
