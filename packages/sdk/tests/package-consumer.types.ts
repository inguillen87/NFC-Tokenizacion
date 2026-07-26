import {
  NexIdApiError,
  NexIdClient,
  type NexIdConfig,
  type NexIdMutationRequestOptions,
  type NexIdIdempotencyStatus,
  type NexIdWebhookVerificationResult,
  type NexIdWebhookSignatureVersion,
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
void NexIdApiError;
void requiresAuthenticatedKeyId;
