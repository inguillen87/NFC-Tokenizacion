import { createHmac, randomUUID } from "node:crypto";

import { ensureSdkSchema } from "./commercial-runtime-schema";
import { sql } from "./db";

function parseEvents(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parseEvents(parsed);
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function endpointMatches(events: string[], eventName: string) {
  return events.includes("*") || events.includes(eventName);
}

function signature(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

export async function dispatchTenantWebhooks(input: {
  tenantId: string | null | undefined;
  eventName: string;
  payload: Record<string, unknown>;
}) {
  if (!input.tenantId) return { attempted: 0, delivered: 0 };
  await ensureSdkSchema();

  const endpoints = await sql/*sql*/`
    SELECT id::text AS id, url, signing_secret, events
    FROM webhook_endpoints
    WHERE tenant_id = ${input.tenantId}
      AND enabled = true
    ORDER BY updated_at DESC
    LIMIT 25
  `;

  let attempted = 0;
  let delivered = 0;
  for (const endpoint of endpoints as Array<Record<string, unknown>>) {
    const events = parseEvents(endpoint.events);
    if (!endpointMatches(events, input.eventName)) continue;
    attempted += 1;
    const payload = {
      id: `evt_${randomUUID()}`,
      type: input.eventName,
      createdAt: new Date().toISOString(),
      data: input.payload,
    };
    const body = JSON.stringify(payload);
    const deliveryRows = await sql/*sql*/`
      INSERT INTO webhook_deliveries (endpoint_id, event_name, payload, attempt_count)
      VALUES (${String(endpoint.id)}, ${input.eventName}, ${JSON.stringify(payload)}::jsonb, 1)
      RETURNING id::text AS id
    `;
    const deliveryId = String((deliveryRows[0] as { id?: string } | undefined)?.id || "");

    try {
      const secret = String(endpoint.signing_secret || "");
      const response = await fetch(String(endpoint.url), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "nexID-webhooks/1.0",
          "x-nexid-event": input.eventName,
          "x-nexid-delivery": deliveryId,
          ...(secret ? { "x-nexid-signature": `sha256=${signature(secret, body)}` } : {}),
        },
        body,
        cache: "no-store",
      });
      const ok = response.status >= 200 && response.status < 300;
      if (ok) delivered += 1;
      await sql/*sql*/`
        UPDATE webhook_deliveries
        SET ok = ${ok}, status_code = ${response.status}, delivered_at = ${ok ? new Date().toISOString() : null}, last_error = ${ok ? null : `HTTP ${response.status}`}
        WHERE id = ${deliveryId}
      `;
    } catch (error) {
      await sql/*sql*/`
        UPDATE webhook_deliveries
        SET ok = false, last_error = ${error instanceof Error ? error.message : "webhook_delivery_failed"}
        WHERE id = ${deliveryId}
      `;
    }
  }

  return { attempted, delivered };
}
