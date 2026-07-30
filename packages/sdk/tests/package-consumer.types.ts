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
void NexIdApiError;
void requiresAuthenticatedKeyId;
