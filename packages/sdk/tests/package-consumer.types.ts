import {
  NexIdApiError,
  NexIdClient,
  verifyAndParseNexIdWebhook,
  type NexIdConfig,
  type NexIdMutationRequestOptions,
  type NexIdEpcisCaptureReceipt,
  type NexIdEpcisDocument,
  type NexIdEpcisPage,
  type NexIdEpcisQueryDocument,
  type NexIdIdempotencyStatus,
  type OfflineScanSyncRequest,
  type OfflineScanSyncResponse,
  type NexIdWebhookVerificationResult,
  type NexIdWebhookSignatureVersion,
  type NexIdWebhookVerificationAndParseResult,
  type SdkProductResponse,
} from "@product/nexid-server-sdk";

const config = {
  apiKey: "nxid_type_smoke",
  tenantSlug: "type-smoke",
  timeoutMs: 5_000,
  retry: { maxRetries: 1 },
} satisfies NexIdConfig;

const mutationOptions: NexIdMutationRequestOptions = {
  requestId: "erp-42",
  idempotencyKey: "erp-42",
  maxRetries: 1,
};
const signatureVersion: NexIdWebhookSignatureVersion = "v2";
const client = new NexIdClient(config);
const product: Promise<SdkProductResponse> = client.getProduct("LOT-42");
const idempotencyStatus: Promise<NexIdIdempotencyStatus> = client.getIdempotencyStatus("reportEvent", "erp-42");
const webhookEnvelope: NexIdWebhookVerificationAndParseResult = verifyAndParseNexIdWebhook({
  secret: "type-smoke-webhook-secret-value-123456789",
  rawBody: "{}",
  headers: {},
});
const epcisDocument = {
  "@context": "https://ref.gs1.org/standards/epcis/epcis-context.jsonld",
  type: "EPCISDocument",
  schemaVersion: "2.0",
  epcisBody: {
    eventList: [{
      type: "ObjectEvent",
      eventTime: "2026-07-29T12:00:00.000Z",
      eventTimeZoneOffset: "-03:00",
      action: "OBSERVE",
      epcList: ["https://id.nexid.lat/01/09506000134352/10/LOT-42"],
    }],
  },
} satisfies NexIdEpcisDocument;
const epcisCapture: Promise<NexIdEpcisCaptureReceipt> = client.captureEpcisDocument(
  epcisDocument,
  { idempotencyKey: "erp:epcis:42" },
);
const epcisPage: Promise<NexIdEpcisPage<NexIdEpcisQueryDocument>> = client.queryEpcisEvents({
  gtin: "09506000134352",
  limit: 50,
});
const offlineSyncRequest = {
  schemaVersion: 1,
  bundleId: "ovb_0123456789abcdef0123456789abcdef0123",
  deviceId: "d877a64d-5a44-4a02-8d33-efb9f4bc0c74",
  events: [{
    localId: "type-smoke-scan-1",
    capturedUrl: "https://tags.example.test/sun?v=1&bid=LOT-42&picc_data=00112233445566778899AABBCCDDEEFF&enc=00112233445566778899AABBCCDDEEFF&cmac=0011223344556677",
    capturedAt: "2026-08-02T12:00:00.000Z",
    status: "PENDING_BACKEND_VERIFICATION",
  }],
} satisfies OfflineScanSyncRequest;
const offlineSync: Promise<OfflineScanSyncResponse> = client.syncOfflineScans(
  offlineSyncRequest,
  { idempotencyKey: "type-smoke-offline-sync-1" },
);

function requiresAuthenticatedKeyId(result: NexIdWebhookVerificationResult) {
  if (!result.ok || !result.keyIdAuthenticated) return null;
  const authenticated: true = result.keyIdAuthenticated;
  const version: "v2" = result.version;
  void authenticated;
  void version;
  return result.keyId;
}

void mutationOptions;
void signatureVersion;
void product;
void idempotencyStatus;
void webhookEnvelope;
void epcisCapture;
void epcisPage;
void offlineSync;
void NexIdApiError;
void requiresAuthenticatedKeyId;
