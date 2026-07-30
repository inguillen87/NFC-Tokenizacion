import { createHash } from "node:crypto";

import { sql } from "./db";
import {
  Gs1RegistryError,
  gs1IdentityKey,
  parseGs1DigitalLinkUri,
  resolveTenantGs1Identities,
  type Gs1DigitalLinkIdentity,
} from "./gs1-digital-link-registry";
import { stableJson } from "./proof-layer";

export const EPCIS_VERSION = "2.0";
export const CBV_VERSION = "2.0";
export const EPCIS_CONTEXT = "https://ref.gs1.org/standards/epcis/epcis-context.jsonld";
export const EPCIS_MEDIA_TYPE = "application/vnd.gs1.epcis+json";
export const EPCIS_CAPTURE_MAX_BYTES = 512 * 1024;
export const EPCIS_CAPTURE_MAX_EVENTS = 100;
export const EPCIS_EVENT_MAX_BYTES = 64 * 1024;
export const EPCIS_EVENT_MAX_IDENTIFIERS = 100;
export const EPCIS_CAPTURE_MAX_PROJECTIONS = 100;
export const EPCIS_QUERY_MAX_LIMIT = 200;

const EVENT_TYPES = new Set([
  "ObjectEvent",
  "AggregationEvent",
  "TransactionEvent",
  "TransformationEvent",
  "AssociationEvent",
]);
const ACTIONS = new Set(["ADD", "OBSERVE", "DELETE"]);
const OFFSET_RE = /^[+-](0[0-9]|1[0-4]):[0-5][0-9]$/;
const IDEMPOTENCY_RE = /^[A-Za-z0-9][A-Za-z0-9._~:/+=-]{0,254}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BARE_CBV_RE = /^[a-z][a-z0-9_]{0,79}$/;

type JsonRecord = Record<string, unknown>;

export type PreparedEpcisEvent = {
  client_event_id: string;
  event_type: string;
  event_time: string;
  event_time_zone_offset: string;
  action: string;
  biz_step: string;
  disposition: string;
  read_point: string;
  biz_location: string;
  event: JsonRecord;
  identities: Gs1DigitalLinkIdentity[];
};

export type EpcisCaptureReceipt = {
  captureId: string;
  documentRecordId: string;
  tenantId: string;
  eventCount: number;
  canonicalProjectionCount: number;
  capturedAt: string;
  replayed: boolean;
};

export class EpcisError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail?: unknown;

  constructor(code: string, status = 400, detail?: unknown) {
    super(code);
    this.name = "EpcisError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

function asRecord(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new EpcisError(code, 400);
  return value as JsonRecord;
}

function boundedText(value: unknown, maximum: number) {
  const text = String(value ?? "").trim();
  return text.length <= maximum ? text : "";
}

function validDateTime(value: unknown) {
  const text = boundedText(value, 64);
  if (!text || !/^\d{4}-\d{2}-\d{2}T/.test(text)) return "";
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function safeUri(value: unknown, required = false) {
  const text = boundedText(value, 512);
  if (!text) {
    if (required) throw new EpcisError("epcis_uri_required", 400);
    return "";
  }
  if (/^urn:[A-Za-z0-9][A-Za-z0-9:._~/?#\[\]@!$&'()*+,;=%-]*$/i.test(text)) return text;
  try {
    const url = new URL(text);
    if (url.protocol === "https:" && !url.username && !url.password) return text;
  } catch {
    // Normalized to one bounded public error below.
  }
  throw new EpcisError("epcis_uri_invalid", 400);
}

function normalizeVocabulary(value: unknown, kind: "BizStep" | "Disp") {
  const text = boundedText(value, 512);
  if (!text) return "";
  if (BARE_CBV_RE.test(text)) return `https://ref.gs1.org/cbv/${kind}-${text}`;
  return safeUri(text, true);
}

function identifierValues(event: JsonRecord) {
  const values: unknown[] = [];
  for (const field of ["epcList", "childEPCs", "inputEPCList", "outputEPCList"]) {
    const list = event[field];
    if (list == null) continue;
    if (!Array.isArray(list)) throw new EpcisError(`epcis_${field}_invalid`, 400);
    values.push(...list);
  }
  if (event.parentID != null) values.push(event.parentID);
  for (const field of ["quantityList", "childQuantityList", "inputQuantityList", "outputQuantityList"]) {
    const list = event[field];
    if (list == null) continue;
    if (!Array.isArray(list)) throw new EpcisError(`epcis_${field}_invalid`, 400);
    for (const entry of list) values.push(asRecord(entry, `epcis_${field}_entry_invalid`).epcClass);
  }
  return values;
}

function requireEventShape(type: string, event: JsonRecord) {
  const identifiers = identifierValues(event);
  if (!identifiers.length) throw new EpcisError("epcis_event_identifier_required", 422);
  if (identifiers.length > EPCIS_EVENT_MAX_IDENTIFIERS) throw new EpcisError("epcis_event_identifier_limit_exceeded", 413);
  const populated = (field: string) => Array.isArray(event[field]) && (event[field] as unknown[]).length > 0;
  const objectIdentifiers = populated("epcList") || populated("quantityList");
  const childIdentifiers = populated("childEPCs") || populated("childQuantityList");
  const inputIdentifiers = populated("inputEPCList") || populated("inputQuantityList");
  const outputIdentifiers = populated("outputEPCList") || populated("outputQuantityList");
  if ((type === "AggregationEvent" || type === "AssociationEvent") && event.parentID == null) {
    throw new EpcisError("epcis_parent_identifier_required", 422);
  }
  if ((type === "AggregationEvent" || type === "AssociationEvent") && !childIdentifiers) {
    throw new EpcisError("epcis_child_identifier_required", 422);
  }
  if ((type === "ObjectEvent" || type === "TransactionEvent") && !objectIdentifiers) {
    throw new EpcisError("epcis_object_identifier_required", 422);
  }
  if (type === "TransformationEvent" && (!inputIdentifiers || !outputIdentifiers)) {
    throw new EpcisError("epcis_transformation_io_required", 422);
  }
  const action = boundedText(event.action, 16).toUpperCase();
  if (type === "TransformationEvent") {
    if (action) throw new EpcisError("epcis_transformation_action_forbidden", 422);
  } else if (!ACTIONS.has(action)) {
    throw new EpcisError("epcis_action_invalid", 422);
  }
  return { identifiers, action };
}

function deterministicEventId(document: JsonRecord, index: number) {
  const digest = createHash("sha256")
    .update(`${stableJson(document)}\u0000${index}`, "utf8")
    .digest("hex");
  const uuid = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  return `urn:uuid:${uuid}`;
}

function hasOfficialContext(value: unknown) {
  if (value === EPCIS_CONTEXT) return true;
  return Array.isArray(value) && value.length === 1 && value[0] === EPCIS_CONTEXT;
}

export function validateEpcisDocument(value: unknown) {
  const document = asRecord(value, "epcis_document_invalid");
  if (document.type !== "EPCISDocument" || document.schemaVersion !== EPCIS_VERSION) {
    throw new EpcisError("epcis_document_profile_unsupported", 422);
  }
  if (!hasOfficialContext(document["@context"])) throw new EpcisError("epcis_context_required", 422);
  const epcisBody = asRecord(document.epcisBody, "epcis_body_invalid");
  if (!Array.isArray(epcisBody.eventList)) throw new EpcisError("epcis_event_list_invalid", 400);
  if (epcisBody.eventList.length < 1 || epcisBody.eventList.length > EPCIS_CAPTURE_MAX_EVENTS) {
    throw new EpcisError("epcis_event_count_invalid", epcisBody.eventList.length > EPCIS_CAPTURE_MAX_EVENTS ? 413 : 400);
  }
  const prepared: PreparedEpcisEvent[] = epcisBody.eventList.map((candidate, index) => {
    const event = asRecord(candidate, "epcis_event_invalid");
    if (Buffer.byteLength(JSON.stringify(event), "utf8") > EPCIS_EVENT_MAX_BYTES) {
      throw new EpcisError("epcis_event_too_large", 413, { index });
    }
    const type = boundedText(event.type, 32);
    if (!EVENT_TYPES.has(type)) throw new EpcisError("epcis_event_type_unsupported", 422, { index, type });
    const eventTime = validDateTime(event.eventTime);
    if (!eventTime) throw new EpcisError("epcis_event_time_invalid", 422, { index });
    const offset = boundedText(event.eventTimeZoneOffset, 6);
    if (!OFFSET_RE.test(offset) || (offset.startsWith("+14") || offset.startsWith("-14")) && offset !== "+14:00" && offset !== "-14:00") {
      throw new EpcisError("epcis_event_timezone_invalid", 422, { index });
    }
    const { identifiers: rawIdentifiers, action } = requireEventShape(type, event);
    const identities = [...new Map(rawIdentifiers.map((identifier) => {
      const identity = parseGs1DigitalLinkUri(identifier);
      return [gs1IdentityKey(identity), identity];
    })).values()];
    const clientEventId = event.eventID == null
      ? deterministicEventId(document, index)
      : safeUri(event.eventID, true);
    const bizStep = normalizeVocabulary(event.bizStep, "BizStep");
    const disposition = normalizeVocabulary(event.disposition, "Disp");
    const readPoint = event.readPoint == null
      ? ""
      : safeUri(asRecord(event.readPoint, "epcis_read_point_invalid").id, true);
    const bizLocation = event.bizLocation == null
      ? ""
      : safeUri(asRecord(event.bizLocation, "epcis_biz_location_invalid").id, true);
    const normalizedEvent: JsonRecord = {
      ...event,
      type,
      eventID: clientEventId,
      eventTime,
      eventTimeZoneOffset: offset,
      ...(action ? { action } : {}),
      ...(bizStep ? { bizStep } : {}),
      ...(disposition ? { disposition } : {}),
    };
    delete normalizedEvent.recordTime;
    return {
      client_event_id: clientEventId,
      event_type: type,
      event_time: eventTime,
      event_time_zone_offset: offset,
      action,
      biz_step: bizStep,
      disposition,
      read_point: readPoint,
      biz_location: bizLocation,
      event: normalizedEvent,
      identities,
    };
  });
  const normalizedDocument: JsonRecord = {
    ...document,
    type: "EPCISDocument",
    schemaVersion: EPCIS_VERSION,
    epcisBody: { ...epcisBody, eventList: prepared.map((entry) => entry.event) },
  };
  if (Buffer.byteLength(JSON.stringify(normalizedDocument), "utf8") > EPCIS_CAPTURE_MAX_BYTES) {
    throw new EpcisError("epcis_document_too_large", 413);
  }
  const projectionCount = prepared.reduce((total, event) => total + event.identities.length, 0);
  if (projectionCount < 1 || projectionCount > EPCIS_CAPTURE_MAX_PROJECTIONS) {
    throw new EpcisError("epcis_projection_count_invalid", 413);
  }
  const documentId = document.id == null ? "" : safeUri(document.id, true);
  return { document: normalizedDocument, documentId, events: prepared, projectionCount };
}

export function validateEpcisIdempotencyKey(value: unknown) {
  const key = String(value ?? "").trim();
  if (!IDEMPOTENCY_RE.test(key)) throw new EpcisError("epcis_idempotency_key_required", 400);
  return key;
}

function requestFingerprint(tenantId: string, document: JsonRecord) {
  return createHash("sha256")
    .update(`${tenantId}\u0000${stableJson(document)}`, "utf8")
    .digest("hex");
}

function projectionFingerprint(input: {
  tenantId: string;
  captureFingerprint: string;
  clientEventId: string;
  registryId: string;
}) {
  return createHash("sha256")
    .update(stableJson(input), "utf8")
    .digest("hex");
}

export async function captureEpcisDocument(input: {
  tenantId: string;
  apiKeyId: string;
  idempotencyKey: string;
  document: unknown;
}): Promise<EpcisCaptureReceipt> {
  const idempotencyKey = validateEpcisIdempotencyKey(input.idempotencyKey);
  const validated = validateEpcisDocument(input.document);
  const allIdentities = validated.events.flatMap((event) => event.identities);
  let registry;
  try {
    registry = await resolveTenantGs1Identities(input.tenantId, allIdentities);
  } catch (error) {
    if (error instanceof Gs1RegistryError) throw new EpcisError(error.code, error.status, error.detail);
    throw error;
  }
  const fingerprint = requestFingerprint(input.tenantId, validated.document);
  const events = validated.events.map((event) => ({
    ...event,
    identifiers: event.identities.map((identity) => {
      const match = registry.get(gs1IdentityKey(identity));
      if (!match) throw new EpcisError("epcis_unknown_gs1_identity", 422);
      return {
        registry_id: match.id,
        projection_fingerprint: projectionFingerprint({
          tenantId: input.tenantId,
          captureFingerprint: fingerprint,
          clientEventId: event.client_event_id,
          registryId: match.id,
        }),
      };
    }),
  }));
  const payload = {
    tenant_id: input.tenantId,
    api_key_id: input.apiKeyId,
    idempotency_key: idempotencyKey,
    request_fingerprint: fingerprint,
    schema_version: EPCIS_VERSION,
    document_type: "EPCISDocument",
    client_document_id: validated.documentId || null,
    document: validated.document,
    events,
  };
  let rows: Array<Record<string, unknown>>;
  try {
    rows = await sql/*sql*/`
      SELECT * FROM nexid_capture_epcis_document_v1(${JSON.stringify(payload)}::jsonb)
    ` as Array<Record<string, unknown>>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const known = message.match(/epcis_[a-z0-9_]+/i)?.[0]?.toLowerCase();
    const status = known === "epcis_idempotency_conflict" || known === "epcis_event_id_conflict"
      ? 409
      : known === "epcis_unknown_gs1_identity" ? 422 : 503;
    throw new EpcisError(known || "epcis_capture_unavailable", status);
  }
  const row = rows[0];
  const receipt = {
    captureId: String(row?.capture_id || ""),
    documentRecordId: String(row?.document_record_id || ""),
    tenantId: String(row?.tenant_id || ""),
    eventCount: Number(row?.event_count || 0),
    canonicalProjectionCount: Number(row?.canonical_projection_count || 0),
    capturedAt: String(row?.captured_at || ""),
    replayed: Boolean(row?.replayed),
  };
  if (!UUID_RE.test(receipt.captureId) || !UUID_RE.test(receipt.documentRecordId)
      || receipt.tenantId !== input.tenantId || receipt.eventCount !== validated.events.length
      || receipt.canonicalProjectionCount !== validated.projectionCount || !validDateTime(receipt.capturedAt)) {
    throw new EpcisError("epcis_capture_receipt_invalid", 503);
  }
  return receipt;
}

export type EpcisQueryFilters = {
  limit: number;
  cursor?: string;
  eventType?: string;
  bizStep?: string;
  disposition?: string;
  gtin?: string;
  lot?: string;
  serial?: string;
  eventTimeFrom?: string;
  eventTimeTo?: string;
};

type EpcisCursor = { eventTime: string; id: string };

export function encodeEpcisCursor(cursor: EpcisCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeEpcisCursor(value: unknown): EpcisCursor | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.length > 512 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new EpcisError("epcis_cursor_invalid", 400);
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const eventTime = validDateTime(parsed?.eventTime);
    const id = String(parsed?.id || "");
    if (!eventTime || !UUID_RE.test(id)) throw new Error("invalid");
    return { eventTime, id };
  } catch {
    throw new EpcisError("epcis_cursor_invalid", 400);
  }
}

export function parseEpcisQueryFilters(search: URLSearchParams): EpcisQueryFilters {
  const rawLimit = search.get("limit") ?? "50";
  if (!/^\d{1,4}$/.test(rawLimit)) throw new EpcisError("epcis_limit_invalid", 400);
  const limit = Number(rawLimit);
  if (limit < 1 || limit > EPCIS_QUERY_MAX_LIMIT) throw new EpcisError("epcis_limit_invalid", 400);
  const eventType = boundedText(search.get("eventType"), 32);
  if (eventType && !EVENT_TYPES.has(eventType)) throw new EpcisError("epcis_event_type_unsupported", 400);
  const bizStep = search.has("bizStep") ? normalizeVocabulary(search.get("bizStep"), "BizStep") : "";
  const disposition = search.has("disposition") ? normalizeVocabulary(search.get("disposition"), "Disp") : "";
  const gtinRaw = boundedText(search.get("gtin"), 14);
  const lot = boundedText(search.get("lot"), 20);
  const serial = boundedText(search.get("serial"), 20);
  let gtin = "";
  if (gtinRaw || lot || serial) {
    const identity = parseGs1DigitalLinkUri(`https://id.nexid.lat/01/${gtinRaw}${lot ? `/10/${encodeURIComponent(lot)}` : ""}${serial ? `/21/${encodeURIComponent(serial)}` : ""}`);
    gtin = identity.gtin;
  }
  const eventTimeFrom = search.has("eventTimeFrom") ? validDateTime(search.get("eventTimeFrom")) : "";
  const eventTimeTo = search.has("eventTimeTo") ? validDateTime(search.get("eventTimeTo")) : "";
  if ((search.has("eventTimeFrom") && !eventTimeFrom) || (search.has("eventTimeTo") && !eventTimeTo)) {
    throw new EpcisError("epcis_event_time_filter_invalid", 400);
  }
  if (eventTimeFrom && eventTimeTo && eventTimeFrom > eventTimeTo) {
    throw new EpcisError("epcis_event_time_range_invalid", 400);
  }
  return {
    limit,
    cursor: search.get("cursor") || "",
    eventType,
    bizStep,
    disposition,
    gtin,
    lot,
    serial,
    eventTimeFrom,
    eventTimeTo,
  };
}

export async function queryEpcisEvents(tenantId: string, filters: EpcisQueryFilters) {
  const cursor = decodeEpcisCursor(filters.cursor);
  const eventType = boundedText(filters.eventType, 32);
  const bizStep = boundedText(filters.bizStep, 512);
  const disposition = boundedText(filters.disposition, 512);
  const gtin = boundedText(filters.gtin, 14);
  const lot = boundedText(filters.lot, 20);
  const serial = boundedText(filters.serial, 20);
  const eventTimeFrom = filters.eventTimeFrom || "";
  const eventTimeTo = filters.eventTimeTo || "";
  const fetchLimit = filters.limit + 1;
  const rows = await sql/*sql*/`
    SELECT event.id::text AS id, event.event_time, event.event_json,
      document.id::text AS document_record_id,
      document.capture_operation_id::text AS capture_id
    FROM epcis_events event
    JOIN epcis_documents document ON document.id = event.document_id
    WHERE event.tenant_id = ${tenantId}::uuid
      AND (${eventType} = '' OR event.event_type = ${eventType})
      AND (${bizStep} = '' OR event.biz_step = ${bizStep})
      AND (${disposition} = '' OR event.disposition = ${disposition})
      AND (${eventTimeFrom} = '' OR event.event_time >= ${eventTimeFrom || null}::timestamptz)
      AND (${eventTimeTo} = '' OR event.event_time <= ${eventTimeTo || null}::timestamptz)
      AND (
        ${gtin} = '' OR EXISTS (
          SELECT 1
          FROM epcis_event_identifiers link
          JOIN gs1_digital_link_identities identity ON identity.id = link.gs1_identity_id
          WHERE link.epcis_event_id = event.id
            AND link.tenant_id = event.tenant_id
            AND identity.gtin = ${gtin}
            AND (${lot} = '' OR identity.lot = ${lot})
            AND (${serial} = '' OR identity.serial = ${serial})
        )
      )
      AND (
        ${cursor?.eventTime || ""} = ''
        OR event.event_time < ${cursor?.eventTime || null}::timestamptz
        OR (event.event_time = ${cursor?.eventTime || null}::timestamptz AND event.id < ${cursor?.id || null}::uuid)
      )
    ORDER BY event.event_time DESC, event.id DESC
    LIMIT ${fetchLimit}
  ` as Array<Record<string, unknown>>;
  const hasMore = rows.length > filters.limit;
  const page = rows.slice(0, filters.limit);
  const last = page.at(-1);
  const nextCursor = hasMore && last
    ? encodeEpcisCursor({ eventTime: new Date(String(last.event_time)).toISOString(), id: String(last.id) })
    : null;
  return {
    events: page.map((row) => {
      if (row.event_json && typeof row.event_json === "object" && !Array.isArray(row.event_json)) {
        return row.event_json as JsonRecord;
      }
      try {
        return asRecord(JSON.parse(String(row.event_json || "{}")), "epcis_stored_event_invalid");
      } catch {
        throw new EpcisError("epcis_stored_event_invalid", 503);
      }
    }),
    nextCursor,
    pageSize: page.length,
  };
}

export function buildEpcisQueryDocument(events: JsonRecord[]) {
  return {
    "@context": EPCIS_CONTEXT,
    type: "EPCISQueryDocument",
    schemaVersion: EPCIS_VERSION,
    creationDate: new Date().toISOString(),
    epcisBody: {
      queryResults: {
        queryName: "SimpleEventQuery",
        resultsBody: { eventList: events },
      },
    },
  };
}

export function buildEpcisExportDocument(events: JsonRecord[]) {
  return {
    "@context": EPCIS_CONTEXT,
    type: "EPCISDocument",
    schemaVersion: EPCIS_VERSION,
    creationDate: new Date().toISOString(),
    epcisBody: { eventList: events },
  };
}

export const EPCIS_RESPONSE_HEADERS = {
  "content-type": `${EPCIS_MEDIA_TYPE}; charset=utf-8`,
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "gs1-epcis-version": EPCIS_VERSION,
  "gs1-cbv-version": CBV_VERSION,
  "epcis-capture-file-size-limit": String(EPCIS_CAPTURE_MAX_BYTES),
} as const;
