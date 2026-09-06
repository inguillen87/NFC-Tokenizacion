import { readDemoDataMetaFromPayload, readDemoDataMetaFromResponse } from "../../../../lib/demo-data-mode";
import { buildLoyaltyAdminUrl } from "./loyalty-campaign-scope";
import type { CampaignAudienceChannel } from "./loyalty-campaign-audience";

export type CampaignDraftContent = {
  title: string;
  message: string;
  channel: CampaignAudienceChannel;
  purpose: "marketing";
};
export type CampaignDraft = CampaignDraftContent & {
  id: string;
  tenant: string;
  status: "draft" | "archived";
  revision: number;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; label: string };
  updatedBy: { id: string; label: string };
};
export type CampaignDraftList = { tenant: string; items: CampaignDraft[]; count: number; truncated: boolean };
export type CampaignDraftMutation = {
  tenant: string;
  id?: string;
  method: "POST" | "PATCH";
  idempotencyKey: string;
  body: Partial<CampaignDraftContent> & { expectedRevision?: number; status?: "draft" | "archived" };
};

export class CampaignDraftError extends Error {
  constructor(
    readonly code: string,
    readonly status = 0,
    readonly uncertain = false,
    readonly currentRevision?: number,
    readonly currentDraft?: CampaignDraft,
  ) { super(code); this.name = "CampaignDraftError"; }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHANNELS = ["whatsapp", "email", "phone"];
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function declaredDemo(value: unknown) {
  return readDemoDataMetaFromPayload(value).demoMode || record(value)?.data_provenance === "declared_demo";
}
function invalid(): never { throw new CampaignDraftError("campaign_draft_contract_invalid"); }
function validText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}
function validDate(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && Number.isFinite(Date.parse(value));
}
function actor(value: unknown) {
  const source = record(value);
  if (!source || typeof source.id !== "string" || !UUID.test(source.id) || !validText(source.label, 160)) return invalid();
  return { id: source.id, label: source.label };
}

export function parseCampaignDraft(value: unknown, tenant: string): CampaignDraft {
  const draft = record(value);
  if (declaredDemo(draft)) throw new CampaignDraftError("campaign_draft_demo_response");
  if (!draft || draft.tenant !== tenant) throw new CampaignDraftError("campaign_draft_tenant_mismatch");
  if (typeof draft.id !== "string" || !UUID.test(draft.id)
    || !validText(draft.title, 160) || !validText(draft.message, 6000)
    || typeof draft.channel !== "string" || !CHANNELS.includes(draft.channel) || draft.purpose !== "marketing"
    || !["draft", "archived"].includes(String(draft.status))
    || typeof draft.revision !== "number" || !Number.isSafeInteger(draft.revision) || draft.revision < 1
    || !validDate(draft.createdAt) || !validDate(draft.updatedAt)) return invalid();
  return {
    id: draft.id, tenant, title: draft.title, message: draft.message,
    channel: draft.channel as CampaignAudienceChannel, purpose: "marketing",
    status: draft.status as "draft" | "archived", revision: draft.revision,
    createdAt: draft.createdAt, updatedAt: draft.updatedAt,
    createdBy: actor(draft.createdBy), updatedBy: actor(draft.updatedBy),
  };
}

export function parseCampaignDraftList(payload: unknown, tenant: string): CampaignDraftList {
  const envelope = record(payload);
  if (envelope?.tenant !== tenant) throw new CampaignDraftError("campaign_draft_tenant_mismatch");
  if (envelope.ok !== true || !Array.isArray(envelope.items) || envelope.items.length > 50
    || envelope.count !== envelope.items.length || typeof envelope.truncated !== "boolean") return invalid();
  const items = envelope.items.map((item) => parseCampaignDraft(item, tenant));
  if (new Set(items.map((item) => item.id)).size !== items.length) return invalid();
  return { tenant, items, count: items.length, truncated: envelope.truncated };
}

function draftUrl(tenant: string, id?: string) {
  if (!/^[a-z0-9](?:[a-z0-9_-]{0,78}[a-z0-9])?$/.test(tenant)) throw new CampaignDraftError("campaign_draft_tenant_required");
  if (id && !UUID.test(id)) throw new CampaignDraftError("campaign_draft_id_invalid");
  const url = buildLoyaltyAdminUrl(id ? `campaigns/drafts/${id}` : "campaigns/drafts", tenant);
  if (!url) throw new CampaignDraftError("campaign_draft_tenant_required");
  return url;
}

async function draftRequest(url: string, init: RequestInit, fetcher: typeof fetch) {
  const mutation = init.method === "POST" || init.method === "PATCH";
  let response: Response;
  try { response = await fetcher(url, { ...init, cache: "no-store" }); }
  catch { throw new CampaignDraftError("campaign_drafts_unavailable", 0, mutation); }
  const payload: unknown = await response.json().catch(() => null);
  const envelope = record(payload);
  if (readDemoDataMetaFromResponse(response).demoMode || declaredDemo(payload) || declaredDemo(envelope?.draft)
    || (Array.isArray(envelope?.items) && envelope.items.some(declaredDemo))) {
    throw new CampaignDraftError("campaign_draft_demo_response", response.status, mutation);
  }
  if (!response.ok) {
    const reason = typeof envelope?.reason === "string" && /^campaign_drafts?_[a-z_]+$/.test(envelope.reason)
      ? envelope.reason : response.status === 401 ? "campaign_draft_session_required"
        : response.status === 403 ? "campaign_draft_write_forbidden" : "campaign_drafts_unavailable";
    throw new CampaignDraftError(reason, response.status, mutation && response.status >= 500,
      typeof envelope?.currentRevision === "number" && Number.isSafeInteger(envelope.currentRevision) && envelope.currentRevision > 0 ? envelope.currentRevision : undefined);
  }
  if (envelope?.ok !== true) throw new CampaignDraftError("campaign_draft_contract_invalid", response.status, mutation);
  return envelope;
}

export async function listCampaignDrafts(tenant: string, options: { signal?: AbortSignal; fetcher?: typeof fetch } = {}) {
  const payload = await draftRequest(`${draftUrl(tenant)}&status=all&limit=50`, { signal: options.signal }, options.fetcher || fetch);
  return parseCampaignDraftList(payload, tenant);
}

export async function getCampaignDraft(tenant: string, id: string, fetcher: typeof fetch = fetch) {
  const payload = await draftRequest(draftUrl(tenant, id), {}, fetcher);
  if (payload.tenant !== tenant) throw new CampaignDraftError("campaign_draft_tenant_mismatch");
  const draft = parseCampaignDraft(payload.draft, tenant);
  if (draft.id !== id) return invalid();
  return draft;
}

export function campaignDraftContent(title: string, message: string, channel: CampaignAudienceChannel): CampaignDraftContent {
  const content = { title: title.trim(), message: message.trim(), channel, purpose: "marketing" as const };
  if (!validText(content.title, 160)) throw new CampaignDraftError("campaign_draft_title_invalid");
  if (!validText(content.message, 6000)) throw new CampaignDraftError("campaign_draft_message_invalid");
  if (!CHANNELS.includes(channel)) throw new CampaignDraftError("campaign_draft_channel_invalid");
  return content;
}

export function campaignDraftSaveOperation(
  tenant: string,
  content: CampaignDraftContent,
  selected: CampaignDraft | null,
  pending: CampaignDraftMutation | null,
  createKey: () => string = () => `draft-${crypto.randomUUID()}`,
): CampaignDraftMutation {
  draftUrl(tenant);
  if (pending) {
    if (pending.tenant !== tenant) throw new CampaignDraftError("campaign_draft_tenant_mismatch");
    return pending;
  }
  if (selected && (selected.tenant !== tenant || selected.status !== "draft")) throw new CampaignDraftError("campaign_draft_write_forbidden");
  const validated = campaignDraftContent(content.title, content.message, content.channel);
  return {
    tenant, method: selected ? "PATCH" : "POST", id: selected?.id, idempotencyKey: createKey(),
    body: selected ? { ...validated, expectedRevision: selected.revision } : { ...validated },
  };
}

export function campaignDraftMatchesMutation(draft: CampaignDraft, operation: CampaignDraftMutation) {
  return draft.tenant === operation.tenant && draft.id === operation.id
    && draft.revision === Number(operation.body.expectedRevision) + 1
    && Object.entries(operation.body).every(([key, value]) => key === "expectedRevision" || draft[key as keyof CampaignDraft] === value);
}

/** Reconcile an uncertain PATCH before retrying its original revision. POST retries reuse their receipt key. */
export async function executeCampaignDraftMutation(operation: CampaignDraftMutation, reconcile = false, fetcher: typeof fetch = fetch) {
  if (!/^[a-zA-Z0-9._:-]{8,128}$/.test(operation.idempotencyKey)) throw new CampaignDraftError("campaign_draft_idempotency_key_invalid");
  if (operation.method === "PATCH" && operation.id && reconcile) {
    const current = await getCampaignDraft(operation.tenant, operation.id, fetcher);
    if (campaignDraftMatchesMutation(current, operation)) return current;
    if (current.revision !== operation.body.expectedRevision) {
      throw new CampaignDraftError("campaign_draft_revision_conflict", 409, false, current.revision);
    }
  }
  const payload = await draftRequest(draftUrl(operation.tenant, operation.id), {
    method: operation.method,
    headers: { "Content-Type": "application/json", "Idempotency-Key": operation.idempotencyKey },
    body: JSON.stringify(operation.body),
  }, fetcher);
  try {
    if (payload.tenant !== operation.tenant) throw new CampaignDraftError("campaign_draft_tenant_mismatch");
    const draft = parseCampaignDraft(payload.draft, operation.tenant);
    if (operation.method === "PATCH" && !campaignDraftMatchesMutation(draft, operation)) return invalid();
    if (operation.method === "POST" && !Object.entries(operation.body).every(([key, value]) => draft[key as keyof CampaignDraft] === value)) {
      if (payload.idempotentReplay === true) throw new CampaignDraftError("campaign_draft_replay_changed", 409, false, draft.revision, draft);
      return invalid();
    }
    return draft;
  } catch (error) {
    if (error instanceof CampaignDraftError && error.code === "campaign_draft_replay_changed") throw error;
    throw new CampaignDraftError(error instanceof CampaignDraftError ? error.code : "campaign_draft_contract_invalid", 200, true);
  }
}

export function campaignDraftErrorCopy(error: CampaignDraftError | null) {
  if (!error) return "";
  const messages: Record<string, string> = {
    campaign_draft_revision_conflict: "Otra persona o pestaña cambió este borrador. Tu texto sigue aquí. Revisá la versión del servidor antes de decidir qué conservar.",
    campaign_draft_idempotency_conflict: "La clave del guardado ya está asociada a otro contenido. Tu texto se conserva; consultá el listado antes de intentar un nuevo guardado.",
    campaign_draft_replay_changed: "El borrador sí fue creado, pero su versión actual tiene otros cambios. Tu texto se conserva. Revisá la versión del servidor antes de continuar; no se creará otro borrador automáticamente.",
    campaign_draft_tenant_mismatch: "La respuesta no pertenece al tenant seleccionado. No se aplicó al editor.",
    campaign_draft_tenant_required: "Seleccioná un tenant autorizado para guardar borradores.",
    campaign_draft_title_invalid: "Escribí un título de entre 1 y 160 caracteres.",
    campaign_draft_message_invalid: "El mensaje debe tener entre 1 y 6000 caracteres.",
    campaign_draft_body_too_large: "El contenido supera el tamaño permitido. Reducilo antes de volver a guardar; tu texto se conserva.",
    campaign_draft_channel_invalid: "Seleccioná un canal válido para este borrador.",
    campaign_draft_write_forbidden: "Tu rol no permite esta operación. El texto permanece en el editor.",
    campaign_draft_session_required: "La sesión venció. El texto permanece en esta página; copialo antes de volver a iniciar sesión.",
    campaign_draft_not_found: "El borrador no está disponible en este tenant. Tu texto se conserva.",
    campaign_draft_contract_invalid: "La respuesta no pudo validarse. No se confirma el guardado y tu texto se conserva.",
    campaign_draft_demo_response: "La fuente devolvió una simulación; no se acepta como un borrador guardado.",
  };
  return messages[error.code] || (error.uncertain
    ? "No se pudo confirmar el guardado. Reintentá la misma operación para comprobar su resultado sin duplicar el borrador."
    : "Los borradores del servidor no están disponibles. Tu texto se conserva; podés volver a consultar.");
}
