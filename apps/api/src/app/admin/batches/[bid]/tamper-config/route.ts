export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantAccess } from "../../../../../lib/auth";
import { json } from "../../../../../lib/http";
import { sql } from "../../../../../lib/db";

type TamperConfigBody = {
  tagtamper_enabled?: boolean;
  tamper_status_enabled?: boolean;
  tamper_status_source?: "enc_decrypted" | "picc_data_decrypted" | "none" | "enc" | "picc_data" | "decrypted_sdm";
  tamper_status_offset?: number | null;
  tamper_status_length?: number | null;
  tamper_closed_values?: Array<string | number>;
  tamper_open_values?: Array<string | number>;
  tamper_unknown_policy?: "UNKNOWN" | "DO_NOT_DISPLAY";
  tamper_notes?: string | null;
  ttstatus_enabled?: boolean;
  ttstatus_source?: "enc_decrypted" | "picc_data_decrypted" | "none" | "enc" | "picc_data" | "decrypted_sdm";
  ttstatus_offset?: number | null;
  ttstatus_plain_or_encrypted?: "plain" | "encrypted";
  ttstatus_notes?: string | null;
};

const STANDARD_CLOSED_VALUES = ["4343"];
const STANDARD_OPEN_VALUES = ["4F4F", "4F43"];
const STANDARD_INVALID_VALUES = ["4949"];

function normalizeValues(values: unknown, fallback: string[]) {
  const source = Array.isArray(values) ? values : fallback;
  const normalized = source.map((v) => String(v).trim().toUpperCase()).filter(Boolean);
  return normalized.length ? normalized : fallback;
}

export async function PATCH(req: Request, context: { params: Promise<{ bid: string }> }) {
  const auth = await checkAdmin(req);
  if (auth) return auth;

  const { bid } = await context.params;
  const body = (await req.json().catch(() => ({}))) as TamperConfigBody;
  if (!bid) return json({ ok: false, reason: "bid required" }, 400);

  const sourceInput = String(body.ttstatus_source || body.tamper_status_source || "none").toLowerCase();
  const source = sourceInput === "enc" || sourceInput === "decrypted_sdm" || sourceInput === "enc_decrypted"
    ? "enc_decrypted"
    : sourceInput === "picc_data" || sourceInput === "picc_data_decrypted"
      ? "picc_data_decrypted"
      : "none";

  const nextConfig = {
    tagtamper_enabled: body.tagtamper_enabled == null ? true : Boolean(body.tagtamper_enabled),
    tamper_status_enabled: Boolean(body.tamper_status_enabled ?? body.ttstatus_enabled),
    tamper_status_source: source,
    tamper_status_offset: Number.isInteger(Number(body.ttstatus_offset ?? body.tamper_status_offset)) ? Number(body.ttstatus_offset ?? body.tamper_status_offset) : null,
    tamper_status_length: Number.isInteger(Number(body.tamper_status_length)) ? Number(body.tamper_status_length) : 2,
    tamper_closed_values: normalizeValues(body.tamper_closed_values, STANDARD_CLOSED_VALUES),
    tamper_open_values: normalizeValues(body.tamper_open_values, STANDARD_OPEN_VALUES),
    tamper_invalid_values: STANDARD_INVALID_VALUES,
    tamper_unknown_policy: ["UNKNOWN", "DO_NOT_DISPLAY"].includes(String(body.tamper_unknown_policy || "")) ? body.tamper_unknown_policy : "UNKNOWN",
    tamper_notes: body.tamper_notes ? String(body.tamper_notes) : null,
    ttstatus_enabled: Boolean(body.ttstatus_enabled ?? body.tamper_status_enabled),
    ttstatus_source: source,
    ttstatus_offset: Number.isInteger(Number(body.ttstatus_offset ?? body.tamper_status_offset)) ? Number(body.ttstatus_offset ?? body.tamper_status_offset) : null,
    ttstatus_length: 2,
    ttstatus_closed_values: STANDARD_CLOSED_VALUES,
    ttstatus_opened_values: STANDARD_OPEN_VALUES,
    ttstatus_invalid_values: STANDARD_INVALID_VALUES,
    ttstatus_plain_or_encrypted: String(body.ttstatus_plain_or_encrypted || "encrypted").toLowerCase() === "plain" ? "plain" : "encrypted",
    ttstatus_notes: body.ttstatus_notes ? String(body.ttstatus_notes) : null,
  };

  const { forcedTenantSlug } = getAdminTenantAccess(req);
  const batches = forcedTenantSlug
    ? await sql/*sql*/`
      SELECT b.id, b.status, b.created_at
      FROM batches b
      JOIN tenants t ON t.id = b.tenant_id
      WHERE b.bid = ${bid} AND t.slug = ${forcedTenantSlug}
      ORDER BY b.created_at ASC, b.id ASC
    `
    : await sql/*sql*/`
      SELECT id, status, created_at
      FROM batches
      WHERE bid = ${bid}
      ORDER BY created_at ASC, id ASC
    `;
  if (!batches[0]) return json({ ok: false, reason: "batch not found" }, 404);
  if (batches.length > 1) {
    return json({
      ok: false,
      reason: "DUPLICATE_BID",
      message: "BID must be globally unique before updating tamper config.",
      batches: batches.map((row) => ({ id: row.id, status: row.status || null, created_at: row.created_at || null })),
    }, 409);
  }

  const updated = await sql/*sql*/`
    UPDATE batches
    SET sdm_config = COALESCE(sdm_config, '{}'::jsonb) || ${JSON.stringify(nextConfig)}::jsonb
    WHERE id = ${batches[0].id}
    RETURNING id, bid, sdm_config
  `;

  return json({ ok: true, bid: updated[0].bid, tamper_config: nextConfig });
}
