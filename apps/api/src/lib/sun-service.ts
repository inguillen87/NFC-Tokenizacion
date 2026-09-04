import { sql } from './db';
import { randomUUID } from 'node:crypto';
import { decryptKey16 } from './keys';
import { DEFAULT_SUN_MAC_INPUT_MODE, SUN_MAC_INPUT_MODES, type SunMacInputMode, verifySun } from './crypto/sdm';
import { publishTenantTapRealtimeProjection } from './realtime-tap-projection';
import { decodeTTStatus, parseTTStatusFromDecryptedPayload } from './ttstatus';
import { evaluateSecurityAlerts } from './alert-engine';
import { buildSunPayloadHashes } from './sun-payload.ts';
import { findRegisteredSunPayload } from './sun-payload-registry.ts';
import { persistSunScanAtomically } from './sun-atomic-persistence.ts';
import { normalizeCoordinatePair, redactSensitiveQueryValues } from './approximate-location.ts';
import { lifecycleResultOverride, normalizeTagLifecycleState } from './tag-lifecycle.ts';
import {
  buildSupplierQaVerificationContext,
  normalizeSupplierQaPackPurpose,
  type SupplierQaPackPurpose,
} from './supplier-qa-verification-context.ts';
import {
  carrierSupportsTagTamper,
  resolveAuthenticatedCarrierState,
  resolveSunSecureCarrierProfile,
} from './sun-carrier-trust-state.ts';

const AUTHENTIC_SCAN_RESULTS = new Set([
  "VALID",
  "TAP_VALID",
  "VALID_AUTHENTIC",
  "VALID_CLOSED",
  "VALID_UNKNOWN_TAMPER",
  "OPENED",
  "OPENED_PREVIOUSLY",
  "MANUAL_OPENED",
  "VALID_OPENED",
  "VALID_OPENED_PREVIOUSLY",
  "VALID_MANUAL_OPENED",
]);

const PUBLIC_SUN_REDACTED_FIELDS = [
  "picc_data_decrypted",
  "sdm_enc_decrypted",
  "uid_candidate",
  "picc_candidates",
  "cmac_candidates",
  "expected_cmac",
  "actual_cmac",
] as const;

export type ScanContext = {
  ip?: string | null;
  userAgent?: string | null;
  city?: string | null;
  countryCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  deviceLabel?: string | null;
  source?: 'real' | 'demo' | 'imported';
  meta?: Record<string, unknown>;
  forceResult?: string;
  requestId?: string;
};

export type SunScanSideEffectMode = "persist" | "dry_run";

export function shouldPersistSunScanState(mode: unknown) {
  // Omitted preserves the production scan contract. Once a caller opts into
  // this control, only the exact persist value may enable state mutations.
  return mode === undefined || mode === "persist";
}

export function resolveSunReplayExecutionClass(source: ScanContext["source"] | null | undefined) {
  return source === "demo" ? "demo" as const : "operational" as const;
}

type TTStatusProductState =
  | "VALID_CLOSED"
  | "VALID_OPENED"
  | "VALID_OPENED_PREVIOUSLY"
  | "VALID_UNKNOWN_TAMPER";

type ProductState =
  | "VALID_AUTHENTIC"
  | "VALID_CLOSED"
  | "VALID_OPENED"
  | "VALID_OPENED_PREVIOUSLY"
  | "VALID_UNKNOWN_TAMPER"
  | "VALID_MANUAL_OPENED"
  | "TAMPER_RISK"
  | "REPLAY_SUSPECT"
  | "SUN_PROFILE_MISMATCH"
  | "SUN_BATCH_DUPLICATE_CONFIG"
  | "INVALID"
  | "NOT_REGISTERED"
  | "NOT_ACTIVE"
  | "UNKNOWN_BATCH"
  | "MALFORMED_URL";

export type TamperProfile = {
  chip_model: string;
  tagtamper_enabled: boolean;
  tamper_status_enabled: boolean;
  tamper_status_source: "enc_decrypted" | "picc_data_decrypted" | "none";
  tamper_status_offset: number | null;
  tamper_status_length: number | null;
  tamper_closed_values: string[];
  tamper_open_values: string[];
  tamper_unknown_policy: "UNKNOWN" | "DO_NOT_DISPLAY";
  tamper_notes: string;
  ttstatus_enabled: boolean;
  ttstatus_source: "enc_decrypted" | "picc_data_decrypted" | "none";
  ttstatus_offset: number | null;
  ttstatus_length: 2;
  ttstatus_plain_or_encrypted: "plain" | "encrypted";
  ttstatus_notes: string | null;
  ttstatus_closed_values: string[];
  ttstatus_opened_values: string[];
  ttstatus_invalid_values: string[];
};

export function resolveTamperProfile(raw: unknown): TamperProfile {
  const cfg = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {};
  const sourceRaw = String(cfg.ttstatus_source || cfg.tamper_status_source || "none").toLowerCase();
  const source = (() => {
    if (sourceRaw === "enc" || sourceRaw === "decrypted_sdm" || sourceRaw === "enc_decrypted") return "enc_decrypted";
    if (sourceRaw === "picc_data" || sourceRaw === "picc_data_decrypted") return "picc_data_decrypted";
    return "none";
  })() as TamperProfile["tamper_status_source"];
  const normalizeValues = (values: unknown, fallback: string[]) => {
    const rawValues = Array.isArray(values) ? values : fallback;
    return rawValues.map((x) => String(x).trim().toUpperCase()).filter(Boolean);
  };
  const ttClosed = normalizeValues(cfg.ttstatus_closed_values, ["4343"]);
  const ttOpened = normalizeValues(cfg.ttstatus_opened_values, ["4F4F", "4F43"]);
  const ttInvalid = normalizeValues(cfg.ttstatus_invalid_values, ["4949"]);
  const closed = normalizeValues(cfg.tamper_closed_values, ttClosed);
  const opened = normalizeValues(cfg.tamper_open_values, ttOpened);
  const offsetRaw = Number(cfg.ttstatus_offset ?? cfg.tamper_status_offset);
  const lengthRaw = Number(cfg.ttstatus_length ?? cfg.tamper_status_length);
  const unknownPolicyRaw = String(cfg.tamper_unknown_policy || "UNKNOWN").toUpperCase();
  const isTagTamperDefault = /tag.?tamper|424.*(?:dna.*)?(?:_|-|\s)tt$/i.test(String(cfg.chip_model || ""));
  return {
    chip_model: String(cfg.chip_model || "unknown"),
    tagtamper_enabled: Boolean(cfg.tagtamper_enabled ?? isTagTamperDefault),
    tamper_status_enabled: Boolean(cfg.tamper_status_enabled ?? cfg.ttstatus_enabled ?? false),
    tamper_status_source: source,
    tamper_status_offset: Number.isInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : null,
    tamper_status_length: Number.isInteger(lengthRaw) && lengthRaw > 0 ? lengthRaw : 2,
    tamper_closed_values: closed,
    tamper_open_values: opened,
    tamper_unknown_policy: (["UNKNOWN", "DO_NOT_DISPLAY"].includes(unknownPolicyRaw) ? unknownPolicyRaw : "UNKNOWN") as TamperProfile["tamper_unknown_policy"],
    tamper_notes: String(cfg.tamper_notes || cfg.notes || ""),
    ttstatus_enabled: Boolean(cfg.ttstatus_enabled ?? cfg.tamper_status_enabled ?? false),
    ttstatus_source: source,
    ttstatus_offset: Number.isInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : null,
    ttstatus_length: 2,
    ttstatus_plain_or_encrypted: String(cfg.ttstatus_plain_or_encrypted || "encrypted").toLowerCase() === "plain" ? "plain" : "encrypted",
    ttstatus_notes: cfg.ttstatus_notes ? String(cfg.ttstatus_notes) : null,
    ttstatus_closed_values: ttClosed,
    ttstatus_opened_values: ttOpened,
    ttstatus_invalid_values: ttInvalid,
  };
}

export function summarizeBatchSdmConfig(raw: unknown) {
  const cfg = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {};
  const profile = resolveTamperProfile(cfg);
  return {
    chip_model: profile.chip_model,
    carrier_profile_code: typeof cfg.carrier_profile_code === "string" ? cfg.carrier_profile_code : null,
    mac_input: typeof cfg.mac_input === "string" ? cfg.mac_input : null,
    mac_input_candidates: Array.isArray(cfg.mac_input_candidates)
      ? cfg.mac_input_candidates.map((x) => String(x)).filter(Boolean)
      : [],
    url_template: typeof cfg.url_template === "string" ? cfg.url_template : null,
    tagtamper_enabled: profile.tagtamper_enabled,
    tamper_status_enabled: profile.tamper_status_enabled,
    tamper_status_source: profile.tamper_status_source,
    tamper_status_offset: profile.tamper_status_offset,
    tamper_status_length: profile.tamper_status_length,
    ttstatus_enabled: profile.ttstatus_enabled,
    ttstatus_source: profile.ttstatus_source,
    ttstatus_offset: profile.ttstatus_offset,
    ttstatus_length: profile.ttstatus_length,
    ttstatus_closed_values: profile.ttstatus_closed_values,
    ttstatus_opened_values: profile.ttstatus_opened_values,
    ttstatus_invalid_values: profile.ttstatus_invalid_values,
  };
}

export function resolveConfiguredMacInputModes(raw: unknown): SunMacInputMode[] {
  const cfg = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {};
  const rawCandidates = Array.isArray(cfg.mac_input_candidates) ? cfg.mac_input_candidates : [];
  const firstMode = typeof cfg.mac_input === "string" ? cfg.mac_input : DEFAULT_SUN_MAC_INPUT_MODE;
  const supported = new Set<string>(SUN_MAC_INPUT_MODES);
  const modes: SunMacInputMode[] = [];
  for (const value of [firstMode, ...rawCandidates]) {
    const mode = String(value || "").trim();
    if (supported.has(mode) && !modes.includes(mode as SunMacInputMode)) {
      modes.push(mode as SunMacInputMode);
    }
  }
  return modes.length ? modes : [DEFAULT_SUN_MAC_INPUT_MODE];
}

export function resolveSelectedMacInputModes(raw: unknown): SunMacInputMode[] {
  const cfg = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {};
  const mode = typeof cfg.mac_input === "string" ? cfg.mac_input.trim() : DEFAULT_SUN_MAC_INPUT_MODE;
  return SUN_MAC_INPUT_MODES.includes(mode as SunMacInputMode)
    ? [mode as SunMacInputMode]
    : [DEFAULT_SUN_MAC_INPUT_MODE];
}

function asPlainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function resolveEffectiveSupplierQaPackPurpose(
  supplierOrderId: unknown,
  declaredPurpose: unknown,
): Promise<SupplierQaPackPurpose | null> {
  const normalizedDeclared = normalizeSupplierQaPackPurpose(declaredPurpose);
  if (normalizedDeclared && normalizedDeclared !== "legacy_unclassified") return normalizedDeclared;

  const normalizedOrderId = String(supplierOrderId || "").trim();
  if (!normalizedOrderId) return normalizedDeclared;

  try {
    const capability = await sql/*sql*/`
      SELECT to_regprocedure('public.nexid_effective_supplier_pack_purpose_v1(uuid)') IS NOT NULL AS available
    `;
    if (capability[0]?.available !== true) return normalizedDeclared;

    const rows = await sql/*sql*/`
      SELECT public.nexid_effective_supplier_pack_purpose_v1(${normalizedOrderId}::uuid) AS effective_pack_purpose
    `;
    return normalizeSupplierQaPackPurpose(rows[0]?.effective_pack_purpose) || normalizedDeclared;
  } catch {
    // Supplier purpose is an additional QA consistency binding. Its optional
    // lookup must never weaken or make the physical SUN verifier unavailable;
    // a missing value leaves QA fail-closed because no context digest is made.
    return normalizedDeclared;
  }
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
    if (text) return text;
  }
  return null;
}

function resolveBatchProductName(batch: Record<string, unknown> | null | undefined) {
  const cfg = asPlainRecord(batch?.sdm_config);
  const sun = asPlainRecord(cfg.sun);
  const product = asPlainRecord(sun.product);
  return firstText(
    cfg.product_name,
    cfg.productName,
    product.name,
    cfg.sku,
    product.sku,
  );
}

function resolveTamperSignal() {
  // Public query parameters and request metadata are attacker-controlled and
  // therefore never establish a seal state. Electronic tamper comes only from
  // the complete two-byte TTStatus decrypted below; manual evidence comes from
  // the privileged, audited override store.
  return { opened: false, tamper: false, raw: null as string | null };
}

export async function processSunScan(input: {
  bid: string;
  piccDataHex: string;
  encHex: string;
  cmacHex: string;
  /** Optional server-authenticated tenant boundary for SDK/BFF callers. */
  expectedTenantId?: string;
  rawQuery?: Record<string, string>;
  context?: ScanContext;
  sideEffectMode?: SunScanSideEffectMode;
}) {
  const persistScanState = shouldPersistSunScanState(input.sideEffectMode);
  const replayExecutionClass = resolveSunReplayExecutionClass(input.context?.source);
  const scanHashes = buildSunPayloadHashes(input);
  const requestId = input.context?.requestId || randomUUID();
  input.context = { ...input.context, requestId };
  let replayOriginalEventId: number | null = null;

  async function sunStateSql(strings: TemplateStringsArray, ...values: unknown[]) {
    if (!persistScanState) return [];
    return sql(strings, ...values);
  }

  async function getManualTamperOverride(uidHex: string | null) {
    if (!uidHex) return null;
    const rows = await sql/*sql*/`
      SELECT tamper_status, reason, evidence_note, source
      FROM tag_manual_tamper_overrides
      WHERE batch_id = ${batch.id} AND uid_hex = ${uidHex}
      LIMIT 1
    `;
    return rows[0] || null;
  }
  async function logUnassignedAttempt(reason: string) {
    try {
      const persistedRawQuery = redactSensitiveQueryValues(input.rawQuery) || {};
      const coordinate = normalizeCoordinatePair(input.context?.lat, input.context?.lng);
      await sunStateSql/*sql*/`
        INSERT INTO sun_scan_attempts (
          bid, result, reason, ip, user_agent, geo_city, geo_country, geo_lat, geo_lng, source, raw_query, meta
        ) VALUES (
          ${input.bid},
          'UNASSIGNED_ATTEMPT',
          ${reason},
          ${input.context?.ip || null},
          ${input.context?.userAgent || null},
          ${input.context?.city || null},
          ${input.context?.countryCode || null},
          ${coordinate?.lat ?? null},
          ${coordinate?.lng ?? null},
          ${input.context?.source || 'real'},
          ${JSON.stringify(persistedRawQuery)}::jsonb,
          ${JSON.stringify({ warning: 'batch_not_found_or_revoked', context: input.context?.meta || {} })}::jsonb
        )
      `;
    } catch {
      // best effort logging for unknown/revoked batch attempts
    }
  }

  const expectedTenantId = String(input.expectedTenantId || "").trim() || null;
  const batchRows = await sql/*sql*/`
    SELECT
      b.id,
      b.tenant_id,
      t.slug AS tenant_slug,
      t.name AS tenant_name,
      b.status,
      b.meta_key_ct,
      b.file_key_ct,
      b.sdm_config,
      b.carrier_profile_code,
      b.created_at,
      supplier_context.supplier_order_id,
      supplier_context.declared_pack_purpose,
      supplier_context.supplier_sub_batch_id,
      supplier_context.key_fingerprint,
      supplier_context.manifest_hash,
      supplier_context.supplier_sub_batch_status,
      supplier_context.key_export_count,
      supplier_context.key_exported_at,
      supplier_context.batch_key_export_count,
      supplier_context.batch_key_exported_at,
      supplier_context.packaging_spec_revision,
      supplier_context.packaging_spec_hash,
      supplier_context.packaging_governance_status
    FROM batches b
    LEFT JOIN tenants t ON t.id = b.tenant_id
    LEFT JOIN LATERAL (
      SELECT
        so.id AS supplier_order_id,
        NULLIF(lower(trim(to_jsonb(so)->>'pack_purpose')), '') AS declared_pack_purpose,
        ssb.id AS supplier_sub_batch_id,
        bk.key_fingerprint,
        ssb.manifest_hash,
        ssb.status AS supplier_sub_batch_status,
        ssb.key_export_count,
        to_char(ssb.key_exported_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS key_exported_at,
        bk.export_count AS batch_key_export_count,
        to_char(bk.exported_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS batch_key_exported_at,
        so.packaging_spec_revision,
        so.packaging_spec_hash,
        so.packaging_governance_status
      FROM supplier_sub_batches ssb
      JOIN supplier_orders so
        ON so.id = ssb.supplier_order_id
       AND so.tenant_id = ssb.tenant_id
      JOIN batch_keys bk
        ON bk.supplier_sub_batch_id = ssb.id
       AND bk.batch_id = ssb.batch_id
       AND bk.tenant_id = ssb.tenant_id
       AND bk.bid = ssb.bid
       AND bk.status = 'active'
      WHERE ssb.batch_id = b.id
        AND ssb.tenant_id = b.tenant_id
        AND ssb.bid = b.bid
      ORDER BY ssb.created_at DESC, ssb.id DESC
      LIMIT 1
    ) supplier_context ON true
    WHERE b.bid = ${input.bid}
      AND (${expectedTenantId}::uuid IS NULL OR b.tenant_id = ${expectedTenantId}::uuid)
    ORDER BY b.created_at ASC, b.id ASC
  `;
  if (batchRows.length > 1) {
    const duplicateBatches = batchRows.map((row) => ({
      id: row.id,
      tenant_slug: row.tenant_slug || null,
      status: row.status || null,
      created_at: row.created_at || null,
      batch_sdm_config: summarizeBatchSdmConfig(row.sdm_config),
    }));
    console.error("[sun_batch_duplicate_config]", JSON.stringify({
      requestId,
      bid: input.bid,
      count: batchRows.length,
      batches: duplicateBatches,
    }));
    return {
      status: 409,
      body: {
        ok: false,
        request_id: requestId,
        reason: "duplicate batch bid configuration",
        result: "SUN_BATCH_DUPLICATE_CONFIG",
        auth_status: "SUN_BATCH_DUPLICATE_CONFIG",
        product_state: "SUN_BATCH_DUPLICATE_CONFIG",
        bid: input.bid.trim().toUpperCase(),
        sun_diagnostics: {
          traceId: requestId,
          bid: input.bid,
          result: "SUN_BATCH_DUPLICATE_CONFIG",
          status: 409,
          side_effect_mode: persistScanState ? "persist" : "dry_run",
          duplicate_batches: duplicateBatches,
          batch_sdm_config: null,
        },
      },
    };
  }
  const batch = batchRows[0];
  if (!batch) {
    await logUnassignedAttempt('unknown batch');
    return {
      status: 404,
      body: {
        ok: false,
        request_id: requestId,
        result: 'UNKNOWN_BATCH',
        auth_status: 'UNKNOWN_BATCH',
        product_state: 'UNKNOWN_BATCH',
        reason: 'unknown batch',
        bid: input.bid.trim().toUpperCase(),
      },
    };
  }
  if (batch.status === 'revoked') {
    await logUnassignedAttempt('batch revoked');
    return {
      status: 403,
      body: {
        ok: false,
        request_id: requestId,
        result: 'INVALID',
        auth_status: 'INVALID',
        product_state: 'INVALID',
        reason: 'batch revoked',
        bid: input.bid.trim().toUpperCase(),
      },
    };
  }

  const envelopeKeyVersion = Number((batch.sdm_config as { key_version?: unknown } | null)?.key_version || 1);
  const keyContext = {
    tenantId: String(batch.tenant_id),
    bid: input.bid,
    keyVersion: Number.isSafeInteger(envelopeKeyVersion) && envelopeKeyVersion > 0 ? envelopeKeyVersion : 1,
  };
  const kMeta = decryptKey16(batch.meta_key_ct, { ...keyContext, role: 'K_META_BATCH' }).toString('hex').toUpperCase();
  const kFile = decryptKey16(batch.file_key_ct, { ...keyContext, role: 'K_FILE_BATCH' }).toString('hex').toUpperCase();
  const selectedMacInputModes = resolveSelectedMacInputModes((batch as { sdm_config?: unknown }).sdm_config || {});
  const carrierProfileCode = String(batch.carrier_profile_code || "").trim().toLowerCase();
  const sunCarrierProfileCode = resolveSunSecureCarrierProfile({
    carrierProfileCode,
    sdmConfig: batch.sdm_config,
  });
  const keyFingerprint = String(batch.key_fingerprint || "").trim().toUpperCase();
  const manifestHash = String(batch.manifest_hash || "").trim().toLowerCase();
  const supplierOrderId = String(batch.supplier_order_id || "").trim().toLowerCase();
  const supplierSubBatchId = String(batch.supplier_sub_batch_id || "").trim().toLowerCase();
  const effectivePackPurpose = await resolveEffectiveSupplierQaPackPurpose(
    supplierOrderId,
    batch.declared_pack_purpose,
  );
  const supplierSubBatchStatus = String(batch.supplier_sub_batch_status || "").trim().toLowerCase();
  const packagingGovernanceStatus = String(batch.packaging_governance_status || "").trim().toLowerCase();
  const packagingSpecRevision = Math.trunc(Number(batch.packaging_spec_revision || 0));
  const packagingSpecHash = String(batch.packaging_spec_hash || "").trim().toLowerCase();
  const keyExportCount = Math.trunc(Number(batch.key_export_count || 0));
  const batchKeyExportCount = Math.trunc(Number(batch.batch_key_export_count || 0));
  const keyExportedAt = String(batch.key_exported_at || "").trim() || null;
  const batchKeyExportedAt = String(batch.batch_key_exported_at || "").trim() || null;
  const verificationContext = buildSupplierQaVerificationContext({
    tenantId: batch.tenant_id,
    batchId: batch.id,
    bid: input.bid,
    manifestHash,
    carrierProfileCode,
    keyFingerprint,
    sdmConfig: batch.sdm_config || {},
    supplierOrderId,
    supplierSubBatchId,
    supplierSubBatchStatus,
    batchStatus: batch.status,
    keyExportCount,
    keyExportedAt,
    batchKeyExportCount,
    batchKeyExportedAt,
    packagingGovernanceStatus,
    packagingSpecRevision,
    packagingSpecHash,
    packPurpose: effectivePackPurpose,
  });
  const verificationContextDigest = verificationContext?.verificationContextDigest || null;

  const res = verifySun({
    piccDataHex: input.piccDataHex,
    encHex: input.encHex,
    cmacHex: input.cmacHex,
    kMetaHex: kMeta,
    kFileHex: kFile,
    macInputModes: selectedMacInputModes,
  });

  const registeredPayloadMatch = res.ok
    ? null
    : await findRegisteredSunPayload({
        batchId: String(batch.id),
        hashes: scanHashes,
        ensureSchema: persistScanState,
      }).catch(() => null);
  const resolvedUidHex = res.ok ? res.uidHex : registeredPayloadMatch?.uidHex || null;
  const resolvedCtr = res.ok ? res.ctr : null;
  const cryptographicVerification = Boolean(res.ok);
  const cryptoErrorReason = res.ok ? null : res.reason;
  const supplierPayloadMatch = Boolean(registeredPayloadMatch);
  const supplierPayloadOnly = supplierPayloadMatch && !cryptographicVerification;
  const payloadVerified = cryptographicVerification || supplierPayloadMatch;

  let allowlisted = false;
  let tagStatus: string | null = null;
  let tagLifecycleState: string | null = registeredPayloadMatch?.lifecycleState || null;
  let tagLifecycleRevision = Number(registeredPayloadMatch?.lifecycleRevision || 0);
  let replaySuspect = false;

  // Diagnostics stay mutation-free and may inspect the current snapshot. A
  // persistent scan must not perform these replay reads outside the database
  // transaction; nexid_persist_sun_scan_v1 repeats them after acquiring its
  // per-batch identity lock and the tag row lock.
  if (!persistScanState) {
    const priorPayloadEventRows = await sql/*sql*/`
      SELECT id
      FROM events
      WHERE batch_id = ${batch.id}
        AND (CASE WHEN source::text = 'demo' THEN 'demo' ELSE 'operational' END) = ${replayExecutionClass}
        AND (
          (picc_data_hash = ${scanHashes.piccDataHash} AND cmac_hash = ${scanHashes.cmacHash})
          OR raw_url_hash = ${scanHashes.rawUrlHash}
        )
      ORDER BY created_at ASC, id ASC
      LIMIT 1
    `;
    if (priorPayloadEventRows[0]) {
      replaySuspect = true;
      replayOriginalEventId = Number((priorPayloadEventRows[0] as { id?: number }).id || 0) || null;
    }

    if (res.ok && resolvedUidHex && resolvedCtr != null) {
      const priorCounterEventRows = await sql/*sql*/`
        SELECT id
        FROM events
        WHERE batch_id = ${batch.id}
          AND (CASE WHEN source::text = 'demo' THEN 'demo' ELSE 'operational' END) = ${replayExecutionClass}
          AND UPPER(uid_hex) = UPPER(${resolvedUidHex})
          AND sdm_read_ctr = ${resolvedCtr}
        ORDER BY created_at ASC, id ASC
        LIMIT 1
      `;
      if (priorCounterEventRows[0]) {
        replaySuspect = true;
        replayOriginalEventId = replayOriginalEventId || Number((priorCounterEventRows[0] as { id?: number }).id || 0) || null;
      }
    }

    if (resolvedUidHex) {
      const tagRows = await sql/*sql*/`
        SELECT id, status, lifecycle_state, lifecycle_revision, last_seen_ctr
        FROM tags
        WHERE batch_id = ${batch.id} AND UPPER(uid_hex) = UPPER(${resolvedUidHex})
        LIMIT 1
      `;
      const tag = tagRows[0];
      if (tag || registeredPayloadMatch) {
        allowlisted = true;
        tagStatus = String(tag?.status || registeredPayloadMatch?.tagStatus || registeredPayloadMatch?.payloadStatus || "active");
        tagLifecycleState = String(tag?.lifecycle_state || registeredPayloadMatch?.lifecycleState || tagStatus);
        tagLifecycleRevision = Number(tag?.lifecycle_revision ?? registeredPayloadMatch?.lifecycleRevision ?? 0);
        if (
          replayExecutionClass === "operational"
          && res.ok
          && typeof tag?.last_seen_ctr === 'number'
          && resolvedCtr != null
          && resolvedCtr <= tag.last_seen_ctr
        ) replaySuspect = true;
      }
    }
  }

  const tamperProfile = resolveTamperProfile((batch as { sdm_config?: unknown }).sdm_config || {});
  const tagTamperSupported = carrierSupportsTagTamper(sunCarrierProfileCode);
  const requireTamperEvidence = tagTamperSupported && String(process.env.TAGTAMPER_REQUIRE_EVIDENCE || "1") !== "0";
  const encStatusByteHex = res.ok && typeof res.encPlainHex === "string" && /^[0-9a-f]{2,}$/i.test(res.encPlainHex)
    ? res.encPlainHex.slice(0, 2).toUpperCase()
    : null;
  const tamperSignal = resolveTamperSignal();
  const configuredStatusHex = (() => {
    if (!tamperProfile.tamper_status_enabled || tamperProfile.tamper_status_source === "none") return null;
    const offset = tamperProfile.tamper_status_offset ?? 0;
    const len = tamperProfile.tamper_status_length ?? 2;
    const expectedEnd = offset * 2 + len * 2;
    if (tamperProfile.tamper_status_source === "enc_decrypted" && res.ok && typeof res.encPlainHex === "string" && res.encPlainHex.length >= expectedEnd) {
      return res.encPlainHex.slice(offset * 2, expectedEnd).toUpperCase();
    }
    if (tamperProfile.tamper_status_source === "picc_data_decrypted" && res.ok && typeof res.piccPlainHex === "string" && res.piccPlainHex.length >= expectedEnd) {
      return res.piccPlainHex.slice(offset * 2, expectedEnd).toUpperCase();
    }
    return null;
  })();
  const ttstatusParsed = (() => {
    if (!tagTamperSupported || !tamperProfile.ttstatus_enabled || tamperProfile.ttstatus_source === "none" || tamperProfile.ttstatus_offset == null || !res.ok) return null;
    const payloadHex = tamperProfile.ttstatus_source === "enc_decrypted" ? String(res.encPlainHex || "") : String(res.piccPlainHex || "");
    return parseTTStatusFromDecryptedPayload(payloadHex, tamperProfile.ttstatus_offset, {
      closedValues: tamperProfile.ttstatus_closed_values,
      openedValues: tamperProfile.ttstatus_opened_values,
      invalidValues: tamperProfile.ttstatus_invalid_values,
    });
  })();
  // Backward-compatible alias used by some in-flight branches/deploys.
  const parsedTTStatus = ttstatusParsed;
  const decodedTT = decodeTTStatus(ttstatusParsed?.raw || null);
  const tamperConfigured = Boolean(
    tagTamperSupported
    && (tamperProfile.ttstatus_enabled || tamperProfile.tamper_status_enabled)
    && (tamperProfile.ttstatus_source !== "none" || tamperProfile.tamper_status_source !== "none")
    && (Number.isInteger(tamperProfile.ttstatus_offset) || Number.isInteger(tamperProfile.tamper_status_offset)),
  );
  const tamperStatus = (() => {
    if (!tagTamperSupported) return "UNKNOWN" as const;
    if (ttstatusParsed?.tamper_status === "CLOSED") return "CLOSED" as const;
    if (ttstatusParsed?.tamper_status === "OPENED") return "OPENED" as const;
    if (ttstatusParsed?.tamper_status === "OPENED_PREVIOUSLY") return "OPENED_PREVIOUSLY" as const;
    if (ttstatusParsed?.tamper_status === "INVALID") return "INVALID" as const;
    if (!tamperConfigured) return "UNKNOWN" as const;
    if (!ttstatusParsed?.raw) {
      return "UNKNOWN" as const;
    }
    return "UNKNOWN" as const;
  })();
  const preRegistryResult = cryptographicVerification
    ? resolveAuthenticatedCarrierState({
        carrierProfileCode: sunCarrierProfileCode,
        cryptographicVerification,
        ttProductState: parsedTTStatus?.product_state,
      })
    : null;
  let authStatus = supplierPayloadOnly
    ? 'SUPPLIER_PAYLOAD_ONLY'
    : !cryptographicVerification
      ? 'SUN_PROFILE_MISMATCH'
      : !allowlisted
        ? 'NOT_REGISTERED'
        : tagStatus !== 'active'
          ? 'NOT_ACTIVE'
          : replaySuspect
            ? 'REPLAY_SUSPECT'
            : preRegistryResult || 'VALID';
  let normalizedLifecycleState = normalizeTagLifecycleState(tagLifecycleState || tagStatus);
  const serverLifecycleResult = cryptographicVerification && allowlisted && !replaySuspect
    ? lifecycleResultOverride(normalizedLifecycleState)
    : null;
  let result = serverLifecycleResult || authStatus;
  const manualTamper = tagTamperSupported ? await getManualTamperOverride(resolvedUidHex) : null;
  const manualOpened = String(manualTamper?.tamper_status || "").toUpperCase() === "MANUAL_OPENED" || String(manualTamper?.tamper_status || "").toUpperCase() === "OPENED";
  const resolvedTamperStatus = manualOpened ? "MANUAL_OPENED" as const : tamperStatus;
  const tamperSource = manualOpened ? "manual" as const : (tamperConfigured ? "electronic" as const : "unavailable" as const);

  const successReasonWithoutReplay = serverLifecycleResult
    ? `tag_lifecycle_${normalizedLifecycleState}:administrative_state`
    : manualOpened
    ? `manual_tamper_opened:${String(manualTamper?.reason || "operator_override")}`
    : tamperStatus === "OPENED"
    ? `tagtamper_opened:${ttstatusParsed?.raw || 'ttstatus'}`
    : tamperStatus === "OPENED_PREVIOUSLY"
      ? `tagtamper_opened_previously:${ttstatusParsed?.raw || 'ttstatus'}`
    : requireTamperEvidence && !tamperConfigured
      ? 'tagtamper_unconfigured'
    : supplierPayloadMatch && !cryptographicVerification
      ? `supplier_payload_manifest_match:${cryptoErrorReason || "crypto_decode_failed"}`
    : null;
  let resolvedReason = replaySuspect
    ? 'copied URL / replay suspected'
    : !payloadVerified
      ? cryptoErrorReason
      : successReasonWithoutReplay;
  const verificationMethod = cryptographicVerification
    ? "sun_crypto"
    : supplierPayloadMatch
      ? "supplier_payload_manifest"
      : "sun_crypto_failed";
  const batchSdmConfigSummary = summarizeBatchSdmConfig((batch as { sdm_config?: unknown }).sdm_config || {});
  const productName = resolveBatchProductName(batch as Record<string, unknown>);
  const coordinate = normalizeCoordinatePair(input.context?.lat, input.context?.lng);
  let eventId: number | null = null;

  if (persistScanState) {
    const receipt = await persistSunScanAtomically({
      tenantId: String(batch.tenant_id),
      tenantSlug: (batch as { tenant_slug?: string }).tenant_slug || null,
      batchId: String(batch.id),
      bid: input.bid,
      resolvedUidHex,
      resolvedCtr,
      registeredTagId: registeredPayloadMatch?.tagId || null,
      registeredTagStatus: registeredPayloadMatch?.tagStatus || registeredPayloadMatch?.payloadStatus || null,
      cryptographicVerification,
      payloadVerified,
      supplierPayloadMatch,
      supplierPayloadOnly,
      preRegistryResult,
      forceResult: serverLifecycleResult || input.context?.forceResult || null,
      ttTruth: {
        carrierProfileCode: sunCarrierProfileCode,
        ttRaw: ttstatusParsed?.raw || null,
        claimedProductState: preRegistryResult,
        statusSource: tamperProfile.ttstatus_source,
        statusOffset: tamperProfile.ttstatus_offset,
        statusLength: tamperProfile.ttstatus_length,
      },
      reasonIfNotReplay: !payloadVerified ? cryptoErrorReason : successReasonWithoutReplay,
      source: input.context?.source || 'real',
      userAgent: input.context?.userAgent,
      city: input.context?.city,
      countryCode: input.context?.countryCode,
      lat: coordinate?.lat ?? null,
      lng: coordinate?.lng ?? null,
      ip: input.context?.ip,
      geoCity: input.context?.city,
      geoCountry: input.context?.countryCode,
      deviceLabel: input.context?.deviceLabel,
      productName,
      piccDataHash: scanHashes.piccDataHash,
      encHash: scanHashes.encHash,
      cmacHash: scanHashes.cmacHash,
      rawUrlHash: scanHashes.rawUrlHash,
      meta: {
        ...(input.context?.meta || {}),
        tag_lifecycle_state: normalizedLifecycleState,
        tag_lifecycle_revision: tagLifecycleRevision,
      },
      rawQuery: input.rawQuery,
    });
    eventId = receipt.eventId;
    result = receipt.finalResult;
    authStatus = receipt.authStatus;
    resolvedReason = receipt.finalReason;
    replaySuspect = receipt.replaySuspect;
    replayOriginalEventId = receipt.replayOriginalEventId;
    allowlisted = receipt.allowlisted;
    tagStatus = receipt.tagStatus;
    tagLifecycleState = receipt.tagLifecycleState || tagLifecycleState;
    tagLifecycleRevision = receipt.tagLifecycleRevision;
    normalizedLifecycleState = normalizeTagLifecycleState(tagLifecycleState || tagStatus);

    // Notifications and alerts are post-commit projections. Their failure must
    // never undo or misreport the canonical tag/event transaction.
    try {
      const projection = await publishTenantTapRealtimeProjection(
        receipt.eventId,
        typeof input.context?.meta?.trace_id === 'string' ? String(input.context.meta.trace_id) : null,
      );
      if (!projection.projected || !projection.distributed) {
        console.warn("[sun_realtime_projection_unavailable]", JSON.stringify({
          eventId: receipt.eventId,
          projected: projection.projected,
          distributed: projection.distributed,
        }));
      }
    } catch (error) {
      console.error("[sun_realtime_projection_failed]", JSON.stringify({
        eventId: receipt.eventId,
        reason: error instanceof Error ? error.name : "unknown_error",
      }));
    }
    void evaluateSecurityAlerts({
      eventId: receipt.eventId,
      tenantId: String(batch.tenant_id),
      tenantSlug: (batch as { tenant_slug?: string }).tenant_slug || null,
      uidHex: resolvedUidHex,
      result: String(receipt.finalResult).toUpperCase(),
      countryCode: input.context?.countryCode || null,
      deviceLabel: input.context?.deviceLabel || null,
    }).catch(() => null);
  }

  const ttStateRaw = ttstatusParsed?.product_state;
  const ttState: TTStatusProductState | null =
    ttStateRaw === "VALID_CLOSED"
    || ttStateRaw === "VALID_OPENED"
    || ttStateRaw === "VALID_OPENED_PREVIOUSLY"
    || ttStateRaw === "VALID_UNKNOWN_TAMPER"
      ? ttStateRaw
      : null;
  const productState: ProductState = (() => {
    if (!cryptographicVerification || supplierPayloadOnly || authStatus === "SUN_PROFILE_MISMATCH") return "SUN_PROFILE_MISMATCH";
    if (authStatus === "NOT_REGISTERED") return "NOT_REGISTERED";
    if (authStatus === "NOT_ACTIVE") return "NOT_ACTIVE";
    if (authStatus === "REPLAY_SUSPECT") return "REPLAY_SUSPECT";
    if (manualOpened || resolvedTamperStatus === "MANUAL_OPENED") return "VALID_MANUAL_OPENED";
    return resolveAuthenticatedCarrierState({
      carrierProfileCode: sunCarrierProfileCode,
      cryptographicVerification,
      ttProductState: ttState,
    });
  })();
  const resolvedTamperOpened =
    resolvedTamperStatus === "OPENED"
    || resolvedTamperStatus === "OPENED_PREVIOUSLY"
    || resolvedTamperStatus === "MANUAL_OPENED"
    || productState === "VALID_OPENED"
    || productState === "VALID_OPENED_PREVIOUSLY"
    || productState === "VALID_MANUAL_OPENED";
  const resolvedTamperRisk = resolvedTamperStatus === "INVALID";

  if (!persistScanState && input.context?.forceResult) result = input.context.forceResult;

  if (eventId && batch) {
    // Async background process for fraud tracking and loyalty syncs
    import('./loyalty-service').then(({ loyaltyFraudGuard, evaluateLoyaltyForTap }) => {
      loyaltyFraudGuard({
        eventId: String(eventId),
        result,
        uidHex: String(resolvedUidHex || input.piccDataHex),
        tenantId: batch.tenant_id
      }).catch(() => null);

      if (payloadVerified && resolvedUidHex) {
        // Safe dispatch. For demo purposes we can map to the expected arg signature.
        evaluateLoyaltyForTap({
          eventId: String(eventId),
          memberId: "anonymous", // Normally we'd extract member info from the context
          program: {}, // Minimal stub to prevent errors since we're hooking it loosely
          event: { result, uid_hex: resolvedUidHex }
        }).catch(() => null);
      }
    }).catch(() => null);
  }
  const maskedUidForLog = resolvedUidHex
    ? `${resolvedUidHex.slice(0, 4)}***${resolvedUidHex.slice(-4)}`
    : null;
  console.info("[sun_tamper_decode]", JSON.stringify({
    bid: input.bid,
    uid_masked: maskedUidForLog,
    read_counter: resolvedCtr,
    cmac_valid: cryptographicVerification,
    supplier_payload_match: supplierPayloadMatch,
    verification_method: verificationMethod,
    crypto_error_reason: cryptoErrorReason,
    sdm_decryption_ok: Boolean(res.ok && res.encPlainHex),
    picc_layout: res.ok ? res.piccLayout || null : null,
    selected_mac_input: res.ok ? res.macInputMode || null : null,
    configured_mac_input_modes: selectedMacInputModes,
    picc_candidate_count: Array.isArray(res.piccCandidates) ? res.piccCandidates.length : 0,
    cmac_candidate_count: Array.isArray(res.cmacCandidates) ? res.cmacCandidates.length : 0,
    enc_plain_hex_length: res.ok && typeof res.encPlainHex === "string" ? res.encPlainHex.length : 0,
    tt_raw: ttstatusParsed?.raw || null,
    tt_perm_hex: ttstatusParsed?.raw?.slice(0, 2) || null,
    tt_curr_hex: ttstatusParsed?.raw?.slice(2, 4) || null,
    tt_perm_status: ttstatusParsed?.perm || null,
    tt_curr_status: ttstatusParsed?.current || null,
    tt_decoded_status: decodedTT.status,
    tt_status_source: tamperProfile.ttstatus_source,
    tt_status_offset: tamperProfile.ttstatus_offset,
    tt_status_length: tamperProfile.ttstatus_length,
    tamper_status: resolvedTamperStatus,
    product_state: productState,
    tag_tamper: {
      status: decodedTT.status,
      raw: ttstatusParsed?.raw || null,
      source: tamperProfile.ttstatus_source,
    },
  }));

  const publicResult = String(result || "").toUpperCase();
  const publicOk = AUTHENTIC_SCAN_RESULTS.has(publicResult);
  const responseStatus = publicOk ? 200 : publicResult === 'REPLAY_SUSPECT' || publicResult === "SUN_BATCH_DUPLICATE_CONFIG" ? 409 : 403;
  const sunDiagnostics = {
    traceId: requestId,
    bid: input.bid,
    result,
    status: responseStatus,
    side_effect_mode: persistScanState ? "persist" : "dry_run",
    sensitive_redacted: true,
    redacted_fields: PUBLIC_SUN_REDACTED_FIELDS,
    crypto_error_reason: cryptoErrorReason || null,
    verification_method: verificationMethod,
    cmac_valid: typeof res.cmacValid === "boolean" ? res.cmacValid : null,
    sdm_decryption_ok: Boolean(res.ok && res.encPlainHex),
    uid_decoded: Boolean(res.ok && res.uidDecoded),
    uid_hex: res.ok ? res.uidHex || resolvedUidHex || null : resolvedUidHex || null,
    uid_candidate_count: Array.isArray(res.piccCandidates) ? res.piccCandidates.length : 0,
    read_counter: resolvedCtr ?? null,
    picc_layout: res.ok ? res.piccLayout || null : null,
    selected_mac_input: res.ok ? res.macInputMode || null : null,
    configured_mac_input_modes: selectedMacInputModes,
    picc_candidate_count: Array.isArray(res.piccCandidates) ? res.piccCandidates.length : 0,
    cmac_candidate_count: Array.isArray(res.cmacCandidates) ? res.cmacCandidates.length : 0,
    enc_plain_hex_length: typeof res.encPlainHex === "string" ? res.encPlainHex.length : 0,
    tt_raw: ttstatusParsed?.raw || null,
    tt_perm_hex: ttstatusParsed?.raw?.slice(0, 2) || null,
    tt_curr_hex: ttstatusParsed?.raw?.slice(2, 4) || null,
    tt_perm_status: ttstatusParsed?.perm || null,
    tt_curr_status: ttstatusParsed?.current || null,
    tt_status_source: tamperProfile.ttstatus_source,
    tt_status_offset: tamperProfile.ttstatus_offset,
    tt_status_length: tamperProfile.ttstatus_length,
    configured_status_hex: configuredStatusHex,
    batch_sdm_config: batchSdmConfigSummary,
    verification_context_domain: verificationContext?.domain || null,
    verification_context_version: verificationContext?.schemaVersion || null,
    verification_context_digest: verificationContextDigest,
    supplier_payload_match: supplierPayloadMatch,
  };
  return {
    status: responseStatus,
    body: {
      ok: publicOk,
      request_id: requestId,
      result,
      side_effect_mode: persistScanState ? "persist" : "dry_run",
      tenant_id: batch.tenant_id,
      tenant_slug: (batch as { tenant_slug?: string }).tenant_slug || undefined,
      tenant_name: (batch as { tenant_name?: string }).tenant_name || undefined,
      carrier_profile_code: sunCarrierProfileCode,
      auth_status: authStatus,
      bid: input.bid,
      uid: resolvedUidHex || undefined,
      ctr: resolvedCtr ?? undefined,
      verification_method: verificationMethod,
      supplier_payload_match: supplierPayloadMatch,
      cryptographic_verification: cryptographicVerification,
      crypto_error_reason: cryptoErrorReason || undefined,
      allowlisted,
      tag_status: tagStatus,
      tag_lifecycle_state: normalizedLifecycleState,
      tag_lifecycle_revision: tagLifecycleRevision,
      lifecycle_evidence_boundary: "Administrative lifecycle can block a verified tag, but it does not replace NFC CMAC/SDM verification or physical TagTamper evidence.",
      tamper_signal: tamperSignal.raw || undefined,
      tamper_opened: resolvedTamperOpened,
      tamper_risk: resolvedTamperRisk,
      tamper_supported: tagTamperSupported,
      tamper_configured: tamperConfigured,
      tamper_status: resolvedTamperStatus,
      tamper_source: tamperSource,
      tamper_raw_value: ttstatusParsed?.raw || null,
      tt_perm_status: ttstatusParsed?.perm || undefined,
      tt_curr_status: ttstatusParsed?.current || undefined,
      ttstatus_raw: ttstatusParsed?.raw || undefined,
      ttstatus_reason: ttstatusParsed?.reason || undefined,
      tamper_reason: manualOpened
        ? "Estado abierto declarado por operador; no es una medición criptográfica del contenido."
        : resolvedTamperStatus === "UNKNOWN"
        ? "NFC message validated. Open/closed TT state is not available for this batch configuration."
        : resolvedTamperStatus === "OPENED"
          ? "NFC message validated; TT reports an open state."
          : resolvedTamperStatus === "INVALID"
            ? "NFC message validated. TTStatus is invalid or not enabled for this batch."
          : resolvedTamperStatus === "OPENED_PREVIOUSLY"
            ? "NFC message validated; TT history reports a previous opening."
          : undefined,
      tag_tamper: {
        available: decodedTT.available,
        verified: cryptographicVerification,
        source: tamperProfile.ttstatus_source === "none" ? tamperProfile.tamper_status_source : tamperProfile.ttstatus_source,
        raw: ttstatusParsed?.raw || null,
        permanent: decodedTT.permanent,
        current: decodedTT.current,
        status: decodedTT.status,
        tampered: decodedTT.tampered,
        current_open: decodedTT.current_open,
      },
      product_state: productState,
      tag_tamper_config_detected: tamperConfigured,
      tag_tamper_evidence_required: requireTamperEvidence,
      enc_plain_status_byte: encStatusByteHex || undefined,
      tamper_status_source: tamperProfile.tamper_status_source,
      tamper_status_offset: tamperProfile.tamper_status_offset ?? undefined,
      tamper_status_length: tamperProfile.tamper_status_length ?? undefined,
      ttstatus_enabled: tamperProfile.ttstatus_enabled,
      ttstatus_source: tamperProfile.ttstatus_source,
      ttstatus_offset: tamperProfile.ttstatus_offset ?? undefined,
      ttstatus_length: tamperProfile.ttstatus_length,
      ttstatus_plain_or_encrypted: tamperProfile.ttstatus_plain_or_encrypted,
      ttstatus_notes: tamperProfile.ttstatus_notes || undefined,
      tamper_closed_values: tamperProfile.tamper_closed_values,
      tamper_open_values: tamperProfile.tamper_open_values,
      tamper_unknown_policy: tamperProfile.tamper_unknown_policy,
      tamper_notes: tamperProfile.tamper_notes || undefined,
      chip_model: tamperProfile.chip_model,
      batch_sdm_config_summary: batchSdmConfigSummary,
      sun_diagnostics: sunDiagnostics,
      reason: resolvedReason || undefined,
      event_id: eventId || undefined,
    },
  };
}
