export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../../lib/http";
import { getConsumerFromRequest } from "../../../../../lib/consumer-auth";
import { sql } from "../../../../../lib/db";

function parseRequestToBuyPayload(payload: Record<string, unknown> | null | undefined) {
  const quantity = Number.parseInt(String(payload?.quantity ?? 1), 10);
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 24) {
    return { ok: false as const, error: "invalid_quantity" };
  }

  const rawMessage = typeof payload?.message === "string" ? payload.message.trim() : "";
  if (rawMessage.length > 500) {
    return { ok: false as const, error: "message_too_long" };
  }

  return {
    ok: true as const,
    value: {
      quantity,
      message: rawMessage || null,
      ageGateAccepted: payload?.ageGateAccepted === true,
    },
  };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseRequestToBuyPayload(body);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);

  const product = await sql/*sql*/`
    SELECT
      p.id,
      p.tenant_id,
      p.status,
      p.request_to_buy_enabled,
      p.age_gate_required,
      mb.status AS brand_status,
      mb.visible_in_network
    FROM marketplace_products p
    JOIN marketplace_brand_profiles mb ON mb.tenant_id = p.tenant_id
    WHERE p.id = ${id}
    LIMIT 1
  `;
  if (!product[0]) return json({ ok: false, error: "product_not_found" }, 404);

  const record = product[0];
  if (String(record.status || "") !== "active") return json({ ok: false, error: "product_not_active" }, 409);
  if (String(record.brand_status || "") !== "active" || record.visible_in_network !== true) {
    return json({ ok: false, error: "brand_not_visible_in_network" }, 409);
  }
  if (!record.request_to_buy_enabled) return json({ ok: false, error: "request_to_buy_disabled" }, 409);
  if (record.age_gate_required && !parsed.value.ageGateAccepted) {
    return json({ ok: false, error: "age_gate_ack_required" }, 400);
  }

  const rows = await sql/*sql*/`
    INSERT INTO marketplace_order_requests (consumer_id, tenant_id, marketplace_product_id, quantity, consumer_message, contact_json)
    VALUES (${consumer.id}, ${record.tenant_id}, ${record.id}, ${parsed.value.quantity}, ${parsed.value.message}, ${JSON.stringify({ email: consumer.email, phone: consumer.phone })}::jsonb)
    RETURNING *
  `;

  return json({ ok: true, orderRequest: rows[0], checkout: "request_only" });
}
