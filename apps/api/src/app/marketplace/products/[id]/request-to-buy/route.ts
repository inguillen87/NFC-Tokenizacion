export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../../../lib/http";
import { getConsumerFromRequest } from "../../../../../lib/consumer-auth";
import { sql } from "../../../../../lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: 'unauthorized' }, 401);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const product = await sql/*sql*/`SELECT id, tenant_id, request_to_buy_enabled FROM marketplace_products WHERE id = ${id} LIMIT 1`;
  if (!product[0]) return json({ ok: false, error: 'product_not_found' }, 404);
  if (!product[0].request_to_buy_enabled) return json({ ok: false, error: 'request_to_buy_disabled' }, 409);

  const rows = await sql/*sql*/`
    INSERT INTO marketplace_order_requests (consumer_id, tenant_id, marketplace_product_id, quantity, consumer_message, contact_json)
    VALUES (${consumer.id}, ${product[0].tenant_id}, ${product[0].id}, ${Number(body.quantity || 1)}, ${body.message || null}, ${JSON.stringify({ email: consumer.email, phone: consumer.phone })}::jsonb)
    RETURNING *
  `;
  return json({ ok: true, orderRequest: rows[0], checkout: 'request_only' });
}
