import { z } from "zod";

export type ApiClientOptions = {
  baseURL?: string;
  adminToken?: string;
};

const errorSchema = z.object({ ok: z.boolean().optional(), reason: z.string().optional(), error: z.string().optional() }).passthrough();

export const tenantSchema = z.object({ id: z.string(), slug: z.string(), name: z.string(), created_at: z.string().optional() }).passthrough();
export const batchSchema = z.object({ id: z.string().optional(), bid: z.string(), status: z.string().optional(), created_at: z.string().optional() }).passthrough();
export const eventSchema = z.object({ id: z.union([z.number(), z.string()]), result: z.string(), created_at: z.string().optional() }).passthrough();

const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();
const optionalBoolean = z.boolean().optional();

export const supplierSubBatchSchema = z.object({
  id: z.string().optional(),
  bid: z.string(),
  batch_id: z.string().optional(),
  sequence_index: z.number().optional(),
  expected_quantity: z.number().optional(),
  manifest_status: nullableString,
  manifest_count: nullableNumber,
  qa_status: nullableString,
  key_fingerprint: nullableString,
  url_template: nullableString,
  status: nullableString,
}).passthrough();

export const supplierOrderSchema = z.object({
  id: z.string(),
  tenant_id: z.string().optional(),
  tenant_slug: z.string().optional(),
  customer_slug: z.string().optional(),
  order_name: z.string().optional(),
  base_batch_id: z.string().optional(),
  total_quantity: z.number().optional(),
  sub_batch_size: z.number().optional(),
  chip_model: z.string().optional(),
  carrier_profile_code: z.string().optional(),
  status: z.string().optional(),
  sub_batches: z.array(supplierSubBatchSchema).optional(),
}).passthrough();

export const supplierOrdersResponseSchema = z.object({
  ok: z.literal(true),
  orders: z.array(supplierOrderSchema),
}).passthrough();

export const supplierOrderResponseSchema = z.object({
  ok: z.literal(true),
  order: supplierOrderSchema,
  sub_batches: z.array(supplierSubBatchSchema).optional(),
  warning: z.string().optional(),
}).passthrough();

export const supplierVaultArtifactSchema = z.object({
  id: z.string(),
  bid: nullableString,
  resource_type: z.string().optional(),
  resource_id: z.string().optional(),
  artifact_type: z.string(),
  content_hash: z.string().optional(),
  mime_type: nullableString,
  status: nullableString,
  created_at: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
}).passthrough();

export const supplierVaultResponseSchema = z.object({
  ok: z.literal(true),
  order: z.object({
    id: z.string(),
    tenant_slug: z.string().optional(),
    customer_slug: z.string().optional(),
    order_name: z.string().optional(),
  }).passthrough(),
  artifacts: z.array(supplierVaultArtifactSchema),
}).passthrough();

export const supplierPackExportResponseSchema = z.object({
  ok: z.literal(true),
  order: z.object({
    id: z.string(),
    tenant_slug: z.string().optional(),
    customer_slug: z.string().optional(),
    order_name: z.string().optional(),
  }).passthrough(),
  zip_layout: z.string().optional(),
  encrypted_pack: z.object({
    filename: z.string(),
    mime_type: z.string().optional(),
    encoding: z.string().optional(),
    base64: z.string(),
    envelope_sha256: z.string().optional(),
    plaintext_zip_sha256: z.string().optional(),
    ciphertext_sha256: z.string().optional(),
    password_warning: z.string().optional(),
  }).passthrough(),
  packs: z.array(z.object({
    bid: z.string(),
    key_fingerprint: z.string().optional(),
    content_hash: z.string().optional(),
  }).passthrough()),
  warning: z.string().optional(),
}).passthrough();

export const supplierManifestResponseSchema = z.object({
  ok: z.literal(true),
  dryRun: optionalBoolean,
  batch: z.string(),
  manifestType: z.string().optional(),
  importedRows: z.number(),
  inserted: z.number().optional(),
  reactivated: z.number().optional(),
  registeredSunPayloads: z.number().optional(),
  duplicateUids: z.array(z.string()).optional(),
  activated: optionalBoolean,
  supplier_gate: z.record(z.unknown()).nullable().optional(),
}).passthrough();

export const supplierQaResponseSchema = z.object({
  ok: z.literal(true),
  bid: z.string(),
  qa_status: z.string(),
  activation_gate: z.string().optional(),
  evidence_hash: z.string().optional(),
  requires_ttstatus: optionalBoolean,
}).passthrough();

export const supplierActivationResponseSchema = z.object({
  ok: z.literal(true),
  batch: z.string(),
  activated: z.number(),
  remainingInactive: z.number(),
  activationComplete: z.boolean(),
  supplier_gate: z.record(z.unknown()).nullable().optional(),
}).passthrough();

export const offlineVerifierDeviceSchema = z.object({
  id: z.string(),
  tenant_slug: z.string().optional(),
  device_label: z.string(),
  device_type: z.string(),
  device_fingerprint: z.string(),
  operator_ref: z.string().nullable().optional(),
  status: z.string(),
  last_seen_at: nullableString,
  created_at: z.string().optional(),
}).passthrough();

export const offlineVerifierDevicesResponseSchema = z.object({
  ok: z.literal(true),
  devices: z.array(offlineVerifierDeviceSchema),
}).passthrough();

export const offlineVerifierDeviceResponseSchema = z.object({
  ok: z.literal(true),
  device: offlineVerifierDeviceSchema,
}).passthrough();

export const offlineVerifierBundleSchema = z.object({
  id: z.string(),
  bundle_ref: z.string(),
  tenant_slug: z.string(),
  device_id: z.string(),
  allowed_bids: z.array(z.string()),
  key_fingerprints: z.record(z.object({
    pair: z.string().nullable().optional(),
    roles: z.record(z.string()).optional(),
  }).passthrough()),
  key_material_included: z.literal(false),
  policy: z.object({
    contains_key_material: z.literal(false),
    local_verdict_model: z.literal("provisional_until_backend_sync"),
    allowed_local_verdicts: z.array(z.enum(["OFFLINE_LOCAL_PASS", "OFFLINE_LOCAL_FAIL", "SYNC_PENDING"])),
    requires_backend_sync_for: z.array(z.string()),
  }).passthrough(),
  bundle_hash: z.string(),
  status: z.string(),
  expires_at: z.string(),
  created_at: z.string(),
}).passthrough();

export const offlineVerifierBundleResponseSchema = z.object({
  ok: z.literal(true),
  bundle: offlineVerifierBundleSchema,
  warning: z.string().optional(),
}).passthrough();

export const offlineVerifierSyncResultSchema = z.object({
  ok: z.boolean(),
  client_event_id: z.string().nullable(),
  bid: z.string().optional(),
  reason: z.string().nullable().optional(),
  key: z.string().optional(),
  sync_status: z.enum(["received", "duplicate"]).optional(),
  server_verdict: z.string().optional(),
  final: z.literal(false).optional(),
  payload_hash: z.string().optional(),
}).passthrough();

export const offlineVerifierSyncResponseSchema = z.object({
  ok: z.literal(true),
  bundle_ref: z.string(),
  tenant_slug: z.string(),
  received: z.number(),
  rejected: z.number(),
  final_verdict: z.literal(false),
  warning: z.string().optional(),
  results: z.array(offlineVerifierSyncResultSchema),
}).passthrough();

export type SupplierSubBatch = z.infer<typeof supplierSubBatchSchema>;
export type SupplierOrder = z.infer<typeof supplierOrderSchema>;
export type SupplierOrdersResponse = z.infer<typeof supplierOrdersResponseSchema>;
export type SupplierOrderResponse = z.infer<typeof supplierOrderResponseSchema>;
export type SupplierVaultArtifact = z.infer<typeof supplierVaultArtifactSchema>;
export type SupplierVaultResponse = z.infer<typeof supplierVaultResponseSchema>;
export type SupplierPackExportResponse = z.infer<typeof supplierPackExportResponseSchema>;
export type SupplierManifestResponse = z.infer<typeof supplierManifestResponseSchema>;
export type SupplierQaResponse = z.infer<typeof supplierQaResponseSchema>;
export type SupplierActivationResponse = z.infer<typeof supplierActivationResponseSchema>;
export type OfflineVerifierDevice = z.infer<typeof offlineVerifierDeviceSchema>;
export type OfflineVerifierDevicesResponse = z.infer<typeof offlineVerifierDevicesResponseSchema>;
export type OfflineVerifierDeviceResponse = z.infer<typeof offlineVerifierDeviceResponseSchema>;
export type OfflineVerifierBundle = z.infer<typeof offlineVerifierBundleSchema>;
export type OfflineVerifierBundleResponse = z.infer<typeof offlineVerifierBundleResponseSchema>;
export type OfflineVerifierSyncResponse = z.infer<typeof offlineVerifierSyncResponseSchema>;

export type CreateSupplierOrderPayload = {
  tenant_id?: string;
  tenantId?: string;
  tenant_slug?: string;
  tenantSlug?: string;
  tenant?: string;
  customer_slug?: string;
  customerSlug?: string;
  order_name?: string;
  orderName?: string;
  base_batch_id?: string;
  baseBatchId?: string;
  total_quantity?: number;
  totalQuantity?: number;
  sub_batch_size?: number;
  subBatchSize?: number;
  chip_model?: string;
  chipModel?: string;
  chip?: string;
  carrier_profile_code?: string;
  carrierProfileCode?: string;
  material_type?: string;
  materialType?: string;
  sku?: string;
  notes?: string;
};

export type ExportSupplierPackPayload = {
  password: string;
  bid?: string;
};

export type ImportSupplierManifestPayload = {
  csv: string;
  dryRun?: boolean;
  activateImported?: boolean;
};

export type SupplierQaPayload = {
  bid: string;
  passed?: boolean;
  qa_passed?: boolean;
  status?: "passed" | "failed";
  sample_urls?: string[];
  sampleUrls?: string[];
  replay_checked?: boolean;
  replayChecked?: boolean;
  ttstatus_checked?: boolean;
  ttstatusChecked?: boolean;
  notes?: string;
};

export type ActivateSupplierSubBatchPayload = {
  limit?: number;
};

export type OfflineVerifierDevicesQuery = {
  tenant?: string;
  tenant_slug?: string;
  tenant_id?: string;
};

export type EnrollOfflineVerifierDevicePayload = {
  tenant_id?: string;
  tenantId?: string;
  tenant_slug?: string;
  tenantSlug?: string;
  tenant?: string;
  device_label?: string;
  deviceLabel?: string;
  label?: string;
  device_type?: string;
  deviceType?: string;
  device_fingerprint?: string;
  deviceFingerprint?: string;
  device_public_key?: string;
  devicePublicKey?: string;
  device_serial?: string;
  deviceSerial?: string;
  operator_ref?: string;
  operatorRef?: string;
  operator?: string;
  app_version?: string;
  appVersion?: string;
  platform?: string;
};

export type IssueOfflineVerifierBundlePayload = {
  device_id?: string;
  deviceId?: string;
  bids?: string[] | string;
  bid?: string;
  batch_ids?: string[] | string;
  batchIds?: string[] | string;
  expires_at?: string;
  expiresAt?: string;
};

export type OfflineLocalVerdict = "OFFLINE_LOCAL_PASS" | "OFFLINE_LOCAL_FAIL" | "SYNC_PENDING";

export type SyncOfflineVerifierEventPayload = {
  client_event_id?: string;
  clientEventId?: string;
  id?: string;
  bid?: string;
  batch_id?: string;
  batchId?: string;
  local_verdict?: OfflineLocalVerdict;
  localVerdict?: OfflineLocalVerdict;
  observed_at?: string;
  observedAt?: string;
  uid_hash?: string;
  uidHash?: string;
  sun_payload_hash?: string;
  sunPayloadHash?: string;
  app_version?: string;
  appVersion?: string;
};

export type SyncOfflineVerifierEventsPayload = {
  bundle_ref?: string;
  bundleRef?: string;
  bundle_id?: string;
  bundleId?: string;
  events: SyncOfflineVerifierEventPayload[];
};

function pathSegment(value: string) {
  return encodeURIComponent(value);
}

function normalizeManifestPayload(payload: string | ImportSupplierManifestPayload): ImportSupplierManifestPayload {
  return typeof payload === "string" ? { csv: payload } : payload;
}

function withQuery(path: string, query?: Record<string, string | number | undefined>) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") params.set(k, String(v));
  const serialized = params.toString();
  return serialized ? `${path}?${serialized}` : path;
}

async function request<T>(opts: ApiClientOptions, path: string, init?: RequestInit, parser?: z.ZodType<T>): Promise<T> {
  const baseURL = opts.baseURL || process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";
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
    demoLiveFeed: (tenant = "demobodega", limit = 25) => request(opts, withQuery("/demo/live", { tenant, limit })),
    sunValidate: (query: Record<string, string | number>) => request(opts, withQuery("/sun", query)),
    adminCreateTenant: (payload: { slug: string; name: string }) => request(opts, "/admin/tenants", { method: "POST", body: JSON.stringify(payload) }, tenantSchema),
    adminListTenants: () => request(opts, "/admin/tenants", undefined, z.array(tenantSchema)),
    adminCreateBatch: (payload: { tenant_slug: string; bid: string }) => request(opts, "/admin/batches", { method: "POST", body: JSON.stringify(payload) }),
    adminListSupplierOrders: () => request(opts, "/admin/supplier-orders", undefined, supplierOrdersResponseSchema),
    adminCreateSupplierOrder: (payload: CreateSupplierOrderPayload) => request(opts, "/admin/supplier-orders", { method: "POST", body: JSON.stringify(payload) }, supplierOrderResponseSchema),
    adminExportSupplierPack: (orderId: string, payload: ExportSupplierPackPayload) => request(opts, `/admin/supplier-orders/${pathSegment(orderId)}/export-pack`, { method: "POST", body: JSON.stringify(payload) }, supplierPackExportResponseSchema),
    adminGetSupplierVault: (orderId: string) => request(opts, `/admin/supplier-orders/${pathSegment(orderId)}/vault`, undefined, supplierVaultResponseSchema),
    adminRunSupplierQa: (orderId: string, payload: SupplierQaPayload) => request(opts, `/admin/supplier-orders/${pathSegment(orderId)}/qa`, { method: "POST", body: JSON.stringify(payload) }, supplierQaResponseSchema),
    adminListBatches: (tenant_slug?: string) => request(opts, withQuery("/admin/batches", { tenant: tenant_slug }), undefined, z.array(batchSchema)),
    adminImportSupplierManifest: (bid: string, payload: string | ImportSupplierManifestPayload) => request(opts, `/admin/batches/${pathSegment(bid)}/import-manifest`, { method: "POST", body: JSON.stringify(normalizeManifestPayload(payload)) }, supplierManifestResponseSchema),
    adminImportManifest: (bid: string, csvText: string) => request(opts, `/admin/batches/${pathSegment(bid)}/import-manifest`, { method: "POST", body: JSON.stringify({ csv: csvText }) }, supplierManifestResponseSchema),
    adminActivateSupplierSubBatch: (bid: string, payload: ActivateSupplierSubBatchPayload = {}) => request(opts, `/admin/batches/${pathSegment(bid)}/activate-all`, { method: "POST", body: JSON.stringify(payload) }, supplierActivationResponseSchema),
    adminListOfflineVerifierDevices: (filters?: OfflineVerifierDevicesQuery) => request(opts, withQuery("/admin/offline-verifier/devices", { tenant: filters?.tenant, tenant_slug: filters?.tenant_slug, tenant_id: filters?.tenant_id }), undefined, offlineVerifierDevicesResponseSchema),
    adminEnrollOfflineVerifierDevice: (payload: EnrollOfflineVerifierDevicePayload) => request(opts, "/admin/offline-verifier/devices", { method: "POST", body: JSON.stringify(payload) }, offlineVerifierDeviceResponseSchema),
    adminIssueOfflineVerifierBundle: (payload: IssueOfflineVerifierBundlePayload) => request(opts, "/admin/offline-verifier/bundles", { method: "POST", body: JSON.stringify(payload) }, offlineVerifierBundleResponseSchema),
    adminSyncOfflineVerifierEvents: (payload: SyncOfflineVerifierEventsPayload) => request(opts, "/admin/offline-verifier/sync", { method: "POST", body: JSON.stringify(payload) }, offlineVerifierSyncResponseSchema),
    adminActivateTags: (payload: { batchId: string; count: number }) => request(opts, "/admin/tags/activate", { method: "POST", body: JSON.stringify(payload) }),
    adminRevokeBatch: (bid: string, reason: string) => request(opts, `/admin/batches/${bid}/revoke`, { method: "POST", body: JSON.stringify({ reason }) }),
    adminGetOverview: (tenant_slug?: string) => request(opts, withQuery("/admin/overview", { tenant: tenant_slug })),
    adminGetAnalytics: (tenant_slug?: string) => request(opts, withQuery("/admin/analytics", { tenant: tenant_slug })),
    adminListEvents: (filters?: Record<string, string | number | undefined>) => request(opts, withQuery("/admin/events", filters), undefined, z.array(eventSchema)),
    createLead: (payload: Record<string, unknown>) => request(opts, "/admin/leads", { method: "POST", body: JSON.stringify(payload) }),
    createTicket: (payload: Record<string, unknown>) => request(opts, "/admin/tickets", { method: "POST", body: JSON.stringify(payload) }),
    createOrderRequest: (payload: Record<string, unknown>) => request(opts, "/admin/orders", { method: "POST", body: JSON.stringify(payload) }),
    listLeads: () => request(opts, "/admin/leads"),
    listTickets: () => request(opts, "/admin/tickets"),
    listOrders: () => request(opts, "/admin/orders"),

    adminSeedDemoBodega: () => request(opts, "/internal/demo/seed", { method: "POST" }),
    demoLabPacks: () => request(opts, "/internal/demo/packs"),
    demoLabSummary: () => request(opts, "/internal/demo/summary"),
    demoLabUsePack: () => request(opts, "/internal/demo/use-pack", { method: "POST" }),
    demoLabReset: () => request(opts, "/internal/demo/reset", { method: "POST" }),
    demoLabGenerateScans: (payload: { bid?: string; count?: number; mode?: "valid" | "replay" | "tamper" }) => request(opts, "/internal/demo/generate-live-scans", { method: "POST", body: JSON.stringify(payload) }),
    demoLabSimulateTap: (payload?: { uidHex?: string; mode?: "valid" | "replay" | "tamper" }) => request(opts, "/internal/demo/simulate-tap", { method: "POST", body: JSON.stringify(payload || {}) }),
    internalDemoScan: (payload: { bid: string; uidHex: string; deviceLabel?: string; city?: string; countryCode?: string; lat?: number; lng?: number; action?: "uncork" | "verify" | "retail_scan" }) => request(opts, "/internal/demo/scan", { method: "POST", body: JSON.stringify(payload) }),
    assistantChat: (payload: Record<string, unknown>) => request(opts, "/assistant/chat", { method: "POST", body: JSON.stringify(payload) }),
  };
}
