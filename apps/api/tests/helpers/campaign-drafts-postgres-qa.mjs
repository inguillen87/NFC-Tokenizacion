import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  CampaignDraftError,
  createCampaignDraft,
  getCampaignDraft,
  listCampaignDrafts,
  parseCampaignDraftCreate,
  parseCampaignDraftIdempotencyKey,
  parseCampaignDraftList,
  parseCampaignDraftPatch,
  patchCampaignDraft,
} from "../../src/lib/campaign-drafts.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sqlExecutor(client, afterQuery) {
  return async (strings, ...values) => {
    const text = strings.reduce((sql, part, index) => sql + (index ? `$${index}` : "") + part, "");
    const result = await client.query(text, values);
    if (afterQuery) await afterQuery(text);
    return result.rows;
  };
}

// Let both PATCH calls read revision 1 before either UPDATE reaches Postgres.
// A bounded barrier makes a changed repository query fail rather than hang QA.
function concurrentReadBarrier() {
  let arrivals = 0;
  let release;
  let reject;
  const ready = new Promise((resolve, fail) => { release = resolve; reject = fail; });
  const timer = setTimeout(() => reject(new Error("campaign_drafts_qa_read_barrier_timeout")), 15_000);
  ready.catch(() => {});
  return {
    async afterQuery(text) {
      if (!/^\s*SELECT\s+\*\s+FROM\s+public\.campaign_drafts\s+WHERE\s+tenant_id\s*=\s*\$1::uuid\s+AND\s+id\s*=\s*\$2::uuid\s+LIMIT\s+1\s*$/i.test(text)) return;
      arrivals += 1;
      if (arrivals === 2) release();
      await ready;
    },
    assertReached() { assert.ok(arrivals >= 2, "Both concurrent edits must read before their writes"); },
    dispose() { clearTimeout(timer); },
  };
}

function isDraftError(error, status, code) {
  return error instanceof CampaignDraftError && error.status === status && error.message === code;
}

function listOptions(status) {
  return parseCampaignDraftList(new URLSearchParams({ status, limit: "100" }));
}

async function identity(tenant, id, query) {
  const rows = await query`
    SELECT id, tenant_id, create_fingerprint, create_idempotency_key,
      created_by, created_by_label, created_at
    FROM public.campaign_drafts WHERE tenant_id = ${tenant.id}::uuid AND id = ${id}::uuid
  `;
  assert.equal(rows.length, 1, "The test draft must have one persisted identity");
  const row = rows[0];
  assert.match(row.create_fingerprint, /^[0-9a-f]{64}$/, "The create fingerprint must be SHA-256 hex");
  return { ...row, created_at: new Date(row.created_at).toISOString() };
}

/**
 * Explicitly invoked, synthetic PostgreSQL QA; importing this module does no I/O.
 * The caller must authorize and select an isolated QA database, apply migrations,
 * and provide existing tenant/user fixtures. connect() must return a fresh,
 * already-connected pg client on every call, outside any caller transaction.
 * This helper closes only those clients. It never creates fixtures, applies DDL,
 * reads credentials/environment variables, or deletes the test drafts/audit rows.
 * Run with a TypeScript-aware loader, for example the repository's tsx loader.
 *
 * @param {{connect: () => Promise<{query: Function, end: Function}>,
 *   tenant: {id: string, slug: string}, actor: {id: string, label: string},
 *   otherTenant?: {id: string, slug: string}}} options
 */
export async function runCampaignDraftsPostgresQa({ connect, tenant, actor, otherTenant } = {}) {
  assert.equal(typeof connect, "function", "An explicit connection factory is required");
  assert.ok(UUID.test(tenant?.id ?? "") && typeof tenant?.slug === "string" && tenant.slug.length > 0, "An existing tenant fixture is required");
  assert.ok(UUID.test(actor?.id ?? "") && typeof actor?.label === "string" && actor.label.trim().length > 0, "An existing actor fixture is required");
  if (otherTenant !== undefined) {
    assert.ok(UUID.test(otherTenant?.id ?? "") && typeof otherTenant?.slug === "string" && otherTenant.slug.length > 0, "The optional tenant fixture must be valid");
    assert.notEqual(otherTenant.id.toLowerCase(), tenant.id.toLowerCase(), "Isolation requires different tenant fixtures");
    assert.notEqual(otherTenant.slug, tenant.slug, "Isolation requires different tenant slugs");
  }

  const clients = [];
  const runId = randomUUID();
  const key = parseCampaignDraftIdempotencyKey(`qa-campaign-draft:${runId}`);
  const content = parseCampaignDraftCreate({
    title: `Synthetic QA draft ${runId}`,
    message: "Synthetic QA content only. No recipient, audience, schedule, or delivery.",
    channel: "email",
    purpose: "marketing",
  });
  const audit = { ip: null, userAgent: "campaign-drafts-postgres-qa", traceId: `qa:${runId}` };
  let failed = false;
  try {
    // allSettled prevents a late successful connection leaking after its peer fails.
    const opened = await Promise.allSettled([
      Promise.resolve().then(() => connect()),
      Promise.resolve().then(() => connect()),
    ]);
    for (const result of opened) if (result.status === "fulfilled") clients.push(result.value);
    const connectionFailure = opened.find((result) => result.status === "rejected");
    if (connectionFailure) throw connectionFailure.reason;
    assert.equal(new Set(clients).size, 2, "Concurrency QA requires two independent clients");
    for (const client of clients) assert.ok(typeof client?.query === "function" && typeof client?.end === "function", "The connection factory must return connected pg clients");
    const [firstQuery, secondQuery] = clients.map((client) => sqlExecutor(client));

    const createAttempts = await Promise.allSettled([
      createCampaignDraft(tenant, actor, content, key, audit, firstQuery),
      createCampaignDraft(tenant, actor, content, key, audit, secondQuery),
    ]);
    for (const attempt of createAttempts) if (attempt.status === "rejected") throw attempt.reason;
    const created = createAttempts.map((attempt) => attempt.value);
    assert.ok(created[0].draft.id === created[1].draft.id, "Concurrent creates must return the same server UUID");
    assert.match(created[0].draft.id, UUID, "The draft ID must be a server-generated UUID");
    assert.equal(created.filter((item) => item.idempotentReplay === false).length, 1, "Exactly one create must be new");
    assert.equal(created.filter((item) => item.idempotentReplay === true).length, 1, "Exactly one create must replay");
    assert.ok(created.every((item) => item.draft.revision === 1 && item.draft.status === "draft"), "Both create responses must describe revision 1");
    const draftId = created[0].draft.id;
    const initialIdentity = await identity(tenant, draftId, firstQuery);

    await assert.rejects(
      () => createCampaignDraft(tenant, actor, { ...content, title: "Synthetic conflicting create" }, key, audit, firstQuery),
      (error) => isDraftError(error, 409, "campaign_draft_idempotency_conflict"),
      "A reused key with different content must conflict",
    );

    const barrier = concurrentReadBarrier();
    let edits;
    try {
      edits = await Promise.allSettled(clients.map((client, index) => patchCampaignDraft(
        tenant, actor, draftId,
        parseCampaignDraftPatch({ expectedRevision: 1, title: `Synthetic concurrent edit ${index + 1}` }),
        audit, sqlExecutor(client, barrier.afterQuery),
      )));
      barrier.assertReached();
    } finally {
      barrier.dispose();
    }
    const winners = edits.filter((item) => item.status === "fulfilled");
    const conflicts = edits.filter((item) => item.status === "rejected");
    assert.equal(winners.length, 1, "Exactly one concurrent edit must succeed");
    assert.equal(conflicts.length, 1, "Exactly one concurrent edit must conflict");
    assert.equal(winners[0].value.revision, 2, "The winning edit must produce revision 2");
    assert.ok(isDraftError(conflicts[0].reason, 409, "campaign_draft_revision_conflict"), "The losing edit must report a revision conflict");
    assert.equal(conflicts[0].reason.currentRevision, 2, "The conflict must report current revision 2");

    const replayAfterEdit = await createCampaignDraft(tenant, actor, content, key, audit, secondQuery);
    assert.ok(replayAfterEdit.idempotentReplay && replayAfterEdit.draft.id === draftId, "An original create replay after editing must preserve identity");
    assert.equal(replayAfterEdit.draft.revision, 2, "Create replay must return current revision without resetting content");
    assert.ok(replayAfterEdit.draft.title === winners[0].value.title, "Create replay must preserve the winning edit");
    assert.ok(JSON.stringify(await identity(tenant, draftId, firstQuery)) === JSON.stringify(initialIdentity), "Editing and replay must preserve the initial fingerprint and authorship");

    const archived = await patchCampaignDraft(tenant, actor, draftId, parseCampaignDraftPatch({ expectedRevision: 2, status: "archived" }), audit, firstQuery);
    assert.equal(archived.revision, 3, "Archiving must advance revision to 3");
    assert.equal(archived.status, "archived", "Archiving must persist its status");
    const archivedList = await listCampaignDrafts(tenant, listOptions("archived"), firstQuery);
    const activeList = await listCampaignDrafts(tenant, listOptions("draft"), firstQuery);
    assert.ok(archivedList.items.some((item) => item.id === draftId) && archivedList.items.every((item) => item.status === "archived"), "Archived listing must include the archived draft only in the correct status");
    assert.ok(!activeList.items.some((item) => item.id === draftId) && activeList.items.every((item) => item.status === "draft"), "Active listing must exclude the archived draft");

    const restored = await patchCampaignDraft(tenant, actor, draftId, parseCampaignDraftPatch({ expectedRevision: 3, status: "draft" }), audit, secondQuery);
    assert.equal(restored.revision, 4, "Restoring must advance revision to 4");
    assert.equal(restored.status, "draft", "Restoring must persist draft status");
    const persisted = await getCampaignDraft(tenant, draftId, firstQuery);
    assert.ok(persisted.revision === 4 && persisted.status === "draft", "An independent read must confirm the restored state");
    assert.ok(JSON.stringify(await identity(tenant, draftId, firstQuery)) === JSON.stringify(initialIdentity), "Archive and restore must preserve creation identity");

    let otherDraftId;
    if (otherTenant !== undefined) {
      await assert.rejects(() => getCampaignDraft(otherTenant, draftId, secondQuery), (error) => isDraftError(error, 404, "campaign_draft_not_found"), "Cross-tenant get must return not found");
      await assert.rejects(
        () => patchCampaignDraft(otherTenant, actor, draftId, parseCampaignDraftPatch({ expectedRevision: 4, title: "Synthetic cross-tenant edit" }), audit, secondQuery),
        (error) => isDraftError(error, 404, "campaign_draft_not_found"),
        "Cross-tenant patch must return not found",
      );
      // The same key is valid independently in another tenant.
      const otherCreated = await createCampaignDraft(otherTenant, actor, content, key, audit, secondQuery);
      otherDraftId = otherCreated.draft.id;
      assert.ok(otherCreated.idempotentReplay === false && otherDraftId !== draftId, "Create idempotency must be tenant-scoped");
      const [ownList, otherList] = await Promise.all([
        listCampaignDrafts(tenant, listOptions("all"), firstQuery),
        listCampaignDrafts(otherTenant, listOptions("all"), secondQuery),
      ]);
      assert.ok(ownList.items.some((item) => item.id === draftId) && !ownList.items.some((item) => item.id === otherDraftId) && ownList.items.every((item) => item.tenant === tenant.slug), "Primary tenant listing must be isolated");
      assert.ok(otherList.items.some((item) => item.id === otherDraftId) && !otherList.items.some((item) => item.id === draftId) && otherList.items.every((item) => item.tenant === otherTenant.slug), "Other tenant listing must be isolated");
      const afterDeniedPatch = await getCampaignDraft(tenant, draftId, firstQuery);
      assert.ok(afterDeniedPatch.revision === 4 && afterDeniedPatch.title === restored.title, "Denied cross-tenant edit must not mutate the original draft");
    }

    return {
      ok: true,
      runId,
      draftIds: otherDraftId ? [draftId, otherDraftId] : [draftId],
      concurrentCreate: { new: 1, replay: 1, sameId: true },
      mismatchedCreateStatus: 409,
      concurrentEdit: { updated: 1, conflicted: 1, revision: 2, conflictStatus: 409 },
      replayAfterEdit: { sameId: true, revision: 2, fingerprintPreserved: true },
      lifecycle: { archivedRevision: 3, restoredRevision: 4, finalStatus: "draft" },
      tenantIsolation: otherTenant === undefined ? "skipped_other_tenant_not_provided" : "passed",
      rowsRetainedForCallerCleanup: true,
    };
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    const closed = await Promise.allSettled([...new Set(clients)].map(async (client) => client?.end?.()));
    if (!failed && closed.some((result) => result.status === "rejected")) throw new Error("campaign_drafts_qa_connection_close_failed");
  }
}
