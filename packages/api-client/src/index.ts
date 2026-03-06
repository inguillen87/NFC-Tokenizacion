import { z } from "zod";

export type ApiClientOptions = {
  baseURL?: string;
  adminToken?: string;
};

const errorSchema = z.object({ ok: z.boolean().optional(), reason: z.string().optional(), error: z.string().optional() }).passthrough();

export const tenantSchema = z.object({ id: z.string(), slug: z.string(), name: z.string(), created_at: z.string().optional() }).passthrough();
export const batchSchema = z.object({ id: z.string().optional(), bid: z.string(), status: z.string().optional(), created_at: z.string().optional() }).passthrough();
export const eventSchema = z.object({ id: z.union([z.number(), z.string()]), result: z.string(), created_at: z.string().optional() }).passthrough();

function withQuery(path: string, query?: Record<string, string | number | undefined>) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") params.set(k, String(v));
  const serialized = params.toString();
  return serialized ? `${path}?${serialized}` : path;
}

async function request<T>(opts: ApiClientOptions, path: string, init?: RequestInit, parser?: z.ZodType<T>): Promise<T> {
  const baseURL = opts.baseURL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3003";
  const response = await fetch(`${baseURL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(opts.adminToken ? { Authorization: `Bearer ${opts.adminToken}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const normalized = errorSchema.safeParse(data);
    const message = normalized.success ? normalized.data.reason || normalized.data.error || `HTTP ${response.status}` : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return parser ? parser.parse(data) : (data as T);
}

export function createApiClient(opts: ApiClientOptions = {}) {
  return {

    getJson: <T = unknown>(path: string) => request<T>(opts, path),
    postJson: <T = unknown>(path: string, payload: unknown) => request<T>(opts, path, { method: "POST", body: JSON.stringify(payload) }),
    health: () => request(opts, "/health"),
    sunValidate: (query: Record<string, string | number>) => request(opts, withQuery("/sun", query)),
    adminCreateTenant: (payload: { slug: string; name: string }) => request(opts, "/admin/tenants", { method: "POST", body: JSON.stringify(payload) }, tenantSchema),
    adminListTenants: () => request(opts, "/admin/tenants", undefined, z.array(tenantSchema)),
    adminCreateBatch: (payload: { tenant_slug: string; bid: string }) => request(opts, "/admin/batches", { method: "POST", body: JSON.stringify(payload) }),
    adminListBatches: (tenant_slug?: string) => request(opts, withQuery("/admin/batches", { tenant: tenant_slug }), undefined, z.array(batchSchema)),
    adminImportManifest: (bid: string, csvText: string) => request(opts, `/admin/batches/${bid}/import-manifest`, { method: "POST", body: JSON.stringify({ csv: csvText }) }),
    adminActivateTags: (payload: { batchId: string; count: number }) => request(opts, "/admin/tags/activate", { method: "POST", body: JSON.stringify(payload) }),
    adminRevokeBatch: (bid: string, reason: string) => request(opts, `/admin/batches/${bid}/revoke`, { method: "POST", body: JSON.stringify({ reason }) }),
    adminGetOverview: (tenant_slug?: string) => request(opts, withQuery("/admin/overview", { tenant: tenant_slug })),
    adminListEvents: (filters?: Record<string, string | number | undefined>) => request(opts, withQuery("/admin/events", filters), undefined, z.array(eventSchema)),
    createLead: (payload: Record<string, unknown>) => request(opts, "/admin/leads", { method: "POST", body: JSON.stringify(payload) }),
    createTicket: (payload: Record<string, unknown>) => request(opts, "/admin/tickets", { method: "POST", body: JSON.stringify(payload) }),
    createOrderRequest: (payload: Record<string, unknown>) => request(opts, "/admin/orders", { method: "POST", body: JSON.stringify(payload) }),
    listLeads: () => request(opts, "/admin/leads"),
    listTickets: () => request(opts, "/admin/tickets"),
    listOrders: () => request(opts, "/admin/orders"),
    assistantChat: (payload: Record<string, unknown>) => request(opts, "/assistant/chat", { method: "POST", body: JSON.stringify(payload) }),
  };
}
