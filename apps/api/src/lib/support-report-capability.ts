import { createHmac, timingSafeEqual } from "node:crypto";
import { sql, type SqlExecutor } from "./db";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const SUPPORT_REPORT_PURPOSE = "sun_support_report_v1";
export const SUPPORT_REPORT_TTL_SECONDS = 900;
export type SupportReportScope = { eventId: string; tenantId: string; batchId: string; tenantSlug: string; bid: string; uid: string | null; counter: number | null };
export type SupportReportCapability = { token: string; eventId: string; expiresAt: string };
export function supportEventId(value: unknown): string | null {
  return typeof value === "string" && /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9_223_372_036_854_775_807n ? value : null;
}
function validScope(value: SupportReportScope) {
  return supportEventId(value.eventId) && UUID.test(value.tenantId) && UUID.test(value.batchId)
    && typeof value.bid === "string" && value.bid.length > 0 && value.bid.length <= 160 && !/[\u0000-\u001f\u007f]/.test(value.bid)
    && (value.uid === null || typeof value.uid === "string" && value.uid.length <= 256)
    && (value.counter === null || Number.isSafeInteger(value.counter) && value.counter >= 0);
}
/** Identity is loaded from the event's durable foreign scope, never BID/UID lookup. */
export async function loadSupportReportScope(eventId: unknown, execute: SqlExecutor = sql): Promise<SupportReportScope | null> {
  if (!supportEventId(eventId)) return null;
  const rows = await execute`
    SELECT e.id::text AS event_id,e.tenant_id::text AS tenant_id,e.batch_id::text AS batch_id,
      t.slug AS tenant_slug,e.bid,e.uid_hex,e.sdm_read_ctr
    FROM events e JOIN batches b ON b.id=e.batch_id AND b.tenant_id=e.tenant_id
    JOIN tenants t ON t.id=e.tenant_id
    WHERE e.id=${eventId}::bigint AND e.bid=b.bid
    LIMIT 2
  `;
  if (rows.length !== 1) return null;
  const row = rows[0];
  const scope: SupportReportScope = { eventId: String(row.event_id), tenantId: String(row.tenant_id), batchId: String(row.batch_id),
    tenantSlug: typeof row.tenant_slug === "string" ? row.tenant_slug : "", bid: row.bid as string,
    uid: row.uid_hex === null ? null : row.uid_hex as string, counter: row.sdm_read_ctr === null ? null : row.sdm_read_ctr as number };
  return validScope(scope) && scope.eventId === eventId ? scope : null;
}
function secrets() {
  return [...new Set([process.env.SUN_HANDOFF_SECRET, process.env.SUN_HANDOFF_SECRET_PREVIOUS]
    .map(value => String(value || "").trim()).filter(value => Buffer.byteLength(value, "utf8") >= 32))];
}
function signingSecret() {
  const value = String(process.env.SUN_HANDOFF_SECRET || "").trim();
  if (Buffer.byteLength(value, "utf8") < 32) throw new Error("support_signing_unavailable");
  return value;
}
const mac = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("base64url");
function binding(scope: SupportReportScope, secret: string) {
  return mac("sun-support-binding-v1\0" + JSON.stringify([scope.eventId, scope.tenantId, scope.batchId, scope.bid, scope.uid, scope.counter]), secret);
}
function same(left: string, right: string) {
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function signSupportReportCapability(scope: SupportReportScope, nowMs = Date.now()): SupportReportCapability {
  if (!validScope(scope)) throw new Error("support_scope_invalid");
  const secret = signingSecret(), iat = Math.floor(nowMs / 1000), exp = iat + SUPPORT_REPORT_TTL_SECONDS;
  if (!Number.isSafeInteger(iat) || iat <= 0) throw new Error("support_time_invalid");
  const payload = { purpose: SUPPORT_REPORT_PURPOSE, eventId: scope.eventId, tenantId: scope.tenantId, batchId: scope.batchId,
    bid: scope.bid, binding: binding(scope, secret), iat, exp };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { token: `${body}.${mac("sun-support-token-v1\0" + body, secret)}`, eventId: scope.eventId, expiresAt: new Date(exp * 1000).toISOString() };
}
export function verifySupportReportCapability(token: unknown, scope: SupportReportScope, nowMs = Date.now()): { ok: true } | { ok: false; reason: string } {
  const denied = (reason: string) => ({ ok: false as const, reason });
  if (typeof token !== "string" || token.length > 3000 || !validScope(scope)) return denied("missing_or_invalid");
  const match = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return denied("malformed");
  const secret = secrets().find(value => same(match[2], mac("sun-support-token-v1\0" + match[1], value)));
  if (!secret) return denied("invalid_signature");
  try {
    const bytes = Buffer.from(match[1], "base64url");
    if (bytes.toString("base64url") !== match[1]) return denied("malformed");
    const p = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!p || Array.isArray(p) || p.purpose !== SUPPORT_REPORT_PURPOSE) return denied("wrong_purpose");
    if (p.eventId !== scope.eventId || p.tenantId !== scope.tenantId || p.batchId !== scope.batchId || p.bid !== scope.bid
      || typeof p.binding !== "string" || !same(p.binding, binding(scope, secret))) return denied("scope_mismatch");
    const now = Math.floor(nowMs / 1000);
    if (!Number.isSafeInteger(now) || !Number.isSafeInteger(p.iat) || !Number.isSafeInteger(p.exp) || p.iat <= 0
      || p.iat > now + 60 || p.exp <= p.iat || p.exp - p.iat > SUPPORT_REPORT_TTL_SECONDS) return denied("invalid_lifetime");
    if (p.exp <= now) return denied("expired");
    return { ok: true };
  } catch { return denied("malformed"); }
}
/** Call only after authorizing a passport read and persisting its event. Never
 * store this report-only capability in the diagnostic or general analytics. */
export async function createSupportReportCapability(eventId: unknown, execute: SqlExecutor = sql): Promise<SupportReportCapability | null> {
  try { const scope = await loadSupportReportScope(eventId, execute); return scope ? signSupportReportCapability(scope) : null; }
  catch { return null; }
}
