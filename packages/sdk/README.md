# nexID server SDK

Private TypeScript SDK for nexID's existing server-side API v1. It is intentionally unavailable in browser runtimes so an API key never reaches a consumer device.

> This workspace package is not published to npm yet. Use it from the nexID monorepo or an approved private package source; do not advertise a public install command.

## Runtime and package contract

- Node.js `>=20.11.1`, ESM only.
- `npm run build --workspace=@product/nexid-server-sdk` emits JavaScript, source maps, declarations and declaration maps under `dist/`.
- Package `exports`, `main`, `module` and `types` resolve only built files from `dist/`; consumers never execute `src/index.ts`.
- `npm run check --workspace=@product/nexid-server-sdk` validates source behavior, strict types, the built ESM consumer and the exact `npm pack` file list.

The package remains `private: true`. Building or packing it locally does not publish it.

## Machine-readable API contract

The server API surface used by this package is published as OpenAPI 3.1 at
`https://api.nexid.lat/openapi/nexid-sdk-v1.json`. Its source lives in
`apps/api/public/openapi/nexid-sdk-v1.json` and is regression-tested against the
SDK v1 route list, required request fields, server-only authentication,
durable idempotency guarantees and uncertain-write reconciliation contract.

Treat the document as the v1 integration contract, not as permission to expose
an API key in a browser. The package remains the preferred Node.js integration
because it also enforces timeouts, typed errors, mutation retry policy and
webhook signature verification.

## Five-minute server quickstart

```ts
import { NexIdApiError, NexIdClient } from "@product/nexid-server-sdk";

const nexid = new NexIdClient({
  apiKey: process.env.NEXID_API_KEY!,
  tenantSlug: process.env.NEXID_TENANT_SLUG!,
});

try {
  const product = await nexid.getProduct("SYNGENTA-2026-001");
  console.log(product.product);
} catch (error) {
  if (error instanceof NexIdApiError) {
    console.error({
      status: error.status,
      reason: error.reason,
      traceId: error.traceId,
      retryAfterSeconds: error.retryAfter,
    });
  }
  throw error;
}
```

Keep `NEXID_API_KEY` in a backend, BFF, secret manager or protected server environment. Never prefix it with `NEXT_PUBLIC_`, `VITE_` or another client-exposed convention.

## Requests, timeouts and cancellation

The default timeout is 15 seconds per attempt. Reads retry at most twice after
HTTP `429`, `5xx` or a transport failure. Mutations default to one attempt; only
the four supported SDK mutations with an explicit `idempotencyKey` may retry.

```ts
const nexid = new NexIdClient({
  apiKey: process.env.NEXID_API_KEY!,
  tenantSlug: "syngenta",
  timeoutMs: 8_000,
  retry: { maxRetries: 2, baseDelayMs: 200, maxDelayMs: 2_000 },
});

const controller = new AbortController();
const product = await nexid.getProduct("SYNGENTA-2026-001", {
  signal: controller.signal,
  requestId: "erp-sync-2026-07-26-001",
  timeoutMs: 5_000,
});
```

Every request carries `x-nexid-sdk-version`, a server-side user agent and a trace id. Pass a stable `requestId` to correlate nexID telemetry with your logs; otherwise the SDK creates one.

## Durable mutation idempotency and reconciliation

```ts
const result = await nexid.reportEvent(
  {
    eventType: "shipment.received",
    bid: "SYNGENTA-2026-001",
    source: "warehouse-wms",
    occurredAt: new Date().toISOString(),
  },
  {
    requestId: "wms-receipt-48392",
    idempotencyKey: "wms-receipt-48392",
    maxRetries: 2,
  },
);
```

`verifyTap`, `claimOwnership`, `reportEvent` and `activatePosPurchase` implement
durable idempotency scoped by tenant, route and key. nexID computes a canonical
request hash: the same key and equivalent JSON replay the original HTTP status
and body; the same key with a different payload returns `409
idempotency_key_payload_mismatch`. Stored response bodies are encrypted because
POS responses contain a one-time bearer token. Records remain queryable for
seven days.

The API writes a versioned encryption envelope containing a non-secret key ID.
Operators rotate `SDK_IDEMPOTENCY_MASTER_KEY_HEX` by assigning a new active key
and retaining the old key in `SDK_IDEMPOTENCY_PREVIOUS_KEYS_JSON`, keyed by its
original ID, for at least the complete seven-day record TTL plus deployment
overlap. Both replay decryption and canonical request-hash comparison consult
that active/previous keyring. An unknown key ID fails closed; deleting an old
key before its retention window expires makes those historical responses
unreplayable. A future longer retention policy must lengthen this overlap or run
an audited rewrap job first.

The SDK retries a supported mutation only when `idempotencyKey` is explicit.
Without a key, every mutation is attempted once. The three logistics routes do
not yet implement this server guarantee and are therefore never retried by the
SDK, even if callers pass a key as correlation metadata.

After a timeout or `503`, reconcile with the original key; never invent a new
key for the same business operation:

```ts
const status = await nexid.getIdempotencyStatus(
  "reportEvent",
  "wms-receipt-48392",
);

if (status.state === "uncertain") {
  const reconciled = await nexid.reconcileIdempotency(
    "reportEvent",
    "wms-receipt-48392",
  );
  // This scans durable linkage and safely re-enqueues missing outbox rows.
  // It never executes the business mutation again.
  console.log(
    reconciled.operationCommitted,
    reconciled.resourceId,
    reconciled.reconciliationStatus,
  );
}
```

To retrieve a stored response, send the exact original mutation with the same
key. `processing` means wait and poll. `uncertain` means do not use a new key;
inspect `resourceId` and reconcile downstream delivery. A different payload is
never accepted under an existing key.

Webhook-producing mutation responses include `webhookOutbox`. `confirmed`
means every currently enabled matching tenant endpoint has a durable outbox row;
`not_configured` means there was no matching endpoint and no delivery was
promised. At-least-once semantics begin only for a confirmed row. If enqueue
cannot be verified, the API returns HTTP `503` with `traceId`, `resourceId` and
`operationCommitted`; inspect `NexIdApiError.body` and call
`reconcileIdempotency`. Reconciliation binds the durable business resource and
re-enqueues only missing, deterministically deduplicated webhook outbox rows; it
never reruns the original business mutation. A `503` does not imply that the
business write was rolled back.

## Existing API surface

| SDK method | HTTP route | Required API-key scope |
| --- | --- | --- |
| `verifyTap` | `POST /api/v1/sdk/verify` | `sdk:verify` |
| `claimOwnership` | `POST /api/v1/sdk/claim` | `sdk:claim` |
| `getProduct` | `GET /api/v1/sdk/products/:bid` | `sdk:products` |
| `reportEvent` | `POST /api/v1/sdk/events` | `sdk:events` |
| `activatePosPurchase` | `POST /api/v1/sdk/pos/activate` | `sdk:pos` |
| `getIdempotencyStatus` | `GET /api/v1/sdk/idempotency/status?operation=...` + `Idempotency-Key` | Scope of the original operation |
| `reconcileIdempotency` | `POST /api/v1/sdk/idempotency/status?operation=...` + `Idempotency-Key` | Scope of the original operation |
| `applyDeliverySeal` | `POST /api/v1/logistics/seal-apply` | `sdk:logistics` |
| `handoffDeliverySeal` | `POST /api/v1/logistics/handoff` | `sdk:logistics` |
| `verifyDeliverySeal` | `POST /api/v1/logistics/recipient-verify` | `sdk:logistics` |

There is no public sandbox endpoint. For an approved local or private deployment use `environment: "private"` with an explicit `apiBaseUrl`.

## Webhooks: verify the raw body first

The signature covers the exact bytes delivered by nexID. Never parse JSON and serialize it again before verification. After a valid signature, persist `deliveryId` with a uniqueness constraint before processing to reject replayed deliveries.

### Signature envelopes and v2 migration

`verifyNexIdWebhookSignature` accepts two explicit envelopes based on `x-nexid-signature-version`; it never falls back from a failed v2 verification to v1.

- **v1 legacy:** authenticates timestamp, delivery ID, event ID and raw body. `keyId` is required as routing metadata but is **not authenticated**. A valid result explicitly returns `keyIdAuthenticated: false`. Resolve the v1 secret from a trusted endpoint/tenant binding; never trust the header alone to cross tenant boundaries.
- **v2 preferred:** also authenticates the byte-length-framed `keyId` and returns `keyIdAuthenticated: true`.

The v2 signed bytes are defined exactly as:

```text
prefix = UTF8(joinWithDot([
  "v2",
  decimal(timestamp),
  utf8ByteLength(keyId), keyId,
  utf8ByteLength(deliveryId), deliveryId,
  utf8ByteLength(eventId), eventId,
  rawBodyByteLength,
  ""
]))

signedPayload = prefix || rawBodyExactBytes
signature = lowercaseHex(HMAC_SHA256(secret, signedPayload))
x-nexid-signature = "v2=" || signature
```

The empty final field makes `prefix` end in a literal dot immediately before the raw bytes. All lengths are byte lengths in UTF-8, not JavaScript character counts. The unchanged v1 prefix omits `utf8ByteLength(keyId), keyId` and starts with `"v1"`.

Safe rollout:

1. Deploy this dual-version verifier to consumers.
2. Continue accepting v1 while the producer is migrated explicitly to v2.
3. Observe `verification.version`, require `verification.keyIdAuthenticated` before trusting key identity, and monitor delivery failures.
4. Once a tenant has no v1 deliveries in the agreed window, enforce v2 in application policy:

```ts
if (verification.ok && verification.version !== "v2") {
  return Response.json({ ok: false, reason: "webhook_v2_required" }, { status: 401 });
}
```

Adding v2 support to this SDK does not silently change the server-side webhook producer.

### Next.js App Router (Node runtime)

```ts
import { verifyNexIdWebhookSignature } from "@product/nexid-server-sdk";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = new Uint8Array(await request.arrayBuffer());
  const verification = verifyNexIdWebhookSignature({
    secret: process.env.NEXID_WEBHOOK_SECRET!,
    rawBody,
    headers: request.headers,
  });

  if (!verification.ok) {
    return Response.json({ ok: false, reason: verification.reason }, { status: 401 });
  }

  // Atomically reserve verification.deliveryId before side effects.
  const event = JSON.parse(Buffer.from(rawBody).toString("utf8"));
  await processNexIdEvent(event, verification.deliveryId);
  return Response.json({ ok: true });
}
```

### Express

Register the raw route before any global `express.json()` middleware.

```ts
import express from "express";
import { verifyNexIdWebhookSignature } from "@product/nexid-server-sdk";

const app = express();

app.post("/webhooks/nexid", express.raw({ type: "application/json" }), async (req, res) => {
  const verification = verifyNexIdWebhookSignature({
    secret: process.env.NEXID_WEBHOOK_SECRET!,
    rawBody: req.body,
    headers: req.headers,
  });
  if (!verification.ok) return res.status(401).json({ ok: false, reason: verification.reason });

  // Enforce a unique deliveryId in durable storage before processing.
  const event = JSON.parse(req.body.toString("utf8"));
  await processNexIdEvent(event, verification.deliveryId);
  return res.status(200).json({ ok: true });
});

app.use(express.json());
```

The verifier rejects weak secrets, missing headers, unsupported signature versions, malformed timestamps, stale deliveries and signature mismatches with stable `reason` values. Its default timestamp tolerance is five minutes.
