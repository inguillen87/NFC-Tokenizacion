import { checkAdminWithPermission, getAdminPrincipal } from "./auth";
import { auditFreeformContainsSecret } from "./audit-freeform-secret-policy";
import { sql, type SqlExecutor } from "./db";
import { json } from "./http";

export const SUPPORT_TICKET_WORKFLOW_PROTOCOL = "nexid.support-ticket-workflow.v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;
const REVISION = /^[0-9a-f]{64}$/;
const STATUSES = ["open", "pending", "closed"];
const HEADERS = { "cache-control": "private, no-store, max-age=0", "referrer-policy": "no-referrer", vary: "Authorization, Cookie" };
const ERROR_STATUS: Record<string, number> = { forbidden: 403, ticket_not_found: 404, ticket_workflow_invalid_request: 400, ticket_workflow_no_change: 400, ticket_workflow_conflict: 409, ticket_workflow_blocked: 409 };
type Dependencies = { authorize?: typeof checkAdminWithPermission; principal?: typeof getAdminPrincipal; execute?: SqlExecutor };
type Command = { status: string; reason: string; request_id: string; expected_revision: string };
type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue | null { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : null; }
function uuid(value: unknown): value is string { return typeof value === "string" && UUID.test(value) && value === value.toLowerCase(); }
function sequence(value: unknown): value is string { return typeof value === "string" && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n; }
function iso(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function parseTicketWorkflowCommand(value: unknown): Command | null {
  const input = object(value);
  if (!input || Object.keys(input).length !== 4 || !Object.keys(input).every(key => ["status", "reason", "request_id", "expected_revision"].includes(key))
    || typeof input.status !== "string" || !STATUSES.includes(input.status)
    || typeof input.reason !== "string" || input.reason.length > 1100
    || typeof input.request_id !== "string" || !UUID.test(input.request_id)
    || typeof input.expected_revision !== "string" || !REVISION.test(input.expected_revision)) return null;
  const reason = input.reason.replace(/[\r\n\t]+/g, " ").trim();
  if (!reason || reason.length > 1000 || /[\u0000-\u001f\u007f-\u009f]/.test(reason) || auditFreeformContainsSecret(reason)) return null;
  return { status: input.status, reason, request_id: input.request_id.toLowerCase(), expected_revision: input.expected_revision };
}

async function readCommand(req: Request) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") || "")) return null;
  if (Number(req.headers.get("content-length") || 0) > 8192 || !req.body) return null;
  const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 8192) { await reader.cancel(); return null; }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return parseTicketWorkflowCommand(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  } catch { return null; } finally { reader.releaseLock(); }
}

function projectCurrent(value: unknown, id: string, tenantId: string | null, tenantSlug: string | null) {
  const row = object(value); if (!row || row.ticketId !== id || !uuid(row.ticketId)) return null;
  const updatedAt = iso(row.updatedAt);
  if (!updatedAt || typeof row.status !== "string" || !row.status || row.status.length > 64
    || typeof row.revision !== "string" || !REVISION.test(row.revision)
    || row.tenantId !== null && !uuid(row.tenantId)
    || row.tenantSlug !== null && (typeof row.tenantSlug !== "string" || !SLUG.test(row.tenantSlug))
    || tenantId && row.tenantId !== tenantId || tenantSlug && row.tenantSlug !== tenantSlug
    || typeof row.canUpdate !== "boolean" || ![null, "incident_managed", "legacy_status", "tenant_unassigned"].includes(row.blockedReason as string | null)
    || row.canUpdate !== (row.blockedReason === null)
    || row.canUpdate && (!STATUSES.includes(row.status) || !row.tenantId || !row.tenantSlug)) return null;
  return { ticketId: row.ticketId, tenantId: row.tenantId as string | null, tenantSlug: row.tenantSlug as string | null,
    status: row.status, updatedAt, revision: row.revision, canUpdate: row.canUpdate, blockedReason: row.blockedReason as string | null };
}

function projectReceipt(value: unknown) {
  const row = object(value), actor = object(row?.actor); if (!row || !actor) return null;
  const createdAt = iso(row.createdAt);
  if (!uuid(row.operationId) || !uuid(row.requestId) || !sequence(row.sequence)
    || typeof row.fromStatus !== "string" || !STATUSES.includes(row.fromStatus)
    || typeof row.toStatus !== "string" || !STATUSES.includes(row.toStatus) || row.fromStatus === row.toStatus
    || typeof row.reason !== "string" || !row.reason.trim() || row.reason.length > 1000
    || typeof row.revision !== "string" || !REVISION.test(row.revision) || !createdAt || !uuid(actor.id)
    || actor.label !== null && (typeof actor.label !== "string" || actor.label.length > 320)) return null;
  return { operationId: row.operationId, requestId: row.requestId, sequence: row.sequence,
    fromStatus: row.fromStatus, toStatus: row.toStatus, reason: row.reason,
    actor: { id: actor.id, label: actor.label as string | null }, createdAt, revision: row.revision };
}

async function handle(req: Request, idInput: unknown, write: boolean, dependencies: Dependencies) {
  const fail = (reason: string, status: number) => json({ ok: false, reason }, status, HEADERS);
  try {
    const auth = await (dependencies.authorize || checkAdminWithPermission)(req, "leads.manage");
    if (auth) return fail(auth.status === 401 ? "unauthorized" : auth.status === 403 ? "forbidden" : "ticket_workflow_unavailable", [401, 403].includes(auth.status) ? auth.status : 503);
    const principal = (dependencies.principal || getAdminPrincipal)(req);
    if (typeof idInput !== "string" || !UUID.test(idInput)) return fail("ticket_id_invalid", 400);
    const id = idInput.toLowerCase(), parameters = new URL(req.url).searchParams;
    const selectors = parameters.getAll("tenant"), cursors = parameters.getAll("cursor");
    if (selectors.length > 1) return fail("ticket_tenant_invalid", 400);
    const selectedTenant = (selectors[0] || "").trim().toLowerCase();
    if (selectedTenant && !SLUG.test(selectedTenant)) return fail("ticket_tenant_invalid", 400);
    if (cursors.length > 1 || cursors.length && (write || !sequence(cursors[0]))) return fail("ticket_workflow_invalid_request", 400);
    const global = principal.scope === "super_admin";
    const principalId = principal.tenantId?.toLowerCase() || null, principalSlug = principal.tenantSlug?.trim().toLowerCase() || null;
    if (!global && (!principalId || !UUID.test(principalId) || !principalSlug || !SLUG.test(principalSlug))) return fail("forbidden", 403);
    if (!global && selectedTenant && selectedTenant !== principalSlug) return fail("ticket_not_found", 404);
    const tenantId = global ? null : principalId, tenantSlug = global ? selectedTenant || null : principalSlug;
    const execute = dependencies.execute || sql;
    let command: Command | null = null, rows: Record<string, unknown>[];
    if (write) {
      command = await readCommand(req);
      if (!command) return fail("ticket_workflow_invalid_request", 400);
      const idempotencyKey = req.headers.get("idempotency-key");
      if (idempotencyKey !== null && idempotencyKey.toLowerCase() !== command.request_id) return fail("ticket_workflow_invalid_request", 400);
      if (!uuid(principal.userId)) return fail("forbidden", 403);
      const actorLabel = typeof principal.label === "string" && principal.label.trim() && principal.label.length <= 320 ? principal.label : null;
      rows = await execute`SELECT public.nexid_transition_support_ticket_v1(${id}::uuid,${tenantId}::uuid,${tenantSlug}::text,
        ${principal.userId}::uuid,${actorLabel}::text,${command.expected_revision}::text,${command.status}::text,
        ${command.reason}::text,${command.request_id}::uuid) AS result`;
    } else {
      rows = await execute`SELECT public.nexid_read_support_ticket_workflow_v1(${id}::uuid,${tenantId}::uuid,${tenantSlug}::text,${cursors[0] || null}::bigint) AS result`;
    }
    const result = rows.length === 1 ? object(rows[0].result) : null;
    if (!result) return fail("ticket_workflow_unavailable", 503);
    if (result.ok !== true) {
      const reason = typeof result.reason === "string" && Object.hasOwn(ERROR_STATUS, result.reason) ? result.reason : "ticket_workflow_unavailable";
      return fail(reason, ERROR_STATUS[reason] || 503);
    }
    const current = projectCurrent(result.current, id, tenantId, tenantSlug);
    if (!current) return fail("ticket_workflow_unavailable", 503);
    const common = { ok: true, protocol: SUPPORT_TICKET_WORKFLOW_PROTOCOL,
      scope: { mode: tenantSlug ? "tenant" : "global", tenantId: tenantSlug ? current.tenantId : null, tenantSlug }, current };
    if (write && command) {
      const receipt = projectReceipt(result.receipt);
      if (!receipt || !["updated", "replayed"].includes(result.outcome as string)
        || receipt.requestId !== command.request_id || receipt.toStatus !== command.status || receipt.reason !== command.reason
        || receipt.actor.id !== principal.userId
        || result.outcome === "updated" && (current.status !== receipt.toStatus || current.revision !== receipt.revision)) return fail("ticket_workflow_unavailable", 503);
      return json({ ...common, receipt, outcome: result.outcome }, 200, HEADERS);
    }
    const page = object(result.page);
    if (!Array.isArray(result.items) || result.items.length > 50 || !page || typeof page.hasMore !== "boolean") return fail("ticket_workflow_unavailable", 503);
    const items = result.items.map(projectReceipt);
    if (items.some(item => item === null)) return fail("ticket_workflow_unavailable", 503);
    const entries = items.filter((item): item is NonNullable<typeof item> => item !== null);
    if (entries.some((entry, index) => index > 0 && BigInt(entry.sequence) >= BigInt(entries[index - 1].sequence))
      || cursors[0] && entries.some(entry => BigInt(entry.sequence) >= BigInt(cursors[0]))
      || page.hasMore && (entries.length !== 50 || page.nextCursor !== entries[49].sequence)
      || !page.hasMore && page.nextCursor !== null) return fail("ticket_workflow_unavailable", 503);
    return json({ ...common, items: entries, page: { hasMore: page.hasMore, nextCursor: page.nextCursor } }, 200, HEADERS);
  } catch { return fail("ticket_workflow_unavailable", 503); }
}

export function handleAdminTicketWorkflowHistory(req: Request, id: unknown, dependencies: Dependencies = {}) { return handle(req, id, false, dependencies); }
export function handleAdminTicketWorkflowTransition(req: Request, id: unknown, dependencies: Dependencies = {}) { return handle(req, id, true, dependencies); }
