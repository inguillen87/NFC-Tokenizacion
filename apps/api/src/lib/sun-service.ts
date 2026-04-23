import { sql } from './db';
import { randomUUID } from 'node:crypto';
import { decryptKey16 } from './keys';
import { verifySun } from './crypto/sdm';
import { publishRealtimeEvent } from './realtime-events';
import { parseTTStatusFromDecryptedPayload } from './ttstatus';
import { recordTapEvent } from './tap-event-service';

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
  | "INVALID"
  | "NOT_REGISTERED"
  | "NOT_ACTIVE"
  | "UNKNOWN_BATCH"
  | "MALFORMED_URL";

type TamperProfile = {
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
};

function resolveTamperProfile(raw: unknown): TamperProfile {
  const cfg = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {};
  const sourceRaw = String(cfg.ttstatus_source || cfg.tamper_status_source || "none").toLowerCase();
  const source = (() => {
    if (sourceRaw === "enc" || sourceRaw === "decrypted_sdm" || sourceRaw === "enc_decrypted") return "enc_decrypted";
    if (sourceRaw === "picc_data" || sourceRaw === "picc_data_decrypted") return "picc_data_decrypted";
    return "none";
  })() as TamperProfile["tamper_status_source"];
  const closedRaw = Array.isArray(cfg.tamper_closed_values) ? cfg.tamper_closed_values : [];
  const openedRaw = Array.isArray(cfg.tamper_open_values) ? cfg.tamper_open_values : [];
  const closed = closedRaw.map((x) => String(x).trim().toUpperCase()).filter(Boolean);
  const opened = openedRaw.map((x) => String(x).trim().toUpperCase()).filter(Boolean);
  const offsetRaw = Number(cfg.ttstatus_offset ?? cfg.tamper_status_offset);
  const lengthRaw = Number(cfg.tamper_status_length);
  const unknownPolicyRaw = String(cfg.tamper_unknown_policy || "UNKNOWN").toUpperCase();
  const isTagTamperDefault = /424|tag.?tamper|tt/i.test(String(cfg.chip_model || ""));
  return {
    chip_model: String(cfg.chip_model || "unknown"),
    tagtamper_enabled: Boolean(cfg.tagtamper_enabled ?? isTagTamperDefault),
    tamper_status_enabled: Boolean(cfg.tamper_status_enabled ?? cfg.ttstatus_enabled ?? false),
    tamper_status_source: source,
    tamper_status_offset: Number.isInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : null,
    tamper_status_length: Number.isInteger(lengthRaw) && lengthRaw > 0 ? lengthRaw : 1,
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
  };
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
    const isReplay = payload.resultValue === 'REPLAY_SUSPECT';
    const isInvalid = payload.resultValue !== 'VALID' && payload.resultValue !== 'TAP_VALID';
    const riskLevelStr = payload.resultValue === 'TAMPER_RISK' || isReplay ? 'high' : isInvalid ? 'medium' : 'none';

    return await recordTapEvent({
      tenantId: batch.tenant_id,
      tenantSlug: (batch as { tenant_slug?: string }).tenant_slug || null,
      batchId: batch.id,
      bid: input.bid,
      uidHex: payload.uidHex,
      source: input.context?.source || 'real',
      eventType: isReplay ? 'REPLAY_SUSPECT' : isInvalid ? 'TAP_INVALID' : 'TAP_VALID',
      verdict: payload.resultValue.toLowerCase() as any,
      riskLevel: riskLevelStr as any,
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
      meta: input.context?.meta || {},
      traceId: typeof input.context?.meta?.trace_id === 'string' ? String(input.context.meta.trace_id) : null,
      ip: input.context?.ip,
      geoCity: input.context?.city,
      geoCountry: input.context?.countryCode,
      deviceLabel: input.context?.deviceLabel,
      rawQuery: input.rawQuery,
    });
  }

  const batchRows = await sql/*sql*/`
    SELECT b.id, b.tenant_id, t.slug AS tenant_slug, b.status, b.meta_key_ct, b.file_key_ct, b.sdm_config
    FROM batches b
    LEFT JOIN tenants t ON t.id = b.tenant_id
    WHERE b.bid = ${input.bid}
    LIMIT 1
  `;
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

  const res = verifySun({
    piccDataHex: input.piccDataHex,
    encHex: input.encHex,
    cmacHex: input.cmacHex,
    kMetaHex: kMeta,
    kFileHex: kFile,
  });

  let allowlisted = false;
  let tagStatus: string | null = null;
  let replaySuspect = false;

  if (res.ok) {
    const priorEventRows = await sql/*sql*/`
      SELECT id
      FROM events
      WHERE batch_id = ${batch.id}
        AND uid_hex = ${res.uidHex}
        AND sdm_read_ctr = ${res.ctr}
      LIMIT 1
    `;
    if (priorEventRows[0]) replaySuspect = true;

    const tagRows = await sql/*sql*/`
      SELECT id, status, last_seen_ctr
      FROM tags
      WHERE batch_id = ${batch.id} AND uid_hex = ${res.uidHex}
      LIMIT 1
    `;
    const tag = tagRows[0];
    if (tag) {
      allowlisted = true;
      tagStatus = tag.status;
      if (typeof tag.last_seen_ctr === 'number' && res.ctr <= tag.last_seen_ctr) replaySuspect = true;
      await sql/*sql*/`
        UPDATE tags
        SET scan_count = scan_count + 1,
            first_seen_at = COALESCE(first_seen_at, now()),
            last_seen_at = now(),
            last_seen_ctr = GREATEST(COALESCE(last_seen_ctr, -1), ${res.ctr})
        WHERE id = ${tag.id}
      `;
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
    const len = tamperProfile.tamper_status_length ?? 1;
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
    return parseTTStatusFromDecryptedPayload(payloadHex, tamperProfile.ttstatus_offset);
  })();
  // Backward-compatible alias used by some in-flight branches/deploys.
  const parsedTTStatus = ttstatusParsed;
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
    if (tamperConfigured && configuredStatusHex && tamperProfile.tamper_open_values.includes(configuredStatusHex)) return "OPENED" as const;
    if (tamperConfigured && configuredStatusHex && tamperProfile.tamper_closed_values.includes(configuredStatusHex)) return "CLOSED" as const;
    if (!tamperConfigured) return "UNKNOWN" as const;
    if (!configuredStatusHex) {
      return "UNKNOWN" as const;
    }
    return "UNKNOWN" as const;
  })();
  const authStatus = !res.ok
    ? 'INVALID'
    : parsedTTStatus?.product_state === "VALID_OPENED" || parsedTTStatus?.product_state === "VALID_OPENED_PREVIOUSLY"
      ? 'OPENED'
    : parsedTTStatus?.product_state === ("TAMPER_RISK" as string) // type assertion since it might not be in TTStatusProductState
      ? 'TAMPER_RISK'
    : tamperSignal.opened
      ? 'OPENED'
      : tamperSignal.tamper
        ? 'TAMPER_RISK'
    : replaySuspect
      ? 'REPLAY_SUSPECT'
      : !allowlisted
        ? 'NOT_REGISTERED'
        : tagStatus !== 'active'
          ? 'NOT_ACTIVE'
          : 'VALID';
  let result = authStatus;
  const manualTamper = await getManualTamperOverride(res.ok ? res.uidHex : null);
  const manualOpened = String(manualTamper?.tamper_status || "").toUpperCase() === "MANUAL_OPENED" || String(manualTamper?.tamper_status || "").toUpperCase() === "OPENED";
  const resolvedTamperStatus = manualOpened ? "MANUAL_OPENED" as const : tamperStatus;
  const tamperSource = manualOpened ? "manual" as const : (tamperConfigured ? "electronic" as const : "unavailable" as const);

  const successReason = manualOpened
    ? `manual_tamper_opened:${String(manualTamper?.reason || "operator_override")}`
    : tamperStatus === "OPENED"
    ? `tagtamper_opened:${configuredStatusHex || tamperSignal.raw || 'signal'}`
    : tamperStatus === "OPENED_PREVIOUSLY"
      ? `tagtamper_opened_previously:${ttstatusParsed?.raw || configuredStatusHex || tamperSignal.raw || 'signal'}`
    : requireTamperEvidence && !tamperConfigured
      ? 'tagtamper_unconfigured'
    : tamperSignal.tamper
      ? `tagtamper_alert:${configuredStatusHex || tamperSignal.raw || 'signal'}`
      : replaySuspect
        ? 'copied URL / replay suspected'
        : null;
  const resolvedReason = !res.ok ? res.reason : successReason;
  const ttStateRaw = ttstatusParsed?.product_state;
  const ttState: TTStatusProductState | null =
    ttStateRaw === "VALID_CLOSED"
    || ttStateRaw === "VALID_OPENED"
    || ttStateRaw === "VALID_OPENED_PREVIOUSLY"
    || ttStateRaw === "VALID_UNKNOWN_TAMPER"
      ? ttStateRaw
      : null;
  const authValid = res.ok && authStatus === "VALID";
  const productState: ProductState = (() => {
    if (!res.ok || authStatus === "INVALID") return "INVALID";
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

  if (input.context?.forceResult) result = input.context.forceResult;

  const hasGeo = Number.isFinite(input.context?.lat) && Number.isFinite(input.context?.lng);

  const requestId = input.context?.requestId || randomUUID();
  input.context = { ...input.context, requestId };

  const eventId = await insertEvent({
    uidHex: res.ok ? res.uidHex : null,
    ctr: res.ok ? res.ctr : null,
    cmacOk: res.ok,
    allowlistedValue: allowlisted,
    tagStatusValue: tagStatus,
    resultValue: result,
    reasonValue: resolvedReason,
    hasGeoValue: hasGeo,
  });

  return {
    status: result === 'VALID' ? 200 : 403,
    body: {
      ok: result === 'VALID',
      request_id: requestId,
      result,
      auth_status: authStatus,
      bid: input.bid,
      uid: res.ok ? res.uidHex : undefined,
      ctr: res.ok ? res.ctr : undefined,
      picc_plain_hex: res.ok ? res.piccPlainHex : undefined,
      enc_plain_hex: res.ok ? res.encPlainHex : undefined,
      allowlisted,
      tag_status: tagStatus,
      tamper_signal: tamperSignal.raw || undefined,
      tamper_opened: tamperSignal.opened,
      tamper_risk: tamperSignal.tamper,
      tamper_supported: tagTamperEnabled,
      tamper_configured: tamperConfigured,
      tamper_status: resolvedTamperStatus,
      tamper_source: tamperSource,
      tamper_raw_value: configuredStatusHex || null,
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
      reason: resolvedReason || undefined,
      event_id: eventId || undefined,
    },
  };
}
