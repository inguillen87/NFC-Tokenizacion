export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../../lib/auth";
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
};

export async function PATCH(req: Request, context: { params: Promise<{ bid: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { bid } = await context.params;
  const body = (await req.json().catch(() => ({}))) as TamperConfigBody;
  if (!bid) return json({ ok: false, reason: "bid required" }, 400);

  const sourceInput = String(body.tamper_status_source || "none").toLowerCase();
  const source = sourceInput === "enc" || sourceInput === "decrypted_sdm" || sourceInput === "enc_decrypted"
    ? "enc_decrypted"
    : sourceInput === "picc_data" || sourceInput === "picc_data_decrypted"
      ? "picc_data_decrypted"
      : "none";

  const nextConfig = {
    tagtamper_enabled: Boolean(body.tagtamper_enabled),
    tamper_status_enabled: Boolean(body.tamper_status_enabled),
    tamper_status_source: source,
    tamper_status_offset: Number.isInteger(Number(body.tamper_status_offset)) ? Number(body.tamper_status_offset) : null,
    tamper_status_length: Number.isInteger(Number(body.tamper_status_length)) ? Number(body.tamper_status_length) : 1,
    tamper_closed_values: Array.isArray(body.tamper_closed_values) ? body.tamper_closed_values.map((v) => String(v).trim().toUpperCase()).filter(Boolean) : [],
    tamper_open_values: Array.isArray(body.tamper_open_values) ? body.tamper_open_values.map((v) => String(v).trim().toUpperCase()).filter(Boolean) : [],
    tamper_unknown_policy: ["UNKNOWN", "DO_NOT_DISPLAY"].includes(String(body.tamper_unknown_policy || "")) ? body.tamper_unknown_policy : "UNKNOWN",
    tamper_notes: body.tamper_notes ? String(body.tamper_notes) : null,
  };

  const updated = await sql/*sql*/`
    UPDATE batches
    SET sdm_config = COALESCE(sdm_config, '{}'::jsonb) || ${JSON.stringify(nextConfig)}::jsonb
    WHERE bid = ${bid}
    RETURNING id, bid, sdm_config
  `;

  if (!updated[0]) return json({ ok: false, reason: "batch not found" }, 404);
  return json({ ok: true, bid: updated[0].bid, tamper_config: nextConfig });
}
