import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
} from "node:crypto";

import { RequestBodyTooLargeError, readRequestTextBounded } from "../../../../lib/bounded-request-body";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import type { SdkAuthContext, SdkScope } from "../../../../lib/sdk-auth";
import { enqueueSdkWebhookGuaranteed } from "../../../../lib/sdk-webhook-outbox-guarantee";
import { mapSdkVerdict, mapSealStatus, maskUid } from "./_shared";

const MAX_MUTATION_BODY_BYTES = 64 * 1024;
const IDEMPOTENCY_TTL_DAYS = 7;
const IDEMPOTENCY_LEASE_SECONDS = 300;
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~:/+=-]{0,254}$/;
const MASTER_KEY_PATTERN = /^[0-9a-fA-F]{64}$/;
const MASTER_KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const STORED_HEADER_NAMES = ["content-type", "retry-after", "x-nexid-trace-id"] as const;

export const SDK_IDEMPOTENCY_OPERATIONS = {
  verifyTap: { route: "/api/v1/sdk/verify", scope: "sdk:verify" },
  claimOwnership: { route: "/api/v1/sdk/claim", scope: "sdk:claim" },
  reportEvent: { route: "/api/v1/sdk/events", scope: "sdk:events" },
  activatePosPurchase: { route: "/api/v1/sdk/pos/activate", scope: "sdk:pos" },
} as const satisfies Record<string, { route: string; scope: SdkScope }>;

export type SdkIdempotencyOperation = keyof typeof SDK_IDEMPOTENCY_OPERATIONS;
export type SdkIdempotencyRoute = (typeof SDK_IDEMPOTENCY_OPERATIONS)[SdkIdempotencyOperation]["route"];

type StoredOperation = {
  id: string;
  tenant_id: string;
  route: SdkIdempotencyRoute;
  idempotency_key: string;
  request_hash: string;
  state: "processing" | "completed" | "failed" | "uncertain";
  response_status: number | null;
  response_headers: Record<string, unknown> | string | null;
  response_body_ciphertext: string | null;
  resource_id: string | null;
  operation_committed: boolean | null;
  reconciliation_status: "not_requested" | "confirmed" | "not_configured" | "failed";
  reconciliation_details: Record<string, unknown> | string | null;
  reconciled_at: string | null;
  trace_id: string | null;
  error_code: string | null;
  lease_expires_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  expires_at: string;
};

type MutationExecutionContext = {
  idempotencyOperationId: string | null;
  idempotencyKey: string | null;
};

type RunMutationInput = {
  req: Request;
  context: SdkAuthContext;
  route: SdkIdempotencyRoute;
  body: Record<string, unknown>;
  execute: (context: MutationExecutionContext) => Promise<Response>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("idempotency_request_not_canonical_json");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  throw new TypeError("idempotency_request_not_canonical_json");
}

export function canonicalSdkRequestJson(body: Record<string, unknown>) {
  return canonicalJson(body);
}

type SdkIdempotencyMasterKeyring = {
  activeKeyId: string;
  activeKey: Buffer;
  keysById: Map<string, Buffer>;
};

export function sdkIdempotencyKeyIdForMasterKey(masterKey: Buffer) {
  if (masterKey.byteLength !== 32) throw new Error("sdk_idempotency_master_key_invalid");
  return `key_${createHash("sha256").update(masterKey).digest("hex").slice(0, 16)}`;
}

function parseMasterKey(raw: unknown) {
  const normalized = String(raw || "").trim();
  if (!MASTER_KEY_PATTERN.test(normalized)) throw new Error("sdk_idempotency_master_key_unavailable");
  return Buffer.from(normalized, "hex");
}

function readMasterKeyring(): SdkIdempotencyMasterKeyring {
  const activeKey = parseMasterKey(process.env.SDK_IDEMPOTENCY_MASTER_KEY_HEX);
  const configuredActiveKeyId = String(process.env.SDK_IDEMPOTENCY_MASTER_KEY_ID || "").trim();
  const activeKeyId = configuredActiveKeyId || sdkIdempotencyKeyIdForMasterKey(activeKey);
  if (!MASTER_KEY_ID_PATTERN.test(activeKeyId)) throw new Error("sdk_idempotency_master_key_id_invalid");

  const keysById = new Map<string, Buffer>([[activeKeyId, activeKey]]);
  const previousRaw = String(process.env.SDK_IDEMPOTENCY_PREVIOUS_KEYS_JSON || "").trim();
  if (previousRaw) {
    let previous: unknown;
    try {
      previous = JSON.parse(previousRaw);
    } catch {
      throw new Error("sdk_idempotency_previous_keys_invalid");
    }
    if (!previous || typeof previous !== "object" || Array.isArray(previous)) {
      throw new Error("sdk_idempotency_previous_keys_invalid");
    }
    for (const [keyId, rawKey] of Object.entries(previous as Record<string, unknown>)) {
      if (!MASTER_KEY_ID_PATTERN.test(keyId)) throw new Error("sdk_idempotency_previous_key_id_invalid");
      const key = parseMasterKey(rawKey);
      const existing = keysById.get(keyId);
      if (existing && !existing.equals(key)) throw new Error("sdk_idempotency_key_id_collision");
      keysById.set(keyId, key);
    }
  }
  return { activeKeyId, activeKey, keysById };
}

function readMasterKey() {
  return readMasterKeyring().activeKey;
}

function deriveKey(master: Buffer, purpose: "request-hash" | "response-encryption") {
  return createHmac("sha256", master)
    .update(`nexid-sdk-idempotency-v1:${purpose}`, "utf8")
    .digest();
}

export function hashCanonicalSdkRequest(input: {
  tenantId: string;
  route: SdkIdempotencyRoute;
  body: Record<string, unknown>;
  masterKey?: Buffer;
}) {
  const master = input.masterKey || readMasterKey();
  const canonical = canonicalSdkRequestJson(input.body);
  return createHmac("sha256", deriveKey(master, "request-hash"))
    .update(`${input.tenantId}\u0000${input.route}\u0000${canonical}`, "utf8")
    .digest("hex");
}

export function matchesStoredRequestHash(input: {
  tenantId: string;
  route: SdkIdempotencyRoute;
  body: Record<string, unknown>;
  activeRequestHash: string;
  storedRequestHash: string;
}) {
  if (input.storedRequestHash === input.activeRequestHash) return true;
  for (const masterKey of readMasterKeyring().keysById.values()) {
    const candidate = hashCanonicalSdkRequest({
      tenantId: input.tenantId,
      route: input.route,
      body: input.body,
      masterKey,
    });
    if (candidate === input.storedRequestHash) return true;
  }
  return false;
}

function responseAad(
  operation: Pick<StoredOperation, "tenant_id" | "route" | "idempotency_key" | "request_hash">,
  keyId?: string,
) {
  return Buffer.from([
    keyId ? "nexid-sdk-idempotency-response-v2" : "nexid-sdk-idempotency-response-v1",
    ...(keyId ? [keyId] : []),
    operation.tenant_id,
    operation.route,
    operation.idempotency_key,
    operation.request_hash,
  ].join("\u0000"), "utf8");
}

export function encryptSdkIdempotencyResponseBody(
  rawBody: string,
  operation: Pick<StoredOperation, "tenant_id" | "route" | "idempotency_key" | "request_hash">,
) {
  const keyring = readMasterKeyring();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(keyring.activeKey, "response-encryption"), iv);
  cipher.setAAD(responseAad(operation, keyring.activeKeyId));
  const ciphertext = Buffer.concat([cipher.update(rawBody, "utf8"), cipher.final()]);
  return [
    "v2",
    keyring.activeKeyId,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

function decryptWithMasterKey(input: {
  masterKey: Buffer;
  keyId?: string;
  ivRaw: string;
  tagRaw: string;
  ciphertextRaw: string;
  operation: Pick<StoredOperation, "tenant_id" | "route" | "idempotency_key" | "request_hash">;
}) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(input.masterKey, "response-encryption"),
    Buffer.from(input.ivRaw, "base64url"),
  );
  decipher.setAAD(responseAad(input.operation, input.keyId));
  decipher.setAuthTag(Buffer.from(input.tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(input.ciphertextRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function decryptSdkIdempotencyResponseBody(
  envelope: string,
  operation: Pick<StoredOperation, "tenant_id" | "route" | "idempotency_key" | "request_hash">,
) {
  const parts = String(envelope || "").split(".");
  const version = parts[0];
  const keyring = readMasterKeyring();
  if (version === "v2") {
    const [, keyId, ivRaw, tagRaw, ciphertextRaw, ...extra] = parts;
    if (!keyId || !ivRaw || !tagRaw || !ciphertextRaw || extra.length || !MASTER_KEY_ID_PATTERN.test(keyId)) {
      throw new Error("sdk_idempotency_response_ciphertext_invalid");
    }
    const masterKey = keyring.keysById.get(keyId);
    if (!masterKey) throw new Error("sdk_idempotency_response_key_unknown");
    return decryptWithMasterKey({ masterKey, keyId, ivRaw, tagRaw, ciphertextRaw, operation });
  }

  // Backward-compatible read path for v1 envelopes created before KIDs were
  // introduced. Every retained key is tried; new writes are always v2.
  const [, ivRaw, tagRaw, ciphertextRaw, ...extra] = parts;
  if (version !== "v1" || !ivRaw || !tagRaw || !ciphertextRaw || extra.length) {
    throw new Error("sdk_idempotency_response_ciphertext_invalid");
  }
  for (const masterKey of keyring.keysById.values()) {
    try {
      return decryptWithMasterKey({ masterKey, ivRaw, tagRaw, ciphertextRaw, operation });
    } catch {
      // Continue only across the explicitly configured active/previous keyring.
    }
  }
  throw new Error("sdk_idempotency_response_decryption_failed");
}

function storedHeaders(response: Response) {
  const headers: Record<string, string> = {};
  for (const name of STORED_HEADER_NAMES) {
    const value = response.headers.get(name);
    if (value) headers[name] = value;
  }
  return headers;
}

function restoredHeaders(value: StoredOperation["response_headers"]) {
  if (typeof value === "string") {
    try {
      return restoredHeaders(JSON.parse(value));
    } catch {
      return {};
    }
  }
  const record = asRecord(value);
  const headers: Record<string, string> = {};
  for (const name of STORED_HEADER_NAMES) {
    if (typeof record[name] === "string" && record[name]) headers[name] = String(record[name]);
  }
  return headers;
}

function decorateResponse(response: Response, input: {
  state: StoredOperation["state"];
  replayed: boolean;
  traceId: string | null;
}) {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-nexid-idempotency-status", input.state);
  headers.set("x-nexid-idempotent-replay", input.replayed ? "true" : "false");
  if (input.traceId && !headers.has("x-nexid-trace-id")) headers.set("x-nexid-trace-id", input.traceId);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function idempotencyFailure(reason: string, traceId: string, status = 503, extra: Record<string, unknown> = {}) {
  return json({ ok: false, reason, retryable: status >= 500, traceId, ...extra }, status, {
    "cache-control": "no-store",
    "x-nexid-trace-id": traceId,
  });
}

function validateIdempotencyKey(req: Request) {
  const header = req.headers.get("idempotency-key");
  if (header === null) return { ok: true as const, key: null };
  const key = header.trim();
  if (!KEY_PATTERN.test(key)) return { ok: false as const, key: null };
  return { ok: true as const, key };
}

async function beginOperation(input: {
  context: SdkAuthContext;
  route: SdkIdempotencyRoute;
  key: string;
  requestHash: string;
}) {
  await sql/*sql*/`
    DELETE FROM sdk_idempotency_operations
    WHERE tenant_id = ${input.context.tenantId}::uuid
      AND route = ${input.route}
      AND idempotency_key = ${input.key}
      AND expires_at <= now()
  `;
  const leaseToken = randomUUID();
  const inserted = await sql/*sql*/`
    INSERT INTO sdk_idempotency_operations (
      tenant_id, api_key_id, route, idempotency_key, request_hash, state,
      trace_id, lease_token, lease_expires_at, expires_at
    ) VALUES (
      ${input.context.tenantId}::uuid,
      ${input.context.apiKeyId}::uuid,
      ${input.route},
      ${input.key},
      ${input.requestHash},
      'processing',
      ${input.context.traceId},
      ${leaseToken},
      now() + (${IDEMPOTENCY_LEASE_SECONDS} * interval '1 second'),
      now() + (${IDEMPOTENCY_TTL_DAYS} * interval '1 day')
    )
    ON CONFLICT (tenant_id, route, idempotency_key) DO NOTHING
    RETURNING *, id::text AS id
  `;
  if (inserted[0]) return { acquired: true as const, leaseToken, operation: inserted[0] as unknown as StoredOperation };

  const existing = await sql/*sql*/`
    SELECT *, id::text AS id
    FROM sdk_idempotency_operations
    WHERE tenant_id = ${input.context.tenantId}::uuid
      AND route = ${input.route}
      AND idempotency_key = ${input.key}
    LIMIT 1
  `;
  return { acquired: false as const, leaseToken: null, operation: existing[0] as unknown as StoredOperation | undefined };
}

function resourceIdFromResponseBody(rawBody: string) {
  try {
    const body = asRecord(JSON.parse(rawBody));
    const operation = asRecord(body.operation);
    return String(
      body.resourceId
      || body.eventId
      || body.claimId
      || body.activationId
      || operation.eventId
      || operation.claimId
      || operation.activationId
      || "",
    ).trim() || null;
  } catch {
    return null;
  }
}

function committedFromResponse(response: Response, rawBody: string, resourceId: string | null) {
  try {
    const body = asRecord(JSON.parse(rawBody));
    if (typeof body.operationCommitted === "boolean") return body.operationCommitted;
  } catch {
    // A non-JSON response cannot assert a committed write.
  }
  if (resourceId) return true;
  if (response.status >= 500) return null;
  return false;
}

async function finalizeOperation(input: {
  operation: StoredOperation;
  leaseToken: string;
  response: Response;
  state?: StoredOperation["state"];
  errorCode?: string | null;
}) {
  const rawBody = await input.response.clone().text();
  const resourceId = resourceIdFromResponseBody(rawBody);
  const operationCommitted = committedFromResponse(input.response, rawBody, resourceId);
  const state = input.state || (input.response.status >= 500
    ? operationCommitted === false ? "failed" : "uncertain"
    : "completed");
  const ciphertext = encryptSdkIdempotencyResponseBody(rawBody, input.operation);
  const rows = await sql/*sql*/`
    UPDATE sdk_idempotency_operations
    SET state = ${state},
        response_status = ${input.response.status},
        response_headers = ${JSON.stringify(storedHeaders(input.response))}::jsonb,
        response_body_ciphertext = ${ciphertext},
        resource_id = COALESCE(${resourceId}, resource_id),
        operation_committed = ${operationCommitted},
        error_code = ${input.errorCode || null},
        lease_token = NULL,
        lease_expires_at = NULL,
        completed_at = now(),
        updated_at = now()
    WHERE id = ${input.operation.id}::uuid
      AND state = 'processing'
      AND lease_token = ${input.leaseToken}
    RETURNING id::text AS id
  `;
  if (!rows[0]) throw new Error("sdk_idempotency_finalize_lease_lost");
  return { state, rawBody, resourceId, operationCommitted };
}

function replayStoredOperation(operation: StoredOperation, traceId: string) {
  if (operation.response_status === null || !operation.response_body_ciphertext) {
    return idempotencyFailure("idempotency_operation_outcome_uncertain", traceId, 409, {
      idempotencyStatus: operation.state,
      operationCommitted: operation.operation_committed,
      resourceId: operation.resource_id,
      recovery: "Query the idempotency reconciliation endpoint. Do not create a new key while the outcome is uncertain.",
    });
  }
  try {
    const rawBody = decryptSdkIdempotencyResponseBody(operation.response_body_ciphertext, operation);
    const response = new Response(rawBody, {
      status: operation.response_status,
      headers: restoredHeaders(operation.response_headers),
    });
    return decorateResponse(response, { state: operation.state, replayed: true, traceId: operation.trace_id || traceId });
  } catch {
    return idempotencyFailure("idempotency_replay_unavailable", traceId, 503, {
      idempotencyStatus: operation.state,
      operationCommitted: operation.operation_committed,
      resourceId: operation.resource_id,
    });
  }
}

export async function runSdkIdempotentMutation(input: RunMutationInput): Promise<Response> {
  const validatedKey = validateIdempotencyKey(input.req);
  if (!validatedKey.ok) {
    return idempotencyFailure("idempotency_key_invalid", input.context.traceId, 400, {
      requirement: "Use 1-255 visible characters: letters, digits, dot, underscore, tilde, colon, slash, plus, equals or hyphen.",
    });
  }
  if (!validatedKey.key) {
    return input.execute({ idempotencyOperationId: null, idempotencyKey: null });
  }

  let requestHash: string;
  try {
    requestHash = hashCanonicalSdkRequest({
      tenantId: input.context.tenantId,
      route: input.route,
      body: input.body,
    });
  } catch {
    return idempotencyFailure("idempotency_service_unavailable", input.context.traceId, 503);
  }

  let claim: Awaited<ReturnType<typeof beginOperation>>;
  try {
    claim = await beginOperation({
      context: input.context,
      route: input.route,
      key: validatedKey.key,
      requestHash,
    });
  } catch {
    return idempotencyFailure("idempotency_store_unavailable", input.context.traceId, 503);
  }

  if (!claim.operation) return idempotencyFailure("idempotency_store_unavailable", input.context.traceId, 503);
  if (!claim.acquired) {
    let requestMatches: boolean;
    try {
      requestMatches = matchesStoredRequestHash({
        tenantId: input.context.tenantId,
        route: input.route,
        body: input.body,
        activeRequestHash: requestHash,
        storedRequestHash: claim.operation.request_hash,
      });
    } catch {
      return idempotencyFailure("idempotency_service_unavailable", input.context.traceId, 503);
    }
    if (!requestMatches) {
      return idempotencyFailure("idempotency_key_payload_mismatch", input.context.traceId, 409, {
        idempotencyStatus: claim.operation.state,
        recovery: "Use the original request body with this key, or choose a new key for a genuinely new operation.",
      });
    }
    if (claim.operation.state === "processing") {
      const leaseExpiresAt = new Date(String(claim.operation.lease_expires_at || "")).getTime();
      const leaseActive = Number.isFinite(leaseExpiresAt) && leaseExpiresAt > Date.now();
      if (leaseActive) {
        const retryAfter = Math.max(1, Math.min(30, Math.ceil((leaseExpiresAt - Date.now()) / 1000)));
        return json({
          ok: false,
          reason: "idempotency_operation_in_progress",
          retryable: true,
          idempotencyStatus: "processing",
          traceId: claim.operation.trace_id || input.context.traceId,
        }, 409, { "retry-after": String(retryAfter), "cache-control": "no-store" });
      }
      await sql/*sql*/`
        UPDATE sdk_idempotency_operations
        SET state = 'uncertain', error_code = 'idempotency_lease_expired', updated_at = now()
        WHERE id = ${claim.operation.id}::uuid
          AND state = 'processing'
          AND lease_expires_at <= now()
      `;
      claim.operation.state = "uncertain";
    }
    return replayStoredOperation(claim.operation, input.context.traceId);
  }

  let response: Response;
  try {
    response = await input.execute({
      idempotencyOperationId: claim.operation.id,
      idempotencyKey: validatedKey.key,
    });
  } catch {
    response = idempotencyFailure("sdk_operation_outcome_uncertain", input.context.traceId, 503, {
      operationCommitted: null,
      recovery: "Query the idempotency reconciliation endpoint. Do not retry with a new key.",
    });
    try {
      const finalized = await finalizeOperation({
        operation: claim.operation,
        leaseToken: claim.leaseToken,
        response,
        state: "uncertain",
        errorCode: "sdk_operation_outcome_uncertain",
      });
      return decorateResponse(response, { state: finalized.state, replayed: false, traceId: input.context.traceId });
    } catch {
      return response;
    }
  }

  try {
    const finalized = await finalizeOperation({
      operation: claim.operation,
      leaseToken: claim.leaseToken,
      response,
      errorCode: response.status >= 500 ? "sdk_operation_response_uncertain" : null,
    });
    return decorateResponse(response, { state: finalized.state, replayed: false, traceId: input.context.traceId });
  } catch {
    return idempotencyFailure("idempotency_finalize_unavailable", input.context.traceId, 503, {
      operationCommitted: response.status < 500 ? resourceIdFromResponseBody(await response.clone().text()) !== null : null,
      recovery: "Query the idempotency reconciliation endpoint. Do not retry with a new key.",
    });
  }
}

export async function readSdkMutationBody(req: Request, traceId: string) {
  try {
    const rawBody = await readRequestTextBounded(req, MAX_MUTATION_BODY_BYTES);
    const parsed = JSON.parse(rawBody || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new SyntaxError("json_object_required");
    return { ok: true as const, body: parsed as Record<string, unknown> };
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return {
      ok: false as const,
      response: idempotencyFailure(
        tooLarge ? "sdk_request_body_too_large" : "sdk_request_body_invalid",
        traceId,
        tooLarge ? 413 : 400,
        tooLarge ? { maxBytes: MAX_MUTATION_BODY_BYTES } : {},
      ),
    };
  }
}

export function parseSdkIdempotencyOperation(value: string | null): SdkIdempotencyOperation | null {
  const operation = String(value || "").trim() as SdkIdempotencyOperation;
  return Object.prototype.hasOwnProperty.call(SDK_IDEMPOTENCY_OPERATIONS, operation) ? operation : null;
}

async function discoverLinkedResource(operationId: string, route: SdkIdempotencyRoute, tenantId: string) {
  const rows = await sql/*sql*/`
    SELECT resource_id
    FROM (
      SELECT event.id::text AS resource_id, '/api/v1/sdk/verify'::text AS route
      FROM events event
      WHERE event.tenant_id = ${tenantId}::uuid
        AND (
          event.sdk_idempotency_operation_id = ${operationId}::uuid
          OR event.meta->>'sdk_idempotency_operation_id' = ${operationId}
        )
      UNION ALL
      SELECT claim.id::text, '/api/v1/sdk/claim'::text
      FROM sdk_claim_requests claim
      WHERE claim.tenant_id = ${tenantId}::uuid
        AND claim.idempotency_operation_id = ${operationId}::uuid
      UNION ALL
      SELECT external_event.id::text, '/api/v1/sdk/events'::text
      FROM sdk_external_events external_event
      WHERE external_event.tenant_id = ${tenantId}::uuid
        AND external_event.idempotency_operation_id = ${operationId}::uuid
      UNION ALL
      SELECT activation.id::text, '/api/v1/sdk/pos/activate'::text
      FROM sdk_pos_activations activation
      WHERE activation.tenant_id = ${tenantId}::uuid
        AND activation.idempotency_operation_id = ${operationId}::uuid
    ) linked
    WHERE linked.route = ${route}
    LIMIT 1
  `;
  return String((rows[0] as { resource_id?: string } | undefined)?.resource_id || "").trim() || null;
}

async function repairSdkWebhookOutbox(operation: StoredOperation, resourceId: string) {
  const traceId = operation.trace_id || `sdk_reconcile_${operation.id}`;
  const inputs: Array<Parameters<typeof enqueueSdkWebhookGuaranteed>[0]> = [];

  if (operation.route === SDK_IDEMPOTENCY_OPERATIONS.verifyTap.route) {
    const rows = await sql/*sql*/`
      SELECT
        event.id::text AS event_id,
        event.bid,
        event.uid_hex,
        event.sdm_read_ctr,
        event.result,
        event.reason,
        event.meta,
        tenant.slug AS tenant_slug,
        tenant.name AS tenant_name
      FROM events event
      JOIN tenants tenant ON tenant.id = event.tenant_id
      WHERE event.tenant_id = ${operation.tenant_id}::uuid
        AND event.id::text = ${resourceId}
      LIMIT 1
    `;
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new Error("idempotency_linked_resource_not_found");
    const meta = asRecord(row.meta);
    const verdict = mapSdkVerdict(row.result);
    inputs.push({
      tenantId: operation.tenant_id,
      eventName: "sdk.verify",
      idempotencyKey: resourceId,
      payload: {
        ok: verdict === "VALID",
        verdict,
        uidMasked: maskUid(row.uid_hex),
        readCounter: Number.isFinite(Number(row.sdm_read_ctr)) ? Number(row.sdm_read_ctr) : null,
        sealStatus: mapSealStatus(meta.tamper_status),
        eventId: resourceId,
        tenant: { slug: String(row.tenant_slug || ""), name: String(row.tenant_name || row.tenant_slug || "") },
        bid: String(row.bid || ""),
        result: String(row.result || ""),
        reason: row.reason ? String(row.reason) : null,
        traceId,
      },
      correlationId: traceId,
      resourceId,
    });
  } else if (operation.route === SDK_IDEMPOTENCY_OPERATIONS.reportEvent.route) {
    const rows = await sql/*sql*/`
      SELECT id::text AS event_id, event_type, bid, uid_hex, source
      FROM sdk_external_events
      WHERE tenant_id = ${operation.tenant_id}::uuid
        AND id::text = ${resourceId}
      LIMIT 1
    `;
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new Error("idempotency_linked_resource_not_found");
    inputs.push({
      tenantId: operation.tenant_id,
      eventName: "sdk.external_event",
      idempotencyKey: resourceId,
      payload: {
        eventId: resourceId,
        eventType: String(row.event_type || ""),
        bid: row.bid ? String(row.bid) : null,
        uidHex: row.uid_hex ? String(row.uid_hex) : null,
        source: String(row.source || "sdk"),
        traceId,
      },
      correlationId: traceId,
      resourceId,
    });
  } else if (operation.route === SDK_IDEMPOTENCY_OPERATIONS.claimOwnership.route) {
    const rows = await sql/*sql*/`
      SELECT
        id::text AS claim_id,
        lead_id::text AS lead_id,
        claim_status,
        bid,
        uid_hex,
        pos_validated,
        pin_validated,
        pos_activation_id::text AS pos_activation_id
      FROM sdk_claim_requests
      WHERE tenant_id = ${operation.tenant_id}::uuid
        AND id::text = ${resourceId}
      LIMIT 1
    `;
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new Error("idempotency_linked_resource_not_found");
    const common = {
      claimId: resourceId,
      leadId: String(row.lead_id || ""),
      bid: String(row.bid || ""),
      uidHex: row.uid_hex ? String(row.uid_hex) : null,
      traceId,
    };
    inputs.push({
      tenantId: operation.tenant_id,
      eventName: "sdk.claim.created",
      idempotencyKey: resourceId,
      payload: {
        ...common,
        status: String(row.claim_status || "pending_verification"),
        posValidated: Boolean(row.pos_validated),
        pinValidated: Boolean(row.pin_validated),
      },
      correlationId: traceId,
      resourceId,
    });
    if (String(row.claim_status) === "claimed") {
      inputs.push({
        tenantId: operation.tenant_id,
        eventName: "sdk.claim.claimed",
        idempotencyKey: resourceId,
        payload: { ...common, posActivationId: row.pos_activation_id ? String(row.pos_activation_id) : null },
        correlationId: traceId,
        resourceId,
      });
    }
  } else if (operation.route === SDK_IDEMPOTENCY_OPERATIONS.activatePosPurchase.route) {
    const rows = await sql/*sql*/`
      SELECT id::text AS activation_id, bid, uid_hex, external_order_id, retailer_id, expires_at
      FROM sdk_pos_activations
      WHERE tenant_id = ${operation.tenant_id}::uuid
        AND id::text = ${resourceId}
      LIMIT 1
    `;
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new Error("idempotency_linked_resource_not_found");
    inputs.push({
      tenantId: operation.tenant_id,
      eventName: "sdk.pos.activated",
      idempotencyKey: resourceId,
      payload: {
        activationId: resourceId,
        bid: String(row.bid || ""),
        uidHex: row.uid_hex ? String(row.uid_hex) : null,
        externalOrderId: row.external_order_id ? String(row.external_order_id) : null,
        retailerId: row.retailer_id ? String(row.retailer_id) : null,
        expiresAt: String(row.expires_at || ""),
        traceId,
      },
      correlationId: traceId,
      resourceId,
    });
  }

  if (!inputs.length) throw new Error("idempotency_route_not_reconcilable");
  const receipts = [];
  for (const webhookInput of inputs) receipts.push(await enqueueSdkWebhookGuaranteed(webhookInput));
  const status = receipts.every((receipt) => receipt.status === "not_configured")
    ? "not_configured" as const
    : "confirmed" as const;
  return {
    status,
    details: receipts.map((receipt, index) => ({
      eventName: inputs[index].eventName,
      status: receipt.status,
      eventId: receipt.eventId,
      attempted: receipt.attempted,
      confirmed: receipt.confirmed,
      queued: receipt.queued,
      deduplicated: receipt.deduplicated,
    })),
  };
}

export async function readSdkIdempotencyStatus(input: {
  tenantId: string;
  route: SdkIdempotencyRoute;
  key: string;
  reconcile: boolean;
}) {
  if (!KEY_PATTERN.test(input.key)) return { ok: false as const, status: 400, reason: "idempotency_key_invalid" };
  const rows = await sql/*sql*/`
    SELECT *, id::text AS id
    FROM sdk_idempotency_operations
    WHERE tenant_id = ${input.tenantId}::uuid
      AND route = ${input.route}
      AND idempotency_key = ${input.key}
      AND expires_at > now()
    LIMIT 1
  `;
  const operation = rows[0] as unknown as StoredOperation | undefined;
  if (!operation) return { ok: false as const, status: 404, reason: "idempotency_operation_not_found" };

  const leaseExpired = operation.state === "processing"
    && new Date(String(operation.lease_expires_at || "")).getTime() <= Date.now();
  let resourceId = operation.resource_id;
  if (input.reconcile || leaseExpired || !resourceId) {
    resourceId = resourceId || await discoverLinkedResource(operation.id, input.route, input.tenantId);
    const nextState = leaseExpired ? "uncertain" : operation.state;
    const committed = resourceId ? true : operation.operation_committed;
    await sql/*sql*/`
      UPDATE sdk_idempotency_operations
      SET state = ${nextState},
          resource_id = COALESCE(${resourceId}, resource_id),
          operation_committed = COALESCE(${committed}, operation_committed),
          error_code = CASE WHEN ${leaseExpired} THEN 'idempotency_lease_expired' ELSE error_code END,
          updated_at = now()
      WHERE id = ${operation.id}::uuid
    `;
    operation.state = nextState;
    operation.resource_id = resourceId;
    operation.operation_committed = committed;
  }

  if (input.reconcile && operation.state === "uncertain" && resourceId) {
    try {
      const reconciliation = await repairSdkWebhookOutbox(operation, resourceId);
      const nextState = operation.response_body_ciphertext ? "completed" : "uncertain";
      await sql/*sql*/`
        UPDATE sdk_idempotency_operations
        SET state = ${nextState},
            operation_committed = true,
            reconciliation_status = ${reconciliation.status},
            reconciliation_details = ${JSON.stringify({ webhooks: reconciliation.details })}::jsonb,
            reconciled_at = now(),
            error_code = CASE WHEN ${nextState} = 'completed' THEN NULL ELSE error_code END,
            updated_at = now()
        WHERE id = ${operation.id}::uuid
      `;
      operation.state = nextState;
      operation.operation_committed = true;
      operation.reconciliation_status = reconciliation.status;
      operation.reconciliation_details = { webhooks: reconciliation.details };
      operation.reconciled_at = new Date().toISOString();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "idempotency_reconciliation_failed";
      await sql/*sql*/`
        UPDATE sdk_idempotency_operations
        SET reconciliation_status = 'failed',
            reconciliation_details = ${JSON.stringify({ reason })}::jsonb,
            reconciled_at = now(),
            updated_at = now()
        WHERE id = ${operation.id}::uuid
      `;
      operation.reconciliation_status = "failed";
      operation.reconciliation_details = { reason };
      operation.reconciled_at = new Date().toISOString();
    }
  }

  const nextAction = operation.state === "processing"
    ? "wait_and_poll"
    : operation.state === "uncertain"
      ? "do_not_use_a_new_key; inspect resourceId and escalate downstream delivery if required"
      : "reissue the exact original request with the same key only when the stored response is needed";
  return {
    ok: true as const,
    status: 200,
    body: {
      ok: true,
      route: operation.route,
      state: operation.state,
      operationCommitted: operation.operation_committed,
      resourceId: operation.resource_id,
      traceId: operation.trace_id,
      responseStatus: operation.response_status,
      replayAvailable: Boolean(operation.response_body_ciphertext && operation.response_status !== null),
      reconciliationStatus: operation.reconciliation_status,
      reconciliationDetails: asRecord(operation.reconciliation_details),
      reconciledAt: operation.reconciled_at,
      createdAt: operation.created_at,
      updatedAt: operation.updated_at,
      completedAt: operation.completed_at,
      expiresAt: operation.expires_at,
      nextAction,
    },
  };
}
