import { sql } from './db';
import { randomUUID } from 'node:crypto';
import { decryptKey16 } from './keys';
import { DEFAULT_SUN_MAC_INPUT_MODE, SUN_MAC_INPUT_MODES, type SunMacInputMode, verifySun } from './crypto/sdm';
import { publishRealtimeEvent } from './realtime-events';
import { decodeTTStatus, parseTTStatusFromDecryptedPayload } from './ttstatus';
import { recordTapEvent } from './tap-event-service';
import type { NexidEventVerdict } from '@product/core';
import { buildSunPayloadHashes } from './sun-payload.ts';
import { findRegisteredSunPayload } from './sun-payload-registry.ts';

const AUTHENTIC_SCAN_RESULTS = new Set([
  "VALID",
  "TAP_VALID",
  "VALID_CLOSED",
  "VALID_UNKNOWN_TAMPER",
  "OPENED",
  "OPENED_PREVIOUSLY",
  "MANUAL_OPENED",
  "VALID_OPENED",
  "VALID_OPENED_PREVIOUSLY",
  "VALID_MANUAL_OPENED",
]);

const OPENED_SCAN_RESULTS = new Set([
  "OPENED",
  "OPENED_PREVIOUSLY",
  "MANUAL_OPENED",
  "VALID_OPENED",
  "VALID_OPENED_PREVIOUSLY",
  "VALID_MANUAL_OPENED",
]);

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

type TamperState = "opened" | "tamper" | "closed" | null;
type TTStatusProductState =
  | "VALID_CLOSED"
  | "VALID_OPENED"
  | "VALID_OPENED_PREVIOUSLY"
  | "VALID_UNKNOWN_TAMPER";

type ProductState =
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
  const isTagTamperDefault = /424|tag.?tamper|tt/i.test(String(cfg.chip_model || ""));
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

function normalizeTamperValue(input: unknown): TamperState {
  const raw = String(input ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (["open", "opened", "broken", "breach", "open_loop", "loop_open", "open-circuit"].includes(raw)) return "opened";
  if (["ttperm_open", "ttcurr_open", "perm_open", "curr_open"].includes(raw)) return "opened";
  if (["tamper", "tampered", "alert", "alarm", "loop_alert", "suspicious"].includes(raw)) return "tamper";
  if (["ttperm_close", "ttcurr_close", "perm_close", "curr_close"].includes(raw)) return "closed";
  if (["0", "00", "false", "closed", "sealed", "intact", "ok", "clean", "normal"].includes(raw)) return "closed";
  if (["1", "true"].includes(raw)) return "tamper";
  if (/^0b[01]{1,8}$/i.test(raw)) {
    const numeric = Number.parseInt(raw.slice(2), 2);
    return numeric === 0 ? "closed" : (numeric & 0b1) === 1 ? "opened" : "tamper";
  }
  if (/^[0-9a-f]{2}$/i.test(raw)) {
    const numeric = Number.parseInt(raw, 16);
    if (Number.isFinite(numeric)) return numeric === 0 ? "closed" : (numeric & 0x01) === 0x01 ? "opened" : "tamper";
  }
  return null;
}

function resolveTamperSignal(input: { rawQuery?: Record<string, string>; meta?: Record<string, unknown>; encPlainHex?: string; tagTamperEnabled?: boolean }) {
  const query = input.rawQuery || {};
  const nestedMeta = input.meta || {};
  const nfcMeta = typeof nestedMeta.nfc === "object" && nestedMeta.nfc ? (nestedMeta.nfc as Record<string, unknown>) : {};
  const candidates = [
    query.tt_status,
    query.ttstatus,
    query.tt_state,
    query.tts,
    query.tt,
    query.tt_hex,
    query.tt_status_hex,
    query.tamper_status,
    query.tamper_state,
    query.tamper_loop,
    query.loop_status,
    query.loop,
    query.tamper,
    query.ttpermstatus,
    query.ttcurrstatus,
    query.tt_perm_status,
    query.tt_curr_status,
    query.ttperm,
    query.ttcurr,
    query.opened,
    query.open,
    query.seal_status,
    query.seal,
    query.integrity,
    input.meta?.tt_status,
    input.meta?.ttstate,
    input.meta?.tt,
    input.meta?.tamper_state,
    input.meta?.tamper_status,
    input.meta?.tamper,
    input.meta?.ttpermstatus,
    input.meta?.ttcurrstatus,
    input.meta?.tt_perm_status,
    input.meta?.tt_curr_status,
    input.meta?.opened,
    input.meta?.seal_status,
    nfcMeta.tt_status,
    nfcMeta.tamper_status,
    nfcMeta.tamper,
    nfcMeta.ttpermstatus,
    nfcMeta.ttcurrstatus,
    nfcMeta.tt_perm_status,
    nfcMeta.tt_curr_status,
    nfcMeta.opened,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeTamperValue(candidate);
    if (normalized === "opened" || normalized === "tamper") {
      return {
        opened: normalized === "opened",
        tamper: true,
        raw: String(candidate),
      };
    }
  }
  return { opened: false, tamper: false, raw: null as string | null };
}

export async function processSunScan(input: {
  bid: string;
  piccDataHex: string;
  encHex: string;
  cmacHex: string;
  rawQuery?: Record<string, string>;
  context?: ScanContext;
}) {
  const scanHashes = buildSunPayloadHashes(input);
  const requestId = input.context?.requestId || randomUUID();
  input.context = { ...input.context, requestId };
  let replayOriginalEventId: number | null = null;

  async function getManualTamperOverride(uidHex: string | null) {
    if (!uidHex) return null;
    try {
      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS tag_manual_tamper_overrides (
          id bigserial PRIMARY KEY,
          batch_id uuid NOT NULL,
          uid_hex text NOT NULL,
          tamper_status text NOT NULL,
          reason text,
          evidence_note text,
          source text NOT NULL DEFAULT 'operator',
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (batch_id, uid_hex)
        )
      `;
      const rows = await sql/*sql*/`
        SELECT tamper_status, reason, evidence_note, source
        FROM tag_manual_tamper_overrides
        WHERE batch_id = ${batch.id} AND uid_hex = ${uidHex}
        LIMIT 1
      `;
      return rows[0] || null;
    } catch {
      return null;
    }
  }
  async function logUnassignedAttempt(reason: string) {
    try {
      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS sun_scan_attempts (
          id bigserial PRIMARY KEY,
          bid text NOT NULL,
          result text NOT NULL,
          reason text,
          ip inet,
          user_agent text,
          geo_city text,
          geo_country text,
          geo_lat double precision,
          geo_lng double precision,
          source text NOT NULL DEFAULT 'real',
          raw_query jsonb,
          meta jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql/*sql*/`
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
          ${Number.isFinite(input.context?.lat) ? input.context?.lat! : null},
          ${Number.isFinite(input.context?.lng) ? input.context?.lng! : null},
          ${input.context?.source || 'real'},
          ${JSON.stringify(input.rawQuery || {})}::jsonb,
          ${JSON.stringify({ warning: 'batch_not_found_or_revoked', context: input.context?.meta || {} })}::jsonb
        )
      `;
    } catch {
      // best effort logging for unknown/revoked batch attempts
    }
  }

  async function insertEvent(payload: {
    uidHex: string | null;
    ctr: number | null;
    cmacOk: boolean;
    allowlistedValue: boolean;
    tagStatusValue: string | null;
    resultValue: string;
    reasonValue: string | null;
    hasGeoValue: boolean;
  }): Promise<number | null> {
    if (!batch) return null;
    const normalizedResult = String(payload.resultValue || "").toUpperCase();
    const isReplay = normalizedResult === 'REPLAY_SUSPECT';
    const isAuthentic = AUTHENTIC_SCAN_RESULTS.has(normalizedResult);
    const isOpened = OPENED_SCAN_RESULTS.has(normalizedResult);
    const isInvalid = !isAuthentic;
    const riskLevelStr: 'none' | 'low' | 'medium' | 'high' =
      normalizedResult === 'TAMPER_RISK' || isReplay
        ? 'high'
        : isInvalid
          ? 'medium'
          : isOpened
            ? 'low'
            : 'none';
    const verdictByResult: Record<string, NexidEventVerdict> = {
      VALID: "valid",
      TAP_VALID: "valid",
      VALID_CLOSED: "valid",
      VALID_UNKNOWN_TAMPER: "valid",
      OPENED: "valid",
      OPENED_PREVIOUSLY: "valid",
      MANUAL_OPENED: "valid",
      VALID_OPENED: "valid",
      VALID_OPENED_PREVIOUSLY: "valid",
      VALID_MANUAL_OPENED: "valid",
      REPLAY_SUSPECT: "replay_suspect",
      SUN_PROFILE_MISMATCH: "invalid",
      SUN_BATCH_DUPLICATE_CONFIG: "invalid",
      TAMPER_RISK: "tampered",
      NOT_REGISTERED: "not_registered",
      NOT_ACTIVE: "not_active",
      UNKNOWN_BATCH: "unknown_batch",
      REVOKED: "revoked",
      BROKEN: "broken",
      INVALID: "invalid",
    };
    const verdict = verdictByResult[normalizedResult] || "invalid";

    return await recordTapEvent({
      tenantId: batch.tenant_id,
      tenantSlug: (batch as { tenant_slug?: string }).tenant_slug || null,
      batchId: batch.id,
      bid: input.bid,
      uidHex: payload.uidHex,
      source: input.context?.source || 'real',
      eventType: isReplay ? 'REPLAY_SUSPECT' : isInvalid ? 'TAP_INVALID' : 'TAP_VALID',
      verdict,
      riskLevel: riskLevelStr,
      readCounter: payload.ctr,
      sdmReadCtr: payload.ctr,
      cmacOk: payload.cmacOk,
      allowlisted: payload.allowlistedValue,
      tagStatus: payload.tagStatusValue,
      userAgent: input.context?.userAgent,
      city: input.context?.city,
      countryCode: input.context?.countryCode,
      lat: payload.hasGeoValue ? input.context?.lat : null,
      lng: payload.hasGeoValue ? input.context?.lng : null,
      reason: payload.reasonValue,
      piccDataHash: scanHashes.piccDataHash,
      cmacHash: scanHashes.cmacHash,
      rawUrlHash: scanHashes.rawUrlHash,
      meta: {
        ...(input.context?.meta || {}),
        enc_data_hash: scanHashes.encHash,
        replay_original_event_id: replayOriginalEventId,
      },
      traceId: typeof input.context?.meta?.trace_id === 'string' ? String(input.context.meta.trace_id) : null,
      ip: input.context?.ip,
      geoCity: input.context?.city,
      geoCountry: input.context?.countryCode,
      deviceLabel: input.context?.deviceLabel,
      rawQuery: input.rawQuery,
    });
  }

  const batchRows = await sql/*sql*/`
    SELECT b.id, b.tenant_id, t.slug AS tenant_slug, t.name AS tenant_name, b.status, b.meta_key_ct, b.file_key_ct, b.sdm_config, b.created_at
    FROM batches b
    LEFT JOIN tenants t ON t.id = b.tenant_id
    WHERE b.bid = ${input.bid}
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
        bid: input.bid,
        sun_diagnostics: {
          traceId: requestId,
          bid: input.bid,
          result: "SUN_BATCH_DUPLICATE_CONFIG",
          status: 409,
          duplicate_batches: duplicateBatches,
          batch_sdm_config: null,
        },
      },
    };
  }
  const batch = batchRows[0];
  if (!batch) {
    await logUnassignedAttempt('unknown batch');
    return { status: 404, body: { ok: false, reason: 'unknown batch' } };
  }
  if (batch.status === 'revoked') {
    await logUnassignedAttempt('batch revoked');
    return { status: 403, body: { ok: false, reason: 'batch revoked' } };
  }

  const kMeta = decryptKey16(batch.meta_key_ct).toString('hex').toUpperCase();
  const kFile = decryptKey16(batch.file_key_ct).toString('hex').toUpperCase();
  const selectedMacInputModes = resolveSelectedMacInputModes((batch as { sdm_config?: unknown }).sdm_config || {});

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
    : await findRegisteredSunPayload({ batchId: String(batch.id), hashes: scanHashes }).catch(() => null);
  const resolvedUidHex = res.ok ? res.uidHex : registeredPayloadMatch?.uidHex || null;
  const resolvedCtr = res.ok ? res.ctr : null;
  const cryptographicVerification = Boolean(res.ok);
  const cryptoErrorReason = res.ok ? null : res.reason;
  const supplierPayloadMatch = Boolean(registeredPayloadMatch);
  const payloadVerified = cryptographicVerification || supplierPayloadMatch;

  let allowlisted = false;
  let tagStatus: string | null = null;
  let replaySuspect = false;

  const priorPayloadEventRows = await sql/*sql*/`
    SELECT id
    FROM events
    WHERE batch_id = ${batch.id}
      AND (
        (picc_data_hash = ${scanHashes.piccDataHash} AND cmac_hash = ${scanHashes.cmacHash})
        OR raw_url_hash = ${scanHashes.rawUrlHash}
      )
    ORDER BY created_at ASC
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
        AND UPPER(uid_hex) = UPPER(${resolvedUidHex})
        AND sdm_read_ctr = ${resolvedCtr}
      ORDER BY created_at ASC
      LIMIT 1
    `;
    if (priorCounterEventRows[0]) {
      replaySuspect = true;
      replayOriginalEventId = replayOriginalEventId || Number((priorCounterEventRows[0] as { id?: number }).id || 0) || null;
    }
  }

  if (resolvedUidHex) {
    const tagRows = await sql/*sql*/`
      SELECT id, status, last_seen_ctr
      FROM tags
      WHERE batch_id = ${batch.id} AND UPPER(uid_hex) = UPPER(${resolvedUidHex})
      LIMIT 1
    `;
    const tag = tagRows[0];
    if (tag || registeredPayloadMatch) {
      allowlisted = true;
      tagStatus = String(tag?.status || registeredPayloadMatch?.tagStatus || registeredPayloadMatch?.payloadStatus || "active");
      if (res.ok && typeof tag?.last_seen_ctr === 'number' && resolvedCtr != null && resolvedCtr <= tag.last_seen_ctr) replaySuspect = true;
      const tagId = tag?.id || registeredPayloadMatch?.tagId || null;
      if (tagId) {
        await sql/*sql*/`
          UPDATE tags
          SET scan_count = scan_count + 1,
              first_seen_at = COALESCE(first_seen_at, now()),
              last_seen_at = now(),
              last_seen_ctr = CASE
                WHEN ${resolvedCtr}::integer IS NULL THEN tags.last_seen_ctr
                ELSE GREATEST(COALESCE(last_seen_ctr, -1), ${resolvedCtr})
              END
          WHERE id = ${tagId}
        `;
      } else {
        await sql/*sql*/`
          UPDATE tags
          SET scan_count = scan_count + 1,
              first_seen_at = COALESCE(first_seen_at, now()),
              last_seen_at = now()
          WHERE batch_id = ${batch.id} AND UPPER(uid_hex) = UPPER(${resolvedUidHex})
        `;
      }
    }
  }

  const tamperProfile = resolveTamperProfile((batch as { sdm_config?: unknown }).sdm_config || {});
  const tagTamperEnabled = tamperProfile.tagtamper_enabled || /tag.?tamper|tamper|tt/i.test(JSON.stringify((batch as { sdm_config?: unknown }).sdm_config || {}));
  const requireTamperEvidence = tagTamperEnabled && String(process.env.TAGTAMPER_REQUIRE_EVIDENCE || "1") !== "0";
  const encStatusByteHex = res.ok && typeof res.encPlainHex === "string" && /^[0-9a-f]{2,}$/i.test(res.encPlainHex)
    ? res.encPlainHex.slice(0, 2).toUpperCase()
    : null;
  const tamperSignal = resolveTamperSignal({
    rawQuery: input.rawQuery,
    meta: input.context?.meta,
    encPlainHex: res.ok ? res.encPlainHex : undefined,
    tagTamperEnabled,
  });
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
    if (!tamperProfile.ttstatus_enabled || tamperProfile.ttstatus_source === "none" || tamperProfile.ttstatus_offset == null || !res.ok) return null;
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
    tagTamperEnabled
    && (tamperProfile.ttstatus_enabled || tamperProfile.tamper_status_enabled)
    && (tamperProfile.ttstatus_source !== "none" || tamperProfile.tamper_status_source !== "none")
    && (Number.isInteger(tamperProfile.ttstatus_offset) || Number.isInteger(tamperProfile.tamper_status_offset)),
  );
  const tamperStatus = (() => {
    if (!tagTamperEnabled) return "UNKNOWN" as const;
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
  const authStatus = !payloadVerified
    ? 'SUN_PROFILE_MISMATCH'
    : replaySuspect
      ? 'REPLAY_SUSPECT'
    : parsedTTStatus?.product_state === "VALID_OPENED" || parsedTTStatus?.product_state === "VALID_OPENED_PREVIOUSLY"
      ? 'OPENED'
    : parsedTTStatus?.product_state === "VALID_UNKNOWN_TAMPER"
      ? 'VALID'
    : tamperStatus === "OPENED" || tamperStatus === "OPENED_PREVIOUSLY"
      ? tamperStatus
    : tamperSignal.tamper
        ? 'TAMPER_RISK'
      : !allowlisted
        ? 'NOT_REGISTERED'
        : tagStatus !== 'active'
          ? 'NOT_ACTIVE'
          : 'VALID';
  let result = authStatus;
  const manualTamper = await getManualTamperOverride(resolvedUidHex);
  const manualOpened = String(manualTamper?.tamper_status || "").toUpperCase() === "MANUAL_OPENED" || String(manualTamper?.tamper_status || "").toUpperCase() === "OPENED";
  const resolvedTamperStatus = manualOpened ? "MANUAL_OPENED" as const : tamperStatus;
  const tamperSource = manualOpened ? "manual" as const : (tamperConfigured ? "electronic" as const : "unavailable" as const);

  const successReason = replaySuspect
    ? 'copied URL / replay suspected'
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
    : tamperSignal.tamper
      ? `tagtamper_alert:${tamperSignal.raw || 'signal'}`
      : null;
  const resolvedReason = !payloadVerified ? cryptoErrorReason : successReason;
  const ttStateRaw = ttstatusParsed?.product_state;
  const ttState: TTStatusProductState | null =
    ttStateRaw === "VALID_CLOSED"
    || ttStateRaw === "VALID_OPENED"
    || ttStateRaw === "VALID_OPENED_PREVIOUSLY"
    || ttStateRaw === "VALID_UNKNOWN_TAMPER"
      ? ttStateRaw
      : null;
  const authValid = payloadVerified && authStatus === "VALID";
  const productState: ProductState = (() => {
    if (!payloadVerified || authStatus === "SUN_PROFILE_MISMATCH") return "SUN_PROFILE_MISMATCH";
    if (result === "REPLAY_SUSPECT") return "REPLAY_SUSPECT";
    if (ttState === "VALID_OPENED" || ttState === "VALID_OPENED_PREVIOUSLY") return ttState;
    if (ttState === "VALID_CLOSED") return "VALID_CLOSED";
    if (manualOpened || resolvedTamperStatus === "MANUAL_OPENED") return "VALID_MANUAL_OPENED";
    if (resolvedTamperStatus === "OPENED") return "VALID_OPENED";
    if (resolvedTamperStatus === "OPENED_PREVIOUSLY") return "VALID_OPENED_PREVIOUSLY";
    if (resolvedTamperStatus === "CLOSED") return "VALID_CLOSED";
    if (tamperSignal.tamper && requireTamperEvidence && !tamperConfigured) return "TAMPER_RISK";
    if (authValid) return "VALID_UNKNOWN_TAMPER";
    return "INVALID";
  })();
  const resolvedTamperOpened =
    resolvedTamperStatus === "OPENED"
    || resolvedTamperStatus === "OPENED_PREVIOUSLY"
    || resolvedTamperStatus === "MANUAL_OPENED"
    || productState === "VALID_OPENED"
    || productState === "VALID_OPENED_PREVIOUSLY"
    || productState === "VALID_MANUAL_OPENED";
  const resolvedTamperRisk = Boolean(tamperSignal.tamper || resolvedTamperStatus === "INVALID" || productState === "TAMPER_RISK");

  if (input.context?.forceResult) result = input.context.forceResult;

  const verificationMethod = cryptographicVerification
    ? "sun_crypto"
    : supplierPayloadMatch
      ? "supplier_payload_manifest"
      : "sun_crypto_failed";
  const batchSdmConfigSummary = summarizeBatchSdmConfig((batch as { sdm_config?: unknown }).sdm_config || {});

  const hasGeo = Number.isFinite(input.context?.lat) && Number.isFinite(input.context?.lng);

  const eventId = await insertEvent({
    uidHex: resolvedUidHex,
    ctr: resolvedCtr,
    cmacOk: cryptographicVerification,
    allowlistedValue: allowlisted,
    tagStatusValue: tagStatus,
    resultValue: result,
    reasonValue: resolvedReason,
    hasGeoValue: hasGeo,
  });

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
  console.info("[sun_tamper_decode]", JSON.stringify({
    bid: input.bid,
    uid: resolvedUidHex,
    read_counter: resolvedCtr,
    cmac_valid: cryptographicVerification,
    supplier_payload_match: supplierPayloadMatch,
    verification_method: verificationMethod,
    crypto_error_reason: cryptoErrorReason,
    sdm_decryption_ok: Boolean(res.ok && res.encPlainHex),
    picc_layout: res.piccLayout || null,
    selected_mac_input: res.macInputMode || null,
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
    crypto_error_reason: cryptoErrorReason || null,
    verification_method: verificationMethod,
    cmac_valid: typeof res.cmacValid === "boolean" ? res.cmacValid : null,
    sdm_decryption_ok: Boolean(res.ok && res.encPlainHex),
    uid_decoded: Boolean(res.uidDecoded),
    uid_hex: res.uidHex || resolvedUidHex || null,
    read_counter: resolvedCtr ?? null,
    picc_layout: res.piccLayout || null,
    selected_mac_input: res.macInputMode || null,
    configured_mac_input_modes: selectedMacInputModes,
    picc_candidate_count: Array.isArray(res.piccCandidates) ? res.piccCandidates.length : 0,
    cmac_candidate_count: Array.isArray(res.cmacCandidates) ? res.cmacCandidates.length : 0,
    picc_plain_hex_prefix: typeof res.piccPlainHex === "string" ? res.piccPlainHex.slice(0, 32) : null,
    enc_plain_hex_prefix: typeof res.encPlainHex === "string" ? res.encPlainHex.slice(0, 32) : null,
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
    supplier_payload_match: supplierPayloadMatch,
  };
  return {
    status: responseStatus,
    body: {
      ok: publicOk,
      request_id: requestId,
      result,
      tenant_id: batch.tenant_id,
      tenant_slug: (batch as { tenant_slug?: string }).tenant_slug || undefined,
      tenant_name: (batch as { tenant_name?: string }).tenant_name || undefined,
      auth_status: authStatus,
      bid: input.bid,
      uid: resolvedUidHex || undefined,
      ctr: resolvedCtr ?? undefined,
      picc_plain_hex: res.ok ? res.piccPlainHex : undefined,
      enc_plain_hex: res.ok ? res.encPlainHex : undefined,
      verification_method: verificationMethod,
      supplier_payload_match: supplierPayloadMatch,
      cryptographic_verification: cryptographicVerification,
      crypto_error_reason: cryptoErrorReason || undefined,
      allowlisted,
      tag_status: tagStatus,
      tamper_signal: tamperSignal.raw || undefined,
      tamper_opened: resolvedTamperOpened,
      tamper_risk: resolvedTamperRisk,
      tamper_supported: tagTamperEnabled,
      tamper_configured: tamperConfigured,
      tamper_status: resolvedTamperStatus,
      tamper_source: tamperSource,
      tamper_raw_value: ttstatusParsed?.raw || null,
      tt_perm_status: ttstatusParsed?.perm || undefined,
      tt_curr_status: ttstatusParsed?.current || undefined,
      ttstatus_raw: ttstatusParsed?.raw || undefined,
      ttstatus_reason: ttstatusParsed?.reason || undefined,
      tamper_reason: manualOpened
        ? "Producto auténtico. Sello marcado como abierto por operador."
        : resolvedTamperStatus === "UNKNOWN"
        ? "Authenticity confirmed. Open/closed status is not available for this batch configuration."
        : resolvedTamperStatus === "OPENED"
          ? "Authentic tag, but seal appears opened."
          : resolvedTamperStatus === "INVALID"
            ? "Authenticity confirmed. TTStatus invalid or not enabled for this batch."
          : resolvedTamperStatus === "OPENED_PREVIOUSLY"
            ? "Authenticity confirmed. The seal was opened previously."
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
      tag_tamper_config_detected: tagTamperEnabled,
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
