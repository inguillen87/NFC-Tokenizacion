import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkAdminWithPermission, getAdminPrincipal } from "../src/lib/auth.ts";
import { createCampaignDraftHandlers } from "../src/lib/campaign-draft-http.ts";
import {
  CampaignDraftError, parseCampaignDraftCreate, parseCampaignDraftPatch,
  parseCampaignDraftIdempotencyKey, parseCampaignDraftList,
  resolveCampaignDraftTenant, createCampaignDraft, patchCampaignDraft,
  getCampaignDraft, listCampaignDrafts,
} from "../src/lib/campaign-drafts.ts";

const tenant = { id: "11111111-1111-4111-8111-111111111111", slug: "drafts-qa" };
const otherTenant = { id: "22222222-2222-4222-8222-222222222222", slug: "drafts-other" };
const actor = { id: "33333333-3333-4333-8333-333333333333", label: "Campaign editor" };
const secondActor = { id: "44444444-4444-4444-8444-444444444444", label: "Another editor" };
const audit = { ip: null, userAgent: null, traceId: "drafts-local-test" };
const content = { title: "Campaña de prueba", message: "Texto de prueba\nSin envío", channel: "whatsapp", purpose: "marketing" };
const principal = {
  authenticationType: "human_session", sessionId: "session-test", userId: actor.id,
  email: "synthetic@example.invalid", label: actor.label, role: "marketing-manager", scope: "tenant_operator",
  tenantId: tenant.id, tenantSlug: tenant.slug, permissions: ["campaigns:read", "campaigns:write"],
  deniedPermissions: [], mfaVerified: true, expiresAt: "2030-01-01T00:00:00.000Z", rotatedSessionToken: null,
};
const errorIs = (reason, status = 400) => (error) => error instanceof CampaignDraftError && error.message === reason && error.status === status;

// Local deterministic adapter: these tests verify repository/request contracts.
// The independent-connection PostgreSQL harness verifies database concurrency.
function memoryRepository() {
  const rows = new Map();
  const calls = [];
  const audits = [];
  const query = async (strings, ...values) => {
    const statement = strings.join("?");
    calls.push({ statement, values });
    if (statement.includes("FROM public.tenants")) return [tenant, otherTenant].filter((entry) => entry.slug === values[0]);
    if (statement.includes("WITH created AS")) {
      const existing = [...rows.values()].find((row) => row.tenant_id === values[0] && row.create_idempotency_key === values[9]);
      if (existing) return [];
      const row = {
        id: randomUUID(), tenant_id: values[0], title: values[1], message: values[2], channel: values[3], purpose: values[4],
        created_by: values[5], updated_by: values[6], created_by_label: values[7], updated_by_label: values[8],
        create_idempotency_key: values[9], create_fingerprint: values[10], status: "draft", revision: 1,
        created_at: new Date("2026-09-06T12:00:00Z"), updated_at: new Date("2026-09-06T12:00:00Z"), audit_count: 1,
      };
      rows.set(row.id, row);
      audits.push({ tenant: row.tenant_id, actor: values[11], action: "campaign_draft_created", before: null, after: values[12] });
      return [{ ...row }];
    }
    if (statement.includes("WITH updated AS")) {
      const row = rows.get(values[8]);
      if (!row || row.tenant_id !== values[7] || row.revision !== values[9]) return [];
      const next = {
        ...row, title: values[0], message: values[1], channel: values[2], purpose: values[3], status: values[4],
        revision: row.revision + 1, updated_by: values[5], updated_by_label: values[6],
        updated_at: new Date(row.updated_at.getTime() + 1000),
      };
      rows.set(row.id, next);
      audits.push({ tenant: row.tenant_id, actor: values[10], action: values[11], before: values[12], after: values[13] });
      return [{ ...next }];
    }
    const scoped = [...rows.values()].filter((row) => row.tenant_id === values[0]);
    if (statement.includes("create_idempotency_key =")) return scoped.filter((row) => row.create_idempotency_key === values[1]).map((row) => ({ ...row }));
    if (statement.includes("AND id =")) return scoped.filter((row) => row.id === values[1]).map((row) => ({ ...row }));
    if (statement.includes("ORDER BY updated_at DESC")) return scoped.filter((row) => values[1] === "all" || row.status === values[1])
      .sort((left, right) => right.updated_at - left.updated_at || right.id.localeCompare(left.id)).slice(0, values[3]).map((row) => ({ ...row }));
    throw new Error("unexpected_test_query");
  };
  return { query, rows, calls, audits };
}

function handlers(repository, options = {}) {
  return createCampaignDraftHandlers({
    authorize: async () => null,
    principal: () => principal,
    requestMeta: () => audit,
    query: repository.query,
    ...options,
  });
}

function request(method = "GET", input, query = `tenant=${tenant.slug}`, headers = {}) {
  return new Request(`http://localhost/admin/campaigns/drafts?${query}`, {
    method,
    headers: { "content-type": "application/json", "idempotency-key": "draft-create-key", ...headers },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
}

test("create parser normalizes bounded plain text without HTML/template interpretation", () => {
  assert.deepEqual(parseCampaignDraftCreate({ ...content, title: ` ${content.title} `, message: ` ${content.message} ` }), content);
  assert.equal(parseCampaignDraftCreate({ ...content, message: "2 < 3 & {{texto}}" }).message, "2 < 3 & {{texto}}");
  for (const input of [null, [], "text", { ...content, createdBy: actor }, { ...content, tenant: tenant.slug }, { ...content, audienceSnapshot: { count: 12 } }]) {
    assert.throws(() => parseCampaignDraftCreate(input), CampaignDraftError);
  }
  for (const field of ["title", "message", "channel", "purpose"]) {
    const { [field]: omitted, ...input } = content;
    assert.throws(() => parseCampaignDraftCreate(input), errorIs(`campaign_draft_${field}_invalid`));
  }
  for (const input of [
    { title: " " }, { title: "a".repeat(161) }, { message: "a".repeat(6001) }, { message: "text\u0000" },
    { title: "Title\nOther" }, { channel: "sms" }, { purpose: "transactional" }, { status: "approved" },
  ]) assert.throws(() => parseCampaignDraftCreate({ ...content, ...input }), CampaignDraftError);
});

test("PATCH requires an exact positive expected revision and a closed editable field set", () => {
  assert.deepEqual(parseCampaignDraftPatch({ expectedRevision: 1, status: "archived" }), { expectedRevision: 1, status: "archived" });
  assert.throws(() => parseCampaignDraftPatch({ title: "New" }), errorIs("campaign_draft_expected_revision_required"));
  for (const value of [0, -1, 1.1, "1", null, 2147483648]) {
    assert.throws(() => parseCampaignDraftPatch({ expectedRevision: value, title: "New" }), errorIs("campaign_draft_expected_revision_invalid"));
  }
  for (const value of [
    { expectedRevision: 1 }, { expectedRevision: 1, revision: 2 }, { expectedRevision: 1, id: randomUUID() },
    { expectedRevision: 1, createdAt: new Date().toISOString() }, { expectedRevision: 1, status: "sent" },
    { expectedRevision: 1, message: null }, { expectedRevision: 1, profile: "ignored" },
  ]) assert.throws(() => parseCampaignDraftPatch(value), CampaignDraftError);
});

test("idempotency and list limits are validated, never silently truncated", () => {
  assert.equal(parseCampaignDraftIdempotencyKey("draft:12345678"), "draft:12345678");
  assert.throws(() => parseCampaignDraftIdempotencyKey(null), errorIs("campaign_draft_idempotency_key_required"));
  for (const key of ["short", "a".repeat(129), "key/1234567", " abcdefgh"]) assert.throws(() => parseCampaignDraftIdempotencyKey(key), CampaignDraftError);
  assert.deepEqual(parseCampaignDraftList(new URLSearchParams()), { status: "draft", limit: 50 });
  assert.deepEqual(parseCampaignDraftList(new URLSearchParams("status=all&limit=100")), { status: "all", limit: 100 });
  for (const query of ["limit=0", "limit=101", "limit=2.5", "limit=foo", "limit=", "status=sent"]) assert.throws(() => parseCampaignDraftList(new URLSearchParams(query)), CampaignDraftError);
});

test("tenant scope is mandatory for every role and never substitutes another tenant", async () => {
  const repository = memoryRepository();
  for (const scope of ["tenant_admin", "tenant_operator", "reseller"]) {
    const bound = { ...principal, scope };
    await assert.rejects(resolveCampaignDraftTenant(null, bound, repository.query), errorIs("campaign_draft_tenant_required"));
    await assert.rejects(resolveCampaignDraftTenant(otherTenant.slug, bound, repository.query), errorIs("campaign_draft_tenant_mismatch", 403));
    assert.deepEqual(await resolveCampaignDraftTenant(tenant.slug.toUpperCase(), bound, repository.query), tenant);
    await assert.rejects(resolveCampaignDraftTenant(tenant.slug, { ...bound, tenantId: otherTenant.id }, repository.query), errorIs("campaign_draft_tenant_mismatch", 403));
  }
  const global = { ...principal, scope: "super_admin", tenantId: null, tenantSlug: null };
  await assert.rejects(resolveCampaignDraftTenant(null, global, repository.query), errorIs("campaign_draft_tenant_required"));
  assert.deepEqual(await resolveCampaignDraftTenant(otherTenant.slug, global, repository.query), otherTenant);
  await assert.rejects(resolveCampaignDraftTenant("not-found", global, repository.query), errorIs("campaign_draft_tenant_not_found", 404));
});

test("create is tenant-scoped, audited once, returns only projected server fields and replays current state", async () => {
  const repository = memoryRepository();
  const first = await createCampaignDraft(tenant, actor, content, "draft-create-key", audit, repository.query);
  assert.equal(first.idempotentReplay, false);
  assert.equal(first.draft.revision, 1);
  assert.deepEqual(first.draft.createdBy, actor);
  assert.equal(first.draft.createdAt, "2026-09-06T12:00:00.000Z");
  assert.doesNotMatch(JSON.stringify(first), /fingerprint|idempotency_key|audit_count|tenant_id/);
  const replay = await createCampaignDraft(tenant, actor, { purpose: "marketing", channel: "whatsapp", message: content.message, title: content.title }, "draft-create-key", audit, repository.query);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.draft.id, first.draft.id);
  assert.equal(repository.audits.length, 1);
  await assert.rejects(createCampaignDraft(tenant, actor, { ...content, channel: "email" }, "draft-create-key", audit, repository.query), errorIs("campaign_draft_idempotency_conflict", 409));
  await assert.rejects(createCampaignDraft(tenant, secondActor, content, "draft-create-key", audit, repository.query), errorIs("campaign_draft_idempotency_conflict", 409));
  const other = await createCampaignDraft(otherTenant, actor, content, "draft-create-key", audit, repository.query);
  assert.notEqual(other.draft.id, first.draft.id);
  const updated = await patchCampaignDraft(tenant, secondActor, first.draft.id, { expectedRevision: 1, message: "Actualizado", channel: "phone" }, audit, repository.query);
  assert.deepEqual(updated.createdBy, actor);
  assert.deepEqual(updated.updatedBy, secondActor);
  assert.equal(updated.revision, 2);
  assert.equal(updated.createdAt, first.draft.createdAt);
  const afterReplay = await createCampaignDraft(tenant, actor, content, "draft-create-key", audit, repository.query);
  assert.deepEqual(afterReplay.draft, updated);
  assert.equal(repository.audits.length, 3);
  assert.equal(repository.calls.filter((call) => call.statement.includes("WITH created AS"))[0].statement.includes(content.message), false);
});

test("PATCH compare-and-swap reports conflicts and preserves the winning revision", async () => {
  const repository = memoryRepository();
  const { draft } = await createCampaignDraft(tenant, actor, content, "draft-create-key", audit, repository.query);
  const results = await Promise.allSettled([
    patchCampaignDraft(tenant, actor, draft.id, { expectedRevision: 1, title: "A" }, audit, repository.query),
    patchCampaignDraft(tenant, secondActor, draft.id, { expectedRevision: 1, title: "B" }, audit, repository.query),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected").reason;
  assert.equal(rejected.message, "campaign_draft_revision_conflict");
  assert.equal(rejected.currentRevision, 2);
  assert.equal(repository.audits.length, 2);
  const archived = await patchCampaignDraft(tenant, actor, draft.id, { expectedRevision: 2, status: "archived" }, audit, repository.query);
  assert.equal(archived.status, "archived");
  assert.equal((await listCampaignDrafts(tenant, { status: "draft", limit: 50 }, repository.query)).count, 0);
  assert.equal((await listCampaignDrafts(tenant, { status: "archived", limit: 50 }, repository.query)).count, 1);
  const restored = await patchCampaignDraft(tenant, actor, draft.id, { expectedRevision: 3, status: "draft" }, audit, repository.query);
  assert.equal(restored.revision, 4);
  assert.equal(restored.status, "draft");
  assert.deepEqual(repository.audits.map((entry) => entry.action), ["campaign_draft_created", "campaign_draft_updated", "campaign_draft_archived", "campaign_draft_restored"]);
});

test("all draft lookups and mutations include tenant; list count describes only the bounded returned items", async () => {
  const repository = memoryRepository();
  const { draft } = await createCampaignDraft(tenant, actor, content, "draft-create-key", audit, repository.query);
  await createCampaignDraft(tenant, actor, content, "draft-create-key-two", audit, repository.query);
  await assert.rejects(getCampaignDraft(otherTenant, draft.id, repository.query), errorIs("campaign_draft_not_found", 404));
  await assert.rejects(patchCampaignDraft(otherTenant, actor, draft.id, { expectedRevision: 1, title: "No" }, audit, repository.query), errorIs("campaign_draft_not_found", 404));
  assert.deepEqual(await listCampaignDrafts(otherTenant, { status: "all", limit: 50 }, repository.query), { items: [], count: 0, truncated: false });
  const listing = await listCampaignDrafts(tenant, { status: "all", limit: 1 }, repository.query);
  assert.equal(listing.count, 1);
  assert.equal(listing.truncated, true);
  for (const call of repository.calls.filter((call) => /SELECT \* FROM public.campaign_drafts/.test(call.statement))) {
    assert.match(call.statement, /WHERE tenant_id = \?::uuid/);
  }
});

test("mutations keep audit in their SQL statement and never call senders, runtime DDL or best-effort logging", async () => {
  const source = await readFile(new URL("../src/lib/campaign-drafts.ts", import.meta.url), "utf8");
  assert.equal((source.match(/INSERT INTO public.audit_logs/g) || []).length, 2);
  assert.match(source, /WITH created AS[\s\S]*ON CONFLICT \(tenant_id, create_idempotency_key\) DO NOTHING[\s\S]*audited AS/);
  assert.match(source, /WITH updated AS[\s\S]*WHERE tenant_id = .* AND id = .* AND revision = /);
  const update = source.slice(source.indexOf("UPDATE public.campaign_drafts SET"), source.indexOf("RETURNING *", source.indexOf("UPDATE public.campaign_drafts SET")));
  assert.doesNotMatch(update, /create_fingerprint|create_idempotency_key|created_by|created_at/);
  assert.doesNotMatch(source, /logAuditEvent|CREATE TABLE|ALTER TABLE|fetch\(|sendMail|messages\.create|twilio/i);
});

test("HTTP envelopes round-trip create, list, detail, conflict, archive and restore", async () => {
  const repository = memoryRepository();
  const api = handlers(repository);
  const created = await api.create(request("POST", content));
  assert.equal(created.status, 201);
  assert.match(created.headers.get("cache-control"), /private, no-store/);
  const first = await created.json();
  assert.equal(first.ok, true);
  assert.equal(first.tenant, tenant.slug);
  assert.equal(first.idempotentReplay, false);
  assert.equal((await api.create(request("POST", content))).status, 200);
  assert.equal((await (await api.list(request())).json()).count, 1);
  assert.deepEqual((await (await api.get(request(), first.draft.id)).json()).draft, first.draft);
  assert.equal((await api.patch(request("PATCH", { expectedRevision: 1, status: "archived" }), first.draft.id)).status, 200);
  const conflict = await api.patch(request("PATCH", { expectedRevision: 1, title: "Conservar trabajo" }), first.draft.id);
  assert.equal(conflict.status, 409);
  assert.deepEqual(await conflict.json(), { ok: false, reason: "campaign_draft_revision_conflict", currentRevision: 2 });
  const restore = await api.patch(request("PATCH", { expectedRevision: 2, status: "draft" }), first.draft.id);
  assert.equal((await restore.json()).draft.revision, 3);
});

test("HTTP validates root shape, server-owned fields, size, idempotency and IDs before writing", async () => {
  const repository = memoryRepository();
  const api = handlers(repository);
  for (const input of [null, [], { ...content, createdBy: actor }, { ...content, status: "approved" }]) assert.equal((await api.create(request("POST", input))).status, 400);
  assert.equal((await api.create(request("POST", content, `tenant=${tenant.slug}`, { "idempotency-key": "" }))).status, 400);
  const malformed = new Request(`http://localhost/admin/campaigns/drafts?tenant=${tenant.slug}`, { method: "POST", headers: { "idempotency-key": "draft-create-key" }, body: "{" });
  assert.equal((await api.create(malformed)).status, 400);
  assert.equal((await api.create(request("POST", { ...content, message: "a".repeat(40000) }))).status, 413);
  assert.equal((await api.get(request(), "not-a-uuid")).status, 400);
  assert.equal((await api.patch(request("PATCH", { title: "x" }), randomUUID())).status, 400);
  assert.equal(repository.rows.size, 0);
});

test("HTTP failures preserve no-store and do not expose SQL errors or wrong-tenant rows", async () => {
  const repository = memoryRepository();
  const api = handlers(repository, { query: async () => { throw new Error("database_connection_or_sql_secret"); } });
  const failed = await api.list(request());
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { ok: false, reason: "campaign_drafts_unavailable" });
  const forbidden = await handlers(repository).list(request("GET", undefined, `tenant=${otherTenant.slug}`));
  assert.equal(forbidden.status, 403);
  assert.equal(repository.calls.length, 0);
  const denied = await handlers(repository, { authorize: async () => new Response("Forbidden", { status: 403 }) }).create(request("POST", content));
  assert.equal(denied.status, 403);
  assert.match(denied.headers.get("cache-control"), /no-store/);
  assert.equal(repository.rows.size, 0);
});

test("malformed persisted values fail closed without presenting an invented draft", async () => {
  const repository = memoryRepository();
  const { draft } = await createCampaignDraft(tenant, actor, content, "draft-create-key", audit, repository.query);
  for (const invalidFields of [{ tenant_id: otherTenant.id }, { revision: "1" }, { channel: "sms" }, { created_by_label: "" }, { updated_at: "invalid" }]) {
    const row = { ...repository.rows.get(draft.id), ...invalidFields };
    const api = handlers(repository, {
      query: async (strings, ...values) => strings.join("").includes("FROM public.tenants") ? repository.query(strings, ...values) : [row],
    });
    const response = await api.get(request(), draft.id);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, reason: "campaign_drafts_unavailable" });
  }
});

test("real permission guard distinguishes reads/writes and enforces denied grants and human roles", async () => {
  const repository = memoryRepository();
  const session = { ...principal, id: principal.sessionId, role: "marketing-manager", rotatedCookieValue: null };
  const api = (overrides) => handlers(repository, {
    authorize: (req, permission) => checkAdminWithPermission(req, permission, async () => ({ ...session, ...overrides })),
    principal: getAdminPrincipal,
  });
  const withAuth = (method, input, token = "opaque-test-session") => request(method, input, `tenant=${tenant.slug}`, { authorization: `Bearer ${token}` });
  assert.equal((await api({}).list(withAuth("GET"))).status, 200);
  assert.equal((await api({}).create(withAuth("POST", content))).status, 201);
  const readOnly = api({ permissions: ["campaigns:read"] });
  assert.equal((await readOnly.list(withAuth("GET"))).status, 200);
  assert.equal((await readOnly.create(withAuth("POST", content))).status, 403);
  assert.equal((await api({ permissions: ["*"], deniedPermissions: ["campaigns:write"] }).create(withAuth("POST", content))).status, 403);
  assert.equal((await api({ permissions: ["*"], deniedPermissions: ["campaigns:read"] }).list(withAuth("GET"))).status, 403);
  for (const role of ["viewer", "reseller-admin", "security-analyst", "api-integration"]) assert.equal((await api({ role, permissions: ["*"] }).create(withAuth("POST", content))).status, 403);
  for (const token of ["demo.fake", "local.fake"]) assert.equal((await api({}).create(withAuth("POST", content, token))).status, 401);
  assert.equal((await api({}).create(request("POST", content))).status, 401);
});

test("route entrypoints use dynamic Node handlers and await the detail route id", async () => {
  const root = await readFile(new URL("../src/app/admin/campaigns/drafts/route.ts", import.meta.url), "utf8");
  const detail = await readFile(new URL("../src/app/admin/campaigns/drafts/[id]/route.ts", import.meta.url), "utf8");
  assert.match(root, /runtime = "nodejs"/);
  assert.match(root, /dynamic = "force-dynamic"/);
  assert.match(root, /GET = handlers.list/);
  assert.match(root, /POST = handlers.create/);
  assert.match(detail, /await context.params/);
  assert.match(detail, /handlers.patch/);
  assert.doesNotMatch(`${root}\n${detail}`, /DELETE|send|approve|demo/i);
});

test("production schema watermark requires the campaign draft migration before serving new code", async () => {
  const db = await readFile(new URL("../src/lib/db.ts", import.meta.url), "utf8");
  assert.match(db, /"20260906120000_0102_campaign_drafts.sql",\s*\] as const/);
});
