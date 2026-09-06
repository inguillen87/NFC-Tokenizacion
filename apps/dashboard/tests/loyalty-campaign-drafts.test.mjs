import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { requiredPermissionForAdminResource, dashboardPermissionMatches } from "../src/lib/permission-policy.ts";
import { canDemoSandboxAccess } from "../src/lib/admin-proxy-policy.ts";
import {
  CampaignDraftError, campaignDraftContent, campaignDraftErrorCopy, campaignDraftSaveOperation,
  executeCampaignDraftMutation, getCampaignDraft, listCampaignDrafts, parseCampaignDraft, parseCampaignDraftList,
} from "../src/app/(app)/loyalty/campaigns/loyalty-campaign-drafts.ts";
import { CampaignDraftListPanel, CampaignDraftSaveFeedback } from "../src/app/(app)/loyalty/campaigns/loyalty-campaign-draft-workspace.tsx";

const dir = "../src/app/(app)/loyalty/campaigns/";
const client = await readFile(new URL(`${dir}loyalty-campaigns-client.tsx`, import.meta.url), "utf8");
const workspaceSource = await readFile(new URL(`${dir}loyalty-campaign-draft-workspace.tsx`, import.meta.url), "utf8");
const page = await readFile(new URL(`${dir}page.tsx`, import.meta.url), "utf8");
const tenant = "fixture-tenant";
const id = "10000000-0000-4000-8000-000000000001";
const actor = { id: "20000000-0000-4000-8000-000000000001", label: "Editor de prueba" };
const content = { title: "Borrador de prueba", message: "Texto de prueba sin destinatarios.", channel: "whatsapp", purpose: "marketing" };
const draft = { ...content, id, tenant, status: "draft", revision: 1, createdAt: "2026-09-06T12:00:00.000Z", updatedAt: "2026-09-06T12:00:00.000Z", createdBy: actor, updatedBy: actor };
const saved = (value = draft, extra = {}) => ({ ok: true, tenant, draft: value, ...extra });
const listed = (items = [draft], extra = {}) => ({ ok: true, tenant, items, count: items.length, truncated: false, ...extra });
const key = () => "draft-fixture-retry-0001";
const post = () => campaignDraftSaveOperation(tenant, content, null, null, key);
const workspace = (extra = {}) => ({
  list: { tenant, loading: false, error: null, result: { tenant, items: [draft], count: 1, truncated: false } },
  selected: null, comparison: null, write: { pending: false, error: null, saved: null }, reading: false,
  hasUnresolved: false, unresolvedId: undefined, unresolvedIsArchive: false,
  reload() {}, save() {}, archive() {}, restore() {}, readDraft() {}, select() { return true; },
  useReviewedRevision() {}, acknowledgeReviewedStatus() {}, closeRejectedReceipt() {}, retry() {}, ...extra,
});
const panel = (state = workspace(), canWrite = true) => renderToStaticMarkup(React.createElement(CampaignDraftListPanel, { workspace: state, canWrite, onEdit() {}, onNew() {} }));
const feedback = (state) => renderToStaticMarkup(React.createElement(CampaignDraftSaveFeedback, { workspace: state, dirty: true, onUseServer() {} }));

test("draft routes preserve exact read/write permissions and demo cannot write to either resource", () => {
  for (const path of ["campaigns/drafts", `campaigns/drafts/${id}`]) {
    assert.equal(requiredPermissionForAdminResource("GET", path), "campaigns:read");
    for (const method of ["POST", "PATCH", "DELETE"]) {
      assert.equal(requiredPermissionForAdminResource(method, path), "campaigns:write");
      assert.equal(canDemoSandboxAccess(method, path), false);
    }
  }
  assert.equal(dashboardPermissionMatches(["campaigns:read"], "campaigns:write"), false);
  assert.equal(dashboardPermissionMatches(["*"], "campaigns:write", ["campaigns:write"]), false);
  assert.match(page, /!session.isDemo/);
  assert.match(page, /dashboardPermissionDenied\(session.deniedPermissions, "campaigns:write"\)/);
  assert.match(page, /key=\{`\$\{adminContext.tenantSlug\}:\$\{Boolean\(session.isDemo\)\}`\}/);
  assert.match(client, /enabled: !allowDemoData, canWrite: canWriteDrafts/);
});

test("draft parser requires server identity, revision and tenant while projecting no audience or extra fields", () => {
  assert.deepEqual(parseCampaignDraft({ ...draft, audienceSnapshot: { count: 10, items: [{ phone: "DO-NOT-STORE" }] } }, tenant), draft);
  for (const invalid of [{ ...draft, tenant: "another-tenant" }, { ...draft, revision: 0 }, { ...draft, id: "generated-local-id" }, { ...draft, createdBy: { id: "user", label: "Editor" } }, { ...draft, updatedBy: { ...actor, label: "" } }, { ...draft, status: "sent" }, { ...draft, updatedAt: "invalid" }]) {
    assert.throws(() => parseCampaignDraft(invalid, tenant), CampaignDraftError);
  }
  const plain = parseCampaignDraft({ ...draft, message: "<b>Texto literal</b> {{name}}" }, tenant);
  const html = panel(workspace({ list: { tenant, loading: false, error: null, result: { tenant, items: [plain], count: 1, truncated: false } } }));
  assert.match(html, /&lt;b&gt;Texto literal&lt;\/b&gt; \{\{name\}\}/);
  assert.doesNotMatch(html, /<b>Texto literal|DO-NOT-STORE|dangerouslySetInnerHTML/);
});

test("list reload uses the scoped no-store GET and count means received rows, not historical total", async () => {
  const fetcher = async (url, options) => {
    assert.equal(url, `/api/admin/campaigns/drafts?tenant=${tenant}&status=all&limit=50`);
    assert.equal(options.cache, "no-store");
    assert.equal(options.method, undefined);
    return Response.json(listed([draft], { truncated: true }));
  };
  assert.deepEqual(await listCampaignDrafts(tenant, { fetcher }), await listCampaignDrafts(tenant, { fetcher }));
  assert.equal(parseCampaignDraftList(listed([]), tenant).count, 0);
  for (const payload of [listed([draft], { count: 99 }), listed([draft, draft]), listed([draft], { tenant: "other" }), { ok: true, tenant, items: [] }]) {
    assert.throws(() => parseCampaignDraftList(payload, tenant), CampaignDraftError);
  }
  const html = panel(workspace({ list: { tenant, loading: false, error: null, result: { tenant, items: [draft], count: 1, truncated: true } } }));
  assert.match(html, /no es el total histórico/);
});

test("list failures and demo responses never become confirmed empty or persisted data", async () => {
  for (const [body, status, headers] of [[{ ok: false }, 503], [listed(), 200, { "x-nexid-data-mode": "demo" }], [{ ...listed(), demoMode: true }, 200], [listed([{ ...draft, data_provenance: "declared_demo" }]), 200]]) {
    await assert.rejects(listCampaignDrafts(tenant, { fetcher: async () => Response.json(body, { status, headers }) }), CampaignDraftError);
  }
  const html = panel(workspace({ list: { tenant, loading: false, error: new CampaignDraftError("campaign_drafts_unavailable", 503), result: null } }));
  assert.match(html, /No se interpreta el error como una lista vacía/);
  assert.doesNotMatch(html, /No hay borradores en la muestra/);
  assert.match(panel(workspace({ list: { tenant, loading: false, error: null, result: { tenant, items: [], count: 0, truncated: false } } })), /No hay borradores en la muestra/);
});

test("content validates lengths and save operation contains only editable text/channel/purpose", () => {
  assert.deepEqual(campaignDraftContent(" Título ", " Mensaje ", "email"), { title: "Título", message: "Mensaje", channel: "email", purpose: "marketing" });
  for (const [title, message] of [["", "Texto"], ["x".repeat(161), "Texto"], ["Título", ""], ["Título", "x".repeat(6001)]]) {
    assert.throws(() => campaignDraftContent(title, message, "email"), CampaignDraftError);
  }
  const operation = campaignDraftSaveOperation(tenant, { ...content, audienceSnapshot: { count: 10 }, items: ["raw"] }, null, null, key);
  assert.deepEqual(operation.body, content);
  assert.doesNotMatch(JSON.stringify(operation), /audienceSnapshot|items|createdBy|updatedBy|raw/);
  assert.throws(() => campaignDraftSaveOperation("other", content, draft, null, key), CampaignDraftError);
  assert.throws(() => campaignDraftSaveOperation(tenant, content, { ...draft, status: "archived" }, null, key), CampaignDraftError);
});

test("ambiguous POST retries retain the exact key and original payload even if the editor changes", async () => {
  const operation = post();
  const before = structuredClone(operation);
  const requests = [];
  let attempt = 0;
  const fetcher = async (url, options) => {
    requests.push({ url, body: options.body, key: options.headers["Idempotency-Key"] });
    if (++attempt === 1) throw new Error("connection lost after server write");
    return Response.json(saved(draft, { idempotentReplay: true }));
  };
  await assert.rejects(executeCampaignDraftMutation(operation, false, fetcher), (error) => error.uncertain === true);
  const retry = campaignDraftSaveOperation(tenant, { ...content, message: "Nuevos cambios locales" }, null, operation, () => { throw new Error("must not rotate key"); });
  const result = await executeCampaignDraftMutation(retry, true, fetcher);
  assert.equal(result.id, id);
  assert.deepEqual(operation, before);
  assert.deepEqual(requests[0], requests[1]);
});

test("POST replay returning a newer edited revision is a reviewable conflict, not endless uncertainty", async () => {
  const operation = post();
  const current = { ...draft, revision: 3, message: "Cambio confirmado por otro editor" };
  let failure;
  try { await executeCampaignDraftMutation(operation, true, async () => Response.json(saved(current, { idempotentReplay: true }))); }
  catch (error) { failure = error; }
  assert.equal(failure.code, "campaign_draft_replay_changed");
  assert.equal(failure.status, 409);
  assert.equal(failure.uncertain, false);
  assert.deepEqual(failure.currentDraft, current);
  assert.equal(operation.idempotencyKey, key());
  const html = feedback(workspace({ comparison: current, write: { pending: false, error: failure, saved: null }, hasUnresolved: true, unresolvedId: current.id }));
  assert.match(html, /El borrador sí fue creado/);
  assert.match(html, /Conservar mi texto y usar esta versión como base/);
  assert.doesNotMatch(html, /Reintentar el mismo guardado/);
  const rejected = feedback(workspace({ write: { pending: false, saved: null, error: new CampaignDraftError("campaign_draft_idempotency_conflict", 409) }, hasUnresolved: true }));
  assert.match(rejected, /Cerrar operación rechazada y revisar listado/);
  assert.doesNotMatch(rejected, /Reintentar el mismo guardado/);
});

test("uncertain PATCH reconciles existing matching revision without writing it twice", async () => {
  const operation = campaignDraftSaveOperation(tenant, { ...content, message: "Texto actualizado" }, draft, null, key);
  const current = { ...draft, message: "Texto actualizado", revision: 2 };
  const calls = [];
  const result = await executeCampaignDraftMutation(operation, true, async (url, options) => { calls.push({ url, options }); return Response.json(saved(current)); });
  assert.deepEqual(result, current);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, undefined);
  assert.match(calls[0].url, new RegExp(`/drafts/${id}\\?tenant=`));
});

test("uncertain PATCH retries only an unchanged base and refuses to overwrite another revision", async () => {
  const operation = campaignDraftSaveOperation(tenant, { ...content, message: "Texto actualizado" }, draft, null, key);
  const requests = [];
  const result = await executeCampaignDraftMutation(operation, true, async (_url, options) => {
    requests.push(options);
    return Response.json(saved(options.method === "PATCH" ? { ...draft, message: "Texto actualizado", revision: 2 } : draft));
  });
  assert.equal(result.revision, 2);
  assert.equal(requests.length, 2);
  assert.equal(JSON.parse(requests[1].body).expectedRevision, 1);
  let calls = 0;
  await assert.rejects(executeCampaignDraftMutation(operation, true, async () => { calls += 1; return Response.json(saved({ ...draft, message: "Otra revisión", revision: 2 })); }), (error) => error.code === "campaign_draft_revision_conflict" && error.currentRevision === 2);
  assert.equal(calls, 1);
  assert.equal(operation.body.message, "Texto actualizado");
});

test("archive and restore use only status plus expected revision and report conflicts in the list feedback", async () => {
  for (const status of ["archived", "draft"]) {
    const operation = { tenant, id, method: "PATCH", idempotencyKey: key(), body: { expectedRevision: 4, status } };
    const result = await executeCampaignDraftMutation(operation, false, async (_url, options) => {
      assert.deepEqual(JSON.parse(options.body), { expectedRevision: 4, status });
      return Response.json(saved({ ...draft, status, revision: 5 }));
    });
    assert.equal(result.status, status);
  }
  const failure = new CampaignDraftError("campaign_draft_revision_conflict", 409, false, 5);
  const conflictState = workspace({ write: { pending: false, error: failure, saved: null }, hasUnresolved: true, unresolvedId: id, unresolvedIsArchive: true });
  assert.match(feedback(conflictState), /Versión actual informada: 5/);
  assert.doesNotMatch(feedback(conflictState), /Usar versión revisada en la lista/);
  assert.match(feedback({ ...conflictState, comparison: { ...draft, revision: 5 } }), /Usar versión revisada en la lista/);
  assert.match(client, /<CampaignDraftSaveFeedback[^>]+\/>\s*<CampaignDraftListPanel/);
  assert.match(workspaceSource, /Restaurar borrador/);
});

test("draft GET requires matching returned identity and mutation errors do not display raw upstream bodies", async () => {
  await assert.rejects(getCampaignDraft(tenant, id, async () => Response.json(saved({ ...draft, id: "10000000-0000-4000-8000-000000000002" }))), CampaignDraftError);
  for (const status of [400, 401, 403, 404, 409, 413, 503]) {
    await assert.rejects(executeCampaignDraftMutation(post(), false, async () => Response.json({ ok: false, reason: "private@example.invalid" }, { status })), (error) => {
      assert.doesNotMatch(campaignDraftErrorCopy(error), /private@example.invalid/);
      return true;
    });
  }
  assert.match(panel(workspace(), false), /Sólo lectura/);
  assert.doesNotMatch(panel(workspace(), false), />Archivar</);
});

test("loading, unresolved receipts and context boundaries prevent changing draft identity accidentally", () => {
  const html = panel(workspace({ reading: true }));
  assert.match(html, /disabled=""[^>]*>Nuevo borrador/);
  assert.match(client, /draftWorkspace.hasUnresolved \|\| draftWorkspace.write.pending \|\| draftWorkspace.reading/);
  assert.match(client, /if \(!draftWorkspace.select\(null\)\) return/);
  assert.match(client, /if \(!draftWorkspace.select\(draft\)\) return/);
  assert.match(client, /before === JSON.stringify\(editorValueRef.current\)/);
  assert.match(workspaceSource, /if \(!pending.uncertain && failure.status !== 409\) operation.current = null/);
  assert.match(workspaceSource, /generation === listGeneration.current/);
  assert.match(client, /document.addEventListener\("click", confirmLinkExit, true\)/);
});

test("late AI results and local fallback cannot cross draft identities or overwrite newer editor text", () => {
  const optimizer = client.slice(client.indexOf("async function handleOptimizeText"), client.indexOf("function applySavedDraft"));
  assert.equal([...optimizer.matchAll(/if \(!isCurrentEditor\(\)\) return/g)].length, 3);
  assert.match(optimizer, /generation === optimizerGeneration.current && initialEditor === JSON.stringify\(editorValueRef.current\)/);
  assert.match(optimizer, /signal: controller.signal/);
  assert.match(client, /id: draftWorkspace.selected\?\.id \|\| "new"/);
  assert.match(client, /\[draftWorkspace.selected\?\.id, draftTitle, draftText, draftChannel, selectedTone\]/);
  const save = client.slice(client.indexOf("async function handleCreateCampaign"), client.indexOf("const newCampaign: Campaign"));
  assert.match(save, /await draftWorkspace.save\(content\)/);
  assert.doesNotMatch(save, /setDraftText\(""\)|setDraftTitle\(""\)/);
});

test("secondary tools collapse away from persisted drafts and no modeled uplift percentages remain", () => {
  assert.match(client, /<details[^>]*>[\s\S]*Herramientas de prueba y canje/);
  assert.doesNotMatch(client, /modeledOutcome|\+14%|\+22%|-18%|\+9%/);
  assert.match(client, /Guardamos sólo texto, canal y finalidad: ningún contacto ni conteo de audiencia/);
  assert.doesNotMatch(workspaceSource, /test-whatsapp|redemptions|localStorage|sessionStorage|setDraftText|setDraftTitle/);
});
