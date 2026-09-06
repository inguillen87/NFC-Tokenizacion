"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  CampaignDraftError,
  campaignDraftErrorCopy,
  campaignDraftSaveOperation,
  executeCampaignDraftMutation,
  getCampaignDraft,
  listCampaignDrafts,
  type CampaignDraft,
  type CampaignDraftContent,
  type CampaignDraftList,
  type CampaignDraftMutation,
} from "./loyalty-campaign-drafts";

type DraftOperation = { request: CampaignDraftMutation; uncertain: boolean };
type DraftWriteState = { pending: boolean; error: CampaignDraftError | null; saved: CampaignDraft | null };
const emptyWrite: DraftWriteState = { pending: false, error: null, saved: null };

export function useCampaignDraftWorkspace({ tenant, enabled, canWrite }: { tenant: string; enabled: boolean; canWrite: boolean }) {
  const context = useRef(tenant);
  context.current = tenant;
  const [list, setList] = useState<{ tenant: string; loading: boolean; error: CampaignDraftError | null; result: CampaignDraftList | null }>({ tenant, loading: enabled, error: null, result: null });
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<CampaignDraft | null>(null);
  const [comparison, setComparison] = useState<CampaignDraft | null>(null);
  const [write, setWrite] = useState<DraftWriteState>(emptyWrite);
  const [reading, setReading] = useState(false);
  const operation = useRef<DraftOperation | null>(null);
  const busy = useRef(false);
  const listGeneration = useRef(0);
  useEffect(() => { context.current = tenant; return () => { context.current = "unmounted"; }; }, [tenant]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const generation = ++listGeneration.current;
    const controller = new AbortController();
    setList({ tenant, loading: true, error: null, result: null });
    void listCampaignDrafts(tenant, { signal: controller.signal }).then((result) => {
      if (!cancelled && context.current === tenant && generation === listGeneration.current) setList({ tenant, loading: false, error: null, result });
    }).catch((error) => {
      if (!cancelled && context.current === tenant && generation === listGeneration.current) setList({ tenant, loading: false, error: asDraftError(error), result: null });
    });
    return () => { cancelled = true; controller.abort(); };
  }, [enabled, tenant, refresh]);

  const merge = useCallback((draft: CampaignDraft) => {
    listGeneration.current += 1;
    setList((previous) => {
      const items = [draft, ...(previous.tenant === tenant ? previous.result?.items || [] : []).filter((item) => item.id !== draft.id)]
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 50);
      return { tenant, loading: false, error: null, result: { tenant, items, count: items.length, truncated: previous.result?.truncated || false } };
    });
    setRefresh((value) => value + 1);
  }, [tenant]);

  async function runOperation(reconcile: boolean) {
    const pending = operation.current;
    if (!enabled || !canWrite || !pending || pending.request.tenant !== tenant || busy.current) return null;
    busy.current = true;
    setWrite({ pending: true, error: null, saved: null });
    try {
      const draft = await executeCampaignDraftMutation(pending.request, reconcile);
      if (context.current !== tenant) return null;
      merge(draft);
      if (!pending.request.body.status || selected?.id === draft.id) setSelected(draft);
      operation.current = null;
      setComparison(null);
      setWrite({ pending: false, error: null, saved: draft });
      return draft;
    } catch (error) {
      if (context.current !== tenant) return null;
      const failure = asDraftError(error);
      if (failure.currentDraft) { setComparison(failure.currentDraft); merge(failure.currentDraft); }
      pending.uncertain = pending.uncertain || failure.uncertain;
      if (!pending.uncertain && failure.status !== 409) operation.current = null;
      // A failed reconciliation read does not erase an earlier uncertain write.
      const visibleError = pending.uncertain && failure.status !== 409
        ? new CampaignDraftError(failure.code, failure.status, true, failure.currentRevision) : failure;
      setWrite({ pending: false, error: visibleError, saved: null });
      return null;
    } finally { busy.current = false; }
  }

  async function save(content: CampaignDraftContent) {
    if (!enabled || !canWrite || busy.current || selected?.status === "archived") return null;
    if (!operation.current) {
      operation.current = {
        request: campaignDraftSaveOperation(tenant, content, selected, null),
        uncertain: false,
      };
    }
    return runOperation(operation.current.uncertain);
  }

  async function changeStatus(draft: CampaignDraft, status: "draft" | "archived") {
    if (!enabled || !canWrite || busy.current || operation.current || draft.tenant !== tenant || draft.status === status) return;
    operation.current = { request: { tenant, method: "PATCH", id: draft.id, idempotencyKey: `draft-${crypto.randomUUID()}`,
      body: { expectedRevision: draft.revision, status } }, uncertain: false };
    await runOperation(false);
  }

  async function readDraft(id: string, forComparison = false) {
    if (!enabled || busy.current) return null;
    busy.current = true;
    setReading(true);
    try {
      const draft = await getCampaignDraft(tenant, id);
      if (context.current !== tenant) return null;
      merge(draft);
      if (forComparison) setComparison(draft);
      return draft;
    } catch (error) {
      if (context.current === tenant) setWrite({ pending: false, error: asDraftError(error), saved: null });
      return null;
    } finally { busy.current = false; if (context.current === tenant) setReading(false); }
  }

  function select(draft: CampaignDraft | null) {
    if (busy.current || operation.current?.uncertain || (draft && draft.tenant !== tenant)) return false;
    operation.current = null;
    setSelected(draft);
    setComparison(null);
    setWrite(emptyWrite);
    return true;
  }

  function useReviewedRevision() {
    if (!comparison || comparison.tenant !== tenant || busy.current) return;
    operation.current = null;
    setSelected(comparison);
    setComparison(null);
    setWrite(emptyWrite);
  }

  function acknowledgeReviewedStatus() {
    if (!comparison || !operation.current?.request.body.status || busy.current) return;
    operation.current = null;
    setComparison(null);
    setWrite(emptyWrite);
  }

  function closeRejectedReceipt() {
    if (busy.current || write.error?.code !== "campaign_draft_idempotency_conflict") return;
    // An explicit server rejection is not retried with a fresh key automatically.
    operation.current = null;
    setComparison(null);
    setWrite(emptyWrite);
    setRefresh((value) => value + 1);
  }

  return {
    list: list.tenant === tenant ? list : { tenant, loading: enabled, error: null, result: null },
    selected: selected?.tenant === tenant ? selected : null,
    comparison, write, reading,
    hasUnresolved: Boolean(operation.current),
    unresolvedId: write.error?.currentDraft?.id || operation.current?.request.id,
    unresolvedIsArchive: Boolean(operation.current?.request.body.status),
    reload: () => setRefresh((value) => value + 1),
    save, archive: (draft: CampaignDraft) => changeStatus(draft, "archived"),
    restore: (draft: CampaignDraft) => changeStatus(draft, "draft"),
    readDraft, select, useReviewedRevision, acknowledgeReviewedStatus, closeRejectedReceipt,
    retry: () => runOperation(Boolean(operation.current?.uncertain)),
  };
}

function asDraftError(error: unknown) {
  return error instanceof CampaignDraftError ? error : new CampaignDraftError("campaign_drafts_unavailable");
}

export type CampaignDraftWorkspace = ReturnType<typeof useCampaignDraftWorkspace>;
const buttonClass = "min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800";
const channelLabels = { whatsapp: "WhatsApp", email: "Email", phone: "Teléfono" };

export function CampaignDraftSaveFeedback({ workspace, dirty, onUseServer }: {
  workspace: CampaignDraftWorkspace;
  dirty: boolean;
  onUseServer: (draft: CampaignDraft) => void;
}) {
  const { write, selected, comparison } = workspace;
  return <div className="space-y-3 text-sm" aria-live="polite">
    <p className="text-slate-600 dark:text-slate-300">
      {write.pending ? "Guardando en el servidor…" : write.saved
        ? `${write.saved.status === "archived" ? "Archivo" : "Guardado"} confirmado · ${write.saved.title} · versión ${write.saved.revision}${dirty && selected?.id === write.saved.id ? " · hay cambios nuevos sin guardar" : ""}`
        : selected ? `Editando versión ${selected.revision}${dirty ? " · cambios sin guardar" : " · sin cambios"}` : "Borrador nuevo · todavía sin guardar"}
    </p>
    {write.error ? <div role="alert" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
      <p>{campaignDraftErrorCopy(write.error)}</p>
      {write.error.currentRevision ? <p>Versión actual informada: {write.error.currentRevision}.</p> : null}
      <div className="flex flex-wrap gap-2">
        {write.error.code === "campaign_draft_idempotency_conflict" ? <button type="button" className={buttonClass} onClick={workspace.closeRejectedReceipt}>Cerrar operación rechazada y revisar listado</button> : null}
        {workspace.hasUnresolved && !["campaign_draft_revision_conflict", "campaign_draft_idempotency_conflict", "campaign_draft_replay_changed"].includes(write.error.code) ?
          <button type="button" className={buttonClass} disabled={write.pending || workspace.reading} onClick={() => void workspace.retry()}>Reintentar el mismo guardado</button> : null}
        {workspace.unresolvedId ? <button type="button" className={buttonClass} disabled={workspace.reading || write.pending} onClick={() => void workspace.readDraft(workspace.unresolvedId!, true)}>Consultar versión del servidor</button> : null}
      </div>
    </div> : null}
    {comparison ? <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-950">
      <h4 className="font-semibold text-slate-900 dark:text-white">Versión del servidor {comparison.revision} · {comparison.status === "archived" ? "Archivado" : "Borrador"}</h4>
      <p className="break-words font-medium text-slate-800 dark:text-slate-200">{comparison.title}</p>
      <p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-600 dark:text-slate-300">{comparison.message}</p>
      <p className="text-xs text-slate-600 dark:text-slate-300">Tu texto sigue en el editor. Elegí cómo continuar; no se sobrescribe automáticamente.</p>
      <div className="flex flex-wrap gap-2">
        {workspace.unresolvedIsArchive ? <button type="button" className={buttonClass} onClick={workspace.acknowledgeReviewedStatus}>Usar versión revisada en la lista</button> : null}
        {!workspace.unresolvedIsArchive && comparison.status === "draft" ? <button type="button" className={buttonClass} onClick={workspace.useReviewedRevision}>Conservar mi texto y usar esta versión como base</button> : null}
        <button type="button" className={buttonClass} onClick={() => { workspace.useReviewedRevision(); onUseServer(comparison); }}>Usar texto del servidor en el editor</button>
      </div>
    </div> : null}
  </div>;
}

export function CampaignDraftListPanel({ workspace, canWrite, onEdit, onNew }: {
  workspace: CampaignDraftWorkspace;
  canWrite: boolean;
  onEdit: (draft: CampaignDraft) => void;
  onNew: () => void;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const { list, write } = workspace;
  const items = (list.result?.items || []).filter((item) => item.status === (showArchived ? "archived" : "draft"));
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white" aria-label="Borradores guardados">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-bold">Borradores guardados</h2><p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">Contenido persistido por tenant. Guardar no aprueba ni envía una campaña.</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={list.loading || write.pending} onClick={workspace.reload}>Actualizar lista</button>
        <button type="button" className={buttonClass} disabled={!canWrite || write.pending || workspace.reading || workspace.hasUnresolved} onClick={onNew}>Nuevo borrador</button>
      </div>
    </div>
    {!canWrite ? <p className="text-sm text-slate-600 dark:text-slate-300">Sólo lectura: tu rol puede consultar borradores, pero no guardarlos ni archivarlos.</p> : null}
    <div className="flex flex-wrap gap-2">
      <button type="button" aria-pressed={!showArchived} className={buttonClass} onClick={() => setShowArchived(false)}>Borradores</button>
      <button type="button" aria-pressed={showArchived} className={buttonClass} onClick={() => setShowArchived(true)}>Archivados</button>
    </div>
    <div role="status" aria-live="polite">
      {list.loading ? <p className="text-sm">Consultando borradores del servidor…</p> : list.error
        ? <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">{campaignDraftErrorCopy(list.error)} No se interpreta el error como una lista vacía.</p>
        : list.result && !items.length ? <p className="text-sm text-slate-600 dark:text-slate-300">No hay {showArchived ? "archivados" : "borradores"} en la muestra recibida.</p> : null}
    </div>
    {!list.loading && !list.error ? <ul className="space-y-3">
      {items.map((draft) => <li key={draft.id} className="min-w-0 space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 break-words font-semibold">{draft.title}</h3>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">{draft.status === "archived" ? "Archivado" : "Borrador"} · v{draft.revision}</span>
        </div>
        <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600 dark:text-slate-300">{draft.message}</p>
        <p className="text-xs text-slate-600 dark:text-slate-300">{channelLabels[draft.channel]} · Marketing · actualizado {new Date(draft.updatedAt).toLocaleString("es-AR", { timeZone: "UTC" })} UTC{draft.updatedBy.label ? ` · ${draft.updatedBy.label}` : ""}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} disabled={write.pending || workspace.reading || workspace.hasUnresolved} onClick={() => onEdit(draft)}>{draft.status === "archived" || !canWrite ? "Consultar texto" : "Editar borrador"}</button>
          {draft.status === "draft" && canWrite ? <button type="button" className={buttonClass} disabled={write.pending || workspace.hasUnresolved} onClick={() => void workspace.archive(draft)}>Archivar</button> : null}
          {draft.status === "archived" && canWrite ? <button type="button" className={buttonClass} disabled={write.pending || workspace.reading || workspace.hasUnresolved} onClick={() => void workspace.restore(draft)}>Restaurar borrador</button> : null}
        </div>
      </li>)}
    </ul> : null}
    {list.result ? <p className="text-xs text-slate-600 dark:text-slate-300">{list.result.count} borradores recibidos, incluidos archivados. {list.result.truncated ? "La muestra está limitada a 50; no es el total histórico." : "La fuente no informa más resultados para esta consulta."}</p> : null}
  </section>;
}
