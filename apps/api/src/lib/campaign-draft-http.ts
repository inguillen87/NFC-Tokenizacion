import { checkAdminWithPermission, getAdminPrincipal } from "./auth";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "./bounded-request-body";
import {
  CampaignDraftError, campaignDraftActor, createCampaignDraft, getCampaignDraft, listCampaignDrafts,
  parseCampaignDraftCreate, parseCampaignDraftId, parseCampaignDraftIdempotencyKey,
  parseCampaignDraftList, parseCampaignDraftPatch, patchCampaignDraft, resolveCampaignDraftTenant,
} from "./campaign-drafts";
import { sql } from "./db";
import { getRequestMeta } from "./request-meta";

const NO_STORE = { "cache-control": "private, no-store, max-age=0" };
const defaults = { authorize: checkAdminWithPermission, principal: getAdminPrincipal, query: sql, requestMeta: getRequestMeta };

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

async function body(req: Request) {
  try {
    return await readBoundedJsonBody<unknown>(req, 32 * 1024);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) throw new CampaignDraftError("campaign_draft_body_too_large", 413);
    throw new CampaignDraftError("campaign_draft_body_invalid");
  }
}

export function createCampaignDraftHandlers(overrides: Partial<typeof defaults> = {}) {
  const deps = { ...defaults, ...overrides };
  async function handle(req: Request, method: "list" | "get" | "create" | "patch", rawId?: string) {
    try {
      const auth = await deps.authorize(req, method === "list" || method === "get" ? "campaigns:read" : "campaigns:write");
      if (auth) {
        const response = new Response(auth.body, auth);
        response.headers.set("cache-control", NO_STORE["cache-control"]);
        return response;
      }
      const principal = deps.principal(req);
      const url = new URL(req.url);
      const id = method === "get" || method === "patch" ? parseCampaignDraftId(rawId || "") : "";
      const options = method === "list" ? parseCampaignDraftList(url.searchParams) : null;
      const key = method === "create" ? parseCampaignDraftIdempotencyKey(req.headers.get("idempotency-key")) : "";
      const content = method === "create" ? parseCampaignDraftCreate(await body(req)) : null;
      const patch = method === "patch" ? parseCampaignDraftPatch(await body(req)) : null;
      const tenant = await resolveCampaignDraftTenant(url.searchParams.get("tenant"), principal, deps.query);
      if (method === "list" && options) return json({ ok: true, tenant: tenant.slug, ...await listCampaignDrafts(tenant, options, deps.query) });
      if (method === "get") return json({ ok: true, tenant: tenant.slug, draft: await getCampaignDraft(tenant, id, deps.query) });
      const actor = campaignDraftActor(principal);
      const meta = deps.requestMeta(req);
      const audit = { ip: meta.ip, userAgent: meta.userAgent?.slice(0, 1024) || null, traceId: meta.traceId?.slice(0, 128) || null };
      if (method === "create" && content) {
        const result = await createCampaignDraft(tenant, actor, content, key, audit, deps.query);
        return json({ ok: true, tenant: tenant.slug, ...result }, result.idempotentReplay ? 200 : 201);
      }
      if (method === "patch" && patch) return json({ ok: true, tenant: tenant.slug, draft: await patchCampaignDraft(tenant, actor, id, patch, audit, deps.query) });
      throw new Error("campaign_draft_operation_invalid");
    } catch (error) {
      if (error instanceof CampaignDraftError) return json({
        ok: false, reason: error.message,
        ...(error.currentRevision === undefined ? {} : { currentRevision: error.currentRevision }),
      }, error.status);
      return json({ ok: false, reason: "campaign_drafts_unavailable" }, 503);
    }
  }
  return {
    list: (req: Request) => handle(req, "list"),
    create: (req: Request) => handle(req, "create"),
    get: (req: Request, id: string) => handle(req, "get", id),
    patch: (req: Request, id: string) => handle(req, "patch", id),
  };
}
