import { sql } from './db';
import { decryptKey16 } from './keys';
import { verifySun } from './crypto/sdm';
import { publishRealtimeEvent } from './realtime-events';

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
};

type TamperState = "opened" | "tamper" | "closed" | null;
type TamperProfile = {
  chip_model: string;
  tagtamper_enabled: boolean;
  ttstatus_enabled: boolean;
  ttstatus_source: "enc_decrypted" | "picc_data_decrypted" | "none";
  ttstatus_offset: number | null;
  ttstatus_length: number;
  ttstatus_plain_or_encrypted: "plain" | "encrypted";
  ttstatus_notes: string;
  tamper_status_enabled: boolean;
  tamper_status_source: "enc_decrypted" | "picc_data_decrypted" | "none";
  tamper_status_offset: number | null;
  tamper_status_length: number | null;
  tamper_closed_values: string[];
  tamper_open_values: string[];
  tamper_unknown_policy: "UNKNOWN" | "DO_NOT_DISPLAY";
  tamper_notes: string;
};

export type ParsedTTStatus = {
  raw: string;
  perm: "CLOSED" | "OPENED" | "INVALID" | "UNKNOWN";
  current: "CLOSED" | "OPENED" | "INVALID" | "UNKNOWN";
  product_state: "VALID_CLOSED" | "VALID_OPENED" | "VALID_OPENED_PREVIOUSLY" | "VALID_UNKNOWN_TAMPER" | "TAMPER_RISK";
  reason?: string;
};

function decodeTTByte(byteHex: string): ParsedTTStatus["perm"] {
  const normalized = String(byteHex || "").toUpperCase();
  if (normalized === "43") return "CLOSED";
  if (normalized === "4F") return "OPENED";
  if (normalized === "49") return "INVALID";
  return "UNKNOWN";
}

export function parseTTStatusFromDecryptedPayload(payloadHex: string, offset: number): ParsedTTStatus {
  const normalized = String(payloadHex || "").replace(/[^0-9a-f]/gi, "").toUpperCase();
  const base = Number.isInteger(offset) && offset >= 0 ? offset * 2 : 0;
  const raw = normalized.slice(base, base + 4);
  const permByte = raw.slice(0, 2);
  const currentByte = raw.slice(2, 4);
  const perm = decodeTTByte(permByte);
  const current = decodeTTByte(currentByte);
  if (raw === "4343") return { raw, perm, current, product_state: "VALID_CLOSED" };
  if (raw === "4F4F") return { raw, perm, current, product_state: "VALID_OPENED" };
  if (raw === "4F43") return { raw, perm, current, product_state: "VALID_OPENED_PREVIOUSLY" };
  if (raw === "434F") return { raw, perm, current, product_state: "TAMPER_RISK", reason: "TTStatus inconsistente (434F)." };
  if (raw === "4949") return { raw, perm, current, product_state: "VALID_UNKNOWN_TAMPER", reason: "TTStatus invalid/not enabled." };
  return { raw: raw || "NONE", perm, current, product_state: "VALID_UNKNOWN_TAMPER", reason: "TTStatus not recognized." };
}

function findTTStatusCandidatesInPayload(payloadHex: string) {
  const normalized = String(payloadHex || "").replace(/[^0-9a-f]/gi, "").toUpperCase();
  const hits: Array<{ offset: number; raw: string }> = [];
  for (let i = 0; i + 4 <= normalized.length; i += 2) {
    const raw = normalized.slice(i, i + 4);
    if (["4343", "4F4F", "4F43", "4949"].includes(raw)) {
      hits.push({ offset: i / 2, raw });
    }
  }
  return hits;
}

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
  const offsetRaw = Number(cfg.tamper_status_offset);
  const ttOffsetRaw = Number(cfg.ttstatus_offset ?? cfg.tamper_status_offset);
  const lengthRaw = Number(cfg.tamper_status_length);
  const ttLengthRaw = Number(cfg.ttstatus_length);
  const unknownPolicyRaw = String(cfg.tamper_unknown_policy || "UNKNOWN").toUpperCase();
  return {
    chip_model: String(cfg.chip_model || "unknown"),
    tagtamper_enabled: Boolean(cfg.tagtamper_enabled ?? /424|tag.?tamper|tt/i.test(String(cfg.chip_model || ""))),
    ttstatus_enabled: Boolean(cfg.ttstatus_enabled ?? cfg.tamper_status_enabled ?? false),
    ttstatus_source: source,
    ttstatus_offset: Number.isInteger(ttOffsetRaw) && ttOffsetRaw >= 0 ? ttOffsetRaw : null,
    ttstatus_length: Number.isInteger(ttLengthRaw) && ttLengthRaw > 0 ? ttLengthRaw : 2,
    ttstatus_plain_or_encrypted: String(cfg.ttstatus_plain_or_encrypted || "encrypted").toLowerCase() === "plain" ? "plain" : "encrypted",
    ttstatus_notes: String(cfg.ttstatus_notes || cfg.tamper_notes || cfg.notes || ""),
    tamper_status_enabled: Boolean(cfg.tamper_status_enabled ?? false),
    tamper_status_source: source,
    tamper_status_offset: Number.isInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : null,
    tamper_status_length: Number.isInteger(lengthRaw) && lengthRaw > 0 ? lengthRaw : 1,
    tamper_closed_values: closed,
    tamper_open_values: opened,
    tamper_unknown_policy: (["UNKNOWN", "DO_NOT_DISPLAY"].includes(unknownPolicyRaw) ? unknownPolicyRaw : "UNKNOWN") as TamperProfile["tamper_unknown_policy"],
    tamper_notes: String(cfg.tamper_notes || cfg.notes || ""),
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
    const emitRealtime = (eventId?: number | null) => {
      publishRealtimeEvent({
        id: eventId || undefined,
        tenant_slug: (batch as { tenant_slug?: string }).tenant_slug || undefined,
        bid: input.bid,
        uid_hex: payload.uidHex || undefined,
        result: payload.resultValue,
        reason: payload.reasonValue || undefined,
        city: input.context?.city || null,
        country_code: input.context?.countryCode || null,
        lat: payload.hasGeoValue ? input.context?.lat || null : null,
        lng: payload.hasGeoValue ? input.context?.lng || null : null,
        source: input.context?.source || 'real',
        created_at: new Date().toISOString(),
        trace_id: typeof input.context?.meta?.trace_id === 'string' ? String(input.context.meta.trace_id) : null,
      });
    };

    const commonValues = [
      batch.tenant_id,
      batch.id,
      payload.uidHex,
      payload.ctr,
      payload.cmacOk,
      payload.allowlistedValue,
      payload.tagStatusValue,
      payload.resultValue,
      payload.reasonValue,
      input.context?.ip || null,
      input.context?.userAgent || null,
      input.context?.city || null,
      input.context?.countryCode || null,
      payload.hasGeoValue ? input.context?.lat! : null,
      payload.hasGeoValue ? input.context?.lng! : null,
      input.context?.city || null,
      input.context?.countryCode || null,
      payload.hasGeoValue ? input.context?.lat! : null,
      payload.hasGeoValue ? input.context?.lng! : null,
      input.context?.deviceLabel || null,
      input.context?.source || 'real',
      JSON.stringify(input.context?.meta || {}),
      JSON.stringify(input.rawQuery || {}),
    ] as const;

    const isMissingColumnError = (error: unknown) => {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      return message.includes('column') && message.includes('does not exist');
    };

    try {
      const inserted = await sql/*sql*/`
        INSERT INTO events (
          tenant_id, batch_id, uid_hex, sdm_read_ctr, read_counter, cmac_ok, allowlisted, tag_status, result, reason,
          ip, user_agent, geo_city, geo_country, geo_lat, geo_lng, city, country_code, lat, lng, device_label,
          source, meta, raw_query
        ) VALUES (
          ${commonValues[0]}, ${commonValues[1]}, ${commonValues[2]}, ${payload.ctr}, ${payload.ctr}, ${commonValues[4]}, ${commonValues[5]}, ${commonValues[6]}, ${commonValues[7]}, ${commonValues[8]},
          ${commonValues[9]}, ${commonValues[10]}, ${commonValues[11]}, ${commonValues[12]}, ${commonValues[13]}, ${commonValues[14]}, ${commonValues[15]}, ${commonValues[16]}, ${commonValues[17]}, ${commonValues[18]}, ${commonValues[19]},
          ${commonValues[20]}::scan_source, ${commonValues[21]}::jsonb, ${commonValues[22]}::jsonb
        )
        RETURNING id
      `;
      const eventId = Number((inserted?.[0] as { id?: number } | undefined)?.id || 0) || null;
      emitRealtime(eventId);
      return eventId;
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;
    }

    try {
      const inserted = await sql/*sql*/`
        INSERT INTO events (
          tenant_id, batch_id, uid_hex, sdm_read_ctr, cmac_ok, allowlisted, tag_status, result, reason,
          ip, user_agent, geo_city, geo_country, geo_lat, geo_lng, city, country_code, lat, lng, device_label,
          source, meta, raw_query
        ) VALUES (
          ${commonValues[0]}, ${commonValues[1]}, ${commonValues[2]}, ${payload.ctr}, ${commonValues[4]}, ${commonValues[5]}, ${commonValues[6]}, ${commonValues[7]}, ${commonValues[8]},
          ${commonValues[9]}, ${commonValues[10]}, ${commonValues[11]}, ${commonValues[12]}, ${commonValues[13]}, ${commonValues[14]}, ${commonValues[15]}, ${commonValues[16]}, ${commonValues[17]}, ${commonValues[18]}, ${commonValues[19]},
          ${commonValues[20]}::scan_source, ${commonValues[21]}::jsonb, ${commonValues[22]}::jsonb
        )
        RETURNING id
      `;
      const eventId = Number((inserted?.[0] as { id?: number } | undefined)?.id || 0) || null;
      emitRealtime(eventId);
      return eventId;
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;
    }

    const inserted = await sql/*sql*/`
      INSERT INTO events (
        tenant_id, batch_id, uid_hex, sdm_read_ctr, cmac_ok, allowlisted, tag_status, result, reason,
        ip, user_agent, raw_query
      ) VALUES (
        ${commonValues[0]}, ${commonValues[1]}, ${commonValues[2]}, ${payload.ctr}, ${commonValues[4]}, ${commonValues[5]}, ${commonValues[6]}, ${commonValues[7]}, ${commonValues[8]},
        ${commonValues[9]}, ${commonValues[10]}, ${commonValues[22]}::jsonb
      )
      RETURNING id
    `;
    const eventId = Number((inserted?.[0] as { id?: number } | undefined)?.id || 0) || null;
    emitRealtime(eventId);
    return eventId;
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
  const ttStatusConfigured = Boolean(
    tagTamperEnabled
    && tamperProfile.ttstatus_enabled
    && tamperProfile.ttstatus_source !== "none"
    && Number.isInteger(tamperProfile.ttstatus_offset),
  );
  const ttPayloadHex = tamperProfile.ttstatus_source === "enc_decrypted"
    ? (res.ok ? res.encPlainHex : "")
    : tamperProfile.ttstatus_source === "picc_data_decrypted"
      ? (res.ok ? res.piccPlainHex : "")
      : "";
  const parsedTTStatus = ttStatusConfigured && ttPayloadHex
    ? parseTTStatusFromDecryptedPayload(ttPayloadHex, Number(tamperProfile.ttstatus_offset || 0))
    : null;
  const encTTCandidates = findTTStatusCandidatesInPayload(res.ok ? (res.encPlainHex || "") : "");
  const piccTTCandidates = findTTStatusCandidatesInPayload(res.ok ? (res.piccPlainHex || "") : "");
  const configuredStatusHex = (() => {
    if (!tamperProfile.tamper_status_enabled || tamperProfile.tamper_status_source === "none") return null;
    const offset = tamperProfile.tamper_status_offset ?? tamperProfile.ttstatus_offset ?? 0;
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
  const tamperConfigured = Boolean(
    tagTamperEnabled
    && (tamperProfile.tamper_status_enabled || tamperProfile.ttstatus_enabled)
    && (tamperProfile.tamper_status_source !== "none" || tamperProfile.ttstatus_source !== "none")
    && (Number.isInteger(tamperProfile.tamper_status_offset) || Number.isInteger(tamperProfile.ttstatus_offset)),
  );
  const tamperStatus = (() => {
    if (!tagTamperEnabled) return "UNKNOWN" as const;
    if (parsedTTStatus?.product_state === "VALID_CLOSED") return "CLOSED" as const;
    if (parsedTTStatus?.product_state === "VALID_OPENED") return "OPENED" as const;
    if (parsedTTStatus?.product_state === "VALID_OPENED_PREVIOUSLY") return "OPENED_PREVIOUSLY" as const;
    if (parsedTTStatus?.product_state === "TAMPER_RISK") return "TAMPER_RISK" as const;
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
    : parsedTTStatus?.product_state === "TAMPER_RISK"
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
    : parsedTTStatus?.product_state === "VALID_OPENED_PREVIOUSLY"
    ? `tagtamper_opened_previously:${parsedTTStatus.raw}`
    : parsedTTStatus?.product_state === "VALID_OPENED"
    ? `tagtamper_opened:${parsedTTStatus.raw}`
    : parsedTTStatus?.product_state === "TAMPER_RISK"
    ? `tagtamper_inconsistent:${parsedTTStatus.raw}`
    : tamperStatus === "OPENED"
    ? `tagtamper_opened:${configuredStatusHex || tamperSignal.raw || 'signal'}`
    : requireTamperEvidence && !tamperConfigured
      ? 'tagtamper_unconfigured'
    : tagTamperEnabled && !ttStatusConfigured && !encTTCandidates.length && !piccTTCandidates.length
      ? 'ttstatus_not_found_in_payload'
    : tamperSignal.tamper
      ? `tagtamper_alert:${configuredStatusHex || tamperSignal.raw || 'signal'}`
      : replaySuspect
        ? 'copied URL / replay suspected'
        : null;
  const resolvedReason = !res.ok ? res.reason : successReason;
  const productState = (() => {
    if (!res.ok || authStatus === "INVALID") return "INVALID" as const;
    if (result === "REPLAY_SUSPECT") return "REPLAY_SUSPECT" as const;
    if (resolvedTamperStatus === "MANUAL_OPENED") return "VALID_MANUAL_OPENED" as const;
    if (parsedTTStatus?.product_state === "VALID_OPENED_PREVIOUSLY") return "VALID_OPENED_PREVIOUSLY" as const;
    if (parsedTTStatus?.product_state === "VALID_CLOSED") return "VALID_CLOSED" as const;
    if (parsedTTStatus?.product_state === "VALID_OPENED") return "VALID_OPENED" as const;
    if (resolvedTamperStatus === "OPENED") return "VALID_OPENED" as const;
    if (resolvedTamperStatus === "CLOSED") return "VALID_CLOSED" as const;
    return "VALID_UNKNOWN_TAMPER" as const;
  })();

  if (input.context?.forceResult) result = input.context.forceResult;

  const hasGeo = Number.isFinite(input.context?.lat) && Number.isFinite(input.context?.lng);

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
      tamper_reason: manualOpened
        ? "Producto auténtico. Sello marcado como abierto por operador."
        : parsedTTStatus?.product_state === "VALID_UNKNOWN_TAMPER"
        ? "Authenticity confirmed. Open/closed status is not available for this batch configuration."
        : parsedTTStatus?.product_state === "VALID_OPENED_PREVIOUSLY"
        ? "Authenticity confirmed. Seal was opened previously."
        : resolvedTamperStatus === "UNKNOWN"
        ? "Authenticity confirmed. Open/closed status is not available for this batch configuration."
        : resolvedTamperStatus === "OPENED"
          ? "Authentic tag, but seal appears opened."
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
      ttstatus_raw: parsedTTStatus?.raw || undefined,
      tt_perm_status: parsedTTStatus?.perm || undefined,
      tt_curr_status: parsedTTStatus?.current || undefined,
      ttstatus_notes: tamperProfile.ttstatus_notes || undefined,
      ttstatus_candidate_offsets: {
        enc_decrypted: encTTCandidates,
        picc_data_decrypted: piccTTCandidates,
      },
      ttstatus_recommendation: parsedTTStatus
        ? `TTStatus parsed at configured offset ${tamperProfile.ttstatus_offset}.`
        : ttStatusConfigured
          ? "TTStatus enabled but bytes at configured offset did not match expected values (4343/4F4F/4F43/4949)."
          : encTTCandidates.length || piccTTCandidates.length
            ? "TTStatus-like bytes detected in payload. Configure ttstatus_offset with candidate offsets."
            : "No TTStatus pattern found. Supplier may not have mirrored TTStatus into SDM payload.",
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
