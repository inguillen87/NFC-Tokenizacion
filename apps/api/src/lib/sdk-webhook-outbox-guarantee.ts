import { dispatchTenantWebhooks } from "./sdk-webhooks";

export type SdkWebhookOutboxReceipt = {
  status: "confirmed" | "not_configured";
  eventId: string | null;
  attempted: number;
  confirmed: number;
  queued: number;
  deduplicated: number;
};

type DispatchInput = Parameters<typeof dispatchTenantWebhooks>[0];
type DispatchResult = Awaited<ReturnType<typeof dispatchTenantWebhooks>>;
type Dispatcher = (input: DispatchInput) => Promise<DispatchResult>;

export class SdkWebhookOutboxUnavailableError extends Error {
  readonly code = "webhook_outbox_unavailable";
  readonly retryable = true;
  readonly correlationId: string;
  readonly resourceId: string | null;

  constructor(input: { correlationId: string; resourceId?: string | null; cause?: unknown }) {
    super("Webhook outbox enqueue could not be durably confirmed", { cause: input.cause });
    this.name = "SdkWebhookOutboxUnavailableError";
    this.correlationId = input.correlationId;
    this.resourceId = input.resourceId || null;
  }
}

function toReceipt(result: DispatchResult): SdkWebhookOutboxReceipt {
  const attempted = Number(result.attempted || 0);
  const confirmed = Number(result.confirmed || 0);
  if (!Number.isSafeInteger(attempted) || attempted < 0 || !Number.isSafeInteger(confirmed) || confirmed !== attempted) {
    throw new Error("webhook_outbox_receipt_unconfirmed");
  }
  return {
    status: attempted > 0 ? "confirmed" : "not_configured",
    eventId: result.eventId || null,
    attempted,
    confirmed,
    queued: Number(result.queued || 0),
    deduplicated: Number(result.deduplicated || 0),
  };
}

export async function enqueueSdkWebhookGuaranteed(
  input: DispatchInput & { correlationId: string; resourceId?: string | null },
  options: { dispatch?: Dispatcher; maxAttempts?: number } = {},
): Promise<SdkWebhookOutboxReceipt> {
  const dispatch = options.dispatch || dispatchTenantWebhooks;
  const maxAttempts = Math.min(Math.max(Math.floor(options.maxAttempts ?? 2), 1), 3);
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return toReceipt(await dispatch(input));
    } catch (error) {
      lastError = error;
    }
  }
  throw new SdkWebhookOutboxUnavailableError({
    correlationId: input.correlationId,
    resourceId: input.resourceId,
    cause: lastError,
  });
}

export function sdkWebhookOutboxUnavailableBody(error: SdkWebhookOutboxUnavailableError) {
  return {
    ok: false,
    reason: error.code,
    retryable: error.retryable,
    operationCommitted: Boolean(error.resourceId),
    resourceId: error.resourceId,
    traceId: error.correlationId,
    recovery: error.resourceId
      ? "Reconcile using resourceId before replaying the business mutation. The same webhook event ID is deduplicated when enqueue is retried."
      : "Retry the request with the same idempotency key after the outbox is available.",
  };
}
